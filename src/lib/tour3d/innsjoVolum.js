// Innsjøen som et volum i 3D: senket bunn, gjennomsiktig vannflate, strandlinje
// i flata og dybdekurvene draperte på bunnen.
//
// Terrenget er SAMME mesh over og under vann — bunnen er senket inn i DEM-et
// før meshen bygges (senketDem i innsjoBunn.js), så strand og bunn henger
// sammen per konstruksjon. Det som legges til her er bare det som gjør bunnen
// lesbar gjennom flata:
//   • en dybde-toning på terrengets vertekser (multipliseres med karttekstur),
//   • vannflata i innsjønivå, gjennomsiktig og uten dybde-skriving,
//   • strandlinja som en lys strek i flata — der overflaten ER,
//   • dybdekurvene på bunnen, så formen kan leses uten å fly rundt.

import {
  BufferGeometry, BufferAttribute, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry,
} from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { settLinjeSegmenter } from './linjeSegmenter.js'

const GRUNT = new Color(0.82, 0.93, 1.0)
const DYPT = new Color(0.12, 0.26, 0.5)
const VANN = 0x2f7fc4
// Flata sett nedenfra: lysere og tettere, så den leses som «lys der oppe».
const VANN_UNDER = 0x9fd3ff
const STRAND = 0xe8f6ff
// Dykke-ringen er like stor på skjermen uansett avstand, som trykk-ringene i
// himmelen: en affordanse måles i piksler.
const RING_PX = 44

/**
 * Tone terrengets vertekser etter dybde. Vertekser utenfor innsjøen får hvitt,
 * altså uendret tekstur. Skjørt-verteksene bak gitteret får også hvitt.
 */
export function tonBunn(geometry, material, bunn, cols, rows) {
  const n = geometry.getAttribute('position').count
  const farger = new Float32Array(n * 3).fill(1)
  const c = new Color()
  const maks = bunn.maksDybde || 1
  for (let i = 0; i < cols * rows; i++) {
    if (!bunn.maske[i]) continue
    const t = Math.min(1, Math.max(0, bunn.dybde[i] / maks))
    c.copy(GRUNT).lerp(DYPT, Math.sqrt(t))
    farger[i * 3] = c.r; farger[i * 3 + 1] = c.g; farger[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new BufferAttribute(farger, 3))
  material.vertexColors = true
  material.needsUpdate = true
}

function linjer(segmenter, { color, linewidth, opacity }) {
  const geo = new LineSegmentsGeometry()
  settLinjeSegmenter(geo, segmenter)
  const mat = new LineMaterial({ color, linewidth, transparent: opacity < 1, opacity })
  const obj = new LineSegments2(geo, mat)
  obj.frustumCulled = false
  return { obj, geo, mat }
}

/**
 * @param {{bunn: object, dem: object, coords: object, innsjo: object, faktor: number}} p
 *   dem er det DESIMERTE gitteret bunnen er regnet på; innsjo har omriss og
 *   kurver i SVG-meter.
 */
export function buildInnsjoVolum({ bunn, dem, coords, innsjo, faktor, dykkPunkt = null }) {
  const { cols, rows, transform } = dem
  const pw = transform.pixelWidth
  const ph = transform.pixelHeight
  const group = new Group()
  const geometries = []
  const materials = []
  const lineMats = []

  // Vannflata: hver gittercelle med minst ett hjørne i innsjøen, i nivået. Litt
  // over nivået så den ikke z-kjemper med strandvertekser som står nøyaktig der.
  const yFlate = coords.elevToWorldY(bunn.nivaa) + 0.4
  const { c0, c1, r0, r1 } = bunn.ramme
  const pos = []
  const idx = []
  const vert = new Map()
  const v = (c, r) => {
    const k = r * cols + c
    let i = vert.get(k)
    if (i === undefined) {
      i = pos.length / 3
      const [x, , z] = coords.toWorld(c * pw, r * ph, 0)
      pos.push(x, yFlate, z)
      vert.set(k, i)
    }
    return i
  }
  for (let r = Math.max(0, r0 - 1); r <= Math.min(rows - 2, r1); r++) {
    for (let c = Math.max(0, c0 - 1); c <= Math.min(cols - 2, c1); c++) {
      const a = r * cols + c
      if (!(bunn.maske[a] || bunn.maske[a + 1] || bunn.maske[a + cols] || bunn.maske[a + cols + 1])) continue
      const ia = v(c, r), ib = v(c + 1, r), id = v(c, r + 1), ie = v(c + 1, r + 1)
      idx.push(ia, id, ib, ib, id, ie)
    }
  }
  let flateMat = null
  if (idx.length) {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setIndex(idx)
    geo.computeBoundingSphere()
    const mat = new MeshBasicMaterial({
      color: VANN, transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide,
    })
    flateMat = mat
    const flate = new Mesh(geo, mat)
    flate.renderOrder = 2
    group.add(flate)
    geometries.push(geo); materials.push(mat)
  }

  // Strandlinja i flata.
  const strand = []
  for (const ring of innsjo.omriss) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = coords.toWorld(ring[i][0], ring[i][1], 0)
      const b = coords.toWorld(ring[i + 1][0], ring[i + 1][1], 0)
      strand.push(a[0], yFlate + 0.3, a[2], b[0], yFlate + 0.3, b[2])
    }
  }
  if (strand.length) {
    const l = linjer(strand, { color: STRAND, linewidth: 2, opacity: 0.9 })
    group.add(l.obj); geometries.push(l.geo); lineMats.push(l.mat)
  }

  // Dybdekurvene på bunnen, i hver kurves egen dybde. Litt over bunnen, så de
  // ikke forsvinner i terrenget der interpolasjonen ligger nøyaktig på kurven.
  const kurver = []
  for (const k of innsjo.kurver) {
    if (k.type !== 0 || !(k.dybde > 0)) continue
    const y = coords.elevToWorldY(bunn.nivaa - k.dybde * faktor) + 0.6
    const p = k.punkter
    for (let i = 0; i + 1 < p.length; i++) {
      const a = coords.toWorld(p[i][0], p[i][1], 0)
      const b = coords.toWorld(p[i + 1][0], p[i + 1][1], 0)
      kurver.push(a[0], y, a[2], b[0], y, b[2])
    }
  }
  if (kurver.length) {
    const l = linjer(kurver, { color: 0x0b3a6e, linewidth: 1.4, opacity: 0.7 })
    group.add(l.obj); geometries.push(l.geo); lineMats.push(l.mat)
  }

  // Dykke-ringen: to ringer flatt i vannflata over det dypeste punktet.
  let ring = null
  if (dykkPunkt) {
    const [rx, , rz] = coords.toWorld(dykkPunkt.x, dykkPunkt.y, 0)
    ring = new Group()
    for (const [inn, ut, opasitet] of [[0.86, 1, 0.95], [0.3, 0.4, 0.8]]) {
      const geo = new RingGeometry(inn, ut, 48)
      const mat = new MeshBasicMaterial({
        color: STRAND, transparent: true, opacity: opasitet, depthWrite: false, side: DoubleSide, fog: false,
      })
      const m = new Mesh(geo, mat)
      m.rotation.x = -Math.PI / 2
      m.renderOrder = 3
      ring.add(m)
      geometries.push(geo); materials.push(mat)
    }
    ring.position.set(rx, yFlate + 0.5, rz)
    group.add(ring)
  }

  // Midtpunkt og radius for kamera-innrammingen.
  const [cx, , cz] = coords.toWorld(((c0 + c1) / 2) * pw, ((r0 + r1) / 2) * ph, 0)
  const radius = Math.max((c1 - c0) * Math.abs(pw), (r1 - r0) * Math.abs(ph)) / 2

  return {
    group,
    senter: { x: cx, y: yFlate, z: cz },
    radius,
    flateY: yFlate,
    setResolution(w, h) { for (const m of lineMats) m.resolution.set(w, h) },
    /** Flata sett nedenfra eller ovenfra. */
    settUnderside(paa) {
      if (!flateMat) return
      flateMat.color.setHex(paa ? VANN_UNDER : VANN)
      flateMat.opacity = paa ? 0.55 : 0.3
    },
    /** Hold ringen RING_PX bred på skjermen; skjul den under et dykk. */
    oppdaterRing(camera, hoydePx, synlig, tidS = 0) {
      if (!ring) return
      ring.visible = synlig
      if (!synlig) return
      const avstand = camera.position.distanceTo(ring.position)
      const verdenPrPx = (2 * avstand * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, hoydePx)
      const puls = 1 + 0.08 * Math.sin(tidS * 3)
      ring.scale.setScalar((RING_PX / 2) * verdenPrPx * puls)
    },
    /** Ringens skjermposisjon-kandidat: world-punktet den står i. */
    get ringPunkt() { return ring ? ring.position : null },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const m of lineMats) m.dispose()
    },
  }
}

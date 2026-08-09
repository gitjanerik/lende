// Stinettet drapert i terrenget.
//
// Poenget er å kunne se OM og HVOR det finnes sti i kartet, fra hvilken som
// helst høyde. På terrengteksturen forsvinner en 0,25 mm ISOM-strek så snart
// man zoomer ut, så nettet tegnes som egne vektorlinjer med piksel-bredde
// (samme LineSegments2-teknikk som høydekurvene) og litt varmere farge enn
// underlaget. Stier og kjøreveier skilles, men begge skal leses på avstand.
//
// Linjene løftes noen meter over bakken. Lavere enn det, og de forsvinner inn
// i terrenget i bratte skråninger der mesh-oppløsningen (512 celler) ikke
// klarer å følge stien nøyaktig.

import { Group } from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { sampleElevation } from '../demSampling.js'

// Sti (505/506/507) vs kjørbar veg (503/504/509). Fargene er valgt for
// kontrast mot ISOM-underlaget, ikke for å matche det: nettet er et overlegg
// man slår på for å orientere seg.
const STI_KODER = new Set(['505', '506', '507'])
const STI_COLOR = 0xd6371f
const VEG_COLOR = 0x8a5a1e

// Klipp lange segmenter så linja følger terrenget i stedet for å skjære
// gjennom rygger. 25 m matcher omtrent DEM-oppløsningen etter desimering.
const MAX_SEG_M = 25

export function buildPathNetwork(features, dem, coords, { liftM = 4 } = {}) {
  const group = new Group()
  const geometries = []
  const materials = []

  const yAt = (x, y) => {
    const e = sampleElevation(dem, x, y)
    return coords.toWorld(x, y, (Number.isFinite(e) ? e : 0) + liftM)
  }

  const pushDraped = (pts, x1, y1, x2, y2) => {
    const d = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.max(1, Math.ceil(d / MAX_SEG_M))
    let prev = yAt(x1, y1)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const next = yAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
      pts.push(prev[0], prev[1], prev[2], next[0], next[1], next[2])
      prev = next
    }
  }

  const emit = (wantSti) => {
    const pts = []
    for (const f of features ?? []) {
      const isSti = STI_KODER.has(f.isomCode)
      if (isSti !== wantSti) continue
      const c = f.coordinates
      for (let i = 0; i + 1 < c.length; i++) {
        pushDraped(pts, c[i][0], c[i][1], c[i + 1][0], c[i + 1][1])
      }
    }
    if (!pts.length) return
    const geo = new LineSegmentsGeometry()
    geo.setPositions(pts)
    const mat = new LineMaterial({
      color: wantSti ? STI_COLOR : VEG_COLOR,
      linewidth: wantSti ? 2.6 : 3.4,
      transparent: true,
      opacity: wantSti ? 0.95 : 0.8,
      depthTest: true,
    })
    geometries.push(geo)
    materials.push(mat)
    const lines = new LineSegments2(geo, mat)
    lines.frustumCulled = false
    group.add(lines)
  }

  emit(false)   // veger under
  emit(true)    // stier over

  return {
    group,
    geometries,
    materials,
    get isEmpty() { return geometries.length === 0 },
    setVisible(v) { group.visible = !!v },
    setResolution(w, h) {
      for (const m of materials) m.resolution.set(w, h)
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}

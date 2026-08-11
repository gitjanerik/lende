// Endepunkt- og parkeringmarkører i 3D: start (grønn), mål (rød, A→B) og
// delmål/vendepunkter (oransje) er knappenåler som stikker opp fra
// terrenget — lavere enn POI-strålen, men med avstandsavhengig overdrivelse
// så de synes helt i horisonten. Nålene og nærmeste utfartsparkering
// («P»-billboard) står ALLTID (v3.0.27) — brukeren skal aldri miste start/
// mål/vendepunkt av syne. Kun hjem-skiltet (pause-billboard) følger
// UI-togglen (setPinsVisible), sammen med POI-koreografien i viewer-laget.

import {
  SphereGeometry, CylinderGeometry, MeshBasicMaterial, Mesh, Group,
  CanvasTexture, SpriteMaterial, Sprite, SRGBColorSpace,
} from 'three'
import { PIN_STEM_H, PIN_STEM_R, PIN_HEAD_R, drapedWorld, pinScaleAt } from './pinField.js'

const COLOR_START = 0x16a34a
const COLOR_DEST = 0xdc2626
const COLOR_VIA = 0xf59e0b

function parkingTexture() {
  const px = 128
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1d4ed8'
  roundRect(ctx, 8, 8, px - 16, px - 16, 26)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 6
  roundRect(ctx, 8, 8, px - 16, px - 16, 26)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 84px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('P', px / 2, px / 2 + 6)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// «Hjem»-skilt: 180-graders pil i bue (U-sving) på varm brun bunn —
// vendepunktet der turen snur hjemover (typisk rasteplassen ved vannet).
function uTurnTexture() {
  const px = 128
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#92400e'
  roundRect(ctx, 8, 8, px - 16, px - 16, 26)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 6
  roundRect(ctx, 8, 8, px - 16, px - 16, 26)
  ctx.stroke()
  // Opp høyre ben, 180° bue over toppen, ned venstre ben …
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(82, 98)
  ctx.lineTo(82, 58)
  ctx.arc(64, 58, 18, 0, Math.PI, true)
  ctx.lineTo(46, 76)
  ctx.stroke()
  // … med pilhode nederst på venstre ben.
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(32, 74)
  ctx.lineTo(60, 74)
  ctx.lineTo(46, 100)
  ctx.closePath()
  ctx.fill()
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/**
 * @param {{coordinates: Array<[number,number]>}} route
 * @param {Array<{svgX:number, svgY:number}>} via  delmål/vendepunkter
 * @param {boolean} isLoop
 * @param {Array<{x:number,y:number,name:string}>} parkingSpots  0–2 (start/mål ≤ 50 m fra utfartsparkering)
 * @param {Array<{x:number,y:number,name:string}>} pauseSpots  vendepunkt ved vann (rast/bad)
 */
export function buildWaypointMarkers({ route, via = [], isLoop = false, parkingSpots = [], pauseSpots = [] }, dem, coords) {
  const group = new Group()
  // Togglebar undergruppe: kun skilt-billboards (hjem-skiltet). Nålene
  // ligger rett i group og er alltid synlige.
  const signsGroup = new Group()
  group.add(signsGroup)
  const geometries = []
  const materials = []
  const pins = []
  // Trefftesting: hver stamme/hode/sprite peker tilbake på hva den ER, så et
  // trykk på start-nåla kan svare «Start» og fly dit — som en POI-nål.
  const hitMeshes = []
  const metaOf = new Map()

  // Knappenål plantet med foten i bakken: stamme + hode i én gruppe som
  // skaleres fra bakkepunktet — avstandsoverdrivelsen forstørrer da både
  // høyde og hode uten å løfte nåla fra terrenget.
  const pin = (x, y, color, meta) => {
    const holder = new Group()
    const stemGeo = new CylinderGeometry(PIN_STEM_R, PIN_STEM_R, PIN_STEM_H, 8)
    const stemMat = new MeshBasicMaterial({ color: 0xffffff })
    const stem = new Mesh(stemGeo, stemMat)
    stem.position.y = PIN_STEM_H / 2
    const headGeo = new SphereGeometry(PIN_HEAD_R, 16, 12)
    const headMat = new MeshBasicMaterial({ color })
    const head = new Mesh(headGeo, headMat)
    head.position.y = PIN_STEM_H + PIN_HEAD_R * 0.6
    holder.add(stem)
    holder.add(head)
    const [wx, wy, wz] = drapedWorld(dem, coords, x, y)
    holder.position.set(wx, wy, wz)
    geometries.push(stemGeo, headGeo)
    materials.push(stemMat, headMat)
    group.add(holder)
    pins.push(holder)
    const full = { ...meta, world: [wx, wy, wz] }
    for (const m of [stem, head]) {
      hitMeshes.push(m)
      metaOf.set(m, full)
    }
  }

  const coordsArr = route.coordinates
  const [ax, ay] = coordsArr[0]
  pin(ax, ay, COLOR_START, { kind: 'start', name: isLoop ? 'Start og mål' : 'Start' })
  if (!isLoop) {
    const [bx, by] = coordsArr[coordsArr.length - 1]
    pin(bx, by, COLOR_DEST, { kind: 'mål', name: 'Mål' })
  }
  for (const v of via) pin(v.svgX, v.svgY, COLOR_VIA, { kind: 'via', name: 'Vendepunkt' })

  const billboard = (spots, texFactory, { sizeM, liftM, parent, kind, label }) => {
    if (!spots.length) return
    const tex = texFactory()
    const mat = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    materials.push(mat)
    // Teksturen deles; SpriteMaterial disposer ikke map automatisk.
    mat.userData = { tex }
    for (const p of spots) {
      const sprite = new Sprite(mat)
      sprite.scale.set(sizeM, sizeM, 1)
      const [wx, wy, wz] = drapedWorld(dem, coords, p.x, p.y, liftM)
      sprite.position.set(wx, wy, wz)
      parent.add(sprite)
      hitMeshes.push(sprite)
      // Skiltet svarer for punktet det står på, med bakkepunktet som mål —
      // ellers ville flyturen siktet inn luften over nåla.
      metaOf.set(sprite, {
        kind,
        name: p.name || label,
        world: drapedWorld(dem, coords, p.x, p.y),
      })
    }
  }
  billboard(parkingSpots, parkingTexture, {
    sizeM: 46, liftM: 40, parent: group, kind: 'parkering', label: 'Parkering',
  })
  // Hjem-skiltet følger POI-togglen (setPinsVisible); løftes over den
  // oransje nåla på samme punkt.
  billboard(pauseSpots, uTurnTexture, {
    sizeM: 42, liftM: 95, parent: signsGroup, kind: 'rast', label: 'Rasteplass',
  })

  return {
    group,
    geometries,
    materials,
    hitMeshes,

    /**
     * Trykk-treff → hvilket veipunkt det var.
     * @returns {{kind:string, name:string, world:[number,number,number]}|null}
     */
    pick(raycaster) {
      for (const h of raycaster.intersectObjects(hitMeshes, false)) {
        // Skjulte skilt (POI-togglen av) skal ikke kunne treffes.
        if (h.object.parent && h.object.parent.visible === false) continue
        const meta = metaOf.get(h.object)
        if (meta) return meta
      }
      return null
    },
    // Toggler kun skilt-billboards — start-/mål-/via-nålene står alltid.
    setPinsVisible(v) { signsGroup.visible = !!v },
    // Avstandsoverdrivelse: nær = naturlig størrelse, langt unna vokser nåla
    // (opptil 5×) så start/mål kan lokaliseres helt i horisonten. Samme
    // skalering som POI-nålene i utforskeren — se pinField.pinScaleAt.
    update(camera) {
      for (const p of pins) {
        p.scale.setScalar(pinScaleAt(camera.position.distanceTo(p.position)))
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) {
        m.userData?.tex?.dispose()
        m.dispose()
      }
    },
  }
}

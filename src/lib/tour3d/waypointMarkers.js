// Endepunkt- og parkeringmarkører i 3D: start (grønn), mål (rød, A→B) og
// delmål/vendepunkter (oransje) er knappenåler som stikker opp fra
// terrenget — lavere enn POI-strålen, men med avstandsavhengig overdrivelse
// så de synes helt i horisonten. Nålene er togglebare fra UI; nærmeste
// utfartsparkering («P»-billboard) står alltid.

import {
  SphereGeometry, CylinderGeometry, MeshBasicMaterial, Mesh, Group,
  CanvasTexture, SpriteMaterial, Sprite, SRGBColorSpace,
} from 'three'
import { sampleElevation } from '../demSampling.js'

const COLOR_START = 0x16a34a
const COLOR_DEST = 0xdc2626
const COLOR_VIA = 0xf59e0b

const PIN_STEM_H = 55
const PIN_STEM_R = 2.2
const PIN_HEAD_R = 9

function drapedWorld(dem, coords, x, y, liftM = 0) {
  const e = sampleElevation(dem, x, y)
  return coords.toWorld(x, y, (Number.isFinite(e) ? e : 0) + liftM)
}

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

/**
 * @param {{coordinates: Array<[number,number]>}} route
 * @param {Array<{svgX:number, svgY:number}>} via  delmål/vendepunkter
 * @param {boolean} isLoop
 * @param {Array<{x:number,y:number,name:string}>} parkingSpots  0–2 (start/mål)
 */
export function buildWaypointMarkers({ route, via = [], isLoop = false, parkingSpots = [] }, dem, coords) {
  const group = new Group()
  const pinsGroup = new Group()
  group.add(pinsGroup)
  const geometries = []
  const materials = []
  const pins = []

  // Knappenål plantet med foten i bakken: stamme + hode i én gruppe som
  // skaleres fra bakkepunktet — avstandsoverdrivelsen forstørrer da både
  // høyde og hode uten å løfte nåla fra terrenget.
  const pin = (x, y, color) => {
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
    pinsGroup.add(holder)
    pins.push(holder)
  }

  const coordsArr = route.coordinates
  const [ax, ay] = coordsArr[0]
  pin(ax, ay, COLOR_START)
  if (!isLoop) {
    const [bx, by] = coordsArr[coordsArr.length - 1]
    pin(bx, by, COLOR_DEST)
  }
  for (const v of via) pin(v.svgX, v.svgY, COLOR_VIA)

  if (parkingSpots.length) {
    const tex = parkingTexture()
    const mat = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    materials.push(mat)
    // Teksturen deles; SpriteMaterial disposer ikke map automatisk.
    mat.userData = { tex }
    for (const p of parkingSpots) {
      const sprite = new Sprite(mat)
      sprite.scale.set(46, 46, 1)
      const [wx, wy, wz] = drapedWorld(dem, coords, p.x, p.y, 40)
      sprite.position.set(wx, wy, wz)
      group.add(sprite)
    }
  }

  return {
    group,
    geometries,
    materials,
    setPinsVisible(v) { pinsGroup.visible = !!v },
    // Avstandsoverdrivelse: nær = naturlig størrelse, langt unna vokser nåla
    // (opptil 5×) så start/mål kan lokaliseres helt i horisonten.
    update(camera) {
      if (!pinsGroup.visible) return
      for (const p of pins) {
        const d = camera.position.distanceTo(p.position)
        const s = Math.min(5, Math.max(1, d / 1200))
        p.scale.setScalar(s)
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

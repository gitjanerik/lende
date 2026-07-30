// Endepunkt- og parkeringmarkører i 3D: A = grønn prikk, B = rød, delmål
// (via/vendepunkt) = gule. Nærmeste utfartsparkering ved start (og mål for
// A→B-ruter) vises som en «P»-billboard. Alt drapes på terrenghøyden.

import {
  SphereGeometry, MeshBasicMaterial, Mesh, Group,
  CanvasTexture, SpriteMaterial, Sprite, SRGBColorSpace,
} from 'three'
import { sampleElevation } from '../demSampling.js'

const COLOR_START = 0x16a34a
const COLOR_DEST = 0xdc2626
const COLOR_VIA = 0xf59e0b

function drapedWorld(dem, coords, x, y, liftM = 6) {
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
export function buildWaypointMarkers({ route, via = [], isLoop = false, parkingSpots = [] }, dem, coords, { dotRadiusM = 11 } = {}) {
  const group = new Group()
  const geometries = []
  const materials = []

  const dot = (x, y, color) => {
    const geo = new SphereGeometry(dotRadiusM, 14, 10)
    const mat = new MeshBasicMaterial({ color })
    const mesh = new Mesh(geo, mat)
    const [wx, wy, wz] = drapedWorld(dem, coords, x, y)
    mesh.position.set(wx, wy, wz)
    geometries.push(geo)
    materials.push(mat)
    group.add(mesh)
  }

  const coordsArr = route.coordinates
  const [ax, ay] = coordsArr[0]
  dot(ax, ay, COLOR_START)
  if (!isLoop) {
    const [bx, by] = coordsArr[coordsArr.length - 1]
    dot(bx, by, COLOR_DEST)
  }
  for (const v of via) dot(v.svgX, v.svgY, COLOR_VIA)

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
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) {
        m.userData?.tex?.dispose()
        m.dispose()
      }
    },
  }
}

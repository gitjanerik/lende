// Kart-SVG-en rasterisert til terrengtekstur — selve ISOM-kartografien
// drapert over meshen. Samme Blob → objectURL → Image → drawImage-mønster
// som printExport.js (mobil-OOM-trygt via størrelsesklamp).
//
// Hillshade: #hillshade-layer injiseres av klienten ved visning og finnes
// normalt IKKE i den lagrede SVG-strengen — da bakes computeHillshade inn
// med multiply, så belysningen ligger i teksturen og materialet kan være
// ulit (MeshBasicMaterial).

import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter } from 'three'
import { computeHillshade } from '../hillshade.js'

const RUNTIME_LAYER_IDS = ['user-layer', 'annotation-layer', 'track-layer', 'measure-layer', 'stifinner-layer', 'hydro-layer']

export function cleanSvgForTexture(svgString) {
  let s = svgString
  for (const id of RUNTIME_LAYER_IDS) {
    const re = new RegExp(`<g[^>]*id="${id}"[^]*?</g>`, 'g')
    s = s.replace(re, '')
  }
  if (!s.includes('xmlns:xlink')) {
    s = s.replace(/<svg\b([^>]*)>/, '<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink">')
  }
  return s
}

export function pickTextureSize(renderer) {
  const maxTex = renderer?.capabilities?.maxTextureSize ?? 4096
  const mem = typeof navigator !== 'undefined' ? (navigator.deviceMemory ?? 4) : 4
  return maxTex >= 8192 && mem >= 6 ? 4096 : 2048
}

/**
 * @param {string} svgString  kart-SVG (lastSvgString)
 * @param {import('../demSampling.js').DEM|null} dem  for hillshade-bake
 * @param {{sizePx?: number, renderer?: object}} [opts]
 * @returns {Promise<CanvasTexture>}
 */
export async function buildMapTexture(svgString, dem, { sizePx, renderer } = {}) {
  const px = sizePx ?? pickTextureSize(renderer)
  const cleaned = cleanSvgForTexture(svgString)

  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas-context utilgjengelig')

  const blob = new Blob([cleaned], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('SVG-rasterisering feilet'))
      img.src = url
    })
    // Hele viewBoxen tegnes inn i det kvadratiske pow2-lerretet; UV-ene i
    // terrainGrid kompenserer for aspektet.
    ctx.drawImage(img, 0, 0, px, px)
  } finally {
    URL.revokeObjectURL(url)
  }

  if (dem && !cleaned.includes('id="hillshade-layer"')) {
    bakeHillshade(ctx, dem, px)
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  if (renderer?.capabilities?.getMaxAnisotropy) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  }
  return tex
}

function bakeHillshade(ctx, dem, px) {
  const shade = computeHillshade(dem)
  const tmp = document.createElement('canvas')
  tmp.width = shade.cols
  tmp.height = shade.rows
  const tctx = tmp.getContext('2d')
  if (!tctx) return
  tctx.putImageData(new ImageData(shade.rgba, shade.cols, shade.rows), 0, 0)
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.55
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(tmp, 0, 0, px, px)
  ctx.restore()
}

// Fallback når SVG-rasterisering feiler: hillshade tonet i ISOM-krem så
// turen fortsatt er brukbar (uten kartografi).
export function buildFallbackTexture(dem) {
  const shade = computeHillshade(dem)
  const canvas = document.createElement('canvas')
  canvas.width = shade.cols
  canvas.height = shade.rows
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fffbf0'
  ctx.fillRect(0, 0, shade.cols, shade.rows)
  const tmp = document.createElement('canvas')
  tmp.width = shade.cols
  tmp.height = shade.rows
  tmp.getContext('2d').putImageData(new ImageData(shade.rgba, shade.cols, shade.rows), 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(tmp, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

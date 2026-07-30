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

// Fjern <g>-grupper som matcher åpnings-regexen, med balansert tag-skanning —
// gruppene kan ha nestede <g>, som gjør non-greedy regex utrygg.
function stripBalancedGroups(svg, openRe) {
  let out = svg
  let m
  while ((m = openRe.exec(out)) !== null) {
    const start = m.index
    const tagRe = /<\/?g\b[^>]*>/g
    tagRe.lastIndex = start + m[0].length
    let depth = 1
    let end = -1
    let t
    while ((t = tagRe.exec(out)) !== null) {
      if (t[0][1] === '/') depth--
      else if (!t[0].endsWith('/>')) depth++
      if (depth === 0) { end = tagRe.lastIndex; break }
    }
    if (end < 0) return out
    out = out.slice(0, start) + out.slice(end)
  }
  return out
}

// Fjern kartets innbakte høydekurver (<g data-layer="kontur"> med nestede
// data-iso-/kontur-tall-grupper) fra teksturen: i 3D er vektorkurve-laget
// eneste kurvekilde, så «Kurver»-knappen faktisk styrer kurvene og de ikke
// vises dobbelt (uskarpt fra tekstur + skarpt fra vektor).
export function stripContourLayers(svg) {
  return stripBalancedGroups(svg, /<g\b[^>]*data-layer="kontur"[^>]*>/)
}

// Relieff-stilen «Skarp (vektor)» er en <g id="hillshade-layer"> med diskrete
// tone-bånd-polygoner — rasterisert til 3D-tekstur blir de flate grå flekker
// på terrenget. Strip den, så baker buildMapTexture mykt bilde-relieff i
// stedet: 3D bruker alltid «Mjuk (bilde)», uansett hva brukeren valgte i 2D.
// «Mjuk»-varianten er en <image id="hillshade-layer"> og matches ikke av
// <g-regexen — den beholdes som den er.
export function stripVectorRelief(svg) {
  return stripBalancedGroups(svg, /<g\b[^>]*id="hillshade-layer"[^>]*>/)
}

// Kartelementer som ikke hører hjemme drapert på 3D-terreng: flate punkt-
// skilt blir store «klistremerker» på bakken (P-skilt, WC, buss/tog), og
// bymasse-fyllet (522, tett bebyggelse) legger grå flater over terrenget.
// Fjernes kun fra 3D-teksturen — 2D-kartet og eksportene er urørt.
const TEXTURE_STRIP_PATTERNS = [
  /<g\b[^>]*data-layer="parkering"[^>]*>/,   // P-skilt (534 + 534u)
  /<g\b[^>]*data-layer="holdeplass"[^>]*>/,  // buss/tog (560)
  /<g\b[^>]*data-iso="554"[^>]*>/,           // WC/toalett (enkeltmarkører i sjø-POI-laget)
  /<g\b[^>]*data-layer="bymasse"[^>]*>/,     // tett bebyggelse (522)
]

export function stripPointSymbols(svg) {
  let out = svg
  for (const re of TEXTURE_STRIP_PATTERNS) out = stripBalancedGroups(out, re)
  return out
}

export function cleanSvgForTexture(svgString) {
  let s = svgString
  for (const id of RUNTIME_LAYER_IDS) {
    const re = new RegExp(`<g[^>]*id="${id}"[^]*?</g>`, 'g')
    s = s.replace(re, '')
  }
  s = stripContourLayers(s)
  s = stripVectorRelief(s)
  s = stripPointSymbols(s)
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
 * @param {string} svgString  kart-SVG (eksport-markup fra MapView)
 * @param {import('../demSampling.js').DEM|null} dem  for hillshade-bake
 * @param {{sizePx?: number, renderer?: object, night?: boolean}} [opts]
 *   night: nattmodus-tekstur — evt. medfølgende relieff-<image> er tonet for
 *   lyst tema og strippes; i stedet bakes screen-blend (lysner mørk flate).
 * @returns {Promise<CanvasTexture>}
 */
export async function buildMapTexture(svgString, dem, { sizePx, renderer, night = false } = {}) {
  const px = sizePx ?? pickTextureSize(renderer)
  let cleaned = cleanSvgForTexture(svgString)
  // Nattmodus: relieff-bildene (aktiv flise + nabo-flisenes data-ghost-relief)
  // er tonet for lyst tema — strip dem og bak screen-blend i stedet.
  if (night) cleaned = cleaned.replace(/<image\b[^>]*(?:id="hillshade-layer"|data-ghost-relief)[^>]*\/?>(<\/image>)?/g, '')

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

  // Etter cleanSvgForTexture kan hillshade-layer bare være <image>-varianten
  // («Mjuk (bilde)») — mangler den (relieff av, «Skarp (vektor)» strippet,
  // eller nattmodus), bakes mykt relieff inn her.
  if (dem && !cleaned.includes('id="hillshade-layer"')) {
    bakeHillshade(ctx, dem, px, night)
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

function bakeHillshade(ctx, dem, px, night = false) {
  const shade = computeHillshade(dem)
  const tmp = document.createElement('canvas')
  tmp.width = shade.cols
  tmp.height = shade.rows
  const tctx = tmp.getContext('2d')
  if (!tctx) return
  tctx.putImageData(new ImageData(shade.rgba, shade.cols, shade.rows), 0, 0)
  ctx.save()
  // Dag: multiply mørkner skyggesider på lys flate. Natt: screen lysner
  // sollys-sider på mørk flate (samme grep som useReliefRender for mørke
  // temaer) — svakere alpha så natta forblir natt.
  ctx.globalCompositeOperation = night ? 'screen' : 'multiply'
  ctx.globalAlpha = night ? 0.3 : 0.55
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

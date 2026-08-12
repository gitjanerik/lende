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
import { stripBalancedGroups, stripGroupsById } from '../svgLayerStrip.js'

const RUNTIME_LAYER_IDS = ['user-layer', 'annotation-layer', 'track-layer', 'measure-layer', 'stifinner-layer', 'hydro-layer']

// Nabofliser i en mosaikk merker lagene sine `data-ghost-layer` (useGhostTiles
// renavner dem for å holde dem utenfor lag-queries og perf-reglene i 2D). Alt
// som strippes ut av 3D-teksturen må derfor treffe BEGGE navnene — ellers fikk
// aktiv flis rene kurver mens naboflisene sto med kurvene bakt inn i bildet, og
// «Kurver»-knappen styrte bare den ene niendedelen (v5.18.0).
const LAG = 'data-(?:ghost-)?layer'

// Fjern kartets innbakte høydekurver (<g data-layer="kontur"> med nestede
// data-iso-/kontur-tall-grupper) fra teksturen: i 3D er vektorkurve-laget
// eneste kurvekilde, så «Kurver»-knappen faktisk styrer kurvene og de ikke
// vises dobbelt (uskarpt fra tekstur + skarpt fra vektor).
export function stripContourLayers(svg) {
  return stripBalancedGroups(svg, new RegExp(`<g\\b[^>]*${LAG}="kontur"[^>]*>`))
}

// Relieff-stilen «Skarp (vektor)» er en <g id="hillshade-layer"> med diskrete
// tone-bånd-polygoner — rasterisert til 3D-tekstur blir de flate grå flekker
// på terrenget. Strip den, så baker buildMapTexture mykt bilde-relieff i
// stedet: 3D bruker alltid «Mjuk (bilde)», uansett hva brukeren valgte i 2D.
// «Mjuk»-varianten er en <image id="hillshade-layer"> og matches ikke av
// <g-regexen — den beholdes som den er.
export function stripVectorRelief(svg) {
  const utenAktiv = stripBalancedGroups(svg, /<g\b[^>]*id="hillshade-layer"[^>]*>/)
  // Naboflisenes vektor-relieff er en <g data-ghost-relief> med de samme
  // tone-båndene, og de blir de samme grå flekkene på terrenget.
  return stripBalancedGroups(utenAktiv, /<g\b[^>]*data-ghost-relief[^>]*>/)
}

// Kartelementer som ikke hører hjemme drapert på 3D-terreng: flate punkt-
// skilt blir store «klistremerker» på bakken (P-skilt, WC, buss/tog), og
// bymasse-fyllet (522, tett bebyggelse) legger grå flater over terrenget.
// Fjernes kun fra 3D-teksturen — 2D-kartet og eksportene er urørt.
const TEXTURE_STRIP_PATTERNS = [
  new RegExp(`<g\\b[^>]*${LAG}="parkering"[^>]*>`),   // P-skilt (534 + 534u)
  new RegExp(`<g\\b[^>]*${LAG}="holdeplass"[^>]*>`),  // buss/tog (560)
  /<g\b[^>]*data-iso="554"[^>]*>/,                    // WC/toalett (enkeltmarkører i sjø-POI-laget)
  new RegExp(`<g\\b[^>]*${LAG}="bymasse"[^>]*>`),     // tett bebyggelse (522)
]

export function stripPointSymbols(svg) {
  let out = svg
  for (const re of TEXTURE_STRIP_PATTERNS) out = stripBalancedGroups(out, re)
  return out
}

export function cleanSvgForTexture(svgString) {
  // Balansert stripping — hydro-/annoterings-/spor-lag har nestede <g>, og
  // non-greedy regex etterlot ubalansert XML → hele rasteriseringen feilet
  // og terrenget fikk grå fallback-tekstur uten kartografi (v3.0.27).
  let s = stripGroupsById(svgString, RUNTIME_LAYER_IDS)
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

// Førstevisningen bygges på dette, og skjerpes til pickTextureSize etterpå.
// Et 1024-lerret er ~16× mindre å laste opp til GPU-en og mipmappe enn 4096,
// og det er den opplastingen — ikke rasteriseringen — som koster tid på mobil.
export const PREVIEW_TEXTURE_PX = 1024

/**
 * Er kilde-lerretet til teksturen tømt?
 *
 * Nettleseren kan frigjøre backing-store for store lerret når appen ligger i
 * bakgrunnen (et 4096²-lerret er 64 MB). Lerretet består, men innholdet er
 * borte — og siden three laster teksturen opp på nytt fra kilden etter et
 * kontekst-tap, ble terrenget helt SVART. Kart-SVG-en har en dekkende
 * bakgrunn, så et gyldig lerret er ugjennomsiktig overalt; alpha 0 i alle
 * prøvepunktene betyr tømt.
 *
 * Konservativ med vilje: kan vi ikke lese lerretet (tainted canvas, ingen
 * 2D-context), svarer vi «ikke tømt» og lar teksturen være.
 */
export function textureSourceIsBlank(tex) {
  const canvas = tex?.image
  if (!canvas || !canvas.width || !canvas.height) return false
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    const w = canvas.width
    const h = canvas.height
    const punkter = [
      [w >> 1, h >> 1],
      [w >> 2, h >> 2],
      [(w * 3) >> 2, h >> 2],
      [w >> 2, (h * 3) >> 2],
      [(w * 3) >> 2, (h * 3) >> 2],
    ]
    for (const [x, y] of punkter) {
      if (ctx.getImageData(x, y, 1, 1).data[3] !== 0) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} svgString  kart-SVG (eksport-markup fra MapView)
 * @param {import('../demSampling.js').DEM|null} dem  for hillshade-bake
 * @param {{sizePx?: number, renderer?: object, night?: boolean}} [opts]
 *   night: nattmodus-tekstur — evt. medfølgende relieff-<image> er tonet for
 *   lyst tema og strippes; i stedet bakes screen-blend (lysner mørk flate).
 * @returns {Promise<CanvasTexture>}
 */
/**
 * Dekod kart-SVG-en én gang, klar til å rasteriseres i flere størrelser.
 *
 * Dekodingen — nettleserens parsing og rasterisering av titusenvis av
 * SVG-elementer — er den dyre delen, og den koster det samme uansett hvor
 * stort lerretet er. Derfor deles den fra selve tegningen: da kan vi vise en
 * liten tekstur først og skjerpe til full oppløsning etterpå uten å betale
 * for rasteriseringen to ganger. Samme grunn til at relieffet bakes én gang.
 *
 * @returns {Promise<{img: HTMLImageElement, cleaned: string, dispose: () => void}>}
 */
export async function prepareMapTextureSource(svgString, { night = false } = {}) {
  let cleaned = cleanSvgForTexture(svgString)
  // Nattmodus: relieff-bildene (aktiv flise + nabo-flisenes data-ghost-relief)
  // er tonet for lyst tema — strip dem og bak screen-blend i stedet.
  if (night) cleaned = cleaned.replace(/<image\b[^>]*(?:id="hillshade-layer"|data-ghost-relief)[^>]*\/?>(<\/image>)?/g, '')

  const blob = new Blob([cleaned], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('SVG-rasterisering feilet'))
      img.src = url
    })
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
  let shadeCanvas = null
  return {
    img,
    cleaned,
    /** Relieff-lerretet, bygget ved første behov og gjenbrukt etterpå. */
    shade(dem) {
      if (!shadeCanvas && dem) shadeCanvas = hillshadeCanvas(dem)
      return shadeCanvas
    },
    dispose() { URL.revokeObjectURL(url) },
  }
}

/** Tegn en ferdig dekodet kilde inn i en kvadratisk tekstur på `sizePx`. */
export function rasterizeMapTexture(source, dem, { sizePx, renderer, night = false } = {}) {
  const px = sizePx ?? pickTextureSize(renderer)
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas-context utilgjengelig')

  // Hele viewBoxen tegnes inn i det kvadratiske pow2-lerretet; UV-ene i
  // terrainGrid kompenserer for aspektet.
  ctx.drawImage(source.img, 0, 0, px, px)

  // Etter cleanSvgForTexture kan hillshade-layer bare være <image>-varianten
  // («Mjuk (bilde)») — mangler den (relieff av, «Skarp (vektor)» strippet,
  // eller nattmodus), bakes mykt relieff inn her.
  if (dem && !source.cleaned.includes('id="hillshade-layer"')) {
    drawShade(ctx, source.shade(dem), px, night)
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

export async function buildMapTexture(svgString, dem, { sizePx, renderer, night = false } = {}) {
  const source = await prepareMapTextureSource(svgString, { night })
  try {
    return rasterizeMapTexture(source, dem, { sizePx, renderer, night })
  } finally {
    source.dispose()
  }
}

function hillshadeCanvas(dem) {
  const shade = computeHillshade(dem)
  const tmp = document.createElement('canvas')
  tmp.width = shade.cols
  tmp.height = shade.rows
  const tctx = tmp.getContext('2d')
  if (!tctx) return null
  tctx.putImageData(new ImageData(shade.rgba, shade.cols, shade.rows), 0, 0)
  return tmp
}

function drawShade(ctx, tmp, px, night = false) {
  if (!tmp) return
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

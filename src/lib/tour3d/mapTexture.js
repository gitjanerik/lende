// Kart-SVG-en rasterisert til terrengtekstur — selve ISOM-kartografien
// drapert over meshen. Blob → objectURL → Image → drawImage, som printExport.js.
//
// ÉN FLIS OM GANGEN (v5.18.1). Fram til da ble hele arket serialisert til ÉN
// SVG-streng og dekodet som ett bilde. Det holdt til fire fliser og brakk ved ni:
// bildet lastet ikke, og terrenget fikk gråtone-fallbacken — et månelandskap
// uten kartografi. Nå dekodes hver flis for seg og tegnes inn i sin egen rute av
// lerretet. Kostnaden per dekoding er en niendedel, en flis som feiler koster
// bare sin egen rute (resten av kartet står), og strengen vi bygger er aldri
// større enn ett kart.
//
// Hillshade bakes ALLTID her, fra utsnittets egen DEM, og alt relieff strippes
// ut av flisene først. Det gir én sømløs belysning over hele arket i stedet for
// ni per-flis-bilder med hver sin kant — og det er den største enkeltposten i
// strengen som forsvinner. Belysningen ligger dermed i teksturen, og materialet
// kan være ulit (MeshBasicMaterial).

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

// ALT relieff ut av flisene (v5.18.1) — 3D baker sitt eget fra utsnittets DEM.
//
// «Skarp (vektor)» er en <g id="hillshade-layer"> med diskrete tone-bånd som
// blir flate grå flekker på terrenget. «Mjuk (bilde)» er en <image> med et
// base64-PNG; den ble beholdt fram til v5.18.1, men i en mosaikk er det ETT slikt
// bilde per flis — hver med sin egen kant, og til sammen megabyte med base64 i
// strengen vi ber nettleseren dekode. Én bake fra union-DEM-en gir samme
// belysning uten skjøter, og 3D-relieffet blir samtidig uavhengig av hva
// brukeren valgte i 2D (som er riktig: 3D har sin egen lyssetting).
export function stripVectorRelief(svg) {
  let s = stripBalancedGroups(svg, /<g\b[^>]*id="hillshade-layer"[^>]*>/)
  // Naboflisenes vektor-relieff er en <g data-ghost-relief> med samme tone-bånd.
  s = stripBalancedGroups(s, /<g\b[^>]*data-ghost-relief[^>]*>/)
  // …og bilde-varianten, aktiv flis som naboer.
  return s.replace(
    /<image\b[^>]*(?:id="hillshade-layer"|data-ghost-relief)[^>]*\/?>(<\/image>)?/g, '')
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

const ISOM_CREAM = '#fffbf0'

/**
 * Sett en eksplisitt pikselstørrelse på rot-SVG-en.
 *
 * Den levende kart-SVG-en har `width="100%" height="100%"` — den fyller sin
 * vert. En `<img>` har ingen vert, så prosentene gir bildet ingen egen
 * størrelse, og nettleseren rasteriserer SVG-en på sin default (300 px) før den
 * skaleres opp. Her sier vi presis hvor mange piksler flisa skal dekode til.
 */
export function withPixelSize(svg, wPx, hPx) {
  return svg.replace(/<svg\b([^>]*)>/, (_m, attrs) => {
    const rest = attrs.replace(/\s(?:width|height)="[^"]*"/g, '')
    return `<svg${rest} width="${Math.max(1, Math.round(wPx))}" height="${Math.max(1, Math.round(hPx))}">`
  })
}

async function decodeTile(svgString, { wPx, hPx }) {
  const cleaned = withPixelSize(cleanSvgForTexture(svgString), wPx, hPx)
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
  return { img, bytes: cleaned.length, dispose: () => URL.revokeObjectURL(url) }
}

/**
 * Dekod arkets fliser én gang, klare til å rasteriseres i flere størrelser.
 *
 * Dekodingen — nettleserens parsing og rasterisering av titusenvis av
 * SVG-elementer — er den dyre delen, og den koster det samme uansett hvor
 * stort lerretet er. Derfor deles den fra selve tegningen: da kan vi vise en
 * liten tekstur først og skjerpe til full oppløsning etterpå uten å betale
 * for rasteriseringen to ganger. Samme grunn til at relieffet bakes én gang.
 *
 * En flis som ikke lar seg dekode hoppes over — resten av kartet skal stå.
 * Feiler ALLE, kaster vi, og kalleren faller til gråtone-relieffet.
 *
 * @param {{tiles: Array<{svg:string, x:number, y:number, w:number, h:number}>,
 *          widthM:number, heightM:number, background?:string}} spec
 *   x/y/w/h i meter, i utsnittets eget rom (0 … widthM).
 * @param {{sizePx?: number}} [opts] lerretsstørrelsen flisene skal dekodes for
 */
export async function prepareMapTextureSource(spec, { sizePx = 4096 } = {}) {
  const { tiles = [], widthM, heightM } = spec ?? {}
  if (!tiles.length || !(widthM > 0) || !(heightM > 0)) {
    throw new Error('Tomt tekstur-utsnitt')
  }
  const utfall = await Promise.allSettled(tiles.map((t) => decodeTile(t.svg, {
    wPx: (t.w / widthM) * sizePx,
    hPx: (t.h / heightM) * sizePx,
  }).then((d) => ({ ...d, rect: t }))))
  const dekodet = utfall.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const feilet = tiles.length - dekodet.length
  if (!dekodet.length) {
    throw new Error(`Ingen av ${tiles.length} kartfliser lot seg rasterisere`)
  }
  if (feilet) {
    console.warn(`[3D] ${feilet} av ${tiles.length} kartfliser lot seg ikke rasterisere`)
  }

  let shadeCanvas = null
  return {
    background: spec.background || ISOM_CREAM,
    tileCount: tiles.length,
    /** Hvor mange fliser som ikke kom med — kalleren melder fra om det. */
    missing: feilet,
    bytes: dekodet.reduce((sum, d) => sum + d.bytes, 0),
    /** Tegn alle flisene inn i et kvadratisk lerret på `px`. */
    draw(ctx, px) {
      for (const d of dekodet) {
        ctx.drawImage(
          d.img,
          (d.rect.x / widthM) * px,
          (d.rect.y / heightM) * px,
          (d.rect.w / widthM) * px,
          (d.rect.h / heightM) * px,
        )
      }
    },
    /** Relieff-lerretet, bygget ved første behov og gjenbrukt etterpå. */
    shade(dem) {
      if (!shadeCanvas && dem) shadeCanvas = hillshadeCanvas(dem)
      return shadeCanvas
    },
    dispose() { for (const d of dekodet) d.dispose() },
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

  // Bakgrunnen males først: hull i mosaikken (og margen rundt et avlangt ark)
  // skal være kartets egen papirfarge, ikke gjennomsiktig — en gjennomsiktig
  // tekstur leser textureSourceIsBlank som «lerretet er tømt».
  ctx.fillStyle = source.background || ISOM_CREAM
  ctx.fillRect(0, 0, px, px)

  // Hele utsnittet tegnes inn i det kvadratiske pow2-lerretet, flis for flis;
  // UV-ene i terrainGrid kompenserer for aspektet.
  source.draw(ctx, px)

  // Relieffet er strippet ut av flisene (se stripVectorRelief) og bakes her, fra
  // utsnittets egen DEM — én sømløs belysning over hele arket.
  if (dem) drawShade(ctx, source.shade(dem), px, night)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  if (renderer?.capabilities?.getMaxAnisotropy) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  }
  return tex
}

export async function buildMapTexture(spec, dem, { sizePx, renderer, night = false } = {}) {
  const px = sizePx ?? pickTextureSize(renderer)
  const source = await prepareMapTextureSource(spec, { sizePx: px })
  try {
    return rasterizeMapTexture(source, dem, { sizePx: px, renderer, night })
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

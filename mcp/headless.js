// Headless kart-bygging for MCP-serveren. Samme løype som CI-scriptet
// (scripts/build-vardasen-svg.js): Overpass + N50 + DEM/DOM → buildSvg.
// Kjører i ren Node — ingen IndexedDB, ingen Web Worker.

import { DOMParser, parseHTML } from 'linkedom'
import { fetchOverpass, buildSvg, bboxFromCenter } from '../src/lib/mapBuilder.js'
import { fetchDEM } from '../src/lib/demFetcher.js'
import { fillDemVoidsFromTerrarium } from '../src/lib/terrariumDem.js'
import { fetchN50Water } from '../src/lib/n50Fetcher.js'
// Vann-sammenslåingen er DELT med appen (createMapFlow) — se lib/vannMerge.js.
import { slaaSammenVann } from '../src/lib/vannMerge.js'
import { slaaSammenAreal } from '../src/lib/arealMerge.js'
import { fetchTurruteRoutes, turruteElementsFrom } from '../src/lib/turrutebasenFetcher.js'
import { fetchN50StiLinjer, n50StiElementerFra } from '../src/lib/n50StiFetcher.js'
import { fetchN50Areal } from '../src/lib/n50ArealFetcher.js'
import { utm32BboxFromWgs84 } from '../src/lib/utm.js'
import { parsePathSubpaths } from '../src/lib/pathUtils.js'
import { ROUTABLE_CODES, BARRIER_CODES } from '../src/lib/routing.js'
import { poiType, parseLen, sumTranslate, mmToUnitFromSvg, dedupePoi } from '../src/lib/mapPoi.js'
import { buildSearchIndex, filterIndex } from '../src/composables/useMapSearch.js'
import { probeDensity } from '../src/lib/densityProbe.js'
import { tetthetsBeslutning } from '../src/lib/mapDensityRules.js'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Appen leser N50-sti-flisene over HTTP under Vites BASE_URL. Headless kjører i
// Node uten den, så vi leser rett fra repoets public/-katalog.
//
// MERK: Node-ens `fetch` støtter IKKE `file:` («not implemented... yet...»), så
// en fil-URL alene holder ikke — vi må gi fetcheren en egen leser. Uten den fikk
// MCP-bygde kart null N50-stier, helt stille, siden uthentingen aldri feiler
// hardt. Er flisene ikke bakt, gir ENOENT 404 og kartet blir som før.
//
// Katalogen regnes ut LAZILY, og bare der det finnes et filsystem (v5.18.2).
// Denne fila bundles også inn i Cloudflare-Workeren (cloudflare/mcp-worker), og
// der er `import.meta.url` undefined. Som en konstant på modulnivå kastet
// `fileURLToPath(undefined)` i det Workeren startet — så HVER ENESTE deploy av
// MCP-Workeren feilet fra v5.0.16 og framover, uten at noe i appen merket det.
// Gaten som fanger det nå er `npm run boot:workers` (scripts/worker-boot.mjs).
let n50Katalog                     // undefined = ikke regnet ut ennå, null = ingen disk

function n50StiKatalog() {
  if (n50Katalog !== undefined) return n50Katalog
  n50Katalog = null
  try {
    const her = import.meta.url
    if (her) n50Katalog = join(dirname(fileURLToPath(her)), '..', 'public', 'data', 'n50-sti') + '/'
  } catch { n50Katalog = null }
  return n50Katalog
}

/** Fil-URL til N50-sti-flisene, eller null når vi ikke har et filsystem. */
export function n50StiBasePath() {
  const k = n50StiKatalog()
  return k ? pathToFileURL(k).href : null
}

/**
 * Hvor N50-sti-flisene skal hentes fra, og hvem som skal lese dem.
 *
 * Tre kilder, i prioritert rekkefølge:
 *   1. `eksplisitt` — en URL kalleren gir oss. Cloudflare-Workeren sender
 *      HTTPS-adressen til flisene på GitHub Pages (N50_STI_BASE), som er
 *      NØYAKTIG de samme filene appen bruker.
 *   2. Disk — Node med repoet tilgjengelig (MCP-stdio, fasit, CI-scriptene).
 *   3. Ingen — da hopper vi over N50 framfor å be fetcheren om en relativ URL
 *      den ikke kan slå opp.
 *
 * LESEREN VELGES PÅ PROTOKOLL, ikke på miljø: Node-ens `fetch` støtter ikke
 * `file:`, så en fil-URL må gjennom `lesN50StiFraDisk`; en `https:`-URL skal
 * gjennom fetcherens egen `hentBytesViaFetch` (vi sender da ingen `hentBytes`).
 *
 * Hvorfor dette finnes: i workerd er `import.meta.url` undefined, så
 * `n50StiKatalog()` gir null der — og fra v5.0.16 til v5.18.6 bygde
 * MCP-Workeren HVERT ENESTE kart uten N50-stier, helt stille, siden uthentingen
 * aldri feiler hardt. Det er 179 706 km sti/traktorveg som manglet i skyen mens
 * appen hadde dem.
 */
export function n50StiKilde(eksplisitt) {
  const basePath = eksplisitt || n50StiBasePath()
  if (!basePath) return null
  return basePath.startsWith('file:')
    ? { basePath, hentBytes: lesN50StiFraDisk }
    : { basePath }
}

/**
 * Samme tre-trinns valg som n50StiKilde, mot arealdekke-flisene. Egen katalog,
 * samme regel — og samme fallgruve: i workerd er `import.meta.url` undefined,
 * så uten en eksplisitt URL fra kalleren bygges kartet uten N50-myr. Stille.
 */
export function n50ArealKilde(eksplisitt) {
  let basePath = eksplisitt
  if (!basePath) {
    try {
      const her = import.meta.url
      if (her) {
        basePath = pathToFileURL(
          join(dirname(fileURLToPath(her)), '..', 'public', 'data', 'n50-areal') + '/').href
      }
    } catch { basePath = null }
  }
  if (!basePath) return null
  return basePath.startsWith('file:')
    ? { basePath, hentBytes: lesN50StiFraDisk }
    : { basePath }
}

export async function lesN50StiFraDisk(url) {
  try {
    const buf = await readFile(fileURLToPath(url))
    return { status: 200, bytes: new Uint8Array(buf) }
  } catch (e) {
    return { status: e?.code === 'ENOENT' ? 404 : 500, bytes: null }
  }
}

// sjokartFetcher sjekker `typeof DOMParser` for GML-parsing — uten shim
// returnerer den tomt og kystkart mister dybdedata i Node.
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = DOMParser
}

// Velg DEM/DOM-oppløsning ut fra kart-arealet så WCS-forespørselen holder seg
// under et celletak. Headless-motstykket til appens coastalTargetResFor: små
// kart beholder 5 m (uendret oppførsel ≤ ~8×8 km), mens store turområder/
// nasjonalparker faller til 10/20/25 m i stedet for å be om titalls millioner
// celler, time ut, og falle stille tilbake til syntetisk DEM (terrengløst kart).
const DEM_MAX_CELLS = 4e6
export function demResolutionForArea(utmBbox, maxCells = DEM_MAX_CELLS) {
  const areaM2 = (utmBbox.maxE - utmBbox.minE) * (utmBbox.maxN - utmBbox.minN)
  if (!(areaM2 > 0)) return 5
  for (const res of [5, 10, 20, 25]) {
    if (areaM2 / (res * res) <= maxCells) return res
  }
  return 25
}

/**
 * Bygg et komplett turkart headless.
 *
 * `detaljNivaa` kan settes eksplisitt; utelates den sonderes datatettheten med
 * samme regler som appen (mapDensityRules), så et Oslo-kart fra MCP blir like
 * lett som fra appen. `tetthetAv: true` skrur sonderingen helt av.
 *
 * @param {{lat:number, lon:number, halfKm:number, equidistanceM?:number,
 *          detaljNivaa?:string, tetthetAv?:boolean, n50StiBase?:string}} opts
 *   n50StiBase — hvor N50-sti-flisene ligger. Uten filsystem (Cloudflare-
 *   Workeren) MÅ denne settes, ellers bygges kartet uten N50-stier. Se
 *   n50StiKilde. `n50ArealBase` gjør det samme for myr-flisene.
 * @returns {Promise<{svg:string, counts:object, meta:object, dem:object, bbox:object,
 *                    halfKm:number, tetthet:object|null}>}
 */
export async function buildMapHeadless({
  lat, lon, halfKm, equidistanceM, detaljNivaa: eksplisittNivaa, tetthetAv = false,
  n50StiBase, n50ArealBase,
}) {
  let effHalfKm = halfKm
  let bbox = bboxFromCenter(lat, lon, effHalfKm)

  // Tetthets-sondering før hentingen (samme trinn-rekkefølge som appen:
  // detaljer først, så areal). Feiler den → full detalj, uendret bredde.
  let detaljNivaa = eksplisittNivaa ?? 'full'
  let tetthet = null
  if (!eksplisittNivaa && !tetthetAv) {
    const probe = await probeDensity(bbox).catch(() => null)
    const b = tetthetsBeslutning(probe, { breddeKm: effHalfKm * 2, aspect: 1 })
    if (b) {
      detaljNivaa = b.detaljNivaa
      tetthet = {
        indeks: Math.round(b.indeks), klasse: b.klasse, maksBreddeKm: b.maksBreddeKm,
        fraBreddeKm: effHalfKm * 2, tilBreddeKm: b.breddeKm,
      }
      if (b.breddeJustert && b.breddeKm > 0) {
        effHalfKm = b.breddeKm / 2
        bbox = bboxFromCenter(lat, lon, effHalfKm)
      }
      console.error(
        `[buildMapHeadless] tetthet ${b.klasse} (indeks ${Math.round(b.indeks)}) → ` +
        `detalj «${detaljNivaa}», bredde ${halfKm * 2} → ${effHalfKm * 2} km`,
      )
    }
  }

  const utmBbox = utm32BboxFromWgs84(bbox)
  const resolutionM = demResolutionForArea(utmBbox)
  console.error(`[buildMapHeadless] halfKm=${effHalfKm} → DEM/DOM-oppløsning ${resolutionM} m`)

  // N50-sti-utfallet bæres helt fram til meta (som i appen, createMapFlow:411).
  // Uten det er «bygde Workeren kartet med eller uten stinett?» ikke et spørsmål
  // noen kan STILLE — og da er det heller ikke et spørsmål CI kan svare på. Det
  // er nettopp derfor feilen fikk leve fra v5.0.16 til v5.18.6.
  let n50StiStatus = null

  let n50ArealStatus = null
  const [overpass, n50Water, dem, turruteRoutes, n50StiLinjer, n50Areal] = await Promise.all([
    fetchOverpass(bbox),
    fetchN50Water(bbox).catch(() => []),
    // DEM + samme hull-reparasjon som appen gjør (createMapFlow →
    // maybeFillFromTerrarium). NHM-mosaikken leverer 0 m der den mangler
    // LiDAR-retur, og et slikt hull midt i terrenget gir en stabel høydekurver
    // fra havnivå og opp langs hullkanten (Otersjøen i Lierne, v5.18.6).
    // Headless hoppet over fyllet, så MCP-bygde kart beholdt hullene appen var
    // ferdig med. Gaten er billig og degraderer trygt: ingen hull → ingen
    // flis-henting, feilet henting → DEM uendret.
    fetchDEM(bbox, utmBbox, { resolutionM, useReal: true })
      .then(async (rå) => {
        try {
          const { dem: fylt, replaced } = await fillDemVoidsFromTerrarium(rå, utmBbox)
          if (replaced) console.error(`[Terrarium] fylte ${replaced} celler uten norsk LiDAR-dekning`)
          return fylt
        } catch (e) {
          console.error(`[Terrarium] fyll hoppet over: ${e?.message ?? e}`)
          return rå
        }
      }),
    // Merkede fotruter (Turrutebasen) — samme kilde som appen, så MCP-bygde
    // kart ikke mangler stier appen har. Tynnes mot OSM under.
    fetchTurruteRoutes(bbox).catch(() => []),
    // N50-stinettet. Kilden velges av n50StiKilde(): kallerens URL (Workeren
    // sender GitHub Pages-adressen), ellers repoets public/-katalog, ellers
    // ingenting. Se notatet ved n50StiKilde for hvorfor protokollen bestemmer
    // leseren.
    (() => {
      const kilde = n50StiKilde(n50StiBase)
      if (!kilde) {
        n50StiStatus = { state: 'av', message: 'ingen N50-sti-kilde (verken n50StiBase eller filsystem)' }
        return Promise.resolve([])
      }
      return fetchN50StiLinjer(bbox, { ...kilde, onStatus: s => { n50StiStatus = s } })
        .catch((e) => {
          n50StiStatus = { state: 'feil', message: String(e?.message ?? e) }
          return []
        })
    })(),
    // N50-arealdekke (myr, skog, isbre + bre-navn), samme kilde-regel som
    // stiene. Statusen fanges fordi DEKNING er det buildSvg trenger for å
    // avgjøre om Turkarts skog-påstand skal vike — se mapBuilder.
    (() => {
      const kilde = n50ArealKilde(n50ArealBase)
      if (!kilde) return Promise.resolve([])
      return fetchN50Areal(bbox, { ...kilde, onStatus: s => { n50ArealStatus = s } })
        .catch(() => [])
    })(),
  ])

  // Vann-stacken slås sammen med SAMME kode som appen (lib/vannMerge.js).
  //
  // Fram til v5.18.3 hadde headless sin egen, grovere variant: fikk den én
  // eneste innsjø fra kilden, kastet den ALT OSM-vann — innsjøer, elveflater,
  // bekker og grøfter — og beholdt bare kildens innsjøer. NVE Innsjødatabasen
  // har verken elveløp eller bekker, så det som ble kastet ble ikke erstattet
  // av noe: Rondvassbu gikk fra 72,7 til 14,6 km elv, Kolstadøya fra 7,5 til 0,
  // og halvparten av vannflatene forsvant. Appen har hele tiden gjort per-flate
  // dekningstester og beholdt elveløp; nå gjør begge det, fordi det er én kode.
  // Arealdekke slås sammen med SAMME kode som appen (lib/arealMerge.js) — delt
  // fra første linje, nettopp fordi vann-stacken viste hva to varianter koster.
  const osmElements = slaaSammenAreal({ osm: overpass.elements, n50Areal })
  const elements = slaaSammenVann({ osm: osmElements, n50Water })
  const turruteEls = turruteElementsFrom(turruteRoutes, overpass.elements)
  elements.push(...turruteEls)
  elements.push(...n50StiElementerFra(n50StiLinjer, [...overpass.elements, ...turruteEls], n50StiStatus))

  const { svg, counts, meta } = buildSvg(elements, bbox, {
    dem,
    utmBbox,
    contourIntervalM: equidistanceM,
    // Samme dekningsflagg som appen. Uten det ville MCP-bygde høyfjellskart
    // beholdt Turkarts skog-påstand mens appens ikke gjorde det — nøyaktig den
    // typen sprik mellom app og headless som vann-stacken brukte månedsvis på.
    arealDekning: n50ArealStatus?.dekning === true,
    skipContoursIfSynthetic: true,
    detaljNivaa,
    tetthet,
    n50StiStatus,
  })
  return { svg, counts, meta, dem, bbox, halfKm: effHalfKm, tetthet }
}

/**
 * Ekstraher routbare sti-/vei-features OG barriere-geometri fra en generert
 * SVG-streng i ÉN gjennomgang. Node-varianten av useStifinner.featuresFromSvg —
 * et nybygd kart har ingen nestede fliser, så ingen offset-håndtering trengs.
 *
 * `barriers` er det hull-broingen i routing.js trenger for å nekte å bro over
 * hovedvei, jernbane, bygning, vann og upassérbart stup.
 *
 * @param {string} svgText
 * @returns {{features: Array<{coordinates: Array<[number,number]>, isomCode: string}>,
 *            barriers: Array<{coordinates: Array<[number,number]>, isomCode: string}>}}
 */
export function graphInputFromSvg(svgText) {
  const { document } = parseHTML(`<html><body>${svgText}</body></html>`)
  const features = []
  const barriers = []
  for (const g of document.querySelectorAll('[data-iso]')) {
    const code = g.getAttribute('data-iso')
    const routbar = ROUTABLE_CODES.has(code)
    const barriere = BARRIER_CODES[code] != null
    if (!routbar && !barriere) continue
    const paths = g.tagName.toLowerCase() === 'path' ? [g] : g.querySelectorAll('path')
    for (const p of paths) {
      const d = p.getAttribute('d')
      if (!d) continue
      for (const sub of parsePathSubpaths(d)) {
        if (sub.length < 2) continue
        if (routbar) features.push({ coordinates: sub, isomCode: code })
        if (barriere) barriers.push({ coordinates: sub, isomCode: code })
      }
    }
  }
  return { features, barriers }
}

/**
 * Bare de routbare features. Beholdt fordi flere kallsteder bare trenger dem.
 * @param {string} svgText
 * @returns {Array<{coordinates: Array<[number,number]>, isomCode: string}>}
 */
export function routableFeaturesFromSvg(svgText) {
  return graphInputFromSvg(svgText).features
}

/**
 * Ekstraher navngitte POI-er fra en generert kart-SVG med absolutt posisjon
 * (SVG-meter). Etikett-tekstens egen x/y (kan være en mm-offset) legges til
 * summen av forelder-transformenes translate, så både absolutt-plasserte
 * (hytte/vann) og gruppe-plasserte (topp) etiketter havner riktig.
 * @param {string} svgText
 * @returns {Array<{navn:string, type:string, x:number, y:number}>}
 */
export function extractMapPoiFromSvg(svgText) {
  const { document } = parseHTML(`<html><body>${svgText}</body></html>`)
  const mmToUnit = mmToUnitFromSvg(svgText)
  const out = []
  for (const el of document.querySelectorAll('text[data-label]')) {
    const type = poiType(el.getAttribute('data-label'))
    if (!type) continue
    const navn = (el.textContent ?? '').trim()
    if (!navn) continue
    let dx = 0, dy = 0
    for (let n = el; n && n.getAttribute; n = n.parentNode) {
      const t = sumTranslate(n.getAttribute('transform'))
      dx += t.dx; dy += t.dy
    }
    const x = dx + parseLen(el.getAttribute('x'), mmToUnit)
    const y = dy + parseLen(el.getAttribute('y'), mmToUnit)
    out.push({ navn, type, x, y })
  }
  return dedupePoi(out)
}

/**
 * Kjør appens kart-søk headless mot en generert SVG-streng. Gjenbruker
 * useMapSearch (buildSearchIndex + filterIndex) så spesial-nøkkelord som
 * «vann» (alle innsjøer, navnløse inkludert, sortert på areal) og «topp» (de
 * høyeste, sortert på moh) oppfører seg identisk med nettleser-appen. Treffenes
 * x/y er i SVG-meter (samme som extractMapPoiFromSvg) og konverteres til WGS84
 * av kalleren.
 * @param {string} svgText
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{name:string, kind:string, label:string, x:number, y:number, ele:number|null, areaM2:number|null, categories:string[]|null}>}
 */
export function searchMapSvg(svgText, query, limit = 30) {
  const { document } = parseHTML(`<html><body>${svgText}</body></html>`)
  const svgEl = document.querySelector('svg')
  if (!svgEl) return []
  const index = buildSearchIndex(svgEl)
  return filterIndex(index, query, limit)
}

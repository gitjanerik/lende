// Merkede fotruter fra Kartverkets Turrutebasen («Tur- og friluftsruter») som
// EKTE VEKTOR via Geonorge WFS — https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter
//
// ── Hvorfor ────────────────────────────────────────────────────────────────
// OSM er tynt i norsk utmark. Målt på Trettekollen (Drammens høyeste punkt,
// 608 moh) 2026-08-09: OSM har 31 linjer i utsnittet, men NÆRMESTE ligger
// 478 m fra toppen — det går ingen sti til Trettekollen i OSM i det hele tatt,
// mens UT.no viser et helt stinett. Turrutebasen fyller en del av det hullet:
// i samme utsnitt gir Fotrute 10,8 km rute, hvorav 3,0 km (28 %) ligger mer
// enn 30 m fra enhver OSM-linje.
//
// Turrutebasen dekker MERKEDE ruter, ikke alle stier — resten av hullet er
// N50 Samferdsel «Sti», som ikke har noen live WFS (eget løft senere).
//
// ── Hvorfor dedup er obligatorisk ──────────────────────────────────────────
// De resterende 72 % ligger oppå OSM-stier vi allerede tegner. Uten
// uttynning ville hver merket rute blitt tegnet TO ganger, med et par meters
// forskyvning — en dobbel, «uskarp» strek langs alle hovedstiene. Vi beholder
// derfor bare de partiene som faktisk er nye (se dedupeRoutesAgainstLines).
//
// Output er GML 3.2 (WFS-en har ingen GeoJSON-utgang), CORS `*`, EPSG:4258
// (ETRS89 ≈ WGS84) med akserekkefølge lat,lon i både bbox og posList — samme
// form som kulturminneWfs.js, og vi parser likedan med regex (DOM-fri, testbar).
// Feiler aldri hardt → tom liste; kartet blir da som før.

const WFS_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURRUTEBASEN_WFS_URL) ||
  'https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter'
const CRS = 'urn:ogc:def:crs:EPSG::4258'
// Fotrute er stinettet. Skiløype hentes i en EGEN spørring (v7.9.19) og går
// til lysløype-laget (510), ikke til stiene: en skiløype er ikke en sti om
// sommeren. Sykkelrute/AnnenRute står fortsatt ute.
const TYPE = 'app:Fotrute'
const TYPE_SKI = 'app:Skiløype'

// Tak på antall ruter vi henter. Et 16 km-kart i et turtett område (Jotunheimen,
// Nordmarka) kan ha mange hundre; 800 er godt over det uten å risikere en
// payload som timer ut på mobil.
export const TURRUTE_FETCH_CAP = 800

/**
 * WFS GetFeature-URL for et bbox. bbox-parameteren tar `sør,vest,nord,øst` +
 * CRS-urn — EPSG:4258 har lat,lon-akserekkefølge.
 */
export function buildTurruteUrl(bbox, { count = TURRUTE_FETCH_CAP, type = TYPE } = {}) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: type,
    srsName: CRS,
    bbox: `${bbox.south},${bbox.west},${bbox.north},${bbox.east},${CRS}`,
    count: String(count),
  })
  return `${WFS_BASE}?${p}`
}

function tagIn(block, tag) {
  const m = block.match(new RegExp(`<app:${tag}>([^<]*)</app:${tag}>`, 'i'))
  return m ? m[1].trim() || null : null
}

/** «lat lon lat lon …» (EPSG:4258) → [{lat,lon}, …]. */
export function posListToGeometry(posList) {
  if (!posList) return []
  const n = posList.trim().split(/\s+/).map(Number)
  const out = []
  for (let i = 0; i + 1 < n.length; i += 2) {
    if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1])) out.push({ lat: n[i], lon: n[i + 1] })
  }
  return out
}

/**
 * Parse GML 3.2 → rute-objekter. Én post per posList: en Fotrute kan ha flere
 * geometrier (MultiCurve), og hver av dem er en selvstendig linje.
 */
export function parseFotruter(gml) {
  if (!gml || typeof gml !== 'string') return []
  const out = []
  const blockRe = /<app:Fotrute\b[\s\S]*?<\/app:Fotrute>/g
  let m
  while ((m = blockRe.exec(gml))) {
    const block = m[0]
    const id = (block.match(/gml:id="([^"]+)"/) || [])[1] || tagIn(block, 'lokalId')
    // `merking` = JA/NEI/tom. Rutenavn m.m. ligger nøstet i <app:fotruteInfo>.
    const merking = (tagIn(block, 'merking') || '').toUpperCase()
    const meta = {
      navn: tagIn(block, 'rutenavn'),
      rutenummer: tagIn(block, 'rutenummer'),
      ansvarlig: tagIn(block, 'vedlikeholdsansvarlig'),
      gradering: tagIn(block, 'gradering'),
      ruteFolger: tagIn(block, 'ruteFølger'),
    }
    const posRe = /<gml:posList[^>]*>([^<]+)<\/gml:posList>/g
    let p, i = 0
    while ((p = posRe.exec(block))) {
      const geometry = posListToGeometry(p[1])
      if (geometry.length < 2) continue
      out.push({ id: `${id ?? 'fotrute'}-${i++}`, merking, ...meta, geometry })
    }
  }
  return out
}

// Skiløypene har samme GML-form som fotrutene. Elementnavnet kan komme med
// ø, som tegnreferanse eller translitterert — regexen tar alle tre, for et
// navn vi ikke kjente igjen ville gitt null løyper og ingen feilmelding.
const SKI_EL = 'app:Skil(?:ø|&#248;|&#xf8;|o|oe)ype'

/**
 * Parse GML 3.2 → skiløype-objekter. `belysning` = JA/NEI/tom; alt annet enn
 * JA regnes som uten lys, samme regel som `erBelystLoype` for OSM.
 */
export function parseSkiloyper(gml) {
  if (!gml || typeof gml !== 'string') return []
  const out = []
  const blockRe = new RegExp(`<${SKI_EL}\\b[\\s\\S]*?<\\/${SKI_EL}>`, 'gi')
  let m
  while ((m = blockRe.exec(gml))) {
    const block = m[0]
    const id = (block.match(/gml:id="([^"]+)"/) || [])[1] || tagIn(block, 'lokalId')
    const belysning = (tagIn(block, 'belysning') || '').toUpperCase()
    const navn = tagIn(block, 'rutenavn')
    const posRe = /<gml:posList[^>]*>([^<]+)<\/gml:posList>/g
    let p, i = 0
    while ((p = posRe.exec(block))) {
      const geometry = posListToGeometry(p[1])
      if (geometry.length < 2) continue
      out.push({ id: `${id ?? 'skiloype'}-${i++}`, belysning, navn, geometry })
    }
  }
  return out
}

// Turrutebasens `ruteFølger` sier hva strekket FØLGER — sti, veg, trapp, bru …
// og båt/ferge der ruta krysser vann med rutebåt. De siste er det som tegnet
// «stier» tvers over Oslofjorden: en stiplet sti over sjøen leses som et tråkk
// man kan gå. De går nå til båtrute-laget (ISOM-derivert 561) i stedet.
//
// Matchingen er en SUBSTRENG og ikke en kodeliste-verdi med vilje: Kartverkets
// kodeliste er ikke pinned her, og verdiene varierer mellom «Båt», «båtrute»,
// «Ferge» og «Ferje» i dataene. En for vid regel koster et blått strekk der
// det skulle vært en sti; en for smal koster en sti tvers over fjorden.
const BAT_RE = /b(å|aa|a)t|ferg|ferj/i

export function erBatStrekk(ruteFolger) {
  return BAT_RE.test(String(ruteFolger ?? ''))
}

// Uttynningen mot allerede tegnede linjer bor i linjeDedup.js — delt med
// N50-stinettet, som trenger nøyaktig samme behandling.
//
// MERK: vi må IMPORTERE i tillegg til å re-eksportere. `export { x } from …`
// alene binder ikke navnet lokalt, så modulens egen bruk av
// dedupeRoutesAgainstLines lenger nede ble en ReferenceError ved kjøring —
// usynlig for enhetstestene, som importerer funksjonene direkte.
import { erSkiloype } from './symbolizer.js'
import {
  travelLineGeometries, dedupeRoutesAgainstLines,
  DEDUP_TOLERANCE_M, MIN_NEW_SEGMENT_M,
} from './linjeDedup.js'
export { travelLineGeometries, dedupeRoutesAgainstLines, DEDUP_TOLERANCE_M, MIN_NEW_SEGMENT_M }

// ── Kart-elementer ─────────────────────────────────────────────────────────

/**
 * Rute-objekter → OSM-aktige way-elementer for buildSvg().
 *
 * `lende:turrute` er vår egen tag (ikke OSM): symbolizer.js gir den ISOM 506
 * når ruta er merket og 507 når den ikke er det. Vi setter bevisst IKKE
 * `name` — rutenavn på hver way ville dyttet «Eiksetra - Svarvestolen» inn i
 * navne-budsjettet og fortrengt stedsnavn. Navnet ligger i `lende:rutenavn`
 * for framtidig bruk (klikk-info).
 */
export function turruterToElements(routes) {
  return (routes ?? []).map((r, i) => {
    const bat = erBatStrekk(r.ruteFolger)
    return {
      type: 'way',
      id: `turrute-${r.id ?? i}`,
      geometry: r.geometry,
      tags: {
        // Båtstrekk får IKKE `lende:turrute`: taggen er dedup-nøkkelen i
        // linjeDedup.travelLineGeometries, og et båtstrekk er ikke en linje
        // N50-stier skal tynnes mot.
        ...(bat ? { 'lende:batrute': 'turrute' } : { 'lende:turrute': 'fotrute' }),
        merking: r.merking === 'JA' ? 'JA' : 'NEI',
        ...(r.navn ? { 'lende:rutenavn': r.navn } : {}),
        ...(r.ansvarlig ? { 'lende:ansvarlig': r.ansvarlig } : {}),
      },
      _source: 'turrutebasen',
    }
  })
}

/**
 * Skiløype-objekter → way-elementer med OSM-ens egne løype-tagger, så
 * symbolizer og lysløype-regelen behandler dem likt med OSM-løypene.
 *
 * Ingen båt-sjekk og ingen vann-klipping: en skiløype over et islagt vann er
 * normalen, ikke en feil (jf. båtstrekkene i fotrutene, som ER en feil der).
 */
export function skiloyperToElements(routes) {
  return (routes ?? []).map((r, i) => ({
    type: 'way',
    id: `turrute-ski-${r.id ?? i}`,
    geometry: r.geometry,
    tags: {
      'piste:type': 'nordic',
      'piste:lit': r.belysning === 'JA' ? 'yes' : 'no',
      ...(r.navn ? { 'lende:rutenavn': r.navn } : {}),
    },
    _source: 'turrutebasen',
  }))
}

// Løypene OSM allerede har — veier og relasjons-medlemmer med løype-tagger.
// Skiløypene tynnes BARE mot disse og ikke mot stier og veier: at en løype
// følger en skogsvei er nettopp tilfellet der den skal tegnes i tillegg.
function skiLinjer(elements) {
  const out = []
  for (const el of elements ?? []) {
    if (!erSkiloype(el?.tags)) continue
    if (Array.isArray(el.geometry) && el.geometry.length >= 2) out.push(el.geometry)
    for (const m of el.members ?? []) {
      if (Array.isArray(m.geometry) && m.geometry.length >= 2) out.push(m.geometry)
    }
  }
  return out
}

async function safeFetchText(url, { signal, timeoutMs = 15000, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return null
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (res.ok) return await res.text()
    } catch (e) {
      if (signal?.aborted) return null
      if (attempt === retries) console.warn(`[Turrutebasen] WFS feilet (${retries + 1} forsøk): ${e?.message ?? e}`)
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    if (attempt < retries && !signal?.aborted) await new Promise(r => setTimeout(r, 700))
  }
  return null
}

/**
 * Hent og parse fotruter i bbox — NETTVERK BARE, ingen dedup. Skilt fra
 * uttynningen med vilje: dedup trenger OSM-elementene, og Overpass er den
 * trege kilden. Hentes ruta parallelt og tynnes først når begge er inne,
 * legger WFS-en ingenting til byggetiden.
 *
 * Rapporterer utfallet via `onStatus` (Utvikler-fanen) etter samme mønster som
 * NVE-innsjøene — en stille CORS-/nettfeil på mobil er ellers usynlig.
 * Feiler aldri hardt → [].
 */
export async function fetchTurruteRoutes(bbox, opts = {}) {
  const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
    onStatus({ state: 'feil', message: 'ugyldig bbox' })
    return []
  }
  const txt = await safeFetchText(buildTurruteUrl(bbox), opts)
  if (txt == null) {
    onStatus({ state: 'feil', message: 'WFS svarte ikke' })
    return []
  }
  const routes = parseFotruter(txt)
  onStatus({ state: 'ok', ruter: routes.length })
  return routes
}

/**
 * Tynn ruter mot OSM-elementene og gjør dem om til kart-elementer.
 * Oppdaterer `status` (fra fetchTurruteRoutes) med hvor mye som ble nytt.
 */
export function turruteElementsFrom(routes, osmElements, status = null) {
  const kept = dedupeRoutesAgainstLines(routes, travelLineGeometries(osmElements))
  const elements = turruterToElements(kept)
  if (routes?.length) {
    console.log(`[Turrutebasen] ${routes.length} fotruter → ${elements.length} nye strekk (resten dekkes av OSM)`)
  }
  if (status && status.state === 'ok') status.nye = elements.length
  return elements
}


/**
 * Hent og parse skiløyper i bbox. Samme kontrakt som fetchTurruteRoutes:
 * nettverk bare, feiler aldri hardt → [].
 */
export async function fetchSkiloyper(bbox, opts = {}) {
  const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
    onStatus({ state: 'feil', message: 'ugyldig bbox' })
    return []
  }
  const txt = await safeFetchText(buildTurruteUrl(bbox, { type: TYPE_SKI }), opts)
  if (txt == null) {
    onStatus({ state: 'feil', message: 'WFS svarte ikke' })
    return []
  }
  const routes = parseSkiloyper(txt)
  onStatus({ state: 'ok', ruter: routes.length })
  return routes
}

/** Tynn skiløyper mot OSM-løypene og gjør dem om til kart-elementer. */
export function skiloypeElementsFrom(routes, osmElements, status = null) {
  const kept = dedupeRoutesAgainstLines(routes, skiLinjer(osmElements))
  const elements = skiloyperToElements(kept)
  if (routes?.length) {
    console.log(`[Turrutebasen] ${routes.length} skiløyper → ${elements.length} nye strekk (resten dekkes av OSM)`)
  }
  if (status && status.state === 'ok') status.nye = elements.length
  return elements
}

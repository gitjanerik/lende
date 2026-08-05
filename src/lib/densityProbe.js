// Datatetthets-sondering: teller OSM-features i et utsnitt UTEN å hente
// geometri, så kart-flyten kan velge detaljgrad og størrelse før den tunge
// hentingen starter.
//
// Bakgrunn: et 8 km standardkart er lett i Lierne og 7,17 MB i Oslo. Forskjellen
// er datamengden, ikke arealet — og den varierer med to størrelsesordener.
// Uten et mål på tettheten kan flyten ikke gjøre annet enn å bygge alt og håpe.
//
// Formen er kopiert fra buildCoastProbeQuery/probeCoastline (mapBuilder.js): én
// bitteliten spørring gjennom samme speil-kappløp, ingen retries, og feil er
// ALDRI fatalt — kalleren faller tilbake til dagens oppførsel. Dette er en
// optimalisering, ikke en kilde.
//
// `out count` gir ett element per kategori med tags {nodes, ways, relations,
// total} og ingen geometri — hele svaret er noen hundre byte selv i Oslo.
import { raceOverpassMirrors } from './overpassClient.js'
import { bboxAreaKm2 } from './mapBuilder.js'
import { fetchFredaCount } from './kulturminneWfs.js'

// Kategoriene sonderes i DENNE rekkefølgen, og `out count`-elementene kommer
// tilbake i samme rekkefølge — parseDensityCounts er posisjonsbasert, så
// rekkefølgen her er en del av kontrakten (holdes av enhetstest).
//
// Selektorene speiler de tilsvarende linjene i buildOverpassQuery, men er
// bevisst GROVERE: vi måler tetthet, ikke innhold, og en bredere selektor er
// billigere å telle enn en regex over ti alternativer.
export const DENSITY_CATEGORIES = Object.freeze([
  { key: 'bygning',    selectors: ['way["building"];'] },
  { key: 'kulturminne', selectors: ['node["historic"];', 'way["historic"];'] },
  { key: 'vei',        selectors: ['way["highway"];'] },
  { key: 'parkering',  selectors: ['node["amenity"="parking"];', 'way["amenity"="parking"];'] },
  { key: 'sted',       selectors: ['node["place"];'] },
  { key: 'holdeplass', selectors: [
    'node["highway"="bus_stop"];',
    'node["railway"~"^(station|halt|tram_stop)$"];',
    'node["public_transport"="station"];',
  ] },
])

const PROBE_TIMEOUT_S = 20

/**
 * Bygg count-spørringen. Hver kategori pakkes i en eksplisitt union — uten
 * parentesene ville statement nr. 2 overskrive resultatsettet `_` og vi ville
 * bare telt den siste selektoren.
 */
export function buildDensityProbeQuery(bbox) {
  const blocks = DENSITY_CATEGORIES.map(
    (c) => `(\n  ${c.selectors.join('\n  ')}\n);\nout count;`,
  ).join('\n')
  return `
[out:json][timeout:${PROBE_TIMEOUT_S}][bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}];
${blocks}
`.trim()
}

/**
 * Plukk totalene ut av count-svaret. Posisjonsbasert mot DENSITY_CATEGORIES.
 * Mangler et element (eldre Overpass-versjon, delvis svar) blir kategorien 0
 * i stedet for at hele sonderingen kastes — et for lavt tall gir dagens
 * oppførsel, som er den trygge feilretningen.
 */
export function parseDensityCounts(json) {
  const els = (json?.elements ?? []).filter((e) => e?.type === 'count')
  const counts = {}
  DENSITY_CATEGORIES.forEach((c, i) => {
    const n = Number(els[i]?.tags?.total)
    counts[c.key] = Number.isFinite(n) && n >= 0 ? n : 0
  })
  return counts
}

/** Sum av alle sonderte kategorier — grunnlaget for tetthet per km². */
export function totalCount(counts) {
  return Object.values(counts ?? {}).reduce(
    (s, n) => s + (Number.isFinite(n) ? n : 0), 0,
  )
}

/**
 * Sonder datatettheten i et utsnitt.
 *
 * @returns {Promise<{counts, arealKm2, perKm2}|null>} null ved ENHVER feil —
 *   kalleren skal da oppføre seg akkurat som før sonderingen fantes.
 */
export async function probeDensity(bbox, { signal, timeoutMs = 12000 } = {}) {
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) return null
  const arealKm2 = bboxAreaKm2(bbox)
  if (!(arealKm2 > 0)) return null
  try {
    const body = 'data=' + encodeURIComponent(buildDensityProbeQuery(bbox))
    // Fredede kulturminner er gratis å telle (resultType=hits) og er en av de
    // tetteste kildene i byer. fetchFredaCount svelger sine egne feil (→ null).
    const [json, freda] = await Promise.all([
      raceOverpassMirrors(body, { signal, timeoutMs }),
      fetchFredaCount(bbox, { signal, timeoutMs: Math.min(timeoutMs, 8000), retries: 0 })
        .catch(() => null),
    ])
    const counts = parseDensityCounts(json)
    if (Number.isFinite(freda) && freda >= 0) counts.fredet = freda
    return {
      counts,
      arealKm2,
      perKm2: totalCount(counts) / arealKm2,
    }
  } catch (e) {
    if (signal?.aborted) return null
    console.warn(`[tetthet] sondering feilet (${e?.message ?? e}) — bygger med full detalj`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Cache. Pickeren sonderer når senteret flyttes, og buildMapFromCenter sonderer
// når kartet bygges — uten cache ville et «bygg» rett etter et picker-treff
// koste to runder. Nøkkelen kvantiseres til ~0,01° (≈ 1 km) så små justeringer
// av senteret treffer samme celle, og lagres i localStorage med samme
// `lende-`-prefiks som resten av appen.
const MEM = new Map()
const LS_PREFIX = 'lende-density-'
const TTL_MS = 30 * 24 * 60 * 60 * 1000   // 30 d, samme som kulturminne-cachen
const MEM_MAX = 40

export function densityCacheKey(bbox) {
  if (!bbox) return null
  const q = (v) => (Math.round(v * 100) / 100).toFixed(2)
  return `${q(bbox.south)},${q(bbox.west)},${q(bbox.north)},${q(bbox.east)}`
}

function readCache(key) {
  const hit = MEM.get(key)
  if (hit) return hit
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (!v || typeof v !== 'object') return null
    if (!Number.isFinite(v.ts) || Date.now() - v.ts > TTL_MS) return null
    const val = { counts: v.counts, arealKm2: v.arealKm2, perKm2: v.perKm2 }
    MEM.set(key, val)
    return val
  } catch { return null }
}

function writeCache(key, val) {
  if (MEM.size >= MEM_MAX) MEM.delete(MEM.keys().next().value)
  MEM.set(key, val)
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ...val, ts: Date.now() }))
  } catch { /* private mode / quota — cachen er en bonus */ }
}

/** probeDensity med cache. Samme kontrakt: null betyr «vet ikke». */
export async function probeDensityCached(bbox, opts = {}) {
  const key = densityCacheKey(bbox)
  if (!key) return null
  const hit = readCache(key)
  if (hit) return hit
  const val = await probeDensity(bbox, opts)
  if (val) writeCache(key, val)
  return val
}

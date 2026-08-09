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
// Kun Fotrute. Skiløype/Sykkelrute/AnnenRute finnes i samme WFS, men hører
// hjemme i egne lag (en skiløype er ikke en sti om sommeren) — eget løft.
const TYPE = 'app:Fotrute'

// Tak på antall ruter vi henter. Et 16 km-kart i et turtett område (Jotunheimen,
// Nordmarka) kan ha mange hundre; 800 er godt over det uten å risikere en
// payload som timer ut på mobil.
export const TURRUTE_FETCH_CAP = 800

/**
 * WFS GetFeature-URL for et bbox. bbox-parameteren tar `sør,vest,nord,øst` +
 * CRS-urn — EPSG:4258 har lat,lon-akserekkefølge.
 */
export function buildTurruteUrl(bbox, { count = TURRUTE_FETCH_CAP } = {}) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: TYPE,
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

// ── Dedup mot linjer vi allerede tegner ────────────────────────────────────

const R_EARTH = 6371000
const toRad = Math.PI / 180

function metersBetween(a, b) {
  const lat0 = ((a.lat + b.lat) / 2) * toRad
  return R_EARTH * Math.hypot((b.lat - a.lat) * toRad, (b.lon - a.lon) * toRad * Math.cos(lat0))
}

// Punkter langs en linje med maks `stepM` mellomrom. Nødvendig i BEGGE
// retninger: en OSM-way kan ha to punkter 400 m fra hverandre, og en
// verteks-mot-verteks-test ville da kalt hele strekket «nytt» selv om ruta
// ligger rett oppå den.
function densify(geometry, stepM) {
  const out = []
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i], b = geometry[i + 1]
    const d = metersBetween(a, b)
    const steps = Math.max(1, Math.ceil(d / stepM))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t })
    }
  }
  if (geometry.length) out.push(geometry[geometry.length - 1])
  return out
}

// Enkelt lat/lon-rutenett for nærhets-oppslag. Cellestørrelsen settes til
// toleransen, så et treff alltid ligger i en av de 9 nabocellene.
function buildGrid(points, cellM) {
  const grid = new Map()
  if (!points.length) return { grid, cellM, latC: 0, lonC: 0 }
  const latC = cellM / 111320
  const midLat = points[0].lat
  const lonC = cellM / (111320 * Math.max(0.05, Math.cos(midLat * toRad)))
  for (const p of points) {
    const key = `${Math.floor(p.lat / latC)},${Math.floor(p.lon / lonC)}`
    let cell = grid.get(key)
    if (!cell) grid.set(key, (cell = []))
    cell.push(p)
  }
  return { grid, cellM, latC, lonC }
}

function hasNeighbourWithin(index, p, tolM) {
  const { grid, latC, lonC } = index
  if (!grid.size) return false
  const gi = Math.floor(p.lat / latC), gj = Math.floor(p.lon / lonC)
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const cell = grid.get(`${gi + di},${gj + dj}`)
      if (!cell) continue
      for (const q of cell) if (metersBetween(p, q) <= tolM) return true
    }
  }
  return false
}

// Linje-geometrier fra OSM-elementene vi allerede tegner. Bare ferdselslinjer
// er relevante — en rute som følger en innsjøkant er ikke en duplikat.
const FERDSEL = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential',
  'unclassified', 'service', 'living_street', 'path', 'track', 'bridleway',
  'steps', 'footway', 'cycleway',
])

export function travelLineGeometries(elements) {
  const out = []
  for (const el of elements ?? []) {
    const h = el?.tags?.highway
    if (!h || !FERDSEL.has(h)) continue
    if (Array.isArray(el.geometry) && el.geometry.length >= 2) out.push(el.geometry)
  }
  return out
}

// Hvor nær en eksisterende linje en rute må ligge for å regnes som duplikat.
// 30 m er valgt fra dataene: Turrutebasen oppgir `nøyaktighet` 50 (cm-enheter
// → ±0,5 m) men er ofte digitalisert fra eldre kilder, og OSM-stier er tegnet
// fra sporlogger. 30 m fanger den reelle forskyvningen mellom to tegninger av
// SAMME sti uten å svelge en parallell sti på andre siden av en myr.
export const DEDUP_TOLERANCE_M = 30
// Kortere nye biter enn dette droppes. Uten dette gir små avvik langs en
// duplikat-rute en stiplet «konfetti» av 10-20 m-stumper.
export const MIN_NEW_SEGMENT_M = 60
const DENSIFY_M = 10

function lengthOf(geometry) {
  let sum = 0
  for (let i = 0; i < geometry.length - 1; i++) sum += metersBetween(geometry[i], geometry[i + 1])
  return sum
}

/**
 * Behold bare de partiene av hver rute som IKKE følger en linje vi allerede
 * tegner. Returnerer nye rute-objekter (én per sammenhengende nytt parti).
 *
 * @param {Array} routes    fra parseFotruter()
 * @param {Array} lines     [{lat,lon}[]] fra travelLineGeometries()
 */
export function dedupeRoutesAgainstLines(routes, lines, {
  toleranceM = DEDUP_TOLERANCE_M, minSegmentM = MIN_NEW_SEGMENT_M,
} = {}) {
  const dense = []
  for (const g of lines ?? []) dense.push(...densify(g, DENSIFY_M))
  const index = buildGrid(dense, toleranceM)
  const out = []
  for (const route of routes ?? []) {
    // Ruta densifiseres også, ellers kan et langt rute-segment hoppe over
    // dekningen midt på og bli stående som «nytt».
    const pts = densify(route.geometry, DENSIFY_M)
    let run = []
    const flush = () => {
      if (run.length >= 2 && lengthOf(run) >= minSegmentM) {
        out.push({ ...route, id: `${route.id}-${out.length}`, geometry: run })
      }
      run = []
    }
    for (const p of pts) {
      if (hasNeighbourWithin(index, p, toleranceM)) flush()
      else run.push(p)
    }
    flush()
  }
  return out
}

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
  return (routes ?? []).map((r, i) => ({
    type: 'way',
    id: `turrute-${r.id ?? i}`,
    geometry: r.geometry,
    tags: {
      'lende:turrute': 'fotrute',
      merking: r.merking === 'JA' ? 'JA' : 'NEI',
      ...(r.navn ? { 'lende:rutenavn': r.navn } : {}),
      ...(r.ansvarlig ? { 'lende:ansvarlig': r.ansvarlig } : {}),
    },
    _source: 'turrutebasen',
  }))
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

/** Hent + tynn i én operasjon (MCP/headless og tester). */
export async function fetchTurruter(bbox, opts = {}) {
  const routes = await fetchTurruteRoutes(bbox, opts)
  return turruteElementsFrom(routes, opts.osmElements)
}

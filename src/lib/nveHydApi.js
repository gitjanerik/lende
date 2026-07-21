// NVE HydAPI — sanntids vannstand + vanntemperatur for et innsjø-punkt.
//
// HydAPI (https://hydapi.nve.no) er NVEs offisielle hydrologiske API. Det gir
// sanntids- og historiske serier pr MÅLESTASJON (ikke pr innsjø), så vi må
// matche punktet/innsjøen til nærmeste relevante stasjon.
//
// KREVER API-NØKKEL, men den bor SERVER-SIDE: HydAPI krever en nøkkel sendt som
// `X-API-Key`. Nøkkelen kan ikke bakes inn i den offentlige klient-bundelen, så
// kallene går som standard gjennom en Cloudflare Worker-proxy
// (`cloudflare/nve-proxy/`) som legger på nøkkelen. Basen overstyres med
// `VITE_NVE_HYDAPI_URL`. Settes en `apiKey` inn hit (lokal dev mot hydapi.nve.no
// direkte), sendes den som `X-API-Key` — ellers utelates headeren og proxyen
// står for nøkkelen.
//
// CORS/nett: som de andre eksterne kildene kan dette feile; da returneres
// null (graceful). Stasjonslista caches pr sesjon (den er stor).
//
// Stasjons-matching: nærmeste stasjon som måler ønsket parameter innen
// `maxKm`. For å unngå å plukke en ELV-stasjon i nærheten av en innsjø
// foretrekker vi en stasjon hvis høyde (masl) matcher innsjøens vannflate-
// høyde (±`maslTolM`) — en vannstands-stasjon i innsjøen ligger på flata.

// Standard = Cloudflare Worker-proxyen (offentlig URL, ikke hemmelig). Bytt
// <SUBDOMENE> til ditt workers.dev-subdomene etter deploy, eller sett
// VITE_NVE_HYDAPI_URL ved bygg. Lokal dev direkte mot NVE:
// VITE_NVE_HYDAPI_URL=https://hydapi.nve.no/api/v1 + VITE_NVE_HYDAPI_KEY.
const HYDAPI_BASE =
  import.meta.env?.VITE_NVE_HYDAPI_URL ??
  'https://lende-nve-proxy.<SUBDOMENE>.workers.dev/api/v1'

// X-API-Key kun når en nøkkel faktisk er gitt (dev-modus mot NVE direkte).
// Via proxyen sendes ingen nøkkel fra klienten — Worker-en legger den på.
function apiHeaders(apiKey) {
  const h = { Accept: 'application/json' }
  if (apiKey) h['X-API-Key'] = apiKey
  return h
}

// HydAPI parameter-koder.
export const PARAM_WATER_LEVEL = 1000  // Vannstand (m)
export const PARAM_DISCHARGE = 1001    // Vannføring (m³/s)
export const PARAM_WATER_TEMP = 1003   // Vanntemperatur (°C)

// Offentlig stasjonsside hos NVE (Sildre) for en gitt stasjons-id.
export function sildreStationUrl(stationId) {
  return `https://sildre.nve.no/station/${encodeURIComponent(stationId)}`
}

/** Haversine-avstand i km mellom to WGS84-punkt. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Måler en stasjon denne parameteren? Skanner `seriesList`. */
function stationHasParameter(station, parameter) {
  const series = station?.seriesList
  if (!Array.isArray(series)) return false
  return series.some(s => Number(s?.parameter) === Number(parameter))
}

/** Stasjonens høyde (moh), eller NaN. HydAPI bruker feltet `masl`. */
function stationMasl(station) {
  const n = Number(station?.masl)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Finn den best matchende stasjonen for et punkt.
 *
 * @param {Array<object>} stations  HydAPI-stasjonsliste (data-arrayen)
 * @param {number} lat
 * @param {number} lon
 * @param {object} [opts]
 * @param {number} [opts.parameter=PARAM_WATER_LEVEL]
 * @param {number} [opts.maxKm=12]      maks avstand
 * @param {number} [opts.lakeHoyde]     innsjøens vannflate-høyde (moh) for masl-match
 * @param {number} [opts.maslTolM=6]    maks |masl − lakeHoyde| for å regnes som «på innsjøen»
 * @returns {{ station: object, distanceKm: number } | null}
 */
export function findNearestStation(stations, lat, lon, opts = {}) {
  const {
    parameter = PARAM_WATER_LEVEL,
    maxKm = 12,
    lakeHoyde,
    maslTolM = 6,
  } = opts
  if (!Array.isArray(stations)) return null

  let best = null
  for (const st of stations) {
    if (!stationHasParameter(st, parameter)) continue
    const slat = Number(st?.latitude)
    const slon = Number(st?.longitude)
    if (!Number.isFinite(slat) || !Number.isFinite(slon)) continue
    const distanceKm = haversineKm(lat, lon, slat, slon)
    if (distanceKm > maxKm) continue

    // Foretrekk en stasjon på innsjøflata: når både innsjøhøyde og stasjons-
    // masl er kjent, krev at de matcher (±maslTolM). Ellers (ukjent masl)
    // godtas stasjonen på avstand alene, men med en liten straff så en
    // høyde-matchende stasjon vinner.
    const masl = stationMasl(st)
    let heightOk = true
    let penalty = 0
    if (Number.isFinite(lakeHoyde) && Number.isFinite(masl)) {
      if (Math.abs(masl - lakeHoyde) > maslTolM) heightOk = false
    } else {
      penalty = 1 // km-ekvivalent straff for ukjent høyde-match
    }
    if (!heightOk) continue

    const score = distanceKm + penalty
    if (!best || score < best.score) best = { station: st, distanceKm, score }
  }
  if (!best) return null
  return { station: best.station, distanceKm: best.distanceKm }
}

/**
 * Hent den nyeste observasjonen fra en HydAPI Observations-respons.
 * @param {{ data?: Array<{ observations?: Array<{ time: string, value: number }> }> }} json
 * @returns {{ time: string, value: number } | null}
 */
export function latestObservation(json) {
  const series = json?.data
  if (!Array.isArray(series) || series.length === 0) return null
  let latest = null
  for (const s of series) {
    const obs = s?.observations
    if (!Array.isArray(obs)) continue
    for (const o of obs) {
      if (o?.value == null) continue   // null/undefined → ikke en måling (Number(null)===0!)
      const value = Number(o.value)
      if (!Number.isFinite(value)) continue
      const t = o?.time ? Date.parse(o.time) : NaN
      if (!latest || (Number.isFinite(t) && t > latest._t)) {
        latest = { time: o.time ?? null, value, _t: Number.isFinite(t) ? t : -Infinity }
      }
    }
  }
  if (!latest) return null
  return { time: latest.time, value: latest.value }
}

// Stasjonsliste caches pr sesjon (stor respons, endrer seg sjelden).
let _stationsCache = null
let _stationsPromise = null

async function fetchStations(apiKey, signal) {
  if (_stationsCache) return _stationsCache
  if (_stationsPromise) return _stationsPromise
  _stationsPromise = (async () => {
    const res = await fetch(`${HYDAPI_BASE}/Stations?Active=1`, {
      headers: apiHeaders(apiKey),
      signal,
    })
    if (!res.ok) throw new Error(`Stations HTTP ${res.status}`)
    const json = await res.json()
    _stationsCache = Array.isArray(json?.data) ? json.data : []
    return _stationsCache
  })()
  try {
    return await _stationsPromise
  } finally {
    _stationsPromise = null
  }
}

async function fetchLatest(stationId, parameter, apiKey, signal) {
  // Siste døgn, timesoppløsning — vi tar nyeste gyldige punkt.
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 3600 * 1000)
  const params = new URLSearchParams({
    StationId: String(stationId),
    Parameter: String(parameter),
    ResolutionTime: '60',
    ReferenceTime: `${start.toISOString()}/${end.toISOString()}`,
  })
  const res = await fetch(`${HYDAPI_BASE}/Observations?${params}`, {
    headers: apiHeaders(apiKey),
    signal,
  })
  if (!res.ok) return null
  return latestObservation(await res.json())
}

/**
 * Hent sanntids vannstand + vanntemperatur for et innsjø-punkt fra HydAPI.
 * DVALE uten API-nøkkel (returnerer null). Graceful ved nett-/CORS-feil.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {object} opts
 * @param {string} [opts.apiKey]              HydAPI-nøkkel (utelates ved proxy-bruk)
 * @param {number} [opts.lakeHoyde]           innsjøhøyde (moh) for stasjons-match
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ stationName: string, distanceKm: number,
 *   waterLevel?: { value: number, time: string|null },
 *   waterTemp?: { value: number, time: string|null } } | null>}
 */
export async function fetchLiveWater(lat, lon, opts = {}) {
  const { apiKey, lakeHoyde, signal } = opts
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    const stations = await fetchStations(apiKey, signal)
    // Match på vannstand først (definerer «stasjonen på denne innsjøen»).
    const match = findNearestStation(stations, lat, lon, {
      parameter: PARAM_WATER_LEVEL, lakeHoyde, maxKm: 12,
    })
    if (!match) return null
    const id = match.station.stationId
    const [level, temp] = await Promise.all([
      fetchLatest(id, PARAM_WATER_LEVEL, apiKey, signal).catch(() => null),
      // Temperatur kan ligge på samme stasjon (måler den parameteren).
      stationHasParameter(match.station, PARAM_WATER_TEMP)
        ? fetchLatest(id, PARAM_WATER_TEMP, apiKey, signal).catch(() => null)
        : Promise.resolve(null),
    ])
    if (!level && !temp) return null
    const out = {
      stationName: match.station.stationName ?? 'NVE-stasjon',
      distanceKm: match.distanceKm,
    }
    if (level) out.waterLevel = level
    if (temp) out.waterTemp = temp
    return out
  } catch (e) {
    if (signal?.aborted) return null
    console.warn(`[HydAPI] sanntids-oppslag feilet: ${e?.message ?? e}`)
    return null
  }
}

// ── Kartlag: hydrologiske målestasjoner i kartutsnittet ────────────────────
// Ren, testbar filtrering av stasjonslista mot en WGS84-bbox. Vi tar bare med
// stasjoner som måler noe brukeren bryr seg om (vannføring, vannstand eller
// temperatur) og som har gyldige koordinater innenfor utsnittet.
const HYDRO_LAYER_PARAMS = [PARAM_DISCHARGE, PARAM_WATER_LEVEL, PARAM_WATER_TEMP]

export function stationsInBbox(stations, bbox) {
  if (!Array.isArray(stations) || !bbox) return []
  const { south, west, north, east } = bbox
  const out = []
  for (const st of stations) {
    const lat = Number(st?.latitude)
    const lon = Number(st?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (lat < south || lat > north || lon < west || lon > east) continue
    if (!HYDRO_LAYER_PARAMS.some(pr => stationHasParameter(st, pr))) continue
    out.push(st)
  }
  return out
}

/**
 * Hent alle relevante målestasjoner innenfor en bbox. DVALE uten API-nøkkel
 * (returnerer []). Graceful ved nett-/CORS-feil.
 *
 * @param {{south:number,west:number,north:number,east:number}} bbox
 * @param {{ apiKey?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function fetchStationsForBbox(bbox, { apiKey, signal } = {}) {
  if (!bbox) return []
  try {
    const stations = await fetchStations(apiKey, signal)
    return stationsInBbox(stations, bbox)
  } catch (e) {
    if (signal?.aborted) return []
    console.warn(`[HydAPI] stasjon-liste feilet: ${e?.message ?? e}`)
    return []
  }
}

/**
 * Hent siste vannføring / vannstand / vanntemperatur for én stasjon. Kun
 * parametere stasjonen faktisk måler spørres. Returnerer et objekt med de
 * verdiene som fantes (kan være tomt).
 *
 * @param {object} station  stasjons-objekt fra stasjonslista (har seriesList)
 * @param {{ apiKey?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ discharge?: {value,time}, waterLevel?: {value,time}, waterTemp?: {value,time} }>}
 */
export async function fetchStationLatest(station, { apiKey, signal } = {}) {
  const out = {}
  if (!station?.stationId) return out
  const id = station.stationId
  const wanted = [
    ['discharge', PARAM_DISCHARGE],
    ['waterLevel', PARAM_WATER_LEVEL],
    ['waterTemp', PARAM_WATER_TEMP],
  ].filter(([, pr]) => stationHasParameter(station, pr))
  const results = await Promise.all(
    wanted.map(([, pr]) => fetchLatest(id, pr, apiKey, signal).catch(() => null)),
  )
  wanted.forEach(([key], i) => { if (results[i]) out[key] = results[i] })
  return out
}

// For test: nullstill stasjons-cache.
export function _resetStationsCache() {
  _stationsCache = null
  _stationsPromise = null
}

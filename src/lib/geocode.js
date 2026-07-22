// Stedssøk. Delt kjerne for useNominatim (UI-composable) og MCP-serveren
// (sok_sted / bygg_kart med sted-navn). Rene funksjoner som tar fetch injisert,
// så de kan testes og kjøres i Node uten avhengighet av et globalt fetch eller vue.
//
// To kilder flettes av searchPlaces():
//  1. Kartverket SSR (Sentralt stedsnavnregister) via Geonorge — autoritativ for
//     norske stedsnavn (fjell, setre, gårder, grender, vann), med fuzzy-søk.
//  2. OpenStreetMap Nominatim — dekker adresser og POI-er (hoteller, severdigheter)
//     som SSR ikke har.
//
// Begge er gratis tjenester — vær rate-limit-vennlig (debounce i UI) og send
// User-Agent i server-kontekst (Nominatim krever det for ikke-nettleser-klienter).

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const STEDSNAVN = 'https://ws.geonorge.no/stedsnavn/v1/navn'

// Kortnavn: «Navn, tettsted» der det finnes, ellers de to første leddene av
// display_name. Trekker ut det mest gjenkjennelige stedsnavnet fra adressen.
export function shortNameFor(d) {
  const a = d.address ?? {}
  const place = a.suburb || a.village || a.town || a.city || a.municipality || a.county || ''
  const parts = []
  if (d.name) parts.push(d.name)
  else if (a.road) parts.push(a.road)
  else if (a.postcode) parts.push(a.postcode)
  if (place && place !== parts[0]) parts.push(place)
  return parts.join(', ') || d.display_name.split(',').slice(0, 2).join(',')
}

// Normaliser ett Nominatim-treff til vårt interne format.
export function normalizeNominatim(d) {
  return {
    id: d.place_id,
    name: d.display_name,
    shortName: shortNameFor(d),
    type: d.type,
    importance: d.importance,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    bbox: d.boundingbox?.map(parseFloat) ?? null,
    source: 'nominatim',
  }
}

// Normaliser ett Kartverket SSR-treff (v1 /navn) til samme interne format.
// SSR er punkt-baserte navn uten bounding box (bbox=null) — extentInfo() i
// MCP-serveren tåler det. Feltnavn med æ/ø leses via bracket-tilgang.
// Returnerer null hvis representasjonspunktet mangler gyldige koordinater.
export function normalizeKartverket(item) {
  const rp = item?.representasjonspunkt ?? {}
  const lat = parseFloat(rp['nord'])
  const lon = parseFloat(rp['øst'])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const skrivemate = item['skrivemåte'] ?? ''
  const kommune = item.kommuner?.[0]?.kommunenavn ?? ''
  const label = kommune ? `${skrivemate}, ${kommune}` : skrivemate
  return {
    id: `ssr:${item.stedsnummer ?? skrivemate}`,
    name: label,
    shortName: label,
    type: (item.navneobjekttype ?? '').toLowerCase() || null,
    importance: 0.5,
    lat,
    lon,
    bbox: null,
    source: 'kartverket',
  }
}

// Nærmeste gjenkjennelige stedsnavn fra et reverse-treff. Prioriterer det MEST
// lokale leddet (gård/grend/boligfelt) og faller gradvis tilbake til større
// enheter, så et GPS-punkt ute i terrenget får «Stormoen» framfor kommunenavnet.
// Returnerer null hvis ingenting brukbart finnes (kaller faller tilbake selv).
export function nearestPlaceLabel(d) {
  if (!d) return null
  const a = d.address ?? {}
  const label =
    a.hamlet || a.isolated_dwelling || a.farm || a.village ||
    a.neighbourhood || a.quarter || a.suburb || a.town ||
    a.city_district || a.city || a.municipality ||
    d.name ||
    (d.display_name ? d.display_name.split(',')[0].trim() : '')
  return label || null
}

/**
 * Revers-geokod en koordinat til nærmeste stedsnavn (Nominatim /reverse).
 * @param {number} lat
 * @param {number} lon
 * @param {{signal?:AbortSignal, fetchImpl?:Function, endpoint?:string,
 *          userAgent?:string, zoom?:number}} opts
 * @returns {Promise<{id,name,shortName,type,importance,lat,lon,bbox,placeLabel}|null>}
 */
export async function reverseGeocode(lat, lon, opts = {}) {
  const { signal, fetchImpl, endpoint = NOMINATIM_REVERSE, userAgent, zoom = 14 } = opts
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const doFetch = fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('Ingen fetch tilgjengelig for geokoding')

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), format: 'jsonv2',
    addressdetails: '1', zoom: String(zoom),
  })
  const headers = { Accept: 'application/json' }
  if (userAgent) headers['User-Agent'] = userAgent

  const res = await doFetch(`${endpoint}?${params}`, { signal, headers })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = await res.json()
  if (!data || data.error) return null
  return { ...normalizeNominatim(data), placeLabel: nearestPlaceLabel(data) }
}

/**
 * Geokod et fritekst-søk til en liste normaliserte treff (viktigst først).
 * @param {string} query
 * @param {{countryCode?:string, limit?:number, signal?:AbortSignal,
 *          fetchImpl?:Function, endpoint?:string, userAgent?:string}} opts
 * @returns {Promise<Array<{id,name,shortName,type,importance,lat,lon,bbox}>>}
 */
export async function geocodePlace(query, opts = {}) {
  const { countryCode = 'no', limit = 8, signal, fetchImpl, endpoint = NOMINATIM, userAgent } = opts
  const q = (query ?? '').trim()
  if (q.length < 2) return []

  const doFetch = fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('Ingen fetch tilgjengelig for geokoding')

  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: String(limit), addressdetails: '1', countrycodes: countryCode,
  })
  const headers = { Accept: 'application/json' }
  if (userAgent) headers['User-Agent'] = userAgent

  const res = await doFetch(`${endpoint}?${params}`, { signal, headers })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(normalizeNominatim) : []
}

/**
 * Geokod et fritekst-søk mot Kartverket SSR (autoritativt norsk stedsnavnregister).
 * Bruker fuzzy-søk så små avvik (f.eks. «Bøseter» vs «Bøsetra») fanges opp, og
 * ber om koordinater i WGS84 (utkoordsys=4258) så nord=lat, øst=lon.
 * @param {string} query
 * @param {{limit?:number, signal?:AbortSignal, fetchImpl?:Function,
 *          endpoint?:string, userAgent?:string}} opts
 * @returns {Promise<Array<{id,name,shortName,type,importance,lat,lon,bbox,source}>>}
 */
export async function geocodeKartverket(query, opts = {}) {
  const { limit = 8, signal, fetchImpl, endpoint = STEDSNAVN, userAgent } = opts
  const q = (query ?? '').trim()
  if (q.length < 2) return []

  const doFetch = fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('Ingen fetch tilgjengelig for geokoding')

  const params = new URLSearchParams({
    sok: q, fuzzy: 'true', utkoordsys: '4258', treffPerSide: String(limit), side: '1',
  })
  const headers = { Accept: 'application/json' }
  if (userAgent) headers['User-Agent'] = userAgent

  const res = await doFetch(`${endpoint}?${params}`, { signal, headers })
  if (!res.ok) throw new Error(`Kartverket ${res.status}`)
  const data = await res.json()
  const navn = Array.isArray(data?.navn) ? data.navn : []
  return navn.map(normalizeKartverket).filter(Boolean)
}

// Match-kvalitet mellom søket og et treff (lavere = bedre). Sammenlikner mot
// selve navnet (første ledd før komma), ikke hele «Navn, kommune»-etiketten.
function matchRank(query, r) {
  const q = query.trim().toLowerCase()
  const label = (r.shortName || r.name || '').toLowerCase()
  const head = label.split(',')[0].trim()
  if (head === q) return 0
  if (head.startsWith(q)) return 1
  if (head.includes(q)) return 2
  if (label.includes(q)) return 3
  return 4
}

// Dedup-nøkkel: navnet + koordinat avrundet til ~100 m. Samme sted fra to
// kilder kolliderer og telles én gang (første forekomst vinner).
function dedupKey(r) {
  const head = (r.shortName || r.name || '').split(',')[0].trim().toLowerCase()
  return `${head}@${r.lat.toFixed(3)},${r.lon.toFixed(3)}`
}

/**
 * Flett stedssøk fra Kartverket SSR og OpenStreetMap Nominatim til én liste.
 * Kildene kjøres parallelt; feiler/CORS-blokkeres den ene (allSettled), brukes
 * den andre alene. Treff dedupliseres (SSR foretrekkes for norsk skrivemåte) og
 * rangeres etter match-kvalitet, så kilde (SSR før OSM), så importance.
 * @param {string} query
 * @param {{limit?:number, signal?:AbortSignal, fetchImpl?:Function,
 *          userAgent?:string, countryCode?:string}} opts
 * @returns {Promise<Array<{id,name,shortName,type,importance,lat,lon,bbox,source}>>}
 */
export async function searchPlaces(query, opts = {}) {
  const { limit = 8 } = opts
  const q = (query ?? '').trim()
  if (q.length < 2) return []

  const [kv, nom] = await Promise.allSettled([
    geocodeKartverket(q, opts),
    geocodePlace(q, opts),
  ])
  const kvHits = kv.status === 'fulfilled' ? kv.value : []
  const nomHits = nom.status === 'fulfilled' ? nom.value : []

  const seen = new Set()
  const merged = []
  for (const r of [...kvHits, ...nomHits]) {
    const key = dedupKey(r)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(r)
  }

  merged.forEach((r, i) => { r._order = i })
  merged.sort((a, b) => {
    const ra = matchRank(q, a), rb = matchRank(q, b)
    if (ra !== rb) return ra - rb
    const sa = a.source === 'kartverket' ? 0 : 1
    const sb = b.source === 'kartverket' ? 0 : 1
    if (sa !== sb) return sa - sb
    const ia = a.importance ?? 0, ib = b.importance ?? 0
    if (ia !== ib) return ib - ia
    return a._order - b._order
  })

  return merged.slice(0, limit).map(({ _order, ...r }) => r)
}

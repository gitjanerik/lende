// Stedssøk via OpenStreetMap Nominatim. Delt kjerne for useNominatim
// (UI-composable) og MCP-serveren (sok_sted / bygg_kart med sted-navn). Ren
// funksjon som tar fetch injisert, så den kan testes og kjøres i Node uten
// avhengighet av et globalt fetch eller vue.
//
// Free service — vær rate-limit-vennlig (debounce i UI) og send User-Agent i
// server-kontekst (Nominatim krever det for ikke-nettleser-klienter).

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

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

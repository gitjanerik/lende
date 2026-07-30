// Dyplenker til 3D-turvisningen — delt mellom appen (MapView-restore) og
// MCP-serveren (planlegg_rute / planlegg_rundtur returnerer tur3dUrl så
// agenten kan foreslå «se turen i 3D» rett etter planlegging).
//
// Lenken bygger på det eksisterende dele-formatet: kart-parametre
// (lat/lon/km/eq/asp → mottakeren bygger samme kart via /kart/nytt) pluss
// tur-parametre. Rundtur: olat/olon + rtv (vendepunkt) — identisk med den
// gamle «Del rundtur»-lenken, så eldre lenker fortsetter å virke. A→B:
// olat/olon + dlat/dlon (+ rtv som via-punkter). v3d=1 åpner 3D-visningen
// automatisk etter at ruta er gjenskapt.

export const LENDE_APP_BASE = 'https://gitjanerik.github.io/lende'

const fix6 = (n) => Number(n).toFixed(6)

/** Turen → query-params (POJO). dest = null ⇒ rundtur (via kreves). */
export function buildTourParams({ origin, dest = null, via = [], routeIdx = 0, open3d = true }) {
  const params = {
    olat: fix6(origin.lat),
    olon: fix6(origin.lon),
  }
  if (dest) {
    params.dlat = fix6(dest.lat)
    params.dlon = fix6(dest.lon)
  }
  if (via.length) {
    params.rtv = via.map((v) => `${fix6(v.lat)},${fix6(v.lon)}`).join(';')
  }
  params.ri = String(routeIdx ?? 0)
  if (open3d) params.v3d = '1'
  return params
}

/**
 * Query (f.eks. vue-router route.query) → tur, eller null når lenken ikke
 * bærer en tur. Gamle rundtur-lenker (uten dlat/v3d) parses som før.
 */
export function parseTourQuery(query) {
  const num = (k) => parseFloat(query?.[k])
  const olat = num('olat')
  const olon = num('olon')
  if (!Number.isFinite(olat) || !Number.isFinite(olon)) return null
  const dlat = num('dlat')
  const dlon = num('dlon')
  const dest = Number.isFinite(dlat) && Number.isFinite(dlon) ? { lat: dlat, lon: dlon } : null
  const via = String(query?.rtv ?? '')
    .split(';')
    .map((s) => s.split(',').map(parseFloat))
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))
    .map(([lat, lon]) => ({ lat, lon }))
  if (!dest && !via.length) return null
  const ri = parseInt(query?.ri, 10)
  return {
    origin: { lat: olat, lon: olon },
    dest,
    via,
    routeIdx: Number.isFinite(ri) ? ri : 0,
    open3d: query?.v3d === '1' || query?.v3d === 1,
  }
}

/**
 * Full dyplenke: mottakeren bygger kartet (/kart/nytt) og lander i 3D.
 * `map`: { lat, lon, kmBredde, equidistanceM, aspekt? } — senter + størrelse
 * som ved bygg_kart / delt lagret kart.
 */
export function buildTour3dUrl({ appBase = LENDE_APP_BASE, map, tour }) {
  const params = new URLSearchParams()
  params.set('lat', Number(map.lat).toFixed(5))
  params.set('lon', Number(map.lon).toFixed(5))
  params.set('km', String(map.kmBredde))
  if (Number.isFinite(map.equidistanceM)) params.set('eq', String(map.equidistanceM))
  if (Number.isFinite(map.aspekt)) params.set('asp', map.aspekt.toFixed(3))
  for (const [k, v] of Object.entries(buildTourParams(tour))) params.set(k, v)
  return `${appBase.replace(/\/$/, '')}/kart/nytt?${params.toString()}`
}

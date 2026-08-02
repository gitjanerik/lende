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
export function buildTourParams({ origin, dest = null, via = [], routeIdx = 0, open3d = true, name = null }) {
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
  // tn = turnavn: mottakerens kart bygges med dette navnet i stedet for
  // «Uten navn» (samme 60-tegns tak som pickerens kartnavn-felt).
  const tn = typeof name === 'string' ? name.trim().slice(0, 60) : ''
  if (tn) params.tn = tn
  return params
}

/**
 * Query (f.eks. vue-router route.query) → tur, eller null når lenken ikke
 * bærer en tur. Gamle rundtur-lenker (uten dlat/v3d) parses som før.
 */
/**
 * Navnebasert tur (tfn/ttn): «lag et kart over X og gå en tur fra A til B».
 * Kartet finnes ikke når chatten svarer, så koordinater kan ikke slås opp —
 * NAVNENE følger i stedet med gjennom byggeflyten, og MapView løser dem mot
 * kartets egen søkeindeks når stiene er på plass.
 * @returns {{fromName:string, toName:string, open3d:boolean, name:string|null}|null}
 */
export function parseTourNameQuery(query) {
  const s = (k) => (typeof query?.[k] === 'string' ? query[k].trim().slice(0, 60) : '')
  const fromName = s('tfn')
  const toName = s('ttn')
  if (!fromName || !toName) return null
  const tn = s('tn')
  return {
    fromName,
    toName,
    open3d: query?.v3d === '1' || query?.v3d === 1,
    name: tn || null,
  }
}

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
  const tn = typeof query?.tn === 'string' ? query.tn.trim().slice(0, 60) : ''
  return {
    origin: { lat: olat, lon: olon },
    dest,
    via,
    routeIdx: Number.isFinite(ri) ? ri : 0,
    open3d: query?.v3d === '1' || query?.v3d === 1,
    name: tn || null,
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

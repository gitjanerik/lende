// Datainnsamling for 3D-turen: severdigheter i korridoren rundt ruta.
//
// Kartets egen søkeindeks (buildSearchIndex) er offline-kilden — topper,
// tjern/vann, steder, hytter og naturreservater ligger allerede i SVG-en.
// NVE-målestasjoner og fredede kulturminner hentes over nett og «popper inn»
// asynkront; feil svelges stille så turen aldri blokkeres av en kilde.

import { svgToWgs84, wgs84ToSvg } from '../utm.js'
import { distanceToRoute, routeBboxWgs84 } from '../routeEnrichment.js'
import { kindMeta } from './featureTimeline.js'

// Plukk korridor-kandidater fra søkeindeksen. `el`-referansen strippes så
// resultatet er rene data (trygt å sende inn i engine/reaktivitet).
export function collectMapFeatures(searchIndex, route, { maxDistM = 400 } = {}) {
  if (!route || route.length < 2) return []
  const out = []
  for (const entry of searchIndex ?? []) {
    if (!entry?.name || !kindMeta(entry.kind, entry.categories)) continue
    const { distM } = distanceToRoute([entry.x, entry.y], route)
    if (distM > maxDistM) continue
    out.push({
      name: entry.name,
      kind: entry.kind,
      x: entry.x,
      y: entry.y,
      ele: entry.ele ?? null,
      areaM2: entry.areaM2 ?? null,
      categories: entry.categories ?? null,
    })
  }
  return out
}

// NVE-målestasjoner i kartutsnittet, konvertert til SVG-meter.
// Detaljene (siste vannføring/-stand/-temp) hentes lazily av infokortet.
export async function loadNveFeatures({ meta, signal }) {
  const { fetchStationsForBbox, stationsInBbox, pickStationInfo, sildreStationUrl } =
    await import('../nveHydApi.js')
  const bbox = bboxFromMeta(meta)
  const all = await fetchStationsForBbox(bbox, { signal })
  const inMap = stationsInBbox(all, bbox)
  return inMap.map(st => {
    const { x, y } = wgs84ToSvg(st.latitude, st.longitude, meta)
    return {
      name: st.stationName,
      kind: 'nve',
      x, y,
      ele: Number.isFinite(st.masl) ? st.masl : null,
      areaM2: null,
      categories: null,
      detail: {
        station: st,
        info: pickStationInfo(st),
        sildreUrl: sildreStationUrl(st.stationId),
      },
    }
  })
}

// Fredede kulturminner (Riksantikvaren WFS) i en buffer rundt ruta,
// TTL-cachet i lende-cache.
export async function loadHeritageFeatures({ route, meta, signal }) {
  const [{ fetchFredaKulturminner, clusterByMinMeters }, cacheMod] = await Promise.all([
    import('../kulturminneWfs.js'),
    import('../protectedAreaCache.js'),
  ])
  const { cacheGet, cacheSet, fredetKulturminneBboxKey, TTL } = cacheMod
  const routeWgs = route.map(([x, y]) => {
    const ll = svgToWgs84(x, y, meta)
    return [ll.lon, ll.lat]
  })
  const bbox = routeBboxWgs84(routeWgs, 250)
  if (!bbox) return []
  const key = fredetKulturminneBboxKey(bbox)
  let items = await cacheGet(key)
  if (!items) {
    items = await fetchFredaKulturminner(bbox, { signal })
    if (items?.length) cacheSet(key, items, TTL.kulturminne)
  }
  return clusterByMinMeters(items ?? [], 60).map(k => {
    const { x, y } = wgs84ToSvg(k.lat, k.lon, meta)
    return {
      name: k.navn || 'Kulturminne',
      kind: 'kulturminne',
      x, y,
      ele: null,
      areaM2: null,
      categories: null,
      detail: { kulturminne: k },
    }
  })
}

// WGS84-bbox fra kartets fire hjørner (samme som useHydroStations.bboxFromMeta,
// duplisert for å holde chunk-grensen ren — composablen drar med seg Vue).
export function bboxFromMeta(m) {
  const cs = [
    svgToWgs84(0, 0, m), svgToWgs84(m.widthM, 0, m),
    svgToWgs84(0, m.heightM, m), svgToWgs84(m.widthM, m.heightM, m),
  ]
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const c of cs) {
    if (c.lat < south) south = c.lat
    if (c.lat > north) north = c.lat
    if (c.lon < west) west = c.lon
    if (c.lon > east) east = c.lon
  }
  return { south, west, north, east }
}

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

// Utfartsparkering ved rutens start — og ved målet for A→B-ruter (rundtur
// ender der den startet). Kun når parkeringen faktisk ER start-/målpunktet
// (≤ 50 m) — større radius traff parkeringer turen ikke utgår fra og
// P-skiltet virket tilfeldig. Samme plass returneres bare én gang.
export function findParkingSpots(searchIndex, route, { isLoop = false, maxDistM = 50 } = {}) {
  if (!route || route.length < 2) return []
  const parking = (searchIndex ?? []).filter(e => e?.kind === 'parkering')
  if (!parking.length) return []
  const nearest = ([px, py]) => {
    let best = null
    let bestD = Infinity
    for (const p of parking) {
      const d = Math.hypot(p.x - px, p.y - py)
      if (d < bestD) { bestD = d; best = p }
    }
    return bestD <= maxDistM ? best : null
  }
  const spots = []
  const start = nearest(route[0])
  if (start) spots.push({ x: start.x, y: start.y, name: start.name })
  if (!isLoop) {
    const end = nearest(route[route.length - 1])
    if (end && !(spots[0] && spots[0].x === end.x && spots[0].y === end.y)) {
      spots.push({ x: end.x, y: end.y, name: end.name })
    }
  }
  return spots
}

// Pausepunkter: vendepunkt/delmål som ligger ved et tjern eller vann —
// der tar man sannsynligvis rast (og kanskje et bad). Store vann måles mot
// en areal-skalert radius siden sentroiden kan ligge langt fra bredden.
export function findPauseSpots(searchIndex, via = [], { maxDistM = 150 } = {}) {
  if (!via.length) return []
  const water = (searchIndex ?? []).filter(e =>
    e?.kind === 'vann-navn' || e?.kind === 'vann-omrade' || e?.categories?.includes('vann'))
  if (!water.length) return []
  const spots = []
  for (const v of via) {
    let best = null
    let bestD = Infinity
    for (const w of water) {
      const radius = Math.max(maxDistM, Number.isFinite(w.areaM2) ? Math.sqrt(w.areaM2) * 0.6 : 0)
      const d = Math.hypot(w.x - v.svgX, w.y - v.svgY)
      if (d <= radius && d < bestD) { bestD = d; best = w }
    }
    if (best) spots.push({ x: v.svgX, y: v.svgY, name: best.name })
  }
  return spots
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

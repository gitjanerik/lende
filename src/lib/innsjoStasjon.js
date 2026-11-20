// Hvilken NVE-målestasjon hører til innsjøen i 3D? En stasjon I vannet, eller
// i en tilstøtende elv: høyst ELV_RADIUS_KM fra strandlinja. Ren regning på
// stasjonslista fra HydAPI og omrisset fra dybdekurve-fila ([lon, lat]-ringer).

import { PARAM_DISCHARGE, PARAM_WATER_LEVEL, PARAM_WATER_TEMP } from './nveHydApi.js'

export const ELV_RADIUS_KM = 2

const KM_PER_GRAD_LAT = 110.57

function maaler(st, pr) {
  return Array.isArray(st?.seriesList) && st.seriesList.some(s => Number(s?.parameter) === pr)
}

/** Avstand i km fra punktet til omrisset; 0 når punktet ligger i vannet. */
export function avstandTilOmrissKm(omriss, lat, lon) {
  const kx = Math.cos((lat * Math.PI) / 180) * 111.32
  let inne = false
  let best = Infinity
  for (const ring of omriss ?? []) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      // Partall/oddetall over alle ringene: en øy er et hull.
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inne = !inne
      const ax = (xj - lon) * kx, ay = (yj - lat) * KM_PER_GRAD_LAT
      const bx = (xi - lon) * kx, by = (yi - lat) * KM_PER_GRAD_LAT
      const dx = bx - ax, dy = by - ay
      const l2 = dx * dx + dy * dy
      const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
    }
  }
  return inne ? 0 : best
}

/**
 * Den beste stasjonen for innsjøen, eller null. En stasjon i selve vannet går
 * foran en elvestasjon like ved. Ellers vinner den nærmeste, men en stasjon som
 * mangler vanntemperatur eller vannføring taper litt, for det er de to tallene
 * panelet finnes for. Vannstand alene er nok til å bli med.
 */
export function velgInnsjoStasjon(stasjoner, omriss, { maxKm = ELV_RADIUS_KM } = {}) {
  let best = null
  for (const st of stasjoner ?? []) {
    const lat = Number(st?.latitude)
    const lon = Number(st?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const temp = maaler(st, PARAM_WATER_TEMP)
    const foring = maaler(st, PARAM_DISCHARGE)
    if (!temp && !foring && !maaler(st, PARAM_WATER_LEVEL)) continue
    const avstandKm = avstandTilOmrissKm(omriss, lat, lon)
    if (avstandKm > maxKm) continue
    const score = avstandKm + (temp ? 0 : 0.8) + (foring ? 0 : 0.5) - (avstandKm === 0 ? 0.6 : 0)
    if (!best || score < best.score) best = { stasjon: st, avstandKm, score }
  }
  return best && { stasjon: best.stasjon, avstandKm: best.avstandKm, iVannet: best.avstandKm === 0 }
}

/** WGS84-boksen rundt omrisset, med margin for elvene. */
export function omrissBbox(omriss, margKm = ELV_RADIUS_KM) {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const ring of omriss ?? []) {
    for (const [lon, lat] of ring) {
      if (lat < south) south = lat
      if (lat > north) north = lat
      if (lon < west) west = lon
      if (lon > east) east = lon
    }
  }
  if (!Number.isFinite(south)) return null
  const dLat = margKm / KM_PER_GRAD_LAT
  const dLon = margKm / (111.32 * Math.cos((((south + north) / 2) * Math.PI) / 180))
  return { south: south - dLat, west: west - dLon, north: north + dLat, east: east + dLon }
}

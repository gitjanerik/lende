// N50-vann fra Kartverket, servert som statisk FlatGeobuf.
//
// Kartverkets N50 vektor-WFS (wfs.n50_kartdata) er avviklet. N50-vann bakes
// derfor i CI (scripts/build-n50-water.mjs) til én statisk FlatGeobuf-fil
// (public/data/n50-water.fgb) i EPSG:4326, og klienten spør den på bbox via
// HTTP Range (flatgeobuf har spatial-indeks → laster bare utsnittet). Vann-
// polygonene beholder øyer som INDRE RINGER, så øyer blir ekte hull i kartet
// (Kolstadøya i Setten) — helt uten terskler/DEM-heuristikk.
//
// Feiler aldri hardt: mangler fila (eller vi er utenfor bakt dekning) →
// tom liste, og NVE/OSM-vann tar over som før.

import { geojson as fgbGeojson } from 'flatgeobuf'

// URL til den statiske FGB-en. I nettleseren ligger den under Vite BASE_URL;
// i Node/CI kan N50_WATER_FGB_URL settes (ellers → ingen N50-vann herfra).
function fgbUrl() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      return `${import.meta.env.BASE_URL}data/n50-water.fgb`
    }
  } catch { /* import.meta.env ikke tilgjengelig (Node) */ }
  return (globalThis.process && globalThis.process.env && globalThis.process.env.N50_WATER_FGB_URL) || null
}

// N50 Arealdekke-objtype → OSM-aktig vann-tagging. Havflate = saltvann
// (sjø-stacken), resten (Innsjø, InnsjøRegulert, ElvBekk, FerskvannTørrfall)
// = ferskvann.
function mappingForObjtype(objtype) {
  if (objtype === 'Havflate') {
    return { tag: 'natural', value: 'water', extraTags: { water: 'sea', salt: 'yes' } }
  }
  return { tag: 'natural', value: 'water' }
}

/**
 * Hent N50-vann for et bbox fra den statiske FlatGeobuf-fila. Returnerer
 * OSM-aktige `natural=water`-elementer (way/relation med øy-hull), klare for
 * buildSvg(). Feiler aldri hardt → [] (da tar NVE/OSM over).
 *
 * @param {{south:number,west:number,north:number,east:number}} bbox  WGS84
 * @param {{ fgbUrl?: string }} [opts]
 * @returns {Promise<Array>}  OSM-aktige elementer
 */
export async function fetchN50Water(bbox, opts = {}) {
  const url = opts.fgbUrl ?? fgbUrl()
  if (!url || !bbox) return []
  const rect = { minX: bbox.west, minY: bbox.south, maxX: bbox.east, maxY: bbox.north }
  const elements = []
  try {
    for await (const feat of fgbGeojson.deserialize(url, rect)) {
      const mapping = mappingForObjtype(feat?.properties?.objtype)
      for (const el of geojsonToWays(feat, mapping)) elements.push(el)
    }
  } catch (e) {
    console.warn(`[N50] FGB-vann utilgjengelig (${url}): ${e?.message ?? e}`)
    return []
  }
  console.log(`[N50] ${elements.length} vann-elementer fra FGB`)
  return elements
}

function ringToGeometry(ring) {
  return ring.map(([lon, lat]) => ({ lat, lon }))
}

// Konverter GeoJSON Polygon-koordinater ([outer, ...holes]) til ett
// map-element. Uten hull → way; med hull → relation (outer + inner) så
// mapBuilder klipper øy-hullene.
function polygonToElement(coordinates, id, tags) {
  const outer = coordinates[0]
  if (coordinates.length === 1) {
    return { type: 'way', id, geometry: ringToGeometry(outer), tags, _source: 'n50' }
  }
  const members = [{ type: 'way', role: 'outer', geometry: ringToGeometry(outer) }]
  for (let h = 1; h < coordinates.length; h++) {
    if (coordinates[h].length < 3) continue
    members.push({ type: 'way', role: 'inner', geometry: ringToGeometry(coordinates[h]) })
  }
  return { type: 'relation', id, members, tags, _source: 'n50' }
}

// GeoJSON-feature → OSM-aktige elementer. Bevarer Polygon/MultiPolygon-hull
// (øyer) som relation(outer+inner) → mapBuilder klipper dem via evenodd.
export function geojsonToWays(feat, mapping) {
  const g = feat.geometry
  if (!g) return []
  const tags = {
    [mapping.tag]: mapping.value,
    ...(mapping.extraTags ?? {}),
    ...(feat.properties ?? {}),
  }
  const baseId = feat.id ?? Math.random()
  const result = []
  if (g.type === 'LineString' && g.coordinates.length >= 2) {
    result.push({
      type: 'way',
      id: baseId,
      geometry: g.coordinates.map(([lon, lat]) => ({ lat, lon })),
      tags,
      _source: 'n50',
    })
  } else if (g.type === 'MultiLineString') {
    for (let i = 0; i < g.coordinates.length; i++) {
      const line = g.coordinates[i]
      if (line.length < 2) continue
      result.push({
        type: 'way',
        id: `${baseId}-${i}`,
        geometry: line.map(([lon, lat]) => ({ lat, lon })),
        tags,
        _source: 'n50',
      })
    }
  } else if (g.type === 'Polygon' && g.coordinates[0]?.length >= 3) {
    // Én-ring polygon → way (kan slås sammen på navn av unionByName).
    // Har polygonet hull (øyer i innsjøen) → relation med outer + inner
    // så mapBuilder klipper øy-hullene via evenodd. Slippes hullene her,
    // fylles innsjøen opakt over øyene (Kolstadøya/Setten-tilfellet).
    result.push(polygonToElement(g.coordinates, baseId, tags))
  } else if (g.type === 'MultiPolygon') {
    // Uten hull i noen del: én way per del (bevarer unionByName-fletting).
    // Med hull i minst én del: én relation som samler alle outer/inner-
    // ringer så øyene klippes.
    const hasHoles = g.coordinates.some(poly => poly.length > 1)
    if (hasHoles) {
      const members = []
      for (const poly of g.coordinates) {
        if (!poly[0] || poly[0].length < 3) continue
        members.push({ type: 'way', role: 'outer', geometry: ringToGeometry(poly[0]) })
        for (let h = 1; h < poly.length; h++) {
          if (poly[h].length < 3) continue
          members.push({ type: 'way', role: 'inner', geometry: ringToGeometry(poly[h]) })
        }
      }
      if (members.length) {
        result.push({ type: 'relation', id: baseId, members, tags, _source: 'n50' })
      }
    } else {
      for (let i = 0; i < g.coordinates.length; i++) {
        const poly = g.coordinates[i]
        if (!poly[0] || poly[0].length < 3) continue
        result.push({
          type: 'way',
          id: `${baseId}-${i}`,
          geometry: ringToGeometry(poly[0]),
          tags,
          _source: 'n50',
        })
      }
    }
  } else if (g.type === 'Point') {
    result.push({
      type: 'node',
      id: baseId,
      lat: g.coordinates[1],
      lon: g.coordinates[0],
      tags,
    })
  }
  return result
}

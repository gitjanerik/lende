// N50-vann fra Kartverket, servert som statiske FlatGeobuf-filer per fylke.
//
// Kartverkets N50 vektor-WFS (wfs.n50_kartdata) er avviklet. N50-ferskvann
// bakes derfor i CI (scripts/build-n50-water.mjs) til ÉN FlatGeobuf per fylke
// (public/data/n50-water/<fylkeskode>.fgb) i EPSG:4326, pluss et manifest
// (index.json) som lister hver fils bbox. Klienten leser manifestet, velger
// fylkes-fila(ene) som overlapper kart-bboxen, og spør hver på bbox via HTTP
// Range (flatgeobuf har spatial-indeks → laster bare utsnittet). Vann-
// polygonene beholder øyer som INDRE RINGER, så øyer blir ekte hull i kartet
// (Kolstadøya i Setten) — helt uten terskler/DEM-heuristikk. Havflate (sjø)
// bakes ikke (DEM/Sjøkart eier sjøen) → dette er ferskvann.
//
// Feiler aldri hardt: mangler manifest/fil (eller vi er utenfor bakt dekning)
// → tom liste, og NVE/OSM-vann tar over som før.

import { geojson as fgbGeojson } from 'flatgeobuf'

// Katalog der manifest (index.json) + fylkes-FGB ligger. I nettleseren under
// Vite BASE_URL; i Node/CI kan N50_WATER_DIR_URL settes.
function baseDirUrl() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      return `${import.meta.env.BASE_URL}data/n50-water/`
    }
  } catch { /* import.meta.env ikke tilgjengelig (Node) */ }
  return (globalThis.process && globalThis.process.env && globalThis.process.env.N50_WATER_DIR_URL) || null
}

// N50 Arealdekke-objtype → OSM-aktig vann-tagging. Bare ferskvann bakes, men
// vi beholder Havflate-grenen defensivt (skulle en havflate dukke opp).
function mappingForObjtype(objtype) {
  if (objtype === 'Havflate') {
    return { tag: 'natural', value: 'water', extraTags: { water: 'sea', salt: 'yes' } }
  }
  return { tag: 'natural', value: 'water' }
}

// [minLon, minLat, maxLon, maxLat] overlapper rect {minX,minY,maxX,maxY}?
function bboxOverlapsRect(bbox, rect) {
  return bbox[0] <= rect.maxX && bbox[2] >= rect.minX && bbox[1] <= rect.maxY && bbox[3] >= rect.minY
}

// Les én FGB på bbox-rect og skyv OSM-aktige elementer inn i `into`.
async function readFgbInto(url, rect, into) {
  for await (const feat of fgbGeojson.deserialize(url, rect)) {
    const mapping = mappingForObjtype(feat?.properties?.objtype)
    for (const el of geojsonToWays(feat, mapping)) into.push(el)
  }
}

/**
 * Hent N50-ferskvann for et bbox fra de statiske FlatGeobuf-filene. Returnerer
 * OSM-aktige `natural=water`-elementer (way/relation med øy-hull), klare for
 * buildSvg(). Feiler aldri hardt → [] (da tar NVE/OSM over).
 *
 * @param {{south:number,west:number,north:number,east:number}} bbox  WGS84
 * @param {{ dirUrl?: string, fgbUrl?: string }} [opts]  fgbUrl = les én
 *        eksplisitt FGB direkte (test/direktemodus, hopper over manifestet)
 * @returns {Promise<Array>}  OSM-aktige elementer
 */
export async function fetchN50Water(bbox, opts = {}) {
  if (!bbox) return []
  const rect = { minX: bbox.west, minY: bbox.south, maxX: bbox.east, maxY: bbox.north }
  const elements = []

  // Direktemodus: én eksplisitt FGB-URL, ingen manifest (brukes i test).
  if (opts.fgbUrl) {
    try {
      await readFgbInto(opts.fgbUrl, rect, elements)
    } catch (e) {
      console.warn(`[N50] FGB-vann utilgjengelig (${opts.fgbUrl}): ${e?.message ?? e}`)
      return []
    }
    return elements
  }

  const dirUrl = opts.dirUrl ?? baseDirUrl()
  if (!dirUrl) return []

  let manifest
  try {
    const res = await fetch(`${dirUrl}index.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest = await res.json()
  } catch (e) {
    console.warn(`[N50] manifest utilgjengelig (${dirUrl}index.json): ${e?.message ?? e}`)
    return []
  }

  const hits = (manifest?.fylker ?? []).filter(f =>
    Array.isArray(f.bbox) && f.bbox.length === 4 && f.file && bboxOverlapsRect(f.bbox, rect)
  )
  for (const f of hits) {
    try {
      await readFgbInto(`${dirUrl}${f.file}`, rect, elements)
    } catch (e) {
      console.warn(`[N50] fylke ${f.code} (${f.file}) utilgjengelig: ${e?.message ?? e}`)
    }
  }
  console.log(`[N50] ${elements.length} vann-elementer fra ${hits.length} fylke(r)`)
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

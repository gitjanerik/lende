// Innsjø-polygoner med øy-hull, hentet LIVE fra NVE Innsjødatabasen.
//
// Historikk: Kartverkets N50 vektor-WFS ble avviklet, og en periode bakte vi
// N50-innsjøer til statiske FlatGeobuf-filer i git (~400-800 MB, med
// kvalitets-ødeleggende forenkling for å komme under GitHubs 100 MB/fil-
// grense — «Munkeskjæra-problemet»). CI-diagnose (2026-07-20) viste at NVE
// Innsjødatabasen, spurt via ArcGIS REST `query` på bbox (IKKE `identify`,
// som mister hull), leverer innsjø-polygoner med øy-hullene INTAKTE, i full
// N50-detalj (Setten-ringen: 1861 punkter — identisk med uforenklet N50), med
// CORS for appens origin. Derfor: hent live ved kart-bygging (som Overpass og
// DEM allerede gjør) — ingen statisk bake, ingen forenkling, ingen terskler.
//
// Geometrien er N50-avledet (NVE bygger innsjødatabasen på N50-vann), så
// elementene beholder `_source: 'n50'` — mapBuilder/diagnose behandler dem som
// N50-vann. NVE har ingen Havflate; sjø kommer fra DEM/Sjøkart som før.
//
// Merk: `gis3.nve.no`-basen er død (404) — kun kart.nve.no lever.
// Feiler aldri hardt: nede/utilgjengelig → tom liste, NVE-identify/OSM tar over.

const NVE_LAKE_QUERY_BASE =
  'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5'

// Sikkerhetstak for paginering (30 sider à server-maks ~1000 = 30 000 innsjøer
// — langt over noe reelt kart-bbox). VIKTIG: vi ber IKKE om resultRecordCount
// og antar ALDRI sidestørrelse — ArcGIS-servere har sin egen maxRecordCount
// (typisk 1000), og å be om mer gir stille trunkering: serveren leverer maks,
// en «kort side»-sjekk tror det var siste side, og store innsjøer (Setten!)
// faller vilkårlig ut på innsjø-tette kart. Vi paginerer i stedet på serverens
// eget exceededTransferLimit-flagg + objectid-dedup.
const MAX_PAGES = 30

function timeoutSignal(ms) {
  try { return AbortSignal.timeout(ms) } catch { return undefined }
}

async function queryPage(base, bbox, offset) {
  const params = new URLSearchParams({
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    orderByFields: 'objectid',
    resultOffset: String(offset),
    f: 'geojson',
  })
  const res = await fetch(`${base}/query?${params}`, { signal: timeoutSignal(45000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(`ArcGIS: ${json.error.message ?? json.error.code}`)
  // exceededTransferLimit ligger toppnivå eller under properties avhengig av
  // server-versjon — sjekk begge. Kun dette flagget avgjør om det finnes mer.
  const exceeded = json.exceededTransferLimit === true || json.properties?.exceededTransferLimit === true
  return { features: json.features ?? [], exceeded }
}

/**
 * Hent innsjø-polygoner (med øy-hull) for et bbox fra NVE Innsjødatabasen.
 * Returnerer OSM-aktige `natural=water`-elementer (way/relation med
 * outer+inner), klare for buildSvg(). Feiler aldri hardt → [] (da tar
 * NVE-identify/OSM over som før), men rapporterer utfallet via opts.onStatus
 * så Utvikler-fanen kan vise HVORFOR innsjøer eventuelt mangler (samme grep
 * som sjokartStatus — mobil-feil er ellers usynlige). Prøver to ganger:
 * ett forbigående nett-glipp skal ikke koste innsjøene på et helt kart.
 *
 * @param {{south:number,west:number,north:number,east:number}} bbox  WGS84
 * @param {{ queryBase?: string, onStatus?: (s:object)=>void }} [opts]
 * @returns {Promise<Array>}  OSM-aktige elementer
 */
export async function fetchN50Water(bbox, opts = {}) {
  if (!bbox) return []
  const base = opts.queryBase ?? NVE_LAKE_QUERY_BASE
  const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
  const mapping = { tag: 'natural', value: 'water' }
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800))
    const elements = []
    try {
      const seen = new Set()
      let offset = 0
      let truncated = false
      for (let page = 0; page < MAX_PAGES; page++) {
        const { features, exceeded } = await queryPage(base, bbox, offset)
        let fresh = 0
        for (const feat of features) {
          // Dedup på objectid: hvis serveren ikke støtter resultOffset,
          // returnerer den samme side igjen — da må vi stoppe, ikke doble.
          const oid = feat?.properties?.objectid ?? feat?.id
          if (oid != null) {
            if (seen.has(oid)) continue
            seen.add(oid)
          }
          fresh++
          for (const el of geojsonToWays(feat, mapping)) elements.push(el)
        }
        offset += features.length
        if (!exceeded || features.length === 0 || fresh === 0) {
          truncated = exceeded && fresh === 0
          break
        }
        if (page === MAX_PAGES - 1) truncated = true
      }
      if (truncated) console.warn('[N50] ADVARSEL: NVE-paginering stoppet før alt var hentet — noen innsjøer kan mangle')
      console.log(`[N50] ${elements.length} innsjø-elementer fra NVE Innsjødatabasen`)
      onStatus({ state: 'ok', features: elements.length, retried: attempt > 0, truncated: truncated || undefined })
      return elements
    } catch (e) {
      lastError = e
    }
  }
  const message = String(lastError?.message ?? lastError)
  console.warn(`[N50] NVE-innsjøer utilgjengelig (etter retry): ${message}`)
  onStatus({ state: 'feil', message })
  return []
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

// DIAGNOSE (CI, kun logg): verifiser exceededTransferLimit-paginering mot ekte
// NVE — nå med GIGANTISK bbox (halve Østlandet) som garantert overstiger
// serverens maxRecordCount, så vi ser (a) at flagget faktisk finnes i
// f=geojson-svar ved trunkering, og (b) at løkka henter flere sider.

import { fetchN50Water } from '../src/lib/n50Fetcher.js'

console.log('=== lag-metadata (maxRecordCount) ===')
const meta = await (await fetch('https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5?f=json')).json()
console.log('maxRecordCount =', meta.maxRecordCount, '| supportsPagination =', meta.advancedQueryCapabilities?.supportsPagination)

const bbox = { west: 8.0, south: 59.0, east: 12.0, north: 61.0 } // halve Østlandet

console.log('=== rå side 1 på gigantisk bbox ===')
const url = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query?' +
  new URLSearchParams({
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: 'esriGeometryEnvelope', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'objectid',
    returnGeometry: 'false', orderByFields: 'objectid', resultOffset: '0', f: 'geojson',
  })
const j = await (await fetch(url)).json()
console.log(`side 1: ${j.features?.length} features, exceededTransferLimit(topp)=${j.exceededTransferLimit} (props)=${JSON.stringify(j.properties)}`)

console.log('=== fetchN50Water (uten geometri-tung logging) på gigantisk bbox ===')
const t0 = Date.now()
const els = await fetchN50Water(bbox)
console.log(`totalt: ${els.length} elementer på ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log('=== FERDIG ===')

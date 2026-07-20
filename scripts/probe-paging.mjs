// DIAGNOSE (CI, kun logg): bevis at exceededTransferLimit-pagineringen henter
// ALT på et stort, innsjø-tett bbox (Setskog 12×12 km — som brukerens ombygde
// kart), og at Setten er med. Logger også rå side-størrelse + flagg fra NVE.

import { fetchN50Water } from '../src/lib/n50Fetcher.js'
import { bboxFromCenter } from '../src/lib/mapBuilder.js'

const bbox = bboxFromCenter(59.802, 11.673, 6) // 12×12 km Setskog

console.log('=== rå side 1 (uten resultRecordCount) ===')
const url = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query?' +
  new URLSearchParams({
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: 'esriGeometryEnvelope', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'objectid,navn',
    returnGeometry: 'false', orderByFields: 'objectid', resultOffset: '0', f: 'geojson',
  })
const j = await (await fetch(url)).json()
console.log(`side 1: ${j.features?.length} features, exceededTransferLimit(topp)=${j.exceededTransferLimit} (props)=${j.properties?.exceededTransferLimit}`)

console.log('=== fetchN50Water med fikset paginering ===')
const els = await fetchN50Water(bbox)
console.log(`totalt: ${els.length} elementer`)
const setten = els.find(e => (e.tags?.navn ?? '') === 'Setten')
console.log('Setten med?', setten ? `JA ✅ (${setten.type}, inner=${setten.members?.filter(m => m.role === 'inner').length ?? 0})` : 'NEI ❌')
console.log('=== FERDIG ===')

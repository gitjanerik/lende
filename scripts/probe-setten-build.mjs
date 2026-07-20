// DIAGNOSE (CI, kun logg): bygg Setten headless med v1.0.44-koden og dump
// fasit for «innsjøer borte»-regresjonen: leverer NVE-queryen elementer, hva
// slags form har de (way/relation, tags), og ender de som iso-301-vann med
// øy-hull i den ferdige SVG-en? Sjekker også NVE-helse (query + identify) på
// kjøretidspunktet — brukerens skjermbilder kan ha truffet et NVE-utfall.

import { buildMapHeadless } from '../mcp/headless.js'
import { fetchN50Water } from '../src/lib/n50Fetcher.js'
import { bboxFromCenter } from '../src/lib/mapBuilder.js'

const LAT = 59.802, LON = 11.673

console.log('=== 1. NVE-helse akkurat nå ===')
for (const [label, url] of [
  ['query lag 5', 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query?geometry=11.66,59.78,11.71,59.82&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=vatnLnr&returnGeometry=false&f=json'],
  ['identify', 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/identify?geometry=11.673,59.802&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2&mapExtent=11.66,59.78,11.71,59.82&imageDisplay=400,400,96&returnGeometry=false&f=json'],
]) {
  try {
    const res = await fetch(url, { headers: { Origin: 'https://gitjanerik.github.io' } })
    const cors = res.headers.get('access-control-allow-origin')
    const j = await res.json()
    const n = j.features?.length ?? j.results?.length ?? (j.error ? `FEIL ${JSON.stringify(j.error).slice(0, 120)}` : '?')
    console.log(`  ${label}: HTTP ${res.status}, CORS=${cors}, treff=${n}`)
  } catch (e) { console.log(`  ${label}: FEILET ${e.message}`) }
}

console.log('=== 2. fetchN50Water på Setten-bbox ===')
const bbox = bboxFromCenter(LAT, LON, 2)
console.log('bbox:', JSON.stringify(bbox))
const els = await fetchN50Water(bbox)
console.log(`elementer: ${els.length}`)
const ways = els.filter(e => e.type === 'way'), rels = els.filter(e => e.type === 'relation')
console.log(`  ways=${ways.length} relations=${rels.length}`)
if (els[0]) {
  console.log('  første element: type=' + els[0].type + ' tags-nøkler=' + JSON.stringify(Object.keys(els[0].tags ?? {})))
  console.log('  tags (trunkert):', JSON.stringify(els[0].tags).slice(0, 400))
}
for (const r of rels.slice(0, 3)) {
  const o = r.members.filter(m => m.role === 'outer').length
  const i = r.members.filter(m => m.role === 'inner').length
  console.log(`  relation: outer=${o} inner=${i} navn=${r.tags?.navn ?? r.tags?.name ?? '-'}`)
}

console.log('=== 3. Full headless-bygging av Setten ===')
const { svg, counts } = await buildMapHeadless({ lat: LAT, lon: LON, halfKm: 2 })
console.log('counts[301] =', counts['301'], '| counts[304] =', counts['304'])
const isoWater = [...svg.matchAll(/data-iso="301"/g)].length
console.log('SVG: elementer med data-iso="301":', isoWater)
// Hull-sjekk: 301-pather med flere M-subpather (outer + hull)
const m301 = svg.match(/<path[^>]*data-iso="301"[^>]*d="([^"]+)"/g) ?? []
for (const p of m301.slice(0, 4)) {
  const d = p.match(/d="([^"]+)"/)[1]
  const subs = (d.match(/M/g) ?? []).length
  console.log(`  301-path: ${subs} subpather (1=uten hull, >1=med øy-hull), lengde=${d.length}`)
}
console.log('=== FERDIG ===')

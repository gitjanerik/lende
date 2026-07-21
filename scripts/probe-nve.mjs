// MIDLERTIDIG CI-probe: helsesjekk av NVE Innsjødatabasen akkurat nå.
// Sjekker (a) at tjenesten svarer, (b) at Setten og Nesøytjern faktisk
// returneres for bruker-arkenes bbokser, (c) CORS-headere for nettleser-
// origin, (d) flakiness (3 forsøk per bbox).
const BASE = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query'

const AREAS = [
  { name: 'Setten/Setskog', env: [11.52, 59.70, 11.80, 59.90], probe: { navn: 'Setten', pt: [11.655, 59.775] } },
  { name: 'Nesøya',         env: [10.50, 59.845, 10.60, 59.895], probe: { navn: 'Nesøytjern', pt: [10.5455, 59.8672] } },
]

function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

async function queryOnce(env, label) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: env.join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    orderByFields: 'objectid',
  })
  const t0 = Date.now()
  const res = await fetch(`${BASE}?${params}`, {
    headers: { Origin: 'https://gitjanerik.github.io' },
  })
  const ms = Date.now() - t0
  const cors = {
    'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
    'access-control-allow-credentials': res.headers.get('access-control-allow-credentials'),
  }
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* noop */ }
  const feats = json?.features ?? []
  console.log(`\n[${label}] HTTP ${res.status} · ${ms} ms · ${feats.length} features · exceeded=${json?.exceededTransferLimit ?? json?.properties?.exceededTransferLimit ?? false}`)
  console.log(`[${label}] CORS:`, JSON.stringify(cors))
  if (!json) console.log(`[${label}] IKKE JSON — første 300 tegn:`, text.slice(0, 300))
  if (json?.error) console.log(`[${label}] ArcGIS-feil:`, JSON.stringify(json.error))
  return feats
}

for (const area of AREAS) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const feats = await queryOnce(area.env, `${area.name} #${attempt}`)
      const navnListe = feats.map(f => f.properties?.navn ?? f.properties?.NAVN ?? '(uten navn)')
      console.log(`  navn: ${navnListe.join(', ') || '(ingen)'}`)
      const [px, py] = area.probe.pt
      let hit = null
      for (const f of feats) {
        const g = f.geometry
        const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []
        for (const poly of polys) {
          if (poly[0] && pointInRing(px, py, poly[0])) { hit = f; break }
        }
        if (hit) break
      }
      if (hit) {
        const g = hit.geometry
        const nRings = g.type === 'Polygon' ? g.coordinates.length : g.coordinates.reduce((s, p) => s + p.length, 0)
        const nPts = g.type === 'Polygon' ? g.coordinates[0].length : g.coordinates[0][0].length
        console.log(`  ✅ ${area.probe.navn}-punktet dekkes av «${hit.properties?.navn ?? '(uten navn)'}» — ${nRings} ringer, ytre ring ${nPts} pkt`)
      } else {
        console.log(`  ❌ INGEN feature dekker ${area.probe.navn}-punktet (${px}, ${py})`)
      }
    } catch (e) {
      console.log(`[${area.name} #${attempt}] FEILET: ${e?.message ?? e}`)
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000))
  }
}
console.log('\nProbe ferdig.')

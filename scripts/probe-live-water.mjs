// DIAGNOSE (kjøres i CI — full nett): finnes en LEVENDE vektor-kilde for
// norske innsjøer MED øy-hull (indre ringer), spørrbar på bbox, helst med
// CORS? Hvis ja kan Lende hente innsjøer live ved kart-bygging (som Overpass
// og DEM allerede gjør) og hele det statiske FGB-bake/hosting-apparatet
// (~400-800 MB i git) slettes.
//
// Testes mot Setten-bboxen (inneholder Kolstadøya OG Munkeskjæra — begge har
// kjente øy-hull i N50):
//   1. Geonorge kartkatalog (REST-søk) — oppdag OGC API Features/WFS-kandidater
//   2. Geonorge CSW (metadata) — bare status-sjekk (brukerens URL)
//   3. Kartverkets OGC API (azurewebsites) — collections + items?bbox
//   4. NVE Innsjødatabasen (ArcGIS REST) — query (IKKE identify) med bbox
//   5. Ev. WFS-er funnet i steg 1 — GetCapabilities + GetFeature på bbox
//
// For hver kandidat logges: (a) innsjø-polygon med INDRE ringer? (b) treffer
// en indre ring Kolstadøya? (c) CORS-header? (d) punkt-tetthet (detaljnivå).
// Skriver kun til logg — ingen filer committes.

const BBOX = { west: 11.66, south: 59.78, east: 11.71, north: 59.82 }
const KOLSTAD = { lon: 11.69401, lat: 59.79852 }
const ORIGIN = 'https://gitjanerik.github.io'
const UA = 'lende-probe/1.0 (kart-app; live-vann-diagnose)'

const line = (c = '=') => console.log(c.repeat(72))

async function get(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Origin: ORIGIN, Accept: 'application/json,*/*', ...extraHeaders },
    signal: AbortSignal.timeout(45000),
  })
  const cors = res.headers.get('access-control-allow-origin')
  const ct = res.headers.get('content-type')
  return { res, cors, ct }
}

function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Analyser GeoJSON-features: ytre/indre ringer, punkt-tall, Kolstadøya-hull.
function analyzeGeojson(label, features) {
  let outer = 0, inner = 0, pts = 0, kolstadHole = false, maxPts = 0
  for (const f of features ?? []) {
    const g = f?.geometry
    if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) {
      outer++
      pts += poly[0]?.length ?? 0
      maxPts = Math.max(maxPts, poly[0]?.length ?? 0)
      for (let h = 1; h < poly.length; h++) {
        inner++
        pts += poly[h].length
        if (pointInRing(KOLSTAD.lon, KOLSTAD.lat, poly[h])) kolstadHole = true
      }
    }
  }
  console.log(`[${label}] features=${features?.length ?? 0} ytre=${outer} INDRE=${inner} ` +
    `punkter=${pts} (maks ring ${maxPts}) — Kolstadøya-hull: ${kolstadHole ? 'JA ✅' : 'nei'}`)
  return { outer, inner, pts, kolstadHole }
}

// ---------- 1. Geonorge kartkatalog REST ----------
async function probeKartkatalog() {
  line(); console.log('1. GEONORGE KARTKATALOG (REST-søk etter tjenester)')
  const found = []
  for (const term of ['N50 Kartdata', 'arealdekke', 'innsjø', 'vann OGC API']) {
    try {
      const { res } = await get(`https://kartkatalog.geonorge.no/api/search?text=${encodeURIComponent(term)}&limit=25`)
      if (!res.ok) { console.log(`  søk «${term}»: HTTP ${res.status}`); continue }
      const j = await res.json()
      for (const r of j.Results ?? []) {
        const proto = r.DistributionProtocol ?? r.Protocol ?? ''
        const url = r.DistributionUrl ?? r.GetCapabilitiesUrl ?? ''
        const type = r.Type ?? ''
        if (/service|tjeneste/i.test(type) && /(WFS|OGC.?API|Feature)/i.test(`${proto} ${url} ${r.Title}`)) {
          found.push({ title: r.Title, proto, url })
          console.log(`  KANDIDAT: «${r.Title}» proto=${proto} url=${url}`)
        }
      }
    } catch (e) { console.log(`  søk «${term}» feilet: ${e.message}`) }
  }
  if (!found.length) console.log('  (ingen Features/WFS-kandidater i søkene)')
  return found
}

// ---------- 2. CSW (kun status) ----------
async function probeCsw() {
  line(); console.log('2. GEONORGE CSW (metadata-katalog — status-sjekk)')
  try {
    const { res, cors } = await get('https://www.geonorge.no/geonetwork/srv/nor/csw?service=CSW&request=GetCapabilities')
    const body = await res.text()
    console.log(`  HTTP ${res.status}, CORS=${cors}, ${body.length} tegn, starter: ${body.slice(0, 120).replace(/\s+/g, ' ')}`)
  } catch (e) { console.log(`  feilet: ${e.message}`) }
}

// ---------- 3. Kartverkets OGC API ----------
async function probeKartverketOgcApi() {
  line(); console.log('3. KARTVERKETS OGC API (kartverket-ogc-api.azurewebsites.net)')
  const base = 'https://kartverket-ogc-api.azurewebsites.net'
  try {
    const { res, cors } = await get(`${base}/collections?f=json`)
    console.log(`  /collections: HTTP ${res.status}, CORS=${cors}`)
    if (!res.ok) return
    const j = await res.json()
    const cols = j.collections ?? []
    console.log(`  ${cols.length} collections: ${cols.map(c => c.id).join(', ').slice(0, 500)}`)
    for (const c of cols) {
      if (!/vann|innsj|areal|topo|n50|vatn|lake|water/i.test(`${c.id} ${c.title ?? ''}`)) continue
      const iurl = `${base}/collections/${c.id}/items?bbox=${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}&limit=50&f=json`
      try {
        const { res: ir, cors: icors } = await get(iurl)
        console.log(`  items ${c.id}: HTTP ${ir.status}, CORS=${icors}`)
        if (ir.ok) analyzeGeojson(`OGCAPI:${c.id}`, (await ir.json()).features)
      } catch (e) { console.log(`  items ${c.id} feilet: ${e.message}`) }
    }
  } catch (e) { console.log(`  feilet: ${e.message}`) }
}

// ---------- 4. NVE Innsjødatabasen (query, ikke identify) ----------
async function probeNve() {
  line(); console.log('4. NVE INNSJØDATABASEN (ArcGIS REST query på bbox)')
  const bases = [
    'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer',
    'https://gis3.nve.no/map/rest/services/Innsjodatabase2/MapServer',
  ]
  for (const base of bases) {
    try {
      const { res } = await get(`${base}?f=json`)
      if (!res.ok) { console.log(`  ${base}: HTTP ${res.status}`); continue }
      const info = await res.json()
      const layers = (info.layers ?? []).map(l => `${l.id}:${l.name}`)
      console.log(`  ${base}\n    lag: ${layers.join(', ').slice(0, 400)}`)
      for (const l of info.layers ?? []) {
        if (!/innsj|vann|vatn/i.test(l.name)) continue
        const q = `${base}/${l.id}/query?geometry=${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}` +
          `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects` +
          `&outFields=*&returnGeometry=true&outSR=4326&f=geojson`
        try {
          const { res: qr, cors } = await get(q)
          console.log(`  query lag ${l.id} (${l.name}): HTTP ${qr.status}, CORS=${cors}`)
          if (!qr.ok) continue
          const j = await qr.json()
          if (j.error) { console.log(`    ArcGIS-feil: ${JSON.stringify(j.error).slice(0, 200)}`); continue }
          analyzeGeojson(`NVE:${l.id}:${l.name}`, j.features)
        } catch (e) { console.log(`  query lag ${l.id} feilet: ${e.message}`) }
      }
    } catch (e) { console.log(`  ${base} feilet: ${e.message}`) }
  }
}

// ---------- 5. WFS-kandidater fra katalogen ----------
async function probeWfsCandidates(cands) {
  line(); console.log('5. WFS-KANDIDATER FRA KATALOGEN')
  const seen = new Set()
  let tested = 0
  for (const c of cands) {
    if (!c.url || seen.has(c.url) || tested >= 6) continue
    seen.add(c.url); tested++
    const capUrl = c.url.includes('?') ? c.url : `${c.url}?service=WFS&request=GetCapabilities`
    try {
      const { res } = await get(capUrl)
      const cap = await res.text()
      console.log(`  «${c.title}» GetCapabilities: HTTP ${res.status}, ${cap.length} tegn`)
      if (!res.ok || !/WFS_Capabilities/i.test(cap)) continue
      const names = [...cap.matchAll(/<(?:wfs:)?Name>([^<]+)<\/(?:wfs:)?Name>/g)].map(m => m[1])
      const waterTypes = names.filter(n => /innsj|vann|vatn|areal/i.test(n)).slice(0, 3)
      console.log(`    vann-lag: ${waterTypes.join(', ') || '(ingen)'}`)
      for (const t of waterTypes) {
        const gfUrl = `${c.url.split('?')[0]}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(t)}` +
          `&bbox=${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east},urn:ogc:def:crs:EPSG::4326` +
          `&outputFormat=application/json&count=50`
        try {
          const { res: gr, cors } = await get(gfUrl)
          console.log(`    GetFeature ${t}: HTTP ${gr.status}, CORS=${cors}`)
          if (gr.ok) {
            const body = await gr.text()
            try { analyzeGeojson(`WFS:${t}`, JSON.parse(body).features) }
            catch { console.log(`      ikke JSON (${body.slice(0, 120).replace(/\s+/g, ' ')})`) }
          }
        } catch (e) { console.log(`    GetFeature ${t} feilet: ${e.message}`) }
      }
    } catch (e) { console.log(`  «${c.title}» feilet: ${e.message}`) }
  }
  if (!tested) console.log('  (ingen å teste)')
}

const cands = await probeKartkatalog()
await probeCsw()
await probeKartverketOgcApi()
await probeNve()
await probeWfsCandidates(cands)
line()
console.log('PROBE FERDIG — se etter «INDRE» > 0, «Kolstadøya-hull: JA» og CORS≠null over.')

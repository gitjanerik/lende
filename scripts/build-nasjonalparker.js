// Bygg nasjonalpark-datasettet → public/data/nasjonalparker.json.
//
// KILDE: OpenStreetMap via Overpass — `relation[boundary=national_park][name]`
// over Norge. De norske parkene er importert fra Naturbase og bærer
// `naturbase:url`, `ref:naturvern`, `operator` og `start_date`, så én kilde gir
// både geometri og forvaltnings-metadata.
//
// HVORFOR BUNDLE, IKKE SLÅ OPP VED BYGGING? Overpass' bbox-filter treffer en
// relasjon bare når et MEDLEM ligger i boksen — et kart midt inne i Rondane
// (963 km²) returnerer ingenting, grensa er milevis unna. `is_in` løser det,
// men koster en ekstra Overpass-forespørsel som konkurrerer om klientens
// slots (målt: 1–3 s alene, >12 s i skyggen av hoved-spørringen, jevnlige
// timeouts), og speilet openstreetmap.fr svarer 504 på is_in i det hele tatt.
// Parkgrensene er dessuten statiske. Derfor: hent dem én gang i CI, forenkle,
// og gjør oppslaget lokalt (nasjonalparkData.js). Ingen nettverk i appen,
// virker offline, og gjelder også kart som allerede er bygget.
//
// Ringene forenkles med Douglas-Peucker i grader. Toleransen er satt for
// FAKTABOKS-presisjon (er kartet innenfor parken?), ikke for tegning — parken
// tegnes aldri.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'lende/1.0 (https://github.com/gitjanerik/lende)',
}
// ~0.0015° ≈ 100–170 m. Parkene er 20–3400 km²; grense-detaljer under dette
// endrer ikke svaret på «dekker parken kartet».
const SIMPLIFY_DEG = 0.0015

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/data/nasjonalparker.json')

const QUERY = `
[out:json][timeout:300];
relation["boundary"="national_park"]["name"](57.0,4.0,81.0,36.0);
out geom;
`.trim()

async function fetchParks() {
  let lastErr
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, { method: 'POST', headers: HEADERS, body: 'data=' + encodeURIComponent(QUERY) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!Array.isArray(json?.elements)) throw new Error('uventet svar')
      console.log(`[nasjonalparker] ${json.elements.length} relasjoner fra ${new URL(url).host}`)
      return json.elements
    } catch (e) {
      console.warn(`[nasjonalparker] ${new URL(url).host} feilet: ${e.message}`)
      lastErr = e
    }
  }
  throw lastErr ?? new Error('alle Overpass-speil feilet')
}

// Sy sammen medlems-wayene til lukkede ringer (greedy join på endepunkter).
function assembleRings(members) {
  const segs = members
    .filter(m => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length >= 2)
    .filter(m => m.role === 'outer' || m.role === '')
    .map(m => m.geometry.map(g => [round(g.lon), round(g.lat)]))
  const rings = []
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7
  while (segs.length) {
    let cur = segs.shift()
    let joined = true
    while (joined) {
      joined = false
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i]
        const head = cur[0], tail = cur[cur.length - 1]
        if (same(tail, s[0])) cur = cur.concat(s.slice(1))
        else if (same(tail, s[s.length - 1])) cur = cur.concat(s.slice(0, -1).reverse())
        else if (same(head, s[s.length - 1])) cur = s.slice(0, -1).concat(cur)
        else if (same(head, s[0])) cur = s.slice(1).reverse().concat(cur)
        else continue
        segs.splice(i, 1)
        joined = true
        break
      }
    }
    if (cur.length >= 4) rings.push(cur)
  }
  return rings
}

function round(v) {
  return Math.round(v * 1e5) / 1e5
}

// Douglas-Peucker på en LUKKET ring. Ringen splittes først i to buer ved
// midtpunktet: kjørt rått på en ring der første og siste punkt er identiske
// blir ankerlinja null lang, alle avstander 0, og hele ringen kollapser til to
// punkter.
function simplifyRing(points, tol) {
  if (points.length <= 5) return points
  const closed = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]
  const open = closed ? points.slice(0, -1) : points
  const mid = Math.floor(open.length / 2)
  const a = simplify(open.slice(0, mid + 1), tol)
  const b = simplify(open.slice(mid), tol)
  const ring = [...a.slice(0, -1), ...b]
  return closed ? [...ring, ring[0]] : ring
}

// Douglas-Peucker i grader på en ÅPEN linje.
function simplify(points, tol) {
  if (points.length <= 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()
    let maxD = -1, idx = -1
    const [x1, y1] = points[lo], [x2, y2] = points[hi]
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    for (let i = lo + 1; i < hi; i++) {
      const [x, y] = points[i]
      const d = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1
      stack.push([lo, idx], [idx, hi])
    }
  }
  return points.filter((_, i) => keep[i])
}

function bboxOf(rings) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const r of rings) {
    for (const [lon, lat] of r) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  return [minLon, minLat, maxLon, maxLat].map(round)
}

function facts(t) {
  const navn = String(t.name ?? '').trim()
  const alt = [t['name:se'], t['name:sma'], t['name:smj'], t['name:fkv']]
    .map(v => (v == null ? '' : String(v).trim()))
    .find(v => v && v !== navn) ?? null
  const url = typeof t['naturbase:url'] === 'string' && /^https?:\/\//i.test(t['naturbase:url'])
    ? t['naturbase:url'] : null
  return {
    navn,
    altNavn: alt,
    ref: t['ref:naturvern'] ?? null,
    faktaarkUrl: url,
    forvaltning: t.operator ?? null,
    vernedato: /^\d{4}-\d{2}-\d{2}$/.test(String(t.start_date ?? '')) ? t.start_date : null,
    wikidata: t.wikidata ?? null,
  }
}

const elements = await fetchParks()
const parks = []
for (const el of elements) {
  if (el.type !== 'relation' || !el.tags?.name || !Array.isArray(el.members)) continue
  // Kun NORSKE parker. Overpass-boksen fanger også svenske/finske/russiske
  // parker langs grensa; `ref:naturvern` (Naturbase-ID, VV…) finnes bare på de
  // norske og er dermed et presist og stabilt filter.
  if (!/^VV\d+$/i.test(String(el.tags['ref:naturvern'] ?? ''))) continue
  const rings = assembleRings(el.members)
    .map(r => simplifyRing(r, SIMPLIFY_DEG))
    .filter(r => r.length >= 4)
  if (!rings.length) {
    console.warn(`[nasjonalparker] ${el.tags.name}: ingen brukbare ringer — hoppet over`)
    continue
  }
  parks.push({ ...facts(el.tags), bbox: bboxOf(rings), rings })
}
parks.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'))

mkdirSync(dirname(OUT), { recursive: true })
const payload = { generert: new Date().toISOString().slice(0, 10), kilde: 'OpenStreetMap (ODbL) — Naturbase-import', parker: parks }
writeFileSync(OUT, JSON.stringify(payload))
const punkter = parks.reduce((n, p) => n + p.rings.reduce((m, r) => m + r.length, 0), 0)
console.log(`[nasjonalparker] ${parks.length} parker, ${punkter} punkter → ${OUT}`)

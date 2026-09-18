#!/usr/bin/env node
// Probe — hva koster N50-vann, og hvor ligger innsjøen egentlig?
//
// EN MÅLING, IKKE EN GATE. Den finnes fordi Geonorge, NVE, Overpass og
// Kartverkets WCS alle er sperret fra utviklings-sandkassene, så spørsmålene
// under kan bare stilles i CI. Skriver bare til probe-ut/, feiler aldri.
//
// Spørsmålene (docs/VANN_VURDERING.md, punkt 1 og «ikke verifisert»):
//   1. Ligger NVE-innsjøen (det appen tegner) der N50 og terrenget sier at
//      den ligger? Målt som ring-avstander, sentroide-forskyvning og overlapp
//      mot DTM-ens flate innsjøspeil.
//   2. Deler N50-innsjøen hjørner med myr/skog-flatene i samme leveranse?
//      Er svaret ja, er en vann-bake fra samme kilde sømløs per konstruksjon.
//   3. Hva koster N50 Innsjø/Elv pakket med appens eget format, per toleranse?
//   4. Hva koster mer detalj i OSM-lagene på et ekte ark (byte per hjørne)?
//
// Alle trinn er best-effort: et trinn som ikke får svar skriver «hoppet over»
// og resten kjører. Les utskriften — den er hele leveransen.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { parseHTML } from 'linkedom'

import { buildMapHeadless } from '../mcp/headless.js'
import { fetchOverpass, bboxFromCenter } from '../src/lib/mapBuilder.js'
import { fetchN50Water } from '../src/lib/n50Fetcher.js'
import { fetchDEM } from '../src/lib/demFetcher.js'
import { sampleElevation } from '../src/lib/demSampling.js'
import { wgs84ToUtm32, wgs84ToUtm33, utm32BboxFromWgs84, utm32ToWgs84 } from '../src/lib/utm.js'
import { lesFlis, kodeFlis, forenkleRinger, fliserForBbox, arealM2 } from '../src/lib/n50ArealPakke.js'
import { forenkleLinje } from '../src/lib/n50StiPakke.js'
import { finnOmrader, velgFormat, lastNed, finnGdb, lagNavn, krevGdal } from './geonorgeN50.mjs'

const LAT = Number(process.env.PROBE_LAT || 70.14522)
const LON = Number(process.env.PROBE_LON || 28.45329)
const RADIUS_M = Number(process.env.PROBE_RADIUS_M || 1500)
const FYLKE = String(process.env.PROBE_FYLKE || '56')
const HOPP = new Set(String(process.env.PROBE_HOPP || '').split(',').map(s => s.trim()).filter(Boolean))
const NVE_BASE = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5'

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UT = join(ROT, 'probe-ut')
mkdirSync(UT, { recursive: true })

const bbox = bboxFromCenter(LAT, LON, RADIUS_M / 1000)
const utmBbox = utm32BboxFromWgs84(bbox)
const COS = Math.cos(LAT * Math.PI / 180)
const rapport = { punkt: { lat: LAT, lon: LON }, radiusM: RADIUS_M, bbox }
const log = (...a) => console.log(...a)
const tall = (n, d = 0) => Number(n).toLocaleString('no', { maximumFractionDigits: d, minimumFractionDigits: d })
const kb = (b) => `${(b / 1e3).toFixed(1)} KB`

async function trinn(navn, nokkel, fn) {
  log(`\n━━ ${navn} ━━`)
  if (HOPP.has(nokkel)) { log('  hoppet over (PROBE_HOPP)'); return null }
  try { return await fn() } catch (e) {
    log(`  ⚠ hoppet over: ${e?.message ?? e}`)
    rapport[`${nokkel}Feil`] = String(e?.message ?? e)
    return null
  }
}

// ── Geometri i et lokalt meter-plan rundt probepunktet ─────────────────────
const tilXY = (p) => ({ x: (p.lon - LON) * 111320 * COS, y: (p.lat - LAT) * 111320 })
const ringXY = (ring) => ring.map(tilXY)
const lukket = (r) => r.length > 2 && r[0].x === r[r.length - 1].x && r[0].y === r[r.length - 1].y

function areal(r) {
  let s = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j].x * r[i].y - r[i].x * r[j].y
  return Math.abs(s) / 2
}
function sentroide(r) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j].x * r[i].y - r[i].x * r[j].y
    a += f; cx += (r[j].x + r[i].x) * f; cy += (r[j].y + r[i].y) * f
  }
  if (Math.abs(a) < 1e-9) return r[0]
  return { x: cx / (3 * a), y: cy / (3 * a) }
}
function punktIRing(p, r) {
  let inne = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inne = !inne
  }
  return inne
}
function avstandSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
function avstandTilRing(p, r) {
  let m = Infinity
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const d = avstandSegment(p, r[j], r[i]); if (d < m) m = d
  }
  return m
}
function ringAvstander(A, B) {
  const d = A.map(p => avstandTilRing(p, B)).sort((a, b) => a - b)
  if (!d.length) return null
  return {
    snitt: d.reduce((s, v) => s + v, 0) / d.length,
    p95: d[Math.min(d.length - 1, Math.floor(d.length * 0.95))],
    maks: d[d.length - 1],
  }
}
function bboxXY(r) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of r) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y }
  return { x0, y0, x1, y1 }
}
// IoU ved rasterisering; nok for «samme innsjø eller ikke» og for å måle overlapp.
function iou(A, B, cellM = 4) {
  const a = bboxXY(A), b = bboxXY(B)
  const x0 = Math.min(a.x0, b.x0), y0 = Math.min(a.y0, b.y0), x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1)
  let c = cellM
  while (((x1 - x0) / c) * ((y1 - y0) / c) > 1.5e6) c *= 2
  let iA = 0, iB = 0, begge = 0
  for (let y = y0 + c / 2; y < y1; y += c) for (let x = x0 + c / 2; x < x1; x += c) {
    const p = { x, y }
    const inA = punktIRing(p, A), inB = punktIRing(p, B)
    if (inA) iA++; if (inB) iB++; if (inA && inB) begge++
  }
  return { iou: begge / Math.max(1, iA + iB - begge), aKunA: (iA - begge) * c * c, aKunB: (iB - begge) * c * c, cellM: c }
}
const fmtSkift = (fra, til) => `ΔE ${(til.x - fra.x).toFixed(1)} m, ΔN ${(til.y - fra.y).toFixed(1)} m (|Δ| ${Math.hypot(til.x - fra.x, til.y - fra.y).toFixed(1)} m)`
const fmtAvst = (d) => d ? `snitt ${d.snitt.toFixed(1)} / p95 ${d.p95.toFixed(1)} / maks ${d.maks.toFixed(1)} m` : '–'

// OSM-aktige elementer (way/relation) → flater {navn, ringer: [ytre, …hull]} i XY.
function elementerTilFlater(elementer, filter) {
  const ut = []
  for (const el of elementer ?? []) {
    if (!filter(el)) continue
    const navn = el.tags?.navn ?? el.tags?.name ?? ''
    if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4) {
      const r = ringXY(el.geometry)
      if (lukket(r) || Math.hypot(r[0].x - r[r.length - 1].x, r[0].y - r[r.length - 1].y) < 1) ut.push({ navn, kilde: el._source ?? el.type, ringer: [r], id: el.id })
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      const ytre = [], indre = []
      for (const m of el.members) {
        if (!Array.isArray(m.geometry) || m.geometry.length < 4) continue
        ;(m.role === 'inner' ? indre : ytre).push(ringXY(m.geometry))
      }
      for (const y of ytre) ut.push({ navn, kilde: el._source ?? el.type, id: el.id, ringer: [y, ...indre.filter(h => punktIRing(h[0], y))] })
    }
  }
  return ut
}
const erOsmVann = (el) => el.type !== 'node' && (el.tags?.natural === 'water' || !!el.tags?.water || el.tags?.landuse === 'reservoir')
const inneIBbox = (p) => Math.abs(p.x) <= RADIUS_M * 1.05 && Math.abs(p.y) <= RADIUS_M * 1.05

function velgVedPunkt(flater) {
  const p0 = { x: 0, y: 0 }
  return flater.find(f => punktIRing(p0, f.ringer[0]))
    ?? flater.map(f => ({ f, d: avstandTilRing(p0, f.ringer[0]) })).sort((a, b) => a.d - b.d)[0]?.f
    ?? null
}

// ── 1. NVE Innsjødatabasen (det appen faktisk tegner) ──────────────────────
const nve = await trinn('NVE Innsjødatabasen — appens innsjøer', 'nve', async () => {
  const el = await fetchN50Water(bbox)
  const flater = elementerTilFlater(el, () => true).filter(f => inneIBbox(sentroide(f.ringer[0])))
  log(`  ${el.length} elementer, ${flater.length} flater med sentroide i bbox`)
  const meta = await fetch(`${NVE_BASE}?f=json`, { signal: AbortSignal.timeout(30000) }).then(r => r.json()).catch(() => null)
  if (meta) {
    log(`  lag: «${meta.name}» — ${String(meta.description ?? '').replace(/\s+/g, ' ').slice(0, 300) || '(ingen beskrivelse)'}`)
    log(`  copyright: ${meta.copyrightText ?? '–'}`)
    log(`  felter: ${(meta.fields ?? []).map(f => f.name).join(', ')}`)
  }
  const q = new URLSearchParams({ geometry: `${LON},${LAT}`, geometryType: 'esriGeometryPoint', inSR: '4326', outFields: '*', returnGeometry: 'false', f: 'json' })
  const ved = await fetch(`${NVE_BASE}/query?${q}`, { signal: AbortSignal.timeout(30000) }).then(r => r.json()).catch(() => null)
  const attr = ved?.features?.[0]?.attributes
  if (attr) {
    log('  innsjøen under punktet (alle attributter):')
    for (const [k, v] of Object.entries(attr)) log(`    ${k} = ${v}`)
  } else log('  ingen NVE-innsjø under punktet')
  rapport.nve = { flater: flater.length, attributter: attr ?? null, lag: meta ? { navn: meta.name, beskrivelse: meta.description, copyright: meta.copyrightText } : null }
  return flater
})

// ── 2. OSM (Overpass) — det som fyller der NVE ikke har ─────────────────────
let overpassEl = null
const osm = await trinn('OSM via Overpass', 'osm', async () => {
  const res = await fetchOverpass(bbox)
  overpassEl = res.elements ?? []
  const flater = elementerTilFlater(overpassEl, erOsmVann).filter(f => inneIBbox(sentroide(f.ringer[0])))
  const bekker = overpassEl.filter(e => e.type === 'way' && e.tags?.waterway).length
  log(`  ${overpassEl.length} elementer; ${flater.length} vannflater, ${bekker} vassdrag-linjer`)
  rapport.osm = { elementer: overpassEl.length, vannflater: flater.length, vassdrag: bekker }
  return flater
})

// ── 3. Myr-/skog-hull i de bakte arealflisene ───────────────────────────────
const hull = await trinn('Hull i de bakte N50-arealflisene (public/data/n50-areal)', 'fliser', async () => {
  const ut = []
  for (const nokkel of fliserForBbox(bbox)) {
    const fil = join(ROT, 'public', 'data', 'n50-areal', `${nokkel}.bin`)
    if (!existsSync(fil)) { log(`  ${nokkel}.bin finnes ikke`); continue }
    const flater = lesFlis(readFileSync(fil))
    let n = 0
    for (const f of flater) {
      for (let i = 1; i < f.ringer.length; i++) {
        const r = ringXY(f.ringer[i])
        if (inneIBbox(sentroide(r))) { ut.push({ type: f.type, ring: r, eierAreal: arealM2(f.ringer[0]) }); n++ }
      }
    }
    log(`  ${nokkel}.bin: ${flater.length} flater, ${n} hull med sentroide i bbox`)
  }
  const perType = {}
  for (const h of ut) perType[h.type] = (perType[h.type] ?? 0) + 1
  log(`  hull per type: ${Object.entries(perType).map(([k, v]) => `${k}=${v}`).join(', ') || '(ingen)'}`)
  rapport.hull = perType
  return ut
})

// ── 4. Rå N50 fra Geonorge (samme leveranse som areal-baken) ───────────────
let n50Raa = null, n50Land = null, fylkeDir = null, kilde = null, arealLag = null
await trinn(`Rå N50 Kartdata fra Geonorge (fylke ${FYLKE})`, 'geonorge', async () => {
  krevGdal()
  const { omrader, formater, projeksjoner } = await finnOmrader()
  const omrade = omrader.find(o => String(o.code) === FYLKE)
  if (!omrade) throw new Error(`fant ikke område ${FYLKE} — har ${omrader.filter(o => o.type === 'fylke').map(o => `${o.code}=${o.name}`).join(', ')}`)
  log(`  ${omrade.name}`)
  fylkeDir = mkdtempSync(join(tmpdir(), 'n50vann-'))
  const { format, proj } = velgFormat(omrade, formater, projeksjoner)
  const kilder = finnGdb(await lastNed(omrade, format, proj, fylkeDir, log))
  if (!kilder.length) throw new Error('ingen lesbar kilde i nedlastingen')
  kilde = kilder[0]
  const alleLag = lagNavn(kilde, /./)
  arealLag = lagNavn(kilde, /arealdekke.*(omrade|område|flate|polygon)/i)[0]
  if (!arealLag) throw new Error(`ingen arealdekke-flatelag; lag: ${alleLag.join(', ')}`)

  // Antall objekter per lag innenfor bbox — hva N50 HAR her, sammenlignet med OSM.
  const sw = wgs84ToUtm33(bbox.south, bbox.west), ne = wgs84ToUtm33(bbox.north, bbox.east)
  const spat33 = [Math.min(sw.e, ne.e), Math.min(sw.n, ne.n), Math.max(sw.e, ne.e), Math.max(sw.n, ne.n)].map(v => v.toFixed(0))
  log(`  objekter per N50-lag i bbox (${(RADIUS_M * 2 / 1000).toFixed(1)} × ${(RADIUS_M * 2 / 1000).toFixed(1)} km):`)
  const lagTall = {}
  for (const l of alleLag) {
    try {
      const ut = execFileSync('ogrinfo', ['-ro', '-so', '-spat', ...spat33, kilde, l], { encoding: 'utf8', maxBuffer: 1 << 24 })
      const n = Number(ut.match(/Feature Count:\s*(\d+)/)?.[1] ?? 0)
      if (n) { lagTall[l] = n; log(`    ${l.padEnd(44)} ${String(n).padStart(6)}`) }
    } catch { /* et lag som ikke lar seg telle er ikke verdt å stoppe for */ }
  }
  rapport.n50LagIBbox = lagTall

  const spat = [bbox.west, bbox.south, bbox.east, bbox.north].map(String)
  const hent = (fil, where) => {
    execFileSync('ogr2ogr', ['-f', 'GeoJSON', fil, kilde, arealLag, '-t_srs', 'EPSG:4326', '-nlt', 'MULTIPOLYGON',
      '-spat', ...spat, '-spat_srs', 'EPSG:4326', '-where', where], { stdio: 'pipe' })
    return JSON.parse(readFileSync(fil, 'utf8')).features ?? []
  }
  const vannF = hent(join(fylkeDir, 'vann.json'), "objtype LIKE 'Innsj%' OR objtype IN ('Elv','Havflate') OR objtype LIKE 'FerskvannT%'")
  const landF = hent(join(fylkeDir, 'land.json'), "NOT (objtype LIKE 'Innsj%' OR objtype IN ('Elv','Havflate') OR objtype LIKE 'FerskvannT%')")
  const tilFlater = (features) => {
    const ut = []
    for (const f of features) {
      const polys = f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : []
      for (const p of polys) ut.push({ navn: f.properties?.navn ?? '', objtype: f.properties?.objtype, props: f.properties, raa: p, ringer: p.map(r => ringXY(r.map(([lon, lat]) => ({ lat, lon })))) })
    }
    return ut
  }
  n50Raa = tilFlater(vannF)
  n50Land = tilFlater(landF)
  const perType = {}
  for (const f of n50Raa) perType[f.objtype] = (perType[f.objtype] ?? 0) + 1
  log(`  vannflater i bbox: ${Object.entries(perType).map(([k, v]) => `${k}=${v}`).join(', ') || '(ingen)'}; landflater: ${n50Land.length}`)

  const ved = velgVedPunkt(n50Raa)
  if (ved) {
    log(`  N50-flata under punktet: ${ved.objtype} «${ved.navn}», ${tall(areal(ved.ringer[0]) / 1000)} daa, ${ved.ringer[0].length} hjørner, ${ved.ringer.length - 1} hull`)
    for (const [k, v] of Object.entries(ved.props ?? {})) if (v != null && v !== '') log(`    ${k} = ${v}`)
  }

  // Deler vannflata hjørner med naboflatene? Eksakt sammenligning av koordinat-
  // strengene etter SAMME reprojisering — N50 Arealdekke er en flatedeling, så
  // svaret bør være «alle».
  const landHjorner = new Set()
  for (const f of n50Land) for (const r of f.raa) for (const [lon, lat] of r) landHjorner.add(`${lon.toFixed(7)},${lat.toFixed(7)}`)
  const delte = []
  for (const f of n50Raa) {
    const ytre = f.raa[0]
    let n = 0
    for (const [lon, lat] of ytre) if (landHjorner.has(`${lon.toFixed(7)},${lat.toFixed(7)}`)) n++
    delte.push({ navn: f.navn, objtype: f.objtype, hjorner: ytre.length, delte: n })
  }
  const sum = delte.reduce((s, d) => s + d.delte, 0), alle = delte.reduce((s, d) => s + d.hjorner, 0)
  log(`  hjørner på vannflatene som finnes eksakt i en naboflate (myr/skog/åpent/…): ${tall(sum)} av ${tall(alle)} (${(100 * sum / Math.max(1, alle)).toFixed(1)} %)`)
  rapport.delteHjorner = { delte: sum, hjorner: alle, perFlate: delte.slice(0, 40) }

  // Vertekstetthet: N50 rå → 2/4/8 m for flatene i bbox.
  const kurve = {}
  for (const tol of [0, 2, 4, 8]) {
    let n = 0
    for (const f of n50Raa) {
      const ringer = f.raa.map(r => r.map(([lon, lat]) => ({ lat, lon })))
      const s = tol ? forenkleRinger(ringer, tol) : ringer
      for (const r of s) n += r.length
    }
    kurve[tol] = n
  }
  log(`  hjørner på N50-vannflatene i bbox: rå ${tall(kurve[0])} → 2 m ${tall(kurve[2])} → 4 m ${tall(kurve[4])} → 8 m ${tall(kurve[8])}`)
  rapport.n50HjorneKurve = kurve
})

// ── 5. DTM: hvor er innsjøspeilet flatt? ────────────────────────────────────
let demMaske = null
const dem = await trinn('Kartverket DTM 10 m — innsjøspeilet i terrenget', 'dem', async () => {
  const d = await fetchDEM(utmBbox, { resolutionM: 10 })
  if (String(d.source ?? '').startsWith('synthetic')) throw new Error('bare syntetisk DEM')
  log(`  ${d.cols} × ${d.rows} celler @ ${d.resolution.toFixed(1)} m fra ${d.source}`)
  const ved = velgVedPunkt(nve ?? []) ?? velgVedPunkt(n50Raa ?? [])
  if (!ved) throw new Error('ingen innsjø å måle mot')
  const tilSvg = (p) => { const u = wgs84ToUtm32(p.lat, p.lon); return { x: u.e - utmBbox.minE, y: utmBbox.maxN - u.n } }
  const fraXY = (p) => ({ lat: LAT + p.y / 111320, lon: LON + p.x / (111320 * COS) })
  const hoyder = ved.ringer[0].map(p => sampleElevation(d, tilSvg(fraXY(p)).x, tilSvg(fraXY(p)).y)).filter(Number.isFinite).sort((a, b) => a - b)
  if (hoyder.length < 3) throw new Error('ingen DEM-verdier på ringen')
  const nivaa = hoyder[Math.floor(hoyder.length / 2)]
  const s0 = tilSvg({ lat: LAT, lon: LON })
  log(`  strandlinja til «${ved.navn || 'innsjøen'}» ligger på ${hoyder[0].toFixed(1)}–${hoyder[hoyder.length - 1].toFixed(1)} m; median ${nivaa.toFixed(2)} m`)

  // Sammenhengende flate rundt probepunktet med |z − nivå| ≤ 0,3 m.
  const { cols, rows, data, noData, transform } = d
  const start = [Math.floor(s0.x / transform.pixelWidth), Math.floor(s0.y / transform.pixelHeight)]
  const maske = new Uint8Array(cols * rows)
  const ko = []
  const erFlat = (c, r) => { const z = data[r * cols + c]; return z !== noData && Math.abs(z - nivaa) <= 0.3 }
  if (!erFlat(...start)) {
    // Punktet står kanskje på land etter NVE-forskyvningen — start fra den nærmeste flate cella innen 60 m.
    let best = null
    for (let r = start[1] - 6; r <= start[1] + 6; r++) for (let c = start[0] - 6; c <= start[0] + 6; c++) {
      if (c < 0 || r < 0 || c >= cols || r >= rows || !erFlat(c, r)) continue
      const dd = Math.hypot(c - start[0], r - start[1]); if (!best || dd < best.dd) best = { c, r, dd }
    }
    if (!best) throw new Error(`ingen flat celle på ${nivaa.toFixed(1)} m innen 60 m av punktet — punktet står ikke på et innsjøspeil`)
    start[0] = best.c; start[1] = best.r
  }
  ko.push(start); maske[start[1] * cols + start[0]] = 1
  let n = 0
  while (ko.length && n < 2e6) {
    const [c, r] = ko.pop(); n++
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue
      const i = rr * cols + cc
      if (maske[i] || !erFlat(cc, rr)) continue
      maske[i] = 1; ko.push([cc, rr])
    }
  }
  const pw = transform.pixelWidth, ph = transform.pixelHeight
  const cellXY = (c, r) => { const u = { e: utmBbox.minE + (c + 0.5) * pw, n: utmBbox.maxN - (r + 0.5) * ph }; const g = utm32ToWgs84(u.e, u.n); return tilXY({ lat: g.lat, lon: g.lon }) }
  let sx = 0, sy = 0, antall = 0
  const kant = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!maske[r * cols + c]) continue
    const p = cellXY(c, r); sx += p.x; sy += p.y; antall++
    if (!maske[r * cols + c - 1] || !maske[r * cols + c + 1] || !maske[(r - 1) * cols + c] || !maske[(r + 1) * cols + c]) kant.push(p)
  }
  const senter = { x: sx / antall, y: sy / antall }
  const arealMaske = antall * pw * ph
  log(`  flatt speil: ${tall(antall)} celler = ${tall(arealMaske / 1000)} daa, ${kant.length} kantceller`)

  const kilder = [['NVE', velgVedPunkt(nve ?? [])], ['N50 rå', velgVedPunkt(n50Raa ?? [])], ['OSM', velgVedPunkt(osm ?? [])]]
  const ut = { nivaa, arealDaa: arealMaske / 1000, kilder: {} }
  for (const [navn, f] of kilder) {
    if (!f) { log(`  ${navn}: ingen flate`); continue }
    const ring = f.ringer[0]
    let inneOgFlat = 0, inne = 0
    const b = bboxXY(ring)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = cellXY(c, r)
      if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue
      if (!punktIRing(p, ring)) continue
      inne++; if (maske[r * cols + c]) inneOgFlat++
    }
    let maskeIRing = 0
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (maske[r * cols + c] && punktIRing(cellXY(c, r), ring)) maskeIRing++
    const avst = ringAvstander(ring, kant.length ? kant.concat(kant[0]) : ring)
    const sk = sentroide(ring)
    log(`  ${navn.padEnd(7)} «${f.navn}» ${tall(areal(ring) / 1000)} daa, ${ring.length} hjørner: ${(100 * inneOgFlat / Math.max(1, inne)).toFixed(1)} % av flata er flatt speil, `
      + `${(100 * maskeIRing / Math.max(1, antall)).toFixed(1)} % av speilet ligger inni flata; sentroide-skift speil→flate ${fmtSkift(senter, sk)}`)
    ut.kilder[navn] = { arealDaa: areal(ring) / 1000, hjorner: ring.length, flatAndel: inneOgFlat / Math.max(1, inne), speilDekket: maskeIRing / Math.max(1, antall), skift: { dE: sk.x - senter.x, dN: sk.y - senter.y }, avstandTilKant: avst }
  }
  demMaske = { kant, senter }
  rapport.dem = ut
  return d
})

// ── 6. Kilde mot kilde, per innsjø ──────────────────────────────────────────
await trinn('NVE mot N50 rå, myr-hull og OSM — per innsjø', 'sammenlign', async () => {
  if (!nve?.length) throw new Error('ingen NVE-flater å sammenligne')
  const rader = []
  for (const f of nve) {
    const ring = f.ringer[0]
    const a = areal(ring)
    if (a < 2000) continue
    const s = sentroide(ring)
    const rad = { navn: f.navn, arealDaa: a / 1000, hjornerNve: ring.length }
    const raa = (n50Raa ?? []).filter(g => punktIRing(s, g.ringer[0]) || punktIRing(sentroide(g.ringer[0]), ring)).sort((x, y) => areal(y.ringer[0]) - areal(x.ringer[0]))[0]
    if (raa) {
      const o = iou(ring, raa.ringer[0])
      rad.n50 = { objtype: raa.objtype, arealDaa: areal(raa.ringer[0]) / 1000, hjorner: raa.ringer[0].length, iou: o.iou, bareNveDaa: o.aKunA / 1000, bareN50Daa: o.aKunB / 1000, skift: fmtSkift(sentroide(raa.ringer[0]), s), avst: ringAvstander(ring, raa.ringer[0]) }
    }
    const h = (hull ?? []).filter(x => punktIRing(s, x.ring) || punktIRing(sentroide(x.ring), ring)).sort((x, y) => areal(y.ring) - areal(x.ring))[0]
    if (h) rad.hull = { type: h.type, arealDaa: areal(h.ring) / 1000, hjorner: h.ring.length, iou: iou(ring, h.ring).iou, skift: fmtSkift(sentroide(h.ring), s), avst: ringAvstander(ring, h.ring) }
    const o = (osm ?? []).filter(x => punktIRing(s, x.ringer[0]) || punktIRing(sentroide(x.ringer[0]), ring)).sort((x, y) => areal(y.ringer[0]) - areal(x.ringer[0]))[0]
    if (o) rad.osm = { navn: o.navn, arealDaa: areal(o.ringer[0]) / 1000, hjorner: o.ringer[0].length, iou: iou(ring, o.ringer[0]).iou, skift: fmtSkift(sentroide(o.ringer[0]), s), avst: ringAvstander(ring, o.ringer[0]) }
    rader.push(rad)
  }
  rader.sort((x, y) => y.arealDaa - x.arealDaa)
  for (const r of rader.slice(0, 25)) {
    log(`  «${r.navn || '(uten navn)'}» NVE ${tall(r.arealDaa)} daa, ${r.hjornerNve} hjørner`)
    if (r.n50) log(`      N50 rå ${r.n50.objtype}: ${tall(r.n50.arealDaa)} daa, ${r.n50.hjorner} hjørner, IoU ${r.n50.iou.toFixed(3)}, bare-NVE ${tall(r.n50.bareNveDaa, 1)} daa, bare-N50 ${tall(r.n50.bareN50Daa, 1)} daa; skift N50→NVE ${r.n50.skift}; ringavstand ${fmtAvst(r.n50.avst)}`)
    else log('      N50 rå: ingen match')
    if (r.hull) log(`      ${r.hull.type}-hull i flisen: ${tall(r.hull.arealDaa)} daa, ${r.hull.hjorner} hjørner, IoU ${r.hull.iou.toFixed(3)}; skift hull→NVE ${r.hull.skift}; ringavstand ${fmtAvst(r.hull.avst)}`)
    else log('      myr/skog-hull: ingen')
    if (r.osm) log(`      OSM «${r.osm.navn}»: ${tall(r.osm.arealDaa)} daa, ${r.osm.hjorner} hjørner, IoU ${r.osm.iou.toFixed(3)}; skift OSM→NVE ${r.osm.skift}; ringavstand ${fmtAvst(r.osm.avst)}`)
    else log('      OSM: ingen')
  }
  const medN50 = rader.filter(r => r.n50)
  if (medN50.length) {
    const snittIou = medN50.reduce((s, r) => s + r.n50.iou, 0) / medN50.length
    const snittP95 = medN50.reduce((s, r) => s + (r.n50.avst?.p95 ?? 0), 0) / medN50.length
    log(`  ${medN50.length} innsjøer matchet mot N50 rå: snitt IoU ${snittIou.toFixed(3)}, snitt p95-ringavstand ${snittP95.toFixed(1)} m`)
  }
  rapport.perInnsjo = rader
})

// ── 7. Ekte ark bygget headless — hva koster hvert lag i byte? ─────────────
let bytePerHjorne = {}
await trinn(`Headless bygg av ${(RADIUS_M * 2 / 1000).toFixed(1)} km-ark — byte per lag`, 'kart', async () => {
  const t0 = Date.now()
  const { svg, meta } = await buildMapHeadless({ lat: LAT, lon: LON, halfKm: RADIUS_M / 1000, detaljNivaa: 'full', tetthetAv: true })
  log(`  bygget på ${((Date.now() - t0) / 1000).toFixed(0)} s: ${kb(svg.length)} (gzip ${kb(gzipSync(svg).length)}), DEM ${meta?.demSource ?? '?'}`)
  writeFileSync(join(UT, 'ark.svg'), svg)
  const { document } = parseHTML(`<html><body>${svg}</body></html>`)
  const rot = document.querySelector('svg')
  const rader = []
  for (const g of rot.children) {
    const navn = g.getAttribute('data-layer') ?? (g.tagName.toLowerCase() + (g.id ? '#' + g.id : ''))
    let hjorner = 0, paths = 0, tegn = 0
    for (const p of g.querySelectorAll('path')) {
      paths++
      const d = p.getAttribute('d') ?? ''
      tegn += d.length
      hjorner += (d.match(/[-\d.]+(?:e-?\d+)?/g) ?? []).length / 2
    }
    rader.push({ navn, bytes: g.outerHTML.length, paths, hjorner: Math.round(hjorner), dTegn: tegn })
  }
  rader.sort((a, b) => b.bytes - a.bytes)
  log(`  ${'lag'.padEnd(26)} ${'KB'.padStart(8)} ${'andel'.padStart(6)} ${'paths'.padStart(6)} ${'hjørner'.padStart(8)} ${'B/hjørne'.padStart(9)}`)
  for (const r of rader.filter(r => r.bytes > 500)) {
    const bph = r.hjorner ? r.dTegn / r.hjorner : 0
    if (r.hjorner > 20) bytePerHjorne[r.navn] = bph
    log(`  ${r.navn.padEnd(26)} ${(r.bytes / 1e3).toFixed(1).padStart(8)} ${(100 * r.bytes / svg.length).toFixed(1).padStart(5)}% ${String(r.paths).padStart(6)} ${tall(r.hjorner).padStart(8)} ${bph ? bph.toFixed(1).padStart(9) : '–'.padStart(9)}`)
  }
  rapport.ark = { bytes: svg.length, gzip: gzipSync(svg).length, lag: rader }
})

// ── 8. Hva koster mer detalj i OSM-lagene? ─────────────────────────────────
await trinn('Detalj-kostnad i OSM-lag — hjørner per toleranse', 'kurve', async () => {
  if (!overpassEl) throw new Error('ingen Overpass-elementer')
  // Speiler mapBuilder: sizeFactor = clamp(widthM/5000, 0.7, 2.5), simpScale = √sizeFactor.
  const widthM = RADIUS_M * 2
  const simpScale = Math.sqrt(Math.max(0.7, Math.min(2.5, widthM / 5000)))
  const klasser = [
    ['bygning', 1.5 * simpScale, (t) => !!t.building, 'bygning'],
    ['vann', 2.0 * simpScale, (t) => t.natural === 'water' || !!t.water, 'vann'],
    ['myr', 2.5 * simpScale, (t) => t.natural === 'wetland', 'myr'],
    ['skog', 2.5 * simpScale, (t) => t.natural === 'wood' || t.landuse === 'forest', 'skog'],
    ['sti', 2.5 * simpScale, (t) => /^(path|footway|track|bridleway|cycleway)$/.test(t.highway ?? ''), 'sti'],
    ['vei', 2.5 * simpScale, (t) => !!t.highway && !/^(path|footway|track|bridleway|cycleway)$/.test(t.highway), 'vei-liten'],
    ['bekk', 2.0 * simpScale, (t) => !!t.waterway, 'bekk'],
  ]
  const geometrier = (filter) => {
    const ut = []
    for (const el of overpassEl) {
      if (!el.tags || !filter(el.tags)) continue
      if (el.type === 'way' && Array.isArray(el.geometry)) ut.push(el.geometry)
      else if (el.type === 'relation') for (const m of el.members ?? []) if (Array.isArray(m.geometry)) ut.push(m.geometry)
    }
    return ut
  }
  log(`  simpScale ${simpScale.toFixed(2)} for ${widthM} m bredt ark. Hjørner (og anslått KB i SVG-en, målt B/hjørne fra arket over):`)
  log(`  ${'klasse'.padEnd(8)} ${'objekter'.padStart(8)} ${'rå'.padStart(9)} ${'nå'.padStart(14)} ${'halv tol.'.padStart(14)} ${'kvart tol.'.padStart(14)}`)
  const ut = {}
  for (const [navn, tol, filter, lagNavn] of klasser) {
    const g = geometrier(filter)
    const raa = g.reduce((s, l) => s + l.length, 0)
    const ved = (t) => g.reduce((s, l) => s + (t ? forenkleLinje(l, t).length : l.length), 0)
    const naa = ved(tol), halv = ved(tol / 2), kvart = ved(tol / 4)
    const bph = bytePerHjorne[lagNavn] ?? bytePerHjorne[navn] ?? 9
    const fmt = (n) => `${tall(n)} (${(n * bph / 1e3).toFixed(0)} KB)`.padStart(14)
    log(`  ${navn.padEnd(8)} ${String(g.length).padStart(8)} ${tall(raa).padStart(9)} ${fmt(naa)} ${fmt(halv)} ${fmt(kvart)}   tol. nå ${tol.toFixed(2)} m, ${bph.toFixed(1)} B/hjørne`)
    ut[navn] = { objekter: g.length, raa, naa, halv, kvart, tolM: tol, bytePerHjorne: bph }
  }
  const bygg = overpassEl.filter(e => e.tags?.building)
  const byggFlater = bygg.filter(e => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 4).length
  const byggPunkt = bygg.filter(e => e.type === 'node').length
  log(`  OSM-bygninger i bbox: ${byggFlater} med omriss, ${byggPunkt} som punkt`)
  ut.bygninger = { osmOmriss: byggFlater, osmPunkt: byggPunkt }
  rapport.kurve = ut
})

// ── 9. Bygninger i N50 mot OSM ──────────────────────────────────────────────
await trinn('Bygninger: hva N50 har som OSM ikke har', 'bygg', async () => {
  if (!kilde) throw new Error('ingen N50-kilde')
  const lag = lagNavn(kilde, /bygning/i)
  if (!lag.length) throw new Error('ingen bygningslag')
  const spat = [bbox.west, bbox.south, bbox.east, bbox.north].map(String)
  const ut = {}
  for (const l of lag) {
    const fil = join(fylkeDir, `${l.replace(/[^\w]/g, '_')}.json`)
    try {
      execFileSync('ogr2ogr', ['-f', 'GeoJSON', fil, kilde, l, '-t_srs', 'EPSG:4326', '-spat', ...spat, '-spat_srs', 'EPSG:4326'], { stdio: 'pipe' })
    } catch (e) { log(`  ${l}: ogr2ogr feilet (${String(e.message).split('\n')[0]})`); continue }
    const feats = JSON.parse(readFileSync(fil, 'utf8')).features ?? []
    const perType = {}, geomTyper = {}
    let hjorner = 0
    for (const f of feats) {
      const k = [f.properties?.objtype, f.properties?.bygningstype].filter(v => v != null).join('/')
      perType[k] = (perType[k] ?? 0) + 1
      geomTyper[f.geometry?.type] = (geomTyper[f.geometry?.type] ?? 0) + 1
      if (f.geometry?.type === 'Polygon') hjorner += f.geometry.coordinates[0].length
    }
    log(`  ${l}: ${feats.length} objekter — geometri ${Object.entries(geomTyper).map(([k, v]) => `${k}=${v}`).join(', ')}${hjorner ? `, ${hjorner} hjørner` : ''}`)
    log(`    typer: ${Object.entries(perType).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    ut[l] = { antall: feats.length, geometri: geomTyper, typer: perType }
  }
  rapport.n50Bygninger = ut
})

// ── 10. Hele fylket: N50 Innsjø/Elv pakket med appens format, per toleranse ─
await trinn(`Hele fylket pakket — Innsjø, InnsjøRegulert og Elv`, 'fylke', async () => {
  if (!kilde) throw new Error('ingen N50-kilde')
  const HODE = kodeFlis([]).length
  const TOL = [0, 2, 4, 8]
  const utfil = join(fylkeDir, 'fylkevann.geojsonl')
  const t0 = Date.now()
  execFileSync('ogr2ogr', ['-f', 'GeoJSONSeq', utfil, kilde, arealLag, '-t_srs', 'EPSG:4326', '-nlt', 'MULTIPOLYGON',
    '-where', "objtype LIKE 'Innsj%' OR objtype = 'Elv'"], { stdio: 'pipe' })
  log(`  ogr2ogr ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  const per = {}
  const stat = (t) => (per[t] ??= { flater: 0, km2: 0, hjorner: Object.fromEntries(TOL.map(x => [x, 0])), bytes: Object.fromEntries(TOL.map(x => [x, 0])), bytesStore4: 0, flaterStore: 0, biter4: [] })
  const rl = createInterface({ input: createReadStream(utfil), crlfDelay: Infinity })
  for await (const rad of rl) {
    if (!rad.trim()) continue
    let f; try { f = JSON.parse(rad) } catch { continue }
    const type = /^Innsj/.test(f.properties?.objtype ?? '') ? 'innsjo' : 'elv'
    const s = stat(type)
    const polys = f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : []
    for (const p of polys) {
      const ringer = p.map(r => r.map(([lon, lat]) => ({ lat, lon }))).filter(r => r.length >= 3)
      if (!ringer.length) continue
      const a = arealM2(ringer[0])
      s.flater++; s.km2 += a / 1e6
      for (const tol of TOL) {
        const rr = tol ? forenkleRinger(ringer, tol) : ringer
        if (!rr.length) continue
        const b = kodeFlis([{ type: 'annet', ringer: rr }])
        s.bytes[tol] += b.length - HODE
        for (const r of rr) s.hjorner[tol] += r.length
        if (tol === 4) {
          s.biter4.push(Buffer.from(b.subarray(HODE)))
          if (a >= 2500) { s.bytesStore4 += b.length - HODE; s.flaterStore++ }
        }
      }
    }
  }
  rmSync(utfil, { force: true })
  log(`  ${'type'.padEnd(7)} ${'flater'.padStart(8)} ${'km²'.padStart(7)}   ${TOL.map(t => `${t} m`.padStart(16)).join(' ')}`)
  const ut = {}
  for (const [type, s] of Object.entries(per)) {
    const gz4 = gzipSync(Buffer.concat(s.biter4)).length
    log(`  ${type.padEnd(7)} ${tall(s.flater).padStart(8)} ${tall(s.km2).padStart(7)}   ${TOL.map(t => `${(s.bytes[t] / 1e6).toFixed(2)} MB/${tall(s.hjorner[t] / 1000)}k`.padStart(16)).join(' ')}`)
    log(`  ${''.padEnd(7)} gzip ved 4 m: ${(gz4 / 1e6).toFixed(2)} MB (${(100 * gz4 / Math.max(1, s.bytes[4])).toFixed(0)} % av rå); flater ≥ 2500 m²: ${tall(s.flaterStore)} = ${(s.bytesStore4 / 1e6).toFixed(2)} MB ved 4 m`)
    ut[type] = { flater: s.flater, km2: s.km2, bytes: s.bytes, hjorner: s.hjorner, gzip4: gz4, store: { flater: s.flaterStore, bytes4: s.bytesStore4 } }
  }
  rapport.fylke = ut
})

// ── SVG-overlegg: alle kildene oppå hverandre rundt punktet ────────────────
await trinn('SVG-overlegg (probe-ut/overlegg.svg)', 'svg', async () => {
  const R = RADIUS_M
  const sti = (ring) => ring.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${(-p.y).toFixed(1)}`).join('') + 'Z'
  const deler = []
  for (const p of demMaske?.kant ?? []) deler.push(`<rect x="${(p.x - 5).toFixed(0)}" y="${(-p.y - 5).toFixed(0)}" width="10" height="10" fill="#9ec9ff" fill-opacity="0.7"/>`)
  for (const f of n50Raa ?? []) deler.push(`<path d="${f.ringer.map(sti).join('')}" fill="#cfe8ff" fill-opacity="0.35" stroke="#000" stroke-width="2" fill-rule="evenodd"/>`)
  for (const h of hull ?? []) deler.push(`<path d="${sti(h.ring)}" fill="none" stroke="${h.type === 'myr' ? '#8b5a2b' : '#2e8b57'}" stroke-width="2" stroke-dasharray="8 6"/>`)
  for (const f of osm ?? []) deler.push(`<path d="${f.ringer.map(sti).join('')}" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="3 5"/>`)
  for (const f of nve ?? []) deler.push(`<path d="${f.ringer.map(sti).join('')}" fill="none" stroke="#00b8c8" stroke-width="3"/>`)
  const legende = [
    ['#000', 'N50 rå (Geonorge)', 'stroke-width="2"'], ['#00b8c8', 'NVE Innsjødatabasen (appen tegner)', 'stroke-width="3"'],
    ['#8b5a2b', 'myr-hull i bakt flis', 'stroke-width="2" stroke-dasharray="8 6"'], ['#1d4ed8', 'OSM', 'stroke-width="2" stroke-dasharray="3 5"'],
    ['#9ec9ff', 'flatt speil i DTM (kant)', 'stroke-width="10"'],
  ].map(([c, t, s], i) => `<line x1="${-R + 40}" y1="${-R + 60 + i * 44}" x2="${-R + 200}" y2="${-R + 60 + i * 44}" stroke="${c}" ${s}/><text x="${-R + 220}" y="${-R + 72 + i * 44}" font-size="34" font-family="sans-serif">${t}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" width="1200" height="1200">
<rect x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}" fill="#fffbe6"/>
${deler.join('\n')}
<path d="M-40 0H40M0 -40V40" stroke="#e00" stroke-width="4"/>
<rect x="${-R + 20}" y="${-R + 20}" width="880" height="${legende ? 250 : 0}" fill="#fff" fill-opacity="0.85"/>${legende}
<line x1="${R - 560}" y1="${R - 60}" x2="${R - 60}" y2="${R - 60}" stroke="#000" stroke-width="6"/><text x="${R - 560}" y="${R - 80}" font-size="34" font-family="sans-serif">500 m</text>
</svg>`
  writeFileSync(join(UT, 'overlegg.svg'), svg)
  log(`  ${deler.length} elementer tegnet`)
})

writeFileSync(join(UT, 'rapport.json'), JSON.stringify(rapport, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(4)) : v), 2))
if (fylkeDir) rmSync(fylkeDir, { recursive: true, force: true })
log(`\nSkrev probe-ut/rapport.json. Ingenting annet er endret.`)

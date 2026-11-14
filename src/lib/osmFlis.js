// OSM-flisene (docs/PLAN_OSM_UAVHENGIG.md, fase 2): Norges OSM-uttrekk bakt til
// et fast gitter, i NØYAKTIG den formen Overpass svarer med `out geom`. Da er
// mapBuilder urørt — bare transporten byttes.
//
// Denne fila er delt av baken (scripts/bygg-osm-fliser.mjs) og klienten, og den
// er ren: ingen fs, ingen nett.
//
// UTVALGET LESES AV SPØRRINGEN, det skrives ikke av. `osmSelektorer` parser
// buildOverpassQuery, så en ny linje der havner i flisene ved neste bake uten at
// noen må huske en liste nummer to.

import { buildOverpassQuery } from './mapBuilder.js'

export const OSM_FLIS_VERSJON = 2

// ~5,5 × 5,5 km på 60° N. Første bake brukte det dobbelte, og Oslo-flisa ble
// 9 MB gzip — mer enn Overpass sender for et helt 8 km-kart der.
export const GITTER = Object.freeze({ dLat: 0.05, dLon: 0.1 })

// Et element som er større enn dette OG står i flere fliser, lagres ÉN gang som
// en delt fil (`delt/<type>_<id>.json.gz`) som flisene peker på. Ellers ville
// Oslofjorden, en nasjonalpark eller en skiløype-relasjon ligget i full
// geometri i hver flis den berører — og klienten lastet den ned én gang per flis.
export const DELT_TERSKEL_BYTES = 32_000

export const deltFilnavn = (id) => `delt/${id.replace('/', '_')}.json.gz`

// Når baken kjører (UTC) — den 1. hver måned. MÅ stå likt som cron-linja i
// .github/workflows/bygg-osm-fliser.yml; en test holder dem sammen. Appen
// viser neste kjøring i «Om appen», og en dato regnet av en plan som ikke
// lenger gjelder er verre enn ingen dato.
export const OSM_BAKE_PLAN = Object.freeze({ dag: 1, time: 2, minutt: 23 })

/** Neste planlagte bake etter `naa`, som Date. */
export function nesteOsmBake(naa = new Date(), plan = OSM_BAKE_PLAN) {
  let ar = naa.getUTCFullYear()
  let mnd = naa.getUTCMonth()
  for (;;) {
    const t = new Date(Date.UTC(ar, mnd, plan.dag, plan.time, plan.minutt))
    if (t > naa) return t
    if (++mnd > 11) { mnd = 0; ar++ }
  }
}

const EPS = 1e-9

export function flisNokkel(rad, kol) {
  return `${rad}_${kol}`
}

/** Fliser som en bbox overlapper, som nøkler. */
export function flisNoklerForBbox(bbox, gitter = GITTER) {
  const r0 = Math.floor(bbox.south / gitter.dLat + EPS)
  const r1 = Math.floor(bbox.north / gitter.dLat - EPS)
  const k0 = Math.floor(bbox.west / gitter.dLon + EPS)
  const k1 = Math.floor(bbox.east / gitter.dLon - EPS)
  const ut = []
  for (let r = r0; r <= Math.max(r0, r1); r++) {
    for (let k = k0; k <= Math.max(k0, k1); k++) ut.push(flisNokkel(r, k))
  }
  return ut
}

/**
 * Flisene en strek mellom a og b går GJENNOM — ikke flisene boksen dens
 * dekker. En kraftlinje på skrå over ti fliser i hver retning står da i ti
 * fliser og ikke hundre. Rutenett-traversering (Amanatides–Woo); et hjørne
 * truffet eksakt gir én nabo for mye, aldri én for lite.
 */
export function flisNoklerForSegment(a, b, gitter = GITTER, ut = new Set()) {
  const u0 = a.lon / gitter.dLon, v0 = a.lat / gitter.dLat
  const du = b.lon / gitter.dLon - u0, dv = b.lat / gitter.dLat - v0
  let x = Math.floor(u0), y = Math.floor(v0)
  const x1 = Math.floor(u0 + du), y1 = Math.floor(v0 + dv)
  ut.add(flisNokkel(y, x))
  const sx = Math.sign(du), sy = Math.sign(dv)
  const tdx = sx ? Math.abs(1 / du) : Infinity
  const tdy = sy ? Math.abs(1 / dv) : Infinity
  let tmx = sx ? ((sx > 0 ? x + 1 : x) - u0) / du : Infinity
  let tmy = sy ? ((sy > 0 ? y + 1 : y) - v0) / dv : Infinity
  let n = Math.abs(x1 - x) + Math.abs(y1 - y)
  while (n-- > 0) {
    if (tmx < tmy) { x += sx; tmx += tdx } else { y += sy; tmy += tdy }
    ut.add(flisNokkel(y, x))
  }
  return ut
}

/** Flisene et element i Overpass-form faktisk berører. */
export function flisNoklerForElement(el, gitter = GITTER) {
  const ut = new Set()
  const linje = (g) => {
    const p = (g ?? []).filter(Boolean)
    if (p.length === 1) flisNoklerForSegment(p[0], p[0], gitter, ut)
    for (let i = 1; i < p.length; i++) flisNoklerForSegment(p[i - 1], p[i], gitter, ut)
  }
  if (el.type === 'node') flisNoklerForSegment(el, el, gitter, ut)
  else if (el.type === 'way') linje(el.geometry)
  else for (const m of el.members ?? []) m.geometry ? linje(m.geometry) : m.lat != null && linje([m])
  return [...ut]
}

/** Liang–Barsky: krysser strekken a–b boksen? */
function segmentIBbox(a, b, bb) {
  const dx = b.lon - a.lon, dy = b.lat - a.lat
  const p = [-dx, dx, -dy, dy]
  const q = [a.lon - bb.west, bb.east - a.lon, a.lat - bb.south, bb.north - a.lat]
  let t0 = 0, t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue }
    const r = q[i] / p[i]
    if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r } else { if (r < t0) return false; if (r < t1) t1 = r }
  }
  return true
}

function linjeIBbox(g, bb) {
  const p = (g ?? []).filter(Boolean)
  if (p.length === 1) return segmentIBbox(p[0], p[0], bb)
  for (let i = 1; i < p.length; i++) if (segmentIBbox(p[i - 1], p[i], bb)) return true
  return false
}

/**
 * Overpass' egen regel for `(bbox)`: en way er med når en av STREKENE krysser
 * boksen, og en relasjon når et av medlemmene er med. At den omsluttende boksen
 * overlapper er ikke nok — da får en lang kraftlinje som går UTENFOR kartet
 * være med fordi boksen dens dekker det.
 */
export function elementIBbox(el, bb) {
  if (el.type === 'node') return el.lat >= bb.south && el.lat <= bb.north && el.lon >= bb.west && el.lon <= bb.east
  if (el.type === 'way') return linjeIBbox(el.geometry, bb)
  return (el.members ?? []).some(m => m.geometry ? linjeIBbox(m.geometry, bb) : m.lat != null && linjeIBbox([m], bb))
}

/**
 * Selektorene i en Overpass-spørring, som data. Bare formen buildOverpassQuery
 * bruker: `type["k"]`, `["k"="v"]`, `["k"~"re"]`, `["k"!~"re"]`, kjedet.
 * Kaster på en linje den ikke forstår — en selektor som stille faller bort er
 * et lag som mangler på hvert kart bygget av flisene.
 */
export function parseSelektorer(query) {
  const kropp = query.slice(query.indexOf('(') + 1, query.lastIndexOf(');'))
  const ut = []
  for (const raa of kropp.split('\n')) {
    const linje = raa.trim()
    if (!linje) continue
    const m = linje.match(/^(node|way|relation|nwr)((?:\[[^\]]+\])+);$/)
    if (!m) throw new Error(`Forstår ikke selektoren: ${linje}`)
    const krav = [...m[2].matchAll(/\[([^\]]+)\]/g)].map(([, innhold]) => {
      const k = innhold.match(/^"([^"]+)"(?:(=|~|!~)"([^"]*)")?$/)
      if (!k) throw new Error(`Forstår ikke betingelsen [${innhold}] i ${linje}`)
      const [, nokkel, op, verdi] = k
      if (!op) return { nokkel, op: 'finnes' }
      if (op === '=') return { nokkel, op, verdi }
      return { nokkel, op, re: new RegExp(verdi) }
    })
    ut.push({ type: m[1], krav })
  }
  return ut
}

export function osmSelektorer() {
  return parseSelektorer(buildOverpassQuery({ south: 0, west: 0, north: 1, east: 1 }))
}

function oppfyller(tags, k) {
  const v = tags[k.nokkel]
  if (k.op === 'finnes') return v != null
  if (k.op === '=') return v === k.verdi
  if (k.op === '~') return v != null && k.re.test(v)
  // Overpass: ["k"!~"re"] er sann også når nøkkelen mangler.
  return v == null || !k.re.test(v)
}

/** Treffer elementet (type + tagger) minst én selektor? */
export function treffer(type, tags, selektorer) {
  if (!tags) return false
  for (const s of selektorer) {
    if (s.type !== 'nwr' && s.type !== type) continue
    if (s.krav.every(k => oppfyller(tags, k))) return true
  }
  return false
}

/** Nøklene som må finnes for at noe skal treffe — til osmium tags-filter. */
export function filterNokler(selektorer) {
  const per = { node: new Set(), way: new Set(), relation: new Set() }
  for (const s of selektorer) {
    const nokkel = s.krav.find(k => k.op !== '!~')?.nokkel
    if (!nokkel) throw new Error('Selektor uten positiv betingelse')
    for (const t of s.type === 'nwr' ? ['node', 'way', 'relation'] : [s.type]) per[t].add(nokkel)
  }
  return per
}

/** Omsluttende boks for et element i Overpass-form, eller null. */
export function elementBbox(el) {
  if (el.type === 'node') return { south: el.lat, north: el.lat, west: el.lon, east: el.lon }
  let s = Infinity, n = -Infinity, w = Infinity, e = -Infinity
  const ta = (g) => {
    for (const p of g ?? []) {
      if (!p) continue
      if (p.lat < s) s = p.lat
      if (p.lat > n) n = p.lat
      if (p.lon < w) w = p.lon
      if (p.lon > e) e = p.lon
    }
  }
  if (el.type === 'way') ta(el.geometry)
  else for (const m of el.members ?? []) m.geometry ? ta(m.geometry) : m.lat != null && ta([m])
  return s === Infinity ? null : { south: s, north: n, west: w, east: e }
}

export function bboxOverlapper(a, b) {
  return a.south <= b.north && a.north >= b.south && a.west <= b.east && a.east >= b.west
}

/** Id-ene til de delte elementene flisene peker på, uten duplikater. */
export function delteIder(fliser) {
  return [...new Set(fliser.flatMap(f => f?.delte ?? []))]
}

/**
 * Slå sammen flis-svar til ett Overpass-svar for bboksen. Et element som
 * krysser en flisgrense står i hver flis det berører — det dedupes på id. Og
 * en flis er større enn kartet, så elementer utenfor bboksen tas ut: Overpass
 * ville ikke gitt dem. `delte` er de delte elementene (id → element); en
 * peker uten element hoppes over.
 */
export function slaSammenFliser(fliser, bbox, delte = new Map()) {
  const sett = new Set()
  const elements = []
  const ta = (el) => {
    const id = `${el.type}/${el.id}`
    if (sett.has(id) || !elementIBbox(el, bbox)) return
    sett.add(id)
    elements.push(el)
  }
  for (const f of fliser) {
    for (const el of f?.elements ?? []) ta(el)
    for (const id of f?.delte ?? []) { const el = delte.get(id); if (el) ta(el) }
  }
  return { elements }
}

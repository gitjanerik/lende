// Kompakt flis-format for N50 arealdekke-FLATER (myr, skog, isbre).
//
// ── Hvorfor dette finnes ───────────────────────────────────────────────────
// Samme diagnose som n50StiPakke.js åpner med, bare for arealdekke: OSM er
// tynt i norsk utmark. Ved Briskemyrputten i Drammensmarka viser UT.no en myr
// som dekker det meste av utsnittet; OSM har ingenting, og Lende tegnet derfor
// bare selve putten. N50 har myra. Den har ingen live WFS, så dataene bakes
// én gang (scripts/bygg-n50-areal.mjs) og serveres som statiske filer.
//
// ── Hvorfor det er et EGET format og ikke n50StiPakke ──────────────────────
// Sti-formatet bærer LINJER. En flate trenger ringer (ytre + hull), og hull
// er ikke noe man kan lure inn i en linje-koder uten å gjøre begge deler
// utydelige. Men FLISRUTENETTET er delt — det importeres herfra, ikke kopieres.
// Tre kopier av en offset-regel er nøyaktig feilen `svgNestedOffset.js` ble
// laget for å rette opp.
//
// ── Hvorfor flater dupliseres i stedet for å klippes ───────────────────────
// En linje som krysser en flisgrense deles på grensa (delPaaFliser). For en
// flate ville det krevd ekte polygon-klipping med hull-håndtering — og
// gevinsten er null: en myr er sjelden mer enn noen få km, mot en flis på
// ~55 × 35 km. Flata legges derfor HEL i hver flis bboxen berører, og leseren
// dedupliserer. Det koster noen få prosent duplikat og sparer en hel klasse
// geometri-feil.

import { FLIS_LAT, FLIS_LON, flisNokkel, fliserForBbox, forenkleLinje } from './n50StiPakke.js'

export { FLIS_LAT, FLIS_LON, flisNokkel, fliserForBbox }

export const MAGIC = 0x4e353041          // 'N50A'
export const VERSJON = 1

// Samme kvantisering som stiene: 1e-5 grader ≈ 1 m. N50 er 1:50 000; på et
// kart trykt i 1:10 000 er 1 m = 0,1 mm. Usynlig i begge tilfeller.
export const KVANT = 1e5

// Rekkefølgen ER kodingen (u8). Den kan UTVIDES bakerst, men aldri omordnes:
// et navn som bytter indeks gjør hver eneste bakte flis feil-lest uten at noe
// kaster. 'isbre' kom til i v5.26.0 og ligger derfor SIST, ikke ved siden av
// sine slektninger — indeks 0–3 står som de sto, så en klient fra v5.25 leser
// myr og skog riktig ut av en flis bakt i dag.
//
// 'apen' står fortsatt ubrukt med vilje: når Turkart-bakgrunnen ER den åpne
// tonen, er åpenhet standardtilstanden, og 112 020 flater som maler bakgrunnen
// på nytt er ren datamengde. Plassen koster ingenting; baken bestemmer.
export const TYPER = Object.freeze(['myr', 'skog', 'apen', 'annet', 'isbre'])

export function typeIndeks(navn) {
  const i = TYPER.indexOf(navn)
  return i < 0 ? TYPER.indexOf('annet') : i
}

// ── Varint (LEB128) + zigzag ───────────────────────────────────────────────
// Bevisst duplisert fra n50StiPakke i stedet for å eksporteres derfra: det er
// tolv linjer ren bit-mekanikk uten domenekunnskap, og en delt privat
// hjelpemodul ville bundet to filformater sammen som ellers kan versjoneres
// hver for seg.

function zigzag(n) { return (n << 1) ^ (n >> 31) }
function unzigzag(n) { return (n >>> 1) ^ -(n & 1) }

class Skriver {
  constructor() { this.buf = new Uint8Array(1024); this.n = 0 }
  _plass(k) {
    if (this.n + k <= this.buf.length) return
    const ny = new Uint8Array(Math.max(this.buf.length * 2, this.n + k))
    ny.set(this.buf.subarray(0, this.n))
    this.buf = ny
  }
  u8(v) { this._plass(1); this.buf[this.n++] = v & 0xff }
  varint(v) {
    this._plass(5)
    let x = v >>> 0
    while (x >= 0x80) { this.buf[this.n++] = (x & 0x7f) | 0x80; x >>>= 7 }
    this.buf[this.n++] = x
  }
  svarint(v) { this.varint(zigzag(v)) }
  ferdig() { return this.buf.subarray(0, this.n) }
}

class Leser {
  constructor(buf) { this.buf = buf; this.n = 0 }
  u8() { return this.buf[this.n++] }
  varint() {
    let x = 0, skift = 0, b
    do { b = this.buf[this.n++]; x |= (b & 0x7f) << skift; skift += 7 } while (b & 0x80)
    return x >>> 0
  }
  svarint() { return unzigzag(this.varint()) }
}

// ── Koding ─────────────────────────────────────────────────────────────────

/**
 * Pakk flater til én flis.
 *
 * En flate er `{type, ringer: [[{lat,lon}, …], …]}` der ring 0 er ytre kant
 * og resten er hull. Deltakodingen løper VIDERE mellom ringene i samme flate
 * — et hull ligger per definisjon inni ytterkanten, så første punkt i hullet
 * er nær siste punkt i ringen før, og deltaet blir lite.
 *
 * @param {Array<{type?:string, ringer:Array<Array<{lat:number,lon:number}>>}>} flater
 * @returns {Uint8Array}
 */
export function kodeFlis(flater) {
  const s = new Skriver()
  s.varint(MAGIC); s.u8(VERSJON)
  const gyldige = (flater ?? []).filter(f =>
    Array.isArray(f.ringer) && f.ringer.length && Array.isArray(f.ringer[0]) && f.ringer[0].length >= 3)
  s.varint(gyldige.length)
  for (const f of gyldige) {
    const ringer = f.ringer.filter(r => Array.isArray(r) && r.length >= 3)
    s.u8(typeIndeks(f.type))
    s.varint(ringer.length)
    let fLat = 0, fLon = 0
    for (const ring of ringer) {
      s.varint(ring.length)
      for (const p of ring) {
        const qLat = Math.round(p.lat * KVANT)
        const qLon = Math.round(p.lon * KVANT)
        s.svarint(qLat - fLat)
        s.svarint(qLon - fLon)
        fLat = qLat; fLon = qLon
      }
    }
  }
  return s.ferdig()
}

/** Pakk ut en flis igjen. Kaster ved feil magic/versjon. */
export function lesFlis(bytes) {
  const l = new Leser(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  if (l.varint() !== MAGIC) throw new Error('Ikke en N50-areal-flis')
  const v = l.u8()
  if (v !== VERSJON) throw new Error(`Ukjent flis-versjon ${v} (venter ${VERSJON})`)
  const antall = l.varint()
  const ut = []
  for (let i = 0; i < antall; i++) {
    const type = TYPER[l.u8()] ?? 'annet'
    const ringAntall = l.varint()
    const ringer = []
    let fLat = 0, fLon = 0
    for (let r = 0; r < ringAntall; r++) {
      const n = l.varint()
      const ring = []
      for (let j = 0; j < n; j++) {
        fLat += l.svarint(); fLon += l.svarint()
        ring.push({ lat: fLat / KVANT, lon: fLon / KVANT })
      }
      ringer.push(ring)
    }
    ut.push({ type, ringer })
  }
  return ut
}

// ── Geometri ───────────────────────────────────────────────────────────────

/** Bbox for en flate (alle ringer). */
export function bboxForRinger(ringer) {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const ring of ringer ?? []) {
    for (const p of ring) {
      if (p.lat < south) south = p.lat
      if (p.lat > north) north = p.lat
      if (p.lon < west) west = p.lon
      if (p.lon > east) east = p.lon
    }
  }
  return Number.isFinite(south) ? { south, west, north, east } : null
}

/**
 * Areal i m² for én ring (skolisse-formelen på en ekvirektangulær projeksjon).
 * Brukes til å luke bort småflekker i baken: en myr på 500 m² er 0,05 mm² på
 * et kart i 1:10 000 — usynlig, men den koster like mange byte som en synlig.
 */
export function arealM2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  const lat0 = ring[0].lat
  const cos = Math.cos(lat0 * Math.PI / 180)
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lon * cos * 111320, yi = ring[i].lat * 111320
    const xj = ring[j].lon * cos * 111320, yj = ring[j].lat * 111320
    sum += xj * yi - xi * yj
  }
  return Math.abs(sum) / 2
}

/** Douglas-Peucker per ring. En ring med færre enn 4 punkter slippes urørt. */
export function forenkleRinger(ringer, toleranseM = 4) {
  const ut = []
  for (const ring of ringer ?? []) {
    if (!Array.isArray(ring) || ring.length < 4) { if (ring?.length >= 3) ut.push(ring); continue }
    const g = forenkleLinje(ring, toleranseM)
    // Forenklingen kan spise en ring ned under tre punkter — da er den ikke
    // en flate lenger, og skal ut i stedet for å bli en usynlig strek.
    if (g.length >= 3) ut.push(g)
  }
  return ut
}

/**
 * Hvilke fliser skal denne flata ligge i? Alle flisen bboxen berører — flata
 * lagres HEL i hver, se toppen av fila for hvorfor vi ikke klipper.
 *
 * @returns {string[]} flis-nøkler
 */
export function fliserForFlate(ringer) {
  const b = bboxForRinger(ringer)
  return b ? fliserForBbox(b) : []
}

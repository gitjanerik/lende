// Kompakt flis-format for N50-stier (Sti, Traktorveg, Barmarksløype).
//
// ── Hvorfor et eget format ─────────────────────────────────────────────────
// Turrutebasen (v5.0.2) dekker MERKEDE ruter og hentes live per bbox. Resten
// av stinettet — det UT.no viser og vi mangler — ligger i N50 Samferdsel, som
// ikke har noen live WFS. Den må derfor bakes én gang og serveres selv, og da
// er størrelsen alt: den avgjør om dataene kan ligge statisk ved siden av
// appen eller trenger egen lagring.
//
// GeoJSON er sløsing her. Et koordinatpar som «[10.080351,59.839867]» er 22
// tegn; det samme punktet er 2-4 byte når vi kvantiserer til ~1 m, deltakoder
// mot forrige punkt og varint-pakker. På et stinett dominert av lange, jevne
// linjer gir det typisk 5-10× mindre enn GeoJSON FØR gzip.
//
// ── Presisjon ──────────────────────────────────────────────────────────────
// Kvantisering til 1e-5 grader ≈ 1,1 m i nord/sør og ~0,6 m i øst/vest på
// norske breddegrader. N50 er 1:50 000, der 1 m er 0,02 mm på papiret — langt
// under det datagrunnlaget selv holder. Kartet vårt trykkes i 1:10 000, og
// 1 m er 0,1 mm der. Kvantiseringen er altså usynlig i begge tilfeller.
//
// Formatet er bevisst enkelt og selvstendig: ingen avhengigheter, samme kode
// pakker (bake-scriptet i CI) og pakker ut (appen).

export const MAGIC = 0x4e353053          // 'N50S'
export const VERSJON = 1

// Kvantiseringsgitter i grader. 1e-5 → heltall på ~7,1e6 for lat 71.
export const KVANT = 1e5

// Flis-størrelse i grader. Lengdegrader er smalere i nord, så en flis på
// 0,5° × 1,0° er ~55 × 35 km ved lat 60 og ~55 × 18 km ved lat 71 — små nok
// til at et kart på 16 km sjelden trenger mer enn 2×2 fliser.
export const FLIS_LAT = 0.5
export const FLIS_LON = 1.0

// Objekttyper vi bærer. Rekkefølgen ER kodingen (u8) og må ikke endres uten
// versjonsbump — en gammel flis lest med ny tabell ville byttet om stitypene.
export const TYPER = Object.freeze(['sti', 'traktorveg', 'barmarksloype', 'annet'])

export function typeIndeks(navn) {
  const i = TYPER.indexOf(navn)
  return i < 0 ? TYPER.indexOf('annet') : i
}

/** Flis-nøkkel for et punkt, f.eks. «59.5_10.0». Stabil og filnavn-trygg. */
export function flisNokkel(lat, lon) {
  const la = Math.floor(lat / FLIS_LAT) * FLIS_LAT
  const lo = Math.floor(lon / FLIS_LON) * FLIS_LON
  // toFixed(1) unngår flyttalsstøy («59.5» ikke «59.50000000000001»).
  return `${la.toFixed(1)}_${lo.toFixed(1)}`
}

/** Alle flis-nøkler som dekker et bbox (inklusive kantene). */
export function fliserForBbox(bbox) {
  if (!bbox) return []
  const ut = []
  const la0 = Math.floor(bbox.south / FLIS_LAT) * FLIS_LAT
  const lo0 = Math.floor(bbox.west / FLIS_LON) * FLIS_LON
  for (let la = la0; la <= bbox.north; la += FLIS_LAT) {
    for (let lo = lo0; lo <= bbox.east; lo += FLIS_LON) {
      ut.push(flisNokkel(la + FLIS_LAT / 2, lo + FLIS_LON / 2))
    }
  }
  return ut
}

// ── Varint (LEB128) + zigzag ───────────────────────────────────────────────

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
  slutt() { return this.n >= this.buf.length }
}

// ── Koding ─────────────────────────────────────────────────────────────────

/**
 * Pakk linjer til én flis.
 * @param {Array<{type?:string, geometry:Array<{lat:number,lon:number}>}>} linjer
 * @returns {Uint8Array}
 */
export function kodeFlis(linjer) {
  const s = new Skriver()
  s.varint(MAGIC); s.u8(VERSJON)
  const gyldige = (linjer ?? []).filter(l => Array.isArray(l.geometry) && l.geometry.length >= 2)
  s.varint(gyldige.length)
  for (const l of gyldige) {
    s.u8(typeIndeks(l.type))
    s.varint(l.geometry.length)
    let fLat = 0, fLon = 0
    for (let i = 0; i < l.geometry.length; i++) {
      const qLat = Math.round(l.geometry[i].lat * KVANT)
      const qLon = Math.round(l.geometry[i].lon * KVANT)
      // Første punkt absolutt, resten som delta mot forrige — det er her
      // gevinsten ligger: nabopunkter på en sti er sjelden mer enn noen få
      // titalls meter fra hverandre, altså 1-2 byte per koordinat.
      s.svarint(qLat - fLat)
      s.svarint(qLon - fLon)
      fLat = qLat; fLon = qLon
    }
  }
  return s.ferdig()
}

/** Pakk ut en flis igjen. Kaster ved feil magic/versjon. */
export function lesFlis(bytes) {
  const l = new Leser(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  if (l.varint() !== MAGIC) throw new Error('Ikke en N50-sti-flis')
  const v = l.u8()
  if (v !== VERSJON) throw new Error(`Ukjent flis-versjon ${v} (venter ${VERSJON})`)
  const antall = l.varint()
  const ut = []
  for (let i = 0; i < antall; i++) {
    const type = TYPER[l.u8()] ?? 'annet'
    const n = l.varint()
    const geometry = []
    let fLat = 0, fLon = 0
    for (let j = 0; j < n; j++) {
      fLat += l.svarint(); fLon += l.svarint()
      geometry.push({ lat: fLat / KVANT, lon: fLon / KVANT })
    }
    ut.push({ type, geometry })
  }
  return ut
}

// ── Forenkling ─────────────────────────────────────────────────────────────

function avstandTilLinje(p, a, b, cosLat) {
  const px = (p.lon - a.lon) * cosLat, py = p.lat - a.lat
  const bx = (b.lon - a.lon) * cosLat, by = b.lat - a.lat
  const len2 = bx * bx + by * by
  if (len2 === 0) return Math.hypot(px, py)
  let t = (px * bx + py * by) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - bx * t, py - by * t)
}

/**
 * Douglas-Peucker på en linje, med toleranse i METER. N50 er 1:50 000, så
 * vertekser som ligger under et par meter fra nabolinja bærer ingen
 * informasjon — de koster bare byte. Iterativ (ingen rekursjon) så en lang
 * kystnær traktorveg ikke sprenger stakken.
 */
export function forenkleLinje(geometry, toleranseM = 3) {
  if (!Array.isArray(geometry) || geometry.length <= 2) return geometry ?? []
  const cosLat = Math.cos(geometry[0].lat * Math.PI / 180)
  const tolGrader = toleranseM / 111320
  const behold = new Uint8Array(geometry.length)
  behold[0] = 1; behold[geometry.length - 1] = 1
  const stabel = [[0, geometry.length - 1]]
  while (stabel.length) {
    const [i0, i1] = stabel.pop()
    let maks = 0, maksIdx = -1
    for (let i = i0 + 1; i < i1; i++) {
      const d = avstandTilLinje(geometry[i], geometry[i0], geometry[i1], cosLat)
      if (d > maks) { maks = d; maksIdx = i }
    }
    if (maksIdx >= 0 && maks > tolGrader) {
      behold[maksIdx] = 1
      stabel.push([i0, maksIdx], [maksIdx, i1])
    }
  }
  const ut = []
  for (let i = 0; i < geometry.length; i++) if (behold[i]) ut.push(geometry[i])
  return ut
}

/** Lengde i meter (ekvirektangulær tilnærming — god nok for statistikk). */
export function lengdeM(geometry) {
  let sum = 0
  for (let i = 0; i < (geometry?.length ?? 0) - 1; i++) {
    const a = geometry[i], b = geometry[i + 1]
    const cos = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180)
    sum += 111320 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * cos)
  }
  return sum
}

/**
 * Del en linje på flis-grensene, så hver flis er selvstendig lesbar.
 * Segmentet som krysser en grense legges i BEGGE fliser (duplisert kant), så
 * en linje aldri får et hull i skjøten når appen henter to nabofliser.
 */
export function delPaaFliser(linje) {
  const geometry = linje.geometry ?? []
  if (geometry.length < 2) return []
  const ut = new Map()
  const legg = (nokkel, a, b) => {
    let l = ut.get(nokkel)
    if (!l) ut.set(nokkel, (l = []))
    const siste = l[l.length - 1]
    if (!siste || siste[siste.length - 1] !== a) l.push([a, b])
    else siste.push(b)
  }
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i], b = geometry[i + 1]
    const ka = flisNokkel(a.lat, a.lon), kb = flisNokkel(b.lat, b.lon)
    legg(ka, a, b)
    if (kb !== ka) legg(kb, a, b)
  }
  const res = []
  for (const [nokkel, deler] of ut) {
    for (const d of deler) if (d.length >= 2) res.push({ nokkel, type: linje.type, geometry: d })
  }
  return res
}

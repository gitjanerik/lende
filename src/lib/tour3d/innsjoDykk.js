// Dykket ned i innsjø-volumet: hvor man dykker, hvordan kameraet beveger seg, og
// hvor mørkt det blir. Ren regning uten three/DOM, så det kan testes i node.
//
// Dykket er en kamerapose i den virkelige (forsterkede) scenen, ikke en egen
// visning: man står fortsatt på kartet sitt, bare under vannflata. Derfor går
// bevegelsen gjennom den frie riggen (freeRig.spillSekvens) og gulvet byttes,
// ikke riggen.

import { terrainFloorY } from './cameraRigs.js'

// Mørket mettes ved 150 m, og taket er lavt med vilje: man dykker for å se
// formen på bunnen og berget som reiser seg, og ekte vann er svart lenge før
// 288 m (Tyrifjorden) og 514 m (Hornindalsvatnet).
export const MORKE_METNING_M = 150
export const MORKE_TAK = 0.3

const GRUNN_FARGE = [0x4f, 0x9f, 0xdc]
const DYP_FARGE = [0x1d, 0x56, 0x84]

/** 0–1: hvor «dypt» det kjennes ut ved d meter (logaritmisk, mettet). */
export function dybdeGrad(d) {
  if (!(d > 0)) return 0
  return Math.min(1, Math.log1p(d) / Math.log1p(MORKE_METNING_M))
}

/** Mørke-overleggets alfa ved d meter. 5 m ≈ 0,11, 30 m ≈ 0,21, 150 m+ = 0,3. */
export function undervannsMorke(d) {
  return MORKE_TAK * dybdeGrad(d)
}

/** Dis- og bakgrunnsfargen under vann, som 0xRRGGBB. */
export function undervannsFarge(d) {
  const k = dybdeGrad(d)
  let ut = 0
  for (let i = 0; i < 3; i++) ut = (ut << 8) | Math.round(GRUNN_FARGE[i] + (DYP_FARGE[i] - GRUNN_FARGE[i]) * k)
  return ut
}

/**
 * Disen under vann, i world-meter. Rekkevidden sideveis krymper med dybden,
 * men flata over skal alltid skimtes, og helst fjellet over den: flata er det
 * eneste som sier hvor opp er, og berget som fortsetter over vannet er det man
 * dykker for å se.
 */
export function undervannsDis(d, avstandTilFlate) {
  const k = dybdeGrad(d)
  const sideveis = 700 - 450 * k
  return { near: 4, far: Math.max(sideveis, 2.5 * Math.max(0, avstandTilFlate) + 300) }
}

// Lyset kommer fra nordvest i 45°, som relieffet på kartet.
const LYS = (() => {
  const az = (315 * Math.PI) / 180
  const alt = Math.PI / 4
  return [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)]
})()

/**
 * Relieff-faktoren for hver celle i innsjøen: 1 på flat bunn, over 1 i lys
 * skråning, under 1 i skygge. Uten den er bunnen en jevn dybde-gradient, og en
 * skråning og en flate på samme dybde får samme farge.
 *
 * @param {ArrayLike<number>} H  høydene (meter) til det SENKEDE DEM-et
 * @param {number} zFaktor       den vertikale overdrivelsen i scenen
 */
export function bunnRelieff(H, maske, { cols, rows, transform }, zFaktor = 1) {
  const ut = new Float32Array(cols * rows).fill(1)
  const pw = Math.abs(transform.pixelWidth)
  const ph = Math.abs(transform.pixelHeight)
  const h = (c, r) => H[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (!maske[i]) continue
      const dzdx = ((h(c + 1, r) - h(c - 1, r)) * zFaktor) / (2 * pw)
      // Radene går sørover, så nord-gradienten har motsatt fortegn.
      const dzdn = ((h(c, r - 1) - h(c, r + 1)) * zFaktor) / (2 * ph)
      const len = Math.hypot(dzdx, dzdn, 1)
      const lys = Math.max(0, (-dzdx * LYS[0] - dzdn * LYS[1] + LYS[2]) / len)
      ut[i] = Math.min(1.35, Math.max(0.3, 1 + 0.9 * (lys / LYS[2] - 1)))
    }
  }
  return ut
}

/**
 * Den bratteste veggen i innsjøen: strandcella med mest fall under seg og mest
 * fjell over seg innen radiusM, og som kan nås i rett linje fra start uten å
 * krysse land. Det er dit dykketuren går. null når ingen finnes.
 *
 * @param {ArrayLike<number>} H  høydene (meter) til det senkede DEM-et
 * @param {{c:number, r:number}} start  gittercella turen starter i
 */
export function bratteVegg(H, maske, { cols, rows, transform }, nivaa, start, { radiusM = 400 } = {}) {
  const rc = Math.max(1, Math.round(radiusM / Math.abs(transform.pixelWidth)))
  const kandidater = []
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c
      if (!maske[i]) continue
      if (maske[i - 1] && maske[i + 1] && maske[i - cols] && maske[i + cols]) continue
      let under = 0
      let over = 0
      for (let rr = Math.max(0, r - rc); rr <= Math.min(rows - 1, r + rc); rr++) {
        for (let cc = Math.max(0, c - rc); cc <= Math.min(cols - 1, c + rc); cc++) {
          const j = rr * cols + cc
          const d = H[j] - nivaa
          if (maske[j]) { if (-d > under) under = -d } else if (d > over) over = d
        }
      }
      kandidater.push({ c, r, score: under + over, under, over })
    }
  }
  kandidater.sort((a, b) => b.score - a.score)
  for (const k of kandidater) {
    if (fritt(maske, cols, start, k)) {
      return { ...k, x: k.c * transform.pixelWidth, y: k.r * transform.pixelHeight }
    }
  }
  return null
}

// Går den rette linja fra a til b bare gjennom vann?
function fritt(maske, cols, a, b) {
  const n = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r)) * 2
  for (let s = 0; s <= n; s++) {
    const t = n ? s / n : 0
    const c = Math.round(a.c + (b.c - a.c) * t)
    const r = Math.round(a.r + (b.r - a.r) * t)
    if (!maske[r * cols + c]) return false
  }
  return true
}

/** Asimut (radianer, med klokka fra nord) fra a mot b i world-rommet (Z = sør). */
export function asimutMot(ax, az, bx, bz) {
  return Math.atan2(bx - ax, -(bz - az))
}

/**
 * Den dype renna fra start: følger den dypeste vannveien til det fjerneste
 * punktet som fortsatt er minst `andel` av maksdybden. Bare en LANG og SMAL
 * renne teller — en rund gryte gir null, og da går turen mot veggen i stedet.
 *
 * @returns {{punkter:number[][], lengde:number}|null}  punktene i SVG-meter
 */
export function dypRenne(bunn, { cols, rows, transform }, start, { andel = 0.5, minLengdeM = 400 } = {}) {
  const pw = Math.abs(transform.pixelWidth)
  const ph = Math.abs(transform.pixelHeight)
  const s0 = start.r * cols + start.c
  const maks = bunn.dybde[s0]
  if (!bunn.maske[s0] || !(maks > 0)) return null
  const grense = andel * maks
  const n = cols * rows
  const dist = new Float64Array(n).fill(Infinity)
  const forrige = new Int32Array(n).fill(-1)
  const heap = new MinHeap()
  dist[s0] = 0
  heap.push(0, s0)
  let antall = 0
  let ende = s0
  while (heap.size) {
    const [d, i] = heap.pop()
    if (d > dist[i]) continue
    antall++
    if (d > dist[ende]) ende = i
    const c = i % cols
    const r = (i - c) / cols
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const cc = c + dc
        const rr = r + dr
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue
        const j = rr * cols + cc
        if (!bunn.maske[j] || bunn.dybde[j] < grense) continue
        // Grunnere celler koster mer, så veien holder seg i bunnen av renna.
        const steg = Math.hypot(dc * pw, dr * ph) * (1 + 2 * (1 - bunn.dybde[j] / maks))
        if (d + steg < dist[j]) { dist[j] = d + steg; forrige[j] = i; heap.push(d + steg, j) }
      }
    }
  }
  const celler = []
  for (let i = ende; i >= 0; i = forrige[i]) celler.push(i)
  celler.reverse()
  const punkter = celler.map((i) => {
    const c = i % cols
    return [c * transform.pixelWidth, ((i - c) / cols) * transform.pixelHeight]
  })
  let lengde = 0
  for (let k = 1; k < punkter.length; k++) {
    lengde += Math.hypot(punkter[k][0] - punkter[k - 1][0], punkter[k][1] - punkter[k - 1][1])
  }
  const areal = antall * pw * ph
  if (lengde < minLengdeM || lengde * lengde < 2 * areal) return null
  return { punkter, lengde }
}

class MinHeap {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(k, v) {
    const a = this.a
    a.push([k, v])
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const siste = a.pop()
    if (a.length) {
      a[0] = siste
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

// En polyline [x,z] med punkt og retning etter buelengde.
function polyline(P) {
  const cum = [0]
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
  const L = cum.at(-1)
  const punkt = (s) => {
    const t = Math.min(L, Math.max(0, s))
    let i = 1
    while (i < P.length - 1 && cum[i] < t) i++
    const seg = cum[i] - cum[i - 1] || 1
    const k = (t - cum[i - 1]) / seg
    return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k]
  }
  return { L, punkt }
}

// Glatt en rute med glidende snitt; endepunktene står fast.
function glattRute(P, vindu = 3) {
  return P.map((p, i) => {
    if (i === 0 || i === P.length - 1) return p
    const v = Math.min(vindu, i, P.length - 1 - i)
    let x = 0, z = 0
    for (let j = i - v; j <= i + v; j++) { x += P[j][0]; z += P[j][1] }
    return [x / (2 * v + 1), z / (2 * v + 1)]
  })
}

/**
 * Sluttposen: høyt over vannet, med blikket tilbake på dykke-ringen. Kameraet
 * står mellom ringen og der turen kom opp, så det aldri står inne i berget
 * man nettopp svømte til.
 */
export function fuglePose({ fra, ring, flateY, land = null, azimut = 0 }) {
  let ux = fra.x - ring.x
  let uz = fra.z - ring.z
  const d = Math.hypot(ux, uz)
  if (d < 1) { ux = -Math.sin(azimut); uz = Math.cos(azimut) } else { ux /= d; uz /= d }
  const D = Math.max(0.8 * d, 150)
  const x = ring.x + ux * D
  const z = ring.z + uz * D
  let y = flateY + 0.6 * D
  if (land) {
    for (let k = 0; k <= 4; k++) y = Math.max(y, land(ring.x + ux * D * (k / 4), ring.z + uz * D * (k / 4)) + 0.25 * D)
  }
  return { pos: [x, y, z], hoyde: -Math.atan2(y - flateY, D), azimut: asimutMot(x, z, ring.x, ring.z) }
}

/**
 * Dykketuren: snu, gli langs bunnen — langs renna når `rute` er gitt, ellers
 * mot veggen `mot` — og stig opp til like under flata med blikket opp. Med
 * `ring` fortsetter turen gjennom flata og ender i fugleperspektiv med blikket
 * tilbake på dykke-ringen. Under vann holder kameraet seg en klaring over
 * bunnen, aldri over flata.
 *
 * @param {{fra:{x:number,y:number,z:number}, mot?:{x:number,z:number}, rute?:number[][],
 *   ring?:{x:number,z:number}, flateY:number, gulv:(x:number,z:number)=>number,
 *   land?:(x:number,z:number)=>number, klaring?:number, redusert?:boolean}} p
 */
export function dykkeTur({ fra, mot = null, rute = null, ring = null, flateY, gulv, land = null, klaring = 6, redusert = false }) {
  const tak = flateY - 3
  let P
  let Q
  if (rute?.length >= 2) {
    P = glattRute([[fra.x, fra.z], ...rute])
    Q = P.at(-1)
  } else {
    const L = Math.hypot(mot.x - fra.x, mot.z - fra.z)
    // Glid til et stykke foran veggen, så den fyller bildet uten å stå i det.
    const foran = Math.min(250, 0.4 * L)
    const t = (s) => (L ? s / L : 0)
    const langs = (s) => [fra.x + (mot.x - fra.x) * t(s), fra.z + (mot.z - fra.z) * t(s)]
    P = [[fra.x, fra.z], langs(Math.max(0, L - foran))]
    Q = langs(Math.max(0, L - foran) + foran * 0.45)
  }
  const bane = polyline(P)
  const slutt = bane.L
  const azVed = (s) => {
    const D = Math.min(80, slutt / 4)
    const a = bane.punkt(s - D)
    const b = bane.punkt(s + D)
    return asimutMot(a[0], a[1], b[0], b[1])
  }
  const azSlutt = slutt < 30 ? asimutMot(fra.x, fra.z, Q[0], Q[1]) : azVed(slutt)
  const azStart = slutt < 30 ? azSlutt : azVed(0)

  const opp = { pos: [Q[0], tak, Q[1]], hoyde: grad(30), azimut: azSlutt, tid: ring ? 3.5 : 4, ease: 'inn-ut', fase: 'stig' }
  const ende = []
  if (ring) {
    const fugl = fuglePose({ fra: { x: Q[0], z: Q[1] }, ring, flateY, land, azimut: azSlutt })
    ende.push(
      { pos: [Q[0], flateY + 6, Q[1]], hoyde: grad(20), azimut: azSlutt, tid: 1.4, ease: 'inn-ut', fase: 'gjennom' },
      { ...fugl, tid: 5, ease: 'inn-ut', fase: 'fugl' },
    )
  }
  if (redusert) return [{ ...(ende.at(-1) ?? opp), tid: 0 }]

  const steg = [{ pos: [fra.x, fra.y, fra.z], hoyde: grad(5), azimut: azStart, tid: 1.2, ease: 'inn-ut', fase: 'snu' }]
  if (slutt < 30) return [...steg, opp, ...ende]
  const n = Math.max(6, Math.min(rute ? 60 : 30, Math.round(slutt / 80)))
  const fart = slutt / Math.max(8, Math.min(rute ? 30 : 18, slutt / 120))
  const yVed = ([x, z]) => Math.min(tak, gulv(x, z) + klaring)
  const ys = []
  for (let i = 1; i <= n; i++) ys.push(yVed(bane.punkt((slutt * i) / n)))
  // Glatt høyden så kameraet ikke rister over hver kurve, men aldri under gulvet.
  const glatt = ys.map((_, i) => {
    let sum = 0, k = 0
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { sum += ys[j]; k++ }
    return Math.max(ys[i], Math.min(tak, sum / k))
  })
  // Første og siste strekk er kvadratiske over dobbel tid: da møter farten
  // ved skjøten nøyaktig den lineære farten i midten, uten rykk.
  const segTid = slutt / n / Math.max(1, fart)
  for (let i = 0; i < n; i++) {
    const s = (slutt * (i + 1)) / n
    const [x, z] = bane.punkt(s)
    const kant = i === 0 ? 'inn-kvad' : i === n - 1 ? 'ut-kvad' : 'lineaer'
    steg.push({
      pos: [x, glatt[i], z], hoyde: grad(8), azimut: rute ? azVed(s) : azSlutt,
      tid: kant === 'lineaer' ? segTid : 2 * segTid, ease: kant, fase: 'glid',
    })
  }
  steg.push(opp, ...ende)
  return steg
}

/** Det dypeste punktet i bunnen: gittercella og SVG-meter. */
export function dypestePunkt(bunn, { cols, transform }) {
  let best = -1
  let dybde = -Infinity
  for (let i = 0; i < bunn.maske.length; i++) {
    if (bunn.maske[i] && bunn.dybde[i] > dybde) { dybde = bunn.dybde[i]; best = i }
  }
  if (best < 0) return null
  const c = best % cols
  const r = (best - c) / cols
  return { c, r, x: c * transform.pixelWidth, y: r * transform.pixelHeight, dybde }
}

/** Ligger SVG-punktet i innsjøen (nærmeste gittercelle i masken)? */
export function iInnsjoen(bunn, { cols, rows, transform }, x, y) {
  const c = Math.round(x / transform.pixelWidth)
  const r = Math.round(y / transform.pixelHeight)
  if (c < 0 || r < 0 || c >= cols || r >= rows) return false
  return !!bunn.maske[r * cols + c]
}

// Nålene som står I innsjøen er navnet på den; dykke-ringen tar plassen deres.
const VANN_NALER = new Set(['vann-navn', 'vann-omrade'])

/** Fjern innsjøens egne vann-nåler. Nåler på alle andre vann blir stående. */
export function utenInnsjoNaler(features, bunn, dem) {
  if (!bunn || !features?.length) return features ?? []
  return features.filter(f => !(VANN_NALER.has(f.kind) && iInnsjoen(bunn, dem, f.x, f.y)))
}

/**
 * Gulvet under vann: den SENKEDE bunnen, ikke det ekte DEM-et. Det ekte har
 * innsjøspeilet flatt, så det vanlige gulvet ville løftet kameraet rett opp
 * gjennom flata i første bilde. Taket er flata selv.
 */
export function undervannsGulv(terrengDem, coords, wx, wz, flateY) {
  const bunn = terrainFloorY(terrengDem, coords, wx, wz, 0)
  const rom = flateY - bunn
  const gulv = bunn + Math.min(8, Math.max(0, rom) * 0.3)
  return Math.min(gulv, flateY - 2)
}

const grad = (g) => (g * Math.PI) / 180

/**
 * Kamerabanen ned. Fire faser: innflyging, gjennom flata, nedstigning, ro på
 * bunnen. Hvert steg er en pose kameraet skal STÅ i når steget er ferdig.
 * Blikket er asimut (fast) og høyde, ikke et blikkpunkt — et blikkpunkt som
 * passerer gjennom kameraet når blikket snur fra ned til opp, gir et kast.
 *
 * @param {{x:number, z:number, flateY:number, bunnY:number, redusert?:boolean}} p
 *   bunnY er world-Y der kameraet skal ende (gulvet over det dypeste punktet).
 */
export function dykkSekvens({ x, z, flateY, bunnY, redusert = false }) {
  if (redusert) return [{ pos: [x, bunnY, z], hoyde: grad(55), tid: 0, fase: 'bunn' }]
  const dyp = Math.max(1, flateY - bunnY)
  const ned = 1.0 + 0.5 * Math.min(1, dyp / 300)
  return [
    { pos: [x, flateY + 60, z], hoyde: grad(-70), tid: 1.0, ease: 'inn-ut', fase: 'inn' },
    { pos: [x, flateY - Math.min(4, dyp * 0.2), z], hoyde: grad(-70), tid: 0.35, ease: 'lineaer', fase: 'flate' },
    { pos: [x, bunnY, z], hoyde: grad(40), tid: ned, ease: 'inn-ut', fase: 'ned' },
    { pos: [x, bunnY, z], hoyde: grad(55), tid: 0.6, ease: 'ut', fase: 'bunn' },
  ]
}

/** Banen opp igjen: rett opp gjennom flata, så overtar innsjø-innrammingen. */
export function oppSekvens({ x, z, flateY, redusert = false }) {
  if (redusert) return [{ pos: [x, flateY + 60, z], hoyde: grad(-70), tid: 0, fase: 'over' }]
  return [
    { pos: [x, flateY - 2, z], hoyde: grad(70), tid: 1.2, ease: 'inn-ut', fase: 'opp' },
    { pos: [x, flateY + 60, z], hoyde: grad(-60), tid: 0.8, ease: 'ut', fase: 'over' },
  ]
}

/** Dybden i meter (ekte, ikke forsterket) ved kamerahøyde camY. */
export function ekteDybde({ camY, flateY, coords, faktor }) {
  const worldPerMeter = coords.elevToWorldY(1) - coords.elevToWorldY(0)
  return Math.max(0, (flateY - camY) / (worldPerMeter * (faktor || 1)))
}

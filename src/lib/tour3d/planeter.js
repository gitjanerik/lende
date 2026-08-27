// Hvor står planetene — og hvilken av dem kan man faktisk se i kveld.
//
// Ren modul, som astronomi.js: ingen Three.js, ingen DOM, ingen nett.
//
// HVORFOR INGEN API: det finnes flere (JPL Horizons, astronomyapi.com), og de er
// utelukket med vilje. Hele bruksområdet er en natt på fjellet uten dekning, og
// et kart som må ringe hjem for å si hva den lyse prikken er, er ubrukelig
// nettopp der det trengs. Regnestykket er dessuten lite: seks rader med tall og
// en Kepler-løsning.
//
// Elementene er JPL-ens «Approximate Positions of the Major Planets» — middel-
// baneelementer for J2000 med lineære rater per århundre. Nøyaktigheten er
// bueminutter for 1800–2050, altså langt under det en 0,35°-skive kan vise.
// Til sammenlikning er Jupiter selv 0,01° bred sett fra jorda.
//
// RAMMEN: resultatet er J2000, som stjernekatalogen. Det må derfor gjennom
// `presesserTilDato` før det møter en stjernetid, akkurat som stjernene — og i
// motsetning til sola og månen fra astronomi.js, som Meeus' serier gir i
// jevndøgn for datoen. To himmelobjekter i ulike rammer er den ene feilen her
// som ingen test fanger uten at man vet å se etter den.

import {
  norm360, julianskDag, eklipsisTilEkvatorial, solEkvatorial, tilHorisont,
  presesserTilDato, lokalStjernetid,
} from './astronomi.js'

const GRAD = Math.PI / 180

/**
 * [a, e, I, L, ϖ, Ω] og de seks ratene per århundre.
 *   a  halve storakse (AE)      L  middel-lengde (°)
 *   e  eksentrisitet            ϖ  perihelets lengde (°)
 *   I  baneskråning (°)         Ω  knutelinjens lengde (°)
 *
 * Jorda står her fordi vi må trekke posisjonen hennes fra for å komme fra
 * heliosentrisk til geosentrisk. Hun er ikke en «synlig planet».
 */
const ELEMENTER = {
  merkur: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
    0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
    0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  jorda: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
    0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
    -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
}

/**
 * De fem man kan se med øyet, i rekkefølge fra sola. Uranus (5,7 mag) er
 * teoretisk synlig i perfekt mørke, men ingen finner den uten kart og
 * tålmodighet — og et turkart som lover en planet man ikke ser, lyver.
 *
 * `radius` er ekvatorradius i km, `absMag` er H(1,0) til magnitude-formelen, og
 * `farge` er den fargen planeten FAKTISK har for øyet: Mars rustrød, Jupiter
 * blekgul, Saturn gulhvit, Venus og Merkur nesten hvite.
 */
export const PLANETER = [
  { id: 'merkur', navn: 'Merkur', radiusKm: 2439.7, absMag: -0.42, farge: '#cfc6bb' },
  { id: 'venus', navn: 'Venus', radiusKm: 6051.8, absMag: -4.40, farge: '#f6f0dc' },
  { id: 'mars', navn: 'Mars', radiusKm: 3389.5, absMag: -1.52, farge: '#e07a4a' },
  { id: 'jupiter', navn: 'Jupiter', radiusKm: 69911, absMag: -9.40, farge: '#e8dcae' },
  { id: 'saturn', navn: 'Saturn', radiusKm: 58232, absMag: -8.88, farge: '#e6d9a8' },
]

const somId = (p) => (typeof p === 'string' ? p.toLowerCase() : p?.id)

/** Heliosentriske rektangulære ekliptikk-koordinater i AE, J2000-rammen. */
function heliosentrisk(id, t) {
  const e0 = ELEMENTER[id]
  if (!e0) throw new Error(`Ukjent planet: ${id}`)
  const a = e0[0] + e0[6] * t
  const e = e0[1] + e0[7] * t
  const I = (e0[2] + e0[8] * t) * GRAD
  const L = e0[3] + e0[9] * t
  const peri = e0[4] + e0[10] * t
  const knute = e0[5] + e0[11] * t

  // Middel-anomali, brakt til (−180, 180] før Kepler — Newton konvergerer
  // tregt og upresist på en anomali på titusenvis av grader.
  let M = norm360(L - peri)
  if (M > 180) M -= 360
  M *= GRAD

  // Kepler: M = E − e·sin E. Fem runder Newton holder til under et
  // mikroradian for e < 0,21, som er Merkurs og dermed den verste her.
  let E = M
  for (let i = 0; i < 6; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  }

  // I baneplanet, med x mot perihelet.
  const xb = a * (Math.cos(E) - e)
  const yb = a * Math.sqrt(1 - e * e) * Math.sin(E)

  // Roter: argument for perihel, så baneskråning, så knutelinje.
  const w = (peri - knute) * GRAD
  const O = knute * GRAD
  const cw = Math.cos(w); const sw = Math.sin(w)
  const cO = Math.cos(O); const sO = Math.sin(O)
  const cI = Math.cos(I); const sI = Math.sin(I)
  return [
    (cw * cO - sw * sO * cI) * xb + (-sw * cO - cw * sO * cI) * yb,
    (cw * sO + sw * cO * cI) * xb + (-sw * sO + cw * cO * cI) * yb,
    (sw * sI) * xb + (cw * sI) * yb,
  ]
}

/**
 * Fase-leddene i magnituden, fra Astronomical Almanac (samme sett Meeus kap. 41
 * gjengir). Polynom i fasevinkelen α i GRADER.
 *
 * Hvorfor ikke ett lineært ledd for alle: for de ytre planetene er α under 12°
 * og lineært holder fint, men Venus går fra full til tynn sigd og tilbake. Med
 * et lineært ledd kom Venus ut på −5,9 der virkeligheten er −4,9 — altså en hel
 * magnitude for lys, og «lyseste på himmelen» ble en påstand vi ikke kunne
 * innfri. Kvadrat- og kubikk-leddene er det som fanger sigden.
 */
const FASE_LEDD = {
  merkur: [0.0380, -0.000273, 0.000002],
  venus: [0.0009, 0.000239, -0.00000065],
  mars: [0.016, 0, 0],
  jupiter: [0.005, 0, 0],
  saturn: [0.044, 0, 0],
}

/**
 * Tilnærmet visuell magnitude. ±0,3 mag, som er godt nok til å skille «det
 * klart lyseste på himmelen» fra «en middels stjerne» — og det er hele
 * spørsmålet brukeren stiller.
 *
 * Saturn er den svakeste: ringenes helling endrer lysstyrken med ±0,5 mag
 * gjennom et 29-års-omløp, og det modellerer vi ikke. Ringene er dessuten
 * usynlige for øyet, så tallet er riktig for det man SER, med det slingringsrommet.
 */
function magnitude(id, absMag, r, delta, faseVinkelGrader) {
  const grunn = absMag + 5 * Math.log10(r * delta)
  const [c1, c2, c3] = FASE_LEDD[id] ?? [0, 0, 0]
  // Polynomene er tilpasset α opp til ~170°; forbi det står planeten i
  // konjunksjon og er uansett filtrert bort av MIN_ELONGASJON.
  const a = Math.min(faseVinkelGrader, 170)
  return grunn + c1 * a + c2 * a * a + c3 * a * a * a
}

/**
 * Én planet, geosentrisk.
 *
 * @param {string|{id:string}} planet
 * @param {Date} [dato]
 * @returns {{id:string, navn:string, ra:number, dek:number, avstandAE:number,
 *            solavstandAE:number, elongasjon:number, faseVinkel:number,
 *            lysAndel:number, mag:number, farge:string, vinkelGrader:number}}
 *   ra i TIMER og dek i grader, i J2000-rammen. elongasjon og faseVinkel i
 *   grader. vinkelGrader er planetens virkelige vinkeldiameter.
 */
export function planetPosisjon(planet, dato = new Date()) {
  const id = somId(planet)
  const meta = PLANETER.find((p) => p.id === id)
    ?? { id, navn: id, radiusKm: 1, absMag: 0, farge: '#ffffff' }
  const t = (julianskDag(dato) - 2451545) / 36525
  const p = heliosentrisk(id, t)
  const j = heliosentrisk('jorda', t)
  const x = p[0] - j[0]; const y = p[1] - j[1]; const z = p[2] - j[2]

  const lambda = norm360(Math.atan2(y, x) / GRAD)
  const beta = Math.atan2(z, Math.hypot(x, y)) / GRAD
  const delta = Math.hypot(x, y, z)              // jord–planet, AE
  const r = Math.hypot(p[0], p[1], p[2])         // sol–planet, AE
  const R = Math.hypot(j[0], j[1], j[2])         // sol–jord, AE

  // Ekliptikkens skjevhet trengs for ra/dek; vi bruker samme kilde som resten.
  const sol = solEkvatorial(dato)
  const eps = 23.439291 - 0.0130042 * t
  const { ra, dek } = eklipsisTilEkvatorial(lambda, beta, eps)

  // Elongasjon: vinkelen sol–jord–planet, altså hvor langt fra sola den står.
  let elongasjon = Math.abs(lambda - sol.lambda)
  if (elongasjon > 180) elongasjon = 360 - elongasjon

  // Fasevinkelen sol–planet–jord, av cosinussetningen i den samme trekanten.
  const cosFase = (r * r + delta * delta - R * R) / (2 * r * delta)
  const faseVinkel = Math.acos(Math.max(-1, Math.min(1, cosFase))) / GRAD
  const lysAndel = (1 + Math.cos(faseVinkel * GRAD)) / 2

  return {
    id,
    navn: meta.navn,
    ra,
    dek,
    avstandAE: delta,
    solavstandAE: r,
    elongasjon,
    faseVinkel,
    lysAndel,
    farge: meta.farge,
    mag: magnitude(id, meta.absMag, r, delta, faseVinkel),
    // Virkelig vinkeldiameter. 1 AE = 149 597 871 km.
    vinkelGrader: (2 * meta.radiusKm / (delta * 149597870.7)) / GRAD,
  }
}

/**
 * Hvor nær sola en planet kan stå og fortsatt være å se. Under dette drukner
 * den i skumringen uansett hvor høyt på himmelen den står — og en liste som
 * lover noe man ikke kan se er verre enn en kort liste.
 */
export const MIN_ELONGASJON = 12

/** Under dette står den så lavt at terreng og horisontdis tar den. */
export const MIN_HOYDE_GRADER = 1

/**
 * Planetene man faktisk kan se herfra, nå — over horisonten og langt nok fra
 * sola. Sortert lysest først, som er rekkefølgen man legger merke til dem i.
 *
 * Koordinatene er presessert til datoen, så de kan brukes rett sammen med
 * stjernehimmelen.
 *
 * @param {{lat:number, lon:number, dato?: Date}} sted
 */
export function synligePlaneter({ lat, lon, dato = new Date() }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const lst = lokalStjernetid(dato, lon)
  const ut = []
  for (const meta of PLANETER) {
    const p = planetPosisjon(meta, dato)
    if (p.elongasjon < MIN_ELONGASJON) continue
    const j = presesserTilDato(p.ra, p.dek, dato)
    const { azimut, hoyde } = tilHorisont(j.ra, j.dek, lst, lat)
    if (hoyde / GRAD < MIN_HOYDE_GRADER) continue
    ut.push({ ...p, ra: j.ra, dek: j.dek, azimut, hoyde })
  }
  return ut.sort((a, b) => a.mag - b.mag)
}

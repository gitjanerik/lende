// Hvor står sola, månen og stjernene — og hvilken vei er månen skåret.
//
// Ren modul: ingen Three.js, ingen DOM, ingen nett. Samme begrunnelse som
// vaerHimmel.js — hele feilrisikoen i en astronomisk himmel ligger i
// regnestykket, og et regnestykke skal kunne testes offline. skyDome tar imot
// resultatet og gjør bare det den blir fortalt.
//
// Formlene er Meeus' «Astronomical Algorithms», i de korte variantene:
// sola fra kap. 25, månen fra kap. 47 med de største periodiske leddene, fasen
// fra kap. 48. Nøyaktigheten er godt under 0,1° for sola og noen bueminutter
// for månen. Det er langt bedre enn en himmel på en telefonskjerm kan avsløre,
// og formlene er korte nok til å leses.
//
// VIKTIG: dette styrer NATTHIMMELEN, ikke lyssettingen. Sol-retningen som
// skyggelegger skyene og terrenget er LÅST til hillshade-azimuten som er bakt
// inn i karteksturen (se puffSkyer.solRetning og CLAUDE.md, v5.22.1) — en
// astronomisk riktig sol der ville satt skyene og fjellene i utakt med et
// kartbilde vi ikke kan lyssette på nytt.

const GRAD = Math.PI / 180
const rad = (g) => g * GRAD
const sin = (g) => Math.sin(rad(g))
const cos = (g) => Math.cos(rad(g))
/** Normaliser grader til [0, 360). */
export const norm360 = (g) => ((g % 360) + 360) % 360
/** Normaliser radianer til (−π, π]. */
export const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a))

/** Astronomisk juliansk dag (UTC). */
export function julianskDag(dato) {
  return dato.getTime() / 86400000 + 2440587.5
}

/** Århundrer siden J2000.0 — argumentet alle seriene under bruker. */
const T = (jd) => (jd - 2451545) / 36525

/**
 * Greenwich middel-stjernetid i GRADER. Den kontinuerlige formen (Meeus 12.4),
 * så den ikke trenger «JD ved 0h UT» som eget mellomsteg.
 */
export function gmst(dato) {
  const jd = julianskDag(dato)
  const t = T(jd)
  return norm360(
    280.46061837 + 360.98564736629 * (jd - 2451545)
    + 0.000387933 * t * t - (t * t * t) / 38710000,
  )
}

/** Lokal stjernetid i grader. `lon` er østlig positiv, som i WGS84. */
export function lokalStjernetid(dato, lon) {
  return norm360(gmst(dato) + lon)
}

/** Ekliptikkens skjevhet i grader, med nutasjonsleddet. */
function skjevhet(t) {
  const omega = 125.04 - 1934.136 * t
  return 23.439291 - 0.0130042 * t - 1.64e-7 * t * t + 5.04e-7 * t * t * t
    + 0.00256 * cos(omega)
}

/** Ekliptiske koordinater (grader) → ekvatoriale. ra i TIMER, dek i grader. */
export function eklipsisTilEkvatorial(lambda, beta, eps) {
  const ra = Math.atan2(
    cos(eps) * sin(lambda) - Math.tan(rad(beta)) * sin(eps),
    cos(lambda),
  )
  const dek = Math.asin(sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lambda))
  return { ra: norm360(ra / GRAD) / 15, dek: dek / GRAD }
}

/**
 * Sola: rektascensjon (timer), deklinasjon (grader) og avstand (km).
 * Avstanden trengs bare til månefasen.
 */
export function solEkvatorial(dato) {
  const t = T(julianskDag(dato))
  const L0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
  const M = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t
  const C = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(M)
    + (0.019993 - 0.000101 * t) * sin(2 * M)
    + 0.000289 * sin(3 * M)
  const sann = L0 + C
  const v = M + C
  // Radiusvektor i astronomiske enheter (Meeus 25.5).
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(v))
  const omega = 125.04 - 1934.136 * t
  const lambda = sann - 0.00569 - 0.00478 * sin(omega)
  const eps = skjevhet(t)
  return {
    ...eklipsisTilEkvatorial(lambda, 0, eps),
    avstandKm: R * 149597870.7,
    lambda: norm360(lambda),
  }
}

// Månens argumenter (Meeus 47.1–47.6), grader.
function maneArgumenter(t) {
  return {
    // Middel-lengde
    Lp: 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t
      + (t ** 3) / 538841 - (t ** 4) / 65194000,
    // Middel-elongasjon fra sola
    D: 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t
      + (t ** 3) / 545868 - (t ** 4) / 113065000,
    // Solas middel-anomali
    M: 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + (t ** 3) / 24490000,
    // Månens middel-anomali
    Mp: 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t
      + (t ** 3) / 69699 - (t ** 4) / 14712000,
    // Argument for breddegrad
    F: 93.2720950 + 483202.0175233 * t - 0.0036539 * t * t
      - (t ** 3) / 3526000 + (t ** 4) / 863310000,
    // Jordbanens eksentrisitet demper leddene som inneholder solas anomali
    E: 1 - 0.002516 * t - 0.0000074 * t * t,
  }
}

// Ledd: [koeffisient, D, M, M', F]. Bare de største — nok til noen
// bueminutter, som er under det en 1,6°-skive kan vise.
const LENGDE_LEDD = [
  [6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0],
  [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2],
  [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0],
  [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
  [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2],
  [10980, 0, 0, 1, -2], [10675, 4, 0, -1, 0], [10034, 0, 0, 3, 0],
  [8548, 4, 0, -2, 0], [-7888, 2, 1, -1, 0], [-6766, 2, 1, 0, 0],
  [-5163, 1, 0, -1, 0], [4987, 1, 1, 0, 0], [4036, 2, -1, 1, 0],
  [3994, 2, 0, 2, 0], [3861, 4, 0, 0, 0], [3665, 2, 0, -3, 0],
  [-2689, 0, 1, -2, 0], [-2602, 2, 0, -1, 2], [2390, 2, -1, -2, 0],
  [-2348, 1, 0, 1, 0], [2236, 2, -2, 0, 0], [-2120, 0, 1, 2, 0],
  [-2069, 0, 2, 0, 0], [2048, 2, -2, -1, 0], [-1773, 2, 0, 1, -2],
  [-1595, 2, 0, 0, 2], [1215, 4, -1, -1, 0], [-1110, 0, 0, 2, 2],
]

const AVSTAND_LEDD = [
  [-20905355, 0, 0, 1, 0], [-3699111, 2, 0, -1, 0], [-2955968, 2, 0, 0, 0],
  [-569925, 0, 0, 2, 0], [48888, 0, 1, 0, 0], [-3149, 0, 0, 0, 2],
  [246158, 2, 0, -2, 0], [-152138, 2, -1, -1, 0], [-170733, 2, 0, 1, 0],
  [-204586, 2, -1, 0, 0], [-129620, 0, 1, -1, 0], [108743, 1, 0, 0, 0],
  [104755, 0, 1, 1, 0], [10321, 2, 0, 0, -2], [79661, 0, 0, 1, -2],
  [-34782, 4, 0, -1, 0], [-23210, 0, 0, 3, 0], [-21636, 4, 0, -2, 0],
  [24208, 2, 1, -1, 0], [30824, 2, 1, 0, 0], [-8379, 1, 0, -1, 0],
  [-16675, 1, 1, 0, 0], [-12831, 2, -1, 1, 0], [-10445, 2, 0, 2, 0],
  [-11650, 4, 0, 0, 0], [14403, 2, 0, -3, 0], [-7003, 0, 1, -2, 0],
  [10056, 2, -1, -2, 0], [6322, 1, 0, 1, 0], [-9884, 2, -2, 0, 0],
]

const BREDDE_LEDD = [
  [5128122, 0, 0, 0, 1], [280602, 0, 0, 1, 1], [277693, 0, 0, 1, -1],
  [173237, 2, 0, 0, -1], [55413, 2, 0, -1, 1], [46271, 2, 0, -1, -1],
  [32573, 2, 0, 0, 1], [17198, 0, 0, 2, 1], [9266, 2, 0, 1, -1],
  [8822, 0, 0, 2, -1], [8216, 2, -1, 0, -1], [4324, 2, 0, -2, -1],
  [4200, 2, 0, 1, 1], [-3359, 2, 1, 0, -1], [2463, 2, -1, -1, 1],
  [2211, 2, -1, 0, 1], [2065, 2, -1, -1, -1], [-1870, 0, 1, -1, -1],
  [1828, 4, 0, -1, -1], [-1794, 0, 1, 0, 1], [-1749, 0, 0, 0, 3],
  [-1565, 0, 1, -1, 1], [-1491, 1, 0, 0, 1], [-1475, 0, 1, 1, 1],
  [-1410, 0, 1, 1, -1], [-1344, 0, 1, 0, -1], [-1335, 1, 0, 0, -1],
  [1107, 0, 0, 3, 1], [1021, 4, 0, 0, -1], [833, 4, 0, -1, 1],
]

function serie(ledd, a, funk) {
  let sum = 0
  for (const [k, d, m, mp, f] of ledd) {
    const arg = d * a.D + m * a.M + mp * a.Mp + f * a.F
    // Leddene som inneholder solas anomali dempes av jordbanens eksentrisitet.
    const e = Math.abs(m) === 1 ? a.E : Math.abs(m) === 2 ? a.E * a.E : 1
    sum += k * e * funk(arg)
  }
  return sum
}

/**
 * Månen: rektascensjon (timer), deklinasjon (grader), avstand (km) og
 * ekliptiske koordinater (grader).
 */
export function maneEkvatorial(dato) {
  const t = T(julianskDag(dato))
  const a = maneArgumenter(t)
  const lambda = a.Lp + serie(LENGDE_LEDD, a, sin) / 1e6
  const beta = serie(BREDDE_LEDD, a, sin) / 1e6
  const avstandKm = 385000.56 + serie(AVSTAND_LEDD, a, cos) / 1000
  const eps = skjevhet(t)
  // Lengda normaliseres: seriene gir titusener av grader etter tusen år, og en
  // rå lambda på −36 946° er riktig i en cosinus men et minefelt for enhver
  // kaller som sammenlikner to av dem.
  return {
    ...eklipsisTilEkvatorial(lambda, beta, eps),
    avstandKm,
    lambda: norm360(lambda),
    beta,
  }
}

/**
 * Månefasen (Meeus kap. 48).
 *
 * @returns {{lysAndel:number, faseVinkel:number, lyssideVinkel:number, voksende:boolean}}
 *   lysAndel      0 = nymåne, 1 = fullmåne
 *   faseVinkel    fasevinkelen i radianer (0 = full, π = ny)
 *   lyssideVinkel posisjonsvinkelen til den LYSE randen, radianer, målt fra
 *                 himmelens nordpol mot øst. Den sier hvilken VEI månen er
 *                 skåret; uten den ville en halvmåne pekt tilfeldig.
 *   voksende      månen er øst for sola, altså på vei mot fullmåne
 */
export function maneFase(dato) {
  const s = solEkvatorial(dato)
  const m = maneEkvatorial(dato)
  const dRa = rad((s.ra - m.ra) * 15)
  const ds = rad(s.dek)
  const dm = rad(m.dek)
  // Geosentrisk elongasjon måne–sol.
  const cosPsi = Math.sin(ds) * Math.sin(dm) + Math.cos(ds) * Math.cos(dm) * Math.cos(dRa)
  const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)))
  // Fasevinkelen: vinkelen sol–måne–jord.
  const faseVinkel = Math.atan2(
    s.avstandKm * Math.sin(psi),
    m.avstandKm - s.avstandKm * Math.cos(psi),
  )
  const lysAndel = (1 + Math.cos(faseVinkel)) / 2
  const lyssideVinkel = Math.atan2(
    Math.cos(ds) * Math.sin(dRa),
    Math.sin(ds) * Math.cos(dm) - Math.cos(ds) * Math.sin(dm) * Math.cos(dRa),
  )
  // Voksende måne står ØST for sola, altså høyere rektascensjon.
  const dLambda = norm360(m.lambda - s.lambda)
  return { lysAndel, faseVinkel, lyssideVinkel, voksende: dLambda < 180 }
}

/**
 * Ekvatorialt → horisont. `lst` er lokal stjernetid i grader.
 *
 * @returns {{azimut:number, hoyde:number}} radianer. Azimut måles fra NORD mot
 *   ØST (0 = nord, π/2 = øst) — samme konvensjon som kompasskurs i resten av
 *   appen. hoyde er over horisonten; negativ betyr under.
 */
export function tilHorisont(raTimer, dekGrader, lst, latGrader) {
  const H = rad(norm360(lst - raTimer * 15))
  const d = rad(dekGrader)
  const f = rad(latGrader)
  const hoyde = Math.asin(
    Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H),
  )
  const azimut = Math.atan2(
    -Math.cos(d) * Math.sin(H),
    Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.cos(H) * Math.sin(f),
  )
  return { azimut: (azimut + 2 * Math.PI) % (2 * Math.PI), hoyde }
}

/**
 * Den parallaktiske vinkelen: hvor mye himmelens nordpol står dreid fra
 * ZENITH sett fra bakken. Månens lyssideVinkel er målt fra nordpolen, men på
 * skjermen er «opp» zenith — uten dette ville halvmånen stått rett når den er i
 * sør og feil overalt ellers.
 *
 * @returns {number} radianer
 */
export function parallaktiskVinkel(raTimer, dekGrader, lst, latGrader) {
  const H = rad(norm360(lst - raTimer * 15))
  const d = rad(dekGrader)
  const f = rad(latGrader)
  return Math.atan2(
    Math.sin(H),
    Math.tan(f) * Math.cos(d) - Math.sin(d) * Math.cos(H),
  )
}

/**
 * Horisontkoordinater → scenens world-rom.
 *
 * Scenen har NORD = −Z, ØST = +X og OPP = +Y (se coords.js). Det er den samme
 * orienteringen sol-retningen i puffSkyer bygger på, og den må stemme her — en
 * himmel speilvendt om nord–sør-aksen ser helt riktig ut til noen kjenner igjen
 * Karlsvogna.
 */
export function horisontTilWorld(azimut, hoyde, radius) {
  const r = Math.cos(hoyde) * radius
  return [Math.sin(azimut) * r, Math.sin(hoyde) * radius, -Math.cos(azimut) * r]
}

/**
 * Alt natthimmelen trenger for ETT sted og tidspunkt, i ett kall.
 *
 * @param {{lat:number, lon:number, dato?: Date}} sted
 * @returns {{lst:number, lat:number,
 *            mane: {azimut:number, hoyde:number, lysAndel:number,
 *                   lyssideVinkel:number, voksende:boolean},
 *            sol: {azimut:number, hoyde:number}}}
 */
export function himmelFor({ lat, lon, dato = new Date() }) {
  const lst = lokalStjernetid(dato, lon)
  const m = maneEkvatorial(dato)
  const s = solEkvatorial(dato)
  const fase = maneFase(dato)
  const mh = tilHorisont(m.ra, m.dek, lst, lat)
  const sh = tilHorisont(s.ra, s.dek, lst, lat)
  return {
    lst,
    lat,
    mane: {
      ...mh,
      lysAndel: fase.lysAndel,
      voksende: fase.voksende,
      // Lyssida dreid fra ZENITH i stedet for fra nordpolen, som er det
      // skjermen faktisk viser.
      lyssideVinkel: wrapPi(fase.lyssideVinkel - parallaktiskVinkel(m.ra, m.dek, lst, lat)),
    },
    sol: sh,
  }
}

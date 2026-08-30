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
 *
 * Resultatet er i MIDDELJEVNDØGN FOR DATOEN, ikke J2000 — L0-serien bærer
 * presesjonen selv. Kjør det aldri gjennom `presesserTilDato`.
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
 *
 * Som sola: MIDDELJEVNDØGN FOR DATOEN. Ikke gjennom `presesserTilDato`.
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
 * Presesjon: flytt J2000-koordinater til middeljevndøgn for DATOEN.
 *
 * Hvorfor dette må gjøres, og hvorfor det ikke ble gjort i v5.27.0: stjernene i
 * katalogen står i J2000, mens `lokalStjernetid` gjelder i kveld. Blander man
 * dem, mangler man all presesjon siden 2000 — målt til 16 bueminutter i snitt og
 * 22′ på det verste i 2026. Det er en halv fullmånebredde: usynlig på en
 * telefon, men galt, og femten linjer å rette.
 *
 * FELLA, og den er verdt å lese to ganger: dette gjelder KATALOG-koordinater
 * (stjernene) og planetene, som kommer ut av JPL-elementer i J2000-rammen.
 * `solEkvatorial` og `maneEkvatorial` skal IKKE gjennom her — Meeus' serier gir
 * dem allerede i middeljevndøgn for datoen. To himmelobjekter i ulike rammer er
 * en feil ingen test fanger uten at man vet å se etter den; derfor står den her
 * og i JSDoc-en på de to andre.
 *
 * Formen er den rigorøse (Meeus 21.3) og ikke tilnærmingen, fordi tilnærmingen
 * bryter sammen nær polene — og Polstjerna er den ene stjerna alle sjekker.
 *
 * @param {number} raTimer  rektascensjon i timer, J2000
 * @param {number} dekGrader deklinasjon i grader, J2000
 * @param {Date} dato
 * @returns {{ra: number, dek: number}} samme enheter, jevndøgn for datoen
 */
export function presesserTilDato(raTimer, dekGrader, dato) {
  const t = T(julianskDag(dato))
  if (t === 0) return { ra: raTimer, dek: dekGrader }
  const buesek = 1 / 3600
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) * buesek
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) * buesek
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) * buesek
  const ra0 = raTimer * 15 + zeta
  const A = cos(dekGrader) * sin(ra0)
  const B = cos(theta) * cos(dekGrader) * cos(ra0) - sin(theta) * sin(dekGrader)
  const C = sin(theta) * cos(dekGrader) * cos(ra0) + cos(theta) * sin(dekGrader)
  return {
    ra: norm360(Math.atan2(A, B) / GRAD + z) / 15,
    dek: Math.asin(Math.max(-1, Math.min(1, C))) / GRAD,
  }
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
 * Solas offisielle høyde ved soloppgang og solnedgang: −0°50′ (Meeus kap. 15,
 * «standard altitude» h0). Tallet er ikke null fordi det er sola sin ØVRE RAND
 * som skal berøre horisonten (−16′) og fordi atmosfæren løfter bildet av sola
 * (−34′ refraksjon). Det er samme definisjon MET og Yr bruker for tidene sine,
 * så «sola er nede» betyr her det samme som i tabellen deres.
 */
export const SOL_HOYDE_SOLNEDGANG = rad(-50 / 60)

/**
 * Er det natt her og nå — offisielt?
 *
 * HVORFOR REGNET LOKALT OG IKKE HENTET FRA METs Sunrise-API: hele bruksområdet
 * for det som henger på svaret er en kveld ute uten dekning. Et oppslag som
 * feiler på fjellet ville gjort valget tilfeldig nettopp der det betyr noe. Og
 * vi trenger ikke tidene — vi trenger solas høyde NÅ, som er det tidene er
 * regnet ut FRA, og den har vi allerede (`solEkvatorial` + `tilHorisont`).
 *
 * MERK at dette er soloppgang/solnedgang og ikke skumring: rett etter
 * solnedgang er himmelen fortsatt lys, og de første stjernene kommer ved
 * borgerlig skumring (−6°) og utover. Grensa her er den offisielle, som er den
 * som ble bestilt.
 *
 * @param {{lat:number, lon:number, dato?: Date}} sted
 * @returns {boolean|null} null når stedet ikke er brukbart
 */
export function erNatt({ lat, lon, dato = new Date() }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    const lst = lokalStjernetid(dato, lon)
    const s = solEkvatorial(dato)
    return tilHorisont(s.ra, s.dek, lst, lat).hoyde < SOL_HOYDE_SOLNEDGANG
  } catch {
    return null
  }
}

/**
 * Solas høyde over horisonten på et gitt tidspunkt, i radianer. Intern hjelper
 * for `solTider` — den kaller den noen hundre ganger, og da skal den være billig.
 */
function solHoydeVed(lat, lon, ms) {
  const d = new Date(ms)
  const s = solEkvatorial(d)
  return tilHorisont(s.ra, s.dek, lokalStjernetid(d, lon), lat).hoyde
}

/**
 * Når står sola opp og ned der kartet ligger?
 *
 * HVORFOR REGNET LOKALT OG IKKE HENTET FRA METs Sunrise-API — samme svar som for
 * `erNatt`, og det er en sterkere begrunnelse her enn der: tidene er akkurat det
 * man vil vite på vei ut, altså ofte etter at dekningen tok slutt. Et oppslag som
 * feiler på fjellet er verdiløst nettopp der spørsmålet stilles. Vi har solas
 * posisjon lokalt (Meeus, `solEkvatorial`), og tidene er BARE det tidspunktet den
 * posisjonen krysser en høyde vi allerede har definert.
 *
 * MÅLT MOT YR: Stormoen i Drammen 30. august 2026 gir opp 06:10 og ned 20:28 hos
 * Yr, og de samme tallene her. Det er ankeret i testen — se solTider.test.js.
 *
 * METODEN er å SØKE og ikke å løse likningen. Den lukkede formelen (Meeus 15.1)
 * antar at solas deklinasjon står stille gjennom dagen, og bryter sammen nær
 * polarsirkelen der den nettopp ikke gjør det. Her samples høyden gjennom døgnet
 * og hvert fortegnsskifte halveres inn. Det koster noen hundre evalueringer —
 * ingenting for et kort som tegnes én gang — og polardøgnet faller ut av seg
 * selv: finnes det ingen kryssing, er sola enten oppe hele døgnet eller nede
 * hele døgnet, og hvilken av delene ser vi på høyden.
 *
 * DØGNET ER DET LOKALE, altså telefonens tidssone. Det er «i dag» for den som
 * står med kartet, og det er sånn Yr og METs tabeller leses.
 *
 * @param {{lat:number, lon:number, dato?: Date, horisont?: number}} sted
 *   horisont  høyden som regnes som oppgang/nedgang. Default er den offisielle
 *             (−0°50′); −6° gir borgerlig skumring, om noen vil ha det senere.
 * @returns {{oppgang: Date|null, nedgang: Date|null,
 *            tilstand: 'normal'|'midnattssol'|'morketid'}|null}
 *   null når stedet ikke er brukbart. `tilstand` er 'normal' straks ETT av
 *   tidspunktene finnes — overgangsdøgnene i nord har bare det ene, og da er det
 *   det ene som er sant.
 */
export function solTider({ lat, lon, dato = new Date(), horisont = SOL_HOYDE_SOLNEDGANG } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    const start = new Date(dato)
    start.setHours(0, 0, 0, 0)
    const t0 = start.getTime()
    const DOGN = 24 * 60 * 60 * 1000
    // 10 minutter mellom prøvene. Sola beveger seg maks ~15°/time i høyde, så et
    // kryss kan ikke gjemme seg mellom to prøver — bortsett fra i et polart
    // grensetilfelle der hele buen over horisonten varer under ti minutter, og
    // der er «sola var nede» det ærligste svaret uansett.
    const STEG = 10 * 60 * 1000
    const n = Math.round(DOGN / STEG)

    // Halvering inn på krysset. 24 runder tar 10 minutter ned til under et
    // sekund, altså langt under minuttet vi viser.
    const finn = (a, b) => {
      let lo = a
      let hi = b
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        if ((solHoydeVed(lat, lon, lo) - horisont) * (solHoydeVed(lat, lon, mid) - horisont) <= 0) hi = mid
        else lo = mid
      }
      return new Date(Math.round((lo + hi) / 2))
    }

    let oppgang = null
    let nedgang = null
    let forrige = solHoydeVed(lat, lon, t0) - horisont
    const start_oppe = forrige > 0
    for (let i = 1; i <= n; i++) {
      const t = t0 + i * STEG
      const naa = solHoydeVed(lat, lon, t) - horisont
      if (forrige <= 0 && naa > 0 && !oppgang) oppgang = finn(t - STEG, t)
      if (forrige > 0 && naa <= 0 && !nedgang) nedgang = finn(t - STEG, t)
      forrige = naa
    }

    if (!oppgang && !nedgang) {
      return {
        oppgang: null,
        nedgang: null,
        tilstand: start_oppe ? 'midnattssol' : 'morketid',
      }
    }
    return { oppgang, nedgang, tilstand: 'normal' }
  } catch {
    return null
  }
}

/**
 * Høyden en TVUNGEN måne løftes til (utvikler-bryter, se himmelFor).
 *
 * 35° er valgt fordi den er godt over horisonten uten å være i zenit: månen skal
 * stå der man ser den når man løfter blikket i nattmodus (som lander på 50°), og
 * en måne rett over hodet er vanskelig å trykke på.
 */
export const MANE_TVANG_HOYDE = rad(35)

/**
 * Alt natthimmelen trenger for ETT sted og tidspunkt, i ett kall.
 *
 * @param {{lat:number, lon:number, dato?: Date}} sted
 * @returns {{lst:number, lat:number,
 *            mane: {azimut:number, hoyde:number, lysAndel:number,
 *                   lyssideVinkel:number, voksende:boolean},
 *            sol: {azimut:number, hoyde:number}}}
 */
/**
 * @param {{lat:number, lon:number, dato?: Date, tvingMane?: boolean}} sted
 *   tvingMane  UTVIKLER-BRYTER: løft månen over horisonten selv når den står
 *              under. Månen er nede store deler av døgnet, og da kan verken
 *              månegloben eller trykk-plukkingen av den prøves — man må vente på
 *              at himmelen stiller seg riktig. Alt annet ved månen er fortsatt
 *              ekte: fase, lysside og azimut. Bare høyden er løftet, og bare når
 *              den var under horisonten — står månen oppe, rører flagget
 *              ingenting.
 *
 *              NAVNET ER PRESIST: dette er MÅNENS halvdel av utvikler-bryteren.
 *              Flagget UI-et setter heter `tvingHimmel` og dekker også planetene
 *              med globe — den halvdelen bor i `planeter.synligePlaneter`, fordi
 *              det er den ENE kilden til hvor planetene står. Én kilde per
 *              legemetype, aldri to som tvinger samme legeme.
 */
export function himmelFor({ lat, lon, dato = new Date(), tvingMane = false }) {
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
      faseVinkel: fase.faseVinkel,
      // Lyssida dreid fra ZENITH i stedet for fra nordpolen, som er det
      // skjermen faktisk viser.
      lyssideVinkel: wrapPi(fase.lyssideVinkel - parallaktiskVinkel(m.ra, m.dek, lst, lat)),
      hoyde: tvingMane && mh.hoyde < MANE_TVANG_HOYDE ? MANE_TVANG_HOYDE : mh.hoyde,
      // Selve dreiningen, tatt med for seg: månegloben må RULLE like mye for at
      // nordpolen på kula skal stå der himmelens nordpol faktisk står. Uten den
      // ville skyggelinja på kula pekt en annen vei enn sigden man nettopp så.
      parallaktisk: parallaktiskVinkel(m.ra, m.dek, lst, lat),
    },
    sol: sh,
  }
}

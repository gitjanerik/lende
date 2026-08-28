// Himmelkompasset: to ringer og en rød prikk som sier hvor du ser.
//
// HVORFOR DET FINNES: i nattmodus er kartet ute av bildet, og da mister man
// himmelretningene. Man kan stå og se på Karlsvogna uten å vite at man ser mot
// nord. Kompasset er den ene tingen som gir orienteringen tilbake uten å tenne
// en lampe på skjermen.
//
// HVORFOR REN MATTE OG SVG, OG IKKE THREE.JS: det er et HUD. En andre scene med
// eget kamera i et hjørne er nøyaktig den gjelden CLAUDE.md advarer sterkest mot
// (to nesten identiske kamera-regimer levde side om side i månedsvis), og en
// gizmo som koster en ekstra render-pass hver frame er dyr for noe som er 70
// piksler stort. Her er alt tall: ringene samples og skrives som polylinjer, og
// hele modulen kan testes uten WebGL.
//
// HVORFOR RINGENE STÅR STILLE OG PRIKKEN FLYTTER SEG: N blir stående på samme
// sted på skjermen. Det gjør kompasset til noe man LESER framfor noe man må
// tolke — «prikken ligger oppe ved N, altså ser jeg nordover». Snurret ringene
// i stedet, ville bokstavene flyttet seg rundt i mørket, og det er vanskeligere
// å lese enn en prikk som beveger seg.
//
// KOORDINATER: øst = +x, nord = +y, opp = +z. Det er IKKE scenens system
// (der er nord = −Z og opp = +Y) — omregningen skjer i scene3d, som eier
// kameraet. Her inne er det det lokale, lesbare systemet.

const GRAD = Math.PI / 180

/**
 * Kameraets stilling for gizmoen. Faste tall, ikke brukerens kamera: ringene
 * skal ses fra samme vinkel hele tida.
 *
 * Azimuten er 158° (fra sørøst-ish) og ikke 180°: står kameraet rett i sør,
 * ligger nord–sør-ringen EDGE-ON og blir en strek. 22° til side gir den en
 * ellipse man ser er en ring. Høyden på 24° gjør det samme for horisontringen —
 * rett fra sida ville også den blitt en strek.
 */
export const KOMPASS_KAMERA = { azimut: 158, hoyde: 24 }

/** Ringradius i SVG-enheter, med senter i (0, 0). Viseren flytter og skalerer. */
export const KOMPASS_RADIUS = 34

/** Punkter per ring. 48 er glatt på 70 piksler og koster ingenting. */
const RING_PUNKTER = 48

const kryss = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const lengde = (a) => Math.hypot(a[0], a[1], a[2])
const normaliser = (a) => {
  const l = lengde(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * Retningsvektor for en himmelretning og en høyde over horisonten.
 *
 * @param {number} azimutGrader 0 = nord, 90 = øst
 * @param {number} hoydeGrader over horisonten
 * @returns {[number, number, number]} [øst, nord, opp]
 */
export function retning(azimutGrader, hoydeGrader) {
  const a = azimutGrader * GRAD
  const h = hoydeGrader * GRAD
  return [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)]
}

/**
 * Kameraets basis: blikkretning, skjerm-høyre og skjerm-opp.
 *
 * Kameraet står i retningen (azimut, hoyde) og ser MOT origo. Høyre finnes som
 * f × opp — sjekk med et konkret tilfelle om du er i tvil: står kameraet rett i
 * sør og ser nordover, skal høyre bli øst.
 */
export function kompassBasis({ azimut, hoyde } = KOMPASS_KAMERA) {
  const c = retning(azimut, hoyde)
  const f = [-c[0], -c[1], -c[2]]
  const h = normaliser(kryss(f, [0, 0, 1]))
  return { f, hoyre: h, opp: kryss(h, f) }
}

/**
 * Ortografisk projeksjon til SVG-koordinater. Ortografisk og ikke perspektiv
 * med vilje: en gizmo på 70 piksler har ingen dybde å vise, og perspektiv ville
 * bare gjort de to ringene ulikt store uten å si noe.
 *
 * SVG har y NEDOVER, så skjerm-opp får motsatt fortegn.
 *
 * @returns {{x: number, y: number, bak: boolean}} bak = på motsatt side av kula
 */
export function projiser(p, basis = kompassBasis(), radius = KOMPASS_RADIUS) {
  return {
    x: punkt(p, basis.hoyre) * radius,
    y: -punkt(p, basis.opp) * radius,
    bak: punkt(p, basis.f) > 0,
  }
}

/** Sampler en enhetsring og gir SVG-path. `plan` gir de to aksene ringen spenner. */
function ringPath(akse1, akse2, basis, radius) {
  let d = ''
  for (let i = 0; i <= RING_PUNKTER; i++) {
    const t = (i / RING_PUNKTER) * Math.PI * 2
    const p = [
      akse1[0] * Math.cos(t) + akse2[0] * Math.sin(t),
      akse1[1] * Math.cos(t) + akse2[1] * Math.sin(t),
      akse1[2] * Math.cos(t) + akse2[2] * Math.sin(t),
    ]
    const s = projiser(p, basis, radius)
    d += `${i === 0 ? 'M' : 'L'}${s.x.toFixed(2)},${s.y.toFixed(2)}`
  }
  return `${d}Z`
}

/**
 * Alt viseren trenger for å tegne kompasset.
 *
 * @param {{azimut: number, hoyde: number}} blikk hvor brukeren ser, i GRADER
 * @param {{kamera?: object, radius?: number}} [opts]
 * @returns {{horisont: string, meridian: string, ostVest: object,
 *            merker: Array<object>, prikk: object}}
 */
export function kompassGeometri(blikk, { kamera = KOMPASS_KAMERA, radius = KOMPASS_RADIUS } = {}) {
  const basis = kompassBasis(kamera)
  const ost = [1, 0, 0]
  const nord = [0, 1, 0]
  const opp = [0, 0, 1]

  // Horisontringen ligger i jordas plan (øst–nord). Meridianringen står loddrett
  // gjennom nord og zenit — det er den som bærer N og S.
  const horisont = ringPath(ost, nord, basis, radius)
  const meridian = ringPath(nord, opp, basis, radius)

  // Øst–vest-aksen: en strek tvers over den flate skiva, som brukeren ba om.
  // Bokstaver bare på N og S; fire bokstaver på 70 piksler blir grøt i mørket.
  const o = projiser(ost, basis, radius)
  const v = projiser([-1, 0, 0], basis, radius)

  const merker = [
    { navn: 'N', ...projiser(nord, basis, radius * 1.3) },
    { navn: 'S', ...projiser([0, -1, 0], basis, radius * 1.3) },
  ]

  const b = retning(blikk?.azimut ?? 0, blikk?.hoyde ?? 0)
  const prikk = projiser(b, basis, radius)

  return {
    horisont,
    meridian,
    ostVest: { x1: o.x, y1: o.y, x2: v.x, y2: v.y },
    merker,
    prikk,
  }
}

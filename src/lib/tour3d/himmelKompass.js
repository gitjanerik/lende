// Himmelkompasset: en skive som dreier, og en markør som står stille.
//
// HVORFOR DET FINNES: i nattmodus er kartet ute av bildet, og da mister man
// himmelretningene. Man kan stå og se på Karlsvogna uten å vite at man ser mot
// nord. Kompasset er den ene tingen som gir orienteringen tilbake uten å tenne
// en lampe på skjermen.
//
// FØRSTE UTGAVE (v6.1.0) SNUDDE DET MOTSATTE VEIEN, og det var feil. Da sto
// ringene stille — N alltid samme sted på skjermen — og en rød prikk vandret
// rundt for å si hvor man så. Begrunnelsen var at bokstaver som står stille er
// lettere å lese i mørket. Eieren prøvde den og forsto den ikke, og det er den
// avgjørende observasjonen: en gizmo man må tolke er ingen gizmo.
//
// NÅ FØLGER DEN KONVENSJONEN ALLE KJENNER: markøren står fast øverst og betyr
// «hit ser du», og skiva med N, Ø, S, V dreier under den. Det er slik ethvert
// kart-program og hvert eneste kompass gjør det, og da trenger ingen forklaring.
//
// OG DEN ANDRE RINGEN ER BORTE. Den loddrette meridianringen viste blikkets
// HØYDE, men det var også den som gjorde bildet til en armillarsfære man måtte
// studere. Høyden står i infokortet («45° over horisonten») og er dessuten
// åpenbar av hva man ser. Én ring man forstår slår to man ikke forstår.
//
// HVORFOR REN MATTE OG SVG, OG IKKE THREE.JS: det er et HUD. En andre scene med
// eget kamera i et hjørne er nøyaktig den gjelden CLAUDE.md advarer sterkest mot,
// og en gizmo som koster en ekstra render-pass hver frame er dyr for noe som er
// 70 piksler stort. Her er alt tall, og hele modulen testes uten WebGL.

const GRAD = Math.PI / 180

/**
 * Skivas helling, i grader. 0 ville gitt en strek, 90 en sirkel sett rett
 * ovenfra. 45° gir en ellipse som leses som et plan man ser på skrå — «jordas
 * plan», som var bestillingen — mens bokstavene fortsatt står lesbare.
 */
export const KOMPASS_HELLING = 45

/** Ringradius i SVG-enheter, med senter i (0, 0). Viseren flytter og skalerer. */
export const KOMPASS_RADIUS = 34

/** Hvor langt ut fra ringen bokstavene står. */
const MERKE_RADIUS = 1.32

/** Punkter i ellipsen. 48 er glatt på 70 piksler og koster ingenting. */
const RING_PUNKTER = 48

/** De fire himmelretningene, med NORSKE bokstaver: øst og vest, ikke E og W. */
export const HIMMELRETNINGER = [
  { navn: 'N', azimut: 0 },
  { navn: 'Ø', azimut: 90 },
  { navn: 'S', azimut: 180 },
  { navn: 'V', azimut: 270 },
]

/**
 * Et punkt på skiva, gitt vinkelen fra markøren (toppen) målt med klokka.
 *
 * Toppen av ellipsen er den FJERNE sida — det er den som gjør at skiva leses som
 * et plan man ser på skrå og ikke som en ring rett foran seg.
 *
 * @param {number} vinkelGrader 0 = under markøren, 90 = til høyre
 * @param {number} [radius]
 * @returns {{x: number, y: number, naer: boolean}} naer = på siden mot seeren
 */
export function skivePunkt(vinkelGrader, radius = KOMPASS_RADIUS) {
  const t = vinkelGrader * GRAD
  return {
    x: radius * Math.sin(t),
    // SVG har y NEDOVER, derfor minus: cos(0) = 1 skal bli ØVERST.
    y: -radius * Math.cos(t) * Math.sin(KOMPASS_HELLING * GRAD),
    naer: Math.cos(t) < 0,
  }
}

/**
 * Hvor på skiva en himmelretning står, gitt hvor brukeren ser.
 *
 * REGELEN, og den er hele kompasset: markøren står fast på toppen og betyr
 * blikkretningen. En himmelretning `azimut` havner derfor `azimut − blikk` fra
 * toppen. Ser du nord, står N under markøren; ser du øst, står N til venstre —
 * som det gjør i virkeligheten når du snur deg mot øst.
 *
 * @param {number} azimutGrader himmelretningen (0 = nord)
 * @param {number} blikkGrader hvor brukeren ser
 * @returns {number} grader fra markøren, med klokka
 */
export function vinkelPaaSkiva(azimutGrader, blikkGrader) {
  return (((azimutGrader - blikkGrader) % 360) + 360) % 360
}

/** Ellipsen som SVG-path. Formen er FAST — det er bokstavene som dreier. */
function ringPath(radius) {
  let d = ''
  for (let i = 0; i <= RING_PUNKTER; i++) {
    const p = skivePunkt((i / RING_PUNKTER) * 360, radius)
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
  }
  return `${d}Z`
}

/**
 * Alt viseren trenger for å tegne kompasset.
 *
 * @param {{azimut: number, hoyde: number}} blikk hvor brukeren ser, i GRADER
 * @param {{radius?: number}} [opts]
 * @returns {{ring: string, merker: Array<object>, markor: object,
 *            nordVinkel: number, serNord: boolean}}
 */
export function kompassGeometri(blikk, { radius = KOMPASS_RADIUS } = {}) {
  const b = Number.isFinite(blikk?.azimut) ? blikk.azimut : 0

  const merker = HIMMELRETNINGER.map((r) => {
    const v = vinkelPaaSkiva(r.azimut, b)
    const p = skivePunkt(v, radius * MERKE_RADIUS)
    return {
      navn: r.navn,
      x: p.x,
      y: p.y,
      // Bokstaven på den nære sida står FORAN skiva og skal være tydeligst. Det
      // er den enkleste dybdesignalen som finnes, og den koster ingenting.
      naer: p.naer,
      // Nord får litt mer vekt enn de tre andre: det er den man leter etter.
      erNord: r.azimut === 0,
    }
  })

  // Markøren står fast på toppen av skiva og er blikkretningen. Den flytter seg
  // ALDRI — det er skiva som dreier. En markør som også beveget seg ville gjort
  // kompasset til to bevegelser man må skille fra hverandre.
  const m = skivePunkt(0, radius)
  const nordVinkel = vinkelPaaSkiva(0, b)

  return {
    ring: ringPath(radius),
    merker,
    markor: { x: m.x, y: m.y },
    nordVinkel,
    // Innenfor 8° regner vi det som «ser nord». Da har trykk-for-nord ingenting
    // å gjøre, og knappen kan si det i stedet for å love en bevegelse som ikke
    // kommer.
    serNord: nordVinkel <= 8 || nordVinkel >= 352,
  }
}

/** Himmelretning med ord, i åtte deler. Til aria-label. */
export function retningsNavn(azimutGrader) {
  const navn = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest']
  const i = Math.round(((azimutGrader % 360) + 360) % 360 / 45) % 8
  return navn[i]
}

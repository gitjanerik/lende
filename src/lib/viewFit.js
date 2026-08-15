// Hvor mye zoom skal et kart åpne med?
//
// Fram til v5.19.2 åpnet det på skala 1, som er `preserveAspectRatio="meet"` —
// hele arket får plass, med kremgul letterbox over og under. Det ser ut som et
// ark som svever i tomrom, og det leser som «her slutter verden». Særlig galt nå
// som kartet fyller seg selv mens du panorerer: det som skal avsløres når du
// drar, er MER KART, ikke mer krem.
//
// Derfor åpner vi på DEKNING i stedet: skalér til arket dekker hele viewporten,
// pluss et overskudd som ligger utenfor skjermkanten. Da ligger det alltid kart
// like utenfor det du ser, og panorering føles kontinuerlig fra første frame.
//
// Prisen, sagt tydelig: du ser ikke lenger hele arket ved åpning. Oversikten er
// fortsatt ett trykk unna — «Sentrer»-FAB-en og zoom-ut-gulvet (mosaicMinScale)
// er begge bygget for nettopp å vise hele arket — men den er ikke lenger det
// første du møter.

/** Standard overskudd utenfor viewporten (andel av viewport-størrelsen). */
export const DEKNING_OVERSKUDD = 0.1

/**
 * Skala som får arket til å dekke hele viewporten, med overskudd utenfor.
 *
 * Skala 1 er `meet`-tilpasningen: `fit = min(w/widthM, h/heightM)`. For å DEKKE
 * trenger vi `cover = max(w/widthM, h/heightM)`, og forholdet mellom dem er den
 * skalaen som skal til. Kvadratisk ark i kvadratisk viewport gir 1 — da er meet
 * og cover det samme, og bare overskuddet legges på.
 *
 * @param {{w:number, h:number, widthM:number, heightM:number, overskudd?:number}} v
 * @returns {number} skala ≥ 1, eller 1 når målene ikke er brukbare
 */
export function dekningsSkala({ w, h, widthM, heightM, overskudd = DEKNING_OVERSKUDD } = {}) {
  if (![w, h, widthM, heightM].every(n => Number.isFinite(n) && n > 0)) return 1
  const a = w / widthM
  const b = h / heightM
  const fit = Math.min(a, b)
  const cover = Math.max(a, b)
  if (!(fit > 0)) return 1
  const s = (cover / fit) * (1 + Math.max(0, overskudd))
  // Aldri under 1: et ark som alt dekker viewporten skal ikke zoomes UT herfra.
  return Math.max(1, s)
}

/**
 * snarveier.js — katalogen over turkart-modusens FUNKSJONER, og reglene for
 * hvor mange av dem som får plass på snarvei-raden.
 *
 * SKILLET MELLOM FUNKSJON OG INNSTILLING BOR HER (v6.6.0). Måling, Sporing og
 * Annotering lå som faner i innstillings-skuffen ved siden av Kartlag og
 * Eksport, og det er to helt ulike ting i samme rad: en fane som *stiller inn*
 * kartet, og en fane som *gjør* noe med det. Innstillinger er nå bare det
 * første; alt man GJØR ligger i denne lista, og hver av funksjonene som trenger
 * et panel har fått sin egen skuff.
 *
 * REKKEFØLGEN ER BRUKERENS. Standarden under er en påstand om hva folk bruker
 * mest, ikke en sannhet — og på en smal skjerm er det nettopp rekkefølgen som
 * avgjør hva som havner bak nedtrekket. Derfor kan den sorteres, og derfor er
 * «Sorter snarveier» en FAST knapp i nedtrekket og ikke noe som forsvinner når
 * alt får plass på én linje: en knott ingen vet om er ingen knott.
 *
 * Modulen er REN — ingen DOM, ingen Vue, ingen localStorage-lesing på
 * modulnivå — slik at reglene kan enhetstestes uten en nettleser.
 */

export const SNARVEI_REKKEFOLGE_KEY = 'lende-snarvei-rekkefolge'

// `kunEgne` er samme port som fanene hadde: på de innebygde demokartene
// (Vardåsen) finnes verken egne markeringer eller GPS-spor å vise.
export const SNARVEIER = [
  { id: 'stifinner',  label: 'Stifinner',  aria: 'Stifinner' },
  { id: 'runde',      label: 'Runde',      aria: 'Gå en runde' },
  { id: 'maaling',    label: 'Måling',     aria: 'Måling' },
  { id: 'tre-d',      label: '3D',         aria: 'Se kartet i 3D' },
  { id: 'annotering', label: 'Annotering', aria: 'Annotering', kunEgne: true },
  { id: 'sporing',    label: 'Sporing',    aria: 'Sporing',    kunEgne: true },
  { id: 'info',       label: 'Info',       aria: 'Informasjon om stedet' },
]

export const STANDARD_REKKEFOLGE = SNARVEIER.map(s => s.id)

/**
 * Normaliserer en lagret rekkefølge mot katalogen: ukjente ider droppes (en
 * funksjon kan ha blitt fjernet), og nye legges BAKERST i katalogens egen
 * rekkefølge. Å legge dem først ville flyttet på noe brukeren har sortert.
 */
export function normaliserRekkefolge(lagret) {
  const kjente = new Set(STANDARD_REKKEFOLGE)
  const sett = new Set()
  const ut = []
  for (const id of Array.isArray(lagret) ? lagret : []) {
    if (kjente.has(id) && !sett.has(id)) { ut.push(id); sett.add(id) }
  }
  for (const id of STANDARD_REKKEFOLGE) if (!sett.has(id)) ut.push(id)
  return ut
}

/** Katalog-oppslagene i brukerens rekkefølge, filtrert på kart-typen. */
export function snarveierIRekkefolge(rekkefolge, { egetKart = true } = {}) {
  const kat = new Map(SNARVEIER.map(s => [s.id, s]))
  return normaliserRekkefolge(rekkefolge)
    .map(id => kat.get(id))
    .filter(s => s && (egetKart || !s.kunEgne))
}

/** Flytter ett element fra `fra` til `til`. Utenfor rekkevidde = uendret. */
export function flyttSnarvei(rekkefolge, fra, til) {
  const ut = [...rekkefolge]
  if (fra < 0 || fra >= ut.length || til < 0 || til >= ut.length || fra === til) return ut
  const [el] = ut.splice(fra, 1)
  ut.splice(til, 0, el)
  return ut
}

/**
 * Hvor mange knapper får plass på ÉN linje ved siden av nedtrekks-knappen.
 *
 * Budsjettet er hele radens bredde minus knappen, og gapet betales for hvert
 * mellomrom og ikke per knapp — en av-for-én her er én knapp for mye, altså
 * nøyaktig den overflowen målingen finnes for å unngå. Gulvet er ÉN: en rad
 * uten en eneste synlig funksjon er bare et nedtrekk, og da har raden ingen
 * grunn til å stå der.
 */
export function antallSomFar(bredder, ledigPx, handlePx, gapPx) {
  if (!bredder.length) return 0
  let plass = ledigPx - handlePx - gapPx
  let n = 0
  for (const b of bredder) {
    const kost = n === 0 ? b : b + gapPx
    if (plass < kost) break
    plass -= kost
    n++
  }
  return Math.max(1, n)
}

/**
 * Hvilken plass et drag over sorterings-lista peker på. `sentre` er hvert
 * elements midtpunkt i samme y-rom som `y`. Ren funksjon, fordi den ellers
 * bare kan prøves med en finger.
 */
export function dropIndeks(sentre, y) {
  let i = 0
  while (i < sentre.length && y > sentre[i]) i++
  return Math.max(0, Math.min(sentre.length - 1, i))
}

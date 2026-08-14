// nettGjerde.js — økt-taket for automatisk flisbygging.
//
// Kontinuerlig flis-lasting bygger kart uten at brukeren ber om det, og hver
// flis koster nett (Overpass + Kartverket WCS), tid og lagringsplass. Et tak per
// ØKT er billigere enn en tidsbasert struping: det stopper den ene lange
// panorerings-sesjonen som ellers ville bygd hundre fliser, uten å stå i veien
// for den som kommer tilbake i morgen.

export const AUTO_NABO_OKTTAK = 12
export const OKT_KEY = 'lende-auto-nabo-okt'

// HVORFOR sessionStorage og ikke bare en modulvariabel: `promoteTile` gjør
// `router.replace` når skjermsenteret glir over på en nabo-flis, og det
// unmounter og remounter MapView. En teller i minnet ville dermed nullstilt seg
// selv midt under nettopp den kontinuerlige panoreringen den skal begrense —
// taket ville aldri blitt nådd. sessionStorage overlever både router.replace og
// reload, og dør når fanen lukkes, som er nøyaktig semantikken «denne økta».
const standardLes = (nokkel) => {
  try { return sessionStorage.getItem(nokkel) } catch { return null }
}
const standardSkriv = (nokkel, verdi) => {
  try { sessionStorage.setItem(nokkel, verdi) } catch { /* privat modus — da teller vi bare ikke */ }
}

/**
 * Hvor mange fliser har automatikken bygd i denne økta?
 * Ødelagt eller ikke-numerisk lagerverdi leses som 0, ikke som NaN — en NaN
 * hadde gjort enhver sammenligning mot taket usann og sluppet automatikken løs.
 */
export function lesOktTeller({ lesLager = standardLes } = {}) {
  const n = Number.parseInt(lesLager(OKT_KEY), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function oktTakNadd({ lesLager = standardLes, tak = AUTO_NABO_OKTTAK } = {}) {
  return lesOktTeller({ lesLager }) >= tak
}

/** Tell én bygd flis. Returnerer den nye verdien. */
export function okOkt({ lesLager = standardLes, skrivLager = standardSkriv } = {}) {
  const ny = lesOktTeller({ lesLager }) + 1
  skrivLager(OKT_KEY, String(ny))
  return ny
}

/** Nullstill taket — brukeren har gjort noe eksplisitt som fortjener nytt budsjett. */
export function nullstillOkt({ skrivLager = standardSkriv } = {}) {
  skrivLager(OKT_KEY, '0')
}

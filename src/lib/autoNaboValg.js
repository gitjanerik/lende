// De to brukervalgene som styrer automatisk flis-påfyll.
//
// Egen fil fordi standardverdiene er den slags avgjørelse som fortjener en test:
// de bestemmer hva appen gjør på en enhet som aldri har rørt bryteren, og det er
// nettopp tilfellet ingen tester manuelt. localStorage-lesing injiseres, som i
// nettGjerde.js.

export const PA_KEY = 'lende-auto-nabo'
export const FIRKANT_KEY = 'lende-auto-nabo-firkant'

const standardLes = (nokkel) => {
  try { return localStorage.getItem(nokkel) } catch { return null }
}
const standardSkriv = (nokkel, verdi) => {
  try { localStorage.setItem(nokkel, verdi) } catch { /* privat modus */ }
}

/**
 * Er automatisk henting av nabofliser på?
 *
 * Standard AV. Den var på fram til v5.19.7, med den begrunnelsen at en opt-in
 * aldri ville blitt slått på nok til at vi fikk måletall. Det holdt ikke: eieren
 * trenger å kjøre den kontinuerlige panoreringen side om side med den manuelle,
 * og en automatikk som er på fra første kartåpning gjør at det ikke går an å
 * sammenligne. Er den moden, snus dette tilbake — det er ett tegn i denne fila.
 */
export function lesAutoNaboPa({ lesLager = standardLes } = {}) {
  return lesLager(PA_KEY) === '1'
}

export function skrivAutoNaboPa(pa, { skrivLager = standardSkriv } = {}) {
  skrivLager(PA_KEY, pa ? '1' : '0')
}

/**
 * Skal automatikken fylle ut arket til firkant etter hver utvidelse?
 *
 * Standard PÅ, men den betyr ingenting før automatikken er slått på — og da har
 * brukeren allerede sagt ja til at fliser hentes uten å bli spurt. Da er «gjør
 * det ferdig firkantet» mindre overraskende enn et ark med tomme hjørner som 3D
 * og pan-grensa likevel regner med.
 */
export function lesFirkantPa({ lesLager = standardLes } = {}) {
  return lesLager(FIRKANT_KEY) !== '0'
}

export function skrivFirkantPa(pa, { skrivLager = standardSkriv } = {}) {
  skrivLager(FIRKANT_KEY, pa ? '1' : '0')
}

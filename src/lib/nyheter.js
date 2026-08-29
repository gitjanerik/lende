// Kunngjøringer i hovedmenyen. ÉN oppføring om gangen, med vilje: en kø av
// nyheter er hvordan en app blir et nyhetsbrev. Er en kunngjøring utdatert,
// slettes oppføringen her — den skal ikke arkiveres.
//
// `id` og ikke en boolean i localStorage: et framtidig banner får ny id og
// vises igjen, uten at man må finne på en ny nøkkel hver gang.
export const NYHET_LS_KEY = 'lende-nyhet-sett'

export const NYHET = Object.freeze({
  id: 'fritt-lende-1',
  merke: 'NYTT I 6.5',
  tittel: 'Fritt lende',
  tekst: 'Ett kart, én knapp. 2 × 2 km rundt deg, uten noe annet på skjermen. Krever nett.',
  handling: 'Prøv det',
  til: { name: 'fritt-lende' },
})

export function nyhetSett(id = NYHET.id) {
  try { return localStorage.getItem(NYHET_LS_KEY) === id } catch { return false }
}

export function merkNyhetSett(id = NYHET.id) {
  try { localStorage.setItem(NYHET_LS_KEY, id) } catch { /* noop */ }
}

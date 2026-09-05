// Stjernemerkede kulturminner — brukerens egne markeringer PÅ ETT TURKART.
//
// Merkingene bor i kart-recorden (`entry.stjerneminner`), ikke i et eget
// bibliotek på tvers av kart. Det er en bevisst avgrensning: et kulturminne er
// interessant fordi det ligger på turen man planlegger, og et kart som slettes
// tar merkingene sine med seg. Uten kart-eierskapet ville sletting etterlatt
// foreldreløse rader ingen kan finne igjen, og lista ville trengt sitt eget
// vedlikehold — en hel funksjon til for noe brukeren aldri ba om.
//
// Fila er REN (ingen DOM, ingen IndexedDB) fordi det er reglene her som er lette
// å ta feil av: nøkkelen må skille de to kildene, og en vekslet stjerne må ikke
// kunne legge inn en dublett.

// De to kildene har HVER SIN id-rom, og de kan kollidere: brukerminnene fra
// api.ra.no og de fredede lokalitetene fra Geonorge WFS er begge tall-lignende
// strenger fra Riksantikvaren, men peker på ulike ting. Prefikset er derfor
// ikke pynt — uten det ville en stjerne på et brukerminne kunne dukke opp på et
// arkeologisk minne med samme id.
export const KILDE_BRUKER = 'k'
export const KILDE_FREDET = 'f'

/**
 * Nøkkelen en stjerne lagres under. Returnerer null når id-en mangler — da har
 * vi ingenting stabilt å feste merkingen til, og kallstedet skal droppe
 * stjerne-knappen framfor å lagre noe som ikke finnes igjen neste gang.
 *
 * @param {string} kilde  KILDE_BRUKER | KILDE_FREDET
 * @param {string|null|undefined} id
 * @returns {string|null}
 */
export function minneNokkel(kilde, id) {
  if (kilde !== KILDE_BRUKER && kilde !== KILDE_FREDET) return null
  const rein = String(id ?? '').trim()
  if (!rein) return null
  return `${kilde}:${rein}`
}

/** Er dette minnet stjernemerket? Tåler at lista mangler helt. */
export function harStjerne(liste, nokkel) {
  if (!nokkel || !Array.isArray(liste)) return false
  return liste.includes(nokkel)
}

/**
 * Slå stjerna av eller på. Returnerer ALLTID en ny liste (aldri den samme
 * referansen), så et kallsted som sammenligner med === ser endringen — og
 * aldri en dublett, uansett hvor mange ganger den kalles.
 */
export function veksleStjerne(liste, nokkel) {
  const nå = Array.isArray(liste) ? liste.filter((n) => typeof n === 'string' && n) : []
  if (!nokkel) return nå
  return nå.includes(nokkel) ? nå.filter((n) => n !== nokkel) : [...nå, nokkel]
}

/** Antall stjernemerker på et kart. 0 når feltet mangler (eldre kart). */
export function stjerneAntall(liste) {
  if (!Array.isArray(liste)) return 0
  return new Set(liste.filter((n) => typeof n === 'string' && n)).size
}

/**
 * Ringens farge. Den skal LESES som en markering på både et kremgult ISOM-ark
 * og et natt-tema, og gult er allerede appens farge for «brukerens egen
 * vurdering» (stjernene i Mine ruter). Derfor samme familie, men to valører:
 * en lys gulltone forsvinner mot kremgult papir, og en mørk forsvinner i natta.
 *
 * @param {boolean} morktTema
 * @returns {string}
 */
export function stjerneRingFarge(morktTema) {
  return morktTema ? '#ffd24a' : '#8a5f00'
}

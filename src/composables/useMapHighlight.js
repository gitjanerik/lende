import { ref } from 'vue'

// Bro mellom Lende-chat og den rosa, blinkende markeringen i kartvisningen —
// samme mekanikk som useMapLayerControl bruker for lagene.
//
// MapView eier markeringen (highlightedFeature): den nullstilles per kart,
// låser opp navne-LOD-en for treffet og deles av søket, «Nærmeste …»-
// snarveiene og ?hl=-dyplenken. Chatten sender derfor bare en kommando hit;
// MapView utfører den gjennom selectSearchResult — nøyaktig samme vei som når
// brukeren velger et søketreff selv.
//
// Er ingen kartvisning oppe, står `merkeKlar` false og verktøyet svarer ærlig
// i stedet for å påstå at noe ble merket.

const merkeKlar = ref(false)
const kommando = ref(null)   // { navn?, sub?, lat?, lon?, fjern?, id } | null

export function useMapHighlight() {
  return { merkeKlar, kommando }
}

/** MapView melder fra om at markering kan utføres (false når visningen forlates). */
export function publiserMerkeKlar(klar) {
  merkeKlar.value = !!klar
}

/**
 * Chatten ber om en markering. `id` teller opp så to like kommandoer etter
 * hverandre («merk Stordammen» to ganger) fortsatt trigger watchen i MapView.
 */
export function sendMerkeKommando(cmd) {
  kommando.value = { ...cmd, id: (kommando.value?.id ?? 0) + 1 }
}

import { ref } from 'vue'

// Bro mellom Lende-chat og kartvisningens lag-tilstand.
//
// I motsetning til kart-temaet (useMapTheme — en ekte modul-singleton) EIER
// MapView lag-synligheten: den nullstilles per kart, kan overstyres av
// init-prefs fra auto-kart, og monokrome temaer skrur den om automatisk
// (onThemeChange). Å flytte tilstanden hit ville endret alle de reglene.
//
// I stedet publiserer MapView gjeldende tilstand hit, og plukker opp
// kommandoer herfra. Chatten leser `synligeLag` for å vite hva som er på nå,
// og sender en ferdig utregnet lag-liste tilbake. Er ikke noe kart åpent er
// `synligeLag` null, og verktøyet svarer ærlig i stedet for å late som.

const synligeLag = ref(null)   // string[] | null (null = ingen kartvisning oppe)
const kommando = ref(null)     // { keys?: string[], nullstill?: boolean, id } | null

export function useMapLayerControl() {
  return { synligeLag, kommando }
}

/** MapView melder fra om gjeldende synlige lag (null når visningen forlates). */
export function publiserSynligeLag(keys) {
  synligeLag.value = keys ? [...keys] : null
}

/**
 * Chatten ber om en lag-endring. `id` teller opp så to like kommandoer etter
 * hverandre («skjul navn» to ganger) fortsatt trigger watchen i MapView.
 */
export function sendLagKommando(cmd) {
  kommando.value = { ...cmd, id: (kommando.value?.id ?? 0) + 1 }
}

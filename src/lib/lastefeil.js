// Én kilde til «hvorfor kom ikke kartet?», på norsk.
//
// `loadError` i useMapLoadPipeline er rå-meldingen fra det som feilet, og i den
// vanligste situasjonen — flymodus, tomt datakvote, tunnel — er det nettleserens
// engelske «Failed to fetch». Det er både uleselig for brukeren og taust om det
// ene han kan gjøre noe med.
//
// To ting holdes fra hverandre med vilje:
//   • Er nettleseren OFFLINE, er det en pålitelig negativ (se useNettStatus), og
//     da kan vi si det rett ut.
//   • Ellers PÅSTÅR vi ingenting om nettet — captive portal, wifi uten oppstrøm
//     og én strek uten pakker rapporteres alle som online. Vi sier hva kartet
//     KREVER og lar brukeren sjekke.
//
// Alt som ikke er en nettverksfeil slipper gjennom uendret: «Ugyldig SVG» og
// «Mangler data-meta i SVG» er våre egne, norske, og sier noe annet.

// Safari sier «Load failed», Chrome «Failed to fetch», Firefox «NetworkError…».
const NETTFEIL = /failed to fetch|load failed|networkerror|network request failed|internet connection appears to be offline/i

export const NETT_KREVES = 'Kartet må hentes fra nettet. Sjekk at mobildata eller wifi er på.'
export const UTEN_NETT = 'Du er uten nett. Kartet må hentes, så slå på mobildata eller wifi.'

/**
 * @param {string|null|undefined} melding  rå loadError
 * @param {{offline?: boolean}} [opts]     navigator.onLine === false
 * @returns {string}
 */
export function lastefeilPaaNorsk(melding, { offline = false } = {}) {
  const raa = String(melding ?? '').trim()
  if (offline) return UTEN_NETT
  if (!raa) return NETT_KREVES
  if (NETTFEIL.test(raa)) return NETT_KREVES
  // HTTP-statusen er ikke noe brukeren kan handle på, men den skal ikke stå der
  // som bar engelsk kode heller.
  const http = raa.match(/^HTTP (\d{3})$/)
  if (http) return `Serveren svarte HTTP ${http[1]}. Prøv igjen om litt.`
  return raa
}

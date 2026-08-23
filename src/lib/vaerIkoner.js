// Lat lasting av værsymbol-settet (vaerIkoner.generert.js, ~360 kB / 26 kB gzip).
//
// Hvorfor lazy: settet trengs BARE når et varsel faktisk vises, og et varsel
// krever nett. Lagt statisk inn i MapView-chunken kostet det 36 kB gzip for alle
// — også de som aldri åpner vær — og dyttet chunken over 500 kB-grensa. Som eget
// chunk hentes det i det første ikonet skal tegnes, og service worker-en cacher
// hashede assets cache-first, så det ligger der etterpå.
//
// Promiset caches, så samtidige kall (åtte ikoner i en symbolrad) gir én import.

let lasting = null

/** @returns {Promise<{VAER_IKON: Record<string,string>, VAER_NAVN: Record<string,string>, VAER_MED_VARIANT: Set<string>}>} */
export function lastVaerIkoner() {
  lasting ??= import('./vaerIkoner.generert.js')
  return lasting
}

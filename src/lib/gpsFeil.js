// Teksten brukeren får når nettleseren nekter oss en posisjon.
//
// Én kilde, fordi den vises fra tre steder: «Lag kart der jeg er» (MapLibrary),
// «Sentrer på GPS» i utsnitts-velgeren og Fritt lendes ene knapp. Fram til
// v6.5.27 hadde de hver sin kopi av kodetabellen, og Fritt lende hadde ingen —
// et avvist tillatelses-spørsmål der var helt stille, med en chip som lette
// etter en posisjon som aldri kunne komme.
//
// Kodene er Geolocation-APIets egne: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE,
// 3 TIMEOUT.
export const GPS_FEIL_TEKST = Object.freeze({
  1: 'GPS-tillatelse avvist',
  2: 'GPS-posisjon ikke tilgjengelig',
  3: 'GPS-forespørsel tok for lang tid',
})

export const GPS_IKKE_STOTTET = 'Nettleseren støtter ikke GPS'

export function gpsFeilTekst(code, fallback = 'GPS-feil') {
  return GPS_FEIL_TEKST[code] ?? fallback
}

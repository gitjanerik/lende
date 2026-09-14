// Teksten brukeren får når nettleseren nekter oss en posisjon.
//
// Én kilde, fordi den vises fra tre steder: «Lag kart der jeg er» (MapLibrary),
// «Nytt turkart» i hovedmenyen og «Sentrer på GPS» i utsnitts-velgeren. Fram til
// v6.5.27 hadde de hver sin kopi av kodetabellen, og ett av stedene hadde ingen —
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

// RÅDET ER BORTE (v7.8.16). `GPS_FEIL_RAAD` og `gpsFeilForklaring` bar en andre,
// lengre variant av de samme tre feilene — «Trykk på låsikonet i adressefeltet og
// sett Posisjon til «Tillat» — eller søk opp stedet i stedet.» og to søsken — og
// levde fra v7.8.14 på ÉN kaller: utsnitts-velgeren, med den begrunnelsen at
// boksen der har mer plass. Eieren ba om den korte overalt, og begrunnelsen holdt
// ikke: plass er ikke et argument for å si mer, og to lengder på samme feil leses
// som to ulike feil. Alle tre flatene bruker nå `GpsFeilVarsel`, som viser
// etiketten og har en X.
//
// Skal rådet tilbake, hører det hjemme BAK X-en eller i en egen hjelp — ikke som
// tre linjer nettleser-instruksjon over lista man kom for å lese.

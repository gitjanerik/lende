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

// Rådet under etiketten. Etiketten sier HVA som skjedde, rådet sier hva
// brukeren kan gjøre med det — og for kode 1 er det hele poenget: en avvist
// tillatelse spørres ikke om på nytt, så knappen blir stum til man finner
// innstillingen selv.
export const GPS_FEIL_RAAD = Object.freeze({
  1: 'Trykk på låsikonet i adressefeltet og sett Posisjon til «Tillat» — eller søk opp stedet i stedet.',
  2: 'Telefonen får ikke fatt i satellittene akkurat nå. Prøv igjen ute, eller søk opp stedet.',
  3: 'Posisjonen kom ikke i tide. Prøv igjen, eller søk opp stedet.',
})

// Etikett + råd som én lesbar setning, til feilboksene under søkefeltene.
export function gpsFeilForklaring(code, fallback = 'GPS-feil') {
  const raad = GPS_FEIL_RAAD[code]
  return raad ? `${gpsFeilTekst(code, fallback)}. ${raad}` : gpsFeilTekst(code, fallback)
}

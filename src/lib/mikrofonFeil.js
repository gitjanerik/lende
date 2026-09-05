// Teksten brukeren får når diktering ikke lar seg gjøre.
//
// Søsteren til `gpsFeil.js`, og den finnes av samme grunn: mikrofon-knappen
// står i to søkefelt (MapLibrary og MapPickerContent), og fram til v6.5.45 sa
// INGEN av dem noe når nettleseren nektet oss lyd. `useSpeechInput` fanget
// koden i en `error`-ref som ingen leste — knappen slo seg av igjen med det
// samme, og det så ut som om den var i stykker.
//
// Kodene er Web Speech APIets egne (`SpeechRecognitionErrorEvent.error`).
// «no-speech» og «aborted» er normale avslutninger og filtreres bort i
// composable-en; de har derfor ingen linje her.
export const MIK_FEIL_TEKST = Object.freeze({
  'not-allowed': 'Mikrofonen er ikke tillatt',
  'service-not-allowed': 'Mikrofonen er ikke tillatt',
  'audio-capture': 'Fant ingen mikrofon',
  'network': 'Talegjenkjenningen nådde ikke nettet',
  'language-not-supported': 'Nettleseren har ikke norsk talegjenkjenning',
})

// Rådet er halve poenget: en tillatelse man har avvist én gang blir ikke spurt
// om på nytt, så brukeren må vite HVOR den slås på igjen.
export const MIK_FEIL_RAAD = Object.freeze({
  'not-allowed': 'Trykk på låsikonet i adressefeltet og sett Mikrofon til «Tillat» — eller skriv søket i stedet.',
  'service-not-allowed': 'Trykk på låsikonet i adressefeltet og sett Mikrofon til «Tillat» — eller skriv søket i stedet.',
  'audio-capture': 'Sjekk at en mikrofon er koblet til og ikke i bruk av en annen app.',
  'network': 'Talegjenkjenningen kjører i nettleseren, men trenger nett første gang. Skriv søket i stedet.',
  'language-not-supported': 'Skriv søket i stedet.',
})

export const MIK_UKJENT_FEIL = 'Diktering feilet'

export function mikrofonFeilTekst(kode, fallback = MIK_UKJENT_FEIL) {
  return MIK_FEIL_TEKST[kode] ?? fallback
}

// Etikett + råd som én lesbar setning, til feilboksene under søkefeltene.
export function mikrofonFeilForklaring(kode, fallback = MIK_UKJENT_FEIL) {
  const raad = MIK_FEIL_RAAD[kode]
  return raad ? `${mikrofonFeilTekst(kode, fallback)}. ${raad}` : mikrofonFeilTekst(kode, fallback)
}

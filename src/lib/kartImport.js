// Import av en .lendekart-fil: les pakka, legg kartet i mottakerens
// IndexedDB, og skriv datalagene inn i cachen så de virker uten dekning.
//
// Ett kart pr fil, og som et NYTT kart hos mottakeren — med ett unntak: samme
// kart importert på nytt gir det du alt har, se `finnAlleredeImportert`.

import { generateMapId, saveMap, listMaps } from './mapStorage.js'
import { lesKartPakke } from './kartPakke.js'
import { skrivOfflineData } from './offlinePakke.js'
import { APP_VERSION } from '../version.js'

/**
 * Identiteten til et importert kart er AVSENDERENS navn + opprettelsestidspunkt,
 * ikke fila. Et kart eksportert to ganger gir to filer med ulik `eksportert`, men
 * det er samme kart — og en mottaker som importerer det igjen skal ikke få en
 * kopi. Tidspunktet må være med: to helt ulike kart kan hete «Vardåsen».
 *
 * Vi sammenlikner mot det som ble NOTERT ved importen og aldri mot `navn` og
 * `opprettet` på posten: begge skrives om her (ledig navn, import-tidspunkt), og
 * brukeren kan dessuten døpe om kartet sitt etterpå.
 *
 * Legacy: kart importert før v6.5.39 mangler notatet. De kjennes bare igjen på
 * SAMME FIL — basisnavnet pluss `eksportert` — som er nøyaktig det tilfellet
 * feilen ble meldt for (samme fil importert flere ganger). Et annet kart med
 * samme navn har et annet eksport-tidspunkt og slipper gjennom.
 *
 * Ren funksjon, uten IndexedDB.
 *
 * @param {Array<object>} eksisterende  lette poster fra listMaps()
 * @param {{navn: string, opprettet: number|null, eksportert: number|null}} kandidat
 * @returns {object|null}
 */
export function finnAlleredeImportert(eksisterende, kandidat) {
  const navn = kandidat?.navn || ''
  if (!navn) return null
  const harTs = Number.isFinite(kandidat.opprettet)
  const harEksport = Number.isFinite(kandidat.eksportert)
  for (const m of eksisterende ?? []) {
    const fra = m?.importertFra
    if (!fra) continue
    // Samme KART: notert navn + notert tidspunkt. Uten et tidspunkt å holde fast
    // i faller vi gjennom til fil-regelen — navn alene er ikke identitet.
    if (harTs && fra.opprinneligNavn === navn && fra.opprinneligOpprettet === kandidat.opprettet) return m
    // Samme FIL: eksport-tidspunktet. Eneste vei for legacy-poster, og nettet
    // under et kart uten `opprettet`.
    if (harEksport && fra.eksportert === kandidat.eksportert
        && (fra.opprinneligNavn ?? basisnavn(m.navn)) === navn) return m
  }
  return null
}

/** «Vardåsen (importert 2)» → «Vardåsen». Bare for legacy-gjenkjenningen over. */
function basisnavn(navn) {
  return String(navn ?? '').replace(/ \(importert(?: \d+)?\)$/, '')
}

/** «Vardåsen» → «Vardåsen (importert)» → «Vardåsen (importert 2)» */
function ledigNavn(ønsket, tatt) {
  if (!tatt.has(ønsket)) return ønsket
  const base = `${ønsket} (importert)`
  if (!tatt.has(base)) return base
  for (let i = 2; i < 500; i++) {
    const kandidat = `${ønsket} (importert ${i})`
    if (!tatt.has(kandidat)) return kandidat
  }
  return base
}

/**
 * @param {Blob|File|ArrayBuffer|Uint8Array} fil
 * @returns {Promise<{id: string, navn: string, cacheRader: number, alleredeImportert: boolean}>}
 */
export async function importerKartPakke(fil) {
  const pakke = await lesKartPakke(fil)
  const eksisterende = await listMaps().catch(() => [])
  const opprinneligNavn = pakke.kart.navn || 'Importert kart'
  const opprinneligOpprettet = Number.isFinite(pakke.kart.opprettet) ? pakke.kart.opprettet : null

  // Samme kart to ganger: åpne det brukeren har i stedet for å lage en kopi til.
  // Cache-radene skrives likevel om — `skrivOfflineData` gir dem FERSK TTL, og en
  // fil som har ligget en måned i en chat er nettopp grunnen til at den regelen
  // finnes (se offlinePakke). Kart-posten røres ikke: den kan ha annoteringer og
  // spor brukeren har lagt til etter forrige import.
  const dublett = finnAlleredeImportert(eksisterende, {
    navn: opprinneligNavn,
    opprettet: opprinneligOpprettet,
    eksportert: pakke.eksportert,
  })
  if (dublett) {
    const cacheRader = await skrivOfflineData(pakke.cache)
    return { id: dublett.id, navn: dublett.navn, cacheRader, alleredeImportert: true }
  }

  const tatt = new Set(eksisterende.map((m) => m.navn))

  const entry = {
    ...pakke.kart,
    // ALLTID ny id. Mottakeren kan ha et eget kart med samme id (id-en er
    // tilfeldig, men en fil kan også importeres to ganger), og en import skal
    // aldri overskrive noe brukeren selv har laget.
    id: generateMapId(),
    navn: ledigNavn(opprinneligNavn, tatt),
    opprettet: Date.now(),
    // isAuto MÅ være false: auto-fliser fra en annen appVersion ryddes bort av
    // useGhostTiles/tileCache, og et importert kart ville forsvunnet av seg selv.
    isAuto: false,
    // Kartet i fila er ferdig bygget uansett hva avsenderen sto i.
    partial: false,
    // Personlig innhold følger ikke med en delt fil (kartPakke stripper det på
    // vei ut; her settes tomrommet eksplisitt så MapView slipper undefined).
    annotations: [],
    tracks: [],
    // Appversjonen KARTET ble bygget med beholdes — den forteller hvilken
    // pipeline SVG-en kom fra. Hvem som importerte, og når, står for seg.
    appVersion: pakke.kart.appVersion ?? pakke.appVersion ?? null,
    importertFra: {
      appVersion: pakke.appVersion ?? null,
      eksportert: pakke.eksportert ?? null,
      // Kartets identitet hos AVSENDEREN. Leses av finnAlleredeImportert, og er
      // grunnen til at en ny import av samme kart kjennes igjen selv om
      // mottakeren har døpt om kopien sin.
      opprinneligNavn,
      opprinneligOpprettet,
      importertAv: APP_VERSION,
      importert: Date.now(),
    },
  }
  delete entry.trackStyle

  await saveMap(entry)
  const cacheRader = await skrivOfflineData(pakke.cache)
  return { id: entry.id, navn: entry.navn, cacheRader, alleredeImportert: false }
}

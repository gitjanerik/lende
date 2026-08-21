// Import av en .lendekart-fil: les pakka, legg kartet i mottakerens
// IndexedDB, og skriv datalagene inn i cachen så de virker uten dekning.
//
// Ett kart pr fil, alltid som et NYTT kart hos mottakeren.

import { generateMapId, saveMap, listMaps } from './mapStorage.js'
import { lesKartPakke } from './kartPakke.js'
import { skrivOfflineData } from './offlinePakke.js'
import { APP_VERSION } from '../version.js'

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
 * @returns {Promise<{id: string, navn: string, cacheRader: number}>}
 */
export async function importerKartPakke(fil) {
  const pakke = await lesKartPakke(fil)
  const eksisterende = await listMaps().catch(() => [])
  const tatt = new Set(eksisterende.map((m) => m.navn))

  const entry = {
    ...pakke.kart,
    // ALLTID ny id. Mottakeren kan ha et eget kart med samme id (id-en er
    // tilfeldig, men en fil kan også importeres to ganger), og en import skal
    // aldri overskrive noe brukeren selv har laget.
    id: generateMapId(),
    navn: ledigNavn(pakke.kart.navn || 'Importert kart', tatt),
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
      importertAv: APP_VERSION,
      importert: Date.now(),
    },
  }
  delete entry.trackStyle

  await saveMap(entry)
  const cacheRader = await skrivOfflineData(pakke.cache)
  return { id: entry.id, navn: entry.navn, cacheRader }
}

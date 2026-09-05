// Veien fra et LAGRET kart til en .lendekart-fil hos brukeren — delt av de to
// stedene som tilbyr den: «Del som offline-fil» i kart-visningen
// (useKartPakke) og nedlastings-knappen i «Mine kart» (MapLibrary).
//
// Grunnen til at dette bor i én fil er at de to veiene MÅ gi samme fil. Fram
// til v6.5.47 fantes bare den første; en snarvei som pakket «nesten det samme»
// ville gitt turkameraten et kart uten kulturminner eller verneområder, og
// ingenting i UI-et ville sagt hvilken av knappene som ga hvilken fil.
//
// Selve formatet bor i kartPakke.js, innsamlingen av datalag i offlinePakke.js.

import { lagKartPakke, pakkeFilnavn } from './kartPakke.js'
import { samleOfflineData } from './offlinePakke.js'
import { triggerDownload } from './printExport.js'

// Over dette advarer vi. Grensa er ikke teknisk — den er sosial: en fil på
// flere titalls MB kommer ikke gjennom en meldingstjeneste, og brukeren bør
// vite det FØR de prøver å sende den til turkameraten.
export const STOR_FIL_MB = 40

/**
 * Geo-forankringen `samleOfflineData` regner bboksen sin av, lest ut av et
 * lagret karts SVG-streng.
 *
 * Dette er med vilje IKKE `metaFromSvgMeta`-hvitelista (useMapLoadPipeline):
 * den bygger MapViews fulle meta for VISNING, og en hviteliste til ville vært
 * enda et sted å glemme et felt. Her trengs bare det `wgs84BboxFromMeta`
 * leser — utsnittet — og `bbox`, som kulturminne-nøkkelen bruker direkte.
 *
 * Attributtet leses med regex og ikke med DOMParser: et lagret ark er
 * megabyte-vis av SVG, og hele geo-forankringen står i åpningstaggen.
 *
 * @param {string} svg
 * @returns {object|null}
 */
export function forankringFraSvg(svg) {
  if (typeof svg !== 'string') return null
  const tag = svg.match(/<svg\b[^>]*>/)?.[0]
  const rå = tag?.match(/\sdata-meta\s*=\s*'([^']*)'/)?.[1]
  if (!rå) return null
  let m
  try {
    // mapBuilder escaper ' som &apos; for at attributtet skal tåle apostrofer;
    // </> er gyldig JSON og tas av JSON.parse selv.
    m = JSON.parse(rå.replace(/&apos;/g, "'"))
  } catch { return null }
  const u = m?.utmBbox
  if (!u || !Number.isFinite(m.widthM) || !Number.isFinite(m.heightM)) return null
  return {
    minE: u.minE, minN: u.minN, maxE: u.maxE, maxN: u.maxN,
    widthM: m.widthM, heightM: m.heightM,
    bbox: m.bbox ?? null,
  }
}

/**
 * Delings-arket først: der ligger AirDrop, Nearby Share, Bluetooth og «Lagre i
 * Filer» — alle sammen uten nett. Klarer ikke nettleseren å dele filer, faller
 * vi tilbake til en vanlig nedlasting.
 *
 * DETTE er Bluetooth-støtten vår, og det er et bevisst valg: å sende direkte
 * mellom to telefoner fra webappen selv ble vurdert og forkastet (v5.20.1).
 * Web Bluetooth finnes ikke på iOS og er «central-only» på Android, så to
 * nettsider ser aldri hverandre; WebRTC over felles hotspot med QR-håndhilsning
 * ville virket, men kostet for mye å teste i felt. Begrunnelsen i sin helhet
 * står i CLAUDE.md. Operativsystemet er bedre på nærradio enn vi blir — vi
 * leverer en FIL og lar det ta seg av resten.
 *
 * @returns {Promise<'delt'|'lastet-ned'|'avbrutt'>}
 */
export async function delEllerLastNedFil(blob, filnavn, tittel = 'Lende — turkart') {
  const fil = new File([blob], filnavn, { type: 'application/gzip' })
  if (typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [fil] })) {
    try {
      await navigator.share({ files: [fil], title: tittel })
      return 'delt'
    } catch (err) {
      // Bruker lukket arket — ikke en feil, og ikke noe å laste ned heller.
      if (err && err.name === 'AbortError') return 'avbrutt'
      // Alt annet: fall gjennom til nedlasting.
    }
  }
  triggerDownload(blob, filnavn)
  return 'lastet-ned'
}

/** Menneskelig filstørrelse for toasten. */
export function filStorrelseTekst(bytes) {
  const mb = bytes / (1024 * 1024)
  return mb < 1 ? `${Math.round(bytes / 1024)} kB` : `${mb.toFixed(1)} MB`
}

/**
 * Samle datalag + pakk. `meta` kan utelates — da hopper vi over datalagene og
 * pakker kartet alene, som er riktig utfall for et ark uten geo-forankring.
 *
 * @param {{ kart: object, navn?: string, meta?: object|null,
 *           appVersion?: string|null, onProgress?: (t: string) => void }} arg
 * @returns {Promise<{ blob: Blob, filnavn: string }>}
 */
export async function pakkKartTilFil({ kart, navn = '', meta = null, appVersion = null, onProgress = () => {} }) {
  if (!kart?.svg) throw new Error('Fant ikke kartet å pakke.')
  const forankring = meta ?? forankringFraSvg(kart.svg)
  // samleOfflineData svelger feil per kilde: uten dekning kommer vi tilbake med
  // færre rader, ikke med et unntak. Fila blir da mindre, men fullt gyldig.
  const cache = forankring
    ? await samleOfflineData({ meta: forankring, svg: kart.svg, onProgress })
    : []
  onProgress('Pakker fila …')
  const blob = await lagKartPakke({ kart, cache, appVersion })
  return { blob, filnavn: pakkeFilnavn(navn || kart.navn) }
}

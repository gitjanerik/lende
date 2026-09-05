// UTGÅENDE deling som FIL: hele kartet i én .lendekart-fil mottakeren kan åpne
// uten dekning.
//
// Skillet mot useKartDeling: den deler en LENKE med oppskriften, og mottakeren
// bygger kartet selv mot Kartverket/Overpass/N50/NVE. Det er den lette veien
// når begge har nett. Denne veien er for fjellet: fila inneholder den ferdige
// SVG-en, DEM-rutenettet og datalagene, og går telefon-til-telefon med AirDrop,
// Nearby Share, Bluetooth eller minnepinne.
//
// Selve formatet bor i lib/kartPakke.js, innsamlingen i lib/offlinePakke.js,
// og selve pakke-/leverings-rekkefølgen i lib/kartFilDeling.js — DELT med
// nedlastings-knappen i «Mine kart» (v6.5.47), så de to veiene ikke kan gi hver
// sin fil. Her er bare statusen knappen leser og det MapView kan som lista ikke
// kan: å pakke et INNEBYGD kart av det som står på skjermen.

import { ref, computed } from 'vue'
import { loadMap } from '../lib/mapStorage.js'
import { sikreDataMeta } from '../lib/kartPakke.js'
import { delEllerLastNedFil, filStorrelseTekst, pakkKartTilFil, STOR_FIL_MB } from '../lib/kartFilDeling.js'
import { APP_VERSION } from '../version.js'

/**
 * @param {{
 *   meta: import('vue').Ref, mapTitle: import('vue').Ref,
 *   kartId: () => string, autoMapToast: import('vue').Ref,
 *   hentSvgMarkup: () => string,
 * }} deps
 */
export function useKartPakke({ meta, mapTitle, kartId, autoMapToast, hentSvgMarkup }) {
  // '' | 'samler' | 'pakker' | 'deler' | 'ferdig' | 'feil'
  const pakkeStatus = ref('')
  const pakkeDetalj = ref('')
  let resetTimer = null

  const pakkeTekst = computed(() => {
    switch (pakkeStatus.value) {
      case 'samler': return pakkeDetalj.value || 'Samler kartdata …'
      case 'pakker': return 'Pakker fila …'
      case 'deler': return 'Åpner delings-dialog …'
      case 'ferdig': return 'Fil klar ✓'
      case 'feil': return 'Kunne ikke lage fila'
      default: return 'Del som offline-fil'
    }
  })

  function settStatus(s, detalj = '') {
    pakkeStatus.value = s
    pakkeDetalj.value = detalj
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null }
    if (s === 'ferdig' || s === 'feil') {
      resetTimer = setTimeout(() => { pakkeStatus.value = ''; pakkeDetalj.value = '' }, 2600)
    }
  }

  function toast(tekst, ms = 4000) {
    autoMapToast.value = tekst
    setTimeout(() => { if (autoMapToast.value === tekst) autoMapToast.value = '' }, ms)
  }

  // Innebygde kart (vardasen) finnes ikke i IndexedDB — de lastes fra
  // /maps/*.svg. Da bygger vi kart-posten av det som står på skjermen i stedet,
  // så «del offline» virker likt uansett hvor kartet kom fra. Uten DEM: det
  // innebygde kartet har aldri hatt et lagret høyderutenett.
  function entryFraSkjermen(id) {
    const rå = hentSvgMarkup?.()
    const m = meta.value
    if (!rå || !m) return null
    // Skjerm-SVG-en er bygget om av setupHostSvg og har mistet data-meta —
    // uten den nekter mottakerens laster å åpne kartet. Se sikreDataMeta.
    const svg = sikreDataMeta(rå, m)
    return {
      id,
      navn: mapTitle.value || 'Turkart',
      bbox: m.bbox,
      utmBbox: { minE: m.minE, minN: m.minN, maxE: m.maxE, maxN: m.maxN },
      equidistanceM: m.equidistance ?? null,
      demResolutionM: m.demResolutionM ?? null,
      demSource: m.demSource ?? null,
      source: m.source ?? null,
      svg,
      dem: null,
      opprettet: Date.now(),
      appVersion: m.appVersion ?? APP_VERSION,
    }
  }

  async function onDelOffline() {
    if (pakkeStatus.value && pakkeStatus.value !== 'ferdig' && pakkeStatus.value !== 'feil') return
    const id = kartId()
    try {
      settStatus('samler', 'Leser kartet …')
      const kart = (await loadMap(id)) ?? entryFraSkjermen(id)
      if (!kart?.svg) throw new Error('Fant ikke kartet å pakke.')

      // meta sendes inn her, men leses av forankringFraSvg i lista: MapView HAR
      // allerede det ferdig parsede utsnittet, og et innebygd kart har ingen
      // lagret SVG å lese det ut av.
      const { blob, filnavn } = await pakkKartTilFil({
        kart,
        navn: mapTitle.value || kart.navn,
        meta: meta.value,
        appVersion: APP_VERSION,
        onProgress: (t) => {
          if (t === 'Pakker fila …') settStatus('pakker')
          else if (pakkeStatus.value === 'samler') pakkeDetalj.value = t
        },
      })

      settStatus('deler')
      const utfall = await delEllerLastNedFil(blob, filnavn, mapTitle.value || 'Lende — turkart')
      if (utfall === 'avbrutt') { settStatus(''); return }
      settStatus('ferdig')
      if (utfall === 'lastet-ned') {
        const mb = blob.size / (1024 * 1024)
        toast(mb > STOR_FIL_MB
          ? `Fila er ${mb.toFixed(0)} MB — for stor for de fleste meldingsapper. Bruk AirDrop, kabel eller minnepinne.`
          : `${filnavn} lagret (${filStorrelseTekst(blob.size)}).`)
      }
    } catch (e) {
      console.error('Offline-pakking feilet:', e)
      settStatus('feil')
      toast(e?.message || 'Kunne ikke lage offline-fila.')
    }
  }

  return { pakkeStatus, pakkeTekst, onDelOffline }
}

// UTGÅENDE deling som FIL: hele kartet i én .lendekart-fil mottakeren kan åpne
// uten dekning.
//
// Skillet mot useKartDeling: den deler en LENKE med oppskriften, og mottakeren
// bygger kartet selv mot Kartverket/Overpass/N50/NVE. Det er den lette veien
// når begge har nett. Denne veien er for fjellet: fila inneholder den ferdige
// SVG-en, DEM-rutenettet og datalagene, og går telefon-til-telefon med AirDrop,
// Nearby Share, Bluetooth eller minnepinne.
//
// Selve formatet bor i lib/kartPakke.js, innsamlingen i lib/offlinePakke.js.
// Her er bare rekkefølgen, statusen knappen leser, og valget mellom
// delings-arket og en vanlig nedlasting.

import { ref, computed } from 'vue'
import { loadMap } from '../lib/mapStorage.js'
import { lagKartPakke, pakkeFilnavn, sikreDataMeta } from '../lib/kartPakke.js'
import { samleOfflineData } from '../lib/offlinePakke.js'
import { triggerDownload } from '../lib/printExport.js'
import { APP_VERSION } from '../version.js'

// Over dette advarer vi i toasten. Grensa er ikke teknisk — den er sosial: en
// fil på flere titalls MB kommer ikke gjennom en meldingstjeneste, og brukeren
// bør vite det FØR de prøver å sende den til turkameraten.
const STOR_FIL_MB = 40

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

      const cache = await samleOfflineData({
        meta: meta.value,
        svg: kart.svg,
        onProgress: (t) => { if (pakkeStatus.value === 'samler') pakkeDetalj.value = t },
      })

      settStatus('pakker')
      const blob = await lagKartPakke({ kart, cache, appVersion: APP_VERSION })
      const filnavn = pakkeFilnavn(mapTitle.value || kart.navn)
      const mb = blob.size / (1024 * 1024)

      // Delings-arket først: der ligger AirDrop, Nearby Share, Bluetooth og
      // «Lagre i Filer» — alle sammen uten nett. Klarer ikke nettleseren å dele
      // filer, faller vi tilbake til en vanlig nedlasting.
      const fil = new File([blob], filnavn, { type: 'application/gzip' })
      if (typeof navigator.share === 'function'
          && typeof navigator.canShare === 'function'
          && navigator.canShare({ files: [fil] })) {
        settStatus('deler')
        try {
          await navigator.share({ files: [fil], title: mapTitle.value || 'Lende — turkart' })
          settStatus('ferdig')
          return
        } catch (err) {
          // Bruker lukket arket — ikke en feil, og ikke noe å laste ned heller.
          if (err && err.name === 'AbortError') { settStatus(''); return }
          // Alt annet: fall gjennom til nedlasting.
        }
      }
      triggerDownload(blob, filnavn)
      settStatus('ferdig')
      toast(mb > STOR_FIL_MB
        ? `Fila er ${mb.toFixed(0)} MB — for stor for de fleste meldingsapper. Bruk AirDrop, kabel eller minnepinne.`
        : `${filnavn} lagret (${mb < 1 ? `${Math.round(blob.size / 1024)} kB` : `${mb.toFixed(1)} MB`}).`)
    } catch (e) {
      console.error('Offline-pakking feilet:', e)
      settStatus('feil')
      toast(e?.message || 'Kunne ikke lage offline-fila.')
    }
  }

  return { pakkeStatus, pakkeTekst, onDelOffline }
}

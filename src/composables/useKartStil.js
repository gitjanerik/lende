// Kartstil-styringen — ett trykk som setter HELE uttrykket.
//
// Fram til v5.23.0 måtte brukeren kombinere fire uavhengige kontroller selv
// (tema, lag-forhåndsvalg, strek-knotter, sti-fargevelgere), og ingen av dem
// visste om de andre. Denne composable-en er stedet de møtes: den tar én
// kartstil fra lib/kartStiler.js og skriver den ut i alle fire tilstandene.
//
// ── Hvorfor den ligger i MapView-laget og ikke i lib ──────────────────────
// lib/kartStiler.js er ren DATA — den kan leses av MCP-serveren og headless
// uten en nettleser. Selve påføringen må derimot røre fire composables som
// eier hver sin del av tilstanden (tema-singleton, lag-settet, strek-tuning
// per kart, sti-farger per kart). Det er nøyaktig samme arbeidsdeling som
// mapSettingsApply.js har mot drawer-en: delt vokabular i lib, påføring i app.
//
// ── Hvorfor `aktivStil` ser på TEMAET og ikke på lagene ───────────────────
// Lag-synligheten er finjustering. Slår du av gjerder etter å ha valgt
// Turkart, er du fortsatt i Turkart — og knappen skal fortsatt se valgt ut.
// Ser vi på lagene, ville ett avslått lag gjort at INGEN stil så valgt ut,
// altså akkurat følelsen av at ingenting henger sammen som kartstil-begrepet
// finnes for å fjerne.

import { computed } from 'vue'
import { KARTSTILER, STI_PALETTER, kartStil, stiPalett, aktivKartStil } from '../lib/kartStiler.js'
import { useMapTheme } from './useMapTheme.js'
import { useStrokeTuning } from './useStrokeTuning.js'
import { useTrailColors } from './useTrailColors.js'
import { useReliefSettings } from './useReliefSettings.js'

/**
 * @param {{
 *   visibleLayers: import('vue').Ref,          // eies av useLagStyring
 *   applyLayerVisibility: () => void,
 * }} deps
 */
export function useKartStil({ visibleLayers, applyLayerVisibility }) {
  const { mapTheme, setMapTheme } = useMapTheme()
  const stroke = useStrokeTuning()
  const trail = useTrailColors()
  const relief = useReliefSettings()

  const aktivStil = computed(() => aktivKartStil({ tema: mapTheme.value }))

  /**
   * Påfør en kartstil. Rekkefølgen er ikke tilfeldig: lagene settes FØR
   * temaet, fordi tema-watchen i useTemaBytte kan overstyre lag-settet for
   * art-temaer (autoHideLayers). Setter vi lagene sist, ville et bytte fra
   * Curves til Turkart etterlatt kun høydekurver synlige.
   *
   * @param {string|{key: string}} stilEllerNokkel
   */
  function bruksKartStil(stilEllerNokkel) {
    const key = typeof stilEllerNokkel === 'string' ? stilEllerNokkel : stilEllerNokkel?.key
    const stil = kartStil(key)
    if (!stil) return false

    visibleLayers.value = new Set(stil.lag)
    applyLayerVisibility()

    setMapTheme(stil.tema)

    // Strek: nullstill til nøytral først, så legg stilens profil på. Uten
    // nullstillingen ville en tidligere stils multiplikatorer blitt liggende
    // for grupper den nye stilen ikke nevner.
    stroke.resetToNeutral()
    for (const [gruppe, mult] of Object.entries(stil.strek ?? {})) {
      stroke.setGroup(gruppe, mult)
    }

    // Sti-farger: 'tema' (eller ingenting) betyr «fjern overstyringen», så
    // temaets egne sti-farger gjelder. En hardkodet farge her ville fulgt med
    // inn i mørke temaer og blitt usynlig.
    const pal = stiPalett(stil.stiPalett ?? 'tema')
    if (pal?.farger) {
      trail.setColor('fg', pal.farger.fg)
      trail.setColor('bg', pal.farger.bg)
    } else {
      trail.resetColors()
    }

    // Relieff: bare stiler med en MENING rører det. `null` lar brukerens eget
    // valg stå — Print er den eneste som har en mening, og den er absolutt.
    if (typeof stil.relieff === 'boolean') relief.reliefEnabled.value = stil.relieff

    return true
  }

  // ── Sti-palett ─────────────────────────────────────────────────────────
  // Den navngitte veien til sti-fargene, som erstatter de to frie
  // fargevelgerne som primærvalg. Velgerne finnes fortsatt i Strek-panelet
  // for den som vil noe eget — derfor AVLEDES den aktive paletten av de
  // faktiske fargene, i stedet for å lagres ved siden av dem. To kilder til
  // «hvilken palett er valgt» ville kommet i utakt første gang noen brukte
  // fargevelgeren.
  const aktivStiPalett = computed(() => {
    const f = trail.effective.value
    if (!f?.fg && !f?.bg) return 'tema'
    return STI_PALETTER.find((p) => p.farger
      && p.farger.fg === f.fg && p.farger.bg === f.bg)?.key ?? null
  })

  function velgStiPalett(key) {
    const pal = stiPalett(key)
    if (!pal) return
    if (pal.farger) {
      trail.setColor('fg', pal.farger.fg)
      trail.setColor('bg', pal.farger.bg)
    } else {
      trail.resetColors()
    }
  }

  return { KARTSTILER, aktivStil, bruksKartStil, aktivStiPalett, velgStiPalett }
}

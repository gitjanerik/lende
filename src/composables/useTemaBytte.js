// Tema-bytte og diagnose-modus.
//
// Trukket ut av MapView.vue i v5.12.0. Tema-variablene kommer fra samme delte
// kilde som MCP-ens `juster_kart` (lib/mapSettingsApply.js), så drawer-en,
// chatten og verktøyet setter alle det samme.
//
// Rekkefølgen i applyTheme er ikke tilfeldig: ALLE tema-variabler ryddes først,
// deretter settes de for valgt tema. Uten oppryddingen etterlot et bytte mellom
// to monokrom-paletter rester fra den forrige (v10.1.x).
//
// Diagnose-modus farger polygoner etter `data-src` — N50, OSM-way,
// OSM-relation eller polygon-clipping-merge. Den finnes for én arbeidsflyt:
// kjør, ta skjermbilde, del med Claude når en wedge dukker opp.

import { watch } from 'vue'
import { themeVarEntries, allThemeVarNames } from '../lib/mapSettingsApply.js'
import isomCatalog from '../lib/isomCatalog.json'
import { DEFAULT_VISIBLE_LAYER_KEYS } from '../lib/mapLayerCatalog.js'

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, mapInnerRef: import('vue').Ref,
 *   wrapperRef: import('vue').Ref,          // viewport-bakgrunnen males her
 *   visibleLayers: import('vue').Ref,       // «Skisse»-temaet slår av alt utenom kontur
 *   currentTheme: import('vue').Ref, diagnose: import('vue').Ref,
 *   reliefAutoOff: () => import('vue').Ref,   // getter: eies av useKartKnotter
 *   hooks: {
 *     applyHillshade: () => void, renderGhostTiles: () => Promise|void,
 *     applyLayerVisibility: () => void,
 *   },
 * }} deps
 */
export function useTemaBytte({
  svgHostRef, mapInnerRef, wrapperRef, currentTheme, diagnose,
  visibleLayers, reliefAutoOff, hooks,
}) {
  // midt-flisen ved tema-bytte og ringen ble hengende på lys-temaet (v10.1.x).
  // Først ryddes ALLE tema-vars (så bytte mellom mono-paletter ikke etterlater
  // rester), så settes vars for valgt tema.
  function applyTheme() {
    const root = mapInnerRef.value
    if (!root || !svgHostRef.value?.querySelector('svg')) return
    // Tema-variablene kommer fra samme delte kilde som MCP-ens juster_kart
    // (lib/mapSettingsApply.js) — rydd alt et tema KAN sette, sett så gjeldende.
    for (const name of allThemeVarNames()) root.style.removeProperty(name)
    const t = isomCatalog.themes?.[currentTheme.value]
    // Viewport-bakgrunn: mal kartets bakgrunnsfarge på den FASTE (utransformerte)
    // viewporten, så hele kartflaten har riktig base-farge — også letterbox-kanter
    // og periferi-fliser som ennå ikke er lastet. v10.1.23: GJELDER NÅ OGSÅ
    // lys-tema (kremgul #fefae0). Tidligere falt lys-tema til side-bakgrunnen
    // (hvit), og sub-piksel-sømmer mellom mosaikk-fliser slapp den hvite siden
    // gjennom → hvite «hakk» i kartet. Med kart-cream som base blir enhver søm
    // usynlig i åpen mark (samme farge), og kun en hårtynn cream-strek i vann/skog.
    if (wrapperRef.value) {
      wrapperRef.value.style.backgroundColor = (t && t.background) ? t.background : ''
    }
    if (!t) return
    for (const [name, value] of themeVarEntries(currentTheme.value)) {
      root.style.setProperty(name, value)
    }
  }

  // Auto-hide / restore layers ved tema-bytte:
  //   - Inn til art-mode (autoHideLayers=true) → bare høydekurver vises
  //   - Ut fra art-mode → alle lag restaureres
  //   - Mellom andre temaer → ingen endring (brukerens manuelle valg beholdes)
  // applyLayerVisibility kalles ubetinget på slutten så DOM er garantert
  // i sync med state — fjerner mulighet for stuck display=none fra forrige
  // art-mode.
  function onThemeChange(newTheme, oldTheme) {
    applyTheme()
    const newT = isomCatalog.themes?.[newTheme]
    const oldT = isomCatalog.themes?.[oldTheme]
    if (newT?.autoHideLayers) {
      visibleLayers.value = new Set(['kontur'])
    } else if (oldT?.autoHideLayers) {
      visibleLayers.value = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
    }
    hooks.applyLayerVisibility()
    // Monokrom-temaene vil ha rene flater — slå relieffet av automatisk, og på
    // igjen når man går ut. Flagget er ikke persistert (se reliefAutoOff), så
    // brukerens egen relieff-innstilling er urørt og gjelder straks temaet
    // forlates. Watchen på [storedDem, currentTheme] kaller hooks.applyHillshade().
    reliefAutoOff().value = !!newT?.monochrome
    // Tema-bytte endrer relieff-blend-modus → spøkelses-relieffet må re-tones
    // (ny data-URL pr modus). Sjelden operasjon; hillshade-compute er cachet.
    void hooks.renderGhostTiles()
  }

  watch(currentTheme, onThemeChange)

  // Diagnose-modus: fargelegg polygoner etter data-src så vi visuelt kan
  // se om wedger kommer fra N50, OSM-way, OSM-relation, eller polygon-
  // clipping merge. Kjør, ta screenshot, del med Claude.
  function applyDiagnoseMode() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    let style = svg.querySelector('style[data-diagnose]')
    if (diagnose.value) {
      if (!style) {
        style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
        style.setAttribute('data-diagnose', '1')
        svg.appendChild(style)
      }
      style.textContent = `
        .isom-map [data-src="n50"]      { fill: hsl(180, 80%, 55%) !important; opacity: 0.85 !important; }
        .isom-map [data-src="nve"]      { fill: hsl(140, 70%, 45%) !important; opacity: 0.85 !important; }
        .isom-map [data-src="way"]      { fill: hsl(220, 80%, 60%) !important; opacity: 0.85 !important; }
        .isom-map [data-src="relation"] { fill: hsl(300, 80%, 60%) !important; opacity: 0.85 !important; }
        .isom-map [data-src="merged"]   { fill: hsl(45, 90%, 55%) !important; opacity: 0.85 !important; }
      `
    } else if (style) {
      style.remove()
    }
  }
  watch(diagnose, applyDiagnoseMode)

  return { applyTheme, applyDiagnoseMode }
}

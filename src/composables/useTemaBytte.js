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

import { watch, onScopeDispose } from 'vue'
import { etterMaling } from '../lib/etterMaling.js'
import { logPerf } from '../lib/perfLog.js'
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
 *     applyHillshade: () => void, retoneGhostRelieff: () => void,
 *     applyLayerVisibility: () => void,
 *   },
 * }} deps
 */
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

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
  // PALETTEN MALES FØRST, RELIEFFET KOMMER ETTER ET BILDE (v7.8.7).
  //
  // Alt under sto én synkron blokk, og en Vue-watch flushes i ÉN oppgave — så
  // nettleseren fikk ikke male noe før hele blokka var ferdig. Tungvekteren er
  // relieffet: blend-modusen snur på hvert lys↔mørke-bytte, så både aktiv flis
  // og hver spøkelsesflis bygger bånd på nytt (d3-contour over DEM-et), og det
  // eneste brukeren så av «Natt» var en knapp som hang i 2–3 sekunder.
  //
  // Det som er GRATIS — CSS-variablene og lag-synligheten — står igjen her og
  // males i det trykket skjer. Det som er DYRT står bak `etterMaling`, altså
  // etter at det bildet er på skjermen. Ingen spinner: arbeidet er ikke borte,
  // det er bare flyttet bak kvitteringen på at trykket ble registrert.
  //
  // Et nytt bytte AVBRYTER et ventende etterspill. Uten det ville en bruker som
  // vipper fram og tilbake stable opp relieff-bygginger for temaer som allerede
  // er forlatt.
  // OG LAG-SVEIPET GIKK SAMME VEI (v7.8.8). `applyLayerVisibility` sto igjen i
  // den synkrone blokka fordi den «garanterer at DOM-en er i synk», men den
  // koster: tjue `querySelectorAll` over HELE kart-SVG-en og hver
  // spøkelsesflis, et `[data-label]`-sveip over det samme, en upright-passering
  // som tvinger layout, og fire lag-injeksjoner. Målt på demokartet (511 noder)
  // er lag-sveipet 0,6 ms — men en ekte mosaikk er tre størrelsesordener større,
  // og da er dette hundrevis av millisekunder i NØYAKTIG det bildet som skal
  // kvittere for trykket. Og på et lys↔mørke-bytte gjør den ingenting i det hele
  // tatt: `visibleLayers` er urørt med mindre man går inn i eller ut av et
  // `autoHideLayers`-tema. Ett bilde med gamle lag på vei INN i «Skisse» er en
  // pris vi tar; en knapp som henger er det ikke.
  let avbrytEtterspill = null
  function onThemeChange(newTheme, oldTheme) {
    const t0 = now()
    applyTheme()
    const newT = isomCatalog.themes?.[newTheme]
    const oldT = isomCatalog.themes?.[oldTheme]
    if (newT?.autoHideLayers) {
      visibleLayers.value = new Set(['kontur'])
    } else if (oldT?.autoHideLayers) {
      visibleLayers.value = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
    }
    // Monokrom-temaene vil ha rene flater — slå relieffet av automatisk, og på
    // igjen når man går ut. Flagget er ikke persistert (se reliefAutoOff), så
    // brukerens egen relieff-innstilling er urørt og gjelder straks temaet
    // forlates. Selve re-renderingen skjer i etterspillet under.
    reliefAutoOff().value = !!newT?.monochrome
    const tPalett = now() - t0
    avbrytEtterspill?.()
    avbrytEtterspill = etterMaling(async () => {
      avbrytEtterspill = null
      const t1 = now()
      hooks.applyLayerVisibility()
      const tLag = now() - t1
      // AWAIT: applyHillshade er async (den venter på DEM-et). Uten await ville
      // tallet under målt at et promise ble opprettet, altså ingenting.
      const t2 = now()
      await hooks.applyHillshade()
      const tRelieff = now() - t2
      // Tema-bytte endrer relieff-blend-modus → spøkelses-relieffet må bygges om.
      // RE-TONING og ikke en full renderGhostTiles: temaets CSS-variabler arves
      // ned i spøkelsene av seg selv, så en teardown + ny IndexedDB-lesing +
      // DOMParser på inntil tolv multi-MB-fliser betalte for ingenting.
      const t3 = now()
      hooks.retoneGhostRelieff()
      const tSpokelser = now() - t3
      // BUDSJETTET SKRIVES TIL PERF-LOGGEN, ikke gjettes. Eieren melder «tregt»
      // fra en telefon vi ikke kan måle på herfra, og de fire tallene sier
      // hvilken av delene som faktisk koster — palett-bildet er det brukeren
      // venter på, resten skjer bak kvitteringen.
      // Spøkelses-tallet er RIVINGEN, ikke oppbyggingen: bånd-passet er en kø
      // som tar én flis per ledige stund, og den loggen har sin egen linje.
      logPerf(`[tema] ${oldTheme} → ${newTheme}: palett ${tPalett.toFixed(0)} ms `
        + `| lag ${tLag.toFixed(0)} ms | relieff ${tRelieff.toFixed(0)} ms `
        + `| spøkelser (riving) ${tSpokelser.toFixed(0)} ms`)
    })
  }

  watch(currentTheme, onThemeChange)
  onScopeDispose(() => { avbrytEtterspill?.(); avbrytEtterspill = null })

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

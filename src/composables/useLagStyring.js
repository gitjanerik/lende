// Lag-styringen: hvilke kartlag som vises, presets, «nullstill», dybde-laget,
// og selve DOM-arbeidet som slår grupper av og på.
//
// Trukket ut av MapView.vue i v5.8.0. Lag-katalogen (LAYERS, presets, defaults)
// er delt med MCP-serveren — se lib/mapLayerCatalog.js — så drawer-en, chatten
// og `juster_kart` styrer alle det samme settet.
//
// Merk hvorfor `hooks` finnes: å slå et lag på eller av trekker med seg fem
// andre domener (navne-orientering, navne-LOD, dybde, kulturminner,
// vannmålestasjoner), og de eies av andre composables. Ville vi importert dem
// hit, hadde lag-styringen blitt navet i appen igjen — bare i en ny fil. I
// stedet sender MapView inn små tilbakekall, og rekkefølgen holder fordi de
// kalles etter at oppsettet er ferdig.

import { ref, computed, watch, onUnmounted } from 'vue'
import { useMapLayerControl, publiserSynligeLag } from './useMapLayerControl.js'
import {
  LAYERS, MARINE_LAYER_KEYS, DEFAULT_VISIBLE_LAYER_KEYS, LAYER_PRESETS,
} from '../lib/mapLayerCatalog.js'

/**
 * @param {{
 *   svgHostRef: import('vue').Ref,
 *   detachedDetailLayers: () => Array<Element>,   // getter: lista byttes ut
 *                                                 // ved hvert kartbytte
 *   hooks: {
 *     applyUprightLabels: () => void, scheduleNameLOD: () => void,
 *     applyFredetKulturminneLayer: () => void, applyKulturminneFallback: () => void,
 *     applyHydroStationLayer: () => void,
 *   },
 * }} deps
 */
export function useLagStyring({ svgHostRef, detachedDetailLayers, hooks }) {
  const landLayerButtons = LAYERS.filter(l => !MARINE_LAYER_KEYS.has(l.key))
  const marineLayerButtons = LAYERS.filter(l => MARINE_LAYER_KEYS.has(l.key))

  const visibleLayers = ref(new Set(DEFAULT_VISIBLE_LAYER_KEYS))

  const activePreset = computed(() => {
    const cur = visibleLayers.value
    const hit = LAYER_PRESETS.find((p) => p.keys.length === cur.size && p.keys.every((k) => cur.has(k)))
    return hit?.key ?? null
  })
  function applyPreset(p) {
    visibleLayers.value = new Set(p.keys)
    applyLayerVisibility()
  }

  // «Nullstill» er aktiv kun når brukeren har avveket fra default-synligheten
  // (minst ett lag slått til motsatt av sin default-tilstand).
  const layersDirty = computed(() => {
    const cur = visibleLayers.value
    if (cur.size !== DEFAULT_VISIBLE_LAYER_KEYS.length) return true
    for (const k of DEFAULT_VISIBLE_LAYER_KEYS) if (!cur.has(k)) return true
    return false
  })
  function resetLayers() {
    if (!layersDirty.value) return
    visibleLayers.value = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
    applyLayerVisibility()
  }

  function toggleLayer(key) {
    const next = new Set(visibleLayers.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    visibleLayers.value = next
    applyLayerVisibility()
  }

  // Lende-chat (styr_kartlag): chatten leser gjeldende lag herfra og sender en
  // ferdig utregnet liste tilbake. Kartvisningen beholder eierskapet — se
  // useMapLayerControl for hvorfor tilstanden ikke bare er en singleton.
  const { kommando: lagKommando } = useMapLayerControl()
  watch(visibleLayers, (v) => publiserSynligeLag(v), { immediate: true })
  onUnmounted(() => publiserSynligeLag(null))
  watch(lagKommando, (cmd) => {
    if (!cmd) return
    if (cmd.nullstill) visibleLayers.value = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
    else if (Array.isArray(cmd.keys)) visibleLayers.value = new Set(cmd.keys)
    else return
    applyLayerVisibility()
  })

  // Dybde-lag (v11.0.54) — soundings + dybdekurver (Sjøkart) ligger detachet for
  // long-press-inset-en (perf). «Dybde»-toggle (default AV) kloner dem inn som et
  // synlig hovedlag. Kun relevant når kartet faktisk har Sjøkart-dybde
  // (meta.depthSource === 'sjokart'); DEM-estimatet vises uansett som sjø-fyll.
  function applyDepthLayer() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    svg.querySelector('#depth-main-layer')?.remove()
    const detaljLag = detachedDetailLayers()
    if (!visibleLayers.value.has('dybde') || !detaljLag.length) return
    const ns = 'http://www.w3.org/2000/svg'
    const wrap = document.createElementNS(ns, 'g')
    wrap.setAttribute('id', 'depth-main-layer')
    wrap.setAttribute('data-layer', 'dybde')
    wrap.setAttribute('pointer-events', 'none')
    for (const g of detaljLag) {
      const c = g.cloneNode(true)
      c.style.display = ''            // detalj-lagene er display:none — vis dem
      c.removeAttribute('data-detail')
      wrap.appendChild(c)
    }
    // Under navne-labels, over vann/marine — sett inn foran første label-gruppe.
    const before = svg.querySelector('[data-label]')
    if (before) svg.insertBefore(wrap, before)
    else svg.appendChild(wrap)
  }
  function toggleDepth() {
    const next = new Set(visibleLayers.value)
    if (next.has('dybde')) next.delete('dybde'); else next.add('dybde')
    visibleLayers.value = next
    applyDepthLayer()
  }

  function applyLayerVisibility() {
    const root = svgHostRef.value?.querySelector('svg')
    if (!root) return
    for (const lay of LAYERS) {
      // Også spøkelses-nabofliser (data-ghost-layer): de beholder lag-attributtet
      // under et eget navn så lag-toggling når dem, men `[data-layer] path`-perf-
      // regelen (non-scaling-stroke / re-tessellering) IKKE matcher dem.
      const groups = root.querySelectorAll(`[data-layer="${lay.key}"], [data-ghost-layer="${lay.key}"]`)
      for (const g of groups) {
        g.style.display = visibleLayers.value.has(lay.key) ? '' : 'none'
      }
    }
    // Hvis 'navn' er av, skjul også vann-/kontur-/peak-tall (data-label) som
    // ligger inni andre lag-grupper. Da blir Navn-toggle en konsistent
    // "all text on/off"-bryter — men labels inne i 'stedsnavn'-laget styres
    // separat (se applyNameLOD).
    const showLabels = visibleLayers.value.has('navn')
    const labelEls = root.querySelectorAll('[data-label]:not([data-label="stedsnavn"])')
    for (const el of labelEls) {
      el.style.display = showLabels ? '' : 'none'
    }
    // v9.1.10: et lag som nettopp ble slått PÅ kan ha labels med utdatert (eller
    // manglende) counter-rotation siden applyUprightLabels hopper over skjulte
    // lag. Re-orienter nå — billig pga koordinat-cache.
    hooks.applyUprightLabels()
    // Et lag (f.eks. et stedsnavn-nivå) kan nettopp ha blitt slått på/av — la
    // navn-LOD-en revurdere hvilke navn som er overflødige i utsnittet.
    hooks.scheduleNameLOD()
    // Hold dybde-hovedlaget i synk med lag-tilstanden (presets/nullstill kan ha
    // endret 'dybde'); re-injiserer/fjerner #depth-main-layer etter behov.
    applyDepthLayer()
    // Samme for fredet-kulturminne WFS-vektorlaget (injiser/skjul).
    hooks.applyFredetKulturminneLayer()
    // Brukerminne-fallback: hent live hvis laget er på men ingen ikoner er innbakt
    // (typisk mobil der bygge-tids-hentingen glapp).
    hooks.applyKulturminneFallback()
    // Hydrologiske målestasjoner (NVE HydAPI) — injiser/skjul dråpe-laget.
    hooks.applyHydroStationLayer()
  }

  return {
    visibleLayers, landLayerButtons, marineLayerButtons,
    activePreset, layersDirty,
    applyPreset, resetLayers, toggleLayer, toggleDepth,
    applyDepthLayer, applyLayerVisibility,
  }
}

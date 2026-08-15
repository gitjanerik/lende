// Måleverktøyet: distanse langs en linje, areal av et lukket polygon.
//
// Trukket ut av MapView.vue i v5.11.0. Tap-på-kart i denne modusen legger en
// vertex; tegningen av dem bor i useSymbolRenderers (renderMeasure), som får
// `measureVertices`/`measureClosed` inn som deps. Derfor må denne composable-en
// opprettes FØR useSymbolRenderers, og får `renderMeasure` tilbake som et
// tilbakekall — samme mønster som useGpsSpor.
//
// Enhetene er meter fordi koordinatrommet er meter (se CLAUDE.md: viewBox er
// `0 0 widthM heightM`). Ingen projeksjon her — shoelace direkte på svg-punkter.
//
// Måling er gjensidig utelukkende med annotering og med Stifinner mens den
// BLOKKERER (punktvalg). En rute i bruk (`following`) beholdes: å måle noe langs
// en rute man går er en rimelig ting å gjøre.

import { ref, computed, watch } from 'vue'
import { sampleElevation } from '../lib/demSampling.js'

/**
 * @param {{
 *   scale: import('vue').Ref,
 *   dem: () => object|null,
 *   annot: object, sti: object,
 *   hooks: { renderMeasure: () => void, renderRoutes: () => void, ensureDem: () => Promise<boolean> },
 * }} deps
 */
export function useMaaling({ scale, dem, annot, sti, hooks }) {
  const measureMode = ref(false)
  const measureVertices = ref([])
  const measureClosed = ref(false)

  function startMeasure() {
    measureMode.value = true
    measureVertices.value = []
    measureClosed.value = false
    // Høydene i readout-en krever DEM, som hentes lazy. Fire and forget:
    // measureStats er en computed over dem(), så tallene dukker opp når den
    // lander. Uten DEM (ingen WCS-svar) står måling ellers uendret.
    hooks.ensureDem?.()
    // Sørg for at annoterings-/stifinner-modus ikke konkurrerer om tap-eventet.
    // Rute i bruk (following) beholdes — måling skal kunne sameksistere med den.
    annot.selectedSymbol.value = null
    annot.isAnnotateMode.value = false
    if (sti.blocking.value) { sti.cancel(); hooks.renderRoutes() }
  }
  function stopMeasure() {
    measureMode.value = false
    measureVertices.value = []
    measureClosed.value = false
  }
  function clearMeasure() {
    measureVertices.value = []
    measureClosed.value = false
  }
  function closeMeasure() {
    if (measureVertices.value.length >= 3) measureClosed.value = true
  }
  function undoMeasureVertex() {
    if (measureClosed.value) { measureClosed.value = false; return }
    if (measureVertices.value.length === 0) return
    measureVertices.value = measureVertices.value.slice(0, -1)
  }

  // Distanse og areal utledes via computed slik at de re-evaluerer automatisk
  // når vertices endres.
  // Høyde i første og siste punkt, og differansen mellom dem — samme
  // rute-uavhengige A→B-tall som Stifinneren viser (MapView.stiElevationDiffM).
  // DEM-en er sampla i samme svg-meter-rom som punktene. null når kartet mangler
  // DEM eller punktet faller på noData.
  const measureElevation = computed(() => {
    const v = measureVertices.value
    const d = dem?.()
    if (!d || v.length === 0) return { eleA: null, eleB: null, eleDiffM: null }
    const num = (e) => (Number.isFinite(e) ? e : null)
    const eleA = num(sampleElevation(d, v[0].x, v[0].y))
    const last = v[v.length - 1]
    const eleB = v.length < 2 ? null : num(sampleElevation(d, last.x, last.y))
    return {
      eleA, eleB,
      eleDiffM: eleA !== null && eleB !== null ? eleB - eleA : null,
    }
  })

  const measureStats = computed(() => {
    const v = measureVertices.value
    const ele = measureElevation.value
    if (v.length < 2) return { distM: 0, areaM2: 0, ...ele }
    let distM = 0
    for (let i = 1; i < v.length; i++) {
      distM += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y)
    }
    // Lukket polygon: shoelace + closing-edge i distansen.
    let areaM2 = 0
    if (measureClosed.value && v.length >= 3) {
      distM += Math.hypot(v[0].x - v[v.length - 1].x, v[0].y - v[v.length - 1].y)
      let sum = 0
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length]
        sum += a.x * b.y - b.x * a.y
      }
      areaM2 = Math.abs(sum) / 2
    }
    return { distM, areaM2, ...ele }
  })

  // Strekbredden på måle-linja er skjerm-konstant, så et zoom må tegne om.
  watch([measureVertices, measureClosed, scale], () => hooks.renderMeasure(), { deep: true })

  return {
    measureMode, measureVertices, measureClosed, measureStats,
    startMeasure, stopMeasure, clearMeasure, closeMeasure, undoMeasureVertex,
  }
}

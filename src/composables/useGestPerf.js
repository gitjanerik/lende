// Gest-perf: hva vi slår AV mens brukeren drar, pincher eller roterer kartet —
// og målingen som forteller om det hjalp.
//
// Trukket ut av MapView.vue i v5.15.0. Ingenting her er kosmetikk; hver linje er
// et målt tiltak mot hakking på mobil-GPU, og de er lette å «rydde bort» hvis man
// ikke vet hvorfor de finnes:
//
//   • `.is-zooming` overstyrer `vector-effect: non-scaling-stroke` til `none`, så
//     strekene ikke re-tessellerer i device-piksler hver frame. ~3–5× frame-rate
//     på store kart. Strekene «skalerer med» i de 200 ms gesten varer, og snapper
//     tilbake etterpå (v8.10.3).
//   • Relieffet skjules. Et fullkart-<image> med mix-blend-mode må re-komponeres
//     mot bakgrunnen hver frame — blend-mode hindrer billig GPU-lag-isolasjon
//     (v9.1.14). Gjelder ALLE synlige fliser, ellers henger nabofliser igjen med
//     relieff mens aktiv flis flater ut (v10.1.17).
//   • Stiplede streker gjøres solide. På et 10 km-kart blir den merge-de
//     sti-pathen tusenvis av dash-segmenter som reberegnes hver frame — den
//     desidert dyreste enkeltposten (v9.1.15).
//
// Gjenopprettingen er UTSATT ~120 ms med vilje: snap-back-repainten (retessellering
// + dash + relieff-blend) skal ikke lande på samme frame som compositorens siste
// re-raster, og en ny gest innen vinduet kansellerer den helt — rask
// pinch-pinch-pinch betaler én gjenoppretting, ikke tre (v10.2.9).

import { watch, onUnmounted } from 'vue'
import { logPerf } from '../lib/perfLog.js'

const RESTORE_DELAY_MS = 120
// Jank-terskler: kortere gester enn dette sier ingenting om ytelse, og over
// 45 fps er det ikke jank verdt å logge.
const MIN_GEST_MS = 400
const JANK_FPS = 45

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, meta: import('vue').Ref,
 *   isGesturing: import('vue').Ref,
 * }} deps
 */
export function useGestPerf({ svgHostRef, meta, isGesturing }) {
  let gestureRestoreTimer = null

  function setGesturePerfMode(svg, on) {
    if (on) svg.classList.add('is-zooming')
    else svg.classList.remove('is-zooming')
    // Matcher BÅDE <image> (mjuk) og <g> (vektor) ghost-relieff (v11.0.51).
    const reliefImgs = svg.querySelectorAll('#hillshade-layer, #ghost-tiles [data-ghost-relief]')
    for (const hs of reliefImgs) hs.style.visibility = on ? 'hidden' : ''
    // Inline style overstyrer den katalog-genererte data-iso-CSS-en. Gjelder
    // også spøkelses-flisene (data-ghost-layer) av samme grunn.
    const paths = svg.querySelectorAll('[data-layer] path, [data-ghost-layer] path')
    for (const p of paths) p.style.strokeDasharray = on ? 'none' : ''
  }

  watch(isGesturing, (g) => {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    if (gestureRestoreTimer) { clearTimeout(gestureRestoreTimer); gestureRestoreTimer = null }
    if (g) {
      setGesturePerfMode(svg, true)
    } else {
      gestureRestoreTimer = setTimeout(() => {
        gestureRestoreTimer = null
        // Re-query: en silent re-render kan ha byttet SVG-en i mellomtiden.
        const cur = svgHostRef.value?.querySelector('svg')
        if (cur && !isGesturing.value) setGesturePerfMode(cur, false)
      }, RESTORE_DELAY_MS)
    }
  })

  // Gest-jank-måler: teller rAF-frames under aktiv gest og logger til perf-loggen
  // KUN når gesten faktisk hakket — jevne gester skal ikke støye ned ring-
  // bufferen. Verste enkelt-frame-gap avslører om janken er jevnt tung raster
  // eller enkeltstående main-thread-blokkeringer (GC, indeks-pass). Sammen med
  // «[perf] åpne»-linjene gir dette mobil-budsjettet for økt kartstørrelse —
  // leses fra PerfLogModal (Utvikler-fanen).
  let gestFrames = 0
  let gestT0 = 0
  let gestLastT = 0
  let gestWorstGap = 0
  let gestRafId = 0

  function gestRafLoop(t) {
    if (!isGesturing.value) { gestRafId = 0; return }
    if (gestLastT) {
      gestFrames++
      const gap = t - gestLastT
      if (gap > gestWorstGap) gestWorstGap = gap
    }
    gestLastT = t
    gestRafId = requestAnimationFrame(gestRafLoop)
  }

  watch(isGesturing, (g) => {
    if (g) {
      gestFrames = 0
      gestLastT = 0
      gestWorstGap = 0
      gestT0 = performance.now()
      if (!gestRafId) gestRafId = requestAnimationFrame(gestRafLoop)
      return
    }
    if (gestRafId) { cancelAnimationFrame(gestRafId); gestRafId = 0 }
    const durMs = performance.now() - gestT0
    if (durMs < MIN_GEST_MS || gestFrames < 2) return
    const fps = gestFrames / (durMs / 1000)
    if (fps < JANK_FPS) {
      logPerf(
        `[perf] gest ${(durMs / 1000).toFixed(1)}s ~${Math.round(fps)} fps ` +
        `(verste frame ${Math.round(gestWorstGap)}ms) @ ${(meta.value?.widthM ?? 0) / 1000}km`
      )
    }
  })

  onUnmounted(() => {
    if (gestRafId) { cancelAnimationFrame(gestRafId); gestRafId = 0 }
    if (gestureRestoreTimer) clearTimeout(gestureRestoreTimer)
  })

  return { setGesturePerfMode }
}

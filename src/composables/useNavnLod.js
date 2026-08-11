// Navn-LOD: hvilke stedsnavn som får plass i utsnittet.
//
// Trukket ut av MapView.vue i v5.9.0. Selve algoritmen har alltid bodd i
// lib/labelDeclutter.js (ren og enhetstestet); det som lå i MapView — og som er
// her nå — er skjermrom-transformen, boks-målingen og DOM-togglingen.
//
// Kontrakten mot resten av appen, i tre punkter som hver har kostet en bug:
//   1. Alle navn forblir SØKBARE. Søkeindeksen (useMapSearch) leser hele SVG-en
//      uavhengig av denne visnings-LOD-en, og et valgt treff tvinges synlig via
//      `forcedVisibleNameEls`.
//   2. Vi toggler ALDRI geometri. Navngitte polygoner står i søkeindeksen med
//      selve polygonet som `el`; skjuler man dem forsvinner innsjøen, ikke
//      navnet. Se guarden på `path` under.
//   3. Skjulingen skjer med klassen `name-lod-off` (CSS i MapView, IKKE i
//      symbolizer-CSS-en inni SVG-en) — så eksport og print alltid viser alt.

import { ref, watch, onUnmounted } from 'vue'
import { declutter, makeMinZoomOf } from '../lib/labelDeclutter.js'

const DEBOUNCE_MS = 120
const MARGIN_PX = 80        // slingringsmonn så navn rett utenfor kanten teller med

// Klassegruppe for tetthets-budsjettet: topp/vann/område er PRIORITET (utenom
// rutenett-kvoten, men kollisjonssjekkes); bebyggelse/hytte er kvote-styrt.
const PRIORITY_NAME_KINDS = new Set(['vann-navn', 'peak', 'omrade-navn', 'naturreservat-navn'])

function nameGroup(e) {
  if (PRIORITY_NAME_KINDS.has(e.kind)) return 'priority'
  if (e.categories && e.categories.includes('vann')) return 'priority'
  return 'quota'   // stedsnavn, hytte-navn
}

// Score 0–100: les data-score (bakt ved bygging i mapBuilder.labelScore). Fallback
// for eldre kart uten attributtet, utledet fra kind/rank så de fortsatt vrakes ok.
function nameScore(e) {
  if (e._score != null) return e._score
  const raw = e.el?.getAttribute?.('data-score')
  let s = raw != null ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(s)) {
    if (e.kind === 'peak') s = 60
    else if (e.kind === 'vann-navn') s = 55
    else if (e.kind === 'stedsnavn') {
      const r = e.el?.getAttribute('data-rank')
      s = r === 'major' ? 70 : r === 'mid' ? 55 : 35
    } else if (e.kind === 'hytte-navn') s = 20
    else s = 45
  }
  e._score = s
  return s
}

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, wrapperRef: import('vue').Ref,
 *   meta: import('vue').Ref,
 *   scale: import('vue').Ref, rotation: import('vue').Ref,
 *   translateX: import('vue').Ref, translateY: import('vue').Ref,
 *   searchIndex: () => Array|null,          // getter: useMapSearch sin indeks
 *   zoomNearThreshold: import('vue').Ref, zoomedInThreshold: number,
 *   nameBudgetFar: import('vue').Ref, nameBudgetMid: import('vue').Ref,
 *   nameBudgetNear: import('vue').Ref,
 *   nameCellPx: import('vue').Ref, nameK: import('vue').Ref,
 * }} deps
 */
export function useNavnLod({
  svgHostRef, wrapperRef, meta,
  scale, rotation, translateX, translateY,
  searchIndex,
  zoomNearThreshold, zoomedInThreshold,
  nameBudgetFar, nameBudgetMid, nameBudgetNear,
  nameCellPx, nameK,
}) {
  // v11.0.34: budsjettet er zoom-trappet — få navn på oversikt (ren bakgrunn),
  // gradvis flere når man zoomer inn. Tidligere var det fast 200 uansett zoom.
  // v11.0.37: terskel + budsjetter er live-justerbare (useLodTuning, Utvikler-fanen).
  function nameBudgetForZoom() {
    const s = scale.value || 1
    if (s >= zoomNearThreshold.value) return nameBudgetNear.value
    if (s >= zoomedInThreshold) return nameBudgetMid.value
    return nameBudgetFar.value
  }

  const forcedVisibleNameEls = new Set()

  // Label-boks (user-units) måles én gang når labels er synlige, cachet pr element.
  // Re-måles ved kart-load, tekst-skala- og font-bytte (alle endrer boks-bredden).
  const labelBoxCache = new Map()
  function measureLabelBoxes() {
    const idx = searchIndex()
    if (!idx) return
    labelBoxCache.clear()
    for (const e of idx) {
      if (!e.el || typeof e.el.getBBox !== 'function') continue
      let bw = 0, bh = 0
      try { const bb = e.el.getBBox(); bw = bb.width; bh = bb.height } catch { /* display:none → 0 */ }
      if (!(bw > 0) && !(bh > 0)) {
        // Skjult ved måletid → grovt estimat fra navnlengde (kun eldre/skjulte).
        bw = Math.max(8, (e.name?.length || 4) * 4); bh = 6
      }
      labelBoxCache.set(e.el, { bw, bh })
    }
  }

  // Forrige passs synlige navn — hysterese (hindrer blinking ved pan/zoom rundt
  // en LOD-grense). minZoom-tabellen gjenbruker .zoom-near-terskelen.
  let prevShownNames = new Set()
  // Kalles av loadMap (useMapLoadPipeline) ved nytt kart — reassignment kan
  // ikke gjøres gjennom en destrukturert dep.
  function resetPrevShownNames() { prevShownNames = new Set() }
  const nameMinZoomOf = (score) => makeMinZoomOf(zoomNearThreshold.value)(score)

  // Tetthets-budsjett: score → LOD (m/hysterese) → grådig kollisjon (rbush) +
  // rutenett-kvote → synlig-sett. Ren algoritme i lib/labelDeclutter.js; her står
  // kun skjermrom-transformen og DOM-toggling.
  function applyNameLOD() {
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    const idx = searchIndex()
    if (!svg || !m || !idx || !idx.length) return
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!wrap || !wrap.width || !wrap.height) return
    if (!labelBoxCache.size) measureLabelBoxes()

    // Forward-transform viewBox-koordinat → wrapper-lokal skjermpiksel, samme
    // matte som usePinchZoom.panTo: SVG-en fyller wrapperen med
    // preserveAspectRatio="xMidYMid meet", deretter T(tx,ty)∘R(rot)∘S(s).
    const w = wrap.width, h = wrap.height
    const fit = Math.min(w / m.widthM, h / m.heightM)
    const offX = (w - m.widthM * fit) / 2
    const offY = (h - m.heightM * fit) / 2
    const s = scale.value || 1
    const rot = (rotation.value || 0) * Math.PI / 180
    const cos = Math.cos(rot), sin = Math.sin(rot)
    const tx = translateX.value, ty = translateY.value
    const px2 = fit * s // user-units → skjerm-px

    const candidates = []
    for (const e of idx) {
      if (!e.el) continue   // unavngitte vann-polygoner har ingen tekst å toggle
      // ALDRI toggle GEOMETRI: navngitte polygoner (data-name på <path>) står i
      // søkeindeksen med selve polygonet som el. NVE-innsjøer fikk ingen egen
      // vann-navn-tekst (navn-taggen ble ikke lest av lakeLabels) → indeksen
      // beholdt POLYGONET som toggle-mål, og navn-LOD-en skjulte hele innsjøen
      // når navnet tapte declutter-budsjettet. Det var «vannet forsvinner ved
      // zoom/pan»-saken (2026-07-21): blått ved 200 m (raust budsjett), borte i
      // oversikt, flimret ved panorering. Navn-LOD skal kun styre etiketter
      // (<text>/<g>-grupper) — geometri er alltid synlig.
      if ((e.el.tagName ?? '').toLowerCase() === 'path') continue
      const px = offX + e.x * fit
      const py = offY + e.y * fit
      const sx = tx + s * (px * cos - py * sin)
      const sy = ty + s * (px * sin + py * cos)
      if (sx < -MARGIN_PX || sx > w + MARGIN_PX || sy < -MARGIN_PX || sy > h + MARGIN_PX) {
        continue   // utenfor synlig utsnitt — teller ikke, rør ikke klassen
      }
      const box = labelBoxCache.get(e.el) || { bw: 8, bh: 6 }
      // Skjerm-AABB av (kart-rotert) label-boks.
      const hw = (box.bw * px2) / 2
      const hh = (box.bh * px2) / 2
      candidates.push({
        id: e.name || `${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`,
        el: e.el,
        score: nameScore(e),
        sx, sy,
        halfW: Math.abs(hw * cos) + Math.abs(hh * sin),
        halfH: Math.abs(hw * sin) + Math.abs(hh * cos),
        group: nameGroup(e),
        forced: forcedVisibleNameEls.has(e.el),
      })
    }

    const visible = declutter(candidates, {
      cellPx: nameCellPx.value,
      K: nameK.value,
      scale: s,
      minZoomOf: nameMinZoomOf,
      prevShown: prevShownNames,
      maxVisible: nameBudgetForZoom(),   // globalt tak (Utvikler-budsjett)
    })

    for (const c of candidates) {
      c.el.classList.toggle('name-lod-off', !visible.has(c.id))
    }
    prevShownNames = visible
  }

  let nameLodTimer = null
  function scheduleNameLOD() {
    if (nameLodTimer) clearTimeout(nameLodTimer)
    nameLodTimer = setTimeout(applyNameLOD, DEBOUNCE_MS)
  }

  // Re-beregn LOD når utsnittet endrer seg (zoom/pan/rotasjon, gest eller
  // programmatisk). Debouncet så en pågående gest ikke beregner per frame.
  watch([scale, translateX, translateY, rotation], scheduleNameLOD)
  // Budsjett-knottene i Utvikler-fanen skal virke live.
  watch([nameBudgetFar, nameBudgetMid, nameBudgetNear], scheduleNameLOD)

  // Vinduet endret størrelse → andre navn får plass.
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleNameLOD)
    onUnmounted(() => window.removeEventListener('resize', scheduleNameLOD))
  }
  onUnmounted(() => { if (nameLodTimer) clearTimeout(nameLodTimer) })

  return {
    forcedVisibleNameEls, labelBoxCache,
    resetPrevShownNames, applyNameLOD, scheduleNameLOD,
  }
}

// Eksponert for test: budsjett-gruppering og score-fallback er de to stedene en
// endring i katalogen kan gi stille feil valg av navn.
export const _internals = { nameGroup, nameScore, PRIORITY_NAME_KINDS }

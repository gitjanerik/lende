// Viewport-culling: skjul vektorer utenfor utsnittet («out of sight, out of mind»).
//
// Trukket ut av MapView.vue i v5.9.0. Rekt-matematikken og diffen bor i
// lib/viewportCull.js; her står DOM-indekseringen, hysteresen og klasse-togglingen.
//
// Hvor gevinsten IKKE ligger: pan/zoom er en CSS-transform på en composited
// wrapper, så selve panningen er gratis (compositoren flytter en ferdig tekstur).
// Gevinsten er i RE-RASTER: pinch-zoom, gest-slutt-repaint (non-scaling-stroke og
// dash snapper tilbake), lag-toggles og rastermninne. Cull-rekta er derfor
// viewporten ekspandert med raus margin, så normale pans avdekker allerede-tegnet
// innhold momentant uten JS; re-beregning skjer bare når utsnittet rømmer forrige
// margin (needsRecull) — og aldri midt i en gest, der framen uansett betaler for
// snap-back-repainten.
//
// Skjules med klassen `vp-cull` (CSS i MapView, IKKE i symbolizer-CSS-en inni
// SVG-en — så eksport og print alltid viser alt, samme kontrakt som
// `.name-lod-off`). Per-element-klasse kolliderer aldri med applyLayerVisibility,
// som setter style.display på hele lag-grupper: et element vises kun når laget er
// på OG det ikke er cullet OG ikke LOD-skjult.
//
// Kill switch: localStorage 'vp-cull-off' = '1' (også som knapp i Utvikler-fanen).
// Debug-tint (vis i rødt i stedet for å skjule): localStorage 'cull-debug' = '1'.

import { ref, watch, onUnmounted } from 'vue'
import {
  viewRectSvg, expandRect, rectContains, buildCullIndex,
  needsRecull, computeCullDiff, parseBboxAttr,
} from '../lib/viewportCull.js'

const DEBOUNCE_MS = 120

function lesFlagg(nøkkel) {
  try { return localStorage.getItem(nøkkel) === '1' } catch { return false }
}

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, wrapperRef: import('vue').Ref,
 *   meta: import('vue').Ref,
 *   scale: import('vue').Ref, rotation: import('vue').Ref,
 *   translateX: import('vue').Ref, translateY: import('vue').Ref,
 *   isGesturing: import('vue').Ref,
 * }} deps
 */
export function useViewportCull({
  svgHostRef, wrapperRef, meta,
  scale, rotation, translateX, translateY, isGesturing,
}) {
  const cullDisabled = ref(lesFlagg('vp-cull-off'))
  const cullDebugTint = lesFlagg('cull-debug')
  const cullStats = ref({ indexed: 0, culled: 0, ms: 0 })

  let cullIndex = null
  let cullPrevVisible = null
  let cullPrevState = null
  let cullTimer = null

  function resetViewportCull() {
    cullIndex = null
    cullPrevVisible = null
    cullPrevState = null
    cullStats.value = { indexed: 0, culled: 0, ms: 0 }
  }

  // Bygg rbush-indeksen fra den aktive flisas SVG-DOM. Billige bbokser uten
  // getBBox() (som tvinger layout): data-bbox-attributtet (Fase B, eksakt),
  // ellers punkt + raus pad fra translate-grupper og text-x/y. Elementer uten
  // noen av delene indekseres ikke = culles aldri (graceful for gamle lagrede
  // kart). Spøkelses-fliser har data-ghost-layer, ikke data-layer, så
  // `[data-layer]`-scopingen holder dem (og user-layer/overlays) utenfor.
  function buildCullDomIndex() {
    resetViewportCull()
    if (cullDisabled.value) return
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svg || !m) return
    if (cullDebugTint) svg.classList.add('cull-debug-tint')
    // Pad for punkt-indekserte elementer: skal dekke symbolets/tekstens visuelle
    // utstrekning i meter. Labels skalerer med kartstørrelse (labelScale i
    // symbolizer ∝ widthM/4000), så padden gjør det også. Raus pad koster bare
    // litt culling-effektivitet — for liten pad gir synlig popping i kanten.
    const padM = Math.max(80, m.widthM * 0.03)
    const entries = []
    const seen = new Set()
    const pushEntry = (el, rect) => {
      if (seen.has(el)) return
      seen.add(el)
      entries.push({ ...rect, el })
    }
    const translatePoint = (el) => {
      const mt = /translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)/.exec(el.getAttribute('transform') ?? '')
      return mt ? { x: Number(mt[1]), y: Number(mt[2]) } : null
    }
    // 1) Eksakte bbokser fra mapBuilder (Fase B): bucket-paths + standalone-paths.
    for (const el of svg.querySelectorAll('[data-layer] [data-bbox]')) {
      const rect = parseBboxAttr(el.getAttribute('data-bbox'))
      if (rect) pushEntry(el, rect)
    }
    // 2) Punkt-symboler i translate-grupper (parkering, holdeplass, sjø-POI,
    //    hule/gruve/kirke/bom etter posisjons-fiksen) + navn-grupper.
    for (const el of svg.querySelectorAll('[data-layer] g[transform^="translate"]')) {
      if (seen.has(el)) continue
      // Hopp over grupper inni allerede-indekserte elementer (data-bbox-foreldre).
      if (el.parentElement?.closest?.('[data-bbox]')) continue
      const p = translatePoint(el)
      if (p) pushEntry(el, { minX: p.x - padM, minY: p.y - padM, maxX: p.x + padM, maxY: p.y + padM })
    }
    // 3) Frittstående tekst-labels (stedsnavn, vann-navn, kontur-tall, dybde).
    for (const el of svg.querySelectorAll('[data-layer] text')) {
      if (seen.has(el)) continue
      // Tekst inni en allerede-indeksert gruppe følger gruppens synlighet.
      let anc = el.parentElement, covered = false
      while (anc && anc !== svg) { if (seen.has(anc)) { covered = true; break } anc = anc.parentElement }
      if (covered) continue
      const x = Number(el.getAttribute('x'))
      const y = Number(el.getAttribute('y'))
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      pushEntry(el, { minX: x - padM, minY: y - padM, maxX: x + padM, maxY: y + padM })
    }
    if (!entries.length) return
    cullIndex = buildCullIndex(entries)
    cullStats.value = { indexed: entries.length, culled: 0, ms: 0 }
  }

  function applyViewportCull(force = false) {
    if (cullDisabled.value || !cullIndex) return
    const m = meta.value
    const wrap = wrapperRef.value?.getBoundingClientRect()
    const svg = svgHostRef.value?.querySelector('svg')
    if (!m || !wrap || !wrap.width || !wrap.height || !svg) return
    const t0 = performance.now()
    const view = viewRectSvg({
      w: wrap.width, h: wrap.height, widthM: m.widthM, heightM: m.heightM,
      scale: scale.value, rotation: rotation.value,
      tx: translateX.value, ty: translateY.value,
    })
    if (!view) return
    if (!force && !needsRecull(cullPrevState, view, scale.value)) return
    const expanded = expandRect(view)
    // Utzoomet: dekker cull-rekta hele kartet (og gjorde det også sist), er
    // ingenting cullet og ingenting å gjøre — null arbeid ved oversikts-zoom.
    const mapRect = { minX: 0, minY: 0, maxX: m.widthM, maxY: m.heightM }
    if (rectContains(expanded, mapRect) && cullPrevState?.coveredAll &&
        cullPrevVisible && cullPrevVisible.size === cullStats.value.indexed) {
      cullPrevState = { viewRect: view, expandedRect: expanded, scale: scale.value, coveredAll: true }
      return
    }
    const { show, hide, visible } = computeCullDiff(cullIndex, expanded, cullPrevVisible)
    cullPrevVisible = visible
    cullPrevState = {
      viewRect: view, expandedRect: expanded, scale: scale.value,
      coveredAll: rectContains(expanded, mapRect),
    }
    if (show.length || hide.length) {
      requestAnimationFrame(() => {
        for (const el of show) el.classList.remove('vp-cull')
        for (const el of hide) el.classList.add('vp-cull')
      })
    }
    cullStats.value = {
      indexed: cullStats.value.indexed,
      culled: Math.max(0, cullStats.value.indexed - visible.size),
      ms: Math.round((performance.now() - t0) * 10) / 10,
    }
  }

  // Runtime-bryter i Utvikler-fanen: slå culling AV uten reload for å avgjøre
  // på stedet om «forsvunnet innhold» skyldes culling (av → innholdet tilbake
  // umiddelbart = culling er synderen) eller kart-dataene selv. Valget
  // persisteres (vp-cull-off) så det overlever reload/nybygg under feilsøk.
  function toggleCull() {
    const off = !cullDisabled.value
    cullDisabled.value = off
    try {
      if (off) localStorage.setItem('vp-cull-off', '1')
      else localStorage.removeItem('vp-cull-off')
    } catch { /* noop */ }
    if (off) {
      const svg = svgHostRef.value?.querySelector('svg')
      if (svg) for (const el of svg.querySelectorAll('.vp-cull')) el.classList.remove('vp-cull')
      resetViewportCull()
    } else {
      buildCullDomIndex()
      applyViewportCull(true)
    }
  }

  function scheduleViewportCull() {
    if (cullTimer) clearTimeout(cullTimer)
    cullTimer = setTimeout(() => {
      // Aldri midt i en gest: en klasse-toggle der ville tvinge en unødig paint-
      // invalidasjon. Gest-slutt-watcheren tar den i stedet.
      if (!isGesturing.value) applyViewportCull()
    }, DEBOUNCE_MS)
  }

  watch([scale, translateX, translateY, rotation], scheduleViewportCull)
  watch(isGesturing, (g) => { if (!g) applyViewportCull() })
  onUnmounted(() => { if (cullTimer) clearTimeout(cullTimer) })

  return {
    cullStats, cullDisabled, toggleCull,
    buildCullDomIndex, applyViewportCull, resetViewportCull,
  }
}

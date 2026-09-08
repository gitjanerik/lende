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
// ── SPØKELSES-FLISENE CULLES OGSÅ, OG DE HAR SIN EGEN INDEKS (v6.5.73) ──────
// Fram til nå stanset cullingen ved `[data-layer]`, altså aktiv flis. På en
// mosaikk er det den MINSTE halvparten av dokumentet: feste-passet i
// useGhostTiles holder utsnittet pluss ÉN FLIS I HVER RETNING i DOM-en, så et
// 3 × 3-ark har åtte naboer som rendres i sin helhet uansett hvor man står.
// Naboene har dessuten `data-ghost-layer` og ikke `data-layer`, så de faller
// også utenfor `content-visibility: auto`-regelen i MapView — de er den ene
// store flaten i kartet uten noen form for av-skjerm-avlastning.
//
// To nivåer, fordi de koster helt ulikt:
//   HEL FLIS   ligger flisa utenfor cull-rekta, får ROT-noden `vp-cull`. Én
//              klasse, ingen DOM-skanning, hele flisa ut av layout og paint.
//              Dette er den ringen feste-passet med vilje holder festet.
//   PER ELEMENT ligger flisa DELVIS inne, indekseres den som aktiv flis og
//              diffes mot sitt eget synlighets-sett.
//
// Første pass for en flis males ABSOLUTT og ikke som en diff — se ghostCullPass.
//
// Indeksen er PER FLIS og caches på selve noden (WeakMap): en flis som løsner og
// festes igjen skal ikke skanne DOM-en på nytt — det er nøyaktig kostnaden
// feste-passet finnes for å unngå. Bboksene lagres FERDIG FORSKJØVET til aktiv
// flis' meter-rom (ghostFlisRom), så søket kan bruke den samme cull-rekta.
// Cachen dør med noden, som er riktig: en ny `buildGhostSvg` gir et nytt element.
//
// Eksport-kontrakten holder for spøkelsene også, og det er verdt å vite hvorfor
// den ikke er en tilfeldighet: `mapSvgTilesFor3d` KLONER hver flis og baker den
// med sitt eget stilark, `featuresFromSvg` og nabo-søkeindeksen leser
// ATTRIBUTTER. Ingen av dem ser en CSS-regel som bare finnes i MapView, så
// `medAlleSpokelserFestet`-vinduet trenger ingen opprydning.
//
// Kill switch: localStorage 'vp-cull-off' = '1' (også som knapp i Utvikler-fanen).
// Debug-tint (vis i rødt i stedet for å skjule): localStorage 'cull-debug' = '1'.

import { ref, watch, onUnmounted } from 'vue'
import {
  viewRectSvg, expandRect, rectContains, rectsOverlap, buildCullIndex,
  needsRecull, computeCullDiff, parseBboxAttr, ghostFlisRom,
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
  const cullStats = ref({
    indexed: 0, culled: 0, ms: 0,
    ghostFliser: 0, ghostHele: 0, ghostIndeksert: 0, ghostCulled: 0,
  })

  let cullIndex = null
  let cullPrevVisible = null
  let cullPrevState = null
  let cullTimer = null
  // Per spøkelses-flis: { index, antall, prevVisible, gen }. WeakMap-en holder
  // ikke noden i live — den dør med `buildGhostSvg`-elementet den hører til.
  const ghostCache = new WeakMap()
  // Generasjonsteller: bumpes av resetViewportCull. Et cachet synlighets-sett er
  // bare sant så lenge klassene i DOM-en stemmer med det, og en reset (kartbytte,
  // kill switch) tørker klassene bort uten å røre cachen.
  let ghostGen = 0

  function resetViewportCull() {
    cullIndex = null
    cullPrevVisible = null
    cullPrevState = null
    ghostGen++
    cullStats.value = {
      indexed: 0, culled: 0, ms: 0,
      ghostFliser: 0, ghostHele: 0, ghostIndeksert: 0, ghostCulled: 0,
    }
  }

  // Skann ett SVG-rot og gi entries i AKTIV flis' meter-rom. Billige bbokser uten
  // getBBox() (som tvinger layout): data-bbox-attributtet (Fase B, eksakt),
  // ellers punkt + raus pad fra translate-grupper og text-x/y. Elementer uten
  // noen av delene indekseres ikke = culles aldri (graceful for gamle lagrede
  // kart). `lagAttr` skiller aktiv flis (`data-layer`) fra spøkelser
  // (`data-ghost-layer`), og (dx, dy) er flisas forskyvning — 0 for aktiv flis.
  function samleCullEntries(rot, lagAttr, padM, dx = 0, dy = 0) {
    const entries = []
    const seen = new Set()
    const pushEntry = (el, rect) => {
      if (seen.has(el)) return
      seen.add(el)
      entries.push({
        minX: rect.minX + dx, minY: rect.minY + dy,
        maxX: rect.maxX + dx, maxY: rect.maxY + dy, el,
      })
    }
    const translatePoint = (el) => {
      const mt = /translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)/.exec(el.getAttribute('transform') ?? '')
      return mt ? { x: Number(mt[1]), y: Number(mt[2]) } : null
    }
    // 1) Eksakte bbokser fra mapBuilder (Fase B): bucket-paths + standalone-paths.
    for (const el of rot.querySelectorAll(`[${lagAttr}] [data-bbox]`)) {
      const rect = parseBboxAttr(el.getAttribute('data-bbox'))
      if (rect) pushEntry(el, rect)
    }
    // 2) Punkt-symboler i translate-grupper (parkering, holdeplass, sjø-POI,
    //    hule/gruve/kirke/bom etter posisjons-fiksen) + navn-grupper.
    for (const el of rot.querySelectorAll(`[${lagAttr}] g[transform^="translate"]`)) {
      if (seen.has(el)) continue
      // Hopp over grupper inni allerede-indekserte elementer (data-bbox-foreldre).
      if (el.parentElement?.closest?.('[data-bbox]')) continue
      const p = translatePoint(el)
      if (p) pushEntry(el, { minX: p.x - padM, minY: p.y - padM, maxX: p.x + padM, maxY: p.y + padM })
    }
    // 3) Frittstående tekst-labels (stedsnavn, vann-navn, kontur-tall, dybde).
    for (const el of rot.querySelectorAll(`[${lagAttr}] text`)) {
      if (seen.has(el)) continue
      // Tekst inni en allerede-indeksert gruppe følger gruppens synlighet.
      let anc = el.parentElement, covered = false
      while (anc && anc !== rot) { if (seen.has(anc)) { covered = true; break } anc = anc.parentElement }
      if (covered) continue
      const x = Number(el.getAttribute('x'))
      const y = Number(el.getAttribute('y'))
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      pushEntry(el, { minX: x - padM, minY: y - padM, maxX: x + padM, maxY: y + padM })
    }
    return entries
  }

  // Pad for punkt-indekserte elementer: skal dekke symbolets/tekstens visuelle
  // utstrekning i meter. Labels skalerer med kartstørrelse (labelScale i
  // symbolizer ∝ widthM/4000), så padden gjør det også. Raus pad koster bare
  // litt culling-effektivitet — for liten pad gir synlig popping i kanten.
  function cullPad(m) { return Math.max(80, m.widthM * 0.03) }

  // Bygg rbush-indeksen fra den aktive flisas SVG-DOM. Spøkelses-flisene har
  // data-ghost-layer og indekseres hver for seg (ghostCullPass) — de kommer og
  // går i DOM-en uavhengig av kartbytter, så de kan ikke ligge i denne indeksen.
  function buildCullDomIndex() {
    resetViewportCull()
    if (cullDisabled.value) return
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svg || !m) return
    if (cullDebugTint) svg.classList.add('cull-debug-tint')
    const entries = samleCullEntries(svg, 'data-layer', cullPad(m))
    if (!entries.length) return
    cullIndex = buildCullIndex(entries)
    cullStats.value = { ...cullStats.value, indexed: entries.length, culled: 0, ms: 0 }
  }

  // Spøkelses-passet. Returnerer tellerne til cullStats og skyver klasse-
  // endringene inn i show/hide-listene kalleren maler i én rAF.
  function ghostCullPass(svg, expanded, show, hide) {
    const tall = { ghostFliser: 0, ghostHele: 0, ghostIndeksert: 0, ghostCulled: 0 }
    const container = svg.querySelector('#ghost-tiles')
    const m = meta.value
    if (!container || !m) return tall
    const padM = cullPad(m)
    for (const el of container.children) {
      if ((el.tagName ?? '').toLowerCase() !== 'svg') continue
      tall.ghostFliser++
      const rom = ghostFlisRom({
        x: el.getAttribute('x'), y: el.getAttribute('y'),
        width: el.getAttribute('width'), height: el.getAttribute('height'),
        viewBox: el.getAttribute('viewBox'),
      })
      if (!rom) continue
      // Hel flis utenfor cull-rekta: én klasse på rota, ingen skanning.
      if (!rectsOverlap(rom.rect, expanded)) {
        hide.push(el)
        tall.ghostHele++
        continue
      }
      show.push(el)
      let c = ghostCache.get(el)
      if (!c) {
        const entries = samleCullEntries(el, 'data-ghost-layer', padM, rom.dx, rom.dy)
        c = {
          index: entries.length ? buildCullIndex(entries) : null,
          alle: entries.map((e) => e.el), prevVisible: null, gen: ghostGen,
        }
        ghostCache.set(el, c)
      }
      if (c.gen !== ghostGen) { c.prevVisible = null; c.gen = ghostGen }
      if (!c.index) continue
      tall.ghostIndeksert += c.alle.length
      const d = computeCullDiff(c.index, expanded, c.prevVisible)
      // FØRSTE pass for denne flisa males ABSOLUTT, ikke som en diff. En diff mot
      // `null` gir per definisjon et tomt `hide` (computeCullDiff kan bare skjule
      // det som VAR synlig), og en fersk spøkelses-flis festes med rene noder —
      // så en diff ville latt hele flisa stå tegnet til brukeren beveget seg.
      // Aktiv flis slipper unna det fordi dens første pass alltid skjer på
      // oversikts-zoom, der alt er synlig uansett; en flis som festes MENS man
      // står dypt inne i kartet har ingen slik åpning.
      if (c.prevVisible) {
        for (const e of d.show) show.push(e)
        for (const e of d.hide) hide.push(e)
      } else {
        for (const e of c.alle) (d.visible.has(e) ? show : hide).push(e)
      }
      c.prevVisible = d.visible
      tall.ghostCulled += Math.max(0, c.alle.length - d.visible.size)
    }
    return tall
  }

  function applyViewportCull(force = false) {
    if (cullDisabled.value) return
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
    const show = []
    const hide = []
    // Spøkelsene FØRST, og uavhengig av om aktiv flis har en indeks: et gammelt
    // lagret kart uten data-bbox gir `cullIndex === null`, og mosaikken rundt det
    // skal like fullt culles.
    const ghostTall = ghostCullPass(svg, expanded, show, hide)
    const mapRect = { minX: 0, minY: 0, maxX: m.widthM, maxY: m.heightM }
    // Utzoomet: dekker cull-rekta hele kartet (og gjorde det også sist), er
    // ingenting cullet i aktiv flis og ingenting å gjøre — null arbeid ved
    // oversikts-zoom.
    const aktivFerdig = !cullIndex || (
      rectContains(expanded, mapRect) && cullPrevState?.coveredAll &&
      cullPrevVisible && cullPrevVisible.size === cullStats.value.indexed
    )
    let synlige = cullPrevVisible
    if (!aktivFerdig) {
      const d = computeCullDiff(cullIndex, expanded, cullPrevVisible)
      cullPrevVisible = d.visible
      synlige = d.visible
      for (const el of d.show) show.push(el)
      for (const el of d.hide) hide.push(el)
    }
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
      culled: Math.max(0, cullStats.value.indexed - (synlige?.size ?? cullStats.value.indexed)),
      ms: Math.round((performance.now() - t0) * 10) / 10,
      ...ghostTall,
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

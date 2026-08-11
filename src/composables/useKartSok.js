// Søk i kartet: fritekst-treff, highlight-ringen, og å sentrere treffet
// robust — også når mobil-tastaturet står i veien.
//
// Trukket ut av MapView.vue i v5.13.0. Indeksen og treff-matchingen bor i
// useMapSearch; her er UI-tilstanden, valget av et treff, og `panToSettled`.
//
// Den siste er verdt å lese før du rører den. Med
// `interactive-widget=resizes-content` (v12.1.25) er layout-viewporten KRYMPET
// mens søke-tastaturet står oppe, så et panTo som måler wrapperen da legger
// treffet nederst i utsnittet idet tastaturet lukkes. Forsøk nr. 1 (v12.1.29)
// gatet på `document.activeElement`, men på Android blurres søkefeltet allerede
// av TAP-et på resultatknappen — før click-handleren kjører — så gaten slo aldri
// inn. Løsningen er timing-uavhengig: pan straks (responsivt), og RE-pan til
// samme mål hver gang wrapper-størrelsen faktisk endrer seg (ResizeObserver =
// tastaturet lukket seg), debounced til ro, avbrutt hvis brukeren gestikulerer,
// og auto-stoppet etter 1,5 s. Uten tastatur skjer ingen resize → ingen ekstra pan.
//
// Det GLOBALE stedssøket (Kartverket SSR + Nominatim) blir i MapView med vilje:
// å velge et globalt treff BYGGER ET NYTT KART, og hører til bygge-domenet, ikke
// til søket. Herfra kalles bare `hooks.clearGlobalSearch()`.

import { ref, onUnmounted } from 'vue'
import { useMapSearch } from './useMapSearch.js'
import { useSearchKeyboard } from './useSearchKeyboard.js'

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, wrapperRef: import('vue').Ref,
 *   meta: import('vue').Ref, scale: import('vue').Ref,
 *   isGesturing: import('vue').Ref, zoomNearThreshold: import('vue').Ref,
 *   panTo: (x: number, y: number, opts?: object) => void,
 *   forcedVisibleNameEls: () => Set,   // getter: eies av useNavnLod (deklareres senere)
 *   hooks: {
 *     renderHighlight: () => void, closeDrawer: () => void,
 *     clearGlobalSearch: () => void,
 *   },
 * }} deps
 */
export function useKartSok({
  svgHostRef, wrapperRef, meta, scale, isGesturing, zoomNearThreshold,
  panTo, forcedVisibleNameEls, hooks,
}) {

  // Søk i kart — bygger indeks etter map-load, viser dropdown med treff og
  // sentrerer på valgte stedsnavn. Highlight-ringen sitter til brukeren tømmer
  // søket eller scroller bort.
  const mapSearch = useMapSearch()
  // Destrukturér refs så template auto-unwrapper dem (Vue auto-unwrapper kun
  // top-level setup-refs, ikke properties på ett objekt).
  const searchQuery = mapSearch.query
  const searchResults = mapSearch.results
  const searchIndex = mapSearch.index
  const searchOpen = ref(false)
  const highlightedFeature = ref(null)   // { name, x, y, kind } eller null

  function openSearch() {
    searchOpen.value = true
    hooks.closeDrawer()
    // Fokus håndteres av MapSearchOverlay når open blir true.
  }
  function closeSearch() {
    searchOpen.value = false
    mapSearch.clear()
    hooks.clearGlobalSearch()
  }
  function clearHighlight() {
    highlightedFeature.value = null
    hooks.renderHighlight()
  }
  // Sentrer et søketreff robust mot tastatur-resize (v12.1.30). Med viewport-
  // metaen interactive-widget=resizes-content (v12.1.25) er layout-viewporten
  // KRYMPET mens søke-tastaturet står oppe — panTo som måler wrapperen da,
  // legger treffet nederst i utsnittet idet tastaturet lukkes. Forrige forsøk
  // (v12.1.29) gatet på document.activeElement, men på Android blurres søke-
  // feltet allerede av TAP-et på resultatknappen (før click-handleren kjører),
  // så gaten slo aldri inn. Nå timing-uavhengig: pan straks (responsivt), og
  // RE-pan til samme mål hver gang wrapper-størrelsen faktisk endrer seg
  // (ResizeObserver = tastaturet lukkes), debounced til ro. Avbrytes hvis
  // brukeren gestikulerer; auto-stopp etter 1,5 s. Uten tastatur skjer ingen
  // resize → ingen ekstra pan.
  let settleObserver = null
  let settleTimer = null
  let settleStopTimer = null
  function stopPanSettle() {
    settleObserver?.disconnect()
    settleObserver = null
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
    if (settleStopTimer) { clearTimeout(settleStopTimer); settleStopTimer = null }
  }
  function panToSettled(x, y, opts) {
    stopPanSettle()
    panTo(x, y, opts)
    const el = wrapperRef.value
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastH = el.getBoundingClientRect().height
    settleObserver = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      if (Math.abs(h - lastH) < 1) return      // initial-notify / uendret
      lastH = h
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        if (!isGesturing.value) panTo(x, y, opts)
      }, 120)
    })
    settleObserver.observe(el)
    settleStopTimer = setTimeout(stopPanSettle, 1500)
  }

  function selectSearchResult(r) {
    highlightedFeature.value = { name: r.name, x: r.x, y: r.y, kind: r.kind }
    // Et navn som velges i søk skal alltid være synlig, selv om navn-LOD-en
    // hadde skjult det i oversikten. Lås det til synlig (til neste rebuild).
    if (r.el) {
      forcedVisibleNameEls().add(r.el)
      r.el.classList.remove('name-lod-off')
      // Treffet kan også være viewport-cullet (utenfor utsnittet) — panTo
      // flytter dit og recull viser det, men fjern klassen alt nå så
      // highlighten aldri peker på et usynlig element.
      r.el.classList.remove('vp-cull')
    }
    if (meta.value) {
      panToSettled(r.x, r.y, { vbWidth: meta.value.widthM, vbHeight: meta.value.heightM, targetScale: Math.max(scale.value, zoomNearThreshold.value) })
    }
    searchOpen.value = false
    mapSearch.clear()
    hooks.clearGlobalSearch()
    hooks.renderHighlight()
  }

  // Globalt treff valgt (utenfor dette kartet) → bygg et nytt kart sentrert der.
  // Tastaturnavigasjon (desktop): pil ned/opp markerer, Enter velger, Escape
  // nullstiller søkebegrepet. Fokus blir i input-en så Escape alltid virker.
  const { activeIndex: searchActiveIndex, onKeydown: onSearchKeydown } = useSearchKeyboard(searchResults, {
    onSelect: selectSearchResult,
    onClear: () => mapSearch.clear(),
    optionId: (i) => `mapsearch-opt-${i}`,
  })
  onUnmounted(stopPanSettle)

  return {
    mapSearch, searchQuery, searchResults, searchIndex,
    searchOpen, highlightedFeature,
    openSearch, closeSearch, clearHighlight,
    panToSettled, stopPanSettle, selectSearchResult,
    searchActiveIndex, onSearchKeydown,
  }
}

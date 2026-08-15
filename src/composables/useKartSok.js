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
//
// ── Hele arket, ikke bare midtflisa (v5.19.x) ───────────────────────────────
// Brukeren bygger nabofliser bare ved å panorere, og et søk som stoppet ved
// aktiv flis fant ikke stedet de nettopp så på skjermen. Nabo-indeksen bygges
// derfor av navnelabelene i `#ghost-tiles` (useMapSearch.rebuildNabo).
//
// To ting styrer NÅR den bygges, og begge er valgt for ytelse:
//   1. Ikke i `scheduleDeferredMapPasses`. Det passet eier første-paint-budsjettet,
//      og fire til tolv fliser til der er akkurat den regningen ingen vil ha.
//      Nabo-indeksen trengs først når noen søker — så den bygges ved ÅPNING.
//   2. Inne i `medAlleFliser` (useGhostTiles.medAlleSpokelserFestet). En flis
//      kan være DEMONTERT fra DOM-en (v5.19.0); uten dette vinduet ville søket
//      bare funnet det som tilfeldigvis var festet i utsnittet. Den SYNKRONE
//      varianten er valgt med vilje — den asynkrone parser fliser fra IndexedDB
//      på nytt (multi-MB DOMParser per flis), og det er for dyrt for en handling
//      som skal føles umiddelbar. Fliser utenfor node-taket kommer med neste
//      gang de er parset.

import { ref, onUnmounted } from 'vue'
import { useMapSearch } from './useMapSearch.js'
import { useSearchKeyboard } from './useSearchKeyboard.js'
import { logPerf } from '../lib/perfLog.js'

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, wrapperRef: import('vue').Ref,
 *   meta: import('vue').Ref, scale: import('vue').Ref,
 *   isGesturing: import('vue').Ref, zoomNearThreshold: import('vue').Ref,
 *   panTo: (x: number, y: number, opts?: object) => void,
 *   forcedVisibleNameEls: () => Set,   // getter: eies av useNavnLod (deklareres senere)
 *   medAlleFliser?: (fn: Function) => any,  // wrapper: eies av useGhostTiles (deklareres senere)
 *   hooks: {
 *     renderHighlight: () => void, closeDrawer: () => void,
 *     clearGlobalSearch: () => void,
 *   },
 * }} deps
 */
export function useKartSok({
  svgHostRef, wrapperRef, meta, scale, isGesturing, zoomNearThreshold,
  panTo, forcedVisibleNameEls, medAlleFliser, hooks,
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
  // Hele arket (aktiv flis + nabofliser). Det er DENNE trefflista filtreres mot;
  // `searchIndex` er fortsatt aktiv flis alene, fordi navn-LOD-en bruker den som
  // tetthets-budsjett og aldri skal se nestede spøkelses-elementer.
  const arkIndex = mapSearch.arkIndex
  const searchOpen = ref(false)
  const highlightedFeature = ref(null)   // { name, x, y, kind } eller null

  // Indekser naboflisene. Synkron DOM-lesing (ingen getBBox, bare attributter),
  // så den koster ikke noe nær et layout-pass — men den MÅ kjøre inne i
  // gjenfestings-vinduet, ellers ser den bare de festede flisene.
  function rebuildNaboIndeks() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return 0
    const t0 = performance.now()
    const kjor = () => mapSearch.rebuildNabo(svg)
    const antall = typeof medAlleFliser === 'function' ? medAlleFliser(kjor) : kjor()
    logPerf(`[søk] naboindeks: ${Math.round(performance.now() - t0)} ms, ${antall} navn`)
    return antall
  }

  function openSearch() {
    searchOpen.value = true
    hooks.closeDrawer()
    // Naboflisene kan ha kommet til siden sist (auto-bygging mens brukeren
    // panorerte), så indeksen bygges ved hver åpning — ikke ved kart-lasting.
    rebuildNaboIndeks()
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
    mapSearch, searchQuery, searchResults, searchIndex, arkIndex,
    searchOpen, highlightedFeature,
    openSearch, closeSearch, clearHighlight, rebuildNaboIndeks,
    panToSettled, stopPanSettle, selectSearchResult,
    searchActiveIndex, onSearchKeydown,
  }
}

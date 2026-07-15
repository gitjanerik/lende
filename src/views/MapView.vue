<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePinchZoom } from '../composables/usePinchZoom.js'
import { useUserPosition } from '../composables/useUserPosition.js'
import { useProximityAlert, getPersistedAlert } from '../composables/useProximityAlert.js'
import { useCompass } from '../composables/useCompass.js'
import { useDraggableDrawer } from '../composables/useDraggableDrawer.js'
import { useResizablePanel } from '../composables/useResizablePanel.js'
import { useMapAnnotations, ANNOTATION_SYMBOLS } from '../composables/useMapAnnotations.js'
import { useStifinner } from '../composables/useStifinner.js'
import { useMapSearch, findByName } from '../composables/useMapSearch.js'
import { useNominatim } from '../composables/useNominatim.js'
import { useSearchKeyboard } from '../composables/useSearchKeyboard.js'
import { useTrackRecorder } from '../composables/useTrackRecorder.js'
import { useScreenWakeLock } from '../composables/useScreenWakeLock.js'
import { useMapSizePreference, equidistanceForWidthKm, defaultMapDims, DEFAULT_MAP_WIDTH_KM, MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM } from '../composables/useMapSizePreference.js'
import { useLodTuning } from '../composables/useLodTuning.js'
import { useLabelFonts } from '../composables/useLabelFonts.js'
import { useLabelDensity } from '../composables/useLabelDensity.js'
import { useStrokeTuning } from '../composables/useStrokeTuning.js'
import { useReliefSettings } from '../composables/useReliefSettings.js'
import { useDetailInset } from '../composables/useDetailInset.js'
import { useHeritageLayers } from '../composables/useHeritageLayers.js'
import { useReliefRender } from '../composables/useReliefRender.js'
import { useGhostTiles } from '../composables/useGhostTiles.js'
import { buildStrokeOverrideCss } from '../lib/strokeOverrides.js'
import {
  LAYERS, MARINE_LAYER_KEYS, DEFAULT_VISIBLE_LAYER_KEYS, LAYER_PRESETS,
} from '../lib/mapLayerCatalog.js'
import { themeVarEntries, allThemeVarNames } from '../lib/mapSettingsApply.js'
import { declutter, makeMinZoomOf } from '../lib/labelDeclutter.js'
import { trackLengthM, downloadGpx } from '../lib/gpxExport.js'
import { norwegianName } from '../lib/placeName.js'
import AnnotationIcon from '../components/AnnotationIcon.vue'
import TrackElevationSheet from '../components/TrackElevationSheet.vue'
import PerfLogModal from '../components/PerfLogModal.vue'
import MapSearchOverlay from '../components/MapSearchOverlay.vue'
import MapStatusOverlays from '../components/MapStatusOverlays.vue'
import MapScaleAttribution from '../components/MapScaleAttribution.vue'
import KulturminneSheet from '../components/KulturminneSheet.vue'
import FabSettingsPanel from '../components/FabSettingsPanel.vue'
import MapModeChips from '../components/MapModeChips.vue'
import DrawerLayersTab from '../components/drawer/DrawerLayersTab.vue'
import DrawerThemeTab from '../components/drawer/DrawerThemeTab.vue'
import DrawerAnnotateTab from '../components/drawer/DrawerAnnotateTab.vue'
import DrawerMeasureTab from '../components/drawer/DrawerMeasureTab.vue'
import DrawerTracksTab from '../components/drawer/DrawerTracksTab.vue'
import DrawerExportTab from '../components/drawer/DrawerExportTab.vue'
import DrawerAboutTab from '../components/drawer/DrawerAboutTab.vue'
import DrawerDevTab from '../components/drawer/DrawerDevTab.vue'
import ContextMenuSheet from '../components/context-menu/ContextMenuSheet.vue'
import { loadMap as loadStoredMap, listMaps as listStoredMaps, deleteMap as deleteStoredMap } from '../lib/mapStorage.js'
import { isomCatalog, buildPointSymbolDef } from '../lib/symbolizer.js'
import { printDocument, exportSvgFile, exportPngFile, exportPdfFile } from '../lib/printExport.js'
import { unpackDem } from '../lib/demSampling.js'
import { sampleProfile } from '../lib/elevationProfile.js'
import { fetchDEM } from '../lib/demFetcher.js'
import { buildMapFromCenter, consumeMapFinalize } from '../lib/createMapFlow.js'
import { pruneAutoTiles, countAutoTiles, rectOverlapFraction } from '../lib/tileCache.js'
import {
  viewRectSvg, expandRect, rectContains, buildCullIndex,
  needsRecull, computeCullDiff, parseBboxAttr,
} from '../lib/viewportCull.js'
import { svgToWgs84, wgs84ToSvg } from '../lib/utm.js'
import { buildUtNoUrl, utNoZoomForMPerPx, UTNO_DEFAULT_ZOOM } from '../lib/utNoLink.js'
import { gmapsUrl, streetViewUrl, buildVegkartUrl } from '../lib/externalMapLinks.js'
import { fetchKulturminneById } from '../lib/kulturminneFetcher.js'
import { polylineToPath } from '../lib/pathUtils.js'
import { sampleElevation } from '../lib/demSampling.js'
import { fetchLakeData } from '../lib/nveLakeFetcher.js'
import { fetchLiveWater } from '../lib/nveHydApi.js'
import { fetchProtectedArea } from '../lib/verneFetcher.js'
import { fetchNaturtypes } from '../lib/naturtypeFetcher.js'
import { fetchSpeciesSummary } from '../lib/gbifSpecies.js'
import { summarizeRedListed } from '../lib/redListNo.js'
import { groupSpecies } from '../lib/speciesGroups.js'
import { fetchWikiSummary, titleMatches } from '../lib/wikiSummary.js'
import { fetchNearestWikiPlace, placeNameMatches } from '../lib/wikiPlace.js'
import { fetchSnlSummary } from '../lib/snlFetcher.js'
import { cacheGet, cacheSet, pointKey, naturtypePointKey, placePointKey, kulturminneIdKey, TTL } from '../lib/protectedAreaCache.js'
import {
  bearingDeg, bearingToCompass, formatDistanceM,
  findNearestPlace, pointToPolylineDist,
} from '../lib/mapContext.js'
import {
  STEDSMERKE_KEY_TIMES, STEDSMERKE_DUR, STEDSMERKE_SHADOW_OPACITY,
  PIN_SCALE_VALUES, SHADOW_SCALE_VALUES,
  pinTranslateValues, randomBegin, pinPath,
} from '../lib/stedsmerkeAnimation.js'

const router = useRouter()
const route = useRoute()
const wrapperRef = ref(null)
const svgHostRef = ref(null)
// Felles transform-wrapper rundt kart-SVG-en (svgHostRef). Tema-CSS-variabler
// (--iso-*, --bg, --label-*) settes her, ikke på SVG-en, så de arves ned via
// CSS custom property-arv.
const mapInnerRef = ref(null)

const loading = ref(true)
const loadError = ref(null)
const meta = ref(null)
// v11.0.52: forsinket «laster»-pille når et kart ALLEREDE vises. Ved zoom/pan nær
// randsonen kan en frisk-bygget eller cachet nabo-flis lastes på <½ sekund —
// da skal ingen loader blinke. Pillen vises kun hvis lastingen faktisk varer
// (>450 ms). Førstegangs-last (uten meta) bruker fullskjerm-skjelettet umiddelbart.
const loadPillVisible = ref(false)
let loadPillTimer = null
// Fullskjerm-skjelettet er også forsinket (300 ms): et allerede-bygget kart
// åpner typisk på under det (IDB-les + parse), og da skal ingen skjelett-
// skjerm blinke. Kun genuint trege førstegangs-laster får skjelettet.
const skeletonVisible = ref(false)
let skeletonTimer = null
watch(loading, (v) => {
  if (loadPillTimer) { clearTimeout(loadPillTimer); loadPillTimer = null }
  if (skeletonTimer) { clearTimeout(skeletonTimer); skeletonTimer = null }
  if (v && meta.value) {
    loadPillTimer = setTimeout(() => { loadPillVisible.value = true }, 450)
  } else {
    loadPillVisible.value = false
  }
  if (v && !meta.value) {
    skeletonTimer = setTimeout(() => { skeletonVisible.value = true }, 300)
  } else {
    skeletonVisible.value = false
  }
})
const mapTitle = ref('Turkart')

// Sjøkart-WFS-utfall for Utvikler-fanen: hentingen feiler stille (timeout/
// CORS/tom respons), og uten dette var det umulig å se på mobil hvorfor
// dybdetall og kai/brygge/molo manglet på et kystkart.
const sjokartStatusText = computed(() => {
  const s = meta.value?.sjokartStatus
  if (!s) return null
  switch (s.state) {
    case 'ok': return `OK — ${s.features} features (${s.source?.replace('https://wfs.geonorge.no/skwms1/', '') ?? 'ukjent kilde'})`
    case 'innlands': return 'hoppet over (innlandskart)'
    case 'timeout': return `timeout etter ${Math.round((s.timeoutMs ?? 0) / 1000)} s — regenerer kartet for å prøve igjen`
    case 'feil': return 'nettverks-/CORS-feil — dybdetall og kaier mangler'
    default: return '0 features (utenfor dekning eller endret tjeneste)'
  }
})

const storedDem = ref(null)             // unpacked DEM, eller null hvis ikke tilgjengelig


const BUILTIN = {
  vardasen: { navn: 'Vardåsen · turkart', file: 'vardasen.svg' },
}

// Lag-katalogen (LAYERS, presets, defaults) er delt med MCP-serveren —
// se lib/mapLayerCatalog.js. Drawer-en og MCP-ens juster_kart leser samme kilde.
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
// Tema: 'light' (default ISOM), 'dark', 'mono-sepia', 'mono-indigo', 'mono-slate'.
// isDark er derivert for steder som styrer UI-farger (toppbar, drawer-bg).
const currentTheme = ref('light')
const isDark = computed(() => currentTheme.value !== 'light')
const THEMES = computed(() => Object.entries(isomCatalog.themes ?? {}).map(([k, v]) => ({ key: k, label: v.label ?? k })))
const diagnose = ref(false)

// Utvikler-fanen: live A/B-test av lilla stier (#7a4fa3, turkonvensjon-forslag
// fra CD 2. juli 2026 — brukeren var lunken, så svart er default og lilla er
// en knott). Setter --iso-505/506/507-stroke på .isom-map-roten; casingen
// (var(--bg)-fallback) berøres ikke. Persistert så valget overlever reload.
const PURPLE_TRAILS_KEY = 'map-purple-trails'
const purpleTrails = ref(localStorage.getItem(PURPLE_TRAILS_KEY) === '1')
function applyPurpleTrails() {
  const root = mapInnerRef.value
  if (!root || !purpleTrails.value) return
  for (const code of ['505', '506', '507']) root.style.setProperty(`--iso-${code}-stroke`, '#7a4fa3')
}
function togglePurpleTrails() {
  purpleTrails.value = !purpleTrails.value
  localStorage.setItem(PURPLE_TRAILS_KEY, purpleTrails.value ? '1' : '0')
  // applyTheme rydder/re-etablerer temaets sti-farger (AV-veien); lilla
  // legges deretter oppå hvis PÅ.
  applyTheme()
  applyPurpleTrails()
}

// Terreng-først: kartet ble vist med konturer+relieff straks, og OSM/detaljer
// fylles inn i bakgrunnen. Chip vises mens vi venter på full-byggingen.
const fillingInDetails = ref(false)
// Settes hvis bakgrunns-byggingen (Overpass) feilet → vis banner med «Prøv på
// nytt»-knapp i stedet for en teknisk, overflytende toast.
const detailsFailed = ref(false)
let componentAlive = true

// Datamengde lastet for kartet (SVG + lagret DEM). Vises i drawer-ens Debug og
// i long-press-info-arket så man ser hvor «tungt» kartet er.
const mapDataSize = ref({ svgBytes: 0, demBytes: 0 })
// Antall auto-fliser i tile-cachen (debug-readout). Oppdateres ved last + prune.
const autoTileCount = ref(0)
async function refreshAutoTileCount() {
  try { autoTileCount.value = await countAutoTiles() } catch { autoTileCount.value = 0 }
}

// Mosaikk / spøkelses-fliser — flyttet til useGhostTiles (kalles opp lenger
// nede, etter at deps er deklarert — se useGhostTiles-kallet).
function formatBytes(n) {
  if (!n || n < 0) return '0'
  if (n >= 1024 * 1024) return (n / 1048576).toFixed(2).replace('.', ',') + ' MB'
  if (n >= 1024) return Math.round(n / 1024) + ' KB'
  return n + ' B'
}
const mapDataLabel = computed(() => {
  const s = mapDataSize.value
  const parts = []
  if (s.svgBytes) parts.push(`${formatBytes(s.svgBytes)} SVG`)
  if (s.demBytes) parts.push(`${formatBytes(s.demBytes)} DEM`)
  return parts.join(' · ')
})

// Perf-logg-modal (byggetider) — se PerfLogModal.vue. Forelderen eier bare
// synligheten; åpnes fra Utvikler-fanen.
const showPerfLog = ref(false)
const showControls = ref(false)

// Drawer-faner (v8.9.6) — drawer-en hadde vokst seg ulesbar med 10+ vertikale
// seksjoner. Splittet i faner: Lag / Tema / Annotering / Måling / Sporing /
// Eksport / Om / Utvikler. Annotering og Sporing skjules for built-in kart
// (Vardåsen). «Utvikler» (v11.0.32) er en debug-fane lengst til høyre — åpne
// Vardåsen-referansekartet, diagnose-modus og byggetider.
// Aktiv fane huskes i localStorage så drawer åpner tilbake i samme kontekst.
const ACTIVE_TAB_KEY = 'lende-mapview-active-tab'
const ALL_TABS = [
  { key: 'lag',         label: 'Kartlag' },
  { key: 'tema',        label: 'Tema' },
  { key: 'annotering',  label: 'Annotering', userOnly: true },
  { key: 'maaling',     label: 'Måling' },
  { key: 'sporing',     label: 'Sporing',    userOnly: true },
  { key: 'eksport',     label: 'Eksport' },
  { key: 'om',          label: 'Innstillinger' },
  { key: 'utvikler',    label: 'Utvikler' },
]
const activeTab = ref('lag')
try {
  const saved = localStorage.getItem(ACTIVE_TAB_KEY)
  if (saved && ALL_TABS.some(t => t.key === saved)) activeTab.value = saved
} catch { /* private mode / quota — ignore */ }
const visibleTabs = computed(() => {
  const isBuiltin = (route.params.id ?? 'vardasen').startsWith('vardasen')
  return ALL_TABS.filter(t => !t.userOnly || !isBuiltin)
})
watch(activeTab, (v) => {
  try { localStorage.setItem(ACTIVE_TAB_KEY, v) } catch { /* noop */ }
})
// Hvis fanen ble usynlig (f.eks. åpnet et Vardåsen-kart med Sporing aktiv),
// fall tilbake til Lag som er garantert alltid synlig.
watch(visibleTabs, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) activeTab.value = 'lag'
}, { immediate: true })

// Tab-bar scroll-piler (v9.3.6) — faneraden overflower på smale skjermer
// (7 faner). Pil venstre/høyre står permanent foran/etter raden som hint om
// at det finnes flere faner, og disables når man er scrollet helt til
// respektive ende. Native implementasjon (Tailwind-prosjekt, ingen Vuetify).
const tabScroller = ref(null)
const canScrollTabsLeft = ref(false)
const canScrollTabsRight = ref(false)
let tabResizeObs = null
let wrapperResizeObs = null

function updateTabScroll() {
  const el = tabScroller.value
  if (!el) { canScrollTabsLeft.value = canScrollTabsRight.value = false; return }
  const max = el.scrollWidth - el.clientWidth
  canScrollTabsLeft.value = el.scrollLeft > 1
  canScrollTabsRight.value = el.scrollLeft < max - 1
}

function scrollTabs(dir) {
  const el = tabScroller.value
  if (!el) return
  el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.6, 120), behavior: 'smooth' })
}

// Drawer-en er v-if, så scroller-elementet finnes først når den er åpen.
// Sett opp ResizeObserver + recompute når den vises eller fanesettet endres.
watch([showControls, visibleTabs], () => {
  nextTick(() => {
    const el = tabScroller.value
    tabResizeObs?.disconnect()
    if (el && typeof ResizeObserver !== 'undefined') {
      tabResizeObs = new ResizeObserver(() => updateTabScroll())
      tabResizeObs.observe(el)
    }
    updateTabScroll()
  })
})

// Maks-visning lar en tynn kart-stripe stå igjen i toppen (100dvh − denne) så
// bruker ser at det ligger et kart under: 32px header-knapp + 12px lik marg over/under.
const MAX_DRAWER_TOP_GAP_PX = 56
// «Minimert» peek for hovedmeny-skuffen: høy nok til at håndtak + tittel +
// hurtigvalg-raden (Tegnforklaring/GPS/Kompass) er synlig (v11.0.61) — før
// viste 32 px bare håndtaket, som forsvant bak nav-baren. Fane-innholdet
// renderes da under skjermkanten. Juster ved behov etter tekststørrelse.
const MAIN_DRAWER_PEEK_PX = 138
// Kontekst-skuffens minimerte peek: håndtak + koordinat-header synlig.
const CONTEXT_DRAWER_PEEK_PX = 76
const drawer = useDraggableDrawer({ expandedHeight: 0.45, minimizedPeek: MAIN_DRAWER_PEEK_PX, maxTopGapPx: MAX_DRAWER_TOP_GAP_PX })
// Long-press kontekstmeny: nå SAMME UX som hovedmenyen — maksimer / standard /
// minimer (v11.0.61). Minimert viser håndtak + koordinat-header; resten (inset
// + info) skjules under skjermkanten. Lukkes fortsatt helt med X.
const contextDrawer = useDraggableDrawer({ expandedHeight: 0.45, minimizedPeek: CONTEXT_DRAWER_PEEK_PX, maxTopGapPx: MAX_DRAWER_TOP_GAP_PX, allowMinimize: true })
// FAB-panelenes peek: håndtak + tittel-header synlig når minimert.
const KNOB_PANEL_PEEK_PX = 76
// FAB-innstillingspanelene (strek/relieff/zoom): SAMME drawer-UX som kontekst-
// skuffen — 45 dvh standard, dra i håndtaket for å maksimere/minimere. Minimert
// lar brukeren lynraskt justere → minimere → se på kartet → maksimere igjen.
const knobDrawer = useDraggableDrawer({ expandedHeight: 0.45, minimizedPeek: KNOB_PANEL_PEEK_PX, maxTopGapPx: MAX_DRAWER_TOP_GAP_PX, allowMinimize: true })

// Kulturminne-detalj-skuff (Kulturminnesøk brukerminner). Åpnes ved tapp på et
// kulturminne-ikon i kartet. Tittel/kategori er allerede i SVG-en (data-*), mens
// beskrivelse/sted/bilde hentes lazy via fetchKulturminneById (cachet) og fylles
// inn når svaret kommer.
const KULTURMINNE_DRAWER_PEEK_PX = 76
const kulturminneDrawer = useDraggableDrawer({ expandedHeight: 0.45, minimizedPeek: KULTURMINNE_DRAWER_PEEK_PX, maxTopGapPx: MAX_DRAWER_TOP_GAP_PX, allowMinimize: true })
const kulturminneOpen = ref(false)
const kulturminneLoading = ref(false)
// Antall kulturminne-ikoner i det innlastede kartet (settes i setupHostSvg).
// Vises på «Kulturminner»-toggelen så «(0)» skiller et gammelt kart (bygget før
// v12.1.38 → ingen data bakt inn) og et område uten funn fra en rendering-feil.
const kulturminneCount = ref(0)
const kulturminneDetail = ref(null)     // { id, kategori, tittel, beskrivelse, kommune, fylke, opprettetAv, link, bilder }
let kulturminneReqId = 0
async function openKulturminneDetail(el) {
  const id = el?.getAttribute('data-kulturminne-id')
  if (!id) return
  const kategori = el.getAttribute('data-kat') || 'annet'
  const tittel = el.getAttribute('data-tittel') || 'Kulturminne'
  // Vis tittel/kategori straks fra SVG-attributtene; hent resten.
  kulturminneDetail.value = { id, kategori, tittel, beskrivelse: '', kommune: null, fylke: null, opprettetAv: null, link: null, bilder: [] }
  kulturminneOpen.value = true
  kulturminneDrawer.reset()
  const reqId = ++kulturminneReqId
  kulturminneLoading.value = true
  try {
    const key = kulturminneIdKey(id)
    let full = await cacheGet(key)
    if (!full) {
      full = await fetchKulturminneById(id)
      if (full) cacheSet(key, full, TTL.kulturminne)
    }
    if (reqId !== kulturminneReqId) return  // et nyere klikk vant
    if (full) kulturminneDetail.value = { ...kulturminneDetail.value, ...full, tittel: full.tittel || tittel, kategori }
  } finally {
    if (reqId === kulturminneReqId) kulturminneLoading.value = false
  }
}

function closeKulturminneDetail() {
  kulturminneOpen.value = false
  kulturminneReqId++          // kanseller evt. pågående henting
  kulturminneLoading.value = false
}


// Tekststørrelse i appen (drawer + info-ark). CSS `zoom` skalerer hele blokken
// — nødvendig fordi UI bruker faste Tailwind-px-størrelser som ikke arver
// container-font-size. Erstatter behovet for browser-pinch-zoom (som ikke kan
// nullstilles i standalone-PWA).
const UI_TEXT_SCALES = [1, 1.25, 1.5]
const uiTextScale = ref(Number(localStorage.getItem('map-ui-text-scale')) || 1)
function cycleTextScale() {
  const i = UI_TEXT_SCALES.indexOf(uiTextScale.value)
  uiTextScale.value = UI_TEXT_SCALES[(i + 1) % UI_TEXT_SCALES.length]
  try { localStorage.setItem('map-ui-text-scale', String(uiTextScale.value)) } catch {}
}
// Desktop: drawer er et høyrestilt side-panel med dra-bar venstrekant
// (min 360px, maks 50vw, bredde lagret i localStorage per spor).
const panel = useResizablePanel('map-panel-width')
// Bredden side-panelet stjeler fra kartet på desktop. Kompass + FAB skyves
// til venstre for panelet, og kart-wrapperen krympes tilsvarende så «Sentrer»
// (reset av pinch/zoom) fyller den synlige flaten, ikke hele viewporten.
const panelOffsetPx = computed(() =>
  isDesktop.value && showControls.value ? panel.width.value : 0
)
// Høyre-offset for flytende kontroller (kompass + FAB): rett til venstre for
// panelet på desktop, ellers standard 12px (= right-3).
const floatRightStyle = computed(() => ({
  right: (panelOffsetPx.value > 0 ? panelOffsetPx.value + 12 : 12) + 'px',
}))
// Horisontal midtstilling for midtstilte overlays (tittel-badge, toasts,
// highlight-chip): sentrer i den SYNLIGE kart-flaten, ikke hele viewporten,
// så de ikke drifter til venstre når side-panelet er åpent/endrer bredde.
// Brukes sammen med `-translate-x-1/2` (sentrerer elementet om denne left-en).
const mapCenterStyle = computed(() => ({
  left: panelOffsetPx.value > 0 ? `calc(50% - ${panelOffsetPx.value / 2}px)` : '50%',
}))

// Lukk en åpen info-drawer (kontekstmeny) først — ellers ville begge skuffene
// vært åpne samtidig, med Innstillinger usynlig bak info-draweren.
function openDrawer() { closeContextMenu(); showControls.value = true; drawer.reset() }
function closeDrawer() { showControls.value = false }

function onThemeTap(key) {
  currentTheme.value = key
}

// Lazy DEM-henting for features som trenger høydedata etter at kartet er
// lastet (hill-shading, høydeprofil).
async function ensureDem() {
  if (storedDem.value || !meta.value) return !!storedDem.value
  try {
    const m = meta.value
    const utmBbox = { minE: m.minE, maxE: m.maxE, minN: m.minN, maxN: m.maxN }
    const dem = await fetchDEM(m.bbox, utmBbox, { resolutionM: 10, useReal: true })
    if (dem && !dem.source?.startsWith('synthetic')) {
      storedDem.value = dem
    }
  } catch { /* nettverksfeil — kall-sites håndterer manglende DEM */ }
  return !!storedDem.value
}

// Standard zoom-nivå for «Sentrer»-FAB-en (Zoom-panelet, v12.0.18). 1 = dagens
// fulle reset (hele kartet). > 1 = sentrer ved den skalaen: på GPS-posisjonen
// når GPS er aktiv og innenfor kartet, ellers kartsenteret. Global innstilling.
const DEFAULT_ZOOM_LS_KEY = 'lende-default-zoom'
const DEFAULT_ZOOM_MIN = 1
const DEFAULT_ZOOM_MAX = 5
const defaultZoomScale = ref((() => {
  try {
    const v = parseFloat(localStorage.getItem(DEFAULT_ZOOM_LS_KEY))
    if (Number.isFinite(v) && v >= DEFAULT_ZOOM_MIN && v <= DEFAULT_ZOOM_MAX) return v
  } catch { /* noop */ }
  return 1
})())
watch(defaultZoomScale, (v) => {
  try { localStorage.setItem(DEFAULT_ZOOM_LS_KEY, String(v)) } catch { /* noop */ }
})

// v8.5.2: «Sentrer»-FAB resetter pinch/zoom OG tvinger en fersk GPS-fix
// hvis GPS er aktivert. På toget kan watchPosition henge på en cached
// koordinat — getCurrentPosition med maximumAge=0 gir alltid ny måling.
function onResetAndRefreshGps() {
  const z = defaultZoomScale.value
  const m = meta.value
  if (z > 1 && m?.widthM && m?.heightM) {
    const gpsOk = userPos.isWatching && userPos.svgX != null && !userPos.isOutsideMap
    panTo(gpsOk ? userPos.svgX : m.widthM / 2, gpsOk ? userPos.svgY : m.heightM / 2,
          { vbWidth: m.widthM, vbHeight: m.heightM, targetScale: z })
  } else {
    reset()
  }
  // v9.1.19: «Nullstill zoom» rører KUN zoom/pan/rotasjon — IKKE strek- og
  // relieff-knottene. Brukeren vil beholde sine valgte strek-/relieff-nivåer
  // når de bare vil sentrere/uvri kartet.
  // Tekststørrelse-sliden nullstilles derimot til normal (eksplisitt ønsket):
  // FAB-en er den naturlige «tilbake til standard»-handlingen for visningen.
  labelScaleSlider.value = 0   // watch → applyLabelScale + persist
  if (userPos.isWatching) userPos.refresh()
}

function toggleLayer(key) {
  const next = new Set(visibleLayers.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  visibleLayers.value = next
  applyLayerVisibility()
}

// Dybde-lag (v11.0.54) — soundings + dybdekurver (Sjøkart) ligger detachet for
// long-press-inset-en (perf). «Dybde»-toggle (default AV) kloner dem inn som et
// synlig hovedlag. Kun relevant når kartet faktisk har Sjøkart-dybde
// (meta.depthSource === 'sjokart'); DEM-estimatet vises uansett som sjø-fyll.
function applyDepthLayer() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  svg.querySelector('#depth-main-layer')?.remove()
  if (!visibleLayers.value.has('dybde') || !detachedDetailLayers.length) return
  const ns = 'http://www.w3.org/2000/svg'
  const wrap = document.createElementNS(ns, 'g')
  wrap.setAttribute('id', 'depth-main-layer')
  wrap.setAttribute('data-layer', 'dybde')
  wrap.setAttribute('pointer-events', 'none')
  for (const g of detachedDetailLayers) {
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

// Fredet-kulturminne-lag + brukerminne-fallback — flyttet til
// useHeritageLayers; meta-watchen under blir her.
const {
  fredetCount, fredetLoading,
  applyFredetKulturminneLayer, applyKulturminneFallback,
  openFredetDetailFromEl, refreshFredetCount,
} = useHeritageLayers({
  svgHostRef, visibleLayers, meta, applyUprightLabels, kulturminneCount,
  kulturminneDetail, kulturminneLoading, kulturminneOpen, kulturminneDrawer,
})
// Nytt kart lastet → nullstill og hent antall for badgen (liten WFS hits-spørring).
watch(meta, (m) => { fredetCount.value = null; refreshFredetCount(m) })

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
  // separat (se under).
  const showLabels = visibleLayers.value.has('navn')
  const labelEls = root.querySelectorAll('[data-label]:not([data-label="stedsnavn"])')
  for (const el of labelEls) {
    el.style.display = showLabels ? '' : 'none'
  }
  // v9.1.10: et lag som nettopp ble slått PÅ kan ha labels med utdatert (eller
  // manglende) counter-rotation siden applyUprightLabels hopper over skjulte
  // lag. Re-orienter nå — billig pga koordinat-cache.
  applyUprightLabels()
  // Et lag (f.eks. et stedsnavn-nivå) kan nettopp ha blitt slått på/av — la
  // navn-LOD-en revurdere hvilke navn som er overflødige i utsnittet.
  scheduleNameLOD()
  // Hold dybde-hovedlaget i synk med lag-tilstanden (presets/nullstill kan ha
  // endret 'dybde'); re-injiserer/fjerner #depth-main-layer etter behov.
  applyDepthLayer()
  // Samme for fredet-kulturminne WFS-vektorlaget (injiser/skjul).
  applyFredetKulturminneLayer()
  // Brukerminne-fallback: hent live hvis laget er på men ingen ikoner er innbakt
  // (typisk mobil der bygge-tids-hentingen glapp).
  applyKulturminneFallback()
}

// Navne-labels som kan være flerspråklige (norsk - samisk - finsk). Tall-labels
// (kontur-tall, dybde-tall osv.) er ikke med.
const NAME_LABEL_KINDS = new Set([
  'stedsnavn', 'omrade-navn', 'vann-navn', 'peak', 'hytte-navn', 'naturreservat-navn',
])

// Vis kun det norske leddet (default) eller hele det flerspråklige navnet.
// Det fulle navnet lagres i data-name-full ved første kjøring slik at vi kan
// veksle frem og tilbake uten å miste de øvrige språkene — og slik at
// søkeindeksen (useMapSearch) finner alle språk uansett hva som vises.
function applyNameLanguage() {
  const root = svgHostRef.value?.querySelector('svg')
  if (!root) return
  for (const t of root.querySelectorAll('text[data-label]')) {
    if (!NAME_LABEL_KINDS.has(t.getAttribute('data-label'))) continue
    // Topp-labels (v12.0.7+) har høyden som inline <tspan data-label=
    // "peak-ele"> INNI navne-teksten. textContent-basert lesing/skriving
    // (v12.1.28 og eldre) (1) forurenset data-name-full med tallet
    // («Vardåsen349» i søket) og (2) SLETTET tspan-en ved tilbakeskriving,
    // så høyde-tallet forsvant fra kartet. Les/skriv derfor kun tekst-nodene
    // når en inline høyde-tspan finnes.
    const inline = t.querySelector('[data-label="peak-ele"]')
    let current
    if (inline) {
      let own = ''
      for (const n of t.childNodes) if (n.nodeType === 3) own += n.textContent
      current = own.trim()
    } else {
      current = (t.textContent || '').trim()
    }
    let full = t.getAttribute('data-name-full')
    if (full == null) {
      if (!current) continue
      full = current
      t.setAttribute('data-name-full', full)
    } else if (inline) {
      // Reparér data-name-full som en tidligere versjon rakk å forurense
      // med høyde-tallet («Vardåsen349» → «Vardåsen»).
      const eleText = (inline.textContent ?? '').trim()
      if (eleText && full !== eleText && full.endsWith(eleText)) {
        full = full.slice(0, -eleText.length).trim()
        t.setAttribute('data-name-full', full)
      }
    }
    const next = showFullNames.value ? full : norwegianName(full)
    if (current === next) continue
    if (inline) {
      for (const n of [...t.childNodes]) if (n.nodeType === 3) t.removeChild(n)
      t.insertBefore(document.createTextNode(next), t.firstChild)
    } else {
      t.textContent = next
    }
  }
}

// Pinch/pan/rotate fryses kun mens aller første last pågår (ingen kart-DOM
// ennå). Mens et ferskt kart fyller inn stier og detaljer (terreng-først)
// ELLER mens et nytt kart bygges on-the-fly, lar vi brukeren pan/zoome/rotere
// fritt — auto-kart-trigger
// er separat gated (checkAutoMapTrigger returnerer på fillingInDetails/
// buildingOnTheFly), så gestene lager aldri et konkurrerende auto-kart. Når
// detaljene lander, byttes SVG-en inn via en silent re-render som beholder
// gjeldende transform, så stier/detaljer dukker opp sømløst i brukerens utsnitt.
const pinchEnabled = computed(() => !loading.value)
// panAtRest: la kartet dras også ved nullstilt zoom (se clampPan for canvas-rom).
const { scale, translateX, translateY, rotation, reset, panTo, rotateTo, animating, isGesturing } =
  usePinchZoom(wrapperRef, { enabled: pinchEnabled, panAtRest: true, minScale: () => mosaicMinScale() })

// Dynamisk zoom-ut-gulv: la brukeren zoome ut akkurat langt nok til å se HELE
// bruttokartet (aktiv flis ∪ nabofliser) med litt margin rundt — så man raskt
// ser totalområdet et lagret/utvidet kart spenner over. Ett-flis-kart beholder
// dagens gulv (0.5); større mosaikker får lavere gulv (flere zoom-ut-nivåer).
// Absolutt bunn (0.06) hindrer at en svær mosaikk forsvinner i tomrom.
function mosaicMinScale() {
  const m = meta.value
  const wrap = wrapperRef.value?.getBoundingClientRect()
  if (!m || !wrap?.width || !wrap?.height) return 0.5
  const fit = Math.min(wrap.width / m.widthM, wrap.height / m.heightM)
  if (!(fit > 0)) return 0.5
  const b = extendZonesBounds()   // union (alltid rektangulær)
  const unionW = Math.max(m.widthM, b.maxX - b.minX)
  const unionH = Math.max(m.heightM, b.maxY - b.minY)
  // scale der mosaikken fyller ~82 % av viewporten (margin rundt)
  const fitMosaic = 0.82 * Math.min(wrap.width / (unionW * fit), wrap.height / (unionH * fit))
  return Math.max(0.06, Math.min(0.5, fitMosaic))
}

// Desktop uten touch: vis en rotasjons-slider (touch bruker to-finger-rotasjon).
// Detekteres på mount (touch-evner endrer seg ikke i en sesjon i praksis).
const hasTouch = ref(false)
// Desktop-bredde (≥768px): drawer vises som høyrestilt side-panel (som i
// illustrasjons-sporet) i stedet for bunn-ark. Følges med matchMedia.
const isDesktop = ref(false)
let desktopMq = null
function updateIsDesktop() { isDesktop.value = !!desktopMq?.matches }
// Slider-verdi i [-180, 180]. rotation.value akkumulerer fritt; vi normaliserer
// for visning og setter absolutt vinkel via rotateTo ved drag.
const rotationSliderDeg = computed(() => {
  const r = ((rotation.value % 360) + 540) % 360 - 180
  return Math.round(r)
})
function onRotateSlider(e) {
  rotateTo(Number(e.target.value))
}

// Pan-clamp — det synlige sentrum klampes til mosaikk-utstrekningen pluss en
// halv flis i hver retning (frontier-slakk så auto-kart fortsatt kan trigges på
// ukjent grunn). Uten spøkelses-fliser er utstrekningen den aktive flisa, og
// grensene blir [-W/2, 1.5W] × [-H/2, 1.5H] — byte-identisk med den gamle
// «±1 flis»-oppførselen. Med spøkelser strekker grensa seg over hele mosaikken.
// Rotasjons-trygt: vi klamper det synlige sentrum og inverterer til translate.
function clampPan() {
  const m = meta.value
  const el = wrapperRef.value
  if (!m || !el) return
  const r = el.getBoundingClientRect()
  const w = r.width, h = r.height
  if (!w || !h) return
  const c = visibleCenterSvg()
  if (!c) return
  // Mosaikk-bbox i aktiv-flis-koordinater = aktiv flis ∪ alle spøkelses-rekter.
  let minX = 0, minY = 0, maxX = m.widthM, maxY = m.heightM
  for (const g of ghostRects.value) {
    if (g.x < minX) minX = g.x
    if (g.y < minY) minY = g.y
    if (g.x + g.w > maxX) maxX = g.x + g.w
    if (g.y + g.h > maxY) maxY = g.y + g.h
  }
  const marginX = m.widthM / 2, marginY = m.heightM / 2
  const cx = Math.min(Math.max(c.x, minX - marginX), maxX + marginX)
  const cy = Math.min(Math.max(c.y, minY - marginY), maxY + marginY)
  if (cx === c.x && cy === c.y) return   // innenfor → idempotent, ingen endring
  // Inverter visibleCenterSvg: finn translate som lander (cx,cy) på skjermsenter.
  const fit = Math.min(w / m.widthM, h / m.heightM)
  const offX = (w - m.widthM * fit) / 2
  const offY = (h - m.heightM * fit) / 2
  const s = scale.value || 1
  const rot = (rotation.value || 0) * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const px = cx * fit + offX
  const py = cy * fit + offY
  const A = px * cos - py * sin
  const B = px * sin + py * cos
  translateX.value = w / 2 - A * s
  translateY.value = h / 2 - B * s
}
watch([scale, translateX, translateY, rotation], clampPan)

// v8.10.3: Toggle `.is-zooming` på SVG-host under aktiv gest så CSS-regelen
// for `vector-effect: non-scaling-stroke` overstyres til `none` — strokene
// re-tessellerer ikke i device-piksler per frame, og kartet får ~3-5×
// frame-rate-gevinst på store kart. Strokene "skalerer med" mens du zoomer
// (visuelt OK i 200 ms), og snapper tilbake til riktig bredde når gesten er over.
// Gest-perf-modus (.is-zooming + relieff-skjuling + solid dash). v10.2.9:
// gjenopprettingen ved gest-slutt utsettes ~120 ms så den dyre snap-back-
// repainten (non-scaling-stroke-retessellering + dash + relieff-blend) ikke
// lander på samme frame som compositorens siste re-raster — og en ny gest
// innen vinduet kansellerer den helt (rask pinch-pinch-pinch betaler én
// gjenoppretting, ikke tre).
let gestureRestoreTimer = null
function setGesturePerfMode(svg, on) {
  if (on) svg.classList.add('is-zooming')
  else svg.classList.remove('is-zooming')
  // v9.1.14 — Perf: skjul relieff-bildet under aktiv gest. Et fullkart-
  // <image> med mix-blend-mode må re-komponeres mot bakgrunnen hver frame
  // (blend-mode hindrer billig GPU-lag-isolasjon), så det er dyrt på mobil-
  // GPU under pan/zoom/rotasjon. Det dukker tilbake straks gesten slipper.
  // v10.1.17 — gjelder ALLE synlige fliser: både aktiv-flisas #hillshade-layer
  // OG mosaikk-spøkelsenes relieff (image[data-ghost-relief]), ellers «henger»
  // nabofliser igjen med relieff mens aktiv-flisa flater ut → visuell ulikhet.
  // v11.0.51: matcher BÅDE <image> (mjuk) og <g> (vektor) ghost-relieff.
  const reliefImgs = svg.querySelectorAll('#hillshade-layer, #ghost-tiles [data-ghost-relief]')
  for (const hs of reliefImgs) hs.style.visibility = on ? 'hidden' : ''
  // v9.1.15 — Perf: stiplet strek (sti 505-508, gjerde/kraft, jernbane osv)
  // er den desidert dyreste å rastere på mobil-GPU under gest — på et 10 km-
  // kart blir den merge-de sti-pathen tusenvis av dash-segmenter som
  // reberegnes hver frame. Gjør ALLE kart-strekker solide mens gesten varer
  // (solide er allerede uendret), og bytt tilbake til CSS-dash etterpå.
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
    }, 120)
  }
})

// v8.10.4 / v11.0.34: zoom-trappet detalj-LOD via klasser på SVG-host. CSS i
// symbolizer.js gjør selve skjulingen. Tre trinn:
//   • far  (scale < MID)        — oversikt: terreng, vann, kurver, hovednavn
//   • mid  (.zoomed-in, ≥ 1.3)  — + mellomnivå-detaljer (uendret fra før)
//   • near (.zoom-near, ≥ 2.5)  — «nesten helt inn»: høyde-tall (kontur + innsjø-
//                                 moh), bekke-navn, små stedsnavn — alle detaljer
// Fine labels er uleselig små (og dyre å text-shape) ved utzoom, så de holdes
// igjen til brukeren faktisk kan lese dem. NEAR-terskelen er live-justerbar i
// Utvikler-fanen (useLodTuning) og matcher zoom-målet når et søketreff velges
// (selectSearchResult), så et valgt navn alltid blir synlig.
const ZOOMED_IN_THRESHOLD = 1.3
const {
  zoomNearThreshold, nameBudgetFar, nameBudgetMid, nameBudgetNear, resetLodTuning,
} = useLodTuning()
// Brukervalgbart font-par for kart-navn (Innstillinger-fanen). Settes som
// --land-font / --water-font på SVG-host-en → live bytte uten re-render.
const { fontPairId, landFont, waterFont, FONT_PAIRS } = useLabelFonts()
// Navnetetthet (rutenett-kvote for tetthets-budsjettet) — brukervalg i Innstillinger.
// applyToAll PÅ = global tetthet; AV = per-kart-overstyring for kartet du ser på.
const { densityId, applyToAll: densityApplyToAll, cellPx: nameCellPx, K: nameK, DENSITY_PRESETS, setCurrentMap: setDensityMap } = useLabelDensity()
function applyZoomTierClasses(svg, s) {
  if (!svg) return
  svg.classList.toggle('zoomed-in', s >= ZOOMED_IN_THRESHOLD)
  svg.classList.toggle('zoom-near', s >= zoomNearThreshold.value)
}
watch(scale, (s) => {
  applyZoomTierClasses(svgHostRef.value?.querySelector('svg'), s)
}, { immediate: true })
// Gjeldende zoom-trinn (debug-indikator i Utvikler-fanen).
const zoomTier = computed(() => {
  const s = scale.value || 1
  if (s >= zoomNearThreshold.value) return 'near'
  if (s >= ZOOMED_IN_THRESHOLD) return 'mid'
  return 'far'
})
// Live-justering av tuning-knottene → re-applikér klasser + navn-LOD straks.
watch(zoomNearThreshold, () => {
  applyZoomTierClasses(svgHostRef.value?.querySelector('svg'), scale.value)
  scheduleNameLOD()
})
watch([nameBudgetFar, nameBudgetMid, nameBudgetNear], () => scheduleNameLOD())

// ── Strek- og relieff-knotter (FAB) ──────────────────────────────────
// To «volum-knotter» som har overtatt de gamle zoom-inn/ut-knappenes plass
// (zoom dekkes av pinch + dobbel-tap). Tap = ett hakk opp (wrapper til min
// etter max), lang-trykk = nullstill. «Sentrer»-knappen nullstiller begge.
// Verdiene huskes globalt i localStorage (gjelder alle kart).
//  • Strek-knotten skalerer all kartlinje-tykkelse via CSS-var --stroke-scale
//    (se symbolizer.js). Senter-glyfen tegnes i faktisk valgt tykkelse.
//  • Relieff-knotten styrer hillshade-opacity 0 → 0.72 og er nå eneste
//    kontroll for relieff (lag-toggle fjernet). Blend-modus velges per tema
//    (multiply på lyse, screen på mørke/art-tema) så relieffet «gløder» i
//    Curves istedenfor å bli gjørmete.
//  • Strek-hakkene er relative multiplikatorer; den effektive --stroke-scale
//    ganges i tillegg med en kartstørrelse-basis (strokeSizeBase) fordi store
//    kart har langt tettere kontur-tetthet — samme mm-strek blir et svart rot
//    ved zoom. Et 10 km-kart får derfor hele skalaen skjøvet tynnere enn et
//    1 km-kart, mens hint-boblen viser den faktiske effektive ×-verdien.
// v10.2.38 — hele skalaen senket 30% (× 0.7 fra [0.4, 0.6, 0.85, 1.2, 1.6, 2.2]).
// Maks-hakket × strokeSizeBase var litt for voldsomt (effektiv ~1.3–1.5×);
// 30%-kuttet lander effektiv maks på drøyt 1 på både små og store kart.
const STROKE_STEPS = [0.28, 0.42, 0.6, 0.84, 1.12, 1.54]
const STROKE_DEFAULT_IDX = 2  // 0.6× (var 0.85×) etter 30%-nedjustering
// v11.0.44: default-relieff senket fra 0.42 → 0.35 (idx 3 → 2). Flåten av
// kart-eksperter (orientering + tilgjengelighet) fant at sterkt relieff drukner
// brune koter i skyggesidene der landform-detalj bor. idx 2 = 0.35 ≈ «35 %».
const RELIEF_STEPS = [0, 0.18, 0.35, 0.48, 0.60, 0.72]
const RELIEF_DEFAULT_IDX = 2
// Ferske kart får minst dette relieff-nivået («litt relieff») hvis relieffet er
// skrudd HELT av (idx 0) — så et globalt persistert «av» ikke gjør alle nye
// kart blast. Et bevisst lavt nivå (idx 1 = 0.18) respekteres.
const FRESH_RELIEF_MIN_IDX = 2
const STROKE_LS_KEY = 'lende-mapview-stroke-step'
const RELIEF_LS_KEY = 'lende-mapview-relief-step'
const LABEL_SCALE_LS_KEY = 'lende-mapview-label-scale'

function loadKnobStep(key, def, len) {
  try {
    const v = parseInt(localStorage.getItem(key), 10)
    if (Number.isInteger(v) && v >= 0 && v < len) return v
  } catch { /* noop */ }
  return def
}
// Kartstørrelse-basis: 1 km → 1.0, 10 km → 0.4 (lineær mellom). Klam utenfor.
// Gjør at samme knott-hakk gir tynnere streker på store kart der konturene
// ligger tett, så maks ikke blir et svart rot og default matcher ~1 km-følelsen.
function strokeSizeBase(widthM) {
  if (!Number.isFinite(widthM) || widthM <= 0) return 1
  const t = Math.min(1, Math.max(0, (widthM - 1000) / 9000))
  return 1 - 0.6 * t
}
const strokeStepIndex = ref(loadKnobStep(STROKE_LS_KEY, STROKE_DEFAULT_IDX, STROKE_STEPS.length))
const reliefStepIndex = ref(loadKnobStep(RELIEF_LS_KEY, RELIEF_DEFAULT_IDX, RELIEF_STEPS.length))

// Standard kartstørrelse for NYE kart (forsidens søk/GPS-flyt). Velges med en
// slider (1–20 km) i «Innstillinger»-fanen. null = DEFAULT_MAP_WIDTH_KM (10 km).
// Endrer ikke kartet som vises nå — kun neste nye kart.
const { mapSizeKm } = useMapSizePreference()
// Slider-binding: viser 10 km når intet er valgt; lagrer null når brukeren
// står på default (så en framtidig default-endring slår gjennom), ellers tallet.
const mapSizeSlider = computed({
  get: () => mapSizeKm.value ?? DEFAULT_MAP_WIDTH_KM,
  set: (v) => { mapSizeKm.value = (v === DEFAULT_MAP_WIDTH_KM ? null : v) },
})

// «Bygg om dette området i valgt størrelse» (Innstillinger-fanen): rebygger
// samme senter på nytt i den valgte kartstørrelsen, så man kan teste LOD-en på
// samme sted ved ulik bredde uten å gå tilbake til forsiden. Lager et NYTT kart
// (ny id) og navigerer dit. «Standard» = fast 10 km kvadrat (defaultMapDims).
async function rebuildAtChosenSize(km = mapSizeKm.value) {
  const m = meta.value
  if (!m?.bbox || buildingOnTheFly.value) return
  const lat = (m.bbox.south + m.bbox.north) / 2
  const lon = (m.bbox.west + m.bbox.east) / 2
  const dims = km ? { halfKm: km / 2, aspect: 1 } : defaultMapDims()
  closeDrawer()
  knobPanel.value = null
  buildingOnTheFly.value = true
  buildingProgress.value = 'Bygger om i valgt størrelse …'
  try {
    const { id } = await buildMapFromCenter({
      center: { lat, lon, name: m.navn ?? 'Kart' },
      ...dims,
      equidistanceM: equidistanceForWidthKm(km),
      navn: m.navn ?? 'Kart',
      terrainFirst: true,
      onProgress: (msg) => { buildingProgress.value = msg },
    })
    router.push({ name: 'kart-vis', params: { id } })
  } catch (e) {
    console.error('Bygg-om feilet:', e)
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    showAutoMapToast('Kunne ikke bygge om kartet')
  }
}

// Maks kartfliser i mosaikk-cachen — bruker-innstilling (slider i Innstillinger).
// Diskrete trinn (kvadrat-tall, matcher et n×n grid-mentalt-bilde), default 16.
// Påvirker hovedsakelig LAGRING (IndexedDB); live GPU/RAM er separat begrenset av
// MAX_GHOSTS_RENDERED. pruneAutoTiles kapper fjerneste fliser til denne grensa.
const MAX_TILE_STEPS = [4, 9, 16, 25, 36]
const MAX_TILE_DEFAULT_IDX = 2  // = 16
const MAX_TILES_LS_KEY = 'lende-max-tiles'
const maxTileIndex = ref(loadKnobStep(MAX_TILES_LS_KEY, MAX_TILE_DEFAULT_IDX, MAX_TILE_STEPS.length))
const maxTiles = computed(() => MAX_TILE_STEPS[maxTileIndex.value])

// Relieff (terrengskygge) av/på + stil — fra v12.0.18 PER KART med global
// standard som fallback (useReliefSettings). `reliefEnabled`/`reliefMode` er de
// EFFEKTIVE verdiene for kartet som vises (leses av applyHillshade, buildGhostSvg
// og FAB-en); Innstillinger-fanen binder de GLOBALE. Relieff-FAB-panelet
// (long-press) redigerer per-kart-verdiene. 'vektor' (default) = diskrete
// tone-bånd som rene SVG-polygoner; 'mjuk' = myk gradient-PNG (<image>).
const RELIEF_BANDS = 5
const reliefSettings = useReliefSettings()
const reliefEnabled = reliefSettings.reliefEnabled
const reliefMode = reliefSettings.reliefMode
const globalReliefEnabled = reliefSettings.globalReliefEnabled
const globalReliefMode = reliefSettings.globalReliefMode

// Per-element strek-tuning (Strek-FAB-panelet, v12.0.18) — per kart med global
// standard. Effektive multiplikatorer injiseres som override-CSS i kart-SVG-en
// (applyStrokeOverrides) og ganges med den globale --stroke-scale-knotten.
const strokeTuning = useStrokeTuning()
// Top-level ref → auto-unwrap i template (nested refs unwrappes ikke).
const strokeEffective = strokeTuning.effective

// Flerspråklige navn (norsk - samisk - finsk) i Nord-Norge. Default AV = vis
// kun det norske leddet for et renere kart; PÅ = vis hele det flerspråklige
// navnet slik OSM lagrer det. Søk treffer alltid alle språk (useMapSearch
// leser data-name-full uavhengig av hva som vises).
const SHOW_FULL_NAMES_LS_KEY = 'lende-show-full-names'
const showFullNames = ref((() => {
  try { return localStorage.getItem(SHOW_FULL_NAMES_LS_KEY) === '1' } catch { return false }
})())
// MERK: watch-en MÅ stå etter showFullNames-deklarasjonen — watch() kjøres ved
// setup, og en watch plassert før ref-en traff TDZ («Cannot access … before
// initialization») som krasjet hele MapView til sort skjerm.
watch(showFullNames, () => {
  try { localStorage.setItem(SHOW_FULL_NAMES_LS_KEY, showFullNames.value ? '1' : '0') } catch { /* noop */ }
  applyNameLanguage()
  // Navnene endret bredde → la navn-LOD revurdere hvilke som får plass.
  scheduleNameLOD()
})

// Tekststørrelse-slider (desktop) — søsken til rotasjons-sliden. Verdien er
// −100…100 med 0 = «normal» (midtstilt); skala = 2^(v/100) → 0.5×…2.0×, så
// brukeren både kan øke og minske størrelsen på alle kart-etiketter. Lagres i
// localStorage, men nullstilles av «Sentrer/Nullstill»-FAB (onResetAndRefreshGps).
const LABEL_SCALE_MIN = -100
const LABEL_SCALE_MAX = 100
function loadLabelScaleSlider() {
  try {
    const v = parseInt(localStorage.getItem(LABEL_SCALE_LS_KEY), 10)
    if (Number.isInteger(v) && v >= LABEL_SCALE_MIN && v <= LABEL_SCALE_MAX) return v
  } catch { /* noop */ }
  return 0
}
const labelScaleSlider = ref(loadLabelScaleSlider())
const userLabelScale = computed(() => Math.pow(2, labelScaleSlider.value / 100))
const labelScalePct = computed(() => Math.round(userLabelScale.value * 100))
const strokeScale = computed(() => STROKE_STEPS[strokeStepIndex.value] * strokeSizeBase(meta.value?.widthM))
const reliefOpacity = computed(() => RELIEF_STEPS[reliefStepIndex.value])
const strokeFrac = computed(() => strokeStepIndex.value / (STROKE_STEPS.length - 1))
const reliefFrac = computed(() => reliefStepIndex.value / (RELIEF_STEPS.length - 1))

// Gauge-geometri: 270° sveip med gap nederst, i et 24×24 viewBox.
const KNOB_R = 8.5
function knobPolar(deg, r) {
  const a = deg * Math.PI / 180
  return [12 + r * Math.cos(a), 12 + r * Math.sin(a)]
}
function knobArc(frac, r = KNOB_R) {
  if (frac <= 0) return ''
  const sweep = 270 * frac
  const [x0, y0] = knobPolar(135, r)
  const [x1, y1] = knobPolar(135 + sweep, r)
  const large = sweep > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}
const knobTrackD = knobArc(1)
const strokeArcD = computed(() => knobArc(strokeFrac.value))
const reliefArcD = computed(() => knobArc(reliefFrac.value))
// Senter-strek tegnes i faktisk valgt tykkelse — selv-demonstrerende ikon.
const strokeGlyphW = computed(() => (0.9 + 3.0 * strokeFrac.value).toFixed(2))
const reliefGlyphOpacity = computed(() => (0.18 + 0.7 * reliefFrac.value).toFixed(2))

// Transient hint-boble ved justering.
const knobHint = ref('')
let knobHintTimer = null
function flashKnobHint(text) {
  knobHint.value = text
  if (knobHintTimer) clearTimeout(knobHintTimer)
  knobHintTimer = setTimeout(() => { knobHint.value = '' }, 1500)
}

function applyStrokeScale() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (svg) svg.style.setProperty('--stroke-scale', String(strokeScale.value))
}

// Per-element strek-overstyring (Strek-FAB-panelet): injiserer !important-regler
// som slår kartets bakede symbolizer-CSS. Nøytrale sliders → tom CSS → identisk
// rendering med i dag. Ghost-fliser og detalj-inset arver reglene siden de
// nestes/klones inn under samme SVG-rot; eksport klones fra live-DOM → WYSIWYG.
function applyStrokeOverrides() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  let el = svg.querySelector('#stroke-override-style')
  const css = buildStrokeOverrideCss(strokeTuning.effective.value)
  if (!css) { el?.remove(); return }
  if (!el) {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    el.setAttribute('id', 'stroke-override-style')
    svg.appendChild(el)
  }
  el.textContent = css
}
watch(strokeTuning.effective, applyStrokeOverrides)

// Tekst-skala — settes som CSS-var på kart-SVG-en; alle [data-label]-font-sizes
// ganges med den via calc() i symbolizer-CSS-en (se `fs()` der). Sanntid, ingen
// re-render.
function applyLabelScale() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (svg) svg.style.setProperty('--label-scale', String(userLabelScale.value))
}
watch(labelScaleSlider, () => {
  applyLabelScale()
  try { localStorage.setItem(LABEL_SCALE_LS_KEY, String(labelScaleSlider.value)) } catch { /* noop */ }
  flashKnobHint(`Tekst ${Math.round(userLabelScale.value * 100)}%`)
  labelBoxCache.clear(); scheduleNameLOD()   // tekst-skala endrer boks-bredden
})

// Font-par — settes som CSS-vars på kart-SVG-en; symbolizer-CSS-en bruker
// var(--land-font) på roten og var(--water-font) på vann-navn. Sanntid bytte.
// (Persistens skjer i useLabelFonts; her bare appliseringen.)
function applyLabelFonts() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  svg.style.setProperty('--land-font', landFont.value)
  svg.style.setProperty('--water-font', waterFont.value)
}
watch(fontPairId, () => {
  applyLabelFonts()
  flashKnobHint(`Font: ${fontPairId.value}`)
  labelBoxCache.clear(); scheduleNameLOD()   // ny font endrer boks-bredden
})
// Navnetetthet-bytte (eller bytte mellom global/per-kart) → re-vrak straks
// (rutenett-kvoten kan endres; boks uendret).
watch([densityId, densityApplyToAll], () => scheduleNameLOD())

watch(strokeStepIndex, () => {
  applyStrokeScale()
  try { localStorage.setItem(STROKE_LS_KEY, String(strokeStepIndex.value)) } catch { /* noop */ }
  flashKnobHint(`Strek ${strokeScale.value.toFixed(2)}×`)
})
watch(reliefStepIndex, () => {
  applyHillshade()
  updateGhostReliefOpacity()   // hold mosaikk-spøkelsene i takt med relieff-nivået
  try { localStorage.setItem(RELIEF_LS_KEY, String(reliefStepIndex.value)) } catch { /* noop */ }
  flashKnobHint(reliefOpacity.value === 0 ? 'Relieff av' : `Relieff ${Math.round(reliefOpacity.value * 100)}%`)
})

// Maks-fliser-slider: persistér + håndhev en senket grense straks (kapp fjerneste).
watch(maxTileIndex, () => {
  try { localStorage.setItem(MAX_TILES_LS_KEY, String(maxTileIndex.value)) } catch { /* noop */ }
  const m = meta.value
  const c = m ? visibleCenterSvg() : null
  let center = null
  try { if (m && c) center = svgToWgs84(c.x, c.y, m) } catch { center = null }
  pruneAutoTiles({ center: center ?? undefined, max: maxTiles.value, protectIds: [mapId.value] })
    .then(() => { void refreshAutoTileCount() })
    .catch(() => {})
  flashKnobHint(`Maks ${maxTiles.value} kartfliser`)
})

// Relieff av/på (effektiv verdi — reagerer på både per-kart- og global-endring):
// regenerer aktiv-flisas hillshade og re-render mosaikken (spøkelses-relieff
// opprettes/fjernes i buildGhostSvg etter reliefEnabled). Persistering skjer i
// useReliefSettings.
watch(reliefEnabled, () => {
  applyHillshade()
  void renderGhostTiles()
  flashKnobHint(reliefEnabled.value ? 'Relieff på' : 'Relieff av')
})

// Relieff-stil bytte: fjern eksisterende relieff-lag (kan være feil element-type),
// nullstill bånd-cachen, bygg på nytt, og re-render mosaikken (spøkelses-relieff
// gates på modus i buildGhostSvg).
watch(reliefMode, () => {
  svgHostRef.value?.querySelector('svg #hillshade-layer')?.remove()
  cachedBandsKey = null
  applyHillshade()
  void renderGhostTiles()
  flashKnobHint(reliefMode.value === 'vektor' ? 'Skarpt relieff (vektor)' : 'Mjukt relieff (bilde)')
})

// Tap = step (wrap) / sentrer, lang-trykk (600 ms) = åpne FAB-ens innstillings-
// panel (v12.0.18 — erstattet lang-trykk-nullstill; nullstilling bor nå som
// egen knapp i panelene). `knobSettled` gjør at ett trykk gir nøyaktig ett
// hakk: et avsluttet trykk (committet step ELLER lang-trykk) markeres settled,
// så et nytt avsluttende event ikke kan telle om igjen.
const knobPanel = ref(null)   // 'stroke' | 'relief' | 'zoom' | null
const KNOB_HOLD_MS = 600
let knobTimer = null
let knobSettled = true
function knobDown(kind) {
  knobSettled = false
  if (knobTimer) clearTimeout(knobTimer)
  knobTimer = setTimeout(() => {
    knobSettled = true   // lang-trykk konsumerer trykket → ingen step/sentrer ved release
    closeDrawer()        // hovedmeny-skuffen viker for panelet (som ved long-press på kart)
    knobDrawer.reset()   // alltid åpne i standard-høyde (45 dvh)
    knobPanel.value = kind === 'center' ? 'zoom' : kind
  }, KNOB_HOLD_MS)
}
// Bindes til BÅDE pointerup og pointercancel. Enkelte mobil-nettlesere
// (sett på Samsung Internet) sender `pointercancel` i stedet for `pointerup`
// når knappen krymper via `active:scale-95`. Da knobCancel bare ryddet timeren
// uten å telle, ble trykket «mistet» — reliefknotten hoppet over et hakk og
// tok det igjen ved neste trykk (tellefeilen). `knobSettled`-vakten gjør
// committen idempotent, så pointerup + pointercancel aldri teller dobbelt.
function knobUp(kind) {
  if (knobTimer) { clearTimeout(knobTimer); knobTimer = null }
  if (knobSettled) return
  knobSettled = true
  if (kind === 'stroke') {
    strokeStepIndex.value = (strokeStepIndex.value + 1) % STROKE_STEPS.length
  } else if (kind === 'relief') {
    if (!reliefEnabled.value) { flashKnobHint('Relieff er av — hold for innstillinger'); return }
    reliefStepIndex.value = (reliefStepIndex.value + 1) % RELIEF_STEPS.length
  } else {
    onResetAndRefreshGps()
  }
}

// «Kartstørrelse» i Zoom-FAB-panelet gjelder KUN ombygging av det aktive
// kartet — rører ikke den globale nye-kart-preferansen (mapSizeKm). Initieres
// til gjeldende kartbredde når panelet åpnes. (MERK: watch-en må stå ETTER
// knobPanel-deklarasjonen — TDZ, jf. showFullNames-merknaden.)
const rebuildSizeKm = ref(DEFAULT_MAP_WIDTH_KM)
watch(knobPanel, (p) => {
  if (p !== 'zoom') return
  const w = Math.round((meta.value?.widthM ?? 0) / 1000)
  rebuildSizeKm.value = Math.min(MAP_SIZE_MAX_KM, Math.max(MAP_SIZE_MIN_KM, w || DEFAULT_MAP_WIDTH_KM))
})

// Panel-handlinger: «Angi som standard» løfter kartets verdier til global
// standard; «Nullstill» setter kartet tilbake (strek → 1× + knott-default,
// relieff → på + vektor + knott-default). Feedback vises i panel-footeren
// (panelHint) — knobHint-bobla ligger bak panelet.
const panelHint = ref('')
let panelHintTimer = null
function flashPanelHint(text) {
  panelHint.value = text
  if (panelHintTimer) clearTimeout(panelHintTimer)
  panelHintTimer = setTimeout(() => { panelHint.value = '' }, 2000)
}
function strokePanelSaveDefault() {
  strokeTuning.saveAsDefault()
  flashPanelHint('Lagret som standard for alle kart')
}
function strokePanelReset() {
  strokeTuning.resetToNeutral()
  strokeStepIndex.value = STROKE_DEFAULT_IDX
  flashPanelHint('Strek nullstilt')
}
function reliefPanelSaveDefault() {
  reliefSettings.saveReliefAsDefault()
  flashPanelHint('Lagret som standard for alle kart')
}
function reliefPanelReset() {
  reliefSettings.resetRelief()
  reliefStepIndex.value = RELIEF_DEFAULT_IDX
  flashPanelHint('Relieff nullstilt')
}
function closeKnobPanel() {
  knobPanel.value = null
  panelHint.value = ''
}

// Unified transform: translate ∘ rotate ∘ scale med transform-origin 0 0.
// Én enkelt transform-matrise lar oss rotere rundt vilkårlig pivot (finger-
// senter) ved å oppdatere translate samtidig — to nested transformer ville
// låst rotasjonen til element-senter (v8.9.2).
const mapTransformStyle = computed(() => {
  // v8.10.4 — Perf: will-change: transform under aktiv gest/anim hinter til
  // browseren at en composited layer skal opprettes for kart-divet, så
  // transform-oppdateringer skjer på GPU uten å trigge layout/paint av
  // SVG-content. Settes tilbake til 'auto' i hvile så vi ikke holder
  // GPU-memory unødvendig i bakgrunnen.
  const active = (isGesturing && isGesturing.value) || animating.value
  return {
    transform: `translate(${translateX.value}px, ${translateY.value}px) `
             + `rotate(${rotation.value}deg) scale(${scale.value})`,
    transformOrigin: '0 0',
    transition: animating.value ? 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
    willChange: active ? 'transform' : 'auto',
  }
})

const userPos = useUserPosition(() => meta.value)
const proximity = useProximityAlert(() => userPos)
const compass = useCompass()

// Kompass-rosen (oppe til høyre): tap setter kart-NORD som «opp» (rotateTo 0).
// Supplerer «Sentrer»-FAB-en nederst (som nullstiller zoom OG rotasjon) ved å
// kun uvri rotasjonen — zoom/posisjon beholdes. Kompass-FØLGE (heading-modus)
// roterer kartet etter enhetens retning, så det gir ingen mening å «låse nord»
// mens den er på → vi slår den av først. Følge-toggelen finnes fortsatt som
// «Kompass»-knappen i Innstillinger-skuffen.
function pointNorth() {
  if (compass.isActive) compass.stop()
  rotateTo(0)
}

// Annoteringsmodus — point-symboler over auto-generert kart
const mapId = computed(() => route.params.id ?? 'vardasen')
// Bind per-kart-overstyringene (navnetetthet, strek-tuning, relieff) til
// kartet som vises.
watch(mapId, (id) => {
  setDensityMap(id)
  strokeTuning.setCurrentMap(id)
  reliefSettings.setCurrentMap(id)
}, { immediate: true })
const annot = useMapAnnotations(mapId.value)
// Stifinner — rutenavigasjon A→B på sti-laget. Egen modus-maskin (idle →
// pickingStart → showing); gjensidig utelukkende med måling/annotering.
const sti = useStifinner()
// Settes ved setupHostSvg: har kartet routbare sti-/vei-lag? Styrer om
// «Naviger hit» vises.
const mapHasTrails = ref(false)
const showSymbolPalette = ref(false)
let lastSvgString = ''      // huskes til print-eksport

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

// Globalt stedssøk (Nominatim) som FALLBACK: kart-søket ser bare navn i det
// rendrede SVG-et, så et sted utenfor utsnittet gir 0 treff. Da tilbyr vi
// globale forslag — velges ett, bygges et nytt kart der. Kobles kun når
// kart-søket er tomt (og query ≥ 2 tegn) så vi ikke fyrer unødige Nominatim-
// kall når kartet allerede har treff. Debounce/abort ligger i composablen.
const placeSearch = useNominatim({ debounceMs: 350 })
const globalResults = placeSearch.results
const globalSearching = placeSearch.isSearching
watch([searchResults, searchQuery], ([res, q]) => {
  placeSearch.query.value = (res.length === 0 && (q ?? '').trim().length >= 2) ? q : ''
})

function openSearch() {
  searchOpen.value = true
  closeDrawer()
  // Fokus håndteres av MapSearchOverlay når open blir true.
}
function closeSearch() {
  searchOpen.value = false
  mapSearch.clear()
  placeSearch.query.value = ''
}
function clearHighlight() {
  highlightedFeature.value = null
  renderHighlight()
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
    forcedVisibleNameEls.add(r.el)
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
  placeSearch.query.value = ''
  renderHighlight()
}

// Globalt treff valgt (utenfor dette kartet) → bygg et nytt kart sentrert der.
// Gjenbruker buildMapFromCenter (samme flyt som on-the-fly-bygging og
// rebuildAtChosenSize) med standard kartstørrelse.
async function onSelectGlobalPlace(hit) {
  if (buildingOnTheFly.value) return
  searchOpen.value = false
  mapSearch.clear()
  placeSearch.query.value = ''
  const dims = defaultMapDims()
  const widthKm = (dims.halfKm ?? DEFAULT_MAP_WIDTH_KM / 2) * 2
  buildingOnTheFly.value = true
  buildingProgress.value = `Bygger kart ved ${hit.shortName} …`
  try {
    const { id } = await buildMapFromCenter({
      center: { lat: hit.lat, lon: hit.lon, name: hit.shortName },
      ...dims,
      equidistanceM: equidistanceForWidthKm(widthKm),
      navn: hit.shortName,
      terrainFirst: true,
      onProgress: (msg) => { buildingProgress.value = msg },
    })
    router.push({ name: 'kart-vis', params: { id } })
  } catch (e) {
    console.error('Bygg fra søk feilet:', e)
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    showAutoMapToast('Kunne ikke bygge kart her')
  }
}

// Tastaturnavigasjon (desktop): pil ned/opp markerer, Enter velger, Escape
// nullstiller søkebegrepet. Fokus blir i input-en så Escape alltid virker.
const { activeIndex: searchActiveIndex, onKeydown: onSearchKeydown } = useSearchKeyboard(searchResults, {
  onSelect: selectSearchResult,
  onClear: () => mapSearch.clear(),
  optionId: (i) => `mapsearch-opt-${i}`,
})

// ── «Nærmeste …»-snarveier (parkering / toalett / holdeplass) ─────────────
// Highlighter samme rosa puls-ring som et fritekstsøk-treff, men finner
// nærmeste POI av en gitt type RELATIVT til long-press-punktet (PUNKT-arket).
// Et generelt søk gir ikke mening her — «nærmeste» må ha et referansepunkt.
const POI_KINDS = {
  parkering:  { label: 'Nærmeste parkering',  selector: '[data-layer="parkering"] g[transform]' },
  toalett:    { label: 'Nærmeste toalett',    selector: '[data-layer="sjo-poi"] g[data-iso="554"]' },
  holdeplass: { label: 'Nærmeste holdeplass', selector: '[data-layer="holdeplass"] g[transform]' },
}

// Antall POI pr type i det lastede kartet — styrer om snarvei-knappen er
// aktiv eller grået ut. Beregnes når SVG-en er lastet (kartet endrer seg ikke
// etterpå utenom highlight/spor-overlays).
const poiCounts = ref({ parkering: 0, toalett: 0, holdeplass: 0 })
function computePoiAvailability() {
  const svg = svgHostRef.value?.querySelector('svg')
  const next = { parkering: 0, toalett: 0, holdeplass: 0 }
  if (svg) {
    for (const kind of Object.keys(POI_KINDS)) {
      next[kind] = svg.querySelectorAll(POI_KINDS[kind].selector).length
    }
  }
  poiCounts.value = next
}

function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

// Finn + highlight nærmeste POI av `kind` relativt til (ox, oy) i viewBox-meter.
function nearestPoi(kind, ox, oy) {
  const cfg = POI_KINDS[kind]
  const svg = svgHostRef.value?.querySelector('svg')
  if (!cfg || !svg || !meta.value || ox == null || oy == null) return

  let best = null, bestD2 = Infinity
  for (const el of svg.querySelectorAll(cfg.selector)) {
    const m = (el.getAttribute('transform') || '').match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/)
    if (!m) continue
    const x = parseFloat(m[1]), y = parseFloat(m[2])
    const d2 = (x - ox) ** 2 + (y - oy) ** 2
    if (d2 < bestD2) { bestD2 = d2; best = { x, y, el } }
  }
  if (!best) return   // knappen er uansett grået ut når kartet mangler typen

  const name = best.el.getAttribute('data-name')
  const distLabel = fmtDist(Math.sqrt(bestD2))
  // To-linjers chip: stedsnavnet (om det finnes) på linje 1, type + avstand
  // fra markert punkt på linje 2. Uten navn løftes typen til linje 1.
  highlightedFeature.value = name
    ? { name, sub: `${cfg.label} · ${distLabel}`, x: best.x, y: best.y, kind }
    : { name: cfg.label, sub: `${distLabel} fra punktet`, x: best.x, y: best.y, kind }
  panTo(best.x, best.y, { vbWidth: meta.value.widthM, vbHeight: meta.value.heightM, targetScale: Math.max(scale.value, zoomNearThreshold.value) })
  renderHighlight()
}

// Fra PUNKT-arket: nærmeste relativt til long-press-punktet, så lukk arket.
function nearestPoiFromPoint(kind) {
  const p = contextMenuPoint.value
  if (!p || !poiCounts.value[kind]) return
  nearestPoi(kind, p.svgX, p.svgY)
  closeContextMenu()
}

// ── Navn-LOD: skjul overflødige stedsnavn i tett-befolkede utsnitt ─────────
// Når et synlig kartutsnitt inneholder mer enn navne-budsjettet søkbare navn,
// skjules de minst prioriterte. Vann/elver/bekker og «store» stedsnavn (by/
// tettsted) prioriteres og skjules aldri av denne mekanismen. Alle navn forblir
// søkbare — søkeindeksen (useMapSearch) leser hele SVG-en uavhengig av denne
// visnings-LOD-en, og et treff som velges tvinges synlig (forcedVisibleNameEls).
//
// v11.0.34: budsjettet er zoom-trappet — få navn på oversikt (ren bakgrunn),
// gradvis flere når man zoomer inn. Tidligere var det fast 200 uansett zoom.
// v11.0.37: terskel + budsjetter er live-justerbare (useLodTuning, Utvikler-fanen).
function nameBudgetForZoom() {
  const s = scale.value || 1
  if (s >= zoomNearThreshold.value) return nameBudgetNear.value
  if (s >= ZOOMED_IN_THRESHOLD) return nameBudgetMid.value
  return nameBudgetFar.value
}
const forcedVisibleNameEls = new Set()
let nameLodTimer = null

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

// Label-boks (user-units) måles én gang når labels er synlige, cachet pr element.
// Re-måles ved kart-load, tekst-skala- og font-bytte (alle endrer boks-bredden).
const labelBoxCache = new Map()
function measureLabelBoxes() {
  const idx = mapSearch.index.value
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
const nameMinZoomOf = (score) => makeMinZoomOf(zoomNearThreshold.value)(score)

// Tetthets-budsjett: score → LOD (m/hysterese) → grådig kollisjon (rbush) +
// rutenett-kvote → synlig-sett. Ren algoritme i lib/labelDeclutter.js; her står
// kun skjermrom-transformen og DOM-toggling.
function applyNameLOD() {
  const svg = svgHostRef.value?.querySelector('svg')
  const m = meta.value
  const idx = mapSearch.index.value
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
  const MARGIN = 80   // px slingringsmonn så navn rett utenfor kanten teller med
  const px2 = fit * s // user-units → skjerm-px

  const candidates = []
  for (const e of idx) {
    if (!e.el) continue   // unavngitte vann-polygoner har ingen tekst å toggle
    const px = offX + e.x * fit
    const py = offY + e.y * fit
    const sx = tx + s * (px * cos - py * sin)
    const sy = ty + s * (px * sin + py * cos)
    if (sx < -MARGIN || sx > w + MARGIN || sy < -MARGIN || sy > h + MARGIN) {
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

function scheduleNameLOD() {
  if (nameLodTimer) clearTimeout(nameLodTimer)
  nameLodTimer = setTimeout(applyNameLOD, 120)
}

// Re-beregn LOD når utsnittet endrer seg (zoom/pan/rotasjon, gest eller
// programmatisk). Debouncet så en pågående gest ikke beregner per frame.
watch([scale, translateX, translateY, rotation], scheduleNameLOD)

// ── Viewport-culling: skjul vektorer utenfor utsnittet («out of sight,
// out of mind») ─────────────────────────────────────────────────────────────
// Pan/zoom er en CSS-transform på composited wrapper, så gevinsten ligger
// IKKE i selve panningen (compositor flytter ferdig tekstur) men i re-raster:
// pinch-zoom, gest-slutt-repaint (non-scaling-stroke/dash snapper tilbake),
// lag-toggles og raster-minne. Cull-rekta er viewporten ekspandert med raus
// margin, så normale pans avdekker allerede-synlig innhold momentant uten JS;
// re-beregning skjer kun når utsnittet rømmer forrige margin (hysterese i
// needsRecull) — og aldri midt i en gest (kjøres på gest-slutt, der framen
// uansett betaler for snap-back-repainten).
//
// Skjules med klasse `vp-cull` (CSS nederst i fila, IKKE i symbolizer-CSS-en
// inni SVG-en — så eksport/print alltid viser alt, samme kontrakt som
// .name-lod-off). Per-element-klasse kolliderer aldri med applyLayerVisibility
// (som setter style.display på hele lag-grupper): et element vises kun når
// laget er på OG det ikke er cullet OG ikke LOD-skjult.
//
// Kill switch: localStorage 'vp-cull-off' = '1'. Debug-tint (vis i rødt i
// stedet for å skjule): localStorage 'cull-debug' = '1'.
const cullDisabled = (() => { try { return localStorage.getItem('vp-cull-off') === '1' } catch { return false } })()
const cullDebugTint = (() => { try { return localStorage.getItem('cull-debug') === '1' } catch { return false } })()
let cullIndex = null
let cullPrevVisible = null
let cullPrevState = null
let cullTimer = null
const cullStats = ref({ indexed: 0, culled: 0, ms: 0 })

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
  if (cullDisabled) return
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
  //    hule/gruve/trig/kirke/bom etter posisjons-fiksen) + navn-grupper.
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
  if (cullDisabled || !cullIndex) return
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

function scheduleViewportCull() {
  if (cullTimer) clearTimeout(cullTimer)
  cullTimer = setTimeout(() => {
    // Aldri midt i en gest: en klasse-toggle der ville tvinge en unødig paint-
    // invalidasjon. Gest-slutt-watcheren tar den i stedet.
    if (!isGesturing.value) applyViewportCull()
  }, 120)
}
watch([scale, translateX, translateY, rotation], scheduleViewportCull)
watch(isGesturing, (g) => { if (!g) applyViewportCull() })

// Pulsering tegnes som SVG-circle i et eget overlay-lag, lik annoteringer.
// Holder konstant skjerm-størrelse ved å konvertere CSS-px til user-units via
// scale.value.
function renderHighlight() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const ns = 'http://www.w3.org/2000/svg'
  let layer = svg.querySelector('#search-highlight-layer')
  const h = highlightedFeature.value
  if (!h) {
    if (layer) layer.remove()
    return
  }
  if (!layer) {
    layer = document.createElementNS(ns, 'g')
    layer.setAttribute('id', 'search-highlight-layer')
    layer.setAttribute('data-layer', 'search-highlight')
    layer.setAttribute('pointer-events', 'none')
    svg.appendChild(layer)
  }
  layer.replaceChildren()
  const r1 = pxToUserUnits(18)
  const r2 = pxToUserUnits(34)
  const sw = pxToUserUnits(2.5)

  // Indre ring — solid stroke, sterk farge
  const inner = document.createElementNS(ns, 'circle')
  inner.setAttribute('cx', h.x); inner.setAttribute('cy', h.y)
  inner.setAttribute('r', r1)
  inner.setAttribute('fill', 'rgba(244, 114, 182, 0.18)')
  inner.setAttribute('stroke', '#f472b6')
  inner.setAttribute('stroke-width', String(sw))
  layer.appendChild(inner)

  // Ytre puls-ring — SMIL-animasjon, ekspanderer + fader
  const pulse = document.createElementNS(ns, 'circle')
  pulse.setAttribute('cx', h.x); pulse.setAttribute('cy', h.y)
  pulse.setAttribute('r', String(r1))
  pulse.setAttribute('fill', 'none')
  pulse.setAttribute('stroke', '#f472b6')
  pulse.setAttribute('stroke-width', String(sw))
  pulse.setAttribute('opacity', '0.8')
  const anR = document.createElementNS(ns, 'animate')
  anR.setAttribute('attributeName', 'r')
  anR.setAttribute('values', `${r1};${r2}`)
  anR.setAttribute('dur', '1.4s')
  anR.setAttribute('repeatCount', 'indefinite')
  pulse.appendChild(anR)
  const anO = document.createElementNS(ns, 'animate')
  anO.setAttribute('attributeName', 'opacity')
  anO.setAttribute('values', '0.85;0')
  anO.setAttribute('dur', '1.4s')
  anO.setAttribute('repeatCount', 'indefinite')
  pulse.appendChild(anO)
  layer.appendChild(pulse)
}

// Hold ringen på konstant skjerm-størrelse ved zoom.
watch(scale, () => { if (highlightedFeature.value) renderHighlight() })

// Mål-markør for et aktivt nærhetsvarsel: en fast-skjerm-størrelse pin pluss
// en sirkel som viser den ekte utløsnings-radiusen (i meter = user-units).
function renderProximityTarget() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const ns = 'http://www.w3.org/2000/svg'
  let layer = svg.querySelector('#proximity-layer')
  const a = proximity.active.value
  if (!a) {
    if (layer) layer.remove()
    return
  }
  if (!layer) {
    layer = document.createElementNS(ns, 'g')
    layer.setAttribute('id', 'proximity-layer')
    layer.setAttribute('data-layer', 'proximity')
    layer.setAttribute('pointer-events', 'none')
    svg.appendChild(layer)
  }
  layer.replaceChildren()
  const sw = pxToUserUnits(2)
  const dot = pxToUserUnits(5)

  // Utløsnings-radius i ekte meter
  const radius = document.createElementNS(ns, 'circle')
  radius.setAttribute('cx', a.svgX); radius.setAttribute('cy', a.svgY)
  radius.setAttribute('r', String(a.distanceM))
  radius.setAttribute('fill', 'rgba(56, 189, 248, 0.12)')
  radius.setAttribute('stroke', '#38bdf8')
  radius.setAttribute('stroke-width', String(sw))
  radius.setAttribute('stroke-dasharray', `${pxToUserUnits(4)} ${pxToUserUnits(4)}`)
  layer.appendChild(radius)

  // Senter-prikk (fast skjermstørrelse)
  const center = document.createElementNS(ns, 'circle')
  center.setAttribute('cx', a.svgX); center.setAttribute('cy', a.svgY)
  center.setAttribute('r', String(dot))
  center.setAttribute('fill', '#0284c7')
  center.setAttribute('stroke', '#ffffff')
  center.setAttribute('stroke-width', String(pxToUserUnits(1.5)))
  layer.appendChild(center)
}

watch(() => proximity.active.value, renderProximityTarget, { deep: true })
watch(scale, () => { if (proximity.active.value) renderProximityTarget() })

// ── Share-flow ────────────────────────────────────────────────────────────
// Bygger URL som tar mottaker til samme kart-utsnitt. Built-in kart pekes
// direkte på /kart/:id; brukers egne kart deles som /kart/nytt?lat=&km=&eq=
// så mottaker selv kan generere sin lokale kopi (SVG-en bor i IndexedDB
// hos sender).
//
// «Del kart» (uten `place`) deler kun utsnittet. «Del kart og sted» sender med
// et markert sted som eksakte koordinater (slat/slon) + navn (hl): mottakeren
// får en rosa puls-markering på NØYAKTIG samme punkt — robust uavhengig av om
// navnet finnes i deres ferske søkeindeks, så stedet ikke går tapt.
const shareInfo = computed(() => {
  if (!meta.value) return null
  const m = meta.value
  const lat = (m.bbox.south + m.bbox.north) / 2
  const lon = (m.bbox.west + m.bbox.east) / 2
  const sizeKm = m.widthM ? +(m.widthM / 1000).toFixed(2) : 4
  const equidistanceM = m.equidistance ?? 20
  return { lat, lon, sizeKm, equidistanceM }
})

function buildShareUrl(place = null) {
  if (!shareInfo.value) return null
  const base = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
  const id = route.params.id ?? 'vardasen'
  const isBuiltin = !!BUILTIN[id]
  const params = new URLSearchParams()
  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    if (place.name) params.set('hl', place.name)
    params.set('slat', place.lat.toFixed(6))
    params.set('slon', place.lon.toFixed(6))
  }
  if (isBuiltin) {
    // Built-in: del direkte view-URL — mottaker ser nøyaktig samme kart.
    const qs = params.toString()
    return `${base}/kart/${id}${qs ? `?${qs}` : ''}`
  }
  // Stored map: del bbox + ekvidistanse. Mottaker lander i picker (låst
  // utsnitt); etter generering navigeres til MapView med ?hl=&slat=&slon=.
  const s = shareInfo.value
  params.set('lat', s.lat.toFixed(5))
  params.set('lon', s.lon.toFixed(5))
  params.set('km', String(s.sizeKm))
  params.set('eq', String(s.equidistanceM))
  return `${base}/kart/nytt?${params.toString()}`
}

const shareState = ref('idle')  // idle | sharing | copied | error
let shareResetTimer = null

// Felles dele-mekanikk: native share-sheet (iOS/Android) med clipboard-fallback
// på desktop. `shareState` driver knapp-teksten i begge dele-knapper.
async function performShare(url, title, text) {
  if (!url) return
  const shareData = { title, text, url }
  // navigator.share åpner native iOS/Android-dialog der brukeren velger
  // app (Meldinger, WhatsApp, Mail, AirDrop osv). canShare() finnes på
  // moderne browsere men ikke alltid — try/catch dekker resten.
  if (typeof navigator.share === 'function') {
    shareState.value = 'sharing'
    try {
      if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
        throw new Error('share-data-rejected')
      }
      await navigator.share(shareData)
      shareState.value = 'idle'
      return
    } catch (err) {
      // AbortError = bruker lukket sheet — det er ikke en feil
      if (err && err.name === 'AbortError') {
        shareState.value = 'idle'
        return
      }
      // Fall through til clipboard-fallback under
    }
  }
  // Fallback: kopier til utklippstavle. Brukes på desktop (uten share-sheet)
  // og når native share-API ikke aksepterer data (sjeldne tilfeller).
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    shareState.value = 'copied'
  } catch {
    shareState.value = 'error'
  }
  if (shareResetTimer) clearTimeout(shareResetTimer)
  shareResetTimer = setTimeout(() => { shareState.value = 'idle' }, 2200)
}

// «Del kart» — bare utsnittet, ingen markering.
function onShareMap() {
  performShare(buildShareUrl(), mapTitle.value || 'Lende — turkart', mapTitle.value)
}

// «Del kart og sted» fra drawer-en — bruker den aktive rosa søke-/POI-
// markeringen. SVG-punktet regnes om til WGS84 så mottakeren får eksakt
// samme punkt.
function onShareMapWithPlace() {
  const h = highlightedFeature.value
  if (!h || !meta.value) return
  const { lat, lon } = svgToWgs84(h.x, h.y, meta.value)
  performShare(
    buildShareUrl({ name: h.name, lat, lon }),
    mapTitle.value || 'Lende — turkart',
    `${mapTitle.value} — sted: ${h.name}`,
  )
}

// «Del kart og sted» fra long-press-punktet (PUNKT-arket): deler det
// brukeren akkurat trykket på — f.eks. et badevann eller utsiktspunkt.
function onShareMapWithContextPlace() {
  const info = contextMenuInfo.value
  if (!info) return
  const name = info.place?.name || 'Markert sted'
  performShare(
    buildShareUrl({ name, lat: info.lat, lon: info.lon }),
    mapTitle.value || 'Lende — turkart',
    `${mapTitle.value} — sted: ${name}`,
  )
  closeContextMenu()
}

function maybeHighlightFromQuery() {
  const hl = route.query.hl
  const slat = parseFloat(route.query.slat)
  const slon = parseFloat(route.query.slon)
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return

  // «Del kart og sted»: eksakte koordinater → samme rosa markering som om
  // mottakeren selv hadde søkt i utsnittet. Koordinat-basert er robust;
  // navne-oppslaget under er bare fallback for eldre lenker (kun ?hl=).
  if (Number.isFinite(slat) && Number.isFinite(slon) && meta.value) {
    const { x, y } = wgs84ToSvg(slat, slon, meta.value)
    highlightedFeature.value = { name: hl ? String(hl) : 'Delt sted', x, y, kind: 'delt-sted' }
    panTo(x, y, { vbWidth: meta.value.widthM, vbHeight: meta.value.heightM, targetScale: zoomNearThreshold.value })
    renderHighlight()
    return
  }

  if (!hl) return
  const match = findByName(mapSearch.index.value, String(hl))
  if (!match) return
  highlightedFeature.value = { name: match.name, x: match.x, y: match.y, kind: match.kind }
  if (meta.value) {
    panTo(match.x, match.y, { vbWidth: meta.value.widthM, vbHeight: meta.value.heightM, targetScale: zoomNearThreshold.value })
  }
  renderHighlight()
}

// GPS-spor — opptak + rendering av rutene brukeren går (v8.9.2)
const tracker = useTrackRecorder(mapId.value, userPos)
// Tikker hvert sekund mens opptak pågår, så live-stats (distanse/varighet)
// i drawer-en oppdateres uten å bero på nye GPS-fix.
const tracksNow = ref(Date.now())
let tracksTickTimer = null
watch(() => tracker.isRecording.value, (on) => {
  if (on) {
    if (!tracksTickTimer) tracksTickTimer = setInterval(() => { tracksNow.value = Date.now() }, 1000)
  } else if (tracksTickTimer) {
    clearInterval(tracksTickTimer); tracksTickTimer = null
  }
})

const liveTrackStats = computed(() => {
  const t = tracker.activeTrack.value
  if (!t) return null
  void tracksNow.value      // forcer re-eval på hver tikk
  const meters = trackLengthM(t)
  const ms = t.points.length > 0 ? Date.now() - t.points[0].t : 0
  return { meters, ms, points: t.points.length }
})

function formatDistance(m) {
  if (!m) return '0 m'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

// Relieff-rendering — flyttet til useReliefRender; watchene blir her.
const { applyHillshade, reliefBlendMode } = useReliefRender({
  svgHostRef, meta, storedDem, ensureDem, currentTheme,
  reliefEnabled, reliefMode, reliefOpacity, RELIEF_BANDS,
})

// Spøkelses-fliser — flyttet til useGhostTiles.
const {
  ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC,
  renderGhostTiles, updateGhostReliefOpacity,
} = useGhostTiles({
  svgHostRef, meta, mapId, isAlive: () => componentAlive, isGesturing,
  reliefEnabled, reliefMode, reliefOpacity, reliefBlendMode, RELIEF_BANDS,
  applyLayerVisibility, clampPan,
})

// Re-render relieffet når DEM-en lastes eller temaet byttes (blend-modus
// avhenger av tema). Selve nivå-endringer håndteres av reliefStepIndex-watch.
watch([storedDem, currentTheme], () => { applyHillshade() })

// Måleverktøy — distanse + areal (v8.9.4). Aktiveres via knapp i drawer.
// Tap-på-kart i denne modusen plasserer vertices. Lukket polygon viser
// både omkrets og areal (hektar / km²).
const measureMode = ref(false)
const measureVertices = ref([])
const measureClosed = ref(false)
function startMeasure() {
  measureMode.value = true
  measureVertices.value = []
  measureClosed.value = false
  // Sørg for at annoterings-/stifinner-modus ikke konkurrerer om tap-eventet
  annot.selectedSymbol.value = null
  annot.isAnnotateMode.value = false
  if (sti.active.value) { sti.cancel(); renderRoutes() }
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

// Distance og areal-stats utledes via computed slik at de re-evaluerer
// automatisk når vertices endres
const measureStats = computed(() => {
  const v = measureVertices.value
  if (v.length < 2) return { distM: 0, areaM2: 0 }
  let distM = 0
  for (let i = 1; i < v.length; i++) {
    distM += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y)
  }
  // Lukket polygon: shoelace + closing-edge i distance
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
  return { distM, areaM2 }
})

// ── Long-press kontekstmeny ──────────────────────────────────────────────
// Long-press (~550ms hold uten bevegelse) eller høyreklikk på kartet åpner
// en bottom-sheet med koordinater, stedsinfo og handlinger (kopier, del,
// start måling, åpne i Google Maps/Street View, plasser annotering).
//
// Implementasjon: vi binder pointer-events på wrapperRef. Pinch-zoom binder
// touch-events (touchstart/move/end) via egne addEventListener, så de to
// håndterer-settene konkurrerer ikke. Vi sporer kun primær-pointer'en og
// avbryter timeren ved bevegelse (>10 px) eller en sekundær pointer (pinch).
const contextMenuOpen = ref(false)
const contextMenuPoint = ref(null)     // { svgX, svgY, clientX, clientY }
// NVE Innsjødatabase-oppslag for long-press-punktet. Status: 'loading' |
// 'done' (med hoyde+navn) | 'empty' (ikke en registrert innsjø) | 'error'.
// Token-nøkkel forkaster trege svar når brukeren long-presser et nytt punkt.
const lakeQuery = ref(null)
let lakeQueryToken = 0
// Verneområde-oppslag (Naturbase + GBIF + Wikipedia) ved long-press.
// null = ingen verneområde her | { status:'loading' } | { status:'done',
// area, species, wiki }. species/wiki: 'loading' | objekt | null (utilgjengelig).
const verneQuery = ref(null)
let verneQueryToken = 0
// Hvilken rødliste-kategori (CR/EN/VU/NT) som er foldet ut i kortet. Accordion:
// kun én åpen om gangen. Nullstilles når et nytt verneområde slås opp.
const expandedRedCat = ref(null)
// NiN-naturtype-oppslag ved long-press (uavhengig av verneområde — naturtyper
// finnes overalt). null = ingen treff/ikke spurt | { status:'done', items:[…] }.
const naturtypeQuery = ref(null)
let naturtypeQueryToken = 0
// Nærmeste Wikipedia-sted (geosearch) ved long-press — uavhengig av verneområde.
// null = ikke spurt | { status:'loading' } | { status:'done', place } | { status:'empty' }.
const placeWikiQuery = ref(null)
let placeWikiToken = 0
const contextSheetRef = ref(null)      // bottom-sheet-elementet (for into-focus)
const detailInsetRef = ref(null)       // mini-SVG detalj-inset i bottom-sheeten
const DETAIL_INSET_M = 1000            // 1×1 km roambart vindu rundt punktet
// Detalj-lag (data-detail="1") løftet UT av hovedkartets DOM i setupHostSvg
// (perf — de er usynlige der men kostet parse/recalc/clone). Inset-en kloner
// inn herfra. Erstattes ved hver setupHostSvg (nytt kart = nye noder).
let detachedDetailLayers = []
const LONG_PRESS_MS = 550
const LONG_PRESS_MOVE_PX = 10

let lpTimer = null
let lpPointerId = null
let lpStartX = 0
let lpStartY = 0
let lpEvent = null      // siste pointerdown-event så vi kan re-projisere ved fire

function clearLongPress() {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null }
  lpPointerId = null
  lpEvent = null
}

function clientToSvgPoint(clientX, clientY) {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  return pt.matrixTransform(ctm.inverse())
}

function openContextMenuAt(clientX, clientY) {
  // Long-press skal være no-op mens et annet overlay (søk, on-the-fly) eier
  // UI-en, eller mens et ferskt kart fortsatt fyller inn detaljer
  // (detalj-insetet ville ellers vist halvbygd data).
  if (buildingOnTheFly.value || searchOpen.value ||
      fillingInDetails.value || sti.active.value) return
  const local = clientToSvgPoint(clientX, clientY)
  if (!local) return
  contextMenuPoint.value = {
    svgX: local.x, svgY: local.y,
    clientX, clientY,
  }
  contextMenuOpen.value = true
  contextDrawer.reset()
  closeDrawer()
  knobPanel.value = null   // FAB-panelet viker for kontekst-arket (unngå stablede sheets)
  // v9.3.3: INGEN auto-pan av hovedkartet. Brukeren har allerede plassert/
  // zoomet/rotert kartet slik de vil — å flytte det ved long-press var
  // forvirrende og ødela oversikten. Punktet vises i pin + detalj-inset.
}

function closeContextMenu() {
  contextMenuOpen.value = false
  contextMenuPoint.value = null
  contextActionState.value = 'idle'
  proximityPanelOpen.value = false
}

function onPointerDownLongPress(e) {
  // Kun primær single-pointer. Hvis en annen pointer allerede er aktiv (pinch),
  // avbryt timeren — det er en gest, ikke en long-press.
  if (lpPointerId != null) { clearLongPress(); return }
  // Ignorer høyreklikk her — den håndteres av contextmenu-eventet (som også
  // gir oss preventDefault på native browsermenyen).
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // Ignorer tap inne på interaktive UI-elementer (knapper, drawer-håndtak,
  // kant-soner) — disse har egne klikk-handlere.
  if (e.target.closest('button, input, textarea, select, a, [data-extend-dir]')) return
  lpPointerId = e.pointerId
  lpStartX = e.clientX
  lpStartY = e.clientY
  lpEvent = { clientX: e.clientX, clientY: e.clientY }
  lpTimer = setTimeout(() => {
    if (lpEvent) openContextMenuAt(lpEvent.clientX, lpEvent.clientY)
    clearLongPress()
  }, LONG_PRESS_MS)
}
function onPointerMoveLongPress(e) {
  if (lpPointerId == null || e.pointerId !== lpPointerId) return
  const dx = e.clientX - lpStartX
  const dy = e.clientY - lpStartY
  if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) clearLongPress()
}
function onPointerUpLongPress(e) {
  if (lpPointerId != null && e.pointerId === lpPointerId) clearLongPress()
}
function onContextMenuEvent(e) {
  // Høyreklikk på desktop. preventDefault stopper browser-menyen.
  e.preventDefault()
  openContextMenuAt(e.clientX, e.clientY)
}

// Ligger SVG-punktet (meter-rom) inni et ferskvanns-polygon (ISOM 301 innsjø /
// 302 tjern)? Brukes til å være ærlig om høyde: NHM_DTM er en bar-bakke-modell
// uten retur over vann, så vannflater leses som nodata-fylt-til-0 («0 moh»).
// Over innsjøer er den 0-en meningsløs (Tyrifjorden ligger på ~63 m, ikke 0),
// så vi viser «ikke tilgjengelig» istedenfor en falsk høyde. Saltvann (303)
// utelates med vilje — der ER havnivå ≈ 0 riktig.
function pointOnFreshwater(svgX, svgY) {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg || typeof svg.createSVGPoint !== 'function') return false
  const paths = svg.querySelectorAll('g[data-iso="301"] path, g[data-iso="302"] path')
  if (!paths.length) return false
  const rootPt = svg.createSVGPoint()
  rootPt.x = svgX
  rootPt.y = svgY
  for (const path of paths) {
    if (typeof path.isPointInFill !== 'function') continue
    // getCTM(): path-lokalt → SVG-rot-bruker-rom (= viewBox-meter, der svgX/svgY
    // bor). Invers mapper punktet ned til path-ens eget rom før fill-testen, så
    // evt. transform på mellomliggende grupper håndteres. fill-rule evenodd
    // respekteres → øy-hull i innsjøen teller korrekt som land.
    const ctm = typeof path.getCTM === 'function' ? path.getCTM() : null
    let local = rootPt
    if (ctm) {
      try { local = rootPt.matrixTransform(ctm.inverse()) } catch { continue }
    }
    if (path.isPointInFill(local)) return true
  }
  return false
}

// Ligger punktet PÅ en vannflate (sjø ELLER ferskvann)? Punkt-i-fyll mot alle
// vann-AREAL-koder (POLYGON_CODES-vannet i mapBuilder): 301/302 innsjø+elv-areal,
// 303 sjø, 307 dybdeareal, 308/309. Linjer (304/305 elv/bekk) telles ikke — vi
// vil bare avvise selve vannflaten. Brukes av Stifinner til å nekte start-/mål-
// punkt i vann. Samme CTM-invers-mønster som pointOnFreshwater (øy-hull via
// fill-rule evenodd teller som land).
const WATER_AREA_SELECTOR = ['301', '302', '303', '307', '308', '309']
  .map(c => `g[data-iso="${c}"] path`).join(', ')
function pointOnWater(svgX, svgY) {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg || typeof svg.createSVGPoint !== 'function') return false
  const paths = svg.querySelectorAll(WATER_AREA_SELECTOR)
  if (!paths.length) return false
  const rootPt = svg.createSVGPoint()
  rootPt.x = svgX
  rootPt.y = svgY
  for (const path of paths) {
    if (typeof path.isPointInFill !== 'function') continue
    const ctm = typeof path.getCTM === 'function' ? path.getCTM() : null
    let local = rootPt
    if (ctm) {
      try { local = rootPt.matrixTransform(ctm.inverse()) } catch { continue }
    }
    if (path.isPointInFill(local)) return true
  }
  return false
}

// Parse en linje-path-d ("M x,y L x,y ... M ...") til lister av [x,y]-punkter,
// én per subpath. mapBuilder skriver kun M/L med komma-separerte tall.
function parseLinePoints(d) {
  const subs = []
  for (const part of String(d).split('M')) {
    if (!part.trim()) continue
    const pts = []
    const re = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g
    let mm
    while ((mm = re.exec(part)) !== null) {
      const x = parseFloat(mm[1]), y = parseFloat(mm[2])
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
    }
    if (pts.length) subs.push(pts)
  }
  return subs
}

// Finn en navngitt vann-feature (elv/innsjø/bekk) som long-press-punktet ligger
// PÅ — uavhengig av hvor feature-ens navne-anker (sentroid) er. Løser at en lang
// elv (f.eks. Drammenselva) ellers taper mot et nærmere stedsnavn fordi
// findNearestPlace kun måler avstand til anker-punktet, ikke til geometrien.
//   1. Navngitte vann-AREALER (301/302/303): punkt-i-fyll. Velg minste areal
//      ved overlapp (mest spesifikk feature).
//   2. Navngitte vann-LINJER (304/305 elv/bekk): nærmeste punkt på polylinjen,
//      ren matematikk (ingen layout-tvingende getPointAtLength). Toleransen
//      skalerer med zoom (~14 px finger-treff) og clampes til [8, 60] m.
function findWaterFeatureAtPoint(svgX, svgY) {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg || typeof svg.createSVGPoint !== 'function') return null
  const pt = svg.createSVGPoint()
  pt.x = svgX
  pt.y = svgY

  // 1) Vann-arealer — punkt-i-fyll (samme CTM-invers-mønster som pointOnFreshwater).
  let bestArea = null
  for (const path of svg.querySelectorAll(
    'g[data-iso="301"] path[data-name], g[data-iso="302"] path[data-name], g[data-iso="303"] path[data-name]')) {
    const name = path.getAttribute('data-name')?.trim()
    if (!name || typeof path.isPointInFill !== 'function') continue
    const ctm = typeof path.getCTM === 'function' ? path.getCTM() : null
    let local = pt
    if (ctm) { try { local = pt.matrixTransform(ctm.inverse()) } catch { continue } }
    if (!path.isPointInFill(local)) continue
    let area = Infinity
    try { const bb = path.getBBox(); area = bb.width * bb.height } catch { /* keep Infinity */ }
    if (!bestArea || area < bestArea.area) bestArea = { name, area }
  }
  if (bestArea) return { name: bestArea.name, kind: 'vann', onFeature: true, distM: 0, x: svgX, y: svgY }

  // 2) Vann-linjer — nærmeste-punkt-på-polylinje, zoom-skalert toleranse.
  let tolM = 30
  const wrap = wrapperRef.value?.getBoundingClientRect()
  const m = meta.value
  if (wrap && m && m.widthM && m.heightM) {
    const fit = Math.min(wrap.width / m.widthM, wrap.height / m.heightM)
    const mPerPx = 1 / (fit * (scale.value || 1))
    if (Number.isFinite(mPerPx) && mPerPx > 0) tolM = Math.min(60, Math.max(8, 14 * mPerPx))
  }
  let bestLine = null
  for (const path of svg.querySelectorAll('g[data-iso="304"] path[data-name], g[data-iso="305"] path[data-name]')) {
    const name = path.getAttribute('data-name')?.trim()
    if (!name) continue
    const d = path.getAttribute('d')
    if (!d) continue
    for (const sub of parseLinePoints(d)) {
      const dist = pointToPolylineDist(svgX, svgY, sub)
      if (dist <= tolM && (!bestLine || dist < bestLine.distM)) bestLine = { name, distM: dist }
    }
  }
  if (bestLine) return { name: bestLine.name, kind: 'vann', onFeature: true, distM: bestLine.distM, x: svgX, y: svgY }
  return null
}

// Info-utregning når menyen er åpen. Cachet via computed slik at en åpen meny
// ikke re-evaluerer på hver pinch (kun når contextMenuPoint, searchIndex eller
// DEM endrer seg).
const contextMenuInfo = computed(() => {
  const p = contextMenuPoint.value
  if (!p || !meta.value) return null
  const m = meta.value
  // Klamp til kart-bounds — long-press kan treffe utenfor SVG-content
  // pga letterboxing ved bredt aspekt-ratio.
  const inside = p.svgX >= 0 && p.svgX <= m.widthM && p.svgY >= 0 && p.svgY <= m.heightM
  const { lat, lon } = svgToWgs84(p.svgX, p.svgY, m)
  const ele = (storedDem.value && inside)
    ? sampleElevation(storedDem.value, p.svgX, p.svgY)
    : NaN

  // Geometri-bevisst stedsoppslag: ligger punktet PÅ en navngitt elv/innsjø/bekk,
  // vinner den over nærmeste navne-anker (ellers tapte lange elver mot et nærmere
  // stedsnavn). Faller tilbake til nærmeste-anker-heuristikken ellers.
  const waterHit = inside ? findWaterFeatureAtPoint(p.svgX, p.svgY) : null
  const place = waterHit ?? (inside ? findNearestPlace(mapSearch.index.value, p.svgX, p.svgY) : null)

  // NB: «nærmeste sti/vei»-utregningen er bevisst fjernet (v9.1.22).
  // findNearestPath sampler hver path i sti/vei/bekk-lagene med
  // getPointAtLength — en synkron, layout-tvingende operasjon som blokkerte
  // hovedtråden i sekunder på den ekte (CI-bygde) Vardåsen og frøs store
  // bruker-kart helt. Informasjonen er uansett synlig direkte på kartet.

  // Avstand fra brukerens GPS-posisjon (kun synlig når GPS-en er aktiv
  // og brukeren er på kartet). Retning fra meg → punktet.
  let fromUser = null
  if (userPos.isWatching && userPos.svgX != null && userPos.svgY != null) {
    const dx = p.svgX - userPos.svgX
    const dy = p.svgY - userPos.svgY
    const distM = Math.hypot(dx, dy)
    const deg = bearingDeg(userPos.svgX, userPos.svgY, p.svgX, p.svgY)
    fromUser = { distM, deg, compass: bearingToCompass(deg) }
  }

  // Over en innlands-vannflate er DEM-en nodata-fylt-til-0 → ikke vis falsk
  // høyde. To uavhengige signaler (robust mot at det ene svikter):
  //   1. SVG-treff i et ferskvanns-polygon (ISOM 301/302).
  //   2. DEM-artefakt: på et bekreftet INNLANDS-kart (meta.coastal === false)
  //      er en måling ≈ 0 m nødvendigvis vannflate-artefakten — ekte norsk
  //      innlands-terreng ligger aldri på havnivå. Fanger store innsjøer
  //      (Mjøsa/Tyrifjorden) selv når 301-treffet glipper. På kyst-/ukjente
  //      kart er 0 m ekte havnivå, så da slår ikke (2) inn.
  const onFreshwater = inside ? pointOnFreshwater(p.svgX, p.svgY) : false
  const inlandWaterArtifact = inside && Number.isFinite(ele) &&
    Math.abs(ele) < 0.5 && meta.value?.coastal === false
  const isWater = onFreshwater || inlandWaterArtifact

  return {
    lat, lon, inside,
    elevationM: (Number.isFinite(ele) && !isWater) ? ele : null,
    isWater,
    place,
    fromUser,
  }
})

// HydAPI-nøkkel (sanntids vannstand/temp). DVALE uten nøkkel: registreres
// gratis på hydapi.nve.no og settes som VITE_NVE_HYDAPI_KEY ved bygg.
const HYDAPI_KEY = import.meta.env.VITE_NVE_HYDAPI_KEY ?? ''

// Long-press over (sannsynlig) vann → hent innsjø-data fra NVE Innsjødatabase
// (vannflate-høyde + dyp/areal/volum/magasin når oppmålt). NHM_DTM leser ~0 m
// over vann; NVE har de autoritative verdiene (Mjøsa ~123 m / 453 m dyp,
// Tyrifjorden ~63 m). Token forkaster trege svar. Feiler NVE → 'error'/'empty'
// → UI viser «ikke tilgjengelig» (aldri 0). Når innsjøen er funnet og en
// HydAPI-nøkkel er satt, hentes sanntids vannstand/temperatur i et andre,
// ikke-blokkerende steg (fyller lakeQuery.live når den lander).
watch(contextMenuPoint, async (p) => {
  const token = ++lakeQueryToken
  lakeQuery.value = null
  if (!p || !contextMenuOpen.value) return
  const info = contextMenuInfo.value
  if (!info?.inside || !info.isWater) return   // bare slå opp når punktet er vann
  lakeQuery.value = { status: 'loading', live: null }
  try {
    const lake = await fetchLakeData(info.lat, info.lon)
    if (token !== lakeQueryToken) return        // brukeren har flyttet punktet
    if (!lake || !Number.isFinite(lake.hoyde)) {
      lakeQuery.value = { status: 'empty', live: null }
      return
    }
    lakeQuery.value = { status: 'done', lake, live: null }
    // Sanntids vannstand/temp — kun når en HydAPI-nøkkel finnes (ellers dvale).
    if (HYDAPI_KEY) {
      fetchLiveWater(info.lat, info.lon, { apiKey: HYDAPI_KEY, lakeHoyde: lake.hoyde })
        .then((live) => {
          if (token === lakeQueryToken && live && lakeQuery.value?.status === 'done') {
            lakeQuery.value = { ...lakeQuery.value, live }
          }
        })
        .catch(() => { /* graceful: ingen sanntidslinje */ })
    }
  } catch {
    if (token === lakeQueryToken) lakeQuery.value = { status: 'error', live: null }
  }
})

// Long-press hvor som helst på kartet → slå opp om punktet ligger i et
// verneområde (Naturbase via Miljødirektoratet). Ved treff vises navn/verneform/
// vernedato/areal umiddelbart, og to ikke-blokkerende kall fyller arts-/
// observasjons-tellere (GBIF) og Wikipedia-ingress når de lander. Ingen treff →
// ingen verne-seksjon. Token forkaster trege svar; cache gjør gjentatte oppslag
// momentane (IndexedDB + minne, TTL pr kilde).
watch(contextMenuPoint, async (p) => {
  const token = ++verneQueryToken
  verneQuery.value = null
  expandedRedCat.value = null
  if (!p || !contextMenuOpen.value) return
  const info = contextMenuInfo.value
  if (!info?.inside) return
  verneQuery.value = { status: 'loading' }
  try {
    const ptKey = pointKey(info.lat, info.lon)
    let area = await cacheGet(ptKey)
    if (!area) {
      area = await fetchProtectedArea(info.lat, info.lon)
      if (area) cacheSet(ptKey, area, TTL.vern)
    }
    if (token !== verneQueryToken) return
    if (!area) { verneQuery.value = null; return }
    verneQuery.value = { status: 'done', area, species: 'loading', wiki: 'loading' }
    loadVerneSpecies(token, area, info.lat, info.lon)
    loadVerneWiki(token, area)
  } catch {
    if (token === verneQueryToken) verneQuery.value = null
  }
})

// Long-press → slå opp NiN-naturtype-lokaliteter for punktet (Miljødirektoratet
// «Naturtyper på land»). Uavhengig av verneområde-oppslaget over: naturtyper er
// kartlagt i hele landet, ikke bare i verneområder. Cachet 30 dager. Ingen treff
// (tom liste) eller utilgjengelig → ingen naturtype-seksjon.
watch(contextMenuPoint, async (p) => {
  const token = ++naturtypeQueryToken
  naturtypeQuery.value = null
  if (!p || !contextMenuOpen.value) return
  const info = contextMenuInfo.value
  if (!info?.inside) return
  try {
    const key = naturtypePointKey(info.lat, info.lon)
    let items = await cacheGet(key)
    if (!items) {
      items = await fetchNaturtypes(info.lat, info.lon)
      if (items && items.length) cacheSet(key, items, TTL.naturtype)
    }
    if (token !== naturtypeQueryToken) return
    naturtypeQuery.value = (items && items.length) ? { status: 'done', items } : null
  } catch {
    if (token === naturtypeQueryToken) naturtypeQuery.value = null
  }
})

// Long-press hvor som helst → nærmeste Wikipedia-sted (geosearch). Gir fakta om
// innsjø/fjelltopp/grend/elv/stedsnavn også UTENFOR verneområder. Cachet 7 dager
// på ~100 m-grid. Ingen treff/utilgjengelig → ingen sted-seksjon. Kjører også
// utenfor kart-bounds (koordinaten er gyldig uansett).
watch(contextMenuPoint, async (p) => {
  const token = ++placeWikiToken
  placeWikiQuery.value = null
  if (!p || !contextMenuOpen.value) return
  const info = contextMenuInfo.value
  if (!info) return
  placeWikiQuery.value = { status: 'loading' }
  try {
    const key = placePointKey(info.lat, info.lon)
    let place = await cacheGet(key)
    if (!place) {
      // Nærmeste kartlabel (f.eks. «Glitre», «Bondivannet») som navne-hint, så
      // navn-søket kan disambiguere store features og bestemt/ubestemt form.
      place = await fetchNearestWikiPlace(info.lat, info.lon, { hintName: info.place?.name })
      if (place) {
        // SNL foretrekkes for TEKSTEN: Wikipedia-geosearch har allerede
        // identifisert og lokalisert featuren (koordinat-trygt), så her bytter vi
        // bare inn SNLs ingress/lenke for det bekreftede navnet og BEHOLDER
        // avstanden fra Wikipedia-ankeret. SNL har ingen koordinater.
        const snl = await fetchSnlSummary(place.title, { accept: placeNameMatches })
        if (snl) {
          place = { ...place, source: 'snl', title: snl.title, extract: snl.extract,
                    url: snl.url, thumbnail: snl.thumbnail ?? place.thumbnail }
        }
        // Den overordnede «første del»-artikkelen (selve stedet ved siden av
        // stasjonen/toppen): foretrekk SNL-lenken her også. KUN lenke + tittel —
        // ingen ingress-tekst, siden kortet viser teksten for den mest spesifikke.
        // Faller tilbake til Wikipedia-lenken fra wikiPlace; droppes hvis den
        // ender på samme URL som primær-lenken.
        if (place.secondary) {
          const snl2 = await fetchSnlSummary(place.secondary.title, { accept: placeNameMatches })
          const sec = snl2
            ? { ...place.secondary, source: 'snl', title: snl2.title, url: snl2.url }
            : place.secondary
          place = (sec.url && sec.url !== place.url)
            ? { ...place, secondary: sec }
            : { ...place, secondary: null }
        }
      } else if (info.place?.name) {
        // Ingen Wikipedia-treff i nærheten, men vi har et stedsnavn → siste utvei:
        // slå opp navnet i SNL (uten avstand, ingen koordinat-verifisering).
        const snl = await fetchSnlSummary(info.place.name, { accept: placeNameMatches })
        if (snl) place = { ...snl, lat: null, lon: null, distanceM: null }
      }
      if (place) cacheSet(key, place, TTL.wiki)
    }
    if (token !== placeWikiToken) return
    placeWikiQuery.value = place ? { status: 'done', place } : { status: 'empty' }
  } catch {
    if (token === placeWikiToken) placeWikiQuery.value = { status: 'empty' }
  }
})

// Sted-kortet vises kun når geosearch fant en artikkel, og IKKE når den er
// identisk med verneområdets egen Wikipedia-lenke (unngå duplikat).
const placeWikiCard = computed(() => {
  if (placeWikiQuery.value?.status !== 'done') return null
  const place = placeWikiQuery.value.place
  const w = verneQuery.value?.wiki
  const verneUrl = (w && w !== 'loading') ? w.url : null
  if (verneUrl && place.url && verneUrl === place.url) return null
  return place
})

// Kilde-etikett for lenke-/status-tekst. Oppslag kan komme fra SNL (foretrukket)
// eller Wikipedia (fallback). Default Wikipedia for gamle cachede objekter uten kilde.
const SOURCE_LABEL = { snl: 'Store norske leksikon', wikipedia: 'Wikipedia' }
function sourceLabel(s) { return SOURCE_LABEL[s] ?? 'Wikipedia' }

// Verdi-klasse for naturtype-badge: «svært høy»/«høy»/«svært viktig» → sterk
// grønn, «moderat»/«viktig» → gulgrønn, «lav»/«lokalt» → dempet. Ukjent → nøytral.
function naturtypeVerdiClass(verdi) {
  const v = String(verdi ?? '').toLowerCase()
  if (/sv[æa]rt h[øo]y|^h[øo]y|sv[æa]rt viktig/.test(v)) return 'bg-emerald-500/25 text-emerald-100 border-emerald-400/40'
  if (/moderat|^viktig/.test(v)) return 'bg-lime-500/20 text-lime-100 border-lime-400/35'
  if (/lav|lokalt/.test(v)) return 'bg-white/8 text-white/60 border-white/15'
  return 'bg-white/8 text-white/70 border-white/15'
}

// Arts-/observasjons-telling fra GBIF for verneområdet. Cachet 24 t på område-ID.
// Bruker Naturbase-polygonet når det er i lon/lat, ellers en bbox rundt klikk-
// punktet (robust mot at WFS-en leverer projiserte UTM-meter). Setter species
// til objekt (treff) eller null (utilgjengelig).
async function loadVerneSpecies(token, area, lat, lon) {
  const key = `species:${area.id}`
  try {
    let sp = await cacheGet(key)
    if (!sp) {
      sp = await fetchSpeciesSummary({ rings: area.rings, lat, lon, areaKm2: area.arealKm2 })
      if (sp) cacheSet(key, sp, TTL.species)
    }
    // Norsk rødliste: snitt GBIF-artene mot den bundlede Artsdatabanken-lista.
    // Dvale (returnerer null) hvis bundelen ennå ikke er generert → ingen linje.
    if (sp?.speciesKeys && !sp.redListNo) {
      const rl = await summarizeRedListed(sp.speciesKeys)
      if (rl) sp = { ...sp, redListNo: rl }
    }
    patchVerne(token, { species: sp ?? null })
  } catch {
    patchVerne(token, { species: null })
  }
}

// Wikipedia-ingress for verneområdet. Slår opp på fullt navn (navn + verneform)
// før bart navn, så vi treffer «Storøya biotopvernområde» og ikke øya på
// Svalbard. Cachet 7 dager på navn + verneform (nøkkelen forbi-cacher gamle
// feil-treff lagret under bart navn).
async function loadVerneWiki(token, area) {
  const navn = area?.navn
  if (!navn) { patchVerne(token, { wiki: null }); return }
  const key = `wiki2:${navn}|${area.verneform ?? ''}`   // v2: invaliderer pre-SNL cache
  try {
    let wiki = await cacheGet(key)
    if (!wiki) {
      // SNL foretrekkes; Wikipedia som fallback.
      wiki = await fetchSnlSummary(navn, { accept: titleMatches })
        ?? await fetchWikiSummary(navn, { verneform: area.verneform })
      if (wiki) cacheSet(key, wiki, TTL.wiki)
    }
    patchVerne(token, { wiki: wiki ?? null })
  } catch {
    patchVerne(token, { wiki: null })
  }
}

// Slå sammen et delvis resultat inn i verneQuery — kun hvis token fortsatt
// gjelder og oppslaget er i 'done'-tilstand (brukeren kan ha flyttet punktet).
function patchVerne(token, patch) {
  if (token === verneQueryToken && verneQuery.value?.status === 'done') {
    verneQuery.value = { ...verneQuery.value, ...patch }
  }
}

// Vernedato (ISO YYYY-MM-DD) → norsk dd.mm.yyyy. Faller tilbake til råverdi.
function formatVernedato(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

// Heltall med tusenskille (norsk: mellomrom). 1342 → «1 342».
function formatCount(n) {
  return Number(n).toLocaleString('nb-NO')
}

// Rødliste-kategorier i alvorlighets-rekkefølge, med fullt norsk navn (tooltip) og
// fargeklasse for kategori-chipene i kortet.
const RED_CATS = [
  { code: 'CR', label: 'Kritisk truet', cls: 'text-rose-100 border-rose-400/50 bg-rose-500/20' },
  { code: 'EN', label: 'Sterkt truet', cls: 'text-rose-200 border-rose-400/40 bg-rose-500/15' },
  { code: 'VU', label: 'Sårbar', cls: 'text-amber-200 border-amber-400/40 bg-amber-500/15' },
  { code: 'NT', label: 'Nær truet', cls: 'text-amber-100/90 border-amber-300/30 bg-amber-400/10' },
]

// Rødliste-kategorier som faktisk har treff, til kategori-chipene.
function redListCats(byCat) {
  return RED_CATS.filter((c) => byCat?.[c.code] > 0)
}

// Artene i den utvidede kategorien, gruppert etter grov dyre-/plantegruppe.
function redListGroups(redListNo, cat) {
  if (!redListNo || !cat) return []
  const inCat = (redListNo.species ?? []).filter((s) => s.category === cat)
  return groupSpecies(inCat)
}

// Veksle hvilken kategori som er foldet ut (accordion).
function toggleRedCat(code) {
  expandedRedCat.value = expandedRedCat.value === code ? null : code
}

// Areal: under 1 km² vises med to desimaler (små vann), ellers heltall/én desimal.
function formatAreaKm2(km2) {
  if (km2 < 1) return km2.toFixed(2)
  if (km2 < 100) return km2.toFixed(1)
  return String(Math.round(km2))
}
// Volum kommer i mill. m³ fra NVE. Store volum vises i km³ (1 km³ = 1000 mill m³).
function formatVolum(millM3) {
  if (millM3 >= 1000) return `${(millM3 / 1000).toFixed(1)} km³`
  if (millM3 >= 1) return `${Math.round(millM3)} mill. m³`
  return `${(millM3 * 1e6).toFixed(0)} m³`
}

const contextActionState = ref('idle')   // 'idle' | 'copied' | 'failed'
let contextActionTimer = null
function flashContextAction(state) {
  contextActionState.value = state
  if (contextActionTimer) clearTimeout(contextActionTimer)
  contextActionTimer = setTimeout(() => { contextActionState.value = 'idle' }, 1400)
}

// ── Nærhetsvarsel (proximity alert) ──────────────────────────────────────
// Inline config-panel i kontekst-draweren. Lokal redigerings-state speiler
// proximity.prefs (sist brukte valg) til brukeren bekrefter med «Aktiver».
const proximityPanelOpen = ref(false)
const proximityCfg = ref({ distanceM: 10, sound: true, vibration: true })

function toggleProximityPanel() {
  if (!proximityPanelOpen.value) {
    proximityCfg.value = {
      distanceM: proximity.prefs.distanceM,
      sound: proximity.prefs.sound,
      vibration: proximity.prefs.vibration,
    }
  }
  proximityPanelOpen.value = !proximityPanelOpen.value
}

function armProximityAlert() {
  const p = contextMenuPoint.value
  if (!p) return
  const cfg = proximityCfg.value
  // Minst én varseltype må være på.
  if (!cfg.sound && !cfg.vibration) cfg.vibration = true
  proximity.arm({
    svgX: p.svgX,
    svgY: p.svgY,
    lat: contextMenuInfo.value?.lat,
    lon: contextMenuInfo.value?.lon,
    label: contextMenuInfo.value?.place?.name ?? 'punktet',
    distanceM: cfg.distanceM,
    useSound: cfg.sound,
    useVibration: cfg.vibration,
    mapId: mapId.value,
  })
  proximityPanelOpen.value = false
  closeContextMenu()
}

// Avstand fra brukeren til long-press-punktet (for 2 km-gaten i config-panelet).
// 2 km ≈ 20–25 min gange; lengre unna er sjansen stor for at nettleseren/GPS
// rekker å lukke seg før ankomst (en time på 5 km), så alarmen ville ikke fyrt.
const MAX_ARM_DISTANCE_M = 2000
const ctxDistFromUser = computed(() => contextMenuInfo.value?.fromUser?.distM ?? null)
const ctxTooFarToArm = computed(() =>
  ctxDistFromUser.value != null && ctxDistFromUser.value > MAX_ARM_DISTANCE_M)

// Gjenopprett et persistert varsel etter reload: re-projiser lat/lon mot
// gjeldende kart-meta og re-arm, men kun hvis varselet hører til DETTE kartet.
// Starter GPS automatisk så alarmen fungerer videre (krever allerede gitt
// tillatelse — ingen ny prompt hvis avvist).
function restoreProximityAlert() {
  if (proximity.active.value) return            // allerede aktivt i denne økten
  const d = getPersistedAlert()
  if (!d || !meta.value) return
  if (d.mapId !== mapId.value) return           // hører til et annet kart
  const { x, y } = wgs84ToSvg(d.lat, d.lon, meta.value)
  proximity.arm({
    svgX: x, svgY: y,
    lat: d.lat, lon: d.lon,
    label: d.label,
    distanceM: d.distanceM,
    useSound: d.useSound,
    useVibration: d.useVibration,
    mapId: d.mapId,
  })
  if (!userPos.isWatching) startPositioning()
}

// gmapsUrl/streetViewUrl bor i lib/externalMapLinks.js (v12.1.17 — delt med
// Ruteplanleggerens long-press-pin).

async function onCopyCoords() {
  const info = contextMenuInfo.value
  if (!info) return
  const text = `${info.lat.toFixed(6)}, ${info.lon.toFixed(6)}`
  try {
    await navigator.clipboard.writeText(text)
    flashContextAction('copied')
  } catch { flashContextAction('failed') }
}
async function onShareCoords() {
  const info = contextMenuInfo.value
  if (!info) return
  const url = gmapsUrl(info.lat, info.lon)
  const shareData = {
    title: 'Posisjon',
    text: `${info.lat.toFixed(6)}, ${info.lon.toFixed(6)}`,
    url,
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData)
      return
    } catch (err) {
      if (err && err.name === 'AbortError') return
      // Fall gjennom til clipboard-fallback
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    flashContextAction('copied')
  } catch { flashContextAction('failed') }
}
function onStartMeasureHere() {
  const p = contextMenuPoint.value
  if (!p) return
  // Bytt til Måling-fanen så brukeren ser hva som skjer videre, åpne drawer
  // og legg første vertex på long-press-punktet.
  startMeasure()
  measureVertices.value = [{ x: p.svgX, y: p.svgY }]
  activeTab.value = 'maaling'
  closeContextMenu()
  openDrawer()
}
// Start Stifinner mot long-press-punktet (B). Lukk arket; brukeren velger
// startpunkt (A) via midt-siktet. Måling/annotering tvinges av.
function onNavigateHere() {
  const p = contextMenuPoint.value
  if (!p) return
  measureMode.value = false
  annot.isAnnotateMode.value = false
  annot.selectedSymbol.value = null
  renderMeasure()
  sti.begin({ svgX: p.svgX, svgY: p.svgY })
  closeContextMenu()
  closeDrawer()
}
// Start Stifinner som RUNDTUR fra long-press-punktet (origo = start = mål).
// Brukeren sikter deretter inn et vendepunkt (via) — ruten blir en sløyfe.
function onRoundTripHere() {
  const p = contextMenuPoint.value
  if (!p) return
  measureMode.value = false
  annot.isAnnotateMode.value = false
  annot.selectedSymbol.value = null
  renderMeasure()
  sti.beginLoop({ svgX: p.svgX, svgY: p.svgY })
  closeContextMenu()
  closeDrawer()
}
// Bekreft startpunkt = skjermsenteret (der siktet står) → beregn ruter.
function onConfirmStart() {
  const c = visibleCenterSvg()
  const svg = svgHostRef.value?.querySelector('svg')
  if (!c || !svg) return
  sti.confirmStart(c, svg, { startOnWater: pointOnWater(c.x, c.y) })
  renderRoutes()
}
function onCancelStifinner() {
  sti.cancel()
  renderRoutes()
}
function onSelectRoute(idx) {
  sti.selectRoute(idx)
  renderRoutes()
}
// «+ Via» → gå til via-plukk (gult sikte). Bekreft via = skjermsenteret.
function onBeginAddVia() {
  sti.beginAddVia()
}
function onConfirmVia() {
  const c = visibleCenterSvg()
  const svg = svgHostRef.value?.querySelector('svg')
  if (!c || !svg) return
  sti.confirmVia(c, svg)
  renderRoutes()
}
function onRemoveVia(i) {
  sti.removeVia(i)
  renderRoutes()
}
// Farge på sikte/bekreft-knapp: gul i via-modus, grønn ved startvalg.
const stiPickColor = computed(() => (sti.mode.value === 'pickingVia' ? '#f59e0b' : '#16a34a'))

// Høydemeter A→B: ren høydeforskjell mellom start- og målpunktet (DEM-sampla
// i samme svg-meter-rom som rutene). Rute-uavhengig — som luftlinja — så den
// vises på samme bunn-linje uansett hvilken rute som er valgt. null når kartet
// mangler DEM (ingen WCS) eller et av punktene faller på noData.
const stiElevationDiffM = computed(() => {
  if (sti.isLoop.value) return null   // origo == mål → høydediff er 0, irrelevant
  const a = sti.start.value, b = sti.destination.value
  const dem = storedDem.value
  if (!a || !b || !dem) return null
  const ea = sampleElevation(dem, a.svgX, a.svgY)
  const eb = sampleElevation(dem, b.svgX, b.svgY)
  if (!Number.isFinite(ea) || !Number.isFinite(eb)) return null
  return eb - ea
})

// Samlet stigning/fall langs HVER rute (parallelt array til sti.routes, til
// forskjell fra netto-diffen over). sampleProfile sampler DEM jevnt langs
// rute-geometrien og summerer opp- og nedstigninger (5-punkts glatting demper
// DEM-støy). Brukes både av tidsestimatet (Naismith-tillegg i estWalkMinutes)
// og «Valgt rute»-linja. Tomt array / null-innslag når DEM mangler.
const stiRouteClimbs = computed(() => {
  const dem = storedDem.value
  if (sti.mode.value !== 'showing' || !dem) return []
  return sti.routes.value.map((r) => {
    if (!r?.coordinates?.length) return null
    const prof = sampleProfile({ points: r.coordinates.map(c => ({ x: c[0], y: c[1] })) }, dem)
    return prof ? { ascent: prof.totalAscent, descent: prof.totalDescent } : null
  })
})
const stiSelectedClimb = computed(() => stiRouteClimbs.value[sti.selectedRouteIdx.value] ?? null)
function onOpenGoogleMaps() {
  const info = contextMenuInfo.value
  if (!info) return
  window.open(gmapsUrl(info.lat, info.lon), '_blank', 'noopener')
}
function onOpenStreetView() {
  const info = contextMenuInfo.value
  if (!info) return
  window.open(streetViewUrl(info.lat, info.lon), '_blank', 'noopener')
}
// Web-zoom som matcher gjeldende visnings bakkeoppløsning (SVG-viewBox-meter
// pr rendret px, inkl. pinch-zoom via getBoundingClientRect) — så eksterne
// kart (UT.no, Vegkart) åpner på omtrent samme utsnitt som brukeren ser her.
function currentViewWebZoom(lat) {
  try {
    const svg = svgHostRef.value?.querySelector('svg')
    const vb = svg?.viewBox?.baseVal
    const rect = svg?.getBoundingClientRect()
    if (vb?.width && rect?.width) return utNoZoomForMPerPx(vb.width / rect.width, lat)
  } catch { /* fall tilbake til default-zoom */ }
  return UTNO_DEFAULT_ZOOM
}
// Åpne punktet på UT.no sitt turkart (ut.no/kart#zoom/lat/lon).
function onOpenUtNo() {
  const info = contextMenuInfo.value
  if (!info) return
  const url = buildUtNoUrl({ lat: info.lat, lon: info.lon, zoom: currentViewWebZoom(info.lat) })
  if (url) window.open(url, '_blank', 'noopener')
}
// Intern snarvei (v12.1.34): åpne Ruteplanleggeren sentrert på long-press-
// punktet. In-app-navigasjon (ikke ekstern lenke) — GravelPlannerView leser
// ?lat/lon/z og sentrerer kartet der istedenfor sist lagrede utsnitt.
function onOpenRoutePlanner() {
  const info = contextMenuInfo.value
  if (!info) return
  router.push({ name: 'ruteplanlegger', query: {
    lat: info.lat.toFixed(6), lon: info.lon.toFixed(6), z: '12',
  } })
}
// Åpne punktet i Vegvesenets Vegkart (UTM 33N-hash, se externalMapLinks.js).
function onOpenVegkart() {
  const info = contextMenuInfo.value
  if (!info) return
  const url = buildVegkartUrl({ lat: info.lat, lon: info.lon, zoom: currentViewWebZoom(info.lat) })
  if (url) window.open(url, '_blank', 'noopener')
}
function onPlaceAnnotationFromContext(symbolKey) {
  const p = contextMenuPoint.value
  const sym = ANNOTATION_SYMBOLS.find(s => s.symbolKey === symbolKey)
  if (!p || !sym) return
  annot.addPoint(sym.code, p.svgX, p.svgY)
  annot.persist()
  closeContextMenu()
}

// Tilgjengelighet pr handling. Sporing eller måling pågår → noen valg er
// blokkert (Start måling her, Plasser annotering — disse ville kollidere
// med den pågående modusen).
const ctxBusy = computed(() => measureMode.value || tracker.isRecording.value || sti.active.value)
const ctxCanMeasure = computed(() => !ctxBusy.value)
const ctxCanAnnotate = computed(() => {
  const isBuiltin = (route.params.id ?? 'vardasen').startsWith('vardasen')
  return !isBuiltin && !ctxBusy.value
})
// Long-press-punktet på en vannflate? Da gir ikke navigasjon mening (mål-
// markøren ville lagt seg midt i vannet). Re-evalueres når punktet/menyen endres.
const ctxPointOnWater = computed(() => {
  const p = contextMenuPoint.value
  if (!p || !contextMenuOpen.value) return false
  return pointOnWater(p.svgX, p.svgY)
})

// «Naviger hit» tilgjengelig når ingen annen modus er aktiv, kartet faktisk
// har sti-/vei-lag å rute langs, og punktet ikke ligger i vann.
const ctxCanNavigate = computed(() =>
  !ctxBusy.value && mapHasTrails.value && !ctxPointOnWater.value)

// Long-press-markøren (rødt sikte) er et HTML-overlay UTENFOR pinch-transformen
// (barn av wrapperRef, søsken av det transformerte mapInnerRef) — IKKE et SVG-lag
// inne i kartet. Det er hele poenget: alt som ligger inne i den pinch-skalerte
// SVG-en skaleres med transformen, og hver «skjerm-konstant»-utregning (pxToUser
// Units / getScreenCTM / viewBox-brøk) kunne komme i utakt med den faktiske
// skalaen → markøren ballong-blåste. Som et HTML-element har den en LITERAL
// CSS-piksel-størrelse (se template) som FYSISK ikke kan blåses opp uansett zoom.
// Vi flytter den bare i posisjon: long-press-punktets skjerm-koordinat via
// getScreenCTM (samme matrise som mapper trykk → kart-koordinat, så den er
// pålitelig), oversatt til wrapperRef-rommet.
const contextPinElRef = ref(null)
function positionContextPin() {
  const el = contextPinElRef.value
  if (!el) return
  const p = contextMenuPoint.value
  const svg = svgHostRef.value?.querySelector('svg')
  const wrap = wrapperRef.value?.getBoundingClientRect()
  if (!p || !contextMenuOpen.value || !svg || !wrap) return
  const ctm = svg.getScreenCTM()
  if (!ctm) return
  const pt = svg.createSVGPoint()
  pt.x = p.svgX; pt.y = p.svgY
  const scr = pt.matrixTransform(ctm)   // viewport (skjerm)-koordinat
  el.style.left = (scr.x - wrap.left) + 'px'
  el.style.top = (scr.y - wrap.top) + 'px'
}
// Hold markøren limt til punktet gjennom pinch (scale/translate oppdateres live)
// OG gjennom CSS-transition-animasjoner (animating): under en transition er
// scale-ref-en allerede på mål, men den faktiske transformen glir over 200ms, så
// vi rAF-løkker posisjonen til animasjonen er ferdig. Størrelsen røres aldri.
let contextPinRaf = 0
function contextPinRafLoop() {
  positionContextPin()
  if (animating.value && contextMenuOpen.value) {
    contextPinRaf = requestAnimationFrame(contextPinRafLoop)
  } else {
    contextPinRaf = 0
  }
}
watch([contextMenuOpen, contextMenuPoint, scale, translateX, translateY, rotation], positionContextPin)
watch(animating, (v) => {
  if (v && contextMenuOpen.value && !contextPinRaf) contextPinRaf = requestAnimationFrame(contextPinRafLoop)
})

// Detalj-inset (lupe) — flyttet til useDetailInset; watch-en blir her.
const { buildDetailInset } = useDetailInset({
  detailInsetRef, svgHostRef, contextMenuPoint, detachedDetailLayers,
  rotation, roadRefUprightDeg, meta, DETAIL_INSET_M,
})

watch([contextMenuOpen, contextMenuPoint], async () => {
  if (!contextMenuOpen.value) return
  await nextTick()
  buildDetailInset()
})

// Høydeprofil — sample stripe + gradient-fyll under (v8.9.4).
// expandedTrackId holder hvilket spor som er "zoomet" i drawer-en (=
// vises som stor profil under en modal-overlay).
const expandedTrackId = ref(null)

const profileCache = new Map()  // trackId+pointCount → profileObj
function profileFor(track) {
  if (!track?.points?.length || !storedDem.value) return null
  const key = `${track.id}-${track.points.length}`
  if (profileCache.has(key)) return profileCache.get(key)
  const prof = sampleProfile(track, storedDem.value)
  if (prof) profileCache.set(key, prof)
  return prof
}
// Når DEM endres (lazy-load), invalider caches
watch(storedDem, () => { profileCache.clear() })

// Sporet som vises i den store høydeprofil-modalen (TrackElevationSheet).
const expandedTrack = computed(() =>
  tracker.tracks.value.find((t) => t.id === expandedTrackId.value) || null)

watch(() => annot.annotations.value, () => renderAnnotations(), { deep: true })

// Lilla ring rundt symbolene er en hint for at man er i annoteringsmodus
// — re-render når modusen toggles slik at ringen forsvinner ut av modus.
// Per-type visibility (Annoteringer-laget) trigger også re-render.
watch(() => annot.isAnnotateMode.value, () => renderAnnotations())
watch(() => annot.visibleTypes.value, () => renderAnnotations())

// Re-render symboler (annoteringer + bruker-pos dot + spor) når pinch-zoom
// endrer seg, slik at de holder konstant skjerm-størrelse uansett zoom-nivå.
watch(scale, () => { renderAnnotations(); updateUserDot(); renderTracks() })

// Tracks: re-render når spor endres, stil endres, eller synlighet toggles.
// Deep watch på tracks fordi vi pusher nye punkter inn i samme array under
// opptak (~hvert 5. m).
watch(() => tracker.tracks.value, () => renderTracks(), { deep: true })
watch(() => tracker.trackStyle.value, () => renderTracks())
watch(() => tracker.visibleTrackIds.value, () => renderTracks())

/**
 * Konverter CSS-piksler til SVG user-units. Brukes til å holde symboler
 * (annoterings-ikoner, GPS-prikk) på konstant skjerm-størrelse uansett zoom.
 *
 * v8.9.2: tidligere brukte vi svg.getBoundingClientRect() som inkluderer CSS-
 * transformer. Det ga en subtil bug: når man tappet «Nullstill zoom» midt
 * under en pinch-transition, returnerte rect-en mid-animasjons-verdier — vi
 * malte stedsmerker basert på rect ved scale=20 selv om scale-ref var 1,
 * og så ble pin-ene ekstremt små etter at animasjonen var ferdig.
 *
 * Nå bruker vi wrapperSize (fast container målt på mount/resize) + scale.value
 * (mål-skala fra pinch-state) som er garantert konsistent uansett om CSS-
 * transitionen er ferdig eller ikke.
 */
function pxToUserUnits(cssPx) {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return cssPx
  const vb = svg.viewBox.baseVal
  // v11.0.31: mål wrapperen LIVE i stedet for det snapshot-ede wrapperSize.
  // wrapperRef har ingen CSS-transform (pinch-transformen ligger på det indre
  // mapInnerRef), så rect-en er alltid den ekte viewport-størrelsen — upåvirket
  // av pinch/anim, så v8.9.2-fellen (mid-animasjons-rect) gjelder ikke her.
  // Snapshot-et kunne fryse en for-tidlig / for liten måling på iOS Safari der
  // resize-eventet ikke fyrer etter at layouten settler eller toolbaren skjuler
  // seg; da ble pxPerUnit altfor liten og alle skjerm-låste symboler (GPS-prikk,
  // accuracy-ring, annoterings-ikoner) ballong-blåste til halve skjermen.
  const r = wrapperRef.value?.getBoundingClientRect()
  const w = r?.width || wrapperSize.value.w
  const h = r?.height || wrapperSize.value.h
  if (!w || !h || !vb.width || !vb.height) return cssPx
  // SVG fits-with-meet til wrapperen: minste dim bestemmer pxPerUnit
  const fitPxPerUnit = Math.min(w / vb.width, h / vb.height)
  const pxPerUnit = fitPxPerUnit * (scale.value || 1)
  if (!pxPerUnit) return cssPx
  return cssPx / pxPerUnit
}

// Klikk på kart i annoteringsmodus → plasser symbol
function onMapClick(e) {
  // Annotering deferres mens et ferskt kart fyller inn detaljer eller bygges
  // on-the-fly — pan/zoom/rotasjon er fri, men symbol-plassering venter til
  // kartet er ferdig (unngår plassering på et halvbygd / snart-erstattet kart).
  if (fillingInDetails.value || buildingOnTheFly.value) return
  // Kulturminne-ikon tappet → åpne detalj-skuff (uavhengig av verktøy, men ikke
  // mens et aktivt plasserings-/måle-/stifinner-verktøy eier tappet).
  if (!measureMode.value && !annot.isAnnotateMode.value && !sti.active.value) {
    const kmHit = e.target?.closest?.('[data-kulturminne-id]')
    if (kmHit) { openKulturminneDetail(kmHit); return }
    const fmHit = e.target?.closest?.('[data-fredet-id]')
    if (fmHit) { openFredetDetailFromEl(fmHit); return }
  }
  // Stifinner eier tap-eventet mens den er aktiv: startpunkt velges via det
  // faste midt-siktet (bekreft-knapp), og rute-tapp håndteres av egne DOM-
  // listenere på rute-linjene. Generelle kart-tapp gjør ingenting her.
  if (sti.active.value) return
  // Måleverktøy har prioritet over annotering siden brukeren eksplisitt
  // har slått det på (annoteringsmodus blir tvunget av i startMeasure).
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return
  const local = pt.matrixTransform(ctm.inverse())
  if (measureMode.value) {
    if (measureClosed.value) return  // ingen flere vertices etter lukking
    measureVertices.value = [...measureVertices.value, { x: local.x, y: local.y }]
    return
  }
  if (!annot.isAnnotateMode.value || !annot.selectedSymbol.value) return
  const sym = ANNOTATION_SYMBOLS.find(s => s.symbolKey === annot.selectedSymbol.value)
  if (!sym) return
  annot.addPoint(sym.code, local.x, local.y)
  annot.persist()
}

function renderMeasure() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const ns = 'http://www.w3.org/2000/svg'
  let layer = svg.querySelector('#measure-layer')
  if (!layer) {
    layer = document.createElementNS(ns, 'g')
    layer.setAttribute('id', 'measure-layer')
    layer.setAttribute('data-layer', 'maaling')
    layer.setAttribute('pointer-events', 'none')
    svg.appendChild(layer)
  }
  layer.replaceChildren()
  const v = measureVertices.value
  if (!v.length) return

  // Stroke-widths: paths inne i [data-layer] arver vector-effect:
  // non-scaling-stroke fra global SVG-CSS (symbolizer.js linje 394). Det
  // betyr at stroke-width tolkes i CSS-px, ikke i user-units — så
  // pxToUserUnits ville gjort linjene ~10× for tykke (v8.9.5).
  // For å holde konstant skjerm-tykkelse under pinch-zoom: del på scale.
  const s = scale.value || 1
  const haloW = 6 / s
  const lineW = 2.5 / s
  // Vertices er circles, IKKE paths — de arver ikke non-scaling-stroke,
  // så radius må fortsatt konverteres via pxToUserUnits.
  const vertR = pxToUserUnits(4)

  // Areal-polygon (fill) hvis lukket
  if (measureClosed.value && v.length >= 3) {
    const ptsAttr = v.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const poly = document.createElementNS(ns, 'polygon')
    poly.setAttribute('points', ptsAttr)
    poly.setAttribute('fill', 'rgba(34, 197, 94, 0.22)')
    poly.setAttribute('stroke', 'none')
    layer.appendChild(poly)
  }

  // To-lags polyline: hvit halo + grønn linje
  if (v.length >= 2) {
    let d = `M${v[0].x.toFixed(1)},${v[0].y.toFixed(1)}`
    for (let i = 1; i < v.length; i++) d += ` L${v[i].x.toFixed(1)},${v[i].y.toFixed(1)}`
    if (measureClosed.value) d += ' Z'
    const halo = document.createElementNS(ns, 'path')
    halo.setAttribute('d', d); halo.setAttribute('fill', 'none')
    halo.setAttribute('stroke', 'rgba(255,255,255,0.9)')
    halo.setAttribute('stroke-width', String(haloW))
    halo.setAttribute('stroke-linecap', 'round')
    halo.setAttribute('stroke-linejoin', 'round')
    layer.appendChild(halo)
    const line = document.createElementNS(ns, 'path')
    line.setAttribute('d', d); line.setAttribute('fill', 'none')
    line.setAttribute('stroke', '#16a34a')
    line.setAttribute('stroke-width', String(lineW))
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('stroke-linejoin', 'round')
    layer.appendChild(line)
  }

  // Vertices (circles — får ikke non-scaling-stroke fra CSS-regelen som
  // kun matcher `path`, så vi gir dem den eksplisitt for å unngå at
  // strok-bredden vokser ved zoom inn).
  for (let i = 0; i < v.length; i++) {
    const c = document.createElementNS(ns, 'circle')
    c.setAttribute('cx', v[i].x); c.setAttribute('cy', v[i].y)
    c.setAttribute('r', vertR)
    c.setAttribute('fill', '#16a34a')
    c.setAttribute('stroke', '#fff')
    c.setAttribute('stroke-width', String(1.5 / s))
    c.setAttribute('vector-effect', 'non-scaling-stroke')
    layer.appendChild(c)
  }
}

watch([measureVertices, measureClosed, scale], () => renderMeasure(), { deep: true })

// Stifinner-overlay: 1–3 fargede ruter + start/mål-markører + connector-
// strek fra valgt punkt til snappet sti-node. Tegnes i et eget <g> på SVG-en
// (mønster fra renderMeasure). Stroke-bredder deles på scale for konstant
// skjerm-tykkelse. Valgt rute er kraftig; øvrige dempet og tynnere.
const ROUTE_COLORS = ['#dc2626', '#7c3aed', '#0891b2'] // rød, lilla, cyan
function renderRoutes() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const ns = 'http://www.w3.org/2000/svg'
  let layer = svg.querySelector('#stifinner-layer')
  if (!layer) {
    layer = document.createElementNS(ns, 'g')
    layer.setAttribute('id', 'stifinner-layer')
    layer.setAttribute('data-layer', 'stifinner')
    svg.appendChild(layer)
  }
  layer.replaceChildren()
  // Tegn i både 'showing' og 'pickingVia' (behold ruten synlig mens brukeren
  // sikter et nytt via-punkt).
  if (sti.mode.value !== 'showing' && sti.mode.value !== 'pickingVia') return

  const s = scale.value || 1
  const mk = (d, stroke, width, opts = {}) => {
    const p = document.createElementNS(ns, 'path')
    p.setAttribute('d', d)
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', stroke)
    p.setAttribute('stroke-width', String(width / s))
    p.setAttribute('stroke-linecap', 'round')
    p.setAttribute('stroke-linejoin', 'round')
    if (opts.dash) p.setAttribute('stroke-dasharray', `${opts.dash / s} ${opts.dash / s}`)
    if (opts.opacity != null) p.setAttribute('opacity', String(opts.opacity))
    if (opts.pe) p.setAttribute('pointer-events', opts.pe)
    return p
  }

  // Connector-strek (valgt punkt → snappet node). Stiplet grå. Ved rundtur er
  // start == mål (samme origo), så mål-connectoren droppes (den overlapper).
  const a = sti.start.value, b = sti.destination.value
  const aSnap = sti.startSnap.value, bSnap = sti.destSnap.value
  if (a && aSnap) layer.appendChild(mk(`M${a.svgX},${a.svgY}L${aSnap.x},${aSnap.y}`, '#64748b', 1.5, { dash: 3, pe: 'none' }))
  if (!sti.isLoop.value && b && bSnap) layer.appendChild(mk(`M${b.svgX},${b.svgY}L${bSnap.x},${bSnap.y}`, '#64748b', 1.5, { dash: 3, pe: 'none' }))
  const viaPts = sti.via.value, viaSnapArr = sti.viaSnaps.value
  for (let i = 0; i < viaPts.length; i++) {
    const v = viaPts[i], vs = viaSnapArr[i]
    if (v && vs) layer.appendChild(mk(`M${v.svgX},${v.svgY}L${vs.x},${vs.y}`, '#64748b', 1.5, { dash: 3, pe: 'none' }))
  }

  // Tegn ikke-valgte ruter først (under), valgt rute øverst.
  const order = sti.routes.value.map((_, i) => i)
    .sort((i, j) => (i === sti.selectedRouteIdx.value ? 1 : 0) - (j === sti.selectedRouteIdx.value ? 1 : 0))
  for (const i of order) {
    const r = sti.routes.value[i]
    const d = polylineToPath(r.coordinates, false)
    const selected = i === sti.selectedRouteIdx.value
    const color = ROUTE_COLORS[i % ROUTE_COLORS.length]
    // Hvit halo
    layer.appendChild(mk(d, 'rgba(255,255,255,0.9)', selected ? 7 : 5, { pe: 'none', opacity: selected ? 1 : 0.6 }))
    // Farget linje
    layer.appendChild(mk(d, color, selected ? 3.5 : 2.2, { pe: 'none', opacity: selected ? 1 : 0.55 }))
    // Bred usynlig hit-path for lett tapp-treff
    const hit = mk(d, 'transparent', 16, { pe: 'stroke' })
    hit.style.cursor = 'pointer'
    hit.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectRoute(i) })
    layer.appendChild(hit)
  }

  // Start (A, grønn) og mål (B, rød) markører.
  const dot = (x, y, fill) => {
    const c = document.createElementNS(ns, 'circle')
    c.setAttribute('cx', x); c.setAttribute('cy', y)
    c.setAttribute('r', String(pxToUserUnits(6)))
    c.setAttribute('fill', fill)
    c.setAttribute('stroke', '#fff')
    c.setAttribute('stroke-width', String(2 / s))
    c.setAttribute('pointer-events', 'none')
    return c
  }
  if (a) layer.appendChild(dot(a.svgX, a.svgY, '#16a34a'))
  for (const v of viaPts) if (v) layer.appendChild(dot(v.svgX, v.svgY, '#f59e0b'))
  // Ved rundtur er mål == origo (grønn prikk allerede tegnet) → ingen egen rød.
  if (!sti.isLoop.value && b) layer.appendChild(dot(b.svgX, b.svgY, '#dc2626'))
}
watch([() => sti.routes.value, () => sti.selectedRouteIdx.value, () => sti.mode.value,
       () => sti.via.value, scale],
  () => renderRoutes(), { deep: true })

// Sørg for at annoterings-symbolenes <symbol id="iso-sym-X"> finnes i kart-
// SVG-ens <defs>. Nødvendig fordi mapBuilder (v9.1.10+) kun emitterer defs
// for symboler som faktisk BRUKES av auto-features i body — annoterings-
// symboler (knaus/stein/brønn/bro) plasseres klient-side og er typisk ikke
// auto-brukt, så <use href="#iso-sym-knaus"> fant ingenting (kun stedsmerke,
// som har egen custom-rendering, virket). Vi injiserer de manglende defs-ene
// fra katalogen. Stedsmerke hoppes over (rendres via appendStedsmerkeSymbol).
function ensureAnnotationDefs(svg) {
  const ns = 'http://www.w3.org/2000/svg'
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS(ns, 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  for (const s of ANNOTATION_SYMBOLS) {
    if (s.symbolKey === 'stedsmerke') continue
    const id = `iso-sym-${s.symbolKey}`
    if (svg.querySelector(`[id="${id}"]`)) continue
    const spec = isomCatalog.pointSymbols?.[s.symbolKey]
    if (!spec) continue
    const parsed = new DOMParser().parseFromString(
      `<svg xmlns="${ns}">${buildPointSymbolDef(id, spec)}</svg>`, 'image/svg+xml')
    const symEl = parsed.querySelector('symbol')
    if (symEl) defs.appendChild(document.importNode(symEl, true))
  }
}

function renderAnnotations() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  ensureAnnotationDefs(svg)
  const ns = 'http://www.w3.org/2000/svg'
  const xlink = 'http://www.w3.org/1999/xlink'
  let layer = svg.querySelector('#annotation-layer')
  if (!layer) {
    layer = document.createElementNS(ns, 'g')
    layer.setAttribute('id', 'annotation-layer')
    layer.setAttribute('data-layer', 'annotering')
    layer.setAttribute('pointer-events', 'none')
    svg.appendChild(layer)
  }
  layer.replaceChildren()

  // Symbol-størrelse: ~32 CSS px på skjerm uansett zoom-nivå. ISOM-print-
  // størrelse (1.5–2 mm = 6–7.5 px) er usynlig på telefon ved standard
  // kart-zoom (5 km bbox i ~380 px container → 1 m ≈ 0.076 CSS px).
  // pxToUserUnits konverterer ønsket skjerm-px til user-units (meter)
  // basert på faktisk getBoundingClientRect — inkluderer pinch-zoom CSS-
  // transform så symbolet holder konstant skjerm-størrelse.
  const SYMBOL_M = pxToUserUnits(32)
  const HALF = SYMBOL_M / 2

  for (const a of annot.annotations.value) {
    if (a.type !== 'point') continue
    const sym = ANNOTATION_SYMBOLS.find(s => s.code === a.isomCode)
    if (!sym) continue
    // Per-type synlighet (drawer-laget «Annoteringer»). Når brukeren skjuler
    // f.eks. alle «Knaus» beholdes annotasjonen i lagring men ikke rendres.
    if (!annot.visibleTypes.value.has(sym.symbolKey)) continue

    const g = document.createElementNS(ns, 'g')
    // Stedsmerke (rød dråpe-pin) og stedsnavn skal alltid vises «opp» på
    // skjermen selv om kartet er rotert. Counter-rotate g-en med samme
    // mengde som kartets rotasjon, rundt anker-punktet (som nå er (0,0)
    // etter translate). applyUprightLabels() oppdaterer transformen ved
    // hver rotasjons-endring uten å re-rendre noden (v8.9.3).
    if (sym.symbolKey === 'stedsmerke') {
      g.setAttribute('transform', `translate(${a.x},${a.y}) rotate(${-rotation.value})`)
    } else {
      g.setAttribute('transform', `translate(${a.x},${a.y})`)
    }
    g.setAttribute('data-annot-id', a.id)
    g.setAttribute('data-annot-type', sym.symbolKey)

    // Lys ring (lilla) bak symbolet er et editor-hint som vises kun mens
    // brukeren er i annoteringsmodus. Når modusen lukkes (deselect i
    // drawer) forsvinner ringen og symbolet rendres «rent» som på print.
    if (annot.isAnnotateMode.value) {
      const halo = document.createElementNS(ns, 'circle')
      halo.setAttribute('cx', '0')
      halo.setAttribute('cy', '0')
      halo.setAttribute('r', String(HALF * 0.95))
      halo.setAttribute('fill', '#fffef0')
      halo.setAttribute('fill-opacity', '0.9')
      halo.setAttribute('stroke', '#7a3aa3')
      halo.setAttribute('stroke-width', '2')
      halo.setAttribute('vector-effect', 'non-scaling-stroke')
      g.appendChild(halo)
    }

    if (sym.symbolKey === 'stedsmerke') {
      // I annoteringsmodus tegnes pin-en statisk (brukeren plasserer/
      // justerer — animasjon ville vært forstyrrende). Når kartet
      // gjenåpnes fra lagring rendres med squash & stretch hver 5s, med
      // tilfeldig pre-roll pr instans så ikke alle spretter i takt.
      // (Spillmodus skjules tidligere via early return ovenfor.)
      appendStedsmerkeSymbol(g, HALF, !annot.isAnnotateMode.value)
    } else {
      const use = document.createElementNS(ns, 'use')
      const href = `#iso-sym-${sym.symbolKey}`
      use.setAttribute('href', href)
      use.setAttributeNS(xlink, 'xlink:href', href)
      use.setAttribute('x', String(-HALF))
      use.setAttribute('y', String(-HALF))
      use.setAttribute('width', String(SYMBOL_M))
      use.setAttribute('height', String(SYMBOL_M))
      g.appendChild(use)
    }

    layer.appendChild(g)
  }
}

/**
 * Bygg Stedsmerke-symbolet inn i en eksisterende g-node.
 * - s        = halv symbol-bredde (user-units, ~16 CSS-px på skjerm)
 * - animated = true → squash & stretch + random pre-roll. false → ren hvile-
 *              positur (brukes i annoteringsmodus mens brukeren plasserer)
 * - parent g er allerede translate-positionert til annotasjonens (x,y)
 *
 * Visuell design: klassisk rød dråpe-pin med hvit prikk og halvgjennom-
 * siktig skygge under. Pin-tip-en peker presist på annotasjonens (x, y) —
 * pin-en strekker seg oppover derfra. SMIL — ingen JS-timer.
 *
 * Animasjonen er nestet g-er: ytterste plasserer pin-tip-en, midtre
 * animerer translate Y (sprett), innerste animerer scale (squash &
 * stretch). `animateTransform type` må være translate eller scale —
 * `type="matrix"` finnes IKKE i SVG SMIL.
 */
function appendStedsmerkeSymbol(parent, s, animated) {
  const ns = 'http://www.w3.org/2000/svg'
  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    return el
  }

  // s = half-symbol-bredde. Pin head-radius på 0.55*s gir kompakt pin
  // som passer i symbol-boksen uten å dominere kartet.
  const r = s * 0.55
  const shadowRx = r
  const shadowRy = r * 0.22
  const shadowPy = r * 0.18  // Like under pin-tip-en (annotasjonspunktet).

  // Skygge: outer g plasserer + skalerer til ønsket størrelse.
  const shadowOuter = mk('g', {
    transform: `translate(0 ${shadowPy}) scale(${shadowRx} ${shadowRy})`,
  })
  const shadowEl = mk('ellipse', {
    cx: '0', cy: '0', rx: '1', ry: '1',
    fill: '#000', opacity: '0.55',
  })

  // Pin: outer g (rest-pos er allerede annotasjonspunkt, så ingen translate).
  // v9.1.1: ingen border — pin-en er en ren rød silhuett (samme stil som
  // parkering-P). Tidligere mørkerød kontur dempet hodets distinkte form.
  const pinPosG = mk('g', {})
  const pinPathEl = mk('path', {
    d: pinPath(r),
    fill: '#dc2626',
  })
  const pinDotEl = mk('circle', {
    cx: '0', cy: String(-1.85 * r), r: String(r * 0.38),
    fill: '#fff',
  })

  if (!animated) {
    // Statisk: ingen sprett, ingen scale, ingen random offset.
    shadowOuter.appendChild(shadowEl)
    pinPosG.appendChild(pinPathEl)
    pinPosG.appendChild(pinDotEl)
    parent.appendChild(shadowOuter)
    parent.appendChild(pinPosG)
    return
  }

  // Animert: shadow får inner-g for scale, pin får mid-g for translate
  // og inner-g for scale. Felles random begin på alle 4 animatorer.
  const begin = randomBegin()

  const shadowAnim = mk('g', {})
  shadowAnim.appendChild(mk('animateTransform', {
    attributeName: 'transform', type: 'scale',
    values: SHADOW_SCALE_VALUES, keyTimes: STEDSMERKE_KEY_TIMES,
    dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
  }))
  shadowEl.appendChild(mk('animate', {
    attributeName: 'opacity',
    values: STEDSMERKE_SHADOW_OPACITY,
    keyTimes: STEDSMERKE_KEY_TIMES,
    dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
  }))
  shadowAnim.appendChild(shadowEl)
  shadowOuter.appendChild(shadowAnim)
  parent.appendChild(shadowOuter)

  const pinTranslateG = mk('g', {})
  pinTranslateG.appendChild(mk('animateTransform', {
    attributeName: 'transform', type: 'translate',
    values: pinTranslateValues(r), keyTimes: STEDSMERKE_KEY_TIMES,
    dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
  }))
  const pinScaleG = mk('g', {})
  pinScaleG.appendChild(mk('animateTransform', {
    attributeName: 'transform', type: 'scale',
    values: PIN_SCALE_VALUES, keyTimes: STEDSMERKE_KEY_TIMES,
    dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
  }))
  pinScaleG.appendChild(pinPathEl)
  pinScaleG.appendChild(pinDotEl)
  pinTranslateG.appendChild(pinScaleG)
  pinPosG.appendChild(pinTranslateG)
  parent.appendChild(pinPosG)
}

function selectSymbol(key) {
  annot.selectedSymbol.value = annot.selectedSymbol.value === key ? null : key
  annot.isAnnotateMode.value = annot.selectedSymbol.value !== null
}

/**
 * Hold ALL tekst i kart-SVG-en samt stedsmerke-piner stående «opp» på
 * skjermen mens resten av kartet roterer. Counter-rotation appliseres
 * rundt hver etikets eget ankerpunkt slik at de blir lesbare uansett
 * kart-vinkel.
 *
 * v8.9.3: kun stedsnavn + stedsmerke. v8.9.7: utvidet til alle <text>
 * (vann-navn, kontur-tall, dybde-tall, peak, peak-ele, lanterne-tall,
 * skjaer-navn, dybde-kontur-tall, slipp-navn …). Symboler (use/path)
 * roterer fortsatt med terrenget — kun tekst og pin holdes opp.
 *
 * Bruker text.x.baseVal[0].value som gir resolved numeric verdi i
 * user-units uansett om attributtet er "2mm" eller et tall — browseren
 * konverterer mm → user-units for oss. Faller tilbake til 0 hvis x/y
 * mangler (multi-coordinate texts og defaults).
 *
 * Kjøres som lett attributt-oppdatering ved hver rotasjons-endring —
 * ingen DOM-creation, så det er trygt å kalle hver touchmove-frame.
 */
function applyUprightLabels() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const rot = -rotation.value
  // Alle tekst-labels i kart-innholdet
  const texts = svg.querySelectorAll('text')
  for (const el of texts) {
    // v9.3.6 — Hopp over <text> som er en symbol-mal i <defs> (f.eks. «WC»-
    // teksten i ISOM 554-symbolet). Slike instansieres via <use> inne i en
    // <g data-upright="1">-gruppe som ALLEREDE counter-roteres lenger ned;
    // å rotere mal-teksten i tillegg ga dobbel counter-rotation, så WC endte
    // på -rotation (roterte «feil vei») i stedet for å stå rett opp.
    let inDefs = el.__indefs
    if (inDefs === undefined) {
      inDefs = !!el.closest('defs')
      el.__indefs = inDefs
    }
    if (inDefs) continue
    // v12.0.16 — Veinummer-skilt håndteres som HEL gruppe (rect + tekst)
    // lenger ned: å counter-rotere teksten alene skjevstiller den mot
    // skilt-boksen (rapportert etter v12.0.15).
    if (el.dataset.label === 'veinummer') continue
    // v9.1.11 — Perf: cache BÅDE lag-referansen og x/y per element. closest()
    // og baseVal er dyrt; å kjøre dem for hver av 1000+ labels HVER rotasjons-
    // /kompass-frame ga jank (v9.1.10-regresjon: closest per frame). Statisk
    // per element, så vi regner det ut én gang og leser deretter bare den
    // billige inline `style.display` per frame.
    let layerG = el.__layer
    if (layerG === undefined) {
      layerG = el.closest('[data-layer]')
      el.__layer = layerG
    }
    // Hopp over labels i skjulte lag (stedsnavn default av → 1000+ noder
    // itereres ikke). Re-orienteres når laget slås på (applyLayerVisibility).
    if (layerG && layerG.style.display === 'none') continue
    let xVal = el.__ux
    if (xVal === undefined) {
      xVal = el.x?.baseVal?.[0]?.value ?? 0
      el.__ux = xVal
      el.__uy = el.y?.baseVal?.[0]?.value ?? 0
    }
    el.setAttribute('transform', `rotate(${rot} ${xVal} ${el.__uy})`)
  }
  // Stedsmerke-annoteringer (rød dråpe-pin). G-en har allerede
  // translate(x,y) — counter-rotate rundt (0,0) i lokalt rom holder
  // pin-tipp-en forankret mens hodet vippes opp.
  const pins = svg.querySelectorAll('[data-annot-type="stedsmerke"]')
  for (const el of pins) {
    // Bevarer eksisterende translate, bytter ut/setter rotate-segment
    const existing = el.getAttribute('transform') ?? ''
    const m = existing.match(/translate\([^)]+\)/)
    const trans = m ? m[0] : ''
    el.setAttribute('transform', `${trans} rotate(${rot})`)
  }
  // Auto-genererte symboler markert med data-upright (foreløpig kun
  // parkerings-P) skal leses vannrett med skjermens topp — bruker samme
  // mønster som stedsmerke: bevar translate, bytt rotate-segmentet.
  const upright = svg.querySelectorAll('[data-upright="1"]')
  for (const el of upright) {
    const existing = el.getAttribute('transform') ?? ''
    const m = existing.match(/translate\([^)]+\)/)
    const trans = m ? m[0] : ''
    el.setAttribute('transform', `${trans} rotate(${rot})`)
  }
  // v12.0.16 — Veinummer-skilt: beholder vei-bæringen sin (ikke billboard),
  // men flippes 180° når kart-rotasjonen ville lagt teksten på hodet.
  // Skiltet ligger dermed alltid LANGS veien og er alltid lesbart. Bygge-
  // vinkelen caches fra transform-strengen første gang (virker dermed også
  // på kart generert før denne fiksen).
  const badges = svg.querySelectorAll('[data-layer="veinummer"] > g')
  for (const el of badges) {
    if (el.__deg === undefined) {
      const t = el.getAttribute('transform') ?? ''
      el.__trans = t.match(/translate\([^)]+\)/)?.[0] ?? ''
      el.__deg = Number(t.match(/rotate\((-?[\d.]+)/)?.[1] ?? 0)
      // Kart lagret mens v12.0.15-buggen var aktiv kan ha en gammel
      // counter-rotation baket inn på selve teksten — fjern den.
      el.querySelector('text')?.removeAttribute('transform')
    }
    el.setAttribute('transform', `${el.__trans} rotate(${roadRefUprightDeg(el.__deg, rotation.value)})`)
  }
}

// Skilt-vinkel som holder veinummer-teksten lesbar: behold bygge-vinkelen
// hvis effektiv skjermvinkel (bygge + kart-rotasjon) er innenfor ±90°,
// ellers flipp 180°. Returnerer vinkel i kart-rom.
function roadRefUprightDeg(bakedDeg, mapRotDeg) {
  const eff = ((bakedDeg + mapRotDeg) % 360 + 540) % 360 - 180
  return (eff > 90 || eff <= -90) ? bakedDeg + 180 : bakedDeg
}

// Watch rotasjon — billig attributt-oppdatering, ingen full re-render.
watch(rotation, applyUprightLabels)

/**
 * Render alle synlige GPS-spor i et eget SVG-lag som ligger mellom kart-
 * innholdet og annotation/user-laget. Stilen styres av tracker.trackStyle
 * — 'line' (polyline med marsjerende prikker), 'footprints' eller
 * 'breadcrumbs'. Live-tracket (det som spilles inn nå) har ekstra
 * pulserende hode-markør så brukeren ser at opptaket lever.
 */
function renderTracks() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  const ns = 'http://www.w3.org/2000/svg'
  let layer = svg.querySelector('#track-layer')
  if (!layer) {
    layer = document.createElementNS(ns, 'g')
    layer.setAttribute('id', 'track-layer')
    layer.setAttribute('data-layer', 'spor')
    layer.setAttribute('pointer-events', 'none')
    // Plasser før user-layer + annotation-layer hvis de finnes,
    // ellers append. Spor skal ligge UNDER GPS-dot/annoteringer.
    const userLayer = svg.querySelector('#user-layer')
    const annotLayer = svg.querySelector('#annotation-layer')
    const ref = userLayer ?? annotLayer
    if (ref) svg.insertBefore(layer, ref)
    else svg.appendChild(layer)
  }
  layer.replaceChildren()

  // v8.9.5: paths inne i [data-layer] arver vector-effect: non-scaling-
  // stroke fra global SVG-CSS, så stroke-width tolkes i CSS-px. Del kun på
  // pinch-scale for å kompensere for CSS-transform-zoom. (Tidligere brukte
  // vi pxToUserUnits her — det ga ~10× for tykk linje på 4 km-kart.)
  const s = scale.value || 1
  const haloW = 7 / s
  const lineW = 3.5 / s
  // Circle/ellipse-radii er geometri, ikke stroke → fortsatt user-units
  const dotR  = pxToUserUnits(2.5)
  const footW = pxToUserUnits(5)

  const TRACK_COLOR = '#ec4899'         // magenta — kontrasterer mot ISOM
  const HALO_COLOR  = 'rgba(255,255,255,0.85)'

  const style = tracker.trackStyle.value
  for (const tr of tracker.tracks.value) {
    if (!tracker.visibleTrackIds.value.has(tr.id)) continue
    if (!tr.points || tr.points.length === 0) continue
    const isActive = tracker.isRecording.value && (tracker.activeTrack.value?.id === tr.id)
    const g = document.createElementNS(ns, 'g')
    g.setAttribute('data-track-id', tr.id)

    if (style === 'breadcrumbs') {
      // Diskrete prikker hver ~10 m. Bruk avstands-basert sampling så
      // tett-pakkede punkter ikke gir cluster.
      const pts = sampleByDistance(tr.points, 10)
      for (const p of pts) {
        const c = document.createElementNS(ns, 'circle')
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y)
        c.setAttribute('r', dotR)
        c.setAttribute('fill', TRACK_COLOR)
        c.setAttribute('stroke', HALO_COLOR)
        c.setAttribute('stroke-width', pxToUserUnits(1.5))
        g.appendChild(c)
      }
    } else if (style === 'footprints') {
      // Fotavtrykk: små elliptiske prikker alternerende venstre/høyre av
      // bevegelses-retningen, ~5 m mellomrom. Rotasjon følger lokal vinkel.
      const pts = sampleByDistance(tr.points, 5)
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const next = pts[i + 1] ?? pts[i - 1] ?? p
        const dx = next.x - p.x
        const dy = next.y - p.y
        const angDeg = Math.atan2(dy, dx) * 180 / Math.PI
        const side = (i % 2 === 0) ? 1 : -1
        const off = footW * 0.6
        const perpAng = (angDeg + 90) * Math.PI / 180
        const fx = p.x + Math.cos(perpAng) * off * side
        const fy = p.y + Math.sin(perpAng) * off * side
        const fp = document.createElementNS(ns, 'ellipse')
        fp.setAttribute('cx', fx); fp.setAttribute('cy', fy)
        fp.setAttribute('rx', footW * 0.45)
        fp.setAttribute('ry', footW * 0.85)
        fp.setAttribute('transform', `rotate(${angDeg},${fx},${fy})`)
        fp.setAttribute('fill', TRACK_COLOR)
        fp.setAttribute('stroke', HALO_COLOR)
        fp.setAttribute('stroke-width', pxToUserUnits(1))
        fp.setAttribute('opacity', '0.9')
        g.appendChild(fp)
      }
    } else {
      // Default: to-lags polyline med marsjerende prikker. Halo bak gir
      // lesbarhet på både lyse og mørke kart-temaer.
      const d = pointsToPathD(tr.points)
      const halo = document.createElementNS(ns, 'path')
      halo.setAttribute('d', d)
      halo.setAttribute('fill', 'none')
      halo.setAttribute('stroke', HALO_COLOR)
      halo.setAttribute('stroke-width', haloW)
      halo.setAttribute('stroke-linecap', 'round')
      halo.setAttribute('stroke-linejoin', 'round')
      g.appendChild(halo)

      const line = document.createElementNS(ns, 'path')
      line.setAttribute('d', d)
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', TRACK_COLOR)
      line.setAttribute('stroke-width', lineW)
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('stroke-linejoin', 'round')
      // Marsjerende prikker: stiplet + animasjon på offset. Dasharray
      // arver også non-scaling-stroke, så CSS-px / pinch-scale.
      const dash = 6 / s
      const gap = 8 / s
      line.setAttribute('stroke-dasharray', `${dash} ${gap}`)
      const anim = document.createElementNS(ns, 'animate')
      anim.setAttribute('attributeName', 'stroke-dashoffset')
      anim.setAttribute('from', String(dash + gap))
      anim.setAttribute('to', '0')
      anim.setAttribute('dur', '1.4s')
      anim.setAttribute('repeatCount', 'indefinite')
      line.appendChild(anim)
      g.appendChild(line)
    }

    // Live-puls på siste punkt mens opptaket pågår. Gjør det visuelt
    // tydelig at hovedet av sporet er "her og nå" og at appen henter
    // friske GPS-fix-er.
    if (isActive && tr.points.length > 0) {
      const last = tr.points[tr.points.length - 1]
      const headR = pxToUserUnits(8)
      const pulse = document.createElementNS(ns, 'circle')
      pulse.setAttribute('cx', last.x); pulse.setAttribute('cy', last.y)
      pulse.setAttribute('r', headR)
      pulse.setAttribute('fill', 'none')
      pulse.setAttribute('stroke', TRACK_COLOR)
      pulse.setAttribute('stroke-width', pxToUserUnits(2))
      const aR = document.createElementNS(ns, 'animate')
      aR.setAttribute('attributeName', 'r')
      aR.setAttribute('values', `${headR};${headR * 2.4};${headR}`)
      aR.setAttribute('dur', '1.6s'); aR.setAttribute('repeatCount', 'indefinite')
      pulse.appendChild(aR)
      const aO = document.createElementNS(ns, 'animate')
      aO.setAttribute('attributeName', 'opacity')
      aO.setAttribute('values', '0.9;0;0.9'); aO.setAttribute('dur', '1.6s')
      aO.setAttribute('repeatCount', 'indefinite')
      pulse.appendChild(aO)
      g.appendChild(pulse)
    }

    layer.appendChild(g)
  }
}

/** Forenkle path til "M x,y L x,y L ..." fra point-array. */
function pointsToPathD(points) {
  if (!points.length) return ''
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`
  }
  return d
}

/** Sample punkter med min-avstand i SVG-meter. Beholder første og siste. */
function sampleByDistance(points, minDistM) {
  if (points.length <= 1) return points.slice()
  const out = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1]
    const dx = points[i].x - last.x
    const dy = points[i].y - last.y
    if (Math.hypot(dx, dy) >= minDistM) out.push(points[i])
  }
  // Sørg for at siste punkt alltid er med (viktig for live-puls)
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1])
  }
  return out
}

// Start GPS + kompass i samme bruker-gest. Kompasset driver retnings-kjegla
// (se updateUserDot); det MÅ startes fra et klikk/tap fordi iOS krever at
// DeviceOrientationEvent.requestPermission() kalles innenfor en bruker-gest.
// Derfor kalles dette fra gest-handlerne, ikke fra en watcher. compass.start()
// er idempotent-guardet på isActive så GPS-refresh ikke re-spør om tillatelse.
function startPositioning() {
  userPos.start()
  if (!compass.isActive) compass.start()
}

// Track-action-handlers for drawer
function onToggleRecording() {
  if (!userPos.isWatching) { startPositioning(); return }
  if (tracker.isRecording.value) tracker.stopRecording()
  else tracker.startRecording()
}

// Header-shortcut: ett trykk = GPS + sporing av/på.
// Idle → start GPS + start opptak (sist-brukte stil).
// GPS på, ikke opptak → start opptak.
// Opptak → stopp opptak (GPS forblir aktivt så ikonen viser posisjon).
function onHeaderTrackShortcut() {
  if (tracker.isRecording.value) {
    void tracker.stopRecording()
    return
  }
  if (!userPos.isWatching) startPositioning()
  tracker.startRecording()
}
async function onDeleteTrack(id) {
  if (!confirm('Slett dette sporet?')) return
  await tracker.deleteTrack(id)
}
function onExportTrackGpx(tr) {
  if (!meta.value) return
  downloadGpx(tr, meta.value, mapTitle.value)
}

// ── Mosaikk + manuell utvidelse ───────────────────────────────────────────
// Den AUTOMATISKE auto-karten (bygg-på-dvele/prefetch/promotér-på-dvele) er
// fjernet — brukeren utvider eksplisitt via kant-sonene (#extend-zones) og gjør
// en nabo-flis aktiv via en knapp. Mosaikk-rendering (renderGhostTiles) og
// tile-cachen (pruneAutoTiles) beholdes. Navn med «autoMap»-prefiks beholdes der
// de nå dekker delt infrastruktur (bygge-opts, toast, modus-gate).
const buildingOnTheFly = ref(false)  // full-screen loader-flagg (gjenbrukes)
const buildingProgress = ref('')
const autoMapToast = ref('')      // transient melding (offline, flyttet, utvidet)
let autoMapToastTimer = null
let autoMapOfflineNotified = false   // offline-toast vises kun én gang
let autoMapArmed = true              // bygge-lås (extendMap/promoteTile)
// Om kartet som vises NÅ ble auto-/utvidelses-generert (settes fra init-prefs).
const currentMapIsAuto = ref(false)

// Kant-soner (manuell utvidelse, auto-kart AV): 8 diskrete prikker tegnet som
// EKTE SVG-elementer i kart-SVG-en (gruppe #extend-zones). De lever i kart-rommet
// og panner/zoomer/roterer med kartet, så de er IKKE synlige før brukeren enten
// zoomer ut eller panorerer forbi en kant (da kommer canvas-marginen utenfor
// flisa til syne). De fjernes ved eksport/utskrift (se mapSvgMarkupForExport +
// stripRuntimeOverlays). Prikkene mot-skaleres til konstant skjermstørrelse.
const EXTEND_ZONE_DIRS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']
const EXTEND_ZONE_LABEL = {
  N: 'Utvid mot nord', S: 'Utvid mot sør', E: 'Utvid mot øst', W: 'Utvid mot vest',
  NE: 'Utvid mot nordøst', NW: 'Utvid mot nordvest',
  SE: 'Utvid mot sørøst', SW: 'Utvid mot sørvest',
}
const EXTEND_ZONE_R = 16      // prikk-radius i skjermpiksler (mot-skalert)
const EXTEND_ZONE_OFF = 30    // hvor langt UTENFOR kanten prikken sitter (px)
// Drawer-en dekker kant-sonene kun når den er ÅPEN og i ekspandert tilstand
// (mobil-bunnark). Når den er minimert titter bare fane-stripen opp (~32 px), så
// prikkene som sitter utenfor kart-kanten er fortsatt synlige og klikkbare —
// da skal de ikke skjules (v11.0.32). isMinimized er alltid false på desktop
// (side-panel), så desktop-oppførselen er uendret.
const drawerCoversCanvas = computed(() =>
  showControls.value && !drawer.isMinimized.value
)
const extendZonesVisible = computed(() =>
  !loading.value && !loadError.value && !!meta.value &&
  !buildingOnTheFly.value && !fillingInDetails.value &&
  !annot.isAnnotateMode.value &&
  !measureMode.value && !sti.active.value && !searchOpen.value && !drawerCoversCanvas.value
)

// Mot-skalerings-faktor: 1 base-enhet i en kant-sone-gruppe rendres som 1 skjerm-
// piksel, uavhengig av zoom. SVG fyller wrapperen med fit = min(w/W, h/H), og
// kart-CSS-transformen legger på scale; vi nuller begge ut.
function extendZoneScaleK() {
  const m = meta.value
  const wrap = wrapperRef.value?.getBoundingClientRect()
  if (!m || !wrap?.width || !wrap?.height) return null
  const fit = Math.min(wrap.width / m.widthM, wrap.height / m.heightM)
  if (!(fit > 0)) return null
  return 1 / (fit * (scale.value || 1))
}

// Yttergrensa for det som vises nå = aktiv flis ∪ alle spøkelses-rekter (samme
// union som clampPan). Prikkene ankres til DENNE kanten, ikke bare aktiv flis, så
// de alltid står ytterst i canvas — også etter at man har bygd et 2×2 brutto-kart.
function extendZonesBounds() {
  const m = meta.value
  let minX = 0, minY = 0, maxX = m.widthM, maxY = m.heightM
  for (const g of ghostRects.value) {
    if (g.x < minX) minX = g.x
    if (g.y < minY) minY = g.y
    if (g.x + g.w > maxX) maxX = g.x + g.w
    if (g.y + g.h > maxY) maxY = g.y + g.h
  }
  return { minX, minY, maxX, maxY }
}

// Anker (på selve mosaikk-kanten) + utover-offset (i base-piksler) pr retning.
// SVG-y vokser nedover → nord = mindre y.
function extendZoneAnchor(direction, b) {
  const c = 0.7071   // diagonal-komponent (45°) så hjørne-prikker står like langt ut
  const O = EXTEND_ZONE_OFF
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2
  switch (direction) {
    case 'N': return { ax: cx, ay: b.minY, ox: 0, oy: -O }
    case 'S': return { ax: cx, ay: b.maxY, ox: 0, oy: O }
    case 'E': return { ax: b.maxX, ay: cy, ox: O, oy: 0 }
    case 'W': return { ax: b.minX, ay: cy, ox: -O, oy: 0 }
    case 'NE': return { ax: b.maxX, ay: b.minY, ox: O * c, oy: -O * c }
    case 'NW': return { ax: b.minX, ay: b.minY, ox: -O * c, oy: -O * c }
    case 'SE': return { ax: b.maxX, ay: b.maxY, ox: O * c, oy: O * c }
    case 'SW': return { ax: b.minX, ay: b.maxY, ox: -O * c, oy: O * c }
    default: return null
  }
}

// Oppdater bare scale-komponenten på de eksisterende kant-sone-gruppene (billig,
// kjøres på zoom-watch). Ankeret (translate) er uendret.
function updateExtendZoneScale() {
  const g = svgHostRef.value?.querySelector('#extend-zones')
  if (!g) return
  const k = extendZoneScaleK()
  if (k == null) return
  for (const z of g.querySelectorAll('[data-extend-dir]')) {
    z.setAttribute('transform', `translate(${z.dataset.ax} ${z.dataset.ay}) scale(${k})`)
  }
}

// Tegn (eller fjern) de 8 kant-sonene som SVG-elementer i den aktive flisa.
function renderExtendZones() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  svg.querySelector('#extend-zones')?.remove()
  if (!extendZonesVisible.value) return
  const m = meta.value
  const k = extendZoneScaleK()
  if (!m || k == null) return
  const bounds = extendZonesBounds()
  const ns = 'http://www.w3.org/2000/svg'
  const g = document.createElementNS(ns, 'g')
  g.setAttribute('id', 'extend-zones')
  // Containeren slipper gjennom pan-gester; kun prikkene fanger tap.
  g.setAttribute('pointer-events', 'none')
  for (const dir of EXTEND_ZONE_DIRS) {
    const a = extendZoneAnchor(dir, bounds)
    if (!a) continue
    const zone = document.createElementNS(ns, 'g')
    zone.setAttribute('data-extend-dir', dir)
    zone.dataset.ax = String(a.ax)
    zone.dataset.ay = String(a.ay)
    zone.setAttribute('transform', `translate(${a.ax} ${a.ay}) scale(${k})`)
    zone.setAttribute('pointer-events', 'auto')
    zone.setAttribute('cursor', 'pointer')
    zone.setAttribute('role', 'button')
    zone.setAttribute('aria-label', EXTEND_ZONE_LABEL[dir])
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', String(a.ox))
    circle.setAttribute('cy', String(a.oy))
    circle.setAttribute('r', String(EXTEND_ZONE_R))
    circle.setAttribute('fill', '#0ea5e9')
    circle.setAttribute('fill-opacity', '0.92')
    circle.setAttribute('stroke', '#ffffff')
    circle.setAttribute('stroke-width', '2.5')
    const plus = document.createElementNS(ns, 'path')
    const h = 7
    plus.setAttribute('d', `M ${a.ox - h} ${a.oy} H ${a.ox + h} M ${a.ox} ${a.oy - h} V ${a.oy + h}`)
    plus.setAttribute('stroke', '#ffffff')
    plus.setAttribute('stroke-width', '2.5')
    plus.setAttribute('stroke-linecap', 'round')
    zone.appendChild(circle)
    zone.appendChild(plus)
    zone.addEventListener('click', (ev) => { ev.stopPropagation(); extendMap(dir) })
    g.appendChild(zone)
  }
  svg.appendChild(g)
}
watch(extendZonesVisible, () => { renderExtendZones() })
// Mosaikken endret seg (ny flis bygd / scroll-tilbake) → re-anker prikkene til
// den nye yttergrensa.
watch(ghostRects, () => { renderExtendZones() }, { deep: true })
watch(scale, updateExtendZoneScale)

function showAutoMapToast(msg) {
  autoMapToast.value = msg
  if (autoMapToastTimer) clearTimeout(autoMapToastTimer)
  autoMapToastTimer = setTimeout(() => { autoMapToast.value = '' }, 3500)
}

// Viewbox-koordinaten (SVG-meter) som ligger midt på skjermen akkurat nå.
// Invers av forward-transformen i applyNameLOD/panTo: SVG fyller wrapperen med
// preserveAspectRatio="xMidYMid meet", deretter M = T(tx,ty)∘R(rot)∘S(s).
function visibleCenterSvg() {
  const m = meta.value
  const wrap = wrapperRef.value?.getBoundingClientRect()
  if (!m || !wrap || !wrap.width || !wrap.height) return null
  const w = wrap.width, h = wrap.height
  const fit = Math.min(w / m.widthM, h / m.heightM)
  const offX = (w - m.widthM * fit) / 2
  const offY = (h - m.heightM * fit) / 2
  const s = scale.value || 1
  const rot = (rotation.value || 0) * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const tx = translateX.value, ty = translateY.value
  // Skjermsenter (wrapper-lokalt). Løs (X,Y) = T + s·R·(px,py) for (px,py),
  // deretter trekk fra letterbox-offset / del på fit for viewBox-koordinat.
  const A = (w / 2 - tx) / s
  const B = (h / 2 - ty) / s
  const px = A * cos + B * sin
  const py = -A * sin + B * cos
  return { x: (px - offX) / fit, y: (py - offY) / fit }
}

// «Gjør aktiv»-deteksjon: når skjermsenteret glir inn på en nabo-flis (utenfor
// aktiv flis, inni en spøkelses-rect) eksponerer vi den som `activatableTile`.
// v11.0.34: ingen manuell knapp lenger — flisa under senter auto-promoteres til
// aktiv flis etter litt ro (AUTO_PROMOTE_MS). Gated mot måling/annotering/spill/
// drawer via autoMapModeBusy, og promoteTile er sømløs (ingen spinner, beholder
// zoom/posisjon), så byttet er usynlig for brukeren — det holder bare «aktiv
// flis = den du faktisk ser på», som videre utvidelse (kant-soner) refererer til.
const activatableTile = ref(null)   // { id, x, y, w, h, isAuto } eller null
let activatableTimer = null
let autoPromoteTimer = null
const AUTO_PROMOTE_MS = 1500
function clearAutoPromote() {
  if (autoPromoteTimer) { clearTimeout(autoPromoteTimer); autoPromoteTimer = null }
}
function scheduleActivatableCheck() {
  if (activatableTimer) clearTimeout(activatableTimer)
  clearAutoPromote()   // bevegelse nullstiller ro-telleren for auto-promotering
  activatableTimer = setTimeout(() => {
    if (isGesturing && isGesturing.value) { scheduleActivatableCheck(); return }
    updateActivatableTile()
  }, 250)
}
function updateActivatableTile() {
  clearAutoPromote()
  if (!ghostRects.value.length || autoMapModeBusy() || buildingOnTheFly.value || fillingInDetails.value) {
    activatableTile.value = null
    return
  }
  const m = meta.value
  const c = visibleCenterSvg()
  if (!m || !c) { activatableTile.value = null; return }
  // Fortsatt på aktiv flis → ingen kandidat.
  if (c.x >= 0 && c.x <= m.widthM && c.y >= 0 && c.y <= m.heightM) {
    activatableTile.value = null
    return
  }
  activatableTile.value = ghostRects.value.find(
    r => c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h
  ) ?? null
  // Kandidat funnet og senteret står i ro → auto-promoter etter en kort dvale.
  if (activatableTile.value) {
    autoPromoteTimer = setTimeout(maybeAutoPromote, AUTO_PROMOTE_MS)
  }
}
// Promoter flisa under senter til aktiv, men kun hvis den fortsatt er gyldig når
// dvale-timeren fyrer (brukeren kan ha pannet/zoomet videre i mellomtiden).
function maybeAutoPromote() {
  autoPromoteTimer = null
  const g = activatableTile.value
  if (!g) return
  if (autoMapModeBusy() || buildingOnTheFly.value || fillingInDetails.value) return
  if (isGesturing && isGesturing.value) { autoPromoteTimer = setTimeout(maybeAutoPromote, AUTO_PROMOTE_MS); return }
  const c = visibleCenterSvg()
  if (!c) return
  if (c.x >= g.x && c.x <= g.x + g.w && c.y >= g.y && c.y <= g.y + g.h) {
    promoteTile(g, c)
  }
}
watch([scale, translateX, translateY, rotation], scheduleActivatableCheck)

// Felles gate: ikke kjør auto-kart-logikk når et annet modus eier UI-en
// (måling, annotering, søk, åpen drawer) — da er skjermsenteret dekket
// eller irrelevant.
function autoMapModeBusy() {
  return annot.isAnnotateMode.value ||
         measureMode.value || sti.active.value || searchOpen.value || drawerCoversCanvas.value
}

// Bygge-parametre for en ny flis sentrert på et SVG-punkt (samme størrelse +
// ekvidistanse som dagens kart). Brukes av kant-sone-utvidelsen.
function autoMapBuildOpts(centerSvg) {
  const m = meta.value
  const { lat, lon } = svgToWgs84(centerSvg.x, centerSvg.y, m)
  const stamp = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })
  return {
    center: { lat, lon, name: 'Utvidelse' },
    halfKm: +(m.widthM / 2000).toFixed(3),
    // Arv den aktive flisas aspekt (høyde/bredde) så nabo-flisa får NØYAKTIG
    // samme dimensjoner → mosaikken flukter sømløst uansett om flisa er A-format
    // (v10.1.23) eller eldre skjerm-format. Uten dette ville en ny flis falt
    // tilbake til viewportAspect() og fått feil høyde → glipper i mosaikken.
    aspect: +(m.heightM / m.widthM).toFixed(5),
    equidistanceM: m.equidistance ?? 20,
    navn: `Tur ${stamp}`,
    isAuto: true,   // markér som auto-flis → inngår i tileCache (kappes, ikke brukerkart)
  }
}

// ── Manuell kart-utvidelse (kant-soner) ─────────────────────────────────────
// 8 klikkbare kant-soner utvider HELE det (firkantede) bruttokartet i valgt
// retning, så formatet alltid forblir rektangulært: en kardinal-knapp (N/S/Ø/V)
// bygger en hel rad/kolonne langs den siden, en diagonal (NV/NØ/SV/SØ) bygger ny
// rad + ny kolonne + hjørne (vokser begge dimensjoner med 1). Allerede-bygde
// fliser hoppes over (centerOverExistingTile), så man betaler kun for det som
// mangler. Sentrum flyttes til grensen/hjørnet; zoom beholdes. Gjenbruker
// mosaikken: buildMapFromCenter (isAuto) + renderGhostTiles.
const EXTEND_DIR_WORD = {
  N: 'nord', S: 'sør', E: 'øst', W: 'vest',
  NE: 'nordøst', NW: 'nordvest', SE: 'sørøst', SW: 'sørvest',
}

// Geometri for en kant-sone i aktiv-flisas SVG-meter-rom, basert på YTTERGRENSA
// til hele bruttokartet (aktiv flis ∪ alle nabofliser). Returnerer senter for hver
// nye flis som trengs for å holde bruttoen rektangulær + pan-punktet (grense-midt
// for kardinal, hjørne for diagonal). SVG-y vokser nedover → nord = mindre y.
function extendMapGeometry(direction) {
  const m = meta.value
  if (!m) return null
  const W = m.widthM, H = m.heightM
  const b = extendZonesBounds()   // { minX, minY, maxX, maxY } — bruttoens union
  const e = 1                     // innover-nudge i meter
  const cols = Math.max(1, Math.round((b.maxX - b.minX) / W))
  const rows = Math.max(1, Math.round((b.maxY - b.minY) / H))
  // En vertikal kolonne (rows fliser) med venstrekant ved xLeft.
  const colAt = (xLeft) => Array.from({ length: rows },
    (_, r) => ({ x: xLeft + W / 2, y: b.minY + (r + 0.5) * H }))
  // En horisontal rad (cols fliser) med toppkant ved yTop.
  const rowAt = (yTop) => Array.from({ length: cols },
    (_, c) => ({ x: b.minX + (c + 0.5) * W, y: yTop + H / 2 }))
  const midX = (b.minX + b.maxX) / 2, midY = (b.minY + b.maxY) / 2
  let neighborCenters, panPoint
  switch (direction) {
    case 'N': neighborCenters = rowAt(b.minY - H); panPoint = { x: midX, y: b.minY + e }; break
    case 'S': neighborCenters = rowAt(b.maxY); panPoint = { x: midX, y: b.maxY - e }; break
    case 'E': neighborCenters = colAt(b.maxX); panPoint = { x: b.maxX - e, y: midY }; break
    case 'W': neighborCenters = colAt(b.minX - W); panPoint = { x: b.minX + e, y: midY }; break
    case 'NE': neighborCenters = [...colAt(b.maxX), ...rowAt(b.minY - H), { x: b.maxX + W / 2, y: b.minY - H / 2 }]; panPoint = { x: b.maxX - e, y: b.minY + e }; break
    case 'NW': neighborCenters = [...colAt(b.minX - W), ...rowAt(b.minY - H), { x: b.minX - W / 2, y: b.minY - H / 2 }]; panPoint = { x: b.minX + e, y: b.minY + e }; break
    case 'SE': neighborCenters = [...colAt(b.maxX), ...rowAt(b.maxY), { x: b.maxX + W / 2, y: b.maxY + H / 2 }]; panPoint = { x: b.maxX - e, y: b.maxY - e }; break
    case 'SW': neighborCenters = [...colAt(b.minX - W), ...rowAt(b.maxY), { x: b.minX - W / 2, y: b.maxY + H / 2 }]; panPoint = { x: b.minX + e, y: b.maxY - e }; break
    default: return null
  }
  // Autoritativ UTM-bboks per nabo, utledet med eksakt heltalls-offset fra aktiv
  // flis' (allerede rutenett-snappede) UTM-extent. Hver senter-celle har topp-
  // venstre (c.x - W/2, c.y - H/2) i aktiv SVG-meter-rom; SVG-y vokser nedover =
  // UTM-nord nedover, så maxN speiles om aktiv maxN. Siden b.minX/b.minY er
  // heltalls-multipla av W/H fra aktiv origo, lander hver nabo bit-eksakt på
  // aktiv-gitteret → mosaikken flukter uten søm (buildMapFromCenter bruker denne
  // direkte, ingen re-snapping). Avrund til hele meter mot float-rest.
  const neighborBboxes = neighborCenters.map((c) => {
    const sx = c.x - W / 2, sy = c.y - H / 2
    const minE = Math.round(m.minE + sx)
    const maxN = Math.round(m.maxN - sy)
    return { minE, maxE: minE + Math.round(W), minN: maxN - Math.round(H), maxN }
  })
  return { neighborCenters, neighborBboxes, panPoint }
}

// Ville en ny flis sentrert i `c` (samme størrelse som aktiv flis)
// vesentlig duplisere en spøkelses-flis vi allerede har? I så fall skal vi IKKE
// bygge nytt — man «scroller tilbake» til en flis vi har (steg 3 promoterer den
// til full detalj). Returnerer true hvis overlapp med en spøkelse er stor nok.
function centerOverExistingTile(c, m) {
  if (!ghostRects.value.length) return false
  const newRect = { x: c.x - m.widthM / 2, y: c.y - m.heightM / 2, w: m.widthM, h: m.heightM }
  return ghostRects.value.some(g => rectOverlapFraction(newRect, g) > GHOST_TRIGGER_SUPPRESS_FRAC)
}

// Gjør spøkelses-flisa `g` til aktiv flis (eksplisitt «Gjør dette til hovedkart»).
// Bytter via router (oppdaterer mapId → annoteringer, spor, DEM bindes korrekt for
// den nye flisa). promoteView i init-prefs lar loadMap panne slik at samme
// geografiske punkt blir liggende under skjermsenter etter skiftet, og loadMap
// hopper over full-skjerm-loaderen for promoteringer (peek på promoteView-pref)
// → sømløst bytte, ingen spinner.
function promoteTile(g, c) {
  const centerG = { x: c.x - g.x, y: c.y - g.y }   // c uttrykt i g's eget meter-rom
  try {
    sessionStorage.setItem(`mapview-init-prefs:${g.id}`, JSON.stringify({
      theme: currentTheme.value,
      layers: Array.from(visibleLayers.value),
      autoStartGps: userPos.isWatching,
      isAutoMap: !!g.isAuto,
      promoteView: { x: centerG.x, y: centerG.y, scale: scale.value, rotation: rotation.value },
    }))
  } catch { /* noop */ }
  activatableTile.value = null
  router.replace({ name: 'kart-vis', params: { id: g.id } })
}

// Manuell kant-sone-utvidelse. Navigerer IKKE — det aktive kartet beholdes, de
// nye flisene vises som fullopake mosaikk-naboer og vi panorerer sentrum til
// grensen/hjørnet med BEHOLDT zoom. Derfor rydder vi loader/state selv i finally.
let extendingMap = false
async function extendMap(direction) {
  if (extendingMap || buildingOnTheFly.value || fillingInDetails.value) return
  if (autoMapModeBusy()) return
  const m = meta.value
  if (!m) return
  const geom = extendMapGeometry(direction)
  if (!geom) return
  // Offline-gate: bygging krever nett (OSM Overpass + Kartverket WCS).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!autoMapOfflineNotified) {
      autoMapOfflineNotified = true
      showAutoMapToast('Offline — kan ikke lage nytt utsnitt')
    }
    return
  }
  // Hopp over naboer vi allerede har en (rutenett-flukta) flis for — da gir en
  // ny flis på samme senter ≈100 % overlapp med en eksisterende spøkelses-flis.
  const toBuild = geom.neighborCenters
    .map((center, i) => ({ center, utmBbox: geom.neighborBboxes[i] }))
    .filter(({ center }) => !centerOverExistingTile(center, m))
  if (!toBuild.length) {
    panTo(geom.panPoint.x, geom.panPoint.y, {
      vbWidth: m.widthM, vbHeight: m.heightM,
      targetScale: scale.value, keepRotation: true,
    })
    showAutoMapToast('Allerede bygd — flytter dit')
    return
  }
  extendingMap = true
  autoMapArmed = false
  buildingOnTheFly.value = true
  buildingProgress.value = 'Forbereder …'
  closeDrawer()
  closeSearch()
  const builtIds = []
  try {
    for (let i = 0; i < toBuild.length; i++) {
      const prefix = toBuild.length > 1 ? `Utsnitt ${i + 1}/${toBuild.length}` : ''
      buildingProgress.value = toBuild.length > 1
        ? `Bygger utsnitt ${i + 1} av ${toBuild.length} …`
        : 'Bygger nytt utsnitt …'
      const { id } = await buildMapFromCenter({
        ...autoMapBuildOpts(toBuild[i].center),
        utmBbox: toBuild[i].utmBbox,   // eksakt ±W/±H-offset → flukter med aktiv flis
        terrainFirst: false,   // full flis med en gang
        onProgress: (msg) => {
          buildingProgress.value = prefix ? `${prefix}: ${msg}` : msg
        },
      })
      if (id) builtIds.push(id)
    }
    // Tegn de nye flisene som mosaikk-naboer (fullopake, full detalj) og utvid
    // pan-grensa til mosaikken (renderGhostTiles → clampPan), så panTo ikke
    // klampes tilbake til aktiv-flisas grenser.
    await renderGhostTiles()
    await nextTick()
    panTo(geom.panPoint.x, geom.panPoint.y, {
      vbWidth: m.widthM, vbHeight: m.heightM,
      targetScale: scale.value, keepRotation: true,
    })
    // Kapp auto-flis-cachen til bruker-valgt grense, beskytt aktiv flis + det vi
    // nettopp bygde.
    try {
      const ll = svgToWgs84(geom.panPoint.x, geom.panPoint.y, m)
      pruneAutoTiles({ center: { lat: ll.lat, lon: ll.lon }, max: maxTiles.value, protectIds: [mapId.value, ...builtIds] })
        .then(() => { void refreshAutoTileCount() })
        .catch(() => {})
    } catch { /* svgToWgs84 feilet → hopp over pruning */ }
    showAutoMapToast(`Utvidet kartet mot ${EXTEND_DIR_WORD[direction]}`)
  } catch (e) {
    console.error('Kant-sone-utvidelse feilet:', e)
    showAutoMapToast('Kunne ikke lage nytt utsnitt')
  } finally {
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    autoMapArmed = true
    extendingMap = false
  }
}

// Slå opp symbolKey + label for en lagret annotering. Faller tilbake til
// råverdien fra entry hvis isomCode ikke matcher noen kjent type (skulle
// ikke skje, men beskytter mot kart-data som er lagret med en eldre
// ANNOTATION_SYMBOLS-liste).
function labelForAnnotation(a) {
  const sym = ANNOTATION_SYMBOLS.find(s => s.code === a.isomCode)
  return {
    symbolKey: sym?.symbolKey ?? '',
    label: sym?.label ?? `Kode ${a.isomCode}`,
  }
}

// Print- / eksport-handlers.
function mapSvgMarkupForExport() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return ''
  // Eksport/print = det OPPRINNELIGE kartet (én A-format-flis), ikke mosaikken.
  // Klon og fjern spøkelses-naboflisene (#ghost-tiles) før serialisering så
  // utskriften blir det print-tilpassede utsnittet brukeren genererte — med
  // viewBox/print-mm fra den aktive flisa alene. (user-layer m.fl. strippes av
  // printExport.stripRuntimeOverlays.)
  const clone = svg.cloneNode(true)
  clone.querySelector('#ghost-tiles')?.remove()
  clone.querySelector('#extend-zones')?.remove()   // kant-soner er kun runtime-UI
  return clone.outerHTML
}
// Hvilken eksport som kjører nå ('' | 'svg' | 'png' | 'pdf' | 'print'). Brukes
// til å vise spinner på den aktive knappen og deaktivere de andre — PNG/PDF
// bruker noen sekunder (canvas-render + lazy jsPDF), så uten dette virket appen
// «død» mellom trykk og nedlasting. nextTick før det tunge arbeidet så spinneren
// rekker å males (gjelder også den synkrone SVG-blob-en).
const exporting = ref('')
const filenameBase = () => mapTitle.value.replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase()
async function runExport(type, fn) {
  if (exporting.value) return
  const m = mapSvgMarkupForExport()
  if (!m) return
  exporting.value = type
  try {
    await nextTick()
    await fn(m)
  } catch (e) {
    console.error('Eksport feilet:', e)
    autoMapToast.value = 'Eksport feilet — prøv igjen'
    setTimeout(() => { if (autoMapToast.value.startsWith('Eksport')) autoMapToast.value = '' }, 3000)
  } finally {
    exporting.value = ''
  }
}
function onExportSvg() {
  runExport('svg', (m) => exportSvgFile(m, `${filenameBase()}.svg`))
}
function onExportPng() {
  runExport('png', (m) => exportPngFile(m, `${filenameBase()}.png`, { dpi: 300 }))
}
function onExportPdf() {
  runExport('pdf', (m) => exportPdfFile(m, `${filenameBase()}.pdf`, { dpi: 300 }))
}
function onPrint() {
  runExport('print', (m) => printDocument(m, { title: mapTitle.value }))
}

// Innebygde kart hentes som rå SVG-fil. Eldre service workers serverte denne
// via stale-while-revalidate og kunne returnere en utdatert/avkuttet kopi på
// første last → DOMParser ga «Ugyldig SVG», mens en refresh / «Prøv igjen»
// traff den revaliderte (friske) kopien. Den nye SW-en henter maps/* network-
// first, men en allerede-aktiv gammel SW i klienten retter seg ikke før den
// byttes ut. For å være robust UANSETT SW-tilstand: valider at svaret faktisk
// parser som SVG med data-meta, og prøv på nytt med cache-bust (query-param
// som hverken SW-cache eller HTTP-cache matcher) før vi gir opp.
async function fetchBuiltinSvg(file) {
  const baseUrl = `${import.meta.env.BASE_URL}maps/${file}`
  let lastErr = null
  for (let attempt = 0; attempt < 3; attempt++) {
    // Cache-bust f.o.m. forsøk 2 — tvinger forbi en gammel SWR-service-worker.
    const url = attempt === 0 ? baseUrl : `${baseUrl}?v=${Date.now()}`
    try {
      const res = await fetch(url, { cache: 'reload' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
      const root = doc.documentElement
      const bad = !root || root.nodeName === 'parsererror' || root.querySelector('parsererror')
      if (!bad && root.getAttribute('data-meta')) return text
      lastErr = new Error('Ugyldig SVG')
    } catch (e) {
      lastErr = e
    }
    // Kort backoff — gir en bakgrunns-revalidering tid til å fullføre.
    if (attempt < 2) await new Promise((r) => setTimeout(r, 150))
  }
  throw lastErr ?? new Error('Ugyldig SVG')
}

// Peek (uten å konsumere) om det finnes en promoteView-pref for `id` — da er
// dette en «gjør aktiv»-promotering, og vi hopper over full-skjerm-loaderen så
// byttet føles sømløst (flisa er allerede bygd/lagret).
function hasPromotePref(id) {
  try {
    const raw = sessionStorage.getItem(`mapview-init-prefs:${id}`)
    return !!raw && !!JSON.parse(raw)?.promoteView
  } catch { return false }
}

// Generasjonsteller for utsatte etter-paint-pass: en silent re-load (terreng-
// finalize) kan lande mens et utsatt pass venter — da skal det gamle passet
// droppes i stedet for å kjøre mot en utbyttet SVG-DOM.
let loadGeneration = 0

async function loadMap({ silent = false } = {}) {
  // silent = re-render av samme kart (terreng → full) uten full-skjerm-loader;
  // beholder zoom/pan og hopper over init-prefs (alt konsumert ved første last).
  // Promotering (gjør-aktiv): hopp også over loaderen, men prefs leses fortsatt.
  const gen = ++loadGeneration
  const isPromote = !silent && hasPromotePref(route.params.id ?? 'vardasen')
  if (!silent && !isPromote) loading.value = true
  loadError.value = null
  try {
    const id = route.params.id ?? 'vardasen'
    let text
    let demBytes = 0
    let stored = null
    if (BUILTIN[id]) {
      mapTitle.value = BUILTIN[id].navn
      text = await fetchBuiltinSvg(BUILTIN[id].file)
    } else {
      stored = await loadStoredMap(id)
      if (!stored) throw new Error('Kart ikke funnet i lagring')
      mapTitle.value = stored.navn
      text = stored.svg
      // Hent DEM hvis lagret (brukes av relieff og høydeprofil)
      if (stored.dem) {
        try { storedDem.value = unpackDem(stored.dem) } catch { storedDem.value = null }
        demBytes = stored.dem.buffer?.byteLength ?? 0
      }
    }
    // Datamengde for dette kartet (vises i drawer-ens Debug + long-press-arket).
    // SVG-en er hoved-payloaden; DEM-en lagres separat (pakket Float32-buffer).
    // text.length ≈ bytes (ASCII-dominert SVG, samme konvensjon som mapStorage) —
    // slipper å allokere en Blob-kopi av hele strengen på åpne-stien.
    mapDataSize.value = { svgBytes: text.length, demBytes }
    void refreshAutoTileCount()
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'image/svg+xml')
    const root = doc.documentElement
    if (root.nodeName === 'parsererror' || root.querySelector('parsererror')) {
      throw new Error('Ugyldig SVG')
    }
    const metaRaw = root.getAttribute('data-meta')
    if (!metaRaw) throw new Error('Mangler data-meta i SVG')
    const m = JSON.parse(metaRaw)
    meta.value = {
      minE: m.utmBbox.minE,
      minN: m.utmBbox.minN,
      maxE: m.utmBbox.maxE,
      maxN: m.utmBbox.maxN,
      widthM: m.widthM,
      heightM: m.heightM,
      bbox: m.bbox,
      equidistance: m.equidistance ?? null,
      isomVersion: m.isomVersion ?? null,
      scaleDenom: m.scaleDenom ?? 10000,
      source: m.source,
      demSource: m.demSource ?? null,
      demResolutionM: m.demResolutionM ?? null, // grid-oppløsning (m) — diagnostikk for kyst-presisjon
      depthSource: m.depthSource ?? null, // 'sjokart' | 'dem-estimat' | 'ingen' | null (eldre kart)
      contoursSkipped: m.contoursSkipped ?? null,
      coastal: m.coastal ?? null,        // true=kyst, false=innland, null=ukjent (eldre kart)
      sjokartStatus: m.sjokartStatus ?? null, // utfall av Sjøkart-WFS ved bygging (Utvikler-fanen)
    }
    // Forbruk init-prefs fra auto-kart / on-the-fly (tema + synlige lag, GPS,
    // auto-modus, bevart zoom/rotasjon). Én gang per ny mapId.
    let pendingAutoStartGps = false
    let pendingRestoreView = null   // {scale, rotation} — bevar visning over hopp
    let pendingPromoteView = null   // {x, y, scale, rotation} — mosaikk-promotering
    let pendingMovedToast = false
    let pendingResumeRecording = false   // gjenoppta GPS-opptak etter auto-kart-bytte
    try {
      const k = `mapview-init-prefs:${mapId.value}`
      const raw = sessionStorage.getItem(k)
      if (raw) {
        sessionStorage.removeItem(k)
        const prefs = JSON.parse(raw)
        if (prefs.theme) currentTheme.value = prefs.theme
        if (Array.isArray(prefs.layers)) visibleLayers.value = new Set(prefs.layers)
        if (prefs.autoStartGps) pendingAutoStartGps = true
        if (prefs.resumeRecording) pendingResumeRecording = true
        // «Gjør aktiv»-promotering setter isAutoMap eksplisitt (true/false), så å
        // promotere til opprinnelig kart nullstiller flagget korrekt.
        if (prefs.promoteView) currentMapIsAuto.value = !!prefs.isAutoMap
        else if (prefs.isAutoMap) currentMapIsAuto.value = true
        if (prefs.promoteView && typeof prefs.promoteView.x === 'number') {
          pendingPromoteView = prefs.promoteView
        } else if (typeof prefs.scale === 'number' || typeof prefs.rotation === 'number') {
          pendingRestoreView = { scale: prefs.scale ?? 1, rotation: prefs.rotation ?? 0 }
        }
        if (prefs.movedCenterToast) pendingMovedToast = true
      }
    } catch { /* noop */ }
    // Fersk-kart-baseline: garanter «litt kontur + litt relieff» på nye kart så
    // de ikke blir blast hvis relieff er globalt skrudd av. Consume-on-read.
    let isFreshBuild = false
    if (!silent) {
      try {
        const fk = `mapview-freshlook:${mapId.value}`
        if (sessionStorage.getItem(fk)) {
          sessionStorage.removeItem(fk)
          isFreshBuild = true
          if (reliefStepIndex.value === 0) reliefStepIndex.value = FRESH_RELIEF_MIN_IDX
          if (!visibleLayers.value.has('kontur')) {
            visibleLayers.value = new Set(visibleLayers.value).add('kontur')
          }
        }
      } catch { /* noop */ }
    }
    // Full trinnvis avsløring kun der den har en jobb: ferske bygg (masker den
    // første tunge painten) og silent finalize-swaps (masker DOM-byttet). En
    // vanlig åpning av et allerede-bygget kart får en kort enkelt-fade.
    setupHostSvg(root, { staged: isFreshBuild || silent })
    loading.value = false
    await nextTick()
    applyLayerVisibility()
    applyDepthLayer()              // dybde-toggle (default av) — kun synlig om Sjøkart-dybde finnes
    applyTheme()
    applyPurpleTrails()            // Utvikler-test: lilla stier oppå tema-fargen
    applyStrokeScale()
    applyStrokeOverrides()         // per-element strek (Strek-FAB-panelet)
    applyLabelScale()
    applyLabelFonts()
    userPos.recompute()
    // Auto-start GPS når init-prefs ber om det (kommer fra on-the-fly-
    // snarveien i MapHomeView, der bruker ikke har annen vei til å slå
    // GPS på). Trygt å kalle flere ganger — start() er idempotent.
    if (pendingAutoStartGps) userPos.start()
    await annot.load(stored)
    renderAnnotations()
    await tracker.load(stored)
    renderTracks()
    // Gjenoppta GPS-opptak etter et auto-kart-bytte. userPos.start() er allerede
    // kalt over (pendingAutoStartGps) og setter isWatching synkront, så
    // startRecording() lykkes. Sporet fortsetter som et nytt segment på denne flisa.
    if (pendingResumeRecording && userPos.isWatching) tracker.startRecording()
    applyUprightLabels()
    renderMeasure()
    restoreProximityAlert()
    renderProximityTarget()
    // Hill-shading (med innbakt knaus-relieff) er default ON — fire-and-forget.
    // Lazy DEM-load skjer internt hvis nødvendig (Vardåsen).
    applyHillshade()
    // Flerspråklige navn → vis kun norsk (eller fullt, etter innstilling).
    // Må kjøre FØR søkeindeksen bygges: applyNameLanguage stempler det fulle
    // navnet i data-name-full, som useMapSearch indekserer (alle språk søkbare).
    applyNameLanguage()
    // De getBBox-tunge indeks-passene (søk, navn-LOD, culling) utsettes til
    // etter første paint — de bestemmer ikke hva første frame viser, men
    // tvang tidligere synkron layout av hele multi-MB-SVG-en før kartet kom
    // på skjerm. Labels holdes skjult av .lod-pending til passet er kjørt.
    scheduleDeferredMapPasses(gen)
    if (pendingPromoteView) {
      // «Gjør aktiv»-promotering: pan slik at det samme geografiske punktet (uttrykt
      // i den nye flisas meter-rom) blir liggende under skjermsenter — sømløst,
      // ingen hopp i forhold til der brukeren scrollet.
      rotation.value = pendingPromoteView.rotation ?? 0
      await nextTick()
      panTo(pendingPromoteView.x, pendingPromoteView.y, {
        vbWidth: meta.value.widthM, vbHeight: meta.value.heightM,
        targetScale: pendingPromoteView.scale ?? 1, keepRotation: true,
      })
    } else if (pendingRestoreView) {
      rotation.value = pendingRestoreView.rotation
      await nextTick()
      panTo(meta.value.widthM / 2, meta.value.heightM / 2, {
        vbWidth: meta.value.widthM, vbHeight: meta.value.heightM,
        targetScale: pendingRestoreView.scale, keepRotation: true,
      })
    }
    autoMapArmed = true
    if (pendingMovedToast) showAutoMapToast('Flyttet sentrum hit')
    // Mosaikk: tegn nabo-fliser så man kan utvide/gjøre dem aktive.
    // Async + fail-safe; setupHostSvg har tømt evt. gamle spøkelser.
    void renderGhostTiles()
    // Kant-soner (manuell utvidelse) — tegnes inn i den ferske SVG-en.
    renderExtendZones()
    // Terreng-først: hvis dette kartet ble vist som terreng-skjelett, konsumér
    // finalize-promisen og re-render (stille) når full SVG med OSM er klar.
    if (!silent) consumeTerrainFinalize()
  } catch (e) {
    loading.value = false
    loadError.value = e.message ?? 'Kunne ikke laste kart'
  }
}

// Vent på terreng-først-finalize (full bygging i bakgrunnen) og re-render når
// klar. Beholder gjeldende zoom/pan (silent re-load). Tåler at brukeren har
// navigert videre (componentAlive-sjekk).
function consumeTerrainFinalize() {
  const fin = consumeMapFinalize(mapId.value)
  if (!fin) return
  fillingInDetails.value = true
  detailsFailed.value = false
  fin.then(() => {
    if (!componentAlive) return
    return loadMap({ silent: true })
  }).catch(() => {
    // Bakgrunns-byggingen feilet (oftest Overpass nede). Vis en lesbar banner
    // med en «Prøv på nytt»-knapp i stedet for en teknisk toast.
    if (componentAlive) detailsFailed.value = true
  }).finally(() => {
    if (componentAlive) fillingInDetails.value = false
  })
}

// «Prøv på nytt» fra detalj-feil-banneret: bygg kartet på nytt fra samme senter
// (samme størrelse/ekvidistanse/navn), erstatt det delvise kartet.
async function retryMapDetails() {
  if (!meta.value || buildingOnTheFly.value) return
  detailsFailed.value = false
  const prevId = mapId.value
  const centerSvg = { x: meta.value.widthM / 2, y: meta.value.heightM / 2 }
  buildingOnTheFly.value = true
  buildingProgress.value = 'Prøver på nytt …'
  try {
    const { lat, lon } = svgToWgs84(centerSvg.x, centerSvg.y, meta.value)
    const { id } = await buildMapFromCenter({
      center: { lat, lon, name: mapTitle.value },
      halfKm: +(meta.value.widthM / 2000).toFixed(3),
      // Reproduser SAMME utsnitt — behold flisas aspekt (ellers falt høyden
      // tilbake til viewportAspect() og «prøv på nytt» ga et annet utsnitt).
      aspect: +(meta.value.heightM / meta.value.widthM).toFixed(5),
      equidistanceM: meta.value.equidistance ?? 20,
      navn: mapTitle.value,
      terrainFirst: true,
      isAuto: currentMapIsAuto.value,
      onProgress: (msg) => { buildingProgress.value = msg },
    })
    try {
      sessionStorage.setItem(`mapview-init-prefs:${id}`, JSON.stringify({
        theme: currentTheme.value,
        layers: Array.from(visibleLayers.value),
        autoStartGps: userPos.isWatching,
        isAutoMap: currentMapIsAuto.value,
        scale: scale.value,
        rotation: rotation.value,
      }))
    } catch { /* noop */ }
    if (prevId && prevId !== 'vardasen') { try { await deleteStoredMap(prevId) } catch { /* noop */ } }
    router.replace({ name: 'kart-vis', params: { id } })
  } catch (e) {
    console.error('Regenerering feilet:', e)
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    detailsFailed.value = true
  }
}

// Utsatte etter-paint-pass (søkeindeks, POI-telling, navn-LOD, cull-indeks,
// ?hl=-highlight). Dobbel-rAF garanterer at første frame av kartet er malt før
// getBBox-stormene tvinger layout. Generasjonstelleren dropper passet hvis en
// nyere loadMap (silent finalize-swap, flis-bytte) har byttet ut SVG-en.
function scheduleDeferredMapPasses(gen) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (gen !== loadGeneration || !componentAlive) return
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    // Bygg søkeindeks fra ferdig-loaded SVG-DOM (getBBox()+getCTM() krever
    // attached element).
    mapSearch.rebuild(svg)
    // Tell POI pr type så «nærmeste»-snarveiene i PUNKT-arket kan gråes ut
    // når kartet mangler typen (f.eks. ingen holdeplass).
    computePoiAvailability()
    // Kjør navn-LOD nå som indeksen finnes (skjuler overflødige navn i tette
    // utsnitt). Videre på zoom/pan via watch.
    applyNameLOD()
    // Viewport-culling: bygg rbush-indeks fra fersk SVG-DOM og kjør første
    // pass (force — ingen prevState å hysterese mot).
    buildCullDomIndex()
    applyViewportCull(true)
    // Auto-highlight hvis ?hl=<navn> i URL (delings-flow).
    maybeHighlightFromQuery()
    svg.classList.remove('lod-pending')
  }))
}

// Trinnvis kart-avsløring (v11.0.45). Struktur fades inn først, så tekstur +
// labels et hakk etter — gir en «levende» ankomst i stedet for én tung paint.
// Hopper helt over (vis straks) ved prefers-reduced-motion.
const prefersReducedMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
})()
function startMapReveal(svg, staged) {
  if (prefersReducedMotion) return
  if (!staged) {
    // Allerede-bygget kart: kort enkelt-fade i stedet for full to-trinns
    // avsløring — labels maskeres uansett av .lod-pending til LOD-passet.
    svg.classList.add('cb-reveal')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      svg.classList.add('cb-reveal-quick', 'cb-revealing')
      svg.classList.remove('cb-reveal')
      setTimeout(() => svg.classList.remove('cb-revealing', 'cb-reveal-quick'), 200)
    }))
    return
  }
  svg.classList.add('cb-reveal', 'cb-reveal-late')
  requestAnimationFrame(() => requestAnimationFrame(() => {
    svg.classList.add('cb-revealing')      // skru på opacity-transition
    svg.classList.remove('cb-reveal')      // struktur fader 0 → 1
    setTimeout(() => svg.classList.remove('cb-reveal-late'), 130)  // tekstur/labels etter
    setTimeout(() => svg.classList.remove('cb-revealing'), 540)    // rydd transitions
  }))
}

function setupHostSvg(sourceRoot, { staged = true } = {}) {
  const ns = 'http://www.w3.org/2000/svg'
  const host = svgHostRef.value
  host.replaceChildren()
  // Ny SVG-DOM → element-referansene i culling-indeksen er foreldede.
  // Indeksen bygges på nytt etter at lasting er ferdig (buildCullDomIndex).
  resetViewportCull()
  // Samme for navn-LOD-statens el-referanser og boks-cache: tømmes HER (ikke
  // i det utsatte passet) så stale refs aldri overlever et SVG-bytte.
  forcedVisibleNameEls.clear()
  labelBoxCache.clear()
  prevShownNames = new Set()
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', sourceRoot.getAttribute('viewBox'))
  svg.setAttribute('xmlns', ns)
  // v8.9.26: xmlns:xlink må deklareres her — hill-shading og dybde-skygge
  // legger til `xlink:href` på <image>-elementer via setAttributeNS, og
  // uten denne deklarasjonen på root får serialisert eksport "Namespace
  // prefix xlink for href on image is not defined" i Chrome (Android).
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  svg.setAttribute('class', 'isom-map')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  // v10.x mosaikk: la innhold utenfor viewBox (spøkelses-nabofliser) vises i
  // stedet for å klippes ved SVG-viewporten. Skjermkanten (kart-flate-wrapperen)
  // klipper fortsatt, og UI-chrome ligger over (høyere z-index).
  svg.style.overflow = 'visible'
  // Kart-innholdet (bakgrunn + vegetasjon + kurver + relieff osv.) adopteres
  // direkte inn i SVG-roten — adoptNode re-homer nodene fra DOMParser-
  // dokumentet uten å kopiere (den gamle cloneNode(true)-loopen traverserte
  // hele multi-MB-treet en gang til). Parse-dokumentet brukes aldri etterpå
  // (ghost tiles re-leser lagret SVG-tekst selv). Overlays (GPS/annotering/
  // spor/måling/søk) appendes ETTERPÅ så de ligger øverst. Relieffet
  // (#hillshade-layer) settes inn foran [data-layer="vann"].
  while (sourceRoot.firstChild) {
    svg.appendChild(document.adoptNode(sourceRoot.firstChild))
  }
  // v10.2.9 (perf): detalj-lagene (data-detail="1": dybdepunkt/dybdekurve)
  // er usynlige på hovedkartet (display:none) men kostet likevel parse,
  // style-recalc og deep-clone ved hver buildDetailInset. Løft dem UT av
  // live-DOM-en og hold dem i en modul-ref — inset-en (eneste konsument)
  // appender kloner derfra i stedet.
  detachedDetailLayers = []
  for (const g of svg.querySelectorAll('[data-detail="1"]')) {
    detachedDetailLayers.push(g)
    g.remove()
  }
  // Tell kulturminne-ikoner (til toggel-badgen). Gjøres her siden SVG-en nå er
  // fullt populert; gamle kart uten laget gir 0.
  kulturminneCount.value = svg.querySelectorAll('[data-kulturminne-id]').length
  const userLayer = document.createElementNS(ns, 'g')
  userLayer.setAttribute('id', 'user-layer')
  // v8.5.2: GPS-laget skal aldri sluke pinch-to-zoom-gester når brukerens
  // finger lander på prikken/ringen.
  userLayer.setAttribute('pointer-events', 'none')
  svg.appendChild(userLayer)
  // Navn-lagene holdes usynlige til det utsatte navn-LOD-passet har kjørt —
  // ellers ville ALLE navn blinke frem i 1–2 frames før decluttering. Dekker
  // også prefers-reduced-motion (der reveal-fade hoppes helt over).
  svg.classList.add('lod-pending')
  host.appendChild(svg)
  // v11.0.45: trinnvis avsløring — strukturen (bakgrunn/vann/kurver/veier) males
  // først, så toner tekstur (vegetasjon/relieff) og labels inn et lite øyeblikk
  // etter. Selv om total tid er lik, leses en trinnvis ankomst som «snappy»
  // mens én blokkerende paint leses som treg. Ren CSS-klasse-sekvens.
  startMapReveal(svg, staged)
  // v8.10.4: SVG-en er ny-bygget her — applikér evt. allerede-aktive
  // perf-klasser (.zoomed-in / .zoom-near / .is-zooming) basert på nåværende
  // state, siden watcheren bare reagerer på endringer.
  applyZoomTierClasses(svg, scale.value)
  if (isGesturing && isGesturing.value) svg.classList.add('is-zooming')
  // Stifinner: nytt kart → avbryt evt. aktiv modus + rydd rute-overlay, og
  // avgjør om kartet har routbare sti-/vei-lag (styrer «Naviger hit»).
  if (sti.active.value) sti.cancel()
  mapHasTrails.value = !!svg.querySelector(
    '[data-iso="501"],[data-iso="502"],[data-iso="503"],[data-iso="504"],[data-iso="505"],[data-iso="506"],[data-iso="507"],[data-iso="509"]'
  )
}


watch(
  () => [userPos.svgX, userPos.svgY, userPos.accuracyM,
         compass.headingDeg, compass.isActive, userPos.headingDeg],
  () => updateUserDot()
)

function updateUserDot() {
  const svg = svgHostRef.value?.querySelector('svg')
  const layer = svg?.querySelector('#user-layer')
  if (!layer) return
  const x = userPos.svgX
  const y = userPos.svgY
  const acc = userPos.accuracyM ?? 30
  // Kjegla peker dit telefonen vender (kompass/magnetometer via DeviceOrientation)
  // når kompasset er aktivt — det er retningen orienteringsbrukeren vil ha, og
  // det virker også stillestående. GPS-kurs (coords.heading) er fallback når
  // kompasset mangler/avvist; den er kun definert i bevegelse og peker dit du
  // er på vei, ikke dit du vender.
  const heading = (compass.isActive && Number.isFinite(compass.headingDeg))
    ? compass.headingDeg
    : userPos.headingDeg
  layer.replaceChildren()
  if (x == null || y == null) return
  const ns = 'http://www.w3.org/2000/svg'

  // Dynamiske skjerm-størrelser. Dot er fast 14 CSS-px, kjegle 60 CSS-px
  // ut fra dot. Accuracy-ringen reflekterer ekte fysisk usikkerhet (i meter)
  // men cappes på ~28 CSS-px radius slik at dårlig GPS (urban / tog / tunnel)
  // ikke språker ringen utover halve skjermen og dømmer kart-innholdet.
  // v8.5.3: stroke-bredder via pxToUserUnits — non-scaling-stroke virker
  // ikke når SVG-en CSS-transformeres av pinch-zoom-wrapperen, så stroke
  // ble fete på høy zoom og det blå fyllet forsvant under den hvite kant-
  // linjen. Nå skaleres bredden eksplisitt på samme måte som radius.
  const dotR = pxToUserUnits(7)         // ~14 CSS-px diameter
  const dotStroke = pxToUserUnits(1.6)  // tynn hvit halo
  const coneR = pxToUserUnits(30)       // ~60 CSS-px ut fra dot
  const minRingR = pxToUserUnits(12)    // ringen blir aldri mindre enn dot+halo
  const maxRingR = pxToUserUnits(28)    // visuelt cap
  const ringR = Math.min(maxRingR, Math.max(minRingR, acc))
  const ringStroke = pxToUserUnits(0.8)

  const ring = document.createElementNS(ns, 'circle')
  ring.setAttribute('cx', x)
  ring.setAttribute('cy', y)
  ring.setAttribute('r', ringR)
  ring.setAttribute('fill', 'rgba(56, 189, 248, 0.10)')
  ring.setAttribute('stroke', 'rgba(56, 189, 248, 0.40)')
  ring.setAttribute('stroke-width', ringStroke)
  layer.appendChild(ring)

  if (Number.isFinite(heading)) {
    const cone = document.createElementNS(ns, 'path')
    const ang = (heading - 90) * Math.PI / 180
    const ang1 = ang - 0.35
    const ang2 = ang + 0.35
    const x1 = x + Math.cos(ang1) * coneR
    const y1 = y + Math.sin(ang1) * coneR
    const x2 = x + Math.cos(ang2) * coneR
    const y2 = y + Math.sin(ang2) * coneR
    cone.setAttribute('d', `M${x},${y} L${x1},${y1} A${coneR},${coneR} 0 0 1 ${x2},${y2} Z`)
    cone.setAttribute('fill', 'rgba(56, 189, 248, 0.35)')
    layer.appendChild(cone)
  }

  const dot = document.createElementNS(ns, 'circle')
  dot.setAttribute('cx', x)
  dot.setAttribute('cy', y)
  dot.setAttribute('r', dotR)
  dot.setAttribute('fill', '#0ea5e9')
  dot.setAttribute('stroke', '#fff')
  dot.setAttribute('stroke-width', dotStroke)
  layer.appendChild(dot)
}

const equidistanceLabel = computed(() => {
  if (!meta.value) return ''
  const eq = meta.value.equidistance
  if (eq) return `Høydekurver pr ${eq} m`
  if (meta.value.contoursSkipped) return 'Høydekurver: kun på innebygde kart'
  return 'Høydekurver ikke tilgjengelig'
})

const wrapperSize = ref({ w: 0, h: 0 })
function measureWrapper() {
  const r = wrapperRef.value?.getBoundingClientRect()
  if (r) wrapperSize.value = { w: r.width, h: r.height }
}

const SCALE_BAR_MAX_PX = 180
const scaleBar = computed(() => {
  if (!meta.value) return { px: 0, label: '', ticks: [] }
  const { w, h } = wrapperSize.value
  if (!w || !h) return { px: 0, label: '', ticks: [] }
  const fit = Math.min(w / meta.value.widthM, h / meta.value.heightM)
  const pxPerMeter = fit * scale.value
  // Dekker hele zoom-spennet: km-verdier holder linjalen synlig når man zoomer
  // langt ut (1000 m ble < 30 px og baren forsvant), og finere meter-verdier
  // når man zoomer langt inn. Største verdi som passer ≤ MAX_PX velges først.
  const candidates = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]
  for (const m of candidates) {
    const px = m * pxPerMeter
    if (px <= SCALE_BAR_MAX_PX && px >= 30) {
      // Lag tikker pr 1/4 av lengden
      const tickStep = m / 4
      const ticks = []
      for (let i = 0; i <= 4; i++) {
        ticks.push({ px: i * px / 4, m: i * tickStep })
      }
      return { px, label: m >= 1000 ? `${m / 1000} km` : `${m} m`, ticks }
    }
  }
  return { px: 0, label: '', ticks: [] }
})

// Tema-applisering: setter CSS-variabler pr ISOM-kode + label på den FELLES
// transform-wrapperen (mapInnerRef) som omslutter både midt-kartet og periferi-
// ringen. CSS custom properties arves ned, så `var(--iso-*-fill)` i BÅDE midt-
// SVG-en og hver lite-flis-SVG resolver mot disse — uten dette rekolorerte bare
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
  applyPurpleTrails()
  const newT = isomCatalog.themes?.[newTheme]
  const oldT = isomCatalog.themes?.[oldTheme]
  if (newT?.autoHideLayers) {
    visibleLayers.value = new Set(['kontur'])
  } else if (oldT?.autoHideLayers) {
    visibleLayers.value = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
  }
  applyLayerVisibility()
  // Tema-bytte endrer relieff-blend-modus → spøkelses-relieffet må re-tones
  // (ny data-URL pr modus). Sjelden operasjon; hillshade-compute er cachet.
  void renderGhostTiles()
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

// v8.5.5: tikker hvert sekund mens GPS er på, så debug-readout (alder
// på siste fix) oppdaterer seg jevnt uten å bero på nye GPS-events.
const gpsNow = ref(Date.now())
let gpsTickTimer = null
function startGpsTick() {
  if (gpsTickTimer) return
  gpsTickTimer = setInterval(() => { gpsNow.value = Date.now() }, 1000)
}
function stopGpsTick() {
  if (gpsTickTimer) { clearInterval(gpsTickTimer); gpsTickTimer = null }
}
watch(() => userPos.isWatching, (on) => on ? startGpsTick() : stopGpsTick())

const gpsDebugLine = computed(() => {
  if (!userPos.isWatching) return ''
  if (userPos.latRaw == null || userPos.lonRaw == null) return 'Venter på fix …'
  const lat = userPos.latRaw.toFixed(6)
  const lon = userPos.lonRaw.toFixed(6)
  const acc = userPos.accuracyM != null ? `±${Math.round(userPos.accuracyM)} m` : '±? m'
  const ageS = Math.max(0, Math.round((gpsNow.value - userPos.lastFixAt) / 1000))
  const src = userPos.lastFixSource === 'poll' ? 'P' : 'W'
  const rej = userPos.rejectedCount ? ` · ${userPos.rejectedCount} avvist` : ''
  return `${lat}, ${lon} · ${acc} · ${ageS}s · ${src}${rej}`
})

// v8.5.6: kopier raw lat/lng som Google Maps-URL. Universelt format —
// blir tappable lenke i meldinger og åpner Maps-appen direkte.
const copyState = ref('idle') // 'idle' | 'copied' | 'failed'
async function copyGpsCoords() {
  if (userPos.latRaw == null || userPos.lonRaw == null) return
  const lat = userPos.latRaw.toFixed(6)
  const lon = userPos.lonRaw.toFixed(6)
  const url = `https://www.google.com/maps?q=${lat},${lon}`
  try {
    await navigator.clipboard.writeText(url)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'failed'
  }
  setTimeout(() => { copyState.value = 'idle' }, 1500)
}

// v8.5.6: førstegangs-tips om «Presis posisjon» (Android 12+). Vi gikk i
// fella selv — `enableHighAccuracy: true` gir 2000 m fallback hvis appen
// kun har «Omtrentlig» lokasjon. Vis i drawer første gang GPS aktiveres,
// dismissible. localStorage husker dismissal på tvers av sesjoner.
const GPS_TIP_KEY = 'lende-gps-tip-seen'
const gpsTipDismissed = ref(false)
try { gpsTipDismissed.value = localStorage.getItem(GPS_TIP_KEY) === '1' } catch {}
const showGpsTip = computed(() => userPos.isWatching && !gpsTipDismissed.value)
function dismissGpsTip() {
  gpsTipDismissed.value = true
  try { localStorage.setItem(GPS_TIP_KEY, '1') } catch {}
}

// v8.5.6: in-map advarsels-banner når accuracy er dårlig (>100m).
// Synlig over kartet uten at brukeren må åpne drawer. Dismissable
// per sesjon — resettes når GPS toggles off→on.
const LOW_ACCURACY_THRESHOLD_M = 100
const lowAccuracyDismissed = ref(false)
const showLowAccuracyBanner = computed(() =>
  userPos.isWatching &&
  userPos.accuracyM != null &&
  userPos.accuracyM > LOW_ACCURACY_THRESHOLD_M &&
  !lowAccuracyDismissed.value &&
  !userPos.error &&
  !userPos.isOutsideMap
)
function dismissLowAccuracy() { lowAccuracyDismissed.value = true }
watch(() => userPos.isWatching, (on) => { if (on) lowAccuracyDismissed.value = false })

// v9.1.2: «Du er utenfor dette kartet» kan dismisses med en X. Resettes
// hver gang brukeren går tilbake innenfor kart-bounds — så hvis hen
// forlater kartet på nytt, dukker meldingen opp igjen.
const outsideMapDismissed = ref(false)
const showOutsideMapBanner = computed(() =>
  userPos.isOutsideMap && !outsideMapDismissed.value
)
function dismissOutsideMap() { outsideMapDismissed.value = true }
watch(() => userPos.isOutsideMap, (out) => { if (!out) outsideMapDismissed.value = false })

// Screen Wake Lock — holder skjermen våken når brukeren bruker kartet til
// orientering ute. Persisteres i localStorage (default PÅ). Re-requestes
// automatisk når fanen blir synlig igjen siden browseren alltid slipper
// wake-locks ved fane-bytte.
const screenWake = useScreenWakeLock()

// Egen efemer wake-lock som holder skjermen våken mens et nærhetsvarsel er
// aktivt (uten idle-slipp), uavhengig av brukerens generelle «hold skjerm
// våken»-setting. GPS-loopen som oppdager ankomst kjører i siden, så skjermen
// må være våken for at varselet skal kunne fyre.
const alarmWake = useScreenWakeLock({ persist: false, idleTimeoutMs: 0 })
watch(() => !!proximity.active.value, (on) => alarmWake.setEnabled(on))

// Lås dokument-scroll mens kartet er åpent. Roten er h-[100dvh]
// overflow-hidden, men på mobil kan body likevel få en scroll-offset:
// når nettleserens adresselinje kollapser/utvides endrer 100dvh seg, og en
// residual body-scroll skyver hele kart-containeren (toppbar + kompass) opp
// og ut av synsfeltet. router.scrollBehavior nullstiller kun ved navigasjon,
// ikke under interaksjon inne i viewet (f.eks. ved long-press), så vi låser
// body-scroll eksplisitt her og frigjør den igjen ved unmount.
let prevHtmlOverflow = ''
let prevBodyOverflow = ''
function lockBodyScroll() {
  const html = document.documentElement
  prevHtmlOverflow = html.style.overflow
  prevBodyOverflow = document.body.style.overflow
  html.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  // Nullstill enhver residual offset så toppbaren garantert er synlig.
  window.scrollTo(0, 0)
}
function unlockBodyScroll() {
  document.documentElement.style.overflow = prevHtmlOverflow
  document.body.style.overflow = prevBodyOverflow
}

onMounted(() => {
  hasTouch.value = typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0)
  if (typeof window !== 'undefined' && window.matchMedia) {
    desktopMq = window.matchMedia('(min-width: 768px)')
    updateIsDesktop()
    desktopMq.addEventListener('change', updateIsDesktop)
  }
  lockBodyScroll()
  measureWrapper()
  // iOS Safari fyrer ikke alltid `resize` når layouten settler etter mount eller
  // når toolbaren skjuler/viser seg. En ResizeObserver fanger den ekte
  // wrapper-størrelsen pålitelig, så scale-baren (wrapperSize) og GPS-prikken
  // re-skaleres mot riktig viewport i stedet for en frosset for-tidlig måling.
  if (typeof ResizeObserver !== 'undefined' && wrapperRef.value) {
    wrapperResizeObs = new ResizeObserver(() => { measureWrapper(); updateUserDot() })
    wrapperResizeObs.observe(wrapperRef.value)
  }
  window.addEventListener('resize', measureWrapper)
  window.addEventListener('resize', scheduleNameLOD)
  loadMap()
  screenWake.start()
})

onUnmounted(() => {
  unlockBodyScroll()
  stopGpsTick()
  screenWake.stop()
  stopPanSettle()
  tabResizeObs?.disconnect()
  wrapperResizeObs?.disconnect()
  componentAlive = false
  window.removeEventListener('resize', scheduleNameLOD)
  desktopMq?.removeEventListener('change', updateIsDesktop)
  if (nameLodTimer) clearTimeout(nameLodTimer)
  if (activatableTimer) clearTimeout(activatableTimer)
  if (skeletonTimer) clearTimeout(skeletonTimer)
  if (loadPillTimer) clearTimeout(loadPillTimer)
  clearAutoPromote()
  if (autoMapToastTimer) clearTimeout(autoMapToastTimer)
})
</script>

<template>
  <div class="kart-ui relative w-full h-[100dvh] overflow-hidden"
       :class="isDark ? 'bg-zinc-900' : 'bg-stone-100'">

    <!-- Toppbar. v8.7.1: skjult i Curve Invaders-modus — den lå tidligere
         halvveis bak game-HUD-en, og hamburger-knappen i høyre hjørne var
         delvis klikkbar med uønskede effekter (drawer åpnet seg midt i
         spillet). Skjuler hele toppbaren, matcher kompass-rosen og andre
         map-only UI som allerede har samme v-if. -->
    <!-- Toppbaren krympes til den synlige kart-flaten på desktop (høyre kant =
         panelbredden) så den midtstilte tittel-badgen re-sentreres responsivt
         når side-panelet endrer bredde, og søke-/meny-knappene ikke havner bak
         panelet. Mobil/lukket: full bredde (panelOffsetPx = 0). -->
    <div class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-3
                pointer-events-none transition-[right] duration-200"
         :style="{ right: panelOffsetPx + 'px' }">
      <div class="flex items-center gap-2 pointer-events-auto">
        <button @click="router.push('/kart')"
                aria-label="Tilbake til kart-lista"
                class="rounded-full w-10 h-10 flex items-center justify-center
                       bg-zinc-950 text-white shadow-lg active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button @click="onHeaderTrackShortcut"
                :aria-label="tracker.isRecording.value ? 'Stopp sporing' : 'Start GPS og sporing'"
                class="rounded-full w-10 h-10 flex items-center justify-center
                       shadow-lg active:scale-95 transition relative"
                :class="tracker.isRecording.value
                        ? 'bg-pink-500 text-white'
                        : (userPos.isWatching
                            ? 'bg-sky-500 text-white'
                            : 'bg-zinc-950 text-white')">
          <!-- Recording: «stopp»-firkant. Idle: «play»-trekant (peker til høyre)
               så den klassiske start/stopp-semantikken er åpenbar uansett om
               GPS er på (blå knapp = GPS aktiv, klar til å starte ny tur). -->
          <svg v-if="tracker.isRecording.value" viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1.5"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
            <polygon points="8,5 8,19 19,12"/>
          </svg>
        </button>
      </div>

      <div class="pointer-events-none px-3 py-1.5 rounded-full bg-zinc-950
                  text-[12px] text-white font-medium shadow-lg max-w-[42%] truncate">
        {{ mapTitle }}
      </div>

      <div class="flex items-center gap-2 pointer-events-auto">
        <button @click="openSearch" aria-label="Søk i kart"
                class="rounded-full w-10 h-10 flex items-center justify-center
                       bg-zinc-950 text-white shadow-lg active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="20" y1="20" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <button @click="openDrawer" aria-label="Innstillinger"
                class="rounded-full w-10 h-10 flex items-center justify-center
                       bg-zinc-950 text-white shadow-lg active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Søke-overlay — trekt ut til MapSearchOverlay (v1.0.6). Logikk
         (indeksering, sentrering, bygg nytt kart, highlight) blir her. -->
    <MapSearchOverlay
      :open="searchOpen"
      v-model:query="searchQuery"
      v-model:active-index="searchActiveIndex"
      :results="searchResults"
      :index-count="searchIndex.length"
      :global-results="globalResults"
      :global-searching="globalSearching"
      @keydown="onSearchKeydown"
      @close="closeSearch"
      @select="selectSearchResult"
      @select-global="onSelectGlobalPlace" />

    <!-- Kompass-rose. På desktop skyves den til venstre for side-panelet
         når drawer er åpen så den ikke havner bak. -->
    <div class="absolute top-20 z-20 pointer-events-auto select-none flex flex-col items-end
                transition-[right] duration-200"
         :style="floatRightStyle">
      <button @click="pointNorth"
              aria-label="Sett nord opp (nullstill rotasjon)"
              class="w-14 h-14 rounded-full bg-zinc-950
                     flex items-center justify-center text-white shadow-lg active:scale-95 transition">
        <svg viewBox="-50 -50 100 100" class="w-12 h-12"
             :style="{ transform: compass.isActive && compass.headingDeg !== null
                                  ? `rotate(${-compass.headingDeg}deg)`
                                  : `rotate(${-rotation}deg)`,
                       transition: 'transform 0.2s linear' }">
          <circle r="44" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
          <polygon points="0,-38 6,0 0,8 -6,0" fill="#ef4444"/>
          <polygon points="0,38 6,0 0,-8 -6,0" fill="currentColor" opacity="0.85"/>
          <text y="-28" text-anchor="middle" font-size="14" font-weight="700"
                fill="currentColor">N</text>
        </svg>
      </button>
      <div v-if="compass.error"
           class="text-[10px] text-red-300 mt-1 max-w-[80px] text-right leading-tight
                  px-1.5 py-0.5 rounded bg-zinc-950">
        {{ compass.error }}
      </div>
      <!-- Rotasjons-slider (kun desktop/uten touch — touch roterer med to fingre).
           −180…180°, midtstilt = 0 (kart-nord opp). Roterer rundt viewport-senter.
           Dobbeltklikk = nullstill til nord. -->
      <div v-if="!hasTouch"
           class="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950
                  shadow-lg select-none">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white/55 shrink-0" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/>
        </svg>
        <input type="range" min="-180" max="180" step="1" :value="rotationSliderDeg"
               @input="onRotateSlider" @dblclick="rotateTo(0)"
               aria-label="Roter kartet (dobbeltklikk = nullstill til nord)"
               class="w-24 accent-sky-400 cursor-pointer" />
        <span class="text-[10px] text-white/55 tabular-nums w-9 text-right">{{ rotationSliderDeg }}°</span>
      </div>
      <!-- Tekststørrelse-slider (kun desktop, søsken til rotasjons-sliden).
           −100…100 med midtstilt = normal (100%); skala 0.5×…2.0×. Brukeren
           kan både øke og minske størrelsen på alle kart-etiketter (navn,
           høyde, stedsnavn, naturreservat, vann osv). Dobbeltklikk = normal.
           På mobil vises ingen slider — pinch holder til zoom. -->
      <div v-if="!hasTouch"
           class="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950
                  shadow-lg select-none">
        <svg viewBox="0 0 28 24" class="w-4 h-3.5 text-white/55 shrink-0" fill="currentColor">
          <text x="0" y="20" font-size="12" font-weight="800" font-family="ui-sans-serif, sans-serif">A</text>
          <text x="11" y="20" font-size="20" font-weight="800" font-family="ui-sans-serif, sans-serif">A</text>
        </svg>
        <input type="range" :min="LABEL_SCALE_MIN" :max="LABEL_SCALE_MAX" step="1"
               v-model.number="labelScaleSlider" @dblclick="labelScaleSlider = 0"
               aria-label="Tekststørrelse på kart-etiketter (dobbeltklikk = normal)"
               class="w-24 accent-sky-400 cursor-pointer" />
        <span class="text-[10px] text-white/55 tabular-nums w-9 text-right">{{ labelScalePct }}%</span>
      </div>
    </div>

    <!-- FAB-stack: on-the-fly / zoom inn / zoom ut / sentrer. Synlig både når
         drawer er åpen og lukket. Når drawer er åpen flyttes FAB-en opp over
         drawer-toppen så den ikke dekker innstillinger. z-40 sikrer at FAB-en
         ligger over drawer (z-30). Skjult når søke-overlayet er åpent
         (begge bruker z-40 og ville ellers stacke). -->
    <!-- FAB-bunn løftes kun når bunn-arket er åpent (mobil). På desktop er
         drawer et side-panel, så FAB-en beholder sin bunn og skyves i stedet
         til venstre for panelet. -->
    <div v-if="!searchOpen && !(!isDesktop && showControls && drawer.isMaximized.value)"
         class="absolute z-40 flex flex-col gap-2 pointer-events-auto select-none transition-[bottom,right] duration-200"
         :style="{
           right: floatRightStyle.right,
           bottom: (showControls && !isDesktop)
             ? 'calc(45dvh + 0.75rem)'
             : 'calc(env(safe-area-inset-bottom, 0px) + 5rem)'
         }">
      <!-- Transient hint-boble når strek-/relieff-knottene justeres. -->
      <Transition name="hint-fade">
        <div v-if="knobHint"
             class="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg
                    bg-zinc-950/95 text-white text-[11px] font-medium leading-tight shadow-lg
                    whitespace-nowrap pointer-events-none border border-white/10">
          {{ knobHint }}
        </div>
      </Transition>
      <!-- Auto-kart-FAB fjernet (v9.3.38): funksjonen er default PÅ og styres
           via bryteren i Innstillinger-fanen. Runtime-toasts (offline, «flyttet
           sentrum») rendres som et eget element nederst på kartet. -->
      <!-- Strek-knott: tap = tykkere (wrapper til tynnest etter tykkest),
           lang-trykk = åpne strek-panelet (per-element-sliders). Bua viser nivå;
           senter-streken tegnes i faktisk valgt tykkelse (selv-demonstrerende). -->
      <button @pointerdown="knobDown('stroke')" @pointerup="knobUp('stroke')"
              @pointercancel="knobUp('stroke')"
              aria-label="Strektykkelse — tap for å justere, hold for innstillinger"
              class="w-12 h-12 rounded-full bg-zinc-950 text-white shadow-lg touch-none
                     flex items-center justify-center active:scale-95 transition">
        <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none">
          <path :d="knobTrackD" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" opacity="0.22"/>
          <path :d="strokeArcD" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
          <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor"
                :stroke-width="strokeGlyphW" stroke-linecap="round"/>
        </svg>
      </button>
      <!-- Relieff-knott: tap = mer relieff (wrapper til av etter max),
           lang-trykk = åpne relieff-panelet. Senter-bumpens skygge følger nivået.
           Dimmes (ikke skjules) når relieff er av, så panelet — eneste sted
           per-kart-relieff kan skrus PÅ igjen — forblir tilgjengelig. -->
      <button @pointerdown="knobDown('relief')" @pointerup="knobUp('relief')"
              @pointercancel="knobUp('relief')"
              aria-label="Relieff-styrke — tap for å justere, hold for innstillinger"
              class="w-12 h-12 rounded-full bg-zinc-950 text-white shadow-lg touch-none
                     flex items-center justify-center active:scale-95 transition"
              :class="reliefEnabled ? '' : 'opacity-40'">
        <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none">
          <path :d="knobTrackD" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" opacity="0.22"/>
          <path :d="reliefArcD" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
          <path d="M6.5 15.5 L9.5 10 L11.8 12.8 L14.3 8.5 L17.5 15.5 Z"
                fill="currentColor" :fill-opacity="reliefGlyphOpacity"
                stroke="currentColor" stroke-width="0.8" stroke-linejoin="round"/>
        </svg>
      </button>
      <!-- Sentrer-knapp: tap = sentrer (+ GPS-refresh), lang-trykk = åpne
           zoom-panelet. Pointer-events (ikke @click) så lang-trykk ikke
           utløser sentrering ved release — samme knobSettled-mønster. -->
      <button @pointerdown="knobDown('center')" @pointerup="knobUp('center')"
              @pointercancel="knobUp('center')"
              :aria-label="userPos.isWatching ? 'Sentrer + oppdater GPS — hold for innstillinger' : 'Sentrer — hold for innstillinger'"
              class="w-12 h-12 rounded-full bg-zinc-950 text-white shadow-lg touch-none
                     flex items-center justify-center active:scale-95 transition relative">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="5"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="22" y2="12"/>
        </svg>
        <!-- v8.5.2: liten GPS-indikator-prikk i hjørnet når GPS er aktiv,
             så brukeren ser at knappen også refresher posisjonen. -->
        <span v-if="userPos.isWatching"
              class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.8)]" />
      </button>
    </div>

    <!-- Kart-flate. Unified transform (translate ∘ rotate ∘ scale) på ett
         enkelt indre div. Lar finger-pivot styre rotasjons-/zoom-senter
         (v8.9.2). -->
    <div ref="wrapperRef" class="absolute inset-0 touch-none select-none transition-[right] duration-200"
         :class="annot.isAnnotateMode.value ? 'cursor-crosshair' : ''"
         :style="{ right: panelOffsetPx + 'px' }"
         @pointerdown="onPointerDownLongPress"
         @pointermove="onPointerMoveLongPress"
         @pointerup="onPointerUpLongPress"
         @pointercancel="onPointerUpLongPress"
         @contextmenu="onContextMenuEvent">
      <div ref="mapInnerRef" class="w-full h-full relative" :style="mapTransformStyle">
        <div ref="svgHostRef" class="w-full h-full" @click="onMapClick"></div>
      </div>
      <!-- Long-press-sikte: HTML-overlay UTENFOR pinch-transformen (søsken av det
           transformerte mapInnerRef), så størrelsen er en LITERAL CSS-piksel-
           verdi som ikke kan skaleres/blåses opp av zoom. Posisjoneres via
           positionContextPin (getScreenCTM). 34px boks, sentrert på punktet. -->
      <div v-show="contextMenuOpen && contextMenuPoint"
           ref="contextPinElRef"
           class="absolute top-0 left-0 pointer-events-none z-[6]"
           style="width:34px;height:34px;margin-left:-17px;margin-top:-17px;">
        <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
          <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">
            <path d="M17 3.5 V30.5 M3.5 17 H30.5"/>
            <circle cx="17" cy="17" r="6.6"/>
          </g>
          <g fill="none" stroke="#e11d48" stroke-width="2.4" stroke-linecap="round">
            <path d="M17 3.5 V30.5 M3.5 17 H30.5"/>
            <circle cx="17" cy="17" r="6.6"/>
          </g>
        </svg>
      </div>
    </div>

    <!-- Stifinner: fast midt-kikkertsikte mens startpunkt velges. Brukeren
         panorerer kartet til siktet står på ønsket start, så «Bekreft». Ligger
         over kartet (pointer-events none) sentrert i kart-flaten (samme right-
         offset som wrapperen så det treffer visibleCenterSvg). -->
    <div v-if="sti.mode.value === 'pickingStart' || sti.mode.value === 'pickingVia'"
         class="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
         :style="{ right: panelOffsetPx + 'px' }">
      <svg viewBox="0 0 80 80" class="w-20 h-20 drop-shadow"
           fill="none" :stroke="stiPickColor" stroke-width="2.5">
        <circle cx="40" cy="40" r="22" stroke="rgba(255,255,255,0.9)" stroke-width="5"/>
        <circle cx="40" cy="40" r="22"/>
        <circle cx="40" cy="40" r="2.5" :fill="stiPickColor" stroke="none"/>
        <line x1="40" y1="6" x2="40" y2="22" stroke="rgba(255,255,255,0.9)" stroke-width="5"/>
        <line x1="40" y1="6" x2="40" y2="22"/>
        <line x1="40" y1="58" x2="40" y2="74" stroke="rgba(255,255,255,0.9)" stroke-width="5"/>
        <line x1="40" y1="58" x2="40" y2="74"/>
        <line x1="6" y1="40" x2="22" y2="40" stroke="rgba(255,255,255,0.9)" stroke-width="5"/>
        <line x1="6" y1="40" x2="22" y2="40"/>
        <line x1="58" y1="40" x2="74" y2="40" stroke="rgba(255,255,255,0.9)" stroke-width="5"/>
        <line x1="58" y1="40" x2="74" y2="40"/>
      </svg>
    </div>
    <!-- «Bekreft»-knapp (start- eller via-plukk). -->
    <div v-if="sti.mode.value === 'pickingStart' || sti.mode.value === 'pickingVia'"
         class="absolute left-1/2 -translate-x-1/2 z-30 transition-[left] duration-200"
         :style="[mapCenterStyle, { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }]">
      <button @click="sti.mode.value === 'pickingVia' ? onConfirmVia() : onConfirmStart()"
              class="px-5 py-3 rounded-full text-white text-[14px] font-semibold
                     shadow-lg active:scale-95 flex items-center gap-2"
              :class="sti.mode.value === 'pickingVia' ? 'bg-amber-500' : 'bg-emerald-600'">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 L9 17 L4 12"/>
        </svg>
        {{ sti.mode.value === 'pickingVia'
            ? (sti.isLoop.value ? 'Bekreft vendepunkt' : 'Bekreft via-punkt')
            : 'Bekreft startpunkt' }}
      </button>
    </div>

    <!-- Auto-kart-trådkorset er fjernet (v9.3.38): auto-kart er default PÅ og
         kjører stille uten ramme/trådkors — dra kartet, så bygges nytt utsnitt. -->

    <!-- Modus-chips/-bannere (auto-kart-toast, detalj-chip, highlight-chip,
         annoterings-indikator, måle-readout, stifinner- og nærhetsvarsel-
         alert) — trekt ut til MapModeChips (v1.0.8). -->
    <MapModeChips
      :auto-map-toast="autoMapToast"
      :search-open="searchOpen"
      :map-center-style="mapCenterStyle"
      :filling-in-details="fillingInDetails"
      :highlighted-feature="highlightedFeature"
      :annot="annot"
      :measure-mode="measureMode"
      :measure-closed="measureClosed"
      :measure-stats="measureStats"
      :sti="sti"
      :sti-elevation-diff-m="stiElevationDiffM"
      :sti-route-climbs="stiRouteClimbs"
      :sti-selected-climb="stiSelectedClimb"
      :proximity="proximity"
      @clear-highlight="clearHighlight"
      @stop-measure="stopMeasure"
      @select-route="onSelectRoute"
      @remove-via="onRemoveVia"
      @begin-add-via="onBeginAddVia"
      @cancel-stifinner="onCancelStifinner" />

    <!-- Status/feil-overlays: lasting, last-feil, posisjons-status,
         detalj-feil og lav GPS-nøyaktighet. Trekt ut til MapStatusOverlays
         (v1.0.7). Tre uavhengige v-if/v-else-if-kjeder inne i komponenten. -->
    <MapStatusOverlays
      :loading="loading"
      :has-meta="!!meta"
      :skeleton-visible="skeletonVisible"
      :is-dark="isDark"
      :load-pill-visible="loadPillVisible"
      :load-error="loadError"
      :position-error="userPos.error"
      :map-center-style="mapCenterStyle"
      :show-outside-map="showOutsideMapBanner"
      :details-failed="detailsFailed"
      :show-low-accuracy="showLowAccuracyBanner"
      :accuracy-m="userPos.accuracyM ?? 0"
      @retry-load="loadMap"
      @dismiss-outside="dismissOutsideMap"
      @dismiss-details="detailsFailed = false"
      @retry-details="retryMapDetails"
      @dismiss-low-accuracy="dismissLowAccuracy" />

    <!-- Skala/ekvidistanse + attribusjon — trekt ut til MapScaleAttribution (v1.0.8). -->
    <MapScaleAttribution
      :visible="!loading && !searchOpen"
      :scale-bar="scaleBar"
      :equidistance-label="equidistanceLabel"
      :meta="meta" />

    <!-- Kontrollpanel (drawer). Desktop (≥768px): høyrestilt fullhøyde side-
         panel (som illustrasjons-sporet). Mobil: dragbart bunn-ark. -->
    <Transition :name="isDesktop ? 'drawer-side' : 'drawer'">
      <div v-if="showControls"
           :class="['absolute z-30 backdrop-blur-md bg-zinc-900/92 flex flex-col shadow-2xl',
                    isDesktop
                      ? 'top-0 right-0 bottom-0 border-l border-white/10'
                      : 'inset-x-0 bottom-0 border-t border-white/10 rounded-t-2xl']"
           :style="isDesktop
                     ? { width: panel.width.value + 'px', transition: panel.isResizing.value ? 'none' : undefined }
                     : drawer.drawerHeightStyle.value">
        <!-- Desktop: dra-bar venstrekant for å justere panelbredden (360px–50vw). -->
        <div v-if="isDesktop"
             class="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-10 cursor-col-resize group"
             @pointerdown="panel.onResizeStart($event)">
          <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10
                      group-hover:bg-sky-400/60 transition-colors"
               :class="panel.isResizing.value ? 'bg-sky-400/80' : ''"></div>
        </div>
        <div class="shrink-0 select-none"
             :class="isDesktop ? '' : 'touch-none cursor-grab active:cursor-grabbing'"
             @pointerdown="isDesktop || drawer.onPointerDown($event)"
             @pointermove="isDesktop || drawer.onPointerMove($event)"
             @pointerup="isDesktop || drawer.onPointerUp($event)"
             @pointercancel="isDesktop || drawer.onPointerUp($event)">
          <div v-if="!isDesktop" class="pt-3.5 pb-2 flex justify-center">
            <div class="w-12 h-1.5 rounded-full bg-white/40"
                 :style="{ opacity: drawer.handleOpacity.value }"></div>
          </div>
          <div class="px-4 pb-2 flex items-center justify-between"
               :class="isDesktop ? 'pt-3' : ''">
            <div class="text-white text-sm font-semibold">Innstillinger</div>
            <div class="flex items-center gap-1">
              <button @pointerdown.stop @click.stop="cycleTextScale"
                      aria-label="Tekststørrelse"
                      class="h-8 px-2 -mr-0.5 rounded-full flex items-center gap-1
                             text-white/70 active:bg-white/10">
                <span class="font-semibold leading-none"><span class="text-[12px]">A</span><span class="text-[16px]">A</span></span>
                <span v-if="uiTextScale !== 1" class="text-[10px] tabular-nums text-white/50">{{ Math.round(uiTextScale * 100) }}%</span>
              </button>
              <button @pointerdown.stop @click.stop="closeDrawer"
                      class="w-8 h-8 -mr-1 rounded-full flex items-center justify-center
                             text-white/70 active:bg-white/10">
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Hurtigvalg: alltid synlig over fanene (v8.9.6). Tegnforklaring +
             GPS/kompass-toggles trengs hyppig uavhengig av aktiv fane. -->
        <div class="shrink-0 px-4 pb-2 grid grid-cols-3 gap-1.5">
          <button @click="router.push('/tegnforklaring')"
                  class="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80
                         text-[11px] font-medium active:scale-[0.98] flex flex-col items-center gap-1">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <line x1="7" y1="9" x2="17" y2="9"/>
              <line x1="7" y1="13" x2="17" y2="13"/>
              <line x1="7" y1="17" x2="13" y2="17"/>
            </svg>
            Tegnforklaring
          </button>
          <button @click="userPos.isWatching ? userPos.stop() : startPositioning()"
                  class="px-2 py-2 rounded-lg border text-[11px] font-medium active:scale-[0.98]
                         flex flex-col items-center gap-1"
                  :class="userPos.isWatching
                          ? 'bg-sky-500/20 border-sky-400/50 text-white'
                          : 'bg-white/5 border-white/10 text-white/80'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="10" r="3"/>
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
            </svg>
            {{ userPos.isWatching ? 'Følger GPS' : 'Start GPS' }}
          </button>
          <button @click="compass.isActive ? compass.stop() : compass.start()"
                  class="px-2 py-2 rounded-lg border text-[11px] font-medium active:scale-[0.98]
                         flex flex-col items-center gap-1"
                  :class="compass.isActive
                          ? 'bg-sky-500/20 border-sky-400/50 text-white'
                          : 'bg-white/5 border-white/10 text-white/80'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polygon points="12 5 14 12 12 13 10 12" fill="currentColor"/>
              <polygon points="12 19 14 12 12 11 10 12"/>
            </svg>
            {{ compass.isActive ? 'Kompass på' : 'Kompass' }}
          </button>
        </div>

        <!-- Tab-bar — understreket aktiv fane (samme stil som illustrasjons-
             sporet). Horisontal scroll når labels ikke får plass. Pil
             venstre/høyre (v9.3.6) er alltid synlig som hint om flere faner,
             og disables i hver ende. Skjult når skuffen er minimert (v11.0.61)
             så minimert-peeken viser kun håndtak + tittel + hurtigvalg. -->
        <div v-show="!drawer.isMinimized.value"
             class="shrink-0 mx-4 mb-2 flex items-stretch border-b border-white/10">
          <!-- Pil venstre -->
          <button type="button" @click="scrollTabs(-1)"
                  :disabled="!canScrollTabsLeft"
                  aria-label="Vis faner til venstre"
                  class="shrink-0 px-1 flex items-center transition-colors"
                  :class="canScrollTabsLeft
                          ? 'text-white/70 active:scale-90 cursor-pointer'
                          : 'text-white/15 cursor-default'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div ref="tabScroller" @scroll="updateTabScroll"
               class="flex-1 flex overflow-x-auto map-tabs"
               style="scrollbar-width: none;">
            <button v-for="tab in visibleTabs" :key="tab.key"
                    @click="activeTab = tab.key"
                    class="px-3 py-2.5 text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0
                           transition-colors"
                    :class="activeTab === tab.key
                            ? 'text-white border-b-2 border-slate-200'
                            : 'text-white/40'">
              {{ tab.label }}
            </button>
          </div>

          <!-- Pil høyre -->
          <button type="button" @click="scrollTabs(1)"
                  :disabled="!canScrollTabsRight"
                  aria-label="Vis faner til høyre"
                  class="shrink-0 px-1 flex items-center transition-colors"
                  :class="canScrollTabsRight
                          ? 'text-white/70 active:scale-90 cursor-pointer'
                          : 'text-white/15 cursor-default'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div v-show="!drawer.isMinimized.value"
             class="flex-1 overflow-y-auto px-4 pb-6" :style="{ zoom: uiTextScale }">
          <!-- ── Tab: Lag ─────────────────────────────────────────── -->
          <!-- Fane-innholdet er skilt ut i egne komponenter (v1.0.8):
               src/components/drawer/. v-show (ikke v-if) beholder DOM-en
               levende ved fanebytte, som før. -->
          <DrawerLayersTab v-show="activeTab === 'lag'"
            :apply-preset="applyPreset" :active-preset="activePreset"
            :reset-layers="resetLayers" :layers-dirty="layersDirty"
            :land-layer-buttons="landLayerButtons" :marine-layer-buttons="marineLayerButtons"
            :toggle-layer="toggleLayer" :toggle-depth="toggleDepth"
            :visible-layers="visibleLayers" :kulturminne-count="kulturminneCount"
            :fredet-loading="fredetLoading" :fredet-count="fredetCount" :meta="meta" />

          <DrawerThemeTab v-show="activeTab === 'tema'"
            :themes="THEMES" :current-theme="currentTheme" :on-theme-tap="onThemeTap"
            :land-font="landFont" :water-font="waterFont"
            v-model:font-pair-id="fontPairId" />

          <DrawerAnnotateTab v-show="activeTab === 'annotering'"
            :annot="annot" :select-symbol="selectSymbol"
            :label-for-annotation="labelForAnnotation" />

          <DrawerMeasureTab v-show="activeTab === 'maaling'"
            :measure-mode="measureMode" :measure-stats="measureStats"
            :measure-closed="measureClosed" :measure-vertices="measureVertices"
            :start-measure="startMeasure" :stop-measure="stopMeasure"
            :close-measure="closeMeasure" :undo-measure-vertex="undoMeasureVertex"
            :clear-measure="clearMeasure" />

          <DrawerTracksTab v-show="activeTab === 'sporing'"
            :tracker="tracker" :user-pos="userPos" :live-track-stats="liveTrackStats"
            :on-toggle-recording="onToggleRecording" :on-export-track-gpx="onExportTrackGpx"
            :on-delete-track="onDeleteTrack" :profile-for="profileFor"
            v-model:expanded-track-id="expandedTrackId"
            :gps-debug-line="gpsDebugLine" :copy-gps-coords="copyGpsCoords"
            :copy-state="copyState" :show-gps-tip="showGpsTip"
            :dismiss-gps-tip="dismissGpsTip" />

          <DrawerExportTab v-show="activeTab === 'eksport'"
            :share-state="shareState" :highlighted-feature="highlightedFeature"
            :exporting="exporting" :on-share-map="onShareMap"
            :on-share-map-with-place="onShareMapWithPlace"
            :on-export-svg="onExportSvg" :on-export-png="onExportPng"
            :on-export-pdf="onExportPdf" :on-print="onPrint" />

          <DrawerAboutTab v-show="activeTab === 'om'"
            v-model:map-size-slider="mapSizeSlider"
            v-model:show-full-names="showFullNames"
            v-model:max-tile-index="maxTileIndex"
            v-model:global-relief-enabled="globalReliefEnabled"
            v-model:global-relief-mode="globalReliefMode"
            v-model:density-id="densityId"
            v-model:density-apply-to-all="densityApplyToAll"
            :map-size-km="mapSizeKm" :rebuild-at-chosen-size="rebuildAtChosenSize"
            :building="buildingOnTheFly" :can-rebuild="!!meta?.bbox"
            :screen-wake="screenWake" :max-tiles="maxTiles"
            :max-tile-index-max="MAX_TILE_STEPS.length - 1" />

          <DrawerDevTab v-show="activeTab === 'utvikler'"
            :scale="scale" :zoom-tier="zoomTier"
            v-model:zoom-near-threshold="zoomNearThreshold"
            v-model:name-budget-far="nameBudgetFar"
            v-model:name-budget-mid="nameBudgetMid"
            v-model:name-budget-near="nameBudgetNear"
            v-model:diagnose="diagnose"
            :reset-lod-tuning="resetLodTuning" :map-data-label="mapDataLabel"
            :auto-tile-count="autoTileCount" :max-tiles="maxTiles"
            :cull-stats="cullStats" :sjokart-status-text="sjokartStatusText" :meta="meta"
            :purple-trails="purpleTrails" :toggle-purple-trails="togglePurpleTrails"
            :open-vardasen="() => router.push({ name: 'kart-vis', params: { id: 'vardasen' } })"
            :open-perf-log="() => { showPerfLog = true }" />
        </div>
      </div>
    </Transition>

    <!-- FAB-innstillingspanel: long-press på Strek-/Relieff-/Sentrer-FAB-ene
         åpner ett delt bottom-sheet. Trekt ut til FabSettingsPanel (v1.0.8). -->
    <FabSettingsPanel
      :panel="knobPanel"
      :drawer="knobDrawer"
      :stroke-effective="strokeEffective"
      v-model:relief-enabled="reliefEnabled"
      v-model:relief-mode="reliefMode"
      v-model:default-zoom-scale="defaultZoomScale"
      v-model:max-tile-index="maxTileIndex"
      v-model:rebuild-size-km="rebuildSizeKm"
      :zoom-min="DEFAULT_ZOOM_MIN"
      :zoom-max="DEFAULT_ZOOM_MAX"
      :max-tiles="maxTiles"
      :max-tile-index-max="MAX_TILE_STEPS.length - 1"
      :can-rebuild="!!meta?.bbox"
      :building="buildingOnTheFly"
      :hint="panelHint"
      @close="closeKnobPanel"
      @set-stroke-group="(id, v) => strokeTuning.setGroup(id, v)"
      @save-default="knobPanel === 'stroke' ? strokePanelSaveDefault() : reliefPanelSaveDefault()"
      @reset="knobPanel === 'stroke' ? strokePanelReset() : reliefPanelReset()"
      @rebuild="rebuildAtChosenSize" />

    <!-- Long-press kontekstmeny (bottom-sheet). Åpnes ved long-press eller
         høyreklikk på kartet. Viser koordinater, høyde, nærmeste sted/sti,
         og handlinger for det valgte punktet. -->
    <!-- Ingen backdrop-blur her: long-press-siktet er et HTML-overlay foran
         kartet, og backdrop-filter:blur tvinger re-blurring av hele den komplekse
         kart-SVG-en på HVER animasjons-frame → mobil-kompositoren låser seg
         (frys på store/innebygde kart, men ikke på små 1×1). Vanlig
         halv-opak dimming er billig og fryser ikke. -->
    <!-- Bare maksimert tilstand dimmer + sperrer kartet (modal: tapp utenfor
         = lukk). Standard/minimert lar kartet stå synlig og interaktivt bak
         arket (pointer-events-none) så man kan panorere/zoome hovedkartet for
         kontekst, uavhengig av mini-kartets eget zoom-nivå i arket. -->
    <!-- Kulturminne-detalj-skuff — trekt ut til KulturminneSheet (v1.0.8).
         Henting/cache blir her (openKulturminneDetail). -->
    <KulturminneSheet
      :open="kulturminneOpen"
      :detail="kulturminneDetail"
      :loading="kulturminneLoading"
      :drawer="kulturminneDrawer"
      @close="closeKulturminneDetail" />

    <!-- Long-press kontekstmeny (bottom-sheet) — egen Transition: to uavhengige
         v-if-søsken i samme <Transition> er en dev-kompileringsfeil (krever
         nøyaktig ett barn; sjekken er dev-only, derfor passerte prod-bygget). -->
    <!-- Long-press-kontekstmeny — trekt ut til ContextMenuSheet (v1.0.8).
         All punkt-info/oppslag-logikk blir her; DOM-refene (ark + detalj-
         inset-vert) settes tilbake i forelderens refs via funksjons-props. -->
    <ContextMenuSheet
      :context-menu-open="contextMenuOpen"
      :context-menu-info="contextMenuInfo"
      :context-drawer="contextDrawer"
      :set-sheet-el="el => { contextSheetRef = el }"
      :set-inset-el="el => { detailInsetRef = el }"
      :context-action-state="contextActionState"
      :ui-text-scale="uiTextScale"
      :DETAIL_INSET_M="DETAIL_INSET_M"
      :lake-query="lakeQuery"
      :verne-query="verneQuery"
      :naturtype-query="naturtypeQuery"
      :place-wiki-card="placeWikiCard"
      :expanded-red-cat="expandedRedCat"
      :map-data-label="mapDataLabel"
      :ctx-can-navigate="ctxCanNavigate"
      :ctx-can-measure="ctxCanMeasure"
      :ctx-can-annotate="ctxCanAnnotate"
      :ctx-busy="ctxBusy"
      :ctx-too-far-to-arm="ctxTooFarToArm"
      :ctx-dist-from-user="ctxDistFromUser"
      :proximity-panel-open="proximityPanelOpen"
      :proximity-cfg="proximityCfg"
      :proximity="proximity"
      :user-pos="userPos"
      :poi-counts="poiCounts"
      :measure-mode="measureMode"
      :close-context-menu="closeContextMenu"
      :on-copy-coords="onCopyCoords"
      :cycle-text-scale="cycleTextScale"
      :on-open-route-planner="onOpenRoutePlanner"
      :format-area-km2="formatAreaKm2"
      :format-volum="formatVolum"
      :format-vernedato="formatVernedato"
      :format-count="formatCount"
      :red-list-cats="redListCats"
      :red-list-groups="redListGroups"
      :toggle-red-cat="toggleRedCat"
      :source-label="sourceLabel"
      :naturtype-verdi-class="naturtypeVerdiClass"
      :on-share-coords="onShareCoords"
      :on-share-map="onShareMap"
      :on-share-map-with-context-place="onShareMapWithContextPlace"
      :on-navigate-here="onNavigateHere"
      :on-round-trip-here="onRoundTripHere"
      :on-start-measure-here="onStartMeasureHere"
      :on-open-google-maps="onOpenGoogleMaps"
      :on-open-street-view="onOpenStreetView"
      :on-open-ut-no="onOpenUtNo"
      :on-open-vegkart="onOpenVegkart"
      :toggle-proximity-panel="toggleProximityPanel"
      :arm-proximity-alert="armProximityAlert"
      :start-positioning="startPositioning"
      :nearest-poi-from-point="nearestPoiFromPoint"
      :on-place-annotation-from-context="onPlaceAnnotationFromContext" />

    <!-- Perf-logg-modal: byggetider fra localStorage (kun utvikler).
         Trekt ut til PerfLogModal (v1.0.5). -->
    <PerfLogModal v-model:open="showPerfLog" />

    <!-- Høydeprofil-modal: stor profil + stats for valgt spor.
         Trekt ut til TrackElevationSheet (v1.0.4). -->
    <TrackElevationSheet
      :track="expandedTrack"
      :profile="expandedTrack ? profileFor(expandedTrack) : null"
      @close="expandedTrackId = null" />

    <!-- On-the-fly kart-bygging: IKKE-blokkerende chip (pointer-events-none).
         Tidligere var dette en full-screen blocker som frøs alt; nå forblir det
         gjeldende kartet pan/zoom/rotér-bart mens det nye bygges. Auto-kart-
         trigger er gated på buildingOnTheFly, så gestene lager ikke et
         konkurrerende bygg. z-[60] holder chippen over drawer/søk visuelt. -->
    <Transition name="chip-fade">
      <div v-if="buildingOnTheFly && !searchOpen"
           class="absolute top-16 left-1/2 -translate-x-1/2 z-[60] px-3 py-1.5 rounded-2xl
                  bg-zinc-950/90 text-white text-[12px] font-medium shadow-lg backdrop-blur
                  flex items-center gap-2 pointer-events-none border border-white/10 max-w-[85%]
                  transition-[left] duration-200"
           :style="mapCenterStyle">
        <span class="w-3.5 h-3.5 rounded-full border-2 border-white/25 border-t-white/80 animate-spin shrink-0"></span>
        <span class="truncate">{{ buildingProgress || 'Oppretter kart …' }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.drawer-enter-from, .drawer-leave-to       { transform: translateY(100%); }
/* Desktop: side-panelet glir inn fra høyre i stedet for opp fra bunnen. */
.drawer-side-enter-active, .drawer-side-leave-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.drawer-side-enter-from, .drawer-side-leave-to       { transform: translateX(100%); }
/* Skjul scrollbar på tab-strip — fortsatt scrollbar med touch / wheel */
.map-tabs::-webkit-scrollbar { display: none; }
/* Highlight-chip — kun fade, så Tailwinds -translate-x-1/2 bevares */
.chip-fade-enter-active, .chip-fade-leave-active { transition: opacity 0.18s ease; }
.chip-fade-enter-from, .chip-fade-leave-to       { opacity: 0; }
/* On-the-fly inaktiv-hint og full-screen loader */
.hint-fade-enter-active, .hint-fade-leave-active { transition: opacity 0.18s ease; }
.hint-fade-enter-from, .hint-fade-leave-to       { opacity: 0; }
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.22s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to       { opacity: 0; }
/* Under fade-UT dekker inset-0-overlayet fortsatt skjermen og spiser
   pointer-events i 220 ms — et raskt nytt trykk (f.eks. re-åpne et FAB-panel)
   traff det usynlige laget i stedet for knappen. Slipp pekeren gjennom. */
.overlay-fade-leave-active { pointer-events: none; }
</style>

<!-- Ikke-scoped: kart-SVG-en injiseres via createElementNS (utenfor template-
      scope), så scoped-regler treffer den ikke. Navn-LOD-en (applyNameLOD)
     setter .name-lod-off på overflødige stedsnavn-tekster i tette utsnitt.
     Regelen lever her — ikke i symbolizer-CSS-en inni SVG-en — så den IKKE
     følger med ved SVG-eksport/print (der vil vi ha alle navn).
     Samme kontrakt for .vp-cull (viewport-culling, applyViewportCull):
     skjult på skjerm, alltid med i eksport. Med localStorage 'cull-debug'
     vises cullede elementer i stedet halvgjennomsiktig rosa (visuell
     verifisering på enhet: pan rundt og SE hva som culles). -->
<style>
.isom-map .name-lod-off { display: none !important; }
.isom-map .vp-cull { display: none !important; }

/* Navn-lagene holdes usynlige til det utsatte navn-LOD-passet har kjørt
   (scheduleDeferredMapPasses fjerner klassen) — hindrer at ALLE navn blinker
   frem i 1–2 frames før decluttering. visibility (ikke opacity) så den ikke
   kolliderer med reveal-sekvensens opacity-transitions. Samme eksport-kontrakt
   som .name-lod-off: lever her, følger ikke med i SVG-eksport. */
.isom-map.lod-pending [data-layer="navn"],
.isom-map.lod-pending [data-layer^="stedsnavn"] { visibility: hidden; }

/* v11.0.45 — trinnvis kart-avsløring. Klassene settes/fjernes i startMapReveal;
   etter sekvensen er alle borte og kartet er upåvirket (ingen permanent
   transition som kan koste under pan/zoom). */
.isom-map.cb-reveal { opacity: 0; }
.isom-map.cb-revealing { transition: opacity .26s ease; }
/* Kort enkelt-fade ved åpning av allerede-bygget kart (startMapReveal uten
   staged) — erstatter to-trinns-sekvensen med 130/540 ms-timerne. */
.isom-map.cb-reveal-quick.cb-revealing { transition: opacity .12s ease; }
.isom-map.cb-reveal-late [data-layer="navn"],
.isom-map.cb-reveal-late [data-layer^="stedsnavn"],
.isom-map.cb-reveal-late #hillshade-layer { opacity: 0; }
.isom-map.cb-revealing [data-layer="navn"],
.isom-map.cb-revealing [data-layer^="stedsnavn"],
.isom-map.cb-revealing #hillshade-layer { transition: opacity .28s ease; }
.isom-map.cull-debug-tint .vp-cull {
  display: revert !important;
  opacity: 0.25 !important;
  fill: #e11d48 !important;
}
</style>

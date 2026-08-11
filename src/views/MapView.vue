<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePinchZoom } from '../composables/usePinchZoom.js'
import { useUserPosition } from '../composables/useUserPosition.js'
import { useProximityAlert, getPersistedAlert } from '../composables/useProximityAlert.js'
import { useCompass } from '../composables/useCompass.js'
import { useDraggableDrawer } from '../composables/useDraggableDrawer.js'
import { useFloatAboveSheets } from '../composables/useFloatAboveSheets.js'
import { useResizablePanel } from '../composables/useResizablePanel.js'
import { useMapAnnotations, ANNOTATION_SYMBOLS } from '../composables/useMapAnnotations.js'
import { useStifinner } from '../composables/useStifinner.js'
import { useMapSearch, findByName } from '../composables/useMapSearch.js'
import { useNominatim } from '../composables/useNominatim.js'
import { useSearchKeyboard } from '../composables/useSearchKeyboard.js'
import { useScreenWakeLock } from '../composables/useScreenWakeLock.js'
import { useMapSizePreference, effectiveEquidistanceForWidthKm, aspectForFormat, DEFAULT_MAP_WIDTH_KM, MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM } from '../composables/useMapSizePreference.js'
import { useLodTuning } from '../composables/useLodTuning.js'
import { useLabelFonts } from '../composables/useLabelFonts.js'
import { useLabelDensity } from '../composables/useLabelDensity.js'
import { useStrokeTuning } from '../composables/useStrokeTuning.js'
import { useTrailColors } from '../composables/useTrailColors.js'
import { useReliefSettings } from '../composables/useReliefSettings.js'
import { useDetailInset } from '../composables/useDetailInset.js'
import { useHeritageLayers } from '../composables/useHeritageLayers.js'
import { useHydroStations } from '../composables/useHydroStations.js'
import { useReliefRender } from '../composables/useReliefRender.js'
import { useGhostTiles } from '../composables/useGhostTiles.js'
import { useMapExtend } from '../composables/useMapExtend.js'
import { use3dEntry } from '../composables/use3dEntry.js'
import { useKartDeling } from '../composables/useKartDeling.js'
import { useDeltTur } from '../composables/useDeltTur.js'
import { useLagStyring } from '../composables/useLagStyring.js'
import { useNavnLod } from '../composables/useNavnLod.js'
import { useViewportCull } from '../composables/useViewportCull.js'
import { useGpsSpor } from '../composables/useGpsSpor.js'
import { useSymbolRenderers } from '../composables/useSymbolRenderers.js'
import { useContextLookups } from '../composables/useContextLookups.js'
import { useMapTheme } from '../composables/useMapTheme.js'
import { useMapHighlight, publiserMerkeKlar } from '../composables/useMapHighlight.js'
import { loadNasjonalparker, parksForBbox, samePark } from '../lib/nasjonalparkData.js'
import { useMapLoadPipeline } from '../composables/useMapLoadPipeline.js'
import { buildStrokeOverrideCss } from '../lib/strokeOverrides.js'
import { buildTrailColorCss, normalizeHex } from '../lib/trailColors.js'
import { DEFAULT_VISIBLE_LAYER_KEYS } from '../lib/mapLayerCatalog.js'
import { themeVarEntries, allThemeVarNames, buildThemeCss, listThemes } from '../lib/mapSettingsApply.js'
import { norwegianName } from '../lib/placeName.js'
import AnnotationIcon from '../components/AnnotationIcon.vue'
import TrackElevationSheet from '../components/TrackElevationSheet.vue'
import PerfLogModal from '../components/PerfLogModal.vue'
import RenameMapDialog from '../components/RenameMapDialog.vue'
import MapSearchOverlay from '../components/MapSearchOverlay.vue'
import MapEdgeHandles from '../components/MapEdgeHandles.vue'
import MapStatusOverlays from '../components/MapStatusOverlays.vue'
import MapScaleAttribution from '../components/MapScaleAttribution.vue'
import KulturminneSheet from '../components/KulturminneSheet.vue'
import HydroStationSheet from '../components/HydroStationSheet.vue'
import FabSettingsPanel from '../components/FabSettingsPanel.vue'
import FabCluster from '../components/FabCluster.vue'
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
import AppMenuButton from '../components/AppMenuButton.vue'
import { useLendeChat } from '../composables/useLendeChat.js'
import { hasAiToken } from '../lib/lendeAi.js'
import { isomCatalog, buildPointSymbolDef } from '../lib/symbolizer.js'
import { printDocument, exportSvgFile, exportPngFile, exportPdfFile } from '../lib/printExport.js'
import { withColophon, formatDenom } from '../lib/mapColophon.js'
import { logPerf } from '../lib/perfLog.js'
import { sampleProfile } from '../lib/elevationProfile.js'
import { fetchDEM } from '../lib/demFetcher.js'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { setBuildBusy } from '../lib/swUpdate.js'
import { pruneAutoTiles, countAutoTiles } from '../lib/tileCache.js'
import { renameMap } from '../lib/mapStorage.js'
import { svgToWgs84, wgs84ToSvg } from '../lib/utm.js'
import { utNoZoomForMPerPx, UTNO_DEFAULT_ZOOM } from '../lib/utNoLink.js'
import { useMapContext } from '../composables/useMapContext.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import { fetchKulturminneById } from '../lib/kulturminneFetcher.js'
import { polylineToPath } from '../lib/pathUtils.js'
import { sampleElevation } from '../lib/demSampling.js'
import { routeProgress } from '../lib/routeProgress.js'
import { cacheGet, cacheSet, kulturminneIdKey, TTL } from '../lib/protectedAreaCache.js'
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
// Wrapper-mål (brukes av pxToUserUnits i useSymbolRenderers + skalabaren).
const wrapperSize = ref({ w: 0, h: 0 })
function measureWrapper() {
  const r = wrapperRef.value?.getBoundingClientRect()
  if (r) wrapperSize.value = { w: r.width, h: r.height }
}


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
  // COUNT=5000 per typename uten paginering kan kutte stille i tette
  // havneområder — da er «OK — N features» en halv sannhet, og trunkeringen
  // skal stå i statusen så tallet ikke leses som fullstendig.
  const trunk = (s.trunkert ?? []).length
    ? ` · TRUNKERT: ${s.trunkert.map(t => `${t.typeName} ${t.returned}/${t.matched}`).join(', ')}`
    : ''
  switch (s.state) {
    case 'ok': return `OK — ${s.features} features (${s.source?.replace('https://wfs.geonorge.no/skwms1/', '') ?? 'ukjent kilde'})${trunk}`
    case 'innlands': return 'hoppet over (innlandskart)'
    case 'timeout': return `timeout etter ${Math.round((s.timeoutMs ?? 0) / 1000)} s — regenerer kartet for å prøve igjen`
    case 'feil': return 'nettverks-/CORS-feil — dybdetall og kaier mangler'
    default: return '0 features (utenfor dekning eller endret tjeneste)'
  }
})

// NVE-innsjø-utfall (Utvikler-fanen): innsjøene hentes live fra NVE
// Innsjødatabasen ved bygging — feiler den stille på mobil, er dette
// eneste sporet av HVORFOR innsjøer mangler (innsjøer borte-saken).
const nveInnsjoStatusText = computed(() => {
  if (!meta.value) return null
  const s = meta.value.nveInnsjoStatus
  // Kart bygd før v1.0.45 har ingen status — si det EKSPLISITT i stedet for å
  // skjule raden (en usynlig rad var umulig å skille fra «alt ok»).
  if (!s) return `ingen status — kartet er bygd med ${meta.value.appVersion ? 'v' + meta.value.appVersion : 'app eldre enn v1.0.45'}; bygg kartet på nytt`
  if (s.state === 'ok') {
    return `OK — ${s.features} innsjøer${s.retried ? ' (etter retry)' : ''}` +
      (s.truncated ? ' (AVKUTTET — noen kan mangle)' : '')
  }
  return `FEILET: ${s.message ?? 'ukjent feil'} — innsjøer mangler; bygg kartet på nytt`
})

// Turrutebasen-utfall (Utvikler-fanen). «nye» er tallet som betyr noe: hvor
// mange rutestrekk som faktisk kom i tillegg til OSM etter uttynningen —
// 0 nye av mange ruter betyr at OSM allerede dekket området, ikke en feil.
const turruteStatusText = computed(() => {
  if (!meta.value) return null
  const s = meta.value.turruteStatus
  if (!s) return 'ingen status — kartet er bygd før v5.0.2; bygg kartet på nytt'
  if (s.state === 'ok') {
    return `OK — ${s.ruter} merkede ruter, ${s.nye ?? 0} nye strekk (resten dekkes av OSM)`
  }
  return `FEILET: ${s.message ?? 'ukjent feil'} — merkede ruter mangler`
})

// N50-sti-utfall (Utvikler-fanen). «nye» er tallet som betyr noe: hvor mange
// strekk som kom i tillegg til OSM og Turrutebasen etter uttynningen.
const n50StiStatusText = computed(() => {
  if (!meta.value) return null
  const s = meta.value.n50StiStatus
  if (!s) return 'ingen status — kartet er bygd før v5.0.14; bygg kartet på nytt'
  if (s.state === 'ok') {
    if (!s.fliser) return 'ingen fliser her (utenfor N50-dekning)'
    return `OK — ${s.fliser} flis(er), ${s.linjer} linjer, ${s.nye ?? 0} nye strekk`
  }
  return `FEILET: ${s.message ?? 'ukjent feil'} — N50-stier mangler`
})

// Nasjonalparker som dekker kartet helt eller delvis. Slås opp lokalt mot det
// bundlede park-datasettet (ingen nettverk, virker offline) — derfor gjelder
// faktaboksen også kart som allerede er bygget. Parken tegnes aldri i kartet.
const nasjonalparker = ref([])
watch(() => meta.value?.bbox, async (bbox) => {
  if (!bbox) { nasjonalparker.value = []; return }
  const parker = await loadNasjonalparker()
  if (meta.value?.bbox !== bbox) return
  nasjonalparker.value = parksForBbox(parker, bbox)
}, { immediate: true })

const storedDem = ref(null)             // unpacked DEM, eller null hvis ikke tilgjengelig


const BUILTIN = {
  vardasen: { navn: 'Vardåsen · turkart', file: 'vardasen.svg' },
}

// Lag-styringen (synlige lag, presets, nullstill, dybde-lag og DOM-arbeidet)
// bor i useLagStyring.js. Lag-katalogen er delt med MCP-serveren — se
// lib/mapLayerCatalog.js. Tilbakekallene under er domener lag-bytte drar med
// seg; de eies av andre composables lenger ned i fila, og kalles først etter
// at oppsettet er ferdig.
const {
  visibleLayers, landLayerButtons, marineLayerButtons,
  activePreset, layersDirty,
  applyPreset, resetLayers, toggleLayer, toggleDepth,
  applyDepthLayer, applyLayerVisibility,
} = useLagStyring({
  svgHostRef,
  // Getter, ikke verdien: lista deklareres lenger ned i fila (TDZ ved oppsett)
  // OG re-tilordnes ved hvert kartbytte.
  detachedDetailLayers: () => detachedDetailLayers,
  hooks: {
    applyUprightLabels: () => applyUprightLabels(),
    scheduleNameLOD: () => scheduleNameLOD(),
    applyFredetKulturminneLayer: () => applyFredetKulturminneLayer(),
    applyKulturminneFallback: () => applyKulturminneFallback(),
    applyHydroStationLayer: () => applyHydroStationLayer(),
  },
})

// Tema: 'light' (default ISOM), 'dark', 'mono-sepia', 'mono-indigo', 'mono-slate'.
// isDark er derivert for steder som styrer UI-farger (toppbar, drawer-bg).
// Tilstanden bor i useMapTheme (delt singleton, lagret i localStorage) så
// Tema-fanen her og «Turkart i mørkt tema»-bryteren i hovedmenyen styrer det
// samme — og valget overlever at appen lukkes.
const { mapTheme: currentTheme, setMapTheme } = useMapTheme()
const isDark = computed(() => currentTheme.value !== 'light')
const THEMES = computed(() => listThemes(isomCatalog))
const diagnose = ref(false)

// Terreng-først: kartet ble vist med konturer+relieff straks, og OSM/detaljer
// fylles inn i bakgrunnen. Chip vises mens vi venter på full-byggingen.
const fillingInDetails = ref(false)
// Settes hvis bakgrunns-byggingen (Overpass) feilet → vis banner med «Prøv på
// nytt»-knapp i stedet for en teknisk, overflytende toast.
const detailsFailed = ref(false)
// Satt fra lagret entry (stored.partial): kartet ble aldri ferdig bygd (bygging
// avbrutt av reload/app-lukking) → viser bare terreng. MapView tilbyr «Fullfør» (B).
const mapIsPartial = ref(false)
// Offline-tilstand (reaktiv) — «Fullfør»/«Reparer» krever nett; knappene gråes ut.
const isOffline = ref(typeof navigator !== 'undefined' && navigator.onLine === false)
function updateOnlineState() { isOffline.value = navigator.onLine === false }
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
// Vises på «Kulturminner»-toggelen. null = vet ikke ennå (ingen innbakte ikoner,
// runtime-fallbacken har ikke svart); 0 = tjenesten svarte og området er tomt.
// Skillet kom i v4.8.6 — før var begge «(0)», og det leste brukeren som at
// funksjonen var borte.
const kulturminneCount = ref(null)
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


// Tekststørrelse i appen (drawer + info-ark): global, styres fra hovedmenyens
// «Tekststørrelse»-knapp (useUiTextScale). CSS `zoom` skalerer hele blokken —
// nødvendig fordi UI bruker faste Tailwind-px-størrelser som ikke arver
// container-font-size.
const { uiTextScale } = useUiTextScale()
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
  setMapTheme(key)
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
  // Kompass-FØLGE roterer kartet etter enhetens retning — å «nullstille til
  // nord» mens den er på gir ingen mening, så den slås av først (samme
  // semantikk som den gamle kompass-FAB-en, som denne knappen har absorbert).
  if (compass.isActive) compass.stop()
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

// Fredet-kulturminne-lag + brukerminne-fallback — flyttet til
// useHeritageLayers; meta-watchen under blir her.
const {
  fredetCount, fredetShown, fredetTruncated, fredetLoading, kulturminneStatus,
  applyFredetKulturminneLayer, applyKulturminneFallback,
  openFredetDetailFromEl, refreshFredetCount,
} = useHeritageLayers({
  svgHostRef, visibleLayers, meta,
  // Lazy wrapper: applyUprightLabels destruktureres fra useSymbolRenderers
  // lenger nede — direkte referanse her ville truffet TDZ ved setup.
  applyUprightLabels: (...a) => applyUprightLabels(...a),
  kulturminneCount,
  kulturminneDetail, kulturminneLoading, kulturminneOpen, kulturminneDrawer,
})
// Nytt kart lastet → nullstill og hent antall for badgen (liten WFS hits-spørring).
watch(meta, (m) => { fredetCount.value = null; fredetShown.value = null; refreshFredetCount(m) })
// Toast «mange arkeologiske kulturminner» — kun når laget er på og vi kappet.
const showFredetToast = computed(() =>
  fredetTruncated.value && visibleLayers.value.has('fredet-kulturminne'))

// Hydrologiske målestasjoner (NVE HydAPI) — eget togglebart lag (blå dråper).
const hydroOpen = ref(false)
const hydroLoading = ref(false)
const hydroDetail = ref(null)
const HYDRO_DRAWER_PEEK_PX = 76
const hydroDrawer = useDraggableDrawer({ expandedHeight: 0.45, minimizedPeek: HYDRO_DRAWER_PEEK_PX, maxTopGapPx: MAX_DRAWER_TOP_GAP_PX, allowMinimize: true })
const {
  hydroCount, hydroLoadingLayer,
  applyHydroStationLayer, openHydroDetailFromEl, refreshHydroCount,
} = useHydroStations({
  svgHostRef, visibleLayers, meta,
  applyUprightLabels: (...a) => applyUprightLabels(...a),
  hydroDetail, hydroLoading, hydroOpen, hydroDrawer,
})
watch(meta, (m) => { hydroCount.value = null; refreshHydroCount(m) })

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
const {
  scale, translateX, translateY, rotation, reset, panTo, rotateTo, animating, isGesturing,
} = usePinchZoom(wrapperRef, { enabled: pinchEnabled, panAtRest: true, minScale: () => mosaicMinScale() })

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

// Gest-jank-måler: teller rAF-frames under aktiv gest og logger til perf-loggen
// KUN når gesten faktisk hakket (snitt < 45 fps over ≥ 400 ms) — jevne gester
// støyer ikke ned ring-bufferen. Verste enkelt-frame-gap avslører om janken er
// jevnt tung raster eller enkeltstående main-thread-blokkeringer (GC, indeks-
// pass). Sammen med «[perf] åpne»-linjene gir dette mobil-budsjettet for økt
// kartstørrelse — leses fra PerfLogModal (Utvikler-fanen).
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
  if (durMs < 400 || gestFrames < 2) return
  const fps = gestFrames / (durMs / 1000)
  if (fps < 45) {
    logPerf(
      `[perf] gest ${(durMs / 1000).toFixed(1)}s ~${Math.round(fps)} fps ` +
      `(verste frame ${Math.round(gestWorstGap)}ms) @ ${(meta.value?.widthM ?? 0) / 1000}km`
    )
  }
})
onUnmounted(() => { if (gestRafId) { cancelAnimationFrame(gestRafId); gestRafId = 0 } })

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
// Perf: watcheren fyrer på hver pinch-frame, men trinnene endrer seg maks to
// ganger under en zoom. Hopp over querySelector + toggle når verken .zoomed-in
// eller .zoom-near krysser terskelen sin. Direkte kall (SVG-bytte i
// useMapLoadPipeline) applikerer fortsatt klassene på fersk SVG uavhengig.
let prevZoomTier = { zoomedIn: null, near: null }
watch(scale, (s) => {
  const zoomedIn = s >= ZOOMED_IN_THRESHOLD
  const near = s >= zoomNearThreshold.value
  if (zoomedIn === prevZoomTier.zoomedIn && near === prevZoomTier.near) return
  prevZoomTier = { zoomedIn, near }
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

// Standarder for NYE kart (forsidens søk/GPS-flyt): bredde-slider + format- og
// ekvidistanse-knapper i «Innstillinger»-fanen. null-bredde = DEFAULT_MAP_WIDTH_KM.
// Endrer ikke kartet som vises nå — kun neste nye kart.
const { mapSizeKm, mapFormat } = useMapSizePreference()
// Slider-binding: viser 10 km når intet er valgt; lagrer null når brukeren
// står på default (så en framtidig default-endring slår gjennom), ellers tallet.
const mapSizeSlider = computed({
  get: () => mapSizeKm.value ?? DEFAULT_MAP_WIDTH_KM,
  set: (v) => { mapSizeKm.value = (v === DEFAULT_MAP_WIDTH_KM ? null : v) },
})

// «Bygg om dette området i valgt størrelse» (Innstillinger-fanen): rebygger
// samme senter på nytt med valgt størrelse/format/ekvidistanse, så man kan
// teste samme sted uten å gå tilbake til forsiden. Lager et NYTT kart (ny id)
// og navigerer dit. «Nullstill» = 5 km kvadrat med 10 m ekvidistanse.
async function rebuildAtChosenSize(km = mapSizeKm.value) {
  const m = meta.value
  if (!m?.bbox || buildingOnTheFly.value) return
  const lat = (m.bbox.south + m.bbox.north) / 2
  const lon = (m.bbox.west + m.bbox.east) / 2
  const dims = {
    halfKm: (km ?? DEFAULT_MAP_WIDTH_KM) / 2,
    aspect: aspectForFormat(mapFormat.value),
  }
  closeDrawer()
  knobPanel.value = null
  buildingOnTheFly.value = true
  buildingProgress.value = 'Bygger om i valgt størrelse …'
  try {
    // Behold kartets navn (stedsnavn + dato, f.eks. «Mjøsa 19. juli») ved
    // ombygging. Navnet ligger i mapTitle (fra lagringen), IKKE i meta —
    // meta.navn er undefined, så det gamle `m.navn ?? 'Kart'` ga alltid «Kart».
    const keepName = mapTitle.value?.trim() || 'Kart'
    const { id } = await buildMapFromCenter({
      center: { lat, lon, name: keepName },
      ...dims,
      equidistanceM: effectiveEquidistanceForWidthKm(km),
      navn: keepName,
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

// Monokrom-temaene slår relieffet av automatisk — hillshade legger en
// gråtone-gradient over flatene og bryter nettopp det ensfargede uttrykket de
// er laget for. Dette er en TREDJE, IKKE-PERSISTERT bryter, med vilje: både
// reliefEnabled (per kart) og reliefStepIndex (globalt) lagres i localStorage,
// og temaet gjør IKKE det (det faller tilbake til 'light' ved reload). Et
// auto-av lagret i en av dem ville blitt liggende igjen etter at temaet var
// borte. Brukeren overstyrer via relieff-knotten, FAB-panelet eller
// Innstillinger-fanen — alle tre nullstiller flagget.
const reliefAutoOff = ref(false)
// Det render-koden faktisk skal se på. reliefEnabled beholdes som brukerens
// egen innstilling (og er den v-model-en UI-et skriver til).
const reliefActive = computed(() => reliefEnabled.value && !reliefAutoOff.value)
function clearReliefAutoOff() {
  if (!reliefAutoOff.value) return
  reliefAutoOff.value = false
  applyHillshade()
  void renderGhostTiles()
}

// Per-element strek-tuning (Strek-FAB-panelet, v12.0.18) — per kart med global
// standard. Effektive multiplikatorer injiseres som override-CSS i kart-SVG-en
// (applyStrokeOverrides) og ganges med den globale --stroke-scale-knotten.
const strokeTuning = useStrokeTuning()
// Top-level ref → auto-unwrap i template (nested refs unwrappes ikke).
const strokeEffective = strokeTuning.effective

// Sti-farger (Strek-FAB-panelet) — per kart med global standard, samme modell
// som strek-tuningen over. Tom overstyring = følg temaets sti-farger.
const trailColors = useTrailColors()
const trailColorsEffective = trailColors.effective
const trailColorsOverridden = trailColors.isOverridden

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

// Sti-farger: samme injeksjons-mønster som strek-overstyringen over, i en egen
// <style> så de to kan settes uavhengig. Ingen overstyring → blokken fjernes og
// temaets egne sti-farger gjelder igjen.
function applyTrailColors() {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return
  let el = svg.querySelector('#trail-color-style')
  const css = buildTrailColorCss(trailColors.effective.value)
  if (!css) { el?.remove(); return }
  if (!el) {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    el.setAttribute('id', 'trail-color-style')
    svg.appendChild(el)
  }
  el.textContent = css
}
watch(trailColors.effective, applyTrailColors)

// Fargen velgerne skal VISE når brukeren ikke har overstyrt: temaets sti-farge,
// ellers katalogens ISOM-default (svart strek, krem casing). Casingen faller i
// CSS tilbake på var(--bg), altså temaets bakgrunn — speiles her.
const trailColorSwatches = computed(() => {
  const t = isomCatalog.themes?.[currentTheme.value]
  const def = isomCatalog.categories?.manmade?.['505']
  return {
    fg: normalizeHex(trailColorsEffective.value.fg
      ?? t?.categories?.['505']?.stroke?.color ?? def?.stroke?.color, '#000000'),
    bg: normalizeHex(trailColorsEffective.value.bg
      ?? t?.background ?? def?.casingStroke?.color, '#fbf7ec'),
  }
})

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
// En bruker som rører av/på-bryteren (FAB-panelet eller Innstillinger-fanen)
// har uttalt seg om relieffet, og skal vinne over temaets auto-av.
watch(reliefEnabled, () => {
  reliefAutoOff.value = false
  applyHillshade()
  void renderGhostTiles()
  flashKnobHint(reliefEnabled.value ? 'Relieff på' : 'Relieff av')
})

// Relieff-stil bytte: fjern eksisterende relieff-lag (kan være feil element-type),
// nullstill bånd-cachen, bygg på nytt, og re-render mosaikken (spøkelses-relieff
// gates på modus i buildGhostSvg).
watch(reliefMode, () => {
  svgHostRef.value?.querySelector('svg #hillshade-layer')?.remove()
  invalidateReliefBands()
  applyHillshade()
  void renderGhostTiles()
  flashKnobHint(reliefMode.value === 'vektor' ? 'Skarpt relieff (vektor)' : 'Mjukt relieff (bilde)')
})

// Tap = step (wrap) / sentrer, lang-trykk (600 ms) = åpne FAB-ens innstillings-
// panel (v12.0.18 — erstattet lang-trykk-nullstill; nullstilling bor nå som
// egen knapp i panelene). Selve gest-håndteringen — settled-vakten,
// Samsung-pointercancel-en og avstands-avbruddet — bor i useLongPress via
// FabCluster fra v4.8.2. Her står bare hva et tap og et hold BETYR.
const knobPanel = ref(null)   // 'stroke' | 'relief' | 'zoom' | null

function onFabKnobTap(kind) {
  if (kind === 'stroke') {
    strokeStepIndex.value = (strokeStepIndex.value + 1) % STROKE_STEPS.length
  } else if (kind === 'relief') {
    // Auto-av fra et monokrom-tema er ment å være lett å angre: ett tap skrur
    // relieffet på igjen i stedet for å telle et hakk. Brukerens eget «av»
    // (reliefEnabled) beholder derimot dagens hold-for-innstillinger-vakt.
    if (reliefAutoOff.value) {
      clearReliefAutoOff()
      flashKnobHint('Relieff på')
      return
    }
    if (!reliefEnabled.value) { flashKnobHint('Relieff er av — hold for innstillinger'); return }
    reliefStepIndex.value = (reliefStepIndex.value + 1) % RELIEF_STEPS.length
  } else {
    onResetAndRefreshGps()
  }
}

function onFabKnobHold(kind) {
  closeDrawer()        // hovedmeny-skuffen viker for panelet (som ved long-press på kart)
  knobDrawer.reset()   // alltid åpne i standard-høyde (45 dvh)
  knobPanel.value = kind === 'center' ? 'zoom' : kind
}

// ── Lende-FAB som anker for knott-klyngen (v4.3.1, komponent v4.8.2) ──
// Fire knotter i hjørnet ble for voldsomt når chat-FAB-en kom til. Nå er
// Lende-knappen (app-logoen) eneste synlige knott; sentrer/strek/relieff
// er skjult som standard og springer ut fra ankeret med gummibånd-
// animasjon (sentrer mot nord, strek mot nordvest, relieff mot vest).
// Tap veksler knottene (ren toggle — v4.3.2 fjernet lukk-ved-kart-trykk
// etter brukertest: på/av på ankeret holder). Lang-trykk åpner
// Lende-chatten (kun med invitasjonstoken; uten token armeres ingen
// hold-timer, så lang-trykk gjør ingenting).
const lendeChatEnabled = hasAiToken()
const lendeLogoUrl = `${import.meta.env.BASE_URL}icon.svg`
const fabMenuOpen = ref(false)

// Knott-plassene: nord = «legg kartet der jeg trenger det», nordvest = «hva
// kartet tegner», vest = «hvordan kartet ser ut». Ruteplanleggeren bruker de
// samme plassene med sitt eget innhold, så gest og betydning holder på tvers.
const fabSatellites = computed(() => [
  {
    key: 'center', slot: 'n', hasPanel: true,
    label: userPos.isWatching
      ? 'Sentrer og nord opp + oppdater GPS — hold for innstillinger'
      : 'Sentrer og nord opp — hold for innstillinger',
  },
  {
    key: 'stroke', slot: 'nw', hasPanel: true,
    label: `Strektykkelse: nivå ${strokeStepIndex.value + 1} av ${STROKE_STEPS.length}`
      + ' — trykk for neste, hold for innstillinger',
  },
  {
    key: 'relief', slot: 'w', hasPanel: true, dimmed: !reliefActive.value,
    label: reliefActive.value
      ? `Relieff: nivå ${reliefStepIndex.value + 1} av ${RELIEF_STEPS.length}`
        + ' — trykk for neste, hold for innstillinger'
      : 'Relieff er av — hold for innstillinger',
  },
])

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
  trailColors.saveAsDefault()
  flashPanelHint('Lagret som standard for alle kart')
}
function trailColorsReset() {
  trailColors.resetColors()
  flashPanelHint('Sti-farger følger temaet igjen')
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

// Kompass-FAB-en (pointNorth) er fjernet (v1.0.77): «Sentrer»-knappen i FAB-
// stacken nullstiller allerede zoom OG rotasjon, og bærer nå kompassnåla som
// ikon. Kompass-FØLGE (heading-modus) toggles fortsatt via «Kompass»-knappen i
// Innstillinger-skuffen.

// Annoteringsmodus — point-symboler over auto-generert kart
const mapId = computed(() => route.params.id ?? 'vardasen')

// ── Gi kart nytt navn ─────────────────────────────────────────────────────
// Innebygde kart (Vardåsen) ligger ikke i lagringen og kan ikke gis nytt navn.
const canRenameMap = computed(() => !BUILTIN[mapId.value])
const renameOpen = ref(false)
function openRename() {
  if (canRenameMap.value) renameOpen.value = true
}
async function onRenameSave(navn) {
  const saved = await renameMap(mapId.value, navn)
  if (saved) mapTitle.value = saved
}
// Bind per-kart-overstyringene (navnetetthet, strek-tuning, relieff) til
// kartet som vises.
watch(mapId, (id) => {
  setDensityMap(id)
  strokeTuning.setCurrentMap(id)
  trailColors.setCurrentMap(id)
  reliefSettings.setCurrentMap(id)
}, { immediate: true })
const annot = useMapAnnotations(mapId.value)
// Stifinner — rutenavigasjon A→B på sti-laget. Egen modus-maskin (idle →
// pickingStart → showing); gjensidig utelukkende med måling/annotering.
// `dem`-getteren gjør hull-broingen i grafen terrengbevisst: et hull mellom to
// stier broes ikke når terrenget over det er for bratt å krysse (v5.6.0).
// storedDem hentes asynkront — useStifinner bygger grafen på nytt når den
// lander, og watchen under reberegner en rute som alt vises.
const sti = useStifinner({ dem: () => storedDem.value })
const mapCtx = useMapContext()
// Settes ved setupHostSvg: har kartet routbare sti-/vei-lag? Styrer om
// «Naviger hit» vises.
const mapHasTrails = ref(false)
const showSymbolPalette = ref(false)

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

// Globalt stedssøk (Kartverket SSR + Nominatim) PARALLELT med kart-søket:
// kart-søket ser bare navn i det rendrede SVG-et, så globale forslag vises
// alltid i tillegg («Andre steder») — velges ett, bygges et nytt kart der.
// At søkeordet også finnes i kartet er uviktig; det nye kartet får uansett
// navn etter treffet. Debounce/abort ligger i composablen.
const placeSearch = useNominatim({ debounceMs: 350 })
const globalResults = placeSearch.results
const globalSearching = placeSearch.isSearching
watch(searchQuery, (q) => {
  placeSearch.query.value = (q ?? '').trim().length >= 2 ? q : ''
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
// rebuildAtChosenSize) med brukerens standarder (størrelse/format/ekvidistanse).
async function onSelectGlobalPlace(hit) {
  if (buildingOnTheFly.value) return
  searchOpen.value = false
  mapSearch.clear()
  placeSearch.query.value = ''
  const widthKm = mapSizeKm.value ?? DEFAULT_MAP_WIDTH_KM
  const dims = { halfKm: widthKm / 2, aspect: aspectForFormat(mapFormat.value) }
  buildingOnTheFly.value = true
  buildingProgress.value = `Bygger kart ved ${hit.shortName} …`
  try {
    const { id } = await buildMapFromCenter({
      center: { lat: hit.lat, lon: hit.lon, name: hit.shortName },
      ...dims,
      equidistanceM: effectiveEquidistanceForWidthKm(widthKm),
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

// Navn-LOD (hvilke stedsnavn som får plass) — flyttet til useNavnLod.js.
// Kontrakten: alle navn forblir søkbare, geometri toggles aldri, og skjulingen
// bruker klassen `name-lod-off` (CSS nederst i denne fila) så eksport/print
// alltid viser alt.
const {
  forcedVisibleNameEls, labelBoxCache,
  resetPrevShownNames, applyNameLOD, scheduleNameLOD,
} = useNavnLod({
  svgHostRef, wrapperRef, meta,
  scale, rotation, translateX, translateY,
  // Getter: mapSearch-indeksen bygges om ved hvert kartbytte.
  searchIndex: () => mapSearch.index.value,
  zoomNearThreshold, zoomedInThreshold: ZOOMED_IN_THRESHOLD,
  nameBudgetFar, nameBudgetMid, nameBudgetNear,
  nameCellPx, nameK,
})

// Viewport-culling (skjul vektorer utenfor utsnittet) — flyttet til
// useViewportCull.js. Klassen `vp-cull` har samme eksport-kontrakt som
// `name-lod-off`; kill switch i Utvikler-fanen via toggleCull.
const {
  cullStats, cullDisabled, toggleCull,
  buildCullDomIndex, applyViewportCull, resetViewportCull,
} = useViewportCull({
  svgHostRef, wrapperRef, meta,
  scale, rotation, translateX, translateY, isGesturing,
})

// Hold ringen på konstant skjerm-størrelse ved zoom.
watch(scale, () => { if (highlightedFeature.value) renderHighlight() })


watch(() => proximity.active.value, () => renderProximityTarget(), { deep: true })
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
// Lende-chat-konteksten settes lenger ned (etter stiSelectedClimb) — watcheren
// trenger klatretallene, og en referanse hit oppe ga TDZ-krasj ved mount
// (v4.2.5-regresjonen: svart skjerm + tilbake til forsiden).
const { setChatContext, openChat } = useLendeChat()
onUnmounted(() => setChatContext(null))

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

// Lende-chat ber om en markering («kan du merke det»). Finner vi navnet i
// kartets egen søkeindeks, går vi gjennom selectSearchResult — da er resultatet
// per definisjon identisk med at brukeren valgte treffet i søket selv (navne-
// LOD-en låses opp, utsnittet panner dit, puls-ringen tegnes). Ellers merkes
// koordinatene direkte, som en delt sted-lenke.
const { kommando: merkeKommando } = useMapHighlight()
// Markering krever et lastet kart med ferdig søkeindeks — chatten spør om
// dette før den påstår at noe er merket.
watch(searchIndex, (idx) => publiserMerkeKlar((idx?.length ?? 0) > 0), { immediate: true })
onUnmounted(() => publiserMerkeKlar(false))
watch(merkeKommando, (cmd) => {
  if (!cmd) return
  if (cmd.fjern) { clearHighlight(); return }
  const match = cmd.navn ? findByName(mapSearch.index.value, String(cmd.navn)) : null
  if (match) { selectSearchResult(match); return }
  if (!meta.value || !Number.isFinite(cmd.lat) || !Number.isFinite(cmd.lon)) return
  const { x, y } = wgs84ToSvg(cmd.lat, cmd.lon, meta.value)
  highlightedFeature.value = {
    name: cmd.navn || 'Markert sted', sub: cmd.sub, x, y, kind: 'chat-merke',
  }
  panToSettled(x, y, {
    vbWidth: meta.value.widthM,
    vbHeight: meta.value.heightM,
    targetScale: Math.max(scale.value, zoomNearThreshold.value),
  })
  renderHighlight()
})

// Mottaker-side: en delt tur-lenke gjenskapes av useDeltTur, som eier
// TIMINGEN (rendret SVG, ferdig detalj-pass, tegnede spøkelsesfliser). Selve
// turen legges her, av den ekte modus-maskinen — resultatet skal være identisk
// med manuell inntasting. ?v3d=1 åpner 3D-visningen når ruta står.
function gjenskapTur(tour, svg) {
  const toSvg = (ll) => wgs84ToSvg(ll.lat, ll.lon, meta.value)
  if (tour.dest) {
    const d = toSvg(tour.dest)
    sti.begin({ svgX: d.x, svgY: d.y })
    const o = toSvg(tour.origin)
    sti.confirmStart({ x: o.x, y: o.y }, svg, { startOnWater: pointOnWater(o.x, o.y) })
    for (const v of tour.via.slice(0, sti.MAX_VIA)) {
      const p = toSvg(v)
      sti.beginAddVia()
      sti.confirmVia({ x: p.x, y: p.y }, svg)
    }
  } else {
    const o = toSvg(tour.origin)
    sti.beginLoop({ svgX: o.x, svgY: o.y })
    for (const v of tour.via.slice(0, sti.MAX_VIA)) {
      const p = toSvg(v)
      sti.confirmVia({ x: p.x, y: p.y }, svg)
    }
  }
  sti.selectRoute(tour.routeIdx)
  sti.follow()   // no-op hvis ruting feilet — banneret viser da feilen
  renderRoutes()
  if (tour.open3d && sti.routes.value.length) openTour3d()
}

// GPS og sporing (posisjonering, opptak, live-stats, høydeprofil, eksport) bor
// i useGpsSpor.js. Tegningen ligger i useSymbolRenderers, som trenger `tracker`
// herfra — derfor opprettes denne FØRST, og får renderTracks som et lat
// tilbakekall (det kalles bare når spor endres, altså etter oppsettet).
const {
  tracker,
  startPositioning, onRetryGps, gpsNow,
  liveTrackStats, onToggleRecording, onDeleteTrack, onExportTrackGpx,
  expandedTrackId, expandedTrack, profileFor,
} = useGpsSpor({
  mapId, meta, mapTitle, storedDem, userPos, compass,
  renderTracks: () => renderTracks(),
})

// Relieff-rendering — flyttet til useReliefRender; watchene blir her.
const { applyHillshade, reliefBlendMode, invalidateReliefBands } = useReliefRender({
  svgHostRef, meta, storedDem, ensureDem, currentTheme,
  reliefEnabled: reliefActive, reliefMode, reliefOpacity, RELIEF_BANDS,
})

// Spøkelses-fliser — flyttet til useGhostTiles.
const {
  ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC,
  renderGhostTiles, updateGhostReliefOpacity,
} = useGhostTiles({
  svgHostRef, meta, mapId, isAlive: () => componentAlive, isGesturing,
  reliefEnabled: reliefActive, reliefMode, reliefOpacity, reliefBlendMode, RELIEF_BANDS,
  applyLayerVisibility, clampPan,
})

// Re-render relieffet når DEM-en lastes eller temaet byttes (blend-modus
// avhenger av tema). Selve nivå-endringer håndteres av reliefStepIndex-watch.
watch([storedDem, currentTheme], () => { applyHillshade() })

// Må stå ETTER useGhostTiles: restore-timingen venter på at spøkelsesflisene
// dekker turens punkter, og leser `ghostRects` derfra.
const { maybeRestoreRoundTripFromQuery } = useDeltTur({
  route, meta, searchIndex, svgHostRef, ghostRects, fillingInDetails,
  sti, findByName, gjenskapTur,
})

// Måleverktøy — distanse + areal (v8.9.4). Aktiveres via knapp i drawer.
// Tap-på-kart i denne modusen plasserer vertices. Lukket polygon viser
// både omkrets og areal (hektar / km²).
const measureMode = ref(false)
const measureVertices = ref([])
const measureClosed = ref(false)

// Symbol-/overlay-rendererne — flyttet til useSymbolRenderers; watchene
// som kaller dem blir her.
const {
  pxToUserUnits, renderHighlight, renderProximityTarget, renderMeasure,
  renderRoutes, ensureAnnotationDefs, renderAnnotations,
  applyUprightLabels, roadRefUprightDeg, renderTracks, updateUserDot,
} = useSymbolRenderers({
  svgHostRef, wrapperRef, wrapperSize, scale, rotation,
  highlightedFeature, proximity,
  measureVertices, measureClosed,
  sti, onSelectRoute, annot, tracker, userPos, compass,
})

watch([measureVertices, measureClosed, scale], () => renderMeasure(), { deep: true })

// DEM-en kan komme ETTER at Stifinneren har regnet ut ruta (ensureDem er et
// nettverkskall). Da må grafen bygges på nytt med terreng-regelen og ruta
// reberegnes — ellers viser vi en rute som krysser et stup fordi høydedataene
// ikke hadde landet ennå. recompute() er en no-op under 'following'.
watch(storedDem, (dem) => {
  if (!dem || sti.mode.value !== 'showing') return
  sti.recompute()
  renderRoutes()
})
function startMeasure() {
  measureMode.value = true
  measureVertices.value = []
  measureClosed.value = false
  // Sørg for at annoterings-/stifinner-modus ikke konkurrerer om tap-eventet.
  // Rute i bruk (following) beholdes — måling skal kunne sameksistere med den.
  annot.selectedSymbol.value = null
  annot.isAnnotateMode.value = false
  if (sti.blocking.value) { sti.cancel(); renderRoutes() }
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

// Mosaikk + manuell utvidelse — flyttet til useMapExtend; watchene blir her.
const {
  buildingOnTheFly, buildingProgress, autoMapToast, currentMapIsAuto,
  drawerCoversCanvas, extendZonesVisible, activatableTile, mosaicGapCount,
  edgeHandles, hoveredDir, previewExtend, clearExtendPreview,
  showAutoMapToast,
  visibleCenterSvg, clientToSvg, svgToClient, scheduleActivatableCheck, autoMapModeBusy,
  autoMapBuildOpts, promoteTile, extendMap, armAutoMap,
  extendZonesBounds, teardownMapExtend,
  refreshMosaicGaps, repairMosaicGaps,
} = useMapExtend({
  wrapperRef, wrapperSize, meta, mapId, router,
  scale, rotation, translateX, translateY, isGesturing, panTo,
  loading, loadError, fillingInDetails,
  annot, measureMode, sti, searchOpen, showControls, drawer,
  ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC, renderGhostTiles,
  currentTheme, visibleLayers, userPos, maxTiles, refreshAutoTileCount,
  closeDrawer, closeSearch,
})
// Mosaikken endret seg (ny flis bygd / scroll-tilbake) → re-tell hull (C) så
// «Reparer»-banneret dukker opp/forsvinner i takt. Kanthåndtakene re-ankrer seg
// selv (edgeHandles er en computed over ghostRects + transform-tilstanden).
watch(ghostRects, () => { refreshMosaicGaps() }, { deep: true })
watch([scale, translateX, translateY, rotation], scheduleActivatableCheck)
// Starter brukeren en egen gest (wheel-zoom, pinch, pan) mens pilla står åpen,
// er den ikke lenger relevant — de ser på noe annet nå.
watch(isGesturing, (g) => { if (g && hoveredDir.value) clearExtendPreview() })
watch(extendZonesVisible, (v) => { if (!v && hoveredDir.value) clearExtendPreview() })
// Bygge-lås for SW-oppdatering: mens en flis bygges/utvides eller detaljer fylles
// inn, skal en «Oppdater»-reload vente (ellers etterlater den et hull i den
// halvbygde mosaikken). Blir byggingen ferdig med en oppdatering på vent, utfører
// setBuildBusy(false) reloaden da.
watch([buildingOnTheFly, fillingInDetails], ([b, f]) => setBuildBusy(b || f), { immediate: true })
onUnmounted(() => setBuildBusy(false))

// ── Gjenoppta-ved-app-start (v1.0.12) ────────────────────────────────────
// Husk sist brukte modus/kart + utsnitt (senter/zoom/rotasjon), så router.js
// kan gjenopprette nøyaktig visning når appen startes på nytt etter
// inaktivitet. Debounced — skriver først når visningen har roet seg.
let viewSaveTimer = null
function scheduleViewSave() {
  if (viewSaveTimer) clearTimeout(viewSaveTimer)
  viewSaveTimer = setTimeout(() => {
    viewSaveTimer = null
    if (!meta.value) return
    const c = visibleCenterSvg()
    if (!c) return
    try {
      localStorage.setItem(`lende-view:${mapId.value}`, JSON.stringify({
        x: +c.x.toFixed(1), y: +c.y.toFixed(1),
        scale: +(scale.value || 1).toFixed(3),
        rotation: +(rotation.value || 0).toFixed(1),
        isAuto: currentMapIsAuto.value,
      }))
    } catch { /* noop */ }
  }, 800)
}
watch([scale, translateX, translateY, rotation], scheduleViewSave)
watch(mapId, (id) => {
  try {
    localStorage.setItem('lende-last-mode', 'kart')
    localStorage.setItem('lende-last-map', id)
  } catch { /* noop */ }
}, { immediate: true })

// ── Long-press kontekstmeny — flyttet til useContextLookups ─────────────
// Inset-refene og de detachede detalj-lagene blir her (setupHostSvg
// re-tilordner detachedDetailLayers, og useDetailInset bruker dem).
const contextSheetRef = ref(null)      // bottom-sheet-elementet (for into-focus)
const detailInsetRef = ref(null)       // mini-SVG detalj-inset i bottom-sheeten
const DETAIL_INSET_M = 1000            // 1×1 km roambart vindu rundt punktet
// Detalj-lag (data-detail="1") løftet UT av hovedkartets DOM i setupHostSvg
// (perf — de er usynlige der men kostet parse/recalc/clone). Inset-en kloner
// inn herfra. Erstattes ved hver setupHostSvg (nytt kart = nye noder).
let detachedDetailLayers = []

// Deklarert FØR useContextLookups-kallet (closeContextMenu lukker panelet).
const proximityPanelOpen = ref(false)

const {
  contextMenuOpen, contextMenuPoint, contextMenuInfo,
  lakeQuery, verneQuery, naturtypeQuery, placeWikiCard, expandedRedCat,
  clearLongPress, clientToSvgPoint, openContextMenuAt, closeContextMenu,
  onPointerDownLongPress, onPointerMoveLongPress, onPointerUpLongPress,
  onContextMenuEvent,
  pointOnFreshwater, pointOnWater, findWaterFeatureAtPoint,
  sourceLabel, naturtypeVerdiClass, formatVernedato, formatCount,
  redListCats, redListGroups, toggleRedCat, formatAreaKm2, formatVolum,
  contextActionState, flashContextAction,
} = useContextLookups({
  svgHostRef, wrapperRef, meta, storedDem, ensureDem, userPos, searchIndex,
  buildingOnTheFly, searchOpen, fillingInDetails, sti, scale, mapSearch,
  contextDrawer, mapId, closeDrawer, knobPanel, proximityPanelOpen, clientToSvg,
})

// Utgående deling (kart, sted, tur) — plassert HER fordi den trenger
// kontekstmenyens punkt-info, som deklareres rett over. Se useKartDeling.js.
const {
  shareInfo, shareState,
  buildShareUrl, performShare,
  onShareMap, onShareMapWithPlace, onShareMapWithContextPlace, onShareRoundTrip,
} = useKartDeling({
  meta, mapTitle,
  kartId: () => route.params.id ?? 'vardasen',
  erInnebygd: (id) => !!BUILTIN[id],
  highlightedFeature, contextMenuInfo, closeContextMenu, sti,
})


// ── FAB-klyngens ark-regel (v4.8.2) ──────────────────────────────────
// Klyngen står fast nederst til høyre, dokker rett over en minimert peek-kant,
// og forsvinner når et ark er dratt opp. Før løftet vi bare for Innstillinger
// (`calc(45dvh + 0.75rem)` — feil i to av tre ark-tilstander), mens
// infopanelet dekket klyngen stille: samme z-40, men senere i DOM. Nå mates
// ALLE arkene inn, også hjelpe-arkene som aldri var med i den ad hoc-e
// gjensidige utelukkelsen. Deklarert her fordi contextMenuOpen kommer fra
// useContextLookups over.
const fabFloat = useFloatAboveSheets(
  () => [
    { open: showControls, drawer },
    { open: contextMenuOpen, drawer: contextDrawer },
    { open: () => !!knobPanel.value, drawer: knobDrawer },
    { open: kulturminneOpen, drawer: kulturminneDrawer },
    { open: hydroOpen, drawer: hydroDrawer },
  ],
  {
    mapWidthPx: () => wrapperSize.value.w,
    // På desktop er Innstillinger et sidepanel, ikke et ark: klyngen beholder
    // bunnen og skyves i stedet til venstre for panelet (floatRightStyle).
    panelMode: () => isDesktop.value && showControls.value,
  }
)


// Hvilke parker faktaboksen faktisk skal vise. Trykker du INNE i en
// nasjonalpark, svarer Naturbase-oppslaget med samme park — og det kortet er
// rikere (rødlistearter, leksikon-lenke). Da hadde vi to grønne bokser med
// samme innhold; parken lukes derfor bort her. Faktaboksen står igjen for det
// den er til: kartet dekker en park, men punktet du trykket på ligger utenfor
// den — eller Naturbase er utilgjengelig (offline på tur), der det lokale
// datasettet er eneste kilde.
//
// Under selve oppslaget ('loading') holdes boksen igjen: å vise den og så
// bytte den ut med Naturbase-kortet et sekund senere leser som en glitch.
const nasjonalparkerVist = computed(() => {
  const q = verneQuery.value
  if (q?.status === 'loading') return []
  const area = q?.status === 'done' ? q.area : null
  if (!area) return nasjonalparker.value
  return nasjonalparker.value.filter(p => !samePark(p, area))
})


// ── Nærhetsvarsel (proximity alert) ──────────────────────────────────────
// Inline config-panel i kontekst-draweren. Lokal redigerings-state speiler
// proximity.prefs (sist brukte valg) til brukeren bekrefter med «Aktiver».
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
  void ensureDem()
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
  void ensureDem()
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
// «Bruk rute»: gå til following-modus (kartet slippes fri, boksen blir pill).
// GPS startes i samme bruker-gest så fremdriften langs ruta vises straks —
// startPositioning er idempotent og feil håndteres av eksisterende GPS-toast.
function onFollowRoute() {
  sti.follow()
  startPositioning()
  renderRoutes()
}
function onStopFollowing() {
  sti.stopFollowing()
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

// ── Snarvei-rad (mest brukte funksjoner) ──────────────────────────────────
// Stifinner/rundtur fra snarveien: sikt inn punktene med kikkertsiktet — FØRST
// startpunktet, så målet (B/origo) — i motsetning til long-press-inngangen.
// Måling/annotering av.
function stifinnerReset() {
  void ensureDem()          // terreng-regelen i hull-broingen trenger DEM
  measureMode.value = false
  annot.isAnnotateMode.value = false
  annot.selectedSymbol.value = null
  renderMeasure()
  closeContextMenu()
  closeDrawer()
}
function onShortcutStifinner() {
  stifinnerReset()
  sti.beginPickStart()
}
function onShortcutRoundTrip() {
  stifinnerReset()
  sti.beginPickLoop()
}
// Bekreft mål (B) = skjermsenteret. Startpunktet er alt valgt (snarvei-
// inngangen plukker start FØR mål) → ruter beregnes og tegnes nå.
function onConfirmDest() {
  const c = visibleCenterSvg()
  if (!c) return
  sti.confirmDest(c)
  renderRoutes()
}
// Bekreft rundtur-origo = skjermsenteret → videre til vendepunkt-plukk.
function onConfirmLoopOrigin() {
  const c = visibleCenterSvg()
  if (!c) return
  sti.confirmLoopOrigin(c)
}
function onShortcutMeasure() {
  measureMode.value || startMeasure()
  activeTab.value = 'maaling'
  openDrawer()
}
// Sporing hadde en egen snarvei her til v5.1.0. Plassen gikk til 3D-utforskeren;
// selve sporingen er uendret og styres fra «Sporing»-fanen i innstillinger.
function onShortcut3d() {
  openExplore3d()
}
// Info om stedet: åpne kontekst/info-arket på kartets senter (supplement til
// long-press). openContextMenuAt tar skjerm-koordinater.
function onShortcutInfo() {
  const el = wrapperRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  infoTipRequested.value = true
  openContextMenuAt(r.left + r.width / 2, r.top + r.height / 2)
}

// Long-press er lite oppdagbart. Vis et blått tips øverst i info-arket når det
// åpnes via Info-snarveien — men IKKE ved faktisk long-press (da kan brukeren
// det allerede). infoTipRequested settes kun av snarveien og nullstilles så
// snart en kart-gest (mulig long-press) starter. Dismissible, husket globalt
// i localStorage så det ikke dukker opp igjen.
const INFO_TIP_KEY = 'lende-info-longpress-tip-seen'
const infoTipDismissed = ref(false)
try { infoTipDismissed.value = localStorage.getItem(INFO_TIP_KEY) === '1' } catch {}
const infoTipRequested = ref(false)
const showInfoTip = computed(() =>
  infoTipRequested.value && contextMenuOpen.value && !infoTipDismissed.value
)
function dismissInfoTip() {
  infoTipDismissed.value = true
  try { localStorage.setItem(INFO_TIP_KEY, '1') } catch {}
}
function onMapPointerDownLongPress(e) {
  infoTipRequested.value = false
  onPointerDownLongPress(e)
}
function onMapContextMenuEvent(e) {
  infoTipRequested.value = false
  onContextMenuEvent(e)
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
  if ((sti.mode.value !== 'showing' && sti.mode.value !== 'following') || !dem) return []
  return sti.routes.value.map((r) => {
    if (!r?.coordinates?.length) return null
    const prof = sampleProfile({ points: r.coordinates.map(c => ({ x: c[0], y: c[1] })) }, dem)
    return prof ? { ascent: prof.totalAscent, descent: prof.totalDescent } : null
  })
})
const stiSelectedClimb = computed(() => stiRouteClimbs.value[sti.selectedRouteIdx.value] ?? null)

// Lende-chat (KI): fortell assistenten hvilket kart brukeren ser på — pluss
// den aktive Stifinner-/Runde-ruta (aktivTur), så oppfølgingsspørsmål («hvor
// mange høydemeter?») besvares fra data i stedet for nye verktøykall. Flettes
// inn i system-prompten ved hvert send (useLendeChat). MÅ stå etter
// stiSelectedClimb (immediate-watch — TDZ ellers).
watch([shareInfo, mapTitle, () => sti.mode.value, () => sti.routes.value,
       () => sti.selectedRouteIdx.value, stiSelectedClimb,
       () => userPos.latRaw, () => userPos.lonRaw], ([s, tittel]) => {
  const ctx = s ? {
    visning: 'turkart',
    kartId: route.params.id ?? null,
    kartnavn: tittel || 'Uten navn',
    senter: { lat: +s.lat.toFixed(5), lon: +s.lon.toFixed(5) },
    stoerrelseKm: s.sizeKm,
    ekvidistanseM: s.equidistanceM,
  } : null
  // Brukerens GPS-punkt (blå prikk) — gjør «fra min posisjon» mulig i chatten.
  if (ctx && Number.isFinite(userPos.latRaw) && Number.isFinite(userPos.lonRaw)) {
    ctx.brukerPosisjon = { lat: +userPos.latRaw.toFixed(6), lon: +userPos.lonRaw.toFixed(6) }
  }
  const rute = ctx && (sti.mode.value === 'showing' || sti.mode.value === 'following')
    ? sti.routes.value[sti.selectedRouteIdx.value] : null
  if (rute) {
    const climb = stiSelectedClimb.value
    ctx.aktivTur = {
      type: sti.isLoop.value ? 'rundtur' : 'fottur',
      lengdeM: Math.round(rute.lengthM),
      stigningM: climb ? Math.round(climb.ascent) : null,
      fallM: climb ? Math.round(climb.descent) : null,
      estimertGangtidMin: sti.estWalkMinutes(rute.lengthM, climb),
    }
  }
  setChatContext(ctx)
}, { immediate: true })

// Fremdrift langs fulgt rute (following-modus): GPS-posisjonen prosjekteres på
// rute-polylinjen. Monotont anker (stiPrevAlongM) løser rundtur-tvetydigheten
// der start == mål — seedes til 0 ved følge-start så turen begynner på 0 m,
// og oppdateres kun når brukeren faktisk er på ruta (≤100 m unna).
const stiProgress = ref(null)
let stiPrevAlongM = null
watch([() => userPos.svgX, () => userPos.svgY, () => sti.mode.value,
       () => sti.selectedRouteIdx.value], () => {
  if (sti.mode.value !== 'following') {
    stiProgress.value = null
    stiPrevAlongM = null
    return
  }
  const r = sti.routes.value[sti.selectedRouteIdx.value]
  if (!r?.coordinates?.length || userPos.svgX == null || userPos.isOutsideMap) {
    stiProgress.value = null
    return
  }
  const p = routeProgress(r.coordinates, userPos.svgX, userPos.svgY,
    { prevAlongM: stiPrevAlongM ?? 0 })
  stiProgress.value = p
  if (p && p.offRouteM <= 100) stiPrevAlongM = p.alongM
})

// Web-zoom som matcher gjeldende visnings bakkeoppløsning (SVG-viewBox-meter
// pr rendret px, inkl. pinch-zoom via getBoundingClientRect) — så eksterne
// kart (UT.no, Vegkart via hovedmenyen) åpner på omtrent samme utsnitt.
function currentViewWebZoom(lat) {
  try {
    const svg = svgHostRef.value?.querySelector('svg')
    const vb = svg?.viewBox?.baseVal
    const rect = svg?.getBoundingClientRect()
    if (vb?.width && rect?.width) return utNoZoomForMPerPx(vb.width / rect.width, lat)
  } catch { /* fall tilbake til default-zoom */ }
  return UTNO_DEFAULT_ZOOM
}
// Punkt-provider for hovedmenyens eksterne karttjenester: synlig kartsenter
// som lat/lon + web-zoom. Registrert så lenge denne visningen lever.
function menuMapPoint() {
  const m = meta.value
  const c = visibleCenterSvg()
  if (!m || !c) return null
  const { lat, lon } = svgToWgs84(c.x, c.y, m)
  return { lat, lon, zoom: currentViewWebZoom(lat) }
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
const ctxBusy = computed(() => measureMode.value || tracker.isRecording.value || sti.blocking.value)
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
// svgToClient (ren forover-matte, browser-uavhengig — matcher clientToSvg som
// fanget punktet), oversatt til wrapperRef-rommet.
const contextPinElRef = ref(null)
function positionContextPin() {
  const el = contextPinElRef.value
  if (!el) return
  const p = contextMenuPoint.value
  const wrap = wrapperRef.value?.getBoundingClientRect()
  if (!p || !contextMenuOpen.value || !wrap) return
  const scr = svgToClient(p.svgX, p.svgY)   // viewport (skjerm)-koordinat
  if (!scr) return
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

// ── 3D-visning ──────────────────────────────────────────────────────────
// Hele domenet — pin-ene, dataklargjøringen (inkl. utvidet utsnitt for turer
// utenfor aktiv flis) og viewerens livssyklus — bor i use3dEntry.js.
const {
  view3dOpen, view3dLoading, view3dComp, view3dData, tour3dError,
  tour3dPinVisible, tour3dEndPinVisible, tour3dPinElRef, tour3dEndPinElRef,
  gpsFor3d, tour3dEstWalk,
  openTour3d, openExplore3d, close3d,
} = use3dEntry({
  meta, storedDem, searchIndex, svgHostRef, wrapperRef, animating,
  scale, translateX, translateY, rotation,
  sti, userPos, svgToClient, ensureDem,
})


// Detalj-inset (lupe) — flyttet til useDetailInset; watch-en blir her.
const { buildDetailInset } = useDetailInset({
  detailInsetRef, svgHostRef, contextMenuPoint, detachedDetailLayers,
  rotation, roadRefUprightDeg, meta, DETAIL_INSET_M,
})

// isMaximized er med fordi inset-verten er v-if-gated på maksimert skuffe
// (unngår dobbelt crosshair-utsnitt) — elementet finnes først da.
watch([contextMenuOpen, contextMenuPoint, () => contextDrawer.isMaximized.value], async () => {
  if (!contextMenuOpen.value) return
  await nextTick()
  buildDetailInset()
})

// Søke-overlayet er også z-40 og ville stacket med FAB-klyngen; høydeprofil-
// modalen har eget scrim over den. Begge fjerner klyngen helt.
// (MERK: må stå ETTER expandedTrack — watch under evaluerer kilden med én
// gang, og en tidligere plassering ga TDZ-krasj ved oppstart.)
const fabHidden = computed(() =>
  fabFloat.hidden.value || searchOpen.value || !!expandedTrack.value
)

// Blir klyngen borte, skal den ikke stå åpen når den kommer tilbake.
watch(fabHidden, (hidden) => { if (hidden) fabMenuOpen.value = false })

watch(() => annot.annotations.value, () => renderAnnotations(), { deep: true })

// Lilla ring rundt symbolene er en hint for at man er i annoteringsmodus
// — re-render når modusen toggles slik at ringen forsvinner ut av modus.
// Per-type visibility (Annoteringer-laget) trigger også re-render.
watch(() => annot.isAnnotateMode.value, () => renderAnnotations())
watch(() => annot.visibleTypes.value, () => renderAnnotations())

// Re-render symboler (annoteringer + bruker-pos dot + spor) når pinch-zoom
// endrer seg, slik at de holder konstant skjerm-størrelse uansett zoom-nivå.
// Perf: IKKE midt i en gest — hver av disse gjør en full layer.replaceChildren()-
// ombygging, og med aktivt spor-opptak ble det merkbar jank per pinch-frame.
// Symbolene skalerer med kart-transformen mens gesten varer (samme aksepterte
// avvik som strek-/relieff-perf-modus) og snapper til riktig skjerm-størrelse
// straks gesten slipper (gest-slutt-watcheren under).
watch(scale, () => {
  if (isGesturing.value) return
  renderAnnotations(); updateUserDot(); renderTracks()
})
// Gest-slutt: snapp de skjerm-konstante/opprett-orienterte symbolene tilbake til
// riktig størrelse/vinkel etter at de fikk følge kart-transformen under gesten.
// Bare det som faktisk endret seg bygges om: ren panorering endrer verken zoom
// eller rotasjon → ingen om-bygging (bevarer pan-billigheten fra før). Endret
// zoom → spor/annoteringer/prikk (skjerm-størrelse). Endret rotasjon ELLER en
// annoterings-om-bygging → applyUprightLabels (replaceChildren nullstiller
// pin-orienteringen, så den må re-appliseres når annoteringene er bygd om).
let gestureStartScale = null
let gestureStartRotation = null
watch(isGesturing, (g) => {
  if (g) {
    gestureStartScale = scale.value
    gestureStartRotation = rotation.value
    return
  }
  const scaleChanged = scale.value !== gestureStartScale
  const rotationChanged = rotation.value !== gestureStartRotation
  if (scaleChanged) { renderAnnotations(); updateUserDot(); renderTracks() }
  if (scaleChanged || rotationChanged) applyUprightLabels()
})

// Tracks: re-render når spor endres, stil endres, eller synlighet toggles.
// Deep watch på tracks fordi vi pusher nye punkter inn i samme array under
// opptak (~hvert 5. m).


// Klikk på kart i annoteringsmodus → plasser symbol
function onMapClick(e) {
  // Annotering deferres mens et ferskt kart fyller inn detaljer eller bygges
  // on-the-fly — pan/zoom/rotasjon er fri, men symbol-plassering venter til
  // kartet er ferdig (unngår plassering på et halvbygd / snart-erstattet kart).
  if (fillingInDetails.value || buildingOnTheFly.value) return
  // Kulturminne-ikon tappet → åpne detalj-skuff (uavhengig av verktøy, men ikke
  // mens et aktivt plasserings-/måle-/stifinner-verktøy eier tappet).
  if (!measureMode.value && !annot.isAnnotateMode.value && !sti.blocking.value) {
    const kmHit = e.target?.closest?.('[data-kulturminne-id]')
    if (kmHit) { openKulturminneDetail(kmHit); return }
    const fmHit = e.target?.closest?.('[data-fredet-id]')
    if (fmHit) { openFredetDetailFromEl(fmHit); return }
    const hydroHit = e.target?.closest?.('[data-hydro-station-id]')
    if (hydroHit) { openHydroDetailFromEl(hydroHit); return }
  }
  // Stifinner eier tap-eventet mens den er interaktiv (blocking): startpunkt
  // velges via det faste midt-siktet (bekreft-knapp), og rute-tapp håndteres
  // av egne DOM-listenere på rute-linjene. I following-modus er kartet fritt.
  if (sti.blocking.value) return
  // Måleverktøy har prioritet over annotering siden brukeren eksplisitt
  // har slått det på (annoteringsmodus blir tvunget av i startMeasure).
  const local = clientToSvg(e.clientX, e.clientY)
  if (!local) return
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



watch([() => sti.routes.value, () => sti.selectedRouteIdx.value, () => sti.mode.value,
       () => sti.via.value, scale],
  () => renderRoutes(), { deep: true })


function selectSymbol(key) {
  annot.selectedSymbol.value = annot.selectedSymbol.value === key ? null : key
  annot.isAnnotateMode.value = annot.selectedSymbol.value !== null
}


// Watch rotasjon — counter-roterer alle <text>/pins så de står rett opp. Perf:
// itererer 1000+ noder og skriver transform per endring, så vi hopper over det
// midt i en rotasjons-gest (labels vippes med kartet og snapper opp ved gest-
// slutt, jf. gest-slutt-watcheren) og kjører kun på hvile-endringer (f.eks.
// programmatisk reset til 0).
watch(rotation, () => { if (!isGesturing.value) applyUprightLabels() })


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

// Print- / eksport-handlers. 3D-vieweren gjenbruker samme markup som
// eksporten (tema baket inn) men uten kolofon — linjal/målestokk skal ikke
// drapes på terrenget. `theme` overstyrer gjeldende tema (3D-nattmodus baker
// 'dark'-temaet uansett 2D-valg). `extent` (utvidet tur, se tourExtent.js)
// beholder nabo-flisene og utvider viewBoxen så teksturen dekker hele turen.
function mapSvgMarkupForExport({ colophon = true, theme = null, extent = null } = {}) {
  const svg = svgHostRef.value?.querySelector('svg')
  if (!svg) return ''
  // Eksport/print = det OPPRINNELIGE kartet (én A-format-flis), ikke mosaikken.
  // Klon og fjern spøkelses-naboflisene (#ghost-tiles) før serialisering så
  // utskriften blir det print-tilpassede utsnittet brukeren genererte — med
  // viewBox/print-mm fra den aktive flisa alene. (user-layer m.fl. strippes av
  // printExport.stripRuntimeOverlays.)
  const clone = svg.cloneNode(true)
  if (extent) {
    // Utvidet 3D-tur: behold nabo-flisene og utvid viewBoxen til union-
    // utsnittet. width/height settes i px med nytt aspekt — print-mm-attrs
    // har flisas gamle aspekt og ville letterboxe rasteret (UV-feil i 3D).
    clone.setAttribute('viewBox', `${extent.minX} ${extent.minY} ${extent.widthM} ${extent.heightM}`)
    const k = Math.min(1, 3000 / Math.max(extent.widthM, extent.heightM))
    clone.setAttribute('width', String(Math.round(extent.widthM * k)))
    clone.setAttribute('height', String(Math.round(extent.heightM * k)))
  } else {
    clone.querySelector('#ghost-tiles')?.remove()
  }
  // Temaet lever som CSS-variabler på mapInnerRef og bakgrunnsfarge på
  // wrapperRef — begge UTENFOR <svg>, så en ren klone falt tilbake på
  // symbolizerens lyse ISOM-defaults uansett valgt tema. Bak derfor temaet inn
  // i klonen: variablene som en <style>, pluss et bakgrunns-rect bakerst.
  // Rect-et er redundant for kart bygget med dagens symbolizer (som har
  // `#bakgrunn rect { fill: var(--bg, …) }`), men dekker eldre lagrede kart
  // uten den regelen. Sti-farger og strek-overstyringer ligger allerede inne i
  // SVG-en og følger med av seg selv.
  const themeKey = theme ?? currentTheme.value
  const themeCss = buildThemeCss(themeKey)
  const bg = isomCatalog.themes?.[themeKey]?.background
  if (bg) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    // %-verdier posisjonerer fra (0,0) — et extent-viewBox starter på minX/minY,
    // så bakgrunnen må settes i absolutte koordinater der.
    rect.setAttribute('x', String(extent?.minX ?? 0))
    rect.setAttribute('y', String(extent?.minY ?? 0))
    rect.setAttribute('width', extent ? String(extent.widthM) : '100%')
    rect.setAttribute('height', extent ? String(extent.heightM) : '100%')
    rect.setAttribute('fill', bg)
    clone.insertBefore(rect, clone.firstChild)
  }
  if (themeCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.setAttribute('id', 'tema-eksport')
    style.textContent = themeCss
    clone.appendChild(style)
  }
  // Kolofon nederst til venstre (v2.4.20): linjal, målestokk, ekvidistanse og
  // «Så i lende · <kart> · <dato>». Ligger HER, i den delte eksport-markupen,
  // så alle fire utgangene (SVG/PNG/PDF/print) får den — en fil eller et ark
  // har ingen app rundt seg til å vise tallene.
  if (!colophon) return clone.outerHTML
  return withColophon(clone.outerHTML, { meta: meta.value, title: mapTitle.value })
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

// Kart-laste-pipelinen — flyttet til useMapLoadPipeline.
const { loadMap, retryMapDetails } = useMapLoadPipeline({
  route, router, svgHostRef, meta, storedDem, mapId, mapTitle, mapDataSize,
  loading, loadError, isAlive: () => componentAlive, isGesturing, scale, rotation, panTo,
  BUILTIN, kulturminneCount, mapHasTrails, currentMapIsAuto,
  fillingInDetails, detailsFailed, mapIsPartial, buildingOnTheFly, buildingProgress,
  visibleLayers, currentTheme, applyTheme,
  applyLayerVisibility, applyDepthLayer, applyNameLanguage,
  applyStrokeScale, applyStrokeOverrides, applyTrailColors, applyLabelScale, applyLabelFonts,
  applyHillshade, applyZoomTierClasses, applyUprightLabels, applyNameLOD,
  applyViewportCull, buildCullDomIndex, resetViewportCull,
  forcedVisibleNameEls, labelBoxCache, resetPrevShownNames,
  renderGhostTiles, renderAnnotations, renderTracks,
  renderMeasure, renderProximityTarget, refreshAutoTileCount,
  computePoiAvailability, maybeHighlightFromQuery, maybeRestoreRoundTripFromQuery, mapSearch,
  annot, tracker, sti, userPos, restoreProximityAlert,
  detachedDetailLayers, showAutoMapToast, armAutoMap,
  reliefStepIndex, FRESH_RELIEF_MIN_IDX,
})


watch(
  () => [userPos.svgX, userPos.svgY, userPos.accuracyM],
  () => updateUserDot()
)


const equidistanceLabel = computed(() => {
  if (!meta.value) return ''
  const eq = meta.value.equidistance
  if (eq) return `Høydekurver pr ${eq} m`
  if (meta.value.contoursSkipped) return 'Høydekurver: kun på innebygde kart'
  return 'Høydekurver ikke tilgjengelig'
})

// Størrelsesforholdet kartet er BYGD for («1:10 000»). Vises i punkt-skuffen —
// linjal-boksen over kartet holder bare selve linjalen (v2.4.20).
const printScaleLabel = computed(() => (
  meta.value?.scaleDenom ? `1:${formatDenom(meta.value.scaleDenom)}` : ''
))

// Provenens som sto i attribusjons-boksen nede til høyre i kartet (fjernet
// v2.4.26): ISOM-variant, DEM-kilde/-oppløsning og — når Sjøkart-WFS faktisk
// leverte — dybde-kilden. Slås opp i punkt-skuffen, ikke lest mens du går.
const mapSourceLabel = computed(() => {
  const m = meta.value
  if (!m) return ''
  const parts = []
  if (m.isomVersion) parts.push(`ISOM ${m.isomVersion}`)
  if (m.demSource) parts.push(`DEM: ${m.demSource}${m.demResolutionM ? ` · ${m.demResolutionM} m` : ''}`)
  if (m.depthSource === 'sjokart') parts.push('Dybde: Sjøkart')
  return parts.join(' · ')
})

// Dybde-advarselen er sikkerhets-info, ikke provenens: den fragile Sjøkart-WFS
// faller stille tilbake til DEM-estimatet, og en padler må vite at dybden da er
// gjettet. Derfor egen, uthevet linje — aldri gjemt i kilde-listen over.
const depthEstimateWarning = computed(() => (
  meta.value?.depthSource === 'dem-estimat' ? 'Dybde: estimat — ikke for navigasjon' : ''
))

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
  const newT = isomCatalog.themes?.[newTheme]
  const oldT = isomCatalog.themes?.[oldTheme]
  if (newT?.autoHideLayers) {
    visibleLayers.value = new Set(['kontur'])
  } else if (oldT?.autoHideLayers) {
    visibleLayers.value = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
  }
  applyLayerVisibility()
  // Monokrom-temaene vil ha rene flater — slå relieffet av automatisk, og på
  // igjen når man går ut. Flagget er ikke persistert (se reliefAutoOff), så
  // brukerens egen relieff-innstilling er urørt og gjelder straks temaet
  // forlates. Watchen på [storedDem, currentTheme] kaller applyHillshade().
  reliefAutoOff.value = !!newT?.monochrome
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


const gpsDebugLine = computed(() => {
  if (!userPos.isWatching) return ''
  if (userPos.error) return 'Ingen GPS-posisjon'
  if (userPos.latRaw == null || userPos.lonRaw == null) return 'Venter på GPS-signal …'
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
  // MapView rakk å montere → gjenopptaket til dette kartet lyktes (ikke blank).
  // Fjern boot-loop-vernets flagg (satt i router.js) så et neste normalt
  // gjenopptak ikke feilaktig hoppes over.
  try { localStorage.removeItem('lende-boot-pending') } catch { /* noop */ }
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
  window.addEventListener('online', updateOnlineState)
  window.addEventListener('offline', updateOnlineState)
  loadMap()
  screenWake.start()
  mapCtx.register(menuMapPoint, mapTitle.value)
})
// Hovedmenyens snarvei-blokk skriver «Åpne <sted> i» — hold navnet i sync med
// kart-tittelen (settes ved lasting og ved «Gi nytt navn»).
watch(mapTitle, (t) => mapCtx.setPlaceName(t))

onUnmounted(() => {
  unlockBodyScroll()
  // GPS-tikkeren ryddes av useGpsSpor selv.
  screenWake.stop()
  stopPanSettle()
  tabResizeObs?.disconnect()
  wrapperResizeObs?.disconnect()
  componentAlive = false
  window.removeEventListener('online', updateOnlineState)
  window.removeEventListener('offline', updateOnlineState)
  desktopMq?.removeEventListener('change', updateIsDesktop)
  if (skeletonTimer) clearTimeout(skeletonTimer)
  if (loadPillTimer) clearTimeout(loadPillTimer)
  teardownMapExtend()
  if (viewSaveTimer) clearTimeout(viewSaveTimer)
  mapCtx.unregister(menuMapPoint)
})
</script>

<template>
  <div class="kart-ui relative w-full h-[100dvh] overflow-hidden"
       :class="isDark ? 'bg-surface' : 'bg-stone-100'">

    <!-- Toppbar. v8.7.1: skjult i Curve Invaders-modus — den lå tidligere
         halvveis bak game-HUD-en, og hamburger-knappen i høyre hjørne var
         delvis klikkbar med uønskede effekter (drawer åpnet seg midt i
         spillet). Skjuler hele toppbaren, matcher kompass-rosen og andre
         map-only UI som allerede har samme v-if. -->
    <!-- Toppbaren krympes til den synlige kart-flaten på desktop (høyre kant =
         panelbredden) så den midtstilte tittel-badgen re-sentreres responsivt
         når side-panelet endrer bredde, og søke-/meny-knappene ikke havner bak
         panelet. Mobil/lukket: full bredde (panelOffsetPx = 0). -->
    <div class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pb-3
                pointer-events-none transition-[right] duration-200"
         :style="{ right: panelOffsetPx + 'px',
                   paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }">
      <div class="flex items-center gap-2 pointer-events-auto">
        <AppMenuButton variant="float" />
      </div>

      <button v-if="canRenameMap" @click="openRename"
              aria-label="Gi kart nytt navn"
              class="pointer-events-auto px-3 py-1.5 rounded-full bg-overlay
                     text-[12px] text-ink font-medium shadow-lg max-w-[42%]
                     flex items-center gap-1.5 active:scale-95 transition">
        <span class="truncate">{{ mapTitle }}</span>
        <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0 text-ink/50" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
      </button>
      <div v-else class="pointer-events-none px-3 py-1.5 rounded-full bg-overlay
                  text-[12px] text-ink font-medium shadow-lg max-w-[42%] truncate">
        {{ mapTitle }}
      </div>

      <div class="flex items-center gap-2 pointer-events-auto">
        <button @click="openSearch" aria-label="Søk i kart"
                class="rounded-full w-10 h-10 flex items-center justify-center
                       bg-overlay text-ink shadow-lg active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="20" y1="20" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <button @click="openDrawer" aria-label="Innstillinger"
                class="rounded-full w-10 h-10 flex items-center justify-center
                       bg-overlay text-ink shadow-lg active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Snarvei-rad: de mest brukte kart-funksjonene (stifinner, rundtur,
         måling, sporing, info om stedet). Skjules når en modus (stifinner/måling/
         annotering) eller søk er aktiv, mens kartet bygges/utvides, og når
         highlight-pillen vises — bygge-chipen og pillen bruker samme
         --ovl-top-slot og ville kollidert. -->
    <div v-if="!sti.active.value && !measureMode && !searchOpen && !annot.isAnnotateMode.value
               && !buildingOnTheFly && !fillingInDetails && !highlightedFeature"
         class="absolute -translate-x-1/2 top-[var(--ovl-top)] z-20 pointer-events-none
                transition-[left] duration-200"
         :style="mapCenterStyle">
      <div class="pointer-events-auto flex items-stretch gap-1 px-1.5 py-1.5 rounded-2xl
                  bg-overlay/90 backdrop-blur shadow-lg">
        <button @click="onShortcutStifinner" class="shortcut-btn" aria-label="Stifinner">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>Stifinner</span>
        </button>
        <button @click="onShortcutRoundTrip" class="shortcut-btn" aria-label="Gå en runde">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/></svg>
          <span>Runde</span>
        </button>
        <button @click="onShortcutMeasure" class="shortcut-btn" aria-label="Måling">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>
            <line x1="6.4" y1="17.6" x2="17.6" y2="6.4" stroke-dasharray="2 2.5"/></svg>
          <span>Måling</span>
        </button>
        <button @click="onShortcut3d" class="shortcut-btn" aria-label="Se kartet i 3D">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>
            <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>
          <span>3D</span>
        </button>
        <button @click="onShortcutInfo" class="shortcut-btn" aria-label="Informasjon om stedet">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="8" r="0.6" fill="currentColor"/></svg>
          <span>Info</span>
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
      :ui-text-scale="uiTextScale"
      @keydown="onSearchKeydown"
      @close="closeSearch"
      @select="selectSearchResult"
      @select-global="onSelectGlobalPlace" />

    <!-- Kompass-FAB-en er fjernet (v1.0.77) — nåla bor nå som ikon på
         «Sentrer»-knappen i FAB-stacken (som uansett nullstiller rotasjonen).
         Containeren består for desktop-sliderne + kompass-feilmelding. -->
    <div class="absolute top-[var(--ovl-rose)] z-20 pointer-events-auto select-none flex flex-col items-end
                transition-[right] duration-200"
         :style="floatRightStyle">
      <div v-if="compass.error"
           class="text-[10px] text-red-300 mt-1 max-w-[80px] text-right leading-tight
                  px-1.5 py-0.5 rounded bg-overlay">
        {{ compass.error }}
      </div>
      <!-- Rotasjons-slider (kun desktop/uten touch — touch roterer med to fingre).
           −180…180°, midtstilt = 0 (kart-nord opp). Roterer rundt viewport-senter.
           Dobbeltklikk = nullstill til nord. -->
      <div v-if="!hasTouch"
           class="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-overlay
                  shadow-lg select-none">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-ink/55 shrink-0" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/>
        </svg>
        <input type="range" min="-180" max="180" step="1" :value="rotationSliderDeg"
               @input="onRotateSlider" @dblclick="rotateTo(0)"
               aria-label="Roter kartet (dobbeltklikk = nullstill til nord)"
               class="w-24 accent-sky-400 cursor-pointer" />
        <span class="text-[10px] text-ink/55 tabular-nums w-9 text-right">{{ rotationSliderDeg }}°</span>
      </div>
      <!-- Tekststørrelse-slider (kun desktop, søsken til rotasjons-sliden).
           −100…100 med midtstilt = normal (100%); skala 0.5×…2.0×. Brukeren
           kan både øke og minske størrelsen på alle kart-etiketter (navn,
           høyde, stedsnavn, naturreservat, vann osv). Dobbeltklikk = normal.
           På mobil vises ingen slider — pinch holder til zoom. -->
      <div v-if="!hasTouch"
           class="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-overlay
                  shadow-lg select-none">
        <svg viewBox="0 0 28 24" class="w-4 h-3.5 text-ink/55 shrink-0" fill="currentColor">
          <text x="0" y="20" font-size="12" font-weight="800" font-family="ui-sans-serif, sans-serif">A</text>
          <text x="11" y="20" font-size="20" font-weight="800" font-family="ui-sans-serif, sans-serif">A</text>
        </svg>
        <input type="range" :min="LABEL_SCALE_MIN" :max="LABEL_SCALE_MAX" step="1"
               v-model.number="labelScaleSlider" @dblclick="labelScaleSlider = 0"
               aria-label="Tekststørrelse på kart-etiketter (dobbeltklikk = normal)"
               class="w-24 accent-sky-400 cursor-pointer" />
        <span class="text-[10px] text-ink/55 tabular-nums w-9 text-right">{{ labelScalePct }}%</span>
      </div>
    </div>

    <!-- FAB-klynge (v4.3.1, egen komponent v4.8.2): Lende-knappen er eneste
         synlige knott og anker for sentrer/strek/relieff. Tap = vis/skjul (alle
         brukere); lang-trykk = Lende-chat (kun med token). Plassering og
         synlighet mot bunn-arkene styres av useFloatAboveSheets — dokker over
         en minimert peek-kant, forsvinner når et ark er dratt opp.
         Ikonene ligger her som slots: kompassnåla og bue-indikatorene er
         kart-spesifikke og skal ikke generaliseres inn i komponenten. -->
    <FabCluster
      v-model:open="fabMenuOpen"
      :satellites="fabSatellites"
      :chat-enabled="lendeChatEnabled"
      :bottom="fabFloat.bottomStyle.value"
      :right-style="floatRightStyle"
      :hint="knobHint"
      :hidden="fabHidden"
      :logo-url="lendeLogoUrl"
      @tap="onFabKnobTap"
      @hold="onFabKnobHold"
      @chat="openChat">

      <!-- Sentrer (nord, v1.0.77): nåla roterer med kompass-heading eller
           kartrotasjon. Liten GPS-prikk (v8.5.2) viser at knappen også
           refresher posisjonen. -->
      <template #center>
        <svg viewBox="-50 -50 100 100" class="w-8 h-8"
             :style="{ transform: compass.isActive && compass.headingDeg !== null
                                  ? `rotate(${-compass.headingDeg}deg)`
                                  : `rotate(${rotation}deg)`,
                       transition: 'transform 0.2s linear' }">
          <circle r="44" fill="none" stroke="currentColor" stroke-width="4" opacity="0.35"/>
          <polygon points="0,-40 10,0 0,12 -10,0" fill="#ef4444"/>
          <polygon points="0,40 10,0 0,-12 -10,0" fill="currentColor" opacity="0.85"/>
        </svg>
        <span v-if="userPos.isWatching"
              class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.8)]" />
      </template>

      <!-- Strek (nordvest): bua viser nivå, senter-streken tegnes i faktisk
           valgt tykkelse. -->
      <template #stroke>
        <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none">
          <path :d="knobTrackD" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" opacity="0.22"/>
          <path :d="strokeArcD" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
          <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor"
                :stroke-width="strokeGlyphW" stroke-linecap="round"/>
        </svg>
      </template>

      <!-- Relieff (vest): senter-bumpens skygge følger nivået. Knotten dimmes
           (ikke skjules) når relieff er av — dimmed-flagget i fabSatellites. -->
      <template #relief>
        <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none">
          <path :d="knobTrackD" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" opacity="0.22"/>
          <path :d="reliefArcD" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
          <path d="M6.5 15.5 L9.5 10 L11.8 12.8 L14.3 8.5 L17.5 15.5 Z"
                fill="currentColor" :fill-opacity="reliefGlyphOpacity"
                stroke="currentColor" stroke-width="0.8" stroke-linejoin="round"/>
        </svg>
      </template>
    </FabCluster>

    <!-- Kart-flate. Unified transform (translate ∘ rotate ∘ scale) på ett
         enkelt indre div. Lar finger-pivot styre rotasjons-/zoom-senter
         (v8.9.2). -->
    <div ref="wrapperRef" class="absolute inset-0 touch-none select-none transition-[right] duration-200"
         :class="annot.isAnnotateMode.value ? 'cursor-crosshair' : ''"
         :style="{ right: panelOffsetPx + 'px' }"
         @pointerdown="onMapPointerDownLongPress"
         @pointermove="onPointerMoveLongPress"
         @pointerup="onPointerUpLongPress"
         @pointercancel="onPointerUpLongPress"
         @contextmenu="onMapContextMenuEvent">
      <div ref="mapInnerRef" class="w-full h-full relative" :style="mapTransformStyle">
        <div ref="svgHostRef" class="w-full h-full" @click="onMapClick"></div>
      </div>
      <!-- Long-press-sikte: HTML-overlay UTENFOR pinch-transformen (søsken av det
           transformerte mapInnerRef), så størrelsen er en LITERAL CSS-piksel-
           verdi som ikke kan skaleres/blåses opp av zoom. Posisjoneres via
           positionContextPin (svgToClient). 34px boks, sentrert på punktet. -->
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

      <!-- «3D»-pin i BEGGE ender av ruta (stifinner/rundtur valgt): HTML-
           overlay UTENFOR pinch-transformen, samme mønster som long-press-
           siktet over. Flyter rett over start- og målprikken. -->
      <button v-show="tour3dPinVisible"
              ref="tour3dPinElRef"
              @click="openTour3d"
              aria-label="Vis turen i 3D"
              class="absolute top-0 left-0 z-[7] pointer-events-auto flex items-center gap-1
                     rounded-full bg-gray-900/90 text-white text-[11px] font-bold
                     pl-2 pr-2.5 py-1 shadow-lg border border-white/25 active:scale-90
                     transition-transform"
              style="margin-left:-26px;margin-top:-46px;">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>
        </svg>
        3D
      </button>
      <button v-show="tour3dEndPinVisible"
              ref="tour3dEndPinElRef"
              @click="openTour3d"
              aria-label="Vis turen i 3D"
              class="absolute top-0 left-0 z-[7] pointer-events-auto flex items-center gap-1
                     rounded-full bg-gray-900/90 text-white text-[11px] font-bold
                     pl-2 pr-2.5 py-1 shadow-lg border border-white/25 active:scale-90
                     transition-transform"
              style="margin-left:-26px;margin-top:-46px;">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>
        </svg>
        3D
      </button>

      <!-- Kanthåndtak: 8 runde knapper på ARKETS kant som henter nye kartfliser.
           Ligger UTENFOR pinch-transformen (søsken av mapInnerRef) så knapp,
           hårlinje og pille holder ekte skjermstørrelse, mens ankeret følger
           arket når det vokser, panoreres eller roteres. -->
      <MapEdgeHandles v-if="extendZonesVisible"
                      :handles="edgeHandles"
                      :hovered="hoveredDir"
                      @preview="previewExtend"
                      @clear="clearExtendPreview"
                      @commit="extendMap" />
    </div>

    <!-- Stifinner: fast midt-kikkertsikte mens startpunkt velges. Brukeren
         panorerer kartet til siktet står på ønsket start, så «Bekreft». Ligger
         over kartet (pointer-events none) sentrert i kart-flaten (samme right-
         offset som wrapperen så det treffer visibleCenterSvg). -->
    <div v-if="['pickingStart', 'pickingVia', 'pickingDest', 'pickingOrigin'].includes(sti.mode.value)"
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
    <!-- «Bekreft»-knapp (mål-, start-, origo- eller via-plukk). -->
    <div v-if="['pickingStart', 'pickingVia', 'pickingDest', 'pickingOrigin'].includes(sti.mode.value)"
         class="absolute left-1/2 -translate-x-1/2 z-30 transition-[left] duration-200"
         :style="[mapCenterStyle, { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }]">
      <button @click="sti.mode.value === 'pickingVia' ? onConfirmVia()
                      : sti.mode.value === 'pickingDest' ? onConfirmDest()
                      : sti.mode.value === 'pickingOrigin' ? onConfirmLoopOrigin()
                      : onConfirmStart()"
              class="px-5 py-3 rounded-full text-white text-[14px] font-semibold
                     shadow-lg active:scale-95 flex items-center gap-2"
              :class="sti.mode.value === 'pickingVia' ? 'bg-amber-500' : 'bg-emerald-600'">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 L9 17 L4 12"/>
        </svg>
        {{ sti.mode.value === 'pickingVia'
            ? (sti.isLoop.value ? 'Bekreft vendepunkt' : 'Bekreft via-punkt')
            : sti.mode.value === 'pickingDest' ? 'Bekreft mål'
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
      :share-state="shareState"
      :sti-elevation-diff-m="stiElevationDiffM"
      :sti-route-climbs="stiRouteClimbs"
      :sti-selected-climb="stiSelectedClimb"
      :sti-progress="stiProgress"
      :gps-watching="userPos.isWatching"
      :proximity="proximity"
      @clear-highlight="clearHighlight"
      @stop-measure="stopMeasure"
      @select-route="onSelectRoute"
      @remove-via="onRemoveVia"
      @begin-add-via="onBeginAddVia"
      @cancel-stifinner="onCancelStifinner"
      @follow-route="onFollowRoute"
      @stop-following="onStopFollowing"
      @share-round-trip="onShareRoundTrip"
      @start-gps="startPositioning"
      @open3d="openTour3d" />

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
      :map-is-partial="mapIsPartial && !buildingOnTheFly && !fillingInDetails"
      :mosaic-gap-count="(buildingOnTheFly || fillingInDetails) ? 0 : mosaicGapCount"
      :is-offline="isOffline"
      :show-low-accuracy="showLowAccuracyBanner"
      :accuracy-m="userPos.accuracyM ?? 0"
      :fredet-truncated="showFredetToast"
      :fredet-count="fredetCount ?? 0"
      :fredet-shown="fredetShown ?? 0"
      @retry-load="loadMap"
      @dismiss-outside="dismissOutsideMap"
      @dismiss-details="detailsFailed = false"
      @retry-details="retryMapDetails"
      @complete-partial="retryMapDetails"
      @repair-mosaic="repairMosaicGaps"
      @dismiss-low-accuracy="dismissLowAccuracy"
      @retry-gps="onRetryGps" />

    <!-- Linjal + OSM-kreditt — trekt ut til MapScaleAttribution (v1.0.8).
         Målestokk/ekvidistanse (v2.4.20) og ISOM/DEM/dybde-provenens (v2.4.26)
         står i punkt-skuffen, ikke her. -->
    <MapScaleAttribution
      :visible="!loading && !searchOpen"
      :scale-bar="scaleBar" />

    <!-- Kontrollpanel (drawer). Desktop (≥768px): høyrestilt fullhøyde side-
         panel (som illustrasjons-sporet). Mobil: dragbart bunn-ark. -->
    <Transition :name="isDesktop ? 'drawer-side' : 'drawer'">
      <div v-if="showControls"
           :class="['absolute z-30 backdrop-blur-md bg-surface/92 flex flex-col shadow-2xl',
                    isDesktop
                      ? 'top-0 right-0 bottom-0 border-l border-ink/10'
                      : 'drawer-shell inset-x-0 bottom-0 border-t border-ink/10 rounded-t-2xl']"
           :style="isDesktop
                     ? { width: panel.width.value + 'px', transition: panel.isResizing.value ? 'none' : undefined }
                     : drawer.drawerHeightStyle.value">
        <!-- Desktop: dra-bar venstrekant for å justere panelbredden (360px–50vw). -->
        <div v-if="isDesktop"
             class="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-10 cursor-col-resize group"
             @pointerdown="panel.onResizeStart($event)">
          <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-ink/10
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
            <div class="w-12 h-1.5 rounded-full bg-ink/40"
                 :style="{ opacity: drawer.handleOpacity.value }"></div>
          </div>
          <div class="px-4 pb-2 flex items-center justify-between"
               :class="isDesktop ? 'pt-3' : ''">
            <div class="text-ink text-sm font-semibold">Innstillinger</div>
            <div class="flex items-center gap-1">
              <button @pointerdown.stop @click.stop="closeDrawer"
                      class="w-8 h-8 -mr-1 rounded-full flex items-center justify-center
                             text-ink/70 active:bg-ink/10">
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Hurtigvalg: alltid synlig over fanene (v8.9.6). Tegnforklaring +
             GPS/kompass-toggles trengs hyppig uavhengig av aktiv fane. Følger
             global tekststørrelse (zoom) som fanene og fane-innholdet under. -->
        <div class="shrink-0 px-4 pb-2 grid grid-cols-3 gap-1.5" :style="{ zoom: uiTextScale }">
          <button @click="router.push('/tegnforklaring')"
                  class="px-2 py-2 rounded-lg bg-ink/5 border border-ink/10 text-ink/80
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
                          ? 'bg-sky-500/20 border-sky-400/50 text-ink'
                          : 'bg-ink/5 border-ink/10 text-ink/80'">
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
                          ? 'bg-sky-500/20 border-sky-400/50 text-ink'
                          : 'bg-ink/5 border-ink/10 text-ink/80'">
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
             class="shrink-0 mx-4 mb-2 flex items-stretch border-b border-ink/10"
             :style="{ zoom: uiTextScale }">
          <!-- Pil venstre -->
          <button type="button" @click="scrollTabs(-1)"
                  :disabled="!canScrollTabsLeft"
                  aria-label="Vis faner til venstre"
                  class="shrink-0 px-1 flex items-center transition-colors"
                  :class="canScrollTabsLeft
                          ? 'text-ink/70 active:scale-90 cursor-pointer'
                          : 'text-ink/15 cursor-default'">
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
                            ? 'text-ink border-b-2 border-slate-200'
                            : 'text-ink/40'">
              {{ tab.label }}
            </button>
          </div>

          <!-- Pil høyre -->
          <button type="button" @click="scrollTabs(1)"
                  :disabled="!canScrollTabsRight"
                  aria-label="Vis faner til høyre"
                  class="shrink-0 px-1 flex items-center transition-colors"
                  :class="canScrollTabsRight
                          ? 'text-ink/70 active:scale-90 cursor-pointer'
                          : 'text-ink/15 cursor-default'">
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
            :kulturminne-status="kulturminneStatus"
            :fredet-loading="fredetLoading" :fredet-count="fredetCount"
            :hydro-loading="hydroLoadingLayer" :hydro-count="hydroCount" :meta="meta" />

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
            :rebuild-at-chosen-size="rebuildAtChosenSize"
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
            :cull-stats="cullStats" :cull-disabled="cullDisabled" :toggle-cull="toggleCull"
            :sjokart-status-text="sjokartStatusText"
            :nve-innsjo-status-text="nveInnsjoStatusText"
            :turrute-status-text="turruteStatusText"
            :n50-sti-status-text="n50StiStatusText" :meta="meta"
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
      :trail-swatches="trailColorSwatches"
      :trail-colors-overridden="trailColorsOverridden"
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
      @set-trail-color="(role, v) => trailColors.setColor(role, v)"
      @reset-trail-colors="trailColorsReset"
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

    <!-- Hydrologisk målestasjon (NVE HydAPI) — blått tema, sanntidsverdier. -->
    <HydroStationSheet
      :open="hydroOpen"
      :detail="hydroDetail"
      :loading="hydroLoading"
      :drawer="hydroDrawer"
      @close="hydroOpen = false" />

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
      :nasjonalparker="nasjonalparkerVist"
      :naturtype-query="naturtypeQuery"
      :place-wiki-card="placeWikiCard"
      :expanded-red-cat="expandedRedCat"
      :map-data-label="mapDataLabel"
      :print-scale-label="printScaleLabel"
      :equidistance-label="equidistanceLabel"
      :map-source-label="mapSourceLabel"
      :depth-estimate-warning="depthEstimateWarning"
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
      :format-area-km2="formatAreaKm2"
      :format-volum="formatVolum"
      :format-vernedato="formatVernedato"
      :format-count="formatCount"
      :red-list-cats="redListCats"
      :red-list-groups="redListGroups"
      :toggle-red-cat="toggleRedCat"
      :source-label="sourceLabel"
      :naturtype-verdi-class="naturtypeVerdiClass"
      :on-share-map="onShareMap"
      :on-share-map-with-context-place="onShareMapWithContextPlace"
      :on-navigate-here="onNavigateHere"
      :on-round-trip-here="onRoundTripHere"
      :on-start-measure-here="onStartMeasureHere"
      :toggle-proximity-panel="toggleProximityPanel"
      :arm-proximity-alert="armProximityAlert"
      :start-positioning="startPositioning"
      :nearest-poi-from-point="nearestPoiFromPoint"
      :on-place-annotation-from-context="onPlaceAnnotationFromContext"
      :show-info-tip="showInfoTip"
      :dismiss-info-tip="dismissInfoTip" />

    <!-- Perf-logg-modal: byggetider fra localStorage (kun utvikler).
         Trekt ut til PerfLogModal (v1.0.5). -->
    <PerfLogModal v-model:open="showPerfLog" />

    <!-- Gi kart nytt navn (bunn-ark) -->
    <RenameMapDialog
      v-model:open="renameOpen"
      :navn="mapTitle"
      @save="onRenameSave" />

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
           class="absolute top-[var(--ovl-top)] left-1/2 -translate-x-1/2 z-[60] px-3 py-1.5 rounded-2xl
                  bg-overlay/90 text-ink text-[12px] font-medium shadow-lg backdrop-blur
                  flex items-center gap-2 pointer-events-none border border-ink/10 max-w-[85%]
                  transition-[left] duration-200"
           :style="mapCenterStyle">
        <span class="w-3.5 h-3.5 rounded-full border-2 border-ink/25 border-t-ink/80 animate-spin shrink-0"></span>
        <span class="truncate">{{ buildingProgress || 'Oppretter kart …' }}</span>
      </div>
    </Transition>

    <!-- 3D-visning: fullskjerm-viewer (Teleport til body inne i komponenten).
         Samme komponent uansett dør — med `tour` står den planlagte ruta klar,
         uten den er 3D en fri utforsking av kartet. Chunk-en (inkl. three)
         lastes lazily — spinner mens den hentes. -->
    <div v-if="view3dOpen && view3dLoading"
         class="fixed inset-0 z-[219] bg-black/70 flex flex-col items-center justify-center gap-3 text-white/85">
      <span class="w-9 h-9 rounded-full border-2 border-white/25 border-t-white animate-spin"></span>
      <span class="text-[13px]">Laster 3D-visning …</span>
    </div>
    <component :is="view3dComp"
               v-if="view3dOpen && !view3dLoading && view3dComp && view3dData"
               :dem="view3dData.dem"
               :meta="view3dData.meta"
               :search-index="view3dData.searchIndex"
               :path-features="view3dData.pathFeatures"
               :barrier-features="view3dData.barrierFeatures"
               :brukerminner="view3dData.brukerminner"
               :tour="view3dData.tour"
               :est-walk-minutes="tour3dEstWalk"
               :get-svg-text="(opts) => mapSvgMarkupForExport({ colophon: false, theme: opts?.dark ? 'dark' : null, extent: view3dData.extent })"
               :is-dark="isDark"
               :user-pos="gpsFor3d"
               @close="close3d" />

    <Transition name="chip-fade">
      <div v-if="tour3dError"
           class="absolute bottom-24 left-1/2 -translate-x-1/2 z-[60] px-3 py-2 rounded-xl
                  bg-red-600/95 text-white text-[12px] font-medium shadow-lg max-w-[85%]">
        {{ tour3dError }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Snarvei-rad-knapp: ikon over liten etikett, mørk flytende pille. */
.shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 54px;
  padding: 6px 8px;
  border-radius: 12px;
  color: var(--color-ink);
  font-size: 10px;
  line-height: 1;
  transition: background 0.15s ease, transform 0.1s ease;
  /* Snarvei-etikettene er ett kort ord hver — de skal aldri orddeles/brytes
     («Stifin-ner»). Overstyrer det globale hyphens: auto på #app. */
  hyphens: manual;
  white-space: nowrap;
}
.shortcut-btn:active { transform: scale(0.94); }
.shortcut-btn:hover { background: color-mix(in oklab, var(--color-ink) 8%, transparent); }

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
/* FAB-klyngens .fab-sat-geometri og hint-boblens fade bor i FabCluster.vue
   fra v4.8.2. */
/* Full-screen loader */
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

/* Perf: content-visibility lar nettleseren HOPPE OVER layout/paint av av-skjerm
   bucket-geometri (de merge-de data-bbox-pathene) helt selv, kontinuerlig og fra
   første paint — uten JS. Utfyller viewport-cullingen (.vp-cull, som kjøres ved
   gest-slutt og gir det harde display:none-kuttet): c-v tar det løpende arbeidet
   mellom cull-passene, og gjør større kart lettere å rendre. Empirisk verifisert
   i Chromium: engasjerer på SVG <path>, skjuler når pan/zoom-transformen skyver
   pathen ut av utsnittet, og synlige paths rendres piksel-identisk (den impliserte
   `contain: paint` klipper ikke geometrien). Ekskluderer [data-name]-paths
   (søkeindeksens getBBox måler dem — en skippet path ville gitt (0,0)) og treffer
   kun ren geometri (ikke tekst/symbol-grupper). Lever her, IKKE i SVG-ens egen
   <style>, så eksport/print (cloneNode.outerHTML) fortsatt rendrer HELE kartet.
   Ukjent i eldre Safari (< 18) → egenskapen ignoreres, trygt no-op. */
.isom-map [data-layer] path[data-bbox]:not([data-name]) { content-visibility: auto; }

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

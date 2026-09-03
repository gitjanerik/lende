<script setup>
// Kart- og rute-biblioteket: fane-veksler, «Mine kart» med lag-nytt-flyten, og
// «Mine ruter» med del/stjerne/slett. Trukket ut av MapHomeView (v2.4.16) fordi
// hovedmenyen nå åpner de samme listene som modal — forsiden og modalen deler
// denne komponenten i stedet for å duplisere 500 linjer liste-logikk.
//
// Verten eier ramme, padding, scroll og tekst-skalering; her ligger innholdet.
import { ref, computed, watch, onMounted, onActivated, onUnmounted, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import { listMaps, deleteMap, clearAll, renameMap, listGravelRoutes, deleteGravelRoute, updateGravelRoute } from '../lib/mapStorage.js'
import { importerKartPakke } from '../lib/kartImport.js'
import { PAKKE_FILENDELSE, lesefeilPaaNorsk } from '../lib/kartPakke.js'
import { arkExtentFor } from '../lib/tileCache.js'
import { routeShareToken, MAX_SHARE_ROUTES } from '../lib/routeShare.js'
import RenameMapDialog from './RenameMapDialog.vue'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { useMapSizePreference, effectiveEquidistanceForWidthKm, defaultMapDims, aspectForFormat } from '../composables/useMapSizePreference.js'
import { useNominatim } from '../composables/useNominatim.js'
import { useSpeechInput } from '../composables/useSpeechInput.js'
import { reverseGeocode } from '../lib/geocode.js'
import { useSearchKeyboard } from '../composables/useSearchKeyboard.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import { gpsFeilTekst, GPS_IKKE_STOTTET } from '../lib/gpsFeil.js'

// Fanen eies av VERTEN: forsiden speiler den mot ?tab=, modalen setter den fra
// menyvalget. Toveis, så brukeren kan bytte fane inne i begge.
const props = defineProps({
  tab: { type: String, default: 'kart' },
  // Forsiden viser PWA-install-CTA-en nederst; i modalen ville den bare
  // konkurrert med menyens egen «Installer som app».
  showInstall: { type: Boolean, default: true },
})
// open-picker: verten bestemmer HVORDAN «Flere valg» åpnes — forsiden navigerer
// til /nytt, hovedmenyen åpner Nytt turkart som modal oppå seg selv. Uten dette
// navigerte knappen alltid, så i modalen forsvant både menyen og modalen.
const emit = defineEmits(['update:tab', 'open-picker'])

const router = useRouter()
const { uiTextScale } = useUiTextScale()

// Ved forstørret tekst (> 100 %) blir kart-radene trange: kartnavnet får nesten
// ikke plass ved siden av «blyant»/«søppel»-knappene. Da legger vi knappene på
// egen linje under navnet i stedet (se kort-radens layout under).
const isEnlarged = computed(() => uiTextScale.value > 1)

// ── «Installer som app» ───────────────────────────────────────────────────
// Forsiden tilbyr PWA-install. Knappen vises når nettleseren har fyrt av
// beforeinstallprompt (Chrome/Edge/Android → canInstall) eller på iOS (der
// install er manuell via Del-menyen). Skjules når appen alt kjører installert
// (standalone). Klikk → confirm() → nettleserens egen install-prompt.
const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()
const showInstallButton = computed(() =>
  props.showInstall && !isStandalone.value && (canInstall.value || isIOS.value))

async function onInstallClick() {
  if (isIOS.value) {
    alert('Slik installerer du Lende på iPhone/iPad:\n\n1. Trykk Del-ikonet nederst i Safari.\n2. Velg «Legg til på Hjem-skjerm».')
    return
  }
  if (!canInstall.value) return
  if (!confirm('Installer Lende som webapp?')) return
  try {
    await promptInstall()
  } catch { /* avvist eller utilgjengelig — ingen handling */ }
}
const maps = ref([])
const alleFliser = ref([])
const loading = ref(true)

// ── Faner: Turkart / Ruteplanlegger ───────────────────────────────────────
// Hjem-siden er fellesside for begge modusene: «Turkart»-fanen viser lag-nytt +
// Mine kart, «Ruteplanlegger»-fanen viser Mine ruter. Hovedmenyen navigerer hit
// med ?tab=kart|rute.
const activeTab = ref(props.tab === 'rute' ? 'rute' : 'kart')
watch(() => props.tab, (t) => { if (t === 'rute' || t === 'kart') activeTab.value = t })
watch(activeTab, (t) => emit('update:tab', t))

// Lag-nytt-flyten (søk/GPS/Flere valg) vises alltid øverst i fanen — søk er
// hovedflyten, også når brukeren har kart fra før (v3.0.20; det gamle
// «+ Nytt kart»-utfoldingssteget er fjernet).

const savedRoutes = ref([])

function formatRouteInfo(r) {
  const parts = []
  if (Number.isFinite(r.lengthM)) parts.push(`${(r.lengthM / 1000).toFixed(1)} km`)
  if (Number.isFinite(r.gravelShare)) parts.push(`${Math.round(r.gravelShare * 100)} % grus`)
  if (r.opprettet) {
    parts.push(new Date(r.opprettet).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' }))
  }
  return parts.join(' · ')
}

function openRoute(id) {
  router.push({ name: 'ruteplanlegger', query: { open: id } })
}

async function onDeleteRoute(id, navn) {
  if (!confirm(`Slett rute "${navn}"?`)) return
  await deleteGravelRoute(id)
  savedRoutes.value = savedRoutes.value.filter(r => r.id !== id)
}

async function onDeleteAllRoutes() {
  if (!confirm(`Slett alle ${savedRoutes.value.length} rutene?`)) return
  for (const r of savedRoutes.value) await deleteGravelRoute(r.id)
  savedRoutes.value = []
}

// Stjernemerking 1–5 (portert fra planleggerens «Mine ruter»-ark): samme
// stjerne igjen = fjern. Feltet heter `stjerner` i lagringen.
async function onSetStars(id, stjerner) {
  const n = Math.max(0, Math.min(5, Math.round(stjerner)))
  const updated = await updateGravelRoute(id, { stjerner: n || null })
  if (updated) savedRoutes.value = savedRoutes.value.map(r => (r.id === id ? updated : r))
}

// ── Sortering + stjernefilter (portert fra arket; samme localStorage-nøkkel
// så preferansen overlever flyttingen). Filteret er økt-lokalt. ─────────────
const SORT_LS_KEY = 'lende-ruteplanlegger-sortering'
const SORT_FIELDS = [
  { key: 'opprettet', label: 'Dato' },
  { key: 'lengde', label: 'Lengde' },
  { key: 'grus-km', label: 'Km grus' },
  { key: 'grus', label: '% grus' },
  { key: 'stjerner', label: 'Stjerner' },
]
function loadSort() {
  try {
    const v = JSON.parse(localStorage.getItem(SORT_LS_KEY) ?? 'null')
    if (v && SORT_FIELDS.some((f) => f.key === v.key) && ['asc', 'desc'].includes(v.dir)) return v
  } catch { /* noop */ }
  return { key: 'opprettet', dir: 'desc' }
}
const savedSort = ref(loadSort())
watch(savedSort, (v) => {
  try { localStorage.setItem(SORT_LS_KEY, JSON.stringify(v)) } catch { /* noop */ }
}, { deep: true })
const starFilter = ref(0)              // 0 = alle, -1 = uvurderte, ellers EKSAKT antall stjerner

const SORT_VALUE = {
  opprettet: (r) => r.opprettet ?? 0,
  lengde: (r) => r.lengthM ?? 0,
  'grus-km': (r) => (r.gravelShare ?? 0) * (r.lengthM ?? 0),
  grus: (r) => r.gravelShare ?? -1,
  stjerner: (r) => r.stjerner ?? 0,
}
const visibleSavedRoutes = computed(() => {
  const val = SORT_VALUE[savedSort.value.key] ?? SORT_VALUE.opprettet
  const dir = savedSort.value.dir === 'asc' ? 1 : -1
  // Eksakt stjerne-match; «Ingen» (-1) viser rutene som ennå ikke er vurdert.
  return savedRoutes.value
    .filter((r) => {
      if (!starFilter.value) return true
      const s = r.stjerner ?? 0
      return starFilter.value === -1 ? s === 0 : s === starFilter.value
    })
    .slice()
    .sort((a, b) => dir * (val(a) - val(b)) || (b.opprettet - a.opprettet))
})

// ── Deling (portert fra arket): én rute eller «Del mine ruter …»-velgemodus —
// inntil MAX_SHARE_ROUTES i ÉN lenke (?r=<token>&r=…, se lib/routeShare.js).
const shareState = ref('idle')    // 'idle' | 'copied' | 'error'
let shareResetTimer = null

async function performShare(url, title, text) {
  if (!url) return
  const shareData = { title, text, url }
  if (typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
        throw new Error('share-data-rejected')
      }
      await navigator.share(shareData)
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
      // fall gjennom til clipboard-fallback
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    shareState.value = 'copied'
  } catch {
    shareState.value = 'error'
  }
  if (shareResetTimer) clearTimeout(shareResetTimer)
  shareResetTimer = setTimeout(() => { shareState.value = 'idle' }, 2200)
}

function shareUrlForTokens(tokens) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
  return `${base}/ruteplanlegger?${tokens.map((t) => 'r=' + encodeURIComponent(t)).join('&')}`
}

function onShareRoute(rec) {
  const token = routeShareToken(rec)
  if (!token) return
  void performShare(shareUrlForTokens([token]), rec.navn, rec.navn)
}

const shareSelectMode = ref(false)
const shareSelected = ref([])          // rute-id-er i valgt rekkefølge

function startShareSelect() {
  shareSelectMode.value = true
  shareSelected.value = []
}
function cancelShareSelect() {
  shareSelectMode.value = false
  shareSelected.value = []
}
function toggleShareSelect(id) {
  const cur = shareSelected.value
  if (cur.includes(id)) shareSelected.value = cur.filter((x) => x !== id)
  else if (cur.length < MAX_SHARE_ROUTES) shareSelected.value = [...cur, id]
}
function onShareSelectedRoutes() {
  const recs = shareSelected.value
    .map((id) => savedRoutes.value.find((r) => r.id === id))
    .filter(Boolean)
  const tokens = recs.map(routeShareToken).filter(Boolean)
  if (!tokens.length) return
  const navn = recs.map((r) => r.navn).filter(Boolean)
  const tekst = tokens.length === 1
    ? (navn[0] ?? 'Grusrute')
    : `${tokens.length} grusruter: ${navn.slice(0, 3).join(', ')}${navn.length > 3 ? ' …' : ''}`
  void performShare(shareUrlForTokens(tokens), tekst, tekst)
}
watch(activeTab, () => { cancelShareSelect() })

// Standard kartstørrelse/format/ekvidistanse (settes i MapView «Innstillinger»).
// Størrelse: null = DEFAULT_MAP_WIDTH_KM. Format styrer aspektet (kvadrat/
// portrett/A4). Ekvidistanse: brukerens valg klampet til tillatt for bredden,
// null = auto (fineste tillatte). Brukes av søk-/GPS-flyten.
const { mapSizeKm, mapFormat } = useMapSizePreference()
function squareDims() {
  const base = mapSizeKm.value ? { halfKm: mapSizeKm.value / 2 } : defaultMapDims()
  return { ...base, aspect: aspectForFormat(mapFormat.value) }
}
function squareEquidistance() {
  return effectiveEquidistanceForWidthKm(mapSizeKm.value)
}

async function refresh() {
  loading.value = true
  try {
    // Auto-fliser (isAuto) er en intern scroll-tilbake-cache, ikke kart brukeren
    // bevisst har laget — de skal ikke fylle opp «lagrede kart»-lista.
    // Auto-flisene skjules i LISTA, men vi trenger dem for å kunne si hvor stort
    // arket faktisk er: en utvidet kart består av mange poster, og bare
    // midtflisa er brukerens eget kart.
    const alle = await listMaps()
    alleFliser.value = alle
    maps.value = alle.filter(m => !m.isAuto)
    savedRoutes.value = await listGravelRoutes()
  } catch {
    savedRoutes.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
  // Sist brukte modus (app-start havner der brukeren var sist — se router.js).
  try { localStorage.setItem('lende-last-mode', 'kart') } catch { /* noop */ }
})
onActivated(refresh)

function openMap(id) {
  router.push({ name: 'kart-vis', params: { id } })
}

// ── Importer et delt kart (.lendekart) ──────────────────────────────────────
// Motstykket til «Del som offline-fil» i kart-visningen. Hele poenget er at
// dette skal virke UTEN nett: fila bærer SVG, høyderutenett og datalag, og
// importen skriver dem rett i IndexedDB. Derfor ingen nettverkskall her.
const filInput = ref(null)
const importerer = ref(false)
const importFeil = ref('')

function onVelgImportFil() {
  importFeil.value = ''
  filInput.value?.click()
}

async function onImportFil(e) {
  const fil = e.target?.files?.[0]
  // Nullstill inputen med én gang: velger brukeren SAMME fil på nytt etter en
  // feil, fyrer ikke change-eventet uten dette.
  if (e.target) e.target.value = ''
  if (!fil) return
  importerer.value = true
  importFeil.value = ''
  try {
    const { id } = await importerKartPakke(fil)
    await refresh()
    router.push({ name: 'kart-vis', params: { id } })
  } catch (err) {
    // Nettleserens egne lesefeil er engelske DOMException-er som ikke sier hva
    // brukeren skal gjøre. Den vanligste er NotFoundError: Filer-appen VISER
    // fila selv når den bare ligger i iCloud/Google Drive og ikke er lastet
    // ned. lesefeilPaaNorsk oversetter dem; alt annet (våre egne feil fra
    // lesKartPakke) er norsk allerede. Sjekken gjentas her fordi fila også kan
    // rives bort utenfor pakke-lesingen.
    console.error('Import av kartfil feilet:', err)
    importFeil.value = lesefeilPaaNorsk(err) || err?.message || 'Kunne ikke lese kartfila.'
  } finally {
    importerer.value = false
  }
}

async function onDelete(id, navn) {
  if (!confirm(`Slett kart "${navn}"?`)) return
  await deleteMap(id)
  // Ikke la app-start (router.js) peke på et slettet kart.
  try {
    if (localStorage.getItem('lende-last-map') === id) localStorage.removeItem('lende-last-map')
    localStorage.removeItem(`lende-view:${id}`)
  } catch { /* noop */ }
  await refresh()
}

// ── Gi nytt navn ─────────────────────────────────────────────────────────
const renaming = ref(null)   // { id, navn } — kartet som redigeres, eller null
function onRename(id, navn) {
  renaming.value = { id, navn }
}
async function onRenameSave(navn) {
  const target = renaming.value
  if (!target) return
  await renameMap(target.id, navn)
  renaming.value = null
  await refresh()
}

async function onDeleteAll() {
  const n = maps.value.length
  if (n === 0) return
  if (!confirm(`Vil du slette ${n} kart?`)) return
  await clearAll()
  // Ikke la app-start (router.js) gjenoppta et slettet kart etter refresh —
  // rydd gjenopptaks-nøkkelen og alle lagrede kartutsnitt.
  try {
    localStorage.removeItem('lende-last-map')
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('lende-view:')) localStorage.removeItem(key)
    }
  } catch { /* noop */ }
  await refresh()
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('no-NO', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
}

// Dato + klokkeslett på én linje. Tar ms-timestamp eller ISO-streng.
function formatDateTime(ts) {
  if (ts == null) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return `${formatDate(d)} · ${formatTime(d)}`
}

// Lagringsstørrelse → kort KB/MB-streng. < 1 MB vises i KB, ellers MB med 1 desimal.
function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
// Total lagringsbruk for brukerens lagrede kart (sum av sizeBytes).
const totalBytes = computed(() => maps.value.reduce((s, m) => s + (m.sizeBytes ?? 0), 0))

// «DEM 5 m» / «syntetisk DEM» / null (utelates). Syntetisk DEM har ingen ekte
// oppløsning å vise.
function demLabel(resM, source) {
  if (source && source.startsWith('synthetic')) return 'syntetisk DEM'
  if (resM) return `DEM ${Math.round(resM)} m`
  return null
}

// Info-linje (linje 2): størrelse · ekvidistanse · DEM. Deler som mangler
// (eldre kart uten metadata) utelates stille.
// Størrelses-teksten for én rad. Har kartet blitt utvidet, er det ARKET som er
// interessant — «8,0 × 8,0 km» på et 3×3-ark er teknisk sant om midtflisa og
// misvisende om kartet. Eldre poster mangler utmBbox; da faller vi tilbake til
// flisas egen bredde, som før.
function storrelseFor(m) {
  const km = (v) => (v / 1000).toFixed(1)
  const ark = arkExtentFor(m, alleFliser.value)
  if (!ark || ark.fliser < 2) return `${(m.halfKm * 2).toFixed(1)} × ${(m.halfKm * 2).toFixed(1)} km`
  return `${km(ark.widthM)} × ${km(ark.heightM)} km · ${ark.fliser} fliser`
}

// ── On-the-fly snarvei: «Lag kart der jeg er» ───────────────────────────
// Krever GPS. Ett trykk → hent posisjon → bygg standard-kartet (squareDims/
// squareEquidistance — 5 km kvadrat + 10 m med mindre brukeren har valgt annet),
// åpne nytt kart sentrert på brukeren. Full-screen loader vises mens
// pipelinen kjører (Overpass, N50, Sjøkart, WMS, DEM, buildSvg, saveMap).
const supportsGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation
const buildingOnTheFly = ref(false)
const buildingProgress = ref('')

async function onCreateHere() {
  if (buildingOnTheFly.value) return
  if (!supportsGeolocation) {
    alert(GPS_IKKE_STOTTET)
    return
  }
  buildingOnTheFly.value = true
  buildingProgress.value = 'Henter posisjon …'
  let coords
  try {
    coords = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      )
    })
  } catch (err) {
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    alert(gpsFeilTekst(err.code, 'GPS-feil — kan ikke opprette kart her'))
    return
  }
  try {
    const stamp = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })
    // Slå opp nærmeste stedsnavn så kartet får et gjenkjennelig navn («Stormoen
    // 19. juli») i stedet for «Din posisjon». Best-effort — feiler oppslaget
    // (offline / Nominatim nede) faller vi tilbake til «Min posisjon».
    buildingProgress.value = 'Finner stedsnavn …'
    let placeName = 'Min posisjon'
    try {
      const rev = await reverseGeocode(coords.coords.latitude, coords.coords.longitude)
      if (rev?.placeLabel) placeName = rev.placeLabel
    } catch { /* behold fallback */ }
    const { id } = await buildMapFromCenter({
      center: {
        lat: coords.coords.latitude,
        lon: coords.coords.longitude,
        name: placeName,
      },
      // Kvadratisk utsnitt: beholder den skjerm-utledede høyden og utvider
      // bredden så kartet blir kvadratisk (mer slingringsrom øst/vest).
      ...squareDims(),
      equidistanceM: squareEquidistance(), // auto: fineste tillatte for bredden (5/10/20 m)
      navn: `${placeName} ${stamp}`,
      terrainFirst: true,   // vis terreng straks, fyll inn OSM i bakgrunnen
      onProgress: (msg) => { buildingProgress.value = msg },
    })
    // Be MapView starte GPS automatisk — brukeren har akkurat brukt sin
    // posisjon til å lage kartet, og forventer at posisjons-prikken er
    // synlig idet kartet åpnes. (I MapView-FAB-flyten er GPS allerede
    // aktivt; her er det ikke.)
    try {
      sessionStorage.setItem(`mapview-init-prefs:${id}`, JSON.stringify({
        autoStartGps: true,
      }))
    } catch { /* noop */ }
    router.push({ name: 'kart-vis', params: { id } })
  } catch (e) {
    console.error('On-the-fly kart-bygging feilet:', e)
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    alert('Kunne ikke opprette kart: ' + (e.message ?? 'ukjent feil'))
  }
}

// ── Søk → bygg direkte ──────────────────────────────────────────────────
// Søkefeltet på forsiden er en KISS-snarvei (parallelt med «Lag kart der jeg
// er»): velg et sted fra trefflista → bygg straks et standard 10 × 10 km,
// 20 m ekvidistanse-kart sentrert der, og åpne det. Ingen mellomside med
// størrelse/ekvidistanse-valg — det ligger fortsatt under «Flere valg»
// (MapPickerView) for de som vil finjustere.
const { query, results, isSearching, error: searchError } = useNominatim()

// Tale-til-tekst: diktér søket. Knappen vises kun der nettleseren støtter det.
const { isSupported: micSupported, isListening: micListening, toggle: toggleMic } =
  useSpeechInput({ onResult: (t) => { query.value = t } })

// Høyre-padding + spinner-plassering avhenger av hvor mange kontroll-knapper
// (mikrofon + GPS) som faktisk vises.
const rightControlCount = computed(() =>
  (supportsGeolocation ? 1 : 0) + (micSupported.value ? 1 : 0))
const searchRightPad = computed(() =>
  rightControlCount.value === 2 ? 'pr-24' : rightControlCount.value === 1 ? 'pr-14' : 'pr-3')
const spinnerRight = computed(() =>
  rightControlCount.value === 2 ? 'right-[5.9rem]' : rightControlCount.value === 1 ? 'right-[3.4rem]' : 'right-3.5')

const showResults = computed(() =>
  query.value.trim().length >= 2 && (results.value.length > 0 || isSearching.value)
)

async function onSelectSearchResult(r) {
  if (buildingOnTheFly.value) return
  query.value = ''
  results.value = []
  buildingOnTheFly.value = true
  buildingProgress.value = 'Henter kartdata …'
  try {
    const stamp = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })
    const { id } = await buildMapFromCenter({
      center: { lat: r.lat, lon: r.lon, name: r.shortName },
      ...squareDims(),   // valgt format/bredde — standard 5 km kvadrat
      equidistanceM: squareEquidistance(), // auto: fineste tillatte for bredden (5/10/20 m)
      navn: `${r.shortName} ${stamp}`,
      terrainFirst: true,   // vis terreng straks, fyll inn OSM i bakgrunnen
      onProgress: (msg) => { buildingProgress.value = msg },
    })
    router.push({ name: 'kart-vis', params: { id } })
  } catch (e) {
    console.error('Søk-kart-bygging feilet:', e)
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    alert('Kunne ikke opprette kart: ' + (e.message ?? 'ukjent feil'))
  }
}

// ── Tastaturnavigasjon (desktop) ────────────────────────────────────────
// Samme combobox-mønster som MapPickerView/GravelPlannerView: pil ned/opp
// markerer, Enter velger, Escape nullstiller. To lister deler mønsteret:
//   1. Søketreff (når nedtrekket er åpent) — Enter bygger kart der.
//   2. «Mine kart» (ellers) — Enter åpner det markerte kartet.
const { activeIndex: searchActiveIndex, onKeydown: onSearchResultsKeydown } = useSearchKeyboard(results, {
  onSelect: onSelectSearchResult,
  onClear: () => { query.value = ''; results.value = [] },
  optionId: (i) => `maphome-opt-${i}`,
})

const { activeIndex: mapsActiveIndex, onKeydown: onMapsKeydown } = useSearchKeyboard(maps, {
  onSelect: (m) => { if (!buildingOnTheFly.value) openMap(m.id) },
  optionId: (i) => `maphome-map-${i}`,
})

// Keydown i søkefeltet: åpne nedtrekk → naviger treff; ellers faller
// piltastene gjennom til kart-lista, så flyten virker uten å flytte fokus.
function onSearchKeydown(e) {
  if (showResults.value) onSearchResultsKeydown(e)
  else if (e.key !== 'Escape') onMapsKeydown(e)
}

// Piltaster skal også virke uten fokus i søkefeltet (rett etter side-last).
// Interaktive elementer (knapper, input) beholder sin egen Enter/Escape.
function onWindowKeydown(e) {
  if (buildingOnTheFly.value) return
  const t = e.target
  if (t instanceof HTMLElement &&
      (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName) || t.isContentEditable)) return
  onMapsKeydown(e)
}

// Duplikat-add er ufarlig (samme funksjonsreferanse er no-op), så mounted +
// activated kan begge legge til — viewet lever i keep-alive.
onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onActivated(() => window.addEventListener('keydown', onWindowKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  if (shareResetTimer) clearTimeout(shareResetTimer)
})
onDeactivated(() => window.removeEventListener('keydown', onWindowKeydown))
</script>

<template>

  <!-- Fane-veksler (samme segment-stil som Om-siden): hjem-siden er felles
       for turkart (Mine kart) og ruteplanlegger (Mine ruter). -->
  <div class="flex gap-1 p-1 rounded-xl bg-ink/5 border border-ink/10 mb-4">
    <button @click="activeTab = 'kart'"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
            :class="activeTab === 'kart' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink/60 active:text-ink/90'">
      Turkart{{ maps.length ? ` (${maps.length})` : '' }}
    </button>
    <button @click="activeTab = 'rute'"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
            :class="activeTab === 'rute' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink/60 active:text-ink/90'">
      Ruteplanlegger{{ savedRoutes.length ? ` (${savedRoutes.length})` : '' }}
    </button>
  </div>

  <template v-if="activeTab === 'kart'">
  <!-- Lag-nytt-flyten (søk/GPS/Flere valg) ligger alltid øverst — søk er
       hovedflyten. Kartlista følger rett under, uten egen «Mine kart»-label. -->
  <div class="flex items-center justify-between mb-2 mt-3">
    <div class="text-ink/45 text-[11px] uppercase tracking-wide">Lag nytt kart</div>
    <button @click="emit('open-picker')"
            class="text-[11px] font-medium text-ink/55 active:text-ink/85
                   flex items-center gap-1 transition">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="18" x2="20" y2="18"/>
      </svg>
      Flere valg
    </button>
  </div>

  <!-- Søkefelt med integrert GPS-knapp (v10.1.24). Søk = hovedflyten: velg
       et sted → bygg straks et A-format-kart. Den grønne pin-knappen til
       høyre er en forlengelse av feltet og lager kart der du står (GPS).
       Hjelpeteksten under forklarer knappen siden pin-ikonet alene ikke er
       helt selvforklarende. Den tidligere store grønne CTA-en er fjernet —
       den dominerte over søkefeltet. -->
  <div class="relative z-20 mb-1.5">
    <div class="relative">
      <svg viewBox="0 0 24 24" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/50"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>
      </svg>
      <input v-model="query" type="search" autocomplete="off" autocorrect="off"
             @keydown="onSearchKeydown"
             role="combobox" aria-autocomplete="list" :aria-expanded="showResults"
             aria-controls="maphome-results"
             :aria-activedescendant="searchActiveIndex >= 0 ? `maphome-opt-${searchActiveIndex}` : undefined"
             placeholder="Søk etter sted, postnummer eller adresse"
             :class="['w-full pl-11 py-3.5 rounded-xl bg-ink/[0.06] border border-ink/20 text-[15px]',
                      'placeholder-ink/35 focus:outline-none focus:bg-ink/[0.1]',
                      'focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-400/15 transition',
                      searchRightPad]" />
      <!-- Søke-spinner (til venstre for kontroll-knappene) -->
      <div v-if="isSearching"
           :class="['absolute top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-ink/15',
                    'border-t-ink/70 rounded-full animate-spin', spinnerRight]" />
      <!-- Kontroll-knapper: mikrofon (diktér søk) + GPS (lag kart der jeg er) -->
      <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button v-if="micSupported" type="button" @click="toggleMic"
                :aria-label="micListening ? 'Stopp diktering' : 'Diktér søk (tale til tekst)'"
                :aria-pressed="micListening"
                :class="['w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95',
                         micListening ? 'bg-red-500/90 text-ink animate-pulse' : 'bg-ink/10 text-ink/70']">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <button v-if="supportsGeolocation"
                @click="onCreateHere"
                :disabled="buildingOnTheFly"
                aria-label="Lag kart der jeg står (GPS)"
                class="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center
                       shadow-md active:scale-95 transition disabled:opacity-60">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="10" r="3"/>
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Søkeresultater -->
    <Transition name="fade">
      <div v-if="showResults" id="maphome-results" role="listbox"
           class="absolute left-0 right-0 mt-1 rounded-xl bg-surface/98 backdrop-blur
                  border border-ink/10 shadow-2xl max-h-[50dvh] overflow-y-auto z-30">
        <div v-if="results.length === 0 && !isSearching"
             class="px-4 py-3 text-[13px] text-ink/50">Ingen treff</div>
        <button v-for="(r, index) in results" :key="r.id"
                :id="`maphome-opt-${index}`" role="option"
                :aria-selected="index === searchActiveIndex"
                @click="onSelectSearchResult(r)"
                @mousemove="searchActiveIndex = index"
                class="w-full text-left px-4 py-2.5 transition border-b
                       border-ink/8 last:border-0"
                :class="index === searchActiveIndex ? 'bg-ink/12' : 'active:bg-ink/10'">
          <div class="text-[13px] font-medium text-ink truncate">{{ r.shortName }}</div>
          <div class="text-[11px] text-ink/50 truncate">{{ r.name }}</div>
        </button>
      </div>
    </Transition>
  </div>

  <!-- Hjelpetekst som forklarer den integrerte GPS-knappen. -->
  <div v-if="supportsGeolocation"
       class="mb-4 px-1 text-[11.5px] text-ink/45 flex items-center gap-1.5 leading-snug">
    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-emerald-300/80 shrink-0" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="10" r="3"/>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
    </svg>
    <span>Søk etter et sted — eller trykk den grønne knappen for å lage kart der du står.</span>
  </div>
  <div v-if="searchError" class="-mt-2 mb-4 px-1 text-[11px] text-slate-300">{{ searchError }}</div>

  <!-- Importer et kart en turkamerat har delt som fil. Står her, mellom
       «lag nytt» og lista, fordi det er den andre måten et kart havner i
       lista på. Virker uten nett — fila inneholder alt. -->
  <button type="button" @click="onVelgImportFil" :disabled="importerer"
          class="w-full mb-3 px-3 py-3 rounded-lg border border-ink/10 bg-ink/[0.04]
                 text-ink/70 text-[14px] active:scale-[0.99] disabled:opacity-60
                 flex items-center justify-center gap-2 transition">
    <span v-if="importerer"
          class="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink/70 animate-spin shrink-0"></span>
    <svg v-else viewBox="0 0 24 24" class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    {{ importerer ? 'Importerer …' : 'Importer delt kart (fil)' }}
  </button>
  <input ref="filInput" type="file" class="hidden"
         :accept="`${PAKKE_FILENDELSE},application/gzip`" @change="onImportFil">
  <!-- Feilmeldingen er det ENESTE brukeren har å gå etter når importen ryker,
       og den forteller gjerne om en fil som ligger i skyen. 11 px i lys grå
       nederst på skjermen ble ikke lest — den står nå i en egen boks, i samme
       størrelse som listeteksten. -->
  <div v-if="importFeil"
       class="-mt-1 mb-3 px-3 py-2.5 rounded-lg bg-rose-500/[0.10] border border-rose-400/30
              text-rose-200 text-[13px] leading-snug">{{ importFeil }}</div>

  <!-- Vardåsen-referansekartet er flyttet til «Utvikler»-fanen inne i kart-
       visningen (debug-hjelp) — det fyller ikke lenger forsiden. -->

  <!-- Vises kun når brukeren har samlet opp mange kart. Filene er små,
       så dette handler om ryddighet/utdaterte kart, ikke lagringsplass. -->
  <div v-if="!loading && maps.length > 9"
       class="mb-2 px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-400/20
              text-amber-200/80 text-[11px] leading-snug">
    Du har mange og potensielt utdaterte kart. Slett kart du ikke trenger lenger for å
    holde lista ryddig — eller
    <button type="button" @click="onDeleteAll"
            class="underline font-medium text-amber-100 active:text-ink">slett alle kart</button>.
  </div>

  <div v-if="loading" class="flex justify-center py-6">
    <div class="w-5 h-5 border-2 border-ink/15 border-t-ink/60 rounded-full animate-spin"/>
  </div>

  <div v-for="(m, index) in maps" :key="m.id"
       :id="`maphome-map-${index}`"
       class="mb-2 rounded-lg border overflow-hidden"
       :class="index === mapsActiveIndex
         ? 'border-emerald-300/50 bg-ink/[0.08]'
         : 'border-ink/10 bg-ink/[0.04]'">
    <div class="flex gap-3 px-4 py-3 active:bg-ink/[0.07]"
         :class="isEnlarged ? 'flex-col' : 'items-center'"
         @click="openMap(m.id)">
      <div class="flex items-center gap-3 min-w-0" :class="isEnlarged ? '' : 'flex-1'">
        <div class="shrink-0 w-10 h-10 rounded-lg bg-slate-500/15 border border-slate-300/25
                    flex items-center justify-center text-slate-300">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
            <path d="M9 4 V18 M15 6 V20"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-[14px] truncate text-ink">{{ m.navn }}</div>
          <div class="text-[12px] text-ink/50 truncate">
            {{ [storrelseFor(m), m.equidistanceM ? `${m.equidistanceM} m ekv.` : '', demLabel(m.demResolutionM, m.demSource)].filter(Boolean).join(' · ') }}
          </div>
          <div class="text-[11px] text-ink/35 truncate">
            {{ formatDateTime(m.opprettet) }}<template v-if="formatBytes(m.sizeBytes)"> · {{ formatBytes(m.sizeBytes) }}</template>
          </div>
        </div>
      </div>
      <!-- Blyant/søppel: på egen linje (høyrestilt) når teksten er forstørret,
           ellers til høyre for navnet som før. -->
      <div class="shrink-0 flex items-center gap-1" :class="isEnlarged ? 'justify-end -mr-1' : ''">
        <button @click.stop="onRename(m.id, m.navn)"
                aria-label="Gi kart nytt navn"
                class="w-9 h-9 rounded-lg flex items-center justify-center text-ink/35
                       active:bg-ink/10 active:text-ink/70">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
        <button @click.stop="onDelete(m.id, m.navn)"
                aria-label="Slett kart"
                class="w-9 h-9 rounded-lg flex items-center justify-center text-ink/35
                       active:bg-ink/10 active:text-ink/70">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6 L18 20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 L5 6"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div v-if="!loading && maps.length === 0"
       class="mt-6 px-6 py-8 rounded-xl bg-ink/[0.03] border border-ink/10
              flex flex-col items-center text-center">
    <!-- Stort ton-i-ton kart-ikon (samme folde-kart-glyf som lista bruker). -->
    <svg viewBox="0 0 24 24" class="w-20 h-20 text-ink/[0.08]" fill="none"
         stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
      <path d="M9 4 V18 M15 6 V20"/>
    </svg>
    <div class="mt-4 text-[15px] font-semibold text-ink/80">Ingen egne kart ennå</div>
    <div v-if="supportsGeolocation" class="mt-1.5 text-[13px] text-ink/45 leading-relaxed max-w-[18rem]">
      Lag ditt første turkart der du står — eller søk opp et sted øverst.
    </div>
    <div v-else class="mt-1.5 text-[13px] text-ink/45 leading-relaxed max-w-[18rem]">
      Søk opp et sted øverst for å lage ditt første turkart.
    </div>

    <!-- Full-bredde grønn primær-CTA: lag kart der jeg står (GPS). Samme
         handler som den integrerte GPS-knappen i søkefeltet. Kun når GPS
         støttes — uten posisjon faller vi tilbake til søk. -->
    <button v-if="supportsGeolocation"
            @click="onCreateHere"
            :disabled="buildingOnTheFly"
            class="mt-5 w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold
                   flex items-center justify-center gap-2 shadow-md
                   active:scale-[0.99] transition disabled:opacity-60">
      <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="10" r="3"/>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
      </svg>
      <span>Lag kart der du står</span>
    </button>
  </div>

  <!-- Slett alle (vises kun når brukeren har lagrede kart). Linje 2 er
       lagringstelleren — antall kart + samlet plass — flyttet hit fra den
       gamle «Mine kart»-toppraden (v3.0.20).
       v4.8.3: var solid bg-red-600 med hvit skrift og ble den mest dominante
       flaten i hele panelet — en sjelden, destruktiv handling som ropte
       høyere enn «Lag nytt kart». Nå tonet rød med kant og søppelbøtte-ikon,
       samme mønster som de andre aksentknappene (bg-*-500/15 + border-*-400/40
       + text-*-100, der 100-skyggen remappes til mørk rød i lyst tema av
       style.css). Fortsatt utvetydig destruktiv, men den skriker ikke. -->
  <button v-if="!loading && maps.length > 0"
          @click="onDeleteAll"
          class="w-full mt-3 rounded-lg px-4 py-2.5 text-[13px] font-medium border transition
                 bg-red-500/15 border-red-400/40 text-red-100
                 active:bg-red-500/25 active:scale-[0.99]">
    <span class="flex items-center justify-center gap-2">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/>
      </svg>
      <span>Slett alle kart</span>
    </span>
    <span class="block mt-0.5 text-[11px] font-normal text-ink/50 tabular-nums">
      {{ maps.length }} kart<template v-if="formatBytes(totalBytes)"> · {{ formatBytes(totalBytes) }}</template>
    </span>
  </button>

  <!-- Tegnforklaring-knappen er fjernet fra forsiden (v9.3.38) — den finnes
       fortsatt som hurtigvalg inne i kart-visningen (MapView-drawer). -->
  </template>

  <!-- Ruteplanlegger-fanen: Mine ruter øverst, «+ Ny rute» som diskret
       handling. Hele forvaltnings-flyten (stjerner/sortering/deling) bor
       HER — portert fra planleggerens gamle «Mine ruter»-ark. -->
  <template v-else>
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="text-ink/45 text-[11px] uppercase tracking-wide">Mine ruter
        <span v-if="starFilter && savedRoutes.length"
              class="normal-case tracking-normal">· {{ visibleSavedRoutes.length }} av {{ savedRoutes.length }}</span>
      </span>
      <button v-if="!loading && savedRoutes.length > 0"
              @click="router.push('/rute')"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                     bg-emerald-500 text-white
                     transition active:scale-95">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Ny rute
      </button>
    </div>

    <!-- Verktøylinje (kun med flere ruter): velg-modus-handlinger ELLER
         sortering (persistert) + stjernefilter + dele-inngang. -->
    <div v-if="savedRoutes.length > 1" class="mb-3 space-y-1.5">
      <template v-if="shareSelectMode">
        <div class="flex gap-1.5">
          <button @click="onShareSelectedRoutes" :disabled="!shareSelected.length"
                  class="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition
                         active:scale-95 disabled:opacity-40 bg-emerald-500/20
                         border-emerald-400/50 text-emerald-100">
            {{ shareState === 'copied' ? 'Lenke kopiert!'
               : `Del ${shareSelected.length ? `(${shareSelected.length})` : ''} ruter` }}
          </button>
          <button @click="cancelShareSelect"
                  class="px-3 py-2 rounded-lg text-[12px] font-medium border bg-ink/5
                         border-ink/15 text-ink/60 active:scale-95 transition">Avbryt</button>
        </div>
        <div class="text-[10px] text-ink/45">
          Trykk på rutene du vil dele (inntil {{ MAX_SHARE_ROUTES }}) — mottakeren får alle i én lenke.
        </div>
      </template>
      <div v-else class="flex gap-1.5 items-center">
        <label class="sr-only" for="hjem-rute-sortering">Sorter etter</label>
        <select id="hjem-rute-sortering" v-model="savedSort.key"
                class="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] bg-surface-2 border
                       border-ink/15 text-ink/80 focus:outline-none">
          <option v-for="f in SORT_FIELDS" :key="f.key" :value="f.key">{{ f.label }}</option>
        </select>
        <button @click="savedSort.dir = savedSort.dir === 'desc' ? 'asc' : 'desc'"
                :aria-label="savedSort.dir === 'desc' ? 'Synkende — bytt til stigende' : 'Stigende — bytt til synkende'"
                class="shrink-0 w-8 h-8 rounded-lg border bg-ink/5 border-ink/15 text-ink/70
                       flex items-center justify-center active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="savedSort.dir === 'desc'">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </template>
            <template v-else>
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </template>
          </svg>
        </button>
        <label class="sr-only" for="hjem-rute-stjernefilter">Stjernefilter</label>
        <select id="hjem-rute-stjernefilter" v-model.number="starFilter"
                class="shrink-0 w-[5.5rem] px-2 py-1.5 rounded-lg text-[11px] bg-surface-2 border
                       border-ink/15 focus:outline-none"
                :class="starFilter ? 'text-amber-300 border-amber-400/40' : 'text-ink/80'">
          <option :value="-1">Ingen</option>
          <option :value="0">★ Alle</option>
          <option :value="5">★ 5</option>
          <option :value="4">★ 4</option>
          <option :value="3">★ 3</option>
          <option :value="2">★ 2</option>
          <option :value="1">★ 1</option>
        </select>
        <button @click="startShareSelect"
                class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border
                       bg-sky-500/25 border-sky-400/60 text-sky-100 active:scale-95 transition">
          Del …
        </button>
      </div>
    </div>

    <div v-if="savedRoutes.length && !visibleSavedRoutes.length"
         class="text-[13px] text-ink/50 text-center py-6">
      <template v-if="starFilter === -1">Alle rutene er vurdert — ingen uten stjerner.</template>
      <template v-else>Ingen ruter med {{ starFilter }} {{ starFilter === 1 ? 'stjerne' : 'stjerner' }} ennå.</template>
    </div>

    <!-- I velg-modus toggler HELE kortet valget (samme UX som arket). -->
    <div v-for="rec in visibleSavedRoutes" :key="rec.id"
         class="mb-2 rounded-lg border overflow-hidden"
         :class="[shareSelectMode ? 'cursor-pointer active:opacity-80 transition' : '',
                  shareSelectMode && shareSelected.includes(rec.id)
                    ? 'ring-1 ring-sky-400/70 bg-sky-500/[0.08] border-sky-400/40'
                    : 'border-ink/10 bg-ink/[0.03]']"
         @click="shareSelectMode && toggleShareSelect(rec.id)">
      <div class="flex items-center gap-3 px-4 pt-3"
           :class="shareSelectMode ? 'pb-3' : ''">
        <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-ink/40" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
          <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
        </svg>
        <button class="flex-1 min-w-0 text-left active:opacity-70 transition"
                @click="shareSelectMode || openRoute(rec.id)">
          <div class="font-medium text-[14px] truncate text-ink">{{ rec.navn }}</div>
          <div class="text-[12px] text-ink/50 truncate">{{ formatRouteInfo(rec) }}</div>
        </button>
        <!-- Velg-modus: sjekkboks-visual i stedet for del/slett -->
        <div v-if="shareSelectMode"
             class="shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition"
             :class="shareSelected.includes(rec.id) ? 'bg-sky-500 border-sky-400' : 'border-ink/30'">
          <svg v-if="shareSelected.includes(rec.id)" viewBox="0 0 24 24" class="w-4 h-4 text-ink"
               fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
               stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <template v-else>
          <button @click.stop="onShareRoute(rec)" aria-label="Del rute"
                  class="w-8 h-8 rounded-full flex items-center justify-center text-ink/40
                         active:text-sky-300 active:bg-sky-500/10 transition shrink-0">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button @click.stop="onDeleteRoute(rec.id, rec.navn)" aria-label="Slett rute"
                  class="w-8 h-8 rounded-full flex items-center justify-center text-ink/40
                         active:text-rose-200 active:bg-rose-500/10 transition shrink-0">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </template>
      </div>
      <!-- Stjernemerking 1–5: samme stjerne igjen = fjern. -->
      <div v-if="!shareSelectMode" class="pb-2 pl-11 flex items-center gap-0.5">
        <button v-for="s in 5" :key="s"
                @click.stop="onSetStars(rec.id, (rec.stjerner ?? 0) === s ? 0 : s)"
                :aria-label="`Gi ${s} ${s === 1 ? 'stjerne' : 'stjerner'}`"
                :aria-pressed="(rec.stjerner ?? 0) >= s"
                class="w-7 h-7 flex items-center justify-center active:scale-90 transition"
                :class="(rec.stjerner ?? 0) >= s ? 'text-amber-400' : 'text-ink/25'">
          <svg viewBox="0 0 24 24" class="w-4 h-4"
               :fill="(rec.stjerner ?? 0) >= s ? 'currentColor' : 'none'"
               stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Samme tonede destruktive stil som «Slett alle kart» over (v4.8.3). -->
    <button v-if="!loading && savedRoutes.length > 1 && !shareSelectMode"
            @click="onDeleteAllRoutes"
            class="w-full mt-3 rounded-lg px-4 py-2.5 text-[13px] font-medium border transition
                   bg-red-500/15 border-red-400/40 text-red-100
                   active:bg-red-500/25 active:scale-[0.99]
                   flex items-center justify-center gap-2">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/>
      </svg>
      Slett alle ({{ savedRoutes.length }}) ruter
    </button>

    <div v-if="!loading && savedRoutes.length === 0"
         class="mt-10 flex flex-col items-center text-center">
      <svg viewBox="0 0 24 24" class="w-14 h-14 text-ink/20" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
        <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
      </svg>
      <div class="mt-4 text-[15px] font-semibold text-ink/80">Ingen lagrede ruter ennå</div>
      <div class="mt-1.5 text-[13px] text-ink/45 leading-relaxed max-w-[18rem]">
        Planlegg en rute fra A til B i ruteplanleggeren og lagre den — så finner du den igjen her.
      </div>
      <button @click="router.push('/rute')"
              class="mt-5 w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold
                     flex items-center justify-center gap-2 shadow-md
                     active:scale-[0.99] transition">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
          <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
        </svg>
        <span>Åpne ruteplanleggeren</span>
      </button>
    </div>
  </template>

  <!-- «Installer som app»: nederst, diskret — skal ikke konkurrere med
       listene. Vises når nettleseren tilbyr PWA-install (canInstall) eller
       på iOS (manuell veiledning); skjult når appen kjører installert. -->
  <button v-if="showInstallButton"
          @click="onInstallClick"
          class="w-full mt-6 py-3 rounded-xl bg-ink/[0.06] border border-ink/20
                 text-ink/85 text-[14px] font-medium flex items-center justify-center gap-2
                 active:bg-ink/[0.1] active:scale-[0.99] transition">
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>
    </svg>
    <span>Installer som app</span>
  </button>
<!-- Full-screen loader for on-the-fly kart-bygging -->
<Transition name="overlay-fade">
  <div v-if="buildingOnTheFly"
       class="fixed inset-0 z-[220] bg-overlay/92 backdrop-blur-sm
              flex flex-col items-center justify-center text-ink">
    <div class="w-16 h-16 mb-4">
      <svg viewBox="0 0 50 50" class="w-full h-full animate-spin"
           fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
        <circle cx="25" cy="25" r="20" stroke-opacity="0.18"/>
        <path d="M25 5 a20 20 0 0 1 20 20"/>
      </svg>
    </div>
    <div class="text-[16px] font-semibold mb-1">Oppretter kart</div>
    <div class="text-[12px] text-ink/65 px-6 text-center max-w-[280px]
                min-h-[18px] leading-snug">
      {{ buildingProgress }}
    </div>
  </div>
</Transition>

<!-- Gi kart nytt navn (bunn-ark) -->
<RenameMapDialog
  :open="renaming !== null"
  :navn="renaming?.navn ?? ''"
  @update:open="v => { if (!v) renaming = null }"
  @save="onRenameSave" />
</template>

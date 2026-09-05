<script setup>
// Kart- og rute-biblioteket: fane-veksler, «Mine kart» med lag-nytt-flyten, og
// «Mine ruter» med del/stjerne/slett. Trukket ut av MapHomeView (v2.4.16) fordi
// hovedmenyen nå åpner de samme listene som modal — forsiden og modalen deler
// denne komponenten i stedet for å duplisere 500 linjer liste-logikk.
//
// Verten eier ramme, padding, scroll og tekst-skalering; her ligger innholdet.
import { ref, computed, watch, nextTick, onMounted, onActivated, onUnmounted, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import { listMaps, loadMap, deleteMap, clearAll, renameMap, listGravelRoutes, deleteGravelRoute, updateGravelRoute } from '../lib/mapStorage.js'
import { importerKartPakke } from '../lib/kartImport.js'
import { PAKKE_FILENDELSE, lesefeilPaaNorsk } from '../lib/kartPakke.js'
import { delEllerLastNedFil, pakkKartTilFil } from '../lib/kartFilDeling.js'
import { APP_VERSION } from '../version.js'
import { arkExtentFor } from '../lib/tileCache.js'
import { routeShareToken, MAX_SHARE_ROUTES } from '../lib/routeShare.js'
import RenameMapDialog from './RenameMapDialog.vue'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { useMapSizePreference, effectiveEquidistanceForWidthKm, defaultMapDims, aspectForFormat } from '../composables/useMapSizePreference.js'
import { useNominatim } from '../composables/useNominatim.js'
import { useSpeechInput } from '../composables/useSpeechInput.js'
import { useSearchKeyboard } from '../composables/useSearchKeyboard.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
import { reverseGeocode } from '../lib/geocode.js'
import { gpsFeilForklaring, GPS_IKKE_STOTTET } from '../lib/gpsFeil.js'
import { mikrofonFeilForklaring } from '../lib/mikrofonFeil.js'

// Fanen eies av VERTEN: forsiden speiler den mot ?tab=, modalen setter den fra
// menyvalget. Toveis, så brukeren kan bytte fane inne i begge.
const props = defineProps({
  tab: { type: String, default: 'kart' },
  // Fane-raden øverst. Av i menyens modaler — se malen for hvorfor.
  showTabs: { type: Boolean, default: true },
  // Forsiden viser PWA-install-CTA-en nederst; i modalen ville den bare
  // konkurrert med menyens egen «Installer som app».
  showInstall: { type: Boolean, default: true },
})
// open-picker: verten bestemmer HVORDAN «Flere valg» åpnes — forsiden navigerer
// til /nytt, hovedmenyen åpner Nytt turkart som modal oppå seg selv. Uten dette
// navigerte knappen alltid, så i modalen forsvant både menyen og modalen.
// v6.5.45: nyttelasten { gps: true } er borte. Den grønne knappen i søkefeltet
// BYGGER nå her — se onGpsBygg — så «Flere valg» åpnes bare av «Flere valg».
const emit = defineEmits(['update:tab', 'open-picker', 'fritt-lende', 'navigert'])

const router = useRouter()

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

// ALL navigasjon ut av dette panelet går her, og `navigert` fyres FØR pushen.
// Samme lærdom som Fritt lende-snarveien (v6.5.33): verten lukker modalen sin på
// en rute-watch, og en push til ruta man ALLEREDE står i er en no-op —
// `route.fullPath` endrer seg aldri, watchen fyrer aldri, og «Mine kart» blir
// stående oppå kartet. Det traff hardest med ETT lagret kart: boot-gjenopptaket
// (router.js) sender deg rett inn i det ene kartet du har, så kartet i lista ER
// det du står i, hver gang. Med to kart traff man vanligvis det andre og
// oppdaget aldri feilen. Verten skal derfor lukke på DENNE hendelsen og ikke på
// ruta; forsiden, som ikke har noen modal, kan la den ligge.
function gaaTil(to) {
  emit('navigert')
  router.push(to)
}

function openRoute(id) {
  gaaTil({ name: 'ruteplanlegger', query: { open: id } })
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
  gaaTil({ name: 'kart-vis', params: { id } })
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
    // `alleredeImportert` trenger ingen egen beskjed: importen ender uansett i
    // kartet, og det er nøyaktig samme utfall brukeren ba om. En melding her
    // ville dessuten blitt vist i et panel som lukkes i samme åndedrag.
    const { id } = await importerKartPakke(fil)
    await refresh()
    gaaTil({ name: 'kart-vis', params: { id } })
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

// ── Last ned et kart som .lendekart-fil ─────────────────────────────────────
// Motstykket til «Importer delt kart» rett over lista, og en snarvei til det
// «Del som offline-fil» gjør inne i kart-visningen. Veien er DELT
// (lib/kartFilDeling.js), så snarveien ikke kan gi en tynnere fil enn den lange
// veien: begge samler datalagene først og leverer via delings-arket når
// telefonen har et, ellers som nedlasting.
//
// Statusen er per kart og ikke én global: lista har mange rader, og en spinner
// på feil rad er verre enn ingen.
const lasterNed = ref('')      // kart-id under pakking, eller ''
const nedlastFeil = ref('')

async function onLastNed(m) {
  if (lasterNed.value) return
  lasterNed.value = m.id
  nedlastFeil.value = ''
  try {
    const kart = await loadMap(m.id)
    const { blob, filnavn } = await pakkKartTilFil({ kart, navn: m.navn, appVersion: APP_VERSION })
    await delEllerLastNedFil(blob, filnavn, m.navn || 'Lende — turkart')
  } catch (err) {
    console.error('Nedlasting av kartfil feilet:', err)
    nedlastFeil.value = `Kunne ikke lage fila for «${m.navn}». ${err?.message || ''}`.trim()
  } finally {
    lasterNed.value = ''
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

// ── Bygge-tilstand for søk → kart ───────────────────────────────────────
// Søketreffet bygger fortsatt direkte (KISS-snarveien under). GPS-pinnen gjør
// det IKKE lenger — den åpner skjemaet sentrert på posisjonen — så det som er
// igjen her er full-screen-loaderen søke-flyten deler med den.
const supportsGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation
const buildingOnTheFly = ref(false)
const buildingProgress = ref('')

// ── Søk → bygg direkte ──────────────────────────────────────────────────
// Søkefeltet på forsiden er en KISS-snarvei: velg et sted fra trefflista → bygg straks et standard 10 × 10 km,
// 20 m ekvidistanse-kart sentrert der, og åpne det. Ingen mellomside med
// størrelse/ekvidistanse-valg — det ligger fortsatt under «Flere valg»
// (MapPickerView) for de som vil finjustere.
const { query, results, isSearching, error: searchError } = useNominatim()

// Tale-til-tekst: diktér søket. Knappen vises kun der nettleseren støtter det.
const { isSupported: micSupported, isListening: micListening, error: micError, toggle: toggleMic } =
  useSpeechInput({ onResult: (t) => { query.value = t; micError.value = null } })

// Høyre-padding + spinner-plassering avhenger av hvor mange kontroll-knapper
// (mikrofon + GPS) som faktisk vises.
const rightControlCount = computed(() =>
  (supportsGeolocation ? 1 : 0) + (micSupported.value ? 1 : 0))
// v6.5.45: den grønne knappen er skrumpet fra 40 til 36 px, altså lik
// mikrofonen. To knapper måler nå 36 + 4 + 36 + 6 = 82 px, én måler 42 px.
const searchRightPad = computed(() =>
  rightControlCount.value === 2 ? 'pr-22' : rightControlCount.value === 1 ? 'pr-13' : 'pr-3')
const spinnerRight = computed(() =>
  rightControlCount.value === 2 ? 'right-[5.5rem]' : rightControlCount.value === 1 ? 'right-[3rem]' : 'right-3.5')

const showResults = computed(() =>
  query.value.trim().length >= 2 && (results.value.length > 0 || isSearching.value)
)

// Ett sted der «Mine kart» lager kart. v6.5.45: den grønne GPS-knappen bygger
// nå OGSÅ herfra, så et trykk på den og et valg i trefflista gjør nøyaktig det
// samme — det er hele skillet mot «Flere valg», der et sted bare VELGES og
// brukeren gjør resten av innstillingene selv.
// Byggingen tar 5–30 sekunder mot Overpass og Kartverket, og overlegget som
// dekker skjerma imens hadde ingen vei ut. Avbryteren er den samme
// AbortController-en Ruteplanleggeren og Fritt lende bruker — `buildMapFromCenter`
// videresender signalet helt ned i hver enkelt henting.
let byggAvbryter = null

async function byggKartFra(sted) {
  if (buildingOnTheFly.value) return
  query.value = ''
  results.value = []
  buildingOnTheFly.value = true
  buildingProgress.value = 'Henter kartdata …'
  byggAvbryter = new AbortController()
  try {
    const stamp = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })
    const { id } = await buildMapFromCenter({
      center: { lat: sted.lat, lon: sted.lon, name: sted.navn },
      ...squareDims(),   // valgt format/bredde — standard 5 km kvadrat
      equidistanceM: squareEquidistance(), // auto: fineste tillatte for bredden (5/10/20 m)
      navn: `${sted.navn} ${stamp}`,
      terrainFirst: true,   // vis terreng straks, fyll inn OSM i bakgrunnen
      signal: byggAvbryter.signal,
      onProgress: (msg) => { buildingProgress.value = msg },
    })
    byggAvbryter = null
    gaaTil({ name: 'kart-vis', params: { id } })
  } catch (e) {
    const avbrutt = e?.name === 'AbortError'
    byggAvbryter = null
    buildingOnTheFly.value = false
    buildingProgress.value = ''
    if (avbrutt) return
    console.error('Søk-kart-bygging feilet:', e)
    alert('Kunne ikke opprette kart: ' + (e.message ?? 'ukjent feil'))
  }
}

function avbrytBygging() {
  byggAvbryter?.abort()
  byggAvbryter = null
  buildingOnTheFly.value = false
  buildingProgress.value = ''
}

function onSelectSearchResult(r) {
  return byggKartFra({ lat: r.lat, lon: r.lon, navn: r.shortName })
}

// ── GPS → bygg direkte ──────────────────────────────────────────────────
// Feilen MÅ sies, og med en forklaring: en nektet posisjon var stille her, og
// knappen så da ut som om den var i stuss. Teksten kommer fra `lib/gpsFeil.js`
// — ÉN kilde, delt med «Flere valg» og Fritt lende.
const gpsLeter = ref(false)
const gpsFeil = ref('')

function onGpsBygg() {
  if (buildingOnTheFly.value || gpsLeter.value) return
  gpsFeil.value = ''
  if (!supportsGeolocation) { gpsFeil.value = GPS_IKKE_STOTTET; return }
  gpsLeter.value = true
  navigator.geolocation.getCurrentPosition(async (pos) => {
    gpsLeter.value = false
    const lat = pos.coords.latitude, lon = pos.coords.longitude
    let navn = 'Min posisjon'
    try {
      const g = await reverseGeocode(lat, lon)
      navn = g?.placeLabel || g?.shortName || navn
    } catch { /* uten navn er kartet like brukbart */ }
    await byggKartFra({ lat, lon, navn })
  }, (err) => {
    gpsLeter.value = false
    gpsFeil.value = gpsFeilForklaring(err.code)
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
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

// Piltaster bytter fane, som i APG-ens tab-mønster. Home/End tas med fordi de
// er billige og forventet i en fane-rad med bare to elementer også.
function onTabKeydown(e) {
  const rekke = ['kart', 'rute']
  const i = rekke.indexOf(activeTab.value)
  let neste = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') neste = rekke[(i + 1) % rekke.length]
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') neste = rekke[(i - 1 + rekke.length) % rekke.length]
  else if (e.key === 'Home') neste = rekke[0]
  else if (e.key === 'End') neste = rekke[rekke.length - 1]
  if (!neste) return
  e.preventDefault()
  activeTab.value = neste
  nextTick(() => document.getElementById(`hjem-fane-${neste}`)?.focus())
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
       for turkart (Mine kart) og ruteplanlegger (Mine ruter).

       IKKE I MODALENE (v6.5.35). Hovedmenyen åpner «Mine kart» og «Mine ruter»
       som hver sin side med sin egen tittel, og en fane-rad der er en snarvei
       til den andre halvdelen av appen midt inne i den ene: den motsier
       tittelen over seg, og de to funksjonene brukes aldri samtidig. Etter at
       modus-bryteren gikk ut av menyen (samme versjon) er menyen det ene
       stedet man bytter halvdel — så raden hadde blitt appens siste sted der
       navigasjonen mellom dem ligger gjemt inne i noe annet.

       Hjem-siden BEHOLDER den: der er `?tab=` en ekte rute-kontrakt med egne
       redirects og røyk-sjekker, og siden er per definisjon fellessiden. -->
  <!-- Ekte tablist (v6.5.48): to knapper som SER ut som faner ble annonsert som
       to uavhengige knapper, uten at noe sa hvilken halvdel man sto i. Roving
       tabindex + piltaster er APG-mønsteret — TAB hopper til innholdet, pilene
       bytter fane. -->
  <div v-if="showTabs" role="tablist" aria-label="Mine kart og ruter"
       @keydown="onTabKeydown"
       class="flex gap-1 p-1 rounded-xl bg-ink/5 border border-ink/10 mb-4">
    <button id="hjem-fane-kart" role="tab" :aria-selected="activeTab === 'kart'"
            aria-controls="hjem-panel-kart" :tabindex="activeTab === 'kart' ? 0 : -1"
            @click="activeTab = 'kart'"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
            :class="activeTab === 'kart' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink-3 active:text-ink'">
      Turkart{{ maps.length ? ` (${maps.length})` : '' }}
    </button>
    <button id="hjem-fane-rute" role="tab" :aria-selected="activeTab === 'rute'"
            aria-controls="hjem-panel-rute" :tabindex="activeTab === 'rute' ? 0 : -1"
            @click="activeTab = 'rute'"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
            :class="activeTab === 'rute' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink-3 active:text-ink'">
      Ruteplanlegger{{ savedRoutes.length ? ` (${savedRoutes.length})` : '' }}
    </button>
  </div>

  <div id="hjem-panel-kart" role="tabpanel" aria-labelledby="hjem-fane-kart"
       v-if="activeTab === 'kart'">
  <!-- Lag-nytt-flyten (søk/GPS/Flere valg) ligger alltid øverst — søk er
       hovedflyten. Kartlista følger rett under, uten egen «Mine kart»-label. -->
  <div class="flex items-center justify-between mb-2 mt-3">
    <div class="text-ink-4 text-[11px] uppercase tracking-wide">Lag nytt kart</div>
    <button @click="emit('open-picker')"
            class="text-[11px] font-medium text-ink-3 active:text-ink
                   flex items-center gap-1 transition">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="18" x2="20" y2="18"/>
      </svg>
      Flere valg
    </button>
  </div>

  <!-- Søkefelt med integrert GPS-knapp. Søk = hovedflyten: velg et sted →
       bygg straks et kart. v6.5.45: den grønne pin-knappen gjør nøyaktig det
       SAMME, bare med et målt senter i stedet for et søkt opp. Forskjellen på
       de to inngangene er hvor senteret kommer fra, ikke hva som skjer etterpå,
       og de deler derfor `byggKartFra`.
       Fram til v6.5.28 bygde den et kart direkte; v6.5.28–44 lot den åpne
       «Flere valg» sentrert der du står, med en hjelpetekst under som forklarte
       forskjellen. Den runden er reversert med vilje: er dette «Mine kart»,
       lager begge veier et kart, og vil man justere først, står «Flere valg»
       rett over. Da trenger knappen ingen hjelpetekst. -->
  <div class="relative z-20 mb-1.5">
    <div class="relative">
      <svg viewBox="0 0 24 24" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>
      </svg>
      <input v-model="query" type="search" autocomplete="off" autocorrect="off"
             @keydown="onSearchKeydown"
             role="combobox" aria-autocomplete="list" :aria-expanded="showResults"
             aria-controls="maphome-results"
             :aria-activedescendant="searchActiveIndex >= 0 ? `maphome-opt-${searchActiveIndex}` : undefined"
             placeholder="Søk etter sted, postnummer eller adresse"
             aria-label="Søk etter sted, postnummer eller adresse"
             :class="['w-full pl-11 py-3.5 rounded-xl bg-ink/[0.06] border border-ink/20 text-[15px]',
                      'placeholder-ink/35 focus:bg-ink/[0.1]',
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
                         micListening ? 'bg-red-500/90 text-ink animate-pulse' : 'bg-ink/10 text-ink-2']">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <button v-if="supportsGeolocation"
                @click="onGpsBygg"
                :disabled="buildingOnTheFly || gpsLeter"
                aria-label="Lag turkart der jeg står (GPS)"
                class="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center
                       shadow-md active:scale-95 transition disabled:opacity-60">
          <svg v-if="gpsLeter" viewBox="0 0 24 24" class="w-5 h-5 animate-spin" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="10" r="3"/>
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Søkeresultater -->
      <!-- Treff-telling som live-region (v6.5.48). Lista er en listbox, og en
           listbox annonserer bare det som er MARKERT — så en skjermleser-bruker
           som skrev og ventet fikk ingen beskjed om at det kom fem treff, eller
           ingen. Teksten er sr-only; tallet står ikke i UI-et fra før. -->
    <div class="sr-only" role="status" aria-live="polite">
      <template v-if="isSearching">Søker …</template>
      <template v-else-if="showResults">{{ results.length }} treff</template>
    </div>
    <Transition name="fade">
      <div v-if="showResults" id="maphome-results" role="listbox"
           class="absolute left-0 right-0 mt-1 rounded-xl bg-surface/98 backdrop-blur
                  border border-ink/10 shadow-2xl max-h-[50dvh] overflow-y-auto z-30">
        <div v-if="results.length === 0 && !isSearching"
             class="px-4 py-3 text-[13px] text-ink-4">Ingen treff</div>
        <button v-for="(r, index) in results" :key="r.id"
                :id="`maphome-opt-${index}`" role="option"
                :aria-selected="index === searchActiveIndex"
                @click="onSelectSearchResult(r)"
                @mousemove="searchActiveIndex = index"
                class="w-full text-left px-4 py-2.5 transition border-b
                       border-ink/8 last:border-0"
                :class="index === searchActiveIndex ? 'bg-ink/12' : 'active:bg-ink/10'">
          <div class="text-[13px] font-medium text-ink truncate">{{ r.shortName }}</div>
          <div class="text-[11px] text-ink-4 truncate">{{ r.name }}</div>
        </button>
      </div>
    </Transition>
  </div>

  <!-- v6.5.45: hjelpeteksten under søkefeltet er fjernet. Den forklarte en
       knapp som nå gjør det samme som lista over den, og den sto i veien for
       nettopp den lista ved stor tekst. Det som ER verdt plass er en NEKTET
       tillatelse: begge knappene var helt stille når nettleseren sa nei. -->
  <div v-if="gpsFeil" role="alert"
       class="mb-4 px-3 py-2.5 rounded-lg bg-amber-500/[0.12] border border-amber-400/35
              text-amber-100 text-[13px] leading-snug">{{ gpsFeil }}</div>
  <div v-if="micError" role="alert"
       class="mb-4 px-3 py-2.5 rounded-lg bg-amber-500/[0.12] border border-amber-400/35
              text-amber-100 text-[13px] leading-snug">{{ mikrofonFeilForklaring(micError) }}</div>
  <div v-if="searchError" class="-mt-2 mb-4 px-1 text-[11px] text-slate-300">{{ searchError }}</div>

  <!-- Importer et kart en turkamerat har delt som fil. Står her, mellom
       «lag nytt» og lista, fordi det er den andre måten et kart havner i
       lista på. Virker uten nett — fila inneholder alt. -->
  <button type="button" @click="onVelgImportFil" :disabled="importerer"
          class="w-full mb-3 px-3 py-3 rounded-lg border border-ink/10 bg-ink/[0.04]
                 text-ink-2 text-[14px] active:scale-[0.99] disabled:opacity-60
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

  <!-- Kunne ikke lage fila for ett av kartene. Står over lista, ikke i raden:
       en feiltekst inne i en rad ville presset kortet ut av form akkurat der
       brukeren nettopp trykket. -->
  <div v-if="nedlastFeil" role="alert"
       class="mb-3 px-3 py-2.5 rounded-lg bg-rose-500/[0.10] border border-rose-400/30
              text-rose-200 text-[13px] leading-snug">{{ nedlastFeil }}</div>

  <!-- Kart-kortet har TO linjer: kartet selv (ikon + navn + to metadatalinjer),
       og en handlingsrad under. Fram til v6.5.47 sto knappene til høyre for
       navnet og stjal bredden fra nettopp de to metadatalinjene, som da ble
       kuttet med «…» på en vanlig telefon. Nå får teksten hele bredden, og
       nedlastingen får plass ved siden av de to andre — det er den samme fila
       «Importer delt kart» over lista tar imot, så eksport og import står nå
       på samme side. -->
  <div v-for="(m, index) in maps" :key="m.id"
       :id="`maphome-map-${index}`"
       class="mb-2 rounded-lg border overflow-hidden"
       :class="index === mapsActiveIndex
         ? 'border-emerald-300/50 bg-ink/[0.08]'
         : 'border-ink/10 bg-ink/[0.04]'">
    <button type="button" @click="openMap(m.id)"
            class="w-full text-left flex items-center gap-3 px-4 pt-3 pb-2
                   active:bg-ink/[0.07] focus-visible:outline-2 focus-visible:-outline-offset-2
                   focus-visible:outline-emerald-400">
      <div class="shrink-0 w-10 h-10 rounded-lg bg-slate-500/15 border border-slate-300/25
                  flex items-center justify-center text-slate-300">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
          <path d="M9 4 V18 M15 6 V20"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-[14px] truncate text-ink">{{ m.navn }}</div>
        <div class="text-[12px] text-ink-3 truncate">
          {{ [storrelseFor(m), m.equidistanceM ? `${m.equidistanceM} m ekv.` : '', demLabel(m.demResolutionM, m.demSource)].filter(Boolean).join(' · ') }}
        </div>
        <div class="text-[11px] text-ink-4 truncate">
          {{ formatDateTime(m.opprettet) }}<template v-if="formatBytes(m.sizeBytes)"> · {{ formatBytes(m.sizeBytes) }}</template>
        </div>
      </div>
    </button>
    <!-- Handlingsraden ligger UTENFOR kart-knappen, ikke oppå den: en knapp i
         en knapp er ugyldig markup, og @click.stop er en avtale man må huske
         hver gang det kommer en knapp til. -->
    <div class="flex items-center justify-end gap-1 px-3 pb-2">
      <button type="button" @click="onLastNed(m)" :disabled="!!lasterNed"
              :aria-label="`Last ned ${m.navn} som fil`"
              :aria-busy="lasterNed === m.id ? 'true' : undefined"
              class="w-9 h-9 rounded-lg flex items-center justify-center text-ink-3
                     active:bg-ink/10 active:text-ink disabled:opacity-40
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-emerald-400">
        <span v-if="lasterNed === m.id"
              class="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink/70 animate-spin"></span>
        <svg v-else viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
      <button type="button" @click="onRename(m.id, m.navn)"
              :aria-label="`Gi ${m.navn} nytt navn`"
              class="w-9 h-9 rounded-lg flex items-center justify-center text-ink-3
                     active:bg-ink/10 active:text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-emerald-400">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
      </button>
      <button type="button" @click="onDelete(m.id, m.navn)"
              :aria-label="`Slett ${m.navn}`"
              class="w-9 h-9 rounded-lg flex items-center justify-center text-ink-3
                     active:bg-ink/10 active:text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-emerald-400">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6 L18 20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 L5 6"/>
          <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
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
    <div class="mt-4 text-[15px] font-semibold text-ink-2">Ingen egne kart ennå</div>
    <!-- v6.5.28: den store grønne CTA-en «Lag kart der du står» er fjernet.
         Den gjorde nøyaktig det samme som pin-knappen i søkefeltet rett over,
         og to grønne knapper med samme handling på samme skjerm er ikke et
         valg — det er en gjetning om hvilken som er den ekte.

         v6.5.35: bruksanvisningen for de to inngangene er fjernet med. Søkefeltet
         og pin-knappen står rett over, med hver sin plassholder og etikett, og
         en linje som peker på kontroller man allerede ser er en linje man leser
         forbi. Teksten står IGJEN der geolokasjon MANGLER: der er pin-knappen
         borte, og «Søk opp et sted» er da det eneste som finnes å gjøre. -->
    <div v-if="!supportsGeolocation" class="mt-1.5 text-[13px] text-ink-4 leading-relaxed max-w-[18rem]">
      Søk opp et sted øverst for å lage ditt første turkart.
    </div>

    <!-- Snarvei til Fritt lende (v6.5.31). Modusen bor bare i hovedmenyen, og
         en tom liste er nøyaktig der noen står som ville hatt et kart uten
         skjemaet over. Den står UNDER teksten: skjemaet er fortsatt hovedveien.

         v6.5.37 — INGEN AKSENTFARGE, og det er målt. Flata var
         `bg-amber-400/[0.08]`, som mot kortet under gir 1,02:1 i lyst tema:
         den kostet en fjerde betydning for gult i denne fila (valgt fane,
         FAB-ring, varselpanelet hundre linjer opp, favoritt-stjerna) og
         leverte nesten ingen flate-kontrast. Grønt er utelukket av samme grunn
         som v6.5.28 over: Fritt lende ER «lag kart der jeg står», og en andre
         grønn ting med den handlingen er ikke et valg, det er en gjetning.
         Nøytralt `ink/[0.06]` inni kortets `ink/[0.03]` leses som et hevet
         element i SAMME kort — gjenkjennelsen bæres nå av kompass-glyfen fra
         hovedmenyens rad, ikke av fargen.

         TEKSTEN SOLGTE MOT SEG SELV. «Vil du bare ha et turkart uten noe mer
         fuzz?» påstår at hovedveien er tungvint, mens hele grunnen til at
         knappen er tonet og ikke grønn er at hovedveien skal stå. Overskriften
         sier nå forskjellen — ingen innstillinger — og ikke stedet, for «der du
         står» er nøyaktig hva den grønne pin-knappen tre centimeter over gjør.
         De to gamle småtekstene lå dessuten på 4,08 og 2,70 mot AAs 4,5.
         «Krever nett» blir stående: dette er det ene stedet i appen der
         premisset snus, og en bruker i den tomme lista har aldri sett
         hovedmenyens rad som sier det.

         v6.5.33: den navigerte SELV, med `router.push('/fritt')`, og lot
         eieren om å rydde. Det så riktig ut fordi rute-byttet uansett river
         panelet med seg — men står du ALLEREDE i Fritt lende, er navigasjonen
         en no-op: `route.fullPath` endrer seg ikke, watchen i AppMenu som
         nullstiller `sheet` fyrer aldri, og «Mine kart» blir stående oppå
         arket. Nå eier KALLEREN både lukkingen og ruta — AppMenu gjennom
         `goFrittLende`, som også er den ene som kjenner `replace`-regelen. -->
    <button type="button" @click="emit('fritt-lende')"
            class="mt-6 w-full max-w-[20rem] min-h-11 px-4 py-3 rounded-xl border text-left
                   flex items-center gap-3 transition
                   bg-ink/[0.06] border-ink/15
                   active:bg-ink/[0.11] active:scale-[0.99]
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40">
      <!-- Samme kompass-glyf som Fritt lende-raden i hovedmenyen (am-row-icon),
           så de to inngangene til modusen leses som samme sted. -->
      <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-ink-3" fill="none" stroke="currentColor"
           stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5"/>
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M14.5 9.5l-2 5-5 2 2-5 5-2Z"/>
      </svg>
      <span class="flex-1 min-w-0">
        <span class="block text-[14px] font-semibold text-ink">Ett kart, ingen innstillinger</span>
        <span class="block mt-0.5 text-[12px] leading-snug text-ink-2">
          Fritt lende — ett ark der du står, én knapp. Krever nett.
        </span>
      </span>
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 text-ink-3" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 6 6 6-6 6"/>
      </svg>
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
    <span class="block mt-0.5 text-[11px] font-normal text-ink-4 tabular-nums">
      {{ maps.length }} kart<template v-if="formatBytes(totalBytes)"> · {{ formatBytes(totalBytes) }}</template>
    </span>
  </button>

  <!-- Tegnforklaring-knappen er fjernet fra forsiden (v9.3.38) — den finnes
       fortsatt som hurtigvalg inne i kart-visningen (MapView-drawer). -->
  </div>

  <!-- Ruteplanlegger-fanen: Mine ruter øverst, «+ Ny rute» som diskret
       handling. Hele forvaltnings-flyten (stjerner/sortering/deling) bor
       HER — portert fra planleggerens gamle «Mine ruter»-ark. -->
  <div id="hjem-panel-rute" role="tabpanel" aria-labelledby="hjem-fane-rute" v-else>
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="text-ink-4 text-[11px] uppercase tracking-wide">Mine ruter
        <span v-if="starFilter && savedRoutes.length"
              class="normal-case tracking-normal">· {{ visibleSavedRoutes.length }} av {{ savedRoutes.length }}</span>
      </span>
      <button v-if="!loading && savedRoutes.length > 0"
              @click="gaaTil('/rute')"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                     bg-emerald-700 text-white
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
                         border-ink/15 text-ink-3 active:scale-95 transition">Avbryt</button>
        </div>
        <div class="text-[10px] text-ink-4">
          Trykk på rutene du vil dele (inntil {{ MAX_SHARE_ROUTES }}) — mottakeren får alle i én lenke.
        </div>
      </template>
      <div v-else class="flex gap-1.5 items-center">
        <label class="sr-only" for="hjem-rute-sortering">Sorter etter</label>
        <select id="hjem-rute-sortering" v-model="savedSort.key"
                class="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] bg-surface-2 border
                       border-ink/15 text-ink-2">
          <option v-for="f in SORT_FIELDS" :key="f.key" :value="f.key">{{ f.label }}</option>
        </select>
        <button @click="savedSort.dir = savedSort.dir === 'desc' ? 'asc' : 'desc'"
                :aria-label="savedSort.dir === 'desc' ? 'Synkende — bytt til stigende' : 'Stigende — bytt til synkende'"
                class="shrink-0 w-8 h-8 rounded-lg border bg-ink/5 border-ink/15 text-ink-2
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
                       border-ink/15"
                :class="starFilter ? 'text-amber-300 border-amber-400/40' : 'text-ink-2'">
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
         class="text-[13px] text-ink-4 text-center py-6">
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
        <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-ink-4" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
          <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
        </svg>
        <button class="flex-1 min-w-0 text-left active:opacity-70 transition"
                @click="shareSelectMode || openRoute(rec.id)">
          <div class="font-medium text-[14px] truncate text-ink">{{ rec.navn }}</div>
          <div class="text-[12px] text-ink-4 truncate">{{ formatRouteInfo(rec) }}</div>
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
                  class="w-8 h-8 rounded-full flex items-center justify-center text-ink-4
                         active:text-sky-300 active:bg-sky-500/10 transition shrink-0">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button @click.stop="onDeleteRoute(rec.id, rec.navn)" aria-label="Slett rute"
                  class="w-8 h-8 rounded-full flex items-center justify-center text-ink-4
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
                :class="(rec.stjerner ?? 0) >= s ? 'text-amber-400' : 'text-ink-4'">
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
      <svg viewBox="0 0 24 24" class="w-14 h-14 text-ink-4" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
        <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
      </svg>
      <div class="mt-4 text-[15px] font-semibold text-ink-2">Ingen lagrede ruter ennå</div>
      <div class="mt-1.5 text-[13px] text-ink-4 leading-relaxed max-w-[18rem]">
        Planlegg en rute fra A til B i ruteplanleggeren og lagre den — så finner du den igjen her.
      </div>
      <button @click="gaaTil('/rute')"
              class="mt-5 w-full py-3.5 rounded-xl bg-emerald-700 text-white font-semibold
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
  </div>

  <!-- «Installer som app»: nederst, diskret — skal ikke konkurrere med
       listene. Vises når nettleseren tilbyr PWA-install (canInstall) eller
       på iOS (manuell veiledning); skjult når appen kjører installert. -->
  <button v-if="showInstallButton"
          @click="onInstallClick"
          class="w-full mt-6 py-3 rounded-xl bg-ink/[0.06] border border-ink/20
                 text-ink text-[14px] font-medium flex items-center justify-center gap-2
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
    <div class="text-[12px] text-ink-2 px-6 text-center max-w-[280px]
                min-h-[18px] leading-snug" role="status" aria-live="polite">
      {{ buildingProgress }}
    </div>
    <!-- Ærlig ventetid: kartdataene hentes fra Overpass og Kartverket, og på
         dårlig dekning er det de sekundene det tar. Uten tallet leses et
         overlegg som står i ti sekunder som en app som har hengt seg. -->
    <div class="text-[11px] text-ink-3 mt-1.5 px-6 text-center">
      Tar vanligvis 5–30 sekunder.
    </div>
    <button type="button" @click="avbrytBygging"
            class="mt-6 px-5 py-2.5 rounded-xl text-[13px] font-medium border
                   bg-ink/5 border-ink/15 text-ink-2
                   active:bg-ink/10 active:scale-[0.98] transition">
      Avbryt
    </button>
  </div>
</Transition>

<!-- Gi kart nytt navn (bunn-ark) -->
<RenameMapDialog
  :open="renaming !== null"
  :navn="renaming?.navn ?? ''"
  @update:open="v => { if (!v) renaming = null }"
  @save="onRenameSave" />
</template>

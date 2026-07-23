<script setup>
import { ref, computed, watch, onMounted, onActivated, onUnmounted, onDeactivated } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listMaps, deleteMap, clearAll, renameMap, listGravelRoutes, deleteGravelRoute } from '../lib/mapStorage.js'
import RenameMapDialog from '../components/RenameMapDialog.vue'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { useMapSizePreference, effectiveEquidistanceForWidthKm, defaultMapDims, aspectForFormat } from '../composables/useMapSizePreference.js'
import { useNominatim } from '../composables/useNominatim.js'
import { useSpeechInput } from '../composables/useSpeechInput.js'
import { reverseGeocode } from '../lib/geocode.js'
import { useSearchKeyboard } from '../composables/useSearchKeyboard.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
import AppMenuButton from '../components/AppMenuButton.vue'

const router = useRouter()

// ── «Installer som app» ───────────────────────────────────────────────────
// Forsiden tilbyr PWA-install. Knappen vises når nettleseren har fyrt av
// beforeinstallprompt (Chrome/Edge/Android → canInstall) eller på iOS (der
// install er manuell via Del-menyen). Skjules når appen alt kjører installert
// (standalone). Klikk → confirm() → nettleserens egen install-prompt.
const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()
const showInstallButton = computed(() => !isStandalone.value && (canInstall.value || isIOS.value))

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
const loading = ref(true)

// ── Faner: Turkart / Ruteplanlegger ───────────────────────────────────────
// Hjem-siden er fellesside for begge modusene: «Turkart»-fanen viser lag-nytt +
// Mine kart, «Ruteplanlegger»-fanen viser Mine ruter. Hovedmenyen navigerer hit
// med ?tab=kart|rute.
const route = useRoute()
const activeTab = ref(route.query.tab === 'rute' ? 'rute' : 'kart')
watch(() => route.query.tab, (t) => { if (t === 'rute' || t === 'kart') activeTab.value = t })

// Lista eier fanene; lag-nytt-flyten (søk/GPS/Flere valg) ligger bak et lite
// «+ Nytt kart» og foldes kun ut på forespørsel. Unntak: tom liste → vis
// lag-nytt direkte, så førstegangsbrukeren sparer et klikk.
const showCreateMap = ref(false)
const createMapVisible = computed(() =>
  showCreateMap.value || (!loading.value && maps.value.length === 0))
watch(activeTab, () => { showCreateMap.value = false })

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
    maps.value = (await listMaps()).filter(m => !m.isAuto)
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
function infoLine(sizeStr, eq, demRes, demSource) {
  const parts = [`${sizeStr} × ${sizeStr} km`]
  if (eq) parts.push(`${eq} m ekv.`)
  const dl = demLabel(demRes, demSource)
  if (dl) parts.push(dl)
  return parts.join(' · ')
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
    alert('Nettleseren støtter ikke GPS')
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
    const map = {
      1: 'GPS-tillatelse avvist',
      2: 'GPS-posisjon ikke tilgjengelig',
      3: 'GPS-forespørsel tok for lang tid',
    }
    alert(map[err.code] ?? 'GPS-feil — kan ikke opprette kart her')
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
onUnmounted(() => window.removeEventListener('keydown', onWindowKeydown))
onDeactivated(() => window.removeEventListener('keydown', onWindowKeydown))
</script>

<template>
  <div class="kart-ui relative w-full min-h-[100dvh] flex flex-col bg-[#0e1116] text-white/90">

    <!-- Toppbar. Rute-knappen til venstre er snarveien til Ruteplanleggeren
         (speiler tilbake-knappen i Ruteplanleggerens header). Bak: diskrete
         kontur-ringer fra logoen, spredt fra øvre venstre hjørne. -->
    <div class="relative overflow-hidden shrink-0 px-3 py-2.5 flex items-center gap-2
                bg-zinc-900/80 border-b border-white/10">
      <svg viewBox="0 0 400 60" preserveAspectRatio="xMinYMin slice" aria-hidden="true"
           class="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <path id="hdr-blob" d="M0,-100 C58,-100 100,-58 97,-4 C94,50 58,99 2,97 C-54,95 -99,52 -97,-2 C-99,-56 -58,-100 0,-100 Z"/>
        </defs>
        <g fill="none" stroke="#3a3d45" stroke-width="1.4" opacity="0.55">
          <use href="#hdr-blob" transform="translate(0,0) scale(0.18)"/>
          <use href="#hdr-blob" transform="translate(0,0) scale(0.34)"/>
          <use href="#hdr-blob" transform="translate(0,0) scale(0.52)"/>
          <use href="#hdr-blob" transform="translate(0,0) scale(0.72)"/>
        </g>
      </svg>
      <div class="relative"><AppMenuButton variant="header" /></div>
      <div class="relative flex-1"></div>
    </div>

    <!-- Innhold -->
    <div class="flex-1 px-4 pt-4 pb-32 overflow-y-auto">

      <!-- Fane-veksler (samme segment-stil som Om-siden): hjem-siden er felles
           for turkart (Mine kart) og ruteplanlegger (Mine ruter). -->
      <div class="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-4">
        <button @click="activeTab = 'kart'"
                class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
                :class="activeTab === 'kart' ? 'bg-[#ffd84a] text-zinc-900' : 'text-white/60 active:text-white/90'">
          Turkart{{ maps.length ? ` (${maps.length})` : '' }}
        </button>
        <button @click="activeTab = 'rute'"
                class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
                :class="activeTab === 'rute' ? 'bg-[#ffd84a] text-zinc-900' : 'text-white/60 active:text-white/90'">
          Ruteplanlegger{{ savedRoutes.length ? ` (${savedRoutes.length})` : '' }}
        </button>
      </div>

      <template v-if="activeTab === 'kart'">
      <!-- Lista eier fanen: «Mine kart» øverst, med et lite «+ Nytt kart» som
           folder ut lag-nytt-flyten (søk/GPS/Flere valg). Tom liste → lag-nytt
           vises direkte (createMapVisible). -->
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-white/45 text-[11px] uppercase tracking-wide">Mine kart</span>
        <div class="flex items-center gap-3">
          <span v-if="totalBytes > 0" class="text-white/35 text-[11px] tabular-nums">
            {{ formatBytes(totalBytes) }}
          </span>
          <button v-if="!loading && maps.length > 0"
                  @click="showCreateMap = !showCreateMap"
                  :aria-expanded="createMapVisible"
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                         transition active:scale-95"
                  :class="showCreateMap
                    ? 'bg-[#ffd84a] text-zinc-900'
                    : 'bg-white/[0.06] border border-white/15 text-white/75'">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 transition-transform duration-200"
                 :class="{ 'rotate-45': showCreateMap }" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nytt kart
          </button>
        </div>
      </div>

      <template v-if="createMapVisible">
      <div class="flex items-center justify-between mb-2 mt-3">
        <div class="text-white/45 text-[11px] uppercase tracking-wide">Lag nytt kart</div>
        <button @click="router.push('/kart/nytt')"
                class="text-[11px] font-medium text-white/55 active:text-white/85
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
          <svg viewBox="0 0 24 24" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>
          </svg>
          <input v-model="query" type="search" autocomplete="off" autocorrect="off"
                 @keydown="onSearchKeydown"
                 role="combobox" aria-autocomplete="list" :aria-expanded="showResults"
                 aria-controls="maphome-results"
                 :aria-activedescendant="searchActiveIndex >= 0 ? `maphome-opt-${searchActiveIndex}` : undefined"
                 placeholder="Søk etter sted, postnummer eller adresse"
                 :class="['w-full pl-11 py-3.5 rounded-xl bg-white/[0.06] border border-white/20 text-[15px]',
                          'placeholder-white/35 focus:outline-none focus:bg-white/[0.1]',
                          'focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-400/15 transition',
                          searchRightPad]" />
          <!-- Søke-spinner (til venstre for kontroll-knappene) -->
          <div v-if="isSearching"
               :class="['absolute top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/15',
                        'border-t-white/70 rounded-full animate-spin', spinnerRight]" />
          <!-- Kontroll-knapper: mikrofon (diktér søk) + GPS (lag kart der jeg er) -->
          <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button v-if="micSupported" type="button" @click="toggleMic"
                    :aria-label="micListening ? 'Stopp diktering' : 'Diktér søk (tale til tekst)'"
                    :aria-pressed="micListening"
                    :class="['w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95',
                             micListening ? 'bg-red-500/90 text-white animate-pulse' : 'bg-white/10 text-white/70']">
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
               class="absolute left-0 right-0 mt-1 rounded-xl bg-zinc-900/98 backdrop-blur
                      border border-white/10 shadow-2xl max-h-[50dvh] overflow-y-auto z-30">
            <div v-if="results.length === 0 && !isSearching"
                 class="px-4 py-3 text-[13px] text-white/50">Ingen treff</div>
            <button v-for="(r, index) in results" :key="r.id"
                    :id="`maphome-opt-${index}`" role="option"
                    :aria-selected="index === searchActiveIndex"
                    @click="onSelectSearchResult(r)"
                    @mousemove="searchActiveIndex = index"
                    class="w-full text-left px-4 py-2.5 transition border-b
                           border-white/8 last:border-0"
                    :class="index === searchActiveIndex ? 'bg-white/12' : 'active:bg-white/10'">
              <div class="text-[13px] font-medium text-white truncate">{{ r.shortName }}</div>
              <div class="text-[11px] text-white/50 truncate">{{ r.name }}</div>
            </button>
          </div>
        </Transition>
      </div>

      <!-- Hjelpetekst som forklarer den integrerte GPS-knappen. -->
      <div v-if="supportsGeolocation"
           class="mb-4 px-1 text-[11.5px] text-white/45 flex items-center gap-1.5 leading-snug">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-emerald-300/80 shrink-0" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="10" r="3"/>
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        </svg>
        <span>Søk etter et sted — eller trykk den grønne knappen for å lage kart der du står.</span>
      </div>
      <div v-if="searchError" class="-mt-2 mb-4 px-1 text-[11px] text-slate-300">{{ searchError }}</div>
      </template>

      <!-- Vardåsen-referansekartet er flyttet til «Utvikler»-fanen inne i kart-
           visningen (debug-hjelp) — det fyller ikke lenger forsiden. -->

      <!-- Vises kun når brukeren har samlet opp mange kart. Filene er små,
           så dette handler om ryddighet/utdaterte kart, ikke lagringsplass. -->
      <div v-if="!loading && maps.length > 9"
           class="mb-2 px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-400/20
                  text-amber-200/80 text-[11px] leading-snug">
        Du har mange og potensielt utdaterte kart. Slett kart du ikke trenger lenger for å
        holde lista ryddig.
      </div>

      <div v-if="loading" class="flex justify-center py-6">
        <div class="w-5 h-5 border-2 border-white/15 border-t-white/60 rounded-full animate-spin"/>
      </div>

      <div v-for="(m, index) in maps" :key="m.id"
           :id="`maphome-map-${index}`"
           class="mb-2 rounded-lg border overflow-hidden"
           :class="index === mapsActiveIndex
             ? 'border-emerald-300/50 bg-white/[0.08]'
             : 'border-white/10 bg-white/[0.04]'">
        <div class="flex items-center gap-3 px-4 py-3 active:bg-white/[0.07]"
             @click="openMap(m.id)">
          <div class="shrink-0 w-10 h-10 rounded-lg bg-slate-500/15 border border-slate-300/25
                      flex items-center justify-center text-slate-300">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
              <path d="M9 4 V18 M15 6 V20"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-[14px] truncate text-white">{{ m.navn }}</div>
            <div class="text-[12px] text-white/50 truncate">
              {{ infoLine((m.halfKm * 2).toFixed(1), m.equidistanceM, m.demResolutionM, m.demSource) }}
            </div>
            <div class="text-[11px] text-white/35 truncate">
              {{ formatDateTime(m.opprettet) }}<template v-if="formatBytes(m.sizeBytes)"> · {{ formatBytes(m.sizeBytes) }}</template>
            </div>
          </div>
          <button @click.stop="onRename(m.id, m.navn)"
                  aria-label="Gi kart nytt navn"
                  class="w-9 h-9 rounded-lg flex items-center justify-center text-white/35
                         active:bg-white/10 active:text-white/70">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
          <button @click.stop="onDelete(m.id, m.navn)"
                  aria-label="Slett kart"
                  class="w-9 h-9 rounded-lg flex items-center justify-center text-white/35
                         active:bg-white/10 active:text-white/70">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6 L18 20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 L5 6"/>
              <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="!loading && maps.length === 0"
           class="mt-6 px-6 py-8 rounded-xl bg-white/[0.03] border border-white/10
                  flex flex-col items-center text-center">
        <!-- Stort ton-i-ton kart-ikon (samme folde-kart-glyf som lista bruker). -->
        <svg viewBox="0 0 24 24" class="w-20 h-20 text-white/[0.08]" fill="none"
             stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
          <path d="M9 4 V18 M15 6 V20"/>
        </svg>
        <div class="mt-4 text-[15px] font-semibold text-white/80">Ingen egne kart ennå</div>
        <div v-if="supportsGeolocation" class="mt-1.5 text-[13px] text-white/45 leading-relaxed max-w-[18rem]">
          Lag ditt første turkart der du står — eller søk opp et sted øverst.
        </div>
        <div v-else class="mt-1.5 text-[13px] text-white/45 leading-relaxed max-w-[18rem]">
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

      <!-- Slett alle (vises kun når brukeren har lagrede kart) -->
      <button v-if="!loading && maps.length > 0"
              @click="onDeleteAll"
              class="w-full mt-3 rounded-lg px-4 py-2.5 text-[13px] font-medium
                     text-rose-300 border border-rose-400/25 bg-rose-500/10
                     active:bg-rose-500/15 active:scale-[0.99] transition">
        Slett alle ({{ maps.length }}) kart
      </button>

      <!-- Tegnforklaring-knappen er fjernet fra forsiden (v9.3.38) — den finnes
           fortsatt som hurtigvalg inne i kart-visningen (MapView-drawer). -->
      </template>

      <!-- Ruteplanlegger-fanen: Mine ruter øverst, «+ Ny rute» som diskret
           handling. Tom liste → stor CTA i tom-tilstanden i stedet. -->
      <template v-else>
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="text-white/45 text-[11px] uppercase tracking-wide">Mine ruter</span>
          <button v-if="!loading && savedRoutes.length > 0"
                  @click="router.push('/rute')"
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                         bg-white/[0.06] border border-white/15 text-white/75
                         transition active:scale-95">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ny rute
          </button>
        </div>

        <div v-for="rec in savedRoutes" :key="rec.id"
             class="mb-2 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-3 active:bg-white/[0.07]"
               @click="openRoute(rec.id)">
            <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-white/40" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
              <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
            </svg>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-[14px] truncate text-white">{{ rec.navn }}</div>
              <div class="text-[12px] text-white/50 truncate">
                {{ formatRouteInfo(rec) }}<template v-if="rec.stars"> · {{ '★'.repeat(rec.stars) }}</template>
              </div>
            </div>
            <button @click.stop="onDeleteRoute(rec.id, rec.navn)" aria-label="Slett rute"
                    class="w-8 h-8 rounded-full flex items-center justify-center text-white/40
                           active:text-rose-300 active:bg-rose-500/10 transition shrink-0">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="!loading && savedRoutes.length === 0"
             class="mt-10 flex flex-col items-center text-center">
          <svg viewBox="0 0 24 24" class="w-14 h-14 text-white/20" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
            <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
          </svg>
          <div class="mt-4 text-[15px] font-semibold text-white/80">Ingen lagrede ruter ennå</div>
          <div class="mt-1.5 text-[13px] text-white/45 leading-relaxed max-w-[18rem]">
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
              class="w-full mt-6 py-3 rounded-xl bg-white/[0.06] border border-white/20
                     text-white/85 text-[14px] font-medium flex items-center justify-center gap-2
                     active:bg-white/[0.1] active:scale-[0.99] transition">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>
        </svg>
        <span>Installer som app</span>
      </button>
    </div>

    <!-- Full-screen loader for on-the-fly kart-bygging -->
    <Transition name="overlay-fade">
      <div v-if="buildingOnTheFly"
           class="fixed inset-0 z-[60] bg-zinc-950/92 backdrop-blur-sm
                  flex flex-col items-center justify-center text-white">
        <div class="w-16 h-16 mb-4">
          <svg viewBox="0 0 50 50" class="w-full h-full animate-spin"
               fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
            <circle cx="25" cy="25" r="20" stroke-opacity="0.18"/>
            <path d="M25 5 a20 20 0 0 1 20 20"/>
          </svg>
        </div>
        <div class="text-[16px] font-semibold mb-1">Oppretter kart</div>
        <div class="text-[12px] text-white/65 px-6 text-center max-w-[280px]
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
  </div>
</template>

<style scoped>
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.22s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to       { opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>

<script setup>
// Fullskjerm 3D-visning — ÉN viser for alle tre inngangene (v5.7.0):
//   • fra kartet          → fri utforsking, ingen tur
//   • trykk på stinettet  → en tur visningen lager selv
//   • Stifinner/rundtur   → den planlagte ruta står klar i følge-kameraet
//
// Skallet eier motorens livssyklus (create3dScene i onMounted, dispose i
// onBeforeUnmount) og holder alt engine-relatert utenfor Vue-reaktivitet
// (toRaw/ikke-reaktive variabler) — reaktive proxies i RAF-loopen dreper
// frameraten. Lukkeveier: X-knapp, Escape og Android-tilbakeknapp (pushState +
// popstate; samme URL, så vue-router er upåvirket).
import { ref, computed, watch, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { useScreenWakeLock } from '../../composables/useScreenWakeLock.js'
import { sampleProfile } from '../../lib/elevationProfile.js'
import Tour3dFeatureCard from './Tour3dFeatureCard.vue'
import Tour3dPinPanel from './Tour3dPinPanel.vue'
import Tour3dInfoPanel from './Tour3dInfoPanel.vue'
import Tour3dHud from './Tour3dHud.vue'
import { lesPinPrefs, skrivPinPrefs, paaGrupper } from '../../lib/tour3d/pinPrefs.js'

const props = defineProps({
  dem: { type: Object, default: null },
  meta: { type: Object, required: true },
  searchIndex: { type: Array, default: () => [] },
  // Sti-/veg-geometri lest ut av kart-SVG-en av forelderen (som eier DOM-en).
  pathFeatures: { type: Array, default: () => [] },
  // Hindre-geometri (vann, hovedvei, jernbane, bygning, stup) — sti-vandringen
  // hopper ikke over et brudd i stinettet når et av disse ligger imellom.
  barrierFeatures: { type: Array, default: () => [] },
  // Brukerminner bakt inn i SVG-en — offline-tilgjengelige.
  brukerminner: { type: Array, default: () => [] },
  // Planlagt tur fra Stifinneren: { route: {coordinates, lengthM}, via, isLoop }.
  // Null = visningen åpnes uten tur.
  tour: { type: Object, default: null },
  estWalkMinutes: { type: Function, default: null },
  getSvgText: { type: Function, required: true },
  isDark: { type: Boolean, default: false },
  // Live GPS-posisjon i SVG-meter, null når posisjonering ikke er aktiv.
  // MapView sender et nytt lite objekt per fix, så watch-en trigges.
  userPos: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const KRYSSPAUSE_KEY = 'lende-3d-krysspause'
const TIME_SCALES = [64, 128, 256]
const HUD_FELTER = ['gaatt', 'igjen', 'hoyde', 'stigning', 'eta']

const phase = ref('loading')      // loading | ready | no-dem | no-webgl | error
// Kortet for en severdighet: den man TRYKKET på vinner over den turen stopper
// ved, så et valg aldri blir overskrevet av koreografien.
const pickedFeature = ref(null)
const stopFeature = ref(null)
const activeFeature = computed(() => pickedFeature.value ?? stopFeature.value)
const walking = ref(false)
const fixedTour = ref(false)
const playing = ref(false)
const finished = ref(false)
const detached = ref(false)
// Fingeren ligger nede og ser seg rundt fra et frosset punkt (følge-riggens
// hold). Vises som et hint så den som fant det ved uhell skjønner hva som skjer.
const holdingLook = ref(false)
const timeScale = ref(128)
const stats = ref(null)
const junction = ref(null)
// Krysspause: turen stopper like før hvert stikryss så valget kan tas i ro.
// Default på — uten den rekker man ikke å reagere før krysset er passert —
// og valget huskes mellom økter.
const kryssPauseOn = ref((() => {
  try { return localStorage.getItem(KRYSSPAUSE_KEY) !== '0' } catch { return true }
})())
const hasPaths = ref(false)
const pinCounts = ref({})
const pinGroups = ref([])
const extrasLoading = ref(true)
// Hva motoren holder på med: vises i laste-overlayet, og som en diskret pille
// når kartbildet skjerpes etter at visningen alt er åpen.
const buildMsg = ref(null)
const toast = ref('')
const isLandscape = ref(typeof window !== 'undefined' && window.innerWidth > window.innerHeight)

const canvasHost = ref(null)
let engine = null
let abort = null
let poppedByHistory = false
let toastTimer = 0

const wake = useScreenWakeLock({ persist: false, defaultOn: false, idleTimeoutMs: 0 })

const errorText = computed(() => ({
  'no-dem': 'Ingen høydedata for dette kartet — 3D-visning krever et kart bygd med ekte terreng.',
  'no-webgl': '3D-visning støttes ikke på denne enheten.',
  'no-route': 'Ingen rute å vise i 3D.',
  error: 'Kunne ikke bygge 3D-visningen for dette kartet.',
})[phase.value] ?? null)

// Hjelpetekstene følger inngangen: en planlagt tur har POI-stopp der en
// utforsking har kryssvalg.
const INFO_KNAPPER = computed(() => [
  { navn: 'Nåler', tekst: 'viser interessepunkter — trykk på en for å fly dit. Filteret ved siden av velger hvilke.' },
  { navn: 'Sol/måne', tekst: 'bytter mellom lyst og mørkt kart.' },
  { navn: 'Sti', tekst: 'tegner stinettet oppå terrenget — og må være på for å kunne følge en sti.' },
  fixedTour.value
    ? { navn: 'Stopp', tekst: 'lar turen stoppe ved severdigheter langs veien.' }
    : { navn: 'Kryss', tekst: 'stopper turen i hvert stikryss så du kan velge vei.' },
  { navn: 'Kurver', tekst: 'legger på høydekurver.' },
  walking.value
    ? { navn: 'Til ruta', tekst: 'fester kameraet tilbake til turen etter en avstikker.' }
    : { navn: 'Oversikt', tekst: 'tar deg tilbake til hele kartet ovenfra.' },
])
const INFO_TIPS = computed(() => (walking.value
  ? [
    'Dra mens turen går for å se den fra en annen vinkel — kameraet følger ruta hele tiden.',
    'Hold fingeren stille: kameraet blir stående, og du kan se rundt deg, opp og ned. Slipp, og det glir tilbake bak ruta.',
    'Pause løsner kameraet helt: da kan du fly rundt og se på det du vil.',
    'Play setter kameraet tilbake skrått bakfra.',
    'Trykk på en nål for å fly dit; turen venter på deg.',
  ]
  : [
    'Slå på Sti, og trykk på en sti for å følge den.',
    'Turen fortsetter over små brudd i stinettet, og ender der stien faktisk slutter.',
    'Trykk på en knappenål for å fly dit.',
  ]))

// --- lagrede filtervalg ----------------------------------------------------

const pinPrefs = ref(lesPinPrefs())

function setPinPrefs(next) {
  pinPrefs.value = next
  skrivPinPrefs(next)
  applyPinGroups()
}

function applyPinGroups() {
  engine?.setPinGroups(paaGrupper(pinPrefs.value))
}

// --- livssyklus ------------------------------------------------------------

function onKeydown(e) {
  if (e.key === 'Escape') requestClose()
}
function onPopstate() {
  poppedByHistory = true
  emit('close')
}
function onOrientation() {
  isLandscape.value = window.innerWidth > window.innerHeight
  engine?.resize()
}
function requestClose() {
  history.back()
}

function showToast(text, ms = 2400) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, ms)
}

onMounted(async () => {
  history.pushState({ lende3d: true }, '')
  window.addEventListener('popstate', onPopstate)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onOrientation)

  const dem = props.dem ? toRaw(props.dem) : null
  if (!dem) { phase.value = 'no-dem'; return }

  abort = new AbortController()

  try {
    const mod = await import('../../lib/tour3d/index.js')
    // Brukerminnene er allerede lest ut av SVG-en av forelderen, som eier
    // DOM-en; her brukes bare resultatet.
    const {
      create3dScene, collectAllFeatures, collectMapFeatures,
      findParkingSpots, findPauseSpots, loadNveFeatures, loadHeritageForMap,
      clusterFeaturesByMeters, PIN_GROUPS, countByGroup,
    } = mod

    pinGroups.value = PIN_GROUPS

    const rawIndex = toRaw(props.searchIndex) ?? []
    let allFeatures = clusterFeaturesByMeters([
      ...collectAllFeatures(rawIndex),
      ...(toRaw(props.brukerminner) ?? []),
    ])

    // Den planlagte turen tar med seg det den trenger for koreografien:
    // severdigheter i korridoren, P-plass ved start/mål, rasteplass ved
    // vendepunktet, og 2D-sidens egen høydeprofil (samme stigningstall).
    let tourOpts = null
    const t = props.tour ? toRaw(props.tour) : null
    if (t?.route?.coordinates?.length >= 2) {
      const via = (t.via ?? []).map(v => ({ svgX: v.svgX, svgY: v.svgY }))
      const profile = sampleProfile(
        { points: t.route.coordinates.map(c => ({ x: c[0], y: c[1] })) },
        dem,
      )
      tourOpts = {
        route: { coordinates: t.route.coordinates, lengthM: t.route.lengthM },
        via,
        isLoop: !!t.isLoop,
        parkingSpots: findParkingSpots(rawIndex, t.route.coordinates, { isLoop: !!t.isLoop }),
        pauseSpots: findPauseSpots(rawIndex, via),
        routeFeatures: collectMapFeatures(rawIndex, t.route.coordinates),
        profileSamples: profile?.samples ?? null,
        estWalkMinutes: props.estWalkMinutes ?? null,
      }
    }

    engine = await create3dScene(canvasHost.value, {
      dem,
      meta: toRaw(props.meta),
      svgText: props.getSvgText(),
      // Lar motoren rasterisere på nytt: skjerping til full oppløsning, og
      // gjenoppbygging hvis nettleseren tømmer lerretet mens vi ligger nede.
      getSvgText: props.getSvgText,
      onProgress: (m) => { buildMsg.value = m },
      pathFeatures: toRaw(props.pathFeatures) ?? [],
      barrierFeatures: toRaw(props.barrierFeatures) ?? [],
      features: allFeatures,
      tour: tourOpts,
      options: { estWalkMinutes: props.estWalkMinutes ?? null },
    })

    engine.on('progress', (p) => {
      walking.value = !!p.walking
      if (p.walking) {
        stats.value = p
        playing.value = !!p.playing
        finished.value = !!p.finished
        fixedTour.value = !!p.fixed
        detached.value = !!p.detached
        if (Number.isFinite(p.timeScale)) timeScale.value = p.timeScale
      } else {
        stats.value = null
      }
    })
    // Trykket nål (POI, start/mål/via, parkering) — turen er pauset og
    // kameraet løsnet av motoren.
    engine.on('feature', ({ feature }) => { pickedFeature.value = feature })
    // Severdighet turen stopper ved av seg selv.
    engine.on('feature-enter', ({ feature }) => { stopFeature.value = feature })
    engine.on('feature-exit', () => { stopFeature.value = null })
    engine.on('trip-start', ({ lengthM, fixed }) => {
      // Turen står klar men spiller ikke — play-knappen pulserer i stedet,
      // og skjermlåsen holdes først fra brukeren faktisk trykker play.
      walking.value = true
      playing.value = false
      finished.value = false
      fixedTour.value = !!fixed
      pickedFeature.value = null
      void lengthM
    })
    engine.on('trip-end', () => {
      walking.value = false
      playing.value = false
      junction.value = null
      wake.stop()
    })
    engine.on('camera', ({ detached: d }) => { detached.value = !!d })
    engine.on('camera-hold', ({ holding }) => { holdingLook.value = !!holding })
    engine.on('junction', ({ junction: j }) => { junction.value = j })
    engine.on('junction-pause', () => { playing.value = false; wake.stop() })
    engine.on('finished', () => { playing.value = false; finished.value = true; wake.stop() })
    engine.on('no-path', () => showToast('Ingen sti akkurat der'))
    engine.on('paths-hidden', () => showToast('Slå på Sti for å følge stien'))
    engine.on('tour-locked', () => showToast('Følger den planlagte turen — stinettet er bare til orientering'))

    engine.setPathsVisible(pathsOn.value)
    applyKryssPause()
    engine.setPoiStops(poiStopsOn.value)
    applyUserPos(props.userPos)

    hasPaths.value = engine.hasPaths
    walking.value = engine.walking
    fixedTour.value = engine.isFixedTour
    // Uten dette står HUD-en tom til første progress-event (et kvart sekund) —
    // med en tur er det nettopp den brukeren ser etter først.
    if (engine.walking) stats.value = engine.state
    engine.setFeatures(allFeatures)
    pinCounts.value = countByGroup(allFeatures)
    applyPinGroups()
    engine.setContoursVisible(contoursOn.value).catch(() => {})
    if (nightOn.value) applyNight(true).catch(() => {})

    phase.value = 'ready'

    // Nettbaserte kilder popper inn asynkront — feil svelges stille, som før.
    // Kartet skal aldri stå og vente på Riksantikvaren.
    const merge = (extra) => {
      if (!extra?.length || !engine) return
      allFeatures = clusterFeaturesByMeters([...allFeatures, ...extra])
      engine.setFeatures(allFeatures)
      pinCounts.value = countByGroup(allFeatures)
      applyPinGroups()
    }
    const meta = toRaw(props.meta)
    await Promise.allSettled([
      loadNveFeatures({ meta, signal: abort.signal }).then(merge),
      loadHeritageForMap({ meta, signal: abort.signal }).then(merge),
    ])
    extrasLoading.value = false
  } catch (err) {
    extrasLoading.value = false
    phase.value = err?.code === 'no-dem'
      ? 'no-dem'
      : err?.code === 'no-webgl'
        ? 'no-webgl'
        : err?.code === 'no-route' ? 'no-route' : 'error'
    if (phase.value === 'error') console.error('3D-visning feilet:', err)
  }
})

onBeforeUnmount(() => {
  abort?.abort()
  clearTimeout(toastTimer)
  wake.stop()
  engine?.dispose()
  engine = null
  window.removeEventListener('popstate', onPopstate)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onOrientation)
  if (!poppedByHistory && history.state?.lende3d) {
    poppedByHistory = true
    history.back()
  }
})

// --- toggles ---------------------------------------------------------------

// Stinettet starter AV: førsteinntrykket skal være terrenget og kartbildet, ikke
// et rødt nett over alt. Den som vil følge en sti slår den på — og da er det
// også tydelig hva man trykker på.
const pathsOn = ref(false)
function togglePaths() {
  pathsOn.value = !pathsOn.value
  engine?.setPathsVisible(pathsOn.value)
  applyKryssPause()
}

// Krysspausen gjelder bare når stinettet vises — Kryss-knappen er deaktivert
// med Sti av, og da skal heller ikke motoren stoppe på usynlige kryss.
function applyKryssPause() {
  engine?.setAutoPauseJunctions(kryssPauseOn.value && pathsOn.value)
}

function toggleKryssPause() {
  kryssPauseOn.value = !kryssPauseOn.value
  try { localStorage.setItem(KRYSSPAUSE_KEY, kryssPauseOn.value ? '1' : '0') } catch { /* privat modus */ }
  applyKryssPause()
}

// POI-stopp langs en planlagt tur — default AV (v3.0.27): turen skal kunne
// spilles i ett strekk. Nålene er klikkbare uansett.
const poiStopsOn = ref(false)
function togglePoiStops() {
  poiStopsOn.value = !poiStopsOn.value
  engine?.setPoiStops(poiStopsOn.value)
}

const pinsOn = ref(true)
function togglePins() {
  pinsOn.value = !pinsOn.value
  engine?.setPinsVisible(pinsOn.value)
  if (!pinsOn.value) pickedFeature.value = null
}

// Åpningsbildet er terrenget, kartbildet og nålene — INGENTING oppå (v5.18.0).
// Kurvene sto på fram til da, med den begrunnelsen at de leser terrenget for
// deg i fugleperspektiv. Men sammen med stinettet, nålene og en rute ble det
// fire lag over hverandre i det første sekundet, og førsteinntrykket er det
// eneste som ikke kan slås på igjen. Den som vil ha kurver, slår dem på.
const contoursOn = ref(false)
async function toggleContours() {
  contoursOn.value = !contoursOn.value
  await engine?.setContoursVisible(contoursOn.value)
}

const nightOn = ref(props.isDark)
async function applyNight(on) {
  if (!engine) return
  await engine.setNightMode(on, on ? { svgText: props.getSvgText({ dark: true }) } : {})
}
function toggleNight() {
  nightOn.value = !nightOn.value
  applyNight(nightOn.value)
}

// --- turen -----------------------------------------------------------------

function play() {
  engine?.play()
  playing.value = true
  pickedFeature.value = null
  wake.start()
}
function pause() { engine?.pause(); playing.value = false; wake.stop() }
function restart() {
  engine?.restart()
  playing.value = true
  finished.value = false
  pickedFeature.value = null
  wake.start()
}
function stopTrip() { engine?.stopTrip() }
function followRoute() { engine?.followRoute(); pickedFeature.value = null }
function overview() {
  engine?.overview()
  pickedFeature.value = null
  playing.value = false
  wake.stop()
}

// Tidsakse: dra = seek (kameraet følger), slipp = forbli pauset.
function onScrubStart() { engine?.scrubStart(); playing.value = false; wake.stop() }
function onScrub(pct) { if (engine) engine.scrub(pct * engine.totalM) }
function onScrubEnd() { engine?.scrubEnd(); playing.value = false }
function chooseBranch(nodeId) { engine?.chooseBranch(nodeId) }

// «Videre →» på kortet: et trykket kort lukkes, et turstopp hoppes over.
function onCardSkip() {
  if (pickedFeature.value) { pickedFeature.value = null; return }
  engine?.skipFeature()
}

function setTimeScale(x) {
  timeScale.value = x
  engine?.setTimeScale(x)
}

// Live GPS: motoren tegner/skjuler markøren selv, inkl. utenfor-kartet-sjekk.
function applyUserPos(p) {
  engine?.setUserPosition(p && p.svgX != null
    ? { x: p.svgX, y: p.svgY, accuracyM: p.accuracyM }
    : null)
}
watch(() => props.userPos, applyUserPos)

const ISOM_LABEL = {
  505: 'Sti', 506: 'Sti (uklar)', 507: 'Stitråkk', 504: 'Skogsbilvei',
  503: 'Småveg', 502: 'Hovedvei', 501: 'Motorvei', 509: 'Bro',
}

// Gren-etikett relativt til gangretningen: rett fram, til høyre/venstre —
// «skarpt» når svingen er over 100°, så to grener på samme side kan skilles.
function branchLabel(opt, i) {
  const kind = ISOM_LABEL[opt.isomCode] ?? 'Vei'
  if (i === 0) return `${kind} rett fram`
  const side = opt.turnSigned > 0 ? 'høyre' : 'venstre'
  const skarpt = opt.turn > (100 * Math.PI) / 180 ? 'skarpt ' : ''
  return `${kind} ${skarpt}til ${side}`
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[220] bg-[#101623] flex flex-col" style="height: 100dvh;">
      <div ref="canvasHost" class="absolute inset-0"></div>

      <!-- Topprad: Pin · Sol/måne · Sti · Kryss|Stopp · Kurver — venstrestilt,
           med X aleine helt til høyre. Høyrestilt raden vokste mot venstre, og
           med seks knapper falt den første ut av skjermen på smale telefoner
           (S22+, buet kant). Venstrestilt vokser den innover i stedet, og
           gapet er strammet inn for å gi mer luft i marginene. -->
      <div class="relative z-10 flex items-start justify-between gap-2 px-3"
           style="padding-top: max(env(safe-area-inset-top), 10px);">
        <div class="flex items-center gap-1 min-w-0 flex-wrap">
          <button v-if="phase === 'ready'"
                  @click="togglePins"
                  :aria-label="pinsOn ? 'Skjul knappenåler' : 'Vis knappenåler'"
                  class="w-11 h-11 rounded-full backdrop-blur flex items-center justify-center
                         active:scale-95 transition-colors"
                  :class="pinsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/>
              <circle cx="12" cy="11" r="2.4"/>
            </svg>
          </button>
          <button v-if="phase === 'ready'"
                  @click="toggleNight"
                  :aria-label="nightOn ? 'Bytt til dag' : 'Bytt til natt'"
                  class="w-11 h-11 rounded-full backdrop-blur flex items-center justify-center
                         active:scale-95 transition-colors"
                  :class="nightOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg v-if="nightOn" viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor" aria-hidden="true">
              <path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6 8.5 8.5 0 1 0 20.4 14.2z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2"/>
              <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/>
            </svg>
          </button>
          <!-- Sti-togglen bærer teksten sin, som Kryss og Kurver: ikonet aleine
               er ikke til å gjette. Under 380 px skjermbredde faller de tre
               tekstene bort og knappene blir runde igjen — der er det ikke plass
               til fem merkelapper, og en rad som bryter til tre linjer er verre
               enn tre ikoner. -->
          <button v-if="phase === 'ready' && hasPaths"
                  @click="togglePaths"
                  :aria-label="pathsOn ? 'Skjul stinettet' : 'Vis stinettet'"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-[12px] font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors"
                  :class="pathsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 20c3-1 4-4 3-7s1-6 4-7 6 1 8 3"/>
            </svg>
            <span class="max-[379px]:hidden">Sti</span>
          </button>
          <!-- Krysspause («gaffel»): på = turen stopper i hvert stikryss så man
               rekker å velge vei. Valget huskes. Uten stinettet synlig gir den
               ingen mening — da deaktiveres den. En PLANLAGT tur har ingen
               kryssvalg; der står POI-stopp på samme plass i stedet. -->
          <button v-if="phase === 'ready' && hasPaths && !fixedTour"
                  @click="toggleKryssPause"
                  :disabled="!pathsOn"
                  :aria-label="kryssPauseOn ? 'Ikke stopp i stikryss' : 'Stopp i stikryss'"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-[12px] font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors
                         disabled:opacity-40 disabled:pointer-events-none"
                  :class="kryssPauseOn && pathsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21v-8"/>
              <path d="M12 13 7 8"/><polyline points="7 11 7 8 10 8"/>
              <path d="M12 13l5-5"/><polyline points="14 8 17 8 17 11"/>
            </svg>
            <span class="max-[379px]:hidden">Kryss</span>
          </button>
          <button v-if="phase === 'ready' && fixedTour"
                  @click="togglePoiStops"
                  :aria-label="poiStopsOn ? 'Ikke stopp ved severdigheter' : 'Stopp ved severdigheter'"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-[12px] font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors"
                  :class="poiStopsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l3 2"/>
            </svg>
            <span class="max-[379px]:hidden">Stopp</span>
          </button>
          <button v-if="phase === 'ready'"
                  @click="toggleContours"
                  aria-label="Vis høydekurver i terrenget"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-[12px] font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors"
                  :class="contoursOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M4 9c3-3.5 13-3.5 16 0M5.5 13c2.5-2.6 10.5-2.6 13 0M7.5 17c2-1.8 7-1.8 9 0"/>
            </svg>
            <span class="max-[379px]:hidden">Kurver</span>
          </button>
        </div>
        <button @click="requestClose"
                aria-label="Lukk 3D-visning"
                class="w-11 h-11 shrink-0 rounded-full bg-black/45 backdrop-blur text-white/85
                       flex items-center justify-center active:scale-90">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Andre linje: hjelp til venstre, POI-filter til høyre. Begge minimert
           som små piller, så de koster nesten ingen kartflate før man trenger
           dem. Items-start så en utvidet boks ikke dytter den andre nedover. -->
      <div v-if="phase === 'ready'"
           class="relative z-10 flex items-start justify-between gap-2 px-3 mt-2">
        <Tour3dInfoPanel :modus="walking ? 'tur' : 'utforsk'"
                         :knapper="INFO_KNAPPER" :tips="INFO_TIPS"/>
        <Tour3dPinPanel v-if="pinsOn" :groups="pinGroups" :counts="pinCounts"
                        :loading="extrasLoading"
                        :model-value="pinPrefs" @update:model-value="setPinPrefs"/>
        <div v-else></div>
      </div>

      <!-- Laste-/feiltilstander -->
      <div v-if="phase === 'loading'"
           class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-white/80">
        <div class="w-10 h-10 rounded-full border-2 border-white/25 border-t-white animate-spin"></div>
        <div class="text-[13px]">{{ buildMsg || 'Bygger 3D-terreng …' }}</div>
      </div>
      <div v-else-if="errorText"
           class="absolute inset-0 z-20 flex items-center justify-center p-6">
        <div class="rounded-xl bg-amber-500/10 border border-amber-300/30 px-4 py-3
                    text-amber-100/90 text-[13px] max-w-sm text-center">
          {{ errorText }}
        </div>
      </div>

      <!-- Infokort for valgt/aktuell POI -->
      <div v-if="phase === 'ready' && activeFeature"
           class="absolute left-0 right-0 z-10 flex justify-center px-4 pointer-events-none"
           :class="isLandscape ? 'top-16' : 'top-20'">
        <Tour3dFeatureCard :feature="activeFeature" @skip="onCardSkip"/>
      </div>

      <!-- Bunn: kryssvalg, framdrift og turkontroller -->
      <div v-if="phase === 'ready'" class="relative z-10 mt-auto px-3 flex flex-col gap-2"
           style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">

        <!-- Kameraet er løsnet fra turen: veien tilbake, ett trykk unna. -->
        <button v-if="walking && detached" @click="followRoute"
                class="self-start w-fit flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur
                       px-3 py-1.5 text-[11px] font-medium text-white/90 active:scale-95">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20c3-1 4-4 3-7s1-6 4-7 6 1 8 3"/>
          </svg>
          Til ruta
        </button>

        <!-- Kryss: rett fram vinner om brukeren ikke gjør noe. Med krysspause
             på står turen stille her til man velger gren eller trykker play.
             `self-start w-fit` holder boksen så smal som innholdet — full bredde
             la et grønt teppe over kartet for to korte knapper. -->
        <div v-if="walking && junction"
             class="on-accent self-start w-fit max-w-full rounded-md bg-emerald-600 text-white
                    text-[11px] shadow-lg px-3 py-2">
          <div class="text-[9px] uppercase tracking-wide text-emerald-100/90 mb-1">
            {{ !playing ? 'Kryss — velg vei, eller ▶ for rett fram' : 'Kryss — fortsetter rett fram' }}
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="(opt, i) in junction.options" :key="opt.nodeId"
                    @click="chooseBranch(opt.nodeId)"
                    class="rounded px-2 py-1 text-[11px] font-medium active:scale-95"
                    :class="opt.nodeId === junction.chosenNodeId ? 'bg-white text-emerald-700' : 'bg-ink/15'">
              {{ branchLabel(opt, i) }}
            </button>
          </div>
        </div>

        <Tour3dHud v-if="walking" :stats="stats" :felter="HUD_FELTER"
                   @scrub-start="onScrubStart" @scrub="onScrub" @scrub-end="onScrubEnd"/>

        <div v-if="walking" class="flex items-center gap-2">
          <!-- Start på nytt — bare for en planlagt tur. En generert sti-tur
               starter man på nytt ved å trykke på en sti. -->
          <button v-if="fixedTour" @click="restart"
                  aria-label="Start turen på nytt"
                  class="w-10 h-10 shrink-0 rounded-full bg-black/45 backdrop-blur text-white/85
                         flex items-center justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
            </svg>
          </button>
          <button @click="playing ? pause() : play()"
                  :aria-label="playing ? 'Pause' : 'Fortsett'"
                  class="w-12 h-12 rounded-full bg-white text-gray-900 flex items-center
                         justify-center shrink-0 active:scale-95"
                  :class="{ 'pulse-play': !playing && !finished }">
            <svg v-if="playing" viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1"/>
              <rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
              <polygon points="8,5 8,19 19,12"/></svg>
          </button>
          <button v-if="!fixedTour" @click="stopTrip"
                  class="h-12 px-4 rounded-full bg-black/45 backdrop-blur text-white/85
                         text-[12px] font-medium active:scale-95">
            Avslutt turen
          </button>
          <!-- Tempo, nede til høyre. -->
          <div class="ml-auto flex items-center gap-1 rounded-full bg-black/45 backdrop-blur p-1">
            <button v-for="x in TIME_SCALES" :key="x"
                    @click="setTimeScale(x)"
                    :aria-label="`Tempo ${x} ganger`"
                    class="h-9 px-2.5 rounded-full text-[11px] font-semibold tabular-nums
                           active:scale-95 transition-colors"
                    :class="timeScale === x ? 'bg-white text-gray-900' : 'text-white/80'">
              {{ x }}×
            </button>
          </div>
        </div>

        <div v-else class="flex items-center gap-2">
          <button @click="overview"
                  class="h-11 px-3 rounded-full bg-black/45 backdrop-blur text-white/85
                         text-[12px] font-medium flex items-center gap-1.5 active:scale-95">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/>
            </svg>
            Oversikt
          </button>
          <!-- Hintet gjelder bare med stinettet synlig — med Sti av er det
               ingen sti å trykke på, og et trykk starter ingen tur. -->
          <div v-if="hasPaths"
               class="rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-[11px] text-white/70">
            {{ pathsOn ? 'Trykk på en sti for å følge den' : 'Slå på Sti for å følge en sti' }}
          </div>
        </div>
      </div>

      <!-- Skjerping av kartbildet etter at visningen er åpen -->
      <div v-if="phase === 'ready' && buildMsg"
           class="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full
                  bg-black/55 backdrop-blur px-3 py-1.5 text-[11px] text-white/85"
           :class="isLandscape ? 'top-16' : 'top-32'">
        <span class="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
        {{ buildMsg }}
      </div>

      <!-- Hold-for-å-se-rundt: hintet står så lenge fingeren er nede. -->
      <div v-if="holdingLook"
           class="absolute left-1/2 -translate-x-1/2 bottom-44 z-30 pointer-events-none
                  rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-[11px] text-white/85">
        Ser rundt — slipp for å følge ruta
      </div>

      <!-- Kortvarig melding -->
      <div v-if="toast"
           class="absolute left-1/2 -translate-x-1/2 bottom-28 z-30 max-w-[86vw] text-center rounded-full
                  bg-black/70 backdrop-blur px-3 py-1.5 text-[12px] text-white/90">
        {{ toast }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* «Trykk meg»: play-knappen pulserer rolig så lenge turen står stille —
   både rett etter sti-valg (ingen autostart) og i krysspause. */
@keyframes pulse-play {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.14); }
}
.pulse-play {
  animation: pulse-play 1.1s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pulse-play { animation: none; }
}
</style>

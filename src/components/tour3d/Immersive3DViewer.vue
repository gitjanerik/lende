<script setup>
// Fullskjerm 3D-turvisning (Lende 3.0.0). Skallet eier motorens livssyklus:
// createTourScene i onMounted, dispose i onBeforeUnmount. Alt engine-relatert
// holdes utenfor Vue-reaktivitet (toRaw/ikke-reaktive variabler) — reaktive
// proxies i RAF-loopen dreper frameraten.
//
// Lukkeveier: X-knapp, Escape og Android-tilbakeknapp (pushState + popstate;
// samme URL, så vue-router er upåvirket).
import { ref, computed, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { useScreenWakeLock } from '../../composables/useScreenWakeLock.js'
import { sampleProfile } from '../../lib/elevationProfile.js'
import Tour3dControls from './Tour3dControls.vue'
import Tour3dHud from './Tour3dHud.vue'
import Tour3dFeatureCard from './Tour3dFeatureCard.vue'

const props = defineProps({
  dem: { type: Object, default: null },        // utpakket DEM (null → tom-tilstand)
  meta: { type: Object, required: true },
  route: { type: Object, required: true },     // { coordinates, lengthM }
  via: { type: Array, default: () => [] },     // delmål [{svgX, svgY}]
  isLoop: { type: Boolean, default: false },
  estWalkMinutes: { type: Function, default: null },
  searchIndex: { type: Array, default: () => [] },
  getSvgText: { type: Function, required: true },
  mapTitle: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const phase = ref('loading')   // loading | ready | no-dem | no-webgl | error
const stats = ref(null)
const activeFeature = ref(null)
// Default = Utforsk med fugleperspektiv-oversikt over ruta (matcher motorens
// initialCameraMode 'free').
const cameraMode = ref('free')
const playing = ref(false)
const finished = ref(false)
const timeScale = ref(16)
const isLandscape = ref(typeof window !== 'undefined' && window.innerWidth > window.innerHeight)

const canvasHost = ref(null)
let engine = null
let abort = null
let poppedByHistory = false

const wake = useScreenWakeLock({ persist: false, defaultOn: false, idleTimeoutMs: 0 })

const errorText = computed(() => ({
  'no-dem': 'Ingen høydedata for dette kartet — 3D-visning krever et kart bygd med ekte terreng.',
  'no-webgl': '3D-visning støttes ikke på denne enheten.',
  error: 'Kunne ikke bygge 3D-visningen for denne turen.',
})[phase.value] ?? null)

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
  // Tilbakeknapp-staten poppes; popstate-handleren emitter close.
  history.back()
}

onMounted(async () => {
  history.pushState({ lende3d: true }, '')
  window.addEventListener('popstate', onPopstate)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onOrientation)

  const dem = props.dem ? toRaw(props.dem) : null
  if (!dem) { phase.value = 'no-dem'; return }

  const route = { coordinates: toRaw(props.route.coordinates), lengthM: props.route.lengthM }
  abort = new AbortController()

  try {
    const engineMod = await import('../../lib/tour3d/index.js')
    const { createTourScene, collectMapFeatures, findParkingSpots, loadNveFeatures, loadHeritageFeatures } = engineMod

    const profile = sampleProfile({ points: route.coordinates.map(c => ({ x: c[0], y: c[1] })) }, dem)
    const rawIndex = toRaw(props.searchIndex) ?? []
    const mapFeatures = collectMapFeatures(rawIndex, route.coordinates)

    engine = await createTourScene(canvasHost.value, {
      dem,
      meta: toRaw(props.meta),
      svgText: props.getSvgText(),
      route,
      via: (toRaw(props.via) ?? []).map(v => ({ svgX: v.svgX, svgY: v.svgY })),
      isLoop: props.isLoop,
      parkingSpots: findParkingSpots(rawIndex, route.coordinates, { isLoop: props.isLoop }),
      features: mapFeatures,
      profileSamples: profile?.samples ?? null,
      estWalkMinutes: props.estWalkMinutes,
    })

    engine.on('progress', (p) => {
      stats.value = p
      playing.value = p.playing
      finished.value = p.finished
      timeScale.value = p.timeScale
    })
    engine.on('feature-enter', ({ feature }) => { activeFeature.value = feature })
    engine.on('feature-exit', () => { activeFeature.value = null })
    engine.on('mode-changed', ({ mode }) => { cameraMode.value = mode })
    engine.on('finished', () => { playing.value = false; finished.value = true })

    phase.value = 'ready'
    stats.value = engine.state
    if (contoursOn.value) engine.setContoursVisible(true).catch(() => {})
    if (nightOn.value) applyNight(true).catch(() => {})

    // Nettbaserte kilder popper inn asynkront — feil svelges stille.
    const allFeatures = [...mapFeatures]
    const merge = (extra) => {
      if (!extra?.length || !engine) return
      allFeatures.push(...extra)
      engine.setFeatures(allFeatures)
    }
    loadNveFeatures({ meta: toRaw(props.meta), signal: abort.signal }).then(merge).catch(() => {})
    loadHeritageFeatures({ route: route.coordinates, meta: toRaw(props.meta), signal: abort.signal }).then(merge).catch(() => {})
  } catch (err) {
    phase.value = err?.code === 'no-dem' ? 'no-dem' : err?.code === 'no-webgl' ? 'no-webgl' : 'error'
    if (phase.value === 'error') console.error('3D-visning feilet:', err)
  }
})

onBeforeUnmount(() => {
  abort?.abort()
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

// Skarpe vektorkurver oppå kartteksturen — default PÅ, togglebare i både
// dag- og nattmodus (natt-teksturen bærer det mørke temaets eget relieff).
const contoursOn = ref(true)
async function toggleContours() {
  contoursOn.value = !contoursOn.value
  await engine?.setContoursVisible(contoursOn.value)
}

// Knappenåler for start/mål (+ delmål) — default PÅ.
const pinsOn = ref(true)
function togglePins() {
  pinsOn.value = !pinsOn.value
  engine?.setPinsVisible(pinsOn.value)
}

// Sol/måne: nattmodus rasteriserer kartet med det ekte mørke temaet.
// Måne er forvalgt når appen står i mørkt tema.
const nightOn = ref(props.isDark)
async function applyNight(on) {
  if (!engine) return
  await engine.setNightMode(on, on ? { svgText: props.getSvgText({ dark: true }) } : {})
}
function toggleNight() {
  nightOn.value = !nightOn.value
  applyNight(nightOn.value)
}

// Tidsakse-scrubbing: dra = seek (kameraet følger), slipp = forbli pauset.
function onScrubStart() {
  engine?.scrubStart()
  playing.value = false
  wake.stop()
}
function onScrub(pct) {
  if (!engine) return
  engine.scrub(pct * engine.totalM)
}
function onScrubEnd() {
  engine?.scrubEnd()
  playing.value = false
}

function play() { engine?.play(); playing.value = true; wake.start() }
function pause() { engine?.pause(); playing.value = false; wake.stop() }
function restart() { engine?.restart(); playing.value = true; finished.value = false; wake.start() }
function setTimeScale(x) { engine?.setTimeScale(x); timeScale.value = x }
function setCameraMode(m) { engine?.setCameraMode(m) }
function skipFeature() { engine?.skipFeature() }
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[220] bg-[#101623] flex flex-col"
         style="height: 100dvh;">
      <!-- WebGL-canvas fyller alt; UI ligger som overlay. -->
      <div ref="canvasHost" class="absolute inset-0"></div>

      <!-- Topprad -->
      <div class="relative z-10 flex items-center justify-between gap-2 px-3"
           style="padding-top: max(env(safe-area-inset-top), 10px);">
        <div class="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-[12px] text-white/85 truncate">
          {{ mapTitle || 'Turen i 3D' }}<span v-if="isLoop" class="text-white/50"> · rundtur</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button v-if="phase === 'ready'"
                  @click="togglePins"
                  :aria-label="pinsOn ? 'Skjul start- og målnåler' : 'Vis start- og målnåler'"
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
          <button v-if="phase === 'ready'"
                  @click="toggleContours"
                  aria-label="Vis høydekurver i terrenget"
                  class="h-11 px-3 rounded-full backdrop-blur text-[12px] font-medium
                         flex items-center gap-1.5 active:scale-95 transition-colors"
                  :class="contoursOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M4 9c3-3.5 13-3.5 16 0M5.5 13c2.5-2.6 10.5-2.6 13 0M7.5 17c2-1.8 7-1.8 9 0"/>
            </svg>
            Kurver
          </button>
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
      </div>

      <!-- Laste-/feiltilstander -->
      <div v-if="phase === 'loading'"
           class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-white/80">
        <div class="w-10 h-10 rounded-full border-2 border-white/25 border-t-white animate-spin"></div>
        <div class="text-[13px]">Bygger 3D-terreng …</div>
      </div>
      <div v-else-if="errorText"
           class="absolute inset-0 z-20 flex items-center justify-center p-6">
        <div class="rounded-xl bg-amber-500/10 border border-amber-300/30 px-4 py-3
                    text-amber-100/90 text-[13px] max-w-sm text-center">
          {{ errorText }}
        </div>
      </div>

      <!-- Infokort for aktuell feature -->
      <div v-if="phase === 'ready'"
           class="absolute left-0 right-0 z-10 flex justify-center px-4 pointer-events-none"
           :class="isLandscape ? 'top-16' : 'top-20'">
        <Tour3dFeatureCard :feature="activeFeature" @skip="skipFeature"/>
      </div>

      <!-- Bunnpanel (portrett) / hjørner (landskap) -->
      <div v-if="phase === 'ready'" class="relative z-10 mt-auto">
        <div v-if="!isLandscape"
             class="flex flex-col gap-2.5 px-3"
             style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">
          <Tour3dHud :stats="stats"
                     @scrub-start="onScrubStart" @scrub="onScrub" @scrub-end="onScrubEnd"/>
          <Tour3dControls
            :playing="playing" :finished="finished" :time-scale="timeScale" :camera-mode="cameraMode"
            @play="play" @pause="pause" @restart="restart"
            @set-time-scale="setTimeScale" @set-camera-mode="setCameraMode"/>
        </div>
        <template v-else>
          <div class="absolute bottom-0 right-0 px-3"
               style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">
            <Tour3dHud :stats="stats" landscape
                       @scrub-start="onScrubStart" @scrub="onScrub" @scrub-end="onScrubEnd"/>
          </div>
          <div class="px-3 max-w-md"
               style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">
            <Tour3dControls
              :playing="playing" :finished="finished" :time-scale="timeScale" :camera-mode="cameraMode"
              @play="play" @pause="pause" @restart="restart"
              @set-time-scale="setTimeScale" @set-camera-mode="setCameraMode"/>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

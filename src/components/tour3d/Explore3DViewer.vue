<script setup>
// Fullskjerm 3D-UTFORSKER: hele kartet i 3D, uten noen planlagt tur.
//
// Skallet er bygget som Immersive3DViewer (samme lukkeveier, samme wake lock,
// samme toRaw-disiplin — reaktive proxies i RAF-loopen dreper frameraten), men
// innholdet er utforskermodusens: fugleperspektiv nordover, stinettet som
// klikkbart lag, knappenåler med filterpanel, og en tur langs stien når man
// trykker på en.
import { ref, computed, watch, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { useScreenWakeLock } from '../../composables/useScreenWakeLock.js'
import Tour3dFeatureCard from './Tour3dFeatureCard.vue'
import Tour3dPinPanel from './Tour3dPinPanel.vue'

const props = defineProps({
  dem: { type: Object, default: null },
  meta: { type: Object, required: true },
  searchIndex: { type: Array, default: () => [] },
  // Sti-/veg-geometri lest ut av kart-SVG-en av forelderen (som eier DOM-en).
  pathFeatures: { type: Array, default: () => [] },
  // Brukerminner bakt inn i SVG-en — offline-tilgjengelige.
  brukerminner: { type: Array, default: () => [] },
  getSvgText: { type: Function, required: true },
  isDark: { type: Boolean, default: false },
  // Live GPS-posisjon i SVG-meter, null når posisjonering ikke er aktiv.
  // MapView sender et nytt lite objekt per fix, så watch-en trigges.
  userPos: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const PIN_PREFS_KEY = 'lende-3d-pins'
const KRYSSPAUSE_KEY = 'lende-3d-krysspause'
const TIME_SCALES = [64, 128, 256]

const phase = ref('loading')      // loading | ready | no-dem | no-webgl | error
const activeFeature = ref(null)
const walking = ref(false)
const playing = ref(false)
const walkLengthM = ref(0)
const timeScale = ref(128)
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
  error: 'Kunne ikke bygge 3D-visningen for dette kartet.',
})[phase.value] ?? null)

// --- lagrede filtervalg ----------------------------------------------------

function loadPinPrefs() {
  try {
    const raw = localStorage.getItem(PIN_PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* korrupt lagring skal ikke hindre 3D */ }
  return null
}

const pinPrefs = ref({})

function setPinPrefs(next) {
  pinPrefs.value = next
  try { localStorage.setItem(PIN_PREFS_KEY, JSON.stringify(next)) } catch { /* privat modus */ }
  applyPinGroups()
}

function applyPinGroups() {
  if (!engine) return
  const on = new Set(Object.entries(pinPrefs.value).filter(([, v]) => v).map(([k]) => k))
  engine.setPinGroups(on)
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

function showToast(text, ms = 2200) {
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
      createExploreScene, collectAllFeatures, loadNveFeatures, loadHeritageForMap,
      clusterFeaturesByMeters, PIN_GROUPS, countByGroup, featureType,
    } = mod

    pinGroups.value = PIN_GROUPS
    const stored = loadPinPrefs()
    pinPrefs.value = stored ?? Object.fromEntries(PIN_GROUPS.map(g => [g.key, true]))

    const rawIndex = toRaw(props.searchIndex) ?? []
    let allFeatures = clusterFeaturesByMeters([
      ...collectAllFeatures(rawIndex),
      ...(toRaw(props.brukerminner) ?? []),
    ])

    engine = await createExploreScene(canvasHost.value, {
      dem,
      meta: toRaw(props.meta),
      svgText: props.getSvgText(),
      pathFeatures: toRaw(props.pathFeatures) ?? [],
      features: allFeatures,
    })

    engine.on('progress', (p) => {
      walking.value = !!p.walking
      if (p.walking) {
        playing.value = !!p.playing
        if (Number.isFinite(p.timeScale)) timeScale.value = p.timeScale
      }
    })
    engine.on('feature', ({ feature }) => {
      activeFeature.value = { ...feature, type: featureType(feature) }
    })
    engine.on('walk-start', ({ lengthM }) => {
      // Turen står klar men spiller ikke — play-knappen pulserer i stedet,
      // og skjermlåsen holdes først fra brukeren faktisk trykker play.
      walking.value = true
      playing.value = false
      walkLengthM.value = lengthM
      activeFeature.value = null
    })
    engine.on('walk-end', () => {
      walking.value = false
      playing.value = false
      junction.value = null
      wake.stop()
    })
    engine.on('junction', ({ junction: j }) => { junction.value = j })
    engine.on('junction-pause', () => { playing.value = false; wake.stop() })
    engine.on('finished', () => { playing.value = false })
    engine.on('no-path', () => showToast('Ingen sti akkurat der'))
    applyKryssPause()
    applyUserPos(props.userPos)

    hasPaths.value = engine.hasPaths
    engine.setFeatures(allFeatures)
    pinCounts.value = countByGroup(allFeatures)
    applyPinGroups()
    engine.setContoursVisible(contoursOn.value).catch(() => {})
    if (nightOn.value) applyNight(true).catch(() => {})

    phase.value = 'ready'

    // Nettbaserte kilder popper inn asynkront — feil svelges stille, som i
    // turvisningen. Kartet skal aldri stå og vente på Riksantikvaren.
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
    phase.value = err?.code === 'no-dem' ? 'no-dem' : err?.code === 'no-webgl' ? 'no-webgl' : 'error'
    if (phase.value === 'error') console.error('3D-utforsker feilet:', err)
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

const pathsOn = ref(true)
function togglePaths() {
  pathsOn.value = !pathsOn.value
  engine?.setPathsVisible(pathsOn.value)
  applyKryssPause()
}

// Krysspausen gjelder bare når stinettet vises — Kryss-knappen er deaktivert
// med Stier av, og da skal heller ikke motoren stoppe på usynlige kryss.
function applyKryssPause() {
  engine?.setAutoPauseJunctions(kryssPauseOn.value && pathsOn.value)
}

const pinsOn = ref(true)
function togglePins() {
  pinsOn.value = !pinsOn.value
  engine?.setPinsVisible(pinsOn.value)
  if (!pinsOn.value) activeFeature.value = null
}

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

function resetView() {
  engine?.resetView()
  activeFeature.value = null
}

// --- tur langs sti ---------------------------------------------------------

function play() { engine?.play(); playing.value = true; wake.start() }
function pause() { engine?.pause(); playing.value = false; wake.stop() }
function stopWalk() { engine?.stopWalk() }
function chooseBranch(nodeId) { engine?.chooseBranch(nodeId) }

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

function toggleKryssPause() {
  kryssPauseOn.value = !kryssPauseOn.value
  try { localStorage.setItem(KRYSSPAUSE_KEY, kryssPauseOn.value ? '1' : '0') } catch { /* privat modus */ }
  applyKryssPause()
}

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

      <!-- Topprad: Pin · Sol/måne · Stier · Kryss · Kurver · X -->
      <div class="relative z-10 flex items-start justify-end gap-2 px-3"
           style="padding-top: max(env(safe-area-inset-top), 10px);">
        <div class="flex items-center gap-2 shrink-0">
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
          <button v-if="phase === 'ready' && hasPaths"
                  @click="togglePaths"
                  :aria-label="pathsOn ? 'Skjul stinettet' : 'Vis stinettet'"
                  class="w-11 h-11 rounded-full backdrop-blur flex items-center justify-center
                         active:scale-95 transition-colors"
                  :class="pathsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 20c3-1 4-4 3-7s1-6 4-7 6 1 8 3"/>
            </svg>
          </button>
          <!-- Krysspause («gaffel»): på = turen stopper i hvert stikryss så man
               rekker å velge vei. Valget huskes. Uten stinettet synlig gir den
               ingen mening — da deaktiveres den. -->
          <button v-if="phase === 'ready' && hasPaths"
                  @click="toggleKryssPause"
                  :disabled="!pathsOn"
                  :aria-label="kryssPauseOn ? 'Ikke stopp i stikryss' : 'Stopp i stikryss'"
                  class="h-11 px-3 rounded-full backdrop-blur text-[12px] font-medium
                         flex items-center gap-1.5 active:scale-95 transition-colors
                         disabled:opacity-40 disabled:pointer-events-none"
                  :class="kryssPauseOn && pathsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21v-8"/>
              <path d="M12 13 7 8"/><polyline points="7 11 7 8 10 8"/>
              <path d="M12 13l5-5"/><polyline points="14 8 17 8 17 11"/>
            </svg>
            Kryss
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

      <!-- Filterpanel, oppe til høyre under toggle-knappene -->
      <div v-if="phase === 'ready' && pinsOn"
           class="relative z-10 flex justify-end px-3 mt-2">
        <Tour3dPinPanel :groups="pinGroups" :counts="pinCounts" :loading="extrasLoading"
                        :model-value="pinPrefs" @update:model-value="setPinPrefs"/>
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

      <!-- Infokort for valgt POI -->
      <div v-if="phase === 'ready' && activeFeature"
           class="absolute left-0 right-0 z-10 flex justify-center px-4 pointer-events-none"
           :class="isLandscape ? 'top-16' : 'top-20'">
        <Tour3dFeatureCard :feature="activeFeature" @skip="activeFeature = null"/>
      </div>

      <!-- Bunn: hint, kryssvalg og turkontroller -->
      <div v-if="phase === 'ready'" class="relative z-10 mt-auto px-3 flex flex-col gap-2"
           style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">

        <!-- Kryss: rett fram vinner om brukeren ikke gjør noe. Med krysspause
             på står turen stille her til man velger gren eller trykker play. -->
        <div v-if="walking && junction"
             class="on-accent rounded-md bg-emerald-600 text-white text-[11px] shadow-lg px-3 py-2">
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

        <div v-if="walking" class="flex items-center gap-2">
          <button @click="playing ? pause() : play()"
                  :aria-label="playing ? 'Pause' : 'Fortsett'"
                  class="w-12 h-12 rounded-full bg-white text-gray-900 flex items-center
                         justify-center shrink-0 active:scale-95"
                  :class="{ 'pulse-play': !playing }">
            <svg v-if="playing" viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1"/>
              <rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
              <polygon points="8,5 8,19 19,12"/></svg>
          </button>
          <button @click="stopWalk"
                  class="h-12 px-4 rounded-full bg-black/45 backdrop-blur text-white/85
                         text-[12px] font-medium active:scale-95">
            Avslutt turen
          </button>
          <!-- Tempo, nede til høyre — samme trinn som turvisningen. -->
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
          <button @click="resetView"
                  class="h-11 px-3 rounded-full bg-black/45 backdrop-blur text-white/85
                         text-[12px] font-medium flex items-center gap-1.5 active:scale-95">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/>
            </svg>
            Oversikt
          </button>
          <div v-if="hasPaths"
               class="rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-[11px] text-white/70">
            Trykk på en sti for å følge den
          </div>
        </div>
      </div>

      <!-- Kortvarig melding -->
      <div v-if="toast"
           class="absolute left-1/2 -translate-x-1/2 bottom-28 z-30 rounded-full
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

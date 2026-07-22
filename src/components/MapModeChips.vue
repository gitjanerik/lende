<script setup>
// Modus-chips og -bannere som ligger oppå kartflaten, skilt ut fra MapView
// v1.0.8: auto-kart-toast, «tegner inn detaljer»-chip, highlight-chip,
// annoteringsmodus-indikator, måleverktøy-readout, stifinner-alert og
// nærhetsvarsel-alert. Composable-objektene (annot/sti/proximity) sendes inn
// som props og leses med .value-idiomet, som ellers i appen. Handlinger som
// involverer andre delsystemer sendes ut som events.
import { computed, ref, watch } from 'vue'
import { ANNOTATION_SYMBOLS } from '../composables/useMapAnnotations.js'

const props = defineProps({
  autoMapToast: { type: String, default: '' },
  searchOpen: { type: Boolean, default: false },
  mapCenterStyle: { type: Object, default: () => ({}) },
  fillingInDetails: { type: Boolean, default: false },
  highlightedFeature: { type: Object, default: null },
  annot: { type: Object, required: true },
  measureMode: { type: [Boolean, String], default: false },
  measureClosed: { type: Boolean, default: false },
  measureStats: { type: Object, default: () => ({ distM: 0, areaM2: 0 }) },
  sti: { type: Object, required: true },
  stiElevationDiffM: { type: Number, default: null },
  stiRouteClimbs: { type: Array, default: () => [] },
  stiSelectedClimb: { type: Object, default: null },
  stiProgress: { type: Object, default: null },
  gpsWatching: { type: Boolean, default: false },
  proximity: { type: Object, required: true },
})
defineEmits([
  'clearHighlight', 'stopMeasure',
  'selectRoute', 'removeVia', 'beginAddVia', 'cancelStifinner',
  'followRoute', 'stopFollowing', 'startGps',
])

// Følg rute-panelet: minimert pill som standard; utvid for detaljer/fremdrift.
const followExpanded = ref(false)
watch(() => props.sti.mode.value, (m) => { if (m !== 'following') followExpanded.value = false })

const followedRoute = computed(() =>
  props.sti.routes.value[props.sti.selectedRouteIdx.value] ?? null)
// GPS-fremdrift regnes som «på ruta» innenfor 75 m (GPS-slingring + snapping).
const onRoute = computed(() => props.stiProgress && props.stiProgress.offRouteM <= 75)

function formatDistance(m) {
  if (!m) return '0 m'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}
function formatArea(m2) {
  if (m2 < 10_000) return `${Math.round(m2)} m²`
  if (m2 < 1_000_000) return `${(m2 / 10_000).toFixed(2)} ha`
  return `${(m2 / 1_000_000).toFixed(2)} km²`
}
function formatElevationDiff(m) {
  const r = Math.round(m)
  if (r === 0) return '0 m'
  return `${r > 0 ? '+' : '−'}${Math.abs(r)} m`
}
</script>

<template>
  <!-- Auto-kart runtime-toast (offline / «flyttet sentrum» / på-av): fast
       nederst-midt på kartet siden FAB-en er borte. -->
  <Transition name="chip-fade">
    <div v-if="autoMapToast && !searchOpen"
         class="absolute left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-2xl
                bg-zinc-950/90 text-white text-[12px] font-medium shadow-lg backdrop-blur
                text-center max-w-[85%] pointer-events-none border border-white/10
                transition-[left] duration-200"
         :style="[mapCenterStyle, { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }]">
      {{ autoMapToast }}
    </div>
  </Transition>

  <!-- Terreng-først: kartet viser konturer+relieff straks; chip viser at
       stier og detaljer fylles inn i bakgrunnen (Overpass laster). -->
  <Transition name="chip-fade">
    <div v-if="fillingInDetails && !searchOpen"
         class="absolute top-[var(--ovl-top)] left-1/2 -translate-x-1/2 z-30 pl-2 pr-3.5 py-1.5 rounded-2xl
                bg-zinc-950/90 text-white text-[12.5px] font-medium shadow-lg backdrop-blur
                flex items-center gap-2 pointer-events-none border border-white/10
                transition-[left] duration-200"
         :style="mapCenterStyle">
      <!-- Animert «landmåler»-ikon: topo-konturer tegnes inn mens en gul
           sveipelinje roterer over kartet (SMIL) — eye candy som matcher at
           kartet tegnes ferdig i bakgrunnen. -->
      <svg viewBox="0 0 32 32" class="w-7 h-7 shrink-0" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="14" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="10.5" stroke="#7dd3fc" stroke-width="1.6"
                stroke-dasharray="66" stroke-linecap="round" opacity="0.9">
          <animate attributeName="stroke-dashoffset" values="66;0;0;66" dur="2.4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="16" cy="16" r="6" stroke="#34d399" stroke-width="1.6"
                stroke-dasharray="38" stroke-linecap="round" opacity="0.9">
          <animate attributeName="stroke-dashoffset" values="38;0;0;38" dur="2.4s" begin="0.3s" repeatCount="indefinite"/>
        </circle>
        <g>
          <line x1="16" y1="16" x2="16" y2="3.5" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>
          <circle cx="16" cy="3.5" r="1.7" fill="#fbbf24"/>
          <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="1.8s" repeatCount="indefinite"/>
        </g>
        <circle cx="16" cy="16" r="1.8" fill="#fff">
          <animate attributeName="r" values="1.4;2.4;1.4" dur="1.4s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <span>Tegner inn stier og detaljer …</span>
    </div>
  </Transition>

  <!-- Highlight-chip — vises når et søkeresultat eller ?hl= har satt en
       markør. Tap fjerner highlight og dropper søkemodus. -->
  <Transition name="chip-fade">
    <div v-if="highlightedFeature && !searchOpen"
         class="absolute top-[var(--ovl-top)] left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-2xl
                bg-pink-500/95 text-white text-[12px] font-medium shadow-lg
                flex items-center gap-2 max-w-[85%] pointer-events-auto
                transition-[left] duration-200"
         :style="mapCenterStyle">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="10" r="3"/>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
      </svg>
      <span class="min-w-0 flex flex-col leading-tight">
        <span class="truncate font-semibold">{{ highlightedFeature.name }}</span>
        <span v-if="highlightedFeature.sub"
              class="truncate text-[11px] font-normal text-white/85">{{ highlightedFeature.sub }}</span>
      </span>
      <button @click="$emit('clearHighlight')" aria-label="Fjern markering"
              class="w-5 h-5 -mr-1 rounded-full flex items-center justify-center
                     text-white/90 active:bg-white/20 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor"
             stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
  </Transition>

  <!-- Annoteringsmodus indikator. -->
  <div v-if="annot.isAnnotateMode.value && annot.selectedSymbol.value"
       class="absolute top-[var(--ovl-poi)] right-3 z-20 px-2.5 py-1.5 rounded-md bg-slate-600
              text-white text-[11px] font-medium shadow-lg pointer-events-none">
    Trykk på kartet for å plassere
    <div class="text-[9px] text-white/80 mt-0.5">
      {{ ANNOTATION_SYMBOLS.find(s => s.symbolKey === annot.selectedSymbol.value)?.label }}
    </div>
  </div>

  <!-- Måleverktøy-indikator. Live-readout direkte på kartet, top-left (under
       back-knappen) så den ikke ligger bak FAB-stacken. X-knappen avslutter
       målingen direkte fra kartet uten å åpne drawer-en. -->
  <div v-if="measureMode"
       class="absolute top-[var(--ovl-top)] left-3 z-20 rounded-md bg-emerald-600
              text-white text-[11px] font-medium shadow-lg
              tabular-nums max-w-[55%] flex items-start gap-1.5 pl-3 pr-1 py-2">
    <div class="flex-1 min-w-0">
      <div class="text-[9px] uppercase tracking-wide text-emerald-100/90">Mål</div>
      <div class="text-[13px] font-semibold">{{ formatDistance(measureStats.distM) }}</div>
      <div v-if="measureClosed" class="text-[11px] text-emerald-100/95">
        {{ formatArea(measureStats.areaM2) }}
      </div>
    </div>
    <button @click="$emit('stopMeasure')" aria-label="Avslutt måling"
            class="-mt-0.5 -mr-0.5 w-6 h-6 flex items-center justify-center rounded-md
                   text-white/90 active:scale-90 active:bg-white/10 shrink-0">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Stifinner-alert (grønn, X-knapp avslutter — samme mønster som måling).
       To faser: velg startpunkt → ruter funnet. Egen rute-liste (tappbar,
       viser lengde + estimert gangtid). -->
  <div v-if="sti.active.value && sti.mode.value !== 'following'"
       class="absolute top-[var(--ovl-top)] left-3 z-20 rounded-md bg-emerald-600
              text-white text-[11px] font-medium shadow-lg
              max-w-[70%] flex items-start gap-1.5 pl-3 pr-1 py-2">
    <div class="flex-1 min-w-0">
      <div class="text-[9px] uppercase tracking-wide text-emerald-100/90">
        {{ sti.isLoop.value ? 'Rundtur' : 'Stifinner' }}
      </div>
      <template v-if="sti.mode.value === 'pickingStart'">
        <div class="text-[12px] font-semibold">Velg startpunkt</div>
        <div class="text-[10px] text-emerald-100/90">Sikt med krysset, trykk Bekreft</div>
      </template>
      <template v-else-if="sti.mode.value === 'pickingVia'">
        <div class="text-[12px] font-semibold">
          {{ sti.isLoop.value
              ? (sti.via.value.length === 0 ? 'Velg vendepunkt' : `Vendepunkt ${sti.via.value.length + 1} av ${sti.MAX_VIA}`)
              : `Via-punkt ${sti.via.value.length + 1} av ${sti.MAX_VIA}` }}
        </div>
        <div class="text-[10px] text-emerald-100/90">Sikt med krysset, trykk Bekreft</div>
      </template>
      <template v-else>
        <template v-if="sti.error.value">
          <div class="text-[12px] font-semibold">{{ sti.error.value }}</div>
          <div v-if="sti.diag.value" class="text-[9px] text-emerald-100/70 mt-0.5 tabular-nums break-all">
            {{ sti.diag.value }}
          </div>
          <div v-if="sti.directDistanceM.value" class="text-[10px] text-emerald-100/90 mt-0.5 tabular-nums">
            Luftlinje A→B: {{ formatDistance(sti.directDistanceM.value) }}
          </div>
          <div v-if="stiElevationDiffM !== null" class="text-[10px] text-emerald-100/90 tabular-nums">
            Høydemeter A→B: {{ formatElevationDiff(stiElevationDiffM) }}
          </div>
        </template>
        <template v-else>
          <div class="text-[12px] font-semibold mb-1">
            {{ sti.routes.value.length }} {{ sti.routes.value.length === 1 ? 'rute' : 'ruter' }}
          </div>
          <div class="flex flex-col gap-1">
            <button v-for="(r, i) in sti.routes.value" :key="i"
                    @click="$emit('selectRoute', i)"
                    class="flex items-center gap-1.5 text-left rounded px-1.5 py-1 active:scale-[0.98]"
                    :class="i === sti.selectedRouteIdx.value ? 'bg-white/20' : 'bg-white/5'">
              <span class="w-2.5 h-2.5 rounded-full shrink-0"
                    :style="{ background: ['#dc2626','#7c3aed','#0891b2'][i % 3] }"></span>
              <span class="text-[11px] tabular-nums">
                {{ formatDistance(r.lengthM) }} · {{ sti.estWalkMinutes(r.lengthM, stiRouteClimbs[i]) }} min
              </span>
              <span v-if="r.shortest"
                    class="text-[8px] uppercase tracking-wide bg-white/25 rounded px-1 py-px shrink-0">
                Kortest
              </span>
            </button>
          </div>
          <!-- Via-punkter (0–3): chips med fjern-knapp + «+ Via». -->
          <div class="flex flex-wrap items-center gap-1 mt-1.5">
            <span v-for="(v, i) in sti.via.value" :key="'via' + i"
                  class="flex items-center gap-1 bg-amber-500/30 rounded pl-1.5 pr-0.5 py-0.5 text-[10px]">
              <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
              {{ sti.isLoop.value ? 'Vendepkt' : 'Via' }} {{ i + 1 }}
              <button @click="$emit('removeVia', i)" aria-label="Fjern via-punkt"
                      class="w-4 h-4 flex items-center justify-center rounded active:bg-white/20">
                <svg viewBox="0 0 24 24" class="w-2.5 h-2.5" fill="none" stroke="currentColor"
                     stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                </svg>
              </button>
            </span>
            <button v-if="sti.canAddVia.value" @click="$emit('beginAddVia')"
                    class="flex items-center gap-1 bg-white/15 rounded px-1.5 py-0.5 text-[10px]
                           font-medium active:scale-95">
              <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor"
                   stroke-width="2.6" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {{ sti.isLoop.value ? 'Vendepunkt' : 'Via' }}
            </button>
          </div>
          <div v-if="sti.directDistanceM.value" class="text-[10px] text-emerald-100/80 mt-1 tabular-nums">
            Luftlinje A→B: {{ formatDistance(sti.directDistanceM.value) }}
          </div>
          <div v-if="stiElevationDiffM !== null" class="text-[10px] text-emerald-100/80 tabular-nums">
            Høydemeter A→B: {{ formatElevationDiff(stiElevationDiffM) }}
          </div>
          <div v-if="stiSelectedClimb" class="text-[10px] text-emerald-100/80 tabular-nums">
            Valgt rute: ↑{{ Math.round(stiSelectedClimb.ascent) }} m ↓{{ Math.round(stiSelectedClimb.descent) }} m
          </div>
          <!-- «Bruk rute»: gå til following-modus — ruta beholdes på kartet,
               boksen minimeres til pill og kartet slipper fri igjen. -->
          <button @click="$emit('followRoute')"
                  class="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded
                         bg-white text-emerald-700 font-semibold text-[12px] py-1.5
                         active:scale-[0.98] shadow">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Bruk rute
          </button>
        </template>
      </template>
    </div>
    <button @click="$emit('cancelStifinner')" aria-label="Avslutt stifinner"
            class="-mt-0.5 -mr-0.5 w-6 h-6 flex items-center justify-center rounded-md
                   text-white/90 active:scale-90 active:bg-white/10 shrink-0">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Følg rute (v1.0.52): minimert pill mens brukeren går ruta — kartet er
       fritt (long-press/POI/måling virker). Tap utvider til panel med
       distanse/tid/høydemeter + GPS-fremdrift, «Til forslag» og X. -->
  <!-- Måling kan pågå samtidig (samme hjørne) → still pillen under readouten. -->
  <div v-if="sti.mode.value === 'following'" class="absolute left-3 z-20 max-w-[70%]"
       :class="measureMode ? 'top-[var(--ovl-top-2)]' : 'top-[var(--ovl-top)]'">
    <button v-if="!followExpanded" @click="followExpanded = true"
            class="flex items-center gap-1.5 rounded-full bg-emerald-600 text-white
                   text-[11px] font-semibold shadow-lg pl-3 pr-2 py-1.5 active:scale-[0.97]
                   tabular-nums">
      <span>{{ sti.isLoop.value ? 'Rundtur' : 'Rute' }}</span>
      <span v-if="followedRoute" class="font-normal text-emerald-100/95">
        · {{ onRoute ? formatDistance(stiProgress.remainingM) + ' igjen' : formatDistance(followedRoute.lengthM) }}
      </span>
      <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <div v-else
         class="rounded-md bg-emerald-600 text-white text-[11px] font-medium shadow-lg
                flex items-start gap-1.5 pl-3 pr-1 py-2">
      <div class="flex-1 min-w-0">
        <div class="text-[9px] uppercase tracking-wide text-emerald-100/90">
          {{ sti.isLoop.value ? 'Følger rundtur' : 'Følger rute' }}
        </div>
        <div v-if="followedRoute" class="text-[13px] font-semibold tabular-nums">
          {{ formatDistance(followedRoute.lengthM) }}
          · {{ sti.estWalkMinutes(followedRoute.lengthM, stiSelectedClimb) }} min
        </div>
        <div v-if="stiSelectedClimb" class="text-[10px] text-emerald-100/80 tabular-nums">
          ↑{{ Math.round(stiSelectedClimb.ascent) }} m ↓{{ Math.round(stiSelectedClimb.descent) }} m
        </div>
        <!-- Fremdrift: krever GPS. Utenfor ruta (>75 m) vises avstanden dit. -->
        <div v-if="onRoute" class="text-[11px] text-emerald-50 mt-0.5 tabular-nums">
          Gått {{ formatDistance(stiProgress.alongM) }} av {{ formatDistance(stiProgress.totalM) }}
          · {{ formatDistance(stiProgress.remainingM) }} igjen
        </div>
        <div v-else-if="stiProgress" class="text-[11px] text-amber-200 mt-0.5 tabular-nums">
          Utenfor ruta ({{ formatDistance(stiProgress.offRouteM) }} unna)
        </div>
        <div v-else-if="gpsWatching" class="text-[10px] text-emerald-100/80 mt-0.5">
          Venter på GPS-posisjon …
        </div>
        <button v-else @click="$emit('startGps')"
                class="mt-1 flex items-center gap-1 bg-white/15 rounded px-1.5 py-0.5
                       text-[10px] font-medium active:scale-95">
          <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
          Slå på GPS for fremdrift
        </button>
        <button @click="$emit('stopFollowing')"
                class="mt-1.5 flex items-center gap-1 bg-white/15 rounded px-1.5 py-0.5
                       text-[10px] font-medium active:scale-95">
          <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Til forslag
        </button>
      </div>
      <div class="flex flex-col shrink-0">
        <button @click="followExpanded = false" aria-label="Minimer"
                class="-mt-0.5 -mr-0.5 w-6 h-6 flex items-center justify-center rounded-md
                       text-white/90 active:scale-90 active:bg-white/10">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button @click="$emit('cancelStifinner')" aria-label="Avslutt rute"
                class="-mr-0.5 w-6 h-6 flex items-center justify-center rounded-md
                       text-white/90 active:scale-90 active:bg-white/10">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Nærhetsvarsel-alert (blå, X-knapp avbryter). Stables under måle-/sti-
       banneret hvis et av dem er aktivt (begge ligger på samme topp-offset, left-3). -->
  <div v-if="proximity.active.value"
       class="absolute left-3 z-20 rounded-md bg-sky-600
              text-white text-[11px] font-medium shadow-lg
              tabular-nums max-w-[60%] flex items-start gap-1.5 pl-3 pr-1 py-2"
       :class="(measureMode && sti.mode.value === 'following') ? 'top-[var(--ovl-top-3)]'
               : (measureMode || sti.active.value) ? 'top-[var(--ovl-top-2)]' : 'top-[var(--ovl-top)]'">
    <div class="flex-1 min-w-0">
      <div class="text-[9px] uppercase tracking-wide text-sky-100/90">Nærhetsvarsel</div>
      <div class="text-[12px] font-semibold truncate">{{ proximity.active.value.label }}</div>
      <div v-if="proximity.status.value === 'triggered'" class="text-[12px] text-amber-200 font-semibold">
        Framme!
      </div>
      <div v-else-if="proximity.currentDistanceM.value != null" class="text-[11px] text-sky-100/95">
        {{ formatDistance(proximity.currentDistanceM.value) }} unna · varsler innen {{ proximity.active.value.distanceM }} m
      </div>
      <div v-else class="text-[11px] text-sky-100/80">
        Venter på GPS-posisjon …
      </div>
    </div>
    <button @click="proximity.cancel()" aria-label="Avbryt nærhetsvarsel"
            class="-mt-0.5 -mr-0.5 w-6 h-6 flex items-center justify-center rounded-md
                   text-white/90 active:scale-90 active:bg-white/10 shrink-0">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chip-fade-enter-active, .chip-fade-leave-active { transition: opacity 0.18s ease; }
.chip-fade-enter-from, .chip-fade-leave-to       { opacity: 0; }
</style>

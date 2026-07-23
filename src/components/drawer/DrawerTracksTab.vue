<script setup>
// Drawer-fane «Sporing», skilt ut fra MapView v1.0.8. Opptaks-knapp,
// stil-velger, spor-liste med sparkline (tap → stor profil via
// v-model:expanded-track-id), GPS-debug og «Presis posisjon»-tips.
// tracker/userPos-composablene sendes inn som objekter.
import { TRACK_STYLES } from '../../composables/useTrackRecorder.js'
import { trackLengthM, trackDurationMs } from '../../lib/gpxExport.js'
import { buildProfilePath } from '../../lib/elevationProfile.js'

defineProps({
  tracker: { type: Object, required: true },
  userPos: { type: Object, required: true },
  liveTrackStats: { type: Object, default: null },
  onToggleRecording: { type: Function, required: true },
  onExportTrackGpx: { type: Function, required: true },
  onDeleteTrack: { type: Function, required: true },
  profileFor: { type: Function, required: true },
  gpsDebugLine: { type: String, default: '' },
  copyGpsCoords: { type: Function, required: true },
  copyState: { type: String, default: 'idle' },
  showGpsTip: { type: Boolean, default: false },
  dismissGpsTip: { type: Function, required: true },
})
const expandedTrackId = defineModel('expandedTrackId', { default: null })

function formatDistance(m) {
  if (!m) return '0 m'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}
function formatDuration(ms) {
  if (!ms || ms < 1000) return '0 s'
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}t ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
</script>

<template>
  <div>
  <div class="space-y-2 mb-3">
    <button @click="onToggleRecording"
            class="w-full px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98] flex items-center justify-between gap-2"
            :class="tracker.isRecording.value
                    ? 'bg-pink-500/25 border-pink-300/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/75'">
      <span class="flex items-center gap-2">
        <span v-if="tracker.isRecording.value"
              class="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
        <svg v-else viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </svg>
        {{ tracker.isRecording.value ? 'Stopp opptak' : (userPos.isWatching ? 'Start opptak' : 'Start GPS + opptak') }}
      </span>
      <span v-if="liveTrackStats" class="text-[11px] text-pink-100/85 tabular-nums">
        {{ formatDistance(liveTrackStats.meters) }} · {{ formatDuration(liveTrackStats.ms) }}
      </span>
    </button>

    <!-- Stil-velger: linje / fotspor / brødsmuler. Påvirker
         alle synlige spor med en gang. -->
    <div class="grid grid-cols-3 gap-1.5">
      <button v-for="s in TRACK_STYLES" :key="s.key"
              @click="tracker.setStyle(s.key)"
              :title="s.desc"
              class="px-2 py-1.5 rounded-md border text-[11px] active:scale-[0.98] transition"
              :class="tracker.trackStyle.value === s.key
                      ? 'bg-pink-400/20 border-pink-300/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/65'">
        {{ s.label }}
      </button>
    </div>
    <div class="text-[10px] text-white/40 leading-snug">
      Punkter samples ned til hver 5. m. Lave-nøyaktighets-fixer (over
      50 m) ignoreres så støy ikke blir sti. Spor lagres med kartet.
    </div>
    <div v-if="tracker.isRecording.value"
         class="text-[10px] leading-snug rounded-md px-2 py-1.5 bg-pink-500/10
                border border-pink-300/20 text-pink-100/85">
      <span v-if="tracker.wakeLockActive.value">
        Skjermen holdes våken så GPS ikke stopper. Hold appen åpen
        under turen — nettleseren kan ikke spore i bakgrunnen.
      </span>
      <span v-else>
        Hold appen åpen og skjermen våken under turen — nettleseren
        kan ikke spore i bakgrunnen, og GPS-en stopper når skjermen
        sovner.
      </span>
    </div>
  </div>

  <!-- Liste over lagrede spor + det aktive sporet. -->
  <div v-if="tracker.tracks.value.length"
       class="text-white/55 text-[11px] uppercase tracking-wide mb-2">Mine spor</div>
  <div v-if="tracker.tracks.value.length"
       class="space-y-1.5 mb-3 max-h-56 overflow-y-auto pr-1">
    <div v-for="tr in tracker.tracks.value" :key="tr.id"
         class="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10">
      <div class="flex items-center gap-2">
        <button @click="tracker.toggleVisibility(tr.id)"
                :aria-label="tracker.visibleTrackIds.value.has(tr.id) ? 'Skjul spor' : 'Vis spor'"
                class="w-5 h-5 flex items-center justify-center rounded-sm shrink-0"
                :class="tracker.visibleTrackIds.value.has(tr.id)
                        ? 'text-pink-300'
                        : 'text-white/30'">
          <svg v-if="tracker.visibleTrackIds.value.has(tr.id)" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12 s4 -7 10 -7 s10 7 10 7 s-4 7 -10 7 s-10 -7 -10 -7"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3 L21 21"/>
            <path d="M10.5 6.2 Q12 6 13.5 6.2 Q19 7 22 12 Q21 13.5 19 15.2"/>
            <path d="M2 12 Q5 7 9 6"/>
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <div class="text-[12px] text-white/85 truncate">
            {{ tr.navn || ('Tur ' + new Date(tr.opprettet).toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })) }}
            <span v-if="tracker.isRecording.value && tracker.activeTrack.value?.id === tr.id"
                  class="ml-1 text-pink-300 text-[10px] uppercase">● opptak</span>
          </div>
          <div class="text-[10px] text-white/45 tabular-nums">
            {{ formatDistance(trackLengthM(tr)) }} ·
            {{ formatDuration(trackDurationMs(tr)) }} ·
            {{ tr.points.length }} punkter
          </div>
        </div>
        <button @click="onExportTrackGpx(tr)"
                aria-label="Eksporter som GPX"
                :disabled="!tr.points.length"
                class="w-7 h-7 flex items-center justify-center rounded-md text-white/55
                       active:scale-90 active:bg-white/10 disabled:opacity-30">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5 V19"/><polyline points="6 13 12 19 18 13"/>
            <line x1="5" y1="21" x2="19" y2="21"/>
          </svg>
        </button>
        <button @click="onDeleteTrack(tr.id)"
                aria-label="Slett spor"
                class="w-7 h-7 flex items-center justify-center rounded-md text-white/55
                       active:scale-90 active:bg-rose-500/20 active:text-rose-200">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Høydeprofil-sparkline. Tap for å zoome.
           Krever ≥ 2 punkter og at DEM er lastet. -->
      <button v-if="profileFor(tr)"
              @click="expandedTrackId = tr.id"
              class="mt-1.5 w-full block rounded-sm overflow-hidden active:opacity-80"
              aria-label="Vis høydeprofil i full størrelse">
        <svg viewBox="0 0 200 36" preserveAspectRatio="none"
             class="w-full h-9 block">
          <defs>
            <linearGradient :id="'pf-grad-' + tr.id" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#ec4899" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#ec4899" stop-opacity="0.05"/>
            </linearGradient>
          </defs>
          <path :d="buildProfilePath(profileFor(tr), 200, 36, 2).area"
                :fill="'url(#pf-grad-' + tr.id + ')'"/>
          <path :d="buildProfilePath(profileFor(tr), 200, 36, 2).line"
                fill="none" stroke="#ec4899" stroke-width="1.2"
                stroke-linecap="round" stroke-linejoin="round"
                vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="text-[10px] text-white/55 tabular-nums leading-tight px-0.5 mt-0.5 text-left">
          ↗ {{ Math.round(profileFor(tr).totalAscent) }} m ·
          ↘ {{ Math.round(profileFor(tr).totalDescent) }} m ·
          {{ Math.round(profileFor(tr).minElev) }}–{{ Math.round(profileFor(tr).maxElev) }} moh
        </div>
      </button>
    </div>
  </div>

  <!-- GPS-posisjon-readout (synlig kun når GPS er på): rå koordinater for din
       nåværende posisjon, med knapp for å kopiere dem som Google Maps-lenke. -->
  <div v-if="userPos.isWatching" class="mb-2">
    <div class="text-white/45 text-[10px] uppercase tracking-wide mb-1 px-0.5">
      Din GPS-posisjon
    </div>
    <div class="flex items-stretch gap-2">
      <div class="flex-1 text-white/60 text-[10.5px] font-mono leading-snug
                  bg-white/5 border border-white/10 rounded-lg px-3 py-2 tabular-nums
                  flex items-center">
        {{ gpsDebugLine }}
      </div>
      <button @click="copyGpsCoords"
              :disabled="userPos.latRaw == null"
              :aria-label="copyState === 'copied' ? 'Kopiert' : 'Kopier posisjon som Google Maps-lenke'"
              class="px-3 rounded-lg border text-[11px] active:scale-[0.98] transition disabled:opacity-40"
              :class="copyState === 'copied'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                      : copyState === 'failed'
                        ? 'bg-rose-500/20 border-rose-400/50 text-rose-100'
                        : 'bg-white/5 border-white/10 text-white/75'">
        {{ copyState === 'copied' ? 'Kopiert' : copyState === 'failed' ? 'Feil' : 'Kopier' }}
      </button>
    </div>
  </div>

  <!-- Førstegangs-tips om Android «Presis posisjon». -->
  <div v-if="showGpsTip"
       class="relative text-[11px] leading-snug bg-amber-500/15 border border-amber-400/40
              text-amber-50/95 rounded-lg px-3 py-2.5 mb-2 pr-8">
    <button @click="dismissGpsTip"
            aria-label="Skjul tips"
            class="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center
                   rounded-md text-amber-100/70 active:scale-90 hover:bg-white/10">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
    <div class="font-semibold text-amber-100 mb-0.5">Tips: Sjekk «Presis posisjon»</div>
    Hvis prikken ligger langt unna deg, har nettleseren sannsynligvis bare «Omtrentlig»
    posisjon (~2 km nøyaktighet). På Android 12+: Innstillinger → Apper → din nettleser →
    Tillatelser → Posisjon → velg <b>Presis</b>.
  </div>
  </div>
</template>

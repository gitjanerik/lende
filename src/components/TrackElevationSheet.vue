<script setup>
// Høydeprofil-modal (opprinnelig v8.9.4, skilt ut fra MapView v1.0.4). Åpnes ved
// tap på sparkline i Sporing-fanen. Viser stor profil + stats som bunn-ark.
// Rent presentasjonelt: forelderen eier DEM-en og sender inn ferdig profil
// (null → DEM utilgjengelig for dette kartet).
import { buildProfilePath } from '../lib/elevationProfile.js'
import { trackLengthM, trackDurationMs } from '../lib/gpxExport.js'

defineProps({
  track: { type: Object, default: null },     // { id, navn, opprettet, points }
  profile: { type: Object, default: null },   // profileFor(track)-resultat; null → utilgjengelig
})
defineEmits(['close'])

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
  <div v-if="track"
       class="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end justify-center"
       @click.self="$emit('close')">
    <div class="w-full bg-zinc-900 border-t border-white/10 rounded-t-2xl p-4 max-h-[75dvh] overflow-y-auto">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="text-white text-sm font-semibold">
            {{ track.navn || ('Tur ' + new Date(track.opprettet).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' })) }}
          </div>
          <div class="text-[11px] text-white/55 tabular-nums">
            {{ formatDistance(trackLengthM(track)) }} ·
            {{ formatDuration(trackDurationMs(track)) }} ·
            {{ track.points.length }} punkter
          </div>
        </div>
        <button @click="$emit('close')"
                aria-label="Lukk"
                class="w-8 h-8 rounded-full bg-white/5 border border-white/10
                       text-white/65 flex items-center justify-center active:scale-90">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <template v-if="profile">
        <svg viewBox="0 0 600 180" preserveAspectRatio="none"
             class="w-full h-44 block rounded-lg bg-zinc-950">
          <defs>
            <linearGradient :id="'pf-big-grad-' + track.id" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#ec4899" stop-opacity="0.65"/>
              <stop offset="100%" stop-color="#ec4899" stop-opacity="0.05"/>
            </linearGradient>
          </defs>
          <!-- Horisontale grid-linjer (svake, for kontekst) -->
          <g stroke="rgba(255,255,255,0.07)" stroke-width="1">
            <line v-for="i in 3" :key="i" x1="0" :y1="(i / 4) * 180" x2="600" :y2="(i / 4) * 180"/>
          </g>
          <path :d="buildProfilePath(profile, 600, 180, 8).area"
                :fill="'url(#pf-big-grad-' + track.id + ')'"/>
          <path :d="buildProfilePath(profile, 600, 180, 8).line"
                fill="none" stroke="#ec4899" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"
                vector-effect="non-scaling-stroke"/>
          <!-- Y-akse-labels: max + min høyde -->
          <text x="6" y="14" fill="#ec4899" font-size="11" font-weight="600">
            {{ Math.round(profile.maxElev) }} moh
          </text>
          <text x="6" y="174" fill="#ec4899" font-size="11" font-weight="600">
            {{ Math.round(profile.minElev) }} moh
          </text>
          <text x="594" y="14" fill="rgba(255,255,255,0.4)" font-size="10"
                text-anchor="end">0 m</text>
          <text x="594" y="174" fill="rgba(255,255,255,0.4)" font-size="10"
                text-anchor="end">
            {{ formatDistance(profile.totalDistM) }}
          </text>
        </svg>

        <div class="grid grid-cols-2 gap-2 mt-3 text-[12px]">
          <div class="rounded-md bg-white/5 border border-white/10 px-3 py-2">
            <div class="text-white/45 text-[10px] uppercase tracking-wide">Total stigning</div>
            <div class="text-white font-semibold tabular-nums">↗ {{ Math.round(profile.totalAscent) }} m</div>
          </div>
          <div class="rounded-md bg-white/5 border border-white/10 px-3 py-2">
            <div class="text-white/45 text-[10px] uppercase tracking-wide">Total fall</div>
            <div class="text-white font-semibold tabular-nums">↘ {{ Math.round(profile.totalDescent) }} m</div>
          </div>
          <div class="rounded-md bg-white/5 border border-white/10 px-3 py-2">
            <div class="text-white/45 text-[10px] uppercase tracking-wide">Høyeste punkt</div>
            <div class="text-white font-semibold tabular-nums">{{ Math.round(profile.maxElev) }} moh</div>
          </div>
          <div class="rounded-md bg-white/5 border border-white/10 px-3 py-2">
            <div class="text-white/45 text-[10px] uppercase tracking-wide">Laveste punkt</div>
            <div class="text-white font-semibold tabular-nums">{{ Math.round(profile.minElev) }} moh</div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="rounded-md bg-amber-500/10 border border-amber-300/30 px-3 py-3 text-amber-100/90 text-[12px]">
          Høydeprofil ikke tilgjengelig — DEM kunne ikke leses for dette kartet.
        </div>
      </template>
    </div>
  </div>
</template>

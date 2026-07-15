<script setup>
// Drawer-fane «Måling», skilt ut fra MapView v1.0.8. Start/avslutt måling,
// lukk polygon, angre og tøm. Måle-tilstanden eies av forelderen (den rendrer
// måle-SVG-en); handlingene kommer som funksjons-props.
defineProps({
  measureMode: { type: [Boolean, String], default: false },
  measureStats: { type: Object, default: () => ({ distM: 0, areaM2: 0 }) },
  measureClosed: { type: Boolean, default: false },
  measureVertices: { type: Array, default: () => [] },
  startMeasure: { type: Function, required: true },
  stopMeasure: { type: Function, required: true },
  closeMeasure: { type: Function, required: true },
  undoMeasureVertex: { type: Function, required: true },
  clearMeasure: { type: Function, required: true },
})

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
</script>

<template>
  <div>
    <div class="space-y-2 mb-2">
      <button v-if="!measureMode"
              @click="startMeasure"
              class="w-full px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                     bg-white/5 border-white/10 text-white/75 flex items-center justify-center gap-2">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 21 9 15 13 19 21 11"/>
          <path d="M5 19 V21 H7 M19 11 V13 H21"/>
        </svg>
        Mål distanse og areal
      </button>
      <div v-else class="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 space-y-2">
        <div class="flex items-baseline justify-between">
          <div class="text-[11px] text-emerald-100/85 uppercase tracking-wide">
            Tap på kartet for å plassere punkter
          </div>
          <button @click="stopMeasure"
                  aria-label="Avslutt måling"
                  class="text-white/70 active:scale-90 text-[10px] px-1.5 py-0.5 rounded
                         bg-white/10 hover:bg-white/15">
            Lukk
          </button>
        </div>
        <div class="text-white text-[14px] tabular-nums font-medium">
          {{ formatDistance(measureStats.distM) }}
          <span v-if="measureClosed" class="text-emerald-200/85">
            · {{ formatArea(measureStats.areaM2) }}
          </span>
          <span v-if="measureVertices.length === 0"
                class="text-white/45 text-[11px] font-normal">
            (ingen punkter ennå)
          </span>
        </div>
        <div class="flex gap-1.5">
          <button @click="closeMeasure"
                  :disabled="measureVertices.length < 3 || measureClosed"
                  class="flex-1 px-2 py-1.5 rounded-md text-[11px] border active:scale-[0.98]
                         bg-emerald-500/20 border-emerald-300/40 text-white
                         disabled:opacity-40 disabled:cursor-not-allowed">
            Lukk polygon
          </button>
          <button @click="undoMeasureVertex"
                  :disabled="!measureVertices.length"
                  class="flex-1 px-2 py-1.5 rounded-md text-[11px] border active:scale-[0.98]
                         bg-white/5 border-white/15 text-white/75 disabled:opacity-40">
            Angre
          </button>
          <button @click="clearMeasure"
                  :disabled="!measureVertices.length"
                  class="flex-1 px-2 py-1.5 rounded-md text-[11px] border active:scale-[0.98]
                         bg-white/5 border-white/15 text-white/75 disabled:opacity-40">
            Tøm
          </button>
        </div>
      </div>
    </div>
    <div class="text-[10px] text-white/40 leading-snug">
      Distanse summeres som rette linjer mellom punkter. Areal beregnes
      med shoelace-formelen når polygonen er lukket. m² · ha · km² —
      det som passer best for areal-størrelsen.
    </div>
  </div>
</template>

<script setup>
// Live-statistikk for 3D-turen: høyde, km gått/igjen, stigning, gjenværende
// tid — pluss tidsaksen, som er dra-bar: brukeren scrubber seg fram og
// tilbake langs turen (kameraet følger, POI dukker opp, avspillingen pauses
// automatisk når man slipper).
import { ref, computed } from 'vue'
import { fmtKm, fmtDurationMin, fmtMoh } from '../../lib/tour3d/tourFormat.js'

const props = defineProps({
  stats: { type: Object, default: null },   // progress-payload fra motoren
  landscape: { type: Boolean, default: false },
  // Hvilke felt som vises. «Tid igjen» faller bort av seg selv når turen ikke
  // har et gangtid-estimat, så en kortere liste trengs bare hvis et kall vil
  // vise mindre enn det den har.
  felter: { type: Array, default: () => ['gaatt', 'igjen', 'hoyde', 'stigning', 'eta'] },
})
const emit = defineEmits(['scrub-start', 'scrub', 'scrub-end'])

const rows = computed(() => {
  const s = props.stats
  if (!s) return []
  const alle = {
    gaatt: { label: 'Gått', value: fmtKm(s.alongM) },
    igjen: { label: 'Igjen', value: fmtKm(s.remainingM) },
    hoyde: { label: 'Høyde', value: fmtMoh(s.elevM) },
    stigning: { label: 'Stigning', value: `↗ ${Math.round(s.ascentSoFarM ?? 0)} m` },
    eta: fmtDurationMin(s.etaMin)
      ? { label: 'Tid igjen', value: fmtDurationMin(s.etaMin) }
      : null,
  }
  return props.felter.map(k => alle[k]).filter(Boolean)
})

// Rutenettet følger antall bokser, så et kortere sett ikke etterlater hull.
const gridStyle = computed(() => (props.landscape
  ? {}
  : { gridTemplateColumns: `repeat(${Math.max(1, rows.value.length)}, minmax(0, 1fr))` }))

const trackRef = ref(null)
const scrubbing = ref(false)
// Under drag styrer fingeren posisjonen direkte — ikke vent på motorens
// throttlede progress-event (gir slæpete thumb).
const dragPct = ref(0)

const pct = computed(() =>
  scrubbing.value ? dragPct.value : (props.stats?.pctDone ?? 0))

function pctFromEvent(e) {
  const rect = trackRef.value?.getBoundingClientRect()
  if (!rect || rect.width === 0) return 0
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

function onPointerDown(e) {
  if (!props.stats) return
  scrubbing.value = true
  dragPct.value = pctFromEvent(e)
  e.currentTarget.setPointerCapture(e.pointerId)
  emit('scrub-start')
  emit('scrub', dragPct.value)
}
function onPointerMove(e) {
  if (!scrubbing.value) return
  dragPct.value = pctFromEvent(e)
  emit('scrub', dragPct.value)
}
function onPointerUp() {
  if (!scrubbing.value) return
  scrubbing.value = false
  emit('scrub-end', dragPct.value)
}
</script>

<template>
  <div :class="landscape
         ? 'flex flex-col gap-1.5 items-end'
         : 'grid gap-1.5 w-full'"
       :style="gridStyle">
    <div v-for="r in rows" :key="r.label"
         class="rounded-lg bg-black/45 backdrop-blur px-2 py-1.5 text-center min-w-0"
         :class="landscape ? 'w-28 text-right px-3' : ''">
      <div class="text-[0.5625rem] uppercase tracking-wide text-white/50 truncate">{{ r.label }}</div>
      <div class="text-xs font-semibold text-white tabular-nums whitespace-nowrap">{{ r.value }}</div>
    </div>
    <!-- Dra-bar tidsakse. Rikelig touch-flate (py) rundt selve sporet. -->
    <div v-if="stats"
         class="rounded-lg bg-black/45 backdrop-blur px-2.5 py-2.5 cursor-pointer select-none"
         :class="landscape ? 'w-28' : ''"
         :style="landscape ? 'touch-action: none;' : 'touch-action: none; grid-column: 1 / -1;'"
         @pointerdown="onPointerDown"
         @pointermove="onPointerMove"
         @pointerup="onPointerUp"
         @pointercancel="onPointerUp">
      <div ref="trackRef" class="relative h-2 rounded-full bg-white/15">
        <div class="absolute inset-y-0 left-0 rounded-full bg-red-500"
             :style="{ width: (pct * 100) + '%' }"/>
        <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full
                    bg-white shadow-md border-2 border-red-500 transition-transform"
             :class="scrubbing ? 'scale-125' : ''"
             :style="{ left: (pct * 100) + '%' }"/>
      </div>
    </div>
  </div>
</template>

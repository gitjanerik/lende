<script setup>
// Live-statistikk for 3D-turen: høyde, km gått/igjen, stigning, gjenværende
// tid og aktuell feature. Drives av progress-events fra motoren.
import { computed } from 'vue'
import { fmtKm, fmtDurationMin, fmtMoh } from '../../lib/tour3d/tourFormat.js'

const props = defineProps({
  stats: { type: Object, default: null },   // progress-payload fra motoren
  landscape: { type: Boolean, default: false },
})

const rows = computed(() => {
  const s = props.stats
  if (!s) return []
  const out = [
    { label: 'Gått', value: fmtKm(s.alongM) },
    { label: 'Igjen', value: fmtKm(s.remainingM) },
    { label: 'Høyde', value: fmtMoh(s.elevM) },
    { label: 'Stigning', value: `↗ ${Math.round(s.ascentSoFarM ?? 0)} m` },
  ]
  const eta = fmtDurationMin(s.etaMin)
  if (eta) out.push({ label: 'Tid igjen', value: eta })
  return out
})

const pct = computed(() => Math.round((props.stats?.pctDone ?? 0) * 100))
</script>

<template>
  <div :class="landscape
         ? 'flex flex-col gap-1.5 items-end'
         : 'grid grid-cols-5 gap-1.5 w-full'">
    <div v-for="r in rows" :key="r.label"
         class="rounded-lg bg-black/45 backdrop-blur px-2 py-1.5 text-center min-w-0"
         :class="landscape ? 'w-28 text-right px-3' : ''">
      <div class="text-[9px] uppercase tracking-wide text-white/50 truncate">{{ r.label }}</div>
      <div class="text-[12px] font-semibold text-white tabular-nums whitespace-nowrap">{{ r.value }}</div>
    </div>
    <div v-if="stats"
         class="rounded-lg bg-black/45 backdrop-blur px-2 py-1.5"
         :class="landscape ? 'w-28' : 'col-span-5'">
      <div class="h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div class="h-full rounded-full bg-red-500 transition-[width] duration-300"
             :style="{ width: pct + '%' }"/>
      </div>
    </div>
  </div>
</template>

<script setup>
// Detalj-skuff for en hydrologisk målestasjon (NVE HydAPI). Blått tema. Viser
// siste vannføring, vannstand og vanntemperatur + lenke til stasjonens side hos
// NVE (Sildre). Navn/lenke vises straks fra kart-ikonets data-*; måleverdiene
// hentes lazy av forelderen (useHydroStations) og fylles inn i `detail`.
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  detail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  drawer: { type: Object, required: true },
})
defineEmits(['close'])

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('no-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtNum(v, dec) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return Number(v).toLocaleString('no-NO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const rows = computed(() => {
  const d = props.detail
  if (!d) return []
  const r = []
  if (d.discharge) r.push({ label: 'Vannføring', value: fmtNum(d.discharge.value, 1), unit: 'm³/s', time: d.discharge.time })
  if (d.waterLevel) r.push({ label: 'Vannstand', value: fmtNum(d.waterLevel.value, 2), unit: 'moh', time: d.waterLevel.time })
  if (d.waterTemp) r.push({ label: 'Vanntemperatur', value: fmtNum(d.waterTemp.value, 1), unit: '°C', time: d.waterTemp.time })
  return r
})
const hasAnyValue = computed(() => rows.value.length > 0)

function onOpenNve() {
  if (props.detail?.link) window.open(props.detail.link, '_blank', 'noopener')
}
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open && detail"
         class="absolute inset-0 z-40 flex items-end justify-center transition-colors duration-200"
         :class="drawer.isMaximized.value ? 'bg-black/60' : 'bg-transparent pointer-events-none'"
         @click.self="$emit('close')">
      <div class="w-full bg-zinc-900 border-t border-sky-400/20 rounded-t-2xl flex flex-col pointer-events-auto"
           :style="drawer.drawerHeightStyle.value">
        <div class="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-3.5 pb-3 flex justify-center"
             @pointerdown="drawer.onPointerDown($event)"
             @pointermove="drawer.onPointerMove($event)"
             @pointerup="drawer.onPointerUp($event)"
             @pointercancel="drawer.onPointerUp($event)">
          <div class="w-12 h-1.5 rounded-full bg-white/40"
               :style="{ opacity: drawer.handleOpacity.value }"></div>
        </div>
        <!-- Header: dråpe-merke + stasjonsnavn + lukk -->
        <div class="shrink-0 px-4 pb-2.5 bg-zinc-900/95 border-b border-white/8 flex items-start justify-between gap-3">
          <div class="min-w-0 flex items-start gap-2.5">
            <span class="mt-0.5 shrink-0 text-sky-400">
              <svg viewBox="-1 -1 2 2" class="w-4 h-4" aria-hidden="true">
                <path d="M0,-0.9 C0.5,-0.25 0.72,0.28 0.72,0.5 A0.72,0.72 0 1 1 -0.72,0.5 C-0.72,0.28 -0.5,-0.25 0,-0.9 Z"
                      fill="currentColor" stroke="#0c4a6e" stroke-width="0.12"/>
              </svg>
            </span>
            <div class="min-w-0">
              <div class="text-[10px] uppercase tracking-wide text-sky-300/60">Målestasjon · NVE</div>
              <div class="text-white text-[15px] font-medium leading-snug break-words">{{ detail.stationName }}</div>
              <div v-if="detail.riverName" class="text-[11px] text-white/45">{{ detail.riverName }}</div>
            </div>
          </div>
          <button @click="$emit('close')" aria-label="Lukk"
                  class="w-8 h-8 -mr-1 -mt-0.5 shrink-0 rounded-full flex items-center justify-center
                         bg-white/5 border border-white/10 text-white/70 active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
        <!-- Kropp: måleverdier + lenke -->
        <div v-show="!drawer.isMinimized.value"
             class="flex-1 overflow-y-auto px-4 pt-3"
             :style="{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">
          <div v-if="loading && !hasAnyValue" class="text-[12px] text-white/50 py-3">Henter sanntidsdata …</div>

          <div v-if="hasAnyValue" class="space-y-2">
            <div v-for="r in rows" :key="r.label"
                 class="flex items-baseline justify-between gap-3 rounded-lg bg-sky-500/[0.08] border border-sky-400/20 px-3 py-2">
              <span class="text-[12px] text-sky-100/80">{{ r.label }}</span>
              <span class="text-right">
                <span class="text-[17px] font-semibold text-white tabular-nums">{{ r.value }}</span>
                <span class="ml-1 text-[11px] text-white/50">{{ r.unit }}</span>
                <span v-if="fmtTime(r.time)" class="block text-[10px] text-white/35">{{ fmtTime(r.time) }}</span>
              </span>
            </div>
          </div>

          <div v-else-if="!loading" class="text-[12px] text-white/50 py-3">
            Ingen ferske måledata for denne stasjonen akkurat nå.
          </div>

          <button @click="onOpenNve" :disabled="!detail.link"
                  class="mt-4 w-full px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                         flex items-center gap-2.5 transition
                         bg-sky-500/[0.14] border-sky-400/40 text-sky-100
                         disabled:opacity-40 disabled:active:scale-100">
            <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span class="flex-1 text-left font-medium">Åpne stasjonen hos NVE</span>
          </button>

          <p class="mt-3 text-[10px] text-white/35 leading-relaxed">
            Sanntidsdata: NVE HydAPI ·
            <a href="https://hydapi.nve.no/UserDocumentation/" target="_blank" rel="noopener" class="underline">dokumentasjon</a>.
            Verdiene er foreløpige og ikke kvalitetssikret.
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.22s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to       { opacity: 0; }
.overlay-fade-leave-active { pointer-events: none; }
</style>

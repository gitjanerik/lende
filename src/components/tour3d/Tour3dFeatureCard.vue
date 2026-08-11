<script setup>
// Infokort for aktuell feature under fly-by-stopp. NVE-stasjoner henter
// siste observasjon lazily når kortet vises; alt annet vises fra data som
// allerede ligger i tidslinjen.
import { ref, watch, computed } from 'vue'
import { fmtKm } from '../../lib/tour3d/tourFormat.js'

const props = defineProps({
  feature: { type: Object, default: null },
})
const emit = defineEmits(['skip'])

const TYPE_LABELS = {
  topp: 'Fjelltopp', vann: 'Vann', sted: 'Sted', hytte: 'Hytte',
  naturreservat: 'Naturreservat', kulturminne: 'Kulturminne',
  vannstasjon: 'Vannmålestasjon', 'område': 'Område',
  // Turens egne punkter — trykkbare nåler i 3D, ikke severdigheter.
  veipunkt: 'Turens punkt', parkering: 'Utfartsparkering', rast: 'Rasteplass',
}
const TYPE_ICONS = {
  topp: '⛰️', vann: '💧', sted: '📍', hytte: '🏠',
  naturreservat: '🌿', kulturminne: '🏛️', vannstasjon: '💦', 'område': '🗺️',
  veipunkt: '🚩', parkering: '🅿️', rast: '🧺',
}

const nveLatest = ref(null)
const nveLoading = ref(false)

watch(() => props.feature, async (f) => {
  nveLatest.value = null
  if (!f?.detail?.station) return
  nveLoading.value = true
  try {
    const { fetchStationLatest } = await import('../../lib/nveHydApi.js')
    nveLatest.value = await fetchStationLatest(f.detail.station)
  } catch {
    nveLatest.value = null
  } finally {
    nveLoading.value = false
  }
}, { immediate: true })

const subtitle = computed(() => {
  const f = props.feature
  if (!f) return ''
  const parts = [TYPE_LABELS[f.type] ?? f.type]
  if (Number.isFinite(f.ele)) parts.push(`${Math.round(f.ele)} moh`)
  if (Number.isFinite(f.alongM)) parts.push(`${fmtKm(f.alongM)} ute i turen`)
  return parts.join(' · ')
})

const kulturminne = computed(() => props.feature?.detail?.kulturminne ?? null)
const nveInfo = computed(() => props.feature?.detail?.info ?? null)

function fmtObs(o, unit, digits = 1) {
  if (!o || !Number.isFinite(o.value)) return null
  return `${o.value.toFixed(digits).replace('.', ',')} ${unit}`
}
</script>

<template>
  <transition name="tour3d-card">
    <div v-if="feature"
         class="rounded-xl bg-black/60 backdrop-blur-md text-white p-3 max-w-sm w-full
                border border-white/10 shadow-xl pointer-events-auto">
      <div class="flex items-start gap-2.5">
        <div class="text-2xl leading-none mt-0.5">{{ TYPE_ICONS[feature.type] ?? '📍' }}</div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[14px] leading-tight truncate">{{ feature.name }}</div>
          <div class="text-[11px] text-white/60">{{ subtitle }}</div>

          <div v-if="kulturminne" class="text-[11px] text-white/75 mt-1.5 space-y-0.5">
            <div v-if="kulturminne.art">{{ kulturminne.art }}</div>
            <div v-if="kulturminne.vernetype" class="text-white/55">{{ kulturminne.vernetype }}</div>
          </div>

          <div v-if="feature.detail?.station" class="text-[11px] mt-1.5 space-y-0.5">
            <div v-if="nveLoading" class="text-white/50">Henter siste måling …</div>
            <template v-else-if="nveLatest">
              <div v-if="fmtObs(nveLatest.discharge, 'm³/s')">Vannføring: <span class="tabular-nums">{{ fmtObs(nveLatest.discharge, 'm³/s') }}</span></div>
              <div v-if="fmtObs(nveLatest.waterLevel, 'm', 2)">Vannstand: <span class="tabular-nums">{{ fmtObs(nveLatest.waterLevel, 'm', 2) }}</span></div>
              <div v-if="fmtObs(nveLatest.waterTemp, '°C')">Vanntemp: <span class="tabular-nums">{{ fmtObs(nveLatest.waterTemp, '°C') }}</span></div>
            </template>
            <div v-if="nveInfo?.riverLength" class="text-white/55">{{ feature.detail.station.riverName }}</div>
          </div>
        </div>
        <button @click="emit('skip')"
                aria-label="Fortsett turen"
                class="shrink-0 px-2.5 py-1.5 rounded-full bg-white/15 text-[11px] font-medium
                       active:bg-white/25">
          Videre →
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.tour3d-card-enter-active, .tour3d-card-leave-active { transition: opacity .25s ease, transform .25s ease; }
.tour3d-card-enter-from, .tour3d-card-leave-to { opacity: 0; transform: translateY(8px); }
</style>

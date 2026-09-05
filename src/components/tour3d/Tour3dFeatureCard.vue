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
          <div class="font-semibold text-sm leading-tight truncate">{{ feature.name }}</div>
          <div class="text-[0.6875rem] text-white/78">{{ subtitle }}</div>

          <div v-if="kulturminne" class="text-[0.6875rem] text-white/75 mt-1.5 space-y-0.5">
            <div v-if="kulturminne.art">{{ kulturminne.art }}</div>
            <div v-if="kulturminne.vernetype" class="text-white/75">{{ kulturminne.vernetype }}</div>
          </div>

          <div v-if="feature.detail?.station" class="text-[0.6875rem] mt-1.5 space-y-0.5">
            <div v-if="nveLoading" class="text-white/72">Henter siste måling …</div>
            <template v-else-if="nveLatest">
              <div v-if="fmtObs(nveLatest.discharge, 'm³/s')">Vannføring: <span class="tabular-nums">{{ fmtObs(nveLatest.discharge, 'm³/s') }}</span></div>
              <div v-if="fmtObs(nveLatest.waterLevel, 'm', 2)">Vannstand: <span class="tabular-nums">{{ fmtObs(nveLatest.waterLevel, 'm', 2) }}</span></div>
              <div v-if="fmtObs(nveLatest.waterTemp, '°C')">Vanntemp: <span class="tabular-nums">{{ fmtObs(nveLatest.waterTemp, '°C') }}</span></div>
            </template>
            <div v-if="nveInfo?.riverLength" class="text-white/75">{{ feature.detail.station.riverName }}</div>
          </div>
        </div>
        <!-- Lukk. Het «Videre →» fram til v5.18.0, fra den første 3D-visningen
             der kortene BARE var severdigheter langs en valgt sti og pila
             betydde «gå videre på turen». Nå kommer de fleste kortene av et
             trykk på en nål — der er «videre» meningsløst, og X-en sier det
             den gjør. Handlingen er uendret: et trykket kort lukkes, et
             turstopp hoppes over. -->
        <button @click="emit('skip')"
                aria-label="Lukk"
                class="shrink-0 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center
                       active:bg-white/25">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.tour3d-card-enter-active, .tour3d-card-leave-active { transition: opacity .25s ease, transform .25s ease; }
.tour3d-card-enter-from, .tour3d-card-leave-to { opacity: 0; transform: translateY(8px); }
</style>

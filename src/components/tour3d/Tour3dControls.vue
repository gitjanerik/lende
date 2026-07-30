<script setup>
// Kontrollpanelet: play/pause/restart, avspillingshastighet og kameramodus.
defineProps({
  playing: { type: Boolean, default: false },
  finished: { type: Boolean, default: false },
  timeScale: { type: Number, default: 16 },
  cameraMode: { type: String, default: 'follow' },
})
const emit = defineEmits(['play', 'pause', 'restart', 'set-time-scale', 'set-camera-mode'])

// Ærlige multiplikatorer av sanntid (timeScale = ganger virkelig gangfart).
// 1:1 gir ingen mening for en virtuell tur — 4× til 64× dekker korte kvelds-
// runder så vel som lange fjellturer.
const SPEEDS = [
  { label: '4×', value: 4 },
  { label: '8×', value: 8 },
  { label: '16×', value: 16 },
  { label: '32×', value: 32 },
  { label: '64×', value: 64 },
]
const MODES = [
  { key: 'follow', label: 'Følg' },
  { key: 'flyby', label: 'Flyover' },
  { key: 'free', label: 'Utforsk' },
]
</script>

<template>
  <div class="flex flex-col gap-2 items-center">
    <div class="flex gap-1.5">
      <button v-for="m in MODES" :key="m.key"
              @click="emit('set-camera-mode', m.key)"
              class="px-3 py-1.5 rounded-full text-[12px] font-medium backdrop-blur transition-colors"
              :class="cameraMode === m.key
                ? 'bg-white text-gray-900'
                : 'bg-black/45 text-white/85 active:bg-black/60'">
        {{ m.label }}
      </button>
    </div>

    <div class="flex items-center gap-2">
      <button @click="emit('restart')"
              aria-label="Start på nytt"
              class="w-10 h-10 rounded-full bg-black/45 backdrop-blur text-white/85
                     flex items-center justify-center active:scale-90">
        <svg viewBox="0 0 24 24" class="w-4.5 h-4.5" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
        </svg>
      </button>

      <button @click="emit(playing ? 'pause' : 'play')"
              :aria-label="playing ? 'Pause' : 'Spill av'"
              class="w-14 h-14 rounded-full bg-white text-gray-900 shadow-lg
                     flex items-center justify-center active:scale-95">
        <svg v-if="playing" viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" class="w-6 h-6 ml-0.5" fill="currentColor">
          <path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z"/>
        </svg>
      </button>

      <div class="flex rounded-full bg-black/45 backdrop-blur overflow-hidden">
        <button v-for="s in SPEEDS" :key="s.value"
                @click="emit('set-time-scale', s.value)"
                class="px-1.5 py-2 text-[11px] font-semibold tabular-nums transition-colors"
                :class="timeScale === s.value ? 'bg-white text-gray-900' : 'text-white/75 active:bg-black/60'">
          {{ s.label }}
        </button>
      </div>
    </div>
  </div>
</template>

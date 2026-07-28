<script setup>
import { useRouter } from 'vue-router'
import MapPickerContent from '../components/MapPickerContent.vue'

// Ruten /nytt. Skjemaet ligger i MapPickerContent, som deles med modalen
// hovedmenyens «+» åpner. Ruten består fordi den er inngangen for delte
// kart-lenker (?share=…) — banneret og den låste utsnitts-logikken lever i
// innholdet og leser ruten selv.
const router = useRouter()
</script>

<template>
  <div class="kart-ui relative w-full min-h-[100dvh] flex flex-col bg-app text-ink/90">
    <!-- Toppbar -->
    <div class="relative shrink-0 px-3 py-3 flex items-center justify-between
                bg-surface/80 border-b border-ink/10 z-30">
      <button @click="router.push('/')" aria-label="Tilbake"
              class="rounded-full w-10 h-10 flex items-center justify-center
                     bg-ink/[0.04] border border-ink/10 active:scale-95 transition">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="text-[14px] font-semibold">Nytt turkart</div>
      <div class="w-10 h-10"/>
    </div>

    <MapPickerContent />
  </div>
</template>

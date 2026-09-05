<script setup>
import { useRouter } from 'vue-router'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import AboutContent from '../components/AboutContent.vue'
import TekstStorrelseKnapp from '../components/TekstStorrelseKnapp.vue'

// Full side på ruten /om. Selve innholdet ligger i AboutContent, som deles med
// AboutModal (hovedmenyens «Om appen»). Ruten beholdes for deep-lenker, /about-
// redirecten og fordi den er eager-importert i router.js så den virker offline.
const router = useRouter()
const { uiTextScale } = useUiTextScale()
</script>

<template>
  <div class="kart-ui min-h-screen bg-overlay text-ink">
    <!-- Header med tilbake-knapp (samme drakt som Tegnforklaring). -->
    <header class="sticky top-0 z-10 backdrop-blur bg-overlay/85 border-b border-ink/10">
      <div class="px-4 py-3 flex items-center gap-3">
        <button @click="router.back()" aria-label="Tilbake"
                class="w-9 h-9 rounded-full flex items-center justify-center bg-ink/10
                       text-ink-2 active:scale-95 transition shrink-0">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 class="text-lg font-semibold flex-1">Om Så i lende</h1>
        <TekstStorrelseKnapp />
      </div>
    </header>

    <div class="px-4 py-6 max-w-2xl mx-auto pb-24" :style="{ zoom: uiTextScale }">
      <AboutContent />
    </div>
  </div>
</template>

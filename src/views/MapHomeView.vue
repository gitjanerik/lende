<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import AppMenuButton from '../components/AppMenuButton.vue'
import MapLibrary from '../components/MapLibrary.vue'

// Forsiden. Selve biblioteket (faner, Mine kart, Mine ruter, lag-nytt-flyten)
// ligger i MapLibrary, som deles med modalen hovedmenyen åpner. Her ligger bare
// toppbaren, tekst-skaleringen og speilingen av fanen mot ?tab=kart|rute — så
// delte lenker og hovedmenyens navigasjon lander på riktig fane.
const { uiTextScale } = useUiTextScale()
const route = useRoute()
const router = useRouter()

const activeTab = ref(route.query.tab === 'rute' ? 'rute' : 'kart')
watch(() => route.query.tab, (t) => { if (t === 'rute' || t === 'kart') activeTab.value = t })
// Hold URL-en i takt med fanen, så en refresh (og delte lenker) beholder den.
watch(activeTab, (t) => {
  if ((route.query.tab ?? 'kart') === t) return
  router.replace({ path: '/', query: { ...route.query, tab: t } })
})
</script>

<template>
  <div class="kart-ui relative w-full min-h-[100dvh] bg-app text-ink/90">

    <!-- Toppbar: full bredde som en chrome-stripe, men innholdet sentreres i
         samme 700 px-spalte som panelet under, så hamburgeren og tittelen flukter
         med det. Klebrig: hamburgeren ER inngangen til hovedmenyen på forsiden og
         skal ikke scrolle bort. Bak: diskrete kontur-ringer fra logoen. -->
    <div class="sticky top-0 z-20 relative overflow-hidden
                bg-surface/80 backdrop-blur border-b border-ink/10">
      <svg viewBox="0 0 400 60" preserveAspectRatio="xMinYMin slice" aria-hidden="true"
           class="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <path id="hdr-blob" d="M0,-100 C58,-100 100,-58 97,-4 C94,50 58,99 2,97 C-54,95 -99,52 -97,-2 C-99,-56 -58,-100 0,-100 Z"/>
        </defs>
        <g fill="none" stroke="var(--logo-ring)" stroke-width="1.4" opacity="0.55">
          <use href="#hdr-blob" transform="translate(0,0) scale(0.18)"/>
          <use href="#hdr-blob" transform="translate(0,0) scale(0.34)"/>
          <use href="#hdr-blob" transform="translate(0,0) scale(0.52)"/>
          <use href="#hdr-blob" transform="translate(0,0) scale(0.72)"/>
        </g>
      </svg>
      <div class="relative mx-auto w-full max-w-[700px] px-3 py-2.5 flex items-center gap-2">
        <AppMenuButton variant="header" />
        <div class="flex-1 text-[15px] font-semibold text-ink">Så i lende</div>
      </div>
    </div>

    <!-- Innhold i en midtstilt spalte med samme maksbredde som modalene (700 px)
         — på en bred skjerm strakk listene seg tidligere over hele vinduet, med
         kartnavnet i venstre kant og knappene nesten en halvmeter unna (v2.4.17).
         Siden scroller selv (ingen indre overflow-container), så mobil-nettleserens
         adressefelt oppfører seg normalt. Global tekststørrelse skalerer flaten. -->
    <div class="mx-auto w-full max-w-[700px] px-4 pt-4 pb-32" :style="{ zoom: uiTextScale }">
      <MapLibrary v-model:tab="activeTab" @open-picker="router.push('/nytt')" />
    </div>
  </div>
</template>

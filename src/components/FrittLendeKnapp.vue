<script setup>
import { computed } from 'vue'

// Fritt lendes eneste kontroll. Ett begrep — «hent meg hit» — som bruker det
// billigste midlet situasjonen tillater: panorere hvis mulig, bygge hvis ikke.
//
// Egen komponent og ikke FabCluster med tom `satellites`: den emitter `chat` på
// tap når det ikke finnes knotter (FabCluster.vue).
//
// LANG-TRYKKET ER BORTE (v6.5.27), og det er en KONSEKVENS og ikke en
// forenkling. Det fantes som den ene veien til et nytt ark der man sto, fordi
// tapet aldri fikk bygge innenfor arkkanten. Nå er porten en AVSTAND: over
// 500 m fra senter bygger tapet selv, under den skal ingenting bygge. Da gjør
// et hold nøyaktig det tapet gjør eller nøyaktig ingenting — og en fyllring som
// lover noe nytt og leverer det samme er verre enn ingen ring. Legger du den
// tilbake, må den ha en egen betydning porten ikke alt dekker.
//
// 56 px og ikke appens vanlige 48: dette er den ENESTE kontrollen på skjermen,
// og den brukes med kalde eller behanskede fingre.
const props = defineProps({
  etikett: { type: String, required: true },
  // 'bygg' | 'sentrer' | 'start-gps' | 'start-gps-og-bygg' | 'for-naer' | null
  handling: { type: String, default: null },
  bygger: { type: Boolean, default: false },
  venterPaaFix: { type: Boolean, default: false },
  offline: { type: Boolean, default: false },
})
const emit = defineEmits(['tap'])

// Aksentring når et trykk bygger et nytt ark — knappen skal se annerledes ut
// FØR man trykker, ikke forklare seg etterpå.
const byggerNytt = computed(() => props.handling === 'bygg' || props.handling === 'start-gps-og-bygg')
</script>

<template>
  <button type="button"
          :aria-label="etikett"
          :disabled="bygger"
          @click="!bygger && emit('tap')"
          class="absolute bottom-4 right-4 z-30 w-14 h-14 rounded-full
                 bg-overlay shadow-lg touch-none transition
                 active:scale-95 disabled:opacity-50"
          :class="byggerNytt ? 'ring-2 ring-amber-400' : 'ring-1 ring-ink/15'">
    <!-- Siktekors: prikk, ring og fire streker. Kan et trykk hente et nytt ark,
         får det et pluss-merke, så knappen SIER at den lager noe nytt. -->
    <svg viewBox="0 0 34 34" class="absolute inset-0 m-auto w-7 h-7 text-ink"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         aria-hidden="true">
      <path d="M17 2 V8 M17 26 V32 M2 17 H8 M26 17 H32" />
      <circle cx="17" cy="17" r="7" :class="venterPaaFix ? 'animate-pulse' : ''" />
      <circle v-if="!byggerNytt" cx="17" cy="17" r="2.4" fill="currentColor" stroke="none" />
      <path v-else d="M17 13.5 V20.5 M13.5 17 H20.5" stroke-width="2.4" />
    </svg>

    <!-- Sky med strek: nettleseren sier offline. Et varsel, ikke en sperre —
         brukeren kan vite bedre enn OS-et (portalen ble nettopp løst). -->
    <svg v-if="offline" viewBox="0 0 24 24"
         class="absolute -top-0.5 -right-0.5 w-4 h-4 text-ink/70"
         fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-overlay, #fff)" stroke="none" />
      <path d="M6 15h10a3 3 0 0 0 .4-6A5 5 0 0 0 7.2 9.6" />
      <path d="M4 4 20 20" />
    </svg>
  </button>
</template>

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
// NYTT_KART_M fra senter bygger tapet selv, under den skal ingenting bygge. Da gjør
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
  // Førstegangs-fremheving: knappen er den eneste kontrollen på skjermen, men
  // et siktekors i chrome-grått leses som «vis hvor jeg er» og ikke som «hent
  // et kart». Fram til første trykk står den derfor i Lende-gul med en myk
  // glød, sammen med boblen som peker ned på den.
  fremhev: { type: Boolean, default: false },
})
const emit = defineEmits(['tap'])

// Aksentring når et trykk bygger et nytt ark — knappen skal se annerledes ut
// FØR man trykker, ikke forklare seg etterpå.
const byggerNytt = computed(() => props.handling === 'bygg' || props.handling === 'start-gps-og-bygg')

// Aksenten er logoens egen gul (#ffd84a fra public/icon.svg) og ikke Tailwinds
// amber-400. Ringen og ikonet deler den, for en gul ring rundt et grått merke
// leser som at ringen er et varsel — mens hele knappen i samme farge leser som
// appens knapp. Ett sted, så de to aldri kommer i utakt.
const LENDE_GUL = '#ffd84a'
const aksent = computed(() => (byggerNytt.value || props.fremhev ? LENDE_GUL : 'currentColor'))
const ringStil = computed(() => (byggerNytt.value || props.fremhev
  ? { boxShadow: `0 0 0 2px ${LENDE_GUL}, 0 0 18px -2px ${LENDE_GUL}99` }
  : null))
</script>

<template>
  <button type="button"
          :aria-label="etikett"
          :disabled="bygger"
          @click="!bygger && emit('tap')"
          class="absolute bottom-4 right-4 z-30 w-14 h-14 rounded-full
                 bg-overlay shadow-lg touch-none transition
                 active:scale-95 disabled:opacity-50"
          :class="byggerNytt || fremhev ? '' : 'ring-1 ring-ink/15'"
          :style="ringStil">
    <!-- Siktekors: prikk, ring og fire streker. Kan et trykk hente et nytt ark,
         får det et pluss-merke, så knappen SIER at den lager noe nytt.

         Kurvene mellom sikteringen og krysset (v6.5.31) er logoens motiv i det
         små — to buer som ligger som høydekurver innenfor ringen. De er
         `stroke-linecap="round"` og korte med vilje: et helt kurvesett i 28 px
         blir grøt, mens to buer leses som terreng og gjør merket til Lendes og
         ikke en hvilken som helst siktekors-knapp. -->
    <svg viewBox="0 0 34 34" class="absolute inset-0 m-auto w-7 h-7 text-ink"
         fill="none" :stroke="aksent" stroke-width="2" stroke-linecap="round"
         aria-hidden="true">
      <path d="M17 2 V8 M17 26 V32 M2 17 H8 M26 17 H32" />
      <circle cx="17" cy="17" r="7" :class="venterPaaFix ? 'animate-pulse' : ''" />
      <template v-if="byggerNytt">
        <path d="M17 13.5 V20.5 M13.5 17 H20.5" stroke-width="2.4" />
      </template>
      <template v-else>
        <path d="M13.4 18.6 a4.2 4.2 0 0 1 7.2 -2.6" stroke-width="1.5" opacity="0.75" />
        <circle cx="17" cy="17" r="1.9" :fill="aksent" stroke="none" />
      </template>
    </svg>

    <!-- Sky med strek: nettleseren sier offline. Et varsel, ikke en sperre —
         brukeren kan vite bedre enn OS-et (portalen ble nettopp løst). -->
    <svg v-if="offline" viewBox="0 0 24 24"
         class="absolute -top-0.5 -right-0.5 w-4 h-4 text-ink-2"
         fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-overlay, #fff)" stroke="none" />
      <path d="M6 15h10a3 3 0 0 0 .4-6A5 5 0 0 0 7.2 9.6" />
      <path d="M4 4 20 20" />
    </svg>
  </button>
</template>

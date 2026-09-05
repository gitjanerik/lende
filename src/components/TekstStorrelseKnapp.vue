<script setup>
// Tekststørrelse-knapp for infopanelene (v6.5.43). Ett trykk = neste hakk i
// hovedmenyens egen liste (100/125/150/200), med runding tilbake til 100.
//
// TRE TING SOM MÅ STÅ:
//
// 1. VERDIEN STÅR PÅ KNAPPEN. v2.4.13 fjernet en syklus-knapp nettopp fordi
//    tilstanden var skjult. Tallet på flata er svaret på den innvendingen —
//    fjerner du det, er vi tilbake til en knapp som gjør noe man må gjette.
// 2. SKALAEN ER GLOBAL. `useUiTextScale` er en modulnivå-singleton, så knappen
//    her og segmentbryteren i hovedmenyen skrur på SAMME verdi, og den
//    persisteres. Det er med vilje: den som gjør teksten større i ett panel vil
//    ha den større i neste også.
// 3. NAVNET SKILLER DEN FRA KART-ETIKETTENE. FAB-knotten som skalerer
//    stedsnavn i selve kartet heter «Tekststørrelse på kart-etiketter», og en
//    aria-label som bare het «Tekststørrelse …» kolliderte med den — røyktesten
//    trykket på knotten og målte at ingenting skjedde. Derfor «i grensesnittet».
// 4. KNAPPEN SKALERER IKKE SEG SELV. Den står utenfor tekst-kolonnen som bærer
//    `zoom` (samme regel som lukkeknappen, se ContextMenuSheet), ellers vokser
//    den ut av headeren ved 200 %. Unntaket er 3D-infokortet, der HELE kortet
//    er én zoomet boks — der vokser alt i takt, og det er riktig der.
import { computed } from 'vue'
import { useUiTextScale } from '../composables/useUiTextScale.js'

const props = defineProps({
  // 'lys' = ark/skuff på surface-bakgrunn, 'natt' = 3D-overlegget.
  tema: { type: String, default: 'lys' },
})

const { uiTextScale, cycleTextScale } = useUiTextScale()
const prosent = computed(() => Math.round((uiTextScale.value || 1) * 100))

// Nattvarianten er nakent ikon i 28 px, lik de andre knappene i 3D-kortet;
// lysvarianten er en pille i 32 px, lik lukkeknappen i arkene.
const temaKlasse = computed(() => props.tema === 'natt'
  ? 'h-7 px-1 text-white/55'
  : 'h-8 px-1.5 rounded-full bg-ink/5 border border-ink/10 text-ink/70')
</script>

<template>
  <button type="button"
          @pointerdown.stop
          @click.stop="cycleTextScale()"
          :aria-label="`Tekststørrelse i grensesnittet: ${prosent} prosent — trykk for neste`"
          :title="`Tekststørrelse ${prosent} %`"
          class="shrink-0 flex items-center gap-0.5 active:scale-90 transition"
          :class="temaKlasse">
    <span class="text-[13px] font-semibold leading-none" aria-hidden="true">A</span>
    <span class="text-[9px] font-semibold tabular-nums leading-none" aria-hidden="true">{{ prosent }}</span>
  </button>
</template>

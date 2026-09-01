<script setup>
// Arket i miniatyr, med rutene som bygges blinkende.
//
// Det ENESTE som ble igjen av det automatiske flis-påfyllet (v5.19.0–v6.5.21):
// ikonet var det eneste ved automatikken som var verdt å beholde, og det hadde
// aldri kommet inn i den manuelle utvidelsen — som er den som faktisk bygger
// fliser nå. Rutenettet er arket slik det blir ETTER utvidelsen, klemt til maks
// 2×2, så en stripe vokser som en stripe. Regelen bor i lib/flisIkon.js og er
// ren; her er bare tegningen.
//
// Nord er OPP uansett hvordan kartet er rotert: chipen ligger utenfor kartflaten
// og bærer teksten ved siden av seg, og et roterende ikon ville motsagt den.
import { computed } from 'vue'
import { flisIkonRuter } from '../lib/flisIkon.js'

const props = defineProps({
  // En av EDGE_DIRS, eller null. Null = ukjent retning, og da jobber hele arket.
  retning: { type: String, default: null },
  // Arkets nåværende størrelse i fliser: { cols, rows }.
  ark: { type: Object, default: () => ({ cols: 1, rows: 1 }) },
  // Ferdig-tilstanden: alle ruter fylt i stedet for å blinke.
  klar: { type: Boolean, default: false },
})

const ruter = computed(() =>
  flisIkonRuter(props.retning, props.ark).map(r => ({
    ...r,
    aktiv: !props.klar && r.aktiv,
    fylt: props.klar,
  })))
</script>

<template>
  <svg viewBox="0 0 32 32" class="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
    <template v-for="(r, i) in ruter" :key="r.k">
      <rect v-if="r.aktiv" :x="r.x" :y="r.y" :width="r.w" :height="r.h" rx="1.5"
            :stroke="i % 2 ? '#34d399' : '#7dd3fc'" stroke-width="1.5"
            stroke-dasharray="44" stroke-linecap="round">
        <animate attributeName="stroke-dashoffset" values="44;0" dur="1.6s"
                 :begin="`${(i % 2) * 0.4}s`" repeatCount="indefinite"/>
      </rect>
      <rect v-else :x="r.x" :y="r.y" :width="r.w" :height="r.h" rx="1.5"
            :fill="r.fylt ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'"/>
    </template>
  </svg>
</template>

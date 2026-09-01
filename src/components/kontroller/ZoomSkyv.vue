<script setup>
// Loddrett zoom-skyv med + og − i endene. DESKTOP-ONLY, i både kart og 3D.
//
// HVORFOR DEN FINNES: uten scrollhjul — styreflate, mus uten hjul, en skjerm
// man styrer med tastatur — er det ingen vei inn i kartet i det hele tatt. Pinch
// finnes bare på berøring, og dobbeltklikk zoomer bare INN. Det er samme klasse
// luke som blikk-skyven i 3D lukket: en gest som ikke finnes på maskinen du
// sitter ved.
//
// HVORFOR <input type="range"> OG IKKE ET EGET HÅNDTAK: tastaturstyring,
// aria-verdier og gjentatt-trykk gratis — hele poenget med en
// tilgjengelighetsfiks. Loddrett kommer fra `writing-mode` (Chrome 121+,
// Firefox 120+, Safari 17.4+); faller den tilbake til vannrett i en gammel
// nettleser, virker den fortsatt.
//
// VERDIEN ER EN BRØK 0…1, ikke en skala. Oversettelsen til kartets skala eller
// 3D-ens avstand er LOGARITMISK og bor i lib/navKontroller.js — den er ulik i de
// to visningene, og en skyv som kan begge ville hatt to sannheter om hva den
// viser.
import { computed } from 'vue'

const props = defineProps({
  /** Hvor skyven står nå, 0 = lengst ut, 1 = lengst inn. */
  broek: { type: Number, default: 0 },
  /** Det som vises under skyven — «1,8×» i kartet, «420 m» i 3D. */
  avlest: { type: String, default: '' },
  /** Nattmodus: dempet og rødlig, så den ikke ødelegger mørkeadaptasjonen. */
  natt: { type: Boolean, default: false },
  merkelapp: { type: String, default: 'Zoom' },
})
const emit = defineEmits(['broek', 'steg'])

const STEG = 0.06

const verdi = computed(() => {
  const b = Number.isFinite(props.broek) ? props.broek : 0
  return Math.max(0, Math.min(1, b))
})
const prosent = computed(() => Math.round(verdi.value * 100))

function skyv(e) {
  const v = Number(e.target.value)
  if (Number.isFinite(v)) emit('broek', Math.max(0, Math.min(1, v)))
}
// Knappene går gjennom SAMME brøk som skyven i stedet for å kalle en egen
// zoomIn/zoomOut: to veier inn med hvert sitt stegtall kommer i utakt, og da
// flytter håndtaket seg ulikt alt etter hvordan man zoomet.
function steg(d) {
  emit('broek', Math.max(0, Math.min(1, verdi.value + d * STEG)))
}
</script>

<template>
  <div class="flex flex-col items-center gap-1 select-none" :class="natt ? 'natt' : ''">
    <button type="button" class="zoom-knapp" @click="steg(1)"
            :aria-label="`${merkelapp} inn`">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>
    <input type="range" min="0" max="1" step="0.005" :value="verdi" @input="skyv"
           class="zoom-skyv" :aria-label="merkelapp"
           :aria-valuetext="avlest || `${prosent} %`"/>
    <button type="button" class="zoom-knapp" @click="steg(-1)"
            :aria-label="`${merkelapp} ut`">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>
    </button>
    <span v-if="avlest" class="avlest tabular-nums">{{ avlest }}</span>
  </div>
</template>

<style scoped>
/* Loddrett med de STORE verdiene ØVERST — inn er opp, som på et hvilket som
   helst kart. `direction: rtl` snur aksen. */
.zoom-skyv {
  writing-mode: vertical-rl;
  direction: rtl;
  width: 1.25rem;
  height: 6.5rem;
  accent-color: var(--skyv-farge, #38bdf8);
  background: transparent;
  cursor: ns-resize;
  /* Loddrett drag på selve skyven hører til skyven, ikke til kartet under. */
  touch-action: none;
}
.zoom-knapp {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  color: var(--knapp-farge, currentColor);
  opacity: 0.75;
}
.zoom-knapp:hover { opacity: 1; background: color-mix(in srgb, currentColor 14%, transparent); }
.avlest {
  font-size: 0.5625rem;
  line-height: 1;
  opacity: 0.6;
}
/* Rødt lys ødelegger mørkeadaptasjonen minst — samme regel som himmelkompasset. */
.natt .zoom-skyv { accent-color: #ff6b5a; opacity: 0.75; }
.natt { color: #fca5a5; }
</style>

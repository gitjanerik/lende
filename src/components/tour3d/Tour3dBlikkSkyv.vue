<script setup>
// Skyveknappen som løfter blikket, på høyre kant. DESKTOP-ONLY.
//
// HVORFOR DEN FINNES, og det er en ekte luke og ikke en pynt: himmelvippen —
// måten man ser opp i himmelen — drives av et DRAG. På desktop er venstre
// museknapp satt om til panorering (`mouseButtons` i freeRig), så bare HØYRE
// knapp roterer, og ingenting på skjermen sier det. Uten en kontroll kan man
// altså ikke løfte blikket til stjernehimmelen i det hele tatt med mus.
// Gjelder ALL 3D-visning, ikke bare natt.
//
// HVORFOR IKKE BARE GJØRE VENSTRE KNAPP TIL ROTASJON: panoreringen er valgt med
// vilje — man flytter seg over kartet mer enn man snur seg. Å bytte om ville
// løst dette og brutt noe folk alt har i fingrene.
//
// HVORFOR EN <input type="range"> OG IKKE ET EGET HÅNDTAK: den gir
// tastaturstyring, aria-verdier og gjentatt-trykk gratis, og det er hele poenget
// med en tilgjengelighetsfiks. Loddrett retning kommer fra `writing-mode`, som
// er den moderne veien (Chrome 121+, Firefox 120+, Safari 17.4+); faller den
// tilbake til vannrett i en gammel nettleser, virker den fortsatt.
import { computed } from 'vue'

const props = defineProps({
  /** Blikkets høyde nå, i grader over horisonten. */
  hoyde: { type: Number, default: 0 },
  /** Området riggen faktisk kan levere — les blikkHoydeGrenser i freeRig. */
  min: { type: Number, default: -1 },
  maks: { type: Number, default: 74 },
  /** Nattmodus: dempet og rødlig, så den ikke ødelegger mørkeadaptasjonen. */
  natt: { type: Boolean, default: false },
})
const emit = defineEmits(['hoyde'])

const verdi = computed(() => {
  const h = Number.isFinite(props.hoyde) ? props.hoyde : 0
  return Math.round(Math.max(props.min, Math.min(props.maks, h)))
})

function skyv(e) {
  const v = Number(e.target.value)
  if (Number.isFinite(v)) emit('hoyde', v)
}

const lest = computed(() => `Blikkets høyde: ${verdi.value}° over horisonten`)
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-center gap-1 select-none">
    <!-- Senit oppe, horisont nede: samme retning som blikket faktisk går, så
         håndtaket peker dit man ser. -->
    <span class="text-[0.5625rem] leading-none"
          :class="natt ? 'text-red-300/45' : 'text-white/45'" aria-hidden="true">☆</span>
    <input type="range" :min="min" :max="maks" step="1" :value="verdi"
           @input="skyv" :aria-label="lest" :aria-valuetext="`${verdi} grader`"
           class="blikk-skyv" :class="natt ? 'natt' : ''"/>
    <span class="text-[0.5625rem] leading-none"
          :class="natt ? 'text-red-300/45' : 'text-white/45'" aria-hidden="true">⌒</span>
    <span class="text-[0.5625rem] tabular-nums leading-none"
          :class="natt ? 'text-red-300/70' : 'text-white/60'">{{ verdi }}°</span>
  </div>
</template>

<style scoped>
/* Loddrett, med de STORE verdiene ØVERST. `writing-mode` er den moderne veien;
   `direction: rtl` snur aksen så maks havner oppe. */
.blikk-skyv {
  writing-mode: vertical-rl;
  direction: rtl;
  width: 1.5rem;
  height: 9rem;
  accent-color: #cbd5e1;
  background: transparent;
  cursor: ns-resize;
  /* Loddrett drag på selve knappen hører til knappen, ikke til 3D-lerretet. */
  touch-action: none;
}
.blikk-skyv.natt {
  /* Rødt lys ødelegger mørkeadaptasjonen minst — samme regel som kompasset. */
  accent-color: #ff6b5a;
  opacity: 0.75;
}
</style>

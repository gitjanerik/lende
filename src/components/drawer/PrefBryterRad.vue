<script setup>
// ÉN RAD MED ÉN VIPPEBRYTER (v7.8.35) — formen alle preferansene deler.
//
// Fana hadde tre rader med identisk markup og én knapp som så helt annerledes
// ut: himmel-tvangen var en full-bredde flate med etiketten «Tvungne
// himmellegemer i 3D: PÅ» og en forklaring som bare sto når den var på. Den var
// arvet fra Utvikler-fana, der alt er slike flater, og i en liste med
// vippebrytere leses den som noe annet enn den er.
//
// Nå er raden en komponent, så «samme utforming» er STRUKTURELT og ikke en
// konvensjon man må huske: seks rader, én mal. Kommer det en syvende
// preferanse, er den en instans her.
//
// FORKLARINGEN STÅR ALLTID. En tekst som bare finnes når bryteren er på kan
// ikke leses FØR man bestemmer seg, altså nøyaktig når man trenger den — og
// raden hopper i høyde hvert trykk.
defineProps({
  tittel: { type: String, required: true },
  /** aria-label NÅR bryteren er på (beskriver hva et trykk gjør). */
  ariaAv: { type: String, default: '' },
  /** aria-label NÅR bryteren er av. */
  ariaPa: { type: String, default: '' },
})
const pa = defineModel({ type: Boolean, default: false })
</script>

<template>
  <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
    <div class="flex-1 min-w-0">
      <div class="text-[13px] text-ink font-medium">{{ tittel }}</div>
      <div class="text-[11px] text-ink-3 leading-snug">
        <slot />
      </div>
    </div>
    <button type="button" role="switch" :aria-checked="pa"
            @click="pa = !pa"
            :aria-label="pa ? (ariaAv || `Slå av: ${tittel}`) : (ariaPa || `Slå på: ${tittel}`)"
            class="relative w-11 h-6 rounded-full transition-colors shrink-0"
            :class="pa ? 'bg-emerald-500' : 'bg-ink/15'">
      <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
            :class="pa ? 'left-5' : 'left-0.5'" />
    </button>
  </div>
</template>

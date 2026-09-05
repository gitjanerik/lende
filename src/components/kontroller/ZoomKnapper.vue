<script setup>
/**
 * Zoom (og eventuelt «nord opp») som TRYKK, for berøringsflater.
 *
 * WCAG 2.5.2 krever at alt som kan gjøres med en fleirpunkts-gest også kan
 * gjøres med én peker, og på en telefon fantes zoom bare som pinch og rotasjon
 * bare som to-finger-vri. Vi tar bevisst ikke inn desktop-søyla (ZoomSkyv +
 * RetningsRose): de er kontinuerlige kontroller man sikter på med en musepeker,
 * mens det som mangler på en telefon er tre trykk.
 *
 * Delt av kart-visningen og Fritt lende. Fritt lende har ingen rotasjon —
 * uten `azimut` faller nord-knappen bort av seg selv, i stedet for at hver
 * kaller får sin egen kopi av pilla.
 */
const props = defineProps({
  // Zoomens plass i sitt eget område, 0…1. Kalleren eier grensene.
  broek: { type: Number, required: true },
  // Kartets rotasjon i grader, eller null når modusen ikke roterer.
  azimut: { type: Number, default: null },
})
const emit = defineEmits(['broek', 'nord'])

// Ett hakk er det samme som pluss/minus fra tastaturet i MapView.
const STEG = 0.12
const steg = (d) => emit('broek', Math.min(1, Math.max(0, props.broek + d)))
</script>

<template>
  <div class="flex flex-col items-center gap-1 p-1 rounded-2xl
              bg-overlay/95 shadow-lg select-none text-ink-2">
    <button type="button" aria-label="Zoom inn" @click="steg(STEG)"
            class="w-10 h-10 grid place-items-center rounded-full active:bg-ink/10">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>
    <span class="w-6 h-px bg-ink/15"></span>
    <button type="button" aria-label="Zoom ut" @click="steg(-STEG)"
            class="w-10 h-10 grid place-items-center rounded-full active:bg-ink/10">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>
    </button>
    <!-- Nord-knappen står bare når kartet FAKTISK er dreid — ellers er den en
         knapp som ikke gjør noe. -->
    <template v-if="azimut">
      <span class="w-6 h-px bg-ink/15"></span>
      <button type="button" :aria-label="`Vend kartet mot nord. Nå ${azimut} grader.`"
              @click="emit('nord')"
              class="w-10 h-10 grid place-items-center rounded-full active:bg-ink/10">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
             :style="{ transform: `rotate(${-azimut}deg)` }">
          <circle cx="12" cy="12" r="9"/>
          <polygon points="12 5 14 12 12 13 10 12" fill="currentColor"/>
          <polygon points="12 19 14 12 12 11 10 12"/>
        </svg>
      </button>
    </template>
  </div>
</template>

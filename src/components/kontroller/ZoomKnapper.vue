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
  // HVOR NORD LIGGER PÅ SKJERMEN, i grader med klokka — samme kontrakt som
  // RetningsRose og kompass-FAB-en leser, og samme verdi (`rotationSliderDeg`).
  // Null når modusen ikke roterer; da faller nord-knappen bort.
  azimut: { type: Number, default: null },
})
const emit = defineEmits(['broek', 'nord'])

// Ett hakk er det samme som pluss/minus fra tastaturet i MapView.
const STEG = 0.12
const steg = (d) => emit('broek', Math.min(1, Math.max(0, props.broek + d)))
</script>

<template>
  <!-- KOMPASSET STÅR UTENFOR PILLA, OG DET ER ALLTID SYNLIG (v6.5.66).
       To ting fulgte av at det lå som en tredje knapp i zoom-pilla bak
       `v-if="azimut"`: det dukket opp og forsvant under fingeren — pilla
       skiftet høyde i det kartet ble dreid — og det leste som en tredje
       zoom-knapp. Nå er pluss/minus alene og uforandret, og kompasset er en
       egen knapp med luft imellom. Den er den ENESTE kompassnåla i kartet fra
       v6.5.66; FAB-ens knott bærer et rewind-ikon og er ikke lenger en andre
       vei til nord. -->
  <div class="flex flex-col items-center gap-3">
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
    </div>

    <!-- Nåla er FAB-ens gamle nål: rød spiss mot nord. Flata er `surface-2`
         fordi tokenet ER hvit i lyst tema og grå i mørkt — én klasse i stedet
         for to farger som må holdes i takt.

         NÅLA ROTERES MED `azimut` OG IKKE MOT DEN (v6.5.62). Fortegnet sto
         snudd her fra v6.5.48, så denne nåla og kompass-FAB-ens pekte hver sin
         vei så snart kartet var dreid — speilet om loddrett, altså like på et
         ark i hvile og mest galt på 90°. `azimut` ER skjermvinkelen til nord, så
         et ikon som peker opp i hvile skal roteres MED den; RetningsRose gjør
         det samme med sin skive. -->
    <button v-if="azimut !== null" type="button"
            :aria-label="`Vend kartet mot nord. Nå ${azimut} grader.`"
            @click="emit('nord')"
            class="w-11 h-11 grid place-items-center rounded-full select-none
                   bg-surface-2/80 backdrop-blur shadow-lg text-ink-2
                   active:bg-surface-2">
      <svg viewBox="-50 -50 100 100" class="w-7 h-7" aria-hidden="true"
           :style="{ transform: `rotate(${azimut}deg)`, transition: 'transform 0.2s linear' }">
        <circle r="44" fill="none" stroke="currentColor" stroke-width="4" opacity="0.35"/>
        <polygon points="0,-40 10,0 0,12 -10,0" fill="#ef4444"/>
        <polygon points="0,40 10,0 0,-12 -10,0" fill="currentColor" opacity="0.85"/>
      </svg>
    </button>
  </div>
</template>

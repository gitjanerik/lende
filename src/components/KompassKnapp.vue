<script setup>
// Kompassnåla som fristilt knapp i kartets NEDRE HØYRE hjørne (v7.8.4).
//
// HISTORIKKEN ER KORT OG VERDT Å KJENNE, for nåla har flyttet tre ganger og
// hver flytting rettet noe konkret: den var en FAB (til v1.0.77), en fast
// knapp i snarvei-raden (til v7.3.0), og så nede til VENSTRE over linjalen
// (v7.3.2–v7.8.3). Det siste stedet var riktig i seg selv, men det etterlot
// venstre kant med to ting som vokser med tekststørrelsen — nåla og linjalens
// meterangivelse — mens høyre kant hadde ÉN knapp og ellers ingenting.
// Eieren ba den over: nåla står nå RETT OVER Lende-knappen, som én kolonne
// runde knapper i tommelens rekkevidde. Er chatten ikke aktivert, finnes ikke
// den knappen, og nåla blir stående alene nederst til høyre.
//
// TO BOKSER, OG SKILLET ER `zoom` — samme grep som i FabCluster, og av samme
// grunn: `zoom` skalerer et elements EGNE offsets, så en `bottom` fra
// useFloatAboveSheets ville blitt dobbelt så høy ved 200 %. Den ytre boksen
// bærer plasseringen i ekte skjermpiksler, den indre bærer zoomen, forankret i
// hjørnet så knappen vokser OPP og INN.
import { computed } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Hvor nord ligger på skjermen, i grader med klokka. */
  azimut: { type: Number, default: 0 },
  /** Er KARTET mørkt? Ikke UI-temaet — skiva ligger rett på arket. */
  mork: { type: Boolean, default: false },
  uiTextScale: { type: Number, default: 1 },
  /** Bunnlinja, delt med Lende-FAB-en og linjalen (useFloatAboveSheets). */
  bottom: { type: String, default: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' },
  rightStyle: { type: Object, default: () => ({ right: '12px' }) },
  /**
   * Står Lende-knappen under? Da løftes nåla en knapphøyde pluss luft. Høyden
   * er 3rem (48 px) GANGET MED TEKSTSKALAEN, fordi den knappen bærer `zoom`
   * og faktisk er 96 px høy ved 200 % — et fast tall ville lagt nåla midt oppå
   * den på nøyaktig den innstillingen som trenger plassen mest.
   */
  overChat: { type: Boolean, default: false },
})
defineEmits(['nord'])

// Skiva og blekket fra v6.5.67. Alfaen er ikke pynt: en ugjennomsiktig skive
// blir en klistrelapp på kartet, og nåla skal leses som en del av arket.
const skive = computed(() => (props.mork ? 'rgba(63,63,70,0.82)' : 'rgba(255,255,255,0.82)'))
const blekk = computed(() => (props.mork ? '#e4e4e7' : '#1c1917'))

const bunn = computed(() => (props.overChat
  ? `calc(${props.bottom} + 3rem * ${props.uiTextScale || 1} + 0.5rem)`
  : props.bottom))
</script>

<template>
  <div v-if="visible"
       class="absolute z-40 w-12 h-12 pointer-events-none select-none
              transition-[bottom,right] duration-200"
       :style="{ ...rightStyle, bottom: bunn }">
    <div class="absolute bottom-0 right-0 w-12 h-12" :style="{ zoom: uiTextScale }">
      <button type="button" @click="$emit('nord')"
              data-kompass-knapp
              class="pointer-events-auto w-12 h-12 rounded-full grid place-items-center
                     select-none active:scale-95 transition-transform"
              :style="{ background: skive, color: blekk,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }"
              :aria-label="`Vend kartet mot nord. Nå ${Math.round(azimut)} grader.`">
        <SnarveiIkon id="kompass" class="w-8 h-8"
                     :style="{ transform: `rotate(${azimut}deg)`,
                               transition: 'transform 0.2s linear' }" />
      </button>
    </div>
  </div>
</template>

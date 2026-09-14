<script setup>
// Kompassnåla som fristilt knapp i kartets NEDRE HØYRE HJØRNE (v7.8.17).
//
// HISTORIKKEN ER KORT OG VERDT Å KJENNE, for nåla har flyttet fire ganger og
// hver flytting rettet noe konkret: den var en FAB (til v1.0.77), en fast
// knapp i snarvei-raden (til v7.3.0), og så nede til VENSTRE over linjalen
// (v7.3.2–v7.8.3). Det siste stedet var riktig i seg selv, men det etterlot
// venstre kant med to ting som vokser med tekststørrelsen — nåla og linjalens
// meterangivelse — mens høyre kant hadde ÉN knapp og ellers ingenting. Nåla
// gikk derfor over og la seg RETT OVER Lende-knappen (v7.8.4).
//
// LØFTET ER BORTE IGJEN (v7.8.17), OG DET ER IKKE EN ANGRING AV v7.8.4.
// `overChat` løftet nåla en knapphøyde pluss luft — «3rem × tekstskalaen»,
// fordi Lende-knappen bærer `zoom` og faktisk er 96 px høy ved 200 %. Den
// knappen finnes ikke lenger i turkartet: chatten er en snarvei i raden, og
// hjørnet er nålas alene. Et løft over ingenting er en nål som svever, så
// propen er slettet framfor å stå igjen på `false` hos hver kaller.
// Kommer det en ny fast knapp i hjørnet, er løftet ni linjer å skrive om
// igjen — og det er billigere enn en prop ingen vet hvorfor er der.
//
// TO BOKSER, OG SKILLET ER `zoom` — samme grep som i FabCluster, og av samme
// grunn: `zoom` skalerer et elements EGNE offsets, så en `bottom` fra
// useFloatAboveSheets ville blitt dobbelt så høy ved 200 %. Den ytre boksen
// bærer plasseringen i ekte skjermpiksler, den indre bærer zoomen, forankret i
// hjørnet så knappen vokser OPP og INN.
import { computed } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { kartSkive, kartBlekk } from '../lib/kartFlate.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Hvor nord ligger på skjermen, i grader med klokka. */
  azimut: { type: Number, default: 0 },
  /** Er KARTET mørkt? Ikke UI-temaet — skiva ligger rett på arket. */
  mork: { type: Boolean, default: false },
  uiTextScale: { type: Number, default: 1 },
  /** Bunnlinja, delt med linjalen nede til venstre (useFloatAboveSheets). */
  bottom: { type: String, default: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' },
  rightStyle: { type: Object, default: () => ({ right: '12px' }) },
})
defineEmits(['nord'])

// Skiva og blekket fra v6.5.67. Alfaen er ikke pynt: en ugjennomsiktig skive
// blir en klistrelapp på kartet, og nåla skal leses som en del av arket.
//
// VERDIENE BOR I `lib/kartFlate.js` FRA v7.8.18, ikke her. Snarvei-raden rett
// over bruker nå det samme paret, og to flater som ligger side om side over
// det samme arket kan ikke ha hver sin kopi av fargen — det var nettopp slik
// de spriket før (raden fulgte UI-temaet, nåla følger ARKET).
const skive = computed(() => kartSkive(props.mork))
const blekk = computed(() => kartBlekk(props.mork).ink)
</script>

<template>
  <div v-if="visible"
       class="absolute z-40 w-12 h-12 pointer-events-none select-none
              transition-[bottom,right] duration-200"
       :style="{ ...rightStyle, bottom }">
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

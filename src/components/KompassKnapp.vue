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
import { useLongPress } from '../composables/useLongPress.js'
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
  /**
   * Zoomer et VANLIG trykk ut til hele arket? Styrer bare teksten i
   * aria-label — knappen gjør ingen av de to selv, den sier hvilken av dem
   * trykket var (`motsatt`) og lar MapView avgjøre hva det betyr.
   */
  zoomUt: { type: Boolean, default: false },
})
const emit = defineEmits(['nord'])

// LANG-TRYKK GJØR DET MOTSATTE AV ET TRYKK (v7.8.35). Knappen har to
// oppførsler — vend mot nord, og vend mot nord OG zoom ut til hele arket — og
// hvilken av dem som er STANDARD er en innstilling i Preferanser. Den andre
// var dermed fire trykk unna: åpne skuffa, finn fana, vipp bryteren, tilbake.
// Holdet er snarveien til den, uten å endre innstillingen.
//
// KNAPPEN VET IKKE HVA DE TO ER, og det er med vilje: den sier bare om trykket
// var det vanlige eller det motsatte. Regelen for hva «motsatt» betyr bor der
// innstillingen bor (MapView + useKompassNord), så knappen kan ikke komme i
// utakt med den.
const press = useLongPress({
  onTap: () => emit('nord', { motsatt: false }),
  onHold: () => emit('nord', { motsatt: true }),
})

// Ring som fyller seg over hold-terskelen — samme grep, samme gule, som
// FAB-ankeret og knottene. Uten den er et hold en gest ingen seende bruker kan
// finne, og «registrerte den?» et spørsmål uten svar. Radiusen er i knappens
// eget 48-koordinatrom.
const RING_R = 22
const RING_C = 2 * Math.PI * RING_R
const ringOffset = computed(() => RING_C * (1 - press.holdProgress.value))

// TASTATUR. Knappen er peker-drevet for å skille tap fra hold, og da gjør
// Enter og mellomrom ingenting av seg selv (SC 2.1.1) — samme luke FabCluster
// lukket i v6.5.48. `@click` kan ikke brukes: et lang-trykk med musa sender
// også click ved slipp, og tapet ville fyrt oppå holdet.
function onKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
  e.preventDefault()   // mellomrom ruller sida
  emit('nord', { motsatt: false })
}
// Holdets tastatur-ekvivalent, som på knottene: Meny-tasten / Shift+F10, som
// nettleseren sender som `contextmenu`. Uten den er den motsatte handlingen
// utilgjengelig fra tastatur.
function onContextMenu(e) {
  e.preventDefault()
  emit('nord', { motsatt: true })
}

// Etiketten sier hva HVERT av de to trykkene gjør, og i hvilken rekkefølge.
// Den leses av den som ikke ser kartet skifte, og den er den ene dokumentasjonen
// holdet har.
const lest = computed(() => {
  const kort = props.zoomUt
    ? 'Vend kartet mot nord og zoom ut til hele arket'
    : 'Vend kartet mot nord'
  const lang = props.zoomUt
    ? 'Hold inne for å vende mot nord uten å zoome.'
    : 'Hold inne for å zoome ut til hele arket samtidig.'
  return `${kort}. Nå ${Math.round(props.azimut)} grader. ${lang}`
})

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
      <button type="button"
              @pointerdown="press.onPointerDown"
              @pointermove="press.onPointerMove"
              @pointerup="press.onPointerUp"
              @pointercancel="press.onPointerCancel"
              @keydown="onKeydown"
              @contextmenu="onContextMenu"
              data-kompass-knapp
              class="relative pointer-events-auto w-12 h-12 rounded-full grid place-items-center
                     select-none active:scale-95 transition-transform
                     touch-none [-webkit-touch-callout:none]"
              :style="{ background: skive, color: blekk,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }"
              :aria-label="lest">
        <SnarveiIkon id="kompass" class="w-8 h-8 pointer-events-none"
                     :style="{ transform: `rotate(${azimut}deg)`,
                               transition: 'transform 0.2s linear' }" />
        <svg v-if="press.isHolding.value" viewBox="0 0 48 48"
             class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <circle cx="24" cy="24" :r="RING_R" fill="none" stroke="#ffd84a" stroke-width="3"
                  stroke-linecap="round" :stroke-dasharray="RING_C"
                  :stroke-dashoffset="ringOffset" transform="rotate(-90 24 24)"/>
        </svg>
      </button>
    </div>
  </div>
</template>

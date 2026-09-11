<script setup>
// Linjal + OSM-kreditt nederst til venstre i kartet, skilt ut fra MapView
// v1.0.8. Rent presentasjonelt — skala-utregningen (candidate-step-algoritmen)
// blir i forelderen som eier wrapper-målingen.
//
// v2.4.20: boksen er BARE linjalen. Print-målestokken og ekvidistansen var to
// faste tekstlinjer som gjorde den nesten tre ganger så høy for tall du leser
// én gang, ikke mens du går — de står nå øverst i punkt-skuffen, og i kolofonen
// på eksporterte kart (se lib/mapColophon.js).
//
// v2.4.26: attribusjons-boksen nede til høyre er borte. ISOM-variant, DEM-kilde
// og dybde-provenens er oppslags-fakta, ikke noe du leser mens du går — de står
// i punkt-skuffen sammen med målestokk og ekvidistanse. Selve ODbL-kreditten må
// stå på kartet, og ligger nå som en linje under linjalen.
// v6.5.0: valgfri ekvidistanse-linje for Fritt lende, som ikke har en
// punkt-skuffe å legge tallet i.
//
// v6.5.27: linja bærer AVSTAND FRA SENTER i stedet, og bare når en posisjon er
// kjent. Ekvidistansen er fast 10 m i den modusen og leses én gang; avstanden er
// tallet man trenger MENS man går, fordi det er det som sier når arket tar slutt
// og et nytt utsnitt er tilgjengelig. Begge prop-ene er valgfrie, så MapView er
// uendret.
//
// `avstandNaadd` er en TILSTAND og ikke en farge på kallstedet: linjalen eier
// sitt eget uttrykk, og porten (NYTT_KART_M) bor i lib/frittLende.js.
//
// v7.3.0: KOMPASSET BOR HER. Det sto som en fast knapp i snarvei-raden (med
// posisjonen) foran en skillestrek, og var den ene tingen som gjorde radens
// knapper ulikeverdige. Her hører det bedre hjemme: nede til venstre der
// tommelen er, sammen med avstanden — og det koster ingen plass i raden.
// Nåla har ingen etikett: den peker mot nord, og en rød nordende er
// selvforklarende der ordet «Nord» bare er støy.
//
// v7.3.2: NÅLA ER FRISTILT IGJEN — den står PÅ KARTET, ikke inne i den mørke
// linjal-boksen. Inne i boksen måtte de to dele høyde: en 44 px trykkflate
// gjorde hele avlesningen dobbelt så høy for noe man leser i et øyekast, og
// skillestreken var et element til. Nåla har derfor tilbake sin egen skive fra
// v6.5.67 — halvgjennomsiktig hvit (mørk grå på et mørkt ark), så kartet
// skinner svakt gjennom og knappen ikke blir en klistrelapp.
//
// v7.6.0: NÅLA STÅR PÅ RADEN OVER LINJALEN, OG LINJALEN HELT TIL VENSTRE.
// De sto side om side på samme bunnlinje, og det holdt så lenge begge var faste
// i størrelse. Fra v7.6.0 følger kompass-knappen tekststørrelsen — et ikon
// «leses» som tekst, og ved 200 % er nåla 96 px bred — mens linjalen samtidig
// vokser med sin egen meterangivelse. Side om side ville de to spist bredden av
// hverandre og dyttet linjalen inn mot midten av kartet, der man ikke leser den.
// Stablet har hver sin fulle bredde, og linjalen begynner der venstrekanten er.
//
// Kolonnen er `items-start`, og BUNNEN KOMMER UTENFRA (v7.7.6): kallstedet
// sender inn den SAMME `bottom` som Lende-FAB-en får, fra én
// `useFloatAboveSheets`. Fram til nå hadde boksen en fast bunn her — riktig
// nok FAB-ens egen hvilebunn (`safe-area-inset-bottom + 0.75rem`) og ikke en
// naken `bottom-3`, så de to sto likt i ro — men et minimert bunn-ark løftet
// bare FAB-en, og kompass-nåla ble liggende halvt bak arkets peek-kant. To
// knapper i samme kant som svarer ulikt på det samme arket leses som en feil i
// den ene. Defaulten er den gamle verdien, så komponenten står riktig alene.
//
// TEKSTSTØRRELSEN GJELDER TALLENE, IKKE KREDITTEN (v7.6.0). Målestokken og
// avstanden er det man leser mens man går, og de skalerer med hovedmenyens
// 100/125/150/200. ODbL-kreditten står der fordi lisensen krever det, ikke
// fordi noen leser den — en linje som vokser til 18 px ville tatt plassen fra
// nettopp tallene den står under. Selve LINJALSTREKEN skalerer heller ikke:
// den er en MÅLESTOKK, altså en fysisk lengde på skjermen som svarer til
// `scaleBar.label` meter i terrenget, og en zoomet strek ville løyet om
// avstanden.
//
// Kolonnen er `pointer-events-none` fordi den er en avlesning; kompass-knappen
// tar derfor sin egen `pointer-events-auto`.
import { computed } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  scaleBar: { type: Object, default: () => ({ px: 0, ticks: [], label: '' }) },
  avstandTekst: { type: String, default: '' },
  avstandNaadd: { type: Boolean, default: false },
  // Kompasset: `azimut` er hvor nord ligger på skjermen, i grader med klokka.
  // `kompass` er porten — uten rotasjon (desktop har retningsrosa i søyla)
  // finnes det ingen retning å nullstille.
  kompass: { type: Boolean, default: false },
  azimut: { type: Number, default: 0 },
  // Er KARTET mørkt? Ikke UI-temaet — skiva ligger rett på arket, så det er
  // arkets valør den må lese mot (samme kontrakt som NavKnapper hadde).
  mork: { type: Boolean, default: false },
  // Hovedmenyens 100/125/150/200. Se filhodet for hva den gjelder og ikke.
  uiTextScale: { type: Number, default: 1 },
  // Bunnlinja, delt med Lende-FAB-en — se filhodet.
  bottom: { type: String, default: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' },
})
defineEmits(['nord'])

// Skiva og blekket fra v6.5.67. Alfaen er ikke pynt: en ugjennomsiktig skive
// blir en klistrelapp på kartet, og nåla skal leses som en del av arket.
const skive = computed(() => (props.mork ? 'rgba(63,63,70,0.82)' : 'rgba(255,255,255,0.82)'))
const blekk = computed(() => (props.mork ? '#e4e4e7' : '#1c1917'))
</script>

<template>
  <!-- Skjult under aktivt søk så den ikke ligger under treff-listen. -->
  <div v-if="visible"
       class="absolute left-3 z-20 pointer-events-none flex flex-col items-start gap-2
              transition-[bottom] duration-200"
       :style="{ bottom }">
    <!-- FRISTILT NÅL PÅ EGEN SKIVE (v7.3.2), på RADEN OVER LINJALEN fra v7.6.0.
         48 px som resten av kart-knappene, og `place-items-center` fordi ikonet
         er kvadratisk i en sirkel. `zoom` og ikke en større `w-*`: et ikon leses
         som tekst, og da skal det følge tekststørrelsen som all annen chrome. -->
    <button v-if="kompass" type="button" @click="$emit('nord')"
            data-kompass-knapp
            class="pointer-events-auto shrink-0 w-12 h-12 rounded-full grid place-items-center
                   select-none active:scale-95 transition-transform"
            :style="{ background: skive, color: blekk, zoom: uiTextScale,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }"
            :aria-label="`Vend kartet mot nord. Nå ${Math.round(azimut)} grader.`">
      <SnarveiIkon id="kompass" class="w-8 h-8"
                   :style="{ transform: `rotate(${azimut}deg)`,
                             transition: 'transform 0.2s linear' }" />
    </button>
    <div class="flex items-stretch gap-2 px-3 py-1.5 rounded-lg bg-overlay text-ink
                text-[11px] font-medium shadow-lg">
      <div class="min-w-0">
        <!-- STREKEN ER EN FYSISK LENGDE og står utenfor zoomen; bare tallet
             ved siden av den skalerer. Derfor ligger `zoom` på etiketten og
             ikke på raden de to deler. -->
        <div v-if="scaleBar.px > 0" class="flex items-end gap-2">
          <!-- currentColor, ikke hardkodet hvit: bakgrunnen (bg-overlay) er hvit i
               lyst tema, der en hvit linjal var usynlig. -->
          <svg :width="scaleBar.px" height="14" class="overflow-visible text-ink shrink-0">
            <line x1="0" y1="6" :x2="scaleBar.px" y2="6" stroke="currentColor" stroke-width="2"/>
            <g v-for="(t, i) in scaleBar.ticks" :key="i">
              <line :x1="t.px" y1="2" :x2="t.px" y2="10" stroke="currentColor"
                    :stroke-width="i === 0 || i === scaleBar.ticks.length - 1 ? 2 : 1"/>
            </g>
          </svg>
          <div data-linjal-meter :style="{ zoom: uiTextScale }">{{ scaleBar.label }}</div>
        </div>
        <!-- Tabulære siffer: tallet oppdateres hvert tredje sekund, og med
             proporsjonale siffer flytter hele linja seg for hver 1 som blir en 8. -->
        <div v-if="avstandTekst" :style="{ zoom: uiTextScale }"
             class="text-[10px] leading-tight font-normal [font-variant-numeric:tabular-nums]"
             :class="avstandNaadd ? 'text-amber-200 font-semibold' : ''">
          {{ avstandTekst }}
        </div>
        <!-- KREDITTEN SKALERER IKKE (v7.6.0) — se filhodet. -->
        <div data-osm-kreditt class="text-[9px] leading-tight font-normal text-ink-3">
          © OpenStreetMap-bidragsytere
        </div>
      </div>
    </div>
  </div>
</template>

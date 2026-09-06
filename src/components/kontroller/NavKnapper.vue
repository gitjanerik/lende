<script setup>
/**
 * Posisjon og «nord opp» som to trykk, rett på arket.
 *
 * Het ZoomKnapper til v6.5.68 og bar da også en pille med pluss og minus. Den
 * kom inn etter en UU-gjennomgang som et enkeltpeker-alternativ til pinch, og
 * ble fjernet igjen fordi zoom er så innarbeidet på en telefon at pilla i
 * praksis bare var støy over kartet. Dobbelttrykk zoomer fortsatt inn, og
 * desktop har hele søyla (ZoomSkyv + RetningsRose) pluss tastatur.
 *
 * De to knappene her deler én ting, og det er grunnen til at de bor sammen:
 * skiva de står på. Begge ligger rett på kartet uten knappeflate under seg, og
 * begge må derfor lese mot ARKETS valør og ikke mot app-chromet.
 *
 * Kompasset faller bort uten `azimut` — desktop har retningsrosa i stedet, og
 * en modus uten rotasjon har ingen retning å nullstille.
 */
const props = defineProps({
  // HVOR NORD LIGGER PÅ SKJERMEN, i grader med klokka — samme kontrakt som
  // RetningsRose leser, og samme verdi (`rotationSliderDeg`). Null når kalleren
  // ikke vil ha kompasset; da faller nord-knappen bort.
  azimut: { type: Number, default: null },
  // Er KARTET mørkt? Ikke UI-temaet — knappene står rett på arket, så det er
  // arkets valør de må lese mot. Se malen.
  mork: { type: Boolean, default: false },
  // Følger vi posisjonen nå? Styrer BÅDE farge og aria-pressed.
  gpsPa: { type: Boolean, default: false },
})
const emit = defineEmits(['nord', 'gps'])

// Skiva er halvgjennomsiktig, så kartet skinner svakt gjennom og knappene ikke
// blir klistrelapper; ring og sørnål er den motsatte enden av samme akse, slik
// at kontrasten holder på begge ark.
const skive = () => (props.mork ? 'rgba(63,63,70,0.82)' : 'rgba(255,255,255,0.82)')
const blekk = () => (props.mork ? '#e4e4e7' : '#1c1917')

// PÅ er GPS-PRIKKENS EGEN BLÅ (useSymbolRenderers: #0284c7 i kjernen, #38bdf8 i
// ringen). Knappen og prikken den slår på skal være samme farge — da er det
// ikonet som forklarer prikken, ikke omvendt. Den lyse tas på mørkt ark, der den
// mørke ville forsvunnet i skiva.
// AV er en NØYTRAL GRÅ og ikke en dempet blå: forskjellen på av og på skal
// kunne ses uten å huske hvordan på ser ut.
const gpsFarge = () => (props.gpsPa
  ? (props.mork ? '#38bdf8' : '#0284c7')
  : (props.mork ? '#a1a1aa' : '#78716c'))

// Skiva bærer sin egen lesbarhet: en skygge som følger grafikkens alfa, ikke en
// firkant bak den.
const SKYGGE = 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))'
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- POSISJON (v6.5.68). Sto som en av tre hurtigknapper øverst i
         innstillings-skuffen, altså bak et trykk og en skuff som dekker kartet
         — for den ENE bryteren man vil nå mens man går. De to andre der
         (Tegnforklaring, Kompass) er borte: tegnforklaringen bor i hovedmenyen,
         og kompassfølgingen slås på og av sammen med posisjonen, som er den
         eneste kombinasjonen som gir mening ute.
         Tilstanden bæres av FARGE og av `aria-pressed`, ikke av tekst: knappen
         er 48 px og har ikke plass til et ord, og en farge alene er ikke nok
         for en skjermleser. -->
    <button type="button" :aria-pressed="gpsPa"
            :aria-label="gpsPa ? 'Posisjon på. Slå av.' : 'Posisjon av. Slå på.'"
            @click="emit('gps')"
            class="w-12 h-12 grid place-items-center rounded-full select-none
                   active:scale-95 transition-transform">
      <svg viewBox="-50 -50 100 100" class="w-12 h-12" aria-hidden="true"
           :style="{ filter: SKYGGE }">
        <circle r="46" :fill="skive()" :stroke="blekk()" stroke-width="3" stroke-opacity="0.45"/>
        <g transform="translate(-28.8 -28.8) scale(2.4)" fill="none" :stroke="gpsFarge()"
           stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="10" r="3"/>
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        </g>
      </svg>
    </button>

    <!-- KOMPASSET ER SIN EGEN FLATE (v6.5.67). Det hadde en knappe-bakgrunn
         under seg, altså en sirkel inni en sirkel.
         Nåla er FAB-ens gamle: rød spiss mot nord.

         NÅLA ROTERES MED `azimut` OG IKKE MOT DEN (v6.5.62). Fortegnet sto
         snudd her fra v6.5.48, så denne nåla og kompass-FAB-ens pekte hver sin
         vei så snart kartet var dreid — speilet om loddrett, altså like på et
         ark i hvile og mest galt på 90°. `azimut` ER skjermvinkelen til nord, så
         et ikon som peker opp i hvile skal roteres MED den; RetningsRose gjør
         det samme med sin skive. -->
    <button v-if="azimut !== null" type="button"
            :aria-label="`Vend kartet mot nord. Nå ${azimut} grader.`"
            @click="emit('nord')"
            class="w-12 h-12 grid place-items-center rounded-full select-none
                   active:scale-95 transition-transform">
      <svg viewBox="-50 -50 100 100" class="w-12 h-12" aria-hidden="true"
           :style="{ transform: `rotate(${azimut}deg)`, transition: 'transform 0.2s linear',
                     filter: SKYGGE }">
        <circle r="46" :fill="skive()" :stroke="blekk()" stroke-width="3" stroke-opacity="0.45"/>
        <polygon points="0,-40 10,0 0,12 -10,0" fill="#ef4444"/>
        <polygon points="0,40 10,0 0,-12 -10,0" :fill="blekk()" opacity="0.85"/>
      </svg>
    </button>
  </div>
</template>

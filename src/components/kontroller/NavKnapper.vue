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
  // Følger vi posisjonen nå? Styrer fyll, farge OG aria-pressed.
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
// AV er en NØYTRAL GRÅ og ikke en dempet blå. Fargen er likevel bare halve
// skillet — se `fill` i malen: PÅ er en FYLT pin, AV er et omriss.
const gpsFarge = () => (props.gpsPa
  ? (props.mork ? '#38bdf8' : '#0284c7')
  : (props.mork ? '#a1a1aa' : '#78716c'))

// Skiva bærer sin egen lesbarhet: en skygge som følger grafikkens alfa, ikke en
// firkant bak den.
const SKYGGE = 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))'

// KANTEN ER EN SKYGGE, IKKE EN RAMME (v6.5.69). Ringen sto på 3 px og 45 %
// opasitet, og da leste den som et omriss TEGNET rundt knappen — et grått
// strekelement som konkurrerte med ikonet inni. Jobben dens er bare å løsne
// skiva fra kartet i kanten der drop-shadow-en er svakest, altså å FORTSETTE
// skyggen og ikke å ramme inn.
// Begge knappene deler tallene fordi de står på samme akse: en ring som er
// tynnere på den ene enn på den andre leses som at de er ulike flater.
const KANT_BREDDE = 2
const KANT_OPASITET = 0.18
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- POSISJON (v6.5.68). Sto som en av tre hurtigknapper øverst i
         innstillings-skuffen, altså bak et trykk og en skuff som dekker kartet
         — for den ENE bryteren man vil nå mens man går. De to andre der
         (Tegnforklaring, Kompass) er borte: tegnforklaringen bor i hovedmenyen,
         og kompassfølgingen slås på og av sammen med posisjonen, som er den
         eneste kombinasjonen som gir mening ute.
         Tilstanden bæres av FYLL, FARGE og `aria-pressed`, ikke av tekst:
         knappen er 48 px og har ikke plass til et ord, og verken form eller
         farge er noe en skjermleser kan lese. -->
    <button type="button" :aria-pressed="gpsPa"
            :aria-label="gpsPa ? 'Posisjon på. Slå av.' : 'Posisjon av. Slå på.'"
            @click="emit('gps')"
            class="w-12 h-12 grid place-items-center rounded-full select-none
                   active:scale-95 transition-transform">
      <svg viewBox="-50 -50 100 100" class="w-12 h-12" aria-hidden="true"
           :style="{ filter: SKYGGE }">
        <circle r="46" :fill="skive()" :stroke="blekk()"
                :stroke-width="KANT_BREDDE" :stroke-opacity="KANT_OPASITET"/>
        <!-- PÅ ER SOLID, OG DET ER ÉN PATH MED `evenodd` (v6.5.69). Et blått
             omriss mot et grått omriss er samme figur i to valører — man må
             huske hvordan på ser ut for å se at det er av. Fylt mot ufylt er
             derimot to ulike figurer, og forskjellen bæres av FLATEN og ikke
             av fargen alene.
             Hullet er en ekte UTSTANSING: prikken er en subbane i samme path,
             så skiva bak skinner gjennom der. Et eget fylt element ville måttet
             holde skivas farge i takt med den, og to halvgjennomsiktige lag
             oppå hverandre gir en annen valør enn ett.
             Streken står i BEGGE tilstandene med samme bredde, så silhuetten
             er identisk av og på — det er bare interiøret som fylles, og
             knappen «vokser» ikke når man slår på posisjonen. -->
        <path transform="translate(-28.8 -28.8) scale(2.4)"
              d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z
                 M15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z"
              fill-rule="evenodd" :fill="gpsPa ? gpsFarge() : 'none'" :stroke="gpsFarge()"
              stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
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
        <circle r="46" :fill="skive()" :stroke="blekk()"
                :stroke-width="KANT_BREDDE" :stroke-opacity="KANT_OPASITET"/>
        <polygon points="0,-40 10,0 0,12 -10,0" fill="#ef4444"/>
        <polygon points="0,40 10,0 0,-12 -10,0" :fill="blekk()" opacity="0.85"/>
      </svg>
    </button>
  </div>
</template>

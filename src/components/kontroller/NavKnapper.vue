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
  // Følger vi posisjonen nå? Styrer SKIVAS farge, ikonets strek og aria-pressed.
  gpsPa: { type: Boolean, default: false },
})
const emit = defineEmits(['nord', 'gps'])

// Skiva er halvgjennomsiktig, så kartet skinner svakt gjennom og knappene ikke
// blir klistrelapper; ring og sørnål er den motsatte enden av samme akse, slik
// at kontrasten holder på begge ark.
const skive = () => (props.mork ? 'rgba(63,63,70,0.82)' : 'rgba(255,255,255,0.82)')
const blekk = () => (props.mork ? '#e4e4e7' : '#1c1917')

// PÅ ER APPENS AKSENTGRØNNE, IKKE GPS-PRIKKENS BLÅ (v6.5.70). Blått var valgt
// for å knytte knappen til prikken den slår på, og det var feil spørsmål: en
// bryter som står PÅ er den samme tilstanden her som overalt ellers i appen, og
// den tilstanden er grønn — hver eneste vippebryter i skuffene er
// `bg-emerald-500` mot `bg-ink/15`, og måle- og stifinner-varslene som ligger
// rett på kartet er `bg-emerald-600` med hvitt innhold. Knappen har nå nøyaktig
// det mønsteret: farget skive, hvitt ikon.
// Emerald-600 og ikke -500: hvitt på -500 gir 2,6:1, altså under WCAG 1.4.11 sitt
// krav på 3:1 for grafiske objekter. -600 gir 3,8:1. Samme tall på begge ark —
// en farget skive bærer sin egen kontrast og trenger ikke lese arkets valør.
const AKTIV = '#059669'

// AV er en NØYTRAL GRÅ på den vanlige halvgjennomsiktige skiva. Skillet bæres
// nå av SKIVA og ikke av ikonet: se malen — ikonet er et omriss i BEGGE
// tilstandene, det er flaten under som skifter.
const gpsBlekk = () => (props.gpsPa
  ? '#ffffff'
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
         Tilstanden bæres av SKIVAS FARGE og `aria-pressed`, ikke av tekst:
         knappen er 48 px og har ikke plass til et ord, og en farge er ikke noe
         en skjermleser kan lese. -->
    <button type="button" :aria-pressed="gpsPa"
            :aria-label="gpsPa ? 'Posisjon på. Slå av.' : 'Posisjon av. Slå på.'"
            @click="emit('gps')"
            class="w-12 h-12 grid place-items-center rounded-full select-none
                   active:scale-95 transition-transform">
      <svg viewBox="-50 -50 100 100" class="w-12 h-12" aria-hidden="true"
           :style="{ filter: SKYGGE }">
        <!-- SKIVA BÆRER TILSTANDEN, IKONET STÅR STILLE (v6.5.70). Kort historikk,
             for begge de forkastede utgavene er lette å foreslå på nytt: først
             skiftet bare ikonets FARGE (blått mot grått), og det var to like
             figurer man måtte huske forskjellen på; så ble ikonet FYLT blått, som
             var et tydelig skille men gjorde selve pin-en til flekken man leste,
             på en knapp som er 48 px. Nå er det FLATEN som skifter — den er ti
             ganger større enn ikonet og leses i et øyekast på en telefon i sola.
             Ikonet er derfor et omriss i begge tilstandene, med bare `stroke`
             som endres, og silhuetten er identisk av og på. -->
        <circle r="46" :fill="gpsPa ? AKTIV : skive()" :stroke="blekk()"
                :stroke-width="KANT_BREDDE" :stroke-opacity="KANT_OPASITET"/>
        <!-- ÉN PATH MED `evenodd`, og hullet er en ekte UTSTANSING: prikken er en
             subbane i samme path, så skiva bak skinner gjennom der. `fill` er
             `none` i BEGGE tilstandene — det er streken som gir figuren, og et
             fyll her ville lagt en flekk oppå den fargede skiva. -->
        <path transform="translate(-28.8 -28.8) scale(2.4)"
              d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z
                 M15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z"
              fill-rule="evenodd" fill="none" :stroke="gpsBlekk()"
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

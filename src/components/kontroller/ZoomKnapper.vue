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
  // Er KARTET mørkt? Ikke UI-temaet — kompasset står rett på arket uten
  // knappeflate, så det er arkets valør det må lese mot. Se malen.
  mork: { type: Boolean, default: false },
})
const emit = defineEmits(['broek', 'nord'])

// Kompassets to valører. Skiva er halvgjennomsiktig, så kartet skinner svakt
// gjennom og nåla ikke blir en klistrelapp; ring og sørnål er den motsatte
// enden av samme akse, slik at kontrasten holder på begge ark.
const skive = () => (props.mork ? 'rgba(63,63,70,0.82)' : 'rgba(255,255,255,0.82)')
const blekk = () => (props.mork ? '#e4e4e7' : '#1c1917')

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
       vei til nord. Fra v6.5.67 er kompasset sin egen flate — se under. -->
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

    <!-- KOMPASSET ER SIN EGEN FLATE (v6.5.67). Det hadde en knappe-bakgrunn
         under seg, altså en sirkel inni en sirkel. Skiva i selve nåla er
         flaten man sikter på, og den bærer sin egen lesbarhet: en drop-shadow
         som følger nålas alfa, ikke en firkant bak den.

         VALØREN FØLGER KARTET OG IKKE UI-TEMAET. Det er hele poenget med at
         `mork` er en egen prop og ikke `isDark` fra en tema-klasse: knappen
         står rett på arket, så det er arkets stemning den må passe til — et
         mørkt kart kan godt leses i en lys UI, og en hvit skive ville da vært
         et hull i kartet.

         Nåla er FAB-ens gamle: rød spiss mot nord.

         NÅLA ROTERES MED `azimut` OG IKKE MOT DEN (v6.5.62). Fortegnet sto
         snudd her fra v6.5.48, så denne nåla og kompass-FAB-ens pekte hver sin
         vei så snart kartet var dreid — speilet om loddrett, altså like på et
         ark i hvile og mest galt på 90°. `azimut` ER skjermvinkelen til nord, så
         et ikon som peker opp i hvile skal roteres MED den; RetningsRose gjør
         det samme med sin skive.

         SKIVA ER LIKE BRED SOM PILLA OVER (48 px = pillas `p-1` + w-10).
         De to står loddrett under hverandre på samme akse, og en skive som
         var smalere ville lest som en tredje, mindre knapp framfor som
         søylas siste ledd. Trefflaten er dermed skiva selv. -->
    <button v-if="azimut !== null" type="button"
            :aria-label="`Vend kartet mot nord. Nå ${azimut} grader.`"
            @click="emit('nord')"
            class="w-12 h-12 grid place-items-center rounded-full select-none
                   active:scale-95 transition-transform">
      <svg viewBox="-50 -50 100 100" class="w-12 h-12" aria-hidden="true"
           :style="{ transform: `rotate(${azimut}deg)`, transition: 'transform 0.2s linear',
                     filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }">
        <circle r="46" :fill="skive()" :stroke="blekk()" stroke-width="3" stroke-opacity="0.45"/>
        <polygon points="0,-40 10,0 0,12 -10,0" fill="#ef4444"/>
        <polygon points="0,40 10,0 0,-12 -10,0" :fill="blekk()" opacity="0.85"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useUiTextScale } from '../composables/useUiTextScale.js'

// Fritt lendes eneste kontroll. Ett begrep — «hent meg hit» — som bruker det
// billigste midlet situasjonen tillater: panorere hvis mulig, bygge hvis ikke.
//
// Egen komponent og ikke FabCluster med tom `satellites`: den emitter `chat` på
// tap når det ikke finnes knotter (FabCluster.vue).
//
// LANG-TRYKKET ER BORTE (v6.5.27), og det er en KONSEKVENS og ikke en
// forenkling. Det fantes som den ene veien til et nytt ark der man sto, fordi
// tapet aldri fikk bygge innenfor arkkanten. Nå er porten en AVSTAND: over
// NYTT_KART_M fra senter bygger tapet selv, under den skal ingenting bygge. Da gjør
// et hold nøyaktig det tapet gjør eller nøyaktig ingenting — og en fyllring som
// lover noe nytt og leverer det samme er verre enn ingen ring. Legger du den
// tilbake, må den ha en egen betydning porten ikke alt dekker.
//
// 48 px — appens vanlige kontrollstørrelse. Den sto på 56 fra v6.5.0, med
// begrunnelsen «modusens ENESTE kontroll, brukt med kalde eller behanskede
// fingre», og det argumentet holdt så lenge knappen var en fast størrelse.
// Da den fikk `zoom` (v7.8.2) ble de åtte pikslene en FAKTOR: ved 200 % sto
// den på 112 px mot hamburgerens 80, og eieren meldte at den var «nokså mye
// større» enn resten av UI-et. En kontroll som er større enn alt annet ved
// hvert eneste trinn leses ikke som mer treffsikker, men som ute av takt.
// 48 px er fortsatt over 44 px-minstemålet (SC 2.5.8) i hvert trinn.
const props = defineProps({
  etikett: { type: String, required: true },
  // 'bygg' | 'sentrer' | 'start-gps' | 'start-gps-og-bygg' | 'for-naer' | null
  handling: { type: String, default: null },
  bygger: { type: Boolean, default: false },
  venterPaaFix: { type: Boolean, default: false },
  offline: { type: Boolean, default: false },
  // Førstegangs-fremheving: knappen er den eneste kontrollen på skjermen, men
  // et siktekors i chrome-grått leses som «vis hvor jeg er» og ikke som «hent
  // et kart». Fram til første trykk står den derfor i Lende-gul med en myk
  // glød, sammen med boblen som peker ned på den.
  fremhev: { type: Boolean, default: false },
})
const emit = defineEmits(['tap'])

// Aksentring når et trykk bygger et nytt ark — knappen skal se annerledes ut
// FØR man trykker, ikke forklare seg etterpå.
const byggerNytt = computed(() => props.handling === 'bygg' || props.handling === 'start-gps-og-bygg')

// Aksenten er logoens egen gul (#ffd84a fra public/icon.svg) og ikke Tailwinds
// amber-400. Ringen og ikonet deler den, for en gul ring rundt et grått merke
// leser som at ringen er et varsel — mens hele knappen i samme farge leser som
// appens knapp. Ett sted, så de to aldri kommer i utakt.
const LENDE_GUL = '#ffd84a'
const aksent = computed(() => (byggerNytt.value || props.fremhev ? LENDE_GUL : 'currentColor'))

// KNAPPEN FØLGER TEKSTSTØRRELSEN (v7.8.2). Den er den eneste kontrollen i
// modusen, og fram til nå den eneste flata i Fritt lende som IKKE gjorde det:
// linjalen, boblen, meldingen og angre-toasten bar alle `zoom` fra viewet, så
// ved 200 % vokste alt rundt knappen mens knappen selv sto igjen som den
// minste tingen på skjermen. Samme begrunnelse som hamburgerens `float`-variant
// (v7.6.0): her finnes det ingen tekst i det hele tatt — ikonet ER kontrollen —
// og den som skrur opp fordi ting er for smått trenger også trykkflata større.
//
// Og her skal koordinaten IKKE deles på skalaen, i motsetning til hamburgeren.
// Den er `fixed` på målte skjermpiksler, som `zoom` ganger opp; denne er
// `absolute` med Tailwind-avstander (`bottom-4 right-4`) som skaleres sammen
// med knappen — nøyaktig som naboene, som bærer samme `zoom`. Marg og knapp
// vokser da i takt, og boblas trekant peker fortsatt på knappens midte.
const { uiTextScale } = useUiTextScale()

const ringStil = computed(() => ({
  zoom: uiTextScale.value || 1,
  ...(byggerNytt.value || props.fremhev
    ? { boxShadow: `0 0 0 2px ${LENDE_GUL}, 0 0 18px -2px ${LENDE_GUL}99` }
    : {}),
}))
</script>

<template>
  <!-- `data-hovedknapp`: modusens ene handling, og røyktesten pekte på den som
       «første knapp med aria-label» — en peker som brakk i det zoom-knappene
       kom inn foran den i DOM-en (v6.5.49). -->
  <button type="button"
          data-hovedknapp
          :aria-label="etikett"
          :disabled="bygger"
          @click="!bygger && emit('tap')"
          class="absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full
                 bg-overlay shadow-lg touch-none transition
                 active:scale-95 disabled:opacity-50"
          :class="byggerNytt || fremhev ? '' : 'ring-1 ring-ink/15'"
          :style="ringStil">
    <!-- RENT SIKTEKORS: ring og fire streker, og ingenting inni (v7.8.3).
         Fram til nå lå det en fylt prikk og en liten bue der — logoens
         høydekurve-motiv i det små (v6.5.31) — og de to sammen leste eieren
         som et ØYE: en pupill med et lokk over. Et øye sier «se hvor jeg er»,
         som er nøyaktig den halvparten av knappen som IKKE er poenget. Tomt
         midtfelt sier «sikt her», og gjør dessuten plass til plusset uten at
         merket blir grøt i 22 px.

         Kan et trykk hente et nytt ark, får ringen et pluss — den ENE
         forskjellen på de to tilstandene, og da må den stå alene for å ses. -->
    <svg viewBox="0 0 34 34" class="absolute inset-0 m-auto w-[22px] h-[22px] text-ink"
         fill="none" :stroke="aksent" stroke-width="2.4" stroke-linecap="round"
         aria-hidden="true">
      <path d="M17 2.5 V8 M17 26 V31.5 M2.5 17 H8 M26 17 H31.5" />
      <circle cx="17" cy="17" r="7" :class="venterPaaFix ? 'animate-pulse' : ''" />
      <path v-if="byggerNytt" d="M17 13.5 V20.5 M13.5 17 H20.5" />
    </svg>

    <!-- Sky med strek: nettleseren sier offline. Et varsel, ikke en sperre —
         brukeren kan vite bedre enn OS-et (portalen ble nettopp løst). -->
    <svg v-if="offline" viewBox="0 0 24 24"
         class="absolute -top-0.5 -right-0.5 w-4 h-4 text-ink-2"
         fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-overlay, #fff)" stroke="none" />
      <path d="M6 15h10a3 3 0 0 0 .4-6A5 5 0 0 0 7.2 9.6" />
      <path d="M4 4 20 20" />
    </svg>
  </button>
</template>

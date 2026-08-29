<script setup>
// Værsymbolrad øverst i 3D-visningen: timene framover for arkets senterpunkt.
//
// Ligger på en EGEN linje rett under topprada, OVER Info/POI-raden (v5.27.0).
// Topprada har alt fem-seks knapper, og kommentaren over den (Viewer3D.vue)
// advarer eksplisitt om at den falt ut av skjermen på smale telefoner — den skal
// ikke belastes mer. Under Info/POI, som raden lå fram til v5.27.0, måtte man
// lese seg forbi to piller for å komme til det man slo på værmodus for.
//
// Raden er smal med vilje og ruller vannrett framfor å brekke: den skal koste så
// lite kartflate som mulig. Symbolene tegnes med varianten MET selv har satt i
// `symbol_code` — dag/natt/polartwilight for det tidspunktet varselet gjelder.
// Den fulgte lysmodusen i 3D fram til v5.22.12, og ga sol klokka 00.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VaerIkon from '../VaerIkon.vue'
import { timerFramover, vindMotGrader } from '../../lib/vaerFetcher.js'
import { bearingToCompass } from '../../lib/mapContext.js'

const emit = defineEmits(['lukk'])

const props = defineProps({
  // { status: 'loading'|'done'|'error', varsel } — samme form som i 2D.
  vaer: { type: Object, default: null },
  // TAK, ikke en fast mengde: hvor mange timer som faktisk vises avgjøres av
  // hvor mange som får PLASS. Se maalPlass under.
  antall: { type: Number, default: 12 },
})

/**
 * INGEN VANNRETT RULLING (v6.3.9). Raden var en rulleflate med åtte faste timer,
 * og på en 430 px-telefon fikk seks plass — så to timer lå gjemt bak en gest
 * ingenting antydet. Eieren oppdaget det først etter måneder, og det er den
 * avgjørende observasjonen: en skjult gest er ikke en affordanse.
 *
 * Nå fyller raden bredden og viser BARE det som passer. Ingenting er skjult, så
 * det finnes ikke noe å oppdage. Prisen er at antallet varierer med skjermen —
 * en smal telefon får fem-seks timer, et nettbrett flere — og det er riktig
 * bytte: en turgåer trenger de nærmeste timene, ikke et fast tall.
 *
 * MÅLT I PIKSLER FRA DOM-EN, ikke regnet fra rem. Kolonnene er rem-baserte, og
 * rot-fontstørrelsen følger systemets tekstskalering (se v5.27.0) — en bruker med
 * 150 % tekst har bredere kolonner, og et hardkodet 57,6 px ville da vist for
 * mange og brakt rullingen tilbake.
 */
const radRef = ref(null)
// GULVET ER TO TIMER (v6.3.12), ikke tre. Én time er ikke et varsel, men på en
// 412 px-telefon med 150 % systemtekst får ikke tre timer plass sammen med kilden
// og lukkeknappen — målt til 11 px for mye. Da er valget mellom to timer og en
// X-knapp som klippes bort, og en knapp man ikke kan trykke på er verre enn en
// time mindre. Alternativet, å la kolonnene klemmes sammen i stedet, klipper
// teksten INNE i cellene og er dårligere igjen.
const MIN_TIMER = 2
// KONSERVATIV START, ikke taket: for FÅ timer er ufarlig, for mange flyter ut av
// boksen før første måling.
const plass = ref(MIN_TIMER + 2)

let ro = null
let maaler = false

const grense = (n) => Math.max(MIN_TIMER, Math.min(props.antall, n))

/**
 * MÅLINGEN MÅ KJØRE NÅR RADEN FINNES, ikke ved montering (v6.3.12). Raden står
 * bak `v-else-if="timer.length"`, og ved montering er varselet enda ikke hentet
 * — da rendres «Henter værvarsel …», som ikke bærer `radRef`. `maalPlass` fant
 * altså ingenting, returnerte, og ResizeObserveren ble aldri koblet på engang.
 * Antallet sto igjen på startverdien for alltid, og på en smal skjerm eller med
 * stor systemtekst fløt raden ut: målt i Chromium 48 px på 360 px bredde og
 * 200 px med 24 px rot-font. Det er X-en som havner utenfor og blir klippet av
 * `overflow-hidden` — nøyaktig det eieren så.
 */
function sikreObserver() {
  if (ro || typeof ResizeObserver === 'undefined') return
  // Observerer FORELDEREN, av samme grunn som målingen leser den: radens egen
  // bredde endres av vårt eget resultat.
  const mor = radRef.value?.parentElement
  if (!mor) return
  ro = new ResizeObserver(() => { maalPlass() })
  ro.observe(mor)
}

async function maalPlass() {
  // Ettersjekken under venter på en ny layout, og ResizeObserveren kan fyre midt
  // i den. To samtidige løkker ville trukket antallet ned to ganger for samme
  // overflyt.
  if (maaler) return
  const el = radRef.value
  if (!el) return
  // LEDIG BREDDE måles på FORELDEREN og ikke på raden selv: radens bredde følger
  // antallet vi nettopp valgte, så å måle den ville vært en løkke som jager sin
  // egen hale.
  //
  // OG DET ER INNHOLDSBREDDEN, ikke `getBoundingClientRect()` (v6.3.12): mora har
  // `px-3`, og rammen inkluderer polstringen. Prognosen ble da 24–30 px for
  // raus — nok til én time for mye, som er nøyaktig én time for mye. Polstringen
  // er rem-basert, så den vokser med systemtekst og kan ikke hardkodes.
  const mor = el.parentElement
  if (!mor) return
  const cs = getComputedStyle(mor)
  const ledig = mor.clientWidth
    - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
  if (!(ledig > 0)) return
  const kolonne = el.querySelector('[data-time]')?.getBoundingClientRect().width
  if (!kolonne) return
  // Alt som ikke er en time: MET-attribusjonen og lukkeknappen, som nå ligger i
  // samme celle.
  const faste = [...el.querySelectorAll('[data-fast]')]
    .reduce((sum, e) => sum + e.getBoundingClientRect().width, 0)
  maaler = true
  try {
    plass.value = grense(Math.floor((ledig - faste) / kolonne))
    // ETTERSJEKK MOT DEN EKTE LAYOUTEN. Regnestykket over er en prognose:
    // avrunding, `gap`, skillelinjer og en kolonne som er bredere enn
    // minstebredden kan gjøre den ett hakk for optimistisk. Vi spør derfor
    // browseren om det FAKTISK flyter over, og går ned til det ikke gjør det.
    // Det er samme invariant som røyktesten måler.
    for (let i = 0; i < 4 && plass.value > MIN_TIMER; i++) {
      await nextTick()
      const rad = radRef.value
      if (!rad || rad.scrollWidth <= rad.clientWidth + 1) break
      plass.value -= 1
    }
  } finally {
    maaler = false
  }
}

onMounted(() => { sikreObserver(); maalPlass() })
// Raden dukker opp først når varselet er hentet. `flush: 'post'` gjør at DOM-en
// er oppdatert når vi måler.
watch(() => props.vaer?.status, () => {
  sikreObserver()
  maalPlass()
}, { flush: 'post' })
onBeforeUnmount(() => { ro?.disconnect(); ro = null })

const timer = computed(() => (props.vaer?.status === 'done'
  ? timerFramover(props.vaer.varsel, { antall: Math.min(props.antall, plass.value) })
  : []))

// «14» framfor «14:00» — halve bredden, og minuttet er alltid 00.
function klokke(iso) {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? String(d.getHours()).padStart(2, '0') : '--'
}
const komma = (n, d = 0) => n.toFixed(d).replace('.', ',')

// Rotasjonen pila skal ha. «↑» peker opp (nord) urotert, og CSS-rotasjon går med
// klokka — altså er rotasjonen i grader nøyaktig retningen vinden GÅR. Snuingen
// fra METs «kommer fra» gjøres av vindMotGrader, som skydriften i 3D bruker òg.
function vindMot(fraGrader) {
  const g = vindMotGrader(fraGrader)
  return g === null ? null : Math.round(g)
}

// Full forklaring på hold/hover, siden cella bare har plass til et tall og en pil.
function vindTitle(t) {
  const ms = `${komma(t.vindMs, 1)} m/s`
  return Number.isFinite(t.vindRetningGrader)
    ? `${ms} fra ${bearingToCompass(t.vindRetningGrader)}`
    : ms
}
</script>

<template>
  <div v-if="vaer?.status === 'loading'"
       class="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/60">
    Henter værvarsel …
  </div>
  <!-- Ærlig svar framfor et oppdiktet vær. Samme regel som i infopanelet. -->
  <div v-else-if="vaer?.status === 'error'"
       class="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/60">
    Værvarsel ikke tilgjengelig
  </div>
  <!-- BAREN ER TO KOLONNER (v6.3.8): timene som ruller, og en X som står stille.
       INGEN RULLING: raden viser bare timene som får plass (se maalPlass). En
       rulleflate med skjult innhold var uu-fella som ble rettet i v6.3.9. -->
  <div v-else-if="timer.length" ref="radRef"
       class="rounded-2xl bg-black/45 backdrop-blur max-w-full overflow-hidden
              flex items-stretch divide-x divide-white/10">
      <!-- shrink-0 (v6.3.12): uten den klemmes kolonnene mot min-w når det er
           trangt, og da måler vi minstebredden i stedet for den ekte — som gjør
           prognosen for optimistisk og gir én time for mye. -->
      <div v-for="t in timer" :key="t.tid" data-time
           class="shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 min-w-[3.6rem]">
        <span class="text-[0.5625rem] text-white/50 tabular-nums leading-none">{{ klokke(t.tid) }}</span>
        <VaerIkon :symbol="t.symbol" :size="22"/>
        <!-- Temperatur og vind på SAMME linje (v5.21.2). Vind fortjener plassen,
             men ikke en femte stablet linje: raden ligger over kartet, og høyde
             koster kartflate mens bredde bare koster litt rulling. Derfor
             sidestilt.
             Vinden vises ALLTID når MET har tallet — i motsetning til nedbøren
             under, som bare vises når det ER nedbør. Forskjellen er tilsiktet:
             0 mm er ingen informasjon, mens 0-2 m/s er nettopp det turgåeren vil
             vite. Heltall m/s; desimalen er under varselets nøyaktighet.
             Pila peker dit vinden GÅR — snuingen fra METs «kommer fra» gjøres av
             vindMotGrader, delt med skydriften i 3D, så de aldri kan peke i strid. -->
        <span class="flex items-baseline gap-1 leading-none">
          <span v-if="t.temperaturC != null"
                class="text-[0.6875rem] font-medium text-white tabular-nums">
            {{ Math.round(t.temperaturC) }}°
          </span>
          <span v-if="t.vindMs != null"
                class="flex items-baseline gap-px text-[0.5625rem] text-white/65 tabular-nums"
                :title="vindTitle(t)">
            <!-- Med retning: en rotert pil. UTEN retning: et nøytralt vind-tegn,
                 ikke bare tallet. «8° 8» er to tall uten enhet og leses ikke som
                 vind — og MET oppgir ikke alltid retning. -->
            <span aria-hidden="true" class="inline-block text-[0.5rem]"
                  :style="vindMot(t.vindRetningGrader) !== null
                    ? { transform: `rotate(${vindMot(t.vindRetningGrader)}deg)` } : null">{{
                    vindMot(t.vindRetningGrader) !== null ? '↑' : '≈' }}</span>
            {{ Math.round(t.vindMs) }}
          </span>
        </span>
        <!-- Nedbør bare når det ER nedbør: en rad med «0,0 mm» under hver time
             er støy, og det er nettopp lesbarheten dette ikke skal koste. -->
        <span v-if="t.nedborMm" class="text-[0.5625rem] text-sky-200/80 tabular-nums leading-none">
          {{ komma(t.nedborMm, 1) }}
        </span>
      </div>
    <!-- MET-ATTRIBUSJONEN OG X-EN LIGGER I SAMME CELLE (v6.3.12), etter eierens
         forslag. To celler mot høyre kant ga to skillelinjer og en X presset helt
         ut i kanten; samlet leses de som «kilden, og lukk» — og cellen er
         smalere enn de to var, så en time kan komme tilbake i stedet.
         Lisenskravet: MET-data krever synlig attribusjon. Står den ikke her, står
         den ingen steder i 3D — infopanelet er en annen visning.

         LUKK VÆRET tar bort både raden og værhimmelen — regn, torden, tåke og
         skyer. Den erstatter det tredje steget sol/måne-knappen hadde fram til
         v6.1.0, og er en bedre plassering: knappen sier «dag eller natt», mens
         DETTE er «vis meg været eller ikke», og de to spørsmålene hører ikke på
         samme bryter.
         Tilstanden lagres IKKE: dag/natt avgjøres av klokka, og neste gang man
         åpner 3D er været med igjen. Vil man ha det tilbake i samme økt, går man
         innom natt og tilbake. -->
    <div class="shrink-0 flex items-center gap-0.5 pl-2.5 pr-0.5" data-fast>
      <span class="text-[0.5rem] leading-tight text-white/35 whitespace-nowrap">MET<br/>Norway</span>
      <!-- 44 × 44 px: trykkmålets minimum, og ikke mer — hver piksel her er en
           værtime mindre. Kolonne-målingen trekker cellen fra selv, siden den er
           data-fast. -->
      <button @click="emit('lukk')" aria-label="Skjul værvarselet og værhimmelen"
              class="w-11 h-11 shrink-0 flex items-center justify-center text-white/45
                     active:scale-90 transition-transform">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

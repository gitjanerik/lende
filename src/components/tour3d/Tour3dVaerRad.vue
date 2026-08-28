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
import { computed } from 'vue'
import VaerIkon from '../VaerIkon.vue'
import { timerFramover, vindMotGrader } from '../../lib/vaerFetcher.js'
import { bearingToCompass } from '../../lib/mapContext.js'

const emit = defineEmits(['lukk'])

const props = defineProps({
  // { status: 'loading'|'done'|'error', varsel } — samme form som i 2D.
  vaer: { type: Object, default: null },
  antall: { type: Number, default: 8 },
})

const timer = computed(() => (props.vaer?.status === 'done'
  ? timerFramover(props.vaer.varsel, { antall: props.antall })
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
       X-en må ligge UTENFOR rulleflata — lå den i lista, ville den forsvunnet ut
       til høyre i det man rullet fram flere timer, og da er den ikke en lukkeknapp
       lenger. `shrink-0` på begge sider, og rullingen på den venstre alene. -->
  <div v-else-if="timer.length"
       class="rounded-2xl bg-black/45 backdrop-blur max-w-full flex items-stretch">
    <div class="flex items-stretch divide-x divide-white/10 overflow-x-auto
                [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div class="flex items-stretch divide-x divide-white/10 w-max">
      <div v-for="t in timer" :key="t.tid"
           class="flex flex-col items-center gap-0.5 px-2.5 py-1.5 min-w-[3.6rem]">
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
      <!-- Lisenskravet: MET-data krever synlig attribusjon. Står den ikke her,
           står den ingen steder i 3D — infopanelet er en annen visning. -->
      <div class="flex items-center px-2.5">
        <span class="text-[0.5rem] leading-tight text-white/35 whitespace-nowrap">MET<br/>Norway</span>
      </div>
      </div>
    </div>

    <!-- LUKK VÆRET. Tar bort både raden og værhimmelen — regn, torden, tåke og
         skyer. Den erstatter det tredje steget sol/måne-knappen hadde fram til
         v6.1.0, og er en bedre plassering: knappen sier «dag eller natt», mens
         DETTE er «vis meg været eller ikke», og de to spørsmålene hører ikke på
         samme bryter.
         Tilstanden lagres IKKE: dag/natt avgjøres av klokka, og neste gang man
         åpner 3D er været med igjen. Vil man ha det tilbake i samme økt, går man
         innom natt og tilbake. -->
    <div class="shrink-0 flex items-stretch border-l border-white/10">
      <button @click="emit('lukk')" aria-label="Skjul værvarselet og værhimmelen"
              class="w-9 flex items-center justify-center text-white/45
                     active:scale-90 transition-transform">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

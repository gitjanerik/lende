<script setup>
// Værsymbolrad øverst i 3D-visningen: timene framover for arkets senterpunkt.
//
// Ligger på en EGEN linje under Info/POI-raden. Topprada har alt fem-seks
// knapper, og kommentaren over den (Viewer3D.vue) advarer eksplisitt om at den
// falt ut av skjermen på smale telefoner — den skal ikke belastes mer.
//
// Raden er smal med vilje og ruller vannrett framfor å brekke: den skal koste så
// lite kartflate som mulig. `variant` sendes inn så symbolene følger lysmodusen
// brukeren har valgt, ikke klokka.
import { computed } from 'vue'
import VaerIkon from '../VaerIkon.vue'
import { timerFramover, vindMotGrader } from '../../lib/vaerFetcher.js'
import { bearingToCompass } from '../../lib/mapContext.js'

const props = defineProps({
  // { status: 'loading'|'done'|'error', varsel } — samme form som i 2D.
  vaer: { type: Object, default: null },
  // 'day' | 'night' — hvilken symbolvariant som skal vises.
  variant: { type: String, default: 'day' },
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
       class="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-[11px] text-white/60">
    Henter værvarsel …
  </div>
  <!-- Ærlig svar framfor et oppdiktet vær. Samme regel som i infopanelet. -->
  <div v-else-if="vaer?.status === 'error'"
       class="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-[11px] text-white/60">
    Værvarsel ikke tilgjengelig
  </div>
  <div v-else-if="timer.length"
       class="rounded-2xl bg-black/45 backdrop-blur overflow-x-auto max-w-full
              [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <div class="flex items-stretch divide-x divide-white/10 w-max">
      <div v-for="t in timer" :key="t.tid"
           class="flex flex-col items-center gap-0.5 px-2.5 py-1.5 min-w-[3.6rem]">
        <span class="text-[9px] text-white/50 tabular-nums leading-none">{{ klokke(t.tid) }}</span>
        <VaerIkon :symbol="t.symbol" :variant="variant" :size="22"/>
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
                class="text-[11px] font-medium text-white tabular-nums">
            {{ Math.round(t.temperaturC) }}°
          </span>
          <span v-if="t.vindMs != null"
                class="flex items-baseline gap-px text-[9px] text-white/65 tabular-nums"
                :title="vindTitle(t)">
            <!-- Med retning: en rotert pil. UTEN retning: et nøytralt vind-tegn,
                 ikke bare tallet. «8° 8» er to tall uten enhet og leses ikke som
                 vind — og MET oppgir ikke alltid retning. -->
            <span aria-hidden="true" class="inline-block text-[8px]"
                  :style="vindMot(t.vindRetningGrader) !== null
                    ? { transform: `rotate(${vindMot(t.vindRetningGrader)}deg)` } : null">{{
                    vindMot(t.vindRetningGrader) !== null ? '↑' : '≈' }}</span>
            {{ Math.round(t.vindMs) }}
          </span>
        </span>
        <!-- Nedbør bare når det ER nedbør: en rad med «0,0 mm» under hver time
             er støy, og det er nettopp lesbarheten dette ikke skal koste. -->
        <span v-if="t.nedborMm" class="text-[9px] text-sky-200/80 tabular-nums leading-none">
          {{ komma(t.nedborMm, 1) }}
        </span>
      </div>
      <!-- Lisenskravet: MET-data krever synlig attribusjon. Står den ikke her,
           står den ingen steder i 3D — infopanelet er en annen visning. -->
      <div class="flex items-center px-2.5">
        <span class="text-[8px] leading-tight text-white/35 whitespace-nowrap">MET<br/>Norway</span>
      </div>
    </div>
  </div>
</template>

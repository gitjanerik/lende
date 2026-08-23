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
import { timerFramover } from '../../lib/vaerFetcher.js'

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
           class="flex flex-col items-center gap-0.5 px-2.5 py-1.5 min-w-[3.1rem]">
        <span class="text-[9px] text-white/50 tabular-nums leading-none">{{ klokke(t.tid) }}</span>
        <VaerIkon :symbol="t.symbol" :variant="variant" :size="22"/>
        <span v-if="t.temperaturC != null"
              class="text-[11px] font-medium text-white tabular-nums leading-none">
          {{ Math.round(t.temperaturC) }}°
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

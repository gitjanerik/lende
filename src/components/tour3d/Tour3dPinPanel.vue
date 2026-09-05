<script setup>
// POI-filter for begge 3D-modusene: i utforskeren styrer det hvilke
// knappenåler som står i terrenget, i turvisningen hvilke severdigheter turen
// stopper ved. Samme valg, samme lager — det er én innstilling i brukerens
// hode. Grønn stil: grønt betyr «dine valg», mørkt betyr visningens eget
// maskineri (Info-pilla til venstre). Ligger oppe til høyre.
//
// Valgene lagres lokalt så de holder seg mellom økter; et filter man må sette
// på nytt hver gang er i praksis et filter man slutter å bruke.
//
// v6.5.49: SAMME GREP SOM INFO-PILLA FIKK I v6.5.44 — headeren blir stående,
// og kroppen er et nedtrekk. Fram til nå byttet pilla seg ut med den utvidede
// boksen, og boksen sto i FLYTEN i en `justify-between`-rad: den vokste mot
// venstre til den nådde Info-pilla og rant så ut over høyre skjermkant, med
// sin egen minimer-knapp utenfor. To ting følger, og begge er lette å «rydde»
// bort:
//   1. Pilla er den ENESTE bryteren, og den står i flyten alene. Raden er
//      derfor like bred åpen som lukket. Minimer-knappen inne i boksen er
//      borte — den var en andre vei ut av noe man kom inn i med ett trykk.
//   2. Kroppen er ABSOLUTT plassert under pilla, forankret i HØYRE kant
//      (`right-0`), fordi pilla står i høyre ende av raden. Da må kroppen bære
//      sitt eget tak og sin egen rulling: kallstedet kan ikke pakke den i en
//      `overflow`-boks, for en slik boks ville klippet nedtrekket bort.
// Målene kommer som CSS-lengder fra kallstedet, som `Tour3dInfoPanel` — det er
// DER `zoom` settes, og `vw`/`vh` skaleres ikke ned av den (se v6.3.12).
import { ref, computed, watch } from 'vue'

const props = defineProps({
  groups: { type: Array, required: true },      // PIN_GROUPS
  counts: { type: Object, default: () => ({}) },
  modelValue: { type: Object, required: true }, // { [key]: boolean }
  loading: { type: Boolean, default: false },
  // Hva valgene heter i denne modusen: nåler i utforskeren, severdigheter i
  // turvisningen. Samme filter, ulikt utfall — og da skal overskriften si det.
  tittel: { type: String, default: 'Knappenåler' },
  maksBredde: { type: String, default: '74vw' },
  maksHoyde: { type: String, default: '60vh' },
})
const emit = defineEmits(['update:modelValue'])

const expanded = ref(false)

// Grupper uten treff i dette kartet vises ikke — en tom avkryssingsboks er
// bare støy, og den forteller ingenting brukeren kan gjøre noe med.
const visibleGroups = computed(() =>
  props.groups.filter(g => (props.counts[g.key] ?? 0) > 0))

const activeCount = computed(() =>
  visibleGroups.value.reduce((n, g) => n + (props.modelValue[g.key] ? (props.counts[g.key] ?? 0) : 0), 0))

const allOn = computed(() => visibleGroups.value.every(g => props.modelValue[g.key]))

function toggle(key) {
  emit('update:modelValue', { ...props.modelValue, [key]: !props.modelValue[key] })
}

function setAll(on) {
  const next = { ...props.modelValue }
  for (const g of visibleGroups.value) next[g.key] = on
  emit('update:modelValue', next)
}

// Faller alle grupper bort (kart uten POI i det hele tatt), lukkes panelet så
// det ikke står igjen som en tom pille.
watch(visibleGroups, (gs) => { if (!gs.length) expanded.value = false })
</script>

<template>
  <div v-if="visibleGroups.length" class="on-accent relative">
    <button type="button" @click="expanded = !expanded"
            :aria-expanded="expanded" aria-controls="tour3d-poi-kropp"
            :aria-label="expanded
              ? `Skjul filter for ${tittel.toLowerCase()}`
              : `Vis filter for ${tittel.toLowerCase()}`"
            class="flex items-center gap-1.5 rounded-full bg-emerald-700 text-white
                   text-[0.6875rem] font-semibold shadow-lg pl-3 pr-2 py-1.5 active:scale-[0.97]
                   tabular-nums">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/>
        <circle cx="12" cy="11" r="2.4"/>
      </svg>
      <span>{{ activeCount }}</span>
      <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0 transition-transform"
           :class="expanded ? 'rotate-180' : ''" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Kroppen henger UNDER pilla og er ute av flyten, forankret i høyre kant,
         så raden beholder bredden sin. `touch-pan-y` + `overscroll-contain`:
         uten dem forplanter et drag som treffer enden av lista seg til
         3D-lerretet og dreier kameraet under fingeren. -->
    <div v-if="expanded" id="tour3d-poi-kropp"
         class="absolute right-0 top-full mt-1.5 w-max overflow-y-auto overscroll-contain
                touch-pan-y rounded-md bg-emerald-700 text-white text-[0.6875rem]
                font-medium shadow-lg px-3 py-2"
         :style="{ maxWidth: props.maksBredde, maxHeight: props.maksHoyde }">
      <div class="flex items-center gap-3">
        <div class="text-[0.5625rem] uppercase tracking-wide text-emerald-100/90 flex-1">
          {{ tittel }}
        </div>
        <button @click="setAll(!allOn)"
                class="bg-ink/15 rounded px-1.5 py-0.5 text-[0.625rem] font-medium
                       shrink-0 active:scale-95">
          {{ allOn ? 'Ingen' : 'Alle' }}
        </button>
      </div>

      <div class="mt-1.5 flex flex-col gap-0.5">
        <!-- Avkryssings-semantikk: raden ER en avkryssingsboks (rute + hake),
             og uten role/aria-checked annonseres den som en vanlig knapp der
             ingenting sier om lagets nåler vises. -->
        <button v-for="g in visibleGroups" :key="g.key"
                @click="toggle(g.key)"
                role="checkbox" :aria-checked="!!modelValue[g.key]"
                class="flex items-center gap-2 rounded px-1 py-1 text-left active:scale-[0.98]"
                :class="modelValue[g.key] ? 'bg-ink/10' : 'opacity-55'">
          <span class="w-3.5 h-3.5 shrink-0 rounded-sm border border-white/70
                       flex items-center justify-center"
                :class="modelValue[g.key] ? 'bg-white' : ''">
            <svg v-if="modelValue[g.key]" viewBox="0 0 24 24" class="w-3 h-3 text-emerald-700"
                 fill="none" stroke="currentColor" stroke-width="3.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="4 12 10 18 20 6"/>
            </svg>
          </span>
          <!-- `leading-snug` og ingen `truncate`: ved 200 % tekst brekker
               «Kulturminner» til to linjer, og en klippet merkelapp sier ikke
               hvilket lag man skrur av. Kroppen er et nedtrekk med eget tak,
               så en linje til koster ingen naboer noe. -->
          <span class="flex-1 min-w-0 leading-snug">{{ g.label }}</span>
          <span class="text-[0.625rem] text-emerald-100/85 tabular-nums shrink-0">
            {{ counts[g.key] ?? 0 }}
          </span>
        </button>
      </div>

      <div v-if="loading" class="mt-1 text-[0.625rem] text-emerald-100/80 leading-snug">
        Henter kulturminner og målestasjoner …
      </div>
    </div>
  </div>
</template>

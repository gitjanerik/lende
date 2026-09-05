<script setup>
// POI-filter for begge 3D-modusene: i utforskeren styrer det hvilke
// knappenåler som står i terrenget, i turvisningen hvilke severdigheter turen
// stopper ved. Samme valg, samme lager — det er én innstilling i brukerens
// hode. Grønn toast-stil og minimer/utvid som «Følger rute»-panelet i
// MapModeChips: pille med chevron ned minimert, kort med chevron opp åpen.
// Ligger oppe til høyre, på samme linje som Info-pilla til venstre.
//
// Valgene lagres lokalt så de holder seg mellom økter; et filter man må sette
// på nytt hver gang er i praksis et filter man slutter å bruke.
import { ref, computed, watch } from 'vue'

const props = defineProps({
  groups: { type: Array, required: true },      // PIN_GROUPS
  counts: { type: Object, default: () => ({}) },
  modelValue: { type: Object, required: true }, // { [key]: boolean }
  loading: { type: Boolean, default: false },
  // Hva valgene heter i denne modusen: nåler i utforskeren, severdigheter i
  // turvisningen. Samme filter, ulikt utfall — og da skal overskriften si det.
  tittel: { type: String, default: 'Knappenåler' },
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
  <div v-if="visibleGroups.length" class="on-accent max-w-full sm:max-w-xs">
    <button v-if="!expanded" @click="expanded = true"
            :aria-label="`Vis filter for ${tittel.toLowerCase()}`"
            class="flex items-center gap-1.5 rounded-full bg-emerald-700 text-white
                   text-[0.6875rem] font-semibold shadow-lg pl-3 pr-2 py-1.5 active:scale-[0.97]
                   tabular-nums">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/>
        <circle cx="12" cy="11" r="2.4"/>
      </svg>
      <span>{{ activeCount }}</span>
      <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <div v-else
         class="rounded-md bg-emerald-700 text-white text-[0.6875rem] font-medium shadow-lg
                flex items-start gap-1.5 pl-3 pr-1 py-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <div class="text-[0.5625rem] uppercase tracking-wide text-emerald-100/90 flex-1">
            {{ tittel }}
          </div>
          <button @click="setAll(!allOn)"
                  class="bg-ink/15 rounded px-1.5 py-0.5 text-[0.625rem] font-medium active:scale-95">
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
            <span class="flex-1 min-w-0 truncate">{{ g.label }}</span>
            <span class="text-[0.625rem] text-emerald-100/85 tabular-nums shrink-0">
              {{ counts[g.key] ?? 0 }}
            </span>
          </button>
        </div>

        <div v-if="loading" class="mt-1 text-[0.625rem] text-emerald-100/80">
          Henter kulturminner og målestasjoner …
        </div>
      </div>

      <button @click="expanded = false" aria-label="Minimer"
              class="w-7 h-7 shrink-0 flex items-center justify-center active:scale-90">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 15 12 9 18 15"/>
        </svg>
      </button>
    </div>
  </div>
</template>

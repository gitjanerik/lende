<script setup>
// Drawer-fane «Annotering», skilt ut fra MapView v1.0.8. Symbolvelger,
// synlighet pr type og liste over plasserte annoteringer. annot-composablen
// sendes inn som objekt (.value-idiomet); selectSymbol/labelForAnnotation er
// forelder-logikk (render + persist) og kommer som funksjons-props.
import { ANNOTATION_SYMBOLS } from '../../composables/useMapAnnotations.js'
import AnnotationIcon from '../AnnotationIcon.vue'

defineProps({
  annot: { type: Object, required: true },
  selectSymbol: { type: Function, required: true },
  labelForAnnotation: { type: Function, required: true },
})
</script>

<template>
  <div>
    <div class="space-y-2 mb-3">
      <div class="grid grid-cols-2 gap-2">
        <button v-for="s in ANNOTATION_SYMBOLS" :key="s.code"
                @click="selectSymbol(s.symbolKey)"
                class="px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] transition flex items-center gap-2"
                :class="annot.selectedSymbol.value === s.symbolKey
                        ? 'bg-slate-400/30 border-slate-200/60 text-white'
                        : 'bg-white/5 border-white/10 text-white/70'">
          <AnnotationIcon :symbol-key="s.symbolKey"/>
          {{ s.label }}
        </button>
      </div>
      <div class="flex gap-2 text-[11px] text-white/55">
        <span>{{ annot.annotations.value.length }} symbol(er)</span>
        <button v-if="annot.annotations.value.length"
                @click="annot.clearAll(); annot.persist()"
                class="ml-auto text-red-300 active:text-red-100">Slett alle</button>
      </div>
    </div>

    <!-- Lay-toggles pr type — kun synlig når noe er plassert -->
    <template v-if="annot.annotations.value.length">
      <div class="text-white/55 text-[11px] uppercase tracking-wide mb-2">Synlighet pr type</div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <button v-for="s in ANNOTATION_SYMBOLS.filter(x => annot.countByType.value[x.symbolKey] > 0)"
                :key="s.code"
                @click="annot.toggleTypeVisibility(s.symbolKey)"
                class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition
                       flex items-center gap-2"
                :class="annot.visibleTypes.value.has(s.symbolKey)
                        ? 'bg-slate-400/25 border-slate-300/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/45'">
          <AnnotationIcon :symbol-key="s.symbolKey"/>
          <span class="text-[12px]">{{ s.label }} ({{ annot.countByType.value[s.symbolKey] }})</span>
        </button>
      </div>

      <div class="text-white/55 text-[11px] uppercase tracking-wide mb-2">Alle plasserte</div>
      <div class="space-y-1 mb-2 max-h-56 overflow-y-auto pr-1">
        <div v-for="a in annot.annotations.value" :key="a.id"
             class="flex items-center gap-2 px-2.5 py-1.5 rounded-md
                    bg-white/5 border border-white/10 text-white/75">
          <AnnotationIcon :symbol-key="labelForAnnotation(a).symbolKey"/>
          <span class="text-[12px] flex-1 truncate">{{ labelForAnnotation(a).label }}</span>
          <span class="text-[10px] text-white/35 tabular-nums shrink-0">
            {{ Math.round(a.x) }},&nbsp;{{ Math.round(a.y) }}
          </span>
          <button @click="annot.remove(a.id); annot.persist()"
                  class="w-6 h-6 flex items-center justify-center rounded-md
                         text-white/55 active:scale-90 active:bg-rose-500/20
                         active:text-rose-200 shrink-0"
                  aria-label="Slett annotering">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </template>
    <div v-else class="text-[10px] text-white/40 leading-snug">
      Velg et symbol over og tap på kartet for å plassere.
    </div>
  </div>
</template>

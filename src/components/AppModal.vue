<script setup>
import { ref, watch, nextTick } from 'vue'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import { useFokusFelle } from '../composables/useFokusFelle.js'
import TekstStorrelseKnapp from './TekstStorrelseKnapp.vue'

// Felles modal-skall for «sidene» hovedmenyen åpner (Om appen, Tegnforklaring …).
// De var egne ruter: menyen lukket seg, og veien tilbake gikk via nettleserens
// tilbake-knapp — med en vestigial header og hamburger-ikon øverst til venstre
// som ikke hørte til noe sted. Som modal holder ESC eller X, og du lander i
// menyen slik du forlot den.
//
// Bredde: full bredde på mobil og stående nettbrett, men aldri bredere enn
// stående nettbrett (700 px) — en tekstspalte over hele en 27-tommer er ulesbar.
//
// Escape håndteres av EIEREN (AppMenu), ikke her: to uavhengige lyttere ville
// lukket både modalen og menyen på samme tastetrykk. Eieren lukker øverste lag.

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  // Lar innholdet male sin egen flate når det har eget fargesystem
  // (Tegnforklaringen følger kartets ISOM-tema, ikke UI-temaet).
  bodyClass: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const { uiTextScale } = useUiTextScale()
const closeBtnRef = ref(null)
const scrollerRef = ref(null)
const dialogRef = ref(null)

// Tab skal ikke vandre ut i sida under — den er fortsatt der, bare dekket. Og
// fokus skal tilbake dit det kom fra når modalen lukkes, ellers starter neste
// Tab på toppen av dokumentet.
useFokusFelle(dialogRef, () => props.open, { forsteFokus: () => closeBtnRef.value })

// Flytt fokus til lukke-knappen ved åpning, og start alltid øverst — modalen
// gjenbrukes, så uten dette hadde forrige scroll-posisjon hengt igjen.
watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  if (scrollerRef.value) scrollerRef.value.scrollTop = 0
  closeBtnRef.value?.focus({ preventScroll: true })
})
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="props.open" class="fixed inset-0 z-[210] bg-black/60" @click="emit('close')" />
  </Transition>

  <Transition name="modal-pop">
    <div v-if="props.open"
         class="fixed inset-0 z-[211] flex items-center justify-center p-3 pointer-events-none"
         :style="{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
                   paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">
      <div ref="dialogRef" class="kart-ui pointer-events-auto w-full max-w-[700px] max-h-full flex flex-col
                  rounded-2xl bg-modal text-ink shadow-2xl ring-1 ring-ink/10 overflow-hidden"
           role="dialog" aria-modal="true" :aria-label="props.title">
        <div class="shrink-0 px-4 py-3 flex items-center gap-3 border-b border-ink/10">
          <h2 class="text-lg font-semibold flex-1 min-w-0 truncate text-ink">{{ props.title }}</h2>
          <slot name="header" />
          <!-- Tekststørrelse for kroppen under. Den står i HEADEREN, altså
               utenfor `zoom`-flaten, og vokser derfor ikke med sin egen effekt. -->
          <TekstStorrelseKnapp />
          <button ref="closeBtnRef" type="button" @click="emit('close')" aria-label="Lukk"
                  class="w-9 h-9 rounded-full flex items-center justify-center bg-ink/10
                         text-ink-2 active:scale-95 transition shrink-0">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div ref="scrollerRef" class="flex-1 min-h-0 overflow-y-auto" :class="props.bodyClass"
             :style="{ zoom: uiTextScale }">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal-pop-enter-active, .modal-pop-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.modal-pop-enter-from, .modal-pop-leave-to { opacity: 0; transform: scale(0.97); }

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active, .modal-fade-leave-active,
  .modal-pop-enter-active, .modal-pop-leave-active { transition: none; }
}
</style>

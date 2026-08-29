<script setup>
import { computed } from 'vue'
import { useLongPress } from '../composables/useLongPress.js'

// Fritt lendes eneste kontroll. Ett begrep — «hent meg hit» — som bruker det
// billigste midlet situasjonen tillater: panorere hvis mulig, bygge hvis ikke.
//
// Egen komponent og ikke FabCluster med tom `satellites`: den emitter `chat` på
// tap når det ikke finnes knotter (FabCluster.vue), og hold-semantikken der er
// en annen. Fyllringen og useLongPress arves derimot verbatim — ringen er
// affordansen som gjør holdet trygt, fordi den viser at noe er i ferd med å
// skje og at et tidlig slipp avbryter det.
//
// 56 px og ikke appens vanlige 48: dette er den ENESTE kontrollen på skjermen,
// og den brukes med kalde eller behanskede fingre.
const props = defineProps({
  etikett: { type: String, required: true },
  // 'bygg' | 'sentrer' | 'start-gps' | 'start-gps-og-bygg' | null
  handling: { type: String, default: null },
  bygger: { type: Boolean, default: false },
  utenforArket: { type: Boolean, default: false },
  venterPaaFix: { type: Boolean, default: false },
  offline: { type: Boolean, default: false },
})
const emit = defineEmits(['tap', 'hold'])

const HOLD_MS = 700
const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

const press = useLongPress({
  holdMs: HOLD_MS,
  // Holdet er bare armert når det har en egen betydning. Står tapet allerede
  // for bygging (utenfor arket, eller intet ark ennå), ville et hold gjort
  // nøyaktig det samme — og en ring som lover noe nytt og leverer det samme er
  // verre enn ingen ring.
  armed: () => !props.bygger && !props.utenforArket,
  onTap: () => { if (!props.bygger) emit('tap') },
  onHold: () => { if (!props.bygger) emit('hold') },
})

const ringOffset = computed(() => RING_C * (1 - press.holdProgress.value))
// Aksentring når et trykk bygger et nytt ark — knappen skal se annerledes ut
// FØR man trykker, ikke forklare seg etterpå.
const byggerNytt = computed(() => props.handling === 'bygg' || props.handling === 'start-gps-og-bygg')
</script>

<template>
  <button type="button"
          :aria-label="etikett"
          :disabled="bygger"
          @pointerdown="press.onPointerDown($event)"
          @pointermove="press.onPointerMove($event)"
          @pointerup="press.onPointerUp()"
          @pointercancel="press.onPointerCancel()"
          class="absolute bottom-4 right-4 z-30 w-14 h-14 rounded-full
                 bg-overlay shadow-lg touch-none transition
                 active:scale-95 disabled:opacity-50"
          :class="byggerNytt ? 'ring-2 ring-amber-400' : 'ring-1 ring-ink/15'">
    <!-- Siktekors: prikk, ring og fire streker. Utenfor arket får det et
         pluss-merke, så knappen SIER at den lager noe nytt. -->
    <svg viewBox="0 0 34 34" class="absolute inset-0 m-auto w-7 h-7 text-ink"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         aria-hidden="true">
      <path d="M17 2 V8 M17 26 V32 M2 17 H8 M26 17 H32" />
      <circle cx="17" cy="17" r="7" :class="venterPaaFix ? 'animate-pulse' : ''" />
      <circle v-if="!byggerNytt" cx="17" cy="17" r="2.4" fill="currentColor" stroke="none" />
      <path v-else d="M17 13.5 V20.5 M13.5 17 H20.5" stroke-width="2.4" />
    </svg>

    <!-- Sky med strek: nettleseren sier offline. Et varsel, ikke en sperre —
         brukeren kan vite bedre enn OS-et (portalen ble nettopp løst). -->
    <svg v-if="offline" viewBox="0 0 24 24"
         class="absolute -top-0.5 -right-0.5 w-4 h-4 text-ink/70"
         fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-overlay, #fff)" stroke="none" />
      <path d="M6 15h10a3 3 0 0 0 .4-6A5 5 0 0 0 7.2 9.6" />
      <path d="M4 4 20 20" />
    </svg>

    <svg v-if="press.isHolding.value" viewBox="0 0 56 56"
         class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <circle cx="28" cy="28" :r="RING_R" fill="none" stroke="#ffd84a" stroke-width="3"
              stroke-linecap="round" :stroke-dasharray="RING_C"
              :stroke-dashoffset="ringOffset" transform="rotate(-90 28 28)" />
    </svg>
  </button>
</template>

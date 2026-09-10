<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// FunksjonDrawer — bunn-arket en FUNKSJON får når den trenger et panel (v6.6.0).
//
// Måling, Sporing og Annotering bodde som faner i innstillings-skuffen, ved
// siden av Kartlag og Eksport. Det var to ulike ting i samme fane-rad: noe som
// STILLER INN kartet, og noe man GJØR med det — og prisen var at man måtte
// gjennom «Innstillinger» for å måle en avstand. Nå er de snarveier, og hver av
// dem åpner sitt eget ark her.
//
// Arket er BEVISST likt punkt-arket: samme starthøyde (45 % av viewporten),
// samme dra-håndtak med maksimer opp / minimer ned, samme header med
// tekststørrelse og lukk. Det er den etablerte formen i appen, og en funksjon
// som ser ut som noe annet leses som noe annet.
//
// HÅNDTAKET ER EN EKTE KNAPP (samme regel som innstillings-skuffen, v6.5.48):
// et trykk minimerer/utvider, pil opp/ned flytter ett hakk i snap-rekka. Uten
// det er høyden på arket en ren peker-egenskap.
// ─────────────────────────────────────────────────────────────────────────────
import { watch, onBeforeUnmount } from 'vue'
import SkuffHeader from './SkuffHeader.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  // useDraggableDrawer-instans — eies av kalleren, som også kan lukke arket.
  drawer: { type: Object, required: true },
  etikett: { type: String, required: true },
  tittel: { type: String, default: '' },
  uiTextScale: { type: Number, default: 1 },
})
const emit = defineEmits(['lukk'])

// ESCAPE LUKKER ARKET. Uten den er X-en og et drag nedover eneste vei ut —
// altså ingen vei ut fra tastatur (samme luke innstillings-skuffen hadde).
// Lytteren henges på mens arket står åpent og tas av igjen, så et Escape i
// kartet ikke lukker et ark som ikke er der.
function onKey(e) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  emit('lukk')
}
watch(() => props.open, (apen) => {
  if (apen) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open"
         class="absolute inset-0 z-40 flex items-end justify-center transition-colors duration-200"
         :class="drawer.isMaximized.value ? 'bg-black/60' : 'bg-transparent pointer-events-none'"
         @click.self="$emit('lukk')">
      <div class="drawer-shell bg-surface border-t border-ink/10 rounded-t-2xl flex flex-col pointer-events-auto"
           :style="drawer.drawerHeightStyle.value">
        <button type="button"
                class="shrink-0 w-full touch-none cursor-grab active:cursor-grabbing
                       py-3 flex justify-center"
                :aria-label="drawer.isMinimized.value ? `Utvid ${etikett}` : `Minimer ${etikett}`"
                :aria-expanded="!drawer.isMinimized.value"
                @click="drawer.setMinimized(!drawer.isMinimized.value)"
                @keydown.up.prevent="drawer.stegSnap(-1)"
                @keydown.down.prevent="drawer.stegSnap(1)"
                @pointerdown="drawer.onPointerDown($event)"
                @pointermove="drawer.onPointerMove($event)"
                @pointerup="drawer.onPointerUp($event)"
                @pointercancel="drawer.onPointerUp($event)">
          <span class="w-12 h-1.5 rounded-full bg-ink/40"
                :style="{ opacity: drawer.handleOpacity.value }"></span>
        </button>

        <SkuffHeader :etikett="etikett" :tittel="tittel" :ui-text-scale="uiTextScale"
                     :lukk-tekst="`Lukk ${etikett}`" @lukk="$emit('lukk')">
          <template #under><slot name="under" /></template>
        </SkuffHeader>

        <div v-show="!drawer.isMinimized.value"
             class="flex-1 overflow-y-auto px-4 pt-3"
             :style="{ zoom: uiTextScale,
                       paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)' }">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

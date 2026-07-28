<script setup>
import { ref, computed, watch } from 'vue'
import { useAppMenu } from '../composables/useAppMenu.js'

// Trigger for den globale hovedmenyen. Tre streker (hamburger) som animeres til
// et kryss (X) når menyen er åpen. Deler tilstand med AppMenu via useAppMenu.
// Den ER lukkekontrollen — skuffen har ingen egen X.
//
// variant styrer knappe-skallet så den matcher de to eksisterende chrome-stilene:
//   'float'  — flytende mørk knapp oppå kartet (MapView)
//   'header' — lettere knapp i en topprad (forside, planlegger, m.fl.)
//
// v2.4.18 — hvorfor Teleport: knappen ligger inne i visningenes topprader, som
// har egne z-index-er (z-30 o.l.) og dermed egne stacking contexts. Et barn kan
// ikke klatre ut av forelderens kontekst, så uansett hvor høy z-index knappen
// fikk, gled skuffen (z-201) OVER den — animasjonen ble borte midtveis. Mens
// menyen er åpen flyttes derfor SAMME knapp-element til <body> med fixed
// posisjon; Vue gjenbruker elementet, så CSS-transisjonen på strekene fortsetter
// uavbrutt gjennom flyttingen. Plassholderen beholder plassen i toppraden.

const props = defineProps({
  variant: { type: String, default: 'header' },
})

const { menuOpen, toggle } = useAppMenu()

const slotRef = ref(null)
const pos = ref(null)

// Måles FØR render (flush: 'pre'), mens plassholderen ennå står der den skal —
// ellers ville knappen fått `fixed` uten koordinater i én frame og hoppet.
watch(menuOpen, (open) => {
  if (!open) { pos.value = null; return }
  const r = slotRef.value?.getBoundingClientRect()
  if (r) pos.value = { top: `${Math.round(r.top)}px`, left: `${Math.round(r.left)}px` }
})

const sizeClass = computed(() => (props.variant === 'float' ? 'w-10 h-10' : 'w-9 h-9'))
const skinClass = computed(() => (props.variant === 'float'
  ? 'bg-overlay text-ink shadow-lg'
  : 'bg-ink/5 border border-ink/10 text-ink/70'))
</script>

<template>
  <!-- Plassholder: holder plassen i toppraden også mens knappen er teleportert. -->
  <span ref="slotRef" class="inline-flex shrink-0" :class="sizeClass">
    <!-- z-[205] ligger over skuffen (201) og backdropen (200), men UNDER modalene
         (210/211) — ellers hadde hamburgeren flytt oppå «Om Så i lende» og
         «Tegnforklaring» og dekket tittelen deres på mobil. -->
    <Teleport to="body" :disabled="!menuOpen">
      <button
        @click="toggle"
        :aria-label="menuOpen ? 'Lukk meny' : 'Åpne meny'"
        :aria-expanded="menuOpen"
        class="flex items-center justify-center rounded-full shrink-0
               active:scale-95 transition"
        :class="[sizeClass, skinClass, menuOpen ? 'fixed z-[205]' : 'relative']"
        :style="menuOpen && pos ? pos : null">
        <span class="relative block" :class="variant === 'float' ? 'w-[18px] h-[14px]' : 'w-4 h-3'">
          <span class="menu-bar" :class="{ 'menu-bar-top-open': menuOpen }" style="top: 0" />
          <span class="menu-bar" :class="{ 'menu-bar-mid-open': menuOpen }" style="top: 50%; margin-top: -1px" />
          <span class="menu-bar" :class="{ 'menu-bar-bot-open': menuOpen }" style="bottom: 0" />
        </span>
      </button>
    </Teleport>
  </span>
</template>

<style scoped>
.menu-bar {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transition: transform 0.25s ease, opacity 0.2s ease;
  transform-origin: center;
}
.menu-bar-top-open {
  top: 50% !important;
  margin-top: -1px;
  transform: rotate(45deg);
}
.menu-bar-mid-open {
  opacity: 0;
}
.menu-bar-bot-open {
  bottom: auto !important;
  top: 50%;
  margin-top: -1px;
  transform: rotate(-45deg);
}
</style>

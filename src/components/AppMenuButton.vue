<script setup>
import { useAppMenu } from '../composables/useAppMenu.js'

// Trigger for den globale hovedmenyen. Tre streker (hamburger) som animeres til
// et kryss (X) når menyen er åpen. Deler tilstand med AppMenu via useAppMenu.
//
// variant styrer knappe-skallet så den matcher de to eksisterende chrome-stilene:
//   'float'  — flytende mørk knapp oppå kartet (MapView)
//   'header' — lettere knapp i en topprad (forside, planlegger, m.fl.)

defineProps({
  variant: { type: String, default: 'header' },
})

const { menuOpen, toggle } = useAppMenu()
</script>

<template>
  <button
    @click="toggle"
    :aria-label="menuOpen ? 'Lukk meny' : 'Åpne meny'"
    :aria-expanded="menuOpen"
    class="relative flex items-center justify-center rounded-full shrink-0 active:scale-95 transition"
    :class="variant === 'float'
      ? 'w-10 h-10 bg-zinc-950 text-white shadow-lg'
      : 'w-9 h-9 bg-white/5 border border-white/10 text-white/70'">
    <span class="relative block" :class="variant === 'float' ? 'w-[18px] h-[14px]' : 'w-4 h-3'">
      <span class="menu-bar" :class="{ 'menu-bar-top-open': menuOpen }" style="top: 0" />
      <span class="menu-bar" :class="{ 'menu-bar-mid-open': menuOpen }" style="top: 50%; margin-top: -1px" />
      <span class="menu-bar" :class="{ 'menu-bar-bot-open': menuOpen }" style="bottom: 0" />
    </span>
  </button>
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

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAppMenu } from '../composables/useAppMenu.js'

// Trigger for den globale hovedmenyen. Tre streker (hamburger) som animeres til
// et kryss (X) når menyen er åpen. Deler tilstand med AppMenu via useAppMenu.
// Den ER lukkekontrollen — skuffen har ingen egen X.
//
// variant styrer knappe-skallet så den matcher de to eksisterende chrome-stilene:
//   'float'  — flytende mørk knapp oppå kartet (MapView, planleggeren)
//   'header' — lettere knapp i en topprad (forsiden)
//
// v2.4.27 — hvorfor knappen ALLTID er teleportert og ALLTID fixed:
// Z-index var aldri problemet, og å flytte knappen ved åpning var ikke løsningen.
// Bakgrunn: knappen ligger i visningenes topprader, som har egne z-index-er
// (z-20/z-30) og dermed egne stacking contexts — et barn kan ikke klatre ut av
// forelderens kontekst, så uansett hvor høy z-index knappen fikk, gled skuffen
// (z-201) over den. v2.4.18 løste synligheten ved å teleportere knappen til
// <body> i det menyen åpnet — men da forsvant animasjonen: å flytte et element i
// DOM-en kobler det fra dokumentet og setter det inn igjen, og da kanselleres
// alle løpende CSS-transisjoner. Strekene hoppet rett til kryss.
//
// Derfor: knappen monteres ÉN gang i <body> og blir liggende der. Den er alltid
// `fixed`, plassert på koordinatene til plassholderen som holder plassen i
// toppraden. Åpning/lukking endrer da BARE klasser på de tre strekene — ingen
// DOM-flytting, ingen posisjonsbytte, og transisjonen får gå uforstyrret.
// Bonus: siden knappen permanent bor i body sin stacking context, virker
// z-[205] faktisk (over backdrop 200 og skuff 201, under modalene 210/211).
//
// All bevegelse ligger i `transform` (translateY + rotate i samme funksjonsliste)
// i stedet for i top/bottom. Den gamle CSS-en byttet `top`/`bottom` momentant og
// animerte bare rotasjonen, så øverste strek teleporterte til midten og roterte
// etterpå — det var den andre halvparten av «glippen».

const props = defineProps({
  variant: { type: String, default: 'header' },
})

const { menuOpen, toggle } = useAppMenu()

const slotRef = ref(null)
const pos = ref(null)

// Plassholderen ligger alltid i flyten, så den kan måles når som helst.
// Toppradene på alle tre kallstedene er viewport-stabile (sticky top-0 på
// forsiden, absolute top-0 i de to kartvisningene), derfor trengs ingen
// scroll-lytter — bare størrelse/vindu-endringer kan flytte knappen.
function measure() {
  const r = slotRef.value?.getBoundingClientRect()
  if (r) pos.value = { top: `${Math.round(r.top)}px`, left: `${Math.round(r.left)}px` }
}

let ro = null
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measure)
  window.visualViewport?.addEventListener('resize', measure)
  if (typeof ResizeObserver !== 'undefined' && slotRef.value) {
    ro = new ResizeObserver(measure)
    ro.observe(slotRef.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('orientationchange', measure)
  window.visualViewport?.removeEventListener('resize', measure)
  ro?.disconnect()
})

const isFloat = computed(() => props.variant === 'float')
const sizeClass = computed(() => (isFloat.value ? 'w-10 h-10' : 'w-9 h-9'))
const skinClass = computed(() => (isFloat.value
  ? 'bg-overlay text-ink shadow-lg'
  : 'bg-ink/5 border border-ink/10 text-ink-2'))
</script>

<template>
  <!-- Plassholder: holder plassen i toppraden, og er målepunktet knappen følger. -->
  <span ref="slotRef" class="inline-flex shrink-0" :class="sizeClass">
    <Teleport to="body">
      <button
        @click="toggle"
        :aria-label="menuOpen ? 'Lukk meny' : 'Åpne meny'"
        data-hovedmeny-knapp
        :aria-expanded="menuOpen"
        class="fixed z-[205] flex items-center justify-center rounded-full shrink-0
               active:scale-95 transition"
        :class="[sizeClass, skinClass, { 'is-open': menuOpen, invisible: !pos }]"
        :style="pos">
        <span class="menu-bars" :class="{ 'menu-bars-lg': isFloat }">
          <span class="menu-bar bar-top" />
          <span class="menu-bar bar-mid" />
          <span class="menu-bar bar-bot" />
        </span>
      </button>
    </Teleport>
  </span>
</template>

<style scoped>
.menu-bars {
  position: relative;
  display: block;
  width: 16px;
  height: 12px;
  --bar-gap: 5px;
}
.menu-bars-lg {
  width: 18px;
  height: 14px;
  --bar-gap: 6px;
}

/* Alle tre strekene er sentrert; avstanden mellom dem er en translateY. Da er
   både spredning og rotasjon deler av SAMME transform-liste, og begge
   interpoleres — i motsetning til top/bottom, som bare kan hoppe. */
.menu-bar {
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  height: 2px;
  margin-top: -1px;
  border-radius: 2px;
  background: currentColor;
  transform-origin: center;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease;
}
.bar-top { transform: translateY(calc(-1 * var(--bar-gap))) rotate(0deg) scaleX(1); }
.bar-mid { transform: translateY(0) rotate(0deg) scaleX(1); }
.bar-bot { transform: translateY(var(--bar-gap)) rotate(0deg) scaleX(1); }

.is-open .bar-top { transform: translateY(0) rotate(45deg) scaleX(1); }
.is-open .bar-mid { transform: translateY(0) rotate(0deg) scaleX(0.3); opacity: 0; }
.is-open .bar-bot { transform: translateY(0) rotate(-45deg) scaleX(1); }

@media (prefers-reduced-motion: reduce) {
  .menu-bar { transition: none; }
}
</style>

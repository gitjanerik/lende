<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useAppMenu } from '../composables/useAppMenu.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import { useHoldVaken } from '../composables/useHoldVaken.js'
import { ringDash } from '../lib/holdVaken.js'

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

// HAMBURGEREN FØLGER TEKSTSTØRRELSEN — MEN BARE SOM `float` (v7.6.0). Over
// kartet er den en av de tre faste runde knappene, og der finnes det ingen
// tekst i det hele tatt: ikonet ER kontrollen, og den som skrur opp til 200 %
// fordi etikettene er for små trenger også en større trykkflate. Samme grep
// som snarveiene, søket, kompasset og Lende-knappen.
//
// `header`-varianten skalerer IKKE, og det er ikke en forglemmelse. Den står i
// en topprad ved siden av en overskrift som ikke skalerer, på en side der
// tekstvalget allerede slår gjennom i innholdet under. En 72 px hamburger ved
// siden av en 15 px tittel er ikke den samme kontrollen gjort større — det er
// en rad som er gått i stykker.
//
// KOORDINATEN MÅ DELES PÅ SKALAEN, og det er ikke valgfritt. Knappen er
// `position: fixed` med `top`/`left` fra plassholderens rect — altså ekte
// skjermpiksler — men `zoom` multipliserer nettopp de brukte verdiene. Uten
// divisjonen havner knappen dobbelt så langt ned og inn ved 200 %.
// Plassholderen zoomes også, så toppraden reserverer den plassen knappen
// faktisk tar.
const { uiTextScale } = useUiTextScale()
// TDZ-regelen (se CLAUDE.md): `const` er ikke hoistet, og `watch(skala, …)`
// under leser den ved oppsett — derfor står den her og ikke nede ved
// `isFloat`, der den ellers ville hørt hjemme.
const skala = computed(() => (props.variant === 'float' ? uiTextScale.value || 1 : 1))

// «Hold skjermen våken» har ingen egen knapp og ingen tekst — den vises som en
// gul ring rundt hamburgeren, og ringen ER indikatoren (v6.6.4). Den ligger her
// og ikke i menyen fordi menyen er lukket i det man går: nedtellingen må kunne
// leses av på skjermen man faktisk har foran seg. Fargen og streken er
// FAB-knottenes hold-ring (#ffd84a, 3 px), så en gul ring betyr det samme to
// steder i appen: «noe holder på nå».
const holdVaken = useHoldVaken()
const RING_R = 22.5
const RING_C = 2 * Math.PI * RING_R
const ring = computed(() => ringDash(holdVaken.andel.value, RING_C))

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

// OBSERVEREN MÅ SE FORELDRENE OG IKKE BARE PLASSHOLDEREN (v7.1.0).
// Plassholderen er 40 × 40 px og endrer ALDRI størrelse — så en observer på
// den alene fyrer én gang ved oppstart og aldri mer. Det holdt så lenge
// knappen sto i en topprad som spente hele bredden: da flyttet den seg bare
// når vinduet gjorde det. Fra v7.1.0 bor hamburgeren i snarvei-raden, som er
// en midtstilt pille som VOKSER når raden åpnes og krymper i kompakt modus —
// plassholderen flytter seg uten å endre størrelse, og den teleporterte
// knappen ble stående igjen der raden var. Vi observerer derfor hele
// forelderkjeden opp til <body>: en bredde-endring hvor som helst der er
// nettopp det som kan flytte plassholderen sidelengs.
function observerte() {
  const ut = []
  for (let el = slotRef.value; el && el !== document.body; el = el.parentElement) ut.push(el)
  if (document.body) ut.push(document.body)
  return ut
}

let ro = null
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measure)
  window.visualViewport?.addEventListener('resize', measure)
  if (typeof ResizeObserver !== 'undefined' && slotRef.value) {
    ro = new ResizeObserver(measure)
    for (const el of observerte()) ro.observe(el)
  }
})
watch(skala, () => { nextTick(measure) })

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('orientationchange', measure)
  window.visualViewport?.removeEventListener('resize', measure)
  ro?.disconnect()
})

// Ringen er dekorativ (aria-hidden), så nedtellingen må stå i knappens navn —
// ellers er den usynlig for en skjermleser.
const menyLabel = computed(() => {
  const base = menuOpen.value ? 'Lukk meny' : 'Åpne meny'
  if (!holdVaken.aktiv.value) return base
  return `${base}. Skjermen holdes våken i ${holdVaken.igjenMinutter.value} minutter til`
})

const knappStil = computed(() => {
  const z = skala.value
  if (!pos.value) return { zoom: z }
  return {
    zoom: z,
    top: `${Math.round(parseFloat(pos.value.top) / z)}px`,
    left: `${Math.round(parseFloat(pos.value.left) / z)}px`,
  }
})

const isFloat = computed(() => props.variant === 'float')
const sizeClass = computed(() => (isFloat.value ? 'w-10 h-10' : 'w-9 h-9'))
const skinClass = computed(() => (isFloat.value
  ? 'bg-overlay text-ink shadow-lg'
  : 'bg-ink/5 border border-ink/10 text-ink-2'))
</script>

<template>
  <!-- Plassholder: holder plassen i toppraden, og er målepunktet knappen følger. -->
  <span ref="slotRef" data-hovedmeny-plass class="inline-flex shrink-0" :class="sizeClass"
        :style="{ zoom: skala }">
    <Teleport to="body">
      <button
        @click="toggle"
        :aria-label="menyLabel"
        data-hovedmeny-knapp
        :aria-expanded="menuOpen"
        class="fixed z-[205] flex items-center justify-center rounded-full shrink-0
               active:scale-95 transition"
        :class="[sizeClass, skinClass, { 'is-open': menuOpen, invisible: !pos }]"
        :style="knappStil">
        <span class="menu-bars" :class="{ 'menu-bars-lg': isFloat }">
          <span class="menu-bar bar-top" />
          <span class="menu-bar bar-mid" />
          <span class="menu-bar bar-bot" />
        </span>
        <!-- Analog nedtelling: streken spises MED klokka fra toppen
             (`ringDash`). viewBox-en er fast, så samme ring passer både
             float-knappen (40 px) og header-knappen (36 px). -->
        <svg v-if="holdVaken.aktiv.value" viewBox="0 0 48 48"
             class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
             aria-hidden="true">
          <circle cx="24" cy="24" :r="RING_R" fill="none" stroke="#ffd84a" stroke-width="3"
                  stroke-linecap="round" :stroke-dasharray="ring.dasharray"
                  :stroke-dashoffset="ring.dashoffset" transform="rotate(-90 24 24)" />
        </svg>
        <!-- Tallet i hjørnet (v6.6.5). Ringen sier HVOR LANGT det er igjen på
             et blikk; merket sier NØYAKTIG hvor mange minutter. De to er
             komplementære, ikke to utgaver av det samme — en ring alene kan
             ikke skille 4 fra 6 minutter, og et tall alene viser ingen
             bevegelse. Svart på gult er den ene kombinasjonen som holder
             kontrasten uansett om knappen er den mørke flytende eller den lyse
             i toppraden, og `aria-hidden` fordi nedtellingen alt står i
             knappens navn. -->
        <span v-if="holdVaken.aktiv.value" class="vaken-merke" aria-hidden="true">
          {{ holdVaken.igjenMinutter.value }}
        </span>
      </button>
    </Teleport>
  </span>
</template>

<style scoped>
/* Nedtellings-merket. Sitter PÅ kanten (negativ offset) så det leses som et
   merke og ikke som innhold i knappen, og har en ring i knappens egen
   bakgrunnsfarge så det skiller seg fra den gule ringen rett under. */
.vaken-merke {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: #ffd84a;
  color: #000;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

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

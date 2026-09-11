<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// SorterSnarveier — dra-og-slipp-lista bak «Sorter snarveier» (v6.6.0).
//
// REKKEFØLGEN ER IKKE KOSMETIKK. Snarvei-raden viser så mange funksjoner som
// får plass på skjermen og legger resten bak nedtrekket — så det er DENNE lista
// som avgjør hva som er ett trykk unna på en 360 px telefon. Den som alltid går
// med sporing på skal ha Sporing først.
//
// DRAGET ER IKKE ENESTE VEI (SC 2.5.7). Hver rad har opp/ned-knapper som gjør
// nøyaktig det samme, og de er ekte tab-stopp: et dra-og-slipp uten et
// tastatur-alternativ er en funksjon som ikke finnes for den som ikke kan dra.
// Knappene er dessuten det man rekker etter på et lite skjermbilde uansett.
//
// DRAGET FLYTTER INGENTING FØR FINGEREN SLIPPES (v6.6.1), og det er en
// omskriving av v6.6.0. Der sorterte lista seg LIVE under fingeren: raden man
// holdt i sto stille, mens de andre byttet plass rundt den. Eieren meldte at
// han «nesten ikke ser at det har blitt sortert», og det er riktig lest — det
// eneste som beveget seg var de radene man IKKE holdt i, og de hoppet i det
// draget så vidt var begynt. Nå er det motsatt, som i enhver annen liste man
// kan dra i:
//
//   • RADEN MAN HOLDER I FØLGER FINGEREN. Den løftes ut av flyten (skygge,
//     et hakk større) og oversettes med `translateY`. Det er den man ser på.
//   • ET SPØKELSE BLIR IGJEN DER DEN LÅ — en stiplet, tom boks i nøyaktig
//     samme høyde. Uten den kollapser lista i det draget starter, og alt
//     under spretter opp et hakk før man har flyttet noe som helst.
//   • DE ANDRE RADENE GLIR TIL SIDE for å åpne gapet der raden vil lande, én
//     radhøyde av gangen og med overgang. Det er forhåndsvisningen av hva
//     slippet kommer til å gjøre.
//   • SPØKELSET TONES STILLE UT når slippet er commitet (`GHOST_UT_MS`), så
//     man ser hvor raden kom FRA etter at den har landet.
//
// Fordi ingenting flytter seg under draget, er radhøyden konstant hele veien
// og målindeksen ren aritmetikk (`flytteIndeks`). Det var nettopp det den
// gamle utgaven ikke kunne: den måtte lese midtpunktene på nytt for hver
// bevegelse, fordi radene den målte selv flyttet på seg.
//
// INGEN NUMMERERING (v6.6.1). Tallkolonna sa det posisjonen i lista allerede
// sier, og den var det første som måtte vike da knappene skulle få plass ved
// 200 % tekst. Opp/ned er 32 px og ikke 36: 44 px-regelen gjelder knapper som
// står alene på et kart, ikke to naboer i en liste man leser med begge hender.
//
// «VIS NAVN NÅR MINIMERT» STÅR ØVERST (v7.6.0), over lista og ikke under den.
// Panelet handler om RADEN, og bryteren avgjør hvor mange snarveier som får
// plass på den — altså premisset for sorteringen man gjør nedenfor. Den hører
// derfor hjemme her og ikke i Valg-skuffa: det er det ENE stedet i appen der
// man allerede ser på raden som et objekt. Standarden er PÅ; se lib/snarveier.js
// for hvorfor.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed, onBeforeUnmount } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { SNARVEIER, STANDARD_REKKEFOLGE, flyttSnarvei, flytteIndeks } from '../lib/snarveier.js'

const props = defineProps({
  // Ider i gjeldende rekkefølge (alle, også de kart-typen skjuler).
  rekkefolge: { type: Array, required: true },
  // Ider som ikke vises på dette kartet — de står i lista, men merket.
  skjulteIder: { type: Array, default: () => [] },
  // «Vis navn når minimert» (v7.6.0). Eies av MapView og persisteres der.
  visNavn: { type: Boolean, default: true },
})
const emit = defineEmits(['oppdater', 'vis-navn'])

const GHOST_UT_MS = 260

const katalog = new Map(SNARVEIER.map(s => [s.id, s]))
const rader = computed(() => props.rekkefolge.map(id => katalog.get(id)).filter(Boolean))

const listeRef = ref(null)
const drarIdx = ref(-1)   // hvilken rad fingeren holder i
const overIdx = ref(-1)   // hvor den vil lande
const dy = ref(0)         // hvor langt fingeren har flyttet seg
const radSteg = ref(0)    // radhøyde + mellomrom
const ghost = ref(null)   // { topp, hoyde } i listas eget koordinatrom
const ghostUt = ref(false)
let ghostTimer = null

function flytt(fra, til) {
  if (til < 0 || til >= props.rekkefolge.length || fra === til) return
  emit('oppdater', flyttSnarvei(props.rekkefolge, fra, til))
}

let startY = 0
function onPointerDown(e, i) {
  const liste = listeRef.value
  const rad = e.currentTarget.closest('[data-rad]')
  if (!liste || !rad) return
  const rRad = rad.getBoundingClientRect()
  const rListe = liste.getBoundingClientRect()
  const neste = rad.nextElementSibling?.getBoundingClientRect()
  // Steget er radhøyden PLUSS mellomrommet. Måles av naboen når det finnes en
  // — gapet er en CSS-verdi vi ellers måtte holde i takt to steder.
  radSteg.value = neste ? neste.top - rRad.top : rRad.height
  ghost.value = { topp: rRad.top - rListe.top, hoyde: rRad.height }
  ghostUt.value = false
  clearTimeout(ghostTimer)
  drarIdx.value = i
  overIdx.value = i
  startY = e.clientY
  dy.value = 0
  try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
  e.preventDefault()
}

function onPointerMove(e) {
  if (drarIdx.value < 0) return
  dy.value = e.clientY - startY
  overIdx.value = flytteIndeks(drarIdx.value, dy.value, radSteg.value, rader.value.length)
}

function onPointerUp() {
  if (drarIdx.value < 0) return
  const fra = drarIdx.value
  const til = overIdx.value
  drarIdx.value = -1
  overIdx.value = -1
  dy.value = 0
  flytt(fra, til)
  // Spøkelset står igjen et øyeblikk etter slippet og tones ut, så man ser
  // hvor raden kom fra. Det er den ENE tilbakemeldingen på at noe faktisk
  // skjedde når man flytter en rad bare ett hakk.
  ghostUt.value = true
  ghostTimer = setTimeout(() => { ghost.value = null; ghostUt.value = false }, GHOST_UT_MS)
}

onBeforeUnmount(() => clearTimeout(ghostTimer))

/** Forskyvningen som åpner gapet der raden vil lande. */
function radStil(i) {
  if (drarIdx.value < 0) return null
  if (i === drarIdx.value) {
    return { transform: `translateY(${dy.value}px)`, transition: 'none' }
  }
  const fra = drarIdx.value
  const til = overIdx.value
  if (fra < i && i <= til) return { transform: `translateY(${-radSteg.value}px)` }
  if (til <= i && i < fra) return { transform: `translateY(${radSteg.value}px)` }
  return { transform: 'translateY(0)' }
}

function tilbakestill() { emit('oppdater', [...STANDARD_REKKEFOLGE]) }
</script>

<template>
  <div>
    <!-- BRYTEREN FØRST: den avgjør hvor mange snarveier som får plass, altså
         premisset for sorteringen under. Samme vippebryter-form som i
         skuffene — aksentgrønn på, nøytral av. -->
    <label class="flex items-center justify-between gap-3 mb-3 cursor-pointer">
      <span class="text-[12px] text-ink-2 leading-snug">
        Vis navn når minimert
        <span class="block text-[11px] text-ink-4">
          {{ visNavn
            ? 'Navnet står under ikonet hele tiden'
            : 'Bare ikoner — navnene kommer fram når du drar raden ned' }}
        </span>
      </span>
      <button type="button" role="switch" :aria-checked="visNavn"
              @click="emit('vis-navn', !visNavn)"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="visNavn ? 'bg-emerald-500' : 'bg-ink/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="visNavn ? 'left-5' : 'left-0.5'" />
      </button>
    </label>

    <p class="text-[12px] text-ink-3 leading-snug mb-3">
      Dra i grepet for å endre rekkefølgen, eller bruk pilene. Snarveiene som
      ikke får plass på raden legger seg bak håndtaket nederst i raden.
    </p>

    <ul ref="listeRef" class="relative flex flex-col gap-1.5"
        @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
      <!-- SPØKELSET. Absolutt plassert i listas eget rom, så det holder plassen
           uten å være med i flyten — en tom <li> ville flyttet på alle de andre
           i samme øyeblikk som draget startet. -->
      <li v-if="ghost" aria-hidden="true"
          class="sorter-ghost absolute left-0 right-0 rounded-xl border border-dashed
                 border-ink/25 bg-ink/[0.03] pointer-events-none"
          :class="ghostUt ? 'sorter-ghost--ut' : ''"
          :style="{ top: `${ghost.topp}px`, height: `${ghost.hoyde}px` }"></li>

      <li v-for="(s, i) in rader" :key="s.id" data-rad :data-rad-id="s.id"
          class="sorter-rad flex items-center gap-2 rounded-xl border px-2 py-2"
          :class="drarIdx === i
                  ? 'sorter-rad--drar bg-sky-500/20 border-sky-400/60'
                  : 'bg-ink/5 border-ink/10'"
          :style="radStil(i)">
        <!-- Grepet: draget hører til denne flata alene, så en rulling i lista
             ikke starter en flytting man ikke ba om. -->
        <span class="shrink-0 w-8 h-8 -my-0.5 grid place-items-center rounded-lg
                     text-ink-4 touch-none cursor-grab active:cursor-grabbing"
              aria-hidden="true"
              @pointerdown="onPointerDown($event, i)">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/>
          </svg>
        </span>

        <SnarveiIkon :id="s.id" class="w-5 h-5 shrink-0 text-ink-2" />
        <span class="flex-1 min-w-0 truncate text-[13px] text-ink">{{ s.label }}</span>
        <span v-if="skjulteIder.includes(s.id)"
              class="shrink-0 text-[9px] uppercase tracking-wide text-ink-4
                     rounded px-1.5 py-0.5 bg-ink/10">
          ikke her
        </span>

        <button type="button" @click="flytt(i, i - 1)" :disabled="i === 0"
                :aria-label="`Flytt ${s.label} opp`"
                class="shrink-0 w-8 h-8 grid place-items-center rounded-lg
                       border border-ink/10 active:scale-90 transition
                       disabled:opacity-30 disabled:active:scale-100">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 15 12 9 18 15"/>
          </svg>
        </button>
        <button type="button" @click="flytt(i, i + 1)" :disabled="i === rader.length - 1"
                :aria-label="`Flytt ${s.label} ned`"
                class="shrink-0 w-8 h-8 grid place-items-center rounded-lg
                       border border-ink/10 active:scale-90 transition
                       disabled:opacity-30 disabled:active:scale-100">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </li>
    </ul>

    <button type="button" @click="tilbakestill"
            class="mt-4 w-full rounded-xl border border-ink/10 bg-ink/5 py-2
                   text-[12px] text-ink-2 active:scale-[0.98] transition">
      Tilbakestill til standard rekkefølge
    </button>
  </div>
</template>

<style scoped>
/* Radene glir; den man holder i får `transition: none` fra `radStil`, ellers
   ville den hengt etter fingeren. */
.sorter-rad {
  transition: transform 0.18s ease, background-color 0.15s ease, border-color 0.15s ease;
  touch-action: pan-y;
}
/* Løftet: skygge og et hakk større sier «denne er i lufta» uten en eneste
   pikselmåling. `position: relative` + z-index holder den over naboene den
   passerer. */
.sorter-rad--drar {
  position: relative;
  z-index: 20;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  scale: 1.02;
}
.sorter-ghost { transition: opacity 0.26s ease; }
.sorter-ghost--ut { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .sorter-rad, .sorter-ghost { transition: none; }
}
</style>

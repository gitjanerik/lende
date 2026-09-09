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
// DRAGET FLYTTER LISTA LIVE, det viser ingen skygge-plassholder: raden man
// holder i er den som beveger seg, og de andre glir forbi den. Det er den
// billigste varianten som er til å forstå, og den trenger ingen måling av
// noe annet enn radhøydene.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { SNARVEIER, STANDARD_REKKEFOLGE, flyttSnarvei, dropIndeks } from '../lib/snarveier.js'

const props = defineProps({
  // Ider i gjeldende rekkefølge (alle, også de kart-typen skjuler).
  rekkefolge: { type: Array, required: true },
  // Ider som ikke vises på dette kartet — de står i lista, men merket.
  skjulteIder: { type: Array, default: () => [] },
})
const emit = defineEmits(['oppdater'])

const katalog = new Map(SNARVEIER.map(s => [s.id, s]))
const rader = computed(() => props.rekkefolge.map(id => katalog.get(id)).filter(Boolean))

const listeRef = ref(null)
const drarIdx = ref(-1)

function flytt(fra, til) {
  if (til < 0 || til >= props.rekkefolge.length || fra === til) return
  emit('oppdater', flyttSnarvei(props.rekkefolge, fra, til))
}

function onPointerDown(e, i) {
  drarIdx.value = i
  try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
  e.preventDefault()
}
function onPointerMove(e) {
  if (drarIdx.value < 0) return
  const liste = listeRef.value
  if (!liste) return
  // Midtpunktene leses på nytt for hver bevegelse: lista flytter seg mens man
  // drar, så et snapshot fra pointerdown ville pekt på gårsdagens plasser.
  const sentre = [...liste.querySelectorAll('[data-rad]')]
    .map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
  const til = dropIndeks(sentre, e.clientY)
  if (til !== drarIdx.value) {
    flytt(drarIdx.value, til)
    drarIdx.value = til
  }
}
function onPointerUp() { drarIdx.value = -1 }

function tilbakestill() { emit('oppdater', [...STANDARD_REKKEFOLGE]) }
</script>

<template>
  <div>
    <p class="text-[12px] text-ink-3 leading-snug mb-3">
      Dra i grepet for å endre rekkefølgen, eller bruk pilene. Snarveiene som
      ikke får plass på raden legger seg bak pila lengst til høyre.
    </p>

    <ul ref="listeRef" class="flex flex-col gap-1.5"
        @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
      <li v-for="(s, i) in rader" :key="s.id" data-rad
          class="flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors"
          :class="drarIdx === i
                  ? 'bg-sky-500/15 border-sky-400/50'
                  : 'bg-ink/5 border-ink/10'">
        <!-- Grepet: draget hører til denne flata alene, så en rulling i lista
             ikke starter en flytting man ikke ba om. -->
        <span class="shrink-0 w-9 h-9 -my-0.5 grid place-items-center rounded-lg
                     text-ink-4 touch-none cursor-grab active:cursor-grabbing"
              aria-hidden="true"
              @pointerdown="onPointerDown($event, i)">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/>
          </svg>
        </span>

        <span class="shrink-0 w-6 text-[11px] tabular-nums text-ink-4">{{ i + 1 }}.</span>
        <SnarveiIkon :id="s.id" class="w-5 h-5 shrink-0 text-ink-2" />
        <span class="flex-1 min-w-0 truncate text-[13px] text-ink">{{ s.label }}</span>
        <span v-if="skjulteIder.includes(s.id)"
              class="shrink-0 text-[9px] uppercase tracking-wide text-ink-4
                     rounded px-1.5 py-0.5 bg-ink/10">
          ikke her
        </span>

        <button type="button" @click="flytt(i, i - 1)" :disabled="i === 0"
                :aria-label="`Flytt ${s.label} opp`"
                class="shrink-0 w-9 h-9 grid place-items-center rounded-lg
                       border border-ink/10 active:scale-90 transition
                       disabled:opacity-30 disabled:active:scale-100">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 15 12 9 18 15"/>
          </svg>
        </button>
        <button type="button" @click="flytt(i, i + 1)" :disabled="i === rader.length - 1"
                :aria-label="`Flytt ${s.label} ned`"
                class="shrink-0 w-9 h-9 grid place-items-center rounded-lg
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

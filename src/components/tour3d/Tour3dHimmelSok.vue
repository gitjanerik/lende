<script setup>
// Himmelsøket: velg en formasjon, en planet eller månen — fra lista eller ved å
// skrive.
//
// Vises bare i nattmodus UTEN vær, og først når blikket er løftet mot himmelen
// (`serOpp` i Viewer3D). Porten er presis fordi feltet ikke har noe å gjøre der
// man ser på kartet.
//
// I MAKSIMERT MODUS er dette det eneste som står igjen på skjermen, og da
// flyttes det helt øverst. Derfor er stilen dempet: mørkt glass, ingen hvite
// flater, og teksten på 70 % hvit. Et øye bruker 20–30 minutter på å
// mørkeadaptere, og en lys knapp kaster bort de minuttene.
//
// Lista inneholder BARE det Lende faktisk tegner nå (se himmelObjekter.js). En
// nedtrekksliste som lover et stjernebilde under horisonten er en felle.
import { ref, computed, watch, nextTick } from 'vue'
import { filtrerHimmel, himmelUndertekst } from '../../lib/tour3d/himmelObjekter.js'

const props = defineProps({
  // Fra himmelObjekter(): alt som er valgbart nå.
  objekter: { type: Array, default: () => [] },
  // Id-en som er valgt, eller null.
  valgtId: { type: String, default: null },
  // Maksimert modus: feltet står øverst og alene.
  maksimert: { type: Boolean, default: false },
})
const emit = defineEmits(['velg', 'lukk'])

const apen = ref(false)
const sok = ref('')
const feltRef = ref(null)

const treff = computed(() => filtrerHimmel(props.objekter, sok.value))
const valgt = computed(() => props.objekter.find((o) => o.id === props.valgtId) ?? null)

// Ikon per type. Emoji og ikke SVG: raden er tett, og et lite tegn foran navnet
// gjør typen lesbar uten en egen kolonne.
const IKON = { mane: '🌙', planet: '🪐', formasjon: '✦' }

async function apne() {
  apen.value = true
  await nextTick()
  // Fokus i feltet, men UTEN å tvinge tastaturet opp: på mobil er lista det
  // primære, og et tastatur som dekker halve skjermen skjuler nettopp den.
  // Brukeren trykker i feltet selv om hun vil skrive.
}

function velg(o) {
  emit('velg', o)
  apen.value = false
  sok.value = ''
}

function lukk() {
  apen.value = false
  sok.value = ''
}

// Forsvinner det valgte under horisonten (eller bytter arket), skal ikke pilla
// stå og vise et navn som ikke er der lenger.
watch(() => props.objekter, () => {
  if (props.valgtId && !props.objekter.some((o) => o.id === props.valgtId)) {
    emit('velg', null)
  }
})
</script>

<template>
  <div class="w-full max-w-[86vw] sm:max-w-sm">
    <!-- Lukket: en pille som sier hva som er valgt, eller inviterer til å velge. -->
    <button v-if="!apen"
            @click="apne"
            :aria-label="valgt ? `Valgt: ${valgt.navn}. Velg noe annet på himmelen`
              : 'Finn et stjernebilde eller en planet'"
            class="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur
                   text-[0.6875rem] font-medium shadow-lg pl-2.5 pr-3 py-1.5
                   active:scale-[0.97] transition-colors"
            :class="maksimert ? 'text-white/55' : 'text-white/85'">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
      </svg>
      <span v-if="valgt" class="truncate">{{ IKON[valgt.type] }} {{ valgt.navn }}</span>
      <span v-else>Finn på himmelen</span>
    </button>

    <!-- Åpen: søkefelt + liste. -->
    <div v-else
         class="rounded-md bg-black/80 backdrop-blur shadow-lg overflow-hidden">
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-white/10">
        <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 text-white/40" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
        <input ref="feltRef" v-model="sok" type="search" inputmode="search"
               placeholder="Stjernebilde, planet, stjerne …"
               aria-label="Søk på himmelen"
               class="flex-1 min-w-0 bg-transparent text-[0.8125rem] text-white/90
                      placeholder:text-white/35 outline-none py-1"/>
        <button @click="lukk" aria-label="Lukk himmelsøket"
                class="w-7 h-7 shrink-0 flex items-center justify-center text-white/50
                       active:scale-90">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Lista rulles, og taket er satt i vh så den aldri dekker hele himmelen. -->
      <ul v-if="treff.length" aria-label="Treff på himmelen"
          class="max-h-[46vh] overflow-y-auto [scrollbar-width:thin]">
        <li v-for="o in treff" :key="o.id">
          <button @click="velg(o)"
                  class="w-full text-left px-3 py-2 flex items-start gap-2
                         active:bg-white/10 transition-colors"
                  :class="o.id === valgtId ? 'bg-white/10' : ''">
            <span class="text-[0.8125rem] leading-tight shrink-0" aria-hidden="true">{{ IKON[o.type] }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-[0.8125rem] font-medium text-white/90 truncate">{{ o.navn }}</span>
              <span class="block text-[0.625rem] text-white/45 truncate">{{ himmelUndertekst(o) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <!-- Ærlig svar framfor en tom liste uten forklaring. Det kan være at
           stjernebildet ikke er oppe akkurat nå, og det er verdt å si. -->
      <div v-else class="px-3 py-3 text-[0.6875rem] text-white/50 leading-relaxed">
        Ingen treff. Er du sikker på at den er over horisonten nå? Lista viser
        bare det som faktisk står på himmelen herfra i kveld.
      </div>
    </div>
  </div>
</template>

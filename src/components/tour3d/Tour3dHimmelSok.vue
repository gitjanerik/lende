<script setup>
// Himmelsøket: velg en formasjon, en planet, månen eller én enkelt stjerne —
// fra lista eller ved å skrive.
//
// Vises bare i nattmodus — og der ALLTID, siden nattmodus ER stjernekikkeren
// (v6.1.0). Fram til da krevde porten i tillegg at blikket var løftet, men natt
// løfter blikket selv, og et felt som dukker opp midt i den bevegelsen leses som
// et blaff.
//
// I NATTMODUS er dette det eneste som står igjen på skjermen, mellom sol/måne-
// knappen og X-en. Derfor er stilen dempet: mørkt glass, ingen hvite flater, og
// teksten på 70 % hvit. Et øye bruker 20–30 minutter på å mørkeadaptere, og en
// lys knapp kaster bort de minuttene.
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
  // Nattmodus: dempet ytterligere ned, for nattsynet.
  dempet: { type: Boolean, default: false },
})
const emit = defineEmits(['velg', 'lukk'])

const apen = ref(false)
const sok = ref('')
const feltRef = ref(null)

const treff = computed(() => filtrerHimmel(props.objekter, sok.value))
const valgt = computed(() => props.objekter.find((o) => o.id === props.valgtId) ?? null)

// Ikon per type. Emoji og ikke SVG: raden er tett, og et lite tegn foran navnet
// gjør typen lesbar uten en egen kolonne.
// Fylt stjerne for en figur, åpen for én enkelt stjerne — samme par som i
// infokortet.
//
// SOLA HAR SVG OG IKKE EMOJI (v6.5.6), og det er ikke inkonsekvens for
// inkonsekvensens skyld. ☀️ er en av de mest fargesterke emojiene som finnes, og
// den tegnes av SYSTEMETS font — vi bestemmer verken fargen eller størrelsen.
// I en liste som leses i mørket, der alt annet er dempet hvitt på svart, ville
// den vært det eneste som lyste. En strøket SVG i currentColor arver radens egen
// farge og markeringen, akkurat som globe-merket til høyre.
const IKON = { mane: '🌙', planet: '🪐', formasjon: '✦', stjerne: '✧' }

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
            aria-expanded="false" aria-controls="himmelsok-panel"
            :aria-label="valgt ? `Valgt: ${valgt.navn}. Velg noe annet på himmelen`
              : 'Finn et stjernebilde eller en planet'"
            class="flex items-center gap-1.5 rounded-full bg-black/72 backdrop-blur
                   text-[0.6875rem] font-medium shadow-lg pl-2.5 pr-3 py-1.5
                   active:scale-[0.97] transition-colors"
            :class="dempet ? 'text-white/75' : 'text-white/85'">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
      </svg>
      <!-- BEGGE TEKSTENE ELLIPSERER (v6.5.51). `truncate` uten `min-w-0` gjør
           ingenting i en flex-rad — et flex-barn krymper ikke under sitt eget
           innhold — og «Finn på himmelen» hadde ikke engang `truncate`: ved
           200 % tekst i en smal pille brøt den over sju–ti linjer og pilla ble
           en blokk midt på himmelen. -->
      <span v-if="valgt" class="min-w-0 truncate">{{ IKON[valgt.type] }} {{ valgt.navn }}</span>
      <span v-else class="min-w-0 truncate">Finn på himmelen</span>
    </button>

    <!-- Åpen: søkefelt + liste. -->
    <div v-else id="himmelsok-panel"
         class="rounded-md bg-black/80 backdrop-blur shadow-lg overflow-hidden">
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-white/10">
        <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 text-white/70" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
        <input ref="feltRef" v-model="sok" type="search" inputmode="search"
               placeholder="Stjernebilde, planet, stjerne …"
               aria-label="Søk på himmelen"
               class="flex-1 min-w-0 bg-transparent text-[0.8125rem] text-white/90
                      placeholder:text-white/70 outline-none py-1"/>
        <button @click="lukk" aria-label="Lukk himmelsøket"
                class="w-7 h-7 shrink-0 flex items-center justify-center text-white/72
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
                  :aria-current="o.id === valgtId ? 'true' : undefined"
                  class="w-full text-left px-3 py-2 flex items-start gap-2
                         active:bg-white/10 transition-colors"
                  :class="o.id === valgtId ? 'bg-white/10' : ''">
            <span v-if="o.type === 'sol'" class="shrink-0 self-start mt-[0.1rem] flex" aria-hidden="true">
              <svg viewBox="0 0 16 16" class="w-[0.8125rem] h-[0.8125rem] text-amber-200/80"
                   fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
                <circle cx="8" cy="8" r="3.1"/>
                <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7
                         M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2
                         M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2"/>
              </svg>
            </span>
            <span v-else class="text-[0.8125rem] leading-tight shrink-0" aria-hidden="true">{{ IKON[o.type] }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-[0.8125rem] font-medium text-white/90 truncate">{{ o.navn }}</span>
              <span class="block text-[0.625rem] text-white/70 truncate">{{ himmelUndertekst(o) }}</span>
            </span>
            <!-- GLOBE-MERKET: dette legemet kan åpnes som en roterbar kule.
                 Bare de fire som HAR en globe får det (porten er `harGlobe` i
                 objektet, satt av himmelObjekter) — et merke som lover en globe
                 som ikke finnes er verre enn ingen merke, samme regel som
                 trykk-ringen på himmelen.

                 En liten trådklode og ikke en emoji: 🪐 er alt brukt som
                 TYPE-ikon til venstre for planetene, så en emoji her ville sagt
                 «planet» to ganger og ingenting om at den kan åpnes. Kula leses
                 som 3D fordi meridianen er en ELLIPSE — en rett strek ville gitt
                 et delt-i-to-symbol. -->
            <span v-if="o.harGlobe" class="shrink-0 self-center flex items-center">
              <svg viewBox="0 0 16 16" class="w-[0.875rem] h-[0.875rem] text-white/70"
                   fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
                <circle cx="8" cy="8" r="6"/>
                <ellipse cx="8" cy="8" rx="2.6" ry="6"/>
                <path d="M2.4 6h11.2M2.4 10h11.2"/>
              </svg>
              <!-- Merket er informasjon, så det må finnes som TEKST også: en
                   skjermleser skal høre hvorfor denne raden er annerledes. -->
              <span class="sr-only">— kan åpnes som globe</span>
            </span>
          </button>
        </li>
      </ul>
      <!-- Ærlig svar framfor en tom liste uten forklaring. Det kan være at
           stjernebildet ikke er oppe akkurat nå, og det er verdt å si. -->
      <div v-else class="px-3 py-3 text-[0.6875rem] text-white/72 leading-relaxed">
        Ingen treff. Er du sikker på at den er over horisonten nå? Lista viser
        bare det som faktisk står på himmelen herfra i kveld.
      </div>
    </div>
  </div>
</template>

<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// SnarveiRad — turkart-modusens FUNKSJONER, som én rad over kartet (v6.6.0).
//
// RADEN RULLER IKKE, OG DEN KLIPPER IKKE. Den måler hvor mange knapper som
// faktisk får plass, og legger resten i et nedtrekk — samme grep som værraden
// i 3D fikk i v6.3.9, og av samme grunn: en skjult gest er ikke en affordanse,
// mens en pil ned er det.
//
// FIRE TING SOM MÅ STÅ:
//
// 1. NEDTREKKS-KNAPPEN SKJULES ALDRI. Den er ikke bare «resten av
//    funksjonene» — den er også eneste vei til «Sorter snarveier», og
//    rekkefølgen er nettopp det som avgjør hva som havner bak den på en smal
//    skjerm. Skjuler du knappen når alt får plass, forsvinner sorteringen på
//    de skjermene der den er lettest å prøve ut.
// 2. BUDSJETTET ER VIEWPORTEN, ikke en forelder. Raden er en pille med
//    `width: max-content` som svever midt over kartet — det finnes ingen boks
//    som klemmer den, så en måling av forelderens bredde ville målt radens
//    egen bredde og jaget sin egen hale (værrad-fella, v6.3.12). Derfor
//    `innerWidth − KANT_PX`, og derfor ETTERSJEKKEN under: prognosen
//    kontrolleres mot den ekte rendrede bredden.
// 3. KNAPPENE MÅLES SYNLIGE. En skjult knapp har bredde 0, så første måling
//    (og hver ommåling) skjer med alle knappene i DOM-en; raden står
//    `visibility: hidden` det ene bildet det tar. Tekstskala og fontlasting
//    endrer bredden, så begge utløser ommåling.
// 4. UTVIDET BRUKER `flex-wrap: balance`. Faller den ut (eldre nettleser),
//    står `wrap` igjen i deklarasjonen over — samme rader, bare ujevnt fylt.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { antallSomFar } from '../lib/snarveier.js'

const props = defineProps({
  // [{ id, label, aria }] i brukerens rekkefølge.
  snarveier: { type: Array, required: true },
  uiTextScale: { type: Number, default: 1 },
})
const emit = defineEmits(['velg', 'sorter'])

// Margin til hver skjermkant. Raden er sentrert, så halve verdien per side.
const KANT_PX = 24

const apen = ref(false)
const radRef = ref(null)
const handleRef = ref(null)
const bredder = ref([])
const handlePx = ref(0)
const gapPx = ref(4)
const ledigPx = ref(0)
const maalt = ref(false)
// Ettersjekkens korreksjon: avrunding og skillelinjer gjør regnestykket ett
// hakk optimistisk, og en knapp for mye er nettopp overflowen dette unngår.
const korreksjon = ref(0)

const antallSynlig = computed(() => {
  if (!maalt.value || apen.value) return props.snarveier.length
  const n = antallSomFar(bredder.value, ledigPx.value, handlePx.value, gapPx.value)
  return Math.max(1, n - korreksjon.value)
})
const antallSkjult = computed(() =>
  Math.max(0, props.snarveier.length - antallSynlig.value))

function synlig(i) {
  return apen.value || !maalt.value || i < antallSynlig.value
}

function maal() {
  const rad = radRef.value
  if (!rad) return
  const cs = getComputedStyle(rad)
  gapPx.value = parseFloat(cs.columnGap) || 4
  const padd = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  ledigPx.value = Math.max(0, (window.innerWidth || 360) - KANT_PX - padd)
  handlePx.value = handleRef.value?.getBoundingClientRect().width || 0
  const el = [...rad.querySelectorAll('[data-snarvei]')]
  if (el.length !== props.snarveier.length) return
  bredder.value = el.map(e => e.getBoundingClientRect().width)
  korreksjon.value = 0
  maalt.value = true
  void etterSjekk()
}

// Prognosen ettersjekkes mot den ekte layouten. Løkka er begrenset av gulvet
// i `antallSynlig` (minst én knapp), så den kan ikke gå rundt for alltid.
async function etterSjekk() {
  for (let runde = 0; runde < props.snarveier.length; runde++) {
    await nextTick()
    const rad = radRef.value
    if (!rad || apen.value) return
    // Radens boks INKLUDERER polstringen, mens `ledigPx` er trukket fra den —
    // så sammenlikningen må gå mot hele budsjettet, ikke mot innholdsbredden.
    const bredde = rad.getBoundingClientRect().width
    if (bredde <= (window.innerWidth || 360) - KANT_PX + 0.5) return
    if (antallSynlig.value <= 1) return
    korreksjon.value += 1
  }
}

async function ommaal() {
  maalt.value = false
  await nextTick()
  maal()
}

let ro = null
onMounted(() => {
  void ommaal()
  ro = new ResizeObserver(() => { void ommaal() })
  ro.observe(document.documentElement)
  // Fonten avgjør etikettbredden, og den er ikke nødvendigvis lastet ennå.
  document.fonts?.ready?.then(() => { void ommaal() }).catch(() => {})
})
onBeforeUnmount(() => ro?.disconnect())

watch(() => props.snarveier.map(s => s.id).join(','), () => { void ommaal() })
watch(() => props.uiTextScale, () => { void ommaal() })

function velg(id) {
  apen.value = false
  emit('velg', id)
}
function sorter() {
  apen.value = false
  emit('sorter')
}
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-center gap-1">
    <div ref="radRef"
         class="snarvei-rad flex items-stretch gap-1 px-1.5 py-1.5 rounded-2xl
                bg-overlay/90 backdrop-blur shadow-lg"
         :class="apen ? 'snarvei-rad--apen' : ''"
         :style="{ visibility: maalt ? 'visible' : 'hidden',
                   maxWidth: `calc(100vw - ${KANT_PX}px)` }">
      <button v-for="(s, i) in snarveier" :key="s.id"
              data-snarvei :data-snarvei-id="s.id"
              v-show="synlig(i)"
              @click="velg(s.id)" :aria-label="s.aria"
              class="shortcut-btn">
        <SnarveiIkon :id="s.id" class="w-5 h-5" />
        <span>{{ s.label }}</span>
      </button>

      <!-- Nedtrekket. Står ALLTID, også når ingenting er skjult — se punkt 1
           i filhodet. Tallet i merket sier hvor mange som ligger bak. -->
      <button ref="handleRef" type="button"
              @click="apen = !apen" :aria-expanded="apen"
              :aria-label="apen
                ? 'Skjul flere snarveier'
                : (antallSkjult ? `Vis ${antallSkjult} snarveier til og sortering` : 'Vis sortering av snarveier')"
              class="shortcut-btn shortcut-btn--handle">
        <span class="relative flex items-center justify-center w-5 h-5">
          <svg viewBox="0 0 24 24" class="w-5 h-5 transition-transform duration-200"
               :class="apen ? 'rotate-180' : ''"
               fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span v-if="!apen && antallSkjult"
                class="absolute -top-1 -right-1.5 min-w-[13px] h-[13px] px-[3px] rounded-full
                       bg-sky-500 text-white text-[9px] font-bold leading-[13px] tabular-nums"
                aria-hidden="true">{{ antallSkjult }}</span>
        </span>
        <span>{{ apen ? 'Mindre' : 'Mer' }}</span>
      </button>
    </div>

    <!-- «Sorter snarveier» er en FAST knapp i nedtrekket, ikke en funksjon i
         raden: den handler om raden selv, og en plass mellom Måling og 3D
         ville gjort den til nok en ting man kan trykke på ved et uhell. -->
    <Transition name="snarvei-fade">
      <button v-if="apen" type="button" @click="sorter"
              class="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-2xl
                     bg-overlay/90 backdrop-blur shadow-lg text-ink text-[11px] font-medium
                     active:scale-95 transition">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="4" y1="7" x2="14" y2="7"/><line x1="4" y1="12" x2="11" y2="12"/>
          <line x1="4" y1="17" x2="17" y2="17"/>
          <polyline points="17 4 20 7 17 10"/>
        </svg>
        Sorter snarveier
      </button>
    </Transition>
  </div>
</template>

<style scoped>
/* Snarvei-rad-knapp: ikon over liten etikett, mørk flytende pille. */
.shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 54px;
  padding: 6px 8px;
  border-radius: 12px;
  color: var(--color-ink);
  font-size: 10px;
  line-height: 1;
  transition: background 0.15s ease, transform 0.1s ease;
  /* Etikettene er ett kort ord hver — de skal aldri orddeles («Stifin-ner»).
     Overstyrer det globale hyphens: auto på #app. */
  hyphens: manual;
  white-space: nowrap;
  /* Uten dette klemmes knappene mot minstebredden når det er trangt, og da
     måler vi minstebredden i stedet for den ekte (værrad-lærdommen). */
  flex-shrink: 0;
}
.shortcut-btn:active { transform: scale(0.94); }
.shortcut-btn:hover { background: color-mix(in oklab, var(--color-ink) 8%, transparent); }
.shortcut-btn--handle { min-width: 44px; color: var(--color-ink-2, var(--color-ink)); }

/* SIKKERHETSNETTET: raden BRYTER, den klipper aldri. Målingen skal gjøre at
   den sammenlagte raden holder seg på én linje, men bommer den — en font som
   lastet sent, en tekstskala vi ikke fanget — er en ekstra linje uendelig mye
   bedre enn en knapp som forsvinner ut av skjermkanten. */
.snarvei-rad { flex-wrap: wrap; justify-content: center; row-gap: 2px; }

/* Utvidet: flere rader, balansert fylt. `balance` støttes i Chrome og Safari,
   som er der brukerne er; alle andre forkaster linja og beholder `wrap` over —
   samme rader, bare ujevnt fylt. Derfor står BEGGE, i den rekkefølgen. */
.snarvei-rad--apen {
  flex-wrap: wrap;
  flex-wrap: balance;
}

.snarvei-fade-enter-active, .snarvei-fade-leave-active { transition: opacity 0.16s ease; }
.snarvei-fade-enter-from, .snarvei-fade-leave-to { opacity: 0; }
</style>

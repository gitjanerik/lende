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
//    MEN DA MÅ INNPAKNINGEN VÆRE FULL BREDDE (v6.6.1). Raden lå i den vanlige
//    `left: 50%` + `-translate-x-1/2`-innpakningen, og et absolutt plassert
//    element med `left: 50%` får bare halve viewporten som tilgjengelig
//    bredde — 180 px på en 360 px-skjerm. Raden brøt til to linjer med et
//    budsjett på 336 px og et innhold på 292. Kallstedet i MapView bruker nå
//    `snarveiRadStyle` (full bredde + `justify-center`); flytter du raden,
//    må den innpakningen bli med.
// 3. KNAPPENE MÅLES SYNLIGE. En skjult knapp har bredde 0, så første måling
//    (og hver ommåling) skjer med alle knappene i DOM-en; raden står
//    `visibility: hidden` det ene bildet det tar. Tekstskala og fontlasting
//    endrer bredden, så begge utløser ommåling.
// 4. RADEN BRYTER, DEN KLIPPER ALDRI. `flex-wrap: wrap` står i BEGGE
//    tilstandene som sikkerhetsnett, med `flex-wrap: balance` lagt oppå i den
//    utvidede (Chrome/Safari; andre forkaster linja og beholder `wrap`).
//    MERK AT SIKKERHETSNETTET GJØR ETTERSJEKKEN BLIND FOR BREDDE (v6.6.1): en
//    rad som bryter blir aldri bredere enn taket sitt, så `bredde > budsjett`
//    kan per konstruksjon ikke bli sant. Den sammenlikningen sto her i v6.6.0,
//    og resultatet var en sammenlagt rad på to linjer på eierens telefon.
//    Ettersjekken leser derfor `offsetTop`: er ikke alle knappene på samme
//    linje, er prognosen én for høy.
// 5. VENSTREGRUPPEN ER FAST OG TELLES IKKE MED. Posisjon og kompasset står
//    først, foran en skillelinje, og kollapser aldri — se `NAV_SNARVEIER`. De
//    spiser derimot av budsjettet (`fastPx`), ellers ville målingen lovt plass
//    til knapper gruppa allerede har tatt.
//
// RADEN SPISTE TOPPRADA I v7.1.0, OG SPYTTET DEN UT IGJEN I v7.2.0. Ett forsøk
// samlet hamburgeren, kartnavnet, søket og innstillingene her inne sammen med
// alt annet; felttesten ga en fire linjer høy svart boks over kartet. Topprada
// er tilbake slik den var, og raden er igjen bare FUNKSJONENE. Kompakt-modusen
// falt bort med hamburgeren: raden skjules helt av kallstedet i måling,
// stifinner, annotering, søk og mens kartet bygges, som før — veien ut av
// visningen bor i topprada og forsvinner ikke med den.
//
// PILLENE STÅR PÅ ÅPEN-LINJA (v7.2.0). Strek og relieff er knotter med et
// NIVÅ, ikke funksjoner, og de spiste to plasser av raden på hver skjerm. De
// står nå ved siden av «Sorter», altså bare når raden er åpnet — og et trykk
// på knotten LUKKER IKKE raden: hakket er noe man tar flere av.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { antallSomFar } from '../lib/snarveier.js'

const props = defineProps({
  // [{ id, label, aria }] i brukerens rekkefølge.
  snarveier: { type: Array, required: true },
  // Den faste gruppen: [{ id, label, aria, aktiv }] — se punkt 5 i filhodet.
  nav: { type: Array, default: () => [] },
  // Pillene på åpen-linja: [{ id, label, aria, bue, dimmet?, tannhjulAria? }].
  // `bue` er knott-ringens geometri, som SnarveiIkon tegner nivået med.
  piller: { type: Array, default: () => [] },
  // Hvor nord ligger på skjermen, i grader med klokka. Roterer kompassnåla.
  azimut: { type: Number, default: 0 },
  uiTextScale: { type: Number, default: 1 },
})
// `apen` går UT igjen fordi den åpne raden er tre linjer høy på en telefon og
// da dekker navigasjonssøyla, som står i sin egen `--ovl-nav`-slot rett under.
// Slotten kan ikke dimensjoneres for den åpne raden — den er en transient
// tilstand, og søyla ville stått permanent lavere for en rad man sjelden
// åpner. Kallstedet løfter i stedet raden over søyla mens den er åpen. Radens
// egen z-index duger ikke: innpakningen i MapView er `z-20 absolute`, altså
// sin egen stacking context, og et barn kan ikke klatre ut av den.
const emit = defineEmits(['velg', 'nav', 'innstilling', 'sorter', 'apen'])

// Margin til hver skjermkant. Raden er sentrert, så halve verdien per side.
const KANT_PX = 24

const apen = ref(false)
const radRef = ref(null)
const handleRef = ref(null)
const fastRef = ref(null)
const bredder = ref([])
const handlePx = ref(0)
const fastPx = ref(0)
const gapPx = ref(4)
const ledigPx = ref(0)
const maalt = ref(false)
// Ettersjekkens korreksjon: avrunding og skillelinjer gjør regnestykket ett
// hakk optimistisk, og en knapp for mye er nettopp overflowen dette unngår.
const korreksjon = ref(0)

const antallSynlig = computed(() => {
  if (!maalt.value || apen.value) return props.snarveier.length
  const n = antallSomFar(bredder.value, ledigPx.value, handlePx.value,
                        gapPx.value, fastPx.value)
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
  fastPx.value = fastRef.value?.getBoundingClientRect().width || 0
  const el = [...rad.querySelectorAll('[data-snarvei]')]
  if (el.length !== props.snarveier.length) return
  bredder.value = el.map(e => e.getBoundingClientRect().width)
  korreksjon.value = 0
  maalt.value = true
  void etterSjekk()
}

// Prognosen ettersjekkes mot den EKTE layouten, og spørsmålet er «står alt på
// samme linje?» og ikke «er raden for bred?» — se punkt 4 i filhodet. Løkka er
// begrenset av gulvet i `antallSynlig` (minst én knapp), så den kan ikke gå
// rundt for alltid.
function paaEnLinje(rad) {
  const el = [...rad.querySelectorAll('[data-linje]')]
    .filter(e => e.offsetParent !== null || e.getClientRects().length)
  if (el.length < 2) return true
  const topp = Math.round(el[0].getBoundingClientRect().top)
  return el.every(e => Math.abs(Math.round(e.getBoundingClientRect().top) - topp) <= 1)
}

async function etterSjekk() {
  for (let runde = 0; runde < props.snarveier.length; runde++) {
    await nextTick()
    const rad = radRef.value
    if (!rad || apen.value) return
    if (paaEnLinje(rad)) return
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

watch(apen, v => emit('apen', v))
watch(() => props.snarveier.map(s => s.id).join(','), () => { void ommaal() })
watch(() => props.uiTextScale, () => { void ommaal() })

function velg(id) {
  apen.value = false
  emit('velg', id)
}
// PILLENE LUKKER IKKE RADEN (v7.2.0). Begge halvdelene av en pille er noe man
// gjør FLERE av — et hakk opp, et hakk til, så panelet — og de står uansett
// bare på linja raden nettopp åpnet. En lukking her ville bedt brukeren åpne
// raden på nytt mellom hvert hakk.
function pilleTrykk(id) { emit('velg', id) }
function innstilling(id) { emit('innstilling', id) }
function navTrykk(id) {
  emit('nav', id)
}
function sorter() {
  apen.value = false
  emit('sorter')
}
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-center gap-1"
       :style="{ maxWidth: `calc(100vw - ${KANT_PX}px)`, width: apen ? '100%' : 'auto' }">
    <div ref="radRef"
         class="snarvei-rad flex items-stretch gap-1 px-1.5 py-1.5 rounded-2xl
                bg-overlay/90 backdrop-blur shadow-lg"
         :class="apen ? 'snarvei-rad--apen' : ''"
         :style="{ visibility: maalt ? 'visible' : 'hidden',
                   maxWidth: `calc(100vw - ${KANT_PX}px)` }">
      <!-- DEN FASTE NAV-GRUPPEN (v6.6.1). Samme ikon-over-etikett-form som
           resten av raden, men to ting skiller den, og begge er med vilje:
           knappene bærer en TILSTAND (aksentgrønn flate + `aria-pressed`,
           samme mønster som vippebryterne i skuffene), og de står foran en
           skillelinje som sier at de ikke hører til det som kan sorteres. -->
      <div ref="fastRef" class="flex items-stretch gap-1">
        <template v-if="nav.length">
          <button v-for="n in nav" :key="n.id" data-linje data-nav
                  :data-nav-id="n.id" type="button"
                  @click="navTrykk(n.id)" :aria-pressed="!!n.aktiv"
                  :aria-label="n.ariaTekst || n.aria"
                  class="shortcut-btn shortcut-btn--nav"
                  :class="n.aktiv ? 'shortcut-btn--pa' : ''">
            <SnarveiIkon :id="n.id" class="w-5 h-5"
                         :style="n.id === 'kompass'
                           ? { transform: `rotate(${azimut}deg)`, transition: 'transform 0.2s linear' }
                           : null" />
            <span>{{ n.label }}</span>
          </button>
        </template>
      </div>
      <div v-if="nav.length" class="shrink-0 self-stretch w-px my-1 bg-ink/20" aria-hidden="true"></div>

      <template v-for="(s, i) in snarveier" :key="s.id">
        <button data-snarvei :data-snarvei-id="s.id" data-linje
                v-show="synlig(i)"
                @click="velg(s.id)"
                :aria-label="s.aria" class="shortcut-btn">
          <SnarveiIkon :id="s.id" class="w-5 h-5" />
          <span>{{ s.label }}</span>
        </button>
      </template>

      <!-- Nedtrekket. Står ALLTID, også når ingenting er skjult — se punkt 1
           i filhodet. Tallet i merket sier hvor mange som ligger bak. -->
      <button ref="handleRef" type="button" data-linje
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

    <!-- ÅPEN-LINJA: pillene til venstre, «Sorter snarveier» til høyre.
         Strek og relieff er ikke funksjoner man rekker etter mens man går —
         de er knotter med et nivå — så de tok to plasser av raden for lite. Her
         står de der man alt har åpnet noe for å stille inn, ved siden av
         sorteringen. Raden lukkes IKKE av et trykk på dem; se `pilleTrykk`.
         «Sorter snarveier» er en FAST knapp her, ikke en funksjon i raden: den
         handler om raden selv, og en plass mellom Måling og 3D ville gjort den
         til nok en ting man kan trykke på ved et uhell. -->
    <Transition name="snarvei-fade">
      <div v-if="apen"
           class="pointer-events-auto w-full flex items-center gap-2 px-2 py-1.5 rounded-2xl
                  bg-overlay/90 backdrop-blur shadow-lg">
        <!-- GRUPPE-PILLA: én boks med TO trykkflater (v7.0.0). Venstre er
             hakket — det tapet på knotten gjorde — høyre er tannhjulet som
             åpner panelet, altså det lang-trykket sa. -->
        <div class="flex-1 min-w-0 flex flex-wrap items-stretch gap-1.5">
          <div v-for="pille in piller" :key="pille.id" class="shortcut-group">
            <button type="button" @click="pilleTrykk(pille.id)" :aria-label="pille.aria"
                    class="shortcut-btn shortcut-btn--venstre"
                    :class="pille.dimmet ? 'shortcut-btn--dim' : ''">
              <SnarveiIkon :id="pille.id" :bue="pille.bue" class="w-5 h-5" />
              <span>{{ pille.label }}</span>
            </button>
            <span class="shortcut-group__strek" aria-hidden="true"></span>
            <button type="button" @click="innstilling(pille.id)"
                    :aria-label="pille.tannhjulAria || `Innstillinger for ${pille.label}`"
                    class="shortcut-btn shortcut-btn--tannhjul">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                   aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.79 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>
        <button type="button" @click="sorter" aria-label="Sorter snarveier"
                class="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-xl
                       text-ink text-[11px] font-medium active:scale-95 transition
                       hover:bg-ink/8">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="4" y1="7" x2="14" y2="7"/><line x1="4" y1="12" x2="11" y2="12"/>
            <line x1="4" y1="17" x2="17" y2="17"/>
            <polyline points="17 4 20 7 17 10"/>
          </svg>
          <span class="whitespace-nowrap">Sorter</span>
        </button>
      </div>
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

/* GRUPPE-PILLA (v7.0.0): to trykkflater i én boks. Boksen har radens egen
   avrunding og en hårfin ramme, slik at de to leses som ÉN funksjon med en
   innstilling — ikke som to snarveier som tilfeldigvis står inntil hverandre.
   `flex-shrink: 0` av samme grunn som på knappene: målingen skal se den ekte
   bredden, ikke minstebredden. */
.shortcut-group {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid color-mix(in oklab, var(--color-ink) 14%, transparent);
  background: color-mix(in oklab, var(--color-ink) 5%, transparent);
}
.shortcut-group .shortcut-btn { border-radius: 11px; }
.shortcut-btn--venstre { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.shortcut-btn--tannhjul {
  min-width: 32px;
  padding: 6px 7px;
  justify-content: center;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  color: var(--color-ink-2, var(--color-ink));
}
.shortcut-group__strek {
  width: 1px;
  margin: 6px 0;
  background: color-mix(in oklab, var(--color-ink) 18%, transparent);
}
/* Relieff av: ikonet skal si det uten en egen etikett. */
.shortcut-btn--dim { opacity: 0.55; }

/* NAV-GRUPPEN: av er nøytral, på er appens aksentgrønne med hvitt innhold —
   samme par som hver vippebryter i skuffene og som de gamle runde skivene
   (v6.5.70). Emerald-600 og ikke -500: hvitt på -500 gir 2,6:1, altså under
   WCAG 1.4.11 sitt krav på 3:1 for grafiske objekter. */
.shortcut-btn--nav { min-width: 50px; }
.shortcut-btn--pa { background: #059669; color: #fff; }
.shortcut-btn--pa:hover { background: #047857; }

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

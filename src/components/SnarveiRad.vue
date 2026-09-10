<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// SnarveiRad — turkart-modusens FUNKSJONER, som én rad over kartet (v6.6.0).
//
// RADEN RULLER IKKE, OG DEN KLIPPER IKKE. Den måler hvor mange knapper som
// faktisk får plass, og legger resten bak et dra-håndtak — samme grep som
// værraden i 3D fikk i v6.3.9, og av samme grunn: en skjult gest er ikke en
// affordanse, mens et håndtak er det.
//
// HÅNDTAKET ER ET HÅNDTAK, IKKE ENDA EN SNARVEI (v7.4.0). Fram til nå var
// «Mer / Mindre» en knapp med ikon og etikett som sto i SAMME flex-rad som
// funksjonene — altså formet som en snarvei, plassert som en snarvei, men den
// eneste knappen i raden som ikke gjorde noe med kartet. Nå er det appens
// vanlige grå drawer-håndtak, bunnplassert og midtstilt, som i punkt-arket og
// funksjons-skuffene: dra ned for å folde ut alle snarveiene, dra opp for å
// legge sammen igjen. Et trykk gjør det samme, så gesten aldri er eneste vei.
//
// OG DRAGET AVDEKKER NAVNENE (v7.4.0). Sammenlagt er raden bare IKONER; dratt
// ned får hver knapp etiketten sin. Det er ikke pynt — det er hva et drag i et
// håndtak SKAL gjøre: avdekke noe. Sammenlagt er ikonene det man rekker etter
// mens man går, og det er i den tilstanden plassen er knappest, så en rad uten
// tekst får langt flere av dem på linja (seks mot tre ved 200 % tekst). Dratt
// ned står navnene der for den som ikke kjenner symbolet ennå, og det er
// samtidig den eneste tilstanden der «Sorter snarveier» finnes — altså der man
// er når man skal lære raden å kjenne. `aria-label` bærer navnet i BEGGE
// tilstandene, så et skjermleser-navn forsvinner aldri med etiketten.
//
// MÅLINGEN GJELDER DEN SAMMENLAGTE FORMEN, og bare den. Måler vi mens raden er
// åpen, måler vi knapper med tekst — altså en helt annen bredde enn den som
// skal få plass på linja. `maal()` returnerer derfor tidlig når raden er åpen,
// og en lukking utløser ommåling.
//
// FIRE TING SOM MÅ STÅ:
//
// 1. HÅNDTAKET SKJULES ALDRI. Det er ikke bare «resten av funksjonene» — det
//    er også eneste vei til «Sorter snarveier», og rekkefølgen er nettopp det
//    som avgjør hva som havner bak det på en smal skjerm. Skjuler du håndtaket
//    når alt får plass, forsvinner sorteringen på de skjermene der den er
//    lettest å prøve ut.
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
// 5. ALLE KNAPPENE ER LIKEVERDIGE (v7.3.0). Raden hadde en FAST venstregruppe
//    — posisjon og kompasset — som sto foran en skillelinje, aldri kollapset
//    og spiste av budsjettet (`fastPx`). Den er borte: posisjonen er en vanlig
//    sorterbar snarvei med plass #1 i standarden, kompasset bor i linjal-
//    boksen nede til venstre. En knapp som bærer en TILSTAND (posisjonen) får
//    fortsatt aksentgrønn flate og `aria-pressed` — det er en egenskap ved
//    knappen, ikke en egen klasse knapper med egne plasseringsregler.
//
// SNARVEIENE SKALERER MED TEKSTSTØRRELSEN (v7.4.0). Hovedmenyens 100/125/150/
// 200 gjelder nå ikon OG etikett her, som i skuffene: `zoom` settes på hver
// KNAPP og ikke på raden, fordi en zoomet rad også skalerer sin egen polstring
// og sitt eget gap — og da måler vi et budsjett i én enhet mot knapper i en
// annen. Med `zoom` på knappen leser `getBoundingClientRect()` den ekte
// skjermbredden, altså nøyaktig det målingen trenger. Prisen er at det får
// plass på færre knapper per linje ved 200 %, og det er meningen: resten
// ligger ett drag unna.
//
// RADEN SPISTE TOPPRADA I v7.1.0, OG SPYTTET DEN UT IGJEN I v7.2.0. Ett forsøk
// samlet hamburgeren, kartnavnet, søket og innstillingene her inne sammen med
// alt annet; felttesten ga en fire linjer høy svart boks over kartet. Topprada
// er tilbake slik den var, og raden er igjen bare FUNKSJONENE. Kompakt-modusen
// falt bort med hamburgeren: raden skjules helt av kallstedet i måling,
// stifinner, annotering, søk og mens kartet bygges, som før — veien ut av
// visningen bor i topprada og forsvinner ikke med den.
//
// STREK OG RELIEFF ER UTE (v7.4.0). De sto som gruppe-piller med tannhjul på
// linja raden åpnet, hver med sitt eget bunn-ark og sitt eget hint. De er ikke
// funksjoner, de er innstillinger — og de bor nå i Innstillinger → Kartstil,
// nederst, sammen med tema, lag og sti-farge. Se lib/snarveier.js.
//
// «SORTER SNARVEIER» ER FRISTILT IGJEN (v7.4.0). Den lå inne i radens egen
// boks fra v7.3.0, ved siden av pillene. Uten pillene er det ingenting igjen å
// dele linja med, og knappen handler ikke om kartet men om raden selv — så den
// står som sin egen svarte, midtstilte knapp under den åpne raden.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { antallSomFar } from '../lib/snarveier.js'

const props = defineProps({
  // [{ id, label, aria }] i brukerens rekkefølge.
  snarveier: { type: Array, required: true },
  uiTextScale: { type: Number, default: 1 },
})
// `apen` går UT igjen fordi den åpne raden er tre linjer høy på en telefon og
// da dekker navigasjonssøyla, som står i sin egen `--ovl-nav`-slot rett under.
// Slotten kan ikke dimensjoneres for den åpne raden — den er en transient
// tilstand, og søyla ville stått permanent lavere for en rad man sjelden
// åpner. Kallstedet løfter i stedet raden over søyla mens den er åpen. Radens
// egen z-index duger ikke: innpakningen i MapView er `z-20 absolute`, altså
// sin egen stacking context, og et barn kan ikke klatre ut av den.
const emit = defineEmits(['velg', 'sorter', 'apen'])

// Margin til hver skjermkant. Raden er sentrert, så halve verdien per side.
const KANT_PX = 24
// Hvor langt fingeren må flytte seg før draget teller som et drag og ikke som
// et trykk. Under dette er gesten et tapp, og tappet toggler — så håndtaket
// virker likt for den som drar og den som bare trykker.
const DRA_TERSKEL_PX = 8

const apen = ref(false)
const radRef = ref(null)
const bredder = ref([])
const gapPx = ref(4)
const ledigPx = ref(0)
const maalt = ref(false)
// Ettersjekkens korreksjon: avrunding og skillelinjer gjør regnestykket ett
// hakk optimistisk, og en knapp for mye er nettopp overflowen dette unngår.
const korreksjon = ref(0)

const antallSynlig = computed(() => {
  if (!maalt.value || apen.value) return props.snarveier.length
  const n = antallSomFar(bredder.value, ledigPx.value, gapPx.value)
  return Math.max(1, n - korreksjon.value)
})
const antallSkjult = computed(() =>
  Math.max(0, props.snarveier.length - antallSynlig.value))

function synlig(i) {
  return apen.value || !maalt.value || i < antallSynlig.value
}

function maal() {
  const rad = radRef.value
  // Åpen rad = knapper med etikett, altså en annen bredde enn den som skal få
  // plass på den sammenlagte linja. Å måle her ville gitt et tall som er feil
  // i nøyaktig den tilstanden det brukes i.
  if (!rad || apen.value) return
  const cs = getComputedStyle(rad)
  gapPx.value = parseFloat(cs.columnGap) || 4
  const padd = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  ledigPx.value = Math.max(0, (window.innerWidth || 360) - KANT_PX - padd)
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

watch(apen, (v) => {
  emit('apen', v)
  // Etikettene forsvinner ved lukking, så knappene er smalere enn de var —
  // uten en ommåling her ville raden stått med prognosen fra forrige lukking.
  if (!v) void ommaal()
})
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

// ── Håndtaket ──────────────────────────────────────────────────────────────
// Retningen er den samme som i et bunn-ark, bare speilvendt: her henger arket
// fra toppen av skjermen, så NED er «vis mer» og OPP er «legg sammen». Draget
// avgjør ingenting før fingeren slippes — det er ingen høyde å følge underveis,
// bare to tilstander — og en bevegelse under terskelen faller tilbake på et
// vanlig tapp-toggle.
const draStart = ref(null)
function onDraStart(e) {
  draStart.value = e.clientY
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onDraSlutt(e) {
  const start = draStart.value
  draStart.value = null
  if (start == null) return
  const dy = e.clientY - start
  if (Math.abs(dy) < DRA_TERSKEL_PX) apen.value = !apen.value
  else apen.value = dy > 0
}
</script>

<template>
  <div class="flex flex-col items-center gap-2 w-full">
    <div class="pointer-events-auto flex flex-col items-stretch rounded-2xl
                bg-overlay/90 backdrop-blur shadow-lg"
         :style="{ maxWidth: `calc(100vw - ${KANT_PX}px)`,
                   width: apen ? '100%' : 'auto',
                   visibility: maalt ? 'visible' : 'hidden' }">
      <div ref="radRef"
           class="snarvei-rad flex items-stretch gap-1 px-1.5 pt-1.5"
           :class="apen ? 'snarvei-rad--apen' : ''"
           :style="{ maxWidth: `calc(100vw - ${KANT_PX}px)` }">
        <template v-for="(s, i) in snarveier" :key="s.id">
          <!-- `aktiv` er valgfri og bæres i dag bare av posisjonen: aksentgrønn
               flate + `aria-pressed`, samme par som vippebryterne i skuffene.
               `aria-pressed` settes bare når knappen FAKTISK er en bryter — en
               `aria-pressed="false"` på Stifinner ville lovet en av/på den ikke
               har. `zoom` per knapp: se filhodet. -->
          <button data-snarvei :data-snarvei-id="s.id" data-linje
                  v-show="synlig(i)"
                  @click="velg(s.id)"
                  :aria-pressed="s.aktiv === undefined ? undefined : !!s.aktiv"
                  :aria-label="s.ariaTekst || s.aria"
                  :style="{ zoom: uiTextScale }"
                  class="shortcut-btn"
                  :class="[s.aktiv ? 'shortcut-btn--pa' : '',
                           apen ? '' : 'shortcut-btn--ikon']">
            <SnarveiIkon :id="s.id" class="w-5 h-5" />
            <!-- Navnet AVDEKKES av draget. `aria-label` bærer det uansett, så
                 den sammenlagte raden er ikke en rad med navnløse knapper. -->
            <span v-if="apen">{{ s.label }}</span>
          </button>
        </template>
      </div>

      <!-- HÅNDTAKET: appens grå drawer-håndtak, bunnplassert og midtstilt.
           Står ALLTID, også når ingenting er skjult — se punkt 1 i filhodet.
           Det er en EKTE knapp (samme regel som funksjons-skuffene, v6.5.48):
           trykk toggler, pil ned/opp folder ut og sammen, og draget er et
           tillegg — ikke den eneste veien. -->
      <button type="button"
              class="snarvei-handle shrink-0 w-full touch-none cursor-grab
                     active:cursor-grabbing pt-2 pb-2 flex justify-center"
              :aria-expanded="apen"
              :aria-label="apen
                ? 'Legg sammen snarveiene'
                : (antallSkjult ? `Vis ${antallSkjult} snarveier til og sortering` : 'Vis sortering av snarveier')"
              @keydown.down.prevent="apen = true"
              @keydown.up.prevent="apen = false"
              @pointerdown="onDraStart"
              @pointerup="onDraSlutt"
              @pointercancel="draStart = null">
        <span class="w-12 h-1.5 rounded-full bg-ink/40 transition-colors"></span>
      </button>
    </div>

    <!-- «SORTER SNARVEIER» ER FRISTILT (v7.4.0): sin egen svarte, midtstilte
         knapp under den åpne raden, ikke en rad i radens boks. Den handler om
         RADEN og ikke om kartet, og en plass mellom Måling og 3D ville gjort
         den til nok en ting man kan trykke på ved et uhell. -->
    <Transition name="snarvei-fade">
      <button v-if="apen" type="button" @click="sorter"
              :style="{ zoom: uiTextScale }"
              class="pointer-events-auto shrink-0 px-4 py-2 rounded-xl
                     bg-overlay/90 backdrop-blur shadow-lg text-ink text-[12px]
                     font-medium whitespace-nowrap active:scale-95 transition">
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
/* SAMMENLAGT ER KNAPPEN BARE ET IKON (v7.4.0). 44 px er ikke et rundt tall:
   det er WCAG 2.5.8 / Apples minste trykkflate, og en ikon-knapp har ingen
   etikett å treffe ved siden av seg. Høyden holdes lik bredden så raden ikke
   hopper i høyde når navnene kommer og går. */
.shortcut-btn--ikon {
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  padding: 6px;
}
.shortcut-btn:active { transform: scale(0.94); }
.shortcut-btn:hover { background: color-mix(in oklab, var(--color-ink) 8%, transparent); }

/* Håndtaket har ingen egen flate — det er streken som er knappen — men
   trykkflata skal svare, så hover/aktiv tar streken og ikke boksen. */
.snarvei-handle:hover span { background: color-mix(in oklab, var(--color-ink) 62%, transparent); }
.snarvei-handle:active span { background: color-mix(in oklab, var(--color-ink) 75%, transparent); }

/* EN KNAPP SOM ER PÅ: av er nøytral, på er appens aksentgrønne med hvitt
   innhold — samme par som hver vippebryter i skuffene og som de gamle runde
   skivene (v6.5.70). Emerald-600 og ikke -500: hvitt på -500 gir 2,6:1, altså
   under WCAG 1.4.11 sitt krav på 3:1 for grafiske objekter. */
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

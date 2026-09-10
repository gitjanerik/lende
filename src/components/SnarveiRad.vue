<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// SnarveiRad — turkart-modusens FUNKSJONER, som en skuff over kartet (v6.6.0).
//
// RADEN ER ET GITTER, OG DEN ER EN EKTE SKUFF (v7.5.0).
//
// Fram til nå var den en flex-rad som målte hver knapp for seg og la resten bak
// et nedtrekk. To ting fulgte av det, og begge ble meldt fra felt:
//   • antallet per linje endret seg med tilstanden (sju ikoner sammenlagt, fire
//     med etikett utfoldet), så raden så ut til å stokke om på seg selv;
//   • knappene var ulikt brede, fordi hver av dem var så bred som ordet sitt.
// Nå er det ett gitter med FASTE, LIKE kolonner. Kolonnetallet regnes av den
// BREDESTE cella — altså den med etikett — og er det samme i begge tilstandene.
// Sammenlagt vises første rad; draget avdekker resten.
//
// DRAGET ER KONTINUERLIG, som i punkt-arket og funksjons-skuffene (v7.5.0).
// Håndtaket satte før bare en av/på: raden hoppet mellom to former. Nå følger
// høyden fingeren hele veien (`dra`), etikettene toner inn med den, og de neste
// radene glir opp fra kanten. På slipp DOKKER den til nærmeste ende med appens
// vanlige fjærkurve — og «nærmeste» er `pickSnapTarget` fra useDraggableDrawer,
// samme retnings-baserte regel som hvert bunn-ark i appen: ett svakt drag i en
// retning committer, man må ikke forbi midtpunktet.
//
// KLIKK ÅPNER IKKE (v7.5.0). Håndtaket er et håndtak: man drar i det. Et
// klikk-toggle på samme flate gjorde at et lite drag og et tapp gjorde helt
// ulike ting på samme piksel. **Piltastene står igjen** — de er ikke et klikk,
// og uten dem finnes skuffa ikke for den som betjener appen fra tastatur
// (SC 2.1.1). Det er den ene grunnen til at knappen fortsatt er en `<button>`.
//
// HÅNDTAKET ER APPENS, IKKE RADENS. Samme grå pille, samme luft rundt seg
// (`py-3`) som i punkt-arket og funksjons-skuffene — eieren så de to åpne
// samtidig og meldte at lufta var ulik. Den er nå den samme overalt, og verdien
// er LIK over og under: da er «lufta rundt håndtaket» det samme tallet enten
// arket henger fra toppen eller fra bunnen.
//
// FIRE TING SOM MÅ STÅ:
//
// 1. HÅNDTAKET SKJULES ALDRI. Det er ikke bare «resten av funksjonene» — det
//    er også eneste vei til «Sorter snarveier», og rekkefølgen er nettopp det
//    som avgjør hva som havner bak det på en smal skjerm. Skjuler du håndtaket
//    når alt får plass, forsvinner sorteringen på de skjermene der den er
//    lettest å prøve ut.
// 2. BUDSJETTET ER VIEWPORTEN, ikke en forelder. Raden er en pille som svever
//    midt over kartet — det finnes ingen boks som klemmer den, så en måling av
//    forelderens bredde ville målt radens egen bredde og jaget sin egen hale
//    (værrad-fella, v6.3.12). Derfor `innerWidth − KANT_PX`.
//    MEN DA MÅ INNPAKNINGEN VÆRE FULL BREDDE (v6.6.1). Raden lå i den vanlige
//    `left: 50%` + `-translate-x-1/2`-innpakningen, og et absolutt plassert
//    element med `left: 50%` får bare halve viewporten som tilgjengelig
//    bredde — 180 px på en 360 px-skjerm. Kallstedet i MapView bruker nå
//    `snarveiRadStyle` (full bredde + `justify-center`); flytter du raden,
//    må den innpakningen bli med.
// 3. MÅLINGEN SKJER I ÉN SKJULT PASSERING, med etikettene PÅ og gitteret AV.
//    Cellene må stå i sin naturlige bredde for at «bredeste celle» skal bety
//    noe — i et gitter er de alle like brede per definisjon, så en måling der
//    ville lest kolonnebredden vi nettopp valgte og jaget sin egen hale. Derfor
//    `maalt = false` → flex + etiketter → les → gitter. Raden står
//    `visibility: hidden` det ene bildet det tar. Tekstskala, fontlasting og
//    vindusbredde endrer bredden, så alle tre utløser ommåling.
// 4. HØYDENE ER MÅLT, IKKE REGNET. `hLukket` (én rad, ikoner) og `hApen` (alle
//    rader, etiketter) leses av den ekte layouten i samme skjulte passering.
//    En utregning fra ikonhøyde + etiketthøyde + gap ville vært riktig helt til
//    noen endret en polstring, og feilen ville vært en skuff som klipper det
//    nederste av seg selv — usynlig i enhetstester.
//
// ALLE KNAPPENE ER LIKEVERDIGE (v7.3.0). Raden hadde en FAST venstregruppe —
// posisjon og kompasset — som sto foran en skillelinje og aldri kollapset. Den
// er borte: posisjonen er en vanlig sorterbar snarvei med plass #1 i standarden,
// kompasset bor i linjal-boksen nede til venstre. En knapp som bærer en TILSTAND
// (posisjonen) får aksentgrønn flate og `aria-pressed` — det er en egenskap ved
// knappen, ikke en egen klasse knapper med egne plasseringsregler.
//
// SNARVEIENE SKALERER MED TEKSTSTØRRELSEN (v7.4.0). Hovedmenyens 100/125/150/
// 200 gjelder ikon OG etikett her, som i skuffene: `zoom` settes på hver KNAPP
// og ikke på gitteret, fordi et zoomet gitter også skalerer sitt eget gap — og
// da måles et budsjett i én enhet mot celler i en annen. Med `zoom` på knappen
// leser `getBoundingClientRect()` den ekte skjermbredden, altså nøyaktig det
// målingen trenger. Ved 200 % blir det færre kolonner og flere rader, og det er
// meningen: resten ligger ett drag unna.
//
// RADEN SPISTE TOPPRADA I v7.1.0, OG SPYTTET DEN UT IGJEN I v7.2.0. Ett forsøk
// samlet hamburgeren, kartnavnet, søket og innstillingene her inne sammen med
// alt annet; felttesten ga en fire linjer høy svart boks over kartet. Topprada
// er tilbake slik den var, og raden er igjen bare FUNKSJONENE.
//
// STREK OG RELIEFF ER UTE (v7.4.0). De sto som gruppe-piller med tannhjul på
// linja raden åpnet, hver med sitt eget bunn-ark og sitt eget hint. De er ikke
// funksjoner, de er innstillinger — og de bor nå i Innstillinger → Kartstil,
// nederst, sammen med tema, lag og sti-farge. Se lib/snarveier.js.
//
// «SORTER SNARVEIER» ER FRISTILT (v7.4.0): sin egen svarte, midtstilte knapp
// under den utfoldede skuffa. Den handler om RADEN og ikke om kartet, og en
// plass mellom Måling og 3D ville gjort den til nok en ting man trykker på ved
// et uhell. Den toner inn med draget, som alt annet som avdekkes.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import { antallKolonner, antallRader } from '../lib/snarveier.js'
import { pickSnapTarget } from '../composables/useDraggableDrawer.js'

const props = defineProps({
  // [{ id, label, aria }] i brukerens rekkefølge.
  snarveier: { type: Array, required: true },
  uiTextScale: { type: Number, default: 1 },
})
// `apen` går UT igjen fordi den utfoldede skuffa er flere linjer høy på en
// telefon og da dekker navigasjonssøyla, som står i sin egen `--ovl-nav`-slot
// rett under. Slotten kan ikke dimensjoneres for den utfoldede raden — den er
// en transient tilstand, og søyla ville stått permanent lavere for en skuff man
// sjelden drar ut. Kallstedet løfter i stedet raden over søyla mens den er ute.
// Radens egen z-index duger ikke: innpakningen i MapView er `z-20 absolute`,
// altså sin egen stacking context, og et barn kan ikke klatre ut av den.
const emit = defineEmits(['velg', 'sorter', 'apen'])

// Margin til hver skjermkant. Raden er sentrert, så halve verdien per side.
const KANT_PX = 24
// Fjærkurven skuffa dokker med. Samme tall og samme kurve som
// useDraggableDrawer bruker på hvert bunn-ark — «magneten» skal kjennes lik.
const DOKK_MS = 220
const DOKK_KURVE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
// Hvor stor del av gapet mot neste hakk et drag må passere før det committer.
// Samme verdi som drawer-ens `commitFraction`.
const COMMIT = 0.25
// Hvor langt fingeren minst må flytte seg for å gå hele veien. Skuffa følger
// fingeren 1:1 når den HAR noe å vokse med, men vokse-rommet kan være lite: får
// alle snarveiene plass på én rad, er hele forskjellen på sammenlagt og utfoldet
// de fire pikslene etiketten legger på. Et 1:1-drag ville da vært over før man
// merket at man dro. Divisoren er derfor det STØRSTE av vokse-rommet og dette.
const DRA_MIN_PX = 72

// Dra-posisjonen: 0 = sammenlagt (én rad, ikoner), 1 = utfoldet (alle rader,
// etiketter). Alt annet i komponenten avledes av den.
const dra = ref(0)
const drar = ref(false)
const gitterRef = ref(null)
const kolonner = ref(1)
const gapPx = ref(4)
const hLukket = ref(0)
const hApen = ref(0)
const maalt = ref(false)
// HØYDENE MÅ LESES MED `height: auto`, og det er ikke en detalj. Et gitter med
// FAST høyde sizer radsporet etter containeren, og med `align-self: stretch`
// blir cella nøyaktig så høy som sporet — uansett hva den inneholder. Første
// utgave leste `scrollHeight` med høyde-bindingen på og fikk 50 px i BEGGE
// tilstandene: etiketten var der, men cella nektet å vokse rundt den, så
// skuffa hadde null å dra i. Under målingen står høyden derfor på `auto`.
const maaler = ref(false)

const apen = computed(() => dra.value > 0.5)
const rader = computed(() => antallRader(props.snarveier.length, kolonner.value))
const hoydeSpenn = computed(() => Math.max(0, hApen.value - hLukket.value))
const draLengde = computed(() => Math.max(DRA_MIN_PX, hoydeSpenn.value))

// Høyden følger fingeren. `overflow: hidden` på gitteret gjør resten: radene
// under den første ligger og venter rett utenfor kanten.
const gitterStil = computed(() => ({
  height: maalt.value && !maaler.value
    ? `${hLukket.value + hoydeSpenn.value * dra.value}px`
    : 'auto',
  gridTemplateColumns: maalt.value
    ? `repeat(${kolonner.value}, minmax(0, 1fr))`
    : '',
  transition: drar.value ? 'none' : `height ${DOKK_MS}ms ${DOKK_KURVE}`,
}))

// ── Måling ─────────────────────────────────────────────────────────────────
// Én skjult passering: naturlige cellebredder → kolonnetall → de to høydene.
// Se punkt 3 og 4 i filhodet for hvorfor rekkefølgen er som den er.
async function maal() {
  const g = gitterRef.value
  // Målingen endrer layouten, og ResizeObserveren ser det. Uten denne vakta
  // starter hver passering en ny midt i seg selv, og de leser hverandres
  // halvferdige tilstand.
  if (!g || maaler.value) return
  maaler.value = true
  maalt.value = false
  await nextTick()

  const cs = getComputedStyle(g)
  gapPx.value = parseFloat(cs.columnGap) || 4
  const padd = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  const ledig = Math.max(0, (window.innerWidth || 360) - KANT_PX - padd)

  const celler = [...g.querySelectorAll('[data-snarvei]')]
  if (celler.length !== props.snarveier.length) { maaler.value = false; return }
  const bredest = celler.reduce((m, e) => Math.max(m, e.getBoundingClientRect().width), 0)
  kolonner.value = antallKolonner(bredest, ledig, gapPx.value, props.snarveier.length)

  // Gitteret er nå på plass; les de to høydene av den ekte layouten, med
  // `height: auto` (se `maaler`). `offsetHeight` og ikke `scrollHeight`: det er
  // boksen vi skal animere, ikke innholdet som måtte stikke utenfor den.
  maalt.value = true
  const forrige = dra.value
  dra.value = 1
  await nextTick()
  hApen.value = g.offsetHeight

  // SAMMENLAGT ER ÉN RAD, og den kan ikke leses av gitteret: med `height: auto`
  // står ALLE radene der, og `offsetHeight` ville gitt full høyde også ved
  // dra = 0. Fikk alle snarveiene plass på én rad var det tilfeldigvis riktig;
  // på en smal skjerm sto skuffa åpen fra start. Høyden regnes derfor av FØRSTE
  // celle pluss gitterets topp-polstring — det er nøyaktig den ene raden.
  dra.value = 0
  await nextTick()
  const padTopp = parseFloat(getComputedStyle(g).paddingTop) || 0
  hLukket.value = Math.round(padTopp + celler[0].getBoundingClientRect().height)
  dra.value = forrige
  maaler.value = false
}

let ro = null
onMounted(() => {
  void maal()
  ro = new ResizeObserver(() => { void maal() })
  ro.observe(document.documentElement)
  // Fonten avgjør etikettbredden, og den er ikke nødvendigvis lastet ennå.
  document.fonts?.ready?.then(() => { void maal() }).catch(() => {})
})
onBeforeUnmount(() => ro?.disconnect())

watch(apen, v => emit('apen', v))
watch(() => props.snarveier.map(s => s.id).join(','), () => { void maal() })
watch(() => props.uiTextScale, () => { void maal() })

function velg(id) {
  dra.value = 0
  emit('velg', id)
}
function sorter() {
  dra.value = 0
  emit('sorter')
}

// ── Draget ─────────────────────────────────────────────────────────────────
// Retningen er den samme som i et bunn-ark, bare speilvendt: skuffa henger fra
// toppen av skjermen, så NED er «vis mer» og OPP er «legg sammen».
const start = ref(null)
function onDraStart(e) {
  if (!maalt.value) return
  start.value = { y: e.clientY, dra: dra.value }
  drar.value = true
  e.currentTarget.setPointerCapture?.(e.pointerId)
  e.preventDefault()
}
function onDraFlytt(e) {
  if (!start.value) return
  const dy = e.clientY - start.value.y
  dra.value = Math.max(0, Math.min(1, start.value.dra + dy / draLengde.value))
}
function onDraSlutt() {
  if (!start.value) return
  // Retnings-basert dokking, samme regel som hvert bunn-ark i appen: et svakt
  // drag i én retning committer, man må ikke forbi midtpunktet.
  dra.value = pickSnapTarget(dra.value, start.value.dra, [0, 1], COMMIT)
  start.value = null
  drar.value = false
}
function settDra(v) {
  drar.value = false
  dra.value = v
}
</script>

<template>
  <div class="flex flex-col items-center gap-2 w-full">
    <div class="pointer-events-auto flex flex-col items-stretch rounded-2xl
                bg-overlay/90 backdrop-blur shadow-lg"
         :style="{ maxWidth: `calc(100vw - ${KANT_PX}px)`,
                   visibility: maalt ? 'visible' : 'hidden' }">
      <!-- GITTERET. Sammenlagt viser det første rad; høyden følger draget, og
           `overflow: hidden` lar de neste radene ligge og vente rett utenfor
           kanten. Før målingen er det en flex-rad med etikettene på, så
           cellene står i sin naturlige bredde — se punkt 3 i filhodet. -->
      <div ref="gitterRef" data-snarvei-gitter
           class="snarvei-rad px-1.5 pt-1.5 gap-1"
           :class="maalt ? 'grid overflow-hidden' : 'flex flex-wrap justify-center'"
           :style="gitterStil">
        <!-- `aktiv` er valgfri og bæres i dag bare av posisjonen: aksentgrønn
             flate + `aria-pressed`, samme par som vippebryterne i skuffene.
             `aria-pressed` settes bare når knappen FAKTISK er en bryter — en
             `aria-pressed="false"` på Stifinner ville lovet en av/på den ikke
             har. `zoom` per knapp: se filhodet. -->
        <button v-for="(s, i) in snarveier" :key="s.id"
                data-snarvei :data-snarvei-id="s.id"
                @click="velg(s.id)"
                :aria-pressed="s.aktiv === undefined ? undefined : !!s.aktiv"
                :aria-label="s.ariaTekst || s.aria"
                :style="{ zoom: uiTextScale,
                          opacity: maalt && i >= kolonner ? dra : 1 }"
                class="shortcut-btn" :class="s.aktiv ? 'shortcut-btn--pa' : ''">
          <SnarveiIkon :id="s.id" class="w-5 h-5 shrink-0" />
          <!-- Navnet AVDEKKES av draget: høyden gjør at cella krymper til et
               rent ikon sammenlagt, opasiteten at teksten ikke bare blir
               klippet. `aria-label` bærer navnet uansett, så den sammenlagte
               raden er ikke en rad med navnløse knapper. -->
          <span class="shortcut-btn__navn"
                :style="{ height: `${14 * dra}px`, opacity: dra }">{{ s.label }}</span>
        </button>
      </div>

      <!-- HÅNDTAKET: appens grå drawer-håndtak, bunnplassert og midtstilt, med
           SAMME luft rundt seg som i punkt-arket og funksjons-skuffene.
           Det er en `<button>` for tastaturets skyld — pil ned folder ut, pil
           opp legger sammen — men et KLIKK gjør ingenting (v7.5.0): man drar. -->
      <button type="button" data-snarvei-handle
              class="snarvei-handle shrink-0 w-full touch-none cursor-grab
                     active:cursor-grabbing py-3 flex justify-center"
              :aria-expanded="apen"
              :aria-label="apen ? 'Legg sammen snarveiene' : 'Dra ned for flere snarveier og sortering'"
              @keydown.down.prevent="settDra(1)"
              @keydown.up.prevent="settDra(0)"
              @pointerdown="onDraStart"
              @pointermove="onDraFlytt"
              @pointerup="onDraSlutt"
              @pointercancel="onDraSlutt">
        <span class="w-12 h-1.5 rounded-full bg-ink/40"
              :style="{ opacity: drar ? 0.6 : 1 }"></span>
      </button>
    </div>

    <!-- «Sorter snarveier» toner inn med draget, som alt annet det avdekker.
         `pointer-events` følger med: en usynlig knapp skal ikke ta trykk. -->
    <button v-if="dra > 0" type="button" @click="sorter"
            :style="{ zoom: uiTextScale, opacity: dra,
                      pointerEvents: apen ? 'auto' : 'none' }"
            class="pointer-events-auto shrink-0 px-4 py-2 rounded-xl
                   bg-overlay/90 backdrop-blur shadow-lg text-ink text-[12px]
                   font-medium whitespace-nowrap active:scale-95 transition">
      Sorter snarveier
    </button>
  </div>
</template>

<style scoped>
/* Snarvei-cella: ikon over etikett, med sin EGEN mørkegrå flate (v7.5.0).
   Fram til nå var flata usynlig til man holdt musa over — knappene fløt som
   løse ikoner i én svart boks, og bare den aktive posisjonen hadde en form.
   Nå har alle den samme: samme avrunding, samme størrelse, og «på» er en
   FARGE-forskjell og ikke forskjellen på å ha en flate og ikke ha en. */
.shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  /* 44 px er WCAG 2.5.8 / Apples minste trykkflate. Sammenlagt er cella bare
     et ikon, og da er det ingen etikett ved siden av å bomme inn på. */
  min-width: 44px;
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--color-ink) 12%, transparent);
  color: var(--color-ink);
  font-size: 10px;
  line-height: 1;
  transition: background 0.15s ease, transform 0.1s ease;
  /* Etikettene er ett kort ord hver — de skal aldri orddeles («Stifin-ner»).
     Overstyrer det globale hyphens: auto på #app. */
  hyphens: manual;
  white-space: nowrap;
}
.shortcut-btn:active { transform: scale(0.94); }
.shortcut-btn:hover { background: color-mix(in oklab, var(--color-ink) 20%, transparent); }

/* Etiketten er en boks som VOKSER, ikke en tekst som dukker opp: høyden er det
   som gjør at cella krymper til et rent ikon sammenlagt. `overflow: hidden` så
   halve bokstaver aldri stikker ut mens den er på vei. */
.shortcut-btn__navn {
  display: block;
  overflow: hidden;
  line-height: 12px;
}

/* EN KNAPP SOM ER PÅ: av er den nøytrale grå flata, på er appens aksentgrønne
   med hvitt innhold — samme par som hver vippebryter i skuffene. Emerald-600 og
   ikke -500: hvitt på -500 gir 2,6:1, altså under WCAG 1.4.11 sitt krav på 3:1
   for grafiske objekter. */
.shortcut-btn--pa { background: #059669; color: #fff; }
.shortcut-btn--pa:hover { background: #047857; }

/* Håndtaket har ingen egen flate — det er streken som er knappen — men
   trykkflata skal svare, så hover/aktiv tar streken og ikke boksen. */
.snarvei-handle:hover span { background: color-mix(in oklab, var(--color-ink) 62%, transparent); }
.snarvei-handle:active span { background: color-mix(in oklab, var(--color-ink) 75%, transparent); }

/* SIKKERHETSNETT i den umålte tilstanden: der er raden en flex-rad med
   etikettene på, og den skal BRYTE framfor å klippe en knapp ut over
   skjermkanten om målingen skulle glippe et bilde. */
.snarvei-rad { row-gap: 4px; }
</style>

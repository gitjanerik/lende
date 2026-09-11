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
// BREDESTE cella, og er det samme i begge tilstandene. Sammenlagt vises første
// rad; draget avdekker resten.
//
// NAVNET STÅR ALLTID — MEN DET ER EN BRYTER (v7.6.0). Fram til v7.5.0 avdekket
// draget etikettene, og den STANDARDEN er snudd: ikonene bærer ikke betydningen
// alene, og gevinsten ved å skjule dem var fjorten piksler på en rad som
// uansett bare er ÉN rad sammenlagt. Bryteren står derfor UNDER pilla med PÅ som
// default, for den som HAR lært ikonene og vil ha de pikslene tilbake.
//
// DE TO TILSTANDENE ER ULIKE, OG BEGGE ANIMERES AV SAMME `dra`:
//   • PÅ  — cella er like bred og like høy hele veien, og draget avdekker bare
//           FLERE RADER.
//   • AV  — cella krymper til ikon-høyde sammenlagt (`SNARVEI_MIN_H_SMAL`), og
//           navnene vokser fram MED de nye radene. Høyden og opasiteten på
//           etiketten henger begge på `dra`, så det er én sammenhengende
//           bevegelse — en tekst som blinker på et ferdig utvokst rutenett
//           leses som en feil.
//
// DRAGET ER KONTINUERLIG, som i punkt-arket og funksjons-skuffene (v7.5.0).
// Håndtaket satte før bare en av/på: raden hoppet mellom to former. Nå følger
// høyden fingeren hele veien (`dra`), de neste radene glir opp fra kanten, og
// de toner inn med den. På slipp DOKKER den til nærmeste ende med appens
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
// OG GRIPEFLATA ER HELE PILLA (v7.6.0). Håndtaket er 44 px høyt nederst i en
// boks som er dobbelt så høy, så man måtte sikte på den nederste tredjedelen —
// bommet man, trykket man på en snarvei. Pekerhandlerne bor nå på pilla, og
// håndtaket er igjen bare det det ser ut som: streken som SIER at boksen kan
// dras, pluss tastatur-inngangen. Se «Draget» nederst i skriptet for hvordan
// et drag skilles fra et trykk.
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
//    er også eneste vei til «Sorter» og navne-bryteren, og rekkefølgen er det
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
// 3. MÅLINGEN SKJER I ÉN SKJULT PASSERING, med gitteret AV. Cellene må stå i
//    sin naturlige bredde for at «bredeste celle» skal bety noe — i et gitter
//    er de alle like brede per definisjon, så en måling der ville lest
//    kolonnebredden vi nettopp valgte og jaget sin egen hale. Derfor
//    `maalt = false` → flex → les → gitter. Raden står `visibility: hidden` det
//    ene bildet det tar. Tekstskala, fontlasting og vindusbredde endrer
//    bredden, så alle tre utløser ommåling. Merk at bredden måles med navnene
//    PÅ uansett bryter: skrur man den av og på igjen, skal kolonnene ikke
//    flytte seg.
// 4. HØYDENE ER MÅLT, IKKE REGNET. `hLukket` (én rad) og `hApen` (alle rader)
//    leses av den ekte layouten i samme skjulte passering, og med navnene i
//    den tilstanden hver av de to faktisk har (`maalTvang`). En utregning fra
//    cellehøyde + gap ville vært riktig helt til noen endret en polstring, og
//    feilen ville vært en skuff som klipper det nederste av seg selv — usynlig
//    i enhetstester.
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
// «SORTER» ER FRISTILT (v7.4.0, kortet ned i v7.7.1): sin egen midtstilte knapp
// under den utfoldede skuffa. Den handler om RADEN og ikke om kartet, og en
// plass mellom Måling og 3D ville gjort den til nok en ting man trykker på ved
// et uhell. Den toner inn med draget, som alt annet som avdekkes. Ordet er ett:
// den står nå ved siden av «Navn», og «Sorter snarveier» der sa «snarveier» om
// noe man ser på.
//
// ─────────────────────────────────────────────────────────────────────────────
// SORTERINGEN SKJER I RADEN SELV (v7.7.0) — panelet er slettet, ikke flyttet.
//
// Fram til nå åpnet knappen en skuff med en LISTE: ni rader med et grep og to
// pil-knapper, altså en modell av raden man nettopp sto i. Man sorterte én ting
// mens man så på en annen, og det ENE spørsmålet sorteringen finnes for — hva
// havner bak håndtaket på min skjerm? — kunne lista per konstruksjon ikke svare
// på: den kjenner verken kolonnetallet eller hvor raden brytes. Nå flyttes
// knappene der de står, i det ekte gitteret, så svaret er det man ser på.
//
// DET ER EN MODUS, IKKE EN ALLTID-PÅ-GEST, og det er ikke en forsiktighet.
// Gripeflata er HELE PILLA (v7.6.0): et sveip ned hvor som helst i boksen åpner
// skuffa. Den flata kan ikke også bety «løft denne knappen» — én flate, to
// betydninger, og den ene er en gest man gjør hver gang man vil se resten. I
// tillegg er raden sammenlagt KLIPPET, så en alltid-på-sortering ville latt deg
// dra mot celler du ikke kan se. Modusen løser begge: `dra` låses til 1 (alt
// står framme), pilla slipper draget, og cellene overtar det.
//
// TRE VEIER TIL EN FLYTTING, og de dekker hver sin sperre:
//   • DRA cella dit den skal. De andre glir til side og viser gapet; et stiplet
//     spøkelse blir igjen der den lå. Ingenting flyttes før fingeren slippes —
//     samme regel som panelet hadde (v6.6.1), og grunnen er den samme: står
//     rekkefølgen stille, er stegene konstante og målplassen ren aritmetikk.
//   • TRYKK én celle, så plassen den skal til. Dette er SC 2.5.7 sitt krav om
//     at en dra-bevegelse skal kunne gjøres med ett enkelt trykk — det var
//     panelets opp/ned-knapper som bar det før, og det kravet er IKKE dekket av
//     et tastatur-alternativ.
//   • PILTASTENE på en fokusert celle flytter den ett hakk (venstre/høyre) eller
//     én rad (opp/ned) — SC 2.1.1. Fokus følger cella til den nye plassen, ellers
//     må man tabbe seg fram på nytt for hvert hakk.
//
// FOOTEREN ERSTATTER HÅNDTAKET MENS MODUSEN STÅR PÅ. Håndtaket skjules aldri
// ellers (punkt 1 under), og begrunnelsen der er at det er eneste vei til
// sorteringen — i sorterings-modus er man allerede framme, og et håndtak som
// ikke kan dra noe er verre enn ingen. «Ferdig» legger raden sammen igjen, så
// man ser resultatet: hva som ble stående på første linje.
//
// «TILBAKESTILL» FULGTE MED HIT. Den hørte hjemme i panelet fordi panelet var
// det ene stedet man så på raden som et objekt — nå er det raden selv.
//
// «VIS NAVN» GJORDE DET OGSÅ, OG DET VAR FEIL PLASS (v7.7.1). Bryteren fulgte
// med da panelet ble slettet, men å skru navnene av er ingen sorterings-
// handling: man vil ha en tettere rad, og da måtte man inn i en modus man ikke
// hadde noe å gjøre i for å komme til den. Den står nå UTENFOR den svarte
// boksen, ved siden av «Sorter» — begge er knotter som handler om RADEN og
// ikke om kartet, og de avdekkes av samme drag. Den er SKJULT i sorterings-
// modus: der er hver celle et objekt man flytter, og en bryter som endrer
// cellehøyden midt i et drag er en form som skifter under fingeren.
//
// UTENFOR PILLA BÆRER BRYTEREN ET EKTE SPOR. Inne i boksen var «på» allerede en
// FARGE (aksentgrønn flate), og et spor i tillegg ville vært to former for av/på
// på samme flate. Ute står den ved siden av «Sorter», som bare GJØR noe — og da
// er forskjellen på en av/på og en handling bare en farge man må ha sett før.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import SnarveiIkon from './SnarveiIkon.vue'
import {
  antallKolonner, antallRader, SNARVEI_MIN_H, SNARVEI_MIN_H_SMAL,
  gitterIndeks, gitterForskyvning, flyttSnarvei,
} from '../lib/snarveier.js'
import { pickSnapTarget } from '../composables/useDraggableDrawer.js'

const props = defineProps({
  // [{ id, label, aria }] i brukerens rekkefølge.
  snarveier: { type: Array, required: true },
  uiTextScale: { type: Number, default: 1 },
  // «Vis navn når minimert» fra Sorter-panelet. PÅ er standard — se filhodet.
  visNavn: { type: Boolean, default: true },
})
// `apen` går UT igjen fordi den utfoldede skuffa er flere linjer høy på en
// telefon og da dekker navigasjonssøyla, som står i sin egen `--ovl-nav`-slot
// rett under. Slotten kan ikke dimensjoneres for den utfoldede raden — den er
// en transient tilstand, og søyla ville stått permanent lavere for en skuff man
// sjelden drar ut. Kallstedet løfter i stedet raden over søyla mens den er ute.
// Radens egen z-index duger ikke: innpakningen i MapView er `z-20 absolute`,
// altså sin egen stacking context, og et barn kan ikke klatre ut av den.
const emit = defineEmits(['velg', 'flytt', 'vis-navn', 'tilbakestill', 'apen'])

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
// fingeren 1:1 når den HAR noe å vokse med, men vokse-rommet kan være null: får
// alle snarveiene plass på én rad OG navnene står alltid, er sammenlagt og
// utfoldet nøyaktig like høye — det eneste draget avdekker da er «Sorter
// snarveier» under raden. En divisor på 0 ville gjort hvert drag til et hopp
// rett til enden. Divisoren er derfor det STØRSTE av vokse-rommet og dette.
const DRA_MIN_PX = 72

// Dra-posisjonen: 0 = sammenlagt (første rad), 1 = utfoldet (alle rader). Alt
// annet i komponenten avledes av den.
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
// blir cella nøyaktig så høy som sporet — uansett hva den inneholder, så en
// måling med høyde-bindingen på leser bare tallet den selv nettopp skrev.
// Under målingen står høyden derfor på `auto`.
const maaler = ref(false)

// Måle-overstyring av `dra`: de to høydene leses i hver sin tilstand uten at
// brukerens faktiske dra-posisjon røres. `null` = ikke under måling.
const maalTvang = ref(null)
const draNaa = computed(() => maalTvang.value ?? dra.value)

// Hvor mye av etiketten som vises. Med bryteren PÅ er den alltid hel; med den
// AV følger den draget, så navn og radhøyde er én bevegelse.
const navnAndel = computed(() => (props.visNavn ? 1 : draNaa.value))
// Sammenlagt uten navn er cella bare et ikon, og da skal den være LAV — det er
// hele gevinsten ved å skru bryteren av. Minstehøyden går derfor ned med
// etiketten i stedet for å klemme animasjonen flat.
const celleMinH = computed(() => (props.visNavn
  ? SNARVEI_MIN_H
  : SNARVEI_MIN_H_SMAL + (SNARVEI_MIN_H - SNARVEI_MIN_H_SMAL) * draNaa.value))

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
  // BREDDEN MÅLES ALLTID MED NAVNENE PÅ, uansett bryter. Kolonnetallet skal
  // ikke endre seg av at man skrur etikettene av: en celle uten navn er
  // smalere, og da ville raden stokket om på seg selv i det man vippet
  // bryteren — nøyaktig det v7.5.0-gitteret finnes for å unngå.
  maalTvang.value = 1
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
  await nextTick()
  hApen.value = g.offsetHeight

  // SAMMENLAGT ER ÉN RAD, og den kan ikke leses av gitteret: med `height: auto`
  // står ALLE radene der, og `offsetHeight` ville gitt full høyde også ved
  // dra = 0. Fikk alle snarveiene plass på én rad var det tilfeldigvis riktig;
  // på en smal skjerm sto skuffa åpen fra start. Høyden regnes derfor av FØRSTE
  // celle pluss gitterets topp-polstring — det er nøyaktig den ene raden.
  maalTvang.value = 0
  await nextTick()
  const padTopp = parseFloat(getComputedStyle(g).paddingTop) || 0
  hLukket.value = Math.round(padTopp + celler[0].getBoundingClientRect().height)
  maalTvang.value = null
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
onBeforeUnmount(() => { ro?.disconnect(); losne?.() })

watch(apen, v => emit('apen', v))
// SETTET, IKKE REKKEFØLGEN (v7.7.0). Målingen leter etter den BREDESTE cella,
// og den er den samme uansett hvilken rekkefølge de står i — mens en ommåling
// koster en skjult passering der raden står `visibility: hidden`. Den passeringen
// BLENDER cella man nettopp flyttet: et element uten synlighet kan ikke ha
// fokus, så piltast-veien mistet fokus for hvert hakk (SC 2.1.1), og et drag
// ville fått transformene sine nullstilt midt i seg selv.
watch(() => [...props.snarveier.map(s => s.id)].sort().join(','), () => { void maal() })
watch(() => props.uiTextScale, () => { void maal() })
// Bryteren endrer den SAMMENLAGTE høyden (og bare den), så begge tallene må
// leses på nytt — ellers drar man i en skuff som tror den er 46 px høy.
watch(() => props.visNavn, () => { void maal() })

function velg(id) {
  if (sluk) { sluk = false; return }
  dra.value = 0
  emit('velg', id)
}

// ── Draget ─────────────────────────────────────────────────────────────────
// HELE PILLA ER GRIPEFLATE (v7.6.0), ikke bare håndtaket. Håndtaket er 44 px
// høyt og ligger nederst i en boks som er dobbelt så høy — man måtte treffe
// den nederste tredjedelen for å få tak i skuffa, og bommet man, trykket man
// på en snarvei i stedet. Nå tar pekeren tak hvor som helst i pilla, snarvei-
// knappene inkludert, og håndtaket er igjen det det ser ut som: streken som
// SIER at boksen kan dras.
//
// ET DRAG ER IKKE ET TRYKK, og skillet er en SLOP og ikke en tidtaking. Under
// terskelen skjer ingenting — `click` går sin gang til knappen under fingeren —
// og over den er draget i gang og trykket avlyst (`sluk`, lest og nullstilt av
// `velg`). Uten avlysningen ville hvert drag som startet på en snarvei også
// utløst den ved slipp.
//
// AKSEN AVGJØR OGSÅ. Bare et overveiende LODRETT drag griper: et sidelengs
// drag over pilla hører til kartet under, og en skuff som åpner seg fordi man
// panorerte er verre enn en skuff man må sikte på.
//
// Retningen er den samme som i et bunn-ark, bare speilvendt: skuffa henger fra
// toppen av skjermen, så NED er «vis mer» og OPP er «legg sammen».
const SLOP_PX = 6
const start = ref(null)
// Satt av et drag som passerte slop-en, og avlyser det ene `click`-et som
// følger pekeren. Den nullstilles på TRE steder med vilje: av `velg` som leser
// den, av neste `pointerdown`, og av en makrotask etter slippet. Grunnen er at
// klikket ikke ALLTID kommer — når draget har tatt pekerfangst, retargetes
// `click` til pilla og treffer aldri knappen — og et flagg som blir stående
// sant ville spist det NESTE ekte trykket. Makrotasken kjører etter at et
// eventuelt klikk er levert, så den kan ikke avlyse feil trykk.
let sluk = false

// BEVEGELSEN LYTTES PÅ VINDUET, IKKE PÅ PILLA, og alternativet er verre.
// Skuffa vokser NEDOVER, så fingeren forlater pilla nesten med én gang — og et
// `pointermove` som lander på kartet under bobler aldri opp hit. Den vanlige
// kuren er `setPointerCapture` på `pointerdown`, men den kan vi ikke bruke:
// med fangst aktiv leveres `click` til det FANGENDE elementet, altså pilla, og
// da kan man ikke lenger trykke på en snarvei i det hele tatt. Vindus-lytterne
// gir rekkevidden uten å røre klikk-målet.
let losne = null
function lyttPaaVinduet() {
  const flytt = (e) => onDraFlytt(e)
  const slutt = () => onDraSlutt()
  // passive: false — vi kaller preventDefault når draget først har tatt tak.
  window.addEventListener('pointermove', flytt, { passive: false })
  window.addEventListener('pointerup', slutt)
  window.addEventListener('pointercancel', slutt)
  losne = () => {
    window.removeEventListener('pointermove', flytt)
    window.removeEventListener('pointerup', slutt)
    window.removeEventListener('pointercancel', slutt)
    losne = null
  }
}

function onDraStart(e) {
  sluk = false
  losne?.()
  // I sorterings-modus eier CELLENE pekeren. Pilla kan ikke også dras: den
  // står låst åpen, og en skuff som legger seg sammen midt i en flytting ville
  // klippet bort nettopp plassen man siktet på.
  if (!maalt.value || sorterer.value || e.button > 0) return
  start.value = { x: e.clientX, y: e.clientY, dra: dra.value, tatt: false }
  lyttPaaVinduet()
  // INGEN `preventDefault` HER: den ville tatt `click` fra snarvei-knappene,
  // altså nøyaktig det pilla ellers er til for.
}
function onDraFlytt(e) {
  const s = start.value
  if (!s) return
  const dy = e.clientY - s.y
  if (!s.tatt) {
    const dx = e.clientX - s.x
    if (Math.abs(dy) < SLOP_PX || Math.abs(dx) > Math.abs(dy)) return
    s.tatt = true
    sluk = true
    drar.value = true
  }
  if (e.cancelable) e.preventDefault()
  dra.value = Math.max(0, Math.min(1, s.dra + dy / draLengde.value))
}
function onDraSlutt() {
  const s = start.value
  start.value = null
  losne?.()
  if (!s?.tatt) return
  // Retnings-basert dokking, samme regel som hvert bunn-ark i appen: et svakt
  // drag i én retning committer, man må ikke forbi midtpunktet.
  dra.value = pickSnapTarget(dra.value, s.dra, [0, 1], COMMIT)
  drar.value = false
  setTimeout(() => { sluk = false }, 0)
}
function settDra(v) {
  drar.value = false
  dra.value = v
}

// ── Sortering ──────────────────────────────────────────────────────────────
// Se filhodet for hvorfor dette er en MODUS og ikke en alltid-på-gest, og for
// de tre veiene til en flytting. Under står bare mekanikken.
const sorterer = ref(false)
const drarCelle = ref(-1)   // hvilken celle fingeren holder i
const overCelle = ref(-1)   // hvor den vil lande
const valgtCelle = ref(-1)  // løftet med ett trykk, venter på en plass
const celleDy = ref({ x: 0, y: 0 })
const kolSteg = ref(0)
const radSteg = ref(0)
const spokelse = ref(null)  // { x, y, w, h } i gitterets eget rom
const sisteFlytting = ref('')

function startSortering() {
  sorterer.value = true
  valgtCelle.value = -1
  sisteFlytting.value = ''
  settDra(1)
}
function avsluttSortering() {
  sorterer.value = false
  valgtCelle.value = -1
  drarCelle.value = -1
  spokelse.value = null
  // Sammenlagt igjen, så man ser hva sorteringen faktisk gjorde: hvem som ble
  // stående på første linje.
  settDra(0)
}

const sorterHint = computed(() => {
  if (valgtCelle.value >= 0) {
    return `Trykk der «${props.snarveier[valgtCelle.value]?.label}» skal stå`
  }
  return sisteFlytting.value || 'Dra en knapp dit du vil ha den, eller trykk to'
})

/** Flytter en snarvei og sier fra hva som skjedde. `fokus` følger piltastene. */
async function flyttCelle(fra, til, { fokus = false } = {}) {
  const n = props.snarveier.length
  if (fra < 0 || til < 0 || til >= n || fra === til) return
  const s = props.snarveier[fra]
  emit('flytt', flyttSnarvei(props.snarveier.map(x => x.id), fra, til))
  sisteFlytting.value = `${s.label} flyttet til plass ${til + 1} av ${n}`
  if (!fokus) return
  await nextTick()
  gitterRef.value?.querySelector(`[data-snarvei-id="${s.id}"]`)?.focus()
}

/** Ett trykk løfter cella, det neste plasserer den. SC 2.5.7. */
function trykkCelle(i) {
  if (sluk) { sluk = false; return }
  if (valgtCelle.value < 0) { valgtCelle.value = i; return }
  if (valgtCelle.value === i) { valgtCelle.value = -1; return }
  void flyttCelle(valgtCelle.value, i)
  valgtCelle.value = -1
}

function tastCelle(e, i) {
  const k = kolonner.value || 1
  const til = e.key === 'ArrowLeft' ? i - 1
    : e.key === 'ArrowRight' ? i + 1
      : e.key === 'ArrowUp' ? i - k
        : e.key === 'ArrowDown' ? i + k : null
  if (til === null) return
  e.preventDefault()
  e.stopPropagation()
  void flyttCelle(i, Math.max(0, Math.min(props.snarveier.length - 1, til)), { fokus: true })
}

// STEGENE MÅLES, DE REGNES IKKE. Cellene bærer `zoom`, så «cellebredde + gap»
// er riktig ved 100 % og feil ved 200 %; avstanden mellom to naboceller er
// riktig uansett. Måles ved hvert pekertrykk — tekstskala og vindusbredde kan
// ha endret seg siden forrige.
let celleStart = null
function maalSteg(celler) {
  const r0 = celler[0].getBoundingClientRect()
  const r1 = celler[1]?.getBoundingClientRect()
  const rN = celler[kolonner.value]?.getBoundingClientRect()
  kolSteg.value = (kolonner.value > 1 && r1) ? r1.left - r0.left : r0.width + gapPx.value
  const rg = parseFloat(getComputedStyle(gitterRef.value).rowGap) || 4
  radSteg.value = rN ? rN.top - r0.top : r0.height + rg
  return r0
}

function onCelleStart(e, i) {
  if (!sorterer.value || e.button > 0) return
  const g = gitterRef.value
  const celler = [...g.querySelectorAll('[data-snarvei]')]
  if (celler.length !== props.snarveier.length) return
  const r0 = maalSteg(celler)
  const rG = g.getBoundingClientRect()
  const r = celler[i].getBoundingClientRect()
  celleStart = { x: e.clientX, y: e.clientY, r, r0, tatt: false }
  spokelse.value = { x: r.left - rG.left, y: r.top - rG.top, w: r.width, h: r.height }
  drarCelle.value = i
  overCelle.value = i
  celleDy.value = { x: 0, y: 0 }
  lyttPaaCelle()
}

let losneCelle = null
function lyttPaaCelle() {
  losneCelle?.()
  const flytt = (e) => onCelleFlytt(e)
  const slutt = () => onCelleSlutt()
  window.addEventListener('pointermove', flytt, { passive: false })
  window.addEventListener('pointerup', slutt)
  window.addEventListener('pointercancel', slutt)
  losneCelle = () => {
    window.removeEventListener('pointermove', flytt)
    window.removeEventListener('pointerup', slutt)
    window.removeEventListener('pointercancel', slutt)
    losneCelle = null
  }
}

function onCelleFlytt(e) {
  const s = celleStart
  if (!s) return
  const dx = e.clientX - s.x
  const dy = e.clientY - s.y
  if (!s.tatt) {
    // Samme slop som pilla, men i BEGGE retninger: et gitter flyttes like mye
    // sidelengs som opp og ned, så en akse-test ville sperret halve draget.
    if (Math.hypot(dx, dy) < SLOP_PX) return
    s.tatt = true
    sluk = true   // avlyser trykket som ellers ville løftet cella
  }
  if (e.cancelable) e.preventDefault()
  celleDy.value = { x: dx, y: dy }
  // PUNKTET ER CELLAS SENTER, ikke fingeren: griper man i kanten av en knapp,
  // skal den lande der knappen er.
  overCelle.value = gitterIndeks(
    s.r.left + s.r.width / 2 + dx - s.r0.left,
    s.r.top + s.r.height / 2 + dy - s.r0.top,
    kolSteg.value, radSteg.value, kolonner.value, props.snarveier.length)
}

function onCelleSlutt() {
  const s = celleStart
  celleStart = null
  losneCelle?.()
  const fra = drarCelle.value
  const til = overCelle.value
  drarCelle.value = -1
  overCelle.value = -1
  celleDy.value = { x: 0, y: 0 }
  spokelse.value = null
  if (!s?.tatt) return
  valgtCelle.value = -1
  void flyttCelle(fra, til)
  setTimeout(() => { sluk = false }, 0)
}

onBeforeUnmount(() => losneCelle?.())

/**
 * Cellas plassering mens en annen dras. Den dratte følger fingeren; de andre
 * glir én plass for å åpne gapet der den vil lande.
 *
 * TRANSFORMEN DELES PÅ ZOOMEN. `zoom` står på knappen, så en `translate` på den
 * samme knappen måles i zoomede piksler — ved 200 % ville cella flyttet seg
 * dobbelt så langt som fingeren.
 */
function celleTransform(i) {
  if (drarCelle.value < 0) return null
  const z = props.uiTextScale || 1
  if (i === drarCelle.value) {
    return {
      transform: `translate(${celleDy.value.x / z}px, ${celleDy.value.y / z}px)`,
      transition: 'none',
    }
  }
  const f = gitterForskyvning(i, drarCelle.value, overCelle.value, kolonner.value)
  return { transform: `translate(${f.dKol * kolSteg.value / z}px, ${f.dRad * radSteg.value / z}px)` }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2 w-full">
    <!-- GRIPEFLATA ER HELE PILLA (v7.6.0). Pekerhandlerne står her og ikke på
         håndtaket, så et sveip ned hvor som helst i boksen åpner skuffa.
         `touch-none` er ikke valgfritt: uten den ruller/panorerer nettleseren
         på første piksel og `pointermove` slutter å komme. -->
    <div class="pointer-events-auto flex flex-col items-stretch rounded-2xl
                bg-overlay/90 backdrop-blur shadow-lg touch-none"
         @pointerdown="onDraStart"
         :style="{ maxWidth: `calc(100vw - ${KANT_PX}px)`,
                   visibility: maalt ? 'visible' : 'hidden' }">
      <!-- GITTERET. Sammenlagt viser det første rad; høyden følger draget, og
           `overflow: hidden` lar de neste radene ligge og vente rett utenfor
           kanten. Før målingen er det en flex-rad med etikettene på, så
           cellene står i sin naturlige bredde — se punkt 3 i filhodet. -->
      <div ref="gitterRef" data-snarvei-gitter
           class="snarvei-rad relative px-1.5 pt-1.5 gap-1"
           :class="maalt ? 'grid overflow-hidden' : 'flex flex-wrap justify-center'"
           :style="gitterStil">
        <!-- SPØKELSET: der cella lå da draget startet. Absolutt plassert, så
             det holder ingen gitter-plass — cella den tilhører står fortsatt i
             sin egen rute og er bare forskjøvet, så ruta kollapser ikke. -->
        <div v-if="spokelse" aria-hidden="true"
             class="absolute rounded-xl border border-dashed border-ink/40 pointer-events-none"
             :style="{ left: `${spokelse.x}px`, top: `${spokelse.y}px`,
                       width: `${spokelse.w}px`, height: `${spokelse.h}px` }"></div>
        <!-- `aktiv` er valgfri og bæres i dag bare av posisjonen: aksentgrønn
             flate + `aria-pressed`, samme par som vippebryterne i skuffene.
             `aria-pressed` settes bare når knappen FAKTISK er en bryter — en
             `aria-pressed="false"` på Stifinner ville lovet en av/på den ikke
             har. `zoom` per knapp: se filhodet. -->
        <button v-for="(s, i) in snarveier" :key="s.id"
                data-snarvei :data-snarvei-id="s.id"
                @click="sorterer ? trykkCelle(i) : velg(s.id)"
                @pointerdown="sorterer ? onCelleStart($event, i) : null"
                @keydown="sorterer ? tastCelle($event, i) : null"
                :aria-pressed="sorterer || s.aktiv === undefined ? undefined : !!s.aktiv"
                :aria-label="sorterer
                  ? `Flytt ${s.aria}. Plass ${i + 1} av ${snarveier.length}. Bruk piltastene.`
                  : (s.ariaTekst || s.aria)"
                :style="[{ zoom: uiTextScale,
                           minHeight: `${celleMinH}px`,
                           opacity: maalt && i >= kolonner ? dra : 1 },
                         celleTransform(i)]"
                class="shortcut-btn"
                :class="[s.aktiv && !sorterer ? 'shortcut-btn--pa' : '',
                         sorterer ? 'shortcut-btn--sorter' : '',
                         drarCelle === i ? 'shortcut-btn--loftet' : '',
                         valgtCelle === i ? 'shortcut-btn--valgt' : '']">
          <SnarveiIkon :id="s.id" class="w-5 h-5 shrink-0" />
          <!-- NAVNET. Med bryteren PÅ (standard) er `navnAndel` fast 1 og
               etiketten står; med den AV følger både høyden og opasiteten
               draget, så navnet vokser fram sammen med de nye radene.
               `aria-label` på knappen bærer den fulle teksten uansett —
               «Posisjon på. Slå av.» sier mer enn ordet under ikonet — så en
               skjult etikett gjør aldri raden navnløs. -->
          <span class="shortcut-btn__navn"
                :style="navnAndel < 1
                        ? { height: `${12 * navnAndel}px`, opacity: navnAndel }
                        : null">{{ s.label }}</span>
        </button>
      </div>

      <!-- HÅNDTAKET: appens grå drawer-håndtak, bunnplassert og midtstilt, med
           SAMME luft rundt seg som i punkt-arket og funksjons-skuffene.
           Fra v7.6.0 eier det ikke draget lenger — hele pilla gjør det — men
           det blir stående, av to grunner: det er streken som SIER at boksen
           kan dras, og det er den eneste veien inn i skuffa fra tastatur
           (pil ned folder ut, pil opp legger sammen, SC 2.1.1). Et KLIKK gjør
           fortsatt ingenting (v7.5.0). -->
      <button v-if="!sorterer" type="button" data-snarvei-handle
              class="snarvei-handle shrink-0 w-full cursor-grab
                     active:cursor-grabbing py-3 flex justify-center"
              :aria-expanded="apen"
              :aria-label="apen ? 'Legg sammen snarveiene' : 'Dra ned for flere snarveier og sortering'"
              @keydown.down.prevent="settDra(1)"
              @keydown.up.prevent="settDra(0)">
        <span class="w-12 h-1.5 rounded-full bg-ink/40"
              :style="{ opacity: drar ? 0.6 : 1 }"></span>
      </button>

      <!-- SORTERINGS-FOOTEREN står der håndtaket sto. Hintet er et `status`-
           felt: det sier både hva man kan gjøre og hva som NETTOPP skjedde, og
           en flytting med piltastene eller med to trykk har ellers ingen
           tilbakemelding for den som ikke ser gitteret. -->
      <div v-else data-sorter-footer class="px-2 pt-1 pb-2 flex flex-col items-center gap-1.5">
        <p role="status" aria-live="polite"
           class="text-[11px] leading-snug text-center text-ink/70"
           :style="{ zoom: uiTextScale }">{{ sorterHint }}</p>
        <div class="flex flex-wrap items-center justify-center gap-1.5"
             :style="{ zoom: uiTextScale }">
          <button type="button" class="sorter-knapp" @click="emit('tilbakestill')">
            Tilbakestill
          </button>
          <button type="button" class="sorter-knapp sorter-knapp--ferdig"
                  @click="avsluttSortering">
            Ferdig
          </button>
        </div>
      </div>
    </div>

    <!-- UNDER PILLA: de to knottene som handler om RADEN og ikke om kartet.
         Begge toner inn med draget, som alt annet det avdekker, og
         `pointer-events` følger med — en usynlig knapp skal ikke ta trykk.

         BRYTEREN STÅR HER OG IKKE I SORTERINGS-FOOTEREN (v7.7.1). Den lå der
         først fordi den fulgte med da panelet ble slettet, men å skru navnene
         av er ikke en sorterings-handling: man vil ha en tettere rad, og da
         måtte man inn i en modus man ikke hadde noe å gjøre i for å komme til
         den. Den er SKJULT i sorterings-modus — der er hver celle et objekt man
         flytter, og en bryter som endrer cellehøyden midt i et drag er en form
         som skifter under fingeren. -->
    <div v-if="dra > 0 && !sorterer" class="pointer-events-auto flex items-center gap-2"
         :style="{ zoom: uiTextScale, opacity: dra,
                   pointerEvents: apen ? 'auto' : 'none' }">
      <button type="button" role="switch" :aria-checked="visNavn"
              aria-label="Vis navn under ikonene når raden er sammenlagt"
              @click="emit('vis-navn', !visNavn)"
              class="rad-knott" :class="visNavn ? 'rad-knott--pa' : ''">
        <span class="rad-knott__spor" aria-hidden="true">
          <span class="rad-knott__kule"></span>
        </span>
        Navn
      </button>
      <button type="button" class="rad-knott" @click="startSortering">
        Sorter
      </button>
    </div>
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
  /* Et gulv, ikke en bredde: kolonnen er uansett så bred som det lengste ordet
     i settet. Minstehøyden settes inline (`celleMinH`) fordi den følger
     bryteren og draget — se filhodet. */
  min-width: 44px;
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

/* Fast `line-height` og ikke `normal`: cella er en gitter-celle, og et
   linjehøyde-tall som følger fonten gjør radhøyden avhengig av hvilken font som
   rakk å laste da målingen kjørte. `overflow: hidden` er for den AV-slåtte
   bryteren, der høyden animeres fra 0 — uten den stikker halve bokstaver ut
   mens etiketten er på vei opp. */
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

/* SORTERINGS-MODUS. Cella er den samme knappen — samme størrelse, samme plass
   i gitteret — men den er nå et OBJEKT man flytter og ikke en funksjon man
   utløser, og det må ses uten at raden skifter form. `grab`-pekeren og den
   stiplede kanten sier det på desktop; den løftede cella og spøkelset sier det
   i bevegelse. */
.shortcut-btn--sorter {
  cursor: grab;
  border: 1px dashed color-mix(in oklab, var(--color-ink) 30%, transparent);
  /* Kanten legges INNI cella: en ekte border ville gjort den 2 px bredere enn
     kolonnen den ble målt for, og hele gitteret ville skiftet ved modusbytte. */
  box-sizing: border-box;
  transition: transform 0.18s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.shortcut-btn--sorter:active { transform: none; cursor: grabbing; }

/* Den man holder i: løftet ut av flata, over naboene den passerer. `transition:
   none` settes inline fra `celleTransform` — uten den henger cella etter
   fingeren. */
.shortcut-btn--loftet {
  z-index: 20;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
  background: color-mix(in oklab, var(--color-ink) 28%, transparent);
  border-style: solid;
}

/* Løftet med ETT trykk, venter på en plass (SC 2.5.7). Aksentfargen er radens
   egen «på»-grønn: i denne boksen betyr grønt allerede «denne er aktiv». */
.shortcut-btn--valgt {
  background: #059669;
  color: #fff;
  border-color: #fff;
}

/* Footer-knappene. Samme form som snarvei-cellene, bare lavere: de hører til
   raden og ikke til et panel. */
.sorter-knapp {
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.1;
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-ink);
  background: color-mix(in oklab, var(--color-ink) 12%, transparent);
  transition: background 0.15s ease, transform 0.1s ease;
}
.sorter-knapp:active { transform: scale(0.94); }
.sorter-knapp:hover { background: color-mix(in oklab, var(--color-ink) 20%, transparent); }
.sorter-knapp--pa { background: #059669; color: #fff; }
.sorter-knapp--pa:hover { background: #047857; }
/* «Ferdig» er veien ut, og den eneste knappen her som avslutter noe. */
.sorter-knapp--ferdig {
  background: var(--color-ink);
  color: var(--color-overlay, #111);
}
.sorter-knapp--ferdig:hover { background: color-mix(in oklab, var(--color-ink) 85%, transparent); }

/* KNOTTENE UNDER PILLA. De bor UTENFOR den svarte boksen, og har derfor sin
   egen flate — samme pille-form som overlegget ellers, så de leses som en del
   av raden og ikke som noe på kartet.

   BRYTEREN BÆRER ET EKTE SPOR, og det er ikke pynt: her står den ved siden av
   «Sorter», som bare GJØR noe, og uten sporet er forskjellen på en av/på og en
   handling bare en farge man må ha sett før. Inne i skuffene er den samme
   forskjellen allerede etablert, men denne står alene over kartet. Sporet er
   `aria-hidden` — `role="switch"` + `aria-checked` er det hjelpemidlene leser. */
.rad-knott {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.1;
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-ink);
  background: color-mix(in oklab, var(--color-overlay, #111) 90%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.25);
  transition: background 0.15s ease, transform 0.1s ease;
}
.rad-knott:active { transform: scale(0.95); }
.rad-knott:hover { background: var(--color-overlay, #111); }

/* Sporet: 26 × 14 px er lite nok til å stå i en pille og stort nok til å leses
   som en bryter. Kula flyttes med `translate` og ikke med `margin`, så
   bevegelsen er komposittert og ikke en layout-endring. */
.rad-knott__spor {
  display: inline-block;
  width: 26px;
  height: 14px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-ink) 25%, transparent);
  transition: background 0.15s ease;
}
.rad-knott__kule {
  display: block;
  width: 10px;
  height: 10px;
  margin: 2px;
  border-radius: 999px;
  background: var(--color-ink);
  transition: transform 0.15s ease, background 0.15s ease;
}
/* PÅ er appens aksentgrønne, som hver vippebryter i skuffene. Emerald-600 og
   ikke -500: hvitt på -500 gir 2,6:1, under WCAG 1.4.11 sitt krav på 3:1. */
.rad-knott--pa .rad-knott__spor { background: #059669; }
.rad-knott--pa .rad-knott__kule { transform: translateX(12px); background: #fff; }

@media (prefers-reduced-motion: reduce) {
  .shortcut-btn--sorter { transition: none; }
  .rad-knott__kule { transition: none; }
}

/* Håndtaket har ingen egen flate — det er streken som er knappen — men
   trykkflata skal svare, så hover/aktiv tar streken og ikke boksen. */
.snarvei-handle:hover span { background: color-mix(in oklab, var(--color-ink) 62%, transparent); }
.snarvei-handle:active span { background: color-mix(in oklab, var(--color-ink) 75%, transparent); }

/* SIKKERHETSNETT i den umålte tilstanden: der er raden en flex-rad med
   etikettene på, og den skal BRYTE framfor å klippe en knapp ut over
   skjermkanten om målingen skulle glippe et bilde. */
.snarvei-rad { row-gap: 4px; }

/* RADENE MÅ VÆRE INNHOLDSHØYE, IKKE CONTAINERHØYE (v7.6.0), og det er ikke en
   finpuss. Gitteret har en DEFINITT høyde (den er det draget animerer), og
   `auto`-spor i en slik container KLEMMES når innholdet ikke får plass — de
   overflyter ikke. Målt i Chromium med to rader i en 52 px-boks: sporene ble
   44 px i stedet for 46, og etiketten 10 px i stedet for 12. Symptomet er at
   cella skifter form av draget, altså nøyaktig det gitteret finnes for å
   unngå; årsaken ser ikke ut som layout i det hele tatt. `max-content` gjør
   sporene like høye uansett hva containeren sier, og `overflow: hidden`
   klipper resten — som er hele poenget med skuffa. */
.snarvei-rad.grid { grid-auto-rows: max-content; }
</style>

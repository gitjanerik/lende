<script setup>
// Fullskjerm 3D-visning — ÉN viser for alle tre inngangene (v5.7.0):
//   • fra kartet          → fri utforsking, ingen tur
//   • trykk på stinettet  → en tur visningen lager selv
//   • Stifinner/rundtur   → den planlagte ruta står klar i følge-kameraet
//
// Skallet eier motorens livssyklus (create3dScene i onMounted, dispose i
// onBeforeUnmount) og holder alt engine-relatert utenfor Vue-reaktivitet
// (toRaw/ikke-reaktive variabler) — reaktive proxies i RAF-loopen dreper
// frameraten.
//
// TEKSTSTØRRELSENE I 3D-OVERLEGGET ER `rem`, IKKE `px` (v5.27.0). Det er en
// UU-tilpasning, og den er lett å «rydde» bort igjen uten å vite det: Chrome på
// Android skalerer rot-fontstørrelsen etter Tilgjengelighet → Tekstskalering, og
// `rem` følger den. Faste `px` gjør det aldri. Tailwinds avstandsskala er også
// rem-basert, så polstring og knappehøyder vokser i takt av seg selv — det er
// derfor teksten ikke sprenger boksene sine. Resten av appen er fortsatt px
// (605 forekomster); 3D er første flate som følger systemet, og det er en
// bevisst start og ikke en glipp.
//
// Merk at iOS/Safari ikke følger Dynamic Type gjennom `rem` uten
// `font: -apple-system-body`, og at `index.html` fortsatt setter
// `user-scalable=no`. Begge er egne saker. Lukkeveier: X-knapp, Escape og Android-tilbakeknapp (pushState +
// popstate; samme URL, så vue-router er upåvirket).
import { ref, computed, watch, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { useScreenWakeLock } from '../../composables/useScreenWakeLock.js'
import { sampleProfile } from '../../lib/elevationProfile.js'
import Tour3dFeatureCard from './Tour3dFeatureCard.vue'
import Tour3dPinPanel from './Tour3dPinPanel.vue'
import Tour3dInfoPanel from './Tour3dInfoPanel.vue'
import Tour3dHud from './Tour3dHud.vue'
import Tour3dVaerRad from './Tour3dVaerRad.vue'
import Tour3dNordlysPanel from './Tour3dNordlysPanel.vue'
import Tour3dHimmelSok from './Tour3dHimmelSok.vue'
import Tour3dHimmelKort from './Tour3dHimmelKort.vue'
import Tour3dHimmelKompass from './Tour3dHimmelKompass.vue'
import RetningsRose from '../kontroller/RetningsRose.vue'
import ZoomSkyv from '../kontroller/ZoomSkyv.vue'
import { blikkHoydeGrenserFullt } from '../../lib/tour3d/freeRig.js'
import { zoomBroek, zoomFraBroek } from '../../lib/navKontroller.js'
import { lesPinPrefs, skrivPinPrefs, paaGrupper } from '../../lib/tour3d/pinPrefs.js'
import { svgToWgs84 } from '../../lib/utm.js'
import { fetchVarsel, naaVarsel } from '../../lib/vaerFetcher.js'
import { vaerTilHimmel } from '../../lib/tour3d/vaerHimmel.js'
import { DEMO_STEG, DEMO_SEKUNDER, demoMaling } from '../../lib/tour3d/vaerDemo.js'
import { hentNordlys } from '../../lib/nordlysFetcher.js'
import { sannsynlighetFor, ovalenNordover } from '../../lib/nordlys.js'
import { nordlysPreg } from '../../lib/tour3d/nordlysHimmel.js'
import {
  DEMO_STEG as NORDLYS_STEG, DEMO_SEKUNDER as NORDLYS_SEKUNDER,
  demoMaling as nordlysDemoMaling, demoTall as nordlysDemoTall,
} from '../../lib/tour3d/nordlysDemo.js'
import { cacheGet, cacheSet, vaerPointKey, TTL } from '../../lib/protectedAreaCache.js'
import { himmelObjekter, naboerFor } from '../../lib/tour3d/himmelObjekter.js'
import { erNatt } from '../../lib/tour3d/astronomi.js'
// Hovedmenyens 100/125/150/200-valg. 3D-overlegget er ellers rem-basert (v5.27.0,
// som følger systemets tekstskalering), men nattmodus' tekst er det ENESTE man
// leser i 3D-visningen — og da skal appens eget valg gjelde der også.
import { useUiTextScale } from '../../composables/useUiTextScale.js'

const props = defineProps({
  dem: { type: Object, default: null },
  meta: { type: Object, required: true },
  searchIndex: { type: Array, default: () => [] },
  // Sti-/veg-geometri lest ut av kart-SVG-en av forelderen (som eier DOM-en).
  pathFeatures: { type: Array, default: () => [] },
  // Hindre-geometri (vann, hovedvei, jernbane, bygning, stup) — sti-vandringen
  // hopper ikke over et brudd i stinettet når et av disse ligger imellom.
  barrierFeatures: { type: Array, default: () => [] },
  // Brukerminner bakt inn i SVG-en — offline-tilgjengelige.
  brukerminner: { type: Array, default: () => [] },
  // Planlagt tur fra Stifinneren: { route: {coordinates, lengthM}, via, isLoop }.
  // Null = visningen åpnes uten tur.
  tour: { type: Object, default: null },
  estWalkMinutes: { type: Function, default: null },
  // Arkets kartfliser som SVG-strenger + rutene de dekker, klare til
  // rasterisering (se mapTexture.prepareMapTextureSource). Kalles på nytt for
  // mørkt tema og hver gang teksturen må bygges om.
  getTextureSpec: { type: Function, required: true },
  isDark: { type: Boolean, default: false },
  // Live GPS-posisjon i SVG-meter, null når posisjonering ikke er aktiv.
  // MapView sender et nytt lite objekt per fix, så watch-en trigges.
  userPos: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const { uiTextScale } = useUiTextScale()

/**
 * Stil for en boks som skal SKALERE MED TEKSTVALGET (100/125/150/200 i hovedmenyen).
 *
 * `zoom` alene er ikke nok, og det er en felle som er MÅLT: `vw` og `vh` inne i
 * et zoom-lag skaleres IKKE ned — de er absolutte mot viewporten, og blir så
 * ganget med zoomen. Målt i Chromium: en boks med `max-width: 78vw` inne i
 * `zoom: 1.5` dekker 117 % av skjermen, altså renner den ut på begge sider.
 * Derfor deles taket på skalaen her, og boksene selv bruker `max-w-full`.
 *
 * @param {number} vw taket i prosent av skjermbredden, på skjermen
 * @param {number} [vh] tilsvarende for høyden
 */
function tekstBoks(vw, vh = null) {
  const s = uiTextScale.value || 1
  return {
    zoom: s,
    maxWidth: `${vw / s}vw`,
    ...(vh ? { maxHeight: `${vh / s}vh` } : {}),
  }
}

// Infokortets tak, som en CSS-lengde kortet selv kan bruke. Regnet her og ikke
// der, fordi det er DENNE flaten som setter `zoom` — se `tekstBoks`.
const himmelKortHoyde = computed(() => `${66 / (uiTextScale.value || 1)}vh`)

// Samme regel for hjelpe-nedtrekket i «Info». Taket er ikke pynt: ved 150 %
// er den utvidede hjelpeboksen målt til 527 px, og uten det renner den under
// bunnraden.
const infoMaksBredde = computed(() => `${78 / (uiTextScale.value || 1)}vw`)
const infoMaksHoyde = computed(() => `${60 / (uiTextScale.value || 1)}vh`)

const KRYSSPAUSE_KEY = 'lende-3d-krysspause'
const VAERDEMO_KEY = 'lende-3d-vaerdemo'
const NORDLYSDEMO_KEY = 'lende-3d-nordlysdemo'
// Utvikler-bryter fra Utvikler-fanen (DrawerDevTab): vis månen OG planetene med
// globe selv når de står under horisonten. De er nede store deler av døgnet — og
// Mars, Jupiter og Saturn store deler av året — og da kan verken globene eller
// trykk-plukkingen av dem prøves. Leses her framfor å gå som prop gjennom hele
// kjeden — samme begrunnelse som vær-demoen.
//
// Nøkkelen het `lende-3d-maane-tvang` til v6.3.1, da de tre planetene ble med.
// Den er byttet framfor migrert: bryteren er utvikler-bare, og et navn som lyver
// om hva flagget gjør er verre enn å slå den på én gang til.
const HIMMEL_TVANG_KEY = 'lende-3d-himmel-tvang'
const himmelTvang = (() => {
  try { return localStorage.getItem(HIMMEL_TVANG_KEY) === '1' } catch { return false }
})()
const TIME_SCALES = [64, 128, 256]
const HUD_FELTER = ['gaatt', 'igjen', 'hoyde', 'stigning', 'eta']

const phase = ref('loading')      // loading | ready | no-dem | no-webgl | error
// Kortet for en severdighet: den man TRYKKET på vinner over den turen stopper
// ved, så et valg aldri blir overskrevet av koreografien.
const pickedFeature = ref(null)
const stopFeature = ref(null)
const activeFeature = computed(() => pickedFeature.value ?? stopFeature.value)
const walking = ref(false)
const fixedTour = ref(false)
const playing = ref(false)
const finished = ref(false)
const detached = ref(false)
// Blikket er vippet opp i himmelen (freeRig.himmelVipp > 0). Da er det ikke
// kartet man ser, og hintet nede sier hvordan man kommer tilbake.
const serOpp = ref(false)

// STJERNEMODUS = NATT. Ikke en modus ved siden av natta, men natta selv.
//
// v6.0.0 hadde en egen maksimer-knapp som skjulte overlegget. Den ble prøvd i
// felt, og konklusjonen var at knappen var i veien for sin egen hensikt: den som
// slår på natt i 3D gjør det for å se stjerner, og da er hvert hvite element på
// skjermen en feil — inkludert knappen man må finne for å bli kvitt dem. Natt
// går derfor RETT inn i det bildet. Én bryter, ikke to.
//
// Igjen står sol/måne-knappen (veien tilbake til dag), X-en, og himmelsøket
// mellom dem. Kurver, stier og nåler skjules — se `nattSkjulteLag`. Nattmodus er
// stjernekikkeren, ikke kartet i mørkt tema.
const stjernemodus = computed(() => nightOn.value)

// ---- Himmelsøket ---------------------------------------------------------
// Lista over hva som er valgbart på himmelen regnes HER og sendes til motoren,
// så søkefeltet og trykk-plukkingen aldri kan ha ulike meninger om hva som er
// synlig. Samme regel som mosaikken i CLAUDE.md: to steder som besvarer «hva
// ser jeg nå?» må svare likt.
const himmelListe = ref([])
const valgtHimmel = ref(null)
// Porten er nå bare nattmodus. Fram til v6.1.0 krevde den i tillegg at blikket
// var løftet — men natt løfter blikket selv, og et felt som dukker opp midt i
// den bevegelsen leses som et blaff. Ser man ned i kartet igjen, står søket
// fortsatt der: det er den ene tingen man leter etter i mørket.
const himmelSokSynlig = computed(() => phase.value === 'ready' && nightOn.value)
const himmelNaboer = computed(() => naboerFor(valgtHimmel.value, himmelListe.value, 3))

// ---- Globene: månen, Mars, Jupiter, Saturn -------------------------------
// Trykk på legemet og skiva blir en kule man kan snurre. Labelene kommer fra
// motoren som SKJERMKOORDINATER (motoren har kameraet; viseren har DOM-en), og
// oppdateres ~8 ganger i sekundet — nok til at navnene henger med i draget uten
// en Vue-oppdatering pr frame.
const globeAapen = ref(false)
const globeTrekk = ref([])

// ---- Himmelkompasset -----------------------------------------------------
// Blikkretningen i grader, fra motoren. I nattmodus er kartet ute av bildet, og
// da mister man himmelretningene helt — man kan stå og se på Karlsvogna uten å
// vite at man ser nordover. Kompasset nede til høyre gir det tilbake.
const blikk = ref(null)

// ---- Navigasjonskontrollene (desktop) -----------------------------------
// EN TILGJENGELIGHETSFIKS, ikke en ekstra måte å gjøre det samme. Alle tre
// bevegelsene i 3D er GESTER som ikke finnes på en vanlig maskin: himmelvippen
// og rotasjonen krever HØYRE museknapp (venstre panorerer, se mouseButtons i
// freeRig), og zoom krever et scrollhjul. Ingenting på skjermen sier det. Uten
// kontrollene kan man verken løfte blikket, snu seg eller komme nærmere med en
// styreflate — hele visningen er da låst i åpningsbildet.
//
// ROSA BÆRER TO AKSER I ÉN FLATE. Fire loddrette skyver langs kanten er et
// instrumentbord; rotasjon og tilt er dessuten ÉN retning på en kule, ikke to
// uavhengige tall. Se toppkommentaren i RetningsRose.vue.
//
// GRENSENE LESES AV RIGGEN og skrives ikke av: en kontroll med et annet område
// enn riggen kan levere ender i et håndtak som står stille i endene. Rosa bruker
// det FULLE området (blikkHoydeGrenserFullt) og ikke skyvens: den går gjennom
// settBlikkRetning, som eier både vippe- og orbit-regimet, og kan derfor også
// tilte landskapet ned til fugleperspektiv.
const BLIKK_GRENSER = blikkHoydeGrenserFullt()

// Avstands-området fra riggen, lest når motoren er klar. Null før det — og da
// vises ingen zoom-skyv, framfor en skyv med oppdiktede endepunkter.
const avstandGrenser = ref(null)
const zoomBroekNaa = computed(() => {
  const g = avstandGrenser.value
  const a = blikk.value?.avstand
  if (!g || !Number.isFinite(a)) return 0
  // INVERTERT: opp på skyven er INN i kartet, altså kortere avstand.
  return 1 - zoomBroek(a, g.min, g.maks)
})
const zoomAvlest = computed(() => {
  const a = blikk.value?.avstand
  if (!Number.isFinite(a)) return ''
  return a >= 1000 ? `${(a / 1000).toFixed(1)} km` : `${Math.round(a)} m`
})
function settZoom(broek) {
  const g = avstandGrenser.value
  if (!g) return
  engine?.settAvstand(zoomFraBroek(1 - broek, g.min, g.maks))
}
function settRetning({ azimut, hoyde }) {
  engine?.settBlikkRetning(azimut, hoyde)
}

// Fin peker OG hover = mus eller styreflate, altså ingen berøring å dra med. På
// telefon er draget der alt, og en skyveknapp ville bare tatt plass. Leses én
// gang: en enhet bytter ikke pekertype midt i en økt.
const finPeker = (() => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches } catch { return false }
})()

// «Klikk» er feil ord på en telefon og «trykk» er feil på en maskin. Samme
// peker-tilpasning som hjelpepanelet gjør for gestene. MÅ stå etter finPeker:
// den er en `const`, altså ikke hoistet — se TDZ-regelen i CLAUDE.md.
const STARGAZER_TEKST = finPeker
  ? 'Klikk for å åpne natthimmelen'
  : 'Trykk for å åpne natthimmelen'

// NAVIGASJONSSØYLA EIER SIN EGEN KANT (v6.5.20). Den ligger absolutt plassert på
// høyre side og er en KONTROLL — et trykk der hører til zoomen og rosa. Da må
// flyt-innholdet holde seg unna, og det gjorde det ikke: infokortet er sentrert
// med inntil 86 vw, og på et smalt vindu la det seg under søyla. «alle 9» i et
// stjernebildekort ble da et trykk som traff zoom-skyven, og røyktesten fanget
// det som en klikk-timeout på en knapp som var både synlig og aktiv.
//
// Polstringen står på ROTEN og ikke på hver rad. Absolutt plasserte barn —
// lerretet, himmelkompasset, søyla selv — måler mot padding-BOKSEN og står
// stille, mens hver eneste flyt-rad rykker inn i én operasjon. Det gjelder også
// rader som ikke kolliderer i dag: POI-panelet kan bli 60 vh høyt og vokser rett
// inn i søylas bånd så snart noen slår på flere nålegrupper.
const NAV_SOYLE_PX = 96   // rosa er 4,75 rem = 76 px, resten er panelets polstring og marg
const overleggStil = computed(() => ({
  height: '100dvh',
  paddingRight: finPeker && phase.value === 'ready' ? `${NAV_SOYLE_PX}px` : '0px',
}))
function lukkGlobe() {
  engine?.lukkGlobe()
  globeAapen.value = false
  globeTrekk.value = []
}

/**
 * «Tilbake til natthimmel» — knappen under kula (v6.5.40).
 *
 * Kula lukkes ALT av et trykk utenfor den, men gesten er ikke å gjette på: uten
 * en forklaring trykket brukerne i stedet X-en oppe til høyre, som lukker hele
 * 3D-visningen. Knappen sier hva veien ut er, og den forklarende TEKSTEN i
 * kortet er fortsatt fjernet med vilje (v6.3.3) — en knapp er en affordanse, en
 * bruksanvisning er ord man må lese i mørket.
 *
 * Går gjennom motorens `avsluttGlobe`, som er samme kilde trykket bruker, og
 * tilstanden kommer tilbake gjennom `globe` og `globe-avsluttet` — de to
 * hendelsene som alt legger kortet sammen. Å sette flaggene her i tillegg ville
 * gitt to steder som mener noe om samme tilstand.
 */
function tilbakeTilNatthimmel() {
  engine?.avsluttGlobe()
}

function byggHimmelListe() {
  const m = props.meta
  if (!m?.widthM || !m?.heightM) return
  let punkt
  try {
    punkt = svgToWgs84(m.widthM / 2, m.heightM / 2, m)
  } catch { return }
  if (!Number.isFinite(punkt?.lat) || !Number.isFinite(punkt?.lon)) return
  himmelListe.value = himmelObjekter({
    lat: punkt.lat, lon: punkt.lon, dato: new Date(),
    // MÅ være samme flagg som motoren fikk. Tvinger vi et legeme opp i himmelen
    // men ikke i lista, tilbyr ikke søket noe man ser — og trykk-plukkingen
    // finner det ikke. Samme regel som mosaikken i CLAUDE.md: to steder som
    // svarer på «hva ser jeg nå?» må svare likt.
    tvingHimmel: himmelTvang,
  })
  engine?.setHimmelObjekter(toRaw(himmelListe.value))
}

// Infokortet kan legges sammen til én linje, og ETHVERT valg gir den sammenlagte
// pilla (v6.3.11): himmelen er det man er der for, og en tekstblokk over halve
// skjermen står i veien for den. Kortet åpnes bare når brukeren ber om det, ved å
// trykke på pilla.
//
// Dette avløser tre tidligere regler — «første valg åpner» (v6.0.0), «et bytte
// beholder tilstanden» (v6.3.7) og «lista minimerer, trykket åpner» (v6.3.10).
// Alle tre prøvde å GJETTE om man ville lese eller se, ut fra hvordan valget kom
// inn. Sammenlagt som standard trenger ingen gjetning, og den er billig å angre:
// pilla er ett trykk.
const kortMinimert = ref(false)

/**
 * Valg fra søkelista og fra nabo-snarveiene. Egen funksjon fordi den også skal
 * legge kortet sammen; `velgHimmel` er mekanismen, denne er handlingen.
 */
function velgOgSe(o) {
  velgHimmel(o)
  if (o) kortMinimert.value = true
}

function velgHimmel(o) {
  valgtHimmel.value = o ?? null
  engine?.velgHimmel(o ? toRaw(o) : null)
  // Motoren melder tilbake gjennom 'globe', men bare når tilstanden FAKTISK
  // endret seg. Velger man noe uten globe — et stjernebilde, Merkur, Venus — er
  // kula lukket her og nå. Månen og de tre planetene med globe åpner den, og
  // motoren sier fra.
  if (!o?.harGlobe) {
    globeAapen.value = false
    globeTrekk.value = []
  }
}
// Fingeren ligger nede og ser seg rundt fra et frosset punkt (følge-riggens
// hold). Vises som et hint så den som fant det ved uhell skjønner hva som skjer.
const holdingLook = ref(false)
const timeScale = ref(128)
const stats = ref(null)
const junction = ref(null)
// Krysspause: turen stopper like før hvert stikryss så valget kan tas i ro.
// Default på — uten den rekker man ikke å reagere før krysset er passert —
// og valget huskes mellom økter.
const kryssPauseOn = ref((() => {
  try { return localStorage.getItem(KRYSSPAUSE_KEY) !== '0' } catch { return true }
})())
const hasPaths = ref(false)
const pinCounts = ref({})
const pinGroups = ref([])
const extrasLoading = ref(true)
// Hva motoren holder på med: vises i laste-overlayet, og som en diskret pille
// når kartbildet skjerpes etter at visningen alt er åpen.
const buildMsg = ref(null)
const toast = ref('')
const isLandscape = ref(typeof window !== 'undefined' && window.innerWidth > window.innerHeight)

const canvasHost = ref(null)
let engine = null
let abort = null
let poppedByHistory = false
let toastTimer = 0

const wake = useScreenWakeLock({ persist: false, defaultOn: false, idleTimeoutMs: 0 })

const errorText = computed(() => ({
  'no-dem': 'Ingen høydedata for dette kartet — 3D-visning krever et kart bygd med ekte terreng.',
  'no-webgl': '3D-visning støttes ikke på denne enheten.',
  'no-route': 'Ingen rute å vise i 3D.',
  error: 'Kunne ikke bygge 3D-visningen for dette kartet.',
})[phase.value] ?? null)

// Hjelpetekstene følger inngangen: en planlagt tur har POI-stopp der en
// utforsking har kryssvalg.
const INFO_KNAPPER = computed(() => [
  { navn: 'Nåler', tekst: 'viser interessepunkter — trykk på en for å fly dit. Filteret ved siden av velger hvilke.' },
  { navn: 'Sol/måne', tekst: 'veksler mellom dag og natt, og åpner i den himmelen som faktisk er ute. Værsymbolene er varselet fra MET Norway for dette kartet, og himmelen følger været — X-en i værraden tar bort både raden og skyene. Natt er stjernekikkeren: blikket løftes opp av seg selv, kurver, stier og nåler tas bort, og stjernene, planetene og månen står der de faktisk står over dette kartet i kveld. Dra nedover for å se landskapet igjen.' },
  { navn: 'Sti', tekst: 'tegner stinettet oppå terrenget — og må være på for å kunne følge en sti.' },
  fixedTour.value
    ? { navn: 'Stopp', tekst: 'lar turen stoppe ved severdigheter langs veien.' }
    : { navn: 'Kryss', tekst: 'stopper turen i hvert stikryss så du kan velge vei.' },
  { navn: 'Kurver', tekst: 'legger på høydekurver.' },
  walking.value
    ? { navn: 'Til ruta', tekst: 'fester kameraet tilbake til turen etter en avstikker.' }
    : { navn: 'Oversikt', tekst: 'tar deg tilbake til hele kartet ovenfra.' },
])
const INFO_TIPS = computed(() => (walking.value
  ? [
    'Dra mens turen går for å se den fra en annen vinkel — kameraet følger ruta hele tiden.',
    'Hold fingeren stille: kameraet blir stående, og du kan se rundt deg, opp og ned. Slipp, og det glir tilbake bak ruta.',
    'Pause løsner kameraet helt: da kan du fly rundt og se på det du vil.',
    'Play setter kameraet tilbake skrått bakfra.',
    'Trykk på en nål for å fly dit; turen venter på deg.',
  ]
  : [
    'Slå på Sti, og trykk på en sti for å følge den.',
    'Turen fortsetter over små brudd i stinettet, og ender der stien faktisk slutter.',
    'Trykk på en knappenål for å fly dit.',
  ]))

// --- lagrede filtervalg ----------------------------------------------------

const pinPrefs = ref(lesPinPrefs())

function setPinPrefs(next) {
  pinPrefs.value = next
  skrivPinPrefs(next)
  applyPinGroups()
}

function applyPinGroups() {
  engine?.setPinGroups(paaGrupper(pinPrefs.value))
}

// --- livssyklus ------------------------------------------------------------

function onKeydown(e) {
  if (e.key === 'Escape') requestClose()
}
function onPopstate() {
  poppedByHistory = true
  emit('close')
}
function onOrientation() {
  isLandscape.value = window.innerWidth > window.innerHeight
  engine?.resize()
}
function requestClose() {
  history.back()
}

function showToast(text, ms = 2400) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, ms)
}

onMounted(() => {
  history.pushState({ lende3d: true }, '')
  window.addEventListener('popstate', onPopstate)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onOrientation)
  void byggMotor()
})

let avmontert = false
let byggerOm = false

/**
 * Bygg motoren om fra grunnen. Dette er nøyaktig det brukeren ellers gjorde for
 * hånd: lukke 3D og gå inn igjen. Motoren ber om det selv (`engine-dead`) når
 * render-loopen ikke kom i gang etter retur fra bakgrunn — se engineLoop.vekk.
 */
async function byggOm(grunn) {
  if (avmontert || byggerOm) return
  byggerOm = true
  console.warn(`[3D] bygger motoren om: ${grunn}`)
  try { abort?.abort() } catch { /* ingen henting i gang */ }
  try { engine?.dispose() } catch { /* alt frigjort */ }
  engine = null
  phase.value = 'loading'
  try {
    await byggMotor()
  } finally {
    byggerOm = false
  }
}

async function byggMotor() {
  const dem = props.dem ? toRaw(props.dem) : null
  if (!dem) { phase.value = 'no-dem'; return }

  abort = new AbortController()

  try {
    const mod = await import('../../lib/tour3d/index.js')
    // Brukerminnene er allerede lest ut av SVG-en av forelderen, som eier
    // DOM-en; her brukes bare resultatet.
    const {
      create3dScene, collectAllFeatures, collectMapFeatures,
      findParkingSpots, findPauseSpots, loadNveFeatures, loadHeritageForMap,
      clusterFeaturesByMeters, PIN_GROUPS, countByGroup,
    } = mod

    pinGroups.value = PIN_GROUPS

    const rawIndex = toRaw(props.searchIndex) ?? []
    let allFeatures = clusterFeaturesByMeters([
      ...collectAllFeatures(rawIndex),
      ...(toRaw(props.brukerminner) ?? []),
    ])

    // Den planlagte turen tar med seg det den trenger for koreografien:
    // severdigheter i korridoren, P-plass ved start/mål, rasteplass ved
    // vendepunktet, og 2D-sidens egen høydeprofil (samme stigningstall).
    let tourOpts = null
    const t = props.tour ? toRaw(props.tour) : null
    if (t?.route?.coordinates?.length >= 2) {
      const via = (t.via ?? []).map(v => ({ svgX: v.svgX, svgY: v.svgY }))
      const profile = sampleProfile(
        { points: t.route.coordinates.map(c => ({ x: c[0], y: c[1] })) },
        dem,
      )
      tourOpts = {
        route: { coordinates: t.route.coordinates, lengthM: t.route.lengthM },
        via,
        isLoop: !!t.isLoop,
        parkingSpots: findParkingSpots(rawIndex, t.route.coordinates, { isLoop: !!t.isLoop }),
        pauseSpots: findPauseSpots(rawIndex, via),
        routeFeatures: collectMapFeatures(rawIndex, t.route.coordinates),
        profileSamples: profile?.samples ?? null,
        estWalkMinutes: props.estWalkMinutes ?? null,
      }
    }

    engine = await create3dScene(canvasHost.value, {
      dem,
      meta: toRaw(props.meta),
      // Lar motoren rasterisere på nytt når den trenger det: skjerping til full
      // oppløsning, mørkt tema, og gjenoppbygging hvis nettleseren tømmer
      // lerretet mens vi ligger nede.
      getTextureSpec: props.getTextureSpec,
      onProgress: (m) => { buildMsg.value = m },
      // Kartbildet kom ikke (helt) på terrenget — si fra i stedet for å la
      // brukeren stå med et månelandskap uten forklaring.
      onTextureNote: (m) => { if (m) showToast(m, 6000) },
      pathFeatures: toRaw(props.pathFeatures) ?? [],
      barrierFeatures: toRaw(props.barrierFeatures) ?? [],
      features: allFeatures,
      tour: tourOpts,
      options: { estWalkMinutes: props.estWalkMinutes ?? null, tvingHimmel: himmelTvang },
    })

    engine.on('progress', (p) => {
      walking.value = !!p.walking
      serOpp.value = !!p.serOpp
      if (p.walking) {
        stats.value = p
        playing.value = !!p.playing
        finished.value = !!p.finished
        fixedTour.value = !!p.fixed
        detached.value = !!p.detached
        if (Number.isFinite(p.timeScale)) timeScale.value = p.timeScale
      } else {
        stats.value = null
      }
    })
    // Trykket nål (POI, start/mål/via, parkering) — turen er pauset og
    // kameraet løsnet av motoren.
    engine.on('feature', ({ feature }) => { pickedFeature.value = feature })
    // TRYKK I HIMMELEN. Motoren har alt fremhevet og rettet blikket; viseren
    // styrer kortet — og det skal være SAMMENLAGT, som ved alle andre valg.
    // Handleren setter `valgtHimmel` direkte og går ikke gjennom `velgOgSe`, så
    // den må sette minimeringen selv; sto den ikke her, arvet trykket tilstanden
    // fra forrige valg (feilen i v6.1.1, den gang med motsatt fortegn).
    engine.on('himmel-valgt', ({ objekt }) => {
      valgtHimmel.value = objekt
      if (objekt) kortMinimert.value = true
    })
    engine.on('globe', ({ apen }) => {
      globeAapen.value = !!apen
      if (!apen) globeTrekk.value = []
    })
    // TRYKK UT AV NÆRBILDET: kula legges tilbake på himmelen, og kortet LEGGES
    // SAMMEN — det lukkes ikke. Man er fortsatt på Saturn, man har bare forlatt
    // nærbildet, og et kort som forsvinner helt der leses som at valget røk.
    // Minimert står navnet igjen, og krysshåret i pilla er veien tilbake etter
    // panorering. Egen hendelse og ikke `globe {apen:false}`: den siste fyres
    // også når man velger et legeme UTEN globe (Merkur, Venus), og der har man
    // nettopp spurt hva noe er — da skal kortet stå åpent.
    engine.on('globe-avsluttet', () => { kortMinimert.value = true })
    engine.on('globe-trekk', ({ trekk }) => { globeTrekk.value = trekk ?? [] })
    engine.on('blikk', (b) => { blikk.value = b })
    // Severdighet turen stopper ved av seg selv.
    engine.on('feature-enter', ({ feature }) => { stopFeature.value = feature })
    engine.on('feature-exit', () => { stopFeature.value = null })
    engine.on('trip-start', ({ lengthM, fixed }) => {
      // Turen står klar men spiller ikke — play-knappen pulserer i stedet,
      // og skjermlåsen holdes først fra brukeren faktisk trykker play.
      walking.value = true
      playing.value = false
      finished.value = false
      fixedTour.value = !!fixed
      pickedFeature.value = null
      void lengthM
    })
    engine.on('trip-end', () => {
      walking.value = false
      playing.value = false
      junction.value = null
      wake.stop()
    })
    // Motoren fikk ikke render-loopen i gang igjen etter retur fra bakgrunn.
    // Bygg om — brukeren skal ikke måtte lukke og åpne 3D for å få tilbake zoom,
    // panorering og knapper (rapportert fra felt, fikset i v5.22.12).
    engine.on('engine-dead', () => { void byggOm('render-loopen svarte ikke') })
    engine.on('camera', ({ detached: d }) => { detached.value = !!d })
    engine.on('camera-hold', ({ holding }) => { holdingLook.value = !!holding })
    engine.on('junction', ({ junction: j }) => { junction.value = j })
    engine.on('junction-pause', () => { playing.value = false; wake.stop() })
    engine.on('finished', () => { playing.value = false; finished.value = true; wake.stop() })
    engine.on('no-path', () => showToast('Ingen sti akkurat der'))
    engine.on('paths-hidden', () => showToast('Slå på Sti for å følge stien'))
    engine.on('tour-locked', () => showToast('Følger den planlagte turen — stinettet er bare til orientering'))

    engine.setPathsVisible(pathsOn.value)
    applyKryssPause()
    engine.setPoiStops(poiStopsOn.value)
    applyUserPos(props.userPos)

    hasPaths.value = engine.hasPaths
    walking.value = engine.walking
    fixedTour.value = engine.isFixedTour
    // Uten dette står HUD-en tom til første progress-event (et kvart sekund) —
    // med en tur er det nettopp den brukeren ser etter først.
    if (engine.walking) stats.value = engine.state
    engine.setFeatures(allFeatures)
    pinCounts.value = countByGroup(allFeatures)
    applyPinGroups()
    engine.setContoursVisible(contoursOn.value).catch(() => {})
    if (nightOn.value) applyNight(true).catch(() => {})
    // Vær-valget er husket fra forrige økt; hentingen er ikke-blokkerende.
    if (vaerOn.value) void hentVaer()
    if (nightOn.value) byggHimmelListe()
    // Vær-demoen slås på i Utvikler-fanen og overstyrer varselet.
    if (demoPaa.value) demoStart()
    if (nordlysDemoPaa.value && nightOn.value) nordlysDemoStart()

    phase.value = 'ready'
    // Zoom-skyvens område kommer fra riggen og er kart-avhengig (maxDistance er
    // 3 × største utstrekning). Leses her og ikke ved montering: riggen finnes
    // først når motoren er bygget.
    try { avstandGrenser.value = engine.avstandsGrenser() } catch { avstandGrenser.value = null }

    // Åpner man 3D med et mørkt kart, ER man i nattmodus fra første frame — og
    // da skal stjernemodus gjelde her også, ikke bare når man trykker seg inn i
    // den. Etter phase='ready' med vilje: løftet skal skje i et bilde brukeren
    // ser, ikke bak lasteskjermen.
    if (nightOn.value) aapneStjernemodus()

    // Nettbaserte kilder popper inn asynkront — feil svelges stille, som før.
    // Kartet skal aldri stå og vente på Riksantikvaren.
    const merge = (extra) => {
      if (!extra?.length || !engine) return
      allFeatures = clusterFeaturesByMeters([...allFeatures, ...extra])
      engine.setFeatures(allFeatures)
      pinCounts.value = countByGroup(allFeatures)
      applyPinGroups()
    }
    const meta = toRaw(props.meta)
    await Promise.allSettled([
      loadNveFeatures({ meta, signal: abort.signal }).then(merge),
      loadHeritageForMap({ meta, signal: abort.signal }).then(merge),
    ])
    extrasLoading.value = false
  } catch (err) {
    extrasLoading.value = false
    phase.value = err?.code === 'no-dem'
      ? 'no-dem'
      : err?.code === 'no-webgl'
        ? 'no-webgl'
        : err?.code === 'no-route' ? 'no-route' : 'error'
    if (phase.value === 'error') console.error('3D-visning feilet:', err)
  }
}

onBeforeUnmount(() => {
  avmontert = true
  abort?.abort()
  clearTimeout(toastTimer)
  clearInterval(demoTimer)
  clearInterval(nordlysDemoTimer)
  wake.stop()
  engine?.dispose()
  engine = null
  window.removeEventListener('popstate', onPopstate)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onOrientation)
  if (!poppedByHistory && history.state?.lende3d) {
    poppedByHistory = true
    history.back()
  }
})

// --- toggles ---------------------------------------------------------------

// Stinettet starter AV: førsteinntrykket skal være terrenget og kartbildet, ikke
// et rødt nett over alt. Den som vil følge en sti slår den på — og da er det
// også tydelig hva man trykker på.
const pathsOn = ref(false)
function togglePaths() {
  pathsOn.value = !pathsOn.value
  engine?.setPathsVisible(pathsOn.value)
  applyKryssPause()
}

// Krysspausen gjelder bare når stinettet vises — Kryss-knappen er deaktivert
// med Sti av, og da skal heller ikke motoren stoppe på usynlige kryss.
function applyKryssPause() {
  engine?.setAutoPauseJunctions(kryssPauseOn.value && pathsOn.value)
}

function toggleKryssPause() {
  kryssPauseOn.value = !kryssPauseOn.value
  try { localStorage.setItem(KRYSSPAUSE_KEY, kryssPauseOn.value ? '1' : '0') } catch { /* privat modus */ }
  applyKryssPause()
}

// POI-stopp langs en planlagt tur — default AV (v3.0.27): turen skal kunne
// spilles i ett strekk. Nålene er klikkbare uansett.
const poiStopsOn = ref(false)
function togglePoiStops() {
  poiStopsOn.value = !poiStopsOn.value
  engine?.setPoiStops(poiStopsOn.value)
}

const pinsOn = ref(true)
function togglePins() {
  pinsOn.value = !pinsOn.value
  engine?.setPinsVisible(pinsOn.value)
  if (!pinsOn.value) pickedFeature.value = null
}

// Åpningsbildet er terrenget, kartbildet og nålene — INGENTING oppå (v5.18.0).
// Kurvene sto på fram til da, med den begrunnelsen at de leser terrenget for
// deg i fugleperspektiv. Men sammen med stinettet, nålene og en rute ble det
// fire lag over hverandre i det første sekundet, og førsteinntrykket er det
// eneste som ikke kan slås på igjen. Den som vil ha kurver, slår dem på.
const contoursOn = ref(false)
async function toggleContours() {
  contoursOn.value = !contoursOn.value
  await engine?.setContoursVisible(contoursOn.value)
}

// Sol/måne-knappen bærer TRE tilstander: dag → dag med vær → natt.
//
// Natt+vær er FJERNET i v6.1.0. Den var fire steg der tre gjør nytten, og det
// fjerde ga et bilde ingen av delene: værhimmelen skjuler stjernene som er hele
// grunnen til å slå på natt, og skyene vises uansett bare om dagen (se
// oppdaterSkySynlighet i sceneCore). Regn med at nedbør og lyn om natta var det
// eneste som forsvant, og at ingen har bedt om det.
//
// Dag/natt-biten persisteres IKKE, med vilje: den avledes av kart-temaet
// (props.isDark) slik den alltid har gjort, så 3D følger lys/mørk-valget i
// kartet. Vær-biten persisteres, for den er et selvstendig valg brukeren har tatt.
// Åpningsmodusen er HIMMELEN, ikke kart-temaet (v6.1.0). Står sola under
// horisonten der arket ligger, åpner 3D i natt; ellers i dag. Fram til nå fulgte
// den `props.isDark` — altså om kartet var i mørkt tema, som er et helt annet
// spørsmål: man kan godt lese et mørkt kart midt på dagen. Grensa er den
// offisielle (se erNatt i astronomi.js), regnet lokalt.
//
// Faller utregningen igjennom (ark uten brukbar posisjon), er kart-temaet
// fortsatt et bedre gjett enn en fast verdi.
const nightOn = ref((() => {
  const m = props.meta
  if (m?.widthM && m?.heightM) {
    try {
      const p = svgToWgs84(m.widthM / 2, m.heightM / 2, m)
      const natt = erNatt({ lat: p?.lat, lon: p?.lon })
      if (natt !== null) return natt
    } catch { /* faller til temaet under */ }
  }
  return props.isDark
})())

// VÆRET ER ALLTID PÅ OM DAGEN (v6.1.0). Det var en egen bryter, og den var et
// steg brukeren måtte gjennom for å komme til noe hun nesten alltid ville ha:
// varselet for arket er billig (ett oppslag, 30 min cache), og en dagshimmel
// uten skyer er ikke mer «nøytral» enn en med — den er bare mindre sann. Om
// natta er været av, fordi nattmodus er stjernekikkeren.
// Været LUKKET for denne økta, med X-en i værraden. Erstatter det tredje steget
// sol/måne-knappen hadde fram til v6.1.0, og hører bedre her: knappen svarer på
// «dag eller natt», mens dette er «vis meg været eller ikke».
//
// LAGRES IKKE, og det er bestillingen: dag/natt avgjøres av klokka, så neste gang
// 3D åpnes er været med igjen. En bryter som huskes ville dessuten stått i veien
// for seg selv — man ville åpnet en dagshimmel uten vær uten å huske hvorfor.
//
// Nullstilles av et bytte til eller fra natt (se watch under), som er den ene
// veien tilbake i samme økt.
const vaerAvvist = ref(false)

const vaerOn = computed(() => !nightOn.value && !vaerAvvist.value)

async function applyNight(on) {
  if (!engine) return
  await engine.setNightMode(on)
}

// ÉN BRYTER, TO TILSTANDER: dag med vær ↔ natt. Fram til v6.1.0 var det fire
// steg, og de to som falt bort — dag uten vær og natt med vær — var begge bilder
// ingen hadde bedt om. Nå er spørsmålet knappen stiller det samme som himmelen
// stiller: er det dag eller natt?
function toggleNight() {
  nightOn.value = !nightOn.value
  applyNight(nightOn.value)
}

// Hva knappen skal si nå — brukt både som aria-label og i Info-panelet.
const NATT_STEG_LABEL = ['Bytt til natt', 'Bytt til dag']
const nattSteg = computed(() => (nightOn.value ? 1 : 0))

// ---- Værvarsel for arket -------------------------------------------------
// Ett oppslag per ark, for SENTERPUNKTET — ikke per kamerabevegelse. Det er hele
// debouncingen: varselet henger på arket, og kameraet kan fly hvor det vil.
// Cachen (~100 m rutenett, 30 min) gjør at åpne-lukke-åpne ikke koster MET noe.
const vaer = ref(null)
let vaerHentet = false

async function hentVaer() {
  if (vaerHentet) return
  vaerHentet = true
  // Utsnittets meta når kartet er utvidet med nabofliser, ellers arkets eget:
  // senterpunktet skal være midt i det brukeren FAKTISK ser.
  const m = props.meta
  if (!m?.widthM || !m?.heightM) return
  let punkt
  try {
    punkt = svgToWgs84(m.widthM / 2, m.heightM / 2, m)
  } catch { return }
  if (!Number.isFinite(punkt?.lat) || !Number.isFinite(punkt?.lon)) return
  vaer.value = { status: 'loading' }
  try {
    const key = vaerPointKey(punkt.lat, punkt.lon)
    let varsel = await cacheGet(key)
    if (!varsel) {
      varsel = await fetchVarsel(punkt.lat, punkt.lon)
      // Tomt svar caches ikke — nettfeil og «ingen data» ser like ut herfra.
      if (varsel) cacheSet(key, varsel, TTL.vaer)
    }
    const naa = varsel ? naaVarsel(varsel) : null
    vaer.value = naa ? { status: 'done', varsel, naa } : { status: 'error' }
  } catch {
    vaer.value = { status: 'error' }
  }
  // Hentingen kan ha landet etter at brukeren slo vær av igjen.
  if (vaerOn.value) leggVaerPaaHimmelen()
}

function leggVaerPaaHimmelen() {
  if (!engine) return
  // Demoen vinner: står den på, er det den som styrer himmelen.
  if (demoPaa.value && demoTimer) { demoLegg(); return }
  const naa = vaerOn.value ? vaer.value?.naa : null
  // Uten vær (eller uten varsel) sendes null: standard-himmelen, ikke en
  // gjetning. Værmodus av skal se ut nøyaktig som før værmodus fantes.
  engine.setVaer(naa ? vaerTilHimmel(naa.symbol, naa) : null)
}

// Merk at symbolvarianten (dag/natt/polartwilight) IKKE settes her. Den kommer
// ferdig fra MET i `symbol_code`, som er regnet ut for tidspunktet og stedet
// varselet gjelder. Fram til v5.22.12 overstyrte vi den med lysmodusen i 3D, med
// den begrunnelsen at «ser man en natthimmel, skal symbolet vise natt». Det ga
// sol i raden klokka 00 så snart man sto i dagmodus, og det er feil på en helt
// annen måte: raden er et VARSEL, ikke en illustrasjon av himmelen man har valgt.
// ---- Nordlys ---------------------------------------------------------------
// Speilbildet av værvarselet: været er en dagting, nordlyset en nattting. Samme
// ett-oppslag-per-ark-regel, samme senterpunkt, samme graceful null.
//
// HENTES BARE NÅR NATTA SLÅS PÅ. Et nordlysvarsel har ingenting å si i dagmodus,
// og OVATION-fila er 900 kB — et kall ingen ser er turgåerens datakvote. Se
// watch(nightOn) nedenfor.
//
// PAKKES IKKE OFFLINE — se nordlysFetcher.js. Utdatert betyr FEIL her, som for
// været, og en fil som har ligget en uke i en chat ville meldt forrige ukes storm
// som om den gjaldt i kveld.
const nordlys = ref(null)
const nordlysAvvist = ref(false)
let nordlysHentet = false

// Panelet og gardinene henger på det SAMME flagget, så X-en tar bort begge —
// nøyaktig som værradens X tar bort både raden og værhimmelen (v6.3.8).
const nordlysOn = computed(() => nightOn.value && !nordlysAvvist.value)

// Skydekket kommer fra MET-varselet vi ALLEREDE har hentet for arket. Vi spør
// ikke på nytt: panelet trenger tallet, ikke en ny forespørsel.
const nordlysSkydekke = computed(() => {
  const v = vaer.value?.naa
  return Number.isFinite(v?.skydekkeProsent) ? v.skydekkeProsent : null
})

async function hentNordlysdata() {
  if (nordlysHentet) return
  nordlysHentet = true
  const m = props.meta
  if (!m?.widthM || !m?.heightM) return
  let punkt
  try {
    punkt = svgToWgs84(m.widthM / 2, m.heightM / 2, m)
  } catch { return }
  if (!Number.isFinite(punkt?.lat) || !Number.isFinite(punkt?.lon)) return
  nordlys.value = { status: 'loading' }
  try {
    const d = await hentNordlys()
    if (!d) { nordlys.value = { status: 'error' }; return }
    const prosent = sannsynlighetFor(d.rutenett, punkt.lat, punkt.lon)
    // Hvor ovalen ligger NORDOVER herfra avgjør hvor høyt på himmelen gardinene
    // står. Leses av MÅLINGEN framfor å regnes ut av Kp — se ovalenNordover.
    const oval = ovalenNordover(d.rutenett, punkt.lat, punkt.lon)
    nordlys.value = {
      status: 'done',
      ...d,
      prosent,
      ovalGradNord: oval ? Math.max(0, oval.lat - punkt.lat) : null,
    }
  } catch {
    nordlys.value = { status: 'error' }
  }
  // Hentingen kan ha landet etter at brukeren gikk ut av natta igjen.
  if (nordlysOn.value) leggNordlysPaaHimmelen()
}

function leggNordlysPaaHimmelen() {
  if (!engine) return
  // Demoen vinner, som for været.
  if (nordlysDemoPaa.value && nordlysDemoTimer) { nordlysDemoLegg(); return }
  const d = nordlysOn.value && nordlys.value?.status === 'done' ? nordlys.value : null
  engine.setNordlys(d ? nordlysPreg({
    prosent: d.prosent,
    ovalGradNord: d.ovalGradNord,
    kp: d.kp,
  }) : null)
}

// ---- Nordlys-demo (Utvikler-fanen) -----------------------------------------
// Finnes av en enda sterkere grunn enn vær-demoen: et synlig nordlys over
// Sør-Norge er noe som skjer noen netter i året, så uten demoen kan laget i
// praksis bare prøves av en som tilfeldigvis står i Tromsø på en klar natt med
// høy Kp — altså nesten aldri, og aldri i CI.
const nordlysDemoPaa = ref((() => {
  try { return localStorage.getItem(NORDLYSDEMO_KEY) === '1' } catch { return false }
})())
const nordlysDemoSteg = ref(0)
const nordlysDemoIgjen = ref(NORDLYS_SEKUNDER)
let nordlysDemoTimer = 0
const nordlysDemoNaa = computed(
  () => NORDLYS_STEG[nordlysDemoSteg.value % NORDLYS_STEG.length],
)

function nordlysDemoLegg() {
  if (!engine) return
  const steg = nordlysDemoNaa.value
  engine.setNordlys(nordlysPreg(nordlysDemoMaling(steg)))
  // Panelet viser demoens tall og SIER at det er en demo — ellers ser en Kp 8
  // fra Utvikler-fanen ut som et ekte varsel.
  nordlys.value = { status: 'done', ...nordlysDemoTall(steg), observert: null }
}

function nordlysDemoBla(hopp) {
  nordlysDemoSteg.value =
    (nordlysDemoSteg.value + hopp + NORDLYS_STEG.length) % NORDLYS_STEG.length
  nordlysDemoIgjen.value = NORDLYS_SEKUNDER
  nordlysDemoLegg()
}

function nordlysDemoStart() {
  clearInterval(nordlysDemoTimer)
  nordlysDemoIgjen.value = NORDLYS_SEKUNDER
  nordlysDemoLegg()
  nordlysDemoTimer = setInterval(() => {
    nordlysDemoIgjen.value -= 1
    if (nordlysDemoIgjen.value <= 0) {
      nordlysDemoSteg.value = (nordlysDemoSteg.value + 1) % NORDLYS_STEG.length
      nordlysDemoIgjen.value = NORDLYS_SEKUNDER
      nordlysDemoLegg()
    }
  }, 1000)
}

function nordlysDemoStopp() {
  clearInterval(nordlysDemoTimer)
  nordlysDemoTimer = 0
  // Tilbake til det ekte varselet — demoen skal ikke etterlate en Kp 8.
  nordlys.value = null
  nordlysHentet = false
  if (nordlysOn.value) void hentNordlysdata()
  else engine?.setNordlys(null)
}

function toggleNordlysDemo() {
  nordlysDemoPaa.value = !nordlysDemoPaa.value
  try {
    localStorage.setItem(NORDLYSDEMO_KEY, nordlysDemoPaa.value ? '1' : '0')
  } catch { /* privat modus */ }
  if (nordlysDemoPaa.value) nordlysDemoStart()
  else nordlysDemoStopp()
}

watch(nordlysOn, (on) => {
  if (on) void hentNordlysdata()
  leggNordlysPaaHimmelen()
})

// ---- Vær-demo (Utvikler-fanen) -------------------------------------------
// Går gjennom værtypene, 10 s hver, og overstyrer det ekte varselet. Finnes
// fordi vinddrift, lyn-blink og fallende nedbør er BEVEGELSE og ikke kan
// vurderes på et stillbilde.
const demoPaa = ref((() => {
  try { return localStorage.getItem(VAERDEMO_KEY) === '1' } catch { return false }
})())
const demoSteg = ref(0)
const demoIgjen = ref(DEMO_SEKUNDER)
let demoTimer = 0
const demoNaa = computed(() => DEMO_STEG[demoSteg.value % DEMO_STEG.length])

function demoLegg() {
  if (!engine) return
  const steg = demoNaa.value
  engine.setVaer(vaerTilHimmel(steg.kode, demoMaling(steg)))
}

function demoNeste(hopp = 1) {
  demoSteg.value = (demoSteg.value + hopp + DEMO_STEG.length) % DEMO_STEG.length
  demoIgjen.value = DEMO_SEKUNDER
  demoLegg()
}

function demoStart() {
  clearInterval(demoTimer)
  demoIgjen.value = DEMO_SEKUNDER
  demoLegg()
  demoTimer = setInterval(() => {
    demoIgjen.value -= 1
    if (demoIgjen.value <= 0) demoNeste(1)
  }, 1000)
}

function demoStopp() {
  clearInterval(demoTimer)
  demoTimer = 0
  // Tilbake til det som gjaldt før demoen — enten det ekte varselet eller
  // standard-himmelen. Demoen skal ikke etterlate en tilfeldig værtype.
  leggVaerPaaHimmelen()
}

function toggleDemo() {
  demoPaa.value = !demoPaa.value
  try { localStorage.setItem(VAERDEMO_KEY, demoPaa.value ? '1' : '0') } catch { /* privat modus */ }
  if (demoPaa.value) demoStart()
  else demoStopp()
}

watch(vaerOn, (on) => {
  if (on) void hentVaer()
  leggVaerPaaHimmelen()
})
// Bytter man dag/natt mens været står på, skal himmelen males om (grunnfargen
// for torden-blinket henger på natt/dag inne i motoren).
watch(nightOn, (on) => {
  // Et bytte av lysmodus gir været tilbake. Nullstilles FØR himmelen males om,
  // ellers ville vaerOn fortsatt vært falsk og været blitt liggende av.
  vaerAvvist.value = false
  if (vaerOn.value) leggVaerPaaHimmelen()
  // Himmellista bygges når natta slås på, og ryddes når den slås av: en valgt
  // formasjon som står fremhevet på en dagshimmel er bare rart.
  if (on) byggHimmelListe()
  else velgHimmel(null)
  if (on) aapneStjernemodus()
  else lukkStjernemodus()
  // Nordlyset er nattas motstykke til været: X-en nullstilles av et modusbytte,
  // og varselet hentes først når natta faktisk er på — et 900 kB-kall ingen ser
  // er turgåerens datakvote.
  nordlysAvvist.value = false
  if (on) {
    if (nordlysDemoPaa.value) nordlysDemoStart()
    else void hentNordlysdata()
  } else {
    clearInterval(nordlysDemoTimer)
    nordlysDemoTimer = 0
    engine?.setNordlys(null)
  }
})

// ---- Stjernemodus: inn og ut ---------------------------------------------
// Hva som var påslått da natta ble slått på. Nattmodus skjuler kurver, stier og
// nåler — de har ingenting å gjøre i en stjernehimmel, og en rød stikrøtt over
// silhuetten er nettopp den slags lyse flate modusen finnes for å bli kvitt.
// Men de er brukerens valg, så de gis tilbake når hun går ut igjen.
let lagForNatt = null

function aapneStjernemodus() {
  if (!lagForNatt) {
    lagForNatt = {
      nåler: pinsOn.value, stier: pathsOn.value, kurver: contoursOn.value,
    }
  }
  if (pinsOn.value) togglePins()
  if (pathsOn.value) togglePaths()
  if (contoursOn.value) void toggleContours()
  // Still kameraet tilbake til oversikten og løft så blikket opp i himmelen, av
  // seg selv. Løftet er samme bevegelse brukeren gjør med fingeren — kjørt for
  // henne, så hun vet neste gang at draget finnes.
  //
  // RESETTEN KOM I v6.4.0, og den er bestilt: man går nesten alltid inn i natta
  // fra dagmodus, etter å ha panorert rundt i terrenget, og da lå blikket der
  // turen tilfeldigvis endte. Nå starter hver kveld likt — midt over kartet, med
  // nesa mot nord — og da vet man hvor på himmelen man er før man begynner.
  //
  // Går etter lag-skjulingen, så det ikke er noe å se forsvinne underveis.
  engine?.apneStjernehimmel()
}

function lukkStjernemodus() {
  lukkGlobe()
  blikk.value = null
  const f = lagForNatt
  lagForNatt = null
  if (!f) return
  if (f.nåler !== pinsOn.value) togglePins()
  if (f.stier !== pathsOn.value) togglePaths()
  if (f.kurver !== contoursOn.value) void toggleContours()
  // Blikket ned i kartet igjen: går man ut av natta, er det kartet man vil se.
  engine?.overview()
}

// --- turen -----------------------------------------------------------------

function play() {
  engine?.play()
  playing.value = true
  pickedFeature.value = null
  wake.start()
}
function pause() { engine?.pause(); playing.value = false; wake.stop() }
function restart() {
  engine?.restart()
  playing.value = true
  finished.value = false
  pickedFeature.value = null
  wake.start()
}
function stopTrip() { engine?.stopTrip() }
function followRoute() { engine?.followRoute(); pickedFeature.value = null }
function overview() {
  engine?.overview()
  pickedFeature.value = null
  playing.value = false
  wake.stop()
}

// Tidsakse: dra = seek (kameraet følger), slipp = forbli pauset.
function onScrubStart() { engine?.scrubStart(); playing.value = false; wake.stop() }
function onScrub(pct) { if (engine) engine.scrub(pct * engine.totalM) }
function onScrubEnd() { engine?.scrubEnd(); playing.value = false }
function chooseBranch(nodeId) { engine?.chooseBranch(nodeId) }

// «Videre →» på kortet: et trykket kort lukkes, et turstopp hoppes over.
//
// Å lukke et NÅLE-kort angrer hele trykket (v6.3.12): den gule ringen tas bort og
// kameraet flyr tilbake dit det sto før. Trykket gjorde to ting, og X-en skal
// undo begge — ellers står ringen igjen på en nål ingenting forteller om, og man
// er fanget i et nærbilde man ikke ba om å bli i.
function onCardSkip() {
  if (pickedFeature.value) {
    pickedFeature.value = null
    engine?.angreFeature()
    return
  }
  engine?.skipFeature()
}

function setTimeScale(x) {
  timeScale.value = x
  engine?.setTimeScale(x)
}

// Live GPS: motoren tegner/skjuler markøren selv, inkl. utenfor-kartet-sjekk.
function applyUserPos(p) {
  engine?.setUserPosition(p && p.svgX != null
    ? { x: p.svgX, y: p.svgY, accuracyM: p.accuracyM }
    : null)
}
watch(() => props.userPos, applyUserPos)

const ISOM_LABEL = {
  505: 'Sti', 506: 'Sti (uklar)', 507: 'Stitråkk', 504: 'Skogsbilvei',
  503: 'Småveg', 502: 'Hovedvei', 501: 'Motorvei', 509: 'Bro',
}

// Gren-etikett relativt til gangretningen: rett fram, til høyre/venstre —
// «skarpt» når svingen er over 100°, så to grener på samme side kan skilles.
function branchLabel(opt, i) {
  const kind = ISOM_LABEL[opt.isomCode] ?? 'Vei'
  if (i === 0) return `${kind} rett fram`
  const side = opt.turnSigned > 0 ? 'høyre' : 'venstre'
  const skarpt = opt.turn > (100 * Math.PI) / 180 ? 'skarpt ' : ''
  return `${kind} ${skarpt}til ${side}`
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[220] bg-[#101623] flex flex-col" :style="overleggStil">
      <div ref="canvasHost" class="absolute inset-0"></div>

      <!-- GLOBENS STEDSNAVN. Absolutt plassert over lerretet, uten peker-treff:
           fingeren skal snurre kula, ikke treffe en label. Navnene står med det
           norske først der det finnes et — «Regnhavet» er til å huske, «Mare
           Imbrium» er til å slå opp. -->
      <div v-if="globeAapen && globeTrekk.length"
           class="absolute inset-0 z-[5] pointer-events-none" aria-hidden="true">
        <div v-for="t in globeTrekk" :key="t.navn"
             class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
             :style="{ left: `${t.x}px`, top: `${t.y}px` }">
          <span class="w-1 h-1 rounded-full bg-white/70"></span>
          <!-- TAKET MÅ VÆRE I `vw`, ikke i rem: `zoom` ganger opp rem-en også, så
               en bredde i rem ville vokst i takt med teksten og navnet aldri
               brutt. `tekstBoks` deler på skalaen, altså er 30 vw tretti prosent
               av SKJERMEN på alle fire tekstvalgene — og da brekker et langt navn
               av seg selv når teksten blir stor.
               Orddelingen trenger et språk: `<html lang="no">` gir mønstrene, og
               `break-words` er sikringen for et navn uten et lovlig delepunkt. -->
          <span class="mt-0.5 text-[0.75rem] leading-tight text-white/85 text-center
                       [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] hyphens-auto break-words"
                :style="tekstBoks(30)">
            {{ t.norsk ?? t.navn }}
          </span>
        </div>
      </div>

      <!-- STARGAZER: veien fra en tom dagshimmel til stjernekikkeren.
           Løfter man blikket om dagen, er det ingenting der — blå flate og
           noen skyer — og det ene stedet i appen der det ER noe å se opp på,
           nattmodus, nås fra en sol/måne-knapp helt nede i venstre hjørne som
           ikke handler om himmelen man nettopp så opp i. Knappen står derfor
           DER blikket er, og bare der: den vises på `serOpp` og forsvinner i
           det man drar seg ned igjen, så den koster ingen kartflate.

           Tre ting som må stå:
             · `z-[9]`, altså UNDER resten av overlegget (z-10). Hjelpens
               nedtrekk og værraden skal male over den, ikke omvendt.
             · `pointer-events-none` på raden og `auto` på knappen. Raden
               spenner hele bredden, og uten dette ville den svelget nettopp
               det draget nedover som er veien tilbake til kartet.
             · Skjult under en gående tur: der er kameraet turens, og et bytte
               til natt midt i den er ikke det man ber om ved å se opp. -->
      <div v-if="phase === 'ready' && serOpp && !stjernemodus && !walking"
           class="absolute left-0 right-0 top-[32%] z-[9] flex justify-center px-4
                  pointer-events-none">
        <button type="button" @click="toggleNight"
                aria-label="Stargazer — åpne natthimmelen"
                class="pointer-events-auto max-w-full rounded-2xl bg-black/45 backdrop-blur
                       ring-1 ring-white/20 shadow-lg px-4 py-2.5 text-white/90
                       flex items-center gap-2.5 active:scale-[0.97] transition"
                :style="tekstBoks(80)">
          <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6 8.5 8.5 0 1 0 20.4 14.2z"/>
            <path d="M17.2 3.1l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="currentColor" stroke="none"/>
          </svg>
          <span class="min-w-0 text-left leading-tight">
            <span class="block text-[0.8125rem] font-semibold">Stargazer</span>
            <span class="block text-[0.6875rem] text-white/65">{{ STARGAZER_TEKST }}</span>
          </span>
        </button>
      </div>

      <!-- Topprad: Sol/måne · Pin · Sti · Kryss|Stopp · Kurver — venstrestilt,
           med X aleine helt til høyre og himmelsøket mellom dem i nattmodus.
           Høyrestilt raden vokste mot venstre, og med seks knapper falt den
           første ut av skjermen på smale telefoner (S22+, buet kant).
           Venstrestilt vokser den innover i stedet. -->
      <div class="relative z-10 flex items-start justify-between gap-2 px-3"
           style="padding-top: max(env(safe-area-inset-top), 10px);">
        <div class="flex items-center gap-1 min-w-0 flex-wrap">
          <!-- SOL/MÅNE STÅR FØRST, helt til venstre (v6.1.0). Den er
               modusvelgeren — den bestemmer hva de andre knappene i det hele tatt
               handler om — og i nattmodus er den den ENESTE som blir igjen på
               venstresida. En bryter som skifter hele bildet hører i hjørnet, ikke
               midt i en rad med lag-knapper.

               To tilstander: dag med vær ↔ natt. Ikonet forteller hvor du er
               (sol med sky, eller måne), og aria-label sier hva NESTE trykk gjør.
               I nattmodus er den dempet ned som X-en: poenget er nattsyn. -->
          <button v-if="phase === 'ready'"
                  @click="toggleNight"
                  :aria-label="NATT_STEG_LABEL[nattSteg]"
                  class="w-11 h-11 rounded-full backdrop-blur flex items-center justify-center
                         active:scale-95 transition-colors relative"
                  :class="stjernemodus ? 'bg-black/25 text-white/35' : 'bg-white text-gray-900'">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <!-- Måne (fylt) i natt, sol (strek) i dag. SKYA ER FJERNET (v6.3.0):
                   den sto der for å skille «dag» fra «dag med vær», og de to er
                   nå det samme steget. Sola fyller hele ikonet igjen, sentrert og
                   uten forskyvning — den trenger ikke lenger gi plass til noe. -->
              <path v-if="nightOn" fill="currentColor" stroke="none"
                    d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6 8.5 8.5 0 1 0 20.4 14.2z"/>
              <template v-else>
                <circle cx="12" cy="12" r="4.2"/>
                <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/>
              </template>
            </svg>
          </button>

          <!-- ALT UNDER HER FORSVINNER I NATTMODUS. Kurver, stier og nåler er
               skjult i motoren også (se aapneStjernemodus) — knappene deres ville
               ellers stått og lyst for lag som ikke vises. -->
          <template v-if="!stjernemodus">
          <button v-if="phase === 'ready'"
                  @click="togglePins"
                  :aria-label="pinsOn ? 'Skjul knappenåler' : 'Vis knappenåler'"
                  class="w-11 h-11 rounded-full backdrop-blur flex items-center justify-center
                         active:scale-95 transition-colors"
                  :class="pinsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/>
              <circle cx="12" cy="11" r="2.4"/>
            </svg>
          </button>
          <!-- Sti-togglen bærer teksten sin, som Kryss og Kurver: ikonet aleine
               er ikke til å gjette. Under 380 px skjermbredde faller de tre
               tekstene bort og knappene blir runde igjen — der er det ikke plass
               til fem merkelapper, og en rad som bryter til tre linjer er verre
               enn tre ikoner. -->
          <button v-if="phase === 'ready' && hasPaths"
                  @click="togglePaths"
                  :aria-label="pathsOn ? 'Skjul stinettet' : 'Vis stinettet'"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-xs font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors"
                  :class="pathsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 20c3-1 4-4 3-7s1-6 4-7 6 1 8 3"/>
            </svg>
            <span class="max-[379px]:hidden">Sti</span>
          </button>
          <!-- Krysspause («gaffel»): på = turen stopper i hvert stikryss så man
               rekker å velge vei. Valget huskes. Uten stinettet synlig gir den
               ingen mening — da deaktiveres den. En PLANLAGT tur har ingen
               kryssvalg; der står POI-stopp på samme plass i stedet. -->
          <button v-if="phase === 'ready' && hasPaths && !fixedTour"
                  @click="toggleKryssPause"
                  :disabled="!pathsOn"
                  :aria-label="kryssPauseOn ? 'Ikke stopp i stikryss' : 'Stopp i stikryss'"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-xs font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors
                         disabled:opacity-40 disabled:pointer-events-none"
                  :class="kryssPauseOn && pathsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21v-8"/>
              <path d="M12 13 7 8"/><polyline points="7 11 7 8 10 8"/>
              <path d="M12 13l5-5"/><polyline points="14 8 17 8 17 11"/>
            </svg>
            <span class="max-[379px]:hidden">Kryss</span>
          </button>
          <button v-if="phase === 'ready' && fixedTour"
                  @click="togglePoiStops"
                  :aria-label="poiStopsOn ? 'Ikke stopp ved severdigheter' : 'Stopp ved severdigheter'"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-xs font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors"
                  :class="poiStopsOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l3 2"/>
            </svg>
            <span class="max-[379px]:hidden">Stopp</span>
          </button>
          <button v-if="phase === 'ready'"
                  @click="toggleContours"
                  aria-label="Vis høydekurver i terrenget"
                  class="h-11 px-2 max-[379px]:w-11 max-[379px]:px-0 rounded-full backdrop-blur
                         text-xs font-medium flex items-center justify-center gap-1
                         active:scale-95 transition-colors"
                  :class="contoursOn ? 'bg-white text-gray-900' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M4 9c3-3.5 13-3.5 16 0M5.5 13c2.5-2.6 10.5-2.6 13 0M7.5 17c2-1.8 7-1.8 9 0"/>
            </svg>
            <span class="max-[379px]:hidden">Kurver</span>
          </button>
          </template>
        </div>

        <!-- HIMMELSØKET STÅR MELLOM DE TO KNAPPENE (v6.1.0), på samme linje —
             sol/måne til venstre, X til høyre, søket i midten. I nattmodus er de
             tre det eneste som finnes på skjermen.
             Teksten skalerer med hovedmenyens 100/125/150/200-valg: den som har satt
             større tekst der har gjort det fordi hun trenger det, og en
             stjernehimmel leses i mørket. Chromet (knappene) skalerer bevisst
             ikke — de er 44 px fordi en finger er det. -->
        <div v-if="himmelSokSynlig" class="flex-1 min-w-0 flex justify-center"
             :style="{ zoom: uiTextScale }">
          <Tour3dHimmelSok :objekter="himmelListe" :valgt-id="valgtHimmel?.id ?? null"
                           :dempet="stjernemodus" @velg="velgOgSe"/>
        </div>

        <!-- X-en. Dempet ned i nattmodus, som sol/måne: en hvit flate koster de
             20–30 minuttene et øye bruker på å mørkeadaptere. -->
        <div class="flex items-center gap-1 shrink-0">
          <button @click="requestClose"
                  aria-label="Lukk 3D-visning"
                  class="w-11 h-11 shrink-0 rounded-full backdrop-blur
                         flex items-center justify-center active:scale-90 transition-colors"
                  :class="stjernemodus ? 'bg-black/25 text-white/35' : 'bg-black/45 text-white/85'">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Nordlys-demo (Utvikler-fanen). Samme form som vær-demoen, av samme
           grunn: står den på, er det ikke det ekte varselet man ser, og da må det
           stå. Grønn i stedet for blå — det er det ene som skiller de to demoene
           fra hverandre på et skjermbilde.
           PLASSEN ER IKKE DEN SAMME LENGER (v6.5.18): den står over infokortet,
           ikke under, sammen med nordlyspanelet den overstyrer. Se panelet under
           for hvorfor. -->
      <div v-if="phase === 'ready' && nordlysDemoPaa && nightOn"
           class="relative z-10 px-3 mt-2 flex justify-center">
        <div class="flex items-center gap-2 rounded-2xl bg-emerald-900/70 backdrop-blur
                    px-3 py-1.5 text-white max-w-full">
          <button @click="nordlysDemoBla(-1)" aria-label="Forrige nordlysstyrke"
                  class="w-7 h-7 shrink-0 rounded-full bg-white/15 flex items-center
                         justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div class="min-w-0 leading-tight">
            <div class="text-xs font-semibold truncate">
              {{ nordlysDemoNaa.navn }}
              <span class="text-[0.625rem] font-normal text-emerald-200/70 tabular-nums">
                {{ nordlysDemoSteg + 1 }}/{{ NORDLYS_STEG.length }} · {{ nordlysDemoIgjen }} s
              </span>
            </div>
            <div v-if="nordlysDemoNaa.merk" class="text-[0.625rem] text-emerald-100/65 truncate">
              {{ nordlysDemoNaa.merk }}
            </div>
          </div>
          <button @click="nordlysDemoBla(1)" aria-label="Neste nordlysstyrke"
                  class="w-7 h-7 shrink-0 rounded-full bg-white/15 flex items-center
                         justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button @click="toggleNordlysDemo" aria-label="Avslutt nordlys-demo"
                  class="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[0.625rem]
                         font-medium active:scale-95">
            Avslutt
          </button>
        </div>
      </div>

      <!-- NORDLYSPANELET STÅR ØVERST, RETT UNDER SØKEFELTET (v6.5.18). Det lå
           under infokortet, altså der værraden ligger om dagen — men et
           stjernebildekort er en høy, rullbar tekstflate, og nordlyset havnet
           derfor midt på skjermen med demolinja klemt inn foran.
           Sammenlikningen med værraden holdt ikke: været og nordlyset deler ikke
           plass i praksis, for værraden er skjult i nattmodus (`!stjernemodus`) og
           nordlyset finnes bare der. Det er altså ingen kollisjon å unngå, og da
           skal varselet stå først — det er nettopp DET man slo på natta for å se.
           Nattmodus fjerner ellers hele overlegget (v6.1.0); dette er et bevisst
           unntak på linje med himmelsøket. -->
      <div v-if="phase === 'ready' && nordlysOn && !walking && nordlys"
           class="relative z-10 px-3 mt-2 flex justify-center">
        <Tour3dNordlysPanel :nordlys="nordlys" :skydekke="nordlysSkydekke"
                            :er-natt="true"
                            :demo="nordlysDemoPaa ? nordlysDemoNaa.navn : ''"
                            @lukk="nordlysAvvist = true"/>
      </div>

      <!-- Infokortet for det valgte. Rulles om teksten er lang — den kan være
           det for et stjernebilde. Står UNDER nordlyset (v6.5.18), fordi det er
           den flaten som kan bli høy: et varsel som ligger etter en rullbar
           tekstflate er et varsel man må lete etter. -->
      <div v-if="phase === 'ready' && valgtHimmel"
           class="relative z-10 px-3 mt-2 flex justify-center"
           :style="tekstBoks(86)">
        <!-- `globe-aapen` er BORTE (v6.3.3): kortet brukte den bare til å velge
             mellom to bruksanvisninger, og begge er fjernet. En prop ingen leser
             er nettopp den stille gjelden navnediff finnes for.
             `@fokus` kommer bare fra den MINIMERTE pilla (v6.3.5) — se kortet. -->
        <Tour3dHimmelKort :objekt="valgtHimmel" :naboer="himmelNaboer"
                          :minimert="kortMinimert" :maks-hoyde="himmelKortHoyde"
                          @lukk="velgHimmel(null)" @velg="velgOgSe"
                          @minimer="kortMinimert = true" @utvid="kortMinimert = false"
                          @fokus="engine?.fokuserHimmel()"/>
      </div>

      <!-- Vær-demo (Utvikler-fanen). Ligger over værraden fordi den overstyrer
           den: står demoen på, er det ikke det ekte varselet man ser. -->
      <div v-if="phase === 'ready' && demoPaa"
           class="relative z-10 px-3 mt-2 flex justify-center">
        <div class="flex items-center gap-2 rounded-2xl bg-sky-900/70 backdrop-blur
                    px-3 py-1.5 text-white max-w-full">
          <button @click="demoNeste(-1)" aria-label="Forrige værtype"
                  class="w-7 h-7 shrink-0 rounded-full bg-white/15 flex items-center
                         justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div class="min-w-0 leading-tight">
            <div class="text-xs font-semibold truncate">
              {{ demoNaa.navn }}
              <span class="text-[0.625rem] font-normal text-sky-200/70 tabular-nums">
                {{ demoSteg + 1 }}/{{ DEMO_STEG.length }} · {{ demoIgjen }} s
              </span>
            </div>
            <div v-if="demoNaa.merk" class="text-[0.625rem] text-sky-100/65 truncate">
              {{ demoNaa.merk }}
            </div>
          </div>
          <button @click="demoNeste(1)" aria-label="Neste værtype"
                  class="w-7 h-7 shrink-0 rounded-full bg-white/15 flex items-center
                         justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button @click="toggleDemo" aria-label="Avslutt vær-demo"
                  class="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[0.625rem]
                         font-medium active:scale-95">
            Avslutt
          </button>
        </div>
      </div>

      <!-- Værsymbolraden, rett under topprada. Egen linje fordi topprada alt er
           full. Den lå UNDER Info/POI-linja fram til v5.27.0, og da måtte man
           lese seg forbi to piller for å komme til det man åpnet værmodus for;
           nå står varselet først og hjelpen under. Skjult under en gående tur —
           der konkurrerer HUD og kryssvalg om plassen, og været er ikke det man
           ser etter da. -->
      <div v-if="phase === 'ready' && vaerOn && !walking && !stjernemodus"
           class="relative z-10 px-3 mt-2 flex justify-center">
        <Tour3dVaerRad :vaer="vaer" @lukk="vaerAvvist = true"/>
      </div>

      <!-- Nederste linje: hjelp til venstre, POI-filter til høyre. Begge minimert
           som små piller, så de koster nesten ingen kartflate før man trenger
           dem. Items-start så en utvidet boks ikke dytter den andre nedover.

           BEGGE FØLGER TEKSTVALGET fra hovedmenyen (v6.3.12). De er de to
           tekstflatene man faktisk LESER i dagmodus — resten av overlegget er
           knapper og tall — og de var det siste som ikke fulgte valget. Zoomen
           ligger på hver sin innpakning og ikke på raden: raden er
           `justify-between` over hele bredden, og en zoomet rad ville skalert
           polstringen og dyttet begge boksene utenfor skjermen. -->
      <div v-if="phase === 'ready' && !stjernemodus"
           class="relative z-10 flex items-start justify-between gap-2 px-3 mt-2">
        <!-- INGEN `overflow` HER, og det er ikke en forglemmelse: hjelpekroppen
             er et nedtrekk under pilla, altså absolutt plassert, og en
             `overflow`-boks rundt den ville klippet den bort. Taket og
             rullingen bor derfor i panelet selv — målene regnes her, fordi det
             er her `zoom` settes og `vw`/`vh` ikke skaleres ned av den. -->
        <div :style="tekstBoks(78)">
          <Tour3dInfoPanel :modus="walking ? 'tur' : 'utforsk'"
                           :knapper="INFO_KNAPPER" :tips="INFO_TIPS"
                           :maks-bredde="infoMaksBredde" :maks-hoyde="infoMaksHoyde"/>
        </div>
        <div v-if="pinsOn" class="overflow-y-auto" :style="tekstBoks(74, 60)">
          <Tour3dPinPanel :groups="pinGroups" :counts="pinCounts"
                          :loading="extrasLoading"
                          :model-value="pinPrefs" @update:model-value="setPinPrefs"/>
        </div>
        <div v-else></div>
      </div>

      <!-- Laste-/feiltilstander.
           `pointer-events-none` er ikke kosmetikk (v5.18.4): begge disse er
           fullskjerms lag på z-20, altså OVER topprada (z-10) der X-en sitter.
           Uten dette lå de og svelget trykket, så X-en var synlig men død — og
           feilet 3D-visningen, var den eneste veien ut Escape (som ikke finnes
           på mobil) eller Android-tilbakeknappen. Innholdet her er ren
           informasjon og trenger ingen treff selv. -->
      <div v-if="phase === 'loading'"
           class="absolute inset-0 z-20 pointer-events-none flex flex-col items-center
                  justify-center gap-3 text-white/80">
        <div class="w-10 h-10 rounded-full border-2 border-white/25 border-t-white animate-spin"></div>
        <div class="text-[0.8125rem]">{{ buildMsg || 'Bygger 3D-terreng …' }}</div>
      </div>
      <div v-else-if="errorText"
           class="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-6">
        <div class="rounded-xl bg-amber-500/10 border border-amber-300/30 px-4 py-3
                    text-amber-100/90 text-[0.8125rem] max-w-sm text-center">
          {{ errorText }}
        </div>
      </div>

      <!-- Infokort for valgt/aktuell POI -->
      <div v-if="phase === 'ready' && activeFeature"
           class="absolute left-0 right-0 z-10 flex justify-center px-4 pointer-events-none"
           :class="isLandscape ? 'top-16' : 'top-20'">
        <Tour3dFeatureCard :feature="activeFeature" @skip="onCardSkip"/>
      </div>

      <!-- Bunn: kryssvalg, framdrift og turkontroller -->
      <div v-if="phase === 'ready' && !stjernemodus"
           class="relative z-10 mt-auto px-3 flex flex-col gap-2"
           style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">

        <!-- Kameraet er løsnet fra turen: veien tilbake, ett trykk unna. -->
        <button v-if="walking && detached" @click="followRoute"
                class="self-start w-fit flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur
                       px-3 py-1.5 text-[0.6875rem] font-medium text-white/90 active:scale-95">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20c3-1 4-4 3-7s1-6 4-7 6 1 8 3"/>
          </svg>
          Til ruta
        </button>

        <!-- Kryss: rett fram vinner om brukeren ikke gjør noe. Med krysspause
             på står turen stille her til man velger gren eller trykker play.
             `self-start w-fit` holder boksen så smal som innholdet — full bredde
             la et grønt teppe over kartet for to korte knapper. -->
        <div v-if="walking && junction"
             class="on-accent self-start w-fit max-w-full rounded-md bg-emerald-600 text-white
                    text-[0.6875rem] shadow-lg px-3 py-2">
          <div class="text-[0.5625rem] uppercase tracking-wide text-emerald-100/90 mb-1">
            {{ !playing ? 'Kryss — velg vei, eller ▶ for rett fram' : 'Kryss — fortsetter rett fram' }}
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="(opt, i) in junction.options" :key="opt.nodeId"
                    @click="chooseBranch(opt.nodeId)"
                    class="rounded px-2 py-1 text-[0.6875rem] font-medium active:scale-95"
                    :class="opt.nodeId === junction.chosenNodeId ? 'bg-white text-emerald-700' : 'bg-ink/15'">
              {{ branchLabel(opt, i) }}
            </button>
          </div>
        </div>

        <Tour3dHud v-if="walking" :stats="stats" :felter="HUD_FELTER"
                   @scrub-start="onScrubStart" @scrub="onScrub" @scrub-end="onScrubEnd"/>

        <div v-if="walking" class="flex items-center gap-2">
          <!-- Start på nytt — bare for en planlagt tur. En generert sti-tur
               starter man på nytt ved å trykke på en sti. -->
          <button v-if="fixedTour" @click="restart"
                  aria-label="Start turen på nytt"
                  class="w-10 h-10 shrink-0 rounded-full bg-black/45 backdrop-blur text-white/85
                         flex items-center justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
            </svg>
          </button>
          <button @click="playing ? pause() : play()"
                  :aria-label="playing ? 'Pause' : 'Fortsett'"
                  class="w-12 h-12 rounded-full bg-white text-gray-900 flex items-center
                         justify-center shrink-0 active:scale-95"
                  :class="{ 'pulse-play': !playing && !finished }">
            <svg v-if="playing" viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1"/>
              <rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
              <polygon points="8,5 8,19 19,12"/></svg>
          </button>
          <button v-if="!fixedTour" @click="stopTrip"
                  class="h-12 px-4 rounded-full bg-black/45 backdrop-blur text-white/85
                         text-xs font-medium active:scale-95">
            Avslutt turen
          </button>
          <!-- Tempo, nede til høyre. -->
          <div class="ml-auto flex items-center gap-1 rounded-full bg-black/45 backdrop-blur p-1">
            <button v-for="x in TIME_SCALES" :key="x"
                    @click="setTimeScale(x)"
                    :aria-label="`Tempo ${x} ganger`"
                    class="h-9 px-2.5 rounded-full text-[0.6875rem] font-semibold tabular-nums
                           active:scale-95 transition-colors"
                    :class="timeScale === x ? 'bg-white text-gray-900' : 'text-white/80'">
              {{ x }}×
            </button>
          </div>
        </div>

        <div v-else class="flex items-center gap-2">
          <button @click="overview"
                  class="h-11 px-3 rounded-full bg-black/45 backdrop-blur text-white/85
                         text-xs font-medium flex items-center gap-1.5 active:scale-95">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/>
            </svg>
            Oversikt
          </button>
          <!-- Ser man opp i himmelen, er det ikke kartet i bildet, og da er det
               ikke åpenbart at samme drag den andre veien er veien ned igjen.
               Hintet erstatter sti-hintet, som ikke er til hjelp der. -->
          <div v-if="serOpp"
               class="rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/70">
            Ser opp i himmelen — dra nedover for å komme tilbake til kartet
          </div>
          <!-- Hintet gjelder bare med stinettet synlig — med Sti av er det
               ingen sti å trykke på, og et trykk starter ingen tur. -->
          <div v-else-if="hasPaths"
               class="rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/70">
            {{ pathsOn ? 'Trykk på en sti for å følge den' : 'Slå på Sti for å følge en sti' }}
          </div>
        </div>
      </div>

      <!-- NAVIGASJONSKONTROLLENE, høyre kant, loddrett midtstilt.
           BARE PÅ FIN PEKER (mus/styreflate), og i BÅDE dag og natt: luka de
           lukker gjelder all 3D-visning, ikke bare stjernekikkeren. De blir
           stående i nattmodus selv om alt annet skjules — er de skjult der, er
           himmelen uoppnåelig på en desktop, som er hele grunnen til at de
           finnes. I natt er de dempet og røde, som kompasset. -->
      <div v-if="phase === 'ready' && finPeker"
           class="absolute right-0 top-1/2 -translate-y-1/2 z-10 pointer-events-auto pr-2
                  flex flex-col items-center gap-2 rounded-2xl bg-black/35 backdrop-blur
                  py-3 px-1.5 mr-1 text-white/85">
        <ZoomSkyv v-if="avstandGrenser" :broek="zoomBroekNaa" :avlest="zoomAvlest"
                  :natt="stjernemodus" merkelapp="Zoom i 3D-visningen"
                  @broek="settZoom"/>
        <RetningsRose modus="himmel" :azimut="blikk?.azimut ?? 0" :hoyde="blikk?.hoyde ?? 0"
                      :min-hoyde="BLIKK_GRENSER.minGrader" :maks-hoyde="BLIKK_GRENSER.maksGrader"
                      :natt="stjernemodus"
                      @retning="settRetning" @nord="engine?.seMotNord()"/>
      </div>

      <!-- VEIEN UT AV ET NÆRBILDE (v6.5.40). Midtstilt under kula, som er
           midt på skjermen: et trykk hvor som helst utenfor kula gjør det
           samme, men ingenting sa det, og brukerne tok X-en oppe til høyre —
           som lukker hele 3D-visningen.
           Står over himmelkompasset i hjørnet, ikke ved siden av det.
           INGEN `zoom` her, i motsetning til søkefeltet og infokortet: dette er
           en knapp og ikke lesestoff, og 44 px er 44 px fordi en finger er det
           (v6.1.0). Teksten er `rem`, så den følger systemets tekstskalering
           (v5.27.0), og `max-w-full` gjør at den brekker i stedet for å renne
           ut når skalaen er stor. -->
      <div v-if="phase === 'ready' && globeAapen"
           class="absolute inset-x-0 bottom-28 z-20 flex justify-center px-3 pointer-events-none"
           style="margin-bottom: max(env(safe-area-inset-bottom), 12px);">
        <button @click="tilbakeTilNatthimmel"
                class="pointer-events-auto max-w-full min-h-[44px] rounded-full
                       border border-white/15 bg-black/60 backdrop-blur px-4
                       text-[0.8125rem] leading-tight text-white/90 active:scale-95">
          Tilbake til natthimmel
        </button>
      </div>

      <!-- HIMMELKOMPASSET, nede til høyre i nattmodus. Egen absolutt plassert
           flate og ikke en plass i bunnraden: bunnraden ER skjult om natta, og
           kompasset skal ligge i hjørnet uansett hva annet som står på skjermen.
           pointer-events-none på hele laget — et trykk i hjørnet skal treffe
           himmelen bak, ikke en måler. -->
      <div v-if="phase === 'ready' && stjernemodus"
           class="absolute right-0 bottom-0 z-10 pointer-events-none p-3"
           style="padding-bottom: max(env(safe-area-inset-bottom), 12px);">
        <Tour3dHimmelKompass :blikk="blikk" @nord="engine?.seMotNord()"/>
      </div>

      <!-- Skjerping av kartbildet etter at visningen er åpen -->
      <div v-if="phase === 'ready' && buildMsg"
           class="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full
                  bg-black/55 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/85"
           :class="isLandscape ? 'top-16' : 'top-32'">
        <span class="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
        {{ buildMsg }}
      </div>

      <!-- Hold-for-å-se-rundt: hintet står så lenge fingeren er nede. -->
      <div v-if="holdingLook"
           class="absolute left-1/2 -translate-x-1/2 bottom-44 z-30 pointer-events-none
                  rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/85">
        Ser rundt — slipp for å følge ruta
      </div>

      <!-- Kortvarig melding -->
      <div v-if="toast"
           class="absolute left-1/2 -translate-x-1/2 bottom-28 z-30 max-w-[86vw] text-center rounded-full
                  bg-black/70 backdrop-blur px-3 py-1.5 text-xs text-white/90">
        {{ toast }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* «Trykk meg»: play-knappen pulserer rolig så lenge turen står stille —
   både rett etter sti-valg (ingen autostart) og i krysspause. */
@keyframes pulse-play {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.14); }
}
.pulse-play {
  animation: pulse-play 1.1s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pulse-play { animation: none; }
}
</style>

<script setup>
import { ref, computed, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue'
import AppMenuButton from '../components/AppMenuButton.vue'
import MapScaleAttribution from '../components/MapScaleAttribution.vue'
import FrittLendeKnapp from '../components/FrittLendeKnapp.vue'
import { usePinchZoom } from '../composables/usePinchZoom.js'
import { useUserPosition } from '../composables/useUserPosition.js'
import { useNettStatus } from '../composables/useNettStatus.js'
import { useScreenWakeLock } from '../composables/useScreenWakeLock.js'
import { useMapTheme } from '../composables/useMapTheme.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { loadMap, saveMap, FRITT_LENDE_ID, FRITT_LENDE_FORRIGE_ID } from '../lib/mapStorage.js'
import { byggVertSvg } from '../lib/kartVert.js'
import { tegnBrukerPrikk } from '../lib/brukerPrikk.js'
import { beregnMaalestokk } from '../lib/maalestokk.js'
import { strekSkala } from '../lib/strekSkala.js'
import { themeVarEntries, allThemeVarNames } from '../lib/mapSettingsApply.js'
import isomCatalog from '../lib/isomCatalog.json'
import {
  HALV_KM, ASPEKT, EKVIDISTANSE_M, DEM_OPPLOSNING_M, STREK_IDX, BREDDE_M,
  FRITT_LENDE_LAG, frittLendeTema, frittLendeUtmBbox,
  knappeHandling, knappeEtikett, fixVurdering, arkErGammelt,
  FIX_VENT_MS, dekningsSkala,
  avstandFraSenter, avstandTekst, forNaerTekst, NYTT_KART_M,
} from '../lib/frittLende.js'
import { gpsFeilTekst, GPS_IKKE_STOTTET } from '../lib/gpsFeil.js'
import KartLaster from '../components/KartLaster.vue'

// ── Fritt lende ─────────────────────────────────────────────────────────────
// Ett ark på 2 × 2 km der du står, og én knapp som sier hvor du er. Alt annet
// er borte med vilje.
//
// HVORFOR EGEN VIEW OG IKKE ET FLAGG I MapView: bestillingen var at moduler og
// lyttere ikke skal STARTE i det hele tatt. MapView kaller ~50 composables
// ubetinget på toppnivå i en rekkefølge som er løsbærende (TDZ- og
// hoisting-reglene i CLAUDE.md), så et betinget kall er ikke lov — alternativet
// ville vært en `enabled`-ref tredd inn i tjue composables, med regresjonsflate
// på alle brukere og en feilmodus Vue ikke kaster på. Her kalles seks.
//
// PRISEN ER DRIFT: en feil som rettes i MapViews render-sti når ikke hit. To
// ting demper den, og bare de to: den DELTE koden er ekte (kartVert,
// brukerPrikk, maalestokk, strekSkala er de samme filene MapView bruker), og
// modusen forblir funksjonsløs. HVER NYE KNAPP HER ER EN NY DRIFTFLATE — det er
// argumentet for å si nei til den fjerde knappen om et halvt år.
//
// ALT SOM ER EN BESLUTNING BOR I lib/frittLende.js, ikke her. Prosjektet har
// ingen måte å enhetsteste en Vue-komponent på, så logikk som blir stående i
// denne fila er logikk som bare er dekket av én røyk-sjekk.

const wrapperRef = ref(null)
const mapInnerRef = ref(null)
const svgHostRef = ref(null)

const meta = ref(null)
const opprettet = ref(null)
const bygger = ref(false)
const fremdrift = ref('')
const feil = ref('')
const feilForsok = ref(0)
// Invariant 1: settes false ved FØRSTE tap. Så lenge den står, kan et tap bare
// starte GPS — aldri bygge. Det er svaret på «GPS-en min er et helt annet sted
// nå enn da jeg bygget arket»: åpner du modusen hjemme med et ark fra fjellet,
// gjør første trykk ingen skade.
const ferskLast = ref(true)
const venterPaaFix = ref(false)
// ENGANGS, ikke en «følg meg»-modus. Kartet skal legge seg om deg når fixen
// kommer, men så bli liggende — panorerer du bort, skal ikke neste GPS-oppdatering
// rykke kartet tilbake under fingeren din.
const sentrerPaaNesteFix = ref(false)
const harAngre = ref(false)
const angreSynlig = ref(false)
const gammeltArk = ref(false)
// Kort beskjed nederst — brukes av avstandsporten. Ikke `feil`: den har en
// «Prøv igjen»-knapp og betyr «byggingen gikk galt», mens dette er et svar på
// et trykk som gjorde nøyaktig det den skulle.
const melding = ref('')

let byggAvbryter = null
let angreTimer = null
let meldingTimer = null
let fixVent = null
// Hvilken GPS-feilkode brukeren alt har fått en alert på. watchPosition kaller
// feil-handleren på nytt for hvert forsøk, og en alert per forsøk er en dialog
// man ikke slipper unna.
let varsletFeilkode = null

// Førstegangs-hint ved knappen. Modusen har ÉN kontroll, og et siktekors sier
// hvor du er — ikke at det henter et kart. Boblen vises til første trykk og
// aldri igjen; nøkkelen er persistert, så den overlever en ny økt. En ny bruker
// som ikke har skrudd på posisjon får dessuten spørsmålet stilt før trykket, i
// stedet for en knapp som ser ut til å gjøre ingenting.
const TIPS_KEY = 'lende-fritt-tips-sett'
const tipsSett = ref(true)
try { tipsSett.value = localStorage.getItem(TIPS_KEY) === '1' } catch { /* privat modus — vis én gang */ }
function kvitterTips() {
  if (tipsSett.value) return
  tipsSett.value = true
  try { localStorage.setItem(TIPS_KEY, '1') } catch { /* ignorer */ }
}

const { erOffline } = useNettStatus()
const { isDarkMap } = useMapTheme()
// Tekstflatene i modusen følger hovedmenyens 100/125/150-valg. Kartet gjør det
// bevisst ikke — stedsnavn er kartografi og skaleres av strek/tekst-knottene i
// turkartet, som denne modusen ikke har.
const { uiTextScale } = useUiTextScale()
const skjerm = useScreenWakeLock()

// ── Kart-flate ──────────────────────────────────────────────────────────────
const wrapperSize = ref({ w: 0, h: 0 })
const pz = usePinchZoom(wrapperRef, {
  // Rotasjon er LÅST. Kompasset er borte i denne modusen, og et rotert kart
  // uten kompass og uten noen kontroll som nullstiller rotasjonen er en ekte
  // navigasjonsfelle — du vet ikke hvilken vei nord er, og du kommer ikke
  // tilbake. Å fjerne gesten er en forenkling, ikke en knapp til.
  rotateEnabled: false,
  panAtRest: true,
})

const transformStyle = computed(() => ({
  transform: `translate(${pz.translateX.value}px, ${pz.translateY.value}px) scale(${pz.scale.value})`,
  transformOrigin: '0 0',
}))

const scaleBar = computed(() => beregnMaalestokk({
  w: wrapperSize.value.w, h: wrapperSize.value.h,
  widthM: meta.value?.widthM, heightM: meta.value?.heightM,
  scale: pz.scale.value,
}))

const userPos = useUserPosition(() => meta.value)

// ── Avstand fra senter ──────────────────────────────────────────────────────
// Modusens ene tall, og porten knappen står bak. Null til posisjonen er kjent —
// linjalen viser da ingen linje i stedet for en 0 som ser målt ut.
const avstandM = computed(() => avstandFraSenter({
  svgX: userPos.svgX, svgY: userPos.svgY,
  widthM: meta.value?.widthM, heightM: meta.value?.heightM,
}))
const avstandLinje = computed(() => (userPos.isWatching ? avstandTekst(avstandM.value) : ''))
const avstandNaadd = computed(() => (avstandM.value ?? 0) >= NYTT_KART_M)

// ── Knappen ─────────────────────────────────────────────────────────────────
const knappeTilstand = computed(() => ({
  harArk: !!meta.value,
  gpsPaa: userPos.isWatching,
  ferskLast: ferskLast.value,
  bygger: bygger.value,
  avstandM: avstandM.value,
}))
const etikett = computed(() => knappeEtikett(knappeTilstand.value))
const handling = computed(() => knappeHandling(knappeTilstand.value))

function onTap() { kvitterTips(); utfor(handling.value) }

function utfor(h) {
  ferskLast.value = false
  if (h === 'sentrer') return sentrer()
  if (h === 'start-gps') return startGps()
  if (h === 'start-gps-og-bygg') { startGps(); return byggNaarFix() }
  if (h === 'bygg') return byggHer()
  // Porten er stengt. Kartet sentreres likevel — det er den nyttige halvdelen
  // av trykket, og et trykk som bare avviser deg er en knapp som ikke gjør noe.
  if (h === 'for-naer') { sentrer(); visMelding(forNaerTekst(avstandM.value)) }
}

function visMelding(tekst) {
  melding.value = tekst
  clearTimeout(meldingTimer)
  meldingTimer = setTimeout(() => { melding.value = '' }, 6000)
}

// startPositioning må kalles i SAMME bruker-gest som tapet — iOS krever det for
// posisjons-tillatelsen, så den kan ikke ligge i en watcher.
function startGps() {
  // Samme alert-tekster som «Lag kart der jeg er» i turkartet, fra samme kilde
  // (lib/gpsFeil.js). Fram til v6.5.27 sa Fritt lende INGENTING når posisjonen
  // ble nektet: chipen sto og lette etter en fix som aldri kunne komme.
  if (!navigator.geolocation) { alert(GPS_IKKE_STOTTET); return }
  varsletFeilkode = null
  userPos.start()
  venterPaaFix.value = true
  // Kartet skal legge seg om deg så snart fixen lander, ikke bli stående på
  // arkets midtpunkt med en prikk i utkanten.
  sentrerPaaNesteFix.value = true
}

function sentrer() {
  if (!meta.value) return
  userPos.refresh()
  // Har vi ingen posisjon ennå, sentrerer vi på arket nå og flytter oss dit
  // fixen lander. Uten dette ville et trykk gitt arkets midtpunkt og så blitt
  // stående der, selv om posisjonen kom et halvsekund senere.
  if (userPos.svgX == null) sentrerPaaNesteFix.value = true
  settStandardvisning()
}

// Åpningsvisningen: dekk skjermen, og legg meg i midten. Brukes både når et ark
// lastes eller bygges, og når man trykker «sentrer» — knappen skal gi det samme
// bildet hver gang, uansett hvor man har panorert eller zoomet i mellomtiden.
function settStandardvisning() {
  const m = meta.value
  if (!m) return
  const { w, h } = wrapperSize.value
  if (!w || !h) return
  pz.rotation.value = 0
  pz.scale.value = dekningsSkala({ w, h, widthM: m.widthM, heightM: m.heightM })
  const inne = userPos.svgX != null && !userPos.isOutsideMap
  panTil(inne ? userPos.svgX : m.widthM / 2, inne ? userPos.svgY : m.heightM / 2)
}

// Legger kartpunktet (x, y) i viewportens midte.
//
// LETTERBOXINGEN MÅ MED, og det er ikke en detalj. SVG-elementet fyller hele
// verten (100 % × 100 %), men preserveAspectRatio="xMidYMid meet" tegner det
// KVADRATISKE kartet sentrert inni det rektangelet. På en høy telefon ligger
// altså kartets øvre kant ~180 px ned i elementet. Uten dette leddet lander
// punktet man «sentrerer» på en halv letterbox for lavt — som er nøyaktig det
// som fikk arket til å se bunnjustert ut, med posisjonen din under midten.
function panTil(x, y) {
  const { w, h } = wrapperSize.value
  const m = meta.value
  if (!w || !h || !m) return
  const fit = Math.min(w / m.widthM, h / m.heightM)
  const s = pz.scale.value
  const forskyvX = (w - m.widthM * fit) / 2
  const forskyvY = (h - m.heightM * fit) / 2
  pz.translateX.value = w / 2 - s * (forskyvX + x * fit)
  pz.translateY.value = h / 2 - s * (forskyvY + y * fit)
}

// ── Bygging ─────────────────────────────────────────────────────────────────
// Venter på en brukbar fix før arket bygges. Et 2 km-ark bygget på en ±500 m
// wifi-triangulert posisjon setter deg nær kanten fra første sekund, og du
// merker det ikke.
function byggNaarFix() {
  const start = Date.now()
  clearInterval(fixVent)
  fixVent = setInterval(() => {
    const dom = fixVurdering({ accuracyM: userPos.accuracyM, ventetMs: Date.now() - start })
    if (dom === 'vent') return
    clearInterval(fixVent); fixVent = null
    venterPaaFix.value = false
    if (dom === 'bygg') byggHer()
    else feil.value = `Usikker posisjon (±${Math.round(userPos.accuracyM)} m). Prøv igjen ute.`
  }, 500)
}

async function byggHer() {
  if (bygger.value) return
  if (userPos.latRaw == null) { byggNaarFix(); return }

  // INVARIANT 3: det gamle arket slettes ALDRI før det nye er ferdig bygget og
  // tegnet. Det er dette som gjør et feiltrykk ufarlig — ikke gestespråket.
  // Angre-sloten skrives FØR byggingen, mens vi ennå har arket; selve
  // overskrivingen av gjeldende slot skjer i saveMap inne i byggingen.
  const forrige = meta.value ? await loadMap(FRITT_LENDE_ID).catch(() => null) : null

  bygger.value = true
  feil.value = ''
  fremdrift.value = 'Henter terrenget …'
  byggAvbryter = new AbortController()

  try {
    const lat = userPos.latRaw
    const lon = userPos.lonRaw
    const { entry } = await buildMapFromCenter({
      center: { lat, lon, name: 'Fritt lende' },
      halfKm: HALV_KM,
      aspect: ASPEKT,
      equidistanceM: EKVIDISTANSE_M,
      navn: 'Fritt lende',
      id: FRITT_LENDE_ID,
      // Eksakt 2 × 2 km på DEM-rutenettet. Uten dette avrunder bboxFromCenter
      // og grid-snappingen arket til noe som er 2 000–2 040 m og litt ulikt
      // hver gang — for en modus hvis identitet ER «fast 2 × 2 km» er det feil.
      utmBbox: frittLendeUtmBbox(lat, lon),
      demResolutionM: DEM_OPPLOSNING_M,
      ignorerTetthet: true,
      klampBredde: false,
      signal: byggAvbryter.signal,
      onProgress: (msg) => { fremdrift.value = faseTekst(msg) },
    })
    // Først NÅ er det nye arket et faktum. Legg det gamle i angre-sloten.
    if (forrige) {
      await saveMap({ ...forrige, id: FRITT_LENDE_FORRIGE_ID }).catch(() => {})
      harAngre.value = true
      visAngre()
    }
    await visArk(entry)
    feilForsok.value = 0
  } catch (e) {
    if (e?.name !== 'AbortError') {
      feilForsok.value += 1
      feil.value = 'Fikk ikke tak i kartdata. Sjekk dekningen og prøv igjen.'
      console.error('[Fritt lende] bygging feilet:', e)
    }
  } finally {
    bygger.value = false
    fremdrift.value = ''
    byggAvbryter = null
    ryddSessionNokler()
  }
}

// onProgress er innvendig-vendt teknisk status («Fyller inn manglende høydedata
// fra global modell …»). En strøm av slik tekst er det motsatte av snappy, så
// den mappes til to faser brukeren kan forholde seg til.
function faseTekst(msg) {
  return /sti|osm|overpass|detalj|vei/i.test(msg ?? '')
    ? 'Tegner inn stier og detaljer …'
    : 'Henter terrenget …'
}

// Med et FAST id blir disse nøklene ellers liggende for alltid — de skrives av
// createMapFlow ved hver bygging og konsumeres bare av MapViews pipeline, som
// denne modusen ikke bruker.
function ryddSessionNokler() {
  for (const n of [`mapview-freshlook:${FRITT_LENDE_ID}`, `mapview-init-prefs:${FRITT_LENDE_ID}`]) {
    try { sessionStorage.removeItem(n) } catch { /* noop */ }
  }
}

function avbryt() {
  byggAvbryter?.abort()
  clearInterval(fixVent); fixVent = null
  venterPaaFix.value = false
}

// ── Angre ───────────────────────────────────────────────────────────────────
function visAngre() {
  angreSynlig.value = true
  clearTimeout(angreTimer)
  angreTimer = setTimeout(() => { angreSynlig.value = false }, 8000)
}

async function angre() {
  angreSynlig.value = false
  const forrige = await loadMap(FRITT_LENDE_FORRIGE_ID).catch(() => null)
  if (!forrige) return
  await saveMap({ ...forrige, id: FRITT_LENDE_ID }).catch(() => {})
  harAngre.value = false
  await visArk(forrige)
}

// ── Tegning ─────────────────────────────────────────────────────────────────
const detaljLag = shallowRef([])

async function visArk(entry) {
  if (!entry?.svg) return
  const doc = new DOMParser().parseFromString(entry.svg, 'image/svg+xml')
  const kilde = doc.documentElement
  const { svg, detaljLag: dl } = byggVertSvg(kilde)
  detaljLag.value = dl

  // Navn-LOD kjøres ikke i denne modusen, så klassen MÅ av — ellers er alle
  // stedsnavn usynlige for alltid, og navn er halve poenget med kartet.
  svg.classList.remove('lod-pending')

  meta.value = lesMeta(entry, kilde)
  opprettet.value = entry.opprettet ?? null
  gammeltArk.value = arkErGammelt(entry.opprettet)

  svgHostRef.value?.replaceChildren(svg)
  await nextTick()
  bruksUttrykk(svg)
  // Mål FØR visningen settes: wrapperSize er 0 × 0 fram til første måling, og
  // dekningsSkala på en umålt flate faller tilbake til 1 — altså nøyaktig den
  // contain-visningen dette skal erstatte.
  maal()
  settStandardvisning()
  tegnPrikk()
}

function lesMeta(entry, kilde) {
  const b = entry.utmBbox ?? {}
  return {
    minE: b.minE, minN: b.minN,
    widthM: (b.maxE - b.minE) || BREDDE_M,
    heightM: (b.maxN - b.minN) || BREDDE_M,
    equidistanceM: entry.equidistanceM ?? EKVIDISTANSE_M,
    viewBox: kilde?.getAttribute('viewBox'),
  }
}

// Uttrykket er fast: ISOM-lagsettet, låst strek, ingen relieff. Relieffet er av
// ved KONSTRUKSJON — useReliefRender kalles aldri og applyHillshade finnes ikke
// her — ikke ved å skrus av etterpå.
function bruksUttrykk(svg) {
  const tema = frittLendeTema(isDarkMap.value)
  // Tema-variablene settes på den FELLES transform-wrapperen og arves ned i
  // SVG-en, samme vei som MapViews applyTheme — og fra samme delte kilde
  // (mapSettingsApply), så uttrykket kan ikke drive fra resten av appen.
  const root = mapInnerRef.value
  if (root) {
    for (const name of allThemeVarNames()) root.style.removeProperty(name)
    for (const [name, value] of themeVarEntries(tema)) root.style.setProperty(name, value)
  }
  // Bakgrunnsfargen males på den utransformerte viewporten, ellers slipper
  // side-bakgrunnen gjennom i letterbox-kantene rundt et kvadratisk ark.
  const t = isomCatalog.themes?.[tema]
  if (wrapperRef.value) wrapperRef.value.style.backgroundColor = t?.background ?? ''

  svg.style.setProperty('--stroke-scale', String(strekSkala(STREK_IDX, meta.value?.widthM ?? BREDDE_M)))
  const synlige = new Set(FRITT_LENDE_LAG)
  for (const g of svg.querySelectorAll('[data-layer]')) {
    g.style.display = synlige.has(g.getAttribute('data-layer')) ? '' : 'none'
  }
}

function tegnPrikk() {
  const lag = svgHostRef.value?.querySelector('#user-layer')
  if (!lag || !meta.value) return
  const { w, h } = wrapperSize.value
  const fit = Math.min(w / meta.value.widthM, h / meta.value.heightM) || 1
  tegnBrukerPrikk(lag, {
    x: userPos.svgX, y: userPos.svgY, accuracyM: userPos.accuracyM,
    pxToUserUnits: (px) => px / (fit * pz.scale.value),
  })
}

watch(() => [userPos.svgX, userPos.svgY, userPos.accuracyM], () => {
  tegnPrikk()
  if (userPos.svgX == null) return
  // Posisjonen er inne: en senere feil er en NY feil og skal varsles igjen.
  varsletFeilkode = null
  // Fixen er inne: «Finner posisjonen din …» skal bort. Fram til v6.5.3 ble
  // flagget bare nullstilt av bygge-stien, så et trykk som BARE startet GPS
  // lot chipen stå for alltid — med posisjonen tydelig markert i kartet bak.
  //
  // Unntaket er når byggNaarFix venter på en god NOK fix: da eier den flagget,
  // og chipen skal stå til den har bestemt seg. Ellers ville tilbakemeldingen
  // forsvunnet mens vi fortsatt venter, og skjermen sett ferdig ut midt i en
  // vurdering.
  if (!fixVent) venterPaaFix.value = false
  if (sentrerPaaNesteFix.value && !userPos.isOutsideMap) {
    sentrerPaaNesteFix.value = false
    settStandardvisning()
  }
})
// Nektet posisjon er en BLOKKERENDE beskjed her, ikke en chip. Modusen har
// ingen annen inngang: uten posisjon kan den verken sentrere eller bygge, så en
// stille feil etterlater en skjerm som ser ut som om den henger.
watch(() => userPos.errorCode, (kode) => {
  if (kode == null || kode === varsletFeilkode) return
  varsletFeilkode = kode
  // Byggingen som ventet på en god fix er dømt — uten den ville intervallet
  // spunnet videre bak dialogen og chipen stått for alltid.
  clearInterval(fixVent); fixVent = null
  venterPaaFix.value = false
  sentrerPaaNesteFix.value = false
  // Kode 1 er tillatelsen: den kommer ikke av seg selv, så vi slutter å se
  // etter en posisjon og knappen faller tilbake til «Start posisjon». Kode 2/3
  // er forbigående — der lar vi watchPosition prøve videre.
  if (kode === 1) userPos.stop()
  alert(gpsFeilTekst(kode))
})

watch(() => isDarkMap.value, () => {
  const svg = svgHostRef.value?.querySelector('svg')
  if (svg) bruksUttrykk(svg)
})

// ── Livssyklus ──────────────────────────────────────────────────────────────
function maal() {
  const el = wrapperRef.value
  if (!el) return
  wrapperSize.value = { w: el.clientWidth, h: el.clientHeight }
}

let ro = null
onMounted(async () => {
  maal()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => { maal(); tegnPrikk() })
    ro.observe(wrapperRef.value)
  }
  window.addEventListener('resize', maal)
  skjerm.start?.()

  // Reload henter arket rett fra IndexedDB — ingen nettverk, ingen rebuild.
  // Det er modusens viktigste enkeltoppførsel: telefonen kan ha drept appen
  // mens du sto på fjellet uten dekning.
  const lagret = await loadMap(FRITT_LENDE_ID).catch(() => null)
  if (lagret) await visArk(lagret)
  harAngre.value = !!(await loadMap(FRITT_LENDE_FORRIGE_ID).catch(() => null))
})

onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('resize', maal)
  window.removeEventListener('offline', paaOffline)
  skjerm.stop?.()
  clearTimeout(angreTimer)
  clearTimeout(meldingTimer)
  clearInterval(fixVent)
  byggAvbryter?.abort()
  userPos.stop()
})

// Mister vi nettet MENS vi bygger, er byggingen dømt — avbryt straks i stedet
// for å la fetch-ene time ut én etter én. Etter at arket er bygget sier vi
// derimot INGENTING: arket er ferdig rendret SVG, og tapt dekning endrer ikke
// ett piksel av det du ser på. Et falskt alarmerende banner på et fjell er
// verre enn ingen.
function paaOffline() { if (bygger.value) avbryt() }
window.addEventListener('offline', paaOffline)

const feilHint = computed(() => (feilForsok.value >= 2
  ? 'Er du på et wifi som krever innlogging?' : ''))

const arkDato = computed(() => (opprettet.value
  ? new Date(opprettet.value).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' })
  : ''))
</script>

<template>
  <!-- `select-none` sitter på KART-FLATA og ikke på roten (v6.5.31). Den er der
       for gestene — et drag over et ark skal ikke ende i en blå markering — men
       på roten arvet hver eneste tekst i modusen den, og da kan ingen markere
       noe for opplesing eller oversettelse. Overleggene er ren tekst over et
       ark og har ingen gest å beskytte. -->
  <div class="fixed inset-0 overflow-hidden bg-map">
    <!-- Kart-flate. Ingen long-press-handlere: infopanelet finnes ikke her. -->
    <div ref="wrapperRef" class="absolute inset-0 touch-none select-none">
      <div ref="mapInnerRef" :style="transformStyle" class="w-full h-full">
        <div ref="svgHostRef" class="w-full h-full"></div>
      </div>
    </div>

    <!-- Hovedmenyen: den ENESTE veien ut av modusen. -->
    <div class="absolute top-0 inset-x-0 z-30 p-3">
      <AppMenuButton variant="float" />
    </div>

    <!-- Tomtilstand: navngir den ene gesten hele modusen hviler på.
         ÉN tekststørrelse i hele blokka (v6.5.31). Den hadde tre — 18, 14 og
         12 px — og et hint i 12 px er det ingen leser på en skjerm der det er
         det eneste som står. Overskriften bærer forskjellen med vekt alene.

         `zoom` følger hovedmenyens 100/125/150-valg. Uten den var dette den
         eneste teksten i appen som ikke gjorde det, og modusen er nettopp den
         man bruker med kalde hender i dårlig lys.

         `select-text` + `pointer-events-auto`: roten er `select-none` for
         kartets skyld, og teksten arvet det. Den som trenger en opplesing må
         kunne markere den — det koster ingenting her, siden boksen står midt på
         et tomt ark og ikke over noen kontroll. -->
    <div v-if="!meta && !bygger"
         class="absolute inset-0 grid place-items-center px-8 pointer-events-none">
      <div class="text-center text-ink/70 max-w-xs text-sm leading-relaxed
                  pointer-events-auto select-text"
           :style="{ zoom: uiTextScale }">
        <p class="font-semibold text-ink">Fritt lende</p>
        <p class="mt-2">Trykk knappen nede til høyre.<br>
          Du får et kart på 2 × 2 km med deg selv i midten.</p>
        <!-- Hintet handler om POSISJON og ikke om nett (v6.5.29). «Krever nett»
             sto her, men er implisitt for et kart som bygges av Overpass og
             Kartverket — og hovedmenyen sier det allerede. Det brukeren faktisk
             må gjøre for at knappen skal virke, er å slippe til posisjonen.

             «Nøyaktig posisjon» får en HALV setning om HVOR den bor (v6.5.31).
             Eieren fant den ikke selv: den ligger ikke i dialogen nettleseren
             viser, men under tillatelser for nettstedet i nettleserens egne
             innstillinger, og den settes én gang. Uten den er dette den stille
             feilen — omtrentlig plassering svarer med en fix, arket bygges, og
             det ser like ekte ut selv om det er sentrert kilometer unna. -->
        <p class="mt-3">
          Slå på posisjon når nettleseren spør.
        </p>
        <p class="mt-2">
          Slå også på «Nøyaktig posisjon» for dette nettstedet — en
          engangsinnstilling under tillatelser i nettleserens innstillinger.
          Uten den kan kartet havne kilometer fra der du står.
        </p>
        <p class="mt-4 text-ink/85">God tur i fritt lende.</p>
      </div>
    </div>

    <!-- Fremdrift. Ingen fullskjerm-loader: et 2 km-ark er 1/16 av
         standardkartet, så dette er sekunder og ikke minutter. -->
    <!-- left-0 right-0 + mx-auto og IKKE left-1/2 + translate: for et absolutt
         posisjonert element er tilgjengelig bredde alt fra venstrekanten og ut,
         så `left: 50%` gir shrink-to-fit bare HALVE skjermen å regne med — 215 px
         på en vanlig telefon. max-w slo derfor aldri inn, og «posisjonen» brakk
         midt i ordet. Her er hele bredden tilgjengelig og w-fit holder chipen
         like bred som innholdet. -->
    <div v-if="bygger || venterPaaFix"
         class="absolute top-16 left-0 right-0 mx-auto w-fit z-30 max-w-[min(24rem,92vw)]
                flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl bg-overlay shadow-lg
                border border-ink/10 backdrop-blur">
      <!-- Samme ikon som turkartet bruker mens det fyller inn detaljer. Det står
           i ALLE fasene, også «finner posisjonen» — den var den eneste uten noe
           som beveget seg, og en stillestående chip leses som at appen har hengt. -->
      <KartLaster storrelse="w-6 h-6" />
      <span class="text-sm text-ink leading-snug [overflow-wrap:normal] [word-break:keep-all]"
            :style="{ zoom: uiTextScale }">{{
        venterPaaFix && !bygger ? 'Finner posisjonen din …' : fremdrift }}</span>
      <!-- shrink-0 + nowrap: uten dem klemmes knappen mot teksten og «Avbryt»
           deles til «Av-bryt» over to linjer. Den er rømningsveien ut av en
           bygging, og en knapp som ser ødelagt ut leses som at appen er det. -->
      <button type="button"
              class="shrink-0 whitespace-nowrap text-sm font-semibold text-ink/70 underline"
              @click="avbryt">Avbryt</button>
    </div>

    <!-- Feil. «Kartet du har fungerer fortsatt» er ikke pynt: den skiller
         «du kan ikke lage et nytt nå» fra «det du har er ubrukelig». -->
    <div v-if="feil && !bygger"
         class="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[min(20rem,90vw)]
                px-4 py-3 rounded-xl bg-overlay shadow-lg text-center text-sm"
         :style="{ zoom: uiTextScale }">
      <p class="text-ink">{{ feil }}</p>
      <p v-if="meta" class="mt-1 text-ink/60">Kartet du har fungerer fortsatt.</p>
      <p v-if="feilHint" class="mt-1 text-ink/60">{{ feilHint }}</p>
      <button type="button" class="mt-2 font-semibold text-ink underline"
              @click="feil = ''; byggHer()">Prøv igjen</button>
    </div>

    <!-- Arkets alder. Ett ark fra forrige helg 60 km unna laster ellers
         mandag morgen uten et ord. -->
    <div v-else-if="gammeltArk && meta && !bygger"
         class="absolute top-16 left-1/2 -translate-x-1/2 z-20
                px-3 py-1.5 rounded-full bg-overlay shadow text-sm text-ink/70"
         :style="{ zoom: uiTextScale }">
      Kartet er fra {{ arkDato }}
    </div>

    <!-- Linjalen bærer avstanden fra senter i stedet for ekvidistansen (v6.5.27):
         ekvidistansen er fast 10 m og leses én gang, mens avstanden er tallet
         som sier når arket tar slutt og knappen slipper deg videre. -->
    <MapScaleAttribution :visible="!!meta" :scale-bar="scaleBar"
                         :avstand-tekst="avstandLinje"
                         :avstand-naadd="avstandNaadd" />

    <!-- Førstegangs-boble over knappen. Den peker NED mot knappen med en
         trekant, fordi et hint som bare svever i hjørnet ikke sier hvilken
         knapp det gjelder — og modusen har bare den ene.
         Den står bare før første trykk, og bare når det ikke finnes et ark:
         har du et kart, har du alt trykket.
         `right-4` med samme kant som knappen, og trekanten sentrert over
         knappens midte (56 px bred → 28 px inn fra kanten). -->
    <div v-if="!tipsSett && !meta && !bygger"
         class="absolute bottom-20 right-4 z-30 max-w-[min(17rem,78vw)]
                px-3.5 py-2.5 rounded-xl bg-overlay shadow-lg
                ring-1 ring-amber-400/60 text-sm text-ink leading-snug"
         :style="{ zoom: uiTextScale }">
      GPS på? Trykk her for å hente kart.
      <span class="absolute -bottom-[7px] right-[22px] w-3.5 h-3.5 rotate-45
                   bg-overlay border-r border-b border-amber-400/60" aria-hidden="true"></span>
    </div>

    <FrittLendeKnapp :etikett="etikett" :handling="handling" :bygger="bygger"
                     :venter-paa-fix="venterPaaFix" :offline="erOffline"
                     :fremhev="!tipsSett"
                     @tap="onTap" />

    <!-- Avstandsporten svarer her. Ikke en alert: den er et svar på et trykk som
         gjorde det den skulle, og en dialog man må lukke for hvert trykk på
         hovedknappen ville vært en straff for å bruke den.
         right-24: knappen er 56 px + 16 px marg nede til høyre, og en toast
         under den er en toast man ikke ser. -->
    <div v-if="melding && !bygger"
         class="absolute left-4 right-24 z-30
                px-4 py-2.5 rounded-xl bg-overlay shadow-lg
                text-sm text-ink leading-snug"
         :class="angreSynlig ? 'bottom-20' : 'bottom-6'"
         :style="{ zoom: uiTextScale }">
      {{ melding }}
    </div>

    <!-- Angre. Gjør byggingen ikke-destruktiv, som er hvorfor modusen slipper
         en bekreftelsesdialog i sin egen hovedsløyfe. -->
    <div v-if="angreSynlig"
         class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30
                flex items-center gap-3 px-4 py-2 rounded-full bg-overlay shadow-lg text-sm"
         :style="{ zoom: uiTextScale }">
      <span class="text-ink">Nytt kart.</span>
      <button type="button" class="font-semibold text-ink underline"
              @click="angre">Angre</button>
    </div>
  </div>
</template>

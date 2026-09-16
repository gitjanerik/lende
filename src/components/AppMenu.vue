<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppMenu } from '../composables/useAppMenu.js'
import { useUiTextScale, UI_TEXT_MIN, UI_TEXT_MAKS } from '../composables/useUiTextScale.js'
import { useUiTheme } from '../composables/useUiTheme.js'
import { useHoldVaken } from '../composables/useHoldVaken.js'
import { MAKS_MINUTTER } from '../lib/holdVaken.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
import { useEksterneLenker } from '../composables/useEksterneLenker.js'
import { listMaps, listGravelRoutes } from '../lib/mapStorage.js'
import { mapsSummary, routesSummary } from '../lib/menuSummary.js'
import { gpsFeilTekst, GPS_IKKE_STOTTET } from '../lib/gpsFeil.js'
import { useMapSizePreference, DEFAULT_MAP_WIDTH_KM } from '../composables/useMapSizePreference.js'
import AppModal from './AppModal.vue'
import AboutContent from './AboutContent.vue'
import MapLibrary from './MapLibrary.vue'
import GpsFeilVarsel from './GpsFeilVarsel.vue'
import MapPickerContent from './MapPickerContent.vue'
import VersjonSjekk from './VersjonSjekk.vue'
import { useFokusFelle } from '../composables/useFokusFelle.js'

// Global hovedmeny — slide-in fra venstre. Montert én gang i App.vue og styrt av
// den delte useAppMenu-tilstanden, så meny-knappen i enhver visning åpner denne.
// Lukkes på valg, backdrop-klikk, Escape og rute-endring.
//
// v2.4.13 — ryddet i tre nivåer etter design-handoff:
//   1. primærvalgene er kort med antall/undertekst, kontekst og visning er rader
//   2. Om appen + versjon er dempet under en skillelinje
// Modus-segmentet som lå øverst er fjernet i v6.5.35 — se «Modus» under.
// Tekststørrelsen er én slider (100–200 %) som skalerer menyen live: rot-fonten
// er 16 px × faktor, og alt innhold er i em.

const { menuOpen, close, onsketSheet } = useAppMenu()
const { uiTextScale, setTextScale } = useUiTextScale()
const { theme, setTheme } = useUiTheme()

// ── Eksterne lenker ──────────────────────────────────────────────────────────
// Bryteren bor i HOVEDMENYEN og ikke i kartets innstillings-skuff, fordi den
// gjelder hele appen: ut.no og Google Maps fra infopanelet, kulturminnesok.no,
// NVEs stasjonssider, Naturbase-faktaark og leksikon-lenkene i 3D-himmelen —
// og Turplanleggeren har ingen slik skuff i det hele tatt.
// Begrunnelsen for at AV er standard står i useEksterneLenker.
const { nyFane, settNyFane } = useEksterneLenker()

// ── Hold skjermen våken ──────────────────────────────────────────────────────
// Flyttet hit fra Innstillinger → Format (v6.6.4). Den lå fire trykk unna, i en
// fane om papirformat og høydekurver, og gjaldt bare kartet — mens funksjonen er
// like nødvendig i Turplanleggeren. Hovedmenyen er den ene flaten begge
// halvdelene deler.
//
// Formen byttet samtidig: av/på-bryteren ble en NEDTELLING. En bryter må slås
// av igjen, og den som glemmer det finner en tom telefon; en time som løper ut
// av seg selv trenger verken advarsel eller opprydding. Derfor er det heller
// ingen «på»-tekst og ingen knapp her: sliderens tall og den gule ringen rundt
// hamburgeren sier alt som skal sies.
const holdVaken = useHoldVaken()
// Sliderens visningsverdi: nedtellingen, ikke det som ble valgt. Drar man til 30
// og lar den gå i ti minutter, skal håndtaket stå på 20 — ellers lyver den om
// hvor mye tid som er igjen.
const vakenMin = computed(() => (holdVaken.aktiv.value ? holdVaken.igjenMinutter.value : 0))
const vakenTekst = computed(() => (holdVaken.aktiv.value
  ? `${holdVaken.igjenMinutter.value} minutter igjen`
  : 'Av'))

const route = useRoute()
const router = useRouter()

// ── Modus ────────────────────────────────────────────────────────────────────
// Modusen LESES av appens tilstand (hvilken rute/fane vi står i) i stedet for å
// være en egen preferanse.
//
// SEGMENTBRYTEREN ØVERST ER FJERNET (v6.5.35), og med den den ene knappen som
// gjorde modus til et VALG. Den så ut som faner over et innhold som ikke var
// faner: radene under er bibliotek og innstillinger, ikke to sider av det
// segmentet sto over. Navigasjonen bor nå i radene selv, som en pil høyre —
// «gå til funksjonen» — der «+» sto. For Turplanleggeren var «+ Ny rute»
// dessuten NØYAKTIG samme navigasjon som segmentet, altså to knapper med én
// handling; for Turkart åpnet «+» en modal som «Mine kart» uansett åpner selv
// (søkefeltet står øverst i den).
//
// `mode` lever videre, men BARE for å vise hvor du er (`is-card` på raden).
// Den bestemmer ikke lenger hva som står i menyen eller i hvilken rekkefølge.
const mode = computed(() =>
  (route.name === 'ruteplanlegger' || route.query.tab === 'rute') ? 'plan' : 'kart')

function go(to, last) {
  close()
  if (last) { try { localStorage.setItem('lende-last-mode', last) } catch { /* ignorer */ } }
  router.push(to)
}
// ── Primærvalg ───────────────────────────────────────────────────────────────
// Antall lagrede kart/ruter hentes ved hver åpning — menyen er den ene flaten
// der tallene skal stemme, og lesingen går mot det lette meta-storet.
const maps = ref([])
const routes = ref([])
async function loadCounts() {
  try { maps.value = (await listMaps()).filter((m) => !m.isAuto) } catch { maps.value = [] }
  try { routes.value = await listGravelRoutes() } catch { routes.value = [] }
}
watch(menuOpen, (open) => { if (open) void loadCounts() }, { immediate: true })

const PRIMARY = [
  {
    id: 'kart', label: 'Mine kart', sheet: 'kart',
    to: '/', last: 'kart', goLabel: 'Gå til Turkart',
    d: 'M4 8.5 12 4.5l8 4-8 4-8-4Zm0 5 8 4 8-4m-16 0',
  },
  {
    id: 'plan', label: 'Mine ruter', sheet: 'rute',
    to: '/rute', last: 'rute', goLabel: 'Gå til Turplanlegger',
    // STREKEN MÅ RØRE BEGGE SIRKLENE (v7.8.6). Den gamle bar to `m`-hopp
    // relativt til det lukkede sirkel-subpathet, og landet dermed nede til
    // venstre for den nederste sirkelen: stammen sluttet i løse lufta 5 enheter
    // under den øverste, og halen gikk forbi den nederste. Ruta er nå ett eget
    // subpath i ABSOLUTTE koordinater, fra nedre kant av sirkel 1 (6,5 · 8,5)
    // til venstre kant av sirkel 2 (15 · 18) — to kvartsvinger om en rett strekk.
    d: 'M6.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'
     + 'M6.5 8.5v4a3 3 0 0 0 3 3h3a2.5 2.5 0 0 1 2.5 2.5',
  },
]
// REKKEFØLGEN ER FAST: Turkart øverst, alltid (v6.5.35). Den fulgte modusen —
// «Mine kart» først i Turkart, «Mine ruter» først i Turplanleggeren — og en meny
// som stokker om på seg selv etter hvor du står er en meny man må LESE hver gang
// framfor å treffe på muskelminne. Hvor du er, sies av kort-markeringen
// (`is-card`), som ikke flytter noe.
const primaryRows = computed(() => PRIMARY.map((p) => ({
  ...p,
  meta: p.id === 'kart' ? mapsSummary(maps.value) : routesSummary(routes.value),
})))

// ── «Nytt turkart» ───────────────────────────────────────────────────────────
// TREDJE RAD I am-primary, der Fritt lende sto til v7.8.14. Modusen er slettet,
// og plassen er gitt til det den egentlig lovte: ETT kart, der du står, uten et
// skjema først. Forskjellen er at arket nå er et vanlig turkart — det får navn,
// havner i «Mine kart» og kan deles — så løftet om «ingen innstillinger» kan
// holdes uten at prisen er et ark som forsvinner.
//
// Raden er den eneste i menyen med en «+» og ikke en pil: de to over GÅR et
// sted, denne LAGER noe. Underteksten sier hva man får før man trykker —
// bredden er brukerens egen standard (`mapSizeKm`, default 8 km), ikke en
// konstant, ellers ville den løyet for alle som har dratt slideren.
//
// POSISJONEN HENTES HER, BYGGINGEN SKJER I «Mine kart». En avvist tillatelse
// skal sies der knappen står — derfor `getCurrentPosition` i denne fila — men
// fremdrifts-chipen, avbryt-knappen og navigasjonen til det ferdige kartet bor
// alt i MapLibrary, og en andre kopi av den flyten her ville vært to steder å
// holde i takt. Vi åpner altså «Mine kart»-modalen med koordinatene i
// `byggFra`, og den gjør nøyaktig det dens egen pin-knapp gjør.
const { mapSizeKm } = useMapSizePreference()
const nyttKartBredde = computed(() => mapSizeKm.value ?? DEFAULT_MAP_WIDTH_KM)
const nyttKartMeta = computed(() =>
  `${nyttKartBredde.value} × ${nyttKartBredde.value} km · fra din posisjon`)

const gpsLeter = ref(false)
const gpsFeil = ref('')          // '' = ingen boks. X-en setter den tilbake hit.
const byggFraPos = ref(null)     // { lat, lon } — sendes inn i MapLibrary

function nyttTurkart() {
  if (gpsLeter.value) return
  gpsFeil.value = ''
  if (!('geolocation' in navigator)) { gpsFeil.value = GPS_IKKE_STOTTET; return }
  gpsLeter.value = true
  navigator.geolocation.getCurrentPosition((pos) => {
    gpsLeter.value = false
    byggFraPos.value = { lat: pos.coords.latitude, lon: pos.coords.longitude }
    // openSheet lukker menyen. Rekkefølgen spiller ingen rolle for byggingen —
    // MapLibrary leser propen med `immediate` når den monteres.
    openSheet('kart')
  }, (err) => {
    gpsLeter.value = false
    // Etiketten alene: samme boks som «Mine kart» og utsnitts-velgeren (se
    // GpsFeilVarsel). Menyen er en smal skuff, og tre linjer om låsikonet i
    // adressefeltet dyttet alt under seg ut av syne.
    gpsFeil.value = gpsFeilTekst(err.code)
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
}

// ── HJELP-BLOKKA ER BORTE (v7.8.13) ─────────────────────────────────────────
// Den bar to rader under ledeteksten «Hjelp i lende»: Tegnforklaring og Spør
// Lende. Begge svarer på noe man har foran seg PÅ KARTET, og hovedmenyen er det
// ene stedet i appen der kartet ikke er synlig. Tegnforklaringen er nå snarveien
// «Hjelp» over kartet (se lib/snarveier.js), og chatten nås fra Lende-knappen
// nede til høyre — der den alt har bodd siden v7.2.0. Med begge radene ute har
// ledeteksten ingenting å lede, så den er slettet med dem.

// ── Utseende ─────────────────────────────────────────────────────────────────
const THEMES = [
  { value: 'lyst', label: 'Lyst',
    d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2.5v2m0 15v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2.5 12h2m15 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
  { value: 'mørkt', label: 'Mørkt', d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z' },
  { value: 'auto', label: 'Auto', d: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z' },
]
// TEKSTSTØRRELSEN ER ET SPENN, IKKE FIRE KNAPPER (v7.8.4). Fire samtidige valg
// var riktig så lenge skalaen HADDE fire lovlige verdier; nå er den fri mellom
// 100 og 200 %, og en knapperad kan ikke uttrykke 137. Prosenten står over
// sporet og ikke ved siden av, samme grep som «Hold skjermen våken» (v6.6.5):
// menyens egen rot-font vokser MED valget, så en etikett ved siden av ville
// spist mer av slideren jo større man dro den.
//
// A-KNAPPEN I ARKENE BEHOLDER SINE FIRE HAKK, og det er ikke en inkonsekvens:
// der er plassen ett trykk, og hakkene er stasjonene «litt større, takk»
// stopper på. Den viser den satte prosenten nøyaktig — se TekstStorrelseKnapp.
const TEXT_MIN_PST = Math.round(UI_TEXT_MIN * 100)
const TEXT_MAKS_PST = Math.round(UI_TEXT_MAKS * 100)
const tekstProsent = computed(() => Math.round(uiTextScale.value * 100))

// SKALAEN SETTES VED SLIPP, IKKE UNDER DRAGET (v7.8.7).
// `input` fyrer per piksel, og hver verdi skrev rot-fonten på nytt — så hele
// menyen (og appen bak den) reflowet mens fingeren sto på håndtaket: sporet
// flyttet seg under tommelen, og man siktet på et mål som beveget seg. `change`
// fyrer ved SLIPP på berøring og mus, og med én gang på piltastene — altså
// nøyaktig når valget er tatt, i begge betjeningsformene.
//
// TALLET FØLGER LIKEVEL FINGEREN. Det er hele tilbakemeldingen man har mens man
// drar, og det koster ingen reflow utenfor sin egen boks: plassen over sporet er
// reservert for den STØRSTE prosenten (se .am-size-verdi-plass), så verken
// slideren eller menyen under den rikker seg.
const draProsent = ref(null)
const visProsent = computed(() => draProsent.value ?? tekstProsent.value)
function tekstDra(e) { draProsent.value = e.target.valueAsNumber }
function tekstSlipp(e) {
  draProsent.value = null
  setTextScale(e.target.valueAsNumber / 100)
}

// Menyens egen rot-font: alt innhold er i em, så et valg skalerer hele skuffen
// umiddelbart — brukeren ser resultatet der og da.
const rootFontSize = computed(() => `${16 * uiTextScale.value}px`)

// ── «Installer som app» ──────────────────────────────────────────────────────
// Vises kun når appen IKKE alt kjører installert (standalone) og nettleseren
// støtter install (Chrome/Edge/Samsung via beforeinstallprompt → canInstall,
// eller iOS der install er manuell).
const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()
const showInstall = computed(() => !isStandalone.value && (canInstall.value || isIOS.value))
async function onInstall() {
  if (isIOS.value) {
    close()
    alert('Slik installerer du Lende på iPhone/iPad:\n\n1. Trykk Del-ikonet nederst i Safari.\n2. Velg «Legg til på Hjem-skjerm».')
    return
  }
  if (!canInstall.value) return
  try { await promptInstall() } catch { /* avvist/utilgjengelig */ } finally { close() }
}

// ── Menyens «sider» som modaler ──────────────────────────────────────────────
// Var egne ruter (/om, /tegnforklaring): menyen lukket seg, og veien tilbake
// gikk via nettleserens tilbake-knapp — med en vestigial header og hamburger
// øverst til venstre. Nå er de modaler. Rutene består for deep-lenker (se
// AboutView/LegendView).
//
// v4.8.3: modalen lå oppå den ÅPNE menyen, så du satt igjen med to lag og to
// lukke-kryss samtidig (menyens hamburger-X øverst til venstre og modalens X
// øverst til høyre) — uklart hvilket som gjorde hva. Nå lukker menyen seg når
// en modal åpnes: ett lag, ett kryss. Gjelder alle menyens modaler, ikke bare
// «Mine kart» — ellers ville halvparten oppført seg på den ene måten.
const sheet = ref(null)   // 'kart' | 'rute' | 'nytt' | 'om' | null

// «Nytt kart»-skjemaet har to innganger — menyens «+» og «Flere valg».
// v6.5.45: den tredje er borte. Søkefeltets grønne pin bygger nå kartet der den
// står, så flagget som ba dette skjemaet hente posisjonen hadde ingen avsender
// igjen.
// Et ønske utenfra (kart-visningen uten kart) åpner samme modal som menyen
// selv gjør — og kvitteres ut, så to trykk på samme lenke virker begge ganger.
watch(onsketSheet, (navn) => {
  if (!navn) return
  openSheet(navn)
  onsketSheet.value = null
})

function openSheet(name) {
  sheet.value = name
  close()
}

function apnePicker() {
  sheet.value = 'nytt'
}

// Lukk ved rute-endring (f.eks. maskinvare-tilbake) og på Escape. Modalen kan
// nå stå åpen uten menyen, så den må ryddes her også.
// Merk hva denne watchen IKKE dekker: en push til ruta man allerede står i.
// `MapLibrary` melder derfor navigasjonen sin selv (`@navigert`). Watchen er
// nettet under den — den fanger tilbake-knappen og navigasjon utenfra.
watch(() => route.fullPath, () => {
  sheet.value = null
  if (menuOpen.value) close()
})

// POSISJONEN ER EN ENGANGS-NYTTELAST. Lukkes «Mine kart» på hvilken som helst
// måte — X, Escape, tilbake-knappen eller `@navigert` fra et ferdig kart — skal
// fixen være borte. Uten dette ville neste trykk på «Mine kart» montert
// MapLibrary på nytt med den gamle posisjonen i propen og bygget kartet én gang
// til, på et sted brukeren forlot for en time siden.
watch(sheet, (v) => { if (!v) byggFraPos.value = null })

// Escape lukker ØVERSTE lag først. Håndteres her, ikke i AboutModal: to
// uavhengige lyttere ville lukket både modalen og menyen på samme tastetrykk.
function onKey(e) {
  if (e.key !== 'Escape') return
  if (sheet.value) sheet.value = null
  else if (menuOpen.value) close()
}
// Skuffa er en dialog: Tab skal holde seg i den mens den er åpen, og fokus
// skal tilbake til hamburgeren når den lukkes. Uten fella tabber man rett ut i
// forsiden bak, som fortsatt ligger der og er fullt betjenbar.
const menuRef = ref(null)
useFokusFelle(menuRef, () => menuOpen.value, {
  ogsaa: () => [...document.querySelectorAll('[data-hovedmeny-knapp]')],
})

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="menu-fade">
    <div v-if="menuOpen" class="fixed inset-0 z-[200] bg-black/50" @click="close" />
  </Transition>

  <Transition name="menu-slide">
    <aside v-if="menuOpen" ref="menuRef" class="app-menu" :style="{ fontSize: rootFontSize }"
           role="dialog" aria-modal="true" aria-label="Hovedmeny">
      <div class="am-head">
        <!-- Ingen egen X: hamburger-knappen som åpnet menyen ER lukkekontrollen.
             Den bor permanent i <body> med z-[205] (se AppMenuButton), altså oppå
             skuffen, og animerer streker→kryss uten å flytte seg. Plassholderen
             her holder tittelen klar av knappen. -->
        <span class="am-trigger-slot" aria-hidden="true" />
        <div class="am-title">Lende</div>
      </div>

      <div class="am-scroll">
        <!-- «INSTALLER SOM APP» ER MENYENS FØRSTE RAD OG DEN ENESTE GULE
             (v7.8.29). Den lå nederst under skillelinja, i samme dempede grå
             som «Om appen» — altså formet som det man leser til slutt, mens den
             er det ene valget i menyen som endrer hva Lende ER for brukeren:
             installert får man egen ikon på hjemskjermen, full skjerm og en
             app som starter uten URL-stripe. Gult er appens egen aksent fra før
             (hamburger-ringen, våken-sporet) og finnes ingen andre steder i
             menyen, så raden kan ikke forveksles med de grønne som navigerer.
             Undertittelen er et LØFTE og ikke en forklaring av knappen — det er
             det gult gjør her.
             Raden vises bare når appen ikke alt kjører installert; se
             `showInstall`. Da er menyens første rad «Mine kart», som før. -->
        <button v-if="showInstall" type="button" class="am-install" @click="onInstall">
          <span class="am-install-icon">
            <!-- Telefon med pluss: «legg den på hjemskjermen». Nedlastings-
                 pilen den hadde er handlingen en NETTLESER gjør, og det er
                 ikke det som skjer her. -->
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="2.5" width="14" height="19" rx="2.6" />
              <path d="M12 8.5v6M9 11.5h6" />
            </svg>
          </span>
          <span class="am-install-tekst">
            <span class="am-install-tittel">Installer som app</span>
            <span class="am-install-meta">Fritt lende på tur!</span>
          </span>
        </button>

        <!-- Nivå 1: primærvalgene. Øverste rad (aktiv modus) er kortet. -->
        <div class="am-primary">
          <!-- `is-card` markerer HVOR DU ER og ikke hvilken rad som er øverst
               (v6.5.35). Den fulgte indeksen, som var det samme så lenge lista
               ble stokket om etter modus; med fast rekkefølge må den lese
               modusen selv, ellers ville «Mine kart» sett aktiv ut i
               Turplanleggeren. -->
          <div v-for="p in primaryRows" :key="p.id" class="am-row"
               :class="{ 'is-card': mode === p.id }">
            <span class="am-row-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path :d="p.d" />
              </svg>
            </span>
            <button type="button" class="am-row-main" @click="openSheet(p.sheet)">
              <span class="am-row-title">{{ p.label }}</span>
              <span class="am-row-meta">{{ p.meta }}</span>
            </button>
            <button type="button" class="am-add" :aria-label="p.goLabel"
                    @click="go(p.to, p.last)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h13m-5.5-6 6 6-6 6" />
              </svg>
            </button>
          </div>

          <!-- «NYTT TURKART» — tredje rad, der Fritt lende sto (v7.8.14).
               Den bryter med de to over på ett punkt med vilje: knappen til
               høyre er en PLUSS og ikke en pil. «Mine kart» og «Mine ruter»
               går et sted man kan bli; denne lager noe og forsvinner. Samme
               grønne `am-add`-flate, så de tre radene fortsatt leses som ett
               nivå — det er glyfen som sier forskjellen, ikke formen.

               Ikonet til venstre er en kart-nål og ikke et kompass: raden
               handler om STEDET (der du står), mens Fritt lende-kompasset
               handlet om en modus. Meta-linja bærer brukerens egen
               standardbredde, ikke en konstant — se `nyttKartMeta`.

               Ingen `is-card`: raden er ikke et sted man KAN stå. -->
          <div class="am-row">
            <span class="am-row-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21.5s7-6.2 7-11.5a7 7 0 1 0-14 0c0 5.3 7 11.5 7 11.5Z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
            </span>
            <button type="button" class="am-row-main" @click="nyttTurkart">
              <span class="am-row-title">Nytt turkart</span>
              <!-- `is-svar` er ikke pynt: i liggende skjules meta-linjene for
                   å spare høyde, men «Finner posisjonen din …» er SVARET på
                   trykket man nettopp gjorde — skjules det, ser raden ut til å
                   ikke gjøre noe mens GPS-en jobber. -->
              <span class="am-row-meta" :class="{ 'is-svar': gpsLeter }">{{
                gpsLeter ? 'Finner posisjonen din …' : nyttKartMeta }}</span>
            </button>
            <button type="button" class="am-add" aria-label="Lag nytt turkart der du er"
                    :disabled="gpsLeter" @click="nyttTurkart">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5.5v13M5.5 12h13" />
              </svg>
            </button>
          </div>

          <!-- Varselet står RETT UNDER raden det gjelder, ikke øverst i menyen:
               en avvist tillatelse er svaret på det trykket, og et svar et annet
               sted enn spørsmålet leses ikke. X-en er den eneste veien ut —
               boksen skal ikke forsvinne av seg selv, for da rekker man ikke å
               lese hvorfor knappen ikke gjorde noe. -->
          <GpsFeilVarsel v-if="gpsFeil" :tekst="gpsFeil" @lukk="gpsFeil = ''" />
        </div>

        <!-- Appens utseende. LEDETEKSTEN «Visning» ER BORTE (v7.8.13): med
             hjelp-blokka over slettet er dette den første blokka i menyen, og
             tre tema-knapper med sol, måne og lyn sier hva de er uten en
             overskrift som gjentar det. Tekst-slideren har fått sin egen blokk
             under, med ledetekst — den er ikke selvforklarende på samme måte. -->
        <div class="am-block am-block-wide">
          <div class="am-seg" role="group" aria-label="Utseende">
            <button v-for="t in THEMES" :key="t.value" type="button"
                    class="am-seg-btn am-seg-col" :class="{ 'is-on': theme === t.value }"
                    :aria-pressed="theme === t.value" @click="setTheme(t.value)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path :d="t.d" />
              </svg>{{ t.label }}
            </button>
          </div>
          <!-- «TURKART I MØRKT TEMA» ER BORTE HERFRA (v7.8.6). Den sto under
               de tre tema-knappene, som gjelder APPENS chrome, og gjaldt selv
               KARTFLATA — to nivåer i samme blokk, og det ene av dem var det
               eneste valget i menyen som ikke handlet om appen. Vekselen bor nå
               som snarveien «Natt»/«Dag» over kartet, altså på flata den
               endrer. Stemning-fana er siden borte (v7.8.12) — både kartstilene
               og stemningene velges i Innstillinger → Stil. -->
        </div>

        <!-- TEKST I LENDE (v7.8.13). Etiketten var en `am-size-label` INNE i
             Visning-blokka — altså en tredje slags overskrift ved siden av
             ledetekstene, på en innstilling som er like selvstendig som «Hold
             skjermen våken». Den er nå en ledetekst i sin egen blokk, med samme
             form som den: versaler, samme farge, samme avstand. Navnet sier
             dessuten HVOR den gjelder — appens egen tekst, ikke kartets. -->
        <div class="am-block am-block-wide">
          <div class="am-eyebrow">Tekst i Lende</div>
          <!-- Tallet står OVER sporet (se kommentaren ved TEXT_MIN_PST), og
               rendres i sin EGEN størrelse: valget er lesbart som seg selv,
               slik de fire knappene var. -->
          <div class="am-size-row">
            <div class="am-size-slider">
              <div class="am-size-verdi-plass">
                <div class="am-size-verdi" role="status" aria-live="polite"
                     :style="{ fontSize: `${0.7 + (visProsent - TEXT_MIN_PST) / 125}em` }">
                  {{ visProsent }} %
                </div>
              </div>
              <input type="range" class="am-size-range"
                     :min="TEXT_MIN_PST" :max="TEXT_MAKS_PST" step="1"
                     :value="visProsent"
                     aria-label="Tekststørrelse i grensesnittet, prosent"
                     :aria-valuetext="`${visProsent} prosent`"
                     @input="tekstDra" @change="tekstSlipp" />
            </div>
          </div>
        </div>

        <!-- Hold skjermen våken: én slider, ingen knapp. Egen blokk og ikke en
             rad i «Visning» — det er en FUNKSJON som gjør noe med telefonen, ikke
             en innstilling for hvordan appen ser ut. -->
        <div v-if="holdVaken.stottes.value" class="am-block am-block-wide">
          <div class="am-eyebrow">Hold skjermen våken</div>
          <!-- Teksten står OVER slideren, ikke ved siden av (v6.6.5). Ved 200 %
               tekst tok «39 minutter igjen» to tredjedeler av bredden, og
               slideren satt igjen med en stump man ikke kan sikte i. Over
               betyr også at sporet er like bredt i begge tilstander — det
               flytter seg ikke når «Av» blir til et tall. -->
          <div class="am-wake">
            <div class="am-wake-meta" :class="{ 'is-on': holdVaken.aktiv.value }"
                 role="status" aria-live="polite">{{ vakenTekst }}</div>
            <input type="range" class="am-wake-range"
                   min="0" :max="MAKS_MINUTTER" step="1" :value="vakenMin"
                   aria-label="Hold skjermen våken, minutter"
                   :aria-valuetext="vakenTekst"
                   @input="holdVaken.settMinutter($event.target.valueAsNumber)" />
          </div>
        </div>

        <!-- Eksterne lenker (v7.8.13). Se useEksterneLenker for hvorfor AV er
             standard: en `_blank`-åpning fra en installert PWA legger seg i et
             minimalt nettleser-lag oppå appen, og URL-stripa blir stående nede
             i hjørnet etterpå. Etiketten sier hva PÅ gjør, ikke hva bryteren
             heter — det er handlingen man velger. -->
        <div class="am-block am-block-wide">
          <div class="am-eyebrow">Eksterne lenker</div>
          <label class="am-bryter-rad">
            <span class="am-bryter-tekst">Åpne i ny nettleser</span>
            <button type="button" role="switch" class="am-bryter"
                    :class="{ 'is-on': nyFane }" :aria-checked="nyFane"
                    @click="settNyFane(!nyFane)">
              <span class="am-bryter-knott" />
            </button>
          </label>
        </div>

        <!-- Dempet bunn under skillelinja. -->
        <div class="am-foot">
          <button type="button" class="am-line am-line-dim" @click="openSheet('om')">
            <span class="am-line-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11.5v5m0-8h.01" />
              </svg>
            </span>Om appen
          </button>
          <VersjonSjekk class="am-version" />
        </div>
      </div>
    </aside>
  </Transition>

  <!-- Menyens «sider» ligger OPPÅ menyen (eget lag over z-201), så ESC eller X
       tar deg tilbake til menyen slik du forlot den. -->
  <AppModal :open="sheet === 'kart' || sheet === 'rute'"
            :title="sheet === 'rute' ? 'Mine ruter' : 'Mine kart'" @close="sheet = null">
    <div class="px-4 py-4">
      <MapLibrary :tab="sheet === 'rute' ? 'rute' : 'kart'" :show-install="false"
                  :show-tabs="false" :bygg-fra="byggFraPos"
                  @open-picker="apnePicker"
                  @navigert="sheet = null" />
    </div>
  </AppModal>
  <AppModal :open="sheet === 'nytt'" title="Nytt turkart" @close="sheet = null">
    <MapPickerContent />
  </AppModal>
  <AppModal :open="sheet === 'om'" title="Om Lende" @close="sheet = null">
    <div class="px-4 py-5"><AboutContent /></div>
  </AppModal>
</template>

<style scoped>
/* Menyens egen palett fra design-handoffen — varmere enn appens øvrige chrome,
   og bevisst det: skuffen er en egen flate, og det olivenaktige mørket ligger
   nærmere kartets kremtoner. Aksenten brukes KUN til aktivt segment,
   primær-ikoner og «+»-knappene. */
.app-menu {
  --am-bg: #151714;
  --am-surface: #22251f;
  --am-card: #1d201a;
  --am-ring: rgba(255, 255, 255, 0.07);
  --am-text: #eceade;
  --am-dim: #8d9182;
  --am-line: #2c3026;
  --am-accent: #1fd18a;
  --am-on-accent: #06210f;

  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 201;
  width: 88%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  background: var(--am-bg);
  color: var(--am-text);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.45);
  padding-top: env(safe-area-inset-top, 0px);
}
:root[data-theme="light"] .app-menu {
  --am-bg: #f6f4ea;
  --am-surface: #e6e3d5;
  --am-card: #fffdf5;
  --am-ring: rgba(0, 0, 0, 0.08);
  --am-text: #1a1d16;
  --am-dim: #6d7164;
  --am-line: #dcd8c8;
}

.app-menu button { font: inherit; border: 0; cursor: pointer; }

/* ── Header ── */
.am-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 18px 14px;
  flex: 0 0 auto;
}
/* PLASSHOLDEREN MÅ SKALERE MED KNAPPEN DEN HOLDER PLASS TIL (v7.8.31).
   Hamburgeren/X-en er `w-10 h-10` med `zoom: tekstskala`, altså 40 px ganger
   skalaen — 80 px ved 200 % — mens denne sto på faste 44 px. Differansen er
   hele kollisjonen: ved 150 % og oppover la den runde knappen seg oppå «Så i
   lende». Menyen setter selv `font-size: 16 px × skala` på rota si, så 2.75em
   ER 44 px ved 100 % og følger knappen resten av veien. */
.am-trigger-slot { width: 2.75em; height: 2.75em; flex: 0 0 auto; }
.am-title {
  font-size: 1.25em;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  /* Tittelen skal vike for plassholderen, ikke dytte den ut av boksen. */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Segmentbryter (tema) ──
   Modus-segmentet er borte fra v6.5.35; `.am-seg-modes`, `.am-seg-row` og
   `.am-seg-label` gikk med det. Igjen står tema-bryteren, som er den ENESTE
   segmentkontrollen i menyen nå — og det er poenget: et segment skal bety «to
   tilstander av det samme», ikke «to halvdeler av appen». */
.am-seg {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--am-surface);
  border-radius: 14px;
  flex: 0 0 auto;
}
.am-seg-btn {
  /* Like brede segmenter (flex-basis 0), men min-width 0 så teksten faktisk kan
     krympe: ved 150 % tekststørrelse er «Turplanlegger» bredere enn halve
     skuffen, og uten dette brøt den ut av kontrolleren. */
  flex: 1 1 0;
  min-width: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--am-dim);
  font-weight: 600;
  display: flex;
  align-items: center;
  transition: background 0.18s, color 0.18s;
}
.am-seg-btn.is-on { background: var(--am-accent); color: var(--am-on-accent); }
.am-seg-col {
  flex-direction: column;
  padding: 11px 4px;
  font-size: 0.85em;
  gap: 4px;
}

/* ── Rullefelt ── */
.am-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 18px);
}

/* ── «Installer som app» ──
   Menyens eneste gule flate. #ffd84a er appens egen aksent (hamburger-ringen,
   våken-sporet), og den er lys i BEGGE temaer — derfor er teksten hardkodet
   mørk her og ikke `var(--am-text)`, som ville blitt hvit-på-gult i mørkt tema.
   Den står utenfor `.am-primary` fordi den ikke er et sted man går, og lufta
   ned til «Mine kart» er derfor rullefeltets BLOKK-gap (22 px) og ikke
   `.am-primary`s rad-gap (10 px). Ingen egen marg her — to kilder til samme
   avstand kommer i utakt første gang noen rører den ene. */
.am-install {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 15px 16px;
  border-radius: 16px;
  background: #ffd84a;
  color: #1a1d16;
  text-align: left;
}
.am-install:active { transform: scale(0.985); }
.am-install-icon { display: grid; place-items: center; flex: 0 0 auto; }
.am-install-tekst { display: flex; flex-direction: column; min-width: 0; }
.am-install-tittel { font-size: 1.05em; font-weight: 600; }
.am-install-meta { font-size: 0.78em; color: rgba(26, 29, 22, 0.72); }

/* ── Nivå 1: primærkort ── */
/* Kunngjøring. Aksentkant til venstre og ingen bilde — den skal leses på ett
   blikk og så være ferdig. */

.am-primary { display: flex; flex-direction: column; gap: 10px; }
.am-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: transparent;
}
.am-row.is-card { background: var(--am-card); box-shadow: inset 0 0 0 1px var(--am-ring); }
.am-row-icon {
  width: 26px;
  display: grid;
  place-items: center;
  color: var(--am-accent);
  flex: 0 0 auto;
}
.am-row-main {
  flex: 1;
  min-width: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.am-row-main:active { opacity: 0.7; }
.am-row-title { font-size: 1.05em; font-weight: 600; }
.am-row-meta { font-size: 0.78em; color: var(--am-dim); }
/* LIGGENDE: META-LINJENE ER BORTE (v7.8.31). Menyen har alle valgene sine i
   behold — det var bestillingen — men «11 lagrede · sist Galdhøpiggen, Lom i
   dag» er tre linjer ved 200 % tekst, og på en 411 px høy skjerm er det tre
   linjer som dytter en knapp ut av rullefeltet. Tittelen sier hva raden gjør;
   meta-linja sier hvor mye som ligger der, og det tallet står uansett inne i
   arket raden åpner. */
:root[data-liggende] .am-row-meta:not(.is-svar) { display: none; }
.am-add {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--am-accent);
  color: var(--am-on-accent);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}
.am-add:active { transform: scale(0.92); }

/* ── Nivå 2: kontekst-rader ── */
.am-block { display: flex; flex-direction: column; gap: 4px; }
.am-block-wide { gap: 12px; }
.am-eyebrow {
  font-size: 0.72em;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--am-dim);
  padding: 0 4px 6px;
}
.am-block-wide .am-eyebrow { padding-bottom: 0; }
.am-line {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 4px;
  background: transparent;
  color: var(--am-text);
  font-size: 1em;
  text-align: left;
}
.am-line:active { opacity: 0.7; }
.am-line-icon { width: 26px; display: grid; place-items: center; color: var(--am-dim); flex: 0 0 auto; }
.am-line-dim { color: var(--am-dim); font-size: 0.92em; padding: 12px 4px; }

/* ── Tekststørrelse ── */

/* Etiketten står på sin egen linje og knappene fyller bredden under (v6.5.32).
   Med tre valg på 52 px lå raden allerede på grensen i en 360 px skuff — med et
   fjerde ville den rent over, og skuffens egen rot-font vokser dessuten MED
   valget, så etiketten blir bredere jo større valget er. `flex: 1` på knappene
   deler bredden likt uansett hvor mange hakk lista får. */
.am-size-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 2px 4px; }
.am-size-slider { flex: 1 1 100%; display: flex; flex-direction: column; gap: 2px; }
.am-size-range {
  width: 100%;
  height: 28px;
  background: transparent;
  accent-color: var(--am-accent);
  cursor: pointer;
}
.am-size-range:focus-visible { outline: 2px solid var(--am-accent); outline-offset: 2px; }
/* Tallet vokser med valget, så prosenten er et eksempel på seg selv.
   `tabular-nums` holder sporet i ro mens man drar — uten den hopper linja
   hver gang sifferbredden endrer seg.

   PLASSEN ER RESERVERT FOR DEN STØRSTE PROSENTEN, og det er det som gjør at
   tallet kan følge fingeren uten at noe flytter seg: høyden står på PLASSEN,
   som har menyens egen rot-font, mens tallet inni bærer den valgte størrelsen.
   En min-height på tallet selv ville vært em av dets EGEN font — altså vokst
   med det, og dyttet slideren nedover under draget. */
.am-size-verdi-plass {
  min-height: 2.2em;
  display: flex;
  align-items: flex-end;
}
.am-size-verdi {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--am-accent);
  line-height: 1.2;
}

/* ── Dempet bunn ── */
.am-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--am-line);
  padding-top: 12px;
}
.am-version { font-size: 0.75em; color: var(--am-dim); padding: 4px 4px 0; }

.menu-fade-enter-active, .menu-fade-leave-active { transition: opacity 0.25s ease; }
.menu-fade-enter-from, .menu-fade-leave-to { opacity: 0; }

.menu-slide-enter-active, .menu-slide-leave-active { transition: transform 0.28s ease; }
.menu-slide-enter-from, .menu-slide-leave-to { transform: translateX(-100%); }

/* ── Bryter (eksterne lenker) ──
   Samme form som vippebryterne i skuffene — grønn flate på, grå av, en hvit
   knott som glir — men i menyens egen palett og i em, så den følger
   tekststørrelsen som alt annet her. */
.am-bryter-rad {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 2px 4px;
  cursor: pointer;
  user-select: none;
}
.am-bryter-tekst {
  /* ETIKETTEN FÅR HELE RADEN OG BRYTER ALDRI (v7.8.31). Den sto som et
     krympbart flex-element ved siden av en bryter med fast bredde, så ved
     200 % tekst delte «Åpne i ny nettleser» seg på to linjer mens det var
     god plass på linja under. `flex: 1 0 auto` lar den beholde sin egen
     bredde; da er det BRYTEREN som ikke får plass, og med `flex-wrap` på
     raden legger den seg pent under i stedet. */
  flex: 1 0 auto;
  white-space: nowrap;
  font-size: 0.95em;
}
.am-bryter {
  position: relative;
  flex: 0 0 auto;
  margin-left: auto;
  width: 2.6em;
  height: 1.5em;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.15s ease;
}
.am-bryter.is-on { background: var(--am-accent); }
.am-bryter-knott {
  position: absolute;
  top: 0.15em;
  left: 0.15em;
  width: 1.2em;
  height: 1.2em;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: left 0.15s ease;
}
.am-bryter.is-on .am-bryter-knott { left: 1.25em; }
.am-bryter:focus-visible { outline: 2px solid var(--am-accent); outline-offset: 2px; }

/* ── Hold skjermen våken ──
   Sporet er gult (samme #ffd84a som ringen rundt hamburgeren og FAB-ens
   hold-ring), så sliderens fylte del og ringen leses som samme funksjon. */
.am-wake { display: flex; flex-direction: column; gap: 4px; }
.am-wake-range {
  width: 100%;
  height: 28px;
  background: transparent;
  accent-color: #ffd84a;
  cursor: pointer;
}
.am-wake-meta {
  font-size: 0.8em;
  font-variant-numeric: tabular-nums;
  color: var(--am-dim);
  white-space: nowrap;
}
.am-wake-meta.is-on { color: #ffd84a; font-weight: 600; }
</style>

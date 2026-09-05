<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppMenu } from '../composables/useAppMenu.js'
import { useMapContext } from '../composables/useMapContext.js'
import { useUiTextScale, UI_TEXT_SCALES } from '../composables/useUiTextScale.js'
import { useUiTheme } from '../composables/useUiTheme.js'
import { useMapTheme } from '../composables/useMapTheme.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
import { useLendeChat } from '../composables/useLendeChat.js'
import { hasAiToken } from '../lib/lendeAi.js'
import { gmapsUrl, streetViewUrl, buildVegkartUrl } from '../lib/externalMapLinks.js'
import { buildUtNoUrl } from '../lib/utNoLink.js'
import { listMaps, listGravelRoutes } from '../lib/mapStorage.js'
import { mapsSummary, routesSummary } from '../lib/menuSummary.js'
import AppModal from './AppModal.vue'
import AboutContent from './AboutContent.vue'
import LegendContent from './LegendContent.vue'
import MapLibrary from './MapLibrary.vue'
import MapPickerContent from './MapPickerContent.vue'
import { APP_VERSION } from '../version.js'
import { useFokusFelle } from '../composables/useFokusFelle.js'

// Global hovedmeny — slide-in fra venstre. Montert én gang i App.vue og styrt av
// den delte useAppMenu-tilstanden, så meny-knappen i enhver visning åpner denne.
// Lukkes på valg, backdrop-klikk, Escape og rute-endring.
//
// v2.4.13 — ryddet i tre nivåer etter design-handoff:
//   1. primærvalgene er kort med antall/undertekst, kontekst og visning er rader
//   2. Om appen + versjon er dempet under en skillelinje
// Modus-segmentet som lå øverst er fjernet i v6.5.35 — se «Modus» under.
// Tekststørrelsen er fire samtidige valg (100/125/150/200) som skalerer menyen live:
// rot-fonten er 16 px × faktor, og alt innhold er i em.

const { menuOpen, close } = useAppMenu()
const { hasMapContext, getPoint, placeName } = useMapContext()
const { uiTextScale, setTextScale } = useUiTextScale()
const { theme, setTheme } = useUiTheme()
// Snarvei til kartets mørke tema — samme tilstand som «Mørk» under
// Innstillinger → Tema. Av som default (ISOM-paletten kartene er tegnet for).
const { isDarkMap, setDarkMap } = useMapTheme()
const { openChat } = useLendeChat()

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
// Lende-chat fra menyen (v4.8.2): samme invitasjons-gate som FAB-en, så
// uinviterte ser ikke at funksjonen finnes.
const harChat = hasAiToken()
function onAskLende() {
  close()
  openChat()
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
    d: 'M6.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-11-4v-3m0 3a3 3 0 0 0 3 3h5a3 3 0 0 1 3 3',
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

// ── Fritt lende ──────────────────────────────────────────────────────────────
// Egen rad SIST i am-primary, ikke et tredje segment i modus-bryteren: den er
// appens to HALVDELER, og CSS-kommentaren lenger nede sier at «Turplanlegger»
// alt er bredere enn halve skuffen ved 150 % tekst. Tre segmenter får ikke
// plass. Raden har heller ingen «+»-knapp og ingen meta-tall — Fritt lende har
// verken bibliotek eller antall, og ville løyet om sin egen form som et
// primærkort.
//
// Fast plass, som de to over (v6.5.35): raden var gatet på modus `kart`, med
// begrunnelsen at en Turkart-variant er støy i Turplanleggeren. Da rekkefølgen
// ble fast, ble den gaten det samme problemet i mindre — en rad som er borte
// halve tida er en rad man ikke kan lære hvor er.
const iFrittLende = computed(() => route.name === 'fritt-lende')

// «Kun mobil» er en PRODUKTBESLUTNING, ikke en runtime-sjekk. Raden er derfor
// synlig overalt — en desktop-bruker som åpner den får et fungerende kart, og
// modusen forblir prøvbar og testbar. Forklaringen står i underteksten.
function goFrittLende() {
  close()
  // Modalen ryddes HER og ikke bare av rute-watchen under: står du allerede i
  // Fritt lende, er navigasjonen en no-op og `route.fullPath` endrer seg aldri.
  // Snarveien i «Mine kart» ender i denne funksjonen, og uten dette ble panelet
  // stående oppå arket (v6.5.33).
  sheet.value = null
  // replace og ikke push: ellers lander nettleserens tilbake-knapp i det
  // vanlige kartet, altså en modus-veksling uten om hovedmenyen — som er
  // nettopp det som ikke skal være mulig. En modus-bryter er ikke en
  // drill-down. IKKE «rett» dette til push.
  router.replace({ name: 'fritt-lende' })
}

// ── Hjelp ────────────────────────────────────────────────────────────────────
// Ledeteksten er FAST (v6.5.35). Den sa «På kartet» / «Ruteplanlegging» etter
// hvilken modus du sto i, altså hvor du var — men de to radene under er
// Tegnforklaring og Spør Lende, og de er hjelp i begge halvdeler. En overskrift
// som skifter uten at innholdet gjør det, får leseren til å tro at innholdet
// gjorde det.
const HJELP_LEDETEKST = 'Hjelp i lende'

// Eksterne karttjenester på synlig kartsenter — kun når en kartvisning har
// registrert en punkt-provider (useMapContext), dvs. brukeren er inne i et kart.
// Hele blokken er borte ellers, så menyen slipper å scrolle i det hele tatt.
const SHORTCUTS = [
  { key: 'gmaps', label: 'Google Maps', url: (p) => gmapsUrl(p.lat, p.lon) },
  { key: 'streetview', label: 'Street View', url: (p) => streetViewUrl(p.lat, p.lon) },
  { key: 'utno', label: 'UT.no', url: (p) => buildUtNoUrl(p) },
  { key: 'vegkart', label: 'Vegkart', url: (p) => buildVegkartUrl(p) },
]
function openShortcut(svc) {
  const p = getPoint()
  if (!p) return
  const url = svc.url(p)
  if (url) window.open(url, '_blank', 'noopener')
  close()
}

// ── Visning ──────────────────────────────────────────────────────────────────
const THEMES = [
  { value: 'lyst', label: 'Lyst',
    d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2.5v2m0 15v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2.5 12h2m15 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
  { value: 'mørkt', label: 'Mørkt', d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z' },
  { value: 'auto', label: 'Auto', d: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z' },
]
// Hvert valg rendres i SIN EGEN størrelse så valget er lesbart som seg selv.
// Utledet fra UI_TEXT_SCALES, som er den ene lista setTextScale godtar — en
// hardkodet kopi her ville stilltiende sluttet å virke om lista endres.
const TEXT_SIZE_PX = { 1: 11, 1.25: 13, 1.5: 15, 2: 18 }
const TEXT_SIZES = UI_TEXT_SCALES.map((s) => ({
  scale: s, label: `${Math.round(s * 100)} %`, px: TEXT_SIZE_PX[s] ?? 13,
}))
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
    alert('Slik installerer du «Så i lende» på iPhone/iPad:\n\n1. Trykk Del-ikonet nederst i Safari.\n2. Velg «Legg til på Hjem-skjerm».')
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
const sheet = ref(null)   // 'kart' | 'rute' | 'nytt' | 'tegnforklaring' | 'om' | null

// «Nytt kart»-skjemaet har to innganger — menyens «+» og «Flere valg».
// v6.5.45: den tredje er borte. Søkefeltets grønne pin bygger nå kartet der den
// står, så flagget som ba dette skjemaet hente posisjonen hadde ingen avsender
// igjen.
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
// `MapLibrary` melder derfor navigasjonen sin selv (`@navigert`), og Fritt
// lende-snarveien rydder i `goFrittLende`. Watchen er nettet under dem — den
// fanger tilbake-knappen og navigasjon utenfra.
watch(() => route.fullPath, () => {
  sheet.value = null
  if (menuOpen.value) close()
})

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
        <div class="am-title">Så i lende</div>
      </div>

      <div class="am-scroll">
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

          <!-- Fritt lende: tredje LIKEVERDIGE rad (v6.5.35), med samme pil som
               de to over. Den sto med full bredde og uten knapp for å leses som
               noe annet enn bibliotek-radene — men den er ikke noe annet i
               menyen: den er appens tredje inngang, og en rad uten den grønne
               pila leses som en overskrift framfor et sted å gå. Den har
               fortsatt ingen meta-TALL, for modusen har verken bibliotek eller
               antall; underteksten sier hva den er i stedet. -->
          <div class="am-row" :class="{ 'is-card': iFrittLende }">
            <span class="am-row-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M14.5 9.5l-2 5-5 2 2-5 5-2Z" />
              </svg>
            </span>
            <button type="button" class="am-row-main" @click="goFrittLende">
              <span class="am-row-title">Fritt lende</span>
              <span class="am-row-meta">Ett kart, én knapp · krever nett · laget for mobil</span>
            </button>
            <button type="button" class="am-add" aria-label="Gå til Fritt lende"
                    @click="goFrittLende">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h13m-5.5-6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Nivå 2: hjelp — gjelder begge halvdeler av appen. -->
        <div class="am-block">
          <div class="am-eyebrow">{{ HJELP_LEDETEKST }}</div>
          <button type="button" class="am-line" @click="openSheet('tegnforklaring')">
            <span class="am-line-icon">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
            </span>Tegnforklaring
          </button>

          <!-- Spør Lende (v4.8.2): chatten nås ellers bare med lang-trykk på
               Lende-knappen — en gest uten tastatur-ekvivalent, og den ruten en
               skjermleser-bruker faktisk finner. Samme token-gate som FAB-en,
               så uinviterte ser ingenting. -->
          <button v-if="harChat" type="button" class="am-line" @click="onAskLende">
            <span class="am-line-icon">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" />
              </svg>
            </span>Spør Lende
          </button>

          <!-- Snarveier til eksterne kart — kun når et kart er åpent. -->
          <div v-if="hasMapContext" class="am-chips-wrap">
            <div class="am-chips-label">
              Åpne <strong v-if="placeName">{{ placeName }}</strong><template v-else>stedet</template> i
            </div>
            <div class="am-chips">
              <button v-for="s in SHORTCUTS" :key="s.key" type="button" class="am-chip"
                      @click="openShortcut(s)">
                {{ s.label }}
                <span class="am-chip-ext">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                       stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 4h6v6M20 4l-7.5 7.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Visning: tema + tekststørrelse. -->
        <div class="am-block am-block-wide">
          <div class="am-eyebrow">Visning</div>
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
          <!-- Snarvei til kartets mørke tema. Styrer samme tilstand som
               Tema-fanen i Innstillinger; de tre knappene over gjelder appens
               chrome, denne gjelder kartflaten. -->
          <label class="am-switch-row">
            <span class="am-switch-label">Turkart i mørkt tema</span>
            <input type="checkbox" class="am-switch" role="switch"
                   :checked="isDarkMap" @change="setDarkMap($event.target.checked)" />
          </label>
          <div class="am-size-row">
            <span class="am-size-label">Tekststørrelse</span>
            <div class="am-sizes" role="group" aria-label="Tekststørrelse">
              <button v-for="z in TEXT_SIZES" :key="z.scale" type="button"
                      class="am-size-btn" :class="{ 'is-on': uiTextScale === z.scale }"
                      :style="{ fontSize: z.px + 'px' }"
                      :aria-pressed="uiTextScale === z.scale" @click="setTextScale(z.scale)">
                {{ z.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Dempet bunn under skillelinja. -->
        <div class="am-foot">
          <button v-if="showInstall" type="button" class="am-line am-line-dim" @click="onInstall">
            <span class="am-line-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3.5v12M7.5 11 12 15.5 16.5 11M5 19.5h14" />
              </svg>
            </span>Installer som app
          </button>
          <button type="button" class="am-line am-line-dim" @click="openSheet('om')">
            <span class="am-line-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11.5v5m0-8h.01" />
              </svg>
            </span>Om appen
          </button>
          <div class="am-version">Versjon {{ APP_VERSION }}</div>
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
                  :show-tabs="false"
                  @open-picker="apnePicker" @fritt-lende="goFrittLende"
                  @navigert="sheet = null" />
    </div>
  </AppModal>
  <AppModal :open="sheet === 'nytt'" title="Nytt turkart" @close="sheet = null">
    <MapPickerContent />
  </AppModal>
  <AppModal :open="sheet === 'om'" title="Om Så i lende" @close="sheet = null">
    <div class="px-4 py-5"><AboutContent /></div>
  </AppModal>
  <AppModal :open="sheet === 'tegnforklaring'" title="Tegnforklaring"
            @close="sheet = null">
    <LegendContent />
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
.am-trigger-slot { width: 44px; height: 44px; flex: 0 0 auto; }
.am-title { font-size: 1.25em; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }

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

/* ── Snarvei-chips ── */
.am-chips-wrap { display: flex; flex-direction: column; gap: 8px; padding: 6px 0 2px; }
.am-chips-label { font-size: 0.8em; color: var(--am-dim); padding: 0 4px; }
.am-chips-label strong { color: var(--am-text); font-weight: 600; }
.am-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.am-chip {
  background: var(--am-surface);
  color: var(--am-text);
  font-size: 0.82em;
  padding: 10px 13px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  min-height: 44px;
}
.am-chip:active { transform: scale(0.96); }
.am-chip-ext { color: var(--am-dim); display: grid; place-items: center; }

/* ── Tekststørrelse ── */
/* Bryter-rad: samme rytme som tekststørrelse-raden under. `appearance: none`
   + egen bakgrunn/knott, så bryteren følger meny-tokenene i begge UI-temaer i
   stedet for nettleserens systemfarge. Hele raden er en <label>, altså er
   teksten også trykkflate. */
.am-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
  min-height: 44px;
  cursor: pointer;
}
.am-switch-label { font-size: 0.95em; flex: 1; }
.am-switch {
  appearance: none;
  -webkit-appearance: none;
  flex: 0 0 auto;
  width: 46px;
  height: 28px;
  border-radius: 999px;
  background: var(--am-surface);
  position: relative;
  transition: background 0.18s;
  cursor: pointer;
}
.am-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--am-dim);
  transition: transform 0.18s, background 0.18s;
}
.am-switch:checked { background: var(--am-accent); }
.am-switch:checked::after { transform: translateX(18px); background: var(--am-on-accent); }
.am-switch:focus-visible { outline: 2px solid var(--am-accent); outline-offset: 2px; }

/* Etiketten står på sin egen linje og knappene fyller bredden under (v6.5.32).
   Med tre valg på 52 px lå raden allerede på grensen i en 360 px skuff — med et
   fjerde ville den rent over, og skuffens egen rot-font vokser dessuten MED
   valget, så etiketten blir bredere jo større valget er. `flex: 1` på knappene
   deler bredden likt uansett hvor mange hakk lista får. */
.am-size-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 2px 4px; }
.am-size-label { font-size: 0.95em; flex: 1 1 auto; }
.am-sizes {
  display: flex;
  flex: 1 1 100%;
  gap: 4px;
  padding: 4px;
  background: var(--am-surface);
  border-radius: 12px;
}
.am-size-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  border-radius: 9px;
  background: transparent;
  color: var(--am-dim);
  font-weight: 600;
  transition: background 0.18s, color 0.18s;
}
.am-size-btn.is-on { background: var(--am-accent); color: var(--am-on-accent); }

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
</style>

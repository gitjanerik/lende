<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppMenu } from '../composables/useAppMenu.js'
import { useMapContext } from '../composables/useMapContext.js'
import { useUiTextScale, UI_TEXT_SCALES } from '../composables/useUiTextScale.js'
import { useUiTheme } from '../composables/useUiTheme.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
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

// Global hovedmeny — slide-in fra venstre. Montert én gang i App.vue og styrt av
// den delte useAppMenu-tilstanden, så meny-knappen i enhver visning åpner denne.
// Lukkes på valg, backdrop-klikk, Escape og rute-endring.
//
// v2.4.13 — ryddet i tre nivåer etter design-handoff:
//   1. modus-segmentbryter øverst (Turkart / Turplanlegger) — appens to halvdeler
//      er ikke et menyvalg midt i en liste, og innholdet under følger modusen
//   2. primærvalgene er kort med antall/undertekst, kontekst og visning er rader
//   3. Om appen + versjon er dempet under en skillelinje
// Tekststørrelsen er tre samtidige valg (100/125/150) som skalerer menyen live:
// rot-fonten er 16 px × faktor, og alt innhold er i em.

const { menuOpen, close } = useAppMenu()
const { hasMapContext, getPoint, placeName } = useMapContext()
const { uiTextScale, setTextScale } = useUiTextScale()
const { theme, setTheme } = useUiTheme()

const route = useRoute()
const router = useRouter()

// ── Modus ────────────────────────────────────────────────────────────────────
// Modusen LESES av appens tilstand (hvilken rute/fane vi står i) i stedet for å
// være en egen preferanse — bryteren viser da alltid hvor du faktisk er.
const mode = computed(() =>
  (route.name === 'ruteplanlegger' || route.query.tab === 'rute') ? 'plan' : 'kart')

const MODES = [
  { id: 'kart', label: 'Turkart', to: '/', last: 'kart',
    d: 'M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Zm0 0v13m6-10v13' },
  { id: 'plan', label: 'Turplanlegger', to: '/rute', last: 'rute',
    d: 'M6.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-11-4v-3m0 3a3 3 0 0 0 3 3h5a3 3 0 0 1 3 3' },
]

function go(to, last) {
  close()
  if (last) { try { localStorage.setItem('lende-last-mode', last) } catch { /* ignorer */ } }
  router.push(to)
}
// Å trykke på modusen du alt står i skal ikke kaste deg ut av et åpent kart.
function pickMode(m) {
  if (mode.value === m.id) return
  go(m.to, m.last)
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

const PRIMARY = {
  kart: {
    id: 'kart', label: 'Mine kart', sheet: 'kart',
    addLabel: 'Nytt kart', addSheet: 'nytt',
    d: 'M4 8.5 12 4.5l8 4-8 4-8-4Zm0 5 8 4 8-4m-16 0',
  },
  plan: {
    id: 'plan', label: 'Mine ruter', sheet: 'rute',
    addTo: '/rute', addLabel: 'Ny rute', last: 'rute',
    d: 'M6.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-11-4v-3m0 3a3 3 0 0 0 3 3h5a3 3 0 0 1 3 3',
  },
}
// Rekkefølgen følger modusen: i Turkart ligger Mine kart først, i Turplanlegger
// ligger Mine ruter først. Den øverste raden er kortet.
const primaryRows = computed(() => {
  const order = mode.value === 'kart' ? ['kart', 'plan'] : ['plan', 'kart']
  return order.map((id) => ({
    ...PRIMARY[id],
    meta: id === 'kart' ? mapsSummary(maps.value) : routesSummary(routes.value),
  }))
})

// ── Kontekst ─────────────────────────────────────────────────────────────────
const contextEyebrow = computed(() => (mode.value === 'kart' ? 'På kartet' : 'Ruteplanlegging'))

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
const TEXT_SIZE_PX = { 1: 11, 1.25: 13, 1.5: 15 }
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
// øverst til venstre. Som modaler oppå den åpne menyen holder ESC eller X, og du
// lander der du var. Rutene består for deep-lenker (se AboutView/LegendView).
const sheet = ref(null)   // 'kart' | 'rute' | 'nytt' | 'tegnforklaring' | 'om' | null
watch(menuOpen, (open) => { if (!open) sheet.value = null })

// Lukk ved rute-endring (f.eks. maskinvare-tilbake) og på Escape.
watch(() => route.fullPath, () => { if (menuOpen.value) close() })

// Escape lukker ØVERSTE lag først. Håndteres her, ikke i AboutModal: to
// uavhengige lyttere ville lukket både modalen og menyen på samme tastetrykk.
function onKey(e) {
  if (e.key !== 'Escape') return
  if (sheet.value) sheet.value = null
  else if (menuOpen.value) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="menu-fade">
    <div v-if="menuOpen" class="fixed inset-0 z-[200] bg-black/50" @click="close" />
  </Transition>

  <Transition name="menu-slide">
    <aside v-if="menuOpen" class="app-menu" :style="{ fontSize: rootFontSize }"
           aria-label="Hovedmeny">
      <div class="am-head">
        <button type="button" class="am-close" @click="close" aria-label="Lukk meny">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div class="am-title">Så i lende</div>
      </div>

      <!-- Modus: appens to halvdeler, alltid synlig øverst. -->
      <div class="am-seg am-seg-modes" role="group" aria-label="Modus">
        <button v-for="m in MODES" :key="m.id" type="button"
                class="am-seg-btn am-seg-row" :class="{ 'is-on': mode === m.id }"
                :aria-pressed="mode === m.id" @click="pickMode(m)">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
               stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path :d="m.d" />
          </svg><span class="am-seg-label">{{ m.label }}</span>
        </button>
      </div>

      <div class="am-scroll">
        <!-- Nivå 1: primærvalgene. Øverste rad (aktiv modus) er kortet. -->
        <div class="am-primary">
          <div v-for="(p, i) in primaryRows" :key="p.id" class="am-row"
               :class="{ 'is-card': i === 0 }">
            <span class="am-row-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path :d="p.d" />
              </svg>
            </span>
            <button type="button" class="am-row-main" @click="sheet = p.sheet">
              <span class="am-row-title">{{ p.label }}</span>
              <span class="am-row-meta">{{ p.meta }}</span>
            </button>
            <button type="button" class="am-add" :aria-label="p.addLabel"
                    @click="p.addSheet ? (sheet = p.addSheet) : go(p.addTo, p.last)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5.5v13M5.5 12h13" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Nivå 2: kontekst for der du er. -->
        <div class="am-block">
          <div class="am-eyebrow">{{ contextEyebrow }}</div>
          <button type="button" class="am-line" @click="sheet = 'tegnforklaring'">
            <span class="am-line-icon">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
            </span>Tegnforklaring
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
          <button type="button" class="am-line am-line-dim" @click="sheet = 'om'">
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
  <AppModal :open="menuOpen && (sheet === 'kart' || sheet === 'rute')"
            :title="sheet === 'rute' ? 'Mine ruter' : 'Mine kart'" @close="sheet = null">
    <div class="px-4 py-4">
      <MapLibrary :tab="sheet === 'rute' ? 'rute' : 'kart'" :show-install="false" />
    </div>
  </AppModal>
  <AppModal :open="menuOpen && sheet === 'nytt'" title="Nytt turkart" @close="sheet = null">
    <MapPickerContent />
  </AppModal>
  <AppModal :open="menuOpen && sheet === 'om'" title="Om Så i lende" @close="sheet = null">
    <div class="px-4 py-5"><AboutContent /></div>
  </AppModal>
  <AppModal :open="menuOpen && sheet === 'tegnforklaring'" title="Tegnforklaring"
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
.am-close {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--am-surface);
  color: var(--am-text);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  transition: background 0.18s;
}
.am-close:active { transform: scale(0.94); }
.am-title { font-size: 1.25em; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }

/* ── Segmentbrytere (modus + tema) ── */
.am-seg {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--am-surface);
  border-radius: 14px;
  flex: 0 0 auto;
}
.am-seg-modes { margin: 0 18px 20px; }
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
.am-seg-row {
  padding: 12px 6px;
  font-size: 0.95em;
  justify-content: center;
  gap: 8px;
}
.am-seg-row svg { flex: 0 0 auto; }
.am-seg-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.am-size-row { display: flex; align-items: center; gap: 12px; padding: 2px 4px; }
.am-size-label { font-size: 0.95em; flex: 1; }
.am-sizes { display: flex; gap: 4px; padding: 4px; background: var(--am-surface); border-radius: 12px; }
.am-size-btn {
  min-width: 52px;
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

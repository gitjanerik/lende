import { ref, computed, watch } from 'vue'

// Global UI-tema (Utseende). Modulnivå-singleton (som useUiTextScale/useAppMenu):
// settes fra «Utseende»-knappene i hovedmenyen. Tre modus — lyst / mørkt / auto —
// der «auto» følger OS-ets prefers-color-scheme. Preferansen lagres i
// localStorage; resolved tema («light»/«dark») settes som data-theme på
// <html>, og alle UI-token-fargene (se style.css @theme + :root[data-theme])
// følger. Default = mørkt (dagens utseende). Kartet (.isom-map) er uavhengig —
// UI-temaet styrer bare chrome.

const STORAGE_KEY = 'lende-ui-theme'
export const UI_THEME_OPTIONS = [
  { value: 'lyst', label: 'Lyst' },
  { value: 'mørkt', label: 'Mørkt' },
  { value: 'auto', label: 'Automatisk' },
]
const VALID = new Set(UI_THEME_OPTIONS.map((o) => o.value))

// App-bakgrunnen pr resolved tema — holdes i sync med style.css --color-app.
// Brukes til <meta name="theme-color"> så mobil-status-baren matcher.
//
// DEN ER EN FALLBACK FRA v7.9.9, IKKE FASITEN. Systemets aksentfarge toner
// --color-app (se style.css + lib/systemAksent.js), og et hardkodet hex ville
// da gitt en status-bar i en annen farge enn appen under den. Vi LESER derfor
// den malte bakgrunnen når stilarket er på plass, og faller tilbake hit når det
// ikke er det (første kjøring før CSS-en er lastet i dev).
const APP_BG = { light: '#efeae0', dark: '#0e1116' }

function load() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return VALID.has(v) ? v : 'mørkt'
  } catch { return 'mørkt' }
}

function prefersDark() {
  return typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(pref) {
  if (pref === 'lyst') return 'light'
  if (pref === 'mørkt') return 'dark'
  return prefersDark() ? 'dark' : 'light'   // auto
}

const theme = ref(load())
const resolved = computed(() => resolve(theme.value))

// Den malte bakgrunnen → #rrggbb. Veien om et lerret er ikke omstendelig for
// omstendelighetens skyld: er flata tonet av systemaksenten, serialiserer
// `getComputedStyle().backgroundColor` den i sitt EGET fargerom —
// `oklch(0.1767 0.028 255.5)` og ikke `rgb(…)` — og `<meta name="theme-color">`
// leses av operativsystemets status-bar, ikke av CSS-motoren. Lerretet maler
// fargen og vi leser pikselen, altså nøyaktig det brukeren ser.
function malt(farge) {
  try {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = '#000000'
    ctx.fillStyle = farge
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    if (!d[3]) return ''
    return `#${[d[0], d[1], d[2]].map((x) => x.toString(16).padStart(2, '0')).join('')}`
  } catch { return '' }
}

function apply(name) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = name

  // Anti-flash-scriptet i index.html setter en LITERAL bakgrunn som inline-stil
  // på <html>, fordi det kjører før stilarket finnes. Den må vike her: en
  // inline-stil slår `html { background: var(--color-app) }`, og systemtonen
  // ville aldri blitt malt. Vi rører den bare når stilarket FAKTISK er på plass
  // (tokenet er lesbart) — ellers ville vi fjernet anti-flashen og fått den
  // hvite blinken den finnes for å hindre.
  const stil = getComputedStyle(root)
  const klart = !!stil.getPropertyValue('--color-app').trim()
  if (klart && root.style.background) root.style.background = ''

  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  const hex = klart ? malt(stil.backgroundColor) : ''
  meta.setAttribute('content', hex || APP_BG[name] || APP_BG.dark)
}

// Følg OS-endringer mens «auto» er valgt.
let mqBound = false
function bindSystemListener() {
  if (mqBound || typeof matchMedia === 'undefined') return
  mqBound = true
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => { if (theme.value === 'auto') apply(resolve('auto')) }
  mq.addEventListener?.('change', onChange)
}

watch(theme, (v) => {
  try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ignorer */ }
  apply(resolve(v))
})

// Anti-flash-scriptet i index.html setter data-theme før paint; her holder vi
// den i sync og fanger første kjøring i miljøer uten det scriptet.
apply(resolved.value)
bindSystemListener()

export function useUiTheme() {
  function setTheme(v) { if (VALID.has(v)) theme.value = v }
  return { theme, resolved, options: UI_THEME_OPTIONS, setTheme }
}

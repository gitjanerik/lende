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

function apply(name) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = name
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', APP_BG[name] ?? APP_BG.dark)
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

import { ref, computed, watch } from 'vue'

// Kart-temaet (turkartets farger — ISOM-paletten i `.isom-map`). Modulnivå-
// singleton som useUiTheme/useUiTextScale, slik at hovedmenyens snarvei og
// Tema-fanen i Innstillinger styrer SAMME tilstand: velger du «Mørk» under
// Innstillinger, står bryteren i menyen på, og omvendt.
//
// Ikke å forveksle med useUiTheme, som styrer appens chrome (menyer, skuffer,
// knapper). Dette er kartflaten. Default «light» = ISOM-paletten kartene er
// tegnet for.
//
// Nøkkelen valideres på FORM, ikke mot en kopi av tema-lista i isomCatalog:
// en hardkodet liste her ville stilltiende avvist nye temaer, og å importere
// hele katalogen bare for validering ville dratt den inn i meny-bundelen.

const STORAGE_KEY = 'lende-map-theme'
// v5.23.0: standarden er Turkart, ikke ISOM. Grunnen er lesbarhet — ISOM har
// omvendt vegetasjonslogikk av alle andre norske kart (hvit = løpbar skog,
// gul = åpen mark), og på et ark uten kartlagt vegetasjon leses det som én
// sammenhengende kremgul flate. ISOM-uttrykket lever videre i kartstilen
// «Orientering», som er der det hører hjemme.
//
// Merk at et lagret valg vinner: den som allerede har valgt et tema beholder
// det. Dette gjelder ferske installasjoner.
const DEFAULT_THEME = 'turkart'
const DARK_THEME = 'dark'
const KEY_SHAPE = /^[a-z0-9-]{1,32}$/

function load() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && KEY_SHAPE.test(v) ? v : DEFAULT_THEME
  } catch { return DEFAULT_THEME }
}

const mapTheme = ref(load())

watch(mapTheme, (v) => {
  try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ignorer */ }
})

export function useMapTheme() {
  const isDarkMap = computed(() => mapTheme.value === DARK_THEME)

  function setMapTheme(key) {
    if (typeof key === 'string' && KEY_SHAPE.test(key)) mapTheme.value = key
  }

  // Snarveien i hovedmenyen. Av slår tilbake til ISOM-lyst — også når brukeren
  // sto på et monokrom-tema (Sepia, Petrol …): bryteren er en to-tilstands
  // snarvei, og «av» betyr kartets standardpalett.
  function setDarkMap(on) {
    mapTheme.value = on ? DARK_THEME : DEFAULT_THEME
  }

  return { mapTheme, isDarkMap, setMapTheme, setDarkMap }
}

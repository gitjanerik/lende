import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

const KEY = 'lende-map-theme'

// Testene kjører i node-miljø (ingen jsdom i prosjektet), så localStorage
// stubbes i minnet — samme mønster som fetch-stubbene ellers i suiten.
function makeStorage(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
  }
}

// Modulnivå-singleton: hver test som skal se en ANNEN startverdi må laste
// modulen på nytt etter at localStorage er satt.
async function freshModule() {
  vi.resetModules()
  return (await import('./useMapTheme.js')).useMapTheme
}

beforeEach(() => { vi.stubGlobal('localStorage', makeStorage()) })
afterEach(() => { vi.unstubAllGlobals() })

describe('useMapTheme — kart-tema, delt og lagret', () => {
  // v5.23.0: standarden er Turkart, ikke ISOM. ISOM-uttrykket lever videre i
  // kartstilen «Orientering» — se kartStiler.js for hvorfor det ikke lenger
  // er grunnoppsettet.
  it('default er Turkart, altså mørk-bryteren AV', async () => {
    const useMapTheme = await freshModule()
    const { mapTheme, isDarkMap } = useMapTheme()
    expect(mapTheme.value).toBe('turkart')
    expect(isDarkMap.value).toBe(false)
  })

  it('setDarkMap(true) slår på mørkt kart og lagrer det', async () => {
    const useMapTheme = await freshModule()
    const { mapTheme, isDarkMap, setDarkMap } = useMapTheme()
    setDarkMap(true)
    expect(mapTheme.value).toBe('dark')
    expect(isDarkMap.value).toBe(true)
    await nextTick()   // watcheren som skriver til localStorage flushes på microtask
    expect(localStorage.getItem(KEY)).toBe('dark')
  })

  it('setDarkMap(false) går tilbake til standarden — også fra et monokrom-tema', async () => {
    const useMapTheme = await freshModule()
    const { mapTheme, setMapTheme, setDarkMap } = useMapTheme()
    setMapTheme('mono-sepia')
    expect(mapTheme.value).toBe('mono-sepia')
    setDarkMap(false)
    expect(mapTheme.value).toBe('turkart')
  })

  it('Tema-fanen og bryteren deler tilstand — «Mørk» slår bryteren på', async () => {
    const useMapTheme = await freshModule()
    const fane = useMapTheme()
    const meny = useMapTheme()
    fane.setMapTheme('dark')
    expect(meny.isDarkMap.value).toBe(true)
    meny.setDarkMap(false)
    expect(fane.mapTheme.value).toBe('turkart')
  })

  it('et monokrom-tema gir bryteren AV (den gjelder bare mørkt)', async () => {
    const useMapTheme = await freshModule()
    const { setMapTheme, isDarkMap } = useMapTheme()
    setMapTheme('mono-indigo')
    expect(isDarkMap.value).toBe(false)
  })

  it('lagret valg leses tilbake ved oppstart', async () => {
    vi.stubGlobal('localStorage', makeStorage({ [KEY]: 'dark' }))
    const useMapTheme = await freshModule()
    expect(useMapTheme().isDarkMap.value).toBe(true)
  })

  it('søppel i localStorage faller tilbake til standarden', async () => {
    vi.stubGlobal('localStorage', makeStorage({ [KEY]: '<script>' }))
    const useMapTheme = await freshModule()
    expect(useMapTheme().mapTheme.value).toBe('turkart')
  })

  // Et lagret valg vinner over den nye standarden: den som allerede har valgt
  // ISOM skal ikke våkne til et annet kart etter en oppdatering.
  it('lagret ISOM-valg overlever at standarden ble Turkart', async () => {
    vi.stubGlobal('localStorage', makeStorage({ [KEY]: 'light' }))
    const useMapTheme = await freshModule()
    expect(useMapTheme().mapTheme.value).toBe('light')
  })

  it('setMapTheme avviser ugyldige nøkler i stedet for å sette dem', async () => {
    const useMapTheme = await freshModule()
    const { mapTheme, setMapTheme } = useMapTheme()
    setMapTheme('dark')
    for (const bad of ['', null, undefined, 42, 'Mørk tema!', 'a'.repeat(33)]) setMapTheme(bad)
    expect(mapTheme.value).toBe('dark')
  })
})

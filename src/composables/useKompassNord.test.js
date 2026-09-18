import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Kjøremiljøet er node, så `localStorage` må stubbes — samme grep som
// useEksterneLenker.test.js. Modulen er en singleton, så hver test laster den
// på nytt for å se en annen startverdi.
let lager
async function frisk() {
  vi.resetModules()
  const m = await import('./useKompassNord.js')
  return m.useKompassNord()
}

describe('useKompassNord', () => {
  beforeEach(() => {
    lager = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (lager.has(k) ? lager.get(k) : null),
      setItem: (k, v) => lager.set(k, String(v)),
      removeItem: (k) => lager.delete(k),
      clear: () => lager.clear(),
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('er AV som standard — trykket vender arket mot nord og ingenting mer', async () => {
    const { zoomUt } = await frisk()
    expect(zoomUt.value).toBe(false)
  })

  it('leser et lagret ja', async () => {
    lager.set('lende-kompass-nord-zoom', '1')
    const { zoomUt } = await frisk()
    expect(zoomUt.value).toBe(true)
  })

  // Nøkkelen SLETTES i av-stillingen framfor å skrives som '0': et flagg som
  // ikke finnes er standarden, og da finnes den bare i én form.
  it('lagrer PÅ og fjerner nøkkelen igjen ved AV', async () => {
    const { settZoomUt } = await frisk()
    settZoomUt(true)
    await Promise.resolve()
    expect(lager.get('lende-kompass-nord-zoom')).toBe('1')
    settZoomUt(false)
    await Promise.resolve()
    expect(lager.has('lende-kompass-nord-zoom')).toBe(false)
  })

  it('tåler privat modus uten å kaste', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('nope') },
      setItem: () => { throw new Error('nope') },
      removeItem: () => { throw new Error('nope') },
    })
    const { zoomUt, settZoomUt } = await frisk()
    expect(zoomUt.value).toBe(false)
    expect(() => settZoomUt(true)).not.toThrow()
  })
})

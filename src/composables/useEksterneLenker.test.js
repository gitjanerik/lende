import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Kjøremiljøet er node, så `localStorage` må stubbes — samme grep som
// ventendeFliser.test.js. Modulen er dessuten en singleton, så hver test laster
// den på nytt for å se en annen startverdi.
let lager
async function frisk() {
  vi.resetModules()
  const m = await import('./useEksterneLenker.js')
  return m.useEksterneLenker()
}

describe('useEksterneLenker', () => {
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

  it('er AV som standard — samme fane etterlater ingen URL-stripe', async () => {
    const { nyFane, eksternTarget } = await frisk()
    expect(nyFane.value).toBe(false)
    expect(eksternTarget.value).toBe('_self')
  })

  it('leser et lagret ja og gir _blank', async () => {
    lager.set('lende-ekstern-ny-fane', '1')
    const { nyFane, eksternTarget } = await frisk()
    expect(nyFane.value).toBe(true)
    expect(eksternTarget.value).toBe('_blank')
  })

  it('persisterer valget begge veier', async () => {
    const { settNyFane } = await frisk()
    settNyFane(true)
    await Promise.resolve()
    expect(lager.get('lende-ekstern-ny-fane')).toBe('1')
    settNyFane(false)
    await Promise.resolve()
    expect(lager.get('lende-ekstern-ny-fane')).toBe('0')
  })

  it('apneEkstern følger bryteren, og en tom URL gjør ingenting', async () => {
    const { settNyFane, apneEkstern } = await frisk()
    const open = vi.fn()
    vi.stubGlobal('window', { open })

    // AV: samme fane, men fortsatt gjennom `window.open` — ETT avskjærings-
    // punkt, som er hele grunnen til at det ikke er `location.assign`.
    apneEkstern('https://ut.no/')
    expect(open).toHaveBeenCalledWith('https://ut.no/', '_self')

    settNyFane(true)
    apneEkstern('https://ut.no/')
    expect(open).toHaveBeenCalledWith('https://ut.no/', '_blank', 'noopener')

    apneEkstern('')
    apneEkstern(null)
    expect(open).toHaveBeenCalledTimes(2)
  })
})

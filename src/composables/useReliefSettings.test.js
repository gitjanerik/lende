import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

let lager
async function frisk() {
  vi.resetModules()
  const m = await import('./useReliefSettings.js')
  return m.useReliefSettings()
}

describe('useReliefSettings — relieff-stilen er global', () => {
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

  it('et valg på ett kart følger med til neste kart-id', async () => {
    const r = await frisk()
    r.setCurrentMap('a')
    r.reliefMode.value = 'mjuk'
    r.setCurrentMap('b')
    expect(r.reliefMode.value).toBe('mjuk')
    await nextTick()
    expect(lager.get('lende-relief-mode')).toBe('mjuk')
  })

  it('en gammel per-kart-stil overstyrer ikke, og ryddes ved neste valg', async () => {
    lager.set('lende-relief-mode', 'mjuk')
    lager.set('lende-relief-bymap', JSON.stringify({ a: { mode: 'vektor', enabled: false }, b: { mode: 'vektor' } }))
    const r = await frisk()
    r.setCurrentMap('a')
    expect(r.reliefMode.value).toBe('mjuk')
    expect(r.reliefEnabled.value).toBe(false)
    r.reliefMode.value = 'mjuk'
    expect(JSON.parse(lager.get('lende-relief-bymap'))).toEqual({ a: { enabled: false } })
  })

  it('av/på er fortsatt per kart', async () => {
    const r = await frisk()
    r.setCurrentMap('a')
    r.reliefEnabled.value = false
    r.setCurrentMap('b')
    expect(r.reliefEnabled.value).toBe(true)
  })
})

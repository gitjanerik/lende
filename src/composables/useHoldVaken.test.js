import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Statisk import med vilje: modulen drar inn vue, og vue leser `document` ved
// lasting. Lastes den etter at testen har stubbet document, krasjer vue på et
// stub-objekt uten createElement.
import { useHoldVaken } from './useHoldVaken.js'

// Wake Lock-API-et må stå på plass FØR modulen tas i bruk: `useHoldVaken` lager
// låsen lat, og `supported` leses av navigator i det øyeblikket. Singletonen
// lever på tvers av testene i fila, så hver test slår av til slutt.
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

let requestSpy
let releaseSpy

beforeEach(() => {
  vi.useFakeTimers()
  releaseSpy = vi.fn(() => Promise.resolve())
  requestSpy = vi.fn(() => Promise.resolve({ release: releaseSpy, addEventListener: vi.fn() }))
  vi.stubGlobal('navigator', { wakeLock: { request: requestSpy } })
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

afterEach(() => {
  useHoldVaken().stopp()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useHoldVaken', () => {
  it('starter avslått', () => {
    const v = useHoldVaken()
    expect(v.aktiv.value).toBe(false)
    expect(v.igjenMinutter.value).toBe(0)
    expect(v.andel.value).toBe(0)
  })

  it('tar wake-locken og teller ned til null', async () => {
    const v = useHoldVaken()
    expect(v.settMinutter(2)).toBe(2)
    await flush()
    expect(requestSpy).toHaveBeenCalledWith('screen')
    expect(v.aktiv.value).toBe(true)
    expect(v.igjenMinutter.value).toBe(2)
    expect(v.andel.value).toBe(1)

    vi.advanceTimersByTime(60_000)
    expect(v.igjenMinutter.value).toBe(1)
    expect(v.andel.value).toBeCloseTo(0.5, 3)

    vi.advanceTimersByTime(60_000)
    await flush()
    expect(v.aktiv.value).toBe(false)
    expect(v.valgteMinutter.value).toBe(0)
    expect(releaseSpy).toHaveBeenCalled()
  })

  it('et nytt tall starter nedtellingen på nytt', () => {
    const v = useHoldVaken()
    v.settMinutter(10)
    vi.advanceTimersByTime(5 * 60_000)
    expect(v.igjenMinutter.value).toBe(5)
    v.settMinutter(10)
    expect(v.igjenMinutter.value).toBe(10)
  })

  it('0 slår av og slipper locken', async () => {
    const v = useHoldVaken()
    v.settMinutter(30)
    await flush()
    expect(v.settMinutter(0)).toBe(0)
    await flush()
    expect(v.aktiv.value).toBe(false)
    expect(releaseSpy).toHaveBeenCalled()
  })

  it('klemmer til maks en time', () => {
    const v = useHoldVaken()
    expect(v.settMinutter(180)).toBe(60)
  })
})

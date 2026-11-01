import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchOverpass, overpassTimeoutForBbox } from './mapBuilder.js'

const bbox = { south: 59, north: 59.01, west: 10, east: 10.01 }
const okRes = (payload) => ({ ok: true, json: async () => payload })
const errRes = (status) => ({ ok: false, status, text: async () => 'feil' })

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('overpassTimeoutForBbox — areal-skalert klient-tak', () => {
  it('lite kart (~1 km²) bruker baseline 60 s', () => {
    expect(overpassTimeoutForBbox(bbox)).toBe(60000)
  })
  it('standardarket 8 × 8 km får mer enn baseline', () => {
    const std = { south: 59.76, north: 59.832, west: 10.36, east: 10.503 }
    const t = overpassTimeoutForBbox(std)
    expect(t).toBeGreaterThan(75000)
    expect(t).toBeLessThan(95000)
  })
  it('stort kyst-/by-kart (~14 km, ~190 km²) klatrer mot taket', () => {
    // 14 km bredt kvadrat rundt 59.8°N
    const big = { south: 59.74, north: 59.866, west: 10.3, east: 10.54 }
    const t = overpassTimeoutForBbox(big)
    expect(t).toBeGreaterThan(100000)
    expect(t).toBeLessThanOrEqual(120000)
  })
  it('klamper aldri over taket på 120 s', () => {
    const huge = { south: 59, north: 60, west: 10, east: 12 }
    expect(overpassTimeoutForBbox(huge)).toBe(120000)
  })
  it('tåler manglende bbox', () => {
    expect(overpassTimeoutForBbox(null)).toBe(60000)
  })
})

describe('fetchOverpass speil-kappløp', () => {
  it('returnerer det første speilet som svarer (det raske vinner)', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.includes('fr')) return Promise.resolve(okRes({ elements: ['rask'] }))
      // de: treg — løser etter en makro-task, så fr vinner kappløpet
      return new Promise(resolve => setTimeout(() => resolve(okRes({ elements: ['treg'] })), 50))
    }))
    const data = await fetchOverpass(bbox)
    expect(data.elements).toEqual(['rask'])
  })

  // v7.7.14: vinneren avgjøres på svar-hodene, så taperne skal være avbrutt
  // FØR kroppen deres leses. Med `Promise.any` over `res.json()` strømmet alle
  // tre speilene hele payloaden (0,4–5 MB hver) før noen tapte.
  it('avbryter de tapende speilene før kroppen deres leses', async () => {
    const jsonKalt = []
    const svar = (navn, { treg = false } = {}) => ({
      ok: true,
      json: async () => { jsonKalt.push(navn); return { elements: [navn] } },
    })
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => {
      if (url.includes('fr')) return Promise.resolve(svar('fr'))
      // De to andre svarer med hoder senere; de skal da alt være avbrutt.
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve(svar('treg')), 30)
        signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Avbrutt', 'AbortError')) })
      })
    }))
    const data = await fetchOverpass(bbox)
    expect(data.elements).toEqual(['fr'])
    await new Promise(r => setTimeout(r, 60))
    expect(jsonKalt).toEqual(['fr'])
  })

  it('faller over til et annet speil når ett feiler', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.includes('fr')) return Promise.reject(new Error('nett-feil'))
      return Promise.resolve(okRes({ elements: ['de-ok'] }))
    }))
    const data = await fetchOverpass(bbox)
    expect(data.elements).toEqual(['de-ok'])
  })

  it('prøver på nytt og lykkes etter et forbigående kappløp-feil', async () => {
    vi.useFakeTimers()
    let fail = true   // første kappløp feiler, neste lykkes
    vi.stubGlobal('fetch', vi.fn(() => fail
      ? Promise.resolve(errRes(504))
      : Promise.resolve(okRes({ elements: ['ok'] }))))
    const p = fetchOverpass(bbox)
    await vi.advanceTimersByTimeAsync(100)    // la første kappløp feile
    fail = false
    await vi.advanceTimersByTimeAsync(3000)   // dekk backoff → forsøk 2 lykkes
    await expect(p).resolves.toEqual({ elements: ['ok'] })
  })

  it('kaster når alle forsøk er brukt opp og alle speil feiler', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(errRes(504))))
    const p = fetchOverpass(bbox)
    const assertion = expect(p).rejects.toThrow(/forsøk/)
    await vi.advanceTimersByTimeAsync(20000)   // dekk all backoff mellom forsøk
    await assertion
  })

  it('avbryter umiddelbart hvis signal allerede er aborted', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(okRes({ elements: [] })))
    vi.stubGlobal('fetch', fetchSpy)
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(fetchOverpass(bbox, { signal: ctrl.signal })).rejects.toThrow(/Avbrutt/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('429 fra Overpass — vent på ledig plass', () => {
  it('leser ventetiden fra /api/status', async () => {
    const { slotVentetidFraStatus } = await import('./overpassClient.js')
    const status = `Connected as: 123
Current time: 2026-11-01T21:40:00Z
Announced endpoint: none
Rate limit: 2
Slot available after: 2026-11-01T21:40:12Z, in 12 seconds.
Slot available after: 2026-11-01T21:40:30Z, in 30 seconds.
Currently running queries (pid, space limit, time limit, start time):`
    expect(slotVentetidFraStatus(status)).toBe(12000)
    expect(slotVentetidFraStatus('Rate limit: 2\n2 slots available now.\n')).toBe(0)
    expect(slotVentetidFraStatus('ingenting')).toBeNull()
  })
  it('klemmer ventetiden til [5, 45] s og faller tilbake til 15 s', async () => {
    const { ventetidEtter429 } = await import('./overpassClient.js')
    expect(ventetidEtter429(null)).toBe(15000)
    expect(ventetidEtter429(0)).toBe(5000)
    expect(ventetidEtter429(12000)).toBe(13000)
    expect(ventetidEtter429(300000)).toBe(45000)
  })
  it('venter etter et 429-kappløp og lykkes på neste forsøk', async () => {
    vi.useFakeTimers()
    let kall = 0
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.includes('/api/status')) return Promise.resolve({ ok: true, text: async () => 'Slot available after: x, in 20 seconds.' })
      kall++
      return Promise.resolve(kall <= 3 ? errRes(429) : okRes({ elements: ['ok'] }))
    }))
    const meldinger = []
    const p = fetchOverpass(bbox, { onProgress: m => meldinger.push(m) })
    await vi.advanceTimersByTimeAsync(10000)
    expect(meldinger.some(m => /opptatt — venter 21 s/.test(m))).toBe(true)
    await vi.advanceTimersByTimeAsync(15000)
    expect((await p).elements).toEqual(['ok'])
  })
})

// v12.0.17: DEM-fetcheren var det eneste eksterne kallet uten klient-timeout —
// en hengende WCS-endpoint blokkerte hele kart-byggingen (inkl. terreng-først-
// previewen) uendelig. I tillegg svelget endepunkt-loopen bruker-abort og
// degraderte en bevisst kansellering til syntetisk DEM. Disse testene låser
// timeout-, hedge- og abort-kontraktene.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchDEM, fetchWCSDtm, demTimeoutForPixels } from './demFetcher.js'

// Suksess-stien parser GeoTIFF — mock med et minimalt 2×2-bilde.
vi.mock('geotiff', () => ({
  fromArrayBuffer: async () => ({
    getImage: async () => ({
      readRasters: async () => [new Float32Array([1, 2, 3, 4])],
      getWidth: () => 2,
      getHeight: () => 2,
    }),
  }),
}))

const utmBbox = { minE: 0, minN: 0, maxE: 1000, maxN: 1000 }
const okTiff = () => ({
  ok: true,
  headers: { get: () => 'image/tiff' },
  arrayBuffer: async () => new ArrayBuffer(2000),
})
const hangingFetch = (signal) => new Promise((_, reject) => {
  signal?.addEventListener('abort', () => reject(signal.reason ?? new DOMException('Avbrutt', 'AbortError')), { once: true })
})

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('demTimeoutForPixels — skalert klient-tak', () => {
  it('små forespørsler starter på 15 s gulv', () => {
    expect(demTimeoutForPixels(0)).toBe(15000)
    expect(demTimeoutForPixels(10000)).toBeLessThan(16000)
  })
  it('1M celler → 35 s', () => {
    expect(demTimeoutForPixels(1e6)).toBe(35000)
  })
  it('store forespørsler clampes til 60 s tak', () => {
    expect(demTimeoutForPixels(10e6)).toBe(60000)
  })
})

describe('fetchWCSDtm — klient-timeout', () => {
  it('aborter en hengende request ved timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => hangingFetch(signal)))
    const ep = { url: 'https://x.example', coverage: 'C', bboxCrs: 'EPSG:25832', name: 'test' }
    const p = fetchWCSDtm(utmBbox, 10, ep, { timeoutMs: 5000 })
    const assertion = expect(p).rejects.toThrow(/timeout/i)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })
})

describe('fetchDEM — hedge + abort-kontrakt', () => {
  it('bruker-abort kastes videre i stedet for å degradere til syntetisk', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okTiff())))
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(
      fetchDEM(null, utmBbox, { resolutionM: 10, useReal: true, signal: ctrl.signal }),
    ).rejects.toThrow()
  })

  it('hedge: fallback-endpointen startes etter 4 s og vinner når primæren henger', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn((url, { signal }) => {
      if (url.includes('25833')) return Promise.resolve(okTiff())
      return hangingFetch(signal)   // primær (25832) henger
    })
    vi.stubGlobal('fetch', fetchSpy)
    const p = fetchDEM(null, utmBbox, { resolutionM: 10, useReal: true })
    await vi.advanceTimersByTimeAsync(4100)
    const dem = await p
    expect(dem.source).toContain('25833')
    // Primæren ble startet først, fallbacken etter hedge-forsinkelsen
    expect(fetchSpy.mock.calls[0][0]).toContain('25832')
    expect(fetchSpy.mock.calls[1][0]).toContain('25833')
  })

  it('faller til syntetisk når alle endpoints henger forbi timeout', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn((url, { signal }) => hangingFetch(signal))
    vi.stubGlobal('fetch', fetchSpy)
    const p = fetchDEM(null, utmBbox, { resolutionM: 10, useReal: true })
    // 100×100 px → 15 s timeout per endpoint, hedge etter 4 s. Begge kjører
    // parallelt, så alt er avgjort innen 19 s.
    await vi.advanceTimersByTimeAsync(25000)
    const dem = await p
    expect(dem.source).toMatch(/^synthetic/)
    // v6.5.11: LÅSER AT DEN DØDE DOM10-FALLBACKEN IKKE KOMMER TILBAKE.
    // `wms.hoyde-dom10_33` svarer «UKJENT APPLIKASJON» (målt av
    // probe-svalbard-dem), og lå serielt ETTER de to DTM-ene — altså en ekstra
    // round-trip pluss et 15 s klient-tak på nøyaktig den stien der brukeren
    // allerede venter lengst. En sletting uten en test som holder den nede er
    // en sletting som blir angret i god tro.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    for (const [url] of fetchSpy.mock.calls) expect(url).not.toContain('dom10')
  })
})

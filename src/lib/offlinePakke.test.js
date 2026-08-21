// Innsamlingen som gjør en .lendekart-fil brukbar uten dekning.
//
// Det kritiske her er NØKLENE: lagene (useHeritageLayers, useHydroStations,
// MapView.openKulturminneDetail) slår opp på nøyaktig disse strengene. Treffer
// vi feil, blir fila full av data ingen leter etter, og «offline» virker
// helt til turkameraten står på fjellet.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const cacheStore = new Map()
vi.mock('./protectedAreaCache.js', async (orig) => {
  const ekte = await orig()
  return {
    ...ekte,
    cacheGet: vi.fn(async (key) => (cacheStore.has(key) ? cacheStore.get(key) : null)),
    cacheSet: vi.fn(async (key, data) => { cacheStore.set(key, data) }),
  }
})
vi.mock('./kulturminneFetcher.js', () => ({
  fetchKulturminnerMedStatus: vi.fn(),
  fetchKulturminneById: vi.fn(),
}))
vi.mock('./kulturminneWfs.js', () => ({ fetchFredaKulturminner: vi.fn() }))
vi.mock('./nveHydApi.js', () => ({
  fetchStationsForBbox: vi.fn(),
  fetchStationLatest: vi.fn(),
}))

const { samleOfflineData, skrivOfflineData, kulturminneIderFraSvg, KULTURMINNE_DETALJ_TAK, HYDRO_MAALING_TAK } = await import('./offlinePakke.js')
const { cacheGet, cacheSet, kulturminneBboxKey, fredetKulturminneBboxKey, kulturminneIdKey, hydroBboxKey, hydroLatestKey } = await import('./protectedAreaCache.js')
const { fetchKulturminnerMedStatus, fetchKulturminneById } = await import('./kulturminneFetcher.js')
const { fetchFredaKulturminner } = await import('./kulturminneWfs.js')
const { fetchStationsForBbox, fetchStationLatest } = await import('./nveHydApi.js')

// Et lite, ekte kart-meta (Vardåsen-aktig utsnitt i UTM 32N).
const meta = {
  minE: 590000, minN: 6640000, maxE: 592000, maxN: 6642000,
  widthM: 2000, heightM: 2000,
  bbox: { south: 59.9, north: 59.92, west: 10.4, east: 10.44 },
}

beforeEach(() => {
  cacheStore.clear()
  vi.clearAllMocks()
  fetchKulturminnerMedStatus.mockResolvedValue({ items: [], status: 'ok' })
  fetchFredaKulturminner.mockResolvedValue([])
  fetchKulturminneById.mockResolvedValue(null)
  fetchStationsForBbox.mockResolvedValue([])
  fetchStationLatest.mockResolvedValue({})
})

const nøkler = (rader) => rader.map((r) => r.key)

describe('kulturminneIderFraSvg', () => {
  it('plukker ut de innbakte ikonenes id-er', () => {
    const svg = '<g data-kulturminne-id="abc"/><g data-kulturminne-id="def"/><g/>'
    expect(kulturminneIderFraSvg(svg)).toEqual(['abc', 'def'])
  })
  it('takler et kart uten kulturminner', () => {
    expect(kulturminneIderFraSvg('<svg/>')).toEqual([])
    expect(kulturminneIderFraSvg(undefined)).toEqual([])
  })
})

describe('samleOfflineData — nøklene', () => {
  it('bruker NØYAKTIG de nøklene lagene slår opp på', async () => {
    fetchKulturminnerMedStatus.mockResolvedValue({ items: [{ id: 'km1' }], status: 'ok' })
    fetchFredaKulturminner.mockResolvedValue([{ id: 'f1', lat: 59.91, lon: 10.42 }])
    fetchKulturminneById.mockResolvedValue({ id: 'km1', tittel: 'Gravhaug' })
    fetchStationsForBbox.mockResolvedValue([{ stationId: '2.13.0', latitude: 59.91, longitude: 10.42 }])
    fetchStationLatest.mockResolvedValue({ discharge: { value: 3.2, time: 't' } })

    const rader = await samleOfflineData({ meta, svg: '' })
    const k = nøkler(rader)
    expect(k).toContain(kulturminneBboxKey(meta.bbox))
    expect(k).toContain(kulturminneIdKey('km1'))
    expect(k).toContain(hydroLatestKey('2.13.0'))
    // bbox-nøklene for fredet/hydro regnes fra kartets fire hjørner, ikke meta.bbox
    expect(k.some((s) => s.startsWith('fredet:enk:bbox:'))).toBe(true)
    expect(k.some((s) => s.startsWith('hydro:bbox:'))).toBe(true)
    expect(fredetKulturminneBboxKey).toBeTypeOf('function')
    expect(hydroBboxKey).toBeTypeOf('function')
  })

  it('gir hver rad en expires i framtiden', async () => {
    fetchFredaKulturminner.mockResolvedValue([{ id: 'f1' }])
    const rader = await samleOfflineData({ meta })
    expect(rader.length).toBeGreaterThan(0)
    for (const r of rader) expect(r.expires).toBeGreaterThan(Date.now())
  })

  it('fyller også avsenderens egen cache', async () => {
    fetchFredaKulturminner.mockResolvedValue([{ id: 'f1' }])
    await samleOfflineData({ meta })
    expect(cacheSet).toHaveBeenCalled()
  })
})

describe('samleOfflineData — robusthet', () => {
  it('lar de andre kildene gå videre når én kaster', async () => {
    fetchKulturminnerMedStatus.mockRejectedValue(new Error('api.ra.no nede'))
    fetchFredaKulturminner.mockResolvedValue([{ id: 'f1' }])
    fetchStationsForBbox.mockResolvedValue([{ stationId: '1.1.0' }])
    const k = nøkler(await samleOfflineData({ meta }))
    expect(k.some((s) => s.startsWith('fredet:'))).toBe(true)
    expect(k.some((s) => s.startsWith('hydro:bbox:'))).toBe(true)
  })

  it('bruker cachen i stedet for nettet når raden allerede finnes', async () => {
    cacheStore.set(kulturminneBboxKey(meta.bbox), [{ id: 'gammel' }])
    const rader = await samleOfflineData({ meta })
    expect(fetchKulturminnerMedStatus).not.toHaveBeenCalled()
    expect(rader.find((r) => r.key === kulturminneBboxKey(meta.bbox)).data).toEqual([{ id: 'gammel' }])
  })

  it('henter ikke flere kulturminne-detaljer enn taket', async () => {
    const mange = Array.from({ length: KULTURMINNE_DETALJ_TAK + 25 }, (_, i) => ({ id: `k${i}` }))
    fetchKulturminnerMedStatus.mockResolvedValue({ items: mange, status: 'ok' })
    fetchKulturminneById.mockImplementation(async (id) => ({ id, tittel: id }))
    const rader = await samleOfflineData({ meta })
    expect(rader.filter((r) => r.key.startsWith('kulturminne:id:')).length).toBe(KULTURMINNE_DETALJ_TAK)
  })

  it('gir opp detalj-hentingen når nettet forsvinner (feil på rad)', async () => {
    const mange = Array.from({ length: 60 }, (_, i) => ({ id: `k${i}` }))
    fetchKulturminnerMedStatus.mockResolvedValue({ items: mange, status: 'ok' })
    fetchKulturminneById.mockRejectedValue(new Error('offline'))
    await samleOfflineData({ meta })
    expect(fetchKulturminneById.mock.calls.length).toBeLessThan(20)
  })

  it('henter ikke målinger for flere stasjoner enn taket', async () => {
    const stasjoner = Array.from({ length: HYDRO_MAALING_TAK + 10 }, (_, i) => ({ stationId: `s${i}` }))
    fetchStationsForBbox.mockResolvedValue(stasjoner)
    fetchStationLatest.mockResolvedValue({ discharge: { value: 1, time: 't' } })
    const rader = await samleOfflineData({ meta })
    expect(rader.filter((r) => r.key.startsWith('hydro:latest:')).length).toBe(HYDRO_MAALING_TAK)
  })

  it('stopper når kalleren avbryter', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const rader = await samleOfflineData({ meta, signal: ctrl.signal })
    expect(fetchFredaKulturminner).not.toHaveBeenCalled()
    expect(rader.length).toBeLessThanOrEqual(1)
  })

  it('gir en tom liste uten meta', async () => {
    expect(await samleOfflineData({ meta: null })).toEqual([])
  })
})

describe('skrivOfflineData', () => {
  it('setter TTL på nytt så en gammel fil ikke er utløpt ved import', async () => {
    const forGammel = Date.now() - 1000
    await skrivOfflineData([{ key: hydroBboxKey(meta.bbox), data: [{ stationId: '1' }], expires: forGammel }])
    expect(cacheSet).toHaveBeenCalledWith(hydroBboxKey(meta.bbox), [{ stationId: '1' }], expect.any(Number))
    const [, , ttl] = cacheSet.mock.calls.at(-1)
    expect(ttl).toBeGreaterThan(0)
  })

  it('hopper over tomme rader og teller de skrevne', async () => {
    const n = await skrivOfflineData([{ key: 'a', data: 1 }, { key: 'b' }, null])
    expect(n).toBe(1)
  })

  it('takler at pakka ikke hadde noen cache', async () => {
    expect(await skrivOfflineData(undefined)).toBe(0)
  })
})

// cacheGet er mocket — sanity på at mocken faktisk er i bruk.
it('bruker den mockede cachen', () => expect(vi.isMockFunction(cacheGet)).toBe(true))

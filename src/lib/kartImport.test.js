// Importen av en delt .lendekart-fil. De to reglene som MÅ holde:
//   • aldri overskriv et kart mottakeren allerede har (ny id, ledig navn)
//   • isAuto: false — auto-fliser fra en annen appVersion ryddes bort av
//     useGhostTiles/tileCache, og et importert kart ville forsvunnet av seg selv
import { describe, it, expect, vi, beforeEach } from 'vitest'

const lagrede = []
vi.mock('./mapStorage.js', () => ({
  generateMapId: vi.fn(() => `kart_ny${lagrede.length}`),
  saveMap: vi.fn(async (e) => { lagrede.push(e); return e }),
  listMaps: vi.fn(async () => []),
}))
vi.mock('./offlinePakke.js', () => ({ skrivOfflineData: vi.fn(async (r) => (r?.length ?? 0)) }))

const { importerKartPakke } = await import('./kartImport.js')
const { listMaps, saveMap } = await import('./mapStorage.js')
const { skrivOfflineData } = await import('./offlinePakke.js')
const { lagKartPakke } = await import('./kartPakke.js')

const kart = (over = {}) => ({
  id: 'kart_avsender',
  navn: 'Vardåsen',
  svg: '<svg data-meta=\'{"widthM":1000}\'/>',
  bbox: { south: 59, north: 59.1, west: 10, east: 10.1 },
  dem: { buffer: new Float32Array([100, 200]).buffer, cols: 2, rows: 1, transform: {}, noData: -9999 },
  isAuto: true,
  partial: true,
  appVersion: '5.19.0',
  ...over,
})

const fil = (over, cache = []) => lagKartPakke({ kart: kart(over), cache, appVersion: '5.20.0' })

beforeEach(() => {
  lagrede.length = 0
  vi.clearAllMocks()
  listMaps.mockResolvedValue([])
})

describe('importerKartPakke', () => {
  it('lagrer kartet med NY id — avsenderens id gjenbrukes aldri', async () => {
    const { id } = await importerKartPakke(await fil())
    expect(id).not.toBe('kart_avsender')
    expect(saveMap).toHaveBeenCalledTimes(1)
    expect(lagrede[0].id).toBe(id)
  })

  it('nullstiller isAuto og partial så kartet ikke ryddes bort eller ber om «Fullfør»', async () => {
    await importerKartPakke(await fil())
    expect(lagrede[0].isAuto).toBe(false)
    expect(lagrede[0].partial).toBe(false)
  })

  it('tar med SVG og DEM', async () => {
    await importerKartPakke(await fil())
    expect(lagrede[0].svg).toContain('data-meta')
    expect([...new Float32Array(lagrede[0].dem.buffer)]).toEqual([100, 200])
  })

  it('starter uten annoteringer og spor', async () => {
    await importerKartPakke(await fil())
    expect(lagrede[0].annotations).toEqual([])
    expect(lagrede[0].tracks).toEqual([])
    expect(lagrede[0].trackStyle).toBeUndefined()
  })

  it('beholder appVersion kartet ble BYGGET med, og noterer importen for seg', async () => {
    await importerKartPakke(await fil())
    expect(lagrede[0].appVersion).toBe('5.19.0')
    expect(lagrede[0].importertFra.eksportert).toBeGreaterThan(0)
    expect(lagrede[0].importertFra.importertAv).toBeTruthy()
  })

  it('skriver datalagene inn i cachen', async () => {
    const cache = [{ key: 'hydro:bbox:1,2,3,4', data: [{ stationId: '1' }], expires: 1 }]
    const res = await importerKartPakke(await fil({}, cache))
    expect(skrivOfflineData).toHaveBeenCalledWith(cache)
    expect(res.cacheRader).toBe(1)
  })
})

describe('navnekollisjon', () => {
  it('lar navnet stå når det er ledig', async () => {
    const { navn } = await importerKartPakke(await fil())
    expect(navn).toBe('Vardåsen')
  })

  it('merker det som importert når navnet er opptatt', async () => {
    listMaps.mockResolvedValue([{ navn: 'Vardåsen' }])
    const { navn } = await importerKartPakke(await fil())
    expect(navn).toBe('Vardåsen (importert)')
  })

  it('teller opp ved gjentatte importer av samme fil', async () => {
    listMaps.mockResolvedValue([{ navn: 'Vardåsen' }, { navn: 'Vardåsen (importert)' }])
    const { navn } = await importerKartPakke(await fil())
    expect(navn).toBe('Vardåsen (importert 2)')
  })

  it('gir et navnløst kart et navn', async () => {
    const { navn } = await importerKartPakke(await fil({ navn: '' }))
    expect(navn).toBe('Importert kart')
  })
})

describe('feil', () => {
  it('lagrer ingenting når fila ikke er en kartfil', async () => {
    const søppel = new TextEncoder().encode('{"format":"noe-annet"}')
    await expect(importerKartPakke(søppel)).rejects.toThrow()
    expect(saveMap).not.toHaveBeenCalled()
  })

  it('overlever at listMaps feiler (IndexedDB blokkert)', async () => {
    listMaps.mockRejectedValue(new Error('idb nede'))
    const { navn } = await importerKartPakke(await fil())
    expect(navn).toBe('Vardåsen')
  })
})

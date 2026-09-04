// Importen av en delt .lendekart-fil. De to reglene som MÅ holde:
//   • aldri overskriv et kart mottakeren allerede har (ny id, ledig navn)
//   • samme kart to ganger gir det du alt har, ikke «(importert 2)»
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

const { importerKartPakke, finnAlleredeImportert } = await import('./kartImport.js')
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

  it('teller opp når to ULIKE kart vil hete det samme', async () => {
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


describe('finnAlleredeImportert', () => {
  const post = (over = {}) => ({
    id: 'kart_a', navn: 'Vardåsen',
    importertFra: { eksportert: 500, opprinneligNavn: 'Vardåsen', opprinneligOpprettet: 100 },
    ...over,
  })
  const kand = (over = {}) => ({ navn: 'Vardåsen', opprettet: 100, eksportert: 500, ...over })

  it('kjenner igjen samme kart', () => {
    expect(finnAlleredeImportert([post()], kand())?.id).toBe('kart_a')
  })

  it('kjenner det igjen selv om mottakeren har døpt om kopien sin', () => {
    expect(finnAlleredeImportert([post({ navn: 'Hytteturen' })], kand())?.id).toBe('kart_a')
  })

  it('kjenner det igjen når avsenderen har eksportert det på nytt', () => {
    expect(finnAlleredeImportert([post()], kand({ eksportert: 900 }))?.id).toBe('kart_a')
  })

  it('skiller to ulike kart med samme navn', () => {
    expect(finnAlleredeImportert([post()], kand({ opprettet: 101, eksportert: 900 }))).toBeNull()
  })

  it('rører ikke kart brukeren har bygget selv', () => {
    expect(finnAlleredeImportert([{ id: 'k', navn: 'Vardåsen' }], kand())).toBeNull()
  })

  it('kjenner igjen SAMME FIL for legacy-poster uten notat', () => {
    const gammel = { id: 'kart_g', navn: 'Vardåsen (importert)', importertFra: { eksportert: 500 } }
    expect(finnAlleredeImportert([gammel], kand())?.id).toBe('kart_g')
    expect(finnAlleredeImportert([gammel], kand({ eksportert: 900 }))).toBeNull()
  })

  it('godtar ikke navn alene når tidspunktet mangler', () => {
    const uten = { id: 'k', navn: 'Vardåsen', importertFra: { eksportert: null, opprinneligNavn: 'Vardåsen', opprinneligOpprettet: null } }
    expect(finnAlleredeImportert([uten], kand({ opprettet: null, eksportert: null }))).toBeNull()
  })

  it('tåler tomme lister og navnløse kandidater', () => {
    expect(finnAlleredeImportert([], kand())).toBeNull()
    expect(finnAlleredeImportert(undefined, kand())).toBeNull()
    expect(finnAlleredeImportert([post()], kand({ navn: '' }))).toBeNull()
  })
})

describe('samme kart to ganger', () => {
  it('åpner kartet mottakeren har i stedet for å lage en kopi', async () => {
    const pakke = await fil({ opprettet: 100 })
    const forste = await importerKartPakke(pakke)
    expect(forste.alleredeImportert).toBe(false)
    listMaps.mockResolvedValue([lagrede[0]])

    const igjen = await importerKartPakke(await fil({ opprettet: 100 }))
    expect(igjen.alleredeImportert).toBe(true)
    expect(igjen.id).toBe(forste.id)
    expect(igjen.navn).toBe('Vardåsen')
    expect(lagrede).toHaveLength(1)
    expect(saveMap).toHaveBeenCalledTimes(1)
  })

  it('friskner opp offline-cachen likevel — TTL-en er hele poenget med fila', async () => {
    const cache = [{ key: 'kulturminne:1', data: [], expires: 1 }]
    await importerKartPakke(await fil({ opprettet: 100 }, cache))
    listMaps.mockResolvedValue([lagrede[0]])
    const igjen = await importerKartPakke(await fil({ opprettet: 100 }, cache))
    expect(igjen.cacheRader).toBe(1)
  })
})

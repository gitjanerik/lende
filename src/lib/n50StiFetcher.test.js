import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  berorerBbox, n50StiTilElementer, n50StiElementerFra, fetchN50StiLinjer,
  nullstillManifestCache,
} from './n50StiFetcher.js'
import { kodeFlis } from './n50StiPakke.js'
import { travelLineGeometries } from './linjeDedup.js'
import { classifyToIsom } from './symbolizer.js'

const BBOX = { south: 59.830, west: 10.055, north: 59.848, east: 10.110 }
const linje = (lat, lon0, lon1, n = 10, rest = {}) => ({
  type: 'sti', merket: false, ...rest,
  geometry: Array.from({ length: n }, (_, i) => ({ lat, lon: lon0 + (lon1 - lon0) * (i / (n - 1)) })),
})

describe('berorerBbox', () => {
  it('tar med linjer som har punkter inne i bboxen', () => {
    expect(berorerBbox(linje(59.84, 10.07, 10.09).geometry, BBOX)).toBe(true)
  })

  it('utelater linjer som ligger helt utenfor', () => {
    expect(berorerBbox(linje(59.60, 10.07, 10.09).geometry, BBOX)).toBe(false)
    expect(berorerBbox(linje(59.84, 10.20, 10.30).geometry, BBOX)).toBe(false)
  })

  it('tar med en linje som KRYSSER bboxen uten verteks inni', () => {
    // Lang rett strekning tvers over et lite kart: ingen punkter inne, men
    // segmentet går gjennom. En ren verteks-test ville mistet den.
    const tvers = [{ lat: 59.84, lon: 9.9 }, { lat: 59.84, lon: 10.3 }]
    expect(berorerBbox(tvers, BBOX)).toBe(true)
  })

  it('tåler tom geometri', () => {
    expect(berorerBbox([], BBOX)).toBe(false)
    expect(berorerBbox(null, BBOX)).toBe(false)
  })
})

describe('n50StiTilElementer + symbolisering', () => {
  it('gir merket sti ISOM 506 og umerket 507', () => {
    const [merket] = n50StiTilElementer([linje(59.84, 10.07, 10.09, 5, { merket: true })])
    const [umerket] = n50StiTilElementer([linje(59.84, 10.07, 10.09, 5, { merket: false })])
    expect(classifyToIsom(merket)).toEqual({ code: '506', cat: 'manmade' })
    expect(classifyToIsom(umerket)).toEqual({ code: '507', cat: 'manmade' })
  })

  it('gir traktorveg ISOM 504 — samme kode som OSM highway=track', () => {
    const [t] = n50StiTilElementer([linje(59.84, 10.07, 10.09, 5, { type: 'traktorveg', merket: true })])
    expect(classifyToIsom(t)).toEqual({ code: '504', cat: 'manmade' })
    expect(classifyToIsom({ tags: { highway: 'track' } })).toEqual({ code: '504', cat: 'manmade' })
  })

  it('merker kilden og setter ikke name', () => {
    const [e] = n50StiTilElementer([linje(59.84, 10.07, 10.09)])
    expect(e._source).toBe('n50sti')
    expect(e.type).toBe('way')
    expect(e.tags.name).toBeUndefined()
  })

  it('påvirker ikke klassifiseringen av OSM-stier eller Turrutebasen', () => {
    expect(classifyToIsom({ tags: { highway: 'path' } })).toEqual({ code: '505', cat: 'manmade' })
    expect(classifyToIsom({ tags: { 'lende:turrute': 'fotrute', merking: 'JA' } }))
      .toEqual({ code: '506', cat: 'manmade' })
  })
})

describe('uttynning', () => {
  it('fjerner N50-linjer som ligger oppå en OSM-sti', () => {
    const g = linje(59.84, 10.07, 10.09, 30)
    const osm = [{ tags: { highway: 'path' }, geometry: g.geometry }]
    expect(n50StiElementerFra([g], osm)).toEqual([])
  })

  it('fjerner N50-linjer som ligger oppå en TURRUTEBASEN-rute', () => {
    // Regresjonsvakten: travelLineGeometries filtrerte opprinnelig bare på
    // `highway`, så Turrutebasens egne tagger falt utenfor og samme sti ville
    // blitt tegnet av både Turrutebasen og N50.
    const g = linje(59.84, 10.07, 10.09, 30)
    const turrute = [{ tags: { 'lende:turrute': 'fotrute', merking: 'JA' }, geometry: g.geometry }]
    expect(travelLineGeometries(turrute)).toHaveLength(1)
    expect(n50StiElementerFra([g], turrute)).toEqual([])
  })

  it('beholder N50-linjer ingen andre har', () => {
    const g = linje(59.84, 10.07, 10.09, 30)
    const langtUnna = [{ tags: { highway: 'path' }, geometry: linje(59.60, 10.07, 10.09, 30).geometry }]
    expect(n50StiElementerFra([g], langtUnna)).toHaveLength(1)
  })

  it('oppdaterer status med hvor mye som ble nytt', () => {
    const status = { state: 'ok', linjer: 1 }
    n50StiElementerFra([linje(59.84, 10.07, 10.09, 30)], [], status)
    expect(status.nye).toBe(1)
  })
})

describe('fetchN50StiLinjer', () => {
  beforeEach(() => { nullstillManifestCache() })
  afterEach(() => { vi.unstubAllGlobals(); nullstillManifestCache() })

  const svar = (body, ok = true) => ({
    ok, status: ok ? 200 : 404,
    json: async () => body,
    arrayBuffer: async () => body.buffer ?? body,
  })

  it('henter bare fliser manifestet sier finnes', async () => {
    const flis = kodeFlis([linje(59.84, 10.07, 10.09, 5)])
    const hentet = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      hentet.push(url)
      if (url.endsWith('manifest.json')) return svar({ versjon: 2, fliser: ['59.5_10.0'] })
      return svar(flis)
    }))
    const linjer = await fetchN50StiLinjer(BBOX, { basePath: '/d/' })
    expect(linjer).toHaveLength(1)
    expect(hentet).toEqual(['/d/manifest.json', '/d/59.5_10.0.bin'])
  })

  it('ber ikke om fliser manifestet ikke har (hav og utland)', async () => {
    const hentet = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      hentet.push(url)
      return svar({ versjon: 2, fliser: [] })
    }))
    const status = {}
    const linjer = await fetchN50StiLinjer(BBOX, { basePath: '/d/', onStatus: s => Object.assign(status, s) })
    expect(linjer).toEqual([])
    expect(hentet).toEqual(['/d/manifest.json'])
    expect(status.state).toBe('ok')
  })

  it('filtrerer bort linjer utenfor bboxen — fliser er større enn kartet', async () => {
    const flis = kodeFlis([
      linje(59.84, 10.07, 10.09, 5),   // inne i bbox
      linje(59.60, 10.07, 10.09, 5),   // samme flis, langt sør for bbox
    ])
    vi.stubGlobal('fetch', vi.fn(async (url) =>
      url.endsWith('manifest.json') ? svar({ versjon: 2, fliser: ['59.5_10.0'] }) : svar(flis)))
    expect(await fetchN50StiLinjer(BBOX, { basePath: '/d/' })).toHaveLength(1)
  })

  it('gir tom liste når flisene ikke er bakt ennå', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => svar(null, false)))
    const status = {}
    const linjer = await fetchN50StiLinjer(BBOX, { basePath: '/d/', onStatus: s => Object.assign(status, s) })
    expect(linjer).toEqual([])
    // 404 på fliser er ikke en feil verdt å skrike om — kartet blir som før.
    expect(status.state).toBe('ok')
  })

  it('faller aldri hardt på nettverksfeil', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const status = {}
    await expect(fetchN50StiLinjer(BBOX, { basePath: '/d/', onStatus: s => Object.assign(status, s) }))
      .resolves.toEqual([])
    expect(status.state).toBe('feil')
  })

  it('avviser ugyldig bbox i stedet for å hente noe', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await fetchN50StiLinjer(null, { basePath: '/d/' })).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import {
  fetchN50ArealFlater, n50ArealTilElementer, berorerBbox, nullstillManifestCache,
} from './n50ArealFetcher.js'
import { kodeFlis } from './n50ArealPakke.js'

const ring = (pts) => pts.map(([lat, lon]) => ({ lat, lon }))
const BBOX = { south: 59.80, west: 10.10, north: 59.84, east: 10.18 }
const MYR = ring([[59.81, 10.12], [59.83, 10.12], [59.83, 10.16], [59.81, 10.16]])
const HULL = ring([[59.815, 10.13], [59.825, 10.13], [59.825, 10.15]])

/** Falsk flis-server: {sti → bytes}. Alt annet gir 404. */
function server(filer) {
  return async (url) => {
    for (const [navn, bytes] of Object.entries(filer)) {
      if (url.endsWith(navn)) return { status: 200, bytes }
    }
    return { status: 404, bytes: null }
  }
}
const manifest = (...n) => new TextEncoder().encode(JSON.stringify({ fliser: n }))

beforeEach(() => nullstillManifestCache())

describe('n50ArealFetcher', () => {
  it('henter flater fra flisene manifestet lister', async () => {
    const flater = await fetchN50ArealFlater(BBOX, {
      basePath: '/x/',
      hentBytes: server({
        'manifest.json': manifest('59.5_10.0'),
        '59.5_10.0.bin': kodeFlis([{ type: 'myr', ringer: [MYR] }]),
      }),
    })
    expect(flater).toHaveLength(1)
    expect(flater[0].type).toBe('myr')
  })

  // Dette er grunnen til at fila kunne landes FØR flisene fantes.
  it('gir tom liste — ikke feil — når flisene ikke er bakt ennå', async () => {
    let status = null
    const flater = await fetchN50ArealFlater(BBOX, {
      basePath: '/x/', hentBytes: server({}), onStatus: (s) => { status = s },
    })
    expect(flater).toEqual([])
    expect(status.state).toBe('ok')
  })

  it('hopper over fliser manifestet ikke har — ellers 404-storm over hav', async () => {
    let status = null
    await fetchN50ArealFlater(BBOX, {
      basePath: '/x/',
      hentBytes: server({ 'manifest.json': manifest('70.0_25.0') }),
      onStatus: (s) => { status = s },
    })
    expect(status).toMatchObject({ state: 'ok', fliser: 0, utenfor: true })
  })

  it('dedupliserer en myr som ligger hel i to nabofliser', async () => {
    // Flater klippes ikke på flisgrensa — de dupliseres. Uten dedup ville det
    // halvgjennomsiktige myr-mønsteret blitt synlig dobbelt-tegnet.
    const bytes = kodeFlis([{ type: 'myr', ringer: [MYR] }])
    const flater = await fetchN50ArealFlater(
      { south: 59.4, west: 10.10, north: 59.84, east: 10.18 },
      {
        basePath: '/x/',
        hentBytes: server({
          'manifest.json': manifest('59.0_10.0', '59.5_10.0'),
          '59.0_10.0.bin': bytes,
          '59.5_10.0.bin': bytes,
        }),
      })
    expect(flater).toHaveLength(1)
  })

  it('ugyldig bbox gir feil-status i stedet for å kaste', async () => {
    let status = null
    expect(await fetchN50ArealFlater(null, { onStatus: (s) => { status = s } })).toEqual([])
    expect(status.state).toBe('feil')
  })

  it('berorerBbox fanger flater som overlapper uten å ha verteks inni', async () => {
    expect(berorerBbox([MYR], BBOX)).toBe(true)
    expect(berorerBbox([MYR], { south: 60, west: 11, north: 61, east: 12 })).toBe(false)
    expect(berorerBbox([], BBOX)).toBe(false)
  })
})

describe('n50ArealTilElementer', () => {
  it('flate uten hull blir en way med natural=wetland', () => {
    const [el] = n50ArealTilElementer([{ type: 'myr', ringer: [MYR] }])
    expect(el.type).toBe('way')
    expect(el.tags).toEqual({ natural: 'wetland', 'lende:n50areal': 'myr' })
    expect(el._source).toBe('n50areal')
    expect(el.geometry).toHaveLength(4)
  })

  it('flate MED hull blir en relation med outer/inner — som OSM-multipolygoner', () => {
    // mapBuilder ring-syr relations via assembleRelationRings; en flate med
    // hull sendt som way ville mistet hullet.
    const [el] = n50ArealTilElementer([{ type: 'myr', ringer: [MYR, HULL] }])
    expect(el.type).toBe('relation')
    expect(el.members.map((m) => m.role)).toEqual(['outer', 'inner'])
    expect(el.members[1].geometry).toHaveLength(3)
  })
})

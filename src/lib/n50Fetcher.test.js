import { describe, it, expect, vi, afterEach } from 'vitest'
import { geojsonToWays, fetchN50Water } from './n50Fetcher.js'

const mapping = { tag: 'natural', value: 'water' }

// GeoJSON-ring [lon, lat]; lukket (siste == første).
const ring = (pts) => pts.map(([lon, lat]) => [lon, lat])

// Kvadrat med hjørne (lon0, lat0) og side s (grader).
const box = (lon0, lat0, s) => ring([
  [lon0, lat0], [lon0 + s, lat0], [lon0 + s, lat0 + s], [lon0, lat0 + s], [lon0, lat0],
])

// Setten-lignende innsjø (MultiPolygon) med én øy (hull), slik NVE-queryen
// leverer den som GeoJSON.
const settenFeature = {
  type: 'Feature',
  properties: { navn: 'Setten', vatnLnr: 123 },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [[
      [[11.6, 59.79], [11.7, 59.79], [11.7, 59.83], [11.6, 59.83], [11.6, 59.79]],
      [[11.66, 59.80], [11.68, 59.80], [11.68, 59.81], [11.66, 59.81], [11.66, 59.80]],
    ]],
  },
}

const okResponse = (features) => ({
  ok: true,
  json: async () => ({ type: 'FeatureCollection', features }),
})

describe('fetchN50Water — NVE Innsjødatabasen query på bbox', () => {
  const bbox = { south: 59.79, west: 11.6, north: 59.83, east: 11.7 }

  afterEach(() => vi.unstubAllGlobals())

  it('innsjø med øy-hull → relation med inner-ring (natural=water)', async () => {
    const seen = []
    vi.stubGlobal('fetch', vi.fn(async (u) => { seen.push(String(u)); return okResponse([settenFeature]) }))
    const els = await fetchN50Water(bbox, { queryBase: 'https://x/MapServer/5' })
    expect(els).toHaveLength(1)
    expect(els[0].type).toBe('relation')
    expect(els[0].members.filter(m => m.role === 'inner')).toHaveLength(1)
    expect(els[0].tags.natural).toBe('water')
    expect(els[0]._source).toBe('n50')
    // Query-URL: riktig endepunkt, bbox som envelope, geojson ut.
    expect(seen[0]).toContain('https://x/MapServer/5/query?')
    expect(seen[0]).toContain('geometryType=esriGeometryEnvelope')
    expect(seen[0]).toContain('f=geojson')
    // Én side under PAGE_SIZE → ingen side 2.
    expect(seen).toHaveLength(1)
  })

  it('paginerer når en side er full (2000), stopper på kort side', async () => {
    const full = Array.from({ length: 2000 }, (_, i) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [box(11.6 + i * 1e-6, 59.79, 0.001)] },
    }))
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      calls.push(new URL(String(u)).searchParams.get('resultOffset'))
      return okResponse(calls.length === 1 ? full : [settenFeature])
    }))
    const els = await fetchN50Water(bbox, { queryBase: 'https://x/MapServer/5' })
    expect(calls).toEqual(['0', '2000'])
    expect(els).toHaveLength(2001)
  })

  it('nettfeil (begge forsøk) → tom liste + feil-status (identify/OSM tar over)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('nett nede') }))
    const statuses = []
    const p = fetchN50Water(bbox, { queryBase: 'https://x/MapServer/5', onStatus: s => statuses.push(s) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toEqual([])
    expect(statuses).toEqual([{ state: 'feil', message: 'nett nede' }])
    vi.useRealTimers()
  })

  it('forbigående feil → retry lykkes (status ok m/retried)', async () => {
    vi.useFakeTimers()
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (++call === 1) throw new Error('blipp')
      return okResponse([settenFeature])
    }))
    const statuses = []
    const p = fetchN50Water(bbox, { queryBase: 'https://x/MapServer/5', onStatus: s => statuses.push(s) })
    await vi.advanceTimersByTimeAsync(1000)
    const els = await p
    expect(els).toHaveLength(1)
    expect(statuses).toEqual([{ state: 'ok', features: 1, retried: true }])
    vi.useRealTimers()
  })

  it('ArcGIS-feilobjekt (HTTP 200 med error) → tom liste', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ error: { code: 500, message: 'Kaboom' } }),
    })))
    const p = fetchN50Water(bbox, { queryBase: 'https://x/MapServer/5' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toEqual([])
    vi.useRealTimers()
  })

  it('vellykket henting rapporterer ok-status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([settenFeature])))
    const statuses = []
    await fetchN50Water(bbox, { queryBase: 'https://x/MapServer/5', onStatus: s => statuses.push(s) })
    expect(statuses).toEqual([{ state: 'ok', features: 1, retried: false }])
  })
})

describe('geojsonToWays — øy-hull i innsjø', () => {
  it('Polygon uten hull → way', () => {
    const feat = { id: 'l1', geometry: { type: 'Polygon', coordinates: [box(11.5, 59.9, 0.01)] } }
    const out = geojsonToWays(feat, mapping)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('way')
    expect(out[0].geometry[0]).toEqual({ lat: 59.9, lon: 11.5 })
  })

  it('Polygon med hull (øy) → relation med outer + inner', () => {
    const feat = {
      id: 'setten',
      geometry: {
        type: 'Polygon',
        coordinates: [box(11.5, 59.9, 0.02), box(11.505, 59.905, 0.005)],
      },
    }
    const out = geojsonToWays(feat, mapping)
    expect(out).toHaveLength(1)
    const rel = out[0]
    expect(rel.type).toBe('relation')
    const outer = rel.members.filter(m => m.role === 'outer')
    const inner = rel.members.filter(m => m.role === 'inner')
    expect(outer).toHaveLength(1)
    expect(inner).toHaveLength(1)
    expect(rel.tags.natural).toBe('water')
  })

  it('MultiPolygon uten hull → én way per del', () => {
    const feat = {
      id: 'm1',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[box(11.5, 59.9, 0.01)], [box(11.6, 59.9, 0.01)]],
      },
    }
    const out = geojsonToWays(feat, mapping)
    expect(out).toHaveLength(2)
    expect(out.every(e => e.type === 'way')).toBe(true)
  })

  it('MultiPolygon med hull → én relation som bevarer alle inner-ringer', () => {
    const feat = {
      id: 'm2',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [box(11.5, 59.9, 0.02), box(11.505, 59.905, 0.004)],
          [box(11.6, 59.9, 0.01)],
        ],
      },
    }
    const out = geojsonToWays(feat, mapping)
    expect(out).toHaveLength(1)
    const rel = out[0]
    expect(rel.type).toBe('relation')
    expect(rel.members.filter(m => m.role === 'outer')).toHaveLength(2)
    expect(rel.members.filter(m => m.role === 'inner')).toHaveLength(1)
  })
})

import { describe, it, expect } from 'vitest'
import { geojsonToWays } from './n50Fetcher.js'

const mapping = { tag: 'natural', value: 'water' }

// GeoJSON-ring [lon, lat]; lukket (siste == første).
const ring = (pts) => pts.map(([lon, lat]) => [lon, lat])

// Kvadrat med hjørne (lon0, lat0) og side s (grader).
const box = (lon0, lat0, s) => ring([
  [lon0, lat0], [lon0 + s, lat0], [lon0 + s, lat0 + s], [lon0, lat0 + s], [lon0, lat0],
])

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

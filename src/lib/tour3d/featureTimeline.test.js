import { describe, it, expect } from 'vitest'
import { buildFeatureTimeline } from './featureTimeline.js'

// Rett rute (0,0)→(5000,0).
const ROUTE = [[0, 0], [5000, 0]]

const peak = (x, y, name = 'Topp') => ({ name, kind: 'peak', x, y, ele: 400 })
const lake = (x, y, areaM2, name = 'Tjernet') => ({ name, kind: 'vann-omrade', x, y, areaM2 })

describe('buildFeatureTimeline', () => {
  it('inkluderer punkt innen radius, ekskluderer utenfor', () => {
    const tl = buildFeatureTimeline([peak(1000, 300), peak(2000, 400, 'Fjern topp')], ROUTE)
    expect(tl.map(e => e.name)).toEqual(['Topp'])
    expect(tl[0].alongM).toBeCloseTo(1000, 5)
    expect(tl[0].distM).toBeCloseTo(300, 5)
  })

  it('arealfeatures skalerer radius med sqrt(areaM2)', () => {
    // 1 km² innsjø: radius = max(120, 1000·0.6) = 600 m.
    const tl = buildFeatureTimeline([lake(2500, 500, 1_000_000)], ROUTE)
    expect(tl.length).toBe(1)
    const tl2 = buildFeatureTimeline([lake(2500, 500, 10_000)], ROUTE)
    expect(tl2.length).toBe(0)
  })

  it('sorterer på alongM', () => {
    const tl = buildFeatureTimeline([peak(3000, 100, 'C'), peak(500, 100, 'A'), peak(1500, 100, 'B')], ROUTE)
    expect(tl.map(e => e.name)).toEqual(['A', 'B', 'C'])
  })

  it('dedupe innen 150 m langs ruta: høyest prioritet vinner', () => {
    const tl = buildFeatureTimeline([
      { name: 'Stedet', kind: 'stedsnavn', x: 1000, y: 50 },
      peak(1080, 100, 'Toppen'),
    ], ROUTE)
    expect(tl.map(e => e.name)).toEqual(['Toppen'])
  })

  it('samme navn+type dedupes uansett avstand', () => {
    const tl = buildFeatureTimeline([peak(1000, 100, 'X'), peak(4000, 100, 'X')], ROUTE)
    expect(tl.length).toBe(1)
  })

  it('capper antall hendelser men beholder de viktigste, sortert', () => {
    const feats = []
    for (let i = 0; i < 20; i++) feats.push({ name: `Sted ${i}`, kind: 'stedsnavn', x: 200 + i * 220, y: 50 })
    feats.push(peak(4900, 50, 'Storetoppen'))
    const tl = buildFeatureTimeline(feats, ROUTE, { maxEvents: 5 })
    expect(tl.length).toBe(5)
    expect(tl.some(e => e.name === 'Storetoppen')).toBe(true)
    for (let i = 1; i < tl.length; i++) expect(tl[i].alongM).toBeGreaterThanOrEqual(tl[i - 1].alongM)
  })

  it('ukjente kinds og navnløse features filtreres bort', () => {
    const tl = buildFeatureTimeline([
      { name: 'Kontur', kind: 'kontur-tall', x: 100, y: 0 },
      { name: '', kind: 'peak', x: 200, y: 0 },
    ], ROUTE)
    expect(tl.length).toBe(0)
  })

  it('kategorien vann gir arealradius for generiske områder', () => {
    const tl = buildFeatureTimeline([
      { name: 'Vannet', kind: 'ukjent-kind', categories: ['vann'], x: 1000, y: 110, areaM2: 40000 },
    ], ROUTE)
    expect(tl.length).toBe(1)
    expect(tl[0].type).toBe('vann')
  })
})

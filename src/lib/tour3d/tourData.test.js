import { describe, it, expect } from 'vitest'
import { collectMapFeatures, findParkingSpots, findPauseSpots } from './tourData.js'
import { fmtKm, fmtDurationMin, fmtMoh } from './tourFormat.js'

const ROUTE = [[0, 0], [2000, 0]]

describe('collectMapFeatures', () => {
  it('plukker korridor-kandidater og stripper el-referansen', () => {
    const index = [
      { name: 'Vardåsen', kind: 'peak', x: 1000, y: 200, ele: 349, el: { fake: true } },
      { name: 'Langt unna', kind: 'peak', x: 1000, y: 900, ele: 100, el: null },
      { name: 'Kontur', kind: 'kontur-tall', x: 100, y: 10 },
    ]
    const out = collectMapFeatures(index, ROUTE, { maxDistM: 400 })
    expect(out.length).toBe(1)
    expect(out[0].name).toBe('Vardåsen')
    expect(out[0].ele).toBe(349)
    expect('el' in out[0]).toBe(false)
  })

  it('rundtur (start = slutt) dupliserer ikke features', () => {
    const loop = [[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]
    const index = [{ name: 'Startvannet', kind: 'vann-navn', x: 50, y: 50, areaM2: 5000 }]
    const out = collectMapFeatures(index, loop)
    expect(out.length).toBe(1)
  })

  it('tom rute gir tom liste', () => {
    expect(collectMapFeatures([{ name: 'X', kind: 'peak', x: 0, y: 0 }], [])).toEqual([])
    expect(collectMapFeatures([], ROUTE)).toEqual([])
  })
})

describe('findParkingSpots', () => {
  const P1 = { name: 'Startparkering', kind: 'parkering', x: 30, y: 20 }
  const P2 = { name: 'Målparkering', kind: 'parkering', x: 2020, y: 30 }
  const index = [P1, P2, { name: 'Topp', kind: 'peak', x: 0, y: 0 }]

  it('A→B: parkering ≤ 50 m fra start og mål vises', () => {
    const spots = findParkingSpots(index, [[0, 0], [2000, 0]])
    expect(spots.map(s => s.name)).toEqual(['Startparkering', 'Målparkering'])
  })

  it('parkering lenger unna enn 50 m ignoreres — turen utgår ikke derfra', () => {
    const spots = findParkingSpots([{ name: 'Fjern P', kind: 'parkering', x: 100, y: 100 }], [[0, 0], [2000, 0]])
    expect(spots).toEqual([])
  })

  it('rundtur: kun parkering ved start', () => {
    const spots = findParkingSpots(index, [[0, 0], [2000, 0], [0, 0]], { isLoop: true })
    expect(spots.map(s => s.name)).toEqual(['Startparkering'])
  })

  it('samme plass nærmest begge ender vises én gang', () => {
    const spots = findParkingSpots([P1], [[0, 0], [40, 0]])
    expect(spots.length).toBe(1)
  })
})

describe('findPauseSpots', () => {
  const TJERN = { name: 'Svarttjern', kind: 'vann-omrade', x: 1000, y: 1000, areaM2: 8000 }
  const STORVANN = { name: 'Storvannet', kind: 'vann-navn', x: 5000, y: 5000, areaM2: 1_000_000, categories: ['vann'] }

  it('vendepunkt ved tjern gir pausepunkt med vannets navn', () => {
    const spots = findPauseSpots([TJERN], [{ svgX: 1100, svgY: 1000 }])
    expect(spots).toEqual([{ x: 1100, y: 1000, name: 'Svarttjern' }])
  })

  it('vendepunkt langt fra vann gir ingen pause', () => {
    expect(findPauseSpots([TJERN], [{ svgX: 2000, svgY: 2000 }])).toEqual([])
  })

  it('store vann måles mot areal-skalert radius (sentroiden er langt fra bredden)', () => {
    // 1 km²: radius = max(150, 1000·0.6) = 600 m.
    const spots = findPauseSpots([STORVANN], [{ svgX: 5500, svgY: 5000 }])
    expect(spots.length).toBe(1)
    expect(spots[0].name).toBe('Storvannet')
  })

  it('ikke-vann-features teller ikke', () => {
    const peak = { name: 'Toppen', kind: 'peak', x: 1000, y: 1000 }
    expect(findPauseSpots([peak], [{ svgX: 1000, svgY: 1000 }])).toEqual([])
  })
})

describe('tourFormat', () => {
  it('fmtKm bruker komma-desimal og runder over 100 km', () => {
    expect(fmtKm(4260)).toBe('4,3 km')
    expect(fmtKm(123456)).toBe('123 km')
    expect(fmtKm(NaN)).toBe('–')
  })

  it('fmtDurationMin gir «t»-format over en time', () => {
    expect(fmtDurationMin(42)).toBe('42 min')
    expect(fmtDurationMin(65)).toBe('1 t 05 min')
    expect(fmtDurationMin(-1)).toBeNull()
  })

  it('fmtMoh runder til heltall', () => {
    expect(fmtMoh(348.6)).toBe('349 moh')
    expect(fmtMoh(undefined)).toBe('–')
  })
})

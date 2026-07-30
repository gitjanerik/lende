import { describe, it, expect } from 'vitest'
import { collectMapFeatures, findParkingSpots } from './tourData.js'
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
  const P1 = { name: 'Startparkering', kind: 'parkering', x: 100, y: 100 }
  const P2 = { name: 'Målparkering', kind: 'parkering', x: 2100, y: 100 }
  const index = [P1, P2, { name: 'Topp', kind: 'peak', x: 0, y: 0 }]

  it('A→B: nærmeste parkering ved både start og mål', () => {
    const spots = findParkingSpots(index, [[0, 0], [2000, 0]])
    expect(spots.map(s => s.name)).toEqual(['Startparkering', 'Målparkering'])
  })

  it('rundtur: kun parkering ved start', () => {
    const spots = findParkingSpots(index, [[0, 0], [2000, 0], [0, 0]], { isLoop: true })
    expect(spots.map(s => s.name)).toEqual(['Startparkering'])
  })

  it('samme plass nærmest begge ender vises én gang', () => {
    const spots = findParkingSpots([P1], [[0, 0], [300, 0]])
    expect(spots.length).toBe(1)
  })

  it('for langt unna → ingen treff', () => {
    const spots = findParkingSpots(index, [[5000, 5000], [7000, 5000]])
    expect(spots).toEqual([])
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

import { describe, it, expect } from 'vitest'
import { collectMapFeatures } from './tourData.js'
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

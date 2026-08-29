import { describe, it, expect } from 'vitest'
import { STROKE_STEPS, STROKE_DEFAULT_IDX, strokeSizeBase, strekSkala } from './strekSkala.js'

// Hakkene er brukersynlige (knotten husker indeksen i localStorage), så en
// endring her flytter streken på ALLE lagrede kart. Testen er derfor et gjerde,
// ikke en beskrivelse.
describe('strekSkala', () => {
  it('har de seks hakkene uendret etter uttrekket', () => {
    expect(STROKE_STEPS).toEqual([0.28, 0.42, 0.6, 0.84, 1.12, 1.54])
    expect(STROKE_DEFAULT_IDX).toBe(2)
  })

  it('strokeSizeBase: 1 km → 1.0, 10 km → 0.4, lineært mellom', () => {
    expect(strokeSizeBase(1000)).toBeCloseTo(1, 10)
    expect(strokeSizeBase(10000)).toBeCloseTo(0.4, 10)
    expect(strokeSizeBase(5500)).toBeCloseTo(0.7, 10)
  })

  it('klamper utenfor spennet og tåler tull', () => {
    expect(strokeSizeBase(500)).toBe(1)
    expect(strokeSizeBase(99000)).toBeCloseTo(0.4, 10)
    expect(strokeSizeBase(0)).toBe(1)
    expect(strokeSizeBase(NaN)).toBe(1)
    expect(strokeSizeBase(undefined)).toBe(1)
  })

  it('Fritt lendes låste verdi: default-hakk på et 2 km-ark', () => {
    expect(strekSkala(STROKE_DEFAULT_IDX, 2000)).toBeCloseTo(0.56, 10)
  })

  it('klamper hakk-indeksen', () => {
    expect(strekSkala(-5, 1000)).toBeCloseTo(STROKE_STEPS[0], 10)
    expect(strekSkala(99, 1000)).toBeCloseTo(STROKE_STEPS[5], 10)
  })
})

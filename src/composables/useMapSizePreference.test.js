import { describe, it, expect } from 'vitest'
import {
  defaultMapDims, equidistanceForWidthKm, minEquidistanceForWidthKm,
  effectiveEquidistanceForWidthKm, aspectForFormat, resetMapPreferences,
  useMapSizePreference,
  DEFAULT_MAP_WIDTH_KM, MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM,
  MAP_FORMAT_OPTIONS, DEFAULT_MAP_FORMAT, MAP_EQ_OPTIONS,
} from './useMapSizePreference.js'
import { PRINT_ASPECT } from '../lib/mapBuilder.js'

describe('defaultMapDims — Standard-kartet er et fast 4 km kvadrat (v1.0.27)', () => {
  it('er 4 km bredt (ikke skjerm-skalert)', () => {
    expect(DEFAULT_MAP_WIDTH_KM).toBe(4)
    const d = defaultMapDims()
    expect(d.halfKm).toBe(2)        // 4 km bredde
    expect(2 * d.halfKm).toBe(4)
  })
  it('er et kvadrat (aspect = 1), uavhengig av skjermformat', () => {
    expect(defaultMapDims().aspect).toBe(1)
  })
})

describe('slider-grenser', () => {
  it('1–8 km (v12.0.17: maks senket fra 12 for ytelse)', () => {
    expect(MAP_SIZE_MIN_KM).toBe(1)
    expect(MAP_SIZE_MAX_KM).toBe(8)
  })
})

describe('equidistanceForWidthKm — fineste tillatte (samme gulv som «Flere valg»)', () => {
  it('Standard (null → 4 km) → 10 m', () => {
    expect(equidistanceForWidthKm(null)).toBe(10)
    expect(equidistanceForWidthKm(DEFAULT_MAP_WIDTH_KM)).toBe(10)
  })
  it('< 4 km → 5 m', () => {
    expect(equidistanceForWidthKm(1)).toBe(5)
    expect(equidistanceForWidthKm(3)).toBe(5)
  })
  it('4–6 km → 10 m', () => {
    expect(equidistanceForWidthKm(4)).toBe(10)
    expect(equidistanceForWidthKm(5)).toBe(10)
  })
  it('≥ 6 km → 20 m (også store kart)', () => {
    expect(equidistanceForWidthKm(6)).toBe(20)
    expect(equidistanceForWidthKm(14)).toBe(20)
    expect(equidistanceForWidthKm(20)).toBe(20)
  })
  it('minEquidistanceForWidthKm er samme tabell', () => {
    for (const km of [1, 3, 4, 5, 6, 8]) {
      expect(minEquidistanceForWidthKm(km)).toBe(equidistanceForWidthKm(km))
    }
  })
})

describe('format-preferansen', () => {
  it('har de tre «Flere valg»-formatene, kvadratisk som standard', () => {
    expect(MAP_FORMAT_OPTIONS.map(o => o.value)).toEqual(['square', 'portrait', 'print'])
    expect(DEFAULT_MAP_FORMAT).toBe('square')
  })
  it('aspectForFormat: kvadrat = 1, print = √2, portrett = viewportAspect', () => {
    expect(aspectForFormat('square')).toBe(1)
    expect(aspectForFormat('print')).toBeCloseTo(PRINT_ASPECT, 9)
    // I Node (ingen window) faller viewportAspect til 1; i nettleser er den
    // klampet til [1, 2.2]. Begge er gyldige her.
    const p = aspectForFormat('portrait')
    expect(p).toBeGreaterThanOrEqual(1)
    expect(p).toBeLessThanOrEqual(2.2)
  })
})

describe('effektiv ekvidistanse + Nullstill', () => {
  it('auto (null-valg) følger fineste tillatte', () => {
    resetMapPreferences()
    expect(effectiveEquidistanceForWidthKm(3)).toBe(5)
    expect(effectiveEquidistanceForWidthKm(4)).toBe(10)
    expect(effectiveEquidistanceForWidthKm(8)).toBe(20)
  })
  it('eksplisitt valg brukes når lovlig, klampes opp når bredden er for stor', () => {
    const { mapEquidistance } = useMapSizePreference()
    mapEquidistance.value = 5
    expect(effectiveEquidistanceForWidthKm(3)).toBe(5)    // lovlig
    expect(effectiveEquidistanceForWidthKm(5)).toBe(10)   // klampet (min 10)
    expect(effectiveEquidistanceForWidthKm(8)).toBe(20)   // klampet (min 20)
    mapEquidistance.value = 50
    expect(effectiveEquidistanceForWidthKm(3)).toBe(50)   // grovere enn min er alltid lov
    resetMapPreferences()
  })
  it('Nullstill setter 4 km + auto (10 m) + kvadratisk', () => {
    const { mapSizeKm, mapFormat, mapEquidistance } = useMapSizePreference()
    mapSizeKm.value = 7
    mapFormat.value = 'print'
    mapEquidistance.value = 50
    resetMapPreferences()
    expect(mapSizeKm.value).toBeNull()                       // null = 4 km-default
    expect(mapFormat.value).toBe('square')
    expect(mapEquidistance.value).toBeNull()                 // null = auto
    expect(effectiveEquidistanceForWidthKm(DEFAULT_MAP_WIDTH_KM)).toBe(10)
    expect(MAP_EQ_OPTIONS).toEqual([5, 10, 20, 25, 50])
  })
})

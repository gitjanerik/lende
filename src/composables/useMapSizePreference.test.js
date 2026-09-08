import { describe, it, expect } from 'vitest'
import {
  defaultMapDims, equidistanceForWidthKm, minEquidistanceForWidthKm,
  effectiveEquidistanceForWidthKm, aspectForFormat, resetMapPreferences,
  useMapSizePreference,
  DEFAULT_MAP_WIDTH_KM, MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM,
  MAP_FORMAT_OPTIONS, DEFAULT_MAP_FORMAT, MAP_EQ_OPTIONS, formatFraLagret,
} from './useMapSizePreference.js'
import { PRINT_ASPECT } from '../lib/mapBuilder.js'
import { BREDDE_MIN_KM, BREDDE_MAKS_KM } from '../lib/mapDensityRules.js'

describe('defaultMapDims — Standard-kartet er et fast 10 km kvadrat (v6.5.76)', () => {
  it('er 10 km bredt (ikke skjerm-skalert)', () => {
    expect(DEFAULT_MAP_WIDTH_KM).toBe(10)
    const d = defaultMapDims()
    expect(d.halfKm).toBe(5)        // 10 km bredde
    expect(2 * d.halfKm).toBe(10)
  })
  it('er et kvadrat (aspect = 1), uavhengig av skjermformat', () => {
    expect(defaultMapDims().aspect).toBe(1)
  })
})

describe('slider-grenser', () => {
  it('2–20 km (v6.5.76)', () => {
    expect(MAP_SIZE_MIN_KM).toBe(2)
    expect(MAP_SIZE_MAX_KM).toBe(20)
  })
  it('er de samme endene som tetthets-reglene måler mot', () => {
    expect(MAP_SIZE_MIN_KM).toBe(BREDDE_MIN_KM)
    expect(MAP_SIZE_MAX_KM).toBe(BREDDE_MAKS_KM)
  })
  it('standard-bredden ligger inne i spennet', () => {
    expect(DEFAULT_MAP_WIDTH_KM).toBeGreaterThanOrEqual(MAP_SIZE_MIN_KM)
    expect(DEFAULT_MAP_WIDTH_KM).toBeLessThanOrEqual(MAP_SIZE_MAX_KM)
  })
})

describe('equidistanceForWidthKm — fineste tillatte (samme gulv som «Flere valg»)', () => {
  it('Standard (null → 10 km) → 25 m, altså N50', () => {
    expect(equidistanceForWidthKm(null)).toBe(25)
    expect(equidistanceForWidthKm(0)).toBe(25)         // 0 = «ikke valgt», ikke 0 km
    expect(equidistanceForWidthKm(DEFAULT_MAP_WIDTH_KM)).toBe(25)
  })
  it('< 6 km → 10 m (fineste valg etter at 2,5 og 5 m falt bort)', () => {
    expect(equidistanceForWidthKm(2)).toBe(10)
    expect(equidistanceForWidthKm(5.5)).toBe(10)
  })
  it('6–10 km → 20 m, fra 10 km → 25 m', () => {
    expect(equidistanceForWidthKm(6)).toBe(20)
    expect(equidistanceForWidthKm(9.5)).toBe(20)
    expect(equidistanceForWidthKm(10)).toBe(25)
    expect(equidistanceForWidthKm(20)).toBe(25)
  })
  it('auto har ikke lenger et eget gulv — den ER fineste tillatte', () => {
    for (const km of [2, 4, 6, 8, 10, 20]) {
      expect(equidistanceForWidthKm(km)).toBe(minEquidistanceForWidthKm(km))
    }
  })
  it('MAP_EQ_OPTIONS er 10/20/25/50 — 2,5 og 5 m er borte (v6.5.76)', () => {
    expect(MAP_EQ_OPTIONS).toEqual([10, 20, 25, 50])
  })
})

describe('format-preferansen', () => {
  it('har de tre «Flere valg»-formatene, kvadratisk som standard', () => {
    expect(MAP_FORMAT_OPTIONS.map(o => o.value)).toEqual(['square', 'staaende', 'liggende'])
    expect(DEFAULT_MAP_FORMAT).toBe('square')
  })
  it('ingen av knappene har undertekst — ett ord per knapp (v6.5.46)', () => {
    for (const o of MAP_FORMAT_OPTIONS) expect(o.sub).toBeUndefined()
  })
  it('gamle lagrede formater migreres: begge var høye ark → stående', () => {
    expect(formatFraLagret('portrait')).toBe('staaende')
    expect(formatFraLagret('print')).toBe('staaende')
    expect(formatFraLagret('liggende')).toBe('liggende')
    expect(formatFraLagret('tull')).toBe(DEFAULT_MAP_FORMAT)
    expect(formatFraLagret(null)).toBe(DEFAULT_MAP_FORMAT)
  })
  it('aspectForFormat: kvadrat = 1, stående = √2, liggende = 1/√2', () => {
    expect(aspectForFormat('square')).toBe(1)
    expect(aspectForFormat('staaende')).toBeCloseTo(PRINT_ASPECT, 9)
    expect(aspectForFormat('liggende')).toBeCloseTo(1 / PRINT_ASPECT, 9)
    // Samme ark snudd: produktet er 1.
    expect(aspectForFormat('staaende') * aspectForFormat('liggende')).toBeCloseTo(1, 9)
    // Ukjent/utdatert verdi faller til kvadrat framfor å gi NaN-dimensjoner.
    expect(aspectForFormat('portrait')).toBe(1)
  })
})

describe('effektiv ekvidistanse + Nullstill', () => {
  it('auto (null-valg) følger fineste tillatte', () => {
    resetMapPreferences()
    expect(effectiveEquidistanceForWidthKm(4)).toBe(10)
    expect(effectiveEquidistanceForWidthKm(8)).toBe(20)
    expect(effectiveEquidistanceForWidthKm(10)).toBe(25)
  })
  it('eksplisitt valg brukes når lovlig, klampes opp når bredden er for stor', () => {
    const { mapEquidistance } = useMapSizePreference()
    mapEquidistance.value = 10
    expect(effectiveEquidistanceForWidthKm(3)).toBe(10)   // lovlig
    expect(effectiveEquidistanceForWidthKm(8)).toBe(20)   // klampet (min 20)
    expect(effectiveEquidistanceForWidthKm(10)).toBe(25)  // klampet (min 25)
    mapEquidistance.value = 50
    expect(effectiveEquidistanceForWidthKm(3)).toBe(50)   // grovere enn min er alltid lov
    resetMapPreferences()
  })
  it('Nullstill setter 10 km + auto (25 m) + kvadratisk', () => {
    const { mapSizeKm, mapFormat, mapEquidistance } = useMapSizePreference()
    mapSizeKm.value = 7
    mapFormat.value = 'liggende'
    mapEquidistance.value = 50
    resetMapPreferences()
    expect(mapSizeKm.value).toBeNull()                       // null = 10 km-default
    expect(mapFormat.value).toBe('square')
    expect(mapEquidistance.value).toBeNull()                 // null = auto
    expect(effectiveEquidistanceForWidthKm(DEFAULT_MAP_WIDTH_KM)).toBe(25)
    expect(MAP_EQ_OPTIONS).toEqual([10, 20, 25, 50])
  })
})

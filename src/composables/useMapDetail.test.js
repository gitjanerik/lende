import { describe, it, expect } from 'vitest'
import { QUALITY_PRESETS, DEFAULT_QUALITY, useMapDetail } from './useMapDetail.js'

describe('useMapDetail — kvalitets-presets', () => {
  it('har fire nivåer i rekkefølge med forventede felt', () => {
    expect(QUALITY_PRESETS.map((p) => p.id)).toEqual(['rask', 'standard', 'detaljert', 'maks'])
    for (const p of QUALITY_PRESETS) {
      expect(typeof p.label).toBe('string')
      expect(typeof p.demResM).toBe('number')
      expect(typeof p.chm).toBe('boolean')
      expect(typeof p.mbHint).toBe('string')
      expect(typeof p.desc).toBe('string')
    }
  })

  it('default er standard: 2 m, uten CHM', () => {
    expect(DEFAULT_QUALITY).toBe('standard')
    const std = QUALITY_PRESETS.find((p) => p.id === DEFAULT_QUALITY)
    expect(std.demResM).toBe(2)
    expect(std.chm).toBe(false)
  })

  it('stigen rask→maks: oppløsning finere, CHM slås på øverst', () => {
    const byId = Object.fromEntries(QUALITY_PRESETS.map((p) => [p.id, p]))
    expect(byId.rask.demResM).toBe(10)
    expect(byId.rask.chm).toBe(false)
    expect(byId.detaljert.demResM).toBe(2)
    expect(byId.detaljert.chm).toBe(true)
    expect(byId.maks.demResM).toBe(1)
    expect(byId.maks.chm).toBe(true)
  })

  it('preset følger qualityId', () => {
    const { qualityId, preset } = useMapDetail()
    qualityId.value = 'maks'
    expect(preset.value.id).toBe('maks')
    expect(preset.value.chm).toBe(true)
    qualityId.value = DEFAULT_QUALITY   // rydd opp — delt singleton
  })

  it('ugyldig id ignoreres ikke i preset (faller til standard)', () => {
    const { qualityId, preset } = useMapDetail()
    qualityId.value = 'tull'
    expect(preset.value.id).toBe('standard')   // fallback i computed
    qualityId.value = DEFAULT_QUALITY
  })
})

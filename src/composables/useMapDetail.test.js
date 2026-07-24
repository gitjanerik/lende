import { describe, it, expect } from 'vitest'
import { QUALITY_PRESETS, DEFAULT_QUALITY, useMapDetail } from './useMapDetail.js'

describe('useMapDetail — oppløsning + brytere', () => {
  it('har to oppløsnings-nivåer (rask, standard) med forventede felt', () => {
    expect(QUALITY_PRESETS.map((p) => p.id)).toEqual(['rask', 'standard'])
    for (const p of QUALITY_PRESETS) {
      expect(typeof p.label).toBe('string')
      expect(typeof p.demResM).toBe('number')
      expect(typeof p.mbHint).toBe('string')
      expect(typeof p.desc).toBe('string')
    }
  })

  it('default er standard = 2 m; rask = 10 m', () => {
    expect(DEFAULT_QUALITY).toBe('standard')
    const byId = Object.fromEntries(QUALITY_PRESETS.map((p) => [p.id, p]))
    expect(byId.standard.demResM).toBe(2)
    expect(byId.rask.demResM).toBe(10)
  })

  it('preset følger qualityId', () => {
    const { qualityId, preset } = useMapDetail()
    qualityId.value = 'rask'
    expect(preset.value.id).toBe('rask')
    expect(preset.value.demResM).toBe(10)
    qualityId.value = DEFAULT_QUALITY
  })

  it('ugyldig id faller til standard i preset', () => {
    const { qualityId, preset } = useMapDetail()
    qualityId.value = 'tull'
    expect(preset.value.id).toBe('standard')
    qualityId.value = DEFAULT_QUALITY
  })

  it('formLines og chm er uavhengige boolske brytere (default av)', () => {
    const { formLines, chm } = useMapDetail()
    expect(typeof formLines.value).toBe('boolean')
    expect(typeof chm.value).toBe('boolean')
    formLines.value = true
    expect(formLines.value).toBe(true)
    expect(chm.value).toBe(false)   // uavhengig
    formLines.value = false
  })
})

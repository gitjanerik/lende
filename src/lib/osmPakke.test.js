import { describe, it, expect } from 'vitest'
import { osmPakkeForSti, osmStiErGyldig, bakeId } from './osmPakke.js'

describe('osmPakke', () => {
  it('flisene havner i 1° × 1°-pakker', () => {
    expect(osmPakkeForSti('1198_107.json.gz')).toBe('59_10')
    expect(osmPakkeForSti('1180_100.json.gz')).toBe('59_10')
    expect(osmPakkeForSti('1199_109.json.gz')).toBe('59_10')
    expect(osmPakkeForSti('1200_110.json.gz')).toBe('60_11')
    expect(osmPakkeForSti('-1_-1.json.gz')).toBe('-1_-1')
  })
  it('delte elementer har sin egen pakke', () => {
    expect(osmPakkeForSti('delt/relation_5081.json.gz')).toBe('delt')
  })
  it('alt annet avvises', () => {
    for (const s of ['manifest.json', '../1_1.json.gz', 'delt/foo_1.json.gz', '1_1.json', 'b/x/59_10.bin']) {
      expect(osmStiErGyldig(s)).toBe(false)
      expect(osmPakkeForSti(s)).toBeNull()
    }
  })
  it('bake-id er sorterbar og trygg i en nøkkel', () => {
    expect(bakeId('2026-11-13T21:22:20Z')).toBe('20261113T212220Z')
    expect(bakeId('2026-11-14T10:44:52.972Z')).toBe('20261114T104452Z')
  })
})

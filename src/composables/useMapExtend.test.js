import { describe, it, expect } from 'vitest'
import { EXTEND_DIR_WORD, EXTEND_DIR_DEG, EXTEND_ROSE, extendZoneLabelText } from './useMapExtend.js'

// Kompassrose-utvidelsesknappene: 8 himmelretninger, hver med sin røde arm-vinkel
// og en «<Retning> i lende»-tekst. Selve SVG-tegningen (renderExtendZones) krever
// DOM og testes ikke her; vi dekker den rene retning/tekst/vinkel-logikken.

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

describe('extendZoneLabelText', () => {
  const cases = {
    N: 'Nord i lende', NE: 'Nordøst i lende', E: 'Øst i lende', SE: 'Sørøst i lende',
    S: 'Sør i lende', SW: 'Sørvest i lende', W: 'Vest i lende', NW: 'Nordvest i lende',
  }
  for (const [dir, text] of Object.entries(cases)) {
    it(`${dir} → "${text}"`, () => expect(extendZoneLabelText(dir)).toBe(text))
  }
  it('ukjent retning → tom streng', () => expect(extendZoneLabelText('XX')).toBe(''))
  it('alle tekster starter med versal og slutter på « i lende»', () => {
    for (const dir of DIRS) {
      const t = extendZoneLabelText(dir)
      expect(t.endsWith(' i lende')).toBe(true)
      expect(t[0]).toBe(t[0].toUpperCase())
    }
  })
})

describe('EXTEND_DIR_DEG — rød arm-vinkel per retning', () => {
  it('dekker alle 8 retninger', () => {
    expect(Object.keys(EXTEND_DIR_DEG).sort()).toEqual([...DIRS].sort())
  })
  it('nord = 0°, med klokka i 45°-steg', () => {
    expect(EXTEND_DIR_DEG.N).toBe(0)
    expect(EXTEND_DIR_DEG.E).toBe(90)
    expect(EXTEND_DIR_DEG.S).toBe(180)
    expect(EXTEND_DIR_DEG.W).toBe(270)
  })
  it('hver vinkel er et unikt multiplum av 45 i [0,360)', () => {
    const seen = new Set()
    for (const dir of DIRS) {
      const d = EXTEND_DIR_DEG[dir]
      expect(d % 45).toBe(0)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(360)
      expect(seen.has(d)).toBe(false)
      seen.add(d)
    }
    expect(seen.size).toBe(8)
  })
  it('vinkelen mapper til én av de 8 rose-armene (i*45)', () => {
    for (const dir of DIRS) expect(EXTEND_DIR_DEG[dir] / 45).toBe(Math.round(EXTEND_DIR_DEG[dir] / 45))
  })
})

describe('EXTEND_DIR_WORD / EXTEND_ROSE', () => {
  it('har norske ord for alle retninger', () => {
    expect(Object.keys(EXTEND_DIR_WORD).sort()).toEqual([...DIRS].sort())
    expect(EXTEND_DIR_WORD.NE).toBe('nordøst')
  })
  it('rose-paletten har en rød aksent', () => {
    expect(EXTEND_ROSE.red).toBe('#d8392c')
    expect(EXTEND_ROSE.grey).toMatch(/^#/)
  })
})

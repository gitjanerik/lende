import { describe, it, expect } from 'vitest'
import { klemMinutter, minutterIgjen, andelIgjen, ringDash, MAKS_MINUTTER } from './holdVaken.js'

describe('klemMinutter', () => {
  it('holder seg i [0, 60] og runder til hele minutter', () => {
    expect(klemMinutter(0)).toBe(0)
    expect(klemMinutter(-5)).toBe(0)
    expect(klemMinutter(12.4)).toBe(12)
    expect(klemMinutter(999)).toBe(MAKS_MINUTTER)
    expect(klemMinutter('20')).toBe(20)
    expect(klemMinutter(NaN)).toBe(0)
  })
})

describe('minutterIgjen', () => {
  it('runder OPP, så 0 først vises når tida faktisk er ute', () => {
    expect(minutterIgjen(60_000)).toBe(1)
    expect(minutterIgjen(1)).toBe(1)
    expect(minutterIgjen(0)).toBe(0)
    expect(minutterIgjen(-100)).toBe(0)
    expect(minutterIgjen(29 * 60_000 + 1)).toBe(30)
  })
})

describe('andelIgjen', () => {
  it('er 1 ved start, 0 ved slutt og klemmes utenfor', () => {
    expect(andelIgjen(600_000, 600_000)).toBe(1)
    expect(andelIgjen(300_000, 600_000)).toBe(0.5)
    expect(andelIgjen(-1, 600_000)).toBe(0)
    expect(andelIgjen(900_000, 600_000)).toBe(1)
    expect(andelIgjen(100, 0)).toBe(0)
  })
})

describe('ringDash', () => {
  const C = 100

  it('tegner hele ringen ved full andel', () => {
    expect(ringDash(1, C)).toEqual({ dasharray: '100 100', dashoffset: '0' })
  })

  it('spiser MED klokka: streken starter senere, enden står fast på toppen', () => {
    // Halv tid igjen → siste halvdel av omkretsen er tegnet (fra 50 til 100),
    // altså er den FØRSTE halvparten — den med klokka fra toppen — borte.
    expect(ringDash(0.5, C)).toEqual({ dasharray: '50 100', dashoffset: '-50' })
    expect(ringDash(0.1, C)).toEqual({ dasharray: '10 100', dashoffset: '-90' })
  })

  it('tegner ingenting ved null', () => {
    expect(ringDash(0, C).dasharray).toBe('0 100')
  })
})

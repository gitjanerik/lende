import { describe, it, expect } from 'vitest'
import { tabbbare, nesteFokus, FOKUSERBART } from './fokusFelle.js'

const el = (o = {}) => ({
  disabled: false,
  attrs: o.attrs ?? {},
  getAttribute(n) { return this.attrs[n] ?? null },
  ...o,
})

describe('tabbbare', () => {
  it('slipper gjennom vanlige kontroller', () => {
    const a = el(), b = el()
    expect(tabbbare([a, b], () => true)).toEqual([a, b])
  })

  it('luker ut deaktiverte, skjulte og tabindex=-1', () => {
    const ok = el()
    const av = el({ disabled: true })
    const skjult = el({ attrs: { 'aria-hidden': 'true' } })
    const utenfor = el({ attrs: { tabindex: '-1' } })
    const usynlig = el()
    const liste = tabbbare([ok, av, skjult, utenfor, usynlig], (e) => e !== usynlig)
    expect(liste).toEqual([ok])
  })

  it('utvalget dekker de vanlige kontrollene og ikke tabindex=-1', () => {
    expect(FOKUSERBART).toContain('button')
    expect(FOKUSERBART).toContain('[tabindex]')
    expect(FOKUSERBART).not.toContain('tabindex="-1"')
  })
})

describe('nesteFokus', () => {
  const l = ['a', 'b', 'c']

  it('lar nettleseren gjøre jobben midt i lista', () => {
    expect(nesteFokus(l, 'b', false)).toBeNull()
    expect(nesteFokus(l, 'b', true)).toBeNull()
  })

  it('vikler rundt i begge ender', () => {
    expect(nesteFokus(l, 'c', false)).toBe('a')
    expect(nesteFokus(l, 'a', true)).toBe('c')
  })

  it('drar fokus inn når det står utenfor', () => {
    expect(nesteFokus(l, 'utenfor', false)).toBe('a')
    expect(nesteFokus(l, 'utenfor', true)).toBe('c')
    expect(nesteFokus(l, null, false)).toBe('a')
  })

  it('svarer null på en tom felle — ellers ville den fanget fokus i ingenting', () => {
    expect(nesteFokus([], 'a', false)).toBeNull()
  })
})

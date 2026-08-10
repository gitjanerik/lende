import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  standardPinPrefs, lesPinPrefs, skrivPinPrefs, paaGrupper, filtrerPaaPrefs,
} from './pinPrefs.js'
import { PIN_GROUPS } from './exploreData.js'

const NOKKEL = 'lende-3d-pins'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
})

describe('standardPinPrefs', () => {
  it('slår alle gruppene på', () => {
    const p = standardPinPrefs()
    expect(Object.keys(p).sort()).toEqual(PIN_GROUPS.map(g => g.key).sort())
    expect(Object.values(p).every(v => v === true)).toBe(true)
  })
})

describe('lesPinPrefs', () => {
  it('gir standardvalg uten lagret state', () => {
    expect(lesPinPrefs()).toEqual(standardPinPrefs())
  })

  it('leser lagrede valg tilbake', () => {
    const key = PIN_GROUPS[0].key
    skrivPinPrefs({ ...standardPinPrefs(), [key]: false })
    expect(lesPinPrefs()[key]).toBe(false)
  })

  it('gir nye grupper default på, så de ikke blir usynlige for gamle brukere', () => {
    // Lagret state fra en versjon som bare kjente én gruppe.
    localStorage.setItem(NOKKEL, JSON.stringify({ [PIN_GROUPS[0].key]: false }))
    const p = lesPinPrefs()
    expect(p[PIN_GROUPS[0].key]).toBe(false)
    for (const g of PIN_GROUPS.slice(1)) expect(p[g.key]).toBe(true)
  })

  it('faller tilbake til standard på ødelagt JSON', () => {
    localStorage.setItem(NOKKEL, '{ikke json')
    expect(lesPinPrefs()).toEqual(standardPinPrefs())
  })

  it('overlever at localStorage kaster (privat modus)', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('nei') },
      setItem() { throw new Error('nei') },
    })
    expect(lesPinPrefs()).toEqual(standardPinPrefs())
    expect(() => skrivPinPrefs(standardPinPrefs())).not.toThrow()
  })
})

describe('paaGrupper', () => {
  it('gir settet med påslåtte nøkler', () => {
    expect(paaGrupper({ a: true, b: false, c: true })).toEqual(new Set(['a', 'c']))
  })

  it('tåler null', () => {
    expect(paaGrupper(null).size).toBe(0)
  })
})

describe('filtrerPaaPrefs', () => {
  it('beholder bare features i påslåtte grupper', () => {
    const alle = standardPinPrefs()
    const features = [
      { kind: 'peak', name: 'Topp' },
      { kind: 'vann-navn', name: 'Vann' },
    ]
    expect(filtrerPaaPrefs(features, alle)).toHaveLength(2)

    // Slå av gruppa toppen hører til — da skal bare vannet stå igjen.
    const igjen = filtrerPaaPrefs(features, { ...alle, topp: false })
    expect(igjen.map(f => f.kind)).toEqual(['vann-navn'])
  })

  it('tåler tom liste', () => {
    expect(filtrerPaaPrefs(null, standardPinPrefs())).toEqual([])
  })
})

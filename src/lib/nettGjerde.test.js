import { describe, it, expect, beforeEach } from 'vitest'
import {
  AUTO_NABO_OKTTAK, OKT_KEY,
  lesOktTeller, oktTakNadd, okOkt, nullstillOkt,
} from './nettGjerde.js'

// Map-basert lager i stedet for sessionStorage: testene skal si noe om
// telleren, ikke om nettleser-API-et.
let lager
let lesLager, skrivLager
beforeEach(() => {
  lager = new Map()
  lesLager = (k) => (lager.has(k) ? lager.get(k) : null)
  skrivLager = (k, v) => { lager.set(k, String(v)) }
})

describe('lesOktTeller', () => {
  it('tomt lager → 0', () => {
    expect(lesOktTeller({ lesLager })).toBe(0)
  })
  it('leser tallet som står der', () => {
    lager.set(OKT_KEY, '7')
    expect(lesOktTeller({ lesLager })).toBe(7)
  })
  it('ødelagt eller ikke-numerisk verdi → 0, aldri NaN', () => {
    for (const skrot of ['', 'tolv', '{}', 'null', undefined]) {
      lager.set(OKT_KEY, skrot)
      const n = lesOktTeller({ lesLager })
      expect(Number.isNaN(n)).toBe(false)
      expect(n).toBe(0)
    }
  })
  it('negativ verdi → 0', () => {
    lager.set(OKT_KEY, '-4')
    expect(lesOktTeller({ lesLager })).toBe(0)
  })
})

describe('okOkt', () => {
  it('teller opp og returnerer ny verdi', () => {
    expect(okOkt({ lesLager, skrivLager })).toBe(1)
    expect(okOkt({ lesLager, skrivLager })).toBe(2)
    expect(lesOktTeller({ lesLager })).toBe(2)
  })
  it('starter på 1 også når lagerverdien er skrot', () => {
    lager.set(OKT_KEY, 'tolv')
    expect(okOkt({ lesLager, skrivLager })).toBe(1)
  })
})

describe('oktTakNadd', () => {
  it('under taket → false', () => {
    lager.set(OKT_KEY, String(AUTO_NABO_OKTTAK - 1))
    expect(oktTakNadd({ lesLager })).toBe(false)
  })
  it('nøyaktig på taket → true', () => {
    lager.set(OKT_KEY, String(AUTO_NABO_OKTTAK))
    expect(oktTakNadd({ lesLager })).toBe(true)
  })
  it('over taket → true', () => {
    lager.set(OKT_KEY, String(AUTO_NABO_OKTTAK + 5))
    expect(oktTakNadd({ lesLager })).toBe(true)
  })
  it('taket kan overstyres av kalleren', () => {
    lager.set(OKT_KEY, '3')
    expect(oktTakNadd({ lesLager, tak: 3 })).toBe(true)
    expect(oktTakNadd({ lesLager, tak: 4 })).toBe(false)
  })
  it('nås etter AUTO_NABO_OKTTAK opptellinger', () => {
    for (let i = 0; i < AUTO_NABO_OKTTAK - 1; i++) okOkt({ lesLager, skrivLager })
    expect(oktTakNadd({ lesLager })).toBe(false)
    okOkt({ lesLager, skrivLager })
    expect(oktTakNadd({ lesLager })).toBe(true)
  })
})

describe('nullstillOkt', () => {
  it('setter telleren tilbake til 0 og åpner taket igjen', () => {
    for (let i = 0; i < AUTO_NABO_OKTTAK; i++) okOkt({ lesLager, skrivLager })
    expect(oktTakNadd({ lesLager })).toBe(true)
    nullstillOkt({ skrivLager })
    expect(lesOktTeller({ lesLager })).toBe(0)
    expect(oktTakNadd({ lesLager })).toBe(false)
  })
})

describe('standard-lageret (sessionStorage) er fail-safe', () => {
  // I node finnes ikke sessionStorage i det hele tatt; i privat modus kaster
  // den. Ingen av delene skal velte flis-lastingen.
  it('kaster ikke uten sessionStorage', () => {
    expect(() => lesOktTeller()).not.toThrow()
    expect(lesOktTeller()).toBe(0)
    expect(() => okOkt()).not.toThrow()
    expect(() => nullstillOkt()).not.toThrow()
    expect(() => oktTakNadd()).not.toThrow()
  })
})

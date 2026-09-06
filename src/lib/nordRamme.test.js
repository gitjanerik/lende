import { describe, it, expect } from 'vitest'
import { roterRamme } from './nordRamme.js'

describe('roterRamme', () => {
  it('lar ramma stå urørt ved 0°', () => {
    const r = roterRamme({ widthM: 2000, heightM: 2000, rotDeg: 0 })
    expect(r.widthM).toBe(2000)
    expect(r.heightM).toBe(2000)
    expect(r.vekst).toBe(1)
  })

  it('gir samme ramme for +v og −v — bare størrelsen på vinkelen teller', () => {
    const a = roterRamme({ widthM: 2000, heightM: 1400, rotDeg: 7.8 })
    const b = roterRamme({ widthM: 2000, heightM: 1400, rotDeg: -7.8 })
    expect(a.widthM).toBe(b.widthM)
    expect(a.heightM).toBe(b.heightM)
  })

  it('treffer de målte kostnadene', () => {
    // Tallene som begrunner at rotasjonen er en OPSJON og ikke standard.
    expect(roterRamme({ widthM: 2000, heightM: 2000, rotDeg: 3.2 }).vekst).toBeCloseTo(1.111, 2)
    expect(roterRamme({ widthM: 2000, heightM: 2000, rotDeg: 7.8 }).vekst).toBeCloseTo(1.269, 2)
    expect(roterRamme({ widthM: 2000, heightM: 2000, rotDeg: 19.85 }).vekst).toBeCloseTo(1.639, 2)
  })

  it('en 45°-rotasjon av et kvadrat gir omrisset √2 ganger så bredt', () => {
    const r = roterRamme({ widthM: 100, heightM: 100, rotDeg: 45 })
    expect(r.widthM).toBeCloseTo(100 * Math.SQRT2, 3)
    expect(r.heightM).toBeCloseTo(100 * Math.SQRT2, 3)
  })

  it('sentrerer arket i den nye ramma — rotasjonen går om rammas midtpunkt', () => {
    const r = roterRamme({ widthM: 2000, heightM: 1000, rotDeg: 10 })
    const [, , rx, ry] = /rotate\(([-\d.]+) ([\d.]+) ([\d.]+)\)/.exec(r.transform)
    expect(Number(rx)).toBeCloseTo(r.widthM / 2, 3)
    expect(Number(ry)).toBeCloseTo(r.heightM / 2, 3)
    const [, dx, dy] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(r.transform)
    expect(Number(dx)).toBeCloseTo((r.widthM - 2000) / 2, 3)
    expect(Number(dy)).toBeCloseTo((r.heightM - 1000) / 2, 3)
  })

  it('tar hensyn til et viewBox som ikke starter i origo', () => {
    const r = roterRamme({ minX: 500, minY: 250, widthM: 1000, heightM: 1000, rotDeg: 0 })
    const [, dx, dy] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(r.transform)
    expect(Number(dx)).toBeCloseTo(-500, 3)
    expect(Number(dy)).toBeCloseTo(-250, 3)
  })

  it('svarer null på ugyldig geometri i stedet for å kaste', () => {
    expect(roterRamme({ widthM: 0, heightM: 100, rotDeg: 5 })).toBeNull()
    expect(roterRamme({ widthM: NaN, heightM: 100, rotDeg: 5 })).toBeNull()
  })
})

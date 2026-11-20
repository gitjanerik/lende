import { describe, it, expect } from 'vitest'
import { makeCoords } from './coords.js'
import {
  dybdeGrad, undervannsMorke, undervannsFarge, undervannsDis, dypestePunkt,
  iInnsjoen, utenInnsjoNaler, undervannsGulv, dykkSekvens, oppSekvens, ekteDybde,
  MORKE_TAK,
} from './innsjoDykk.js'

// 4 × 3 celler à 10 m; innsjøen er de fire midtre, dypest i (2,1).
const grid = { cols: 4, rows: 3, transform: { pixelWidth: 10, pixelHeight: 10 } }
const bunn = {
  maske: Uint8Array.from([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0]),
  dybde: Float32Array.from([0, 0, 0, 0, 0, 12, 40, 0, 0, 8, 20, 0]),
}

describe('mørket', () => {
  it('er null i overflata og mettes ved taket, ikke svart', () => {
    expect(undervannsMorke(0)).toBe(0)
    expect(undervannsMorke(5)).toBeCloseTo(0.196, 2)
    expect(undervannsMorke(30)).toBeCloseTo(0.378, 2)
    expect(undervannsMorke(288)).toBe(MORKE_TAK)
    expect(undervannsMorke(514)).toBe(MORKE_TAK)
    expect(MORKE_TAK).toBeLessThan(0.7)
  })
  it('vokser monotont', () => {
    let forrige = -1
    for (let d = 0; d <= 300; d += 5) {
      expect(dybdeGrad(d)).toBeGreaterThanOrEqual(forrige)
      forrige = dybdeGrad(d)
    }
  })
  it('fargen går fra grunn til dyp blå', () => {
    expect(undervannsFarge(0)).toBe(0x2f7fc4)
    expect(undervannsFarge(1000)).toBe(0x0b2540)
  })
  it('disen lar flata skimtes uansett dybde', () => {
    const { far } = undervannsDis(288, 600)
    expect(far).toBeGreaterThan(600)
    expect(undervannsDis(0, 0).far).toBe(400)
    expect(undervannsDis(150, 0).far).toBe(120)
  })
})

describe('dykkepunktet og nålene', () => {
  it('dypestePunkt finner cella med størst dybde innenfor masken', () => {
    expect(dypestePunkt(bunn, grid)).toEqual({ c: 2, r: 1, x: 20, y: 10, dybde: 40 })
    expect(dypestePunkt({ maske: new Uint8Array(12), dybde: new Float32Array(12) }, grid)).toBeNull()
  })
  it('fjerner bare vann-nålene inne i innsjøen', () => {
    const f = [
      { kind: 'vann-navn', x: 20, y: 10 },
      { kind: 'vann-omrade', x: 11, y: 19 },
      { kind: 'vann-navn', x: 0, y: 0 },
      { kind: 'topp', x: 20, y: 10 },
    ]
    expect(iInnsjoen(bunn, grid, 20, 10)).toBe(true)
    expect(iInnsjoen(bunn, grid, -50, 10)).toBe(false)
    expect(utenInnsjoNaler(f, bunn, grid).map(x => x.kind)).toEqual(['vann-navn', 'topp'])
    expect(utenInnsjoNaler(f, null, grid)).toBe(f)
  })
})

describe('gulvet under vann', () => {
  const coords = makeCoords({ widthM: 30, heightM: 20, exaggeration: 1 })
  const dem = (h) => ({
    data: new Float32Array(12).fill(h), cols: 4, rows: 3, noData: -9999,
    transform: { pixelWidth: 10, pixelHeight: 10 },
  })
  it('følger den senkede bunnen og står under flata', () => {
    const g = undervannsGulv(dem(60), coords, 0, 0, 100)
    expect(g).toBeGreaterThan(60)
    expect(g).toBeLessThanOrEqual(68)
    expect(g).toBeLessThan(100)
  })
  it('klemmes under flata også der bunnen er grunn', () => {
    expect(undervannsGulv(dem(99.5), coords, 0, 0, 100)).toBe(98)
  })
})

describe('kamerabanen', () => {
  const p = { x: 5, z: -3, flateY: 100, bunnY: 20 }
  it('ned: inn, flate, ned, bunn — og ender over dykkepunktet', () => {
    const s = dykkSekvens(p)
    expect(s.map(t => t.fase)).toEqual(['inn', 'flate', 'ned', 'bunn'])
    expect(s[0].pos[1]).toBeGreaterThan(p.flateY)
    expect(s[1].pos[1]).toBeLessThan(p.flateY)
    expect(s.at(-1).pos).toEqual([5, 20, -3])
    expect(s.at(-1).hoyde).toBeGreaterThan(0)
    expect(s.every(t => t.tid > 0)).toBe(true)
  })
  it('nedstigningen tar lengre tid jo dypere', () => {
    const grunn = dykkSekvens({ ...p, bunnY: 90 })[2].tid
    const dyp = dykkSekvens({ ...p, bunnY: -400 })[2].tid
    expect(dyp).toBeGreaterThan(grunn)
    expect(dyp).toBeLessThanOrEqual(1.5)
  })
  it('redusert bevegelse er ett kutt, begge veier', () => {
    expect(dykkSekvens({ ...p, redusert: true })).toHaveLength(1)
    expect(dykkSekvens({ ...p, redusert: true })[0].tid).toBe(0)
    const opp = oppSekvens({ ...p, redusert: true })
    expect(opp).toHaveLength(1)
    expect(opp[0].pos[1]).toBeGreaterThan(p.flateY)
  })
  it('opp: gjennom flata og over den', () => {
    const s = oppSekvens(p)
    expect(s.map(t => t.fase)).toEqual(['opp', 'over'])
    expect(s[0].pos[1]).toBeLessThan(p.flateY)
    expect(s[1].pos[1]).toBeGreaterThan(p.flateY)
  })
})

describe('ekteDybde', () => {
  it('deler bort både overdrivelsen og dybde-forsterkningen', () => {
    const coords = makeCoords({ widthM: 10, heightM: 10, exaggeration: 1.5 })
    expect(ekteDybde({ camY: 100 - 1.5 * 2 * 50, flateY: 100, coords, faktor: 2 })).toBeCloseTo(50)
    expect(ekteDybde({ camY: 120, flateY: 100, coords, faktor: 2 })).toBe(0)
  })
})

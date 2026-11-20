import { describe, it, expect } from 'vitest'
import { makeCoords } from './coords.js'
import {
  dybdeGrad, undervannsMorke, undervannsFarge, undervannsDis, dypestePunkt,
  iInnsjoen, utenInnsjoNaler, undervannsGulv, dykkSekvens, oppSekvens, ekteDybde,
  MORKE_TAK, bunnRelieff, bratteVegg, dykkeTur, asimutMot,
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
    expect(undervannsMorke(5)).toBeCloseTo(0.107, 2)
    expect(undervannsMorke(30)).toBeCloseTo(0.206, 2)
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
    expect(undervannsFarge(0)).toBe(0x4f9fdc)
    expect(undervannsFarge(1000)).toBe(0x1d5684)
  })
  it('disen lar flata skimtes uansett dybde', () => {
    const { far } = undervannsDis(288, 600)
    expect(far).toBeGreaterThan(600)
    expect(undervannsDis(0, 0).far).toBe(700)
    expect(undervannsDis(150, 0).far).toBe(300)
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

describe('bunnRelieff', () => {
  const g = { cols: 5, rows: 5, transform: { pixelWidth: 10, pixelHeight: 10 } }
  const alle = new Uint8Array(25).fill(1)
  const felt = (f) => Float32Array.from({ length: 25 }, (_, i) => f(i % 5, Math.floor(i / 5)))
  it('er 1 på flat bunn', () => {
    expect(bunnRelieff(felt(() => -50), alle, g)[12]).toBeCloseTo(1)
  })
  it('lyser opp en skråning mot nordvest og skygger en mot sørøst', () => {
    // Stiger mot sørøst: flata vender mot nordvest, der lyset står.
    const motNv = bunnRelieff(felt((c, r) => (c + r) * 5), alle, g)[12]
    const motSo = bunnRelieff(felt((c, r) => -(c + r) * 5), alle, g)[12]
    expect(motNv).toBeGreaterThan(1)
    expect(motSo).toBeLessThan(1)
  })
  it('lar celler utenfor innsjøen stå på 1', () => {
    const maske = new Uint8Array(25)
    expect(bunnRelieff(felt((c) => c * 50), maske, g)[12]).toBe(1)
  })
})

describe('bratteVegg', () => {
  // 7 × 5: vann i kolonne 1–5, rad 1–3. Østsida er dyp med fjell bak.
  const g = { cols: 7, rows: 5, transform: { pixelWidth: 20, pixelHeight: 20 } }
  const maske = new Uint8Array(35)
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 5; c++) maske[r * 7 + c] = 1
  const H = new Float32Array(35).fill(110)
  for (let r = 0; r < 5; r++) H[r * 7 + 6] = 400
  for (let r = 1; r <= 3; r++) { H[r * 7 + 1] = 95; H[r * 7 + 2] = 90; H[r * 7 + 3] = 70; H[r * 7 + 4] = 40; H[r * 7 + 5] = 20 }
  it('velger strandcella med mest fall under og fjell over', () => {
    const v = bratteVegg(H, maske, g, 100, { c: 3, r: 2 }, { radiusM: 20 })
    expect(v.c).toBe(5)
    expect(v.x).toBe(100)
  })
  it('hopper over en vegg bak land', () => {
    const m2 = Uint8Array.from(maske)
    for (let r = 1; r <= 3; r++) m2[r * 7 + 4] = 0
    const v = bratteVegg(H, m2, g, 100, { c: 2, r: 2 }, { radiusM: 20 })
    expect(v.c).toBeLessThan(4)
  })
})

describe('dykkeTur', () => {
  const p = {
    fra: { x: 0, y: -400, z: 0 }, mot: { x: 1000, z: 0 }, flateY: 0,
    gulv: (x) => -400 + x * 0.35,
  }
  it('snur mot veggen, glir langs bunnen og stiger til like under flata', () => {
    const s = dykkeTur(p)
    expect(s[0].fase).toBe('snu')
    expect(s.at(-1).fase).toBe('stig')
    expect(s.at(-1).pos[1]).toBe(-3)
    expect(s.at(-1).hoyde).toBeGreaterThan(0)
    for (const t of s) {
      expect(t.azimut).toBeCloseTo(Math.PI / 2)
      expect(t.pos[1]).toBeLessThanOrEqual(-3)
      expect(t.pos[1]).toBeGreaterThanOrEqual(p.gulv(t.pos[0]) - 1e-9 - (t.fase === 'snu' ? 1 : 0))
      expect(t.pos[0]).toBeLessThan(1000)
    }
    const total = s.reduce((sum, t) => sum + t.tid, 0)
    expect(total).toBeGreaterThan(8)
    expect(total).toBeLessThan(30)
  })
  it('har sammenhengende fart i skjøtene mellom glidestrekkene', () => {
    const glid = dykkeTur(p).filter(t => t.fase === 'glid')
    expect(glid[0].ease).toBe('inn-kvad')
    expect(glid.at(-1).ease).toBe('ut-kvad')
    expect(glid[0].tid).toBeCloseTo(2 * glid[1].tid)
  })
  it('redusert bevegelse er ett kutt til sluttposen', () => {
    const s = dykkeTur({ ...p, redusert: true })
    expect(s).toHaveLength(1)
    expect(s[0].tid).toBe(0)
  })
  it('asimutMot: nord 0, øst π/2 (Z er sør)', () => {
    expect(asimutMot(0, 0, 0, -10)).toBeCloseTo(0)
    expect(asimutMot(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2)
  })
})

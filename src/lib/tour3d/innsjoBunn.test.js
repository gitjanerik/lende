import { describe, it, expect } from 'vitest'
import { rasterMaske, erLukket, byggInnsjoBunn, autoDybdeFaktor, senketDem } from './innsjoBunn.js'

const sirkel = (cx, cy, r, n = 64) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * 2 * Math.PI
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })

function flatDem(cols = 50, rows = 50, hoyde = 100) {
  return {
    cols, rows, noData: -9999,
    transform: { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
    data: new Float32Array(cols * rows).fill(hoyde),
  }
}

describe('rasterMaske', () => {
  it('fyller en sirkel og lar et hull stå tomt (even-odd)', () => {
    const dem = flatDem()
    const m = rasterMaske(dem, [sirkel(250, 250, 150), sirkel(250, 250, 40)])
    expect(m[25 * 50 + 25]).toBe(0)
    expect(m[25 * 50 + 15]).toBe(1)
    expect(m[0]).toBe(0)
    const n = m.reduce((s, v) => s + v, 0)
    expect(n).toBeGreaterThan(600)
    expect(n).toBeLessThan(720)
  })
})

describe('erLukket', () => {
  it('skiller ring fra åpen linje', () => {
    expect(erLukket(sirkel(0, 0, 100))).toBe(true)
    expect(erLukket([[0, 0], [10, 0], [20, 0], [30, 0]])).toBe(false)
  })
})

describe('byggInnsjoBunn', () => {
  const innsjo = {
    omriss: [sirkel(250, 250, 150)],
    kurver: [
      { dybde: 5, type: 0, punkter: sirkel(250, 250, 100) },
      { dybde: 10, type: 0, punkter: sirkel(250, 250, 50) },
    ],
  }

  it('treffer kurvene, er dypest i midten og grunnest mot land', () => {
    const dem = flatDem()
    const b = byggInnsjoBunn(dem, innsjo)
    expect(b.nivaa).toBe(100)
    expect(b.maksDybde).toBe(10)
    const at = (x, y) => b.dybde[Math.round(y / 10) * 50 + Math.round(x / 10)]
    expect(at(250, 250)).toBeCloseTo(10, 1)
    expect(at(350, 250)).toBeCloseTo(5, 1)
    const midt = at(375, 250)
    expect(midt).toBeGreaterThan(0.5)
    expect(midt).toBeLessThan(5)
    const mellom = at(325, 250)
    expect(mellom).toBeGreaterThan(5)
    expect(mellom).toBeLessThan(10)
    expect(Number.isNaN(b.dybde[0])).toBe(true)
  })

  it('holder en lukket øy-grense tørr selv når omrisset ikke har hullet', () => {
    const dem = flatDem()
    const b = byggInnsjoBunn(dem, {
      omriss: innsjo.omriss,
      kurver: [...innsjo.kurver, { dybde: 0, type: 2, punkter: sirkel(330, 250, 25) }],
    })
    expect(b.maske[25 * 50 + 33]).toBe(0)
  })

  it('tar nivået fra stranda når vannflata mangler høyde', () => {
    const dem = flatDem()
    const m = rasterMaske(dem, innsjo.omriss)
    for (let i = 0; i < m.length; i++) if (m[i]) dem.data[i] = -9999
    expect(byggInnsjoBunn(dem, innsjo).nivaa).toBe(100)
  })

  it('returnerer null uten omriss', () => {
    expect(byggInnsjoBunn(flatDem(), { omriss: [], kurver: [] })).toBeNull()
  })
})

describe('senketDem / autoDybdeFaktor', () => {
  it('senker bare masken, med faktoren', () => {
    const dem = flatDem()
    const b = byggInnsjoBunn(dem, { omriss: [sirkel(250, 250, 150)], kurver: [{ dybde: 10, type: 0, punkter: sirkel(250, 250, 50) }] })
    const s = senketDem(dem, b, 2)
    expect(s.data[25 * 50 + 25]).toBeCloseTo(80, 0)
    expect(s.data[0]).toBe(100)
    expect(dem.data[25 * 50 + 25]).toBe(100)
  })

  it('forsterker en grunn innsjø, ikke en dyp', () => {
    const dem = flatDem()
    const grunn = { maksDybde: 2, celler: 700 }
    const dyp = { maksDybde: 400, celler: 700 }
    expect(autoDybdeFaktor(grunn, dem)).toBeGreaterThan(1)
    expect(autoDybdeFaktor(dyp, dem)).toBe(1)
  })
})

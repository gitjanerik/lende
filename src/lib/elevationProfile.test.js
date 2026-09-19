import { describe, it, expect } from 'vitest'
import { sampleProfile, buildProfilePath } from './elevationProfile.js'

// Et flatt 1 000 × 1 000 m DEM med en jevn rampe i x: høyden er x/10, altså
// 0 m i vest og 100 m i øst. Transform-formen er demSampling sin.
function rampeDem() {
  const cols = 101, rows = 101
  const data = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) data[r * cols + c] = c
  }
  return {
    data, cols, rows, noData: -9999,
    // 10 m per piksel, y ned fra arkets topp — samme kontrakt som sampleElevation.
    transform: { pixelWidth: 10, pixelHeight: 10 },
  }
}

const spor = { points: [{ x: 0, y: 500 }, { x: 990, y: 500 }] }

describe('sampleProfile — punktskala (v7.9.6)', () => {
  it('uten punktskala er svaret uendret (rutemeter)', () => {
    const p = sampleProfile(spor, rampeDem())
    expect(p.totalDistM).toBeCloseTo(990, 6)
    expect(p.samples[0].distM).toBe(0)
    expect(p.samples.at(-1).distM).toBeCloseTo(990, 6)
  })

  it('deler AVSTANDENE på k — 1 000 rutemeter er 992,4 bakkemeter i Vardø', () => {
    const k = 1.00769
    const p = sampleProfile(spor, rampeDem(), k)
    expect(p.totalDistM).toBeCloseTo(990 / k, 6)
    expect(p.samples.at(-1).distM).toBeCloseTo(990 / k, 6)
  })

  it('rører IKKE høyde, stigning eller fall — k er en skala i planet', () => {
    const a = sampleProfile(spor, rampeDem())
    const b = sampleProfile(spor, rampeDem(), 1.00769)
    expect(b.totalAscent).toBeCloseTo(a.totalAscent, 9)
    expect(b.totalDescent).toBeCloseTo(a.totalDescent, 9)
    expect(b.minElev).toBeCloseTo(a.minElev, 9)
    expect(b.maxElev).toBeCloseTo(a.maxElev, 9)
    expect(b.samples.map(s => s.elev)).toEqual(a.samples.map(s => s.elev))
  })

  it('samplingen skjer i SVG-rom — DEM-oppslaget er upåvirket av k', () => {
    // Regnet man om FØR samplingen, ville x-en bommet og høydene blitt andre.
    const p = sampleProfile(spor, rampeDem(), 1.05)
    expect(p.samples[0].elev).toBeCloseTo(0, 3)
    expect(p.samples.at(-1).elev).toBeCloseTo(99, 3)
  })

  it('buildProfilePath er skala-invariant — den tegner forholdet d/total', () => {
    const a = buildProfilePath(sampleProfile(spor, rampeDem()), 100, 40)
    const b = buildProfilePath(sampleProfile(spor, rampeDem(), 1.00769), 100, 40)
    expect(b.line).toBe(a.line)
    expect(b.area).toBe(a.area)
  })
})

import { describe, it, expect } from 'vitest'
import { createPlayback, buildCumulativeAscent, defaultTimeScale } from './playback.js'

describe('defaultTimeScale', () => {
  it('kort tur (< 3 km) → 64×', () => {
    expect(defaultTimeScale(2999)).toBe(64)
    expect(defaultTimeScale(500)).toBe(64)
  })
  it('mellomlang tur (3–12 km) → 128×', () => {
    expect(defaultTimeScale(3000)).toBe(128)
    expect(defaultTimeScale(12000)).toBe(128)
  })
  it('lang tur (> 12 km) → 256×', () => {
    expect(defaultTimeScale(12001)).toBe(256)
    expect(defaultTimeScale(40000)).toBe(256)
  })
  it('ukjent lengde → 128× (gammel default)', () => {
    expect(defaultTimeScale(undefined)).toBe(128)
    expect(defaultTimeScale(NaN)).toBe(128)
  })
})

describe('createPlayback', () => {
  it('tick avanserer med kmh/3.6 · timeScale · dt', () => {
    const pb = createPlayback({ totalM: 10000, speedKmh: 3.6, timeScale: 10 })
    pb.play()
    pb.tick(0.1)
    expect(pb.alongM).toBeCloseTo(1, 6)
  })

  it('spiller ikke før play(), og pause stopper', () => {
    const pb = createPlayback({ totalM: 1000 })
    pb.tick(1)
    expect(pb.alongM).toBe(0)
    pb.play()
    pb.tick(0.05)
    const d = pb.alongM
    expect(d).toBeGreaterThan(0)
    pb.pause()
    pb.tick(1)
    expect(pb.alongM).toBe(d)
  })

  it('dt klampes til 100 ms (tab-bytte-spike)', () => {
    const pb = createPlayback({ totalM: 1e6, speedKmh: 3.6, timeScale: 1 })
    pb.play()
    pb.tick(60)
    expect(pb.alongM).toBeCloseTo(0.1, 6)
  })

  it('klemmer ved slutten og setter finished', () => {
    const pb = createPlayback({ totalM: 10, speedKmh: 36, timeScale: 100 })
    pb.play()
    const r = pb.tick(0.1)
    expect(r.finished).toBe(true)
    expect(pb.alongM).toBe(10)
    expect(pb.playing).toBe(false)
  })

  it('seek klemmer til [0, totalM] og restart nullstiller', () => {
    const pb = createPlayback({ totalM: 100 })
    pb.seek(-5)
    expect(pb.alongM).toBe(0)
    pb.seek(500)
    expect(pb.alongM).toBe(100)
    expect(pb.finished).toBe(true)
    pb.restart()
    expect(pb.alongM).toBe(0)
    expect(pb.playing).toBe(true)
  })

  it('speedFactor demper framdriften', () => {
    const pb = createPlayback({ totalM: 1000, speedKmh: 3.6, timeScale: 10 })
    pb.play()
    pb.setSpeedFactor(0.5)
    pb.tick(0.1)
    expect(pb.alongM).toBeCloseTo(0.5, 6)
    pb.setSpeedFactor(0)
    pb.tick(0.1)
    expect(pb.alongM).toBeCloseTo(0.5, 6)
  })

  it('ETA bruker estWalkMinutes med gjenværende distanse og klatring', () => {
    const cum = buildCumulativeAscent([
      { distM: 0, elev: 100 },
      { distM: 500, elev: 200 },
      { distM: 1000, elev: 150 },
    ])
    const est = (m, climb) => m / 100 + climb / 10
    const pb = createPlayback({ totalM: 1000, estWalkMinutes: est, cumAscent: cum })
    pb.seek(500)
    const s = pb.stats()
    expect(s.ascentSoFarM).toBeCloseTo(100, 5)
    expect(s.remainingClimbM).toBeCloseTo(0, 5)
    expect(s.etaMin).toBeCloseTo(5, 5)
  })
})

describe('buildCumulativeAscent', () => {
  it('akkumulerer bare positive dz og hopper over null-elev', () => {
    const cum = buildCumulativeAscent([
      { distM: 0, elev: 10 },
      { distM: 100, elev: null },
      { distM: 200, elev: 30 },
      { distM: 300, elev: 20 },
      { distM: 400, elev: 45 },
    ])
    expect(Array.from(cum.aM)).toEqual([0, 20, 20, 45])
  })

  it('returnerer null ved for få gyldige samples', () => {
    expect(buildCumulativeAscent([{ distM: 0, elev: 5 }])).toBeNull()
    expect(buildCumulativeAscent([])).toBeNull()
  })
})

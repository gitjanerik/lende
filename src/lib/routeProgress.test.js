import { describe, it, expect } from 'vitest'
import { routeProgress } from './routeProgress.js'

// Rett linje (0,0)→(1000,0).
const LINE = [[0, 0], [500, 0], [1000, 0]]

// Lukket firkant med omkrets 4000: (0,0)→(1000,0)→(1000,1000)→(0,1000)→(0,0).
const SQUARE = [[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]

describe('routeProgress – rett linje', () => {
  it('midt på ruta: along/remaining/offRoute', () => {
    const p = routeProgress(LINE, 300, 40)
    expect(p.alongM).toBeCloseTo(300, 5)
    expect(p.remainingM).toBeCloseTo(700, 5)
    expect(p.offRouteM).toBeCloseTo(40, 5)
    expect(p.totalM).toBeCloseTo(1000, 5)
  })

  it('klemmes til endene når punktet ligger utenfor', () => {
    expect(routeProgress(LINE, -50, 0).alongM).toBe(0)
    const end = routeProgress(LINE, 1080, 0)
    expect(end.alongM).toBeCloseTo(1000, 5)
    expect(end.remainingM).toBe(0)
    expect(end.offRouteM).toBeCloseTo(80, 5)
  })
})

describe('routeProgress – rundtur (start == mål)', () => {
  it('nær origo med prevAlongM=0 → fremdrift ≈ 0, ikke ≈ full runde', () => {
    const p = routeProgress(SQUARE, 20, 5, { prevAlongM: 0 })
    expect(p.alongM).toBeLessThan(200)
    expect(p.remainingM).toBeGreaterThan(3800)
  })

  it('nær origo med prevAlongM nær slutten → fremdrift ≈ totalM', () => {
    const p = routeProgress(SQUARE, 5, 20, { prevAlongM: 3900 })
    expect(p.alongM).toBeGreaterThan(3800)
    expect(p.remainingM).toBeLessThan(200)
  })

  it('langt utenfor vinduet → global nærmeste kandidat (fallback)', () => {
    // Bruker står midtveis (1000,500 → along 1500), men ankeret sier 0.
    // Vinduet [−150, 800] har ingen kandidat innen 100 m → global beste vinner.
    const p = routeProgress(SQUARE, 1000, 500, { prevAlongM: 0 })
    expect(p.alongM).toBeCloseTo(1500, 5)
    expect(p.offRouteM).toBeCloseTo(0, 5)
  })
})

describe('routeProgress – degenerert input', () => {
  it('null / for få punkter → null', () => {
    expect(routeProgress(null, 0, 0)).toBe(null)
    expect(routeProgress([], 0, 0)).toBe(null)
    expect(routeProgress([[0, 0]], 0, 0)).toBe(null)
  })

  it('tolererer null-lengde-segmenter', () => {
    const p = routeProgress([[0, 0], [0, 0], [100, 0]], 50, 10)
    expect(p.alongM).toBeCloseTo(50, 5)
    expect(p.totalM).toBeCloseTo(100, 5)
  })
})

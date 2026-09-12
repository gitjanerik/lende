import { describe, it, expect } from 'vitest'
import { buildSvg } from './mapBuilder.js'
import { syntheticDEM } from './dem.js'

// Bratt syntetisk DEM (Gaussian-topp) → slope > 45° → stupkanter detekteres.
// ~600×600 m @ 10 m oppløsning.
function steepDem() {
  return syntheticDEM(600, 600, { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
    [{ x: 300, y: 300, h: 400, sigma: 40 }], 0)
}
// ~600 m bbox rundt lat 59 (eksakt justering uvesentlig for lag-tilstedeværelse).
const bbox = { south: 59, north: 59.0054, west: 10, east: 10.0105 }

describe('buildSvg timings', () => {
  it('måler alltid kontur-bygging (timings.contours)', () => {
    const dem = steepDem()
    const { timings } = buildSvg([], bbox, { dem, contourIntervalM: 20 })
    expect(typeof timings.contours).toBe('number')
    expect(timings.contours).toBeGreaterThanOrEqual(0)
  })

  it('måler stupkant-beregningen på et bratt DEM', () => {
    const dem = steepDem()
    const { timings } = buildSvg([], bbox, { dem, contourIntervalM: 20 })
    expect(typeof timings.cliffs).toBe('number')
  })

  it('dropper DEM-avledede lag når DEM-et er syntetisk fra demFetcher', () => {
    const dem = { ...steepDem(), source: 'synthetic (generic)' }
    const { timings } = buildSvg([], bbox, { dem, contourIntervalM: 20 })
    expect(timings.contours).toBeUndefined()
  })
})

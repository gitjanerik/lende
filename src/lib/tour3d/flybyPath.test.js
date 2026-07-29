import { describe, it, expect } from 'vitest'
import { makeCoords } from './coords.js'
import { buildFlybyPath } from './flybyPath.js'

// Syntetisk rygg: flat 100 m med en 300 m høy nord–sør-rygg ved svgX≈500.
function ridgeDem() {
  const cols = 100, rows = 100, res = 10
  const data = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * res
      data[r * cols + c] = 100 + (Math.abs(x - 500) < 40 ? 200 : 0)
    }
  }
  return { data, cols, rows, transform: { originX: 0, originY: 0, pixelWidth: res, pixelHeight: res }, noData: -9999 }
}

const coords = makeCoords({ widthM: 990, heightM: 990, exaggeration: 1 })

describe('buildFlybyPath', () => {
  it('holder klaring over terrenget langs hele banen', () => {
    const route = [[100, 500], [900, 500]]
    const dem = ridgeDem()
    const path = buildFlybyPath(route, dem, coords, { smoothPasses: 2 })
    // Over ryggen (svgX 460–540) må kamerahøyden ligge godt over 300 m.
    for (let i = 0; i < path.points3.length / 3; i++) {
      const wx = path.points3[i * 3]
      const svgX = wx + 495
      if (Math.abs(svgX - 500) < 30) {
        expect(path.points3[i * 3 + 1]).toBeGreaterThan(300)
      }
      // Aldri under grunnivå + upM et stykke unna ryggen.
      expect(path.points3[i * 3 + 1]).toBeGreaterThan(100)
    }
  })

  it('glatting reduserer maksimal høyde-jitter', () => {
    const route = [[100, 500], [900, 500]]
    const dem = ridgeDem()
    const rough = buildFlybyPath(route, dem, coords, { smoothPasses: 0 })
    const smooth = buildFlybyPath(route, dem, coords, { smoothPasses: 3 })
    expect(maxJitter(smooth.points3)).toBeLessThan(maxJitter(rough.points3))
  })

  it('cumM er monotont og dekker rute-lengden', () => {
    const path = buildFlybyPath([[0, 100], [800, 100]], ridgeDem(), coords)
    for (let i = 1; i < path.cumM.length; i++) {
      expect(path.cumM[i]).toBeGreaterThanOrEqual(path.cumM[i - 1])
    }
    expect(path.totalM).toBeCloseTo(800, 0)
  })
})

function maxJitter(points3) {
  let m = 0
  for (let i = 2; i < points3.length / 3; i++) {
    const a = points3[(i - 2) * 3 + 1]
    const b = points3[(i - 1) * 3 + 1]
    const c = points3[i * 3 + 1]
    m = Math.max(m, Math.abs(c - 2 * b + a))
  }
  return m
}

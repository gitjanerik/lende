import { describe, it, expect } from 'vitest'
import { makeCoords } from './coords.js'
import { buildTerrainGrid, decimateForTerrain, MAX_GRID_DIM } from './terrainGrid.js'

function makeDem(cols, rows, fill = 100, res = 10) {
  const data = new Float32Array(cols * rows).fill(fill)
  return {
    data, cols, rows,
    transform: { originX: 0, originY: 0, pixelWidth: res, pixelHeight: res },
    noData: -9999,
  }
}

describe('buildTerrainGrid', () => {
  const coords = makeCoords({ widthM: 30, heightM: 30, exaggeration: 1 })

  it('4×4-grid: riktig antall vertekser, uv-er og indekser', () => {
    const dem = makeDem(4, 4, 50)
    const g = buildTerrainGrid(dem, coords, { skirtDropM: 40 })
    const skirtCount = 2 * 4 + 2 * 2
    expect(g.positions.length).toBe((16 + skirtCount) * 3)
    expect(g.uvs.length).toBe((16 + skirtCount) * 2)
    // 9 quads + 12 skirt-quads à 2 trekanter à 3 indekser
    expect(g.indices.length).toBe((9 + 12) * 6)
    expect(g.minElev).toBe(50)
    expect(g.maxElev).toBe(50)
  })

  it('noData-celler flates til havnivå (0), aldri NaN', () => {
    const dem = makeDem(4, 4, 50)
    dem.data[5] = -9999
    dem.data[6] = NaN
    const g = buildTerrainGrid(dem, coords)
    for (const v of g.positions) expect(Number.isFinite(v)).toBe(true)
    expect(g.positions[5 * 3 + 1]).toBe(0)
    expect(g.positions[6 * 3 + 1]).toBe(0)
    expect(g.minElev).toBe(0)
  })

  it('skirt-vertekser deler XZ med kanten men er senket', () => {
    const dem = makeDem(3, 3, 50)
    const g = buildTerrainGrid(dem, coords, { skirtDropM: 40 })
    const gridCount = 9
    // Første skirt-verteks svarer til grid-verteks 0.
    expect(g.positions[gridCount * 3]).toBe(g.positions[0])
    expect(g.positions[gridCount * 3 + 2]).toBe(g.positions[2])
    expect(g.positions[gridCount * 3 + 1]).toBe(g.positions[1] - 40)
  })

  it('verteks-posisjon følger coords-mappingen', () => {
    const dem = makeDem(4, 4, 20)
    const g = buildTerrainGrid(dem, coords)
    // Celle (1,2): svgX=10, svgY=20 → world (10-15, 20, 20-15)
    const i = 2 * 4 + 1
    expect(g.positions[i * 3]).toBe(-5)
    expect(g.positions[i * 3 + 1]).toBe(20)
    expect(g.positions[i * 3 + 2]).toBe(5)
  })
})

describe('decimateForTerrain', () => {
  it('returnerer samme DEM når det er lite nok', () => {
    const dem = makeDem(100, 100)
    expect(decimateForTerrain(dem)).toBe(dem)
  })

  it('desimerer store grid til ≤ MAX_GRID_DIM', () => {
    const dem = makeDem(1200, 800, 100, 10)
    const out = decimateForTerrain(dem)
    expect(Math.max(out.cols, out.rows)).toBeLessThanOrEqual(MAX_GRID_DIM)
    expect(out.transform.pixelWidth).toBeGreaterThan(10)
  })
})

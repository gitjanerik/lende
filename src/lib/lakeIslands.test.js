import { describe, it, expect } from 'vitest'
import { islandHolesForLake } from './lakeIslands.js'

// 1 km × 1 km innsjø-ring i SVG-meter.
const lake = [[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]

// Sentrert øy 400..600 i begge akser (200 m × 200 m = 40 000 m²).
const inIsland = (x, y) => x >= 400 && x <= 600 && y >= 400 && y <= 600

// Areal-vektet sentroid av en ring.
function centroid(ring) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    a += cross; cx += (ring[j][0] + ring[i][0]) * cross; cy += (ring[j][1] + ring[i][1]) * cross
  }
  a /= 2
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

describe('islandHolesForLake — DEM-avledet øy-deteksjon', () => {
  it('verdi-vann (~0 m) med øy som stiger til 50 m → ett hull over øya', () => {
    const dem = (x, y) => (inIsland(x, y) ? 50 : 0)
    const holes = islandHolesForLake(lake, dem)
    expect(holes.length).toBe(1)
    const c = centroid(holes[0])
    expect(c.x).toBeGreaterThan(430); expect(c.x).toBeLessThan(570)
    expect(c.y).toBeGreaterThan(430); expect(c.y).toBeLessThan(570)
  })

  it('verdi-vann på ekte innsjø-nivå (167 m) med øy på 210 m → ett hull', () => {
    const dem = (x, y) => (inIsland(x, y) ? 210 : 167)
    const holes = islandHolesForLake(lake, dem)
    expect(holes.length).toBe(1)
  })

  it('nodata-vann (null over vann) med finite øy-celler → ett hull', () => {
    const dem = (x, y) => (inIsland(x, y) ? 180 : null)
    const holes = islandHolesForLake(lake, dem)
    expect(holes.length).toBe(1)
  })

  it('flat innsjø uten øy → ingen hull', () => {
    const dem = () => 0
    expect(islandHolesForLake(lake, dem)).toEqual([])
  })

  it('lite skjær under minIslandM2 filtreres bort', () => {
    // ~30 m spike. Marching-squares-omrisset blåses opp til ~2 400 m² (terskelen
    // ligger langt inn i vann-cellene når spissen er høy), men < 3 000 m²-gulvet.
    const tiny = (x, y) => (x >= 500 && x <= 530 && y >= 500 && y <= 530 ? 40 : 0)
    expect(islandHolesForLake(lake, tiny)).toEqual([])
  })

  it('øy under aboveWaterM-terskel (bare 2 m over vann) regnes ikke som øy', () => {
    const dem = (x, y) => (inIsland(x, y) ? 2 : 0) // < 6 m default
    expect(islandHolesForLake(lake, dem)).toEqual([])
  })

  it('degenerert input → tom liste', () => {
    expect(islandHolesForLake([[0, 0], [1, 1]], () => 50)).toEqual([])
    expect(islandHolesForLake(lake, null)).toEqual([])
  })
})

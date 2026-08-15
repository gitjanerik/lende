import { describe, it, expect } from 'vitest'
import { findRectangleGaps, findGridGaps } from './tileCache.js'

const R = { w: 1000, h: 1000 }
const g = (col, row) => ({ x: col * 1000, y: row * 1000 })

describe('findRectangleGaps — hva som mangler for en firkant', () => {
  it('én flis alene er allerede et rektangel', () => {
    expect(findRectangleGaps(R, [])).toEqual([])
  })

  it('en hel 2×2 mangler ingenting', () => {
    expect(findRectangleGaps(R, [g(1, 0), g(0, 1), g(1, 1)])).toEqual([])
  })

  it('L-form mangler hjørnet', () => {
    // aktiv (0,0) + øst (1,0) + sør (0,1) → mangler (1,1)
    const ut = findRectangleGaps(R, [g(1, 0), g(0, 1)])
    expect(ut).toHaveLength(1)
    expect(ut[0]).toMatchObject({ col: 1, row: 1, x: 1000, y: 1000 })
  })

  it('kors-form mangler de fire hjørnene', () => {
    // aktiv (0,0) + N, S, Ø, V → 3×3 med fire tomme hjørner
    const ut = findRectangleGaps(R, [g(0, -1), g(0, 1), g(1, 0), g(-1, 0)])
    expect(ut).toHaveLength(4)
    const nokler = ut.map(c => `${c.col},${c.row}`).sort()
    expect(nokler).toEqual(['-1,-1', '-1,1', '1,-1', '1,1'])
  })

  it('diagonal: rapporterer perimeter-cellene, i motsetning til findGridGaps', () => {
    // Nettopp forskjellen som gjorde bounding-box-varianten utrygg som AUTOMATISK
    // varsel (v1.0.28) — her er den trygg fordi den henger på en knapp.
    const diagonal = [g(1, 1), g(2, 2)]
    expect(findGridGaps(R, diagonal)).toEqual([])          // ingen INNELUKKEDE hull
    expect(findRectangleGaps(R, diagonal)).toHaveLength(6) // 3×3 minus tre fliser
  })
})

import { describe, it, expect } from 'vitest'
import { arkExtentFor } from './tileCache.js'

const flis = (id, col, row, W = 8000, H = 8000) => ({
  id,
  utmBbox: { minE: 500000 + col * W, maxE: 500000 + (col + 1) * W,
             minN: 6600000 + row * H, maxN: 6600000 + (row + 1) * H },
})

describe('arkExtentFor', () => {
  it('én flis alene gir flisas egen størrelse', () => {
    const a = flis('a', 0, 0)
    expect(arkExtentFor(a, [a])).toEqual({ widthM: 8000, heightM: 8000, fliser: 1 })
  })

  it('3×3-ark rapporteres som hele arket', () => {
    const alle = []
    for (let c = -1; c <= 1; c++) for (let r = -1; r <= 1; r++) alle.push(flis(`${c},${r}`, c, r))
    const midt = alle.find(t => t.id === '0,0')
    expect(arkExtentFor(midt, alle)).toEqual({ widthM: 24000, heightM: 24000, fliser: 9 })
  })

  it('fliser med annen størrelse teller ikke med', () => {
    const a = flis('a', 0, 0)
    const annen = flis('b', 1, 0, 4000, 4000)
    expect(arkExtentFor(a, [a, annen]).fliser).toBe(1)
  })

  it('fliser utenfor radius teller ikke med', () => {
    const a = flis('a', 0, 0)
    const langtUnna = flis('b', 9, 0)
    expect(arkExtentFor(a, [a, langtUnna]).fliser).toBe(1)
  })

  it('post uten utmBbox (eldre kart) gir null', () => {
    expect(arkExtentFor({ id: 'gammel' }, [])).toBeNull()
  })
})

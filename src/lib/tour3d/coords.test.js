import { describe, it, expect } from 'vitest'
import { makeCoords } from './coords.js'

describe('makeCoords', () => {
  const c = makeCoords({ widthM: 4000, heightM: 2000, exaggeration: 1.5 })

  it('sentrerer kartet i origo og skalerer høyden', () => {
    expect(c.toWorld(0, 0, 0)).toEqual([-2000, 0, -1000])
    expect(c.toWorld(4000, 2000, 0)).toEqual([2000, 0, 1000])
    expect(c.toWorld(2000, 1000, 100)).toEqual([0, 150, 0])
  })

  it('svg-y (sør) mapper til +Z uten flip', () => {
    const north = c.toWorld(2000, 0, 0)
    const south = c.toWorld(2000, 2000, 0)
    expect(north[2]).toBeLessThan(south[2])
  })

  it('toSvg er invers av toWorld i XZ', () => {
    const [wx, , wz] = c.toWorld(1234, 567, 42)
    const back = c.toSvg(wx, wz)
    expect(back.x).toBeCloseTo(1234, 9)
    expect(back.y).toBeCloseTo(567, 9)
  })

  it('uv: nord-kanten har v=1 (three-UV øker oppover)', () => {
    expect(c.uvOf(0, 0)).toEqual([0, 1])
    expect(c.uvOf(4000, 2000)).toEqual([1, 0])
  })

  it('elev-konvertering er symmetrisk', () => {
    expect(c.worldYToElev(c.elevToWorldY(312))).toBeCloseTo(312, 9)
  })
})

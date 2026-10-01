import { describe, it, expect } from 'vitest'
import { sporingFokus, sporingSkala, SPORING_ZOOM } from './sporingSenter.js'

describe('sporingSenter', () => {
  it('fokus står 30 % ned fra toppen, midt i bredden', () => {
    expect(sporingFokus(400, 1000)).toEqual({ x: 200, y: 300 })
  })
  it('zoomer inn, men aldri ut', () => {
    expect(sporingSkala(2)).toBe(SPORING_ZOOM)
    expect(sporingSkala(30)).toBe(30)
    expect(sporingSkala(NaN)).toBe(SPORING_ZOOM)
  })
})

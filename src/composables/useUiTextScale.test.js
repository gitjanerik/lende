import { describe, it, expect } from 'vitest'
import { UI_TEXT_SCALES, nesteTextScale } from './useUiTextScale.js'

describe('nesteTextScale', () => {
  it('går ett hakk opp i hovedmenyens egen liste', () => {
    expect(nesteTextScale(1)).toBe(1.25)
    expect(nesteTextScale(1.25)).toBe(1.5)
    expect(nesteTextScale(1.5)).toBe(2)
  })

  it('runder fra siste hakk tilbake til første — veien tilbake er ikke en blindvei', () => {
    expect(nesteTextScale(UI_TEXT_SCALES[UI_TEXT_SCALES.length - 1])).toBe(UI_TEXT_SCALES[0])
  })

  it('en ukjent verdi låser ikke knappen, den faller til første hakk', () => {
    expect(nesteTextScale(1.75)).toBe(UI_TEXT_SCALES[0])
    expect(nesteTextScale(undefined)).toBe(UI_TEXT_SCALES[0])
  })

  it('runden treffer hvert hakk nøyaktig én gang', () => {
    const sett = []
    let v = UI_TEXT_SCALES[0]
    for (let i = 0; i < UI_TEXT_SCALES.length; i++) { sett.push(v); v = nesteTextScale(v) }
    expect(sett).toEqual(UI_TEXT_SCALES)
    expect(v).toBe(UI_TEXT_SCALES[0])
  })
})

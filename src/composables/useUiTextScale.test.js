import { describe, it, expect } from 'vitest'
import {
  UI_TEXT_SCALES, UI_TEXT_MIN, UI_TEXT_MAKS, nesteTextScale, klemTextScale,
} from './useUiTextScale.js'

describe('nesteTextScale', () => {
  it('går ett hakk opp i A-knappens liste', () => {
    expect(nesteTextScale(1)).toBe(1.25)
    expect(nesteTextScale(1.25)).toBe(1.5)
    expect(nesteTextScale(1.5)).toBe(2)
  })

  it('runder fra siste hakk tilbake til første — veien tilbake er ikke en blindvei', () => {
    expect(nesteTextScale(UI_TEXT_SCALES[UI_TEXT_SCALES.length - 1])).toBe(UI_TEXT_SCALES[0])
  })

  it('en verdi mellom hakkene går til det FØRSTE over, ikke tilbake til start', () => {
    expect(nesteTextScale(1.37)).toBe(1.5)
    expect(nesteTextScale(1.05)).toBe(1.25)
    expect(nesteTextScale(1.75)).toBe(2)
  })

  it('over siste hakk runder den, og et tull-tall låser ikke knappen', () => {
    expect(nesteTextScale(2.4)).toBe(UI_TEXT_SCALES[0])
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

describe('klemTextScale', () => {
  it('slipper gjennom alt i spennet, ikke bare hakkene', () => {
    expect(klemTextScale(1.37)).toBe(1.37)
    expect(klemTextScale(1.01)).toBe(1.01)
  })

  it('runder til hele prosent', () => {
    expect(klemTextScale(1.3749)).toBe(1.37)
    expect(klemTextScale(1.375)).toBe(1.38)
  })

  it('klemmer til spennet i begge ender', () => {
    expect(klemTextScale(0.5)).toBe(UI_TEXT_MIN)
    expect(klemTextScale(3)).toBe(UI_TEXT_MAKS)
  })

  it('et tull-tall faller til minsteverdien', () => {
    expect(klemTextScale(NaN)).toBe(UI_TEXT_MIN)
    expect(klemTextScale(undefined)).toBe(UI_TEXT_MIN)
    expect(klemTextScale('tull')).toBe(UI_TEXT_MIN)
  })

  it('hvert av A-knappens hakk er en lovlig verdi', () => {
    for (const s of UI_TEXT_SCALES) expect(klemTextScale(s)).toBe(s)
  })
})

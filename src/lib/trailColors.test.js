import { describe, it, expect } from 'vitest'
import {
  buildTrailColorCss, isTrailColor, normalizeHex,
  TRAIL_FG_CODES, TRAIL_BG_CODES,
} from './trailColors.js'

describe('trailColors', () => {
  it('ingen farger → tom CSS (så <style>-blokken kan fjernes helt)', () => {
    expect(buildTrailColorCss()).toBe('')
    expect(buildTrailColorCss({})).toBe('')
    expect(buildTrailColorCss({ fg: undefined, bg: undefined })).toBe('')
  })

  it('forgrunn treffer alle tre sti-kodene', () => {
    const css = buildTrailColorCss({ fg: '#7a4fa3' })
    for (const c of TRAIL_FG_CODES) {
      expect(css).toContain(`[data-iso="${c}"]`)
    }
    expect(css).toContain('stroke: #7a4fa3 !important')
    expect(css).not.toContain('path.casing')
  })

  it('bakgrunn treffer kun casing på 505/506 — 507 har ingen underlinje', () => {
    const css = buildTrailColorCss({ bg: '#ffee88' })
    expect(TRAIL_BG_CODES).toEqual(['505', '506'])
    expect(css).toContain('[data-iso="505"] path.casing')
    expect(css).toContain('[data-iso="506"] path.casing')
    expect(css).not.toContain('[data-iso="507"] path.casing')
  })

  it('begge farger gir to regler', () => {
    const css = buildTrailColorCss({ fg: '#000000', bg: '#ffffff' })
    expect(css.split('\n')).toHaveLength(2)
  })

  it('ugyldige verdier ignoreres i stedet for å lekke inn i CSS-en', () => {
    expect(buildTrailColorCss({ fg: 'red' })).toBe('')
    expect(buildTrailColorCss({ fg: '#abc' })).toBe('')
    expect(buildTrailColorCss({ fg: '#12345g' })).toBe('')
    expect(buildTrailColorCss({ fg: 'url(#x)' })).toBe('')
  })

  it('isTrailColor godtar kun 6-sifret hex', () => {
    expect(isTrailColor('#a1B2c3')).toBe(true)
    expect(isTrailColor('#abc')).toBe(false)
    expect(isTrailColor(null)).toBe(false)
  })

  it('normalizeHex utvider kortform for <input type="color">', () => {
    expect(normalizeHex('#000')).toBe('#000000')
    expect(normalizeHex('#AbC')).toBe('#aabbcc')
    expect(normalizeHex('#fbf7ec')).toBe('#fbf7ec')
    expect(normalizeHex('rgba(1,2,3,.5)', '#fbf7ec')).toBe('#fbf7ec')
    expect(normalizeHex(undefined)).toBe('#000000')
  })
})

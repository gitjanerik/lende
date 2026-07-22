import { describe, it, expect } from 'vitest'
import {
  EXTEND_DIR_WORD, EXTEND_DIR_DEG, EXTEND_ROSE, extendZoneLabelText,
  screenToViewBox, viewBoxToScreen,
} from './useMapExtend.js'

// Kompassrose-utvidelsesknappene: 8 himmelretninger, hver med sin røde arm-vinkel
// og en «<Retning> i lende»-tekst. Selve SVG-tegningen (renderExtendZones) krever
// DOM og testes ikke her; vi dekker den rene retning/tekst/vinkel-logikken.

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

describe('extendZoneLabelText', () => {
  const cases = {
    N: 'Nord i lende', NE: 'Nordøst i lende', E: 'Øst i lende', SE: 'Sørøst i lende',
    S: 'Sør i lende', SW: 'Sørvest i lende', W: 'Vest i lende', NW: 'Nordvest i lende',
  }
  for (const [dir, text] of Object.entries(cases)) {
    it(`${dir} → "${text}"`, () => expect(extendZoneLabelText(dir)).toBe(text))
  }
  it('ukjent retning → tom streng', () => expect(extendZoneLabelText('XX')).toBe(''))
  it('alle tekster starter med versal og slutter på « i lende»', () => {
    for (const dir of DIRS) {
      const t = extendZoneLabelText(dir)
      expect(t.endsWith(' i lende')).toBe(true)
      expect(t[0]).toBe(t[0].toUpperCase())
    }
  })
})

describe('EXTEND_DIR_DEG — rød arm-vinkel per retning', () => {
  it('dekker alle 8 retninger', () => {
    expect(Object.keys(EXTEND_DIR_DEG).sort()).toEqual([...DIRS].sort())
  })
  it('nord = 0°, med klokka i 45°-steg', () => {
    expect(EXTEND_DIR_DEG.N).toBe(0)
    expect(EXTEND_DIR_DEG.E).toBe(90)
    expect(EXTEND_DIR_DEG.S).toBe(180)
    expect(EXTEND_DIR_DEG.W).toBe(270)
  })
  it('hver vinkel er et unikt multiplum av 45 i [0,360)', () => {
    const seen = new Set()
    for (const dir of DIRS) {
      const d = EXTEND_DIR_DEG[dir]
      expect(d % 45).toBe(0)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(360)
      expect(seen.has(d)).toBe(false)
      seen.add(d)
    }
    expect(seen.size).toBe(8)
  })
  it('vinkelen mapper til én av de 8 rose-armene (i*45)', () => {
    for (const dir of DIRS) expect(EXTEND_DIR_DEG[dir] / 45).toBe(Math.round(EXTEND_DIR_DEG[dir] / 45))
  })
})

describe('screenToViewBox / viewBoxToScreen — skjerm ⇄ viewBox (long-press-fiks)', () => {
  // Kvadratisk viewport = kvadratisk kart → fit 1, ingen letterbox.
  const base = { w: 1000, h: 1000, widthM: 1000, heightM: 1000, scale: 1, rotationDeg: 0, tx: 0, ty: 0 }

  it('identitet uten transform: skjerm-px == viewBox-meter', () => {
    const p = screenToViewBox(300, 700, base)
    expect(p.x).toBeCloseTo(300, 6)
    expect(p.y).toBeCloseTo(700, 6)
  })

  it('regner MED pan (tx/ty) — det getScreenCTM glapp på iOS', () => {
    // Samme skjerm-punkt, kart panorert 400 px til høyre → viewBox-x flytter 400.
    const still = screenToViewBox(500, 500, base)
    const panned = screenToViewBox(500, 500, { ...base, tx: 400 })
    expect(still.x).toBeCloseTo(500, 6)
    expect(panned.x).toBeCloseTo(100, 6)   // (500 − 400) / scale
  })

  it('regner MED zoom (scale)', () => {
    const p = screenToViewBox(600, 600, { ...base, scale: 2 })
    expect(p.x).toBeCloseTo(300, 6)        // 600 / 2
    expect(p.y).toBeCloseTo(300, 6)
  })

  const views = [
    { ...base, label: 'nøytral' },
    { ...base, scale: 2.5, tx: 320, ty: -140, label: 'pan+zoom' },
    { ...base, scale: 1.4, rotationDeg: 37, tx: 80, ty: 210, label: 'pan+zoom+rot' },
    { w: 800, h: 1600, widthM: 500, heightM: 500, scale: 1.2, rotationDeg: -22, tx: 50, ty: 90, label: 'letterbox portrait' },
  ]
  for (const v of views) {
    it(`round-trip skjerm→viewBox→skjerm (${v.label})`, () => {
      for (const [sx, sy] of [[123, 456], [0, 0], [640, 1200], [799, 1599]]) {
        const vb = screenToViewBox(sx, sy, v)
        const back = viewBoxToScreen(vb.x, vb.y, v)
        expect(back.x).toBeCloseTo(sx, 4)
        expect(back.y).toBeCloseTo(sy, 4)
      }
    })
  }
})

describe('EXTEND_DIR_WORD / EXTEND_ROSE', () => {
  it('har norske ord for alle retninger', () => {
    expect(Object.keys(EXTEND_DIR_WORD).sort()).toEqual([...DIRS].sort())
    expect(EXTEND_DIR_WORD.NE).toBe('nordøst')
  })
  it('rose-paletten har en rød aksent', () => {
    expect(EXTEND_ROSE.red).toBe('#d8392c')
    expect(EXTEND_ROSE.grey).toMatch(/^#/)
  })
})

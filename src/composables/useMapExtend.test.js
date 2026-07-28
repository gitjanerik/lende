import { describe, it, expect } from 'vitest'
import {
  EXTEND_DIR_WORD, EXTEND_DIR_DEG, EDGE_DIRS, EDGE_DIR_VEC, EDGE_LABEL_OFFSET,
  extendZoneLabelText, edgeAnchorSvg, edgeKnobDeg, edgeLabelOffset,
  screenToViewBox, viewBoxToScreen,
} from './useMapExtend.js'

// Kanthåndtakene: 8 himmelretninger, hver med sin pil-vinkel, sitt anker på
// arkkanten og en «<Retning> i lende»-pille. DOM-laget (MapEdgeHandles.vue) og
// de reaktive computedene testes ikke her; vi dekker den rene geometrien.

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

describe('EXTEND_DIR_DEG — pil-vinkel per retning', () => {
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
  it('vinkelen er et helt 45°-trinn', () => {
    for (const dir of DIRS) expect(EXTEND_DIR_DEG[dir] / 45).toBe(Math.round(EXTEND_DIR_DEG[dir] / 45))
  })
})

describe('EDGE_DIRS / EDGE_DIR_VEC — retningsrekkefølge og vektorer', () => {
  it('tab-rekkefølgen følger designet: N → NØ → Ø → SØ → S → SV → V → NV', () => {
    expect(EDGE_DIRS).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
  })
  it('nord er −y (SVG-y vokser nedover), øst er +x', () => {
    expect(EDGE_DIR_VEC.N).toEqual({ dx: 0, dy: -1 })
    expect(EDGE_DIR_VEC.E).toEqual({ dx: 1, dy: 0 })
    expect(EDGE_DIR_VEC.SW).toEqual({ dx: -1, dy: 1 })
  })
  it('vektoren stemmer med vinkelen (0° = opp, med klokka)', () => {
    for (const dir of EDGE_DIRS) {
      const { dx, dy } = EDGE_DIR_VEC[dir]
      const rad = EXTEND_DIR_DEG[dir] * Math.PI / 180
      const n = Math.hypot(dx, dy)
      expect(dx / n).toBeCloseTo(Math.sin(rad), 6)
      expect(dy / n).toBeCloseTo(-Math.cos(rad), 6)
    }
  })
})

describe('edgeAnchorSvg — ankeret på arkkanten', () => {
  const b = { minX: 0, minY: 0, maxX: 1000, maxY: 600 }
  it('kardinal-håndtak sitter midt på sin kant', () => {
    expect(edgeAnchorSvg('N', b)).toEqual({ x: 500, y: 0 })
    expect(edgeAnchorSvg('S', b)).toEqual({ x: 500, y: 600 })
    expect(edgeAnchorSvg('E', b)).toEqual({ x: 1000, y: 300 })
    expect(edgeAnchorSvg('W', b)).toEqual({ x: 0, y: 300 })
  })
  it('diagonal-håndtak sitter i sitt hjørne', () => {
    expect(edgeAnchorSvg('NE', b)).toEqual({ x: 1000, y: 0 })
    expect(edgeAnchorSvg('SW', b)).toEqual({ x: 0, y: 600 })
  })
  it('følger en forskjøvet mosaikk-bboks (negative koordinater)', () => {
    const shifted = { minX: -1000, minY: -600, maxX: 1000, maxY: 600 }
    expect(edgeAnchorSvg('NW', shifted)).toEqual({ x: -1000, y: -600 })
    expect(edgeAnchorSvg('E', shifted)).toEqual({ x: 1000, y: 0 })
  })
  it('ukjent retning → null', () => expect(edgeAnchorSvg('XX', b)).toBe(null))
})

describe('edgeKnobDeg — pila peker mot kanten den utvider, også rotert', () => {
  it('uten kart-rotasjon = retningsvinkelen', () => {
    for (const dir of EDGE_DIRS) expect(edgeKnobDeg(dir, 0)).toBe(EXTEND_DIR_DEG[dir])
  })
  it('kart-rotasjonen legges til (håndtaket sitter på arket)', () => {
    expect(edgeKnobDeg('N', 37)).toBe(37)
    expect(edgeKnobDeg('W', -90)).toBe(180)
  })
  it('ukjent retning → null', () => expect(edgeKnobDeg('XX', 0)).toBe(null))
})

describe('edgeLabelOffset — pilla forskyves INNOVER fra knappen', () => {
  it('uten rotasjon er offsetet (−dx·88, −dy·44)', () => {
    for (const dir of EDGE_DIRS) {
      const { dx, dy } = EDGE_DIR_VEC[dir]
      const off = edgeLabelOffset(dir, 0)
      expect(off.lx).toBeCloseTo(-dx * EDGE_LABEL_OFFSET.x, 6)
      expect(off.ly).toBeCloseTo(-dy * EDGE_LABEL_OFFSET.y, 6)
    }
  })
  it('peker alltid motsatt vei av retningen (innover i arket)', () => {
    for (const dir of EDGE_DIRS) {
      for (const rot of [0, 45, 137, -80]) {
        const { dx, dy } = EDGE_DIR_VEC[dir]
        const r = rot * Math.PI / 180
        const rx = dx * Math.cos(r) - dy * Math.sin(r)
        const ry = dx * Math.sin(r) + dy * Math.cos(r)
        const off = edgeLabelOffset(dir, rot)
        // Skalarproduktet med den roterte retningsvektoren er negativt = innover.
        expect(off.lx * rx + off.ly * ry).toBeLessThan(0)
      }
    }
  })
  it('90° rotasjon flytter nord-pilla til venstre for knappen', () => {
    const off = edgeLabelOffset('N', 90)
    expect(off.lx).toBeCloseTo(-EDGE_LABEL_OFFSET.x, 6)   // −(0·cos − (−1)·sin) · 88
    expect(off.ly).toBeCloseTo(0, 6)
  })
  it('ukjent retning → null', () => expect(edgeLabelOffset('XX', 0)).toBe(null))
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

describe('EXTEND_DIR_WORD', () => {
  it('har norske ord for alle retninger', () => {
    expect(Object.keys(EXTEND_DIR_WORD).sort()).toEqual([...DIRS].sort())
    expect(EXTEND_DIR_WORD.NE).toBe('nordøst')
  })
})

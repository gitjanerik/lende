import { describe, it, expect } from 'vitest'
import {
  viewRectSvg,
  expandRect,
  rectContains,
  buildCullIndex,
  needsRecull,
  computeCullDiff,
  parseBboxAttr,
  rectsOverlap,
  ghostFlisRom,
  CULL_MARGIN_FACTOR,
} from './viewportCull.js'

// Fasit-implementasjon av visibleCenterSvg-matta fra MapView (invers av
// M = T∘R∘S på «meet»-fittet innhold) — viewRectSvg skal gi en rekt hvis
// senter matcher denne for ethvert transform-oppsett.
function centerSvg({ w, h, widthM, heightM, scale, rotation, tx, ty }) {
  const fit = Math.min(w / widthM, h / heightM)
  const offX = (w - widthM * fit) / 2
  const offY = (h - heightM * fit) / 2
  const s = scale || 1
  const rot = ((rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const A = (w / 2 - tx) / s
  const B = (h / 2 - ty) / s
  const px = A * cos + B * sin
  const py = -A * sin + B * cos
  return { x: (px - offX) / fit, y: (py - offY) / fit }
}

const S22 = { w: 360, h: 780, widthM: 5000, heightM: 5000 }

describe('viewRectSvg', () => {
  it('uten transform dekker rekta hele kartet (meet-fit, letterbox utenfor)', () => {
    const r = viewRectSvg({ ...S22, scale: 1, rotation: 0, tx: 0, ty: 0 })
    // Bredde-fit på stående skjerm: x-spennet er nøyaktig kartbredden,
    // y-spennet større (letterbox over/under blir negative/over-maks y).
    expect(r.minX).toBeCloseTo(0, 6)
    expect(r.maxX).toBeCloseTo(5000, 6)
    expect(r.minY).toBeLessThan(0)
    expect(r.maxY).toBeGreaterThan(5000)
  })

  it('senter matcher visibleCenterSvg-fasit ved zoom + pan', () => {
    const p = { ...S22, scale: 6, rotation: 0, tx: -800, ty: -1200 }
    const r = viewRectSvg(p)
    const c = centerSvg(p)
    expect((r.minX + r.maxX) / 2).toBeCloseTo(c.x, 6)
    expect((r.minY + r.maxY) / 2).toBeCloseTo(c.y, 6)
  })

  it('senter matcher fasit også med rotasjon, og rekta krymper med skala', () => {
    const p = { ...S22, scale: 8, rotation: 37, tx: 500, ty: -2400 }
    const r = viewRectSvg(p)
    const c = centerSvg(p)
    expect((r.minX + r.maxX) / 2).toBeCloseTo(c.x, 6)
    expect((r.minY + r.maxY) / 2).toBeCloseTo(c.y, 6)
    // Ved skala 8 er synlig bredde ~5000/8 m; rotert AABB er ≤ diagonalen.
    const diag = Math.hypot(S22.w, S22.h) / (Math.min(S22.w / 5000, S22.h / 5000) * 8)
    expect(r.maxX - r.minX).toBeLessThanOrEqual(diag + 1e-6)
    expect(r.maxX - r.minX).toBeGreaterThan(5000 / 8 - 1e-6)
  })

  it('90° rotasjon bytter x/y-spennene', () => {
    const r0 = viewRectSvg({ ...S22, scale: 5, rotation: 0, tx: 0, ty: 0 })
    const r90 = viewRectSvg({ ...S22, scale: 5, rotation: 90, tx: 0, ty: 0 })
    expect(r90.maxX - r90.minX).toBeCloseTo(r0.maxY - r0.minY, 4)
    expect(r90.maxY - r90.minY).toBeCloseTo(r0.maxX - r0.minX, 4)
  })

  it('returnerer null på degenerert input', () => {
    expect(viewRectSvg({ w: 0, h: 780, widthM: 5000, heightM: 5000, scale: 1, rotation: 0, tx: 0, ty: 0 })).toBeNull()
    expect(viewRectSvg({ w: 360, h: 780, widthM: 0, heightM: 5000, scale: 1, rotation: 0, tx: 0, ty: 0 })).toBeNull()
  })
})

describe('expandRect / rectContains', () => {
  it('ekspanderer med marginFactor per side', () => {
    const r = expandRect({ minX: 100, minY: 200, maxX: 300, maxY: 400 }, 0.5)
    expect(r).toEqual({ minX: 0, minY: 100, maxX: 400, maxY: 500 })
  })
  it('default-margin er CULL_MARGIN_FACTOR', () => {
    const base = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const r = expandRect(base)
    expect(r.minX).toBeCloseTo(-100 * CULL_MARGIN_FACTOR, 9)
  })
  it('rectContains', () => {
    const outer = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    expect(rectContains(outer, { minX: 1, minY: 1, maxX: 9, maxY: 9 })).toBe(true)
    expect(rectContains(outer, { minX: 1, minY: 1, maxX: 11, maxY: 9 })).toBe(false)
  })
})

describe('needsRecull (hysterese)', () => {
  const view = { minX: 1000, minY: 1000, maxX: 1500, maxY: 1500 }
  const state = { viewRect: view, expandedRect: expandRect(view, 0.75), scale: 6 }

  it('første kjøring → true', () => {
    expect(needsRecull(null, view, 6)).toBe(true)
    expect(needsRecull({}, view, 6)).toBe(true)
  })
  it('liten pan innenfor slakk-sonen → false', () => {
    const moved = { minX: 1100, minY: 1050, maxX: 1600, maxY: 1550 }
    expect(needsRecull(state, moved, 6)).toBe(false)
  })
  it('pan forbi slakk-sonen → true', () => {
    // margin per side = 375 m, slakk-sone = 187.5 m → 300 m pan rømmer.
    const moved = { minX: 1300, minY: 1000, maxX: 1800, maxY: 1500 }
    expect(needsRecull(state, moved, 6)).toBe(true)
  })
  it('skala-hopp > 20 % → true selv uten pan', () => {
    expect(needsRecull(state, view, 6 * 1.25)).toBe(true)
    expect(needsRecull(state, view, 6 / 1.25)).toBe(true)
    expect(needsRecull(state, view, 6 * 1.1)).toBe(false)
  })
})

describe('buildCullIndex + computeCullDiff', () => {
  const el = (id) => ({ id })
  const entries = [
    { minX: 0, minY: 0, maxX: 100, maxY: 100, el: el('a') },
    { minX: 2000, minY: 2000, maxX: 2100, maxY: 2100, el: el('b') },
    { minX: 4900, minY: 4900, maxX: 5000, maxY: 5000, el: el('c') },
  ]

  it('første kjøring: alt i rekta er show, ingenting hide', () => {
    const idx = buildCullIndex(entries)
    const { show, hide, visible } = computeCullDiff(idx, { minX: 0, minY: 0, maxX: 2500, maxY: 2500 }, null)
    expect(new Set(show.map(e => e.id))).toEqual(new Set(['a', 'b']))
    expect(hide).toEqual([])
    expect(visible.size).toBe(2)
  })

  it('diff er minimal: kun endrede elementer rapporteres', () => {
    const idx = buildCullIndex(entries)
    const first = computeCullDiff(idx, { minX: 0, minY: 0, maxX: 2500, maxY: 2500 }, null)
    // Flytt utsnittet sørøst: a forsvinner, c kommer til, b forblir.
    const second = computeCullDiff(idx, { minX: 1500, minY: 1500, maxX: 5000, maxY: 5000 }, first.visible)
    expect(second.show.map(e => e.id)).toEqual(['c'])
    expect(second.hide.map(e => e.id)).toEqual(['a'])
    expect(second.visible.size).toBe(2)
  })

  it('kant-berøring teller som synlig (rbush-intersect er inklusiv)', () => {
    const idx = buildCullIndex(entries)
    const { visible } = computeCullDiff(idx, { minX: 100, minY: 100, maxX: 200, maxY: 200 }, null)
    expect(visible.size).toBe(1)
  })
})

describe('parseBboxAttr', () => {
  it('parser gyldig attributt', () => {
    expect(parseBboxAttr('10.5,20,300,400.1')).toEqual({ minX: 10.5, minY: 20, maxX: 300, maxY: 400.1 })
  })
  it('null på søppel/manglende/invertert', () => {
    expect(parseBboxAttr(null)).toBeNull()
    expect(parseBboxAttr('')).toBeNull()
    expect(parseBboxAttr('1,2,3')).toBeNull()
    expect(parseBboxAttr('a,b,c,d')).toBeNull()
    expect(parseBboxAttr('100,0,50,10')).toBeNull()   // maxX < minX
  })
})

describe('rectsOverlap', () => {
  const a = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  it('true på overlapp og på ren kant-berøring', () => {
    expect(rectsOverlap(a, { minX: 50, minY: 50, maxX: 150, maxY: 150 })).toBe(true)
    expect(rectsOverlap(a, { minX: 100, minY: 0, maxX: 200, maxY: 100 })).toBe(true)
  })
  it('false når de er adskilt i én akse', () => {
    expect(rectsOverlap(a, { minX: 101, minY: 0, maxX: 200, maxY: 100 })).toBe(false)
    expect(rectsOverlap(a, { minX: 0, minY: -200, maxX: 100, maxY: -1 })).toBe(false)
  })
  it('er symmetrisk', () => {
    const b = { minX: -50, minY: -50, maxX: 10, maxY: 10 }
    expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a))
  })
})

describe('ghostFlisRom', () => {
  // Slik buildGhostSvg skriver en nabo-flis 2000 m øst, med 0,5 m blø-sone.
  const attr = { x: '1999.5', y: '-0.5', width: '2001', height: '2001', viewBox: '-0.5 -0.5 2001 2001' }
  it('trekker blø-sonen ut av forskyvningen', () => {
    const rom = ghostFlisRom(attr)
    expect(rom.dx).toBe(2000)
    expect(rom.dy).toBe(0)
  })
  it('rekta dekker hele flisa inkludert blø-sonen', () => {
    expect(ghostFlisRom(attr).rect).toEqual({ minX: 1999.5, minY: -0.5, maxX: 4000.5, maxY: 2000.5 })
  })
  it('viewBox uten offset gir forskyvning lik x/y', () => {
    const rom = ghostFlisRom({ x: '2000', y: '0', width: '2000', height: '2000', viewBox: '0 0 2000 2000' })
    expect(rom.dx).toBe(2000)
    expect(rom.dy).toBe(0)
  })
  it('komma-separert viewBox leses likt', () => {
    expect(ghostFlisRom({ ...attr, viewBox: '-0.5,-0.5,2001,2001' }).dx).toBe(2000)
  })
  it('manglende viewBox faller tilbake på null-offset', () => {
    expect(ghostFlisRom({ x: '10', y: '20', width: '5', height: '5' }).dx).toBe(10)
  })
  it('null på søppel og på ikke-positiv størrelse', () => {
    expect(ghostFlisRom()).toBeNull()
    expect(ghostFlisRom({ x: 'a', y: '0', width: '10', height: '10' })).toBeNull()
    expect(ghostFlisRom({ x: '0', y: '0', width: '0', height: '10' })).toBeNull()
  })
})

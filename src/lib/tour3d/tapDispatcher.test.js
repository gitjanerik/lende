import { describe, it, expect } from 'vitest'
import { attachTapDispatcher, isTap, TAP_SLOP_PX, TAP_MAX_MS } from './tapDispatcher.js'

// Minimal element-stubb: nok til å registrere lyttere og sende hendelser.
function stubEl() {
  const handlers = new Map()
  return {
    handlers,
    addEventListener(type, fn) { handlers.set(type, fn) },
    removeEventListener(type, fn) { if (handlers.get(type) === fn) handlers.delete(type) },
    send(type, e) { handlers.get(type)?.(e) },
  }
}

describe('isTap', () => {
  it('stille finger innen tidsvinduet er et trykk', () => {
    expect(isTap({ x: 100, y: 100, t: 0 }, { x: 103, y: 98, t: 120 })).toBe(true)
  })

  it('for langt flyttet er et drag, ikke et trykk', () => {
    expect(isTap({ x: 100, y: 100, t: 0 }, { x: 100 + TAP_SLOP_PX + 1, y: 100, t: 50 })).toBe(false)
  })

  it('for lenge nede er ikke et trykk', () => {
    expect(isTap({ x: 100, y: 100, t: 0 }, { x: 100, y: 100, t: TAP_MAX_MS + 1 })).toBe(false)
  })
})

describe('attachTapDispatcher', () => {
  const oppsett = () => {
    const el = stubEl()
    const treff = []
    let na = 0
    const d = attachTapDispatcher(el, (e) => treff.push(e), { now: () => na })
    return { el, treff, d, tid: (v) => { na = v } }
  }

  it('melder et trykk', () => {
    const { el, treff } = oppsett()
    el.send('pointerdown', { clientX: 10, clientY: 10 })
    el.send('pointerup', { clientX: 12, clientY: 11 })
    expect(treff).toHaveLength(1)
  })

  it('melder ikke et drag', () => {
    const { el, treff } = oppsett()
    el.send('pointerdown', { clientX: 10, clientY: 10 })
    el.send('pointerup', { clientX: 90, clientY: 10 })
    expect(treff).toHaveLength(0)
  })

  it('melder ikke en finger som lå lenge nede', () => {
    const { el, treff, tid } = oppsett()
    el.send('pointerdown', { clientX: 10, clientY: 10 })
    tid(TAP_MAX_MS + 50)
    el.send('pointerup', { clientX: 10, clientY: 10 })
    expect(treff).toHaveLength(0)
  })

  it('pointerup uten forutgående pointerdown gjør ingenting', () => {
    const { el, treff } = oppsett()
    el.send('pointerup', { clientX: 10, clientY: 10 })
    expect(treff).toHaveLength(0)
  })

  it('dispose kobler fra begge lytterne', () => {
    const { el, d } = oppsett()
    d.dispose()
    expect(el.handlers.size).toBe(0)
  })
})

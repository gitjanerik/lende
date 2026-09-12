import { describe, it, expect, vi, afterEach } from 'vitest'
import { etterMaling } from './etterMaling.js'

function riggRaf() {
  const ko = []
  vi.stubGlobal('requestAnimationFrame', (fn) => { ko.push(fn); return ko.length })
  vi.stubGlobal('cancelAnimationFrame', (id) => { ko[id - 1] = null })
  return {
    bilde() {
      const naa = ko.splice(0, ko.length)
      for (const fn of naa) fn?.()
    },
  }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('etterMaling', () => {
  it('venter på at ET bilde er malt — altså to rAF-er', () => {
    const raf = riggRaf()
    const fn = vi.fn()
    etterMaling(fn)
    raf.bilde()
    expect(fn).not.toHaveBeenCalled()   // første rAF er FØR malingen
    raf.bilde()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('avbryt stopper arbeidet i begge trinnene', () => {
    for (const nårAvbryt of [0, 1]) {
      const raf = riggRaf()
      const fn = vi.fn()
      const avbryt = etterMaling(fn)
      for (let i = 0; i < nårAvbryt; i++) raf.bilde()
      avbryt()
      raf.bilde(); raf.bilde()
      expect(fn).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    }
  })

  it('faller tilbake på setTimeout uten rAF', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    const fn = vi.fn()
    etterMaling(fn)
    await new Promise(r => setTimeout(r, 5))
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

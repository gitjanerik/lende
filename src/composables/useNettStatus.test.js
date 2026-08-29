import { describe, it, expect, afterEach, vi } from 'vitest'
import { effectScope } from 'vue'
import { useNettStatus } from './useNettStatus.js'

// Fortegnet er hele poenget med denne composablen: de tre kopiene den avløste
// init-et onLine med MOTSATT fortegn (`=== false` i MapView, `!` i
// GravelPlannerView), og en migrasjon som snur ett av dem er en stille feil.
// Testen holder BEGGE retningene fast.
//
function monter(onLineStart) {
  const lyttere = {}
  const nav = { onLine: onLineStart }
  const win = {
    addEventListener: (t, h) => { lyttere[t] = h },
    removeEventListener: vi.fn(),
  }
  const prevWin = globalThis.window
  const prevNav = globalThis.navigator
  globalThis.window = win
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true })
  const scope = effectScope()
  const api = scope.run(() => useNettStatus())
  const gjenopprett = () => {
    globalThis.window = prevWin
    Object.defineProperty(globalThis, 'navigator', { value: prevNav, configurable: true, writable: true })
  }
  return { api, nav, lyttere, win, scope, gjenopprett }
}

const aktive = []
afterEach(() => { while (aktive.length) aktive.pop()() })

function med(onLineStart) {
  const m = monter(onLineStart)
  aktive.push(() => { m.scope.stop(); m.gjenopprett() })
  return m
}

describe('useNettStatus', () => {
  it('de to flaggene er alltid motsatte', () => {
    const { api } = med(true)
    expect(api.erPaaNett.value).toBe(true)
    expect(api.erOffline.value).toBe(false)
  })

  it('starter offline når nettleseren sier offline', () => {
    const { api } = med(false)
    expect(api.erOffline.value).toBe(true)
    expect(api.erPaaNett.value).toBe(false)
  })

  // navigator.onLine kan være undefined i eksotiske miljøer. Da er «vi vet ikke»
  // det samme som «på nett» — vi skal ikke blokkere på en mangel.
  it('behandler ukjent onLine som på nett', () => {
    const { api } = med(undefined)
    expect(api.erPaaNett.value).toBe(true)
    expect(api.erOffline.value).toBe(false)
  })

  it('følger offline- og online-eventene', () => {
    const { api, nav, lyttere } = med(true)
    nav.onLine = false
    lyttere.offline()
    expect(api.erOffline.value).toBe(true)
    nav.onLine = true
    lyttere.online()
    expect(api.erOffline.value).toBe(false)
  })

  it('kobler lytterne straks, ikke ved mount', () => {
    const { lyttere } = med(true)
    expect(typeof lyttere.online).toBe('function')
    expect(typeof lyttere.offline).toBe('function')
  })

  it('rydder lytterne når scopet stoppes', () => {
    const { win, scope } = med(true)
    scope.stop()
    const typer = win.removeEventListener.mock.calls.map((c) => c[0])
    expect(typer).toContain('online')
    expect(typer).toContain('offline')
  })
})

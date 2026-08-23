import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseHTML } from 'linkedom'
import { createEngineLoop } from './engineLoop.js'

// Testene kjører i node (ingen jsdom i dette prosjektet), så DOM-en bygges med
// linkedom — samme bibliotek som headless kart-byggingen bruker.
let dok

// Minimalt renderer/container-oppsett. Loopen rører bare setSize, domElement og
// container-målene, så resten er uinteressant her.
function lagOppsett() {
  const domElement = dok.document.createElement('canvas')
  const renderer = {
    domElement,
    setSize: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
  }
  const container = dok.document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 400, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })
  dok.document.body.appendChild(container)
  const camera = { aspect: 1, fov: 55, updateProjectionMatrix: vi.fn() }
  return { renderer, container, camera }
}

// jsdom har ingen rAF-klokke vi kan styre, så vi driver framene selv.
let ventende = []
beforeEach(() => {
  dok = parseHTML('<!doctype html><html><body></body></html>')
  Object.defineProperty(dok.document, 'hidden', { value: false, writable: true, configurable: true })
  vi.stubGlobal('document', dok.document)
  vi.stubGlobal('window', dok.window)
  vi.stubGlobal('Event', dok.Event)
  ventende = []
  vi.stubGlobal('requestAnimationFrame', (fn) => { ventende.push(fn); return ventende.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  // Bare timerne skal være falske: vitest sin useFakeTimers overtar ellers
  // requestAnimationFrame også, og da forsvinner stubben vi driver framene med.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const kjørFramer = (n, startT = 16) => {
  for (let i = 0; i < n; i++) {
    const fn = ventende.shift()
    if (!fn) return i
    fn(startT + i * 16)
  }
  return n
}

const settSkjult = (skjult) => {
  Object.defineProperty(dok.document, 'hidden', { value: skjult, writable: true, configurable: true })
  dok.document.dispatchEvent(new dok.Event('visibilitychange'))
}

describe('createEngineLoop', () => {
  it('lever videre når onFrame kaster', () => {
    // Regresjonen fra v5.22.12: kastet onFrame, ble linja som ber om neste frame
    // aldri nådd, og 3D-visningen sto frosset til brukeren lukket den. Ett unntak
    // skal koste én frame, ikke hele økta.
    const feil = vi.spyOn(console, 'error').mockImplementation(() => {})
    let kall = 0
    const onFrame = vi.fn(() => { kall++; if (kall === 2) throw new Error('bang') })
    const loop = createEngineLoop({ ...lagOppsett(), onFrame })
    loop.start()

    kjørFramer(5)
    expect(onFrame).toHaveBeenCalledTimes(5)
    expect(loop.frames).toBe(5)
    expect(feil).toHaveBeenCalledTimes(1)   // logget ÉN gang, ikke per frame
    loop.dispose()
    feil.mockRestore()
  })

  it('starter loopen igjen når siden blir synlig', () => {
    const onFrame = vi.fn()
    const loop = createEngineLoop({ ...lagOppsett(), onFrame })
    loop.start()
    kjørFramer(1)

    settSkjult(true)
    expect(loop.running).toBe(false)

    settSkjult(false)
    expect(loop.running).toBe(true)
    kjørFramer(1)
    expect(loop.frames).toBe(2)
    loop.dispose()
  })

  it('sier fra når loopen IKKE kom i gang igjen', () => {
    // Symptomet fra felt: tilbake fra en annen app sto visningen frosset — ingen
    // zoom, ingen knapper — til man lukket 3D og gikk inn igjen. Vaktbikkja
    // sjekker at det faktisk kom en frame, prøver én omstart, og gir opp høyt.
    const onDead = vi.fn()
    const loop = createEngineLoop({ ...lagOppsett(), onFrame: () => {}, onDead })
    loop.start()
    kjørFramer(1)

    settSkjult(true)
    settSkjult(false)
    ventende = []              // ingen framer leveres: rAF svarer ikke

    vi.advanceTimersByTime(1500)
    expect(onDead).not.toHaveBeenCalled()   // først én omstart
    ventende = []
    vi.advanceTimersByTime(1500)
    expect(onDead).toHaveBeenCalledTimes(1)
    loop.dispose()
  })

  it('sier ikke fra når framene faktisk kommer', () => {
    const onDead = vi.fn()
    const loop = createEngineLoop({ ...lagOppsett(), onFrame: () => {}, onDead })
    loop.start()
    kjørFramer(1)

    settSkjult(true)
    settSkjult(false)
    kjørFramer(3)
    vi.advanceTimersByTime(4000)
    expect(onDead).not.toHaveBeenCalled()
    loop.dispose()
  })

  it('vekkes også av resume, pageshow og focus', () => {
    // visibilitychange kommer ikke alltid når Android har fryst siden.
    for (const [hvor, event] of [['document', 'resume'], ['window', 'pageshow'], ['window', 'focus']]) {
      const mål = hvor === 'document' ? dok.document : dok.window
      const loop = createEngineLoop({ ...lagOppsett(), onFrame: () => {} })
      loop.start()
      loop.stop()
      expect(loop.running).toBe(false)
      Object.defineProperty(dok.document, 'hidden', { value: false, writable: true, configurable: true })
      mål.dispatchEvent(new dok.Event(event))
      expect(loop.running).toBe(true)
      loop.dispose()
    }
  })
})

// GPS AV SKAL FJERNE POSISJONEN (v7.9.24). stop() lot svgX/svgY stå, så den blå
// prikken ble hengende på kartet etter at snarveien «Posisjon» var slått av.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useUserPosition } from './useUserPosition.js'

const META = { minE: 0, minN: 0, widthM: 2000, heightM: 2000, utmZone: 32 }

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('useUserPosition.stop', () => {
  it('nullstiller posisjonen, så prikken kan fjernes', () => {
    vi.useFakeTimers()
    let cb
    vi.stubGlobal('navigator', { geolocation: {
      watchPosition: (ok) => { cb = ok; return 1 },
      clearWatch: () => {},
      getCurrentPosition: () => {},
    } })
    const pos = useUserPosition(() => META)
    pos.start()
    cb({ coords: { latitude: 59.73, longitude: 10.11, accuracy: 5 } })
    expect(pos.latRaw).toBe(59.73)
    pos.stop()
    expect(pos.isWatching).toBe(false)
    expect(pos.svgX).toBeNull()
    expect(pos.svgY).toBeNull()
    expect(pos.latRaw).toBeNull()
    expect(pos.accuracyM).toBeNull()
    expect(pos.isOutsideMap).toBe(false)
  })
})

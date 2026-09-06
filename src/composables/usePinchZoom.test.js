import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePinchZoom } from './usePinchZoom.js'

// Et minimalt «element»: composable-en trenger bare målene.
function fakeEl(w = 400, h = 800) {
  return { getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }), addEventListener() {}, removeEventListener() {} }
}

describe('usePinchZoom — hvile-rotasjonen er SANN nord', () => {
  const NORD = -9.4   // Tromsø: meridiankonvergens i UTM 32

  it('reset() lander på nordRotasjon', () => {
    const el = ref(fakeEl())
    const { reset, rotation } = usePinchZoom(el, { nordRotasjon: () => NORD })
    rotation.value = 42
    reset()
    expect(rotation.value).toBe(NORD)
  })

  // Regresjonen fra v6.5.64: panTo satte rotasjonen til 0 (kartnord), så et
  // ferskt ark mistet sann nord i lasteløypas eget panTo, «Sentrer» rettet
  // arket opp på rutenettet og et søketreff vred et rotert ark tilbake.
  it('panTo uten keepRotation lander på nordRotasjon, ikke 0', () => {
    const el = ref(fakeEl())
    const { panTo, rotation } = usePinchZoom(el, { nordRotasjon: () => NORD })
    rotation.value = 42
    panTo(1000, 1000, { vbWidth: 2000, vbHeight: 2000, targetScale: 2 })
    expect(rotation.value).toBe(NORD)
  })

  it('panTo med keepRotation lar rotasjonen stå', () => {
    const el = ref(fakeEl())
    const { panTo, rotation } = usePinchZoom(el, { nordRotasjon: () => NORD })
    rotation.value = 42
    panTo(1000, 1000, { vbWidth: 2000, vbHeight: 2000, targetScale: 2, keepRotation: true })
    expect(rotation.value).toBe(42)
  })

  // Flatene uten nord-UI (ViewerView) sender ingen nordRotasjon og skal være
  // uendret — hvile er fortsatt 0 der.
  it('uten nordRotasjon er hvile fortsatt 0', () => {
    const el = ref(fakeEl())
    const { panTo, reset, rotation } = usePinchZoom(el, {})
    rotation.value = 42
    panTo(1000, 1000, { vbWidth: 2000, vbHeight: 2000 })
    expect(rotation.value).toBe(0)
    rotation.value = 42
    reset()
    expect(rotation.value).toBe(0)
  })

  // panTo skal sentrere punktet uansett hvilken vinkel arket står i.
  it('panTo sentrerer punktet også med rotasjon på', () => {
    const el = ref(fakeEl(400, 800))
    const { panTo, rotation, translateX, translateY, scale } = usePinchZoom(el, { nordRotasjon: () => NORD })
    panTo(500, 500, { vbWidth: 2000, vbHeight: 2000, targetScale: 3 })
    const fit = Math.min(400 / 2000, 800 / 2000)
    const px = (400 - 2000 * fit) / 2 + 500 * fit
    const py = (800 - 2000 * fit) / 2 + 500 * fit
    const rad = rotation.value * Math.PI / 180
    const sx = translateX.value + scale.value * (px * Math.cos(rad) - py * Math.sin(rad))
    const sy = translateY.value + scale.value * (px * Math.sin(rad) + py * Math.cos(rad))
    expect(sx).toBeCloseTo(200, 6)
    expect(sy).toBeCloseTo(400, 6)
  })
})

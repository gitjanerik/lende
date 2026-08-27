// Himmelvippen — regelen som gjør at man kan se OPP i 3D.
//
// Bare den rene funksjonen testes her. Selve riggen krever OrbitControls og et
// DOM-element, og monteringen dekkes av røyktesten (scripts/royk-mapview.mjs),
// som faktisk drar en finger nedover i Chromium og leser av blikkretningen.
// Det som IKKE kan feilsøkes fra et skjermbilde er regnestykket: at utslaget
// bare går inn i vippen når orbiten har gitt seg, og at det spises opp igjen
// FØR orbiten får bevege seg tilbake.
import { describe, it, expect } from 'vitest'
import { PerspectiveCamera, Vector3, Matrix4 } from 'three'
import { himmelVippSteg, HIMMEL_VIPP_MAKS } from './freeRig.js'

// Radianer per piksel, som i riggen: 2π over elementets høyde.
const FART = (2 * Math.PI) / 900

describe('himmelVippSteg', () => {
  it('vipper ikke før orbiten står på taket', () => {
    // Dette er hele grunnen til at gesten er en fortsettelse og ikke en modus:
    // uten betingelsen ville hvert drag nedover både tiltet kartet OG løftet
    // blikket, og de to bevegelsene hadde lagt seg oppå hverandre.
    expect(himmelVippSteg(0, 50, false, FART)).toBe(0)
    expect(himmelVippSteg(0, 300, false, FART)).toBe(0)
  })

  it('tar utslaget når orbiten står på taket', () => {
    const etter = himmelVippSteg(0, 60, true, FART)
    expect(etter).toBeCloseTo(60 * FART, 10)
    expect(etter).toBeGreaterThan(0)
  })

  it('stopper på taket sitt', () => {
    // Et langt drag skal ikke kunne vippe kameraet forbi senit og opp-ned.
    expect(himmelVippSteg(0, 100000, true, FART)).toBe(HIMMEL_VIPP_MAKS)
    expect(himmelVippSteg(HIMMEL_VIPP_MAKS, 500, true, FART)).toBe(HIMMEL_VIPP_MAKS)
  })

  it('spiser vippen på vei tilbake, og bare den', () => {
    const start = 40 * FART
    // Halve veien tilbake.
    expect(himmelVippSteg(start, -20, true, FART)).toBeCloseTo(20 * FART, 10)
    // Hele veien og mer: den stopper på 0 og lar resten være orbitens.
    expect(himmelVippSteg(start, -400, true, FART)).toBe(0)
  })

  it('lar draget nedover være orbitens når vippen er brukt opp', () => {
    // Uten dette ville orbiten stått fast: et drag tilbake ville alltid gått
    // inn i en vipp som allerede var null.
    expect(himmelVippSteg(0, -80, true, FART)).toBe(0)
    expect(himmelVippSteg(0, -80, false, FART)).toBe(0)
  })

  it('spiser vippen selv om orbiten ikke står på taket', () => {
    // Kan skje etter en zoom eller en dempet bevegelse: vippen er i bruk, men
    // polarvinkelen har glidd et hakk. Den skal fortsatt kunne dras ned.
    expect(himmelVippSteg(30 * FART, -10, false, FART)).toBeCloseTo(20 * FART, 10)
  })

  it('gjør ingenting på et tomt eller ugyldig utslag', () => {
    const v = 20 * FART
    expect(himmelVippSteg(v, 0, true, FART)).toBe(v)
    expect(himmelVippSteg(v, NaN, true, FART)).toBe(v)
    expect(himmelVippSteg(v, undefined, true, FART)).toBe(v)
  })

  it('taket er høyt nok til å se himmelen, men ikke opp-ned', () => {
    const grader = (HIMMEL_VIPP_MAKS * 180) / Math.PI
    // Orbiten selv gir 89° (blikket vannrett). 75° på toppen av det er nesten
    // rett opp; forbi senit ville bildet stått uten et eneste holdepunkt.
    expect(grader).toBeGreaterThan(60)
    expect(grader).toBeLessThan(90)
  })
})

describe('vippens retning', () => {
  // Den ene tingen som kan være snudd, og som ingen aritmetikk-test fanger:
  // vipper `camera.rotateX(vipp)` blikket OPP eller NED? Riggen legger den på
  // etter controls.update(), akkurat slik som her.
  const seVannrett = () => {
    const kamera = new PerspectiveCamera(55, 1, 1, 60000)
    kamera.position.set(0, 500, 1000)
    // Blikkpunkt i samme høyde ⇒ vannrett blikk, som orbiten på taket sitt.
    kamera.quaternion.setFromRotationMatrix(
      new Matrix4().lookAt(kamera.position, new Vector3(0, 500, 0), new Vector3(0, 1, 0)),
    )
    return kamera
  }
  const retningY = (kamera) => kamera.getWorldDirection(new Vector3()).y

  it('starter vannrett', () => {
    expect(retningY(seVannrett())).toBeCloseTo(0, 6)
  })

  it('løfter blikket over horisonten', () => {
    const kamera = seVannrett()
    kamera.rotateX(0.6)
    expect(retningY(kamera)).toBeGreaterThan(0.5)
  })

  it('ved fullt utslag peker blikket nesten rett opp', () => {
    const kamera = seVannrett()
    kamera.rotateX(HIMMEL_VIPP_MAKS)
    // sin(75°) ≈ 0,966 — altså himmelen og ikke horisonten.
    expect(retningY(kamera)).toBeCloseTo(Math.sin(HIMMEL_VIPP_MAKS), 5)
    expect(retningY(kamera)).toBeGreaterThan(0.95)
  })

  it('null vipp rører ingenting', () => {
    const kamera = seVannrett()
    const f0 = kamera.quaternion.clone()
    kamera.rotateX(0)
    expect(kamera.quaternion.equals(f0)).toBe(true)
  })
})

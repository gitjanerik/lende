import { describe, it, expect } from 'vitest'
import {
  zoomBroek, zoomFraBroek, roseTilRetning, retningTilRose, hoydeBroek, normaliserGrader,
} from './navKontroller.js'

describe('zoom-skyven', () => {
  it('legger endene på 0 og 1', () => {
    expect(zoomBroek(0.5, 0.5, 60)).toBe(0)
    expect(zoomBroek(60, 0.5, 60)).toBe(1)
  })

  it('gir hvert doblings-steg like mye plass', () => {
    // Det er hele grunnen til at den er logaritmisk: 1→2 skal ta like stor del
    // av skyven som 8→16, ellers ligger halve området i de siste prosentene.
    const et = zoomBroek(2, 0.5, 60) - zoomBroek(1, 0.5, 60)
    const to = zoomBroek(16, 0.5, 60) - zoomBroek(8, 0.5, 60)
    expect(et).toBeCloseTo(to, 12)
  })

  it('er sin egen inverse', () => {
    for (const s of [0.5, 1, 3.7, 12, 60]) {
      expect(zoomFraBroek(zoomBroek(s, 0.5, 60), 0.5, 60)).toBeCloseTo(s, 9)
    }
  })

  it('klamper utenfor området i stedet for å eksplodere', () => {
    expect(zoomBroek(1000, 0.5, 60)).toBe(1)
    expect(zoomBroek(0.001, 0.5, 60)).toBe(0)
    expect(zoomFraBroek(2, 0.5, 60)).toBeCloseTo(60, 9)
    expect(zoomFraBroek(-1, 0.5, 60)).toBeCloseTo(0.5, 9)
  })

  it('tåler tull uten å kaste', () => {
    expect(zoomBroek(NaN, 0.5, 60)).toBe(0)
    expect(zoomBroek(1, 0, 60)).toBe(0)
    expect(zoomFraBroek(NaN, 0.5, 60)).toBe(0.5)
  })
})

describe('retningsrosa', () => {
  const R = 40

  it('leser nord OPP på skjermen', () => {
    expect(roseTilRetning(0, -R, R).azimut).toBeCloseTo(0, 9)
  })

  it('lar azimut vokse med klokka: øst er +90', () => {
    // Fortegnet her er det ene som kan være snudd uten at noe kaster, og en
    // snudd rose sender kartet motsatt vei av fingeren.
    expect(roseTilRetning(R, 0, R).azimut).toBeCloseTo(90, 9)
    expect(roseTilRetning(0, R, R).azimut).toBeCloseTo(180, 9)
    expect(roseTilRetning(-R, 0, R).azimut).toBeCloseTo(-90, 9)
  })

  it('holder azimuten uendret i dødsonen midt på', () => {
    // atan2(0,0) er nord, så uten dødsonen ville en finger som passerer midten
    // snurret kartet til nord på veien.
    expect(roseTilRetning(1, 1, R).azimut).toBeNull()
    expect(roseTilRetning(1, 1, R).hoyde).not.toBeNull()
  })

  it('setter senter til senit og randen rett ned', () => {
    expect(roseTilRetning(0, -R, R).hoyde).toBeCloseTo(-85, 9)
    expect(roseTilRetning(0, 0, R).hoyde).toBeCloseTo(74, 9)
  })

  it('lar horisonten ligge mellom senter og rand', () => {
    const f = hoydeBroek(0, -85, 74)
    expect(f).toBeGreaterThan(0.2)
    expect(f).toBeLessThan(0.8)
  })

  it('slår av høyden i kart-modus', () => {
    const r = roseTilRetning(10, 10, R, { hoyde: false })
    expect(r.hoyde).toBeNull()
    expect(r.azimut).toBeCloseTo(135, 9)
  })

  it('er sin egen inverse gjennom retningTilRose', () => {
    // Høydene her ligger med vilje utenfor dødsonen: nær SENIT er azimuten
    // meningsløs — pucken står i midten — akkurat som på en ekte himmelkule.
    for (const [az, h] of [[0, 20], [90, -40], [-135, 0], [179, 45]]) {
      const p = retningTilRose(az, h, R)
      const t = roseTilRetning(p.x, p.y, R)
      expect(t.azimut).toBeCloseTo(az, 6)
      expect(t.hoyde).toBeCloseTo(h, 6)
    }
  })

  it('legger pucken på randen i kart-modus', () => {
    const p = retningTilRose(90, null, R, { hoyde: false })
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(R, 9)
  })
})

describe('normaliserGrader', () => {
  it('lander i (−180, 180]', () => {
    expect(normaliserGrader(190)).toBeCloseTo(-170, 9)
    expect(normaliserGrader(-190)).toBeCloseTo(170, 9)
    expect(normaliserGrader(180)).toBeCloseTo(180, 9)
    expect(normaliserGrader(-180)).toBeCloseTo(180, 9)
    expect(normaliserGrader(720)).toBeCloseTo(0, 9)
  })
})

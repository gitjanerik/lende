import { describe, it, expect } from 'vitest'
import {
  rotasjonEndret, lagRotasjonsBudsjett,
  ROT_TERSKEL_GRAD, PASS_BUDSJETT_MS, MAKS_OVERSKRIDELSER,
} from './mykRotasjon.js'

describe('rotasjonEndret', () => {
  it('første skriving skjer alltid', () => {
    expect(rotasjonEndret(null, 0)).toBe(true)
    expect(rotasjonEndret(undefined, 40)).toBe(true)
    expect(rotasjonEndret(NaN, 40)).toBe(true)
  })

  it('koalescerer eventer som lander i samme frame', () => {
    expect(rotasjonEndret(40, 40.1)).toBe(false)
    expect(rotasjonEndret(0, ROT_TERSKEL_GRAD)).toBe(true)
    expect(rotasjonEndret(40, 41)).toBe(true)
  })

  it('er retningsuavhengig', () => {
    expect(rotasjonEndret(40, 38)).toBe(true)
    expect(rotasjonEndret(40, 42)).toBe(true)
  })
})

describe('lagRotasjonsBudsjett', () => {
  it('starter aktivt og holder seg aktivt på raske pass', () => {
    const b = lagRotasjonsBudsjett()
    expect(b.erAktiv()).toBe(true)
    for (let i = 0; i < 50; i++) expect(b.registrer(2)).toBe(true)
    expect(b.erAktiv()).toBe(true)
    expect(b.status().pass).toBe(50)
    expect(b.status().verstMs).toBe(2)
  })

  it('gir opp etter maks overskridelser — og de er KUMULATIVE', () => {
    const b = lagRotasjonsBudsjett({ budsjettMs: 8, maksOverskridelser: 2 })
    expect(b.registrer(20)).toBe(true)     // én sprekk tolereres
    for (let i = 0; i < 30; i++) b.registrer(1)  // en rolig periode frikjenner ikke
    expect(b.erAktiv()).toBe(true)
    expect(b.registrer(20)).toBe(false)
    expect(b.erAktiv()).toBe(false)
  })

  it('et pass nøyaktig på budsjettet er innafor', () => {
    const b = lagRotasjonsBudsjett({ budsjettMs: 8, maksOverskridelser: 1 })
    expect(b.registrer(8)).toBe(true)
    expect(b.registrer(8.001)).toBe(false)
  })

  it('nullstill gir live-modus tilbake (nytt kart, ny sjanse)', () => {
    const b = lagRotasjonsBudsjett({ budsjettMs: 8, maksOverskridelser: 1 })
    b.registrer(99)
    expect(b.erAktiv()).toBe(false)
    b.nullstill()
    expect(b.erAktiv()).toBe(true)
    expect(b.status()).toMatchObject({ pass: 0, verstMs: 0, overskridelser: 0 })
  })

  it('standardene er de dokumenterte', () => {
    expect(lagRotasjonsBudsjett().status()).toMatchObject({
      budsjettMs: PASS_BUDSJETT_MS, maksOverskridelser: MAKS_OVERSKRIDELSER,
    })
  })
})

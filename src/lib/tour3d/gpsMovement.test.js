import { describe, it, expect } from 'vitest'
import { createGpsMovement } from './gpsMovement.js'

const MIN = 60_000

describe('createGpsMovement', () => {
  it('gir null uten nok forflytning — GPS-støy i ro er ikke bevegelse', () => {
    const m = createGpsMovement()
    // Fikser som hopper ±8 m rundt samme punkt, som ekte GPS i ro.
    m.push(100, 100, 0)
    m.push(108, 95, 1000)
    m.push(94, 104, 2000)
    m.push(102, 98, 3000)
    expect(m.heading(3000)).toBeNull()
  })

  it('gir enhetsvektor i netto bevegelsesretning', () => {
    const m = createGpsMovement()
    m.push(0, 0, 0)
    m.push(40, 0, 30_000)
    m.push(80, 0, 60_000)
    const h = m.heading(60_000)
    expect(h).not.toBeNull()
    expect(h[0]).toBeCloseTo(1)
    expect(h[1]).toBeCloseTo(0)
  })

  it('retningen er netto, ikke siste segment', () => {
    const m = createGpsMovement()
    m.push(0, 0, 0)
    m.push(100, 0, 60_000)   // østover …
    m.push(100, 40, 120_000) // … så en sving sørover på slutten
    const h = m.heading(120_000)
    // Netto peker mest østover men litt sør.
    expect(h[0]).toBeGreaterThan(h[1])
    expect(h[1]).toBeGreaterThan(0)
  })

  it('glemmer fikser eldre enn vinduet — gikk man for 6 min siden, står man nå', () => {
    const m = createGpsMovement()
    m.push(0, 0, 0)
    m.push(500, 0, MIN)          // stor forflytning tidlig
    m.push(500, 2, 6 * MIN)      // så i ro
    m.push(501, 0, 7 * MIN)
    // Ved 7 min er de gamle fiksene utenfor 5-minuttersvinduet.
    expect(m.heading(7 * MIN)).toBeNull()
  })

  it('holder retningen så lenge forflytningen er innenfor vinduet', () => {
    const m = createGpsMovement()
    m.push(0, 0, 0)
    m.push(200, 0, MIN)
    m.push(201, 1, 2 * MIN)      // stoppet, men gikk nettopp
    const h = m.heading(3 * MIN)
    expect(h).not.toBeNull()
    expect(h[0]).toBeCloseTo(1, 1)
  })

  it('ignorerer fikser ute av rekkefølge og ugyldige verdier', () => {
    const m = createGpsMovement()
    m.push(0, 0, 1000)
    m.push(NaN, 5, 2000)
    m.push(50, 0, 500)     // eldre enn forrige — droppes
    m.push(200, 0, 3000)
    const h = m.heading(3000)
    expect(h[0]).toBeCloseTo(1)
  })

  it('reset tømmer historikken', () => {
    const m = createGpsMovement()
    m.push(0, 0, 0)
    m.push(200, 0, 1000)
    m.reset()
    expect(m.heading(2000)).toBeNull()
  })

  it('respekterer egne terskler', () => {
    const m = createGpsMovement({ minMoveM: 5 })
    m.push(0, 0, 0)
    m.push(8, 0, 1000)
    expect(m.heading(1000)).not.toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { createFeatureDirector } from './featureDirector.js'

const EVENT = { alongM: 1000, approachM: 100, holdMs: 4000, name: 'Toppen', type: 'topp' }

describe('createFeatureDirector', () => {
  it('CRUISE → APPROACH → HOLD → RESUME → CRUISE med riktige speedFactors', () => {
    const entered = []
    const exited = []
    const d = createFeatureDirector([EVENT], { onEnter: e => entered.push(e), onExit: e => exited.push(e) })

    expect(d.tick(500, 16).speedFactor).toBe(1)
    expect(d.state).toBe('CRUISE')

    const approach = d.tick(950, 16)
    expect(d.state).toBe('APPROACH')
    expect(approach.speedFactor).toBeLessThan(1)
    expect(approach.speedFactor).toBeGreaterThanOrEqual(0.25)

    const hold = d.tick(1000, 16)
    expect(d.state).toBe('HOLD')
    expect(hold.speedFactor).toBe(0)
    expect(entered.map(e => e.name)).toEqual(['Toppen'])

    // Hold-tiden går på dt, ikke alongM (som står stille ved factor 0).
    d.tick(1000, 3000)
    expect(d.state).toBe('HOLD')
    const resume = d.tick(1000, 1100)
    expect(d.state).toBe('RESUME')
    expect(exited.map(e => e.name)).toEqual(['Toppen'])
    expect(resume.speedFactor).toBeGreaterThan(0)
    expect(resume.speedFactor).toBeLessThan(1)

    d.tick(1050, 5000)
    expect(d.state).toBe('CRUISE')
    expect(d.tick(1100, 16).speedFactor).toBe(1)
  })

  it('trigges ikke to ganger for samme hendelse', () => {
    const entered = []
    const d = createFeatureDirector([EVENT], { onEnter: e => entered.push(e) })
    d.tick(1000, 16)
    d.tick(1000, 10000)
    d.tick(1100, 10000)
    d.tick(900, 16)
    d.tick(1000, 16)
    expect(entered.length).toBe(1)
  })

  it('skip() avbryter HOLD umiddelbart', () => {
    const exited = []
    const d = createFeatureDirector([EVENT], { onExit: e => exited.push(e) })
    d.tick(1000, 16)
    expect(d.state).toBe('HOLD')
    d.skip()
    expect(d.state).toBe('RESUME')
    expect(exited.length).toBe(1)
  })

  it('seek forbi hendelsen re-trigger den ikke', () => {
    const entered = []
    const d = createFeatureDirector([EVENT], { onEnter: e => entered.push(e) })
    d.seek(2000)
    d.tick(2100, 16)
    expect(entered.length).toBe(0)
    expect(d.pending).toBe(0)
  })

  it('seek bakover gjør hendelser tilgjengelige igjen', () => {
    const entered = []
    const d = createFeatureDirector([EVENT], { onEnter: e => entered.push(e) })
    d.seek(2000)
    d.seek(0)
    d.tick(1000, 16)
    expect(entered.length).toBe(1)
  })

  it('setEvents midt i turen re-trigger ikke passerte hendelser', () => {
    const entered = []
    const d = createFeatureDirector([], { onEnter: e => entered.push(e) })
    d.tick(1500, 16)
    d.setEvents([EVENT, { ...EVENT, name: 'Neste', alongM: 3000 }], 1500)
    d.tick(1600, 16)
    expect(entered.length).toBe(0)
    d.tick(3000, 16)
    expect(entered.map(e => e.name)).toEqual(['Neste'])
  })

  it('setEnabled(false) under HOLD avslutter og gir factor 1', () => {
    const d = createFeatureDirector([EVENT])
    d.tick(1000, 16)
    expect(d.state).toBe('HOLD')
    d.setEnabled(false)
    expect(d.tick(1000, 16).speedFactor).toBe(1)
  })
})

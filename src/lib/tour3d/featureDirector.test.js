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

  it('eventNear finner nærmeste hendelse innen vindu (scrubbing)', () => {
    const d = createFeatureDirector([
      { ...EVENT, name: 'Nær', alongM: 1000 },
      { ...EVENT, name: 'Fjern', alongM: 3000 },
    ])
    expect(d.eventNear(1080)?.name).toBe('Nær')
    expect(d.eventNear(2000)).toBeNull()
    // Også hendelser man har passert skal kunne forhåndsvises bakover.
    d.seek(2500)
    expect(d.eventNear(1010)?.name).toBe('Nær')
  })

  it('setEnabled(false) under HOLD avslutter og gir factor 1', () => {
    const d = createFeatureDirector([EVENT])
    d.tick(1000, 16)
    expect(d.state).toBe('HOLD')
    d.setEnabled(false)
    expect(d.tick(1000, 16).speedFactor).toBe(1)
  })

  // v4.8.5: POI av under HELE avspillingen lot peker-indeksen stå på 0, siden
  // tick() returnerer før den avanserer når enabled er false. Slo man POI på
  // etter at turen var ferdig, spilte direktøren seg gjennom hele lista mens
  // posisjonen låg på mål — kameraet rammet inn en severdighet, returnerte til
  // punkt B, rammet inn neste. Kuren er at tourScene kaller seek(alongM) når
  // POI slås på; her låser vi oppførselen seek skal ha.
  it('POI slått på etter fullført avspilling utløser ingen passerte hendelser', () => {
    const entered = []
    const d = createFeatureDirector([
      { ...EVENT, name: 'Første', alongM: 1000 },
      { ...EVENT, name: 'Andre', alongM: 2000 },
    ], { onEnter: e => entered.push(e) })

    d.setEnabled(false)
    for (let m = 0; m <= 3000; m += 100) d.tick(m, 16)   // hele turen med POI av
    expect(entered).toEqual([])

    d.setEnabled(true)
    d.seek(3000)                                          // slik tourScene gjør
    expect(d.pending).toBe(0)
    d.tick(3000, 16)
    expect(entered).toEqual([])
    expect(d.state).toBe('CRUISE')
  })

  it('POI slått på MIDT i turen utløser bare hendelser som ligger foran', () => {
    const entered = []
    const d = createFeatureDirector([
      { ...EVENT, name: 'Første', alongM: 1000 },
      { ...EVENT, name: 'Andre', alongM: 2000 },
    ], { onEnter: e => entered.push(e) })

    d.setEnabled(false)
    for (let m = 0; m <= 1500; m += 100) d.tick(m, 16)
    d.setEnabled(true)
    d.seek(1500)
    expect(d.pending).toBe(1)

    d.tick(2000, 16)
    expect(entered.map(e => e.name)).toEqual(['Andre'])
  })
})

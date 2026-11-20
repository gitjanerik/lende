import { describe, it, expect } from 'vitest'
import { filtrerInnsjoer, eksempler, kartBestilling } from './innsjoIndeks.js'

const liste = [
  { nr: 1, navn: 'Mosetten', km2: 0.2 },
  { nr: 2, navn: 'Setten', km2: 11.6 },
  { nr: 3, navn: 'Tyrifjorden', alias: 'Holsfjorden', km2: 136, km: 8, demo: true, lat: 60, lon: 10 },
  { nr: 4, navn: null, km2: 50 },
]

describe('filtrerInnsjoer', () => {
  it('tomt søk gir alle med navn, største først', () => {
    expect(filtrerInnsjoer(liste, '').map(i => i.nr)).toEqual([3, 2, 1])
  })
  it('navn som starter med søket kommer før navn som inneholder det', () => {
    expect(filtrerInnsjoer(liste, 'sett').map(i => i.nr)).toEqual([2, 1])
  })
  it('finner på alias', () => {
    expect(filtrerInnsjoer(liste, 'hols').map(i => i.nr)).toEqual([3])
  })
})

describe('eksempler / kartBestilling', () => {
  it('tar bare med eksempler som finnes', () => {
    expect(eksempler(liste, ['Setten', 'Fjorda']).map(i => i.nr)).toEqual([2])
  })
  it('bestiller innsjøens egen bredde, i brukerens egen kartstil', () => {
    expect(kartBestilling(liste[2])).toEqual({ lat: 60, lon: 10, navn: 'Tyrifjorden', km: 8 })
  })
})

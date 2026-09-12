// Flis-cache-nøkkelen (v7.7.14). Flisene har FASTE filnavn og caches
// cache-first i service workeren, så nøkkelen er det eneste som skiller en ny
// bake fra en gammel — en feil her serverer gamle fliser for alltid.
import { describe, it, expect, beforeEach } from 'vitest'
import { lagFlisNokkel, settFlisNokkel, medFlisNokkel, nullstillFlisNokler } from './n50FlisNokkel.js'

const BASE = '/lende/data/n50-sti/'

beforeEach(() => nullstillFlisNokler())

describe('lagFlisNokkel', () => {
  it('gir samme nøkkel for samme manifest', () => {
    expect(lagFlisNokkel('{"versjon":2}')).toBe(lagFlisNokkel('{"versjon":2}'))
  })
  it('gir ny nøkkel når manifestet endrer seg', () => {
    expect(lagFlisNokkel('{"versjon":2}')).not.toBe(lagFlisNokkel('{"versjon":3}'))
  })
  // Én ny flis i lista er hele forskjellen på to baker — den MÅ slå ut.
  it('gir ny nøkkel når én flis kommer til', () => {
    const a = lagFlisNokkel('{"fliser":["59.0_10.0"]}')
    const b = lagFlisNokkel('{"fliser":["59.0_10.0","59.0_11.0"]}')
    expect(a).not.toBe(b)
  })
})

describe('medFlisNokkel', () => {
  it('lar URL-en stå urørt før manifestet er lest', () => {
    expect(medFlisNokkel(`${BASE}59.0_10.0.bin`, BASE)).toBe(`${BASE}59.0_10.0.bin`)
  })
  it('henger nøkkelen på som ?m= når manifestet er lest', () => {
    settFlisNokkel(BASE, '{"versjon":2}')
    const url = medFlisNokkel(`${BASE}59.0_10.0.bin`, BASE)
    expect(url).toMatch(/^\/lende\/data\/n50-sti\/59\.0_10\.0\.bin\?m=[a-z0-9]+$/)
  })
  it('holder de to basene fra hverandre', () => {
    const areal = '/lende/data/n50-areal/'
    settFlisNokkel(BASE, '{"versjon":2}')
    expect(medFlisNokkel(`${areal}59.0_10.0.bin`, areal)).toBe(`${areal}59.0_10.0.bin`)
  })
})

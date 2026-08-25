import { describe, it, expect } from 'vitest'
import {
  kodeFlis, lesFlis, TYPER, typeIndeks, MAGIC, VERSJON,
  bboxForRinger, arealM2, forenkleRinger, fliserForFlate, flisNokkel,
} from './n50ArealPakke.js'
import { flisNokkel as stiFlisNokkel, FLIS_LAT as STI_FLIS_LAT } from './n50StiPakke.js'

const ring = (pts) => pts.map(([lat, lon]) => ({ lat, lon }))
const KVADRAT = ring([[59.80, 10.10], [59.81, 10.10], [59.81, 10.12], [59.80, 10.12]])
const HULL = ring([[59.803, 10.105], [59.806, 10.105], [59.806, 10.110]])

describe('n50ArealPakke — koding', () => {
  it('round-tripper flate med hull', () => {
    const ut = lesFlis(kodeFlis([{ type: 'myr', ringer: [KVADRAT, HULL] }]))
    expect(ut).toHaveLength(1)
    expect(ut[0].type).toBe('myr')
    expect(ut[0].ringer.map((r) => r.length)).toEqual([4, 3])
    expect(ut[0].ringer[0][0].lat).toBeCloseTo(59.80, 5)
    expect(ut[0].ringer[1][2].lon).toBeCloseTo(10.110, 5)
  })

  it('er drastisk mindre enn GeoJSON', () => {
    // Hele poenget med et eget format. Klarer den ikke det, er kompleksiteten
    // ikke verdt noe og vi burde servert GeoJSON.
    const flater = Array.from({ length: 50 }, (_, i) => ({
      type: 'myr',
      ringer: [ring(Array.from({ length: 40 }, (_, j) =>
        [59.8 + i * 0.001 + j * 0.0001, 10.1 + j * 0.0002]))],
    }))
    const pakket = kodeFlis(flater).length
    const geojson = JSON.stringify(flater).length
    expect(pakket * 5).toBeLessThan(geojson)
  })

  it('dropper flater uten en gyldig ytre ring', () => {
    expect(lesFlis(kodeFlis([{ type: 'myr', ringer: [] }]))).toHaveLength(0)
    expect(lesFlis(kodeFlis([{ type: 'myr', ringer: [ring([[59, 10], [59.1, 10]])] }]))).toHaveLength(0)
  })

  it('ukjent type faller til «annet» i stedet for å kaste', () => {
    expect(typeIndeks('tullete')).toBe(TYPER.indexOf('annet'))
    expect(lesFlis(kodeFlis([{ type: 'tullete', ringer: [KVADRAT] }]))[0].type).toBe('annet')
  })

  it('skog og apen har faste plasser — en senere bake skal ikke kreve ny versjon', () => {
    // Rekkefølgen ER kodingen. Endres den, leses gamle fliser med feil type.
    expect(TYPER).toEqual(['myr', 'skog', 'apen', 'annet'])
  })

  it('kaster på feil magic og feil versjon', () => {
    expect(() => lesFlis(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/Ikke en N50-areal-flis/)
    const b = kodeFlis([{ type: 'myr', ringer: [KVADRAT] }])
    const versjonsOffset = b.findIndex((_, i) => b[i] === VERSJON && i > 0)
    expect(MAGIC).toBe(0x4e353041)
    const ødelagt = Uint8Array.from(b)
    ødelagt[versjonsOffset] = 99
    expect(() => lesFlis(ødelagt)).toThrow(/versjon/)
  })
})

describe('n50ArealPakke — geometri', () => {
  it('bbox dekker alle ringer', () => {
    const b = bboxForRinger([KVADRAT, HULL])
    expect(b).toEqual({ south: 59.80, west: 10.10, north: 59.81, east: 10.12 })
    expect(bboxForRinger([])).toBeNull()
  })

  it('areal er positivt uansett ring-retning', () => {
    const a = arealM2(KVADRAT)
    const motsatt = arealM2([...KVADRAT].reverse())
    expect(a).toBeGreaterThan(0)
    expect(motsatt).toBeCloseTo(a, 0)
    expect(arealM2(ring([[59, 10], [59.1, 10]]))).toBe(0)
  })

  it('forenkling beholder ringer som fortsatt er flater, og dropper resten', () => {
    // En nesten rett «ring» kollapser til under tre punkter og er da ikke en
    // flate lenger — den skal ut, ikke bli en usynlig strek.
    const nestenRett = ring([[59.8, 10.1], [59.8, 10.11], [59.8, 10.12], [59.8, 10.13]])
    expect(forenkleRinger([nestenRett], 50)).toHaveLength(0)
    const beholdt = forenkleRinger([KVADRAT, HULL], 1)
    expect(beholdt).toHaveLength(2)
    for (const r of beholdt) expect(r.length).toBeGreaterThanOrEqual(3)
  })
})

describe('n50ArealPakke — flisrutenettet er DELT med stiene', () => {
  it('bruker nøyaktig samme rutenett som n50StiPakke', () => {
    // To rutenett som driver fra hverandre ville gitt myr og sti i utakt over
    // flisgrensene. Derfor importeres det, ikke kopieres.
    expect(flisNokkel(59.83, 10.15)).toBe(stiFlisNokkel(59.83, 10.15))
    expect(STI_FLIS_LAT).toBe(0.5)
  })

  it('en flate havner i hver flis bboxen berører', () => {
    const overGrense = ring([[59.49, 10.1], [59.51, 10.1], [59.51, 10.12], [59.49, 10.12]])
    expect(fliserForFlate([overGrense]).sort()).toEqual(['59.0_10.0', '59.5_10.0'])
    expect(fliserForFlate([KVADRAT])).toEqual(['59.5_10.0'])
    expect(fliserForFlate([])).toEqual([])
  })
})

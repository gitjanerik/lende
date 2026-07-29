import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parkCoversBbox, parksForBbox } from './nasjonalparkData.js'

const data = JSON.parse(readFileSync(new URL('../../public/data/nasjonalparker.json', import.meta.url)))
const parker = data.parker
const byName = n => parker.find(p => p.navn === n)

// Kart-bbox rundt et punkt (grader, grovt — testene trenger ikke UTM-presisjon).
const around = (lat, lon, km = 1) => ({
  south: lat - km / 111, north: lat + km / 111,
  west: lon - km / (111 * Math.cos(lat * Math.PI / 180)),
  east: lon + km / (111 * Math.cos(lat * Math.PI / 180)),
})

describe('nasjonalpark-datasettet', () => {
  it('inneholder de norske parkene med Naturbase-metadata', () => {
    expect(parker.length).toBeGreaterThanOrEqual(40)
    const rondane = byName('Rondane nasjonalpark')
    expect(rondane).toBeTruthy()
    expect(rondane.faktaarkUrl).toMatch(/^https:\/\/faktaark\.naturbase\.no\/\?id=VV\d+$/)
    expect(rondane.forvaltning).toBeTruthy()
    expect(rondane.rings.length).toBeGreaterThan(0)
  })

  it('alle parker har navn, ringer og bbox', () => {
    for (const p of parker) {
      expect(p.navn).toBeTruthy()
      expect(p.bbox).toHaveLength(4)
      expect(p.rings.length).toBeGreaterThan(0)
      for (const r of p.rings) expect(r.length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('parkCoversBbox — «hele eller deler av»', () => {
  it('kart MIDT INNE i Rondane (Rondvassbu) treffer — ingen grense i boksen', () => {
    expect(parkCoversBbox(byName('Rondane nasjonalpark'), around(61.8867, 9.7794, 1))).toBe(true)
  })

  it('kart som krysser parkgrensa treffer', () => {
    // Stort utsnitt over Rondane-grensa i nord.
    expect(parkCoversBbox(byName('Rondane nasjonalpark'), around(61.9430, 9.8300, 6))).toBe(true)
  })

  it('kart langt unna treffer ikke (Lier)', () => {
    expect(parkCoversBbox(byName('Rondane nasjonalpark'), around(59.7935, 10.27, 1))).toBe(false)
  })

  it('bbox-forsjekken avviser uten å traversere ringene', () => {
    expect(parkCoversBbox(byName('Jotunheimen nasjonalpark'), around(59.91, 10.75, 2))).toBe(false)
  })

  it('tåler manglende park/bbox', () => {
    expect(parkCoversBbox(null, around(61.88, 9.77))).toBe(false)
    expect(parkCoversBbox(byName('Rondane nasjonalpark'), null)).toBe(false)
    expect(parkCoversBbox({ rings: [] }, around(61.88, 9.77))).toBe(false)
  })
})

describe('parksForBbox', () => {
  it('gir Rondane for et kart inne i parken, uten ringer i svaret', () => {
    const hits = parksForBbox(parker, around(61.8867, 9.7794, 1))
    expect(hits.map(p => p.navn)).toContain('Rondane nasjonalpark')
    expect(hits[0].rings).toBeUndefined()
    expect(hits[0].bbox).toBeUndefined()
    expect(hits[0].faktaarkUrl).toMatch(/faktaark\.naturbase\.no/)
  })

  it('gir tom liste for Oslo sentrum', () => {
    expect(parksForBbox(parker, around(59.9139, 10.7522, 2))).toEqual([])
  })

  it('tåler tomt datasett', () => {
    expect(parksForBbox([], around(61.88, 9.77))).toEqual([])
    expect(parksForBbox(null, around(61.88, 9.77))).toEqual([])
  })
})

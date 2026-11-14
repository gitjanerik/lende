import { describe, it, expect } from 'vitest'
import { osmInnenFrist, OSM_VENT_MS } from './n50Ark.js'

const utsatt = () => {
  let resolve, reject
  const p = new Promise((res, rej) => { resolve = res; reject = rej })
  return { p, resolve, reject }
}
const tikk = () => new Promise(r => setTimeout(r, 0))

describe('osmInnenFrist', () => {
  it('ja når OSM kommer før resten er inne', async () => {
    const osm = utsatt(), kritisk = utsatt()
    const svar = osmInnenFrist(osm.p, kritisk.p, 10_000)
    osm.resolve({ elements: [] })
    expect(await svar).toBe(true)
  })

  it('ja når OSM kommer innenfor fristen etter resten', async () => {
    const osm = utsatt(), kritisk = utsatt(), frist = utsatt()
    const svar = osmInnenFrist(osm.p, kritisk.p, 4000, () => frist.p)
    kritisk.resolve()
    await tikk()
    osm.resolve({ elements: [] })
    expect(await svar).toBe(true)
  })

  it('nei når fristen går ut først', async () => {
    const osm = utsatt(), kritisk = utsatt()
    let ventetMs = null
    const svar = osmInnenFrist(osm.p, kritisk.p, 4000, (ms) => { ventetMs = ms; return Promise.resolve() })
    kritisk.resolve()
    expect(await svar).toBe(false)
    expect(ventetMs).toBe(4000)
  })

  it('fristen starter ikke før resten er inne', async () => {
    const osm = utsatt(), kritisk = utsatt()
    let startet = false
    osmInnenFrist(osm.p, kritisk.p, 4000, () => { startet = true; return new Promise(() => {}) })
    await tikk()
    expect(startet).toBe(false)
    kritisk.resolve()
    await tikk()
    expect(startet).toBe(true)
  })

  it('nei med en gang når Overpass feiler', async () => {
    const osm = utsatt(), kritisk = utsatt()
    const svar = osmInnenFrist(osm.p, kritisk.p, 4000, () => new Promise(() => {}))
    osm.reject(new Error('429'))
    expect(await svar).toBe(false)
  })

  it('fristen er kort', () => {
    expect(OSM_VENT_MS).toBeLessThanOrEqual(5000)
  })
})

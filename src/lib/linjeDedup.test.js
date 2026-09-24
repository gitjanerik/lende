import { describe, it, expect } from 'vitest'
import {
  fjernGrovOsm, travelLineGeometries, dedupeRoutesAgainstLines, GROV_SPENN_M,
} from './linjeDedup.js'

// Geometrien etterligner Sandtjern i Finnemarka (Modum): en OSM-sti med ni
// punkter over ~1,9 km, og en DNT-rute som slynger seg rundt den med ±28 m (målt: 19 m i snitt).
const LAT0 = 59.945, LON0 = 10.06
const M_LAT = 1 / 111320
const M_LON = 1 / (111320 * Math.cos(LAT0 * Math.PI / 180))
const pkt = (nordM, ostM) => ({ lat: LAT0 + nordM * M_LAT, lon: LON0 + ostM * M_LON })

const grovSti = (id = 781269559) => ({
  type: 'way', id, tags: { highway: 'path', fixme: 'resurvey;N50' },
  geometry: [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920].map(n => pkt(n, 0)),
})
const buktetRute = (id = 'fotrute.98860') => ({
  id, merket: true,
  geometry: Array.from({ length: 193 }, (_, i) => pkt(i * 10, 28 * Math.sin(i / 6))),
})

describe('fjernGrovOsm', () => {
  it('fjerner en grov OSM-sti som en detaljert rute følger', () => {
    const { elementer, fjernet } = fjernGrovOsm([grovSti()], [buktetRute()])
    expect(fjernet).toEqual([781269559])
    expect(elementer).toHaveLength(0)
  })

  it('lar den detaljerte ruta overleve uttynningen i sin helhet', () => {
    const rute = buktetRute()
    // Uten regelen: ruta tynnes mot den rette streken og nesten ingenting står igjen.
    const før = dedupeRoutesAgainstLines([rute], travelLineGeometries([grovSti()]))
    const førLengde = før.reduce((s, r) => s + r.geometry.length, 0)
    expect(førLengde).toBeLessThan(rute.geometry.length / 2)
    const { elementer } = fjernGrovOsm([grovSti()], [rute])
    const etter = dedupeRoutesAgainstLines([rute], travelLineGeometries(elementer))
    expect(etter).toHaveLength(1)
  })

  it('beholder en OSM-sti som er detaljert nok', () => {
    const fin = { ...grovSti(), geometry: Array.from({ length: 40 }, (_, i) => pkt(i * 50, 0)) }
    expect(fjernGrovOsm([fin], [buktetRute()]).fjernet).toEqual([])
  })

  it('beholder en grov sti som bare delvis dekkes', () => {
    const lang = { ...grovSti(), geometry: [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920, 2400, 2880, 3360, 3840].map(n => pkt(n, 0)) }
    expect(fjernGrovOsm([lang], [buktetRute()]).fjernet).toEqual([])
  })

  it('beholder en grov sti når ruta selv er grov', () => {
    const grovRute = { id: 'r', geometry: [pkt(0, 20), pkt(960, 20), pkt(1920, 20)] }
    expect(fjernGrovOsm([grovSti()], [grovRute]).fjernet).toEqual([])
  })

  it('rører ikke veger, selv om de er grove og dekkes', () => {
    const veg = { ...grovSti(), tags: { highway: 'track' } }
    expect(fjernGrovOsm([veg], [buktetRute()]).fjernet).toEqual([])
  })

  it('rører ikke en sti som ligger langt fra ruta', () => {
    const fjern = { ...grovSti(), geometry: grovSti().geometry.map(p => ({ ...p, lon: p.lon + 500 * M_LON })) }
    expect(fjernGrovOsm([fjern], [buktetRute()]).fjernet).toEqual([])
  })

  it('gir elementlista uendret uten ruter', () => {
    const els = [grovSti()]
    expect(fjernGrovOsm(els, []).elementer).toBe(els)
    expect(GROV_SPENN_M).toBeLessThan(240)
  })
})

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

  it('kapper en delvis dekket sti og beholder resten', () => {
    const lang = { ...grovSti(), geometry: [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920, 2400, 2880, 3360, 3840].map(n => pkt(n, 0)) }
    const { elementer, fjernet } = fjernGrovOsm([lang], [buktetRute()])
    expect(fjernet).toEqual([781269559])
    expect(elementer).toHaveLength(1)
    expect(elementer[0].id).toBe('781269559:0')
    expect(elementer[0].tags).toEqual(lang.tags)
    expect(elementer[0].geometry).toEqual(lang.geometry.slice(8))
  })

  it('kapper midt i stien når to ruter dekker hver sin ende', () => {
    // Ved Sandtjern dekker N50 den nordre halvdelen og Turrutebasen den søndre.
    const nord = { id: 'n50', geometry: buktetRute().geometry.filter((_, i) => i <= 96) }
    const sor = { id: 'tur', geometry: buktetRute().geometry.filter((_, i) => i >= 96) }
    expect(fjernGrovOsm([grovSti()], [nord]).elementer[0].geometry).toEqual(grovSti().geometry.slice(4))
    expect(fjernGrovOsm([grovSti()], [nord, sor]).elementer).toHaveLength(0)
  })

  it('lar de korte spennene i en rute telle selv om den har ett langt', () => {
    const g = buktetRute().geometry
    const medHull = { id: 'n50', geometry: [pkt(-400, 0), ...g] }
    expect(fjernGrovOsm([grovSti()], [medHull]).fjernet).toEqual([781269559])
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

  // Ved Sandtjern ligger OSM-segmentene 5–7 110–215 m vest for DNT-ruta, mellom
  // to dekkede biter av samme sti.
  const forskjovet = (ostM, nord = [960, 1200, 1440]) => ({
    ...grovSti(),
    geometry: [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920].map(n => pkt(n, nord.includes(n) ? ostM : 0)),
  })

  it('fjerner et grovt mellomstrekk som er dekket i begge ender', () => {
    const { elementer, fjernet } = fjernGrovOsm([forskjovet(-150)], [buktetRute()])
    expect(fjernet).toEqual([781269559])
    expect(elementer).toHaveLength(0)
  })

  it('beholder mellomstrekket når det ligger for langt fra ruta', () => {
    const { elementer } = fjernGrovOsm([forskjovet(-400)], [buktetRute()])
    expect(elementer.map(e => e.id)).toEqual(['781269559:0'])
  })

  it('beholder et forskjøvet strekk i enden av stien', () => {
    const { elementer } = fjernGrovOsm([forskjovet(-150, [1680, 1920])], [buktetRute()])
    expect(elementer).toHaveLength(1)
    expect(elementer[0].geometry.at(-1)).toEqual(pkt(1920, -150))
  })

  it('beholder et mellomstrekk som er tegnet detaljert', () => {
    const g = [...[0, 240, 480, 720].map(n => pkt(n, 0)),
      ...Array.from({ length: 15 }, (_, i) => pkt(770 + i * 50, -150)),
      ...[1680, 1920].map(n => pkt(n, 0))]
    const { elementer } = fjernGrovOsm([{ ...grovSti(), geometry: g }], [buktetRute()])
    expect(elementer).toHaveLength(1)
  })

  it('gir elementlista uendret uten ruter', () => {
    const els = [grovSti()]
    expect(fjernGrovOsm(els, []).elementer).toBe(els)
    expect(GROV_SPENN_M).toBeLessThan(240)
  })
})

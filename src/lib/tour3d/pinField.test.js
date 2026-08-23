import { describe, it, expect } from 'vitest'
import { Color, Vector3 } from 'three'
import { makeCoords } from './coords.js'
import {
  buildPinField, pinScaleAt, pinScaleForCamera, drapedWorld,
  PIN_STEM_H, PIN_HEAD_R, PARK_Y,
} from './pinField.js'

const makeDem = (cols, rows, fill = 100, res = 10) => ({
  data: new Float32Array(cols * rows).fill(fill),
  cols, rows,
  transform: { originX: 0, originY: 0, pixelWidth: res, pixelHeight: res },
  noData: -9999,
})

const coords = makeCoords({ widthM: 100, heightM: 100, exaggeration: 1 })
const fakeCamera = (x, y, z) => ({ position: new Vector3(x, y, z) })

describe('pinScaleAt', () => {
  it('holder naturlig størrelse nær kamera', () => {
    expect(pinScaleAt(0)).toBe(1)
    expect(pinScaleAt(600)).toBe(1)
  })

  it('vokser med avstanden så nåla synes i horisonten', () => {
    expect(pinScaleAt(2400)).toBeCloseTo(2)
    expect(pinScaleAt(6000)).toBeCloseTo(5)
  })

  it('taket er 5× — nåler blir aldri absurd store', () => {
    expect(pinScaleAt(100000)).toBe(5)
  })
})

describe('pinScaleForCamera', () => {
  // Bakkepunkt i origo; hodet står PIN_STEM_H + 0,6·PIN_HEAD_R over det.
  const hodeHoyde = (s) => (PIN_STEM_H + PIN_HEAD_R * 0.6) * s
  // Hvor stor del av synsfeltet hodet dekker: radius delt på avstanden TIL HODET.
  const hodeAndel = (camY, camZ) => {
    const s = pinScaleForCamera({ x: 0, y: camY, z: camZ }, 0, 0, 0)
    const dHode = Math.hypot(camZ, camY - hodeHoyde(s))
    return (PIN_HEAD_R * s) / dHode
  }

  it('rører ikke nåler på normal avstand', () => {
    for (const d of [200, 600, 1200, 2400, 6000, 20000]) {
      expect(pinScaleForCamera({ x: 0, y: 0, z: d }, 0, 0, 0)).toBeCloseTo(pinScaleAt(d))
    }
  })

  it('lar aldri ETT hode svelge bildet — uansett hvor kameraet står', () => {
    // Dette er regresjonen fra v5.22.8: skalaen ble regnet fra FOTEN, så et
    // kamera i nålehøyde («foten er 60 m unna, hold full størrelse») kunne ha
    // hodet én meter fra linsa. Ett hode fylte da 100 % av bildet i sin egen
    // flate farge, og forsvant helt idet kameraet krysset kuleflata — flimrende
    // heldekkende bånd i nålefargen.
    for (let camY = 0; camY <= 400; camY += 7) {
      for (let camZ = 0; camZ <= 400; camZ += 7) {
        if (camY === 0 && camZ === 0) continue
        expect(hodeAndel(camY, camZ)).toBeLessThanOrEqual(0.1201)
      }
    }
  })

  it('krymper nåla unna når kameraet står der hodet ville stått', () => {
    // Ikke skala 0: hodet trekkes NED langs stammen til det klarer kameraet.
    const s = pinScaleForCamera({ x: 0, y: hodeHoyde(1), z: 0 }, 0, 0, 0)
    expect(s).toBeLessThan(0.5)
    expect(hodeAndel(hodeHoyde(1), 0)).toBeCloseTo(0.12, 3)
  })

  it('gir skala 0 bare når kameraet står oppå bakkepunktet', () => {
    expect(pinScaleForCamera({ x: 0, y: 0, z: 0 }, 0, 0, 0)).toBe(0)
  })

  it('gir 0 — aldri NaN — for en posisjon som ikke er et tall', () => {
    for (const b of [[NaN, 0, 0], [0, Infinity, 0], [0, 0, -Infinity]]) {
      expect(pinScaleForCamera({ x: 0, y: 100, z: 500 }, ...b)).toBe(0)
    }
  })

  it('krymper jevnt inn mot nåla, uten sprang', () => {
    let forrige = 0
    for (const dz of [10, 20, 40, 60, 75, 90, 150]) {
      const s = pinScaleForCamera({ x: 0, y: hodeHoyde(1), z: dz }, 0, 0, 0)
      expect(s).toBeGreaterThanOrEqual(forrige)   // monoton oppover med avstanden
      expect(s).toBeLessThanOrEqual(1)
      forrige = s
    }
    // Fra ~75 m og ut er taket ute av bildet igjen.
    expect(pinScaleForCamera({ x: 0, y: hodeHoyde(1), z: 150 }, 0, 0, 0)).toBe(1)
  })
})

describe('drapedWorld', () => {
  it('legger punktet på terrenghøyden', () => {
    const dem = makeDem(11, 11, 250)
    const [, wy] = drapedWorld(dem, coords, 50, 50)
    expect(wy).toBeCloseTo(250)
  })

  it('løfter med liftM når det er oppgitt', () => {
    const dem = makeDem(11, 11, 250)
    const [, wy] = drapedWorld(dem, coords, 50, 50, 40)
    expect(wy).toBeCloseTo(290)
  })
})

describe('buildPinField', () => {
  const dem = makeDem(11, 11, 100)

  it('lager én instans per nål i begge meshene', () => {
    const field = buildPinField([
      { x: 10, y: 10, color: '#8e44ad' },
      { x: 90, y: 90, color: '#7f8c8d' },
    ], dem, coords)
    expect(field.count).toBe(2)
    expect(field.stems.count).toBe(2)
    expect(field.heads.count).toBe(2)
    field.dispose()
  })

  it('gir hver nål sin egen hodefarge', () => {
    const field = buildPinField([
      { x: 10, y: 10, color: '#8e44ad' },
      { x: 90, y: 90, color: '#7f8c8d' },
    ], dem, coords)
    const c0 = new Color()
    const c1 = new Color()
    field.heads.getColorAt(0, c0)
    field.heads.getColorAt(1, c1)
    expect(c0.getHexString()).toBe('8e44ad')
    expect(c1.getHexString()).toBe('7f8c8d')
    expect(c0.getHexString()).not.toBe(c1.getHexString())
    field.dispose()
  })

  it('planter nåla med foten i terrenget', () => {
    const field = buildPinField([{ x: 50, y: 50, color: '#fff' }], dem, coords)
    const [, wy] = field.basePosition(0)
    expect(wy).toBeCloseTo(100)
    field.dispose()
  })

  it('skalerer opp nåler langt fra kameraet', () => {
    const field = buildPinField([{ x: 50, y: 50, color: '#fff' }], dem, coords)
    // 600 m: naturlig størrelse, og godt utenfor vinkel-taket på hodet.
    const nær = fakeCamera(0, 100, 600)
    const fjern = fakeCamera(0, 100, 6000)

    field.update(nær)
    const a = field.stems.instanceMatrix.array.slice()
    field.update(fjern)
    const b = field.stems.instanceMatrix.array.slice()

    // Matrisens y-translasjon er halve stammehøyden × skala over bakkepunktet.
    const [, baseY] = field.basePosition(0)
    expect(a[13] - baseY).toBeCloseTo(PIN_STEM_H / 2)
    expect(b[13] - baseY).toBeCloseTo((PIN_STEM_H / 2) * 5)
    field.dispose()
  })

  it('parkerer bortfiltrerte nåler utenfor far-planet, ikke på skala 0', () => {
    const field = buildPinField([
      { x: 10, y: 10, color: '#fff' },
      { x: 90, y: 90, color: '#fff' },
    ], dem, coords)
    field.setVisibleSet(new Set([1]))
    expect(field.isVisible(0)).toBe(false)
    expect(field.isVisible(1)).toBe(true)

    field.update(fakeCamera(0, 100, 600))
    const m = field.stems.instanceMatrix.array
    // En singulær matrise (skala 0) er nettopp det vi IKKE vil ha: en mobil-GPU
    // tegnet vilkårlige kiler av de sammenfalte verteksene (v5.22.9). Den
    // parkerte nåla skal være en helt vanlig kule, langt under bakken.
    expect(m[0]).toBe(1)
    expect(m[13]).toBe(PARK_Y)
    expect(m[16]).toBeGreaterThan(0)
    expect(m[29]).toBeGreaterThan(0)   // synlig nål står på bakken, ikke i PARK_Y
    // Indeksen for nål 1 er fortsatt 1 — raycast-oppslaget må ikke forskyves.
    expect(field.count).toBe(2)
    field.dispose()
  })

  it('etterlater ingen singulær matrise i bufferet — uansett tilstand', () => {
    // Regresjonen: hver frame skrev ~150 av 272 instanser som skala 0, og hver
    // av dem er 260 vertekser i samme punkt. Determinanten skal aldri være 0.
    const field = buildPinField([
      { x: 10, y: 10, color: '#fff' },
      { x: NaN, y: 10, color: '#f00' },
      { x: 50, y: 50, color: '#0f0' },
      { x: 90, y: 90, color: '#00f' },
    ], dem, coords)
    field.setVisibleSet(new Set([2]))
    for (const kam of [fakeCamera(0, 100, 600), fakeCamera(0, 100, 0), fakeCamera(0, 160, 0)]) {
      field.update(kam)
      for (const mesh of [field.stems, field.heads]) {
        const m = mesh.instanceMatrix.array
        for (let i = 0; i < field.count; i++) {
          expect(m[i * 16]).toBeGreaterThan(0)      // skala x
          expect(m[i * 16 + 5]).toBeGreaterThan(0)  // skala y
          expect(m[i * 16 + 10]).toBeGreaterThan(0) // skala z
        }
        expect([...m].every(Number.isFinite)).toBe(true)
      }
    }
    field.dispose()
  })

  it('parkerer nåler uten troverdig posisjon, med indeksene i fred', () => {
    // NaN og absurde koordinater kommer fra ekte kilder: nettbaserte POI-lag som
    // projiseres, og DEM-fyllverdier som ikke er lik noData. Én slik nål ga
    // flimrende kiler over hele bildet på mobil-GPU (v5.22.9).
    const field = buildPinField([
      { x: 10, y: 10, color: '#fff' },
      { x: NaN, y: 10, color: '#f00' },
      { x: 10, y: NaN, color: '#0f0' },
      { x: 1e9, y: 10, color: '#00f' },
      { x: 20, y: 20, color: '#fff' },
    ], dem, coords)

    expect([...field.invalidIndices].sort()).toEqual([1, 2, 3])
    expect(field.isUgyldig(0)).toBe(false)
    expect(field.isUgyldig(4)).toBe(false)

    field.update(fakeCamera(0, 100, 3000))
    const m = field.heads.instanceMatrix.array
    // Skala 0 = parkert. Og alle 16 tallene i matrisa må være endelige, ellers
    // er det nettopp NaN-en vi ville unngå som ligger i bufferet.
    for (const i of [1, 2, 3]) expect(m[i * 16 + 13]).toBe(PARK_Y)
    for (const i of [0, 4]) expect(m[i * 16 + 13]).toBeGreaterThan(0)
    expect([...m].every(Number.isFinite)).toBe(true)
    field.dispose()
  })

  it('parkerer nåla når DEM-en gir en høyde som ikke finnes', () => {
    // GeoTIFF-fyll på 3,4e38 med et ANNET noData-tall slipper gjennom
    // sampleElevation, og blir Infinity i det den lagres i en Float32Array.
    const raw = makeDem(11, 11, 3.4e38)
    const field = buildPinField([{ x: 50, y: 50, color: '#fff' }], raw, coords)
    expect(field.isUgyldig(0)).toBe(true)
    field.update(fakeCamera(0, 100, 3000))
    const m = field.heads.instanceMatrix.array
    expect([...m].every(Number.isFinite)).toBe(true)
    expect(m[13]).toBe(PARK_Y)
    field.dispose()
  })

  it('tåler et tomt felt', () => {
    const field = buildPinField([], dem, coords)
    expect(field.count).toBe(0)
    expect(() => field.update(fakeCamera(0, 0, 0))).not.toThrow()
    field.dispose()
  })
})

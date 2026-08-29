import { describe, it, expect } from 'vitest'
import { Color, Vector3 } from 'three'
import { makeCoords } from './coords.js'
import {
  buildPinField, pinScaleAt, pinScaleForCamera, drapedWorld,
  PIN_STEM_H, PIN_HEAD_R,
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

  it('tegner BARE de synlige nålene — resten submitteres ikke', () => {
    const field = buildPinField([
      { x: 10, y: 10, color: '#fff' },
      { x: 90, y: 90, color: '#fff' },
    ], dem, coords)
    field.setVisibleSet(new Set([1]))
    expect(field.isVisible(0)).toBe(false)
    expect(field.isVisible(1)).toBe(true)

    field.update(fakeCamera(0, 100, 600))
    // Kjernen i v5.22.11: en instans som ikke submitteres kan ingen driver tegne
    // feil. Før dette lå de skjulte i bufferet — først som singulære nullflater,
    // så som kuler 200 km unna — og en mobil-GPU tegnet dem som heldekkende
    // flater i nålefargen.
    expect(field.stems.count).toBe(1)
    expect(field.heads.count).toBe(1)
    // Nåle-indeksene utad er urørt: 2 nåler, og nål 1 kjenner sitt bakkepunkt.
    expect(field.count).toBe(2)
    expect(field.basePosition(1)[0]).toBeCloseTo(40)
    field.dispose()
  })

  it('sloten bærer fargen til nåla som faktisk står der', () => {
    // instanceColor følger SLOTEN, ikke nåla. Bytter declutteren sammensetning,
    // må fargene skrives om — ellers får en nål naboens farge.
    const field = buildPinField([
      { x: 10, y: 10, color: '#ff0000' },
      { x: 50, y: 50, color: '#00ff00' },
      { x: 90, y: 90, color: '#0000ff' },
    ], dem, coords)
    const slot0 = () => [...field.heads.instanceColor.array.slice(0, 3)]

    field.setVisibleSet(new Set([1]))
    field.update(fakeCamera(0, 100, 600))
    const grønn = slot0()

    field.setVisibleSet(new Set([2]))
    field.update(fakeCamera(0, 100, 600))
    const blå = slot0()

    expect(field.heads.count).toBe(1)
    expect(grønn[1]).toBeGreaterThan(0.9)   // grønn kanal
    expect(blå[2]).toBeGreaterThan(0.9)     // blå kanal
    expect(grønn).not.toEqual(blå)
    field.dispose()
  })

  it('etterlater ingen singulær matrise i det som tegnes', () => {
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
        for (let i = 0; i < mesh.count; i++) {
          expect(m[i * 16]).toBeGreaterThan(0)      // skala x
          expect(m[i * 16 + 5]).toBeGreaterThan(0)  // skala y
          expect(m[i * 16 + 10]).toBeGreaterThan(0) // skala z
        }
        for (let j = 0; j < mesh.count * 16; j++) expect(Number.isFinite(m[j])).toBe(true)
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
    // De to gyldige nålene tegnes, de tre ugyldige submitteres ikke i det hele
    // tatt — og ingenting av det som tegnes er NaN.
    expect(field.heads.count).toBe(2)
    const m = field.heads.instanceMatrix.array
    for (let j = 0; j < field.heads.count * 16; j++) expect(Number.isFinite(m[j])).toBe(true)
    field.dispose()
  })

  it('parkerer nåla når DEM-en gir en høyde som ikke finnes', () => {
    // GeoTIFF-fyll på 3,4e38 med et ANNET noData-tall slipper gjennom
    // sampleElevation, og blir Infinity i det den lagres i en Float32Array.
    const raw = makeDem(11, 11, 3.4e38)
    const field = buildPinField([{ x: 50, y: 50, color: '#fff' }], raw, coords)
    expect(field.isUgyldig(0)).toBe(true)
    field.update(fakeCamera(0, 100, 3000))
    expect(field.heads.count).toBe(0)
    field.dispose()
  })

  it('tåler et tomt felt', () => {
    const field = buildPinField([], dem, coords)
    expect(field.count).toBe(0)
    expect(() => field.update(fakeCamera(0, 0, 0))).not.toThrow()
    field.dispose()
  })
})

describe('naermesteISkjerm — trefflaten for en nål', () => {
  const dem = makeDem(11, 11, 100)
  // En «project» som legger nålene på kjente skjermpunkter: vi trenger ikke et
  // ekte kamera for å teste regelen, bare avstandene den regner ut.
  const lagField = () => buildPinField([
    { x: 10, y: 10, color: '#8e44ad' },
    { x: 90, y: 90, color: '#1d4ed8' },
  ], dem, coords)

  it('finner nåla når fingeren er innenfor terskelen, og ingen når den ikke er', () => {
    const field = lagField()
    const skjerm = [{ x: 100, y: 100 }, { x: 300, y: 300 }]
    let kall = 0
    const project = () => skjerm[kall++ % 2]
    expect(field.naermesteISkjerm(() => ({ x: 100, y: 100 }), 100, 100, 34)).toBe(0)
    kall = 0
    expect(field.naermesteISkjerm(project, 120, 100, 34)).toBe(0)
    kall = 0
    // 60 px unna begge: for langt.
    expect(field.naermesteISkjerm(project, 160, 100, 34)).toBe(null)
    field.dispose()
  })

  it('velger den NÆRMESTE når to er innenfor', () => {
    const field = lagField()
    const skjerm = [{ x: 100, y: 100 }, { x: 120, y: 100 }]
    let kall = 0
    const project = () => skjerm[kall++ % 2]
    expect(field.naermesteISkjerm(project, 118, 100, 34)).toBe(1)
    kall = 0
    expect(field.naermesteISkjerm(project, 102, 100, 34)).toBe(0)
    field.dispose()
  })

  it('hopper over nåler bak kameraet', () => {
    const field = lagField()
    let kall = 0
    const project = () => (kall++ === 0
      ? { x: 100, y: 100, behind: true }
      : { x: 300, y: 300 })
    // Nål 0 ligger rett under fingeren, men BAK kameraet: en projeksjon bak
    // linsa er et speilbilde, og et trykk der ville valgt noe man ikke ser.
    expect(field.naermesteISkjerm(project, 100, 100, 34)).toBe(null)
    field.dispose()
  })

  it('ser bare nåler som FAKTISK tegnes', () => {
    const field = lagField()
    field.setVisibleSet(new Set([1]))
    field.update({ position: new Vector3(0, 500, 0) })
    const project = () => ({ x: 100, y: 100 })
    // Alt havner på fingeren; bare den synlige kan velges.
    expect(field.naermesteISkjerm(project, 100, 100, 34)).toBe(1)
    field.dispose()
  })
})

// Filformatet for offline-deling. Kontrakten som låses her: en fil skrevet av
// én Lende skal kunne leses av en annen, DEM-et bit-eksakt, og en fil fra en
// framtidig versjon skal avvises høylytt i stedet for å miste felter stille.
import { describe, it, expect } from 'vitest'
import {
  lagKartPakke, lesKartPakke, demTilJson, demFraJson, pakkeFilnavn, sikreDataMeta,
  PAKKE_FORMAT, PAKKE_FORMAT_VERSION, PAKKE_FILENDELSE,
} from './kartPakke.js'

function lagDem(verdier) {
  const arr = new Float32Array(verdier)
  return { buffer: arr.buffer, cols: 2, rows: verdier.length / 2, transform: { pixelWidth: 10, pixelHeight: -10 }, noData: -9999 }
}

const kart = () => ({
  id: 'kart_abc',
  navn: 'Vardåsen',
  svg: `<svg data-meta='{"widthM":1000}'>${'<path d="M0 0"/>'.repeat(200)}</svg>`,
  bbox: { south: 59, north: 59.1, west: 10, east: 10.1 },
  dem: lagDem([120.5, 131.25, -9999, 98]),
  appVersion: '5.20.0',
})

describe('DEM ↔ JSON', () => {
  it('overlever base64-turen bit-eksakt', () => {
    const dem = lagDem([1.5, -2.25, 1e6, 0])
    const tilbake = demFraJson(demTilJson(dem))
    expect([...new Float32Array(tilbake.buffer)]).toEqual([1.5, -2.25, 1e6, 0])
    expect(tilbake.cols).toBe(dem.cols)
    expect(tilbake.transform).toEqual(dem.transform)
    expect(tilbake.noData).toBe(-9999)
  })

  it('takler et DEM som er større enn base64-chunken (0x8000 bytes)', () => {
    const n = 40_000                       // 160 kB — flere chunks
    const arr = new Float32Array(n)
    for (let i = 0; i < n; i++) arr[i] = i * 0.5
    const tilbake = demFraJson(demTilJson({ buffer: arr.buffer, cols: 200, rows: 200 }))
    const ut = new Float32Array(tilbake.buffer)
    expect(ut.length).toBe(n)
    expect(ut[0]).toBe(0)
    expect(ut[n - 1]).toBe((n - 1) * 0.5)
  })

  it('gir null for et kart uten DEM', () => {
    expect(demTilJson(null)).toBeNull()
    expect(demFraJson(null)).toBeNull()
  })
})

describe('lagKartPakke → lesKartPakke', () => {
  it('gir kartet tilbake med SVG og DEM i behold', async () => {
    const inn = kart()
    const pakke = await lesKartPakke(await lagKartPakke({ kart: inn, appVersion: '5.20.0' }))
    expect(pakke.kart.svg).toBe(inn.svg)
    expect(pakke.kart.navn).toBe('Vardåsen')
    expect(pakke.kart.bbox).toEqual(inn.bbox)
    expect([...new Float32Array(pakke.kart.dem.buffer)]).toEqual([120.5, 131.25, -9999, 98])
    expect(pakke.appVersion).toBe('5.20.0')
    expect(pakke.eksportert).toBeGreaterThan(0)
  })

  it('komprimerer — en repetitiv SVG blir langt mindre enn råteksten', async () => {
    const inn = kart()
    const blob = await lagKartPakke({ kart: inn })
    expect(blob.size).toBeLessThan(inn.svg.length / 2)
  })

  it('tar med cache-radene datalagene trenger', async () => {
    const cache = [{ key: 'hydro:bbox:1,2,3,4', data: [{ stationId: '1.1.0' }], expires: 123 }]
    const pakke = await lesKartPakke(await lagKartPakke({ kart: kart(), cache }))
    expect(pakke.cache).toEqual(cache)
  })

  it('tar ALDRI med annoteringer eller GPS-spor', async () => {
    const inn = { ...kart(), annotations: [{ id: 'a1' }], tracks: [{ id: 't1' }], trackStyle: 'rød' }
    const pakke = await lesKartPakke(await lagKartPakke({ kart: inn }))
    expect(pakke.kart.annotations).toBeUndefined()
    expect(pakke.kart.tracks).toBeUndefined()
    expect(pakke.kart.trackStyle).toBeUndefined()
  })

  it('nekter å pakke et kart uten SVG', async () => {
    await expect(lagKartPakke({ kart: { navn: 'tom' } })).rejects.toThrow(/SVG/)
  })
})

describe('lesKartPakke — avvisninger', () => {
  const somBytes = (obj) => new TextEncoder().encode(JSON.stringify(obj))

  it('leser en ukomprimert pakke (fallback når CompressionStream mangler)', async () => {
    const pakke = await lesKartPakke(somBytes({
      format: PAKKE_FORMAT, formatVersion: 1, kart: { svg: '<svg/>', dem: null }, cache: [],
    }))
    expect(pakke.kart.svg).toBe('<svg/>')
  })

  it('avviser en fil fra en nyere Lende i stedet for å miste felter stille', async () => {
    const bytes = somBytes({
      format: PAKKE_FORMAT, formatVersion: PAKKE_FORMAT_VERSION + 1, kart: { svg: '<svg/>' },
    })
    await expect(lesKartPakke(bytes)).rejects.toThrow(/nyere versjon/)
  })

  it('avviser en fil som ikke er en Lende-kartfil', async () => {
    await expect(lesKartPakke(somBytes({ hello: 'world' }))).rejects.toThrow(/ikke en Lende-kartfil/)
  })

  it('avviser søppel', async () => {
    await expect(lesKartPakke(new TextEncoder().encode('ikke json'))).rejects.toThrow(/ødelagt/)
  })

  it('avviser en pakke uten selve kartet', async () => {
    const bytes = somBytes({ format: PAKKE_FORMAT, formatVersion: 1, kart: { navn: 'tom' } })
    await expect(lesKartPakke(bytes)).rejects.toThrow(/mangler selve kartet/)
  })
})

describe('pakkeFilnavn', () => {
  it('beholder æøå og bytter resten mot bindestrek', () => {
    expect(pakkeFilnavn('Vardåsen nord (2 km)')).toBe(`vardåsen-nord-2-km${PAKKE_FILENDELSE}`)
  })
  it('faller tilbake til turkart når navnet er tomt', () => {
    expect(pakkeFilnavn('')).toBe(`turkart${PAKKE_FILENDELSE}`)
    expect(pakkeFilnavn('///')).toBe(`turkart${PAKKE_FILENDELSE}`)
  })
})

// Innebygde kart (vardasen) finnes ikke i IndexedDB, så de pakkes fra
// skjermen — og skjerm-SVG-en er et nytt rot-element uten data-meta
// (useMapLoadPipeline.setupHostSvg). Uten dette kastet mottakerens laster
// «Mangler data-meta i SVG» og kartet åpnet seg aldri.
describe('sikreDataMeta', () => {
  const meta = {
    minE: 576882.8, minN: 6628954.9, maxE: 581799.9, maxN: 6634077.8,
    widthM: 4917.1, heightM: 5122.9, equidistance: 20,
    bbox: { south: 59.79, north: 59.83, west: 10.36, east: 10.45 },
    source: "Kartverket + OSM <ingen> 'x'",
  }

  it('legger på data-meta når markupen mangler det', () => {
    const ut = sikreDataMeta('<svg class="isom-map" viewBox="0 0 10 10"><g/></svg>', meta)
    const attr = ut.match(/data-meta='([^']*)'/)[1]
    const parsed = JSON.parse(attr.replace(/&apos;/g, "'"))
    expect(parsed.utmBbox).toEqual({ minE: meta.minE, minN: meta.minN, maxE: meta.maxE, maxN: meta.maxN })
    expect(parsed.bbox).toEqual(meta.bbox)
    expect(parsed.widthM).toBe(meta.widthM)
    expect(parsed.minE).toBeUndefined()
  })

  it('rører ikke markup som allerede har data-meta', () => {
    const inn = `<svg data-meta='{"widthM":1}'><g/></svg>`
    expect(sikreDataMeta(inn, meta)).toBe(inn)
  })

  it('escaper < > og apostrof så attributtet ikke bryter SVG-en', () => {
    const ut = sikreDataMeta('<svg viewBox="0 0 1 1"/>', meta)
    const attr = ut.match(/data-meta='([^']*)'/)[1]
    expect(attr).not.toContain('<')
    expect(attr).not.toContain('>')
    expect(attr).toContain('&apos;')
  })

  it('gir markupen uendret tilbake uten meta', () => {
    expect(sikreDataMeta('<svg/>', null)).toBe('<svg/>')
    expect(sikreDataMeta('', meta)).toBe('')
  })
})

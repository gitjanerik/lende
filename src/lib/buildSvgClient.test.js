// Bygge-økta (v7.7.14): terreng-først bygger SAMME ark to ganger, og økta skal
// gjenbruke det DEM-avledede resultatet i andre runde. Testene kjører den
// synkrone stien (ingen Worker i Node), som har nøyaktig samme kontrakt.
import { describe, it, expect } from 'vitest'
import { apneByggeOkt } from './buildSvgClient.js'
import { syntheticDEM } from './dem.js'

const bbox = { south: 59, north: 59.0054, west: 10, east: 10.0105 }
const lagDem = () => syntheticDEM(600, 600,
  { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
  [{ x: 300, y: 300, h: 400, sigma: 40 }], 0)
const opts = { contourIntervalM: 20, scaleDenom: 10000 }

// Konturene er det eneste laget som kan skille et gjenbrukt pass fra et nytt,
// så vi sammenligner selve path-dataen og ikke bare at det finnes et lag.
const konturD = (svg) => (svg.match(/<g data-layer="kontur"[\s\S]*?<\/g>/)?.[0] ?? '')

describe('apneByggeOkt — gjenbruk av DEM-avledet resultat', () => {
  it('gjenbrukDem gir samme konturer som et ferskt pass, uten å regne dem om', async () => {
    const dem = lagDem()
    const okt = apneByggeOkt()
    const forste = await okt.bygg([], bbox, opts, { dem })
    const andre = await okt.bygg([], bbox, opts, { gjenbrukDem: true })
    okt.avslutt()

    expect(typeof forste.timings.contours).toBe('number')  // regnet ut
    expect(andre.timings.contours).toBeUndefined()          // gjenbrukt
    expect(konturD(andre.svg)).toBe(konturD(forste.svg))
    expect(konturD(andre.svg).length).toBeGreaterThan(0)
  })

  it('et nytt DEM nullstiller gjenbruken', async () => {
    const okt = apneByggeOkt()
    await okt.bygg([], bbox, opts, { dem: lagDem() })
    const andre = await okt.bygg([], bbox, opts, { dem: lagDem() })
    okt.avslutt()
    expect(typeof andre.timings.contours).toBe('number')
  })

  // Ekvidistansen er bakt inn i konturene. Kalleren vår sender alltid samme
  // verdi, men en gjenbruk på tvers ville gitt et ark med feil kurver.
  it('en annen ekvidistanse gjenbrukes ikke', async () => {
    const dem = lagDem()
    const okt = apneByggeOkt()
    await okt.bygg([], bbox, opts, { dem })
    const andre = await okt.bygg([], bbox, { ...opts, contourIntervalM: 50 }, { gjenbrukDem: true })
    okt.avslutt()
    expect(typeof andre.timings.contours).toBe('number')
  })

  it('pakkDem gir lagrings-DEM og høyeste punkt', async () => {
    const dem = lagDem()
    const okt = apneByggeOkt()
    const res = await okt.bygg([], bbox, opts, { dem, pakkDem: true })
    okt.avslutt()
    expect(res.pakketDem?.buffer).toBeInstanceOf(ArrayBuffer)
    expect(res.hoyestePunkt?.elevation).toBeGreaterThan(300)
  })

  it('uten pakkDem returneres ingen DEM-pakke', async () => {
    const okt = apneByggeOkt()
    const res = await okt.bygg([], bbox, opts, { dem: lagDem() })
    okt.avslutt()
    expect(res.pakketDem).toBeUndefined()
  })

  it('avbrutt signal kaster i stedet for å bygge', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const okt = apneByggeOkt({ signal: ctrl.signal })
    await expect(okt.bygg([], bbox, opts, { dem: lagDem() })).rejects.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { finnStinettBrudd, formatBruddSvar } from './stinettBrudd.js'

const sti = (coordinates, isomCode = '505') => ({ coordinates, isomCode })

// Narverudgruvene i miniatyr: hovedsti øst–vest, og en sidesti som ender
// `hull` meter fra den, men bare henger sammen med den via en lang omvei i øst.
function bruddNett(hull) {
  return [
    sti([[0, 0], [2000, 0]]),
    sti([[1000, hull], [1000, 400]]),
    sti([[1000, 400], [2000, 400], [2000, 0]]),
  ]
}

// Uten hull-broing i grafen slipper vi å bruke et hull større enn toleransen
// for å demonstrere at diagnosen finner brudd.
const RAA_GRAF = { snapM: 2, componentBridgeM: 80 }

describe('finnStinettBrudd', () => {
  it('finner et hull som koster kilometervis omvei', () => {
    const res = finnStinettBrudd(bruddNett(25), { grafOpts: RAA_GRAF })
    expect(res.antallBrudd).toBe(1)
    const b = res.treff[0]
    expect(b.hullM).toBeCloseTo(25, 0)
    // Omveien måles til nærmeste ende av hovedstien: 375 m opp, 1000 m øst,
    // 400 m ned = 1775 m for å komme 25 m.
    expect(b.omveiM).toBeCloseTo(1775, -1)
    expect(b.forholdstall).toBe(71)
    // Stienden og fotpunktet på hovedstien.
    expect([b.x, b.y]).toEqual([1000, 25])
    expect([b.naboX, b.naboY]).toEqual([1000, 0])
  })

  it('melder ingen brudd når ruteren allerede kommer fram kort vei', () => {
    // U-sti: 20 m mellom endene, 300 m rundt bunnen. Ikke et brudd.
    const res = finnStinettBrudd([sti([[0, 0], [0, 100], [100, 100], [100, 0]])], {
      grafOpts: RAA_GRAF,
    })
    expect(res.antallBrudd).toBe(0)
    expect(res.treff).toEqual([])
  })

  it('melder ingen brudd når hull-broen i ruteren alt har tettet hullet', () => {
    // Samme nett, men med grafen ruteren faktisk kjører (default): hullet på
    // 25 m er innen gapBridgeM, så det er borte når diagnosen ser etter.
    const res = finnStinettBrudd(bruddNett(25))
    expect(res.antallBrudd).toBe(0)
  })

  it('rapporterer helt frakoblede stier som omveiM null, og sorterer dem øverst', () => {
    const res = finnStinettBrudd([
      sti([[0, 0], [2000, 0]]),          // hovedsti
      sti([[1600, 40], [1600, 200]]),    // frakoblet stump, 40 m unna
      ...bruddNett(45),                  // og et vanlig brudd med målbar omvei
    ], { grafOpts: { snapM: 2 } })        // ingen komponent-bro, ingen hull-bro
    expect(res.antallBrudd).toBeGreaterThanOrEqual(2)
    expect(res.treff[0].omveiM).toBeNull()
    expect(res.treff[0].hullM).toBeCloseTo(40, 0)
    // Brudd med målbar omvei kommer etter de frakoblede.
    expect(res.treff.slice(1).some(b => b.omveiM > 1000)).toBe(true)
  })

  it('respekterer maksHullM, minOmveiM og maksTreff', () => {
    expect(finnStinettBrudd(bruddNett(25), { grafOpts: RAA_GRAF, maksHullM: 10 }).antallBrudd).toBe(0)
    expect(finnStinettBrudd(bruddNett(25), { grafOpts: RAA_GRAF, minOmveiM: 20000 }).antallBrudd).toBe(0)
    const mange = finnStinettBrudd(bruddNett(25), { grafOpts: RAA_GRAF, maksTreff: 0 })
    expect(mange.treff).toHaveLength(0)
    expect(mange.antallBrudd).toBe(1)   // antallet telles uansett kutt i listen
  })

  it('tåler tomt stinett', () => {
    const res = finnStinettBrudd([])
    expect(res).toMatchObject({ noder: 0, kanter: 0, antallBrudd: 0, treff: [] })
  })
})

describe('formatBruddSvar', () => {
  const toWgs84 = (x, y) => ({ lat: 59 + y / 111320, lon: 10 + x / 57000 })

  it('projiserer til WGS84 og sier hva som skal til for å tette hullet', () => {
    const res = finnStinettBrudd(bruddNett(45), { grafOpts: RAA_GRAF })
    const svar = formatBruddSvar(res, { toWgs84, gapBridgeM: 30 })
    expect(svar.antallBrudd).toBe(1)
    const t = svar.treff[0]
    expect(t.stiende.lat).toBeCloseTo(59 + 45 / 111320, 6)
    expect(t.naermesteSti.isomKode).toBe('505')
    expect(t.tetteMed).toBe('gapBridgeM ≥ 45 (nå 30)')
    expect(svar.tolkning).toMatch(/ser sammenhengende ut/)
  })

  it('sier fra når hullet er innenfor toleransen (omveien kan være ekte)', () => {
    const res = finnStinettBrudd(bruddNett(25), { grafOpts: RAA_GRAF })
    const svar = formatBruddSvar(res, { toWgs84, gapBridgeM: 30 })
    expect(svar.treff[0].tetteMed).toMatch(/innenfor toleransen/)
  })

  it('skiller ekte hinder (bratt terreng) fra hull i kartdataene', () => {
    // 25 m hull med 25 m fall = 100 % > 60 %. Grafen nekter å bro det, så det
    // står igjen som brudd — og skal MELDES som ekte hinder, ikke som noe å
    // tette ved å heve toleransen.
    // Trinnet ligger midt i hullet, så bratteste MÅLTE helling er høyere enn
    // ende-til-ende (25 m fall over ~13 m, ikke over 25 m) — det er meningen:
    // det er selve stupet vi vil se, ikke gjennomsnittet over hullet.
    const stup = (x, y) => 100 + (y < 12.5 ? 0 : 25)
    const res = finnStinettBrudd(bruddNett(25), { elevationAt: stup })
    expect(res.antallBrudd).toBe(1)
    expect(res.treff[0].hellingPct).toBeGreaterThan(100)
    const svar = formatBruddSvar(res, { toWgs84 })
    expect(svar.treff[0].tetteMed).toMatch(/^ekte hinder: terrenget over hullet er \d+ % bratt/)
    expect(svar.treff[0].hellingPct).toBe(res.treff[0].hellingPct)
  })

  it('melder slakt terreng som hull i dataene, ikke som hinder', () => {
    const res = finnStinettBrudd(bruddNett(45), { elevationAt: () => 100 })
    const svar = formatBruddSvar(res, { toWgs84 })
    expect(svar.treff[0].hellingPct).toBe(0)
    expect(svar.treff[0].tetteMed).toBe('gapBridgeM ≥ 45 (nå 30)')
  })

  it('gir hellingPct null når kartet mangler DEM', () => {
    const res = finnStinettBrudd(bruddNett(45), { grafOpts: RAA_GRAF })
    expect(res.treff[0].hellingPct).toBeNull()
    const svar = formatBruddSvar(res, { toWgs84 })
    expect(svar.treff[0].tetteMed).toMatch(/gapBridgeM/)
  })

  it('gir en ærlig tolkning når det ikke er noen brudd', () => {
    const svar = formatBruddSvar(finnStinettBrudd([]), { toWgs84 })
    expect(svar.tolkning).toMatch(/Ingen brudd/)
    expect(svar.graf).toMatchObject({ noder: 0, kanter: 0 })
  })
})

describe('finnStinettBrudd – barrierer', () => {
  const tvers = (kode) => [{ coordinates: [[900, 12], [1100, 12]], isomCode: kode }]
  const toWgs84 = (x, y) => ({ lat: 59 + y / 111320, lon: 10 + x / 57000 })

  it('melder et hull over jernbane som ekte hinder', () => {
    const res = finnStinettBrudd(bruddNett(25), { barriers: tvers('515') })
    expect(res.antallBrudd).toBe(1)
    expect(res.treff[0].barriere).toBe('jernbane')
    const svar = formatBruddSvar(res, { toWgs84 })
    expect(svar.treff[0].tetteMed).toBe('ekte hinder: hullet krysser jernbane — ruteren nekter med vilje')
  })

  it('setter barriere til null når ingenting ligger i hullet', () => {
    const res = finnStinettBrudd(bruddNett(45), { grafOpts: RAA_GRAF })
    expect(res.treff[0].barriere).toBeNull()
  })

  it('lar barrieren rangere over bratt terreng i forklaringen', () => {
    // Både stup OG jernbane: barrieren er det konkrete svaret, så den vinner.
    const res = finnStinettBrudd(bruddNett(25), {
      barriers: tvers('515'), elevationAt: (x, y) => 100 + (y < 12.5 ? 0 : 25),
    })
    const svar = formatBruddSvar(res, { toWgs84 })
    expect(svar.treff[0].tetteMed).toMatch(/krysser jernbane/)
    expect(svar.treff[0].hellingPct).toBeGreaterThan(60)
  })
})

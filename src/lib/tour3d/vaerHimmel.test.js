// Oversettelsen fra METs symbolkoder til et skypreg. Dette er hele feilrisikoen
// i værhimmelen: rekkefølgen på regex-ene bestemmer hvilken regel som vinner, og
// en som er for tidlig i lista stjeler treff fra dem under. Testen holder hver
// familie fast mot det den skal bli.
import { describe, it, expect } from 'vitest'
import {
  vaerTilHimmel, vindVektor, SKY_OPASITET_TAK, NEDBOR_TAK,
} from './vaerHimmel.js'

describe('vaerTilHimmel — skydekke', () => {
  it('gir nesten skyfri himmel i klarvær', () => {
    // Det brukeren ba om: lite/ingen skyer når sol.
    const p = vaerTilHimmel('clearsky_day')
    expect(p.dekning).toBeLessThan(0.15)
    expect(p.antall).toBeLessThanOrEqual(2)
    expect(p.nedbor).toBeNull()
    expect(p.torden).toBe(false)
  })

  it('trapper opp gjennom lettskyet og delvis skyet til overskyet', () => {
    const d = ['clearsky_day', 'fair_day', 'partlycloudy_day', 'cloudy']
      .map((k) => vaerTilHimmel(k).dekning)
    // Strengt stigende: rekkefølgen i PREG-tabellen skal ikke kunne bytte om.
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1])
  })

  it('gjør skyene mørkere når nedbøren blir kraftigere', () => {
    const g = ['lightrain', 'rain', 'heavyrain'].map((k) => vaerTilHimmel(k).gratone)
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeLessThan(g[i - 1])
  })
})

describe('vaerTilHimmel — nedbørtype', () => {
  it.each([
    ['lightrain', 'regn'], ['rain', 'regn'], ['heavyrain', 'regn'],
    ['lightrainshowers_day', 'regn'], ['heavyrainshowers_night', 'regn'],
    ['lightsleet', 'sludd'], ['sleet', 'sludd'], ['heavysleet', 'sludd'],
    ['lightsleetshowers_day', 'sludd'], ['heavysleetshowers_day', 'sludd'],
    ['lightsnow', 'sno'], ['snow', 'sno'], ['heavysnow', 'sno'],
    ['lightsnowshowers_day', 'sno'], ['heavysnowshowers_day', 'sno'],
    ['clearsky_day', null], ['fair_night', null], ['partlycloudy_day', null],
    ['cloudy', null], ['fog', null],
  ])('%s → %s', (kode, ventet) => {
    expect(vaerTilHimmel(kode).nedbor).toBe(ventet)
  })

  it('treffer riktig type også for METs skrivefeil-koder', () => {
    // «lightssleet…» / «lightssnow…» med den ekstra s-en. Bommer regexen her,
    // får hele torden-familien feil nedbørtype — regn i stedet for snø.
    expect(vaerTilHimmel('lightssleetshowersandthunder_day').nedbor).toBe('sludd')
    expect(vaerTilHimmel('lightssnowshowersandthunder_night').nedbor).toBe('sno')
  })

  it('lar ikke regn-regelen stjele treff fra sludd og snø', () => {
    // Den feilen er lett å innføre: en /rain/-regel plassert for høyt i lista
    // ville tatt «heavysleetshowers» også, siden ingen av dem inneholder «rain»
    // men en slurvete regex kunne.
    expect(vaerTilHimmel('sleetshowersandthunder_day').nedbor).toBe('sludd')
    expect(vaerTilHimmel('snowshowersandthunder_day').nedbor).toBe('sno')
  })
})

describe('vaerTilHimmel — torden', () => {
  it.each([
    'lightrainandthunder', 'rainandthunder', 'heavyrainandthunder',
    'sleetandthunder', 'snowandthunder',
    'rainshowersandthunder_day', 'heavysnowshowersandthunder_polartwilight',
    'lightssleetshowersandthunder_night',
  ])('%s gir torden', (kode) => {
    expect(vaerTilHimmel(kode).torden).toBe(true)
  })

  it.each(['rain', 'heavysnow', 'cloudy', 'clearsky_day', 'fog'])(
    '%s gir IKKE torden', (kode) => {
      expect(vaerTilHimmel(kode).torden).toBe(false)
    })
})

describe('vaerTilHimmel — takene som verner lesbarheten', () => {
  it('holder opasiteten under taket for alle METs koder', () => {
    for (const kode of ['heavyrain', 'cloudy', 'heavysnow', 'heavysleetandthunder', 'fog']) {
      expect(vaerTilHimmel(kode).opasitet).toBeLessThanOrEqual(SKY_OPASITET_TAK)
    }
  })

  it('holder partikkeltallet under taket', () => {
    for (const kode of ['heavyrain', 'heavysnow', 'heavysleet']) {
      expect(vaerTilHimmel(kode).nedborTetthet).toBeLessThanOrEqual(NEDBOR_TAK)
    }
  })

  it('har alltid minst én sky, også i klarvær', () => {
    // 0 sprites ville betydd at feltet forsvant helt; en enslig sky leser som
    // klarvær og holder koden som tegner dem i én tilstand.
    expect(vaerTilHimmel('clearsky_day').antall).toBeGreaterThanOrEqual(1)
  })
})

describe('vaerTilHimmel — ukjent vær', () => {
  it('faller tilbake til standard-himmelen, ikke til en tom en', () => {
    // Å vise NULL skyer ved ukjent vær er en PÅSTAND om klarvær. Standarden er
    // himmelen appen har uten værmodus.
    for (const kode of [null, '', 'noe-met-ikke-har']) {
      const p = vaerTilHimmel(kode)
      expect(p.dekning).toBeGreaterThan(0.3)
      expect(p.nedbor).toBeNull()
      expect(p.torden).toBe(false)
    }
  })
})

describe('vindVektor', () => {
  it('lar skyene drive dit vinden GÅR, ikke dit den kommer fra', () => {
    // MET oppgir wind_from_direction. Vind FRA nord skal sende skyene sørover,
    // og scenen har +Z mot sør. Byttes fortegnet her, drar skyene mot været.
    const v = vindVektor(0, 5)
    expect(v.vindZ).toBeCloseTo(1, 5)
    expect(v.vindX).toBeCloseTo(0, 5)
  })

  it('vind fra sør sender skyene nordover (−Z)', () => {
    const v = vindVektor(180, 5)
    expect(v.vindZ).toBeCloseTo(-1, 5)
  })

  it('vind fra vest sender skyene østover (+X)', () => {
    const v = vindVektor(270, 5)
    expect(v.vindX).toBeCloseTo(1, 5)
    expect(v.vindZ).toBeCloseTo(0, 5)
  })

  it('gir en enhetsvektor så farten styres av fart alene', () => {
    for (const grader of [0, 45, 137, 300]) {
      const v = vindVektor(grader, 5)
      expect(Math.hypot(v.vindX, v.vindZ)).toBeCloseTo(1, 6)
    }
  })

  it('drifter vestlig som før når retningen mangler', () => {
    expect(vindVektor(null, 5).vindX).toBe(1)
    expect(vindVektor(undefined, null).vindX).toBe(1)
  })

  it('skiller UKJENT vind fra STILLE vind', () => {
    // Uten måling skal skyene drive som appen alltid har gjort (1×). 0 m/s er
    // derimot en ekte måling og skal gi rolig drift — men ikke stå stille, for
    // en frossen sky leser som en feil og ikke som vindstille.
    expect(vindVektor(0, null).fart).toBe(1)
    expect(vindVektor(0, 0).fart).toBeGreaterThan(0)
    expect(vindVektor(0, 0).fart).toBeLessThan(0.6)
  })

  it('demper farten og har et tak, så storm ikke gir stroboskop', () => {
    expect(vindVektor(0, 10).fart).toBeLessThan(2)
    expect(vindVektor(0, 45).fart).toBeLessThanOrEqual(2.4)
    // Stigende med vinden — ellers er koblingen til ekte vind bare pynt.
    expect(vindVektor(0, 12).fart).toBeGreaterThan(vindVektor(0, 3).fart)
  })
})

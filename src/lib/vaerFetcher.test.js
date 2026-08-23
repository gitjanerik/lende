// Parsing og tidsvalg for MET-varselet. Alt her er rene funksjoner: dette er
// hvor feilen faktisk kan bo, og det skal kunne testes uten nett.
import { describe, it, expect } from 'vitest'
import {
  parseVarsel, symbolBasis, medVariant, naaVarsel, timerFramover, VAER_DESIMALER,
} from './vaerFetcher.js'

// Utsnitt av et ekte Locationforecast-2.0-compact-svar, kuttet til det vi leser.
const SVAR = {
  properties: {
    meta: { updated_at: '2026-08-23T08:00:00Z' },
    timeseries: [
      {
        time: '2026-08-23T09:00:00Z',
        data: {
          instant: { details: {
            air_temperature: 14.2, wind_speed: 3.4,
            wind_from_direction: 210.5, cloud_area_fraction: 62.5,
          } },
          next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0 } },
          next_6_hours: { summary: { symbol_code: 'lightrain' }, details: { precipitation_amount: 1.2 } },
        },
      },
      {
        time: '2026-08-23T10:00:00Z',
        data: {
          instant: { details: { air_temperature: 15.1, wind_speed: 4.0, wind_from_direction: 215 } },
          next_1_hours: { summary: { symbol_code: 'lightrainshowers_day' }, details: { precipitation_amount: 0.3 } },
        },
      },
      {
        // Langt fram: MET har sluttet å levere 1-times-oppløsning her.
        time: '2026-08-26T06:00:00Z',
        data: {
          instant: { details: { air_temperature: 11.0, wind_speed: 6.1, wind_from_direction: 300 } },
          next_6_hours: { summary: { symbol_code: 'heavyrain' }, details: { precipitation_amount: 4.8 } },
        },
      },
    ],
  },
}

describe('parseVarsel', () => {
  it('leser temperatur, vind, skydekke, nedbør og symbol', () => {
    const v = parseVarsel(SVAR, { naa: '2026-08-23T09:05:00Z' })
    expect(v.oppdatert).toBe('2026-08-23T08:00:00Z')
    expect(v.timer).toHaveLength(3)
    const t = v.timer[0]
    expect(t).toMatchObject({
      tid: '2026-08-23T09:00:00Z',
      temperaturC: 14.2, vindMs: 3.4, vindRetningGrader: 210.5,
      skydekkeProsent: 62.5, nedborMm: 0, symbol: 'partlycloudy_day',
    })
  })

  it('foretrekker 1-times-varselet, men faller tilbake til 6-timers', () => {
    // Uten fallbacken ville den fjerneste raden vært tom bare fordi den ligger
    // langt fram — MET slutter å levere 1-times-oppløsning etter et døgn-to.
    const v = parseVarsel(SVAR)
    expect(v.timer[0].symbol).toBe('partlycloudy_day')   // 1-times vinner
    expect(v.timer[0].nedborTimer).toBe(1)
    expect(v.timer[2].symbol).toBe('heavyrain')          // 6-timers brukt
    expect(v.timer[2].nedborMm).toBe(4.8)
    // Perioden MÅ følge med: «4,8 mm» leser som mm/time uten den.
    expect(v.timer[2].nedborTimer).toBe(6)
  })

  it('gir null for tomt eller ødelagt svar framfor et halvtomt varsel', () => {
    expect(parseVarsel(null)).toBeNull()
    expect(parseVarsel({})).toBeNull()
    expect(parseVarsel({ properties: { timeseries: [] } })).toBeNull()
    // Punkt uten instant.details skal hoppes over, ikke gi NaN-felt.
    expect(parseVarsel({ properties: { timeseries: [{ time: 'x', data: {} }] } })).toBeNull()
  })

  it('gjør manglende måleverdier til null, ikke 0', () => {
    // En falsk 0 °C er verre enn ingen temperatur — det er husregelen ellers i
    // appen, og den gjelder her også.
    const v = parseVarsel({ properties: { timeseries: [{
      time: '2026-08-23T09:00:00Z',
      data: { instant: { details: { air_temperature: null } } },
    }] } })
    expect(v.timer[0].temperaturC).toBeNull()
    expect(v.timer[0].vindMs).toBeNull()
    expect(v.timer[0].nedborMm).toBeNull()
  })
})

describe('symbolBasis / medVariant', () => {
  it('deler kode og variant', () => {
    expect(symbolBasis('clearsky_night')).toEqual({ basis: 'clearsky', variant: 'night' })
    expect(symbolBasis('partlycloudy_polartwilight'))
      .toEqual({ basis: 'partlycloudy', variant: 'polartwilight' })
  })

  it('lar koder uten variant være i fred', () => {
    expect(symbolBasis('cloudy')).toEqual({ basis: 'cloudy', variant: null })
    expect(symbolBasis('fog')).toEqual({ basis: 'fog', variant: null })
  })

  it('splitter bare på SISTE understrek, og bare på en kjent variant', () => {
    // METs egne koder har understrek inni seg, og de har dessuten en kjent
    // skrivefeil («lights…») de har valgt å beholde for ikke å brekke klienter.
    // En naiv split på første understrek ville gitt basis «lightssleetshowersandthunder»
    // → feil ikon for hele torden-familien.
    expect(symbolBasis('lightssleetshowersandthunder_day'))
      .toEqual({ basis: 'lightssleetshowersandthunder', variant: 'day' })
    // «_foo» er ikke en variant: da er hele strengen basiskoden.
    expect(symbolBasis('noe_rart')).toEqual({ basis: 'noe_rart', variant: null })
  })

  it('bytter variant slik at ikonet følger valgt lysmodus', () => {
    expect(medVariant('clearsky_day', 'night')).toBe('clearsky_night')
    expect(medVariant('clearsky_night', 'day')).toBe('clearsky_day')
  })

  it('lar variantløse koder og ugyldige varianter stå urørt', () => {
    expect(medVariant('fog', 'night')).toBe('fog')
    expect(medVariant('clearsky_day', 'tull')).toBe('clearsky_day')
  })

  it('takler tomt og ikke-streng', () => {
    expect(symbolBasis(null)).toEqual({ basis: null, variant: null })
    expect(symbolBasis('')).toEqual({ basis: null, variant: null })
  })
})

describe('naaVarsel', () => {
  const v = parseVarsel(SVAR)

  it('velger timen som har startet, ikke den neste', () => {
    expect(naaVarsel(v, Date.parse('2026-08-23T09:30:00Z')).tid).toBe('2026-08-23T09:00:00Z')
    expect(naaVarsel(v, Date.parse('2026-08-23T10:00:00Z')).tid).toBe('2026-08-23T10:00:00Z')
  })

  it('bruker første time når hele varselet ligger fram i tid', () => {
    expect(naaVarsel(v, Date.parse('2026-08-23T08:00:00Z')).tid).toBe('2026-08-23T09:00:00Z')
  })

  it('gir null når varselet er for gammelt', () => {
    // Et døgn gammelt varsel skal ikke vises som «nå». Det er hele poenget med
    // en 30-minutters TTL, men cachen kan ha levert rett før den løp ut.
    expect(naaVarsel(v, Date.parse('2026-08-27T12:00:00Z'))).toBeNull()
  })

  it('takler tomt varsel', () => {
    expect(naaVarsel(null)).toBeNull()
    expect(naaVarsel({ timer: [] })).toBeNull()
  })
})

describe('timerFramover', () => {
  it('starter på timen som gjelder nå og hopper over det som er passert', () => {
    const v = parseVarsel(SVAR)
    const rad = timerFramover(v, { antall: 2, naa: Date.parse('2026-08-23T09:30:00Z') })
    expect(rad.map((t) => t.tid)).toEqual(['2026-08-23T09:00:00Z', '2026-08-23T10:00:00Z'])
  })

  it('gir tom rad framfor å kaste når varselet mangler', () => {
    expect(timerFramover(null)).toEqual([])
  })
})

describe('koordinat-presisjon', () => {
  it('holder seg innenfor METs grense på 4 desimaler', () => {
    // MET er eksplisitt: flere desimaler ødelegger cachen deres og vil etter
    // hvert gi 400. Vi sender 3 — samme rutenett som cache-nøkkelen.
    expect(VAER_DESIMALER).toBeLessThanOrEqual(4)
  })
})

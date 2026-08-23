// Ikonsettet mot METs egne symbolkoder.
//
// Settet er GENERERT (scripts/build-vaerikoner.js), så det er ikke koden her som
// kan skrive feil — det er en regenerering mot et endret sett. Feilmodusen er
// stille: et ikon som mangler gir bare ingen <img>, og værlinja ser ut som før
// bare uten symbol. Denne testen holder listen fast mot METs dokumenterte koder,
// så en regenerering som mister noe FEILER i stedet for å bli oppdaget på fjellet.
import { describe, it, expect } from 'vitest'
import { VAER_IKON, VAER_NAVN, VAER_MED_VARIANT } from './vaerIkoner.generert.js'
import { symbolBasis, medVariant } from './vaerFetcher.js'

// METs 41 basiskoder (weather/legend.csv). De 21 første har dag-/natt-/
// polartwilight-varianter; resten er like hele døgnet.
const MED_VARIANT = [
  'clearsky', 'fair', 'partlycloudy',
  'lightrainshowers', 'rainshowers', 'heavyrainshowers',
  'lightrainshowersandthunder', 'rainshowersandthunder', 'heavyrainshowersandthunder',
  'lightsleetshowers', 'sleetshowers', 'heavysleetshowers',
  // METs kjente skrivefeil — den ekstra s-en etter «light». De har valgt å
  // beholde den for ikke å brekke klienter, så den skal stå her også.
  'lightssleetshowersandthunder', 'sleetshowersandthunder', 'heavysleetshowersandthunder',
  'lightsnowshowers', 'snowshowers', 'heavysnowshowers',
  'lightssnowshowersandthunder', 'snowshowersandthunder', 'heavysnowshowersandthunder',
]
const UTEN_VARIANT = [
  'cloudy', 'fog',
  'lightrain', 'rain', 'heavyrain',
  'lightrainandthunder', 'rainandthunder', 'heavyrainandthunder',
  'lightsleet', 'sleet', 'heavysleet',
  'lightsleetandthunder', 'sleetandthunder', 'heavysleetandthunder',
  'lightsnow', 'snow', 'heavysnow',
  'lightsnowandthunder', 'snowandthunder', 'heavysnowandthunder',
]
const VARIANTER = ['day', 'night', 'polartwilight']

describe('ikonsettet dekker METs symbolkoder', () => {
  it('har 41 basiskoder med norske navn', () => {
    expect(Object.keys(VAER_NAVN).sort())
      .toEqual([...MED_VARIANT, ...UTEN_VARIANT].sort())
  })

  it('har alle tre variantene for kodene som har varianter', () => {
    for (const basis of MED_VARIANT) {
      expect(VAER_MED_VARIANT.has(basis), `${basis} skal ha varianter`).toBe(true)
      for (const v of VARIANTER) {
        expect(VAER_IKON[`${basis}_${v}`], `mangler ${basis}_${v}`).toBeTruthy()
      }
    }
  })

  it('har variantløse koder under sitt bare navn', () => {
    for (const basis of UTEN_VARIANT) {
      expect(VAER_MED_VARIANT.has(basis), `${basis} skal IKKE ha varianter`).toBe(false)
      expect(VAER_IKON[basis], `mangler ${basis}`).toBeTruthy()
    }
  })

  it('har 83 ikoner totalt og ingen andre', () => {
    // 21 × 3 + 20 = 83. Et avvik betyr at settet har endret seg og at listene
    // over må sjekkes mot METs legend.csv på nytt.
    expect(Object.keys(VAER_IKON)).toHaveLength(83)
  })

  it('er dekodbare SVG-data-URI-er, ikke tomme strenger', () => {
    for (const [kode, uri] of Object.entries(VAER_IKON)) {
      expect(uri.startsWith('data:image/svg+xml;base64,'), `${kode} har feil prefiks`).toBe(true)
      const svg = Buffer.from(uri.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf-8')
      expect(svg.startsWith('<svg'), `${kode} dekoder ikke til SVG`).toBe(true)
      expect(svg.includes('</svg>'), `${kode} er avkuttet`).toBe(true)
    }
  })

  it('slår opp riktig ikon for koden parseren faktisk gir', () => {
    // Kjeden som betyr noe: MET gir en symbol_code, symbolBasis/medVariant
    // former den, og oppslaget må treffe. Torden-familien med skrivefeilen er
    // den som lettest brekker.
    for (const kode of ['clearsky_night', 'cloudy', 'lightssleetshowersandthunder_polartwilight']) {
      expect(VAER_IKON[kode], `mangler ${kode}`).toBeTruthy()
      expect(VAER_NAVN[symbolBasis(kode).basis], `mangler navn for ${kode}`).toBeTruthy()
    }
    // Variant-bytte (3D-modus overstyrer klokka) skal alltid treffe et ikon.
    expect(VAER_IKON[medVariant('clearsky_day', 'night')]).toBe(VAER_IKON.clearsky_night)
  })

  it('bruker METs norske navn, ikke våre egne', () => {
    expect(VAER_NAVN.clearsky).toBe('Klarvær')
    expect(VAER_NAVN.partlycloudy).toBe('Delvis skyet')
    expect(VAER_NAVN.fog).toBe('Tåke')
  })
})

import { describe, it, expect } from 'vitest'
import {
  geocodePlace, geocodeKartverket, searchPlaces,
  normalizeNominatim, normalizeKartverket,
  shortNameFor, nearestPlaceLabel, reverseGeocode,
} from './geocode.js'

const sample = {
  place_id: 123,
  display_name: 'Vardåsen, Asker, Akershus, Norge',
  name: 'Vardåsen',
  type: 'peak',
  importance: 0.42,
  lat: '59.8135',
  lon: '10.4145',
  boundingbox: ['59.81', '59.82', '10.41', '10.42'],
  address: { municipality: 'Asker' },
}

const ssrSample = {
  stedsnummer: 987654,
  'skrivemåte': 'Bøseter',
  navneobjekttype: 'Seter',
  kommuner: [{ kommunenavn: 'Ringerike', kommunenummer: '3007' }],
  representasjonspunkt: { 'øst': 10.201, nord: 60.312, koordsys: 4258 },
}

function fakeFetch(payload, { ok = true, status = 200 } = {}) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return { ok, status, json: async () => payload }
  }
  fn.calls = calls
  return fn
}

// Ruter mot rett kilde ut fra URL: Geonorge → SSR-payload, ellers Nominatim.
function routedFetch(ssrPayload, nomPayload) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    const payload = String(url).includes('ws.geonorge.no') ? ssrPayload : nomPayload
    return { ok: true, status: 200, json: async () => payload }
  }
  fn.calls = calls
  return fn
}

describe('shortNameFor', () => {
  it('kombinerer navn og tettsted', () => {
    expect(shortNameFor(sample)).toBe('Vardåsen, Asker')
  })
  it('faller tilbake til display_name-ledd uten navn/adresse', () => {
    expect(shortNameFor({ display_name: 'A, B, C', address: {} })).toBe('A, B')
  })
})

describe('normalizeNominatim', () => {
  it('parser tall og bbox', () => {
    const n = normalizeNominatim(sample)
    expect(n.lat).toBeCloseTo(59.8135)
    expect(n.lon).toBeCloseTo(10.4145)
    expect(n.bbox).toEqual([59.81, 59.82, 10.41, 10.42])
    expect(n.id).toBe(123)
    expect(n.source).toBe('nominatim')
  })
})

describe('normalizeKartverket', () => {
  it('parser skrivemåte, kommune og representasjonspunkt', () => {
    const n = normalizeKartverket(ssrSample)
    expect(n.shortName).toBe('Bøseter, Ringerike')
    expect(n.lat).toBeCloseTo(60.312)
    expect(n.lon).toBeCloseTo(10.201)
    expect(n.type).toBe('seter')
    expect(n.bbox).toBeNull()
    expect(n.id).toBe('ssr:987654')
    expect(n.source).toBe('kartverket')
  })
  it('returnerer null uten gyldig representasjonspunkt', () => {
    expect(normalizeKartverket({ 'skrivemåte': 'X', representasjonspunkt: {} })).toBeNull()
  })
})

describe('geocodePlace', () => {
  it('returnerer normaliserte treff', async () => {
    const fetchImpl = fakeFetch([sample])
    const out = await geocodePlace('Vardåsen Asker', { fetchImpl })
    expect(out).toHaveLength(1)
    expect(out[0].shortName).toBe('Vardåsen, Asker')
    expect(out[0].lat).toBeCloseTo(59.8135)
  })

  it('sender countrycodes og q i forespørselen', async () => {
    const fetchImpl = fakeFetch([])
    await geocodePlace('Oslo', { fetchImpl, countryCode: 'no' })
    const url = fetchImpl.calls[0].url
    expect(url).toContain('countrycodes=no')
    expect(url).toContain('q=Oslo')
    expect(url).toContain('format=jsonv2')
  })

  it('returnerer tom liste for for korte søk uten å kalle fetch', async () => {
    const fetchImpl = fakeFetch([sample])
    expect(await geocodePlace('a', { fetchImpl })).toEqual([])
    expect(fetchImpl.calls).toHaveLength(0)
  })

  it('kaster ved ikke-ok svar', async () => {
    const fetchImpl = fakeFetch([], { ok: false, status: 429 })
    await expect(geocodePlace('Oslo', { fetchImpl })).rejects.toThrow('Nominatim 429')
  })
})

describe('geocodeKartverket', () => {
  it('parser data.navn til normaliserte treff', async () => {
    const fetchImpl = fakeFetch({ navn: [ssrSample] })
    const out = await geocodeKartverket('Bøseter', { fetchImpl })
    expect(out).toHaveLength(1)
    expect(out[0].shortName).toBe('Bøseter, Ringerike')
    expect(out[0].source).toBe('kartverket')
  })

  it('sender fuzzy, utkoordsys og sok i forespørselen', async () => {
    const fetchImpl = fakeFetch({ navn: [] })
    await geocodeKartverket('Bøseter', { fetchImpl, limit: 5 })
    const url = fetchImpl.calls[0].url
    expect(url).toContain('fuzzy=true')
    expect(url).toContain('utkoordsys=4258')
    expect(url).toContain('treffPerSide=5')
    expect(decodeURIComponent(url)).toContain('sok=Bøseter')
  })

  it('returnerer tom liste for for korte søk uten å kalle fetch', async () => {
    const fetchImpl = fakeFetch({ navn: [ssrSample] })
    expect(await geocodeKartverket('a', { fetchImpl })).toEqual([])
    expect(fetchImpl.calls).toHaveLength(0)
  })

  it('kaster ved ikke-ok svar', async () => {
    const fetchImpl = fakeFetch({ navn: [] }, { ok: false, status: 500 })
    await expect(geocodeKartverket('Oslo', { fetchImpl })).rejects.toThrow('Kartverket 500')
  })
})

describe('searchPlaces', () => {
  it('fletter begge kilder', async () => {
    const fetchImpl = routedFetch({ navn: [ssrSample] }, [sample])
    const out = await searchPlaces('Bøseter', { fetchImpl })
    const sources = out.map(r => r.source)
    expect(sources).toContain('kartverket')
    expect(sources).toContain('nominatim')
  })

  it('rangerer eksakt SSR-treff øverst', async () => {
    const fetchImpl = routedFetch({ navn: [ssrSample] }, [sample])
    const out = await searchPlaces('Bøseter', { fetchImpl })
    expect(out[0].shortName).toBe('Bøseter, Ringerike')
  })

  it('overlever at én kilde feiler (SSR nede → Nominatim alene)', async () => {
    const fn = async (url) => {
      if (String(url).includes('ws.geonorge.no')) return { ok: false, status: 503, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => [sample] }
    }
    const out = await searchPlaces('Vardåsen', { fetchImpl: fn })
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe('nominatim')
  })

  it('dedupliserer samme sted fra begge kilder', async () => {
    const dupNom = { ...sample, display_name: 'Bøseter, Ringerike', name: 'Bøseter',
      lat: '60.3121', lon: '10.2009', address: { municipality: 'Ringerike' } }
    const fetchImpl = routedFetch({ navn: [ssrSample] }, [dupNom])
    const out = await searchPlaces('Bøseter', { fetchImpl })
    const boseter = out.filter(r => r.shortName.startsWith('Bøseter'))
    expect(boseter).toHaveLength(1)
    expect(boseter[0].source).toBe('kartverket')
  })

  it('returnerer tom liste for for korte søk uten å kalle fetch', async () => {
    const fetchImpl = routedFetch({ navn: [ssrSample] }, [sample])
    expect(await searchPlaces('a', { fetchImpl })).toEqual([])
    expect(fetchImpl.calls).toHaveLength(0)
  })

  it('fjerner internt _order-felt fra resultatet', async () => {
    const fetchImpl = routedFetch({ navn: [ssrSample] }, [sample])
    const out = await searchPlaces('Bøseter', { fetchImpl })
    expect(out.every(r => !('_order' in r))).toBe(true)
  })
})

describe('nearestPlaceLabel', () => {
  it('velger det mest lokale leddet (grend før kommune)', () => {
    expect(nearestPlaceLabel({ address: { hamlet: 'Stormoen', municipality: 'Alvdal' } }))
      .toBe('Stormoen')
  })
  it('faller tilbake gjennom village → tettsted → kommune', () => {
    expect(nearestPlaceLabel({ address: { town: 'Lillehammer', municipality: 'Lillehammer' } }))
      .toBe('Lillehammer')
    expect(nearestPlaceLabel({ address: { municipality: 'Asker' } })).toBe('Asker')
  })
  it('bruker name eller første display_name-ledd når adressen er tom', () => {
    expect(nearestPlaceLabel({ name: 'Vardåsen', address: {} })).toBe('Vardåsen')
    expect(nearestPlaceLabel({ display_name: 'Skaret, Asker, Norge', address: {} })).toBe('Skaret')
  })
  it('returnerer null uten noe brukbart', () => {
    expect(nearestPlaceLabel(null)).toBeNull()
    expect(nearestPlaceLabel({ address: {} })).toBeNull()
  })
})

describe('reverseGeocode', () => {
  const revSample = {
    place_id: 9,
    display_name: 'Stormoen, Alvdal, Innlandet, Norge',
    name: '',
    lat: '62.1', lon: '10.6',
    address: { hamlet: 'Stormoen', municipality: 'Alvdal' },
  }

  it('returnerer normalisert treff med placeLabel', async () => {
    const fetchImpl = fakeFetch(revSample)
    const out = await reverseGeocode(62.1, 10.6, { fetchImpl })
    expect(out.placeLabel).toBe('Stormoen')
    expect(out.lat).toBeCloseTo(62.1)
  })

  it('sender lat/lon og reverse-parametre', async () => {
    const fetchImpl = fakeFetch(revSample)
    await reverseGeocode(62.1, 10.6, { fetchImpl })
    const url = fetchImpl.calls[0].url
    expect(url).toContain('lat=62.1')
    expect(url).toContain('lon=10.6')
    expect(url).toContain('format=jsonv2')
  })

  it('returnerer null for ugyldige koordinater uten å kalle fetch', async () => {
    const fetchImpl = fakeFetch(revSample)
    expect(await reverseGeocode(NaN, 10, { fetchImpl })).toBeNull()
    expect(fetchImpl.calls).toHaveLength(0)
  })

  it('returnerer null når Nominatim svarer med error', async () => {
    const fetchImpl = fakeFetch({ error: 'Unable to geocode' })
    expect(await reverseGeocode(0, 0, { fetchImpl })).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { geocodePlace, normalizeNominatim, shortNameFor, nearestPlaceLabel, reverseGeocode } from './geocode.js'

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

function fakeFetch(payload, { ok = true, status = 200 } = {}) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return { ok, status, json: async () => payload }
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

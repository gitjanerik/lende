import { describe, it, expect } from 'vitest'
import { cacheGet, cacheGetStale, cacheSet, pointKey, TTL } from './protectedAreaCache.js'

describe('pointKey', () => {
  it('gruperer nære punkter til samme nøkkel (~100 m grid)', () => {
    expect(pointKey(59.91234, 10.74567)).toBe(pointKey(59.91245, 10.74578))
    expect(pointKey(59.9123, 10.7456)).not.toBe(pointKey(59.9200, 10.7456))
  })
})

describe('cacheGet / cacheSet (minne-fallback uten IndexedDB)', () => {
  it('lagrer og henter en verdi innen TTL', async () => {
    await cacheSet('test:a', { x: 1 }, TTL.vern)
    expect(await cacheGet('test:a')).toEqual({ x: 1 })
  })

  it('returnerer null når verdien er utløpt', async () => {
    await cacheSet('test:expired', { y: 2 }, -1)
    expect(await cacheGet('test:expired')).toBeNull()
  })

  it('lagrer ikke null/undefined (vi cacher ikke «ingen treff»)', async () => {
    await cacheSet('test:null', null, TTL.vern)
    expect(await cacheGet('test:null')).toBeNull()
  })

  it('returnerer null for ukjent nøkkel', async () => {
    expect(await cacheGet('test:missing')).toBeNull()
  })
})

// ── cacheGetStale + vannstasjons-TTL-en (v7.8.14) ──────────────────────────
// Målingen fra NVE ble cachet i 24 t, så en verdi hentet kl. 23 sto som «siste
// måling» hele neste dag mens sildre.nve.no forlengst hadde nyere tall. Taket er
// nå HydAPIs egen takt. Det kunne bare kortes ned fordi `cacheGetStale` finnes:
// uten dekning er en gammel rad med synlig måletidspunkt fortsatt langt bedre
// enn et tomt ark på et fjell.
describe('cacheGetStale — siste utvei når nettet ikke svarer', () => {
  it('leser en UTLØPT rad som cacheGet nekter å gi fra seg', async () => {
    await cacheSet('test:gammel', { temp: 14.9 }, -1)
    expect(await cacheGet('test:gammel')).toBeNull()
    expect(await cacheGetStale('test:gammel')).toEqual({ temp: 14.9 })
  })

  it('leser en fersk rad like godt', async () => {
    await cacheSet('test:fersk', { temp: 14.7 }, TTL.hydroMaaling)
    expect(await cacheGetStale('test:fersk')).toEqual({ temp: 14.7 })
  })

  it('finner ikke opp data for en nøkkel som aldri er skrevet', async () => {
    expect(await cacheGetStale('test:finnes-ikke')).toBeNull()
  })
})

describe('TTL-ene som styrer hvor ferske eksterne data er', () => {
  // Poenget er FORHOLDET, ikke tallet: målingen skal aldri kunne bli eldre enn
  // stasjonslista, og aldri ligge nær 24 t igjen. Et tall alene ville blitt
  // «rettet» til noe rundere uten at noen så hva det kostet.
  it('vannstasjons-MÅLINGEN er én time — HydAPIs egen oppdateringstakt', () => {
    expect(TTL.hydroMaaling).toBe(60 * 60 * 1000)
  })

  it('målingen er langt ferskere enn stasjonslista den hører til', () => {
    expect(TTL.hydroMaaling).toBeLessThan(TTL.hydro)
    expect(TTL.hydroMaaling).toBeLessThanOrEqual(2 * 60 * 60 * 1000)
  })

  it('værvarselet er fortsatt appens ferskeste kilde', () => {
    expect(TTL.vaer).toBeLessThan(TTL.hydroMaaling)
  })
})

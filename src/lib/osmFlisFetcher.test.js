import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import { hentOsmFraFliser, nullstillOsmManifest } from './osmFlisFetcher.js'
import { fetchOsm } from './osmKilde.js'
import { OSM_FLIS_VERSJON } from './osmFlis.js'

const BASE = 'https://flis.test/osm'
const bbox = { south: 59.81, north: 59.84, west: 10.41, east: 10.44 }   // én flis: 1196_104
const vei = { type: 'way', id: 1, geometry: [{ lat: 59.82, lon: 10.42 }, { lat: 59.83, lon: 10.43 }], tags: { highway: 'path' } }
const sjo = { type: 'relation', id: 9, members: [{ type: 'way', ref: 2, role: 'outer', geometry: [{ lat: 59.815, lon: 10.415 }, { lat: 59.9, lon: 10.415 }] }], tags: { natural: 'water' } }

function svar(status, kropp) {
  return new Response(kropp == null ? null : kropp, { status })
}

function settNett(filer) {
  const kall = []
  globalThis.fetch = vi.fn(async (url) => {
    kall.push(String(url))
    const sti = String(url).slice(BASE.length + 1).split('?')[0]
    if (!(sti in filer)) return svar(404)
    const f = filer[sti]
    if (f instanceof Error) throw f
    if (typeof f === 'number') return svar(f)
    return svar(200, sti.endsWith('.gz') ? gzipSync(JSON.stringify(f)) : JSON.stringify(f))
  })
  return kall
}

const manifest = { versjon: OSM_FLIS_VERSJON, osmTid: '2026-11-13T21:22:20Z' }
const ekte = globalThis.fetch

beforeEach(() => nullstillOsmManifest())
afterEach(() => { globalThis.fetch = ekte })

describe('hentOsmFraFliser', () => {
  it('leser flisa, løser opp delte elementer og nøkler URL-en på baken', async () => {
    const kall = settNett({
      'manifest.json': manifest,
      '1196_104.json.gz': { elements: [vei], delte: ['relation/9'] },
      'delt/relation_9.json.gz': sjo,
    })
    const ut = await hentOsmFraFliser(bbox, { base: BASE })
    expect(ut.elements.map(e => `${e.type}/${e.id}`)).toEqual(['way/1', 'relation/9'])
    expect(ut.meta).toMatchObject({ kilde: 'fliser', osmTid: manifest.osmTid })
    expect(kall.find(u => u.includes('1196_104'))).toContain('?t=2026-11-13T21%3A22%3A20Z')
  })

  it('en flis som ikke finnes er tom, ikke en feil', async () => {
    settNett({ 'manifest.json': manifest })
    expect((await hentOsmFraFliser(bbox, { base: BASE })).elements).toEqual([])
  })

  it('kaster på en flis som feiler, en manglende delt fil og en ukjent versjon', async () => {
    settNett({ 'manifest.json': manifest, '1196_104.json.gz': 500 })
    await expect(hentOsmFraFliser(bbox, { base: BASE })).rejects.toThrow(/HTTP 500/)
    nullstillOsmManifest()
    settNett({ 'manifest.json': manifest, '1196_104.json.gz': { elements: [], delte: ['relation/9'] } })
    await expect(hentOsmFraFliser(bbox, { base: BASE })).rejects.toThrow(/relation\/9/)
    nullstillOsmManifest()
    settNett({ 'manifest.json': { ...manifest, versjon: 999 } })
    await expect(hentOsmFraFliser(bbox, { base: BASE })).rejects.toThrow(/v999/)
  })
})

describe('fetchOsm', () => {
  it('bare fliser kaster når flisene ikke kan leses', async () => {
    settNett({})
    await expect(fetchOsm(bbox, { kilde: 'fliser', flisBase: BASE })).rejects.toThrow(/manifest/)
  })
})

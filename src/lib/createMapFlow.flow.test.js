// Differensial-test for «No dice»-saken (2026-07-21): ferske kart bygd via
// picker (terreng-først) mangler NVE-innsjøene i SVG-en (ingen data-src="n50")
// selv om NVE-hentingen lyktes (status OK), mens kant-sone-utvidelser (direkte
// bygging) får dem. Testen kjører buildMapFromCenter BEGGE veier med identiske,
// mockede kilder og sammenligner vann-innholdet i full-SVG-en.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./n50Fetcher.js', () => ({
  fetchN50Water: vi.fn(async (bbox, { onStatus = () => {} } = {}) => {
    onStatus({ state: 'ok', features: 2, retried: false })
    return makeNveElements()
  }),
}))
vi.mock('./nveLakeFetcher.js', () => ({
  fetchNveLakePolygons: vi.fn(async () => []),
}))
vi.mock('./kulturminneFetcher.js', () => ({
  fetchKulturminner: vi.fn(async () => []),
}))
vi.mock('./demFetcher.js', () => ({
  fetchDEM: vi.fn(async () => makeMockDem()),
}))
vi.mock('./demTileCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDEMWithCache: vi.fn(async () => makeMockDem()),
}))
vi.mock('./terrariumDem.js', () => ({
  fillDemVoidsFromTerrarium: vi.fn(async (dem) => ({ dem, filled: false, replaced: 0 })),
}))
vi.mock('./mapStorage.js', () => ({
  saveMap: vi.fn(async (entry) => { savedEntries.push(entry); return entry }),
  generateMapId: vi.fn(() => `test-${++idCounter}`),
}))
vi.mock('./protectedAreaCache.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
  TTL: { kulturminne: 1 },
  kulturminneBboxKey: vi.fn(() => 'k'),
}))
vi.mock('./perfLog.js', () => ({ logPerf: vi.fn() }))
vi.mock('./mapBuilder.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    fetchOverpass: vi.fn(async () => ({ elements: makeOsmElements() })),
    probeCoastline: vi.fn(async () => false),
  }
})

import { buildMapFromCenter, consumeMapFinalize } from './createMapFlow.js'
import { syntheticDEM } from './dem.js'

let savedEntries = []
let idCounter = 0

// Senter nord i «Setten»-innsjøen (Setskog-området).
const CENTER = { lat: 59.802, lon: 11.673, name: 'Test' }

// Ekte-utseende DEM (ikke syntetisk kilde-navn, ellers hopper terreng-først av).
// Alt terreng > 0.5 m → innlandskart (ingen kyst/sjøkart-stier).
function makeMockDem() {
  const dem = syntheticDEM(120, 120,
    { originX: 0, originY: 0, pixelWidth: 40, pixelHeight: 40 },
    [{ x: 2400, y: 2400, h: 300, sigma: 30 }], 100)
  return { ...dem, source: 'mock-wcs' }
}

// NVE-innsjøer slik n50Fetcher.geojsonToWays leverer dem: en stor «Setten»-
// relasjon (outer langt forbi arket + øy-hull) og et lite navnløst tjern-way.
function makeNveElements() {
  const outer = []
  for (let lat = 59.72; lat <= 59.81; lat += 0.004) outer.push({ lat, lon: 11.660 })
  for (let lon = 11.660; lon <= 11.690; lon += 0.004) outer.push({ lat: 59.81, lon })
  for (let lat = 59.81; lat >= 59.72; lat -= 0.004) outer.push({ lat, lon: 11.690 })
  for (let lon = 11.690; lon >= 11.660; lon -= 0.004) outer.push({ lat: 59.72, lon })
  outer.push({ ...outer[0] })
  const inner = [
    { lat: 59.800, lon: 11.672 }, { lat: 59.800, lon: 11.678 },
    { lat: 59.804, lon: 11.678 }, { lat: 59.804, lon: 11.672 },
    { lat: 59.800, lon: 11.672 },
  ]
  const smallRing = [
    { lat: 59.797, lon: 11.664 }, { lat: 59.797, lon: 11.667 },
    { lat: 59.799, lon: 11.667 }, { lat: 59.799, lon: 11.664 },
    { lat: 59.797, lon: 11.664 },
  ]
  return [
    {
      type: 'relation', id: 'nve-setten',
      members: [
        { type: 'way', role: 'outer', geometry: outer },
        { type: 'way', role: 'inner', geometry: inner },
      ],
      tags: { natural: 'water', navn: 'Setten' }, _source: 'n50',
    },
    { type: 'way', id: 'nve-tjern', geometry: smallRing, tags: { natural: 'water' }, _source: 'n50' },
  ]
}

// OSM: en vei + en navngitt OSM-kopi av Setten (skal undertrykkes av NVE-
// dekningen) + et lite tjern utenfor NVE-dekning (skal beholdes).
function makeOsmElements() {
  const road = {
    type: 'way', id: 100, tags: { highway: 'tertiary' },
    geometry: [
      { lat: 59.795, lon: 11.655 }, { lat: 59.800, lon: 11.670 }, { lat: 59.805, lon: 11.685 },
    ],
  }
  const osmSetten = {
    type: 'way', id: 101, tags: { natural: 'water', name: 'Setten' },
    geometry: [
      { lat: 59.79, lon: 11.665 }, { lat: 59.79, lon: 11.685 },
      { lat: 59.805, lon: 11.685 }, { lat: 59.805, lon: 11.665 }, { lat: 59.79, lon: 11.665 },
    ],
  }
  const osmPond = {
    type: 'way', id: 102, tags: { natural: 'water' },
    geometry: [
      { lat: 59.807, lon: 11.650 }, { lat: 59.807, lon: 11.6525 },
      { lat: 59.8085, lon: 11.6525 }, { lat: 59.8085, lon: 11.650 }, { lat: 59.807, lon: 11.650 },
    ],
  }
  return [road, osmSetten, osmPond]
}

function waterStats(svg) {
  const n50Paths = (svg.match(/data-src="n50"/g) ?? []).length
  const wayPaths = (svg.match(/data-src="way"/g) ?? []).length
  const vannGroups = [...svg.matchAll(/<g[^>]*data-layer="vann"[^>]*data-iso="(\d+)"[^>]*>([\s\S]*?)<\/g>/g)]
  const vannPathCount = vannGroups.reduce((a, [, , body]) => a + (body.match(/<path/g) ?? []).length, 0)
  return { n50Paths, wayPaths, vannPathCount }
}

beforeEach(() => {
  savedEntries = []
})

describe('buildMapFromCenter — NVE-vann i full-SVG uansett byggevei', () => {
  const baseOpts = {
    center: CENTER, halfKm: 2, aspect: 1, equidistanceM: 20, navn: 'Testkart',
  }

  it('direkte bygging (utvidelses-veien): full-SVG har n50-vann', async () => {
    const { entry } = await buildMapFromCenter({ ...baseOpts, terrainFirst: false })
    const s = waterStats(entry.svg)
    expect(s.n50Paths).toBeGreaterThan(0)
    expect(s.vannPathCount).toBeGreaterThan(0)
    expect(entry.partial).toBe(false)
  })

  it('terreng-først (picker-veien): full-SVG etter finalize har SAMME n50-vann', async () => {
    const res = await buildMapFromCenter({ ...baseOpts, terrainFirst: true })
    // Terreng-previewen lagres først (partial), finalize gir full entry.
    expect(res.entry.partial).toBe(true)
    const finalize = res.finalize ?? consumeMapFinalize(res.id)
    expect(finalize).toBeTruthy()
    const fullEntry = await finalize
    const s = waterStats(fullEntry.svg)
    expect(s.n50Paths).toBeGreaterThan(0)
    expect(s.vannPathCount).toBeGreaterThan(0)
    expect(fullEntry.partial).toBe(false)
    // Og den fulle entry-en er faktisk LAGRET (siste saveMap-kall).
    const lastSaved = savedEntries[savedEntries.length - 1]
    expect(lastSaved.partial).toBe(false)
    expect(waterStats(lastSaved.svg).n50Paths).toBeGreaterThan(0)
  })
})

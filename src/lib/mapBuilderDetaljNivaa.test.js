import { describe, it, expect } from 'vitest'
import { buildSvg, bboxFromCenter } from './mapBuilder.js'

// Integrasjonsvakt for tetthets-detaljnivåene (mapDensityRules → buildSvg).
// Det VIKTIGSTE kravet: 'full' skal gi identisk resultat med å ikke sende noe
// detaljNivaa i det hele tatt, ellers ville automatikken endret alle kart i
// åpne områder — stikk i strid med formålet.

const CENTER = { lat: 59.9, lon: 10.75 }
const bbox = bboxFromCenter(CENTER.lat, CENTER.lon, 1, 1)

// ~70 m i lat-grader. Bevisst valgt MELLOM `full`- og `sparsom`-separasjonene
// (parkering 50 → 150, holdeplass 25 → 120, bom 0 → 120, bro 0 → 80), så `full`
// beholder alle fem mens `sparsom` faktisk tynner. Ligger punktene tettere enn
// full-separasjonen, tynnes de allerede i dag og testen måler ingenting.
const D = 0.00063

// Scenen bygges ÉN gang: buildSvg leser element-id-er inn i SVG-en, så en
// fabrikk med løpenummer ville gitt ulik output for to ellers like bygg.
const SCENE = (() => {
  let id = 1
  const node = (tags, dLat = 0, dLon = 0) => ({
    type: 'node', id: id++, lat: CENTER.lat + dLat, lon: CENTER.lon + dLon, tags,
  })
  const way = (tags, pts) => ({
    type: 'way', id: id++, tags,
    geometry: pts.map(([dLat, dLon]) => ({ lat: CENTER.lat + dLat, lon: CENTER.lon + dLon })),
  })
  return [
    // Fem bommer på rekke, ~70 m mellomrom.
    ...Array.from({ length: 5 }, (_, i) => node({ barrier: 'gate' }, i * D, 0)),
    // Fem broer, samme avstand.
    ...Array.from({ length: 5 }, (_, i) => way(
      { highway: 'track', bridge: 'yes' },
      [[i * D, 0.0005], [i * D, 0.0009]],
    )),
    // Fem parkeringer og fem holdeplasser, samme avstand.
    ...Array.from({ length: 5 }, (_, i) => node({ amenity: 'parking' }, i * D, 0.0015)),
    ...Array.from({ length: 5 }, (_, i) => node({ highway: 'bus_stop' }, i * D, 0.002)),
    // Kraftlinje + service-vei — droppes på sparsom.
    way({ power: 'line' }, [[0, -0.002], [0.002, -0.002]]),
    way({ highway: 'service' }, [[0, -0.003], [0.002, -0.003]]),
    // En vanlig sti som ALDRI skal forsvinne (navigasjons-innhold).
    way({ highway: 'path' }, [[0, -0.004], [0.002, -0.004]]),
    // Grend-navn (minor) og et bynavn (major).
    node({ place: 'farm', name: 'Vesle Gård' }, -0.001, 0),
    node({ place: 'town', name: 'Storby' }, -0.002, 0),
  ]
})()

const build = (opts) => buildSvg(SCENE, bbox, { scaleDenom: 10000, ...opts })

// meta.generated er et tidsstempel — to bygg millisekunder fra hverandre er
// aldri byte-like. Nulles ut før sammenligning.
const normaliser = (svg) => svg.replace(/&quot;generated&quot;:&quot;[^&]*&quot;/, 'T')
  .replace(/"generated":"[^"]*"/, 'T')

// Trekk ut ETT data-layer og alt inni det, med korrekt <g>-matching. En
// non-greedy regex ville stoppet på det første indre </g>.
function lag(svg, navn) {
  const start = svg.indexOf(`<g data-layer="${navn}"`)
  if (start === -1) return ''
  let i = start, depth = 0
  while (i < svg.length) {
    const open = svg.indexOf('<g', i), close = svg.indexOf('</g>', i)
    if (close === -1) break
    if (open !== -1 && open < close) { depth++; i = open + 2 }
    else { depth--; i = close + 4; if (depth === 0) break }
  }
  return svg.slice(start, i)
}
const antall = (s, re) => (s.match(re) ?? []).length

describe('detaljNivaa — «full» endrer ingenting', () => {
  it('gir identisk SVG som å ikke oppgi detaljNivaa', () => {
    expect(normaliser(build({ detaljNivaa: 'full' }).svg)).toBe(normaliser(build({}).svg))
  })

  it('faller til full oppførsel for ukjent nivå', () => {
    // Nivå-strengen føres til meta som den er, så SVG-en er ikke byte-lik —
    // men INNHOLDET skal være det: ingenting tynnet, ingenting droppet.
    const { svg } = build({ detaljNivaa: 'noe-rart' })
    expect(antall(lag(svg, 'bom'), /<use /g)).toBe(5)
    expect(antall(lag(svg, 'kraftlinje'), /<path /g))
      .toBe(antall(lag(build({}).svg, 'kraftlinje'), /<path /g))
    expect(svg).toContain('Vesle Gård')
  })

  it('beholder alle bommer og broer (ingen uttynning i dag)', () => {
    const { svg } = build({ detaljNivaa: 'full' })
    expect(antall(lag(svg, 'bom'), /<use /g)).toBe(5)
    expect(antall(lag(svg, 'bro'), /<path /g)).toBe(10)   // fem broer × to parapet-linjer
  })

  it('beholder kraftlinja', () => {
    expect(antall(lag(build({ detaljNivaa: 'full' }).svg, 'kraftlinje'), /<path /g))
      .toBeGreaterThan(0)
  })
})

describe('detaljNivaa — «sparsom» dropper støy, beholder innhold', () => {
  const full = build({ detaljNivaa: 'full' })
  const sparsom = build({ detaljNivaa: 'sparsom' })

  it('gir en mindre SVG', () => {
    expect(sparsom.svg.length).toBeLessThan(full.svg.length)
  })

  it('tømmer kraftlinje-laget', () => {
    expect(antall(lag(full.svg, 'kraftlinje'), /<path /g)).toBeGreaterThan(0)
    expect(antall(lag(sparsom.svg, 'kraftlinje'), /<path /g)).toBe(0)
  })

  it('dropper grend-navn men beholder bynavn', () => {
    expect(full.svg).toContain('Vesle Gård')
    expect(sparsom.svg).not.toContain('Vesle Gård')
    expect(sparsom.svg).toContain('Storby')
  })

  it('beholder stien — navigasjons-innhold ofres aldri', () => {
    expect(antall(lag(sparsom.svg, 'sti'), /<path /g)).toBeGreaterThan(0)
  })

  it('tynner ut de tette punkt-klyngene', () => {
    for (const navn of ['bom', 'parkering', 'holdeplass']) {
      const før = antall(lag(full.svg, navn), /<use /g)
      const etter = antall(lag(sparsom.svg, navn), /<use /g)
      expect(før, navn).toBe(5)
      expect(etter, navn).toBeLessThan(før)
      expect(etter, navn).toBeGreaterThan(0)   // aldri tømt helt
    }
  })

  it('tynner ut broene uten å fjerne dem', () => {
    const etter = antall(lag(sparsom.svg, 'bro'), /<path /g)
    expect(etter).toBeLessThan(10)
    expect(etter).toBeGreaterThan(0)
  })
})

describe('detaljNivaa — «lett» ligger mellom', () => {
  it('tømmer kraftlinja men beholder grend-navn', () => {
    const { svg } = build({ detaljNivaa: 'lett' })
    expect(antall(lag(svg, 'kraftlinje'), /<path /g)).toBe(0)
    expect(svg).toContain('Vesle Gård')
  })

  it('gir en størrelse mellom full og sparsom', () => {
    const [f, l, s] = ['full', 'lett', 'sparsom'].map(d => build({ detaljNivaa: d }).svg.length)
    expect(l).toBeLessThanOrEqual(f)
    expect(s).toBeLessThanOrEqual(l)
  })
})

describe('meta-rapportering', () => {
  it('fører detaljNivaa og tetthet inn i meta', () => {
    const t = { indeks: 915, klasse: 'svært tett', maksBreddeKm: 6, fraBreddeKm: 8, tilBreddeKm: 6 }
    const { meta } = build({ detaljNivaa: 'sparsom', tetthet: t })
    expect(meta.detaljNivaa).toBe('sparsom')
    expect(meta.tetthet).toEqual(t)
  })

  it('har tetthet = null når ingen sondering er gjort', () => {
    const { meta } = build({})
    expect(meta.detaljNivaa).toBe('full')
    expect(meta.tetthet).toBeNull()
  })
})

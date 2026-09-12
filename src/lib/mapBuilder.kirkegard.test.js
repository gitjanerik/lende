// Kirkegård / gravplass (516) — fra OSM-tagg til eget lag i SVG-en.
//
// Sporet finnes fordi eieren så en gravplass (Østenstad i Asker) på et
// Fritt lende-ark uten «verken markering eller bakgrunn»: OSM-flata var der,
// men ingen kode plukket den opp, og `landuse=grass` under den gjorde den til
// åpen mark. Testene her holder hele kjeden fast, for hvert ledd kan brytes
// alene uten at noe annet feiler.
import { describe, it, expect } from 'vitest'
import { buildSvg, buildOverpassQuery } from './mapBuilder.js'
import { classifyToIsom } from './symbolizer.js'
import { ALL_LAYER_KEYS, DEFAULT_VISIBLE_LAYER_KEYS } from './mapLayerCatalog.js'
import { FRITT_LENDE_LAG } from './frittLende.js'
import { KARTSTILER } from './kartStiler.js'
import katalog from './isomCatalog.json'

const BBOX = { south: 59.83, west: 10.44, north: 59.85, east: 10.48 }
const ring = (s, w, n, e) => [
  { lat: s, lon: w }, { lat: s, lon: e }, { lat: n, lon: e }, { lat: n, lon: w }, { lat: s, lon: w },
]
// ~200 × 200 m — på størrelse med Østenstad kirkegård, altså godt over
// minAreaM2 men langt under det som slipper gjennom med vegetasjonens terskel.
const gravplass = (tags = {}) => ({
  type: 'way', id: 'gravplass', geometry: ring(59.838, 10.452, 59.840, 10.456),
  tags: { landuse: 'cemetery', ...tags },
})

describe('kirkegård — Overpass spør etter begge taggene', () => {
  const q = buildOverpassQuery(BBOX)

  it('henter landuse=cemetery og amenity=grave_yard, på way og relation', () => {
    expect(q).toContain('way["landuse"="cemetery"];')
    expect(q).toContain('way["amenity"="grave_yard"];')
    // Store gravplasser er multipolygoner i OSM (indre hull for kirka eller
    // en parkeringsplass). Uten relasjonen mister vi nettopp de største.
    expect(q).toContain('relation["landuse"="cemetery"];')
    expect(q).toContain('relation["amenity"="grave_yard"];')
  })
})

describe('kirkegård — klassifisering og render', () => {
  it('gravplass klassifiseres til 516 og ikke til vegetasjon', () => {
    expect(classifyToIsom(gravplass())).toEqual({ code: '516', cat: 'manmade' })
  })

  it('516 rendres i sitt eget toggle-lag', () => {
    const { svg, counts } = buildSvg([gravplass()], BBOX)
    expect(svg).toContain('<g data-layer="kirkegard" data-iso="516">')
    expect(counts['516']).toBe(1)
    expect(ALL_LAYER_KEYS).toContain('kirkegard')
  })

  it('flata får kors-mønsteret og ikke bare en farge', () => {
    // Det var nettopp «ingen markering» eieren meldte: en flate alene leses
    // som en park, og halvparten av gravplassene i OSM mangler navn.
    const { svg } = buildSvg([gravplass()], BBOX)
    expect(svg).toContain('id="iso-pat-kirkegard"')
    expect(svg).toMatch(/\[data-iso="516"\][^}]*url\(#iso-pat-kirkegard\)/)
  })

  it('navnet på flata blir med uten egen kode', () => {
    const { svg } = buildSvg([gravplass({ name: 'Østenstad kirkegård' })], BBOX)
    expect(svg).toContain('Østenstad kirkegård')
  })
})

describe('kirkegård — laget er delt og default PÅ', () => {
  it('er synlig som default', () => {
    expect(DEFAULT_VISIBLE_LAYER_KEYS).toContain('kirkegard')
  })

  it('er med i ALLE kartstiler', () => {
    // kartStiler bygger hvert sett som en UNNTAKS-liste, så dette holder
    // fast at ingen stil har tatt den ut igjen senere.
    for (const stil of KARTSTILER) {
      expect(stil.lag, stil.key).toContain('kirkegard')
    }
  })

  it('er med i Fritt lende', () => {
    expect(FRITT_LENDE_LAG).toContain('kirkegard')
  })
})

describe('kirkegård — mønsteret er themebart hele veien', () => {
  it('mønsteret har en bunn, så et mørkt tema kan bytte den', () => {
    expect(katalog.patterns.kirkegard.background).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('.is-zooming-fallbacken går gjennom mønsterets egen tema-variabel', () => {
    // Under pinch byttes mønsteret til flat farge (perf). Leste den bakte
    // bunnfargen direkte, ville et mørkt tema blinket lyst i ~200 ms per gest
    // — samme feil som kratt/hugst/strand hadde før v10.2.9.
    const { svg } = buildSvg([gravplass()], BBOX)
    expect(svg).toMatch(/\.is-zooming \[data-iso="516"\][^}]*--pattern-kirkegard-fill/)
  })

  it('rene strek-mønstre uten bunn beholder `none` i samme regel', () => {
    // Myra har ingen bunnfarge i katalogen, og skal ikke få en gjennom
    // fallbacken — den ville vært et nytt fyll, ikke en optimalisering.
    expect(katalog.patterns.myr.background).toBeUndefined()
  })
})

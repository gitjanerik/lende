import { describe, it, expect } from 'vitest'
import isomCatalog from './isomCatalog.json'
import { buildPointSymbolDef, buildPatternDef, isOsmWaterSalty, isFlowingWaterArea, classifyToIsom, isTrailheadParking, buildIsomCss, isNationalPark, nationalParkFacts } from './symbolizer.js'

describe('isTrailheadParking — offentlig utfartsparkering vs. privat', () => {
  it('utfart-/tur-/friluft-navn markeres som utfartsparkering uansett access', () => {
    expect(isTrailheadParking({ amenity: 'parking', name: 'Utfartsparkering Vardåsen' })).toBe(true)
    expect(isTrailheadParking({ amenity: 'parking', name: 'Turparkering' })).toBe(true)
    expect(isTrailheadParking({ amenity: 'parking', operator: 'Friluftsetaten' })).toBe(true)
    expect(isTrailheadParking({ amenity: 'parking', 'name:no': 'Badeplass-parkering' })).toBe(true)
  })

  it('eksplisitt offentlig access markeres som utfartsparkering', () => {
    for (const access of ['yes', 'public', 'permissive', 'destination']) {
      expect(isTrailheadParking({ amenity: 'parking', access })).toBe(true)
    }
  })

  it('privat/kunde-access er ALDRI utfartsparkering — selv med utfart-navn taper access ikke (navn vinner)', () => {
    for (const access of ['private', 'customers', 'no', 'permit', 'residents']) {
      expect(isTrailheadParking({ amenity: 'parking', access })).toBe(false)
    }
  })

  it('navn vinner over privat access (en navngitt utfartsparkering er offentlig selv om access feil-tagget)', () => {
    expect(isTrailheadParking({ amenity: 'parking', access: 'private', name: 'Utfartsparkering' })).toBe(true)
  })

  it('parkering uten access-tag regnes konservativt som vanlig (ikke utfart)', () => {
    expect(isTrailheadParking({ amenity: 'parking' })).toBe(false)
    expect(isTrailheadParking({ amenity: 'parking', name: 'Parkeringshus' })).toBe(false)
  })

  it('ikke-parkering returnerer false', () => {
    expect(isTrailheadParking({ amenity: 'toilets', access: 'yes' })).toBe(false)
    expect(isTrailheadParking({})).toBe(false)
    expect(isTrailheadParking(null)).toBe(false)
  })
})

describe('isOsmWaterSalty — kun autoritative tagger, aldri navn', () => {
  // Prinsipp: salinitet avgjøres KUN av tagger, ALDRI av navnet.
  it('ferskvanns-innsjøer med «fjord»-navn er IKKE salt (Tyrifjorden m.fl.)', () => {
    for (const name of ['Tyrifjorden', 'Randsfjorden', 'Steinsfjorden', 'Hestesund', 'Mjøsa']) {
      expect(isOsmWaterSalty({ natural: 'water', name })).toBe(false)
      expect(isOsmWaterSalty({ natural: 'water', 'name:no': name })).toBe(false)
    }
  })

  it('water=fjord-taggen alene gjør IKKE vannet salt (valg B — ofte feil-tagget innlands)', () => {
    expect(isOsmWaterSalty({ natural: 'water', water: 'fjord' })).toBe(false)
    expect(isOsmWaterSalty({ natural: 'water', water: 'lake' })).toBe(false)
  })

  it('autoritative tagger gjør vannet salt', () => {
    expect(isOsmWaterSalty({ natural: 'water', salt: 'yes' })).toBe(true)
    expect(isOsmWaterSalty({ tidal: 'yes' })).toBe(true)
    expect(isOsmWaterSalty({ place: 'sea' })).toBe(true)
    expect(isOsmWaterSalty({ place: 'ocean' })).toBe(true)
    expect(isOsmWaterSalty({ natural: 'bay' })).toBe(true)
    expect(isOsmWaterSalty({ natural: 'strait' })).toBe(true)
    expect(isOsmWaterSalty({ water: 'sea' })).toBe(true)
  })

  it('Tyrifjorden (natural=water + fjord-navn) klassifiseres som ferskvann 301, ikke sjø 303', () => {
    const res = classifyToIsom({ type: 'way', tags: { natural: 'water', name: 'Tyrifjorden' } })
    expect(res).toEqual({ code: '301', cat: 'water' })
  })
})

describe('isFlowingWaterArea — elveløp-flater som NVE/N50 aldri leverer', () => {
  it('water=river/canal/stream/ditch er flytende flate', () => {
    for (const water of ['river', 'canal', 'stream', 'ditch', 'lock', 'moat', 'rapids', 'fish_pass']) {
      expect(isFlowingWaterArea({ natural: 'water', water })).toBe(true)
    }
  })

  it('waterway-areal (riverbank/dock/river/canal) er flytende flate', () => {
    expect(isFlowingWaterArea({ waterway: 'riverbank' })).toBe(true)
    expect(isFlowingWaterArea({ waterway: 'dock' })).toBe(true)
    expect(isFlowingWaterArea({ waterway: 'river' })).toBe(true)
    expect(isFlowingWaterArea({ waterway: 'canal' })).toBe(true)
  })

  it('innsjø/tjern/magasin er IKKE flytende (NVE/N50 er autoritativ for dem)', () => {
    expect(isFlowingWaterArea({ natural: 'water' })).toBe(false)
    expect(isFlowingWaterArea({ natural: 'water', water: 'lake' })).toBe(false)
    expect(isFlowingWaterArea({ natural: 'water', water: 'pond' })).toBe(false)
    expect(isFlowingWaterArea({ natural: 'water', water: 'reservoir' })).toBe(false)
    expect(isFlowingWaterArea({})).toBe(false)
    expect(isFlowingWaterArea(undefined)).toBe(false)
  })
})

describe('classifyToIsom — idrettsanlegg (ISOM 513)', () => {
  it('stadion/idrettspark/idrettsbane/travbane/recreation_ground → 513', () => {
    const cases = [
      { leisure: 'stadium' },
      { leisure: 'sports_centre' },
      { leisure: 'pitch' },
      { leisure: 'track' },
      { leisure: 'horse_racing' },
      { landuse: 'recreation_ground' },
      { building: 'stadium' },
    ]
    for (const tags of cases) {
      expect(classifyToIsom({ type: 'way', tags })).toEqual({ code: '513', cat: 'manmade' })
    }
  })

  it('hoppbakke (sport=ski_jumping) → 513 uansett base-tag og element-type', () => {
    expect(classifyToIsom({ type: 'way', tags: { sport: 'ski_jumping' } })).toEqual({ code: '513', cat: 'manmade' })
    expect(classifyToIsom({ type: 'node', tags: { sport: 'ski_jumping', name: 'Midtstubakken' } })).toEqual({ code: '513', cat: 'manmade' })
    expect(classifyToIsom({ type: 'way', tags: { leisure: 'pitch', sport: 'ski_jumping' } })).toEqual({ code: '513', cat: 'manmade' })
  })

  it('lysløype (leisure=track + sport=skiing) forblir 510, ikke idrettsanlegg', () => {
    expect(classifyToIsom({ type: 'way', tags: { leisure: 'track', sport: 'skiing' } })).toEqual({ code: '510', cat: 'manmade' })
  })

  it('leisure=park forblir åpen mark (401), ikke idrettsanlegg', () => {
    expect(classifyToIsom({ type: 'way', tags: { leisure: 'park' } })).toEqual({ code: '401', cat: 'terrain' })
  })
})

describe('classifyToIsom — vei-ramper (*_link)', () => {
  it('*_link rendres som sin foreldre-klasse (avkjøringer ut av rundkjøringer/kryss)', () => {
    const way = (highway) => classifyToIsom({ type: 'way', tags: { highway } })
    expect(way('motorway_link')).toEqual({ code: '501', cat: 'manmade' })
    expect(way('trunk_link')).toEqual({ code: '501', cat: 'manmade' })
    expect(way('primary_link')).toEqual({ code: '502', cat: 'manmade' })
    expect(way('secondary_link')).toEqual({ code: '502', cat: 'manmade' })
    expect(way('tertiary_link')).toEqual({ code: '503', cat: 'manmade' })
  })

  it('foreldre-klassene er uendret', () => {
    const way = (highway) => classifyToIsom({ type: 'way', tags: { highway } })
    expect(way('motorway')).toEqual({ code: '501', cat: 'manmade' })
    expect(way('primary')).toEqual({ code: '502', cat: 'manmade' })
    expect(way('tertiary')).toEqual({ code: '503', cat: 'manmade' })
  })
})

describe('classifyToIsom — gang-/sykkelbro (ISOM 505)', () => {
  it('footway/cycleway MED bro rendres som sti (505) — spennet leses som kryssing', () => {
    expect(classifyToIsom({ type: 'way', tags: { highway: 'footway', bridge: 'yes' } })).toEqual({ code: '505', cat: 'manmade' })
    expect(classifyToIsom({ type: 'way', tags: { highway: 'cycleway', bridge: 'yes' } })).toEqual({ code: '505', cat: 'manmade' })
  })

  it('hengebro (bridge=suspension) dekkes av samme regel', () => {
    expect(classifyToIsom({ type: 'way', tags: { highway: 'footway', bridge: 'suspension' } })).toEqual({ code: '505', cat: 'manmade' })
  })

  it('ordinær footway/cycleway UTEN bro faller fortsatt bort (declutter-invariant)', () => {
    expect(classifyToIsom({ type: 'way', tags: { highway: 'footway' } })).toBeNull()
    expect(classifyToIsom({ type: 'way', tags: { highway: 'cycleway' } })).toBeNull()
    expect(classifyToIsom({ type: 'way', tags: { highway: 'footway', bridge: 'no' } })).toBeNull()
  })
})

describe('classifyToIsom — kraftlinje (ISOM 528)', () => {
  it('power=line og power=minor_line → 528 (begge kraftlinje-typer med)', () => {
    expect(classifyToIsom({ type: 'way', tags: { power: 'line' } })).toEqual({ code: '528', cat: 'manmade' })
    expect(classifyToIsom({ type: 'way', tags: { power: 'minor_line' } })).toEqual({ code: '528', cat: 'manmade' })
  })
})

describe('buildPointSymbolDef', () => {
  it('renders rect-elementer (ISOM 540 stake-port)', () => {
    const spec = {
      viewBox: '-1 -1 2 2',
      elements: [
        { type: 'rect', x: -0.4, y: -0.6, width: 0.8, height: 1.2, fill: '#cc1f1f' },
      ],
    }
    const def = buildPointSymbolDef('test-rect', spec)
    expect(def).toContain('<rect')
    expect(def).toContain('x="-0.4"')
    expect(def).toContain('y="-0.6"')
    expect(def).toContain('width="0.8"')
    expect(def).toContain('height="1.2"')
    expect(def).toContain('fill="#cc1f1f"')
  })

  it('renders flere rect-elementer (ISOM 542 stake-cardinal)', () => {
    const spec = {
      viewBox: '-1 -1 2 2',
      elements: [
        { type: 'rect', x: -0.4, y: -0.7, width: 0.8, height: 0.5, fill: '#000' },
        { type: 'rect', x: -0.4, y: -0.2, width: 0.8, height: 0.5, fill: '#f5d33a' },
        { type: 'rect', x: -0.4, y: 0.3, width: 0.8, height: 0.4, fill: '#000' },
      ],
    }
    const def = buildPointSymbolDef('test-cardinal', spec)
    const rectMatches = def.match(/<rect/g)
    expect(rectMatches).toHaveLength(3)
    expect(def).toContain('fill="#f5d33a"')
  })

  it('forblir bakoverkompatibel for circle/polygon/path/line', () => {
    const def = buildPointSymbolDef('test-mix', {
      viewBox: '-1 -1 2 2',
      elements: [
        { type: 'circle', cx: 0, cy: 0, r: 0.5, fill: '#000' },
        { type: 'polygon', points: '0,-1 1,1 -1,1', fill: '#0f0' },
      ],
    })
    expect(def).toContain('<circle')
    expect(def).toContain('<polygon')
  })
})

describe('buildIsomCss — veitunnel stiplet i veifargen, uten casing (v2.4.22)', () => {
  const css = buildIsomCss(undefined, new Map(), { usedCodes: new Set(['501', '502', '503', '504']) })

  it('casing-pathen skjules for tunnel-segmenter på veier med overlay', () => {
    for (const code of ['501', '502', '503']) {
      expect(css).toContain(`[data-iso="${code}"] path[data-tunnel="yes"]:not(.overlay) { display: none }`)
    }
  })

  it('overlay-pathen (veifargen) får stiplet strek', () => {
    const rule = css.match(/\[data-iso="502"\] path\.overlay\[data-tunnel="yes"\] \{ ([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/stroke-dasharray: [\d.]+mm [\d.]+mm/)
    expect(rule).toContain('stroke-linecap: butt')
  })

  it('skogsbilvei (504, uten overlay) får stiplet basis-strek', () => {
    expect(css).toMatch(/\[data-iso="504"\] path\[data-tunnel="yes"\] \{ stroke-dasharray:/)
    expect(css).not.toContain('[data-iso="504"] path[data-tunnel="yes"]:not(.overlay)')
  })

  it('tunnel-dashen er tydelig lengre enn sti-stiplingen (505 = 0.36mm)', () => {
    const dash = Number(css.match(/\[data-iso="502"\] path\.overlay\[data-tunnel="yes"\] \{ stroke-dasharray: ([\d.]+)mm/)?.[1])
    expect(dash).toBeGreaterThan(0.6)
  })

  it('koder som ikke er i bruk gir ingen tunnel-regler', () => {
    const only501 = buildIsomCss(undefined, new Map(), { usedCodes: new Set(['501']) })
    expect(only501).not.toContain('[data-iso="502"] path[data-tunnel="yes"]')
  })
})

describe('nasjonalpark — egen kategori, ikke ISOM 520 (v2.4.23)', () => {
  const park = {
    type: 'relation', id: 1,
    tags: {
      boundary: 'national_park', name: 'Rondane nasjonalpark', 'name:en': 'Rondane National Park',
      'naturbase:url': 'https://faktaark.naturbase.no/?id=VV00001873',
      'naturbase:verneform': 'Nasjonalpark', operator: 'Rondane-Dovre nasjonalparkstyre',
      protect_class: '2', 'ref:naturvern': 'VV00001873', start_date: '1962-12-21',
      wikidata: 'Q1245176',
    },
  }

  it('nasjonalpark gir ingen ISOM-kode (tegnes ikke)', () => {
    expect(classifyToIsom(park)).toBeNull()
  })

  it('naturreservat får fortsatt 520', () => {
    const res = classifyToIsom({
      type: 'relation', id: 2,
      tags: { leisure: 'nature_reserve', boundary: 'protected_area', protect_class: '1a', name: 'Grunnvatnet naturreservat' },
    })
    expect(res).toEqual({ code: '520', cat: 'manmade' })
  })

  it('isNationalPark krever navn', () => {
    expect(isNationalPark(park.tags)).toBe(true)
    expect(isNationalPark({ boundary: 'national_park' })).toBe(false)
    expect(isNationalPark({ boundary: 'protected_area', name: 'X' })).toBe(false)
  })

  it('nationalParkFacts plukker Naturbase-feltene', () => {
    expect(nationalParkFacts(park.tags)).toEqual({
      navn: 'Rondane nasjonalpark',
      altNavn: null,
      ref: 'VV00001873',
      faktaarkUrl: 'https://faktaark.naturbase.no/?id=VV00001873',
      forvaltning: 'Rondane-Dovre nasjonalparkstyre',
      vernedato: '1962-12-21',
      wikidata: 'Q1245176',
    })
  })

  it('samisk parallellnavn tas med når det finnes', () => {
    const f = nationalParkFacts({
      boundary: 'national_park', name: 'Børgefjell nasjonalpark', 'name:sma': 'Byrkije nasjonalparhke',
    })
    expect(f.altNavn).toBe('Byrkije nasjonalparhke')
  })

  it('ikke-http naturbase:url forkastes', () => {
    const f = nationalParkFacts({ boundary: 'national_park', name: 'X nasjonalpark', 'naturbase:url': 'VV00001873' })
    expect(f.faktaarkUrl).toBeNull()
  })

  it('nationalParkFacts returnerer null for alt annet enn nasjonalpark', () => {
    expect(nationalParkFacts({ leisure: 'nature_reserve', name: 'Y' })).toBeNull()
  })
})

describe('punktsymbol-farger — hva som themes og hva som er konstant', () => {
  const cat = isomCatalog

  // Rene sort-på-hvitt kartmarker skal følge temaet via currentColor. Hardkodet
  // #000 gjorde dem usynlige i mørke temaer.
  it('blekk-symbolene bruker currentColor, ikke #000', () => {
    for (const name of ['stein', 'bom', 'bru', 'bro', 'hule', 'gruve']) {
      const blob = JSON.stringify(cat.pointSymbols[name])
      expect(blob, `${name} har fortsatt hardkodet #000`).not.toContain('#000')
      expect(blob, `${name} mangler currentColor`).toContain('currentColor')
    }
  })

  // Skiltfarger og sjømerke-koding er konstante på tvers av temaer — som ekte
  // skilt. En hvit glyf på blå brikke skal IKKE følge temaets blekk.
  it('skilt- og IALA-farger er ikke rutet gjennom blekket', () => {
    // Hvit glyf på farget brikke skal være REN hvit, ikke temaets papir — ellers
    // ville P-/buss-/WC-piktogrammene blitt mørke inni den blå brikken.
    for (const name of ['parkering', 'holdeplass', 'wc']) {
      const paints = cat.pointSymbols[name].elements.map((e) => e.fill)
      expect(paints, `${name} mistet ren hvit glyf`).toContain('#fff')
    }
    // IALA: sort/gult på cardinal, gult med sort omriss på special.
    expect(JSON.stringify(cat.pointSymbols['stake-cardinal'])).toContain('#000')
    expect(JSON.stringify(cat.pointSymbols['stake-special'])).toContain('#000')
  })

  // Kirkekorset er samme idiom som label-haloene: sort blekk bak en hvit halo.
  // Korset følger blekket, haloen temaets bakgrunn — så den smelter inn i stedet
  // for å gløde, slik den gjorde i alle mørke temaer.
  it('kirkekorset følger blekket og haloen temaets papir', () => {
    const paints = cat.pointSymbols.kirke.elements.map((e) => e.fill)
    expect(paints.filter((p) => p === 'currentColor')).toHaveLength(2)
    expect(paints.filter((p) => p === 'var(--sym-paper, #fff)')).toHaveLength(2)
    expect(paints).not.toContain('#000')
    expect(paints).not.toContain('#fff')
  })

  it('var()-farger legges som inline style, ikke som presentasjonsattributt', () => {
    // var() virker ikke i SVG-presentasjonsattributter; attributtet må beholde
    // fallback-fargen mens style-en bærer variabelen.
    const def = buildPointSymbolDef('iso-sym-kirke', cat.pointSymbols.kirke)
    expect(def).toContain('style="fill:var(--sym-paper, #fff)"')
    expect(def).toContain('fill="#fff"')
    expect(def).not.toContain('fill="var(')
  })

  it('mønster-farger går gjennom --pattern-<navn>-stroke', () => {
    const def = buildPatternDef('iso-pat-myr', cat.patterns.myr, 'myr')
    expect(def).toContain('var(--pattern-myr-stroke, #0099cc)')
    // Presentasjonsattributtet beholdes som fallback (var() virker ikke der).
    expect(def).toContain('stroke="#0099cc"')
  })

  it('roten setter color fra --sym-ink så currentColor kan arves', () => {
    const css = buildIsomCss(cat, new Map(), {})
    expect(css).toContain('color: var(--sym-ink, #000)')
  })
})

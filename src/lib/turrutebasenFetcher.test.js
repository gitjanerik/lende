import { describe, it, expect } from 'vitest'
import {
  buildTurruteUrl, parseFotruter, posListToGeometry, travelLineGeometries,
  dedupeRoutesAgainstLines, turruterToElements, DEDUP_TOLERANCE_M, MIN_NEW_SEGMENT_M,
} from './turrutebasenFetcher.js'
import { classifyToIsom } from './symbolizer.js'

const BBOX = { south: 59.830, west: 10.055, north: 59.848, east: 10.110 }

// Utdrag av ekte WFS-svar (Trettekollen/Finnemarka, hentet 2026-08-09).
const GML = `<?xml version='1.0' encoding='UTF-8'?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">
<wfs:member>
<app:Fotrute xmlns:app="http://skjema.geonorge.no/SOSI/produktspesifikasjon/TurOgFriluftsruter/20171210" gml:id="fotrute.46514">
  <app:opphav>Rett i kartet</app:opphav>
  <app:senterlinje>
    <gml:LineString gml:id="fotrute.46514_APP_SENTERLINJE" srsName="urn:ogc:def:crs:EPSG::4258">
      <gml:posList>59.8400 10.0800 59.8400 10.0810 59.8400 10.0820</gml:posList>
    </gml:LineString>
  </app:senterlinje>
  <app:merking>JA</app:merking>
  <app:ruteFølger>ST</app:ruteFølger>
  <app:fotruteInfo><app:FotruteInfo>
    <app:rutenavn>Eiksetra - Svarvestolen</app:rutenavn>
    <app:rutenummer>fhv2</app:rutenummer>
    <app:vedlikeholdsansvarlig>DNT | DNT Drammen og Omegn</app:vedlikeholdsansvarlig>
    <app:gradering>B</app:gradering>
  </app:FotruteInfo></app:fotruteInfo>
</app:Fotrute>
</wfs:member>
<wfs:member>
<app:Fotrute xmlns:app="http://skjema.geonorge.no/SOSI/produktspesifikasjon/TurOgFriluftsruter/20171210" gml:id="fotrute.99">
  <app:senterlinje><gml:LineString><gml:posList>59.8300 10.0600 59.8300 10.0650</gml:posList></gml:LineString></app:senterlinje>
  <app:merking>NEI</app:merking>
</app:Fotrute>
</wfs:member>
</wfs:FeatureCollection>`

// Rett øst-vest-linje fra (lat, lon0) med gitt lengde i grader.
const line = (lat, lon0, lon1, n = 12) =>
  Array.from({ length: n }, (_, i) => ({ lat, lon: lon0 + (lon1 - lon0) * (i / (n - 1)) }))

describe('buildTurruteUrl', () => {
  it('bruker EPSG:4258 med lat,lon-akserekkefølge i bbox', () => {
    const url = buildTurruteUrl(BBOX)
    expect(url).toContain('typeNames=app%3AFotrute')
    // sør,vest,nord,øst + CRS-urn
    expect(decodeURIComponent(url)).toContain('bbox=59.83,10.055,59.848,10.11,urn:ogc:def:crs:EPSG::4258')
  })
})

describe('posListToGeometry', () => {
  it('leser lat,lon-par og hopper over ufullstendige/ugyldige tall', () => {
    expect(posListToGeometry('59.84 10.08 59.85 10.09')).toEqual([
      { lat: 59.84, lon: 10.08 }, { lat: 59.85, lon: 10.09 },
    ])
    expect(posListToGeometry('59.84 10.08 59.85')).toHaveLength(1)
    expect(posListToGeometry('')).toEqual([])
    expect(posListToGeometry(null)).toEqual([])
  })
})

describe('parseFotruter', () => {
  it('henter geometri og nøstede felt fra ekte GML', () => {
    const r = parseFotruter(GML)
    expect(r).toHaveLength(2)
    expect(r[0].navn).toBe('Eiksetra - Svarvestolen')
    expect(r[0].rutenummer).toBe('fhv2')
    expect(r[0].ansvarlig).toBe('DNT | DNT Drammen og Omegn')
    expect(r[0].merking).toBe('JA')
    // app:ruteFølger har ø i tagnavnet — regexen må tåle det.
    expect(r[0].ruteFolger).toBe('ST')
    expect(r[0].geometry).toHaveLength(3)
    expect(r[1].merking).toBe('NEI')
  })

  it('tåler tom/ugyldig input', () => {
    expect(parseFotruter('')).toEqual([])
    expect(parseFotruter(null)).toEqual([])
    expect(parseFotruter('<wfs:FeatureCollection/>')).toEqual([])
  })
})

describe('travelLineGeometries', () => {
  it('plukker bare ferdselslinjer, ikke vann eller andre flater', () => {
    const els = [
      { tags: { highway: 'path' }, geometry: line(59.84, 10.08, 10.09) },
      { tags: { highway: 'track' }, geometry: line(59.85, 10.08, 10.09) },
      { tags: { natural: 'water' }, geometry: line(59.86, 10.08, 10.09) },
      { tags: { power: 'line' }, geometry: line(59.87, 10.08, 10.09) },
      { tags: { highway: 'path' }, geometry: [{ lat: 59.88, lon: 10.08 }] },   // for kort
    ]
    expect(travelLineGeometries(els)).toHaveLength(2)
    expect(travelLineGeometries(null)).toEqual([])
  })
})

describe('dedupeRoutesAgainstLines', () => {
  it('fjerner en rute som ligger oppå en OSM-sti', () => {
    const geometry = line(59.8400, 10.0800, 10.0900)
    const kept = dedupeRoutesAgainstLines(
      [{ id: 'a', merking: 'JA', geometry }],
      [line(59.8400, 10.0800, 10.0900)],
    )
    expect(kept).toEqual([])
  })

  it('beholder en rute som ikke har noen OSM-linje i nærheten', () => {
    const kept = dedupeRoutesAgainstLines(
      [{ id: 'a', merking: 'JA', geometry: line(59.8400, 10.0800, 10.0900) }],
      [line(59.8600, 10.0800, 10.0900)],   // ~2,2 km unna
    )
    expect(kept).toHaveLength(1)
    expect(kept[0].geometry.length).toBeGreaterThan(2)
  })

  it('deler en delvis overlappende rute og beholder bare den nye halvdelen', () => {
    // Rute langs hele strekket; OSM dekker bare den vestre halvparten.
    const kept = dedupeRoutesAgainstLines(
      [{ id: 'a', merking: 'JA', geometry: line(59.8400, 10.0800, 10.0900, 40) }],
      [line(59.8400, 10.0800, 10.0850, 20)],
    )
    expect(kept).toHaveLength(1)
    // Det som står igjen skal ligge øst for delepunktet.
    const lons = kept[0].geometry.map(p => p.lon)
    expect(Math.min(...lons)).toBeGreaterThan(10.0845)
  })

  it('bruker densifisering: en OSM-way med to fjerne punkter dekker hele strekket', () => {
    // Uten densifisering ville midten av ruta ligget langt fra begge OSM-vertekser.
    const sparse = [{ lat: 59.8400, lon: 10.0800 }, { lat: 59.8400, lon: 10.0900 }]
    const kept = dedupeRoutesAgainstLines(
      [{ id: 'a', merking: 'JA', geometry: line(59.8400, 10.0800, 10.0900, 40) }],
      [sparse],
    )
    expect(kept).toEqual([])
  })

  it('dropper konfetti-korte nye biter', () => {
    // Et lite hopp i OSM-dekningen skal ikke gi en 20 m-stump.
    const routeGeom = line(59.8400, 10.0800, 10.0900, 200)
    const osm = routeGeom.filter(p => p.lon < 10.08448 || p.lon > 10.08472)
    const kept = dedupeRoutesAgainstLines([{ id: 'a', merking: 'JA', geometry: routeGeom }], [osm])
    for (const k of kept) {
      let len = 0
      for (let i = 0; i < k.geometry.length - 1; i++) {
        len += Math.hypot(
          (k.geometry[i + 1].lat - k.geometry[i].lat) * 111320,
          (k.geometry[i + 1].lon - k.geometry[i].lon) * 111320 * Math.cos(59.84 * Math.PI / 180),
        )
      }
      expect(len).toBeGreaterThanOrEqual(MIN_NEW_SEGMENT_M)
    }
  })

  it('tåler tom input i begge ender', () => {
    expect(dedupeRoutesAgainstLines([], [])).toEqual([])
    expect(dedupeRoutesAgainstLines(null, null)).toEqual([])
    // Ingen OSM-linjer i det hele tatt → alt er nytt.
    expect(dedupeRoutesAgainstLines([{ id: 'a', geometry: line(59.84, 10.08, 10.09) }], []))
      .toHaveLength(1)
  })

  it('toleransen er den dokumenterte', () => {
    expect(DEDUP_TOLERANCE_M).toBe(30)
    // ~50 m nord for OSM-stien → utenfor toleransen, beholdes.
    const kept = dedupeRoutesAgainstLines(
      [{ id: 'a', geometry: line(59.84045, 10.0800, 10.0900) }],
      [line(59.8400, 10.0800, 10.0900)],
    )
    expect(kept).toHaveLength(1)
  })
})

describe('turruterToElements + symbolisering', () => {
  it('lager way-elementer med kilde-merking og uten name', () => {
    const els = turruterToElements([
      { id: 'a', merking: 'JA', navn: 'Eiksetra - Svarvestolen', ansvarlig: 'DNT', geometry: line(59.84, 10.08, 10.09) },
    ])
    expect(els).toHaveLength(1)
    expect(els[0].type).toBe('way')
    expect(els[0]._source).toBe('turrutebasen')
    expect(els[0].tags['lende:turrute']).toBe('fotrute')
    expect(els[0].tags['lende:rutenavn']).toBe('Eiksetra - Svarvestolen')
    // `name` ville spist av navne-budsjettet og fortrengt stedsnavn.
    expect(els[0].tags.name).toBeUndefined()
  })

  it('merket rute → ISOM 506, umerket → 507', () => {
    const [merket] = turruterToElements([{ id: 'a', merking: 'JA', geometry: line(59.84, 10.08, 10.09) }])
    const [umerket] = turruterToElements([{ id: 'b', merking: 'NEI', geometry: line(59.84, 10.08, 10.09) }])
    expect(classifyToIsom(merket)).toEqual({ code: '506', cat: 'manmade' })
    expect(classifyToIsom(umerket)).toEqual({ code: '507', cat: 'manmade' })
  })

  it('påvirker ikke klassifiseringen av vanlige OSM-stier', () => {
    expect(classifyToIsom({ tags: { highway: 'path' } })).toEqual({ code: '505', cat: 'manmade' })
    expect(classifyToIsom({ tags: { highway: 'track' } })).toEqual({ code: '504', cat: 'manmade' })
  })
})

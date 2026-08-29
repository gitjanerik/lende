import { describe, it, expect } from 'vitest'
import { filterOsmWaterElements, demProbeOpplosning } from './createMapFlow.js'

// Regresjon: brede elver (Drammenselva, tagget natural=water+water=river) skal
// IKKE forsvinne når NVE/N50 returnerer ferskvann. NVE/N50 leverer kun innsjø-
// flater, aldri elveløp — så et elve-areal som droppes erstattes av ingenting,
// og kartet sitter igjen med kun den hårtynne waterway=river-senterlinja (304).
const el = (tags) => ({ type: 'way', id: 1, tags })

// En lukket ring (lon/lat) rundt et lite område ved (10, 60) — brukes som NVE-
// innsjø-dekning. Et OSM-vann-element med sentroide her regnes som NVE-dekket.
const NVE_RING = [[10, 60], [10, 60.01], [10.01, 60.01], [10.01, 60], [10, 60]]
const ringGeom = (lon0, lat0, lon1, lat1) => [
  { lat: lat0, lon: lon0 }, { lat: lat0, lon: lon1 },
  { lat: lat1, lon: lon1 }, { lat: lat1, lon: lon0 }, { lat: lat0, lon: lon0 },
]
// OSM-innsjø MED geometri inne i NVE-ringen / langt unna.
const lakeInsideNve = (tags) => ({ type: 'way', id: 2, tags, geometry: ringGeom(10.002, 60.002, 10.008, 60.008) })
const lakeOutsideNve = (tags) => ({ type: 'way', id: 3, tags, geometry: ringGeom(11.0, 59.0, 11.01, 59.01) })

describe('filterOsmWaterElements — elve-flater overlever autoritativt ferskvann', () => {
  const flagsWithNve = { n50HasSea: false, n50HasFreshwater: false, nveLakeRings: [NVE_RING] }
  const flagsWithN50 = { n50HasSea: true, n50HasFreshwater: true, nveLakeRings: null }

  it('navngitt elve-flate (Drammenselva) beholdes når NVE har innsjøer', () => {
    const river = el({ natural: 'water', water: 'river', name: 'Drammenselva' })
    expect(filterOsmWaterElements([river], flagsWithNve)).toEqual([river])
  })

  it('UNAVNGITT elve-flate beholdes når N50 har ferskvann', () => {
    const river = el({ natural: 'water', water: 'river' })
    expect(filterOsmWaterElements([river], flagsWithN50)).toEqual([river])
  })

  it('waterway=riverbank-areal beholdes selv med NVE-innsjøer', () => {
    const bank = el({ waterway: 'riverbank' })
    expect(filterOsmWaterElements([bank], flagsWithNve)).toEqual([bank])
  })

  it('innsjø-flate undertrykkes når NVE dekker den (mistagget flom-innsjø)', () => {
    const lake = lakeInsideNve({ natural: 'water', name: 'Røssvatnet' })
    expect(filterOsmWaterElements([lake], flagsWithNve)).toEqual([])
  })

  it('innsjø NVE IKKE dekker beholdes (Ulvenvatnet-fiks — NVE-respons ufullstendig)', () => {
    // Selv om NVE returnerte ANDRE innsjøer, skal en innsjø utenfor enhver
    // NVE-ring ikke forsvinne. Tidligere ble ALT OSM-ferskvann droppet straks
    // NVE returnerte noe → innsjøer NVE bommet på forsvant helt.
    const lake = lakeOutsideNve({ natural: 'water', name: 'Ulvenvatnet' })
    expect(filterOsmWaterElements([lake], flagsWithNve)).toEqual([lake])
  })

  it('navngitt innsjø (Setten) undertrykkes når N50 dekker den — så N50s øy-hull vinner (Kolstadøya)', () => {
    // OSM «Setten» uten øy-hull ville ellers males opakt over Kolstadøya. Når
    // N50-vann dekker flata, droppes OSM-kopien (selv om den er navngitt).
    const lake = lakeInsideNve({ natural: 'water', name: 'Setten' })
    const flags = { n50HasSea: false, n50HasFreshwater: true, nveLakeRings: null, n50WaterRings: [NVE_RING] }
    expect(filterOsmWaterElements([lake], flags)).toEqual([])
  })

  it('navngitt innsjø UTENFOR N50-dekning beholdes (per-flate, ikke blankett)', () => {
    const lake = lakeOutsideNve({ natural: 'water', name: 'Fjerntjern' })
    const flags = { n50HasSea: false, n50HasFreshwater: true, nveLakeRings: null, n50WaterRings: [NVE_RING] }
    expect(filterOsmWaterElements([lake], flags)).toEqual([lake])
  })

  it('navnløst tjern NVE ikke dekker beholdes når N50 mangler ferskvann', () => {
    const tjern = lakeOutsideNve({ natural: 'water' })
    expect(filterOsmWaterElements([tjern], flagsWithNve)).toEqual([tjern])
  })

  it('saltvann undertrykkes når N50 har sjø, men beholdes ellers', () => {
    const sea = el({ natural: 'water', salt: 'yes' })
    expect(filterOsmWaterElements([sea], { n50HasSea: true })).toEqual([])
    expect(filterOsmWaterElements([sea], { n50HasSea: false })).toEqual([sea])
  })

  it('uten autoritative kilder (nettleser/CORS-feil) beholdes ALT OSM-vann', () => {
    const els = [
      el({ natural: 'water', water: 'river', name: 'Drammenselva' }),
      el({ natural: 'water', name: 'Tyrifjorden' }),
      el({ waterway: 'stream' }),
      el({ highway: 'path' }),
    ]
    expect(filterOsmWaterElements(els, {})).toEqual(els)
  })

  // v5.18.3: bekke-LINJER styres av om kilden SELV har bekker, ikke av om den
  // svarte. Fram til da het flagget n50HasFreshwater og dekket begge deler —
  // riktig den gang kilden var hele N50-vannstacken (Havflate + Innsjø +
  // ElvBekk). Da den ble lagt om til NVE Innsjødatabasen (innsjøer alene),
  // beholdt flagget navnet, og OSM-bekkene ble undertrykt av en kilde uten en
  // eneste bekk å erstatte dem med: Rondvassbu falt fra 72,7 til 14,6 km elv.
  it('bekke-LINJE undertrykkes kun når kilden SELV har bekker', () => {
    const stream = el({ waterway: 'stream' })
    expect(filterOsmWaterElements([stream], { n50HasStreams: true })).toEqual([])
    expect(filterOsmWaterElements([stream], { n50HasStreams: false })).toEqual([stream])
  })

  it('en innsjø-kilde (NVE) tar IKKE bekkene med seg', () => {
    const stream = el({ waterway: 'stream' })
    const ditch = el({ waterway: 'ditch' })
    // Innsjøer i kilden ⇒ n50HasFreshwater, men ingen bekker ⇒ n50HasStreams false.
    const flags = { n50HasFreshwater: true, n50HasStreams: false }
    expect(filterOsmWaterElements([stream, ditch], flags)).toEqual([stream, ditch])
  })

  it('ikke-vann-elementer passerer uberørt', () => {
    const road = el({ highway: 'residential' })
    expect(filterOsmWaterElements([road], flagsWithNve)).toEqual([road])
  })
})

// ── DEM-probe-oppløsning ────────────────────────────────────────────────────
// Regelen bestemmer hvor fin DEM-en blir, og dermed hvor glatte kotene er.
// Den er eksportert nettopp fordi den er en beslutning: lå den bare inne i den
// nettverksavhengige pipelinen, kunne den ikke prøves i det hele tatt.
describe('demProbeOpplosning', () => {
  it('gir 10 m til fine konturer og 20 m ellers — regelen er uendret', () => {
    expect(demProbeOpplosning(2.5)).toBe(10)
    expect(demProbeOpplosning(5)).toBe(10)
    expect(demProbeOpplosning(10)).toBe(20)
    expect(demProbeOpplosning(20)).toBe(20)
    expect(demProbeOpplosning(50)).toBe(20)
  })

  // Fritt lende: 10 m ekvidistanse på et 2 km-ark. Regelen alene ville gitt
  // 20 m DEM, og da ligger kotene drøyt én celle fra hverandre i bratt terreng.
  it('lar kalleren overstyre', () => {
    expect(demProbeOpplosning(10, 10)).toBe(10)
    expect(demProbeOpplosning(20, 5)).toBe(5)
  })

  // Default-en MÅ være uendret for alle eksisterende kallere — ingen av dem
  // sender parameteren, og en overstyring som slo inn på undefined ville
  // stille endret hvert eneste kart som bygges.
  it('faller tilbake på regelen for alt som ikke er et gyldig tall', () => {
    for (const tull of [undefined, null, 0, -5, NaN, '10']) {
      expect(demProbeOpplosning(10, tull)).toBe(20)
    }
  })
})

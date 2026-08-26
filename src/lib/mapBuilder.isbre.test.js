import { describe, it, expect } from 'vitest'
import { buildSvg } from './mapBuilder.js'
import { classifyToIsom } from './symbolizer.js'
import { themeVarEntries, allThemeVarNames } from './mapSettingsApply.js'
import { ALL_LAYER_KEYS } from './mapLayerCatalog.js'
import katalog from './isomCatalog.json'

const BBOX = { south: 61.60, west: 6.90, north: 61.63, east: 6.96 }
const ring = (s, w, n, e) => [
  { lat: s, lon: w }, { lat: s, lon: e }, { lat: n, lon: e }, { lat: n, lon: w }, { lat: s, lon: w },
]
const bre = (tags = {}) => ({
  type: 'way', id: 'bre', geometry: ring(61.610, 6.920, 61.622, 6.940),
  tags: { natural: 'glacier', ...tags },
})
const skog = (tags = {}) => ({
  type: 'way', id: 'skog', geometry: ring(61.604, 6.904, 61.608, 6.914),
  tags: { natural: 'wood', ...tags },
})
const bygg = (elements) => buildSvg(elements, BBOX, { skipContoursIfSynthetic: true })

describe('isbre — egen kode, eget lag', () => {
  it('natural=glacier klassifiseres til 410 og ikke til vegetasjon', () => {
    expect(classifyToIsom(bre())).toEqual({ code: '410', cat: 'terrain' })
  })

  it('glacier vinner over en overlappende landuse-tagg', () => {
    // Breer i OSM bærer ofte en kommune-/verneflates landuse i tillegg. Marka
    // er is; det er breen som beskriver den.
    expect(classifyToIsom(bre({ landuse: 'meadow' })).code).toBe('410')
  })

  it('410 rendres i sitt eget toggle-lag', () => {
    const { svg, counts } = bygg([bre({ 'lende:n50areal': 'isbre' })])
    expect(svg).toContain('<g data-layer="isbre" data-iso="410">')
    expect(counts['410']).toBe(1)
    expect(ALL_LAYER_KEYS).toContain('isbre')
  })

  it('bre-flata er hvit i katalogen og har en kant som skiller den fra papiret', () => {
    const def = katalog.categories.terrain['410']
    expect(def.fill.color).toBe('#ffffff')
    expect(def.stroke.color).toBeTruthy()
    expect(def.stroke.widthMm).toBeGreaterThan(0)
  })
})

describe('isbre-navn er PUNKTER, ikke flate-tagger', () => {
  const navnepunkt = {
    type: 'node', id: 'n', lat: 61.616, lon: 6.930,
    tags: { natural: 'glacier', name: 'Nigardsbreen', 'lende:n50navn': 'isbre' },
  }

  it('et navnepunkt gir en etikett', () => {
    const { svg } = bygg([bre(), navnepunkt])
    expect(svg).toMatch(/data-label="omrade-navn"[^>]*>Nigardsbreen</)
  })

  it('navnepunktet telles ALDRI som en bre-flate', () => {
    // Uten gaten i buckets-løkka ville hvert navn blitt en 410 uten geometri:
    // en teller som lyver, og et lag som ser fullt ut mens det er tomt.
    const { counts } = bygg([navnepunkt])
    expect(counts['410']).toBe(0)
  })

  it('navnet kommer fram selv uten en bre-flate under', () => {
    // N50-flatene og N50-navnene er to uavhengige kilder. Feiler den ene,
    // skal den andre fortsatt vises.
    const { svg } = bygg([navnepunkt])
    expect(svg).toContain('Nigardsbreen')
  })
})

describe('ark med ekte N50-skog merkes, og bare da', () => {
  it('N50-skog på arket gir data-areal="skog" + regelen som bytter bakgrunn', () => {
    const { svg } = bygg([skog({ 'lende:n50areal': 'skog' })])
    expect(svg).toContain('data-areal="skog"')
    expect(svg).toContain('[data-areal~="skog"] { --bg: var(--bg-apen,')
  })

  it('OSM-skog alene merker IKKE arket — påstanden i bakgrunnen blir stående', () => {
    // Dette er hele gaten. OSM er tynt i norsk utmark; å la et enkelt
    // OSM-polygon slå av «her er skog»-påstanden ville gitt tomme ark akkurat
    // der Turkart-temaet finnes for å unngå dem.
    const { svg } = bygg([skog()])
    expect(svg).not.toContain('data-areal=')
    expect(svg).not.toContain('data-areal~=')
  })

  it('et ark uten arealdekke i det hele tatt merkes ikke', () => {
    const { svg } = bygg([bre()])
    expect(svg).not.toContain('data-areal=')
  })
})

describe('--bg-apen er satt for hvert tema, aldri bare for Turkart', () => {
  it('alle temaer med bakgrunn får --bg-apen', () => {
    // Fallbacken i CSS-regelen er katalogens KREMGULE bakgrunn. Et mørkt tema
    // uten --bg-apen ville derfor fått et lyst ark i det øyeblikket det traff
    // et merket kart — verre enn den grønne påstanden vi prøver å bli kvitt.
    for (const navn of Object.keys(katalog.themes)) {
      if (navn === 'light') continue
      const vars = Object.fromEntries(themeVarEntries(navn))
      expect(vars['--bg-apen'], navn).toBeTruthy()
    }
    expect(allThemeVarNames()).toContain('--bg-apen')
  })

  it('temaer uten egen åpen-tone får sin vanlige bakgrunn — byttet blir en no-op', () => {
    const dark = Object.fromEntries(themeVarEntries('dark'))
    expect(dark['--bg-apen']).toBe(dark['--bg'])
    const turkart = Object.fromEntries(themeVarEntries('turkart'))
    expect(turkart['--bg-apen']).not.toBe(turkart['--bg'])
  })

  it('--bg-apen refererer ALDRI --bg — en selvrefererende variabel er en syklus', () => {
    // `--bg: var(--bg-apen, var(--bg, …))` gjør hele deklarasjonen ugyldig i
    // CSS, og da faller alt tilbake på de bakte defaultene. Verdien må være en
    // ren farge.
    for (const navn of Object.keys(katalog.themes)) {
      const par = themeVarEntries(navn).find(([n]) => n === '--bg-apen')
      if (par) expect(par[1], navn).toMatch(/^#[0-9a-f]{3,8}$/i)
    }
  })
})

describe('gaten spør om DEKNING, ikke om skog', () => {
  // v5.26.1 spurte «bærer arket N50-skog?». Over tregrensa er svaret legitimt
  // nei, og da ble arket stående med Turkarts skog-påstand: Hardangervidda kom
  // ut med 151 myrflater og null skog — full dekning — og ble malt grønn.
  // Jo mer alpint arket var, jo sikrere ble det grønt.
  const myr = {
    type: 'way', id: 'm', geometry: ring(61.70, 9.10, 61.72, 9.14),
    tags: { natural: 'wetland', 'lende:n50areal': 'myr' },
  }

  it('dekning uten ett eneste skogpolygon merker likevel arket', () => {
    const { svg, counts } = buildSvg([myr], BBOX, { skipContoursIfSynthetic: true, arealDekning: true })
    expect(counts['406']).toBe(0)
    expect(svg).toContain('data-areal="skog"')
    expect(svg).toContain('[data-areal~="skog"] { --bg: var(--bg-apen,')
  })

  it('et HELT tomt ark med dekning merkes også — bart fjell er et svar', () => {
    const { svg } = buildSvg([], BBOX, { skipContoursIfSynthetic: true, arealDekning: true })
    expect(svg).toContain('data-areal="skog"')
  })

  it('uten dekning står påstanden — offline, utenfor baken, eller gammelt kart', () => {
    const { svg } = buildSvg([myr], BBOX, { skipContoursIfSynthetic: true, arealDekning: false })
    expect(svg).not.toContain('data-areal=')
  })

  it('skog på arket merker det selv om flagget ikke er sendt', () => {
    // Reserven for kallere som ikke plumber flagget: finnes det skog, er
    // dekningen uansett bevist.
    const { svg } = buildSvg([skog({ 'lende:n50areal': 'skog' })], BBOX, { skipContoursIfSynthetic: true })
    expect(svg).toContain('data-areal="skog"')
  })
})

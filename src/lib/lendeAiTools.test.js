import { describe, it, expect } from 'vitest'
import {
  AI_TOOLS, buildTourQuery, buildRundturQuery, buildLagKartQuery, projectForModel,
  kmUtenforBbox, kmMellom, bboxAvstandKm, metaFraSvgEl, toolStatusLabel,
  erStinettSporsmaal, stinettSvarTekst, harOppdiktedeTurtall, turSvarTekst,
  formatGangtid, forhaandsberegnTur, er3dOnske,
} from './lendeAiTools.js'
import { parseHTML } from 'linkedom'
import { parseTourQuery } from './tour3dLink.js'
import { svgToWgs84 } from './utm.js'

describe('AI_TOOLS', () => {
  it('har OpenAI-formen modellen leser', () => {
    for (const t of AI_TOOLS) {
      expect(t.type).toBe('function')
      expect(t.function.name).toBeTruthy()
      expect(t.function.description).toBeTruthy()
      expect(t.function.parameters.type).toBe('object')
    }
  })

  it('har unike verktøynavn', () => {
    const navn = AI_TOOLS.map((t) => t.function.name)
    expect(new Set(navn).size).toBe(navn.length)
  })

  it('turverktøyene tar stedsnavn, og krever bare kartId', () => {
    // Navn slår koordinater (v4.4.2): appen slår dem opp i kartets egne navn,
    // så en navnebror milevis unna ikke kan snike seg inn via sok_sted.
    const tur = AI_TOOLS.find((x) => x.function.name === 'foreslaa_tur')
    expect(tur.function.parameters.properties.fraNavn.type).toBe('string')
    expect(tur.function.parameters.properties.tilNavn.type).toBe('string')
    expect(tur.function.parameters.required).toEqual(['kartId'])

    const rundt = AI_TOOLS.find((x) => x.function.name === 'foreslaa_rundtur')
    expect(rundt.function.parameters.properties.origoNavn.type).toBe('string')
    expect(rundt.function.parameters.properties.viaNavn.type).toBe('string')
    expect(rundt.function.parameters.required).toEqual(['kartId'])
  })

  it('kartverktøyene tar stedsnavn i «sted» og krever ikke koordinater', () => {
    // v4.4.3: modellen gjenbrukte lat/lon fra et annet sted i samtalen, så
    // «Sirikjerke i Øvre Eiker» ga et kart over Stormoen. Nå geokoder appen.
    for (const navn of ['lag_kart', 'foreslaa_nytt_kart']) {
      const t = AI_TOOLS.find((x) => x.function.name === navn)
      expect(t.function.parameters.properties.sted.type, navn).toBe('string')
      expect(t.function.parameters.required, navn).toEqual([])
    }
  })

  it('analyser_stinett er deklarert uten påkrevde argumenter', () => {
    // required: [] med vilje — llama nekter å kalle verktøy der et required-
    // felt må hentes ut av kontekst-JSON-en («function definitions are not
    // comprehensive enough»). losKart faller uansett tilbake til kontekstens
    // kartId når argumentet mangler.
    const t = AI_TOOLS.find((x) => x.function.name === 'analyser_stinett')
    expect(t).toBeDefined()
    expect(t.function.parameters.required).toEqual([])
    expect(t.function.parameters.properties.kartId.type).toBe('string')
    expect(t.function.parameters.properties.minTurKm.type).toBe('number')
  })
})

describe('erStinettSporsmaal', () => {
  it('gjenkjenner stinett-spørsmål på varierte formuleringer', () => {
    for (const sp of [
      'Hvor mange kilometer sti i kartet',
      'Hvor mange kilometer tursti i kartet',
      'hvor mye sti er det her?',
      'Hvor mange km sti er det på Røst?',
      'Hva er den lengste turen jeg kan gå?',
      'lengste sammenhengende stitur?',
      'Hvilken tur er bratteste tur?',
      'analyser stinettet',
    ]) expect(erStinettSporsmaal(sp), sp).toBe(true)
  })
  it('slår ikke inn på andre spørsmål', () => {
    for (const sp of [
      'Hvor høyt er Konnerudkollen?',
      'Lag en rundtur fra parkeringen',
      'Hvor langt er det til Oslo?',
      'Hva heter vannet sør i kartet?',
      '',
    ]) expect(erStinettSporsmaal(sp), sp).toBe(false)
  })
})

describe('stinettSvarTekst', () => {
  it('bygger norsk sammendrag med avrundet total og lengste tur', () => {
    const tekst = stinettSvarTekst({
      kartKm: { bredde: 6.1, hoyde: 11.2 },
      totalStiTekst: 'mer enn 240 km',
      stinett: { totalStiKm: 240 },
      lengsteVandringKm: 11.5,
      treff: 4,
      turer: [{ type: 'AtilB', lengdeKm: 9.2, stigningM: 310 }],
    })
    expect(tekst).toContain('mer enn 240 km turstier')
    expect(tekst).toContain('6,1 × 11,2 km')
    expect(tekst).toContain('11,5 km')
    expect(tekst).toContain('4 turforslag')
    expect(tekst).toContain('9,2 km med 310 m stigning')
  })

  it('takler små nett uten turforslag og uten kartKm', () => {
    const tekst = stinettSvarTekst({
      stinett: { totalStiKm: 9.7 },
      lengsteVandringKm: 1.8,
      treff: 0,
      turer: [],
    })
    expect(tekst).toContain('9,7 km tursti')
    expect(tekst).toContain('minstekravet')
    expect(stinettSvarTekst(null)).toBe('')
  })
})

describe('harOppdiktedeTurtall', () => {
  it('fanger rutetall modellen ikke kan kjenne', () => {
    // Ekte tilfelle: turen ble aldri beregnet, men modellen svarte med tall.
    expect(harOppdiktedeTurtall(
      'Turen er tegnet inn i kartet ditt. Den er 4,7 km lang med 180 høydemeter stigning og en gangtid på 1 time 14 minutter.',
    )).toBe(true)
    expect(harOppdiktedeTurtall('Ruten er 3.2 km.')).toBe(true)
    expect(harOppdiktedeTurtall('Det tar ca 45 min å gå.')).toBe(true)
    expect(harOppdiktedeTurtall('Stigningen er 210 m.')).toBe(true)
  })
  it('godtar bekreftelser uten tall', () => {
    expect(harOppdiktedeTurtall('Jeg åpner kartet og beregner turen nå.')).toBe(false)
    expect(harOppdiktedeTurtall('Turen er sendt til kartet — vil du se den i 3D?')).toBe(false)
    expect(harOppdiktedeTurtall('')).toBe(false)
  })
})

describe('turSvarTekst', () => {
  it('uten forhåndsberegning: ingen tall i det hele tatt', () => {
    const tur = turSvarTekst({ type: 'tur' })
    expect(tur).toContain('beregner turen')
    expect(harOppdiktedeTurtall(tur)).toBe(false)
    expect(turSvarTekst({ type: 'rundtur' })).toContain('rundturen')
    expect(turSvarTekst({ type: 'tur', vis3d: true })).toContain('3D')
  })

  it('med forhåndsberegnet rute: ekte tall i norsk form', () => {
    const tekst = turSvarTekst({
      type: 'tur',
      rute: { lengdeKm: 4.7, stigningM: 180, fallM: 120, gangtidMin: 74 },
    })
    expect(tekst).toContain('4,7 km')
    expect(tekst).toContain('180 høydemeter')
    expect(tekst).toContain('1 t 14 min')
    expect(tekst).toContain('tegnes inn')
  })

  it('tar med snap-merknaden når målet ligger utenfor stinettet', () => {
    const tekst = turSvarTekst({
      rute: { lengdeKm: 3, gangtidMin: 45, snapMerknad: 'Ruten går så nær som stinettet kommer — målet 158 m fra nærmeste sti.' },
    })
    expect(tekst).toContain('158 m')
    expect(tekst).not.toContain('høydemeter')   // uten DEM: ingen påstand om stigning
  })
})

describe('er3dOnske', () => {
  it('godtar alle bestemte former og formuleringer', () => {
    for (const sp of [
      'se ruta i 3D',          // feilet før: modellen dumpet kallet som tekst
      'se ruten i 3D',
      'Vis turen i 3d',
      'kan jeg se løypa i 3-D?',
      'åpne i 3D',
    ]) expect(er3dOnske(sp), sp).toBe(true)
  })
  it('bart «ja» gjelder bare når 3D nettopp ble tilbudt', () => {
    expect(er3dOnske('ja takk', true)).toBe(true)
    expect(er3dOnske('gjerne', true)).toBe(true)
    expect(er3dOnske('ja takk', false)).toBe(false)
  })
  it('rører ikke andre spørsmål', () => {
    for (const sp of ['hvor mange km sti i kartet', 'lag en rundtur', '']) {
      expect(er3dOnske(sp, true), sp).toBe(false)
    }
  })
})

describe('formatGangtid', () => {
  it('under en time i minutter, over i t + min', () => {
    expect(formatGangtid(45)).toBe('45 min')
    expect(formatGangtid(74)).toBe('1 t 14 min')
    expect(formatGangtid(120)).toBe('2 t 00 min')
    expect(formatGangtid(0.2)).toBe('1 min')
  })
})

describe('forhaandsberegnTur', () => {
  // Kart 1×1 km forankret i UTM 32N, med én sti langs y=500 (SVG-meter).
  const META = { minE: 500000, minN: 6600000, widthM: 1000, heightM: 1000 }
  function kartSvg(d = 'M0,500L1000,500') {
    const { document } = parseHTML(
      `<html><body><svg viewBox="0 0 1000 1000">
         <g data-layer="roads" data-iso="505"><path d="${d}"/></g>
       </svg></body></html>`,
    )
    return document.querySelector('svg')
  }
  // SVG-meter → WGS84 → tilbake, så testen bruker samme projeksjon som appen.
  const somWgs84 = (x, y) => svgToWgs84(x, y, META)

  it('beregner ekte lengde og gangtid for A→B', () => {
    const res = forhaandsberegnTur({
      svgEl: kartSvg(), meta: META,
      punkter: [somWgs84(0, 500), somWgs84(1000, 500)],
    })
    expect(res.rute.lengdeKm).toBeCloseTo(1, 1)
    expect(res.rute.gangtidMin).toBeGreaterThan(10)
    expect(res.rute.stigningM).toBeUndefined()   // ingen DEM → ingen påstand
    expect(res.rute.snapMerknad).toBeUndefined()
  })

  it('mål 250 m fra stien (sentroide i et vann): rute + merknad', () => {
    const res = forhaandsberegnTur({
      svgEl: kartSvg(), meta: META,
      punkter: [somWgs84(0, 500), somWgs84(1000, 250)],
    })
    expect(res.rute).toBeDefined()
    expect(res.rute.snapMerknad).toMatch(/målet 250 m/i)
  })

  it('mål 450 m unna: ærlig feil FØR navigering', () => {
    const res = forhaandsberegnTur({
      svgEl: kartSvg(), meta: META,
      punkter: [somWgs84(0, 500), somWgs84(1000, 50)],
    })
    expect(res.feil).toMatch(/i nærheten av målet/i)
    expect(res.rute).toBeUndefined()
  })

  it('kart uten stier: ingenRute (navigerer som før, uten tall)', () => {
    const { document } = parseHTML('<html><body><svg viewBox="0 0 1000 1000"></svg></body></html>')
    const res = forhaandsberegnTur({
      svgEl: document.querySelector('svg'), meta: META,
      punkter: [somWgs84(0, 500), somWgs84(1000, 500)],
    })
    expect(res.ingenRute).toBe(true)
  })
})

describe('toolStatusLabel', () => {
  it('har norsk statuslinje for stinett-analysen', () => {
    expect(toolStatusLabel('analyser_stinett', {})).toBe('Analyserer stinettet …')
  })
})

describe('buildTourQuery', () => {
  it('bygger query som parseTourQuery i MapView leser tilbake', () => {
    const q = buildTourQuery({
      fraLat: 59.7412, fraLon: 10.1934,
      tilLat: 59.7211, tilLon: 10.1533,
      navn: 'Stormoen–Konnerudkollen',
    })
    const tur = parseTourQuery(q)
    expect(tur.origin.lat).toBeCloseTo(59.7412, 4)
    expect(tur.dest.lon).toBeCloseTo(10.1533, 4)
    expect(tur.name).toBe('Stormoen–Konnerudkollen')
  })

  it('åpner 3D kun når vis3d er satt (brukeren må be om det)', () => {
    expect(buildTourQuery({ fraLat: 1, fraLon: 2, tilLat: 3, tilLon: 4 }).v3d).toBeUndefined()
    const q = buildTourQuery({ fraLat: 1, fraLon: 2, tilLat: 3, tilLon: 4, vis3d: true })
    expect(parseTourQuery(q).open3d).toBe(true)
  })

  it('utelater turnavn når det mangler', () => {
    const q = buildTourQuery({ fraLat: 1, fraLon: 2, tilLat: 3, tilLon: 4 })
    expect(q.tn).toBeUndefined()
  })
})

describe('buildRundturQuery', () => {
  it('bygger rundtur-query som parseTourQuery leser tilbake (dest=null, via satt)', () => {
    const q = buildRundturQuery({
      origoLat: 59.7412, origoLon: 10.1934,
      viaLat: 59.7211, viaLon: 10.1533,
      navn: 'Rundtur Konnerudkollen',
    })
    const tur = parseTourQuery(q)
    expect(tur.dest).toBeNull()
    expect(tur.origin.lat).toBeCloseTo(59.7412, 4)
    expect(tur.via).toHaveLength(1)
    expect(tur.via[0].lon).toBeCloseTo(10.1533, 4)
    expect(tur.open3d).toBe(false)
    expect(tur.name).toBe('Rundtur Konnerudkollen')
  })

  it('setter v3d kun når vis3d er sann', () => {
    expect(buildRundturQuery({ origoLat: 1, origoLon: 2, viaLat: 3, viaLon: 4 }).v3d).toBeUndefined()
    expect(buildRundturQuery({ origoLat: 1, origoLon: 2, viaLat: 3, viaLon: 4, vis3d: true }).v3d).toBe('1')
  })
})

describe('buildLagKartQuery', () => {
  it('bygger query som parseShareInvite i MapPickerContent leser, med auto=1', () => {
    const q = buildLagKartQuery({ lat: 59.813746, lon: 10.414616, km: 4, navn: 'Vardåsen' })
    expect(q).toEqual({ lat: '59.81375', lon: '10.41462', km: '4', hl: 'Vardåsen', auto: '1' })
  })

  it('clamper km til 1–16 og defaulter til 4', () => {
    expect(buildLagKartQuery({ lat: 1, lon: 2, km: 99 }).km).toBe('16')
    expect(buildLagKartQuery({ lat: 1, lon: 2, km: 0.2 }).km).toBe('1')
    expect(buildLagKartQuery({ lat: 1, lon: 2 }).km).toBe('4')
  })

  it('utelater hl uten navn og kutter lange navn til 60 tegn', () => {
    expect(buildLagKartQuery({ lat: 1, lon: 2 }).hl).toBeUndefined()
    expect(buildLagKartQuery({ lat: 1, lon: 2, navn: 'x'.repeat(80) }).hl).toHaveLength(60)
  })
})

describe('kmUtenforBbox', () => {
  // Konnerudkollen-aktig kart: ~4×4 km rundt (59.72, 10.15).
  const bbox = { south: 59.702, north: 59.738, west: 10.114, east: 10.186 }

  it('gir 0 for punkter innenfor kartet', () => {
    expect(kmUtenforBbox(bbox, { lat: 59.72, lon: 10.15 })).toBe(0)
    expect(kmUtenforBbox(bbox, { lat: 59.703, lon: 10.185 })).toBe(0)
  })

  it('gir ~km-avstand for punkter utenfor (feil navnebror milevis unna)', () => {
    // ~20 km nord for kartet — som Stormoen-tilfellet.
    const km = kmUtenforBbox(bbox, { lat: 59.918, lon: 10.15 })
    expect(km).toBeGreaterThan(19)
    expect(km).toBeLessThan(21)
  })

  it('tåler manglende bbox og ugyldige punkter (0 = slipp gjennom)', () => {
    expect(kmUtenforBbox(null, { lat: 60, lon: 10 })).toBe(0)
    expect(kmUtenforBbox({ south: 59, north: 60, west: 9, east: 11 }, { lat: NaN, lon: 10 })).toBe(0)
  })
})

describe('bboxAvstandKm', () => {
  const a = { south: 59.70, north: 59.72, west: 10.10, east: 10.14 }
  it('0 for overlappende/berørende bokser (nabofliser i mosaikk)', () => {
    expect(bboxAvstandKm(a, { south: 59.70, north: 59.72, west: 10.14, east: 10.18 })).toBe(0)
    expect(bboxAvstandKm(a, a)).toBe(0)
  })
  it('~km-avstand for adskilte bokser', () => {
    const km = bboxAvstandKm(a, { south: 59.74, north: 59.76, west: 10.10, east: 10.14 })
    expect(km).toBeGreaterThan(1.8)
    expect(km).toBeLessThan(2.6)
  })
})

describe('metaFraSvgEl', () => {
  const fake = (attr) => ({ getAttribute: () => attr })
  it('leser utmBbox-nestet data-meta (mapBuilder-formen)', () => {
    const m = metaFraSvgEl(fake(JSON.stringify({
      utmBbox: { minE: 561000, minN: 6620000 }, widthM: 2044.5, heightM: 2042.3,
    })))
    expect(m).toEqual({ minE: 561000, minN: 6620000, widthM: 2044.5, heightM: 2042.3 })
  })
  it('null ved manglende/ugyldig data-meta', () => {
    expect(metaFraSvgEl(fake(null))).toBeNull()
    expect(metaFraSvgEl(fake('{"widthM":100}'))).toBeNull()
  })
})

describe('kmMellom', () => {
  it('regner luftlinje omtrent riktig (Drammen–Oslo ~35 km)', () => {
    const km = kmMellom({ lat: 59.744, lon: 10.204 }, { lat: 59.913, lon: 10.752 })
    expect(km).toBeGreaterThan(30)
    expect(km).toBeLessThan(40)
  })
})

describe('projectForModel', () => {
  it('projiserer kompakt og tåler hull i data', () => {
    const ut = projectForModel(
      [{ id: 'kart_a', navn: 'Håøya', meta: { widthM: 4200 }, updatedAt: 't1' }, { id: 'kart_b' }],
      [{ id: 'rute_x', navn: 'Finnemarka rundt', createdAt: 't2' }]
    )
    expect(ut.kart[0]).toEqual({ id: 'kart_a', navn: 'Håøya', kmBredde: 4.2, sistEndret: 't1' })
    expect(ut.kart[1].navn).toBe('Uten navn')
    expect(ut.kart[1].kmBredde).toBeNull()
    expect(ut.grusruter[0].sistEndret).toBe('t2')
  })
})

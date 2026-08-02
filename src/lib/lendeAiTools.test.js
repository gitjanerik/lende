import { describe, it, expect } from 'vitest'
import {
  AI_TOOLS, buildTourQuery, buildRundturQuery, buildLagKartQuery, projectForModel,
  kmUtenforBbox, kmMellom, bboxAvstandKm, metaFraSvgEl, toolStatusLabel,
  erStinettSporsmaal,
} from './lendeAiTools.js'
import { parseTourQuery } from './tour3dLink.js'

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

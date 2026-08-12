import { describe, it, expect } from 'vitest'
import {
  stripContourLayers, stripVectorRelief, stripPointSymbols, cleanSvgForTexture,
  textureSourceIsBlank, pickTextureSize, PREVIEW_TEXTURE_PX,
} from './mapTexture.js'

// Speiler mapBuilder-strukturen: kontur-laget har NESTEDE grupper
// (data-iso="101"/"102" + kontur-tall), som knekker non-greedy regex.
const CONTOUR_LAYER =
  '<g data-layer="kontur">' +
  '<g data-iso="101"><path d="M0,0 L1,1"/></g>' +
  '<g data-iso="102"><path d="M2,2 L3,3"/></g>' +
  '<g data-label="kontur-tall"><text x="5" y="5">120</text></g>' +
  '</g>'

const SVG = `<svg viewBox="0 0 100 100"><g data-layer="vann" data-iso="301"><path d="M9,9"/></g>${CONTOUR_LAYER}<g data-layer="skog" data-iso="406"><path d="M4,4"/></g></svg>`

describe('stripContourLayers', () => {
  it('fjerner hele kontur-laget inkl. nestede grupper', () => {
    const out = stripContourLayers(SVG)
    expect(out).not.toContain('data-layer="kontur"')
    expect(out).not.toContain('data-iso="101"')
    expect(out).not.toContain('kontur-tall')
  })

  it('beholder alle andre lag urørt', () => {
    const out = stripContourLayers(SVG)
    expect(out).toContain('data-layer="vann"')
    expect(out).toContain('data-layer="skog"')
    expect(out).toContain('<path d="M9,9"/>')
  })

  it('fjerner flere kontur-lag (nestede flis-SVG-er)', () => {
    const two = `<svg>${CONTOUR_LAYER}<g data-layer="vann"/>${CONTOUR_LAYER}</svg>`
    const out = stripContourLayers(two)
    expect(out).not.toContain('kontur')
    expect(out).toContain('data-layer="vann"')
  })

  it('svg uten kontur-lag passerer uendret', () => {
    const plain = '<svg><g data-layer="vann"><path d="M0,0"/></g></svg>'
    expect(stripContourLayers(plain)).toBe(plain)
  })
})

describe('stripVectorRelief', () => {
  const VECTOR_RELIEF =
    '<g id="hillshade-layer" data-layer="hillshade" opacity="0.6">' +
    '<path d="M0,0 L5,5 Z" fill="#000" fill-opacity="0.1"/>' +
    '<path d="M1,1 L6,6 Z" fill="#000" fill-opacity="0.2"/>' +
    '</g>'
  const RASTER_RELIEF =
    '<image id="hillshade-layer" data-layer="hillshade" href="data:image/png;base64,x" opacity="0.6"/>'

  it('fjerner «Skarp (vektor)»-relieffet (g-variant)', () => {
    const out = stripVectorRelief(`<svg>${VECTOR_RELIEF}<g data-layer="vann"/></svg>`)
    expect(out).not.toContain('hillshade-layer')
    expect(out).toContain('data-layer="vann"')
  })

  it('beholder «Mjuk (bilde)»-relieffet (image-variant)', () => {
    const out = stripVectorRelief(`<svg>${RASTER_RELIEF}</svg>`)
    expect(out).toContain('<image id="hillshade-layer"')
  })

  it('cleanSvgForTexture: vektor-relieff strippes så mykt relieff bakes i stedet', () => {
    const out = cleanSvgForTexture(`<svg>${VECTOR_RELIEF}</svg>`)
    expect(out.includes('id="hillshade-layer"')).toBe(false)
  })
})

describe('stripPointSymbols', () => {
  const SVG =
    '<svg>' +
    '<g data-layer="parkering" data-iso="534">' +
    '<g data-upright="1" data-iso="534u" data-name="Knivåsen Utfartsparkering"><use href="#p-sym"/></g>' +
    '</g>' +
    '<g data-layer="holdeplass" data-iso="560"><g data-upright="1"><use href="#buss-sym"/></g></g>' +
    '<g data-layer="sjo-poi">' +
    '<g data-upright="1" data-iso="554"><use href="#wc-sym"/></g>' +
    '<g data-upright="1" data-iso="553"><use href="#vann-sym"/></g>' +
    '</g>' +
    '<g data-layer="bymasse" data-iso="522"><path d="M0,0 L5,5 Z" fill-rule="evenodd"/></g>' +
    '<g data-layer="skog" data-iso="406"><path d="M1,1"/></g>' +
    '</svg>'

  it('fjerner P-skilt, buss/tog, WC og tett bebyggelse', () => {
    const out = stripPointSymbols(SVG)
    expect(out).not.toContain('parkering')
    expect(out).not.toContain('holdeplass')
    expect(out).not.toContain('data-iso="554"')
    expect(out).not.toContain('bymasse')
  })

  it('beholder andre sjø-POI (drikkevann) og øvrige lag', () => {
    const out = stripPointSymbols(SVG)
    expect(out).toContain('data-iso="553"')
    expect(out).toContain('data-layer="sjo-poi"')
    expect(out).toContain('data-layer="skog"')
  })
})

describe('cleanSvgForTexture', () => {
  it('stripper både runtime-lag og kurver, og sikrer xlink-namespace', () => {
    const s = `<svg viewBox="0 0 10 10"><g id="user-layer"><circle r="1"/></g>${CONTOUR_LAYER}<g data-layer="skog"/></svg>`
    const out = cleanSvgForTexture(s)
    expect(out).not.toContain('user-layer')
    expect(out).not.toContain('kontur')
    expect(out).toContain('data-layer="skog"')
    expect(out).toContain('xmlns:xlink')
  })

  it('runtime-lag med NESTEDE grupper (hydro-stasjoner) fjernes balansert', () => {
    // Regresjon v3.0.27: hydro-laget har <g> per stasjon. Non-greedy regex
    // kuttet ved første </g> → ubalansert XML → blob-rasterisering feilet
    // → grå fallback-tekstur uten kartografi (Grefsenkollen/Maridalsvannet).
    const hydro =
      '<g id="hydro-layer" data-layer="vannstasjon">' +
      '<g data-hydro-station-id="6.10.0"><use href="#hydro-sym"/></g>' +
      '<g data-hydro-station-id="6.11.0"><use href="#hydro-sym"/></g>' +
      '</g>'
    const s = `<svg viewBox="0 0 10 10">${hydro}<g data-layer="skog"><path d="M1,1"/></g></svg>`
    const out = cleanSvgForTexture(s)
    expect(out).not.toContain('hydro')
    expect(out).toContain('data-layer="skog"')
    const opens = (out.match(/<g\b/g) ?? []).length
    const closes = (out.match(/<\/g>/g) ?? []).length
    expect(opens).toBe(closes)
  })
})

describe('textureSourceIsBlank', () => {
  // Nettleseren kan frigjøre backing-store for store lerret når appen ligger i
  // bakgrunnen. Lerretet består, men innholdet er borte — og da lastet three
  // opp en helt gjennomsiktig tekstur, som ble SVART terreng (v5.3.0).
  const fakeCanvas = (alpha) => ({
    width: 512,
    height: 512,
    getContext: () => ({
      getImageData: () => ({ data: [0, 0, 0, alpha] }),
    }),
  })

  it('kjenner igjen et tømt lerret (alt gjennomsiktig)', () => {
    expect(textureSourceIsBlank({ image: fakeCanvas(0) })).toBe(true)
  })

  it('lar et lerret med innhold være i fred', () => {
    expect(textureSourceIsBlank({ image: fakeCanvas(255) })).toBe(false)
  })

  it('svarer nei — aldri gjenoppbygging — når lerretet ikke kan leses', () => {
    // Tainted canvas, manglende 2D-context og tomme dimensjoner skal ikke
    // trigge en unødvendig ombygging av teksturen.
    expect(textureSourceIsBlank({ image: { width: 512, height: 512, getContext: () => { throw new Error('tainted') } } })).toBe(false)
    expect(textureSourceIsBlank({ image: { width: 512, height: 512, getContext: () => null } })).toBe(false)
    expect(textureSourceIsBlank({ image: { width: 0, height: 0 } })).toBe(false)
    expect(textureSourceIsBlank(null)).toBe(false)
    expect(textureSourceIsBlank({})).toBe(false)
  })
})

describe('PREVIEW_TEXTURE_PX', () => {
  it('er mindre enn enhver full teksturstørrelse, så skjerping alltid er et løft', () => {
    expect(PREVIEW_TEXTURE_PX).toBeLessThan(2048)
    expect(PREVIEW_TEXTURE_PX).toBeLessThan(pickTextureSize(null))
  })
})

// ── Nabofliser i en mosaikk ────────────────────────────────────────────────
// Naboflisene merker lagene sine `data-ghost-layer` (useGhostTiles renavner dem
// for å holde dem utenfor 2D-ens lag-queries og perf-regler). Alt 3D-teksturen
// stripper må treffe begge navnene — ellers sto aktiv flis med rene kurver mens
// naboflisene hadde dem bakt inn i bildet, og «Kurver»-knappen styrte bare den
// ene niendedelen av arket (v5.18.0).
describe('mosaikk: naboflisenes lag strippes på lik linje', () => {
  const NABO =
    '<svg x="4000" y="0" width="4000" height="3000">' +
    '<g data-ghost-layer="kontur"><g data-iso="101"><path d="M0,0 L1,1"/></g></g>' +
    '<g data-ghost-layer="parkering" data-iso="534"><use href="#p-sym"/></g>' +
    '<g data-ghost-layer="bymasse" data-iso="522"><path d="M0,0 L5,5 Z"/></g>' +
    '<g data-ghost-relief="1"><path d="M0,0 L9,9" fill="#888"/></g>' +
    '<g data-ghost-layer="skog" data-iso="406"><path d="M1,1"/></g>' +
    '</svg>'
  const ARK = `<svg viewBox="0 0 4000 3000">${NABO}</svg>`

  it('kurver, P-skilt, bymasse og vektor-relieff fjernes også fra naboflisa', () => {
    const out = cleanSvgForTexture(ARK)
    expect(out).not.toContain('data-ghost-layer="kontur"')
    expect(out).not.toContain('data-ghost-layer="parkering"')
    expect(out).not.toContain('data-ghost-layer="bymasse"')
    expect(out).not.toContain('data-ghost-relief')
  })

  it('resten av naboflisa står — den ER kartbildet utenfor aktiv flis', () => {
    const out = cleanSvgForTexture(ARK)
    expect(out).toContain('data-ghost-layer="skog"')
    expect(out).toContain('<svg x="4000"')
  })
})

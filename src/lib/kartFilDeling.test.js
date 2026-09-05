import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { forankringFraSvg, filStorrelseTekst, delEllerLastNedFil } from './kartFilDeling.js'

vi.mock('./printExport.js', () => ({ triggerDownload: vi.fn() }))
import { triggerDownload } from './printExport.js'

const META = {
  utmBbox: { minE: 500000, minN: 6600000, maxE: 508000, maxN: 6608000 },
  widthM: 8000, heightM: 8000,
  bbox: { south: 59.5, west: 10.1, north: 59.6, east: 10.3 },
  equidistance: 20,
}
const svgMed = (meta) =>
  `<svg viewBox="0 0 8000 8000" data-meta='${JSON.stringify(meta)}'><g/></svg>`

describe('forankringFraSvg', () => {
  it('leser utsnittet ut av et lagret ark', () => {
    expect(forankringFraSvg(svgMed(META))).toEqual({
      minE: 500000, minN: 6600000, maxE: 508000, maxN: 6608000,
      widthM: 8000, heightM: 8000, bbox: META.bbox,
    })
  })

  it('tåler &apos; — mapBuilder escaper apostrofer i attributtet', () => {
    const meta = { ...META, source: "Kartverket's WCS" }
    // Nøyaktig samme escaping som mapBuilder skriver attributtet med.
    const attr = JSON.stringify(meta).replace(/'/g, '&apos;')
      .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    const svg = `<svg viewBox="0 0 8000 8000" data-meta='${attr}'><g/></svg>`
    expect(forankringFraSvg(svg)?.widthM).toBe(8000)
  })

  it('gir null når arket mangler forankring', () => {
    expect(forankringFraSvg('<svg viewBox="0 0 1 1"></svg>')).toBeNull()
    expect(forankringFraSvg(svgMed({ utmBbox: META.utmBbox }))).toBeNull()   // uten widthM
    expect(forankringFraSvg('<svg data-meta=\'{ikke json}\'></svg>')).toBeNull()
    expect(forankringFraSvg(null)).toBeNull()
  })

  it('leser bare åpningstaggen — data-meta lenger ned i arket er ikke forankringen', () => {
    const svg = `<svg viewBox="0 0 1 1"><g data-meta='${JSON.stringify(META)}'/></svg>`
    expect(forankringFraSvg(svg)).toBeNull()
  })
})

describe('delEllerLastNedFil', () => {
  const blob = new Blob(['x'], { type: 'application/gzip' })
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { delete globalThis.navigator.share; delete globalThis.navigator.canShare })

  it('laster ned når nettleseren ikke kan dele filer', async () => {
    expect(await delEllerLastNedFil(blob, 'a.lendekart')).toBe('lastet-ned')
    expect(triggerDownload).toHaveBeenCalledWith(blob, 'a.lendekart')
  })

  it('bruker delings-arket når det finnes', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined)
    navigator.canShare = vi.fn().mockReturnValue(true)
    expect(await delEllerLastNedFil(blob, 'a.lendekart')).toBe('delt')
    expect(triggerDownload).not.toHaveBeenCalled()
  })

  it('avbrutt deling laster IKKE ned — brukeren lukket arket med vilje', async () => {
    const abort = Object.assign(new Error('avbrutt'), { name: 'AbortError' })
    navigator.share = vi.fn().mockRejectedValue(abort)
    navigator.canShare = vi.fn().mockReturnValue(true)
    expect(await delEllerLastNedFil(blob, 'a.lendekart')).toBe('avbrutt')
    expect(triggerDownload).not.toHaveBeenCalled()
  })

  it('annen delingsfeil faller tilbake til nedlasting', async () => {
    navigator.share = vi.fn().mockRejectedValue(new Error('nei'))
    navigator.canShare = vi.fn().mockReturnValue(true)
    expect(await delEllerLastNedFil(blob, 'a.lendekart')).toBe('lastet-ned')
    expect(triggerDownload).toHaveBeenCalled()
  })
})

describe('filStorrelseTekst', () => {
  it('kB under én MB, ellers MB med én desimal', () => {
    expect(filStorrelseTekst(4096)).toBe('4 kB')
    expect(filStorrelseTekst(3.25 * 1024 * 1024)).toBe('3.3 MB')
  })
})

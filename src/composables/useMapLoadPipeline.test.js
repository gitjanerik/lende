import { describe, it, expect, vi, afterEach } from 'vitest'
import { DOMParser } from 'linkedom'
import { metaFromSvgMeta, META_BEVISST_UTELATT, useMapLoadPipeline } from './useMapLoadPipeline.js'
import { buildSvg } from '../lib/mapBuilder.js'

// Hvitelisten i metaFromSvgMeta har bitt oss fire ganger: appVersion og
// nveInnsjoStatus (v1.0.45/47), tetthet + detaljNivaa (v5.0.0) og
// turruteStatus (v5.0.2). Symptomet er alltid det samme, og ser ut som et
// databaseproblem i stedet for en kodefeil: Utvikler-fanen viser «ingen
// status» / tom linje på ALLE kart, også splitter ferske. Testene under er
// vaktposten — særlig den første, som fanger NESTE felt automatisk.

const BBOX = { south: 59.830, west: 10.055, north: 59.848, east: 10.110 }

function ekteMeta() {
  return buildSvg([], BBOX, { scaleDenom: 10000 }).meta
}

describe('metaFromSvgMeta — hvitelisten', () => {
  it('slipper gjennom ALLE felter buildSvg faktisk sender, eller erklærer dem utelatt', () => {
    const raw = ekteMeta()
    const ut = metaFromSvgMeta(raw)
    const glemt = Object.keys(raw).filter(
      k => !(k in ut) && !META_BEVISST_UTELATT.includes(k),
    )
    expect(glemt,
      `Nye meta-felter fra buildSvg må enten inn i metaFromSvgMeta eller i ` +
      `META_BEVISST_UTELATT. Glemt: ${glemt.join(', ')}`,
    ).toEqual([])
  })

  it('erklærer ikke felter som utelatt uten at buildSvg sender dem', () => {
    // Holder META_BEVISST_UTELATT ærlig: et felt som er fjernet fra buildSvg
    // skal ut av lista, ellers skjuler den seg selv mot testen over.
    const nøkler = Object.keys(ekteMeta())
    for (const k of META_BEVISST_UTELATT) expect(nøkler).toContain(k)
  })

  it('pakker ut utmBbox til minE/minN/maxE/maxN', () => {
    const ut = metaFromSvgMeta(ekteMeta())
    for (const k of ['minE', 'minN', 'maxE', 'maxN']) expect(ut[k]).toBeTypeOf('number')
  })
})

describe('metaFromSvgMeta — diagnose-feltene Utvikler-fanen leser', () => {
  const DIAGNOSE = [
    'appVersion', 'nveInnsjoStatus', 'sjokartStatus', 'turruteStatus',
    'tetthet', 'detaljNivaa', 'coastal', 'demSource', 'demResolutionM', 'depthSource',
  ]

  it('bevarer verdiene i stedet for å strippe dem til null', () => {
    const raw = {
      ...ekteMeta(),
      appVersion: '5.0.3',
      nveInnsjoStatus: { state: 'ok', features: 12 },
      sjokartStatus: { state: 'innlands' },
      turruteStatus: { state: 'ok', ruter: 8, nye: 4 },
      tetthet: { indeks: 255, klasse: 'middels', fraBreddeKm: 8, tilBreddeKm: 8 },
      detaljNivaa: 'lett',
    }
    const ut = metaFromSvgMeta(raw)
    expect(ut.appVersion).toBe('5.0.3')
    expect(ut.nveInnsjoStatus).toEqual({ state: 'ok', features: 12 })
    expect(ut.turruteStatus).toEqual({ state: 'ok', ruter: 8, nye: 4 })
    expect(ut.tetthet).toEqual({ indeks: 255, klasse: 'middels', fraBreddeKm: 8, tilBreddeKm: 8 })
    expect(ut.detaljNivaa).toBe('lett')
  })

  it('gir null (ikke undefined) for eldre kart som mangler feltene', () => {
    // Eldre kart har ikke feltene i data-meta. Utvikler-fanen skiller på
    // null → «bygd før vX; bygg på nytt», så undefined ville vært en annen bug.
    const raw = ekteMeta()
    for (const k of DIAGNOSE) delete raw[k]
    const ut = metaFromSvgMeta(raw)
    for (const k of DIAGNOSE) {
      expect(ut[k], `${k} skal være null, ikke undefined`).toBeNull()
    }
  })

  it('turruteStatus overlever hele veien fra buildSvg til meta (v5.0.3)', () => {
    // Regresjonen brukeren meldte: appen var på v5.0.2, kartet nybygget, og
    // Utvikler-fanen sa likevel «kartet er bygd før v5.0.2».
    const status = { state: 'ok', ruter: 8, nye: 4 }
    const { meta } = buildSvg([], BBOX, { scaleDenom: 10000, turruteStatus: status })
    expect(meta.turruteStatus).toEqual(status)
    expect(metaFromSvgMeta(meta).turruteStatus).toEqual(status)
  })
})

/**
 * Hentingen av det INNEBYGDE kartet, målt uten nett.
 *
 * Grepene i `fetchBuiltinSvg` — `cache: 'reload'` og en `?v=`-URL på forsøk to —
 * finnes for å komme forbi en gammel stale-while-revalidate-service-worker som
 * kunne svare med en avkuttet kopi. Uten nett peker begge bort fra de eneste
 * kildene som KAN svare: den bustede URL-en har hverken kart-cachen eller
 * HTTP-cachen sett, og `reload` går forbi dem begge. Demokartet er nettopp det
 * ene kartet som skal virke i flymodus, så begge retningene holdes fast her —
 * en forgrening som ser ut som en dublett er lett å «rydde» bort.
 */
// Node har ingen DOMParser; linkedom er samme shim mcp/headless.js bruker.
vi.stubGlobal('DOMParser', DOMParser)
vi.stubGlobal('navigator', { onLine: true })

const BYGD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" data-meta="{}"></svg>'

function settOnline(verdi) {
  globalThis.navigator.onLine = verdi
}

describe('fetchBuiltinSvg', () => {
  afterEach(() => { settOnline(true) })

  it('spør uten cache-busting og uten reload når nettleseren vet vi er offline', async () => {
    settOnline(false)
    const kall = []
    vi.stubGlobal('fetch', vi.fn(async (url, opt) => {
      kall.push({ url, cache: opt?.cache })
      return { ok: true, text: async () => BYGD_SVG }
    }))
    const { fetchBuiltinSvg } = useMapLoadPipeline({})
    expect(await fetchBuiltinSvg('vardasen.svg')).toBe(BYGD_SVG)
    expect(kall).toHaveLength(1)
    expect(kall[0].url).not.toContain('?v=')
    expect(kall[0].cache).toBe('force-cache')
  })

  it('gir opp etter ETT forsøk offline — de to andre kan ikke svare', async () => {
    settOnline(false)
    const f = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    vi.stubGlobal('fetch', f)
    const { fetchBuiltinSvg } = useMapLoadPipeline({})
    await expect(fetchBuiltinSvg('vardasen.svg')).rejects.toThrow()
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('beholder reload og cache-busting når vi er på nett', async () => {
    settOnline(true)
    const kall = []
    vi.stubGlobal('fetch', vi.fn(async (url, opt) => {
      kall.push({ url, cache: opt?.cache })
      // Første svar er en avkuttet kopi, slik en gammel SWR-service-worker ga.
      if (kall.length === 1) return { ok: true, text: async () => '<svg></svg>' }
      return { ok: true, text: async () => BYGD_SVG }
    }))
    const { fetchBuiltinSvg } = useMapLoadPipeline({})
    expect(await fetchBuiltinSvg('vardasen.svg')).toBe(BYGD_SVG)
    expect(kall).toHaveLength(2)
    expect(kall[0].cache).toBe('reload')
    expect(kall[1].url).toContain('?v=')
  })
})

import { describe, it, expect } from 'vitest'
import { metaFromSvgMeta, META_BEVISST_UTELATT } from './useMapLoadPipeline.js'
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

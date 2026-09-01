import { describe, it, expect } from 'vitest'
import { erKartKilde, nokkelFra, NOKKEL_VERSJON } from './kartcache-nokkel.mjs'

// Nøkkelen avgjør om røyktesten kjører mot et FERSKT kart eller et lagret. Går
// den til feil side, går det galt begge veier: for smal, og de sju
// ektekart-sjekkene måler et ark bygget av kode som ikke finnes lenger; for
// bred, og cachen bommer på nettopp 3D-PR-ene den er laget for.

const rad = (sha, fil) => `100644 ${sha} 0\t${fil}`

describe('erKartKilde', () => {
  it('tar med det kartet faktisk bygges av', () => {
    expect(erKartKilde('scripts/build-vardasen-svg.js')).toBe(true)
    expect(erKartKilde('src/lib/mapBuilder.js')).toBe(true)
    expect(erKartKilde('src/lib/isomCatalog.json')).toBe(true)
    expect(erKartKilde('src/lib/symbolizer.js')).toBe(true)
    // polygon-clipping kan flytte en kystlinje.
    expect(erKartKilde('package-lock.json')).toBe(true)
  })

  it('HOLDER 3D-MOTOREN UTE — den leser kartet, den lager det ikke', () => {
    // Dette er hele grunnen til at cachen er verdt noe: ektekart-sjekkene er i
    // hovedsak 3D, så en nøkkel som tok med tour3d ville bommet på hver eneste
    // kjøring som faktisk hadde nytte av den.
    expect(erKartKilde('src/lib/tour3d/freeRig.js')).toBe(false)
    expect(erKartKilde('src/lib/tour3d/scene3d.js')).toBe(false)
  })

  it('holder tester, komponenter og views ute', () => {
    expect(erKartKilde('src/lib/mapBuilder.test.js')).toBe(false)
    expect(erKartKilde('src/views/MapView.vue')).toBe(false)
    expect(erKartKilde('src/components/MapModeChips.vue')).toBe(false)
    expect(erKartKilde('CHANGELOG.md')).toBe(false)
    expect(erKartKilde('')).toBe(false)
  })
})

describe('nokkelFra', () => {
  const grunn = [
    rad('aaa1', 'src/lib/mapBuilder.js'),
    rad('bbb2', 'src/lib/tour3d/freeRig.js'),
    rad('ccc3', 'src/views/MapView.vue'),
  ]

  it('endrer seg når kart-pipelinen endrer seg', () => {
    const etter = [rad('aaa9', 'src/lib/mapBuilder.js'), ...grunn.slice(1)]
    expect(nokkelFra(etter)).not.toBe(nokkelFra(grunn))
  })

  it('står stille når BARE 3D eller et view endrer seg', () => {
    const etter = [
      rad('aaa1', 'src/lib/mapBuilder.js'),
      rad('bbb9', 'src/lib/tour3d/freeRig.js'),
      rad('ccc9', 'src/views/MapView.vue'),
    ]
    expect(nokkelFra(etter)).toBe(nokkelFra(grunn))
  })

  it('er uavhengig av rekkefølgen git leverer i', () => {
    expect(nokkelFra([...grunn].reverse())).toBe(nokkelFra(grunn))
  })

  it('endrer seg når en fil KOMMER TIL, ikke bare når en endres', () => {
    expect(nokkelFra([...grunn, rad('ddd4', 'src/lib/nyKilde.js')]))
      .not.toBe(nokkelFra(grunn))
  })

  it('bærer versjonssaltet, så en bake kan tvinges uten å røre en kildefil', () => {
    expect(nokkelFra(grunn)).toContain(`-v${NOKKEL_VERSJON}-`)
  })

  it('tåler tomme og oppstykkede linjer', () => {
    expect(() => nokkelFra(['', '   ', 'bare-en-kolonne'])).not.toThrow()
  })
})

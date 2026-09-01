import { describe, it, expect } from 'vitest'
import { erKartKilde, nokkelFra, laasDigest, NOKKEL_VERSJON } from './kartcache-nokkel.mjs'

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
    // package-lock går sin egen vei — se laasDigest.
    expect(erKartKilde('package-lock.json')).toBe(false)
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


describe('laasDigest — avhengighetene teller, appens egen versjon gjør ikke', () => {
  const laas = (v, dep) => JSON.stringify({
    name: 'lende', version: v, lockfileVersion: 3,
    packages: { '': { name: 'lende', version: v }, 'node_modules/polygon-clipping': { version: dep } },
  })

  it('STÅR STILLE når bare appens versjon bumpes', () => {
    // Dette er den ene tingen som gjør cachen verdt noe: prosjektet bumper
    // versjonen i HVER PR, så en nøkkel som fulgte den ville aldri truffet.
    // Målt i PR-en som innførte cachen — samme filtall, ny hash, uten at én
    // kartkilde var rørt.
    expect(laasDigest(laas('6.5.24', '0.15.7'))).toBe(laasDigest(laas('6.5.23', '0.15.7')))
  })

  it('endrer seg når en avhengighet bumpes', () => {
    // polygon-clipping er eneste tredjeparts geometri-bibliotek: en bump der
    // kan flytte en kystlinje, og da skal kartet bygges på nytt.
    expect(laasDigest(laas('6.5.24', '0.15.8'))).not.toBe(laasDigest(laas('6.5.24', '0.15.7')))
  })

  it('tåler tull uten å kaste', () => {
    expect(laasDigest('')).toBe('')
    expect(laasDigest('{ ikke json')).toBe('')
    expect(laasDigest('null')).toBe('')
  })

  it('slår gjennom i nøkkelen', () => {
    const rader = ['100644 aaa1 0\tsrc/lib/mapBuilder.js']
    expect(nokkelFra(rader, 'abc')).not.toBe(nokkelFra(rader, 'def'))
  })
})

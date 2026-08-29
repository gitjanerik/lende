import { describe, it, expect } from 'vitest'
import { trengerEktekart } from './trenger-ektekart.mjs'

// Gaten bestemmer om røyktesten bygger et ekte Vardåsen-kart (~2 min) eller
// kjører mot demo-kartet. Feiler den til FEIL side, hopper sju sjekker stille
// over — derfor testes begge retningene, og særlig at ukjente stier faller til
// den dyre siden.

const ekte = (filer) => trengerEktekart(filer).ekte

describe('trengerEktekart — må-lista', () => {
  it('kart-pipelinen krever ekte kart', () => {
    expect(ekte(['src/lib/mapBuilder.js'])).toBe(true)
    expect(ekte(['src/lib/createMapFlow.js'])).toBe(true)
    expect(ekte(['src/lib/tour3d/vaerHimmel.js'])).toBe(true)
  })
  it('MapView komponerer alle sju domenene', () => {
    expect(ekte(['src/views/MapView.vue'])).toBe(true)
  })
  it('de seks composable-ene de sju sjekkene trykker på', () => {
    for (const f of ['useNavnLod', 'useViewportCull', 'useGhostTiles',
                     'useKartSok', 'useKartEksport', 'useGestPerf']) {
      expect(ekte([`src/composables/${f}.js`]), f).toBe(true)
    }
  })
  it('3D-komponentene (vær-sjekken)', () => {
    expect(ekte(['src/components/tour3d/Viewer3D.vue'])).toBe(true)
  })
  it('testen og kart-byggeren selv', () => {
    expect(ekte(['scripts/royk-mapview.mjs'])).toBe(true)
    expect(ekte(['scripts/build-vardasen-svg.js'])).toBe(true)
    expect(ekte(['scripts/trenger-ektekart.mjs'])).toBe(true)
  })
})

describe('trengerEktekart — trygg uten', () => {
  it('composables uten en ektekart-sjekk', () => {
    expect(ekte(['src/composables/useMaaling.js'])).toBe(false)
    expect(ekte(['src/composables/useMapExtend.js'])).toBe(false)
  })
  it('vanlige komponenter', () => {
    expect(ekte(['src/components/MapEdgeHandles.vue'])).toBe(false)
    expect(ekte(['src/components/drawer/DrawerAboutTab.vue'])).toBe(false)
  })
  it('ruting, workflows, versjonsfiler', () => {
    expect(ekte(['src/router.js'])).toBe(false)
    expect(ekte(['.github/workflows/royktest.yml'])).toBe(false)
    expect(ekte(['package.json', 'package-lock.json', 'src/version.js',
                 'public/sw.js', 'CHANGELOG.md'])).toBe(false)
  })
})

describe('trengerEktekart — faller til den dyre siden når den er i tvil', () => {
  it('en ukjent sti er ikke trygg', () => {
    expect(ekte(['src/nytt-domene/hva-er-dette.js'])).toBe(true)
    expect(trengerEktekart(['src/nytt-domene/x.js']).grunn).toMatch(/ukjent/)
  })
  it('tom liste (kunne ikke måle diffen) → ekte kart', () => {
    expect(ekte([])).toBe(true)
    expect(ekte(['', '  '])).toBe(true)
  })
  it('én må-fil blant mange trygge vinner', () => {
    expect(ekte(['CHANGELOG.md', 'package.json', 'src/lib/dem.js'])).toBe(true)
  })
  it('tour3d-komponenter er unntaket fra at komponenter er trygge', () => {
    // Rekkefølgen i trengerEktekart er signifikant: må-lista sjekkes FØRST, så
    // `^src/components/` i trygg-lista ikke stjeler tour3d-treffet.
    expect(ekte(['src/components/tour3d/Tour3dPinPanel.vue'])).toBe(true)
    expect(ekte(['src/components/MapModeChips.vue'])).toBe(false)
  })
})

// Fritt lende (v6.5.0). Røyk-sjekkene for modusen ligger i ruter-royk og seeder
// sitt eget ark i IndexedDB, så de trenger verken Kartverket eller demokartet.
describe('Fritt lende', () => {
  it('viewen og knappen klarer seg uten ekte kart', () => {
    expect(trengerEktekart(['src/views/FrittLendeView.vue']).ekte).toBe(false)
    expect(trengerEktekart(['src/components/FrittLendeKnapp.vue']).ekte).toBe(false)
  })

  // lib/ er og blir dyr side — kart-pipelinen bor der.
  it('men lib/frittLende.js krever ekte kart som resten av lib', () => {
    expect(trengerEktekart(['src/lib/frittLende.js']).ekte).toBe(true)
  })

  it('en typisk modus-PR slipper unna med demokartet', () => {
    expect(trengerEktekart([
      'src/views/FrittLendeView.vue',
      'src/components/FrittLendeKnapp.vue',
      'src/router.js',
      'scripts/ruter-royk.mjs',
    ]).ekte).toBe(false)
  })
})

// BOKS-GJETNINGEN NÅR ET NAVN ER SKJULT VED MÅLETID (v7.8.28).
//
// `measureLabelBoxes` måler hvert navn ÉN gang per kart, og stedsnavn-lagene
// ligger `display:none` i arket til Kartlag-fana slår dem på. `getBBox()` er da
// 0 × 0, og den gamle gjetningen — navnelengde × 4 i bredden, 6 i høyden — var
// så mye mindre enn den ekte boksen at navnet ikke rørte snarvei-radens
// hindring. Symptomet fra felt: «Grend / gård» ble stående og lese tvers
// gjennom knappeteksten mens alt annet vek.
//
// Testen ankrer gjetningen i KATALOGENS egne millimeter, for det er der tallene
// kommer fra. Feilen den finnes for er stille: en for liten boks ser ut som at
// «declutteren bare valgte det navnet».
import { describe, it, expect } from 'vitest'
import { gjettetBoks } from './useNavnLod.js'
import { isomCatalog } from '../lib/symbolizer.js'

// mm er en CSS-absolutt enhet, og inne i viewBoxen er 1 CSS-px = 1 user-unit.
const px = (mm) => mm * 96 / 25.4

// Fra symbolizer.js: stedsnavn er 4,8 (grend/gård) / 5,8 / 7,2 mm.
const GREND_MM = 4.8
const NAVN = 'Nordre Sæter'   // 12 tegn — et helt vanlig grend-navn

describe('gjettetBoks', () => {
  it('høyden ER skriftstørrelsen, ikke en konstant', () => {
    expect(gjettetBoks(px(GREND_MM), NAVN.length).bh).toBeCloseTo(px(GREND_MM), 3)
  })

  it('et grend-navn får en boks som ligner den ekte, ikke den gamle på 6 × 48', () => {
    const b = gjettetBoks(px(GREND_MM), NAVN.length)
    // Gammel gjetning: bw = maks(8, 12 × 4) = 48, bh = 6.
    expect(b.bh).toBeGreaterThan(3 * 6)
    expect(b.bw).toBeGreaterThan(2 * 48)
  })

  it('bredden vokser med både skrift og tekstlengde', () => {
    const liten = gjettetBoks(px(3), 5)
    expect(gjettetBoks(px(3), 10).bw).toBeCloseTo(2 * liten.bw, 6)
    expect(gjettetBoks(px(6), 5).bw).toBeCloseTo(2 * liten.bw, 6)
  })

  it('en uleselig skriftstørrelse faller tilbake på områdenavnets, ikke på null', () => {
    // `getComputedStyle` finnes ikke i alle miljøer (test, SSR), og en boks på
    // null ville vært en hindringstest som alltid svarer nei.
    const omrade = px(isomCatalog.labels['omrade-navn'].fontSizeMm)
    for (const ugyldig of [0, NaN, undefined, -3]) {
      const b = gjettetBoks(ugyldig, NAVN.length)
      expect(b.bh).toBeGreaterThan(0.8 * omrade)
      expect(b.bh).toBeLessThan(1.3 * omrade)
    }
  })

  it('tom tekst gir likevel en boks med utstrekning', () => {
    const b = gjettetBoks(px(GREND_MM), 0)
    expect(b.bw).toBeGreaterThan(0)
    expect(b.bh).toBeGreaterThan(0)
  })
})

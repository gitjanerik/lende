import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useFloatAboveSheets, FAB_NEED_PX } from './useFloatAboveSheets.js'

const BASE = 'calc(env(safe-area-inset-bottom, 0px) + 12px)'

/** Minimalt stub av et useDraggableDrawer-objekt. */
function sheet(peek, visible, open = true) {
  return {
    open: ref(open),
    drawer: { minimizedPeek: ref(peek), visibleHeightPx: ref(visible) },
  }
}

describe('useFloatAboveSheets', () => {
  it('fast nederst med safe-area når ingen ark er åpne', () => {
    const { bottomStyle, hidden } = useFloatAboveSheets([sheet(76, 400, false)])
    expect(bottomStyle.value).toBe(BASE)
    expect(hidden.value).toBe(false)
  })

  it('dokker rett over peek-kanten uten safe-area', () => {
    const { bottomStyle, hidden } = useFloatAboveSheets([sheet(76, 76)])
    expect(bottomStyle.value).toBe('88px')
    expect(hidden.value).toBe(false)
  })

  it('dokker fortsatt innenfor slarken', () => {
    const { bottomStyle, hidden } = useFloatAboveSheets([sheet(76, 83)])
    expect(bottomStyle.value).toBe('95px')
    expect(hidden.value).toBe(false)
  })

  it('skjules så snart arket dras forbi peek', () => {
    const { hidden } = useFloatAboveSheets([sheet(76, 120)])
    expect(hidden.value).toBe(true)
  })

  it('skjules ved åpent (45 dvh) og maksimert ark', () => {
    expect(useFloatAboveSheets([sheet(76, 351)]).hidden.value).toBe(true)
    expect(useFloatAboveSheets([sheet(76, 744)]).hidden.value).toBe(true)
  })

  it('turkartets 138 px-peek gir 150 px', () => {
    expect(useFloatAboveSheets([sheet(138, 138)]).bottomStyle.value).toBe('150px')
  })

  it('følger draget kontinuerlig: peek → dokket, oppover → skjult', () => {
    const s = sheet(76, 76)
    const { bottomStyle, hidden } = useFloatAboveSheets([s])
    expect(hidden.value).toBe(false)
    s.drawer.visibleHeightPx.value = 200
    expect(hidden.value).toBe(true)
    s.drawer.visibleHeightPx.value = 76
    expect(hidden.value).toBe(false)
    expect(bottomStyle.value).toBe('88px')
  })

  it('reagerer når et ark åpnes og lukkes', () => {
    const s = sheet(76, 400, false)
    const { hidden, bottomStyle } = useFloatAboveSheets([s])
    expect(bottomStyle.value).toBe(BASE)
    s.open.value = true
    expect(hidden.value).toBe(true)
    s.open.value = false
    expect(hidden.value).toBe(false)
    expect(bottomStyle.value).toBe(BASE)
  })

  // Gjensidig utelukkelse mellom arkene håndheves ad hoc i MapView, og
  // hjelpe-arkene er ikke med i det nettet — derfor max() over alle åpne.
  it('tar det høyeste av flere åpne ark på peek', () => {
    const { bottomStyle } = useFloatAboveSheets([sheet(76, 76), sheet(138, 138)])
    expect(bottomStyle.value).toBe('150px')
  })

  it('ett åpent ark blant flere på peek skjuler likevel', () => {
    const { hidden } = useFloatAboveSheets([sheet(76, 76), sheet(138, 400)])
    expect(hidden.value).toBe(true)
  })

  it('ignorerer ark som ikke er åpne', () => {
    const { hidden, bottomStyle } = useFloatAboveSheets([
      sheet(76, 76),
      sheet(138, 700, false),
    ])
    expect(hidden.value).toBe(false)
    expect(bottomStyle.value).toBe('88px')
  })

  it('roomy: bredt kart gir fast bunn og ingen skjuling', () => {
    // 700 px ark + 2 × 132 px marg = 964 px er grensen.
    const wide = useFloatAboveSheets([sheet(76, 400)], { mapWidthPx: 1000 })
    expect(wide.roomy.value).toBe(true)
    expect(wide.hidden.value).toBe(false)
    expect(wide.bottomStyle.value).toBe(BASE)

    const narrow = useFloatAboveSheets([sheet(76, 400)], { mapWidthPx: 900 })
    expect(narrow.roomy.value).toBe(false)
    expect(narrow.hidden.value).toBe(true)
  })

  it('roomy-grensen ligger på 700 + 2 × needPx', () => {
    const exact = 700 + 2 * FAB_NEED_PX
    expect(useFloatAboveSheets([], { mapWidthPx: exact }).roomy.value).toBe(true)
    expect(useFloatAboveSheets([], { mapWidthPx: exact - 2 }).roomy.value).toBe(false)
  })

  it('panelMode: sidepanel er ikke et ark — fast bunn, aldri skjult', () => {
    const { bottomStyle, hidden } = useFloatAboveSheets([sheet(138, 500)], {
      panelMode: ref(true),
    })
    expect(bottomStyle.value).toBe(BASE)
    expect(hidden.value).toBe(false)
  })

  it('godtar getter og rå boolean for open', () => {
    const a = useFloatAboveSheets([{ open: () => true, drawer: { minimizedPeek: 76, visibleHeightPx: 76 } }])
    expect(a.bottomStyle.value).toBe('88px')
    const b = useFloatAboveSheets([{ open: true, drawer: { minimizedPeek: 76, visibleHeightPx: 400 } }])
    expect(b.hidden.value).toBe(true)
  })

  it('respekterer egendefinert basePx', () => {
    const { bottomStyle } = useFloatAboveSheets([sheet(76, 76)], { basePx: 4 })
    expect(bottomStyle.value).toBe('80px')
  })
})

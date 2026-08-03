import { computed, unref } from 'vue'

/** Bredden på .drawer-shell (style.css) — arket er midtstilt og maks så bredt. */
export const DRAWER_MAX_W = 700

/**
 * Plassen FAB-klyngen trenger målt fra høyre kant:
 * 12 (right-3) + 48 (ankeret) + 64 (vest-knottens rekkevidde) + 8 (klaring).
 */
export const FAB_NEED_PX = 132

/** Slark på peek-sammenligningen, så et ark i ro alltid leses som «på peek». */
export const PEEK_SLACK_PX = 8

const val = (v) => (typeof v === 'function' ? v() : unref(v))

/**
 * Én regel for hvor et flytende element nede til høyre står i forhold til
 * bunn-arkene (v4.8.2):
 *
 *   Ingen ark åpne      → fast nederst, med safe-area.
 *   Ark minimert (peek) → rett over peek-kanten, UTEN safe-area (arket dekker
 *                         den alt — legger man til begge, flyter knappen høyt).
 *   Ark åpent/maksimert → skjult.
 *
 * Elementet får dermed bare to posisjoner og vandrer aldri med draget.
 *
 * Tilstanden avledes fra `visibleHeightPx` (kontinuerlig), ikke fra
 * `isMinimized` — den settes bare ved snap, så knappen ville ligget under
 * arket gjennom hele draget.
 *
 * To unntak gir alltid fast bunn og aldri skjuling:
 *   - `roomy`: er kartet bredt nok til at det står ≥ needPx synlig kart ved
 *     siden av det 700 px brede arket, kolliderer de ikke i det hele tatt.
 *   - `panelMode`: på desktop er turkartets skuff et sidepanel, ikke et ark.
 *
 * @param {Array<{open: any, drawer: object}>|object} sheets  ark å vike for;
 *        `open` kan være ref, getter eller boolean, `drawer` et
 *        useDraggableDrawer-objekt.
 * @param {object} opts
 * @param {number} opts.basePx      avstand fra ankeret (px)
 * @param {number} opts.needPx      bredde elementet trenger i kartmargen
 * @param {any}    opts.mapWidthPx  kartflatens bredde (ref/getter/tall)
 * @param {any}    opts.panelMode   true → arkene finnes ikke (sidepanel)
 */
export function useFloatAboveSheets(sheets, opts = {}) {
  const { basePx = 12, needPx = FAB_NEED_PX, mapWidthPx = null, panelMode = null } = opts

  const baseBottom = `calc(env(safe-area-inset-bottom, 0px) + ${basePx}px)`

  const openSheets = computed(() =>
    (val(sheets) || []).filter((s) => s && s.drawer && !!val(s.open))
  )

  const roomy = computed(() => {
    const w = val(mapWidthPx)
    if (!w) return false
    return Math.max(0, (w - DRAWER_MAX_W) / 2) >= needPx
  })

  /** true når arkene ikke kan nå elementet, uansett høyde. */
  const clear = computed(() => !!val(panelMode) || roomy.value)

  /**
   * Høyden å dokke over: største synlige ark-høyde når ALLE åpne ark står på
   * peek. `null` betyr at minst ett ark er dratt opp → elementet skjules.
   */
  const dockedPx = computed(() => {
    let tallest = 0
    for (const s of openSheets.value) {
      const visible = val(s.drawer.visibleHeightPx) || 0
      const peek = val(s.drawer.minimizedPeek) || 0
      if (visible > peek + PEEK_SLACK_PX) return null
      if (visible > tallest) tallest = visible
    }
    return tallest
  })

  const hidden = computed(() =>
    !clear.value && openSheets.value.length > 0 && dockedPx.value === null
  )

  const bottomStyle = computed(() => {
    if (clear.value) return baseBottom
    const docked = dockedPx.value
    if (!docked) return baseBottom
    return `${docked + basePx}px`
  })

  return { bottomStyle, hidden, roomy }
}

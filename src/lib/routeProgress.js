// Fremdrift langs en fulgt rute: prosjekter brukerens posisjon på rute-
// polylinjen og regn ut hvor langt hun har kommet / har igjen. SVG-rommet er
// i meter (viewBox), så all avstand er ekte meter.
//
// Rundtur-tvetydigheten: start == mål, så et punkt nær origo prosjekterer like
// godt til along ≈ 0 (uttur) som along ≈ totalM (hjemtur). Løses med et
// monotont anker: caller sender inn forrige along-verdi (`prevAlongM`), og vi
// foretrekker kandidater i vinduet [prev − backtrackM, prev + aheadM] så lenge
// de er rimelig nær ruta. Første kall seedes med prevAlongM = 0 → fremdriften
// starter på 0, ikke på full runde.

/**
 * @param {Array<[number,number]>} coords rute-polylinje i SVG-meter
 * @param {number} x brukerposisjon (SVG-meter)
 * @param {number} y
 * @param {{prevAlongM?: number|null, backtrackM?: number, aheadM?: number, windowOffLimitM?: number}} opts
 * @returns {{alongM: number, remainingM: number, offRouteM: number, totalM: number} | null}
 */
export function routeProgress(coords, x, y, opts = {}) {
  const { prevAlongM = null, backtrackM = 150, aheadM = 800, windowOffLimitM = 100 } = opts
  if (!Array.isArray(coords) || coords.length < 2) return null

  let cum = 0
  let best = null        // global beste kandidat
  let windowed = null    // beste kandidat innenfor det monotone vinduet
  const lo = prevAlongM != null ? prevAlongM - backtrackM : null
  const hi = prevAlongM != null ? prevAlongM + aheadM : null

  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = coords[i - 1]
    const [bx, by] = coords[i]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const segLen = Math.sqrt(len2)
    let t = len2 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const offM = Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
    const alongM = cum + t * segLen

    if (!best || offM < best.offM) best = { alongM, offM }
    if (lo != null && alongM >= lo && alongM <= hi &&
        offM <= windowOffLimitM && (!windowed || offM < windowed.offM)) {
      windowed = { alongM, offM }
    }
    cum += segLen
  }

  const pick = windowed || best
  return {
    alongM: pick.alongM,
    remainingM: Math.max(0, cum - pick.alongM),
    offRouteM: pick.offM,
    totalM: cum,
  }
}

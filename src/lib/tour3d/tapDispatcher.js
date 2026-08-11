// Skiller et TRYKK fra et DRAG på en 3D-flate.
//
// Kameraet i 3D styres med samme finger som velger ting, så et trykk må måles:
// har fingeren flyttet seg mer enn noen piksler, eller ligget nede lenge, var
// det et kamera-drag og ikke et valg. Tersklene må tåle at en finger aldri står
// helt stille.

export const TAP_SLOP_PX = 12
export const TAP_MAX_MS = 600

/**
 * @param {HTMLElement} el
 * @param {(e: PointerEvent) => void} onTap
 * @param {{now?: () => number, slopPx?: number, maxMs?: number}} [opts]
 * @returns {{dispose: () => void}}
 */
export function attachTapDispatcher(el, onTap, {
  now = () => performance.now(), slopPx = TAP_SLOP_PX, maxMs = TAP_MAX_MS,
} = {}) {
  let down = null

  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: now() } }
  const onUp = (e) => {
    const d = down
    down = null
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > slopPx) return
    if (now() - d.t > maxMs) return
    onTap(e)
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)

  return {
    dispose() {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    },
  }
}

/** Er dette et trykk? Ren variant for test og annen bruk. */
export function isTap(from, to, { slopPx = TAP_SLOP_PX, maxMs = TAP_MAX_MS } = {}) {
  if (!from || !to) return false
  if (Math.hypot(to.x - from.x, to.y - from.y) > slopPx) return false
  return to.t - from.t <= maxMs
}

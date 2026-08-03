import { ref, onBeforeUnmount, getCurrentInstance } from 'vue'

/**
 * Tap vs. lang-trykk på én og samme knapp — samlet fra de håndskrevne
 * knobDown/knobUp- og fabAnchorDown/fabAnchorUp-parene i MapView (v4.8.2).
 *
 * To ting her er ikke valgfrie, og begge er lært av feil på ekte enheter:
 *
 * 1. `pointercancel` er en RELEASE, aldri en abort. Samsung Internet sender
 *    `pointercancel` i stedet for `pointerup` når knappen krymper via
 *    `active:scale-95`. Ryddet man da bare timeren uten å committe, ble
 *    trykket «mistet» — relieff-knotten hoppet over et hakk og tok det igjen
 *    ved neste trykk. Derfor peker onPointerCancel på samme funksjon som
 *    onPointerUp.
 * 2. `settled` gjør committen idempotent. Et avsluttet trykk (committet tap
 *    ELLER utløst hold) markeres settled, så et etterfølgende event ikke kan
 *    telle om igjen — nettleseren kan sende både pointerup og pointercancel.
 *
 * Avbrudd skjer kun på avstand: flytter fingeren seg mer enn moveTolerancePx,
 * blir det verken tap eller hold. (Ankeret hadde ingen toleranse før, så et
 * lite drag av knappen vekslet knott-klyngen.)
 *
 * @param {object}   opts
 * @param {number}   opts.holdMs           terskel for lang-trykk
 * @param {number}   opts.moveTolerancePx  flytt mer enn dette → avbrudd
 * @param {Function} opts.armed            false → kun tap, ingen hold-timer
 * @param {Function} opts.onTap            kalles ved release uten hold
 * @param {Function} opts.onHold           kalles når holdMs er nådd
 */
export function useLongPress({
  holdMs = 600,
  moveTolerancePx = 10,
  armed = () => true,
  onTap,
  onHold,
} = {}) {
  const isHolding = ref(false)
  const holdProgress = ref(0)

  let timer = null
  let rafId = null
  let startedAt = 0
  let startX = 0
  let startY = 0
  let settled = true

  const canRaf = typeof requestAnimationFrame === 'function'
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

  function stopHold() {
    if (timer) { clearTimeout(timer); timer = null }
    if (rafId != null && canRaf) { cancelAnimationFrame(rafId); rafId = null }
    isHolding.value = false
    holdProgress.value = 0
  }

  // Driver ring-animasjonen på ankeret. Ren avlesning av klokka — ingen
  // tilstand her styrer når holdet utløses, det gjør setTimeout.
  function tick() {
    if (!isHolding.value) return
    holdProgress.value = Math.min(1, (now() - startedAt) / holdMs)
    rafId = requestAnimationFrame(tick)
  }

  function onPointerDown(e) {
    stopHold()
    settled = false
    startX = e?.clientX ?? 0
    startY = e?.clientY ?? 0
    if (!armed()) return   // uten hold-mål skjer alt på release
    startedAt = now()
    isHolding.value = true
    if (canRaf) rafId = requestAnimationFrame(tick)
    timer = setTimeout(() => {
      settled = true   // holdet konsumerer trykket → ingen tap ved release
      stopHold()
      onHold?.()
    }, holdMs)
  }

  function onPointerMove(e) {
    if (settled) return
    const dx = (e?.clientX ?? 0) - startX
    const dy = (e?.clientY ?? 0) - startY
    if (Math.hypot(dx, dy) <= moveTolerancePx) return
    settled = true   // dratt av knappen: verken tap eller hold
    stopHold()
  }

  function onPointerUp() {
    stopHold()
    if (settled) return
    settled = true
    onTap?.()
  }

  if (getCurrentInstance()) onBeforeUnmount(stopHold)

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    isHolding,
    holdProgress,
  }
}

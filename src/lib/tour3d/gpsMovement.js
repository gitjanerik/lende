// Bevegelsesretning fra GPS-fikser — ren og testbar, ingen three, ingen DOM.
//
// «I bevegelse» betyr at netto forflytning innenfor vinduet (5 min) er stor
// nok til at retningen er signal og ikke GPS-støy. Netto forflytning (eldste →
// nyeste fix) er bevisst valgt framfor fart per fix: står man i ro, hopper
// enkeltfikser flere meter fram og tilbake, men netto går mot null — og da
// skal kameraet IKKE late som om man er på vei noe sted.

const WINDOW_MS = 5 * 60_000
const MIN_MOVE_M = 30

export function createGpsMovement({ windowMs = WINDOW_MS, minMoveM = MIN_MOVE_M } = {}) {
  const fixes = []   // {x, y, t} i SVG-meter, stigende t

  const prune = (nowMs) => {
    while (fixes.length && fixes[0].t < nowMs - windowMs) fixes.shift()
  }

  return {
    /** Registrer en fix. Kalles ~1 Hz; ute-av-rekkefølge ignoreres. */
    push(x, y, tMs) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(tMs)) return
      if (fixes.length && tMs <= fixes[fixes.length - 1].t) return
      fixes.push({ x, y, t: tMs })
      prune(tMs)
    },
    /**
     * Sannsynlig bevegelsesretning akkurat nå.
     * @returns {[number, number]|null} enhetsvektor i SVG-meter, eller null
     *   når man ikke har forflyttet seg nok innenfor vinduet.
     */
    heading(nowMs) {
      prune(nowMs)
      if (fixes.length < 2) return null
      const a = fixes[0]
      const b = fixes[fixes.length - 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      if (d < minMoveM) return null
      return [dx / d, dy / d]
    },
    reset() { fixes.length = 0 },
  }
}

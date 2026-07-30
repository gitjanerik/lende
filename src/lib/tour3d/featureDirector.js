// Koreografien når fly-by/avspilling nærmer seg en feature:
// CRUISE → APPROACH (fart rampes 1→0.25) → HOLD (fart 0, infokort vises,
// kamera rammer inn) → RESUME (fart rampes tilbake) → CRUISE.
//
// Ren tilstandsmaskin: tick(alongM, dtMs) returnerer speedFactor som mates
// inn i playback.setSpeedFactor. Tidslinjen kan byttes underveis (async
// kilder popper inn) uten å re-trigge hendelser bak nåværende posisjon.

const APPROACH_MIN_FACTOR = 0.25
const RESUME_RAMP_MS = 2000

export function createFeatureDirector(events = [], { onEnter = null, onExit = null } = {}) {
  let timeline = events.slice()
  let idx = 0
  let state = 'CRUISE'
  let holdLeftMs = 0
  let resumeLeftMs = 0
  let active = null
  let enabled = true

  const advancePast = (alongM) => {
    idx = timeline.findIndex(e => e.alongM > alongM)
    if (idx < 0) idx = timeline.length
  }

  const exitHold = () => {
    if (active && onExit) onExit(active)
    active = null
    state = 'RESUME'
    resumeLeftMs = RESUME_RAMP_MS
    idx++
  }

  return {
    tick(alongM, dtMs) {
      if (!enabled || !timeline.length) return { speedFactor: 1, state, active }
      const next = timeline[idx] ?? null

      if (state === 'CRUISE' && next && alongM >= next.alongM - next.approachM) {
        state = 'APPROACH'
      }
      if (state === 'APPROACH') {
        if (!next) { state = 'CRUISE'; return { speedFactor: 1, state, active } }
        if (alongM >= next.alongM) {
          state = 'HOLD'
          holdLeftMs = next.holdMs
          active = next
          if (onEnter) onEnter(next)
        } else {
          const t = Math.max(0, Math.min(1, (next.alongM - alongM) / next.approachM))
          const s = t * t * (3 - 2 * t)
          return { speedFactor: APPROACH_MIN_FACTOR + (1 - APPROACH_MIN_FACTOR) * s, state, active }
        }
      }
      if (state === 'HOLD') {
        holdLeftMs -= dtMs
        if (holdLeftMs <= 0) exitHold()
        else return { speedFactor: 0, state, active }
      }
      if (state === 'RESUME') {
        resumeLeftMs -= dtMs
        if (resumeLeftMs <= 0) {
          state = 'CRUISE'
        } else {
          const t = 1 - resumeLeftMs / RESUME_RAMP_MS
          return { speedFactor: APPROACH_MIN_FACTOR + (1 - APPROACH_MIN_FACTOR) * t, state, active }
        }
      }
      return { speedFactor: 1, state, active }
    },
    skip() {
      if (state === 'HOLD') exitHold()
    },
    seek(alongM) {
      if (state === 'HOLD' && active && onExit) onExit(active)
      active = null
      state = 'CRUISE'
      advancePast(alongM)
    },
    setEvents(events, currentAlongM = 0) {
      timeline = (events ?? []).slice()
      if (state === 'HOLD' || state === 'APPROACH') {
        // Behold pågående hendelse; pek forbi den i den nye tidslinjen.
        advancePast(active ? active.alongM : currentAlongM)
      } else {
        advancePast(currentAlongM)
      }
    },
    setEnabled(v) {
      enabled = !!v
      if (!enabled && state === 'HOLD') exitHold()
    },
    // Nærmeste hendelse innen vindu — brukes av scrubbing til å vise
    // POI-kort når brukeren drar seg forbi en feature.
    eventNear(alongM, windowM = 150) {
      let best = null
      let bestD = Infinity
      for (const e of timeline) {
        const d = Math.abs(e.alongM - alongM)
        if (d <= windowM && d < bestD) { bestD = d; best = e }
      }
      return best
    },
    get state() { return state },
    get active() { return active },
    get pending() { return timeline.length - idx },
  }
}

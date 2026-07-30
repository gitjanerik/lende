// Avspillings-tilstandsmaskin for 3D-turen. Ren og testbar: ingen klokke,
// ingen DOM — kalleren mater inn dt fra sin RAF-loop.
//
// alongM avanserer med kmh/3.6 · timeScale · dt · speedFactor. speedKmh er
// «ærlig» gangfart som driver ETA/statistikk; timeScale er brukerens
// avspillingshastighet; speedFactor er ekstern demping (feature-direktøren
// bremser/stopper kameraet med den).

// Standard avspillingstempo styrt av turens lengde: korte turer i ro og
// mak, lange turer raskere så avspillingen ikke drar ut. Brukeren kan
// alltid overstyre med 64×/128×/256×-knappene.
export function defaultTimeScale(lengthM) {
  if (!Number.isFinite(lengthM)) return 128
  if (lengthM < 3000) return 64
  if (lengthM <= 12000) return 128
  return 256
}

export function createPlayback({ totalM, estWalkMinutes = null, cumAscent = null, speedKmh = 4.5, timeScale = 128 } = {}) {
  let alongM = 0
  let playing = false
  let speedFactor = 1
  let virtualElapsedS = 0
  let finished = false

  const ascentAt = (d) => {
    if (!cumAscent || !cumAscent.dM.length) return 0
    const { dM, aM } = cumAscent
    let lo = 0
    let hi = dM.length - 1
    if (d <= dM[0]) return aM[0]
    if (d >= dM[hi]) return aM[hi]
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (dM[mid] < d) lo = mid + 1
      else hi = mid
    }
    const i0 = lo - 1
    const seg = dM[lo] - dM[i0] || 1
    const t = (d - dM[i0]) / seg
    return aM[i0] + (aM[lo] - aM[i0]) * t
  }

  const totalAscent = cumAscent?.aM.length ? cumAscent.aM[cumAscent.aM.length - 1] : 0

  return {
    play() { if (!finished) playing = true },
    pause() { playing = false },
    restart() { alongM = 0; virtualElapsedS = 0; finished = false; playing = true },
    seek(d) {
      alongM = Math.max(0, Math.min(totalM, d))
      finished = alongM >= totalM
      if (finished) playing = false
    },
    setSpeed(kmh) { speedKmh = Math.max(0.5, kmh) },
    setTimeScale(x) { timeScale = Math.max(0.1, x) },
    setSpeedFactor(f) { speedFactor = Math.max(0, Math.min(1, f)) },
    tick(dtSec) {
      if (!playing || finished) return { alongM, finished }
      const dt = Math.min(dtSec, 0.1)
      alongM += (speedKmh / 3.6) * timeScale * dt * speedFactor
      virtualElapsedS += dt * timeScale * speedFactor
      if (alongM >= totalM) {
        alongM = totalM
        finished = true
        playing = false
      }
      return { alongM, finished }
    },
    stats() {
      const remainingM = Math.max(0, totalM - alongM)
      const ascentSoFarM = ascentAt(alongM)
      const remainingClimbM = Math.max(0, totalAscent - ascentSoFarM)
      return {
        alongM,
        totalM,
        remainingM,
        pctDone: totalM > 0 ? alongM / totalM : 0,
        ascentSoFarM,
        remainingClimbM,
        etaMin: estWalkMinutes ? estWalkMinutes(remainingM, remainingClimbM) : null,
        virtualElapsedMin: virtualElapsedS / 60,
        playing,
        finished,
        speedKmh,
        timeScale,
        speedFactor,
      }
    },
    get playing() { return playing },
    get alongM() { return alongM },
    get finished() { return finished },
  }
}

// Kumulativ stigning fra en høydeprofil ({samples: [{distM, elev}]}) —
// grunnlaget for «stigning så langt» og gjenværende klatring i ETA.
export function buildCumulativeAscent(samples) {
  const valid = (samples ?? []).filter(s => s.elev != null && Number.isFinite(s.elev))
  if (valid.length < 2) return null
  const dM = new Float32Array(valid.length)
  const aM = new Float32Array(valid.length)
  let acc = 0
  dM[0] = valid[0].distM
  for (let i = 1; i < valid.length; i++) {
    const dz = valid[i].elev - valid[i - 1].elev
    if (dz > 0) acc += dz
    dM[i] = valid[i].distM
    aM[i] = acc
  }
  return { dM, aM }
}

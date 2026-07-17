// buildSvgClient.js — kjør buildSvg i en Web Worker når mulig, ellers synkront.
//
// I nettleseren spawnes en dedikert worker pr kall så det tunge buildSvg-passet
// ikke fryser UI-en (viktig for at kartet du panner på holder seg responsivt
// mens et nytt kart bygges i bakgrunnen — spekulativ prefetch). Workeren
// termineres når byggingen er ferdig eller blir avbrutt; terminering = umiddelbar
// stopp av CPU-arbeidet.
//
// I Node/CI/test (ingen Worker) faller vi tilbake til synkron buildSvg, så
// scripts/build-vardasen-svg.js og enhetstester er uberørt.
import { buildSvg } from './mapBuilder.js'

export function buildSvgClient(elements, bbox, options = {}, { signal } = {}) {
  if (typeof Worker === 'undefined') {
    // Node / fallback: kjør synkront.
    if (signal?.aborted) return Promise.reject(new DOMException('Avbrutt', 'AbortError'))
    try {
      return Promise.resolve(buildSvg(elements, bbox, options))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  return new Promise((resolve, reject) => {
    let worker
    try {
      worker = new Worker(new URL('./mapSvg.worker.js', import.meta.url), { type: 'module' })
    } catch {
      // Klarte ikke å lage worker (gammel nettleser / CSP) → synkron fallback.
      try { resolve(buildSvg(elements, bbox, options)) } catch (e) { reject(e) }
      return
    }

    // Én-gangs-oppgjør: onmessage/onerror/abort kan kappløpe; første vinner.
    let settled = false
    const onAbort = () => finish(() => reject(new DOMException('Avbrutt', 'AbortError')))
    function cleanup() {
      try { worker.terminate() } catch { /* noop */ }
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    function finish(fn) {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }
    // Siste utvei: bygg synkront på hovedtråden. Fryser UI kort, men et kart er
    // bedre enn en feilmelding. Brukes når workeren feiler å laste/kjøre.
    const syncFallback = () => {
      if (signal?.aborted) { reject(new DOMException('Avbrutt', 'AbortError')); return }
      try { resolve(buildSvg(elements, bbox, options)) } catch (err) { reject(err) }
    }

    if (signal) {
      if (signal.aborted) { cleanup(); reject(new DOMException('Avbrutt', 'AbortError')); return }
      signal.addEventListener('abort', onAbort)
    }

    worker.onmessage = (e) => finish(() => {
      if (e.data?.ok) resolve({ svg: e.data.svg, counts: e.data.counts, timings: e.data.timings })
      // Workeren rapporterte en intern feil → prøv synkront før vi gir opp.
      else syncFallback()
    })
    // Worker-nivå-feil (typisk transient modul-last på GitHub Pages rett etter en
    // deploy: worker-chunken eller en avhengighet lå ikke i SW-cachen ennå).
    // e.message er ofte tom (cross-origin script error). Bygg synkront i stedet
    // for å feile hardt med «buildSvg-worker-feil».
    worker.onerror = () => finish(syncFallback)

    // elements (kan være noen MB) + dem (Float32Array) struktur-klones til
    // workeren. Vi transfererer IKKE dem-bufferet, fordi buildMapFromCenter
    // bruker dem etterpå (packDem/findHighestPoint) — detach ville ødelagt det.
    worker.postMessage({ elements, bbox, options })
  })
}

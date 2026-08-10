// Motorens livssyklus: RAF-loop med klampet dt, ResizeObserver på
// containeren (dekker modal-animasjon, tastatur, rotasjon), context-loss,
// visibilitychange-pause og et dispose-register som frigjør ALT (geometri,
// materialer, teksturer) + forceContextLoss (iOS har hardt tak på antall
// WebGL-contexts).

export function createEngineLoop({ renderer, camera, container, onFrame, onResize = null, onContextLost = null, onContextRestored = null, onVisible = null }) {
  const disposables = new Set()
  const listeners = []
  let rafId = 0
  let running = false
  let lastT = 0
  let disposed = false

  const track = (obj) => {
    if (obj && typeof obj.dispose === 'function') disposables.add(obj)
    return obj
  }

  const frame = (tMs) => {
    if (!running || disposed) return
    const dt = Math.min(0.1, lastT ? (tMs - lastT) / 1000 : 0.016)
    lastT = tMs
    onFrame(dt, tMs / 1000)
    rafId = requestAnimationFrame(frame)
  }

  const start = () => {
    if (running || disposed) return
    running = true
    lastT = 0
    rafId = requestAnimationFrame(frame)
  }

  const stop = () => {
    running = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  const on = (target, event, fn, opts) => {
    target.addEventListener(event, fn, opts)
    listeners.push([target, event, fn, opts])
  }

  const resize = () => {
    if (disposed) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Høyere FOV i portrett så ruta foran forblir synlig.
    camera.fov = h > w ? 65 : 55
    camera.updateProjectionMatrix()
    onResize?.(w, h)
  }

  const resizeObs = new ResizeObserver(resize)
  resizeObs.observe(container)
  resize()

  on(renderer.domElement, 'webglcontextlost', (e) => {
    e.preventDefault()
    stop()
    onContextLost?.()
  })
  on(renderer.domElement, 'webglcontextrestored', () => {
    start()
    onContextRestored?.()
  })
  // Retur fra bakgrunn er ikke bare «start loopen igjen»: nettleseren kan ha
  // frigjort GPU-context OG backing-store for store lerret mens vi lå nede,
  // så kalleren får sjansen til å sjekke ressursene sine på nytt.
  on(document, 'visibilitychange', () => {
    if (document.hidden) { stop(); return }
    start()
    resize()
    onVisible?.()
  })

  return {
    track,
    start,
    stop,
    resize,
    get running() { return running },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      resizeObs.disconnect()
      for (const [target, event, fn, opts] of listeners) target.removeEventListener(event, fn, opts)
      listeners.length = 0
      for (const d of disposables) {
        try { d.dispose() } catch { /* allerede frigjort */ }
      }
      disposables.clear()
      try {
        renderer.dispose()
        renderer.forceContextLoss()
      } catch { /* context alt tapt */ }
      renderer.domElement?.remove()
    },
  }
}

// Motorens livssyklus: RAF-loop med klampet dt, ResizeObserver på
// containeren (dekker modal-animasjon, tastatur, rotasjon), context-loss,
// visibilitychange-pause og et dispose-register som frigjør ALT (geometri,
// materialer, teksturer) + forceContextLoss (iOS har hardt tak på antall
// WebGL-contexts).

export function createEngineLoop({
  renderer, camera, container, onFrame,
  onResize = null, onContextLost = null, onContextRestored = null, onVisible = null,
  onDead = null,
}) {
  const disposables = new Set()
  const listeners = []
  let rafId = 0
  let running = false
  let lastT = 0
  let disposed = false
  let frames = 0
  let feilMeldt = false
  let vaktTimer = 0

  const track = (obj) => {
    if (obj && typeof obj.dispose === 'function') disposables.add(obj)
    return obj
  }

  // Én frame. Kastet onFrame FØR, døde loopen for godt: kastet kallet, ble
  // linja under — den som ber om neste frame — aldri nådd. Da sto 3D-visningen
  // frosset til brukeren lukket den og gikk inn igjen, og et enkelt unntak (en
  // tapt GL-context, en tekstur som forsvant i bakgrunnen) var nok. Nå ber vi
  // ALLTID om neste frame; feilen logges én gang og resten av økta går videre.
  const frame = (tMs) => {
    if (!running || disposed) return
    const dt = Math.min(0.1, lastT ? (tMs - lastT) / 1000 : 0.016)
    lastT = tMs
    frames++
    try {
      onFrame(dt, tMs / 1000)
    } catch (e) {
      if (!feilMeldt) {
        feilMeldt = true
        console.error('[3D] feil i render-loopen (loopen går videre):', e)
      }
    }
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
  //
  // Og selve gjenopptakelsen må VERIFISERES, ikke antas. Symptomet fra felt: er
  // man i 3D og bytter til en annen app i noen minutter, sto visningen frosset
  // ved retur — ingen zoom, ingen panorering, ingen knapper som gjorde noe —
  // til man lukket 3D og gikk inn igjen. Årsakene er flere og vi kan ikke skille
  // dem fra hverandre herfra: `visibilitychange` kommer ikke alltid når Android
  // har fryst siden (Chrome sender `resume`), GL-contexten kan være tapt uten at
  // `webglcontextrestored` noen gang fires, og et unntak i den første framen
  // etter retur drepte loopen (se `frame`). Derfor: lytt på FLERE signaler, og
  // sjekk etterpå at det faktisk KOM en frame. Gjorde det ikke det, prøv én
  // omstart — og hjelper heller ikke det, si det fra så viseren kan bygge om.
  const vekk = () => {
    if (disposed || document.hidden) return
    start()
    resize()
    onVisible?.()
    clearTimeout(vaktTimer)
    const foer = frames
    vaktTimer = setTimeout(() => {
      if (disposed || document.hidden || frames > foer) return
      // Ingen frame på 1,5 s med synlig side: loopen er død. Prøv en ren omstart.
      stop()
      start()
      const foer2 = frames
      vaktTimer = setTimeout(() => {
        if (disposed || document.hidden || frames > foer2) return
        onDead?.()
      }, 1500)
    }, 1500)
  }
  on(document, 'visibilitychange', () => {
    if (document.hidden) { stop(); return }
    vekk()
  })
  // Chrome fryser bakgrunnsfaner og sender `resume` ved oppvåkning — den kommer
  // ikke alltid sammen med en visibilitychange. `pageshow` dekker retur fra
  // back/forward-cachen, og `focus` er siste skanse på Android.
  on(document, 'resume', vekk)
  on(window, 'pageshow', vekk)
  on(window, 'focus', vekk)

  return {
    track,
    start,
    stop,
    resize,
    get running() { return running },
    /** Antall framer kjørt. Vaktbikkja over bruker det; tester leser det.  */
    get frames() { return frames },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      clearTimeout(vaktTimer)
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

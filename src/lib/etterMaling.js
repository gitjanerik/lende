// Kjør noe ETTER at nettleseren har malt neste bilde.
//
// Finnes for tema-byttet (v7.8.7). Vue-watchene flushes i ÉN synkron oppgave, så
// alt en watch gjør skjer FØR nettleseren får male: CSS-variablene for det nye
// temaet ble satt på første linje, men brukeren så ingenting før relieffet var
// bygget om (buildReliefBands er d3-contour over hele DEM-et — 130–170 ms på en
// rask maskin, det mangedobbelte på en telefon) og spøkelsesflisene var tegnet
// på nytt. Målt fra utsiden så det ut som om knappen hang i 2–3 sekunder.
//
// `nextTick` hjelper ikke: den venter på Vues egen kø, ikke på et bilde. To
// rAF-er gjør det — den første kalles FØR malingen av neste bilde, den andre
// etter at det bildet er malt.
//
// Fallback er `setTimeout`, ikke fordi rAF mangler i en nettleser, men fordi
// testene og headless-bygget kjører uten. Merk at en skjult fane ikke maler i
// det hele tatt: da fyrer ingen av rAF-ene, og arbeidet venter til fanen er
// synlig igjen. Det er riktig her — det er arbeid brukeren skal SE.

/**
 * @param {() => void} fn
 * @returns {() => void} avbryt — trygg å kalle flere ganger.
 */
export function etterMaling(fn) {
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null
  if (!raf) {
    const t = setTimeout(fn, 0)
    return () => clearTimeout(t)
  }
  let avbrutt = false
  let id = raf(() => {
    if (avbrutt) return
    id = raf(() => { if (!avbrutt) fn() })
  })
  return () => {
    avbrutt = true
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  }
}

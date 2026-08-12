// Pan- og zoom-grensene: hvor langt kartet kan dras, og hvor langt ut det kan
// zoomes.
//
// Trukket ut av MapView.vue i v5.15.0. Begge svarer på samme spørsmål — «hva er
// utstrekningen av det brukeren eier akkurat nå?» — og begge må derfor spørre
// mosaikken (useMapExtend), som opprettes lenger ned i MapView. Derfor kommer de
// to spørsmålene inn som tilbakekall.
//
// To detaljer det er lett å ødelegge:
//   • Klampen gjelder det SYNLIGE SENTRUM, ikke translate direkte. Det er det som
//     gjør den rotasjons-trygg: vi klamper sentrum i kart-rom og inverterer
//     tilbake til translate.
//   • Frontier-slakken (en halv flis i hver retning) er ikke slurv. Uten den kan
//     ikke auto-kart trigges på ukjent grunn, fordi brukeren aldri får panorert
//     utenfor det som alt finnes.

/**
 * @param {{
 *   meta: import('vue').Ref, wrapperRef: import('vue').Ref,
 *   scale: import('vue').Ref, rotation: import('vue').Ref,
 *   translateX: import('vue').Ref, translateY: import('vue').Ref,
 *   ghostRects: () => import('vue').Ref,   // getter: eies av useGhostTiles
 *   hooks: {
 *     extendZonesBounds: () => { minX: number, minY: number, maxX: number, maxY: number },
 *     visibleCenterSvg: () => { x: number, y: number } | null,
 *   },
 * }} deps
 */
export function usePanGrenser({
  meta, wrapperRef, scale, rotation, translateX, translateY, ghostRects, hooks,
}) {
  // Dynamisk zoom-ut-gulv: la brukeren zoome ut akkurat langt nok til å se HELE
  // bruttokartet (aktiv flis ∪ nabofliser) med litt margin rundt — så man raskt
  // ser totalområdet et lagret/utvidet kart spenner over. Ett-flis-kart beholder
  // dagens gulv (0.5); større mosaikker får lavere gulv (flere zoom-ut-nivåer).
  // Absolutt bunn (0.06) hindrer at en svær mosaikk forsvinner i tomrom.
  function mosaicMinScale() {
    const m = meta.value
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!m || !wrap?.width || !wrap?.height) return 0.5
    const fit = Math.min(wrap.width / m.widthM, wrap.height / m.heightM)
    if (!(fit > 0)) return 0.5
    const b = hooks.extendZonesBounds()   // union (alltid rektangulær)
    const unionW = Math.max(m.widthM, b.maxX - b.minX)
    const unionH = Math.max(m.heightM, b.maxY - b.minY)
    // scale der mosaikken fyller ~82 % av viewporten (margin rundt)
    const fitMosaic = 0.82 * Math.min(wrap.width / (unionW * fit), wrap.height / (unionH * fit))
    return Math.max(0.06, Math.min(0.5, fitMosaic))
  }


  // Pan-clamp — det synlige sentrum klampes til mosaikk-utstrekningen pluss en
  // halv flis i hver retning (frontier-slakk så auto-kart fortsatt kan trigges på
  // ukjent grunn). Uten spøkelses-fliser er utstrekningen den aktive flisa, og
  // grensene blir [-W/2, 1.5W] × [-H/2, 1.5H] — byte-identisk med den gamle
  // «±1 flis»-oppførselen. Med spøkelser strekker grensa seg over hele mosaikken.
  // Rotasjons-trygt: vi klamper det synlige sentrum og inverterer til translate.
  function clampPan() {
    const m = meta.value
    const el = wrapperRef.value
    if (!m || !el) return
    const r = el.getBoundingClientRect()
    const w = r.width, h = r.height
    if (!w || !h) return
    const c = hooks.visibleCenterSvg()
    if (!c) return
    // Mosaikk-bbox i aktiv-flis-koordinater = aktiv flis ∪ alle spøkelses-rekter.
    let minX = 0, minY = 0, maxX = m.widthM, maxY = m.heightM
    for (const g of ghostRects().value) {
      if (g.x < minX) minX = g.x
      if (g.y < minY) minY = g.y
      if (g.x + g.w > maxX) maxX = g.x + g.w
      if (g.y + g.h > maxY) maxY = g.y + g.h
    }
    const marginX = m.widthM / 2, marginY = m.heightM / 2
    const cx = Math.min(Math.max(c.x, minX - marginX), maxX + marginX)
    const cy = Math.min(Math.max(c.y, minY - marginY), maxY + marginY)
    if (cx === c.x && cy === c.y) return   // innenfor → idempotent, ingen endring
    // Inverter visibleCenterSvg: finn translate som lander (cx,cy) på skjermsenter.
    const fit = Math.min(w / m.widthM, h / m.heightM)
    const offX = (w - m.widthM * fit) / 2
    const offY = (h - m.heightM * fit) / 2
    const s = scale.value || 1
    const rot = (rotation.value || 0) * Math.PI / 180
    const cos = Math.cos(rot), sin = Math.sin(rot)
    const px = cx * fit + offX
    const py = cy * fit + offY
    const A = px * cos - py * sin
    const B = px * sin + py * cos
    translateX.value = w / 2 - A * s
    translateY.value = h / 2 - B * s
  }
  return { mosaicMinScale, clampPan }
}

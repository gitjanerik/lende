// GPS-prikken: blå prikk med hvit halo og en nøyaktighetsring rundt.
// Trukket ut av useSymbolRenderers i v6.5.0 fordi Fritt lende tegner den samme
// prikken uten å ta med resten av symbol-rendrerne.
//
// Ren DOM-funksjon — tar laget den skal tegne i og en px→brukerenhet-omregner,
// så den kan testes med linkedom.

const NS = 'http://www.w3.org/2000/svg'

// Dynamiske skjerm-størrelser. Dot er fast 14 CSS-px. Accuracy-ringen
// reflekterer ekte fysisk usikkerhet (i meter) men cappes på ~28 CSS-px radius
// slik at dårlig GPS (urban / tog / tunnel) ikke språker ringen utover halve
// skjermen og dømmer kart-innholdet.
// v8.5.3: stroke-bredder via pxToUserUnits — non-scaling-stroke virker ikke når
// SVG-en CSS-transformeres av pinch-zoom-wrapperen, så stroke ble fete på høy
// zoom og det blå fyllet forsvant under den hvite kantlinjen. Nå skaleres
// bredden eksplisitt på samme måte som radius.
// Retningskjegla ble fjernet i v5.2.2 — den drev hit og dit når man sto stille,
// som er nettopp når kartet leses.
export function tegnBrukerPrikk(layer, { x, y, accuracyM, pxToUserUnits }) {
  if (!layer) return
  layer.replaceChildren()
  if (x == null || y == null) return
  const acc = accuracyM ?? 30

  const dotR = pxToUserUnits(7)         // ~14 CSS-px diameter
  const dotStroke = pxToUserUnits(1.6)  // tynn hvit halo
  const minRingR = pxToUserUnits(12)    // ringen blir aldri mindre enn dot+halo
  const maxRingR = pxToUserUnits(28)    // visuelt cap
  const ringR = Math.min(maxRingR, Math.max(minRingR, acc))
  const ringStroke = pxToUserUnits(0.8)

  const doc = layer.ownerDocument
  const ring = doc.createElementNS(NS, 'circle')
  ring.setAttribute('cx', x)
  ring.setAttribute('cy', y)
  ring.setAttribute('r', ringR)
  ring.setAttribute('fill', 'rgba(56, 189, 248, 0.10)')
  ring.setAttribute('stroke', 'rgba(56, 189, 248, 0.40)')
  ring.setAttribute('stroke-width', ringStroke)
  layer.appendChild(ring)

  // Mørk ytterkontur rundt den hvite ringen (v6.5.48). Den hvite ringen alene
  // måler 1,05:1 mot ISOM-kartets kremgule bunn — altså ingen kontur i det hele
  // tatt der prikken oftest står. Konturen ligger UTENFOR den hvite, så prikken
  // beholder sin lyse ring mot mørk skog og får en mørk mot lys mark.
  const kontur = doc.createElementNS(NS, 'circle')
  kontur.setAttribute('cx', x)
  kontur.setAttribute('cy', y)
  kontur.setAttribute('r', dotR + dotStroke)
  kontur.setAttribute('fill', 'none')
  kontur.setAttribute('stroke', 'rgba(15, 23, 42, 0.55)')
  kontur.setAttribute('stroke-width', dotStroke * 0.6)
  layer.appendChild(kontur)

  const dot = doc.createElementNS(NS, 'circle')
  dot.setAttribute('cx', x)
  dot.setAttribute('cy', y)
  dot.setAttribute('r', dotR)
  dot.setAttribute('fill', '#0ea5e9')
  dot.setAttribute('stroke', '#fff')
  dot.setAttribute('stroke-width', dotStroke)
  layer.appendChild(dot)
}

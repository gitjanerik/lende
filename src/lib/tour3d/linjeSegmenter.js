// Segment-bufferet bak hver LineSegments2 i 3D — med den ene slacken som gjør
// at siste strek ikke blir en linje til origo.
//
// HVORFOR EN EGEN MODUL: regelen fantes fra før, men bare ett sted (skyDome sitt
// fremhevings-buffer, v6.3.11), mens tre andre buffere hadde den ikke — og de
// tre er nettopp de som tegner noe over hele kartet. Da CLAUDE.md sier «skal du
// bygge en ny variant av noe som finnes, spør om varianten egentlig er en OPSJON
// på originalen», er svaret her at det ikke engang er en variant: det er den
// samme regelen fire steder, og den skal stå ett sted.
//
// FEILEN, OG HVORFOR DEN SER UT SOM HØYDEKURVER I LUFTA. `LineSegmentsGeometry`
// legger start og ende i SAMME interleavede buffer: 24-byte stride, `instanceEnd`
// 12 byte inn. For den SISTE instansen slutter `instanceEnd` nøyaktig på
// bufferets siste byte. WebGL-spesifikasjonen tillater det
// (`offset + stride·(n−1) + size`), men en driver som regner kravet som
// `offset + stride·n` finner 12 byte for lite — og gjør da én av to ting: dropper
// instansen, eller leverer NULLER for den (robust buffer access). Eierens telefon
// gjør det siste, og null i tre floats ER world-origo: midt på kartet, i
// havnivå. Siste strek blir derfor en snorrett linje fra der kurven faktisk
// sluttet og tvers over arket.
//
// DET FORKLARER OGSÅ DET GAMLE FUNNET. I skyDome ble symptomet lest som «siste
// strek mangler» (Dragen har 13 og fikk 12): der er origo kuppelens sentrum,
// altså kameraets egen posisjon, så den bomme streken peker rett mot betrakteren
// og kollapser til ingenting på skjermen. Samme feil, to helt ulike symptomer,
// fordi origo betyr noe forskjellig i de to scenene.
//
// SwiftShader og desktop leser innenfor spesifikasjonen og tegner alt riktig, så
// dette er per konstruksjon usynlig i CI, i enhetstester og i røyktesten. Testen
// under kan derfor bare holde fast at SLACKEN er der og at `instanceCount`
// stopper på de ekte segmentene — ikke at bildet blir riktig.

/** Ett segment ekstra i bufferet. 24 byte. */
export const SEGMENT_SLACK = 1

/**
 * Antall hele segmenter i en flat posisjonsliste (6 floats per segment).
 * Egen funksjon fordi en halv hale skal DROPPES og ikke tegnes med søppel i
 * andre enden — nøyaktig feilen modulen finnes for.
 */
export function antallSegmenter(pts) {
  return Math.floor((pts?.length ?? 0) / 6)
}

/**
 * Fyll en `LineSegmentsGeometry` fra en flat liste med [x1,y1,z1, x2,y2,z2, …].
 *
 * Bufferet allokeres med ett segment slack, og `instanceCount` settes til de
 * EKTE segmentene — ellers ville slacken selv blitt tegnet, og en strek fra
 * origo til origo er ikke ingenting: `LineMaterial` har bredde i PIKSLER, så et
 * nullengde-segment blir en liten flekk midt på kartet.
 *
 * @param {import('three/examples/jsm/lines/LineSegmentsGeometry.js').LineSegmentsGeometry} geo
 * @param {number[]|Float32Array} pts
 * @param {{kapasitet?: number}} [opts] kapasitet: allokér plass til så mange
 *   segmenter (for buffere som fylles om igjen senere — three låser taket
 *   `_maxInstanceCount` ved FØRSTE binding og hever det aldri, se v6.3.9).
 * @returns {number} antall segmenter som tegnes
 */
export function settLinjeSegmenter(geo, pts, { kapasitet = 0 } = {}) {
  const antall = antallSegmenter(pts)
  const plasser = Math.max(antall, kapasitet) + SEGMENT_SLACK
  const buffer = new Float32Array(plasser * 6)
  if (antall > 0) {
    buffer.set(pts.length === antall * 6 ? pts : Array.prototype.slice.call(pts, 0, antall * 6))
  }
  geo.setPositions(buffer)
  geo.instanceCount = antall
  return antall
}

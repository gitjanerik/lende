// Hvor ligger et element egentlig, når kartet er en mosaikk?
//
// Spøkelses-/utvidelsesfliser tegnes som nestede `<svg x y>` inni aktiv-flisas
// SVG (useGhostTiles.buildGhostSvg). Koordinatene INNI en slik flis er
// flis-lokale: en sti som ligger på x = 200 i naboflisa har `d`-en sin skrevet
// rundt 200, ikke rundt 200 + flisebredden. Leser man geometri rett ut av
// `d`-attributtene uten å legge til flisas x/y, havner hele naboflisa oppå den
// aktive — forskjøvet med hele flisebredder.
//
// Det har kostet oss to konkrete feil: Stifinneren foreslo ruter tvers over
// Gjende langs feilplasserte sti-kopier, og 3D-visningen tegnet det samme
// stinettet (og brukerminne-nålene) på feil sted. Derfor bor regnestykket her,
// i ÉN fil, i stedet for i tre nesten like kopier — de som leser geometri ut av
// en live kart-SVG er useStifinner, stinettAnalyse og tour3d/exploreData.
//
// Fliser i en mosaikk er gitter-kompatible (samme størrelse, viewBox 1:1 med
// viewporten, ingen skalering), så kumulert x/y ER hele transformasjonen.

/**
 * @param {Element} el      elementet geometrien leses fra
 * @param {Element} rootSvg den aktive flisas `<svg>` — stoppunkt for gåingen
 * @returns {{dx: number, dy: number}} 0/0 når elementet ligger i aktiv flis
 */
export function nestedSvgOffset(el, rootSvg) {
  let dx = 0
  let dy = 0
  for (let n = el; n && n !== rootSvg; n = n.parentNode) {
    if (String(n.tagName).toLowerCase() === 'svg') {
      dx += parseFloat(n.getAttribute('x')) || 0
      dy += parseFloat(n.getAttribute('y')) || 0
    }
  }
  return { dx, dy }
}

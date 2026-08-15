// Hvilke ruter i bygge-chipens 2×2-ikon som skal animere.
//
// Ikonet er fire små firkanter — arket i miniatyr — og de som «jobber» er de som
// ligger i den retningen flisa faktisk hentes. Drar du nordover, blinker de to
// øverste; nordøst blinker bare den øverst til høyre.
//
// Nord er OPP i ikonet, uansett hvordan kartet er rotert. Kanthåndtakene roterer
// med arket fordi de sitter PÅ det, men chipen ligger utenfor kartflaten og
// bærer teksten «Nord i lende» ved siden av seg — da ville et roterende ikon
// motsagt teksten.

/** Kvadrant-nøklene, i DOM-rekkefølge: topp-venstre, topp-høyre, bunn-venstre, bunn-høyre. */
export const KVADRANTER = ['tv', 'th', 'bv', 'bh']

// Retning → kvadrantene som ligger i den retningen. En kardinal-retning dekker
// to ruter (hele siden), en diagonal dekker én (hjørnet).
const KART = {
  N:  ['tv', 'th'],
  NE: ['th'],
  E:  ['th', 'bh'],
  SE: ['bh'],
  S:  ['bv', 'bh'],
  SW: ['bv'],
  W:  ['tv', 'bv'],
  NW: ['tv'],
}

/**
 * @param {string|null} dir  en av EDGE_DIRS, eller null/ukjent
 * @returns {{tv:boolean, th:boolean, bv:boolean, bh:boolean}}
 *   Ukjent retning → alle fire animerer, så ikonet aldri står helt dødt mens
 *   noe faktisk bygges.
 */
export function kvadranterForRetning(dir) {
  const aktive = KART[dir] ?? KVADRANTER
  return Object.fromEntries(KVADRANTER.map(k => [k, aktive.includes(k)]))
}

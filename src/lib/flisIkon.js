// Hvilke ruter i bygge-chipens ikon som skal animere — og hvor mange ruter det
// er.
//
// Ikonet er arket i miniatyr, og de som «jobber» er de som ligger i den
// retningen flisa faktisk hentes. Drar du nordover, blinker de to øverste;
// nordøst blinker bare den øverst til høyre.
//
// Rutenettet er ikke fast 2×2: det er arket slik det blir ETTER utvidelsen,
// klemt til maks 2×2. Et ark som er én flis bredt og vokser nordover blir en
// stående stripe — da har ikonet to ruter oppå hverandre, og bare den øverste
// blinker. Det ville vært direkte feil å blinke to ruter side om side der, for
// arket har ingen side-om-side å vokse i.
//
// Nord er OPP i ikonet, uansett hvordan kartet er rotert. Kanthåndtakene
// roterer med arket fordi de sitter PÅ det, men chipen ligger utenfor
// kartflaten og bærer teksten «Nord i lende» ved siden av seg — da ville et
// roterende ikon motsagt teksten.

/** Kvadrant-nøklene, i DOM-rekkefølge: topp-venstre, topp-høyre, bunn-venstre, bunn-høyre. */
export const KVADRANTER = ['tv', 'th', 'bv', 'bh']

// Retning → kvadrantene som ligger i den retningen, i et fullt 2×2-ark. En
// kardinal-retning dekker to ruter (hele siden), en diagonal dekker én (hjørnet).
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

// Rute-plassering i ikonets 32×32-viewBox. To ruter langs en akse står på 4 og
// 17 (bredde 11); én rute står midtstilt.
const RUTE = 11
const POS_2 = [4, 17]
const POS_1 = [(32 - RUTE) / 2]

/**
 * Ikonets rutenett = arket slik det blir etter utvidelsen, klemt til maks 2×2.
 *
 * @param {string|null} dir            en av EDGE_DIRS, eller null/ukjent
 * @param {{cols?:number, rows?:number}} ark  arkets nåværende størrelse i fliser
 * @returns {{kol:number, rad:number}}
 */
export function ikonRutenett(dir, { cols = 1, rows = 1 } = {}) {
  // Ukjent retning: vis et helt ark og la alt animere.
  if (!KART[dir]) return { kol: 2, rad: 2 }
  const vokserSidelengs = dir.includes('E') || dir.includes('W')
  const vokserOppNed = dir.includes('N') || dir.includes('S')
  return {
    kol: Math.min(2, Math.max(1, cols) + (vokserSidelengs ? 1 : 0)),
    rad: Math.min(2, Math.max(1, rows) + (vokserOppNed ? 1 : 0)),
  }
}

/**
 * Rutene ikonet skal tegne, i DOM-rekkefølge (radvis, venstre mot høyre).
 *
 * @param {string|null} dir            en av EDGE_DIRS, eller null/ukjent
 * @param {{cols?:number, rows?:number}} ark  arkets nåværende størrelse i fliser
 * @returns {Array<{k:string, x:number, y:number, w:number, h:number, aktiv:boolean}>}
 */
export function flisIkonRuter(dir, ark = {}) {
  const { kol, rad } = ikonRutenett(dir, ark)
  const xs = kol === 2 ? POS_2 : POS_1
  const ys = rad === 2 ? POS_2 : POS_1
  const d = KART[dir] ? dir : null
  const ruter = []
  for (let r = 0; r < rad; r++) {
    for (let k = 0; k < kol; k++) {
      // En rute ligger i retningen når den oppfyller HVERT himmelretnings-ledd
      // i dir. «NE» krever øverste rad OG høyre kolonne; «N» stiller ingen krav
      // til kolonne, så hele raden blir med.
      const aktiv = !d || (
        (!d.includes('N') || r === 0) &&
        (!d.includes('S') || r === rad - 1) &&
        (!d.includes('W') || k === 0) &&
        (!d.includes('E') || k === kol - 1)
      )
      ruter.push({ k: `r${r}k${k}`, x: xs[k], y: ys[r], w: RUTE, h: RUTE, aktiv })
    }
  }
  return ruter
}

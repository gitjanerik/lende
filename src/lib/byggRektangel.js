// Orientert rektangel for et lite bygg — erstatteren for det akse-justerte
// kvadratet.
//
// ── Hva som var galt ───────────────────────────────────────────────────────
// Fram til v7.9.1 ble HVERT bygg under 500 m² tegnet som et fast 13 × 13 m
// kvadrat på centroiden. Terskelen høres liten ut, men et vanlig norsk hus er
// 100–200 m² og ei hytte 32–100 — så i praksis gjaldt det hver eneste
// frittliggende bygning i marka. Retning, proporsjon og innbyrdes størrelse
// ble kastet, og et langt naust langs stranda så ut som en firkantet hytte
// som så ut som en garasje.
//
// ── Hvorfor ikke bare tegne omrisset ───────────────────────────────────────
// Fordi kvadratet ikke var vilkårlig. Ei hytte på 32 m² er 5,7 × 5,7 m, altså
// 0,57 mm i 1:10 000 — under en millimeter, og lett maskert av en sti som går
// forbi. Kvadratet var bevisst overdimensjonert (1,3 mm) for å være lesbart,
// samme slag valg som symbolstørrelsene i ISOM-katalogen. Å fjerne
// normaliseringen helt ville løst nøyaktigheten og ødelagt lesbarheten.
//
// Derfor beholdes normaliseringen, men bare som et GULV: bygningens egen
// retning og egne mål brukes, og det eneste vi overstyrer er at ingen side
// blir kortere enn `gulvM`. Et bygg som ER stort nok, tegnes nøyaktig som det
// står. Et som ikke er det, vokser til det er synlig, men beholder retningen
// og den lengste siden sin.
//
// ── Retningen finnes ved minste areal, ikke ved lengste kant ───────────────
// Lengste kant er det nærliggende valget, og det er riktig for et rent
// rektangel. Men et bygg med en lang diagonal vegg — en vinklet garasje, en
// hytte med utbygg — har sin lengste kant PÅ SKRÅ av huskroppen, og da står
// symbolet feil vei. Vi prøver derfor hver kant som kandidat-retning og tar
// den som gir minst omsluttende areal. Det er den klassiske
// minste-omsluttende-rektangel-egenskapen (for et konvekst skrog ligger
// løsningen alltid langs en kant), og for en firkantet bygning gir den
// nøyaktig bygningens egen retning. Ringene her har ~11 punkter, så O(n²) er
// noen hundre operasjoner per bygg.

/** Aksepterer [x, y] eller {x, y}. Meter i SVG-koordinatrommet. */
const px = (p) => (Array.isArray(p) ? p[0] : p.x)
const py = (p) => (Array.isArray(p) ? p[1] : p.y)

/**
 * Minste omsluttende rektangel for en ring, med et gulv på hver side.
 *
 * @param {Array<[number,number]|{x:number,y:number}>} ring  projiserte punkter (meter)
 * @param {{gulvM?: number}} [opts]  minste tillatte side; 0 slår gulvet av
 * @returns {{hjorner: Array<[number,number]>, senter: [number,number],
 *            bredde: number, lengde: number, vinkel: number} | null}
 *   `hjorner` er fire punkter i rekkefølge. `lengde` ≥ `bredde`. `vinkel` er
 *   retningen til den lange siden i radianer. null for en degenerert ring.
 */
export function orientertRektangel(ring, { gulvM = 0 } = {}) {
  if (!Array.isArray(ring) || ring.length < 3) return null
  // En lukket ring gjentar første punkt til slutt; duplikatet gir en
  // null-lengde kant som ellers ville blitt prøvd som retning.
  const pts = []
  for (const p of ring) {
    const x = px(p), y = py(p)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const f = pts[pts.length - 1]
    if (f && Math.abs(f[0] - x) < 1e-9 && Math.abs(f[1] - y) < 1e-9) continue
    pts.push([x, y])
  }
  if (pts.length >= 2) {
    const a = pts[0], b = pts[pts.length - 1]
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) pts.pop()
  }
  if (pts.length < 3) return null

  let best = null
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-9) continue
    const ux = dx / len, uy = dy / len
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (const p of pts) {
      // Projeksjon på kantens retning (u) og på normalen (v).
      const u = p[0] * ux + p[1] * uy
      const v = -p[0] * uy + p[1] * ux
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const areal = (maxU - minU) * (maxV - minV)
    if (!best || areal < best.areal) {
      best = { areal, ux, uy, minU, maxU, minV, maxV }
    }
  }
  if (!best) return null

  const { ux, uy, minU, maxU, minV, maxV } = best
  const midU = (minU + maxU) / 2
  const midV = (minV + maxV) / 2
  // Tilbake til verdenskoordinater: u-aksen er (ux, uy), v-aksen normalen.
  const cx = midU * ux - midV * uy
  const cy = midU * uy + midV * ux

  // GULVET er en minstestørrelse, aldri en nedskalering: et bygg som alt er
  // stort nok røres ikke. Uten `Math.max` ville et stort bygg blitt krympet
  // til gulvet, som er stikk motsatt av hensikten.
  const halvU = Math.max(maxU - minU, gulvM) / 2
  const halvV = Math.max(maxV - minV, gulvM) / 2

  const hjorne = (su, sv) => [
    cx + su * halvU * ux - sv * halvV * uy,
    cy + su * halvU * uy + sv * halvV * ux,
  ]
  const hjorner = [hjorne(-1, -1), hjorne(1, -1), hjorne(1, 1), hjorne(-1, 1)]

  const sideU = halvU * 2, sideV = halvV * 2
  const langsU = sideU >= sideV
  return {
    hjorner,
    senter: [cx, cy],
    lengde: langsU ? sideU : sideV,
    bredde: langsU ? sideV : sideU,
    // Retningen til den LANGE siden. u-aksen er (ux, uy); er v lengst, står
    // den lange siden normalt på den.
    vinkel: langsU ? Math.atan2(uy, ux) : Math.atan2(ux, -uy),
  }
}

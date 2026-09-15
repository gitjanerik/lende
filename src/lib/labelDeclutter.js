import RBush from 'rbush'

// Tetthets-budsjett — ren, deterministisk navne-vraking i SKJERMROM.
//
// Gir et sett med navn-id-er som skal vises i gjeldende utsnitt/zoom. Ingen DOM,
// ingen Vue, ingen tilfeldighet → fullt enhetstestbar. MapView står for
// skjermrom-transformen (senter sx,sy + boks halfW,halfH) og toggler CSS-klassen.
//
// Pipeline (CD-handoff §4): forced (søk) → LOD-filter m/hysterese → STICKY-først
// grådig plassering (allerede-viste navn beholder plassen) → fersk fyll i ledige
// hull (kollisjon + rutenett-kvote) → synlig-sett.
//
// STABILITET er hovedkravet: navn skal IKKE «komme og gå» ved panorering eller
// ubevisst marginal zoom. Derfor er allerede-viste navn klistret (placeres først,
// utenom kvoten) — så et synlig navn forsvinner bare når det går ut av skjermen
// eller faller under sin (hysterese-relakserte) LOD-terskel, eller (ved utzoom)
// kolliderer med et VIKTIGERE allerede-vist navn. Under panorering er innbyrdes
// skjerm-avstand mellom viste navn konstant ⇒ ingen nye kollisjoner ⇒ ro.
//
// candidate: {
//   id:     stabil streng (navnet — globalt unikt ved bygging)
//   score:  0–100 viktighet (data-score fra mapBuilder)
//   sx, sy: skjerm-senter (px)
//   halfW, halfH: halv boks-utstrekning i skjerm-px (aksejustert AABB)
//   group:  'priority' (topp/vann/område — utenom kvote) | 'quota' (bebyggelse/hytte)
//   forced: true ⇒ søke-pin: vises alltid, tegnes over, uten kollisjons-fotavtrykk
// }
// opts: { cellPx, K, scale, minZoomOf(score)->number, prevShown:Set, pad, maxVisible,
//         hindringer: [{minX,minY,maxX,maxY}] }
//
// HINDRINGER er flater som ligger OPPÅ arket og som et navn ikke skal havne
// under (snarvei-raden i dag). De såes i det samme R-treet som navnene, FØR
// noen kandidat plasseres, så de koster nøyaktig null per navn: kollisjonen
// spørres allerede én gang per kandidat. Merk at de gjelder NAVN og ingenting
// annet — kurver, skravur og geometri ligger fortsatt under overlegget, og et
// søketreff (`forced`) står over hele budsjettet og kan derfor fortsatt havne
// der. Boksene er i SKJERMROM, samme rom som `sx/sy`, og kallstedet må derfor
// mate dem på nytt når overlegget endrer størrelse.
//
// Returnerer Set<id> som skal være synlige.

// Et allerede-vist navn overlever til zoom faller godt UNDER terskelen (× denne
// faktoren) — hindrer blinking når man panorerer/zoomer rundt en LOD-grense.
const HYSTERESIS = 0.7

export function declutter(candidates = [], opts = {}) {
  const {
    cellPx = 240,
    K = 2,
    scale = 1,
    prevShown = new Set(),
    pad = 2,
    maxVisible = Infinity,   // global tak (Utvikler-budsjett) — rutenett-kvote er primær
    hindringer = [],         // overlegg navn ikke skal plasseres under (skjermrom)
  } = opts
  const minZoomOf = typeof opts.minZoomOf === 'function' ? opts.minZoomOf : () => 0

  const visible = new Set()
  const tree = new RBush()
  const cellCount = new Map()
  let placed = 0

  const boxOf = (c) => ({
    minX: c.sx - c.halfW - pad,
    minY: c.sy - c.halfH - pad,
    maxX: c.sx + c.halfW + pad,
    maxY: c.sy + c.halfH + pad,
  })
  const cellKey = (c) => `${Math.floor(c.sx / cellPx)},${Math.floor(c.sy / cellPx)}`

  // Forsøk å plassere én kandidat. enforceQuota=false for sticky (de har alt
  // fortjent plassen — kvoten gater bare VEKST). Tellingen skjer uansett, så
  // ferske navn respekterer at sticky allerede opptar celle-plass.
  const tryPlace = (c, enforceQuota) => {
    if (placed >= maxVisible) return
    const box = boxOf(c)
    if (tree.collides(box)) return
    if (c.group !== 'priority') {
      const key = cellKey(c)
      const n = cellCount.get(key) || 0
      if (enforceQuota && n >= K) return
      cellCount.set(key, n + 1)
    }
    visible.add(c.id)
    tree.insert({ ...box, id: c.id })
    placed++
  }

  // 0. Overlegg som opptar plass. Sås før alt annet, så BÅDE sticky og ferske
  //    navn møter dem — et navn som var synlig da raden ble foldet ut skal vike,
  //    ellers ville hysteresen holdt nettopp det navnet fast under raden.
  for (const h of hindringer) {
    if (h && h.maxX > h.minX && h.maxY > h.minY) tree.insert({ ...h })
  }

  // 1. Søke-pin: alltid synlig, tegnes over. Får IKKE kollisjons-fotavtrykk.
  for (const c of candidates) {
    if (c.forced) visible.add(c.id)
  }

  // 2. LOD-filter med hysterese (sticky-navn får relaksert terskel).
  const eligible = []
  for (const c of candidates) {
    if (c.forced) continue
    const mz = minZoomOf(c.score)
    const thresh = prevShown.has(c.id) ? mz * HYSTERESIS : mz
    if (scale >= thresh) eligible.push(c)
  }

  const byScore = (a, b) =>
    b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  // 3. STICKY først (allerede vist) — beholder plassen, utenom kvoten.
  const sticky = eligible.filter((c) => prevShown.has(c.id)).sort(byScore)
  for (const c of sticky) tryPlace(c, false)

  // 4. FERSKE navn fyller ledige hull — kollisjon + rutenett-kvote.
  const fresh = eligible.filter((c) => !prevShown.has(c.id)).sort(byScore)
  for (const c of fresh) tryPlace(c, true)

  return visible
}

/**
 * Et overleggs skjermboks → hindring i WRAPPER-LOKALE piksler.
 *
 * Skilt ut som ren funksjon fordi den er den ene biten av hindrings-veien som
 * kan regne feil uten at noe ser rart ut: en boks i feil rom rydder navn et
 * annet sted enn der overlegget står, og det er umulig å se forskjell på det og
 * «declutteren tok bare de navnene».
 *
 * `krymp` trekker boksen inn mot sin egen midte. Snarvei-raden er en RAMME med
 * gjennomsiktig innmat, så et navn som så vidt stikker under ytterkanten er
 * fortsatt lesbart. En boks som kollapser av krympen er ingen hindring og gis
 * tilbake som null — en invertert boks ville ryddet ingenting, men også skjult
 * at tallet var for stort.
 *
 * @param {{left:number,top:number,right:number,bottom:number}} rect overleggets skjermboks
 * @param {{left:number,top:number}} wrap kartflatas skjermboks
 * @param {number} krymp piksler inn fra hver kant
 */
export function hindringsBoks(rect, wrap, krymp = 0) {
  if (!rect || !wrap) return null
  const b = {
    minX: rect.left - wrap.left + krymp,
    minY: rect.top - wrap.top + krymp,
    maxX: rect.right - wrap.left - krymp,
    maxY: rect.bottom - wrap.top - krymp,
  }
  return (b.maxX > b.minX && b.maxY > b.minY) ? b : null
}

// Score→minZoom-bånd. Bevisst LØS: tetthet styres primært av kollisjon +
// rutenett-kvote i skjermrom (naturlig stabilt — flere navn får plass når man
// zoomer inn). minZoom gater bare så vidt det minst viktige ved lav zoom, så
// kartet ikke er overlesset på full oversikt. near = .zoom-near-terskelen.
export function makeMinZoomOf(near = 2.5) {
  return (score) => {
    if (score >= 55) return 0      // topp, vann, store steder — alltid kvalifisert
    if (score >= 35) return 0.9    // grend/gård/seter — nær full oversikt
    if (score >= 20) return 1.3    // hytter o.l. — et lite hint innzoom
    return 1.8
  }
}

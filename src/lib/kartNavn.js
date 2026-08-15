// Navnelesing ut av en kart-SVG — label-formatene, ett sted.
//
// To ting bor her, og de henger sammen fordi begge må kunne det samme om
// hvordan mapBuilder skriver navn:
//
//   • `readPeakLabel` — å tolke én topp-label. Formatet har endret seg tre
//     ganger (inline `<tspan data-label="peak-ele">`, søsken-`<text>`, navnløs
//     topp der labelen ER tallet), og hver variant har brukket søket en gang.
//   • `lesSpokelsesNavn` — navn i NABOFLISENE (`#ghost-tiles`).
//
// Hvorfor spøkelses-lesingen er en delt funksjon og ikke en kopi til:
// `buildGhostSvg` (useGhostTiles) STRIPPER `data-name`/`data-detail` fra
// naboflisene, men BEHOLDER tekst-elementene (v12.0.11). Navnelabelen er derfor
// alt som er igjen av «hva heter dette» i en naboflis, og fra v5.19.x leser TO
// konsumenter den: 3D-nålene (`tour3d/exploreData.collectGhostFeatures`) og
// kartsøket (`useMapSearch.buildNaboSearchIndex`). Det er nøyaktig den
// situasjonen `svgNestedOffset.js` ble laget for å avslutte — tre nesten like
// kopier av samme regnestykke, to av dem uten flis-offsetet.
//
// Posisjonen er summen av to ledd, og BEGGE må med:
//   • flis-offsetet (`nestedSvgOffset`) — naboflisa er en nested `<svg x y>`, og
//     koordinatene inni den er flis-lokale.
//   • forfedrenes `translate()` — et toppnavn står i en translatert `<g>` der
//     gruppa ER posisjonen, mens text-ens egne x/y bare er en mm-justering.

import { nestedSvgOffset } from './svgNestedOffset.js'

export const NUMERIC_RE = /^[\s-]*\d+([.,]\d+)?(\s*(m|moh|km))?$/i

// Rene tall-/detalj-labels. `peak-ele` står her fordi den er HØYDEN til en
// topp, ikke et navn — den plukkes av readPeakLabel via topp-labelen sin.
// De fire andre fjernes allerede fysisk fra naboflisene i buildGhostSvg; at de
// også står her gjør leseren riktig uansett hvem som kaller den.
export const HOPP_OVER_LABELS = new Set([
  'kontur-tall', 'peak-ele', 'vann-tall', 'dybde-tall', 'dem-topp',
])

// Bare tall (og skilletegn) — «1483», «12–14». Ikke et navn.
const BARE_TALL = /^[\d\s.,–-]+$/
// x/y-attributter uten enhet. Peak-labels bruker «2mm»; det er en mm-justering
// i forhold til gruppa, ikke en posisjon, og skal ikke legges til i meter-rommet.
const UNITLESS_NUM = /^-?[\d.]+$/

/**
 * Tolk én topp-label (`<text data-label="peak">` eller `"peak-ele"`) til
 * `{ name?, ele? }`. Eksportert for test (duck-typet element — trenger kun
 * getAttribute/textContent/childNodes/querySelector).
 *
 * Formater i omløp:
 *  - v12.0.7+ («Stedsnavn-typografi»): høyden ligger som INLINE
 *    `<tspan data-label="peak-ele">` inni navne-teksten. textContent på ytter-
 *    teksten konkatenerer navn+tall («Slottsberget293»), så navnet må leses
 *    fra tekst-nodene alene. Denne varianten brakk søket i v12.0.7–v12.1.21:
 *    tspan-en matchet ikke `text[data-label="peak-ele"]`, toppen fikk aldri
 *    `ele` og ble droppet fra indeksen.
 *  - Eldre kart: navn og høyde som to søsken-`<text>` (peak + peak-ele).
 *  - Navnløs topp: peak-labelen ER høyde-tallet (fallback når navnet var
 *    claimet av en annen label ved bygging).
 */
export function readPeakLabel(t) {
  const lbl = t.getAttribute('data-label')
  if (lbl === 'peak-ele') {
    const n = parseFloat((t.textContent ?? '').trim())
    return Number.isFinite(n) ? { ele: n } : {}
  }
  const out = {}
  const inline = t.querySelector?.('[data-label="peak-ele"]')
  if (inline) {
    const n = parseFloat((inline.textContent ?? '').trim())
    if (Number.isFinite(n)) out.ele = n
  }
  let name = (t.getAttribute('data-name-full') ?? '').trim()
  if (!name) {
    let own = ''
    for (const node of t.childNodes ?? []) {
      if (node.nodeType === 3) own += node.textContent ?? ''
    }
    name = own.trim()
    if (!name && !inline) name = (t.textContent ?? '').trim()
  }
  // Defensivt: eldre applyNameLanguage (≤ v12.1.28) rakk å forurense
  // data-name-full med det inline høyde-tallet («Vardåsen349») — strip et
  // navne-suffiks som er identisk med tspan-høyden.
  if (inline && name) {
    const eleText = (inline.textContent ?? '').trim()
    if (eleText && name !== eleText && name.endsWith(eleText)) {
      name = name.slice(0, -eleText.length).trim()
    }
  }
  if (NUMERIC_RE.test(name)) {
    const n = parseFloat(name)
    if (Number.isFinite(n) && out.ele == null) out.ele = n
  } else if (name) {
    out.name = name
  }
  return out
}

// Kumulert `translate()` fra forfedrene, opp til (men ikke med) `root`.
// Nested `<svg>` bidrar ikke her — de bærer posisjonen sin i x/y, som
// `nestedSvgOffset` tar — så de to leddene overlapper ikke.
function ancestorTranslate(el, root) {
  let dx = 0
  let dy = 0
  for (let n = el?.parentNode; n && n !== root; n = n.parentNode) {
    const t = n.getAttribute?.('transform')
    if (!t) continue
    const m = /translate\(\s*(-?[\d.]+)\s*(?:[, ]\s*(-?[\d.]+))?\s*\)/.exec(t)
    if (m) {
      dx += Number(m[1]) || 0
      dy += Number(m[2] ?? 0) || 0
    }
  }
  return { dx, dy }
}

/**
 * Alle navnelabels i naboflisene, med posisjon i AKTIV flis' meter-rom.
 *
 * Returnerer råe poster — `{ el, label, name, ele, x, y }` — og tar ingen
 * stilling til hva de skal brukes til. 3D mapper `label` til nål-typer, søket
 * bygger indeks-oppføringer; dedupliseringen hører hjemme hos kalleren, som er
 * den eneste som vet hva den deduperer MOT.
 *
 * Merk at en flis kan være DEMONTERT fra DOM-en (v5.19.0). Kall derfor denne
 * inne i `medAlleSpokelserFestet(...)`, ellers ser du bare de flisene som
 * tilfeldigvis er festet i utsnittet akkurat nå.
 *
 * @param {Element} svgEl aktiv flis' `<svg>`
 * @returns {Array<{el: Element, label: string, name: string, ele: number|null, x: number, y: number}>}
 */
export function lesSpokelsesNavn(svgEl) {
  const out = []
  const host = svgEl?.querySelector?.('#ghost-tiles')
  if (!host?.querySelectorAll) return out
  for (const t of host.querySelectorAll('text[data-label]')) {
    const label = t.getAttribute('data-label')
    if (!label || HOPP_OVER_LABELS.has(label)) continue
    let name
    let ele = null
    if (label === 'peak') {
      const info = readPeakLabel(t)
      name = info.name ?? ''
      ele = info.ele ?? null
    } else {
      name = (t.getAttribute('data-name-full') ?? t.textContent ?? '').trim()
    }
    name = name.replace(/\s+/g, ' ').trim()
    if (!name || BARE_TALL.test(name)) continue
    const flis = nestedSvgOffset(t, svgEl)
    const anc = ancestorTranslate(t, svgEl)
    const ax = t.getAttribute('x') ?? ''
    const ay = t.getAttribute('y') ?? ''
    const x = flis.dx + anc.dx + (UNITLESS_NUM.test(ax) ? Number(ax) : 0)
    const y = flis.dy + anc.dy + (UNITLESS_NUM.test(ay) ? Number(ay) : 0)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({ el: t, label, name, ele, x, y })
  }
  return out
}

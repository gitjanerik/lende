// Brukervalgte sti-farger (v2.4.0). Stier tegnes som to søsken-paths med samme
// geometri: en kontinuerlig casing-linje UNDER (bakgrunn) og den stiplede
// streken OVER (forgrunn) — se mapBuilder.js sin casing-tvilling og
// symbolizer.js sine var(--iso-<kode>-stroke / -casing-stroke)-uttak. Denne
// modulen oversetter et {fg, bg}-par til CSS som overstyrer begge.
//
// Erstatter utvikler-knappen «Lilla stier», som satte én hardkodet farge inline
// på wrapper-diven og derfor falt ut av eksport. CSS-en herfra injiseres inne i
// kart-SVG-en, så den følger med i SVG/PNG/PDF/print.

export const TRAIL_FG_CODES = Object.freeze(['505', '506', '507'])
// 507 (stitråkk) har bevisst ingen casingStroke i katalogen — en utydelig sti
// skal ikke løftes over terrenget — så bakgrunnsfargen gjelder kun 505/506.
export const TRAIL_BG_CODES = Object.freeze(['505', '506'])

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const SHORT_HEX_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/

export function isTrailColor(v) {
  return typeof v === 'string' && HEX_RE.test(v)
}

// <input type="color"> godtar kun 6-sifret hex. Katalogen bruker kortformer
// («#000»), så de må utvides før de kan vises i en fargevelger.
export function normalizeHex(v, fallback = '#000000') {
  if (typeof v !== 'string') return fallback
  if (HEX_RE.test(v)) return v.toLowerCase()
  const m = SHORT_HEX_RE.exec(v)
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase()
  return fallback
}

/**
 * CSS som overstyrer sti-fargene. Utelatte/ugyldige verdier gir ingen regler,
 * så «følg tema» er tom streng — og en tom streng lar MapView fjerne
 * <style>-blokken helt i stedet for å injisere en tom.
 *
 * @param {{fg?: string, bg?: string}} colors
 * @returns {string}
 */
export function buildTrailColorCss(colors = {}) {
  const rules = []
  const { fg, bg } = colors ?? {}
  if (isTrailColor(fg)) {
    const sel = TRAIL_FG_CODES.map((c) => `.isom-map [data-iso="${c}"]`).join(', ')
    rules.push(`${sel} { stroke: ${fg} !important; }`)
  }
  if (isTrailColor(bg)) {
    const sel = TRAIL_BG_CODES.map((c) => `.isom-map [data-iso="${c}"] path.casing`).join(', ')
    rules.push(`${sel} { stroke: ${bg} !important; }`)
  }
  return rules.join('\n')
}

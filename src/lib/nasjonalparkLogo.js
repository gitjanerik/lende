// Offisielle nasjonalpark-logoer (Norges nasjonalparker, designet av Snøhetta).
//
// Merkene er den norske nasjonalpark-identiteten og lastes ned som SVG fra
// designmanualen: https://designmanual.norgesnasjonalparker.no/logo/last-ned-logofiler
// Legg filene i `src/assets/nasjonalpark/` med slug-navn (se `parkSlug`) —
// f.eks. `borgefjell.svg` for «Børgefjell nasjonalpark». Bruk den HVITE
// varianten: faktaboksen står på mørk grønn bakgrunn, og SVG-en fargelegges
// ikke om. Se README-en i samme mappe.
//
// Registeret er tomt inntil filene finnes; da faller faktaboksen tilbake til
// ren tekst uten logo. Ingen nettverkskall — merkene bundles.

const files = import.meta.glob('../assets/nasjonalpark/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const registry = new Map()
for (const [path, svg] of Object.entries(files)) {
  const slug = path.split('/').pop().replace(/\.svg$/i, '').toLowerCase()
  if (typeof svg === 'string' && svg.trim()) registry.set(slug, svg)
}

/**
 * Park-navn → filnavn-slug. «Børgefjell nasjonalpark» → «borgefjell»,
 * «Ytre Hvaler nasjonalpark» → «ytre-hvaler». Tospråklige navn beholder
 * begge ledd med bindestrek («Anárjohka» → «anarjohka»).
 */
export function parkSlug(navn) {
  if (!navn) return ''
  return String(navn)
    .toLowerCase()
    .replace(/\bnasjonalparks?\b/g, ' ')
    .replace(/\bálbmot\w*\b/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Rå SVG-markup for parken, eller null når merket ikke er lagt inn ennå. */
export function parkLogoSvg(navn) {
  return registry.get(parkSlug(navn)) ?? null
}

/** Antall innlagte merker — brukes av Utvikler-fanen og testene. */
export function parkLogoCount() {
  return registry.size
}

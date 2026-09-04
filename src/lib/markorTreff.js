// Trefflate for de små markørene i kart-SVG-en: brukerminner, fredede
// kulturminner og NVE-stasjoner.
//
// Symbolene er 3–3,2 mm brede fordi det er ISOM-størrelsen de skal TRYKKES i,
// og den skal ikke endres for en fingers skyld — kartet er print-kvalitet, og
// et ikon som er godt å treffe på en telefon er et ikon som er feil på papiret.
// Trefflaten er derfor skilt fra tegningen, som er samme grep prosjektet
// allerede bruker i 3D: `naermesteISkjerm` for nålene (v6.3.12) og
// `plukkHimmel` for himmelen (v6.0.0). Treffer man ikke figuren, spør vi «hva
// er nærmest fingeren» i SKJERMROM.
//
// HVORFOR IKKE EN USYNLIG SIRKEL PÅ HVER MARKØR, som er den nærliggende
// utveien: kart-SVG-en EKSPORTERES — PNG, PDF, print og .lendekart — så
// hundrevis av 44 px-flater ville fulgt med ut i hver fil. Og markørene lages
// tre steder (bakt av mapBuilder, pluss to runtime-lag), så flaten måtte holdes
// i takt på alle tre. Denne regelen er ETT sted og gjelder alle.
//
// Ren funksjon, uten DOM. Kalleren måler skjermposisjonene.

/**
 * Halve trefflaten. 22 px gir 44 px i diameter, som er minstemålet både WCAG
 * 2.5.8 (AAA) og Apples egen retningslinje setter for et pekemål.
 *
 * Mindre enn nålenes 34 px i 3D med vilje: der er nåla det eneste i nærheten,
 * mens et kulturminne i en by står midt i et kvartal av dem.
 */
export const MARKOR_TREFF_PX = 22

/**
 * Nærmeste markør innen terskelen, målt i CSS-piksler fra trykket.
 *
 * Kandidatene er `{x, y, ...}` — sentrum av markøren på skjermen. Alt annet i
 * objektet følger med ut, så kalleren kan bære elementet sitt der.
 *
 * VED UAVGJORT VINNER DEN FØRSTE. Kalleren sender dem i DOM-rekkefølge, og den
 * er tegne-rekkefølgen: står to markører oppå hverandre, er det den øverste
 * brukeren ser og altså den hun siktet på.
 *
 * @param {number} fx  trykkets x i CSS-piksler (clientX)
 * @param {number} fy  trykkets y i CSS-piksler (clientY)
 * @param {Array<{x: number, y: number}>} kandidater
 * @param {number} [terskel]
 * @returns {object|null}
 */
export function naermesteMarkor(fx, fy, kandidater, terskel = MARKOR_TREFF_PX) {
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null
  let best = null
  let bestAvstand = Infinity
  for (const k of kandidater ?? []) {
    if (!Number.isFinite(k?.x) || !Number.isFinite(k?.y)) continue
    const d = Math.hypot(k.x - fx, k.y - fy)
    if (d > terskel || d >= bestAvstand) continue
    bestAvstand = d
    best = k
  }
  return best
}

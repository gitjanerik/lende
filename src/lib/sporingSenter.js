// Hvor «jeg» skal stå når Sporing åpnes. Sporingsskuffa tar ca. 40 % av høyden
// nedenfra, så den synlige kartflata er de øverste 60 % — midten av den er 30 %.
export const SPORING_SKUFF_ANDEL = 0.4
export const SPORING_ZOOM = 12

/** Fokuspunkt (wrapper-piksler) midt i den delen av kartet skuffa ikke dekker. */
export function sporingFokus(w, h) {
  return { x: w / 2, y: (h * (1 - SPORING_SKUFF_ANDEL)) / 2 }
}

/** Zoom «godt inn» uten å zoome ut en bruker som alt står nærmere. */
export function sporingSkala(naa) {
  return Math.max(Number.isFinite(naa) ? naa : 0, SPORING_ZOOM)
}

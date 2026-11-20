// Maksdyp for oppmålte innsjøer — slått opp på NVEs innsjønummer (vatnlnr).
//
// Tabellen er BAKT (scripts/bygg-innsjodybder.mjs → innsjoDybderData.js), ikke
// hentet ved bygging: NVE Innsjødatabasen har ~600 dybdekartlagte innsjøer av
// 267 000, og tallene endres når noen måler en innsjø på nytt — sjeldnere enn
// hvert år. Et live-oppslag per kart ville vært en ekstra rundtur mot en
// tjeneste for data som ikke har endret seg siden 1979, og det ville ikke
// virket på fjellet.
//
// Rene funksjoner; bake-scriptet og testene deler dem.

import { INNSJO_DYBDER } from './innsjoDybderData.js'

// Hornindalsvatnet er 514 m. Alt over er en registreringsfeil.
export const MAKS_PLAUSIBEL_DYBDE_M = 700

function tall(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Én rad fra Innsjodatabase2-laget «Dybdekart» → { vatnlnr, maks, snitt, aar },
 * eller null når raden ikke har et brukbart maksdyp.
 */
export function radTilDybde(attrs) {
  const vatnlnr = tall(attrs?.vatnlnr)
  const maks = tall(attrs?.maksdyp_m)
  if (vatnlnr == null || vatnlnr <= 0) return null
  if (maks == null || maks <= 0 || maks > MAKS_PLAUSIBEL_DYBDE_M) return null
  const snitt = tall(attrs?.middeldyp_m)
  const aar = tall(attrs?.oppmaltaar)
  return {
    vatnlnr: Math.round(vatnlnr),
    maks,
    snitt: snitt != null && snitt > 0 && snitt <= maks ? snitt : null,
    aar: aar != null && aar >= 1800 && aar <= 2100 ? Math.round(aar) : null,
  }
}

/**
 * Slå sammen rader per innsjø. En innsjø kan stå med flere dybdekart (delbasseng,
 * ny oppmåling); maksdypet er det dypeste av dem, og snitt/år følger raden som
 * eier det.
 * @returns {Map<number, {maks:number, snitt:number|null, aar:number|null}>}
 */
export function samleDybder(rader) {
  const ut = new Map()
  for (const attrs of rader) {
    const d = radTilDybde(attrs)
    if (!d) continue
    const f = ut.get(d.vatnlnr)
    if (!f || d.maks > f.maks) ut.set(d.vatnlnr, { maks: d.maks, snitt: d.snitt, aar: d.aar })
  }
  return ut
}

/** Kildeteksten til den genererte modulen, sortert så en ny bake gir ren diff. */
export function dybdeModulKilde(dybder, { kilde, hentet }) {
  const rader = [...dybder.entries()].sort((a, b) => a[0] - b[0])
    .map(([nr, d]) => `  ${nr}: [${d.maks}, ${d.snitt ?? 'null'}, ${d.aar ?? 'null'}],`)
  return [
    '// GENERERT AV scripts/bygg-innsjodybder.mjs — IKKE REDIGER FOR HÅND.',
    '//',
    `// Maksdyp for dybdekartlagte innsjøer. Kilde: ${kilde}`,
    `// Hentet ${hentet}. ${rader.length} innsjøer.`,
    '//',
    '//   vatnlnr: [maksdyp m, middeldyp m | null, oppmålt år | null]',
    '/* eslint-disable */',
    '',
    'export const INNSJO_DYBDER = {',
    ...rader,
    '}',
    '',
  ].join('\n')
}

/** @returns {{maks:number, snitt:number|null, aar:number|null} | null} */
export function dybdeFor(vatnlnr, tabell = INNSJO_DYBDER) {
  const nr = tall(vatnlnr)
  if (nr == null) return null
  const r = tabell[Math.round(nr)]
  return r ? { maks: r[0], snitt: r[1], aar: r[2] } : null
}

/** «maks 38 m» — under 10 m med én desimal, som dybde-tallene i sjøen. */
export function dybdeEtikett(maks) {
  if (!Number.isFinite(maks) || maks <= 0) return ''
  const t = maks >= 10 ? String(Math.round(maks)) : maks.toFixed(1).replace('.', ',')
  return `maks ${t} m`
}

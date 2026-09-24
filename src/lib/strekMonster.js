// Stiplingsmønstre som følger den EFFEKTIVE strekbredden (v7.9.13).
//
// Fram til v7.9.12 ble bredden skalert med --stroke-scale og «Stier»-slideren,
// mens stroke-dasharray sto i faste mm. En tykkere strek med samme mønster
// fyller igjen lufta — prikkene i 507 ble «kampesteiner i et steingjerde».
// Nå regnes hvert mønster som FAKTORER av bredden, og bredden er ett uttrykk:
//
//   --w = grunnbredde × --stroke-scale × --strek-<gruppe>
//
// --strek-<gruppe> settes av strek-overstyringen (strokeOverrides.js) på
// .isom-map. Et kart bygget før v7.9.13 kjenner ikke variabelen og beholder
// sine bakte mm — det er uendret, ikke ødelagt.
//
// Ren og worker-trygg: ingen DOM.

import { STROKE_GROUPS } from './strokeOverrides.js'

const GRUPPE_FOR_KODE = new Map(
  STROKE_GROUPS.flatMap((g) => g.codes.map((c) => [c, g.id])),
)

export const strekGruppeFor = (code) => GRUPPE_FOR_KODE.get(String(code)) ?? null
export const strekVar = (gruppe) => `--strek-${gruppe}`

const tall = (n) => Number(n.toFixed(4))

/** CSS-uttrykket for den effektive bredden av en strek på `widthMm`. */
export function effektivBredde(widthMm, code) {
  const g = strekGruppeFor(code)
  const mult = g ? ` * var(${strekVar(g)}, 1)` : ''
  return `calc(${widthMm}mm * var(--stroke-scale, 1)${mult})`
}

/**
 * Mønsteret som navngitte faktorer av strekbredden: [{ navn, f }].
 * - `dashFaktor: { strek, gapIndre, gapGruppe }` → dobbelstrek
 *   (strek, indre gap, strek, gruppegap) — 507.
 * - `dashFaktor: { strek, gap }` → vanlig stipling.
 * - ellers `dasharray`/`dash` i mm, delt på `widthMm`, så mønsteret er
 *   pikselidentisk med før ved nøytral skala.
 * Null når streken ikke er stiplet.
 */
export function dashFaktorer(stroke, widthMm = stroke?.widthMm) {
  if (!stroke) return null
  const df = stroke.dashFaktor
  if (df && typeof df === 'object') {
    if (df.gapGruppe != null) {
      return [
        { navn: 'dash', f: df.strek },
        { navn: 'gap-indre', f: df.gapIndre },
        { navn: 'dash', f: df.strek },
        { navn: 'gap-gruppe', f: df.gapGruppe },
      ]
    }
    return [{ navn: 'dash', f: df.strek }, { navn: 'gap', f: df.gap }]
  }
  const mm = stroke.dasharray ?? stroke.dash
  if (!Array.isArray(mm) || !widthMm) return null
  const navn = mm.length === 2 ? ['dash', 'gap'] : mm.map((_, i) => `d${i}`)
  return mm.map((d, i) => ({ navn: navn[i], f: tall(d / widthMm) }))
}

/** Mønsteret i mm ved nøytral skala — for tegnforklaringen og testene. */
export function dashMm(stroke, widthMm = stroke?.widthMm) {
  const fs = dashFaktorer(stroke, widthMm)
  return fs ? fs.map(({ f }) => tall(f * widthMm)) : null
}

/** Temavariabelen for én faktor: --iso-<kode>-<navn>-faktor. */
export const faktorVar = (code, navn) => `--iso-${code}-${navn}-faktor`

/**
 * stroke-dasharray-verdien. Med `code` kan temaet overstyre hver faktor
 * (faktorVar); uten er faktorene bakt (tunneler, overlay).
 */
export function dashCss(faktorer, wExpr, code = null) {
  return faktorer
    .map(({ navn, f }) => {
      const faktor = code ? `var(${faktorVar(code, navn)}, ${f})` : f
      return `calc(${wExpr} * ${faktor})`
    })
    .join(' ')
}

// Lagrede POI-filtervalg for 3D — delt av turvisningen og utforskeren.
//
// Begge visningene viser de samme POI-gruppene, så de deler også valget: slår
// du av brukerminner i utforskeren, er de av i turvisningen også. Det er én
// innstilling i brukerens hode, og da skal det være én i lageret.

import { PIN_GROUPS, groupOfKind } from './exploreData.js'

const NOKKEL = 'lende-3d-pins'

/** Alle grupper på — utgangspunktet for en fersk bruker. */
export function standardPinPrefs() {
  return Object.fromEntries(PIN_GROUPS.map(g => [g.key, true]))
}

export function lesPinPrefs() {
  try {
    const raw = localStorage.getItem(NOKKEL)
    if (!raw) return standardPinPrefs()
    const lagret = JSON.parse(raw)
    // Ukjente nøkler ignoreres, nye grupper får default på — så en ny
    // POI-gruppe ikke blir usynlig for alle som har lagret valg fra før.
    return { ...standardPinPrefs(), ...lagret }
  } catch {
    return standardPinPrefs()
  }
}

export function skrivPinPrefs(prefs) {
  try { localStorage.setItem(NOKKEL, JSON.stringify(prefs)) } catch { /* privat modus */ }
}

/** Settet med grupper som er slått på — det motorene og filtrene bruker. */
export function paaGrupper(prefs) {
  return new Set(Object.entries(prefs ?? {}).filter(([, v]) => v).map(([k]) => k))
}

/** Behold bare features som tilhører en påslått gruppe. */
export function filtrerPaaPrefs(features, prefs) {
  const paa = paaGrupper(prefs)
  return (features ?? []).filter(f => paa.has(groupOfKind(f.kind)))
}

// Ekvidistanse-regler — delt mellom pickeren (MapPickerContent) og MCP-
// serverens bygg_kart, så bredde-reglene ikke driver fra hverandre.
//
// Minste tillatte ekvidistanse skaleres med kartbredde: tett kontur-rendering
// er meningsløst på store kart (overlappende streker, rotete kart uten
// lesbarhet). 20 m er turkart-standarden og default der brukeren ikke har
// bedt om noe finere (ISOM-sprint o.l.).

export const DEFAULT_EQUIDISTANCE_M = 20

//   bredde ≤  2 km  → alle valg (min 2,5 m)
//   2 < bredde < 4  → min 5 m
//   4 ≤ bredde < 6  → min 10 m
//   bredde ≥  6 km  → min 20 m
export function minEquidistanceForWidthKm(km) {
  if (km >= 6) return 20
  if (km >= 4) return 10
  if (km > 2) return 5
  return 2.5
}

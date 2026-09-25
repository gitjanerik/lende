// Ekvidistanse-regler — ÉN kilde, delt av pickeren (MapPickerContent),
// Innstillinger (DrawerAboutTab via useMapSizePreference) og MCP-serverens
// bygg_kart, så bredde-reglene ikke driver fra hverandre.
//
// Minste tillatte ekvidistanse skaleres med kartbredde: tett kontur-rendering
// er meningsløst på store kart (overlappende streker, rotete kart uten
// lesbarhet). 20 m er turkart-standarden og default der brukeren ikke har
// bedt om noe annet.
//
// v6.5.76: 2,5 m og 5 m er FJERNET som valg. Begge forutsatte 1 m DTM og et
// lite ark (ISOM-sprint/-orientering), og med minste kartbredde hevet til 2 km
// fantes 2,5 m-vinduet ikke lenger i det hele tatt. Lagrede preferanser på 2,5
// eller 5 m faller til «auto» av seg selv — `loadEq` slipper bare verdier som
// står i lista.
//
// v7.9.21: 5 m er TILBAKE, etter ønske fra orienteringsfolket — for ark opp til
// og med 4 km. 2,5 m forblir ute.

export const DEFAULT_EQUIDISTANCE_M = 20

// Valgene, med etikett og forklaring — knapperadene i pickeren og i
// Innstillinger bygges av denne lista, så de ikke kan komme i utakt.
export const EQUIDISTANSE_VALG = Object.freeze([
  Object.freeze({ value: 5, label: '5 m', desc: 'orientering — for små områder' }),
  Object.freeze({ value: 10, label: '10 m', desc: 'tett — for mindre områder' }),
  Object.freeze({ value: 20, label: '20 m', desc: 'turkart-standard' }),
  Object.freeze({ value: 25, label: '25 m', desc: 'norsk N50-standard' }),
  Object.freeze({ value: 50, label: '50 m', desc: 'oversikt — for store områder' }),
])

export const EQUIDISTANSE_M = Object.freeze(EQUIDISTANSE_VALG.map(o => o.value))

// Grensene er INKLUSIVE («opp til og med»), fra v7.9.21:
//   bredde ≤  4 km  → alle valg (min 5 m)
//   4 < bredde ≤  6 → min 10 m
//   6 < bredde ≤ 10 → min 20 m
//   bredde > 10 km  → min 25 m
//
// Tabellen beskriver hvor fine høydekurver et ark TÅLER, ikke hvilket ark man
// får, og følger derfor ikke standard-bredden (8 km → 20 m). Den topper på
// 25 — 50 m er alltid valgbart, aldri påtvunget, også for MCP-kart bredere enn
// appens egen slider rekker.
export function minEquidistanceForWidthKm(km) {
  if (km > 10) return 25
  if (km > 6) return 20
  if (km > 4) return 10
  return 5
}

// Hvorfor et valg er utelukket ved gjeldende bredde. Delt av pickeren og
// Innstillinger — to kopier av denne teksten kom i utakt med tabellen over.
export function breddeHintFor(value) {
  if (value === 5) return 'Krever bredde på høyst 4 km'
  if (value === 10) return 'Krever bredde på høyst 6 km'
  if (value === 20) return 'Krever bredde på høyst 10 km'
  return ''
}

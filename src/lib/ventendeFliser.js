// ventendeFliser.js — hva mosaikken SKYLDER å bygge, uavhengig av hvem som ba
// om det.
//
// Sømmen går her fordi dette ikke er «hvordan brukeren utvider kartet» (det er
// kanthåndtakene, som bor i useMapExtend) — det er bokføringen over fliser noen
// satte seg fore å bygge og ikke rakk. Skillet var akademisk så lenge
// kant-utvidelsen var eneste kilde; nå har bokføringen to konsumenter (den
// manuelle utvidelsen og den kontinuerlige flis-lastingen), og da skal den ikke
// ligge inne i den ene av dem.
//
// Regnestykkene under er dessuten den delen som er lett å få galt (fortegnet i
// UTM→SVG) og lett å teste, og de har ingen Vue-avhengigheter.

// Celle-identitet. Nordvest-hjørnet i absolutt UTM avrundet til meter — samme
// celle får samme nøkkel enten den kommer fra bokføringen eller fra geometrien,
// så de to kildene kan slås sammen uten å tilby samme flis to ganger.
export const cellenokkel = (ub) => (ub ? `${Math.round(ub.minE)}:${Math.round(ub.maxN)}` : '')

// Absolutt UTM-bbox → senter i aktiv-flisas meter-rom. SVG-y vokser SØROVER og
// er 0 ved arkets maxN, så toppkanten er (m.maxN − ub.maxN) — ikke omvendt.
export function ventendeSenter(ub, m) {
  if (!ub || m?.minE == null || m?.maxN == null) return null
  const x = (ub.minE - m.minE) + (ub.maxE - ub.minE) / 2
  const y = (m.maxN - ub.maxN) + (ub.maxN - ub.minN) / 2
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

// Hvor langt fra arket vi står på en ventende flis kan ligge før vi antar at den
// hører til et annet kart. Mosaikken tegner selv maks 3 flisebredder unna.
export const VENTENDE_RADIUS_TILES = 4

// Hører spesifikasjonen til DETTE arket? Returnerer senteret i arkets meter-rom
// hvis ja, ellers null. Konservativt med vilje: annen flisestørrelse eller langt
// utenfor rekkevidde betyr et annet kart, og da skal flisa ikke tilbys her.
export function ventendePaaArket(spek, m, radiusTiles = VENTENDE_RADIUS_TILES) {
  const ub = spek?.utmBbox
  if (!ub || !m || m.minE == null) return null
  const W = m.widthM, H = m.heightM
  if (Math.abs((ub.maxE - ub.minE) - W) > 1 || Math.abs((ub.maxN - ub.minN) - H) > 1) return null
  const c = ventendeSenter(ub, m)
  if (!c) return null
  if (Math.abs(c.x) > radiusTiles * W || Math.abs(c.y) > radiusTiles * H) return null
  return c
}

// ── Ventende fliser — bokføring, ikke gjetning ───────────────────────────────
// En avbrutt utvidelse (reload, app-lukking, en flis som feiler midt i løkka)
// etterlater et ark som ikke er ferdig. `findGridGaps` finner bare INNELUKKEDE
// hull, med vilje: en bounding-box-variant rapporterte fantom-hull under vanlig
// panorering og bygde utsnitt ingen ba om (se tileCache.js). Men utvidelsen
// fyller PERIMETERET, så det den etterlater er et hakk i ytterkanten — og
// geometri alene kan ikke skille «avbrutt bygging» fra «diagonal panorering».
//
// Informasjonen finnes ikke i formen, men den finnes i intensjonen: extendMap
// vet nøyaktig hvilke fliser den satte seg fore å bygge. Den skrives ned før
// byggingen og strykes flis for flis, så et avbrudd etterlater en presis liste
// over det som mangler — uten terskler og uten falske positive.
//
// Spesifikasjonene er SELVSTENDIGE (senter som lat/lon + absolutt UTM-bbox), så
// de overlever at en annen flis blir aktiv og koordinatrommet flyttes.
export const VENTENDE_KEY = 'lende-ventende-fliser'

export function lesVentende() {
  try {
    const v = JSON.parse(localStorage.getItem(VENTENDE_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter(s => s?.utmBbox && s?.opts) : []
  } catch { return [] }
}
// Fliser en bruker aldri bygger blir aldri strøket, så lista må ha et tak: den
// er ikke en logg, den er «hva mangler nå». Nyeste beholdes.
export const VENTENDE_MAKS = 24
export function skrivVentende(liste) {
  const kappet = liste.slice(-VENTENDE_MAKS)
  try {
    if (kappet.length) localStorage.setItem(VENTENDE_KEY, JSON.stringify(kappet))
    else localStorage.removeItem(VENTENDE_KEY)
  } catch { /* privat modus — da mister vi bare bokføringen */ }
}
export function leggTilVentende(spekker) {
  const sett = new Set(spekker.map(s => cellenokkel(s.utmBbox)))
  skrivVentende([...lesVentende().filter(s => !sett.has(cellenokkel(s.utmBbox))), ...spekker])
}
export function fjernVentende(utmBbox) {
  const n = cellenokkel(utmBbox)
  skrivVentende(lesVentende().filter(s => cellenokkel(s.utmBbox) !== n))
}

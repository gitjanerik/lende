// Hvordan OSM-flisene ligger i R2. Klienten ser enkeltfiler (`<rad>_<kol>.json.gz`,
// `delt/<type>_<id>.json.gz`), men i bøtta er de PAKKET: én fil per 1° × 1° med
// en indeks ved siden av, og proxy-Workeren leser ut én flis med en range-GET.
//
// Grunnen er opplastingen, ikke lesingen. Hele landet er titusenvis av fliser,
// og Cloudflares API tar 1 200 kall per fem minutter — én PUT per flis ville
// tatt timer. Pakket er det noen hundre filer.
//
// Delt av baken (scripts/last-opp-osm-fliser.mjs) og Workeren
// (cloudflare/proxy). Ren, og uten import: Workeren skal ikke dra mapBuilder
// inn i bunten sin via osmFlis.js.

export const PAKKE_RADER = 20      // × 0,05° = 1° nord–sør
export const PAKKE_KOLONNER = 10   // × 0,1°  = 1° øst–vest
export const DELT_PAKKE = 'delt'

const FLIS = /^(-?\d+)_(-?\d+)\.json\.gz$/
const DELT = /^delt\/(node|way|relation)_\d+\.json\.gz$/

export function osmStiErGyldig(sti) {
  return FLIS.test(sti) || DELT.test(sti)
}

/** Pakken en klient-sti ligger i, eller null for en sti som ikke er vår. */
export function osmPakkeForSti(sti) {
  if (DELT.test(sti)) return DELT_PAKKE
  const m = sti.match(FLIS)
  if (!m) return null
  return `${Math.floor(Number(m[1]) / PAKKE_RADER)}_${Math.floor(Number(m[2]) / PAKKE_KOLONNER)}`
}

export const pakkeNokkel = (prefiks, pakke) => `${prefiks}/${pakke}.bin`
export const indeksNokkel = (prefiks, pakke) => `${prefiks}/${pakke}.idx.json`

/** Bake-id fra OSM-tidsstempelet: `2026-11-13T21:22:20Z` → `20261113T212220Z`. */
export function bakeId(tid) {
  return String(tid).replace(/[-:]/g, '').replace(/\.\d+/, '')
}

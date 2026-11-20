// Søkelista over innsjøer med dybdekurver (`public/data/innsjo-dybde/indeks.json`,
// bakt av scripts/bygg-innsjodybder.mjs). Ren filtrering + én henting.

const BASE =
  `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}data/innsjo-dybde/`

// Eksemplene i teksten i «Om appen». Står de ikke i indeksen (ingen kurver),
// faller de bare bort fra teksten.
export const EKSEMPEL_INNSJOER = ['Bogstadvannet', 'Tyrifjorden', 'Hornindalsvatnet', 'Gjende', 'Vansjø', 'Setten', 'Fjorda']

let lofte = null
export function hentInnsjoIndeks({ basePath = BASE } = {}) {
  if (!lofte) {
    lofte = (async () => {
      const res = await fetch(`${basePath}indeks.json`, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      return j?.v === 1 && Array.isArray(j.innsjoer) ? j.innsjoer : []
    })()
    lofte.catch(() => { lofte = null })
  }
  return lofte
}

const norm = (t) => String(t ?? '').toLocaleLowerCase('nb').normalize('NFC')

/**
 * Treff i navn eller alias. Navn som STARTER med søket kommer først, så «sett»
 * gir Setten før Mosetten-tjernet. Tomt søk gir alle med navn, største først —
 * det er de store padlevannene man leter etter uten å vite navnet.
 */
export function filtrerInnsjoer(liste, sok) {
  const q = norm(sok).trim()
  const medNavn = liste.filter(i => i.navn)
  if (!q) return [...medNavn].sort((a, b) => (b.km2 ?? 0) - (a.km2 ?? 0))
  const start = []
  const inni = []
  for (const i of medNavn) {
    const n = norm(i.navn)
    const a = norm(i.alias)
    if (n.startsWith(q) || a.startsWith(q)) start.push(i)
    else if (n.includes(q) || a.includes(q)) inni.push(i)
  }
  return [...start, ...inni]
}

/** Eksemplene som faktisk finnes, i den rekkefølgen teksten nevner dem. */
export function eksempler(liste, navn = EKSEMPEL_INNSJOER) {
  return navn.map(n => liste.find(i => i.navn === n)).filter(Boolean)
}

/** Bestillingen et klikk sender til «Mine kart». */
export function kartBestilling(i) {
  return { lat: i.lat, lon: i.lon, navn: i.navn ?? `Innsjø ${i.nr}`, km: i.km, stil: 'padling' }
}

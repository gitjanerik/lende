// Cache-nøkkel for de bakte N50-flisene.
//
// Flisene er store (0,5° × 1°, opptil 2,4 MB) og har FASTE filnavn — det er
// nettopp derfor de kan caches, og nettopp derfor de ikke kan caches på navnet
// alene: en ny bake skriver samme filnavn med nytt innhold. Nøkkelen er en hash
// av MANIFESTET, som er den ene fila som endrer seg når baken gjør det, og som
// klienten uansett henter og parser først.
//
// Nøkkelen henges på flis-URL-en som `?m=…`. Det gjør den til en del av
// cache-nøkkelen i service workeren (som ikke trenger å forstå noe om N50), og
// en ny bake blir da automatisk en cache-bom i stedet for et gammelt svar.
// Kallere som ikke bruker `fetch` (MCP/headless leser flisene fra disk) rører
// dette aldri — suffikset legges på i fetch-stien, ikke i sti-byggingen.

const nokler = new Map()   // basePath → nøkkel

/** djb2 over manifest-teksten → kort base36-nøkkel. */
export function lagFlisNokkel(manifestTekst) {
  let h = 5381
  for (let i = 0; i < manifestTekst.length; i++) h = ((h * 33) ^ manifestTekst.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function settFlisNokkel(basePath, manifestTekst) {
  nokler.set(basePath, lagFlisNokkel(manifestTekst))
}

export function nullstillFlisNokler() { nokler.clear() }

/** Flis-URL med cache-nøkkelen påhengt. Ukjent base ⇒ URL-en uendret. */
export function medFlisNokkel(url, basePath) {
  const n = nokler.get(basePath)
  if (!n) return url
  return url.includes('?') ? `${url}&m=${n}` : `${url}?m=${n}`
}

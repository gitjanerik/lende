// Arealdekke-sammenslåingen: hvordan OSM-arealdekke og N50 slås sammen.
//
// Delt av appen (createMapFlow) og den headless kart-byggingen (mcp/headless,
// som MCP-serveren og fasit-suiten bygger gjennom). Den er delt FRA FØRSTE
// LINJE med vilje: vann-stacken hadde to versjoner som sprikte i månedsvis, og
// MCP-bygde kart mistet elvene sine uten at noen gate så det (v5.18.3). Den
// feilen skal ikke gjentas for arealdekke.
//
// PRINSIPPET er det samme som for vann: en kilde er autoritativ for DET DEN
// FAKTISK LEVERER, og ikke for noe mer. N50-baken leverer i dag MYR og
// ingenting annet — ikke skog, ikke åpen mark, ikke dyrka mark. Flagget
// avledes derfor av hva flisene faktisk inneholder (`arealKildeFlagg`), ikke
// av at kilden svarte. Legger noen skog til baken senere, skal `harSkog` bli
// sann av seg selv og OSM-skogen vike uten at denne fila må endres.
//
// ── Hvorfor OSM-myra vikes i det hele tatt ─────────────────────────────────
// N50 har landsdekkende myr; OSM har spredte flekker. Der begge finnes,
// beskriver de SAMME myra med ulik generalisering, og myr-mønsteret er
// halvgjennomsiktig — to lag oppå hverandre gir en synlig mørkere flate som
// leser som «utrygg myr» der det bare er dobbelt-tegning.

const OSM_MYR = (t) => String(t?.natural ?? '').toLowerCase() === 'wetland'
// OSM-skog: begge taggene symbolizer klassifiserer til ISOM 406. `scree` og
// `bare_rock` holdes UTE — de er berg i dagen, ikke skog, og N50s `Skog`
// erstatter dem ikke.
const OSM_SKOG = (t) => String(t?.natural ?? '').toLowerCase() === 'wood'
  || String(t?.landuse ?? '').toLowerCase() === 'forest'

/**
 * Hva inneholder N50-arealdekket vi faktisk fikk? Ett flagg per ting en kilde
 * KAN være autoritativ for. Tomt svar (ingen fliser bakt, offline, utenfor
 * dekning) gir bare `false`-er, og da røres ikke OSM.
 *
 * @param {Array<{tags?: object}>} n50Areal elementer fra n50ArealFetcher
 */
export function arealKildeFlagg(n50Areal) {
  const flagg = { harMyr: false, harSkog: false, harApen: false }
  for (const el of n50Areal ?? []) {
    const t = String(el?.tags?.['lende:n50areal'] ?? '').toLowerCase()
    if (t === 'myr') flagg.harMyr = true
    else if (t === 'skog') flagg.harSkog = true
    else if (t === 'apen') flagg.harApen = true
  }
  return flagg
}

/**
 * Slå sammen OSM-elementer og N50-arealflater.
 *
 * Returnerer en NY liste; input røres ikke.
 *
 * @param {{osm: Array<object>, n50Areal?: Array<object>}} kilder
 * @returns {Array<object>}
 */
export function slaaSammenAreal({ osm = [], n50Areal = [] } = {}) {
  const flagg = arealKildeFlagg(n50Areal)
  if (!n50Areal.length) return [...osm]

  // Hver kilde-egenskap fortrenger BARE sin egen motpart. Bærer baken myr men
  // ikke skog, står OSM-skogen urørt — og omvendt. Det er hele poenget med at
  // flagget avledes av innholdet.
  const beholdt = osm.filter((el) => {
    const t = el?.tags
    if (flagg.harMyr && OSM_MYR(t)) return false
    if (flagg.harSkog && OSM_SKOG(t)) return false
    return true
  })

  return [...beholdt, ...n50Areal]
}

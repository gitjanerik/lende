// Arealdekke-sammenslåingen: hvordan OSM-arealdekke og N50 slås sammen.
//
// Delt av appen (createMapFlow) og den headless kart-byggingen (mcp/headless,
// som MCP-serveren og fasit-suiten bygger gjennom). Den er delt FRA FØRSTE
// LINJE med vilje: vann-stacken hadde to versjoner som sprikte i månedsvis, og
// MCP-bygde kart mistet elvene sine uten at noen gate så det (v5.18.3). Den
// feilen skal ikke gjentas for arealdekke.
//
// PRINSIPPET er det samme som for vann: en kilde er autoritativ for DET DEN
// FAKTISK LEVERER, og ikke for noe mer. Flagget avledes derfor av hva flisene
// faktisk inneholder (`arealKildeFlagg`), ikke av at kilden svarte.
//
// Det prinsippet betalte seg i v5.26.0: baken bar bare myr, og skogen var
// aldri utelatt av en arkitektur-grunn — den var bare ikke bedt om. `--typer`
// sto på sin default `myr`, og workflowen hadde ingen knott for den. Da skogen
// ble bakt, ble `harSkog` sann av seg selv og OSM-skogen vek, uten at én linje
// her måtte røres. `apen` er fortsatt ikke bakt, og `harApen` er derfor
// fortsatt usann — som den skal være.
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
// OSM-isbre. Bre-FLATER viker for N50, men bre-NAVN gjør det ikke: N50
// Arealdekke bærer ingen navn, så et navngitt OSM-polygon er den eneste
// navnekilden vi har der bake-navnene ikke rekker. Se `beholdNavn` under.
const OSM_ISBRE = (t) => String(t?.natural ?? '').toLowerCase() === 'glacier'

/**
 * Hva inneholder N50-arealdekket vi faktisk fikk? Ett flagg per ting en kilde
 * KAN være autoritativ for. Tomt svar (ingen fliser bakt, offline, utenfor
 * dekning) gir bare `false`-er, og da røres ikke OSM.
 *
 * @param {Array<{tags?: object}>} n50Areal elementer fra n50ArealFetcher
 */
export function arealKildeFlagg(n50Areal) {
  const flagg = { harMyr: false, harSkog: false, harApen: false, harIsbre: false }
  for (const el of n50Areal ?? []) {
    const t = String(el?.tags?.['lende:n50areal'] ?? '').toLowerCase()
    if (t === 'myr') flagg.harMyr = true
    else if (t === 'skog') flagg.harSkog = true
    else if (t === 'apen') flagg.harApen = true
    else if (t === 'isbre') flagg.harIsbre = true
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
  // En OSM-flate som bærer NAVN beholdes selv der N50 har overtatt geometrien.
  // N50 Arealdekke har ingen navnefelt, så et undertrykt `natural=glacier` med
  // `name` ville tatt Briksdalsbreen av kartet sammen med sin egen dublett.
  // Flata blir liggende under N50s, som er finere generalisert, og bidrar i
  // praksis bare med etiketten — det er nettopp den vi vil ha.
  const beholdNavn = (el) => !!String(el?.tags?.name ?? '').trim()

  const beholdt = osm.filter((el) => {
    const t = el?.tags
    if (flagg.harMyr && OSM_MYR(t)) return false
    if (flagg.harSkog && OSM_SKOG(t)) return false
    if (flagg.harIsbre && OSM_ISBRE(t) && !beholdNavn(el)) return false
    return true
  })

  return [...beholdt, ...n50Areal]
}

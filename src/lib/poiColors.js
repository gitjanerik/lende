// Felles fargekilde for POI-er, delt av 2D-kartet og 3D-visningen.
//
// Fargene lå tidligere to steder: fredet-diamantene i useHeritageLayers og
// brukerminne-firkantene som CSS-regler i symbolizer. Da 3D-utforskeren skulle
// plante knappenåler i de samme fargene, ville en tredje kopi gjort at «lilla
// kulturminne» kunne bety én ting i kartet og en annen i 3D neste gang noen
// justerte en hex. Begge leser herfra nå, så skillet lilla/grått er det samme
// per konstruksjon.

// Fredet kulturminne (Riksantikvaren/Askeladden), diamant-ikonet — pr vernetype.
export const FREDET_KAT_COLOR = {
  automatisk: '#8e44ad',
  forskrift: '#c0392b',
  vedtak: '#d35400',
  listefort: '#138d75',
  annet: '#7f8c8d',
}

// Brukerminne (Kulturminnesøk), fasade-firkanten — pr utledet kategori.
// Bevisst utenfor ISOM-paletten (grønn/blå/brun-terreng) så kulturminnene
// leser som et eget tematisk lag.
export const BRUKERMINNE_KAT_COLOR = {
  annet: '#6d4c41',
  fangst: '#b8730f',
  gravminne: '#7d3c98',
  stein: '#5d6d7e',
  bygning: '#b03a2e',
}

// Øvrige POI-typer, brukt av knappenålene i 3D. Nøklene er `kind`-verdiene
// fra søkeindeksen (buildSearchIndex) pluss de nettbaserte kildene.
export const POI_KIND_COLOR = {
  peak: '#8b5a2b',
  hoydepunkt: '#8b5a2b',
  'vann-navn': '#0ea5e9',
  'vann-omrade': '#0ea5e9',
  nve: '#1d4ed8',
  'hytte-navn': '#1f2937',
  'naturreservat-navn': '#15803d',
  naturreservat: '#15803d',
  omrade: '#6b7280',
  stedsnavn: '#6b7280',
  parkering: '#1d4ed8',
}

const FALLBACK = '#6b7280'

/**
 * Farge for et POI slik det skal tegnes som knappenål i 3D.
 * Kulturminner grener på kategorien de bærer med seg, resten på `kind`.
 * @param {{kind: string, categories?: string[]|null, detail?: object|null}} feature
 * @returns {string} hex
 */
export function poiColor(feature) {
  if (!feature?.kind) return FALLBACK
  if (feature.kind === 'kulturminne') {
    return FREDET_KAT_COLOR[feature.detail?.kulturminne?.kategori] ?? FREDET_KAT_COLOR.annet
  }
  if (feature.kind === 'brukerminne') {
    return BRUKERMINNE_KAT_COLOR[feature.detail?.kat] ?? BRUKERMINNE_KAT_COLOR.annet
  }
  const direct = POI_KIND_COLOR[feature.kind]
  if (direct) return direct
  if (feature.categories?.includes('vann')) return POI_KIND_COLOR['vann-navn']
  return FALLBACK
}

/**
 * CSS-reglene for brukerminne-laget, generert fra tabellen over.
 * Kalles av symbolizer slik at kart-CSS og 3D-nåler ikke kan drive fra hverandre.
 * @param {string} root scope-selektor (`.isom-map`)
 * @returns {string[]}
 */
export function brukerminneColorRules(root) {
  const rules = [
    `${root} [data-layer="kulturminne"] g[data-kat] { color: ${BRUKERMINNE_KAT_COLOR.annet}; cursor: pointer; }`,
  ]
  for (const [kat, hex] of Object.entries(BRUKERMINNE_KAT_COLOR)) {
    if (kat === 'annet') continue
    rules.push(`${root} [data-layer="kulturminne"] g[data-kat="${kat}"] { color: ${hex}; }`)
  }
  return rules
}

// Vann-sammenslåingen: hvordan OSM-vann og de autoritative norske kildene
// (N50/NVE-innsjø, Sjøkart) slås sammen til ÉN vann-stack.
//
// Delt av appen (createMapFlow) og den headless kart-byggingen (mcp/headless,
// som MCP-serveren og fasit-suiten bygger gjennom). De to hadde hver sin
// versjon, og de sprikte: appen gjorde per-flate-dekningstester og beholdt
// elveløp, mens headless kastet ALT OSM-vann i det kilden returnerte én eneste
// innsjø. Resultatet var at MCP-bygde kart mistet elvene sine — Rondvassbu gikk
// fra 72,7 til 14,6 km elv, Kolstadøya fra 7,5 til 0. Nå er det én kode.
//
// PRINSIPPET: en kilde er autoritativ for DET DEN FAKTISK LEVERER, og ikke for
// noe mer. NVE Innsjødatabasen leverer stillestående ferskvann — innsjøer og
// magasiner, med korrekte øy-hull — og INGENTING annet: ingen elveløp, ingen
// bekker, ingen havflate. Derfor avledes hvert undertrykkelses-flagg av hva
// kilden inneholder, ikke av at den svarte i det hele tatt.
//
// Det siste var den konkrete feilen (v5.18.3). Fram til da het flagget
// `n50HasFreshwater` og styrte BÅDE innsjø-flater og bekke-LINJER. Den gang
// hentet kilden hele N50-vannstacken (Havflate + Innsjø + ElvBekk), så det
// stemte. Da kilden ble lagt om til NVE Innsjødatabasen (innsjøer alene),
// beholdt flagget navnet og konsumentene sin oppførsel — og OSM-bekkene ble
// undertrykt av en kilde som ikke har en eneste bekk å erstatte dem med.

import { isOsmWaterSalty, isFlowingWaterArea } from './symbolizer.js'
import { pointInRing } from './marineTopology.js'

// Areal-vektet sentroid (lon/lat) for en ring av {lat,lon}- eller [lon,lat]-
// punkter. Faller til punkt-gjennomsnitt for degenererte ringer.
export function ringCentroidLonLat(pts) {
  if (!Array.isArray(pts) || pts.length === 0) return null
  const lon = (p) => (p.lon ?? p[0]); const lat = (p) => (p.lat ?? p[1])
  const n = pts.length
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < n; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n]
    const x1 = lon(p1), y1 = lat(p1), x2 = lon(p2), y2 = lat(p2)
    const cross = x1 * y2 - x2 * y1
    a += cross; cx += (x1 + x2) * cross; cy += (y1 + y2) * cross
  }
  if (a !== 0 && Number.isFinite(cx)) return [cx / (3 * a), cy / (3 * a)]
  let sx = 0, sy = 0, c = 0
  for (const p of pts) { sx += lon(p); sy += lat(p); c++ }
  return c ? [sx / c, sy / c] : null
}

// Representativt indre punkt [lon,lat] for et OSM-vann-element (way eller
// multipolygon-relation). Brukes til å teste om en kilde faktisk dekker flata.
export function elementRepPoint(el) {
  if (Array.isArray(el?.geometry) && el.geometry.length) {
    return ringCentroidLonLat(el.geometry)
  }
  if (Array.isArray(el?.members)) {
    let best = null
    for (const m of el.members) {
      if ((m.role === 'outer' || !m.role) && Array.isArray(m.geometry) && m.geometry.length >= 3) {
        if (!best || m.geometry.length > best.length) best = m.geometry
      }
    }
    if (best) return ringCentroidLonLat(best)
  }
  return null
}

/**
 * Ytre ringer (lon/lat) fra en liste kart-elementer — dekningsflaten en kilde
 * er autoritativ innenfor.
 *
 * `inkluderWays` er med fordi appen har hentet ringene på to ulike måter for
 * de to kildene sine: N50-vann fra både `way.geometry` og relations-medlemmer,
 * NVE-innsjøer BARE fra medlemmer. Det siste betyr at en hull-løs NVE-innsjø
 * (som er en `way`) ikke gir dekning. Det ser ut som en forglemmelse, men å
 * rette den her ville endret appens vann-rendring uten at noen måler det —
 * fasit-suiten bygger gjennom headless, som ikke henter NVE-laget i det hele
 * tatt. Derfor er asymmetrien beholdt og synlig i stedet for stilltiende rettet.
 */
export function ytreRinger(elementer, { inkluderWays = true } = {}) {
  const ringer = []
  for (const el of elementer ?? []) {
    if (inkluderWays && el?.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 3) {
      ringer.push(el.geometry.map(g => [g.lon, g.lat]))
    } else if (Array.isArray(el?.members)) {
      for (const m of el.members) {
        if ((m.role === 'outer' || !m.role) && Array.isArray(m.geometry) && m.geometry.length >= 3) {
          ringer.push(m.geometry.map(g => [g.lon, g.lat]))
        }
      }
    }
  }
  return ringer
}

/**
 * Hva inneholder den autoritative kilden faktisk?
 *
 * @param {Array} kilde  elementene kilden leverte (N50-vann / NVE-innsjø)
 * @returns {{harSjo: boolean, harInnsjo: boolean, harBekk: boolean}}
 */
export function vannKildeFlagg(kilde) {
  const els = kilde ?? []
  return {
    harSjo: els.some(el => el.tags?.water === 'sea' || el.tags?.salt === 'yes'),
    harInnsjo: els.some(el => el.tags?.natural === 'water' && el.tags?.salt !== 'yes'),
    harBekk: els.some(el => el.tags?.waterway === 'stream' || el.tags?.waterway === 'ditch'),
  }
}

const dekketAv = (el, ringer) => {
  if (!ringer || ringer.length === 0) return false
  const p = elementRepPoint(el)
  if (!p) return false
  for (const ring of ringer) if (pointInRing(p[0], p[1], ring)) return true
  return false
}

// Per-element OSM-vann-filter. De autoritative norske kildene (N50 vann, NVE
// innsjø-flater, Sjøkart) er foretrukket der de finnes, men de dekker bare
// deler av vann-stacken:
//   • Saltvann → behold kun hvis kilden ikke har sjø (ellers er den autoritativ).
//   • Elve-/kanal-/bekke-FLATER (isFlowingWaterArea) → behold ALLTID. Dette er
//     regresjons-vakten: uten den droppes brede elver (Drammenselva, tagget
//     natural=water+water=river) så snart NVE/N50 returnerer ferskvann, og det
//     som står igjen er bare den hårtynne waterway=river-senterlinja (304).
//   • Innsjø-flate → undertrykk KUN der kilden faktisk har en innsjø som dekker
//     flata (sentroiden ligger i en kilde-ring). NVEs respons er ofte
//     UFULLSTENDIG (ArcGIS-record-cap returnerer bare de første N flatene i
//     bbox-en), så en blanket «NVE finnes → dropp ALT OSM-ferskvann» slettet
//     innsjøer NVE ikke returnerte (Ulvenvatnet i Dikemark forsvant helt, og
//     Rondvassbu mistet 37 navnløse høyfjells-tjern). Per-flate-dekning gjør
//     kilden autoritativ DER den har data og lar OSM fylle hullene. Mistaggede
//     flom-innsjøer (Røssvatnet) dekkes fortsatt av sin NVE-innsjø →
//     undertrykt som før.
//   • Bekke-/grøfte-LINJER → undertrykk kun når kilden SELV har bekker
//     (`n50HasStreams`). NVE Innsjødatabasen har ingen, så der beholdes OSM.
// I nettleseren feiler WFS-kildene ofte (CORS) → alle flagg false → alt
// OSM-vann beholdes uendret.
export function filterOsmWaterElements(elements, flags = {}) {
  const {
    n50HasSea = false, n50HasStreams = false,
    nveLakeRings = null, n50WaterRings = null,
  } = flags
  const nveRings = Array.isArray(nveLakeRings) ? nveLakeRings : null
  const n50Rings = Array.isArray(n50WaterRings) ? n50WaterRings : null
  return (elements ?? []).filter(el => {
    const tags = el.tags ?? {}
    const isWaterPolygon = tags.natural === 'water' || !!tags.water ||
                           tags.natural === 'bay' || tags.natural === 'strait' ||
                           tags.place === 'sea' || tags.place === 'ocean'
    if (isWaterPolygon) {
      if (isOsmWaterSalty(tags)) return !n50HasSea
      // Elveløp som flate — verken NVE eller N50 har den, så aldri undertrykk.
      if (isFlowingWaterArea(tags)) return true
      // N50 (FGB) er autoritativ DER den har innsjøen, og har de riktige øy-
      // hullene. Overlappende OSM-innsjø (også NAVNGITT, f.eks. Setten) droppes
      // så den hull-løse OSM-kopien ikke males opakt over øya (Kolstadøya).
      if (dekketAv(el, n50Rings)) return false
      // Ferskvanns-polygon: kilden er autoritativ KUN der den har innsjøen.
      // Dekker den ikke flata, er OSM eneste kilde til at vannet finnes — da
      // skal det stå, navngitt eller ei. Fram til v5.18.3 falt navnløse tjern
      // gjennom til en blankett-regel («kilden har ferskvann → dropp resten»),
      // og et høyfjellskart der de fleste tjern er navnløse mistet dem i bunt:
      // Rondvassbu gikk fra 50 til 13 vannflater. Blankett-regelen er arven
      // etter designet FØR per-flate-dekningstesten; nå avgjør dekningen alene.
      if (dekketAv(el, nveRings)) return false
      return true
    }
    if (tags.waterway === 'stream' || tags.waterway === 'ditch') {
      return !n50HasStreams
    }
    return true
  })
}

/**
 * Slå sammen OSM-vann med de autoritative kildene. ÉN funksjon for begge
 * pipelinene — appen og headless skal produsere samme vann av samme data.
 *
 * @param {{osm: Array, n50Water?: Array, nveLakes?: Array}} arg
 *   osm       alle OSM-elementer (ikke bare vann — resten passerer uberørt)
 *   n50Water  N50/NVE-innsjø-flater (fetchN50Water)
 *   nveLakes  NVE-innsjøer fra identify-fallbacken (fetchNveLakePolygons)
 * @returns {Array} elementlista, klar for buildSvg
 */
export function slaaSammenVann({ osm = [], n50Water = [], nveLakes = [] }) {
  const flagg = vannKildeFlagg(n50Water)
  const n50WaterRings = ytreRinger(n50Water)
  // Se ytreRinger: NVE-ringene hentes bare fra relations, som i appen.
  const nveLakeRings = ytreRinger(nveLakes, { inkluderWays: false })

  // `harInnsjo` mates BEVISST ikke inn: for innsjø-flater er det DEKNINGEN
  // (ringene) som avgjør, ikke om kilden har innsjøer i det hele tatt.
  const ut = filterOsmWaterElements(osm, {
    n50HasSea: flagg.harSjo,
    n50HasStreams: flagg.harBekk,
    nveLakeRings,
    n50WaterRings,
  })
  if (n50Water.length) ut.push(...n50Water)
  // NVE-innsjøer som N50 alt dekker droppes (N50 har de korrekte øy-hullene).
  const nveBeholdt = n50WaterRings.length
    ? nveLakes.filter(l => !dekketAv(l, n50WaterRings))
    : nveLakes
  if (nveBeholdt.length) ut.push(...nveBeholdt)
  return ut
}

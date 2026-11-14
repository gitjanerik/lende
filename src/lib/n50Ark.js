// N50-arket: et turkart bygget uten OSM, mens Overpass fortsatt svarer.
//
// Overpass bruker 30–60 s på et vanlig ark (2 plasser per IP, 429 når de er
// tatt — se docs/PLAN_OSM_UAVHENGIG.md), mens DEM, NVE-vann og de bakte
// N50-flisene er inne på noen sekunder. Kommer OSM ikke innen en kort frist
// etter at resten er inne, bygges arket av det vi har og lagres som kartet;
// OSM-arket erstatter det når det kommer. Feiler Overpass, blir N50-arket
// stående.

// Fristen OSM får etter at DEM + vann + N50-sti er inne. Kort med vilje: et
// raskt Overpass-svar (cache, ledig speil) skal fortsatt gi ETT bygg, men
// ventetida brukeren ser er nettopp denne.
export const OSM_VENT_MS = 4000

const sov = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Kommer OSM innen fristen? Fristen starter når `kritiskUtenOsmP` er inne.
 * Et Overpass-svar som FEILER teller som «nei» med en gang — da er det ingen
 * grunn til å vente på fristen.
 *
 * @returns {Promise<boolean>}
 */
export function osmInnenFrist(overpassP, kritiskUtenOsmP, ventMs = OSM_VENT_MS, vent = sov) {
  return Promise.race([
    overpassP.then(() => true, () => false),
    kritiskUtenOsmP.then(() => vent(ventMs), () => vent(ventMs)).then(() => false),
  ])
}

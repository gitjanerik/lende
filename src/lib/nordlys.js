// Nordlys: hvor står det, hvor sterkt er det, og kan man se det herfra?
//
// REN MODUL — ingen fetch, ingen Three.js, ingen DOM. Hentingen bor i
// nordlysFetcher.js og uttrykket i tour3d/nordlysHimmel.js, av samme grunn som
// vaerFetcher og vaerHimmel er skilt: det ene endres når kilden endrer seg, det
// andre når vi endrer mening om hvordan det skal se ut.
//
// KILDEN ER MÅLT, IKKE GJETTET (scripts/probe-nordlys.mjs, 2026-08-31). Tre
// runder mot NOAA SWPC ga tallene i filhodet der. De to som styrer koden her:
//
//   OVATION-RUTENETTET BRUKER LENGDEGRAD 0–360, ikke −180..180. Fella er stille:
//   10,4 °E sendt som −349,6 slår opp på motsatt side av jorda og gir et tall som
//   ser helt rimelig ut. Derfor normaliseres alt gjennom `til360`.
//
//   «LATEST» ER ET VARSEL ~1 TIME FRAM, ikke et nå-bilde: fila bærer både
//   Observation Time og Forecast Time, og de lå 67 minutter fra hverandre da det
//   ble målt. Panelet MÅ si det. Lover vi noe om himmelen i dette øyeblikket som
//   kilden ikke sier, er vi tilbake i den ene feilen værvarselet lærte oss å
//   unngå — at utdatert ser ut som sant.

/** Jordas radius i meter. Brukt i høydevinkelen under. */
const R_JORD = 6_371_000

/**
 * Nordlyset lyser i et LAG, ikke i et punkt. Grønt (oksygen, 557,7 nm) er
 * kraftigst rundt 100–150 km, rødt (samme oksygen, 630,0 nm) over 200 km, og den
 * blåfiolette frynsen nederst (N2+, 427,8 nm) ligger under grønnfargen og kommer
 * bare fram i kraftige utbrudd.
 *
 * Tallene er ikke smak: de avgjør både HVOR HØYT over horisonten laget står og
 * hvilken vei fargene skal ligge i en gardin. Snur man dem, får man et nordlys
 * som er rødt nederst — og det er den ene feilen alle som har sett ekte nordlys
 * ser med én gang.
 */
export const HOYDE_KM = { fiolett: 95, gronn: 120, rod: 230 }

/** Lengdegrad til OVATIONs 0–360-konvensjon. Se filhodet: dette er fella. */
export const til360 = (lon) => ((lon % 360) + 360) % 360

/**
 * Høydevinkelen til noe som står `hoydeKm` over bakken, `gradAvstand` grader unna
 * langs jordoverflaten. Positiv = over horisonten.
 *
 * DETTE ER GRUNNEN TIL AT NORDLYS IKKE KAN MALES PÅ KUPPELEN ET VILKÅRLIG STED.
 * Fra Tromsø står ovalen ofte rett over hodet; fra Oslo er den 700 km unna, og da
 * ligger den lavt i nord — eller under horisonten. Invarianten i Lendes 3D er at
 * alt du ser står der det faktisk står, og for nordlys er det NETTOPP denne
 * vinkelen som avgjør om påstanden holder.
 *
 * Formelen er den vanlige for et objekt i høyde h sett fra en kuleflate:
 *   tan(v) = (cos θ − R/(R+h)) / sin θ,  θ = vinkelavstanden langs flata.
 * Ved θ = 0 (rett over) gir den 90°, og den blir negativ når objektet er så
 * langt unna at jordkrumningen skjuler det.
 *
 * @param {number} gradAvstand grader langs jordoverflaten (≥ 0)
 * @param {number} hoydeKm objektets høyde over bakken
 * @returns {number} høydevinkel i grader; negativ betyr under horisonten
 */
export function hoydeVinkel(gradAvstand, hoydeKm) {
  const h = hoydeKm * 1000
  const theta = Math.abs(gradAvstand) * Math.PI / 180
  if (theta < 1e-9) return 90
  const v = Math.atan2(Math.cos(theta) - R_JORD / (R_JORD + h), Math.sin(theta))
  return v * 180 / Math.PI
}

/**
 * Slå opp nordlyssannsynligheten i OVATION-rutenettet for ett punkt.
 *
 * Rutenettet er 1° × 1°, så vi tar NÆRMESTE punkt framfor å interpolere: kilden
 * er en modell med grov oppløsning, og en glattet verdi ville latt som om vi vet
 * mer enn den. Lengdegrad wrapper (359° og 0° er naboer).
 *
 * @param {Array<[number,number,number]>} rutenett OVATIONs `coordinates`
 * @param {number} lat
 * @param {number} lon grader øst, i hvilken som helst konvensjon
 * @returns {number|null} sannsynlighet i prosent, eller null om rutenettet er tomt
 */
export function sannsynlighetFor(rutenett, lat, lon) {
  if (!Array.isArray(rutenett) || !rutenett.length) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const mål = til360(lon)
  let best = null
  let bestD = Infinity
  for (const rad of rutenett) {
    const dLon = Math.min(Math.abs(rad[0] - mål), 360 - Math.abs(rad[0] - mål))
    const d = dLon * dLon + (rad[1] - lat) ** 2
    if (d < bestD) { bestD = d; best = rad }
  }
  return best ? best[2] : null
}

/**
 * Hvor ligger nordlysovalen sett HERFRA — altså på hvilken breddegrad nordover
 * langs min egen lengdegrad er sannsynligheten størst?
 *
 * Vi leser det av MÅLINGEN framfor å regne det ut av Kp. Den vanlige
 * tommelfingerregelen (ovalens sørkant ≈ 66,5° − 2°·Kp i korrigert geomagnetisk
 * bredde) krever en konvertering fra geografisk til geomagnetisk bredde som er en
 * hel modell i seg selv — og OVATION har allerede gjort den jobben. Vi har
 * rutenettet uansett; da er det bare å lete i det.
 *
 * @returns {{lat:number, verdi:number}|null} breddegraden med høyest verdi langs
 *   lengdegraden, eller null om ingenting er over `minVerdi`
 */
export function ovalenNordover(rutenett, lat, lon, { minVerdi = 1, maksGrader = 30 } = {}) {
  if (!Array.isArray(rutenett) || !rutenett.length) return null
  const mål = til360(lon)
  // Nærmeste hele lengdegrad — rutenettet har én kolonne per grad.
  let kolonne = null
  let bestD = Infinity
  for (const rad of rutenett) {
    const d = Math.min(Math.abs(rad[0] - mål), 360 - Math.abs(rad[0] - mål))
    if (d < bestD) { bestD = d; kolonne = rad[0] }
  }
  let best = null
  for (const rad of rutenett) {
    if (rad[0] !== kolonne) continue
    // BARE NORDOVER, og ikke lenger enn maksGrader: nordlys på sørhalvkula er
    // sørlys, og et treff der ville plassert gardinen i feil retning.
    if (rad[1] < lat || rad[1] > lat + maksGrader) continue
    if (rad[2] < minVerdi) continue
    if (!best || rad[2] > best.verdi) best = { lat: rad[1], verdi: rad[2] }
  }
  return best
}

/**
 * Styrkeord for et infopanel. Grensene er valgt etter hva de betyr for en som
 * står ute, ikke etter runde tall:
 *
 *   < 5 %   ingenting å se, og det skal sies rett ut framfor å pynte på det
 *   5–15 %  et svakt grønt slør lavt i nord, ofte bare synlig på kamera
 *   15–35 % tydelige bånd for det blotte øyet
 *   35–60 % bånd som beveger seg, farge man ser uten å lure
 *   > 60 %  det man husker etterpå
 */
export function styrkeOrd(prosent) {
  if (prosent == null || !Number.isFinite(prosent)) return null
  if (prosent < 5) return 'Ingen'
  if (prosent < 15) return 'Svak'
  if (prosent < 35) return 'Synlig'
  if (prosent < 60) return 'Sterk'
  return 'Svært sterk'
}

/**
 * Kan man SE det, alt tatt i betraktning? Nordlys krever tre ting samtidig, og
 * bare den ene av dem står i OVATION.
 *
 * SKYDEKKET ER MED FORDI DET AVGJØR. Et 80 %-nordlys bak et tett skydekke er
 * ingenting, og et panel som melder «Sterk» i den situasjonen er verre enn
 * intet panel — det sender folk ut i kulda for ingenting. Vi rapporterer derfor
 * BEGGE tallene og lar teksten si hva som er begrensningen.
 *
 * @param {object} m
 * @param {number|null} m.prosent OVATION-sannsynlighet her
 * @param {number|null} m.skydekke 0–100, fra MET-varselet vi allerede har
 * @param {boolean} m.erNatt fra astronomi.erNatt for arkets senterpunkt
 */
export function seForhold({ prosent, skydekke, erNatt }) {
  const styrke = styrkeOrd(prosent)
  if (!erNatt) return { kanSes: false, hvorfor: 'Det er lyst ute', styrke }
  if (prosent == null) return { kanSes: false, hvorfor: 'Ingen måling', styrke: null }
  if (prosent < 5) return { kanSes: false, hvorfor: 'For lite aktivitet', styrke }
  if (skydekke != null && skydekke >= 85) {
    return { kanSes: false, hvorfor: 'Overskyet', styrke }
  }
  if (skydekke != null && skydekke >= 60) {
    return { kanSes: true, hvorfor: 'Mye skyer', styrke }
  }
  return { kanSes: true, hvorfor: null, styrke }
}

/**
 * Alderen på et varsel, i minutter. Brukt til å si «for N minutter siden» framfor
 * å la et gammelt tall stå som om det var ferskt.
 */
export function alderMinutter(tidsstempel, naa = Date.now()) {
  const t = Date.parse(tidsstempel ?? '')
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.round((naa - t) / 60000))
}

// Fra et værvarsel til et «skypreg» himmelen kan bruke.
//
// Ren tabell-oppslag, ingen Three.js. Det er med vilje: hele feilrisikoen i
// værhimmelen ligger i denne oversettelsen, og den skal kunne testes offline
// uten WebGL. skyDome/sceneCore tar imot resultatet og gjør bare det de blir
// fortalt.
//
// DISKRESJON ER ET KRAV, IKKE EN AMBISJON. Kartet under skal være lesbart i alle
// tilstander, så takene her er harde: opasiteten går aldri over SKY_OPASITET_TAK,
// og partikkeltallet aldri over NEDBOR_TAK. 3D-visningen har ingen adaptiv
// kvalitets-nedtrapping (sceneCore setter pixelRatio én gang), så budsjettet må
// være konservativt fra starten — det finnes ingen bryter å skru ned senere.

import { symbolBasis, vindMotGrader } from '../vaerFetcher.js'

// Harde tak. Endres de, endres lesbarheten — les kommentaren over først.
export const SKY_OPASITET_TAK = 0.9
export const NEDBOR_TAK = 700

/**
 * Skypreget for klarvær — også svaret når vi ikke vet noe. Å vise NULL skyer
 * ved ukjent vær ville vært en påstand om klarvær; standard-himmelen (uten
 * værmodus) er derfor det vi faller tilbake til, ikke en tom himmel.
 */
const STANDARD = {
  dekning: 0.55, opasitet: 0.85, gratone: 1, antall: 14,
  nedbor: null, nedborTetthet: 0, torden: false,
}

// Hvor mye av skyfeltet som er synlig, og hvor mørkt/tungt det ser ut, per
// familie av symbolkoder. `gratone` 1 = hvit sky, lavere = mørkere grå.
// Tallene er valgt så forskjellen er lesbar i et øyekast uten å ta over bildet.
const PREG = [
  // [test på basiskoden, dekning, opasitet, gratone, nedbør, tetthet, torden]
  [/^clearsky$/,                    0.10, 0.55, 1.00, null,   0,   false],
  [/^fair$/,                        0.28, 0.70, 1.00, null,   0,   false],
  [/^partlycloudy$/,                0.55, 0.82, 0.96, null,   0,   false],
  [/^cloudy$/,                      1.00, 0.90, 0.80, null,   0,   false],
  [/^fog$/,                         1.00, 0.90, 0.86, null,   0,   false],
  // Nedbør: «light» / uspesifisert / «heavy» skiller seg på tetthet og mørke.
  [/^light(rain|.*rainshowers)/,    0.75, 0.85, 0.80, 'regn', 180, false],
  [/^heavy(rain|.*rainshowers)/,    1.00, 0.90, 0.58, 'regn', NEDBOR_TAK, false],
  [/rain/,                          0.90, 0.88, 0.68, 'regn', 380, false],
  [/^lights?sleet/,                 0.78, 0.85, 0.82, 'sludd', 170, false],
  [/^heavysleet/,                   1.00, 0.90, 0.62, 'sludd', 520, false],
  [/sleet/,                         0.90, 0.88, 0.72, 'sludd', 320, false],
  [/^lights?snow/,                  0.75, 0.82, 0.90, 'sno',  200, false],
  [/^heavysnow/,                    1.00, 0.90, 0.72, 'sno',  600, false],
  [/snow/,                          0.90, 0.86, 0.82, 'sno',  380, false],
]

/**
 * @param {string|null} symbolCode METs symbol_code, med eller uten variant.
 * @param {{vindMs?: number|null, vindRetningGrader?: number|null}} [maling]
 * @returns {{dekning:number, opasitet:number, gratone:number, antall:number,
 *           nedbor:null|'regn'|'sludd'|'sno', nedborTetthet:number,
 *           torden:boolean, driftX:number, driftZ:number, driftFart:number}}
 */
export function vaerTilHimmel(symbolCode, maling = {}) {
  const { basis } = symbolBasis(symbolCode)
  let p = STANDARD
  if (basis) {
    for (const [test, dekning, opasitet, gratone, nedbor, tetthet] of PREG) {
      if (test.test(basis)) {
        p = { dekning, opasitet, gratone, antall: STANDARD.antall, nedbor, nedborTetthet: tetthet, torden: false }
        break
      }
    }
    // Torden leses av koden selv framfor å dobles opp i hver rad over — METs
    // navnekonvensjon er konsekvent nok til at det er tryggere.
    if (/andthunder$/.test(basis)) p = { ...p, torden: true }
  }

  const { vindX, vindZ, fart } = vindVektor(maling.vindRetningGrader, maling.vindMs)
  return {
    ...p,
    opasitet: Math.min(p.opasitet, SKY_OPASITET_TAK),
    nedborTetthet: Math.min(Math.round(p.nedborTetthet), NEDBOR_TAK),
    antall: Math.max(1, Math.round(STANDARD.antall * p.dekning)),
    driftX: vindX,
    driftZ: vindZ,
    driftFart: fart,
  }
}

/**
 * Vindretning og -styrke → en driftvektor i scenens XZ-plan.
 *
 * METs `wind_from_direction` er retningen vinden KOMMER FRA, i grader fra nord
 * med klokka. Skyene skal drive dit den GÅR, altså 180° motsatt. Scenen har +Z
 * mot sør (nord er −Z), som terrainMesh legger den, så nordover er (0, −1).
 *
 * Farten er dempet: 1 m/s virkelig vind gir ikke 1 m/s skydrift på et 5 km ark
 * — det ville sett ut som en tidsforkortet film. Faktoren gir en bevegelse man
 * KAN se hvis man ser etter, og som ikke stjeler oppmerksomhet ellers.
 */
export function vindVektor(fraGrader, vindMs) {
  // Snuingen fra «kommer fra» til «går mot» bor i vaerFetcher — delt med
  // vindpila i symbolraden, så de to kan ikke peke i strid.
  const motGrader = vindMotGrader(fraGrader)
  // Uten retning drifter skyene som før: vestlig, altså mot +X.
  if (motGrader === null) return { vindX: 1, vindZ: 0, fart: driftFart(vindMs) }
  const mot = motGrader * Math.PI / 180
  return {
    vindX: Math.sin(mot),
    vindZ: -Math.cos(mot),
    fart: driftFart(vindMs),
  }
}

function driftFart(vindMs) {
  // UKJENT vind og STILLE vind er ikke det samme, og de skal ikke gi samme svar:
  // uten måling drifter skyene som appen alltid har gjort (1×), mens 0 m/s er en
  // ekte måling som skal gi rolig drift. Ikke helt stille — en frossen sky leser
  // som en feil, ikke som vindstille.
  if (!Number.isFinite(vindMs)) return 1
  const ms = Math.max(0, vindMs)
  // 0 m/s → 0,4×, 10 m/s → ~1,5×, og et tak så en storm ikke gir stroboskop.
  return Math.min(2.4, 0.4 + ms * 0.11)
}

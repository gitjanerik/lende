// Fra måling til uttrykk: hvordan skal nordlyset SE UT i 3D?
//
// REN MODUL, og skilt fra nordlys.js av samme grunn som vaerHimmel er skilt fra
// vaerFetcher: den ene endres når NOAA endrer seg, den andre når vi endrer mening
// om hvordan det skal se ut. Tallene her er SMAK og kan skrus på fritt; tallene i
// nordlys.js er geometri og astronomi og kan det ikke.
//
// UTTRYKKET ER IKKE FOTOREALISME, og det er bestilt. Lende tegner ISOM-kart med
// flate farger og puff-skyer av trettens firkanter — et fotografisk nordlys ville
// vært det eneste i scenen som lot som det var et fotografi. Det vi er ute etter
// er det samme som med skyene (v5.22.0): en form som er GJENKJENNELIG i bevegelse.
//
// FIRE TING GJØR AT ET NORDLYS LESES SOM NORDLYS, og ingen av dem er oppløsning:
//   1. Det henger i LODDRETTE stråler, ikke i flater. Strålene følger jordas
//      magnetfeltlinjer, og det er derfor de er parallelle.
//   2. Fargen skifter MED HØYDEN og ikke på tvers: grønt nederst, rødfiolett
//      over. Snur man det, ser alle at det er feil uten å kunne si hvorfor.
//   3. Det er GJENNOMSIKTIG. Stjerner skinner gjennom et nordlys, alltid.
//   4. Det beveger seg LANGSOMT og kontinuerlig — det blinker ikke. En gardin
//      bruker minutter på å folde seg, ikke sekunder.

import { HOYDE_KM, hoydeVinkel, styrkeOrd } from '../nordlys.js'

/**
 * Fargene er de virkelige utslippslinjene, ikke valgt på palett:
 *   557,7 nm  oksygen, det klassiske gulgrønne — 100–150 km
 *   630,0 nm  oksygen igjen, rødt — over 200 km, og bare ved kraftig aktivitet
 *   427,8 nm  ionisert nitrogen, blåfiolett — under grønnfargen, i sterke bånd
 * De er dempet mot ren metning: et skjermgrønt på full styrke leses som neon.
 */
export const FARGER = {
  gronn: '#3ddc84',
  rod: '#b0407a',
  fiolett: '#6a5acd',
}

/** Under dette tegnes ingenting. Se `nordlysPreg`. */
export const MIN_PROSENT = 5

/**
 * Halve bredden på nordlysovalen, i breddegrader. Ovalen er et BELTE og ikke en
 * strek — typisk noen grader bredt — og uten den bredden får gardinen ingen
 * høyde når ovalen står rett over hodet. Se nordlysPreg.
 */
export const OVAL_HALVBREDDE = 3

/**
 * Minste høyde en gardin får spenne over, i grader. Se nordlysPreg: nær senit
 * ser man LANGS lysarket, og geometrien som måler tvers over ovalen undervurderer
 * da hvor mye himmel den dekker.
 */
export const MIN_SPENN_GRADER = 26

/**
 * Taket for hvor høyt en gardin får rekke, i grader over horisonten.
 *
 * DETTE ER EN GEOMETRISK DEGENERASJON OG IKKE SMAK (v6.5.17). Gardinene er
 * spent ut i (asimut, høyde), og radien i asimutretningen er `cos(h)`. På 90°
 * er den NULL: hele toppkanten av hver gardin kollapser til ett og samme punkt i
 * senit, uansett hvilken asimut den sto i. Med ovalen rett over hodet ble
 * `tilGrader` nøyaktig 90, og resultatet var at alle sju gardinene strålte ut av
 * ett felles perspektivpunkt — som leses som en tegnefeil, fordi det ER en.
 *
 * (Et ekte nordlys i magnetisk senit gir faktisk en «korona» med stråler som
 * peker mot betrakteren, så konvergensen er ikke usann i seg selv. Men den ekte
 * koronaen har spredning og struktur; ett matematisk punkt har ingen av dem.)
 *
 * 74° koster oss ikke noe: forskjellen mellom «rett over hodet» og «nesten rett
 * over hodet» er ikke lesbar på en skjerm, mens forskjellen mellom en gardin og
 * et punkt er det.
 */
export const MAKS_TOPP_GRADER = 74

/**
 * Hvor mye av HIMMELEN nordlyset skal dekke, som en funksjon av hvor sterkt det
 * er. Et svakt nordlys er en stripe lavt i nord; et kraftig ett strekker seg over
 * hele himmelen og kan stå i sør.
 *
 * MÅLT I GRADER og ikke i «faktor», av samme grunn som vinddriften ble målt i
 * skjermbrøk (v5.22.1): et tall uten enhet kan ikke sammenliknes med noe, og da
 * ender man med en effekt ingen ser.
 */
export function bueBredde(prosent) {
  if (prosent >= 60) return 150
  if (prosent >= 35) return 110
  if (prosent >= 15) return 80
  return 55
}

/**
 * Oversett en måling til alt gardinene trenger. `null` betyr TEGN INGENTING —
 * ikke et svakt nordlys, ikke en gjetning. Nordlysmodus av skal se nøyaktig ut
 * som før nordlyset fantes, samme kontrakt som `setVaer(null)`.
 *
 * @param {object} m
 * @param {number|null} m.prosent OVATION-sannsynlighet der brukeren står
 * @param {number|null} m.ovalGradNord hvor mange grader NORD for brukeren ovalens
 *   sterkeste bånd ligger. Null = rett over hodet.
 * @param {number|null} m.kp
 * @returns {object|null}
 */
export function nordlysPreg({ prosent, ovalGradNord = null, kp = null } = {}) {
  if (!Number.isFinite(prosent) || prosent < MIN_PROSENT) return null

  // HØYDEVINKELEN ER DET SOM GJØR PÅSTANDEN SANN. Står ovalen 8° nord for deg,
  // ligger den lavt i nord; står den over hodet, fyller den himmelen. Dette er
  // ikke pynt — det er invarianten «alt du ser står der det faktisk står».
  const avstand = Number.isFinite(ovalGradNord) ? Math.max(0, ovalGradNord) : 0

  // OVALEN HAR BREDDE, og uten den kollapser gardinen. Første utgave regnet både
  // nedre og øvre kant fra SAMME avstand, og da ble de to like i det ovalen sto
  // rett over hodet: fra 90° til 90°, altså en gardin uten høyde. Testen fant
  // det. Den ekte ovalen er typisk noen grader bred i bredderetningen, så nedre
  // kant leses av den FJERNE sida (lavest) og øvre av den NÆRE (høyest).
  const grunnVinkel = hoydeVinkel(avstand + OVAL_HALVBREDDE, HOYDE_KM.gronn)
  const næreTopp = hoydeVinkel(Math.max(0, avstand - OVAL_HALVBREDDE), HOYDE_KM.rod)

  // Under horisonten: da ser man det ikke, og da tegner vi det ikke. Et nordlys
  // malt på en horisont der det fysisk ikke kan stå er nøyaktig den løgnen
  // globe-arbeidet nektet å innføre (v6.0.0).
  if (næreTopp <= 0) return null

  // MINSTE SPENN. Står ovalen nær senit, ser man LANGS lysarket og det dekker
  // mye himmel — geometrien over gir et smalt bånd fordi den måler tvers over
  // ovalen, ikke langs den. Gulvet er derfor ikke pynt: uten det blir et nordlys
  // rett over hodet en tynn strek, som er stikk motsatt av hva man ser.
  const toppVinkel = Math.min(MAKS_TOPP_GRADER, næreTopp)
  const fraVinkel = toppVinkel - grunnVinkel < MIN_SPENN_GRADER
    ? Math.max(0, toppVinkel - MIN_SPENN_GRADER)
    : grunnVinkel

  // STYRKEN HAR ET GULV, og det er en bevisst overdrivelse (v6.5.16). Første
  // utgave var lineær fra null (prosent/70), og eieren meldte fra felt at «Svakt,
  // lavt i nord» ikke var synlig i det hele tatt og «Synlig bånd» bare så vidt.
  // Det er riktig fysikk og feil framstilling: et nordlys på 8 % sannsynlighet er
  // svakt for ØYET i mørket, men skjermen har allerede kastet bort det meste av
  // dynamikken før den kommer dit. Samme lærdom som vinddriften (v5.22.1) —
  // en effekt som er korrekt skalert og likevel under terskelen for hva man ser,
  // er en effekt som ikke finnes. Forskjellen mellom svakt og sterkt bæres nå av
  // FARGE, HØYDE, BUEBREDDE og ANTALL, som alle er lettere å lese enn lysstyrke.
  const styrke = 0.3 + 0.7 * Math.min(1, prosent / 65)
  return {
    styrke,
    ord: styrkeOrd(prosent),
    // Nedre og øvre kant av gardinene, i grader over horisonten.
    fraGrader: Math.max(0, fraVinkel),
    tilGrader: toppVinkel,
    // Hvor bredt båndet spenner i asimut, sentrert i nord.
    bueGrader: bueBredde(prosent),
    // ANDELEN RØDT følger aktiviteten, fordi det gjør det i virkeligheten: den
    // røde 630 nm-linja krever at partiklene når høyt nok, og det skjer først
    // ved kraftige utbrudd. Et svakt nordlys som er rødt finnes ikke.
    // Terskelen og brattheten ble skrudd opp i v6.5.16: med de gamle tallene lå
    // rødandelen på 0,22 ved 45 %, og den ble i tillegg maskert bort av
    // utoningen i fragment-shaderen — resultatet var et nordlys som var grønt og
    // bare grønt uansett hvor sterkt det sto.
    rodAndel: Math.min(0.85, Math.max(0, (prosent - 22) / 55)),
    // Den fiolette frynsen nederst kommer enda senere.
    fiolettAndel: prosent >= 40 ? Math.min(0.6, 0.3 + (prosent - 40) / 80) : 0,
    // Foldehastighet. LANGSOMT er poenget: en gardin bruker minutter på å folde
    // seg, og en som rykker leses som en animasjonsfeil. Kp løfter den litt —
    // uro i feltet gir raskere bevegelse — men taket er lavt med vilje.
    fart: 0.045 + Math.min(0.05, (kp ?? 0) * 0.006),
    // Antall gardiner. Flere ved sterk aktivitet, men aldri så mange at de
    // smelter til én flate: da mister man strålene, som er hele formen.
    antall: prosent >= 60 ? 7 : prosent >= 35 ? 5 : prosent >= 15 ? 4 : 3,
    // HVOR MYE AV LYSET SOM LIGGER I STRÅLER. Et svakt nordlys er en DIFFUS BUE
    // uten struktur — strålene kommer først når nedbøren av partikler blir tett
    // nok til å følge enkeltfeltlinjer. Det er derfor dette er et eget tall og
    // ikke bare mer styrke: ved 8 % skal båndet være jevnt, ved 70 % skal det
    // stå i loddrette striper. Det hjelper dessuten synligheten, fordi et jevnt
    // bånd ikke har mørke mellomrom som spiser halve lyset.
    straaleAndel: Math.min(1, Math.max(0.2, (prosent - 5) / 45)),
    // HVOR MYE GARDINEN FOLDER SEG, i radianer utslag i asimut. Et svakt nordlys
    // er en rolig bue; et kraftig et draperi som vrir seg. 0,15 rad ≈ 8,6°, som
    // er nok til å se formen endre seg mens man ser på den.
    foldeUtslag: 0.06 + 0.09 * Math.min(1, prosent / 60),
    // URO: hvor mye lys som løper LANGS båndet, som en bølge. Dette er det ene
    // stedet nordlyset får lov til å være raskt — og det er riktig: de hurtige
    // strålebevegelsene folk beskriver som «dansende» hører til kraftige
    // substorms, mens en svak bue står nesten stille. Formen folder seg fortsatt
    // langsomt; det er BARE lysstyrken som løper.
    uro: Math.min(1, Math.max(0.2, (prosent - 5) / 50)),
  }
}

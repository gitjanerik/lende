import { kartStil } from './kartStiler.js'
import { wgs84ToUtm32 } from './utm.js'

// Fritt lende — den avkledde turkartmodusen. Denne fila er REN: den bærer
// modusens tall, lagsett og beslutninger, og ingenting av Vue eller DOM.
//
// Grunnen til at den er ren er den samme som for demProbeOpplosning og
// synligeKart: prosjektet har ingen måte å enhetsteste en Vue-komponent på
// (ingen @vue/test-utils — komponent-atferd dekkes av røyktesten i Chromium).
// Alt som er en BESLUTNING må derfor bo utenfor komponenten, ellers er den
// bare dekket av én røyk-sjekk.

// ── Arkets faste form ───────────────────────────────────────────────────────
// 2 × 2 km, 10 m ekvidistanse. Ikke justerbart — det er hele poenget med
// modusen. HALV_KM og ASPEKT sendes videre til buildMapFromCenter fordi de
// fortsatt havner i den lagrede entryen, selv om utsnittet avgjøres av utmBbox.
export const HALV_KM = 1
export const ASPEKT = 1
export const EKVIDISTANSE_M = 10
export const BREDDE_M = 2000

// DEM-en tvinges finere enn regelen ville gitt (som er 20 m ved 10 m
// ekvidistanse). På et 2 km-ark i bratt terreng ligger kotene da drøyt én celle
// fra hverandre og trapper seg synlig. 200 × 200 celler er billig.
export const DEM_OPPLOSNING_M = 10

// Strek-hakket er låst til katalogens default. Ingen knott, ingen localStorage.
export const STREK_IDX = 2

// ── Lagsettet ───────────────────────────────────────────────────────────────
// Defineres som et FRATREKK fra orientering-stilen, ikke som en liste — samme
// regel som `uten()` i kartStiler.js, så et nytt lag i katalogen kommer med av
// seg selv i stedet for å måtte huskes på her.
//
// orientering utelater allerede kulturminne, fredet-kulturminne og vannstasjon
// (via OVERLEGG), pluss marine- og vinter-lagene. Det som trekkes fra i tillegg
// er de tre modusen ikke vil ha:
//   bymasse     — tett bebyggelse; finnes ikke på et 2 km-ark på fjellet
//   parkering   — bilinfrastruktur, ikke terreng
//   holdeplass  — kollektiv, samme
//
// Merk at `bygning` IKKE trekkes fra og ikke skal: en hytte er ly, og ly betyr
// noe når det mørkner.
export const FRATREKK = Object.freeze(['bymasse', 'parkering', 'holdeplass'])

export const FRITT_LENDE_LAG = Object.freeze(
  kartStil('orientering').lag.filter((k) => !FRATREKK.includes(k))
)

// Uttrykket er ISOM (kartStil('orientering').tema === 'light'), men et hvitt ark
// på full lysstyrke på et mørkt fjell ødelegger nattsynet. Står brukerens
// «Turkart i mørkt tema» på, følger vi natt-stilens tema med SAMME lagsett.
// Null nytt UI — vi respekterer bare et valg som alt er tatt et annet sted.
export function frittLendeTema(morktKart) {
  return morktKart ? kartStil('natt').tema : kartStil('orientering').tema
}

// ── Eksakt utsnitt ──────────────────────────────────────────────────────────
// Senteret snappes til DEM-rutenettet FØR ±1000 m legges på. Da er arket både
// eksakt 2 000 m og på gitteret, så flis-cachen gir full gjenbruk mellom bygg i
// samme område. Sender vi ikke utmBbox selv, avrunder bboxFromCenter (en
// 111 km/grad-tilnærming) og snapUtmBboxToGrid arket til noe som er 2 000–2 040 m
// og litt ulikt hver gang — for en modus hvis hele identitet er «fast 2 × 2 km»
// er det feil.
export function frittLendeUtmBbox(lat, lon, { res = DEM_OPPLOSNING_M } = {}) {
  const { e, n } = wgs84ToUtm32(lat, lon)
  const cE = Math.round(e / res) * res
  const cN = Math.round(n / res) * res
  const halv = BREDDE_M / 2
  return { minE: cE - halv, maxE: cE + halv, minN: cN - halv, maxN: cN + halv }
}

// ── Posisjonens kvalitet ────────────────────────────────────────────────────
// Et 2 km-ark bygget på en ±500 m wifi-triangulert posisjon setter deg nær
// kanten fra første sekund, og du merker det ikke. Derfor ventes det på en
// brukbar fix — men aldri lenger enn at modusen fortsatt føles snappy.
export const FIX_GOD_NOK_M = 50      // bygg straks
export const FIX_VENT_MS = 8000      // ellers: bygg på beste fix så langt
export const FIX_SPOR_OVER_M = 200   // så dårlig at vi spør først
export const FIX_SPOR_ETTER_MS = 15000

export function fixVurdering({ accuracyM, ventetMs }) {
  if (accuracyM != null && accuracyM <= FIX_GOD_NOK_M) return 'bygg'
  if (accuracyM != null && ventetMs >= FIX_VENT_MS) {
    return (accuracyM > FIX_SPOR_OVER_M && ventetMs >= FIX_SPOR_ETTER_MS) ? 'spor' : 'bygg'
  }
  if (accuracyM != null && ventetMs >= FIX_SPOR_ETTER_MS) return 'spor'
  return 'vent'
}

// ── Knappens tilstandsmaskin ────────────────────────────────────────────────
// Én knapp, ett begrep: «hent meg hit». Den bruker det billigste midlet som
// finnes i situasjonen — panorere hvis mulig, bygge hvis ikke.
//
// TRE INVARIANTER SOM IKKE MÅ FORENKLES BORT. De er grunnen til at modusen kan
// ha en destruktiv handling uten en eneste bekreftelsesdialog:
//
//   1. FØRSTE TAP ETTER EN FERSK LAST STARTER BARE GPS. Det bygger aldri.
//      Ved kald start er GPS alltid av, så det er alltid nøyaktig ETT trykk
//      mellom å åpne modusen og å erstatte arket. Dette er svaret på «GPS-en
//      min er et helt annet sted nå enn da jeg bygget arket»: åpner du appen
//      hjemme med et ark fra fjellet, gjør første trykk ingen skade.
//
//   2. MENS DU STÅR PÅ ARKET ER BYGGING UTILGJENGELIG FOR TAP. Ikke en
//      fartsdump — muligheten finnes ikke. Å gå av et 2 km-ark er hovedsløyfa
//      i denne modusen, ikke et unntak, så en dialog der ville blitt blindtrykket.
//
//   3. (håndheves av kalleren) DET GAMLE ARKET SLETTES ALDRI FØR DET NYE ER
//      FERDIG BYGGET OG TEGNET. Det er dette som faktisk gjør et feiltrykk
//      ufarlig — ikke gestespråket.
//
// KALLERENS ANSVAR: `ferskLast` skal settes false ved FØRSTE tap. Uten det
// står invariant 1 for alltid, og andre trykk ville også bare sentrert — man
// ville aldri fått bygget et nytt ark etter en reload.
//
// Returnerer 'start-gps' | 'start-gps-og-bygg' | 'sentrer' | 'bygg' | null.
// null = knappen er deaktivert (byggingen pågår; «Avbryt» ligger i chipen).
export function knappeHandling({
  harArk, gpsPaa, utenforArket, ferskLast, bygger, hold = false,
}) {
  if (bygger) return null
  if (!harArk) return gpsPaa ? 'bygg' : 'start-gps-og-bygg'
  if (!gpsPaa) return hold ? 'start-gps-og-bygg' : 'start-gps'
  if (ferskLast && !hold) return 'sentrer'   // invariant 1
  if (hold) return 'bygg'
  return utenforArket ? 'bygg' : 'sentrer'   // invariant 2
}

// Hva knappen skal SI at den gjør. Avledet av samme tilstand som handlingen, så
// etiketten kan ikke komme i utakt med oppførselen.
export function knappeEtikett({ harArk, gpsPaa, utenforArket, ferskLast, bygger }) {
  if (bygger) return 'Bygger kart …'
  if (!harArk) return 'Lag kart her'
  if (!gpsPaa) return 'Start posisjon'
  if (!ferskLast && utenforArket) return 'Lag nytt kart her'
  return 'Sentrer på min posisjon. Hold inne for nytt kart her.'
}

// ── Arkets alder ────────────────────────────────────────────────────────────
// Et ark bygget forrige helg 60 km unna laster ellers mandag morgen uten et ord.
export const GAMMELT_ARK_DOGN = 7

export function arkErGammelt(opprettet, naa = Date.now()) {
  if (!Number.isFinite(opprettet)) return false
  return (naa - opprettet) > GAMMELT_ARK_DOGN * 24 * 3600 * 1000
}

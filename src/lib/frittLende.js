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

// «BEHOLD DETTE KARTET» ER VURDERT OG FORKASTET (v6.5.0). Ikke ta det opp igjen
// uten nye argumenter — det ser ut som en billig, snill funksjon, og det er
// nettopp derfor det er lett å legge til i god tro.
//
// Fritt lende er FERSKVARE på alle måter: arket er laget for stedet du står nå,
// det har ikke navn, og det neste erstatter det. Det er ikke en begrensning vi
// har råd til å myke opp — det er forutsetningen resten av modusen hviler på:
//
//   1. Angre-toasten avløser en bekreftelsesdialog FORDI ingen ark er verdt noe
//      spesielt. Kan ett av dem være det du ville beholde, blir en utilsiktet
//      rebygging dyr igjen, og da må dialogen tilbake — i hovedsløyfa, der den
//      blir blindtrykket. «Behold» ville altså gjeninnført det den ikke ba om.
//   2. Den legger en avgjørelse på hvert gode ark — «skal jeg ta vare på denne?»
//      — som er nøyaktig den vurderingen modusen finnes for å fjerne.
//   3. Uten navngiving ville «Mine kart» fylles med ark som alle heter det samme,
//      og med navngiving er vi tilbake i det vanlige turkartet.
//
// Den som vil ha et kart som varer, har allerede verktøyet: /nytt.

// ── Åpningsvisningen ────────────────────────────────────────────────────────
// Arket er KVADRATISK (2 × 2 km) og telefonen er høy og smal. «Se hele arket»
// (contain) fyller derfor bare bredden og etterlater et stort tomt felt over og
// under — arket ble liggende som en frimerke-firkant midt på skjermen, og
// kartet var mindre enn det trengte å være.
//
// Modusen skal vise KARTET, ikke arket. Vi dekker viewporten i stedet (cover),
// og legger på litt margin så en arkkant ikke kommer til syne av at man
// panorerer et lite stykke.
export const DEKNING_MARGIN = 1.08

// Skalaen regnes RELATIVT til den iboende gjengivelsen: SVG-en står på
// 100 % × 100 % med preserveAspectRatio="xMidYMid meet", så nullpunktet
// (scale = 1) ER contain. Derfor forholdet cover/contain og ikke cover alene.
export function dekningsSkala({ w, h, widthM, heightM }) {
  if (!w || !h || !widthM || !heightM) return 1
  const contain = Math.min(w / widthM, h / heightM)
  if (!contain) return 1
  const cover = Math.max(w / widthM, h / heightM)
  return (cover / contain) * DEKNING_MARGIN
}

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

// ── Avstand fra arkets senter ───────────────────────────────────────────────
// Modusens ene tall. Ekvidistansen sto her fram til v6.5.27 — den er fast 10 m
// og leses én gang, mens avstanden fra senter er det man trenger å vite MENS man
// går: arket rekker 1 000 m ut til hver kant, så tallet sier hvor mye lende du
// har igjen foran deg, og når det er på tide å hente et nytt utsnitt.
//
// Tallet er også porten under: et nytt ark bygget 50 m fra det gamle senteret er
// nesten det samme arket, hentet på nytt over 5–30 sekunders Overpass og
// Kartverket. Grensa gjør den bomturen umulig i stedet for å advare mot den.
export const NYTT_KART_M = 500

// svgX/svgY er kartets eget koordinatrom, som ER bakke-meter (viewBox
// `0 0 widthM heightM`) — så dette er en rett euklidsk avstand og ingen
// projeksjon. Utenfor arket blir tallet bare større; det er riktig.
export function avstandFraSenter({ svgX, svgY, widthM, heightM }) {
  if (!Number.isFinite(svgX) || !Number.isFinite(svgY)) return null
  if (!widthM || !heightM) return null
  const dx = svgX - widthM / 2
  const dy = svgY - heightM / 2
  return Math.hypot(dx, dy)
}

// Avrundet til 10 m under kilometeren: GPS-en jitrer noen meter, og et tall som
// teller oppover og nedover på siste siffer leses som støy og ikke som avstand.
export function avstandTekst(m) {
  if (!Number.isFinite(m)) return ''
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km fra senter`
  return `${Math.round(m / 10) * 10} m fra senter`
}

// ── Knappens tilstandsmaskin ────────────────────────────────────────────────
// Én knapp, ett begrep: «hent meg hit». Den bruker det billigste midlet som
// finnes i situasjonen — panorere hvis mulig, bygge hvis ikke.
//
// TO INVARIANTER SOM IKKE MÅ FORENKLES BORT. De er grunnen til at modusen kan
// ha en destruktiv handling uten en eneste bekreftelsesdialog:
//
//   1. FØRSTE TAP ETTER EN FERSK LAST STARTER BARE GPS. Det bygger aldri.
//      Ved kald start er GPS alltid av, så det er alltid nøyaktig ETT trykk
//      mellom å åpne modusen og å erstatte arket. Dette er svaret på «GPS-en
//      min er et helt annet sted nå enn da jeg bygget arket»: åpner du appen
//      hjemme med et ark fra fjellet, gjør første trykk ingen skade.
//
//   2. (håndheves av kalleren) DET GAMLE ARKET SLETTES ALDRI FØR DET NYE ER
//      FERDIG BYGGET OG TEGNET. Det er dette som faktisk gjør et feiltrykk
//      ufarlig — ikke gestespråket.
//
// AVSTANDSPORTEN AVLØSTE INVARIANT 2 (v6.5.27), og det er en BESTILT endring.
// Den gamle regelen var «tap kan aldri bygge mens du står på arket», med et
// lang-trykk som eneste vei til et nytt ark der man sto. Den var bygget rundt
// samme frykt som denne, men målte det gale: «utenfor arket» er en grense man
// krysser én gang, mens spørsmålet man faktisk stiller på tur er «har jeg nok
// kart foran meg?». Nå avgjør avstanden fra senter det, med samme tall som står
// på linjalen — og lang-trykket er borte, fordi en gest som gjør det tapet
// allerede gjør er verre enn ingen gest. Det er avstanden som beskytter arket,
// ikke gestespråket.
//
// KALLERENS ANSVAR: `ferskLast` skal settes false ved FØRSTE tap. Uten det
// står invariant 1 for alltid, og andre trykk ville også bare sentrert — man
// ville aldri fått bygget et nytt ark etter en reload.
//
// Returnerer 'start-gps' | 'start-gps-og-bygg' | 'sentrer' | 'bygg' |
// 'for-naer' | null. null = knappen er deaktivert (byggingen pågår; «Avbryt»
// ligger i chipen).
export function knappeHandling({
  harArk, gpsPaa, ferskLast, bygger, avstandM = null,
}) {
  if (bygger) return null
  // Uten ark er det ingenting å beskytte, og porten gjelder ikke: det er den
  // ENE stien der modusen ikke har noe å vise fram.
  if (!harArk) return gpsPaa ? 'bygg' : 'start-gps-og-bygg'
  if (!gpsPaa) return 'start-gps'            // invariant 1 ved kald start
  if (ferskLast) return 'sentrer'            // invariant 1
  if (avstandM == null) return 'sentrer'     // GPS på, men ingen fix ennå
  return avstandM >= NYTT_KART_M ? 'bygg' : 'for-naer'
}

// Hva knappen skal SI at den gjør. Avledet av samme tilstand som handlingen, så
// etiketten kan ikke komme i utakt med oppførselen.
export function knappeEtikett(tilstand) {
  const { harArk, gpsPaa, bygger } = tilstand
  if (bygger) return 'Bygger kart …'
  if (!harArk) return 'Lag kart her'
  if (!gpsPaa) return 'Start posisjon'
  return knappeHandling(tilstand) === 'bygg'
    ? 'Lag nytt kart her'
    : 'Sentrer på min posisjon'
}

// Meldingen når porten er stengt. Den sier BÅDE grensa og hvor man står, fordi
// «ikke ennå» uten et tall er en vegg uten dør: med begge er den en avstand man
// kan gå ferdig.
export function forNaerTekst(avstandM) {
  const naa = Number.isFinite(avstandM) ? `${Math.round(avstandM / 10) * 10} m` : 'mindre'
  return `Nytt utsnitt først når du er ${NYTT_KART_M} m fra midten av kartet — du er ${naa} unna.`
}

// ── Arkets alder ────────────────────────────────────────────────────────────
// Et ark bygget forrige helg 60 km unna laster ellers mandag morgen uten et ord.
export const GAMMELT_ARK_DOGN = 7

export function arkErGammelt(opprettet, naa = Date.now()) {
  if (!Number.isFinite(opprettet)) return false
  return (naa - opprettet) > GAMMELT_ARK_DOGN * 24 * 3600 * 1000
}

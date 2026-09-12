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
//
// 500 m fra v6.5.27 til v6.5.29. Eieren senket den til 250: et halvt kilometer
// er langt å gå for å få lov, og 250 m flytter fortsatt arkkanten en åttendedel
// av arkbredden — nok til at det nye arket er et annet ark.
export const NYTT_KART_M = 250

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
// Én knapp, ett begrep: «hent meg hit» — og fra v7.8.3 ETT TRYKK. Den bruker
// det billigste midlet situasjonen tillater: panorere hvis mulig, bygge hvis
// ikke, og starte GPS-en først når den er av.
//
// AVSTANDSPORTEN ER DET ENESTE SOM BESKYTTER ARKET, og det er nå bokstavelig
// ment. Den avløste to eldre regler, én om gangen, og begge var bygget rundt
// samme frykt — «et uhell erstatter arket mitt» — men målte noe annet enn det:
//
//   • «Tap kan aldri bygge mens du står på arket» (til v6.5.27). Målte en
//     ARKKANT, altså en grense man krysser én gang, mens spørsmålet man stiller
//     på tur er «har jeg nok kart foran meg?». Lang-trykket som var eneste vei
//     rundt den døde med den: en gest som gjør det tapet allerede gjør er verre
//     enn ingen gest.
//   • «Første tap etter en fersk last starter bare GPS» (til v7.8.3, `ferskLast`).
//     Målte ØKTA og ikke stedet. Den kostet et trykk hver gang den IKKE var
//     nødvendig — er du 7,9 km fra senteret, er det ingen tvil om hva du vil, og
//     regelen svarte med å sentrere kartet og be deg trykke en gang til. Eieren
//     strøk den: «Klikk på knappen er kun tillatt når jeg har beveget meg minst
//     250 m. Det er ok. Når klikk er tillatt: hent nytt kart.»
//
// PRISEN ER BETALT OG KJENT: åpner du modusen hjemme med et ark fra fjellet,
// erstatter ETT trykk nå det arket. Det er nettopp den situasjonen `ferskLast`
// fantes for. Den er akseptert fordi porten dekker det som faktisk er verdt å
// beskytte — et ark du står PÅ — og fordi et ark 60 km unna ikke er verdt et
// trykk å bevare (se ANGRE_MAKS_M under, som er den andre halvdelen av samme
// beslutning).
//
// DEN ENE INVARIANTEN SOM STÅR (håndheves av kalleren): DET GAMLE ARKET
// SLETTES ALDRI FØR DET NYE ER FERDIG BYGGET OG TEGNET. Det er dette som gjør
// en mislykket bygging ufarlig — ikke gestespråket, og ikke lenger noen
// tilstand i økta.
//
// Returnerer 'start-gps-og-bygg' | 'sentrer' | 'bygg' | 'for-naer' | null.
// null = knappen er deaktivert (byggingen pågår; «Avbryt» ligger i chipen).
export function knappeHandling({
  harArk, gpsPaa, bygger, avstandM = null,
}) {
  if (bygger) return null
  // Uten ark er det ingenting å beskytte, og porten gjelder ikke: det er den
  // ENE stien der modusen ikke har noe å vise fram.
  if (!harArk) return gpsPaa ? 'bygg' : 'start-gps-og-bygg'
  // GPS av: ett trykk starter den OG forplikter seg til å bygge. Porten kan
  // ikke avgjøres her — avstanden finnes ikke før fixen lander — så den prøves
  // på nytt i `etterFix`. Fram til v7.8.3 sto 'start-gps' her, og det var det
  // andre av de to trykkene eieren meldte fra om.
  if (!gpsPaa) return 'start-gps-og-bygg'
  if (avstandM == null) return 'sentrer'     // GPS på, men ingen fix ennå
  return avstandM >= NYTT_KART_M ? 'bygg' : 'for-naer'
}

// Hva ventingen på en fix skal ENDE i. Fram til v7.8.3 endte den alltid i et
// bygg, fordi 'start-gps-og-bygg' bare fantes på stien «ingen ark» — der det
// ikke er noe å beskytte. Nå starter ETHVERT trykk GPS-en når den er av, så
// porten må prøves på nytt her: det er først når fixen lander at avstanden
// finnes i det hele tatt.
//
// Uten et ark bygger vi uansett. Er avstanden fortsatt ukjent med en god fix i
// hånda, sentrerer vi — å bygge ville brutt porten, og å si «for nær» ville
// vært en påstand vi ikke har.
export function etterFix({ harArk, avstandM = null }) {
  if (!harArk) return 'bygg'
  if (!Number.isFinite(avstandM)) return 'sentrer'
  return avstandM >= NYTT_KART_M ? 'bygg' : 'for-naer'
}

// ── Angre-sloten ────────────────────────────────────────────────────────────
// Angringen finnes fordi byggingen er destruktiv og modusen ikke har en
// bekreftelsesdialog. Men den er bare verdt noe når det gamle arket fortsatt er
// et sted du kan komme til å ville stå: har du gått langt nok til at det ligger
// bak deg, er «Angre» en knapp som tilbyr deg et kart over et sted du forlot.
//
// 1 000 m = arkets halve bredde, altså grensa der det gamle senteret er på vei
// ut av det nye arket. Eieren: «Jeg trenger ikke angremulighet dersom nytt kart
// og min posisjon har flyttet seg mer enn 1 km fra opprinnelig flis-senter.
// Hva skal jeg med det?»
//
// Dette er den andre halvdelen av at `ferskLast` falt (se over): begge sier at
// et ark langt unna ikke er verdt å bevare. Under grensa står angringen som før
// — der er det gamle arket fortsatt lende du har foran deg.
export const ANGRE_MAKS_M = 1000

function senterAv(bbox) {
  if (!bbox) return null
  const { minE, maxE, minN, maxN } = bbox
  if (![minE, maxE, minN, maxN].every(Number.isFinite)) return null
  return { e: (minE + maxE) / 2, n: (minN + maxN) / 2 }
}

// Begge bboksene er UTM32-meter, så dette er en rett euklidsk avstand.
// Mangler den ene et senter — et ark lagret før `utmBbox` kom inn i entryen —
// tilbys angringen som før: vi vet ikke at den er unødvendig.
export function skalTilbyAngre(forrigeUtmBbox, nyUtmBbox) {
  const a = senterAv(forrigeUtmBbox)
  const b = senterAv(nyUtmBbox)
  if (!a || !b) return true
  return Math.hypot(b.e - a.e, b.n - a.n) <= ANGRE_MAKS_M
}

// ── Autostart ───────────────────────────────────────────────────────────────
// Har brukeren ALLEREDE gitt posisjonstillatelse, og finnes det ikke noe ark,
// skal modusen hente kartet selv. Det er den ene skjermen der et trykk ikke
// bærer en beslutning: knappen ville uansett gjort nøyaktig dette, og fram til
// v6.5.34 var svaret på «hvorfor er skjermen tom?» en knapp du måtte finne.
//
// PORTEN ER `!harArk`, OG DEN ER INVARIANT 1 (se over). Med et ark på skjermen
// er et bygg en ERSTATNING, og da må det ligge et trykk mellom det å åpne
// modusen og det å miste arket — «GPS-en min er et helt annet sted i dag enn da
// jeg bygget» er nettopp den situasjonen invarianten finnes for. Uten ark er
// det ingenting å miste, og det er samme grense `knappeHandling` alt bruker.
//
// `tillatelse` er strengen fra Permissions API. BARE 'granted' teller: 'prompt'
// ville åpnet nettleserens dialog uten at brukeren ba om noe, og en dialog man
// ikke har utløst selv er en dialog man avviser. Safari støtter ikke oppslaget
// i det hele tatt — da er verdien null, og modusen oppfører seg som før.
//
// OFFLINE BYGGER VI IKKE. Arket krever Overpass og Kartverket, så en autostart
// uten dekning gir en feilmelding brukeren ikke har bedt om. Knappen står der
// fortsatt og sier det samme, på et trykk.
export function skalAutostarte({ harArk, tillatelse, offline = false }) {
  return !harArk && !offline && tillatelse === 'granted'
}

// Hva knappen skal SI at den gjør. Avledet av samme tilstand som handlingen, så
// etiketten kan ikke komme i utakt med oppførselen.
export function knappeEtikett(tilstand) {
  const { harArk, bygger } = tilstand
  if (bygger) return 'Bygger kart …'
  if (!harArk) return 'Lag kart her'
  // «Start posisjon» sto her til v7.8.3, da GPS-av var et trykk som BARE
  // startet GPS-en. Nå forplikter det samme trykket seg til å bygge, og en
  // etikett som bare lover posisjon ville underdrevet hva knappen gjør.
  const h = knappeHandling(tilstand)
  return h === 'sentrer' || h === 'for-naer'
    ? 'Sentrer på min posisjon'
    : 'Lag nytt kart her'
}

// Meldingen når porten er stengt. Den sier BÅDE grensa og hvor man står, fordi
// «ikke ennå» uten et tall er en vegg uten dør: med begge er den en avstand man
// kan gå ferdig. Avstanden må navngi hva den måles FRA: «du er 10 m unna» leste
// eieren som «10 m fra å kunne bygge», altså stikk motsatt av det den sier.
export function forNaerTekst(avstandM) {
  const grense = `Nytt utsnitt først ${NYTT_KART_M} m fra midten av kartet.`
  if (!Number.isFinite(avstandM)) return grense
  const naa = Math.round(avstandM / 10) * 10
  return `Du står ${naa} m fra midten av kartet — nytt utsnitt først på ${NYTT_KART_M} m.`
}

// ── Arkets alder ────────────────────────────────────────────────────────────
// Et ark bygget forrige helg 60 km unna laster ellers mandag morgen uten et ord.
export const GAMMELT_ARK_DOGN = 7

export function arkErGammelt(opprettet, naa = Date.now()) {
  if (!Number.isFinite(opprettet)) return false
  return (naa - opprettet) > GAMMELT_ARK_DOGN * 24 * 3600 * 1000
}

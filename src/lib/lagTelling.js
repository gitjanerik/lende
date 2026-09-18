// HVOR MANGE OBJEKTER LIGGER I HVERT LAG? (v7.8.35)
//
// Detaljer-fana er en liste med brytere uten tall. Slår man av «Holdeplass» og
// ingenting endrer seg, er det to helt ulike ting som ser likt ut: laget er
// tomt her, eller bryteren virker ikke. Kulturminner, arkeologiske
// kulturminner og vannmålestasjoner har hatt et tall siden v4.8.6 — de er
// LIVE-lag, så antallet fantes allerede på klienten. De øvrige lagene bakes
// inn i SVG-en, og der lå tallet i byggerens `counts` og ble kastet.
//
// TALLET ER BYGGERENS, IKKE DOM-ENS, OG DET ER IKKE EN SMAKSSAK. En telling av
// elementer i den ferdige SVG-en er FEIL, og feil i to retninger samtidig:
//
//   • Geometri BUCKETES. `mapBuilder` slår sammen flater og linjer per stil ×
//     rutenett-celle til én `<path>` med mange delbaner, nettopp for å holde
//     fila liten. Tjue stier i samme celle er ETT element.
//   • Linjer tegnes TO GANGER. En sti er en base-strek pluss en `.overlay`, og
//     jernbane har fire paths for to strekninger. Et element-tall ville
//     dermed også overtelt.
//
// Å telle `M`-kommandoer i `d` løser den første og ikke den andre, og for en
// flate med øy-hull teller den hvert hull som et objekt. Byggeren, derimot,
// VET hvor mange features den klassifiserte. Tallet bakes i `data-meta`, altså
// i arket selv, så det følger med en delt `.lendekart`-fil og et kart som
// åpnes offline.
//
// PRISEN ER AT ELDRE KART IKKE HAR FELTET. Det er riktig svar og ikke en
// mangel: «(–)» betyr «vet ikke», som er det samme tegnet kulturminnene bruker
// før tjenesten har svart, og et kart bygget før v7.8.35 kan ikke vite noe om
// sitt eget innhold. Bygg det om, og tallene kommer.

import { kategoriForIsomKode } from './mapLayerCatalog.js'

/**
 * Lag som IKKE skal vise et tall, etter eierens gjennomgang av den første
 * utgaven (v7.8.35).
 *
 * BEGRUNNELSEN ER LESBARHET OG IKKE MANGLENDE DATA — tallene finnes fortsatt i
 * `meta.lagTellinger`, det er visningen som utelater dem. To slags lag havnet
 * her, og skillet er verdt å kjenne før noen «fullfører» lista:
 *
 *   • DE SOM ER OVERALT. Sti, høydekurver og navn finnes på hvert eneste ark,
 *     i hundrer eller tusener. «Sti (417)» svarer ikke på et spørsmål noen
 *     har — man ser at det er stier — og tre firesifrede tall øverst i lista
 *     trekker øyet vekk fra de lagene tallet faktisk betyr noe for
 *     (holdeplasser, kirker, bommer, broer).
 *   • DE DER TALLET IKKE ER DET MAN LURER PÅ. Veinummer, GPS-spor og de tre
 *     stedsnavn-nivåene er tekst-overlegg man slår på for uttrykket, ikke for
 *     innholdet.
 *
 * Merk at `(0)` dermed heller ikke vises for disse. Det er akseptert: for et
 * lag som er overalt er «tomt» ikke det tvetydige tilfellet tallene ble
 * innført for.
 */
export const UTEN_TELLING = new Set([
  'sti', 'kontur', 'navn', 'veinummer', 'spor',
  'stedsnavn-major', 'stedsnavn-mid', 'stedsnavn-minor',
])

/**
 * Nøkler i `counts` som IKKE er ISOM-koder. De finnes fordi klassifiseringen
 * plukker dem ut av hovedløkka og `continue`-r — punkt-symbolene får sin egen
 * liste — så deres ISOM-kode blir stående på 0 og må ikke brukes.
 *
 * `place` STÅR BEVISST IKKE HER. Stedsnavn-nodene deles i tre lag etter
 * viktighet (`stedsnavn-major/mid/minor`), og den delingen skjer et helt annet
 * sted enn tellingen. Ett samlet tall fordelt på tre brytere ville vært
 * feil på alle tre. Byggeren sender rangene inn som `ekstra` i stedet.
 */
export const NAVNGITTE_TELLINGER = {
  hule: 'stein',
  gruve: 'stein',
  kirke: 'kirke',
  parkering: 'parkering',
  holdeplass: 'holdeplass',
  bro: 'bro',
  bom: 'bom',
  // Toppene ER navne-laget: symbolet og navnet tegnes som én gruppe der.
  peak: 'navn',
}

/**
 * Summer byggerens `counts` opp til ett tall per lag-nøkkel.
 *
 * REN OG ADDITIV med vilje. `ekstra` finnes fordi noen lag ikke kommer fra
 * klassifiseringen i det hele tatt — høydekurver og stupkanter er DEM-derivert,
 * DEM-sjøen likeså — og de tallene kjenner bare kallstedet. En kilde som legger
 * til i et lag som alt har et tall, LEGGES TIL: stupkant har både en
 * DEM-derivert og en OSM-halvdel, og begge tegnes.
 *
 * NULL ER ET SVAR OG SKAL STÅ. Et lag som byggeren så på og fant ingenting i
 * får `0` — det er hele forskjellen fra «(–)», som betyr at ingen har sett
 * etter. Derfor filtreres ikke nuller bort her; det er visningen som velger
 * hvordan de leses.
 *
 * @param {Record<string, number>} counts byggerens telling: ISOM-koder pluss
 *   nøklene i NAVNGITTE_TELLINGER
 * @param {Record<string, number>} [ekstra] bidrag per LAG-nøkkel (ikke kode)
 * @returns {Record<string, number>} antall per lag-nøkkel
 */
export function lagTellinger(counts, ekstra = {}) {
  const ut = {}
  const legg = (lag, n) => {
    if (!lag || lag === 'other') return
    if (!Number.isFinite(n) || n < 0) return
    ut[lag] = (ut[lag] ?? 0) + n
  }
  for (const [nokkel, n] of Object.entries(counts ?? {})) {
    const navngitt = NAVNGITTE_TELLINGER[nokkel]
    if (navngitt) { legg(navngitt, n); continue }
    // Alt annet leses som en ISOM-kode. `place` og andre ukjente navn faller
    // til 'other' og forsvinner av seg selv.
    legg(kategoriForIsomKode(String(nokkel)), n)
  }
  for (const [lag, n] of Object.entries(ekstra ?? {})) legg(lag, n)
  return ut
}

/**
 * Hva `(…)`-merket skal si for ett lag. Tre utfall, tre tegn — nøyaktig samme
 * konvensjon kulturminne-laget fikk i v4.8.6, og den står fordi den ble
 * innført for å rette en ekte lesefeil: fram til da var «tjenesten svarte, og
 * her er det ingenting» og «vi vet ikke ennå» begge «(0)», som leses som at
 * funksjonen er borte.
 *
 *   '(N)' — byggeren fant N objekter
 *   '(0)' — byggeren så etter og fant ingenting
 *   '(–)' — ingen har sett etter (kart bygget før tellingen fantes)
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function tellingMerke(n) {
  if (!Number.isFinite(n)) return '(–)'
  return `(${n})`
}

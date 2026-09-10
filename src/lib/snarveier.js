/**
 * snarveier.js — katalogen over turkart-modusens FUNKSJONER, og reglene for
 * hvor mange av dem som får plass på snarvei-raden.
 *
 * SKILLET MELLOM FUNKSJON OG INNSTILLING BOR HER (v6.6.0). Måling, Sporing og
 * Annotering lå som faner i innstillings-skuffen ved siden av Kartlag og
 * Eksport, og det er to helt ulike ting i samme rad: en fane som *stiller inn*
 * kartet, og en fane som *gjør* noe med det. Innstillinger er nå bare det
 * første; alt man GJØR ligger i denne lista, og hver av funksjonene som trenger
 * et panel har fått sin egen skuff.
 *
 * REKKEFØLGEN ER BRUKERENS. Standarden under er en påstand om hva folk bruker
 * mest, ikke en sannhet — og på en smal skjerm er det nettopp rekkefølgen som
 * avgjør hva som havner bak nedtrekket. Derfor kan den sorteres, og derfor er
 * «Sorter snarveier» en FAST knapp i nedtrekket og ikke noe som forsvinner når
 * alt får plass på én linje: en knott ingen vet om er ingen knott.
 *
 * Modulen er REN — ingen DOM, ingen Vue, ingen localStorage-lesing på
 * modulnivå — slik at reglene kan enhetstestes uten en nettleser.
 */

export const SNARVEI_REKKEFOLGE_KEY = 'lende-snarvei-rekkefolge'

// `kunEgne` er samme port som fanene hadde: på de innebygde demokartene
// (Vardåsen) finnes verken egne markeringer eller GPS-spor å vise.
export const SNARVEIER = [
  // SØK OG POSISJON ER VANLIGE SNARVEIER (v7.1.0), og de står først fordi det
  // er de to man rekker etter oftest — ikke fordi de er unntatt noe. Søket lå
  // ytterst til høyre i topprada og posisjonen i den faste nav-gruppen; med
  // begge her er topprada borte, og kartet får hele skjermen. Posisjonen bærer
  // fortsatt en TILSTAND (`aktiv` fylles av kallstedet), for den slår noe på.
  { id: 'sok',        label: 'Søk',        aria: 'Søk i kart' },
  { id: 'posisjon',   label: 'Posisjon',   aria: 'Posisjon' },
  { id: 'stifinner',  label: 'Stifinner',  aria: 'Stifinner' },
  { id: 'runde',      label: 'Runde',      aria: 'Gå en runde' },
  { id: 'maaling',    label: 'Måling',     aria: 'Måling' },
  { id: 'tre-d',      label: '3D',         aria: 'Se kartet i 3D' },
  { id: 'annotering', label: 'Annotering', aria: 'Annotering', kunEgne: true },
  { id: 'sporing',    label: 'Sporing',    aria: 'Sporing',    kunEgne: true },
  { id: 'info',       label: 'Info',       aria: 'Informasjon om stedet' },
  // EKSTERNE KART (v6.6.5). De to lå som chips i hovedmenyen sammen med Street
  // View og Vegkart, bak «Åpne <sted> i». Menyen er appens egne halvdeler og
  // innstillingene deres; «se dette stedet hos noen andre» er noe man GJØR med
  // kartet man står i, altså en snarvei. Street View og Vegkart fulgte ikke
  // med: de svarer på spørsmål om VEI, og en turkart-app har ikke veien som
  // spørsmål. De to som ble igjen er dem man faktisk drar til fra en tur —
  // UT.no for turbeskrivelsen, Google for satellitt og det som ligger der.
  //
  // De står SIST i standard-rekkefølgen, og det er ikke tilfeldig: de forlater
  // appen. Alt som gjør noe med kartet ditt skal ligge foran det som tar deg
  // ut av det — og rekkefølgen er uansett brukerens.
  { id: 'utno',       label: 'UT.no',      aria: 'Åpne stedet på UT.no' },
  { id: 'gmaps',      label: 'Google',     aria: 'Åpne stedet i Google Maps' },
  // ARVEN ETTER LENDE-KNAPPEN (v7.0.0). Strek og relieff var to knotter som
  // sprang ut bak et FAB-anker nede til høyre: tap = ett hakk, lang-trykk =
  // panelet. Ankeret er borte — det var appens siste sted der en funksjon bare
  // fantes for den som gjettet en gest — og de to er nå snarveier som alt
  // annet man GJØR med kartet.
  //
  // `gruppe` er forskjellen: de rendres som en pille med TO trykkflater, der
  // venstre er hakket og høyre er et tannhjul som åpner panelet. Det er det
  // lang-trykket sa, sagt med en knapp. `bue` fylles av kallstedet med
  // knott-buens geometri — den blå/oransje ringen som viser NIVÅET er hele
  // grunnen til at de to ikke bare er nok et strekikon.
  //
  // De står SIST, foran chatten: de stiller inn hvordan kartet ser ut, mens
  // resten av raden gjør noe med det. Rekkefølgen er uansett brukerens.
  { id: 'strek',      label: 'Strek',      aria: 'Strektykkelse', gruppe: true,
    tannhjulAria: 'Strek-innstillinger for dette kartet' },
  { id: 'relieff',    label: 'Relieff',    aria: 'Relieff',       gruppe: true,
    tannhjulAria: 'Relieff-innstillinger for dette kartet' },
  // Chatten er HELT sist, og den finnes bare for den som har invitasjonstoken
  // — `kunChat` er samme port som `hasAiToken()` gater alt annet med. Uten
  // token skal funksjonen ikke engang være synlig i sorteringen.
  { id: 'chat',       label: 'Lende',      aria: 'Spør Lende om kartet', kunChat: true },
  // INNSTILLINGER ER OGSÅ EN SNARVEI (v7.0.0), og den står helt sist. Knappen
  // lå ytterst til høyre i topprada ved siden av søket, og de to spurte om
  // ulike ting: søket handler om kartet man ser på, skuffen om hvordan appen
  // er stilt inn. Med skuffen ute får søket høyrekanten alene og kartnavnet
  // den plassen mellom hamburgeren og søket det manglet.
  //
  // Den er en INNGANG og ikke en funksjon, men den sorteres som resten:
  // rekkefølgen er brukerens, og en knapp som er unntatt fra sorteringen er en
  // knapp man ikke finner igjen der man la den. Nav-gruppen er fortsatt det
  // eneste unntaket, og den er det fordi den bærer en TILSTAND.
  { id: 'innstillinger', label: 'Oppsett', aria: 'Innstillinger' },
]

export const STANDARD_REKKEFOLGE = SNARVEIER.map(s => s.id)

/**
 * DEN FASTE VENSTREGRUPPEN (v6.6.1, omgjort i v7.1.0).
 *
 * Gruppen var Posisjon + «nord opp»: to knapper som SLÅR NOE PÅ, sto først
 * foran en skillelinje, og kollapset aldri inn i nedtrekket. Posisjonen er nå
 * en vanlig snarvei — den er brukerens å sortere som alt annet, og den står
 * først i standarden uansett — mens KOMPASSET ble igjen, sammen med
 * hamburgeren, som raden får som slot fra kallstedet.
 *
 * De to som står igjen har det til felles at de ikke handler om KARTET men om
 * hvordan du ser på det: hamburgeren er veien ut av visningen, kompasset er
 * veien tilbake til nord og hele arket. Ingen av dem tåler å havne bak «Mer» —
 * en knapp man ikke finner i regnvær er en knapp som ikke finnes.
 *
 * `kunRotasjon` er kompassets port: uten en azimut å nullstille — desktop har
 * retningsrosa, og en modus uten rotasjon har ingen retning — faller den bort.
 */
export const NAV_SNARVEIER = [
  { id: 'kompass',  label: 'Nord',     aria: 'Vend kartet mot nord', kunRotasjon: true },
]

/**
 * Normaliserer en lagret rekkefølge mot katalogen: ukjente ider droppes (en
 * funksjon kan ha blitt fjernet), og nye legges BAKERST i katalogens egen
 * rekkefølge. Å legge dem først ville flyttet på noe brukeren har sortert.
 */
export function normaliserRekkefolge(lagret) {
  const kjente = new Set(STANDARD_REKKEFOLGE)
  const sett = new Set()
  const ut = []
  for (const id of Array.isArray(lagret) ? lagret : []) {
    if (kjente.has(id) && !sett.has(id)) { ut.push(id); sett.add(id) }
  }
  for (const id of STANDARD_REKKEFOLGE) if (!sett.has(id)) ut.push(id)
  return ut
}

/** Katalog-oppslagene i brukerens rekkefølge, filtrert på kart-typen. */
export function snarveierIRekkefolge(rekkefolge, { egetKart = true, chat = false } = {}) {
  const kat = new Map(SNARVEIER.map(s => [s.id, s]))
  return normaliserRekkefolge(rekkefolge)
    .map(id => kat.get(id))
    .filter(s => s && (egetKart || !s.kunEgne) && (chat || !s.kunChat))
}

/** Flytter ett element fra `fra` til `til`. Utenfor rekkevidde = uendret. */
export function flyttSnarvei(rekkefolge, fra, til) {
  const ut = [...rekkefolge]
  if (fra < 0 || fra >= ut.length || til < 0 || til >= ut.length || fra === til) return ut
  const [el] = ut.splice(fra, 1)
  ut.splice(til, 0, el)
  return ut
}

/**
 * Hvor mange knapper får plass på ÉN linje ved siden av nedtrekks-knappen.
 *
 * Budsjettet er hele radens bredde minus nedtrekket og minus den faste
 * nav-gruppen (`fastPx`, med sitt eget mellomrom), og gapet betales for hvert
 * mellomrom og ikke per knapp — en av-for-én her er én knapp for mye, altså
 * nøyaktig den overflowen målingen finnes for å unngå. Gulvet er ÉN: en rad
 * uten en eneste synlig funksjon er bare et nedtrekk, og da har raden ingen
 * grunn til å stå der.
 */
export function antallSomFar(bredder, ledigPx, handlePx, gapPx, fastPx = 0) {
  if (!bredder.length) return 0
  let plass = ledigPx - handlePx - gapPx - (fastPx ? fastPx + gapPx : 0)
  let n = 0
  for (const b of bredder) {
    const kost = n === 0 ? b : b + gapPx
    if (plass < kost) break
    plass -= kost
    n++
  }
  return Math.max(1, n)
}

/**
 * Hvilken plass et drag peker på, regnet av HVOR LANGT fingeren har flyttet
 * seg og ikke av hvor de andre radene ligger nå.
 *
 * Det er forskjellen på en liste som sorterer seg live og en som viser hva som
 * kommer til å skje: her flyttes ingenting før fingeren slippes, så radhøyden
 * er konstant hele draget og indeksen er ren aritmetikk. En måling av
 * midtpunktene ville lest av rader som selv er forskjøvet av draget.
 */
export function flytteIndeks(fra, dy, radHoyde, antall) {
  if (!(radHoyde > 0) || antall <= 0) return fra
  const til = fra + Math.round(dy / radHoyde)
  return Math.max(0, Math.min(antall - 1, til))
}

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
//
// KATALOGEN ER SLANKET TILBAKE (v7.2.0). I v7.0.0 og v7.1.0 vandret alt inn
// hit — søket, innstillingene, de to eksterne lenkene, chatten og de to
// knott-pillene — og topprada ble borte. Felttesten svarte: raden ble fire
// linjer svart boks over kartet, og gevinsten «en stripe kart på toppen» ble
// spist av at raden tok fire. Lærdommen er verdt å ha skrevet ned: en
// FORENKLING som samler alt på ett sted er bare en forenkling hvis stedet
// tåler alt som kommer.
//
// Det som gikk ut, og hvor det gikk:
//   sok, innstillinger  → topprada, der de lå (MapView)
//   posisjon            → den faste nav-gruppen under, med kompasset
//   strek, relieff      → pille-raden som kommer fram når raden åpnes
//   utno, gmaps         → øverst i infopanelet (ContextMenuSheet)
//   chat                → Lende-FAB-en nede til høyre, som i ruteplanleggeren
//
// Igjen står nøyaktig det raden ble laget for i v6.6.0: det man GJØR med
// kartet, sorterbart, med resten bak nedtrekket.
export const SNARVEIER = [
  { id: 'stifinner',  label: 'Stifinner',  aria: 'Stifinner' },
  { id: 'runde',      label: 'Runde',      aria: 'Gå en runde' },
  { id: 'maaling',    label: 'Måling',     aria: 'Måling' },
  { id: 'tre-d',      label: '3D',         aria: 'Se kartet i 3D' },
  { id: 'annotering', label: 'Annotering', aria: 'Annotering', kunEgne: true },
  { id: 'sporing',    label: 'Sporing',    aria: 'Sporing',    kunEgne: true },
  { id: 'info',       label: 'Info',       aria: 'Informasjon om stedet' },
]

export const STANDARD_REKKEFOLGE = SNARVEIER.map(s => s.id)

/**
 * DEN FASTE VENSTREGRUPPEN (v6.6.1, gjenopprettet i v7.2.0).
 *
 * Posisjon og «nord opp» — to knapper som SLÅR NOE PÅ, står først foran en
 * skillelinje, og kollapser ALDRI inn i nedtrekket. Posisjonen ble en vanlig
 * sorterbar snarvei i v7.1.0, og det var feil av samme grunn som gruppen ble
 * laget: posisjonen er den ene knappen man rekker etter mens man går, og en
 * knapp som havner bak «Mer» fordi man sorterte Stifinner først er en knapp
 * man ikke finner i regnvær.
 *
 * De skiller seg fra resten på to måter som begge må være synlige: de SLÅR NOE
 * PÅ (aksentgrønn flate + `aria-pressed`, samme par som hver vippebryter i
 * skuffene) framfor å gjøre noe, og de sorteres ikke.
 *
 * `kunRotasjon` er kompassets port: uten en azimut å nullstille — desktop har
 * retningsrosa, og en modus uten rotasjon har ingen retning — faller den bort.
 */
export const NAV_SNARVEIER = [
  { id: 'posisjon', label: 'Posisjon', aria: 'Posisjon' },
  { id: 'kompass',  label: 'Nord',     aria: 'Vend kartet mot nord', kunRotasjon: true },
]

/**
 * PILLE-RADEN (v7.2.0): strek og relieff, arven etter Lende-knottene.
 *
 * De er verken funksjoner eller innstillinger, men en tredje ting: en knott
 * med et NIVÅ man skrur på uten å åpne noe. `gruppe` gir dem to trykkflater —
 * venstre er hakket (det knott-tapet gjorde), høyre er tannhjulet som åpner
 * panelet (det lang-trykket gjorde). `bue` fylles av kallstedet med
 * knott-buens geometri; den blå/oransje ringen som viser nivået er hele
 * grunnen til at de to ikke bare er nok et strekikon.
 *
 * De sto i snarvei-raden i v7.0.0 og spiste to plasser av den på hver skjerm.
 * Nå står de på linja som kommer fram når raden åpnes — samme sted man alt
 * finner «Sorter», altså der man er når man stiller inn og ikke når man går.
 * Derfor må et trykk på knotten heller ikke lukke raden: hakket er noe man tar
 * flere av, og en rad som lukker seg etter det første er en rad man må åpne på
 * nytt for hvert hakk.
 */
export const PILLER = [
  { id: 'strek',   label: 'Strek',   aria: 'Strektykkelse', gruppe: true,
    tannhjulAria: 'Strek-innstillinger for dette kartet' },
  { id: 'relieff', label: 'Relieff', aria: 'Relieff',       gruppe: true,
    tannhjulAria: 'Relieff-innstillinger for dette kartet' },
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
export function snarveierIRekkefolge(rekkefolge, { egetKart = true } = {}) {
  const kat = new Map(SNARVEIER.map(s => [s.id, s]))
  return normaliserRekkefolge(rekkefolge)
    .map(id => kat.get(id))
    .filter(s => s && (egetKart || !s.kunEgne))
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

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
 * avgjør hva som havner bak håndtaket. Derfor kan den sorteres, og derfor står
 * «Sorter snarveier» som en fast, fristilt knapp under den ÅPNE raden: en knott
 * ingen vet om er ingen knott.
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
//   utno, gmaps         → øverst i infopanelet (ContextMenuSheet)
//   chat                → Lende-FAB-en nede til høyre, som i ruteplanleggeren
//   strek, relieff      → Innstillinger → Kartstil (v7.4.0)
//
// STREK OG RELIEFF ER INNSTILLINGER, OG DE ENDTE DER (v7.4.0). De sto som to
// gruppe-piller med tannhjul på linja raden åpnet — altså en tredje klasse
// kontroll, med sin egen form, sitt eget bunn-ark og sitt eget hint, midt i en
// rad som ellers bare bærer FUNKSJONER. Det er nøyaktig skillet denne fila
// finnes for: en knott med et nivå stiller inn kartets uttrykk, og uttrykket
// bor i Kartstil-fanen sammen med tema, lag og sti-farge. Pillene, tannhjulene,
// gruppe-pille-formen og hele FabSettingsPanel er slettet — ikke flyttet.
//
// ALLE SNARVEIER ER LIKEVERDIGE (v7.3.0), og det er den siste tingen som
// falt. Posisjon og kompasset sto en periode som en FAST venstregruppe foran
// en skillelinje, fordi posisjonen er den ene knappen man rekker etter mens
// man går. Prisen var at raden hadde to klasser knapper med hver sine regler,
// at gruppa spiste av målingens budsjett, og at brukeren ikke kunne sortere
// den ene knappen hen bryr seg mest om. Posisjonen er nå en vanlig, sorterbar
// snarvei med plass #1 i standarden — den kan altså fortsatt ikke havne bak
// «Mer» uten at brukeren selv har bestemt det — og kompasset har forlatt raden
// helt: det bor i linjal-boksen nede til venstre, der retningen allerede
// leses. Skillestreken er borte med dem.
export const SNARVEIER = [
  { id: 'posisjon',   label: 'Posisjon',   aria: 'Posisjon' },
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
 * Hvor mange KOLONNER raden har plass til.
 *
 * RADEN ER ET GITTER FRA v7.5.0, og kolonnetallet er det samme sammenlagt som
 * utfoldet. Fram til nå var raden en flex-rad som målte hver knapp for seg, og
 * da endret antallet per linje seg med tilstanden: sju ikoner sammenlagt, fire
 * med etikett utfoldet. Eieren leste det som at raden stokket om på seg selv —
 * og det gjorde den. Nå måles den BREDESTE cella (altså den med etikett, som er
 * den brede tilstanden), og alle celler får den bredden i begge tilstandene.
 * Sammenlagt viser gitteret første rad; draget avdekker resten.
 *
 * Gapet betales for hvert MELLOMROM og ikke per kolonne — derfor `+ gapPx` på
 * begge sider av brøken. Gulvet er ÉN: en rad uten en eneste synlig funksjon er
 * bare et håndtak, og da har raden ingen grunn til å stå der. Taket er antallet
 * snarveier, ellers ville et bredt vindu gitt tomme kolonner.
 *
 * @param {number} cellePx   bredden på den bredeste cella (med etikett)
 * @param {number} ledigPx   radens budsjett — viewporten minus kant og polstring
 * @param {number} gapPx     mellomrom mellom kolonner
 * @param {number} maks      antall snarveier
 */
export function antallKolonner(cellePx, ledigPx, gapPx, maks) {
  if (!(cellePx > 0) || !(maks > 0)) return 0
  const n = Math.floor((ledigPx + gapPx) / (cellePx + gapPx))
  return Math.max(1, Math.min(maks, n))
}

/** Hvor mange rader gitteret får. */
export function antallRader(antall, kolonner) {
  if (!(kolonner > 0) || !(antall > 0)) return 0
  return Math.ceil(antall / kolonner)
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

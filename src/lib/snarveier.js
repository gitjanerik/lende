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
 * «Sorter snarveier» som en fast, fristilt knapp under den ÅPNE raden. Den
 * heter det den gjør (v7.7.6): «Sorter» alene sto der uten et objekt, og
 * plassen finnes nå som navne-bryteren ved siden av er borte.
 *
 * Modulen er REN — ingen DOM, ingen Vue, ingen localStorage-lesing på
 * modulnivå — slik at reglene kan enhetstestes uten en nettleser.
 */

export const SNARVEI_REKKEFOLGE_KEY = 'lende-snarvei-rekkefolge'

/**
 * Cellas minstehøyde i piksler. 44 er WCAG 2.5.5 (AAA) og Apples minstemål.
 *
 * Tallet bor her og ikke i CSS-en fordi cella bærer `zoom` fra tekststørrelsen,
 * og minstehøyden settes inline på knappen.
 *
 * DEN SMALE VARIANTEN ER BORTE (v7.7.6). Fram til nå kunne navnene skrus av
 * sammenlagt, og da krympet cella til ikon-høyde. Bryteren er fjernet: ikonene
 * bærer ikke betydningen alene, og gevinsten var fjorten piksler på en rad som
 * uansett bare er ÉN rad sammenlagt. Navnene står alltid.
 */
export const SNARVEI_MIN_H = 44

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
//
// SKUFFEN HETER «VALG» NÅ, OG DEN ER EN SNARVEI (v7.6.0). Tannhjulet sto
// øverst til høyre, ved siden av søket, og var det ene stedet i turkartet der en
// kontroll bodde utenfor raden uten å være en av de tre faste runde knappene.
// Den er nå SIST i standard-rekkefølgen — den er det man går til når man har
// satt seg ned, ikke det man rekker etter mens man går.
//
// NAVNET ER «VALG» HELE VEIEN: etiketten i raden, `aria` på knappen og
// overskriften i selve skuffa. Et kort ord i raden og «Innstillinger» i
// headeren ville vært to navn på samme sted — den som trykker «Valg» og lander
// i «Innstillinger» må selv slutte at det er det samme. Skillet mellom FUNKSJON
// og INNSTILLING står likevel: skuffa bærer fortsatt bare innstillinger, det er
// VEIEN dit og NAVNET som har flyttet.
//
// ETIKETTEN ER KORT, `aria` ER FULL (v7.6.0), og de to er ikke to navn på
// samme ting — de svarer på hver sin ting. Navnene sto alltid skjult sammenlagt
// fram til v7.5.0 og kom fram med draget; fra v7.6.0 står de ALLTID, og da er
// det den LENGSTE etiketten som setter kolonnebredden for ALLE cellene — ett
// «Annotering» gjorde hver av de ni så bred som det ordet, og halverte antallet
// som fikk plass på en telefon. Etikettene er derfor kortformer man leser i et
// øyekast (GPS, Sti, Mål, Merk, Spor), mens `aria` bærer det fulle navnet for
// skjermleseren — der finnes ingen kolonnebredde å spare, og «Merk» alene sier
// ingenting uten ikonet ved siden av. Legger du til en snarvei: hold etiketten
// på fem tegn eller under, ellers betaler alle de andre for den.
export const SNARVEIER = [
  { id: 'posisjon',   label: 'GPS',   aria: 'Posisjon' },
  { id: 'stifinner',  label: 'Sti',   aria: 'Stifinner' },
  { id: 'runde',      label: 'Runde', aria: 'Gå en runde' },
  { id: 'maaling',    label: 'Mål',   aria: 'Måling' },
  { id: 'tre-d',      label: '3D',    aria: 'Se kartet i 3D' },
  { id: 'annotering', label: 'Merk',  aria: 'Annotering', kunEgne: true },
  { id: 'sporing',    label: 'Spor',  aria: 'Sporing',    kunEgne: true },
  { id: 'info',       label: 'Info',  aria: 'Informasjon om stedet' },
  { id: 'innstillinger', label: 'Valg', aria: 'Valg' },
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

/**
 * Snarvei-skuffas ØVERSTE nivå. Skuffa har tre: 0 = sammenlagt (første rad),
 * 1 = alle radene, 2 = kart-innstillingene (strek og relieff).
 *
 * TO NIVÅER BLE TRE I v7.8.0, og grunnen er at strek og relieff er de to
 * innstillingene man rører MENS man går. De bor i Innstillinger → Kartstil
 * (v7.4.0), og det står fast — fana er fortsatt det ene stedet der hele
 * uttrykket stilles inn, med per-element-strek, relieff-stil og «angi som
 * standard». Det nye nivået er en SNARVEI til de to knottene i den fana, ikke
 * en andre bolig for dem: den bærer grov-knotten og ingenting som lagres som
 * standard. Skillet mellom funksjon og innstilling er derfor ikke rørt — det
 * er lagt et eget nivå BAK funksjonene, ikke en knott inn blant dem, og det
 * koster ingen kartflate før man har dratt to ganger.
 */
export const SNARVEI_NIVAER = 2

/**
 * Spennet et drag får bevege seg i, gitt hvor skuffa sto og hvilken vei
 * fingeren går.
 *
 * NED ÅPNER ETT NIVÅ OM GANGEN, OPP MINIMERER I ETT STEG. Asymmetrien er
 * bestilt, og den er den samme som i et hvilket som helst ark man drar fram:
 * å åpne er et valg man tar ett hakk av gangen og ser resultatet av, mens å
 * legge sammen er å bli ferdig — og da skal man ikke måtte dra to ganger for
 * å få kartet tilbake. Konsekvensen for draget er at spennet må klemmes MENS
 * fingeren er nede og ikke bare ved slipp: et langt sveip ned fra sammenlagt
 * skal stoppe på nivå 1 og vise at det stopper der.
 *
 * @param {number} fra   nivået skuffa sto i da draget startet
 * @param {boolean} ned  true = fingeren går nedover (åpne)
 * @param {number} maks  øverste nivå
 * @returns {{lo: number, hi: number}} spennet draget klemmes til
 */
export function draSpenn(fra, ned, maks = SNARVEI_NIVAER) {
  const f = Math.max(0, Math.min(maks, Number(fra) || 0))
  return ned ? { lo: f, hi: Math.min(maks, Math.floor(f) + 1) } : { lo: 0, hi: f }
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
 * da endret antallet per linje seg med tilstanden. Nå måles den BREDESTE cella,
 * og alle celler får den bredden. Sammenlagt viser gitteret første rad; draget
 * avdekker resten.
 *
 * NAVNET STÅR ALLTID (v7.6.0). Sammenlagt var cella et rent ikon, og draget
 * avdekket etiketten. Det ble målt i felt og forkastet: gevinsten er de fjorten
 * pikslene etiketten er høy — raden er uansett bare ÉN rad sammenlagt — mens
 * prisen er at ikonene må bære betydningen alene, og en linjal-med-prikker eller
 * en åttekant med streker gjør ikke det. Cella er derfor like bred og like høy i
 * begge tilstandene, og draget avdekker bare FLERE RADER.
 *
 * Gapet betales for hvert MELLOMROM og ikke per kolonne — derfor `+ gapPx` på
 * begge sider av brøken. Gulvet er ÉN: en rad uten en eneste synlig funksjon er
 * bare et håndtak, og da har raden ingen grunn til å stå der. Taket er antallet
 * snarveier, ellers ville et bredt vindu gitt tomme kolonner.
 *
 * @param {number} cellePx   bredden på den bredeste cella
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
 * Hvilken PLASS i gitteret et punkt peker på — sorteringens ene måling.
 *
 * SORTERINGEN SKJER I SELVE RADEN (v7.7.0), ikke i en liste i et panel, og da
 * er målet et 2D-gitter og ikke en kolonne. Koordinatene er relative til FØRSTE
 * celles hjørne, og stegene er MÅLT av den ekte layouten (avstanden mellom to
 * naboceller) og ikke regnet av cellebredde + gap: cellene bærer `zoom`, så en
 * utregning ville vært riktig ved 100 % og feil ved 200 %.
 *
 * Punktet som sendes inn er den dratte cellas SENTER, ikke fingeren: griper man
 * i kanten av en knapp, skal den lande der knappen er — ikke der tommelen er.
 */
export function gitterIndeks(x, y, kolSteg, radSteg, kolonner, antall) {
  if (!(kolSteg > 0) || !(radSteg > 0) || !(kolonner > 0) || !(antall > 0)) return 0
  const k = Math.max(0, Math.min(kolonner - 1, Math.floor(x / kolSteg)))
  const r = Math.max(0, Math.min(antallRader(antall, kolonner) - 1, Math.floor(y / radSteg)))
  return Math.min(antall - 1, r * kolonner + k)
}

/**
 * Hvor mange kolonner og rader celle `i` må gli for å åpne gapet der cella som
 * dras (`fra`) vil lande (`til`).
 *
 * Dette er forhåndsvisningen av slippet, og den er hele grunnen til at ingenting
 * flyttes før fingeren slippes: rekkefølgen står stille, så stegene er konstante
 * og forskyvningen ren aritmetikk. I et gitter kan ett hakk bety at cella hopper
 * til NESTE RAD — derfor to tall og ikke ett.
 */
export function gitterForskyvning(i, fra, til, kolonner) {
  const ingen = { dKol: 0, dRad: 0 }
  if (!(kolonner > 0) || fra < 0 || til < 0 || fra === til || i === fra) return ingen
  let ny = i
  if (fra < til && i > fra && i <= til) ny = i - 1
  else if (til < fra && i >= til && i < fra) ny = i + 1
  if (ny === i) return ingen
  return {
    dKol: (ny % kolonner) - (i % kolonner),
    dRad: Math.floor(ny / kolonner) - Math.floor(i / kolonner),
  }
}

/**
 * Fletter en ny SYNLIG rekkefølge inn i den fulle.
 *
 * Raden sorterer bare det den viser, og på de innebygde demokartene faller
 * Annotering og Sporing bort (`kunEgne`) — de står fortsatt i brukerens lagrede
 * rekkefølge og skal ikke miste plassen sin av at man sorterte et kart der de
 * ikke finnes. Hver skjulte id blir derfor liggende ETTER den synlige den lå
 * etter fra før; lå den først av alt, blir den liggende først.
 */
export function flettSynligRekkefolge(full, synligNy) {
  const synlig = new Set(synligNy)
  const etter = new Map()
  let forrige = null
  for (const id of Array.isArray(full) ? full : []) {
    if (synlig.has(id)) { forrige = id; continue }
    const arr = etter.get(forrige) || []
    arr.push(id)
    etter.set(forrige, arr)
  }
  const ut = [...(etter.get(null) || [])]
  for (const id of synligNy) {
    ut.push(id)
    for (const skjult of etter.get(id) || []) ut.push(skjult)
  }
  return normaliserRekkefolge(ut)
}

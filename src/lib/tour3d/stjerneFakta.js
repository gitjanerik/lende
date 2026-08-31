// Enkeltstjernene: hva de heter, hvilket stjernebilde de hører til, og det ene
// som er verdt å vite om dem.
//
// HVORFOR EN EGEN FIL, ved sida av stjernebildeInfo.js: den handler om
// FIGURENE vi tegner — mytologien, hvordan man finner dem, streken mellom
// stjernene. Denne handler om stjerner som IKKE har en figur hos oss, og som
// derfor sto igjen som løse prikker på himmelen. Det er to ulike spørsmål med
// hver sin livsløp: en ny figur endrer den første, en høyere magnitudegrense i
// baken endrer denne. Samme splitt som himmelFakta.js mot himmellegemer.js.
//
// BAKGRUNNEN (v6.4.0): eieren så en skjerm full av prikker uten streker mellom,
// og spurte om det var en feil. Det var det ikke — katalogen tar ALLE stjerner
// lysere enn magnitude 2,6, mens vi bare tegner figuren for femten stjernebilder.
// Sirius, Procyon, Antares og Spica har derfor aldri hatt en strek å høre til.
//
// EN STJERNE KAN SLUTTE Å VÆRE LØS. Da Tyren, Ørnen og Nordlige krone kom inn
// (v6.5.14), gikk Aldebaran, Altair og Alphecca fra å være løse prikker til å
// være figurstjerner — og teksten om dem måtte UT herfra og inn i figurens
// infokort. Det samme gjelder navnet på stjernebildet: STJERNEBILDE_NAVN
// dekker bare dem vi IKKE tegner, så Tau, Aql og CrB er tatt ut av tabellen.
// Begge deler håndheves av stjerneFakta.test.js, og det er med vilje: en
// dublett her ville gitt to kort som forteller om samme stjerne.
// Svaret er ikke å skjule dem, men å la dem svare for seg selv når man trykker.
//
// REN MODUL: ingen Three.js, ingen DOM — den brukes av himmelObjekter.js, som
// søkefeltet importerer.

/**
 * IAU-kortnavnet fra Bayer-betegnelsen → navnene på stjernebildet.
 *
 *   latin     nominativ, som stjernebildet heter
 *   genitiv   formen Bayer-betegnelsen bruker: «α Tauri», ikke «α Taurus»
 *   norsk     bokmålsnavnet, som er det man leter etter i en norsk app
 *
 * BARE DE STJERNEBILDENE SOM FAKTISK EIER EN LØS STJERNE i katalogen — de
 * femten vi tegner figuren for har sin egen tekst i stjernebildeInfo.js.
 * `stjerneFakta.test.js` krever at hver løse stjerne finner navnet sitt her, så
 * en bake som slipper inn et nytt stjernebilde feiler med vilje framfor å vise
 * «α ?» i kortet.
 */
export const STJERNEBILDE_NAVN = {
  Ari: { latin: 'Aries', genitiv: 'Arietis', norsk: 'Væren' },
  CMa: { latin: 'Canis Major', genitiv: 'Canis Majoris', norsk: 'Store hund' },
  CMi: { latin: 'Canis Minor', genitiv: 'Canis Minoris', norsk: 'Lille hund' },
  Car: { latin: 'Carina', genitiv: 'Carinae', norsk: 'Kjølen' },
  Cen: { latin: 'Centaurus', genitiv: 'Centauri', norsk: 'Kentauren' },
  Cet: { latin: 'Cetus', genitiv: 'Ceti', norsk: 'Hvalen' },
  Cru: { latin: 'Crux', genitiv: 'Crucis', norsk: 'Sørkorset' },
  Crv: { latin: 'Corvus', genitiv: 'Corvi', norsk: 'Ravnen' },
  Eri: { latin: 'Eridanus', genitiv: 'Eridani', norsk: 'Eridanus' },
  Gru: { latin: 'Grus', genitiv: 'Gruis', norsk: 'Tranen' },
  Hya: { latin: 'Hydra', genitiv: 'Hydrae', norsk: 'Vannslangen' },
  Lep: { latin: 'Lepus', genitiv: 'Leporis', norsk: 'Haren' },
  Lup: { latin: 'Lupus', genitiv: 'Lupi', norsk: 'Ulven' },
  Oph: { latin: 'Ophiuchus', genitiv: 'Ophiuchi', norsk: 'Slangebæreren' },
  Pav: { latin: 'Pavo', genitiv: 'Pavonis', norsk: 'Påfuglen' },
  Phe: { latin: 'Phoenix', genitiv: 'Phoenicis', norsk: 'Føniks' },
  PsA: { latin: 'Piscis Austrinus', genitiv: 'Piscis Austrini', norsk: 'Sørlige fisk' },
  Pup: { latin: 'Puppis', genitiv: 'Puppis', norsk: 'Akterstavnen' },
  Sco: { latin: 'Scorpius', genitiv: 'Scorpii', norsk: 'Skorpionen' },
  Sgr: { latin: 'Sagittarius', genitiv: 'Sagittarii', norsk: 'Skytten' },
  TrA: { latin: 'Triangulum Australe', genitiv: 'Trianguli Australis', norsk: 'Sørlige triangel' },
  Vel: { latin: 'Vela', genitiv: 'Velorum', norsk: 'Seilet' },
  Vir: { latin: 'Virgo', genitiv: 'Virginis', norsk: 'Jomfruen' },
}

/**
 * HYGs tre-bokstavs Bayer-forkortelse → den greske bokstaven.
 *
 * Bokstaven og ikke «Alp»: «α Tauri» er navnet stjerna har i enhver stjernebok,
 * og «Alp Tau» er en katalogforkortelse. Den som slår opp Aldebaran senere,
 * slår opp α.
 */
export const GRESK = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η',
  The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ',
  Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ',
  Chi: 'χ', Psi: 'ψ', Ome: 'ω',
}

const HEVET = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵' }

/**
 * «Zet Oph» → «ζ Ophiuchi». «Gam-1 And» → «γ¹ Andromedae».
 *
 * Komponent-nummeret beholdes som hevet skrift: γ¹ og γ² Andromedae er to ulike
 * stjerner, og å slippe tallet ville gjort navnet tvetydig.
 *
 * @param {string|null} bayer feltet fra katalogen
 * @returns {string|null} null om betegnelsen ikke er til å tyde
 */
export function bayerNavn(bayer) {
  if (!bayer) return null
  const m = /^([A-Za-z]+)(?:-(\d))? (\S+)$/.exec(bayer)
  if (!m) return null
  const bokstav = GRESK[m[1]]
  const sb = STJERNEBILDE_NAVN[m[3]]
  if (!bokstav || !sb) return null
  return `${bokstav}${m[2] ? (HEVET[m[2]] ?? m[2]) : ''} ${sb.genitiv}`
}

/**
 * Stjernebildet stjerna hører til, utledet av Bayer-betegnelsen.
 * @returns {{latin:string, genitiv:string, norsk:string}|null}
 */
export function stjernebildeFor(bayer) {
  const kode = (bayer ?? '').split(' ')[1]
  return STJERNEBILDE_NAVN[kode] ?? null
}

/**
 * Hva stjerna skal HETE i lista og i kortet: egennavnet om det finnes, ellers
 * Bayer-betegnelsen skrevet ut.
 *
 * Rekkefølgen er ikke tilfeldig: 48 av de 57 løse stjernene har et egennavn, og
 * det er dét folk kjenner igjen. «Sirius» er svaret på «hva er den lyse der
 * nede», ikke «α Canis Majoris».
 */
export function stjerneNavn(s) {
  return s?.navn || bayerNavn(s?.bayer) || s?.bayer || 'Ukjent stjerne'
}

/**
 * Én ting som er verdt å vite, nøklet på egennavnet.
 *
 * BARE STJERNER SOM KAN SEES FRA NORGE. Canopus og Sørkorset står i katalogen
 * fordi HYG ikke deler himmelen i to, men de kommer aldri over horisonten her —
 * og `himmelObjekter` slipper dem derfor aldri inn i lista. Å skrive tekst om
 * dem ville vært å skrive for et kort ingen kan åpne.
 *
 * Alt er allment kjent astronomi, gjengitt med egne ord.
 */
export const STJERNE_FAKTA = {
  Sirius: 'Himmelens lyseste stjerne, og en av de nærmeste — 8,6 lysår unna. '
    + 'Den har en liten følgesvenn: en hvit dverg på størrelse med jorda, men '
    + 'like tung som sola. Fra Norge står Sirius lavt i sør, og da blinker den i '
    + 'alle regnbuens farger fordi lyset må gjennom mye urolig luft.',
  Procyon: 'Lille hunds eneste sterke stjerne, 11 lysår unna. Sammen med Sirius '
    + 'og Betelgeuse danner den vintertrekanten — tre lyse punkter som rammer inn '
    + 'himmelen sør for Orion.',
  Spica: 'Kornakset i Jomfruens hånd: to blå stjerner så tett sammen at de går '
    + 'rundt hverandre på fire døgn. Den gamle huskeregelen fortsetter fra '
    + 'Karlsvogna — følg buen til Arcturus, og rett videre til Spica.',
  Antares: 'Skorpionens hjerte, en rød superkjempe så stor at den ville slukt '
    + 'Mars’ bane om den sto der sola står. Navnet betyr «Ares’ rival»: '
    + 'den er nesten like rød som planeten Mars, og de to forveksles lett.',
  Fomalhaut: 'Den eneste sterke stjerna i et stort, tomt felt lavt i sør om '
    + 'høsten — navnet betyr «fiskens munn». Rundt den ligger en ring av støv og '
    + 'stein som er fotografert, en solskive under bygging.',
  Adhara: 'En av de sterkeste kildene til ultrafiolett lys på himmelen. For fire '
    + 'og en halv million år siden sto den mye nærmere oss og var da himmelens '
    + 'lyseste stjerne — sterkere enn Sirius er i dag.',
  Wezen: 'En gulhvit superkjempe rundt 1 600 lysår unna. At den likevel er lett å '
    + 'se sier alt om hvor kraftig den er: den sender ut over femti tusen ganger '
    + 'så mye lys som sola.',
  Mirzam: 'Navnet betyr «budbringeren», og det er en observasjon: den stiger opp '
    + 'like før Sirius og varsler at himmelens lyseste stjerne er på vei.',
  Alphard: 'Navnet betyr «den ensomme», og det er hele beskrivelsen — en oransje '
    + 'kjempe midt i et stort område uten andre lyse stjerner, i Vannslangens '
    + 'hjerte.',
  Hamal: 'Væren-hornet. For to tusen år siden lå vårjevndøgnspunktet her, og '
    + 'derfor står Væren fortsatt først i dyrekretsen — men himmelpolens vandring '
    + 'har flyttet punktet videre inn i Fiskene siden den gang.',
  Diphda: 'Hvalens hale, en oransje kjempe 96 lysår unna. Den er en av de få '
    + 'sterke stjernene i et stort og svakt høstfelt, og peker mot Fomalhaut '
    + 'lenger nede.',
  Nunki: 'En av stjernene i «tekannen» som Skytten tegner lavt i sør. Navnet er '
    + 'babylonsk og blant de eldste stjernenavnene som fortsatt er i bruk.',
  Rasalhague: 'Slangebærerens hode. Den snurrer så fort at den er merkbart '
    + 'flatklemt, og har en følgesvenn som går rundt den på åtte år.',
  Dschubba: 'Skorpionens panne. I år 2000 blusset den plutselig opp og ble '
    + 'nesten dobbelt så lys som før — den kastet av seg en gasskive, og har ikke '
    + 'roet seg helt siden.',
  Sabik: 'Slangebærerens andre sterke stjerne, et par som går rundt hverandre på '
    + 'åtte år. Den ligger nær ekliptikken, så månen kan gå foran den.',
  Aludra: 'En blå superkjempe langt bak resten av Store hund, rundt to tusen '
    + 'lysår unna, og en av de mest lyssterke stjernene vi ser med det blotte øye.',
  Menkar: 'Hvalens nesebor, en rød kjempe i sluttfasen av livet. Den er et '
    + 'forvarsel om hva som skjer med sola vår om noen milliarder år.',
  Acrab: 'Skorpionens klo, og egentlig minst fire stjerner. Et lite teleskop '
    + 'deler den i to, og fordi den ligger tett ved ekliptikken går månen med '
    + 'jevne mellomrom rett foran den.',
  Arneb: 'Harens rygg, en hvit superkjempe under Orions føtter. Haren er lett å '
    + 'overse, men den ligger der Orion jager — det er hele poenget med figuren.',
  Gienah: 'Ravnens vinge. Ravnen er en liten, skjev firkant lavt i sør om våren, '
    + 'og Gienah er den lyseste av de fire.',
  Ascella: 'Skytten-tekannens håndtak, et tett dobbeltpar 88 lysår unna. Fra '
    + 'Norge skraper den så vidt over horisonten på sommernetter.',
}

/**
 * @param {{navn: string|null}} stjerne
 * @returns {string|null}
 */
export function faktaFor(stjerne) {
  return (stjerne?.navn && STJERNE_FAKTA[stjerne.navn]) || null
}

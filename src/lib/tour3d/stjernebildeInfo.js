// Hva står det om stjernebildene i infopanelet.
//
// HÅNDSKREVET, og det er derfor den ligger her og ikke i stjerner.js: den fila
// er GENERERT av scripts/bygg-stjerner.mjs og bærer «IKKE REDIGER FOR HÅND» i
// toppen. Prosa i en generert fil er prosa som forsvinner ved neste bake.
//
// Nøkkelen er `id` fra FORMASJONER, som lages av en slug på det norske navnet.
// Endrer du et norsk navn i baken, endrer du en id, og teksten mister
// formasjonen sin — `stjernebildeInfo.test.js` feiler da, med vilje.
//
// FELTENE, og hvorfor de er valgt:
//   latin      det internasjonale navnet, som er det man søker på i en app til
//   mytologi   hvorfor figuren heter det den heter
//   funFact    én ting som er verdt å vite, og som helst kan SEES
//   finnDen    hvordan man faktisk finner den på himmelen. Dette er et TURKART:
//              den praktiske pekepinnen er det som gjør forskjellen mellom en
//              leksikonartikkel og noe man kan bruke stående i mørket.
//
// RETNINGER I `finnDen` ER SETT FRA BAKKEN I NORGE — «over», «under», «til
// venstre» — og ALDRI himmelkoordinater (v6.3.12). «Nord» på stjernehimmelen
// betyr mot Polstjerna, altså opp og bakover, mens himmelkompasset nede i hjørnet
// viser N på HORISONTEN. Kusken sto med «rett nord for Orion», som er astronomisk
// riktig og likevel leses som «mot kompassets nord» — eieren meldte det som en
// selvmotsigelse mot kompasset, og hadde rett i at teksten var uklar.
// Skriver du en ny: sjekk retningen mot senterRa/senterDek i FORMASJONER, og
// oversett den til det man SER. Samme rektascensjon + høyere deklinasjon = alltid
// høyere på himmelen herfra, og øst = til venstre når man ser mot sør.
//
// Alt her er allment kjent astronomi og gjengitt med egne ord. Tall som spriker
// mellom kilder (Denebs avstand) er oppgitt SOM spredning framfor å velge ett.

export const STJERNEBILDE_INFO = {
  andromeda: {
    latin: 'Andromeda',
    wikipedia: 'https://no.wikipedia.org/wiki/Andromeda_(stjernebilde)',
    mytologi: 'Kongsdatteren, barnet til Kassiopeia og Kefeus. Da mora skrøt av '
      + 'skjønnheten sin, ble Andromeda lenket til et skjær som offer til '
      + 'sjøuhyret — og Persevs kom flygende forbi i siste liten. Hele familien '
      + 'endte på himmelen, og de står der fortsatt ved sida av hverandre.',
    funFact: 'Beinet ut fra Mirach peker på Andromedagalaksen: det fjerneste '
      + 'mennesket kan se uten kikkert, 2,5 millioner lysår unna. Den er ikke et '
      + 'punkt, men en avlang tåkeflekk på størrelse med seks fullmåner etter '
      + 'hverandre — og den kommer mot oss. Om noen milliarder år smelter den '
      + 'sammen med vår egen galakse. Almach i den andre enden er egentlig fire '
      + 'stjerner, og et lite teleskop viser den som et gult og et blått par.',
    finnDen: 'Alpheratz er hjørnet i Pegasus-firkanten som kjeden går ut fra. '
      + 'Følg tre omtrent like sterke stjerner videre derfra — Alpheratz, Mirach, '
      + 'Almach — så har du henne. Fra Mirach går et kort bein opp til to svakere '
      + 'stjerner; like over den ytterste ligger galaksen som en svak, avlang '
      + 'tåke. Vent til øynene er mørkevante, og se litt ved sida av den.',
  },
  bjornevokteren: {
    latin: 'Boötes',
    wikipedia: 'https://no.wikipedia.org/wiki/Bj%C3%B8rnevokteren',
    mytologi: 'Gjeteren eller plogmannen som driver bjørnene rundt himmelpolen. '
      + 'Navnet Arcturus betyr «bjørnevokter» på gresk.',
    funFact: 'Arcturus er den lyseste stjerna på hele den nordlige stjernehimmelen '
      + 'og nummer fire i verden. Det var også her Halley i 1718 oppdaget at '
      + 'stjerner beveger seg: Arcturus hadde flyttet seg merkbart siden '
      + 'antikken. Like til venstre for Arcturus ligger Nordlige krone.',
    finnDen: 'Følg svaien i Karlsvognas skaft videre i samme bue — den peker rett '
      + 'på Arcturus. «Følg buen til Arcturus» er den eldste huskeregelen som finnes.',
  },
  kassiopeia: {
    latin: 'Cassiopeia',
    wikipedia: 'https://no.wikipedia.org/wiki/Kassiopeia',
    mytologi: 'Den forfengelige dronninga, mor til Andromeda. Straffen var å '
      + 'bindes til tronen sin og kjøre rundt himmelpolen i all evighet.',
    funFact: 'Fra Norge går den aldri ned. Den står rett overfor Karlsvogna med '
      + 'Polstjerna imellom, så når den ene er lav, er den andre høy — det er en '
      + 'brukbar klokke på nattehimmelen. Schedar i brystet er den lyseste, og '
      + 'Cih i midten er en urolig stjerne som kaster av seg gass og skifter '
      + 'lysstyrke fra år til år.',
    finnDen: 'Se etter en tydelig W eller M av fem like sterke stjerner, på motsatt '
      + 'side av Polstjerna fra Karlsvogna. Caph i den ene enden ligger nesten '
      + 'på linja mellom Polstjerna og høstjevndøgnspunktet.',
  },
  kefeus: {
    latin: 'Cepheus',
    wikipedia: 'https://no.wikipedia.org/wiki/Kefeus',
    mytologi: 'Kongen, Cassiopeias mann og Andromedas far. Han står ved sida av '
      + 'kona si, litt mindre iøynefallende, som en skjev husgavl.',
    funFact: 'Stjerna δ Cephei ga navn til kefeidene — de pulserende stjernene der '
      + 'lysstyrken forteller hvor langt unna de er. Det var den målestokken som '
      + 'gjorde at vi kunne måle avstanden til andre galakser. Errai i gavlspissen '
      + 'har en egen historie: om 2 000 år er DEN Polstjerna, når himmelpolen har '
      + 'vandret videre fra Lille bjørn.',
    finnDen: 'Mellom Cassiopeia og Svanen, som en femkantet gavl med spissen mot '
      + 'Polstjerna. Alderamin er den lyseste, nederst mot Svanen.',
  },
  dragen: {
    latin: 'Draco',
    wikipedia: 'https://no.wikipedia.org/wiki/Dragen',
    mytologi: 'Dragen Ladon, som voktet de gylne eplene i Hesperidenes hage, '
      + 'slynget rundt Lille bjørn.',
    funFact: 'Thuban i dragens kropp var Polstjerna for 4 700 år siden, da de '
      + 'egyptiske pyramidene ble bygd. Himmelpolen vandrer i en sirkel på '
      + '26 000 år, og om 20 000 år er Thuban tilbake i tjeneste.',
    finnDen: 'Hodet er en liten firkant nær Lyren; kroppen slynger seg derfra hele '
      + 'veien rundt Lille bjørn. Den er lang og svak — vent til øynene er mørkevante.',
  },
  karlsvogna: {
    latin: 'Ursa Major',
    wikipedia: 'https://no.wikipedia.org/wiki/Karlsvognen',
    mytologi: 'Kallisto, som Zeus forvandlet til en bjørn. På norsk er de sju '
      + 'stjernene en vogn og ikke en bjørn — Karlsvogna, altså Karls (Karl den '
      + 'stores) vogn.',
    funFact: 'Fem av de sju stjernene beveger seg sammen gjennom rommet som en '
      + 'løs familie; Dubhe og Alkaid i hver sin ende gjør ikke, og om 50 000 år '
      + 'er vogna ugjenkjennelig. I knekken på skaftet står Mizar, som har '
      + 'følgestjerna Alcor tett ved — klarer du å skille dem, har du godt syn.',
    finnDen: 'Sju sterke stjerner, fire i kassa og tre i skaftet. Fra Norge står '
      + 'den høyt på himmelen hele året.',
  },
  kusken: {
    latin: 'Auriga',
    wikipedia: 'https://no.wikipedia.org/wiki/Kusken',
    mytologi: 'Kusken — kjøresvennen med geita på armen. Capella betyr «den lille '
      + 'geita».',
    funFact: 'Capella er den sjette lyseste stjerna på himmelen, og egentlig to '
      + 'gule kjempestjerner som går rundt hverandre på 104 døgn. Femkanten deler '
      + 'hjørnestjerne med Tyren: Elnath er både kuskens hjørne og oksens '
      + 'nordre horn, og streken deles derfor av begge figurene.',
    finnDen: 'En stor femkant høyt i sør om vinteren, med den skarpt gule Capella '
      + 'som den lyseste. Står rett OVER Orion — samme sted på himmelen, bare '
      + 'nesten 40 grader høyere.',
  },
  'lille-bjorn': {
    latin: 'Ursa Minor',
    wikipedia: 'https://no.wikipedia.org/wiki/Lille_bj%C3%B8rn',
    mytologi: 'Kallistos sønn Arkas, satt på himmelen ved sida av mora si. Formen '
      + 'er den samme som Karlsvogna, bare mindre og svakere.',
    funFact: 'Polstjerna — Polaris — sitter i enden av skaftet, 0,7° fra '
      + 'himmelpolen, altså mindre enn en fingerbredde unna. Nærmest polen kommer '
      + 'den rundt år 2100. Den er dessuten tre stjerner, og den nærmeste '
      + 'kefeiden vi har. Kochab i kassa var polstjerne på Platons tid.',
    finnDen: 'Finn Karlsvogna, følg de to fremste kassestjernene fem ganger '
      + 'avstanden mellom dem, og du er ved Polaris. Derfra går den lille '
      + 'vogna innover, med Kochab og Pherkad som de to lyseste.',
  },
  lyren: {
    latin: 'Lyra',
    wikipedia: 'https://no.wikipedia.org/wiki/Lyren',
    mytologi: 'Orfeus’ lyre. Da han døde, satte Zeus instrumentet blant stjernene.',
    funFact: 'Vega var Polstjerne for 14 000 år siden og blir det igjen om '
      + '12 000 år. Den var også den første stjerna som noen gang ble fotografert, '
      + 'i 1850. Mellom de to nederste stjernene i lyra ligger Ringtåken.',
    finnDen: 'Vega er den skarpt hvitblå stjerna nesten rett over hodet på '
      + 'sommernetter, med et lite parallellogram hengende under. Den er det '
      + 'øverste hjørnet i Sommertriangelet; Svanen og Ørnen er de to andre.',
  },
  loven: {
    latin: 'Leo',
    wikipedia: 'https://no.wikipedia.org/wiki/L%C3%B8ven',
    mytologi: 'Den nemeiske løven, som Herakles kvalte som sin første oppgave. '
      + 'Hodet er en sigd, kroppen en trekant.',
    funFact: 'Regulus betyr «den lille kongen» og ligger nesten oppå ekliptikken '
      + '— derfor passerer månen og planetene helt inntil den, og noen ganger rett '
      + 'over. I november kommer meteorsvermen leonidene ut av dette området.',
    finnDen: 'Se etter en bakvendt spørsmålstegn-form (sigden) i sør om våren, '
      + 'med Regulus som punktet nederst.',
  },
  'nordlige-krone': {
    latin: 'Corona Borealis',
    wikipedia: 'https://no.wikipedia.org/wiki/Nordlige_krone',
    mytologi: 'Ariadnes krone. Hun ga Tesevs tråden som førte ham ut av '
      + 'labyrinten, og ble så forlatt på Naxos; Dionysos fant henne, giftet seg '
      + 'med henne og kastet brudekransen opp på himmelen.',
    funFact: 'Alphecca er den klareste perlen. I kronen ligger også T Coronae '
      + 'Borealis, «flammestjerna» — en nova som blusser opp omtrent hvert '
      + 'åttiende år og da blir synlig for bare øyet i noen netter. Sist gang '
      + 'var i 1946, og den er ventet igjen. Det er ett av de få stedene på '
      + 'himmelen der det kan stå en stjerne i kveld som ikke sto der i går.',
    finnDen: 'En liten, tydelig halvsirkel av svake stjerner, like til venstre '
      + 'for den sterkt gulrøde Arcturus. Halvsirkelen er åpen oppover, og '
      + 'Alphecca sitter midt i buen.',
  },
  orion: {
    latin: 'Orion',
    wikipedia: 'https://no.wikipedia.org/wiki/Orion_(stjernebilde)',
    mytologi: 'Jegeren som skrøt av at han kunne drepe alt levende, og ble drept '
      + 'av en skorpion. De to står på motsatt side av himmelen, så de aldri '
      + 'møtes igjen.',
    funFact: 'Betelgeuse i skulderen er en rød superkjempe så stor at den ville '
      + 'slukt Jupiters bane, og den kommer til å eksplodere som en supernova. '
      + 'Rigel i foten er blå og brenner mye varmere. Under beltet henger '
      + 'Orion-tåken, der nye stjerner blir til i dette øyeblikket.',
    finnDen: 'Tre like sterke stjerner på rad — beltet — er det lettest '
      + 'gjenkjennelige på hele himmelen. Beltet peker mot Sirius den ene veien '
      + 'og mot Aldebaran i Tyren den andre.',
  },
  tyren: {
    latin: 'Taurus',
    wikipedia: 'https://no.wikipedia.org/wiki/Tyren_(stjernebilde)',
    mytologi: 'Zevs i skikkelse av en hvit okse, som bar Europa over havet til '
      + 'Kreta. Bare framparten er med på himmelen — resten er under vann, og '
      + 'oksen stiger opp av havet med jenta på ryggen.',
    funFact: 'Aldebaran er det røde øyet, en oppsvulmet kjempe 65 lysår unna — og '
      + 'den hører IKKE til V-en den ser ut til å stå i. Hyadene bak er mer enn '
      + 'dobbelt så langt borte, og er den nærmeste åpne stjernehopen vi har. '
      + 'Rett over dem henger Sjustjerna. Ved det ene hornet, Tianguan, ligger '
      + 'Krabbetåken: restene av stjerna som eksploderte i 1054 og var synlig på '
      + 'lyse dagen i tre uker.',
    finnDen: 'Følg Orions belte oppover mot høyre — den første sterke, rødlige '
      + 'stjerna du treffer er Aldebaran. Rundt den ligger en tydelig V på sida, '
      + 'som er oksens ansikt, og de to hornene peker videre oppover mot Kusken.',
  },
  ornen: {
    latin: 'Aquila',
    wikipedia: 'https://no.wikipedia.org/wiki/%C3%98rnen_(stjernebilde)',
    mytologi: 'Zevs’ ørn, som bar tordenkilene hans og hentet gjeterguttet '
      + 'Ganymedes opp til gudene for å skjenke i for dem.',
    funFact: 'Altair snurrer rundt på under ti timer og er derfor målbart flat — '
      + 'ekvator buler ut. Den er 17 lysår unna, altså en av våre nærmeste '
      + 'naboer man kan se med bare øyet. Tarazed og Alshain står som en vakt på '
      + 'hver sin side av den; en sterk stjerne med en følgesvenn i hver ende er '
      + 'uvanlig, og det er dét man kjenner Ørnen på.',
    finnDen: 'Det laveste av de tre hjørnene i Sommertriangelet, altså under '
      + 'Vega og Deneb. Se etter en skarp stjerne med en mindre på hver side — '
      + 'tre på rad — høyt i sør på sommernetter.',
  },
  pegasus: {
    latin: 'Pegasus',
    wikipedia: 'https://no.wikipedia.org/wiki/Pegasus_(stjernebilde)',
    mytologi: 'Den vingede hesten, som sprang ut av blodet da Persevs hogg hodet '
      + 'av Medusa. Bellerofon temmet den og red den i kamp, men falt av da han '
      + 'ville ri helt opp til gudene. Hesten står opp ned på himmelen, og bare '
      + 'framparten er med.',
    funFact: 'Firkanten er en målestokk: den spenner omtrent 15 grader, en knyttneve '
      + 'med utstrakt arm, og hvor mange stjerner du klarer å telle INNI den sier '
      + 'hvor mørk himmelen er der du står. Fra en by ser du ingen, fra fjellet et '
      + 'titalls. Innenfor samme felt ligger 51 Pegasi, der de første planetene '
      + 'rundt en vanlig sol ble funnet i 1995 — oppdagelsen ga nobelprisen i '
      + 'fysikk i 2019. Scheat i det ene hjørnet er en rød kjempe som skifter '
      + 'lysstyrke uten fast takt.',
    finnDen: 'En stor, nesten tom firkant høyt oppe på høsthimmelen — det er den '
      + 'tomheten som gjør den lett å kjenne igjen. Markab og Scheat er de to '
      + 'hjørnene på den ene sida, og Alpheratz i det fjerde hjørnet deler den med '
      + 'Andromeda. Halsen med Enif, hestens mule, stikker ut fra firkanten den '
      + 'andre veien enn Andromeda-kjeden.',
  },
  persevs: {
    latin: 'Perseus',
    wikipedia: 'https://no.wikipedia.org/wiki/Persevs_(stjernebilde)',
    mytologi: 'Helten som drepte Medusa og redda Andromeda. Han holder '
      + 'gorgonhodet i den ene handa.',
    funFact: 'Algol er «demonstjerna» — Medusas blinkende øye. Hvert 2,87. døgn '
      + 'formørkes den av en følgestjerne og faller fra 2,1 til 3,4 i lysstyrke, '
      + 'og det kan ses med bare øyet om man vet når. I august kommer '
      + 'perseidene, årets sikreste meteorsverm, ut herfra.',
    finnDen: 'Mellom Cassiopeia og Kusken, som en bøyd kjede med Mirfak i '
      + 'midten.',
  },
  svanen: {
    latin: 'Cygnus',
    wikipedia: 'https://no.wikipedia.org/wiki/Svanen',
    mytologi: 'Zeus i svaneskikkelse. På norsk kalles figuren også Nordkorset, '
      + 'og det er den formen man faktisk ser.',
    funFact: 'Deneb i halen er en av de mest lysstrålende stjernene vi kjenner — '
      + 'så langt unna at anslagene spriker fra 1 500 til 3 000 lysår, og den '
      + 'likevel er en av himmelens sterkeste. I nebbet sitter Albireo, en '
      + 'gyllen og en blå stjerne side om side. Og her ligger Cygnus X-1, det '
      + 'første objektet astronomene godtok som et svart hull.',
    finnDen: 'Et stort kors langs Melkeveien, høyt i sør på sensommernetter. '
      + 'Deneb er hjørnet i Sommertriangelet sammen med Vega i Lyren og '
      + 'Altair i Ørnen.',
  },
  tvillingene: {
    latin: 'Gemini',
    wikipedia: 'https://no.wikipedia.org/wiki/Tvillingene_(stjernebilde)',
    mytologi: 'Castor og Pollux, dioskurene. Da Castor døde, ba Pollux om å få '
      + 'dele udødeligheten sin med broren, og de fikk vekselvis en dag hver.',
    funFact: 'Pollux er den lyseste av de to, og den nærmeste stjerna vi kjenner '
      + 'med en bekreftet planet rundt seg. Castor ser ut som én stjerne, men er '
      + 'seks som går rundt hverandre. I desember kommer geminidene, den tetteste '
      + 'meteorsvermen i året.',
    finnDen: 'To like sterke stjerner tett sammen, opp til venstre for Orion når '
      + 'han står i sør. Pollux er '
      + 'den nederste og litt gulere.',
  },
}

/**
 * Norske navn på stjerner som HAR et norsk navn folk bruker. Søkefeltet slår
 * opp her i tillegg til katalogens egennavn, fordi ingen skriver «Polaris» når
 * de leter etter Polstjerna.
 *
 * Kort med vilje: dette er ikke en oversettelsestabell, det er de få navnene
 * som faktisk er i bruk på norsk.
 */
export const NORSKE_STJERNENAVN = {
  Polaris: ['Polstjerna', 'Nordstjerna'],
  Sirius: ['Hundestjerna'],
  Betelgeuse: ['Betelgeuse'],
}

/**
 * Navn på FIGUREN som ikke er figurens eget navn — det man faktisk skriver i
 * søkefeltet når man ikke har det katalognavnet i hodet.
 *
 * «Orions belte» er saken som gjorde tabellen nødvendig: beltet er ikke en egen
 * konstellasjon, det er de tre midtstjernene i Orion (δ, ε, ζ), og Lende tegner
 * dem som en av kjedene i figuren. Men søket kjente bare «Orion», «Mintaka»,
 * «Alnilam», «Alnitak» og Bayer-betegnelsene — altså ingen av ordene folk flest
 * bruker om nettopp den delen av himmelen de kjenner best. Et søk som ikke
 * svarer ser ut som at figuren mangler.
 *
 * Samme sak for Karlsvogna, som ER en asterisme inne i Ursa Major: søker man
 * «Store bjørn», er det Karlsvogna man skal ha.
 *
 * Nøkkelen er `id` fra FORMASJONER, som `STJERNEBILDE_INFO`. Kort med vilje:
 * dette er ikke en synonymordbok, det er de navnene som faktisk er i bruk.
 */
export const FOLKENAVN = {
  // Jakobsstaven og Frøyas rokk (Friggerokken) er de nordiske folkenavnene på
  // beltet. De brukes ikke lenger til daglig, men den som søker på dem mener
  // nøyaktig disse tre stjernene.
  orion: ['Orions belte', 'Orionbeltet', 'Jakobsstaven', 'Frøyas rokk', 'Friggerokken'],
  karlsvogna: ['Store bjørn', 'Storebjørn'],
}

/**
 * Alle søkbare navn for én figur ut over navnet og det latinske.
 * @param {string} id fra FORMASJONER
 */
export function folkeNavnFor(id) {
  return FOLKENAVN[id] ?? []
}

/** @param {string} id fra FORMASJONER */
export function infoFor(id) {
  return STJERNEBILDE_INFO[id] ?? null
}

/**
 * Alle søkbare navn for én stjerne: katalogens egennavn, Bayer-betegnelsen og
 * eventuelle norske navn.
 * @param {{navn: string|null, bayer: string|null}} stjerne
 */
export function sokeNavnFor(stjerne) {
  const ut = []
  if (stjerne?.navn) {
    ut.push(stjerne.navn)
    ut.push(...(NORSKE_STJERNENAVN[stjerne.navn] ?? []))
  }
  if (stjerne?.bayer) ut.push(stjerne.bayer)
  return ut
}

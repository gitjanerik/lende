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
// Alt her er allment kjent astronomi og gjengitt med egne ord. Tall som spriker
// mellom kilder (Denebs avstand) er oppgitt SOM spredning framfor å velge ett.

export const STJERNEBILDE_INFO = {
  bjornevokteren: {
    latin: 'Boötes',
    mytologi: 'Gjeteren eller plogmannen som driver bjørnene rundt himmelpolen. '
      + 'Navnet Arcturus betyr «bjørnevokter» på gresk.',
    funFact: 'Arcturus er den lyseste stjerna på hele den nordlige stjernehimmelen '
      + 'og nummer fire i verden. Det var også her Halley i 1718 oppdaget at '
      + 'stjerner beveger seg: Arcturus hadde flyttet seg merkbart siden antikken.',
    finnDen: 'Følg svaien i Karlsvognas skaft videre i samme bue — den peker rett '
      + 'på Arcturus. «Følg buen til Arcturus» er den eldste huskeregelen som finnes.',
  },
  cassiopeia: {
    latin: 'Cassiopeia',
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
  cepheus: {
    latin: 'Cepheus',
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
  kjoresvennen: {
    latin: 'Auriga',
    mytologi: 'Kjøresvennen med geita på armen. Capella betyr «den lille geita».',
    funFact: 'Capella er den sjette lyseste stjerna på himmelen, og egentlig to '
      + 'gule kjempestjerner som går rundt hverandre på 104 døgn. Femkanten deler '
      + 'hjørnestjerne med Tyren: Elnath tilhører formelt oksens horn.',
    finnDen: 'En stor femkant høyt i sør om vinteren, med den skarpt gule Capella '
      + 'som den lyseste. Ligger rett nord for Orion.',
  },
  'lille-bjorn': {
    latin: 'Ursa Minor',
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
    mytologi: 'Orfeus’ lyre. Da han døde, satte Zeus instrumentet blant stjernene.',
    funFact: 'Vega var Polstjerne for 14 000 år siden og blir det igjen om '
      + '12 000 år. Den var også den første stjerna som noen gang ble fotografert, '
      + 'i 1850. Mellom de to nederste stjernene i lyra ligger Ringtåken.',
    finnDen: 'Vega er den skarpt hvitblå stjerna nesten rett over hodet på '
      + 'sommernetter, med et lite parallellogram hengende under.',
  },
  loven: {
    latin: 'Leo',
    mytologi: 'Den nemeiske løven, som Herakles kvalte som sin første oppgave. '
      + 'Hodet er en sigd, kroppen en trekant.',
    funFact: 'Regulus betyr «den lille kongen» og ligger nesten oppå ekliptikken '
      + '— derfor passerer månen og planetene helt inntil den, og noen ganger rett '
      + 'over. I november kommer meteorsvermen leonidene ut av dette området.',
    finnDen: 'Se etter en bakvendt spørsmålstegn-form (sigden) i sør om våren, '
      + 'med Regulus som punktet nederst.',
  },
  orion: {
    latin: 'Orion',
    mytologi: 'Jegeren som skrøt av at han kunne drepe alt levende, og ble drept '
      + 'av en skorpion. De to står på motsatt side av himmelen, så de aldri '
      + 'møtes igjen.',
    funFact: 'Betelgeuse i skulderen er en rød superkjempe så stor at den ville '
      + 'slukt Jupiters bane, og den kommer til å eksplodere som en supernova. '
      + 'Rigel i foten er blå og brenner mye varmere. Under beltet henger '
      + 'Orion-tåken, der nye stjerner blir til i dette øyeblikket.',
    finnDen: 'Tre like sterke stjerner på rad — beltet — er det lettest '
      + 'gjenkjennelige på hele himmelen. Beltet peker mot Sirius den ene veien '
      + 'og Aldebaran den andre.',
  },
  perseus: {
    latin: 'Perseus',
    mytologi: 'Helten som drepte Medusa og redda Andromeda. Han holder '
      + 'gorgonhodet i den ene handa.',
    funFact: 'Algol er «demonstjerna» — Medusas blinkende øye. Hvert 2,87. døgn '
      + 'formørkes den av en følgestjerne og faller fra 2,1 til 3,4 i lysstyrke, '
      + 'og det kan ses med bare øyet om man vet når. I august kommer '
      + 'perseidene, årets sikreste meteorsverm, ut herfra.',
    finnDen: 'Mellom Cassiopeia og Kjøresvennen, som en bøyd kjede med Mirfak i '
      + 'midten.',
  },
  svanen: {
    latin: 'Cygnus',
    mytologi: 'Zeus i svaneskikkelse. På norsk kalles figuren også Nordkorset, '
      + 'og det er den formen man faktisk ser.',
    funFact: 'Deneb i halen er en av de mest lysstrålende stjernene vi kjenner — '
      + 'så langt unna at anslagene spriker fra 1 500 til 3 000 lysår, og den '
      + 'likevel er en av himmelens sterkeste. I nebbet sitter Albireo, en '
      + 'gyllen og en blå stjerne side om side. Og her ligger Cygnus X-1, det '
      + 'første objektet astronomene godtok som et svart hull.',
    finnDen: 'Et stort kors langs Melkeveien, høyt i sør på sensommernetter. '
      + 'Deneb er hjørnet i Sommertriangelet sammen med Vega og Altair.',
  },
  tvillingene: {
    latin: 'Gemini',
    mytologi: 'Castor og Pollux, dioskurene. Da Castor døde, ba Pollux om å få '
      + 'dele udødeligheten sin med broren, og de fikk vekselvis en dag hver.',
    funFact: 'Pollux er den lyseste av de to, og den nærmeste stjerna vi kjenner '
      + 'med en bekreftet planet rundt seg. Castor ser ut som én stjerne, men er '
      + 'seks som går rundt hverandre. I desember kommer geminidene, den tetteste '
      + 'meteorsvermen i året.',
    finnDen: 'To like sterke stjerner tett sammen, nordøst for Orion. Pollux er '
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

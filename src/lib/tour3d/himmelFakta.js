// Astronomiske fakta og utforskningshistorie for himmellegemene i 3D-visningen.
//
// REN DATA-MODUL: ingen Three.js, ingen DOM, ingen nett. Alt står her fordi
// bruksområdet er en kveld ute uten dekning — samme grunn som at stjernene er en
// bakt katalog og planetposisjonene regnes lokalt. Et oppslag mot Wikipedia i
// felt er et oppslag som feiler i felt.
//
// HVORFOR EGEN FIL OG IKKE I `himmellegemer.js`: den siste er GEOMETRI og tall
// som styrer hvordan kula tegnes — aksehelling, farge, koordinater for stedsnavn.
// Dette er prosa og årstall. De to endres av helt ulike grunner, og en tabell som
// blander dem inviterer til at et faktum flyttes og en koordinat blir med.
//
// LENKENE er til norsk Store norske leksikon og norsk Wikipedia, i den
// rekkefølgen: SNL er redaksjonelt og på bokmål, Wikipedia er dypere. De åpnes i
// nettleseren og krever altså dekning — derfor står FAKTAENE her, og lenkene er
// bare veien videre for den som vil lese mer når hun er hjemme igjen.
//
// SNL-ADRESSENE ER MÅLT, IKKE UTLEDET (v6.3.6). Mønsteret er IKKE ensartet:
// Merkur, Venus, Jupiter og Saturn ligger på det korte navnet (`snl.no/Venus`),
// mens MARS faktisk bor på `snl.no/Mars_-_planet`. Jupiter sto feil i tre
// leveranser fordi suffikset ble antatt å gjelde alle fem. Kjør
// `npm run probe:lenker` (eller probe-himmellenker.yml i CI) framfor å gjette —
// snl.no er sperret fra utviklingsmiljøene, så en lenke kan ikke prøves her.
//
// KILDER for tallene: NASA/JPL Solar System Dynamics (månetall og oppdagelser),
// IAU Minor Planet Center (månenavn) og oppdragsoversiktene til NASA, ESA, ISRO,
// CNSA og Roskosmos. Månetallene endrer seg — nye småmåner blir funnet — så de er
// merket med året de gjaldt.
//
// SPRÅK: bokmål, som resten av UI-et. «Oppdaget» om et legeme man alltid har sett
// med bare øyet er meningsløst, og står derfor som «kjent fra forhistorisk tid» —
// det er ærligere enn et årstall.

/** Året månetallene er hentet fra. Skriv det om når du oppdaterer dem. */
export const MANETALL_AR = 2025

/**
 * @typedef {{ar: string, tekst: string}} Milepael
 */

/**
 * Fakta per himmellegeme. Nøkkelen er legeme-id-en: månen er `mane`, planetene
 * har sin egen id (samme som i `planeter.js`).
 *
 * Feltene:
 *   type        kort typebeskrivelse, vist over faktalinjene
 *   oppdaget    hvem og når — eller «kjent fra forhistorisk tid»
 *   maner       { antall, navn: string[] } — navn på dem som er verdt å nevne
 *   fakta       korte nøkkeltall som EGEN linje hver. Ikke en avsnitt-suppe.
 *   utforskning milepæler, eldst først. Kortfattet: årstall og hva som skjedde.
 *   snl         Store norske leksikon-artikkel
 *   wikipedia   norsk Wikipedia-artikkel
 */
export const HIMMEL_FAKTA = {
  mane: {
    type: 'Jordas eneste naturlige satellitt',
    oppdaget: 'Kjent fra forhistorisk tid',
    maner: null,
    fakta: [
      '384 400 km unna i snitt — halvannet lyssekund',
      'Diameter 3 474 km, en fjerdedel av jordas',
      'Bundet rotasjon: samme side vender alltid mot oss',
      'Beveger seg 3,8 cm lenger unna hvert år',
    ],
    utforskning: [
      { ar: '1959', tekst: 'Luna 2 (Sovjet) blir det første menneskelagde objektet på månen. Luna 3 fotograferer baksida.' },
      { ar: '1966', tekst: 'Luna 9 gjennomfører den første myke landingen.' },
      { ar: '1968', tekst: 'Apollo 8 er de første menneskene i månebane.' },
      { ar: '1969', tekst: 'Apollo 11: Armstrong og Aldrin går på månen i Stillhetens hav.' },
      { ar: '1970–73', tekst: 'Lunokhod 1 og 2 (Sovjet) — de første fjernstyrte månebilene.' },
      { ar: '1972', tekst: 'Apollo 17, siste bemannede ferd. Tolv mennesker har gått der.' },
      { ar: '2013', tekst: 'Kinas Yutu-rover lander med Chang’e 3.' },
      { ar: '2019', tekst: 'Chang’e 4 lander først av alle på baksida, med roveren Yutu-2.' },
      { ar: '2023', tekst: 'Indias Chandrayaan-3 lander nær sørpolen med roveren Pragyan.' },
    ],
    snl: 'https://snl.no/M%C3%A5nen',
    wikipedia: 'https://no.wikipedia.org/wiki/M%C3%A5nen',
  },

  merkur: {
    type: 'Den innerste planeten',
    oppdaget: 'Kjent fra forhistorisk tid',
    maner: { antall: 0, navn: [] },
    fakta: [
      'Nærmest sola: 58 millioner km i snitt',
      'Et år varer 88 døgn — et soldøgn varer 176',
      'Fra −180 °C om natta til +430 °C om dagen',
      'Ingen atmosfære å snakke om, og ingen måner',
    ],
    utforskning: [
      { ar: '1974–75', tekst: 'Mariner 10 passerer tre ganger og kartlegger under halve planeten.' },
      { ar: '2011–15', tekst: 'MESSENGER går i bane rundt Merkur og kartlegger den helt.' },
      { ar: '2025', tekst: 'BepiColombo (ESA/JAXA) skal gå i bane etter seks forbiflyvninger.' },
    ],
    snl: 'https://snl.no/Merkur',
    wikipedia: 'https://no.wikipedia.org/wiki/Merkur_(planet)',
  },

  venus: {
    type: 'Jordas «søsterplanet»',
    oppdaget: 'Kjent fra forhistorisk tid',
    maner: { antall: 0, navn: [] },
    fakta: [
      'Nesten like stor som jorda — 95 % av diameteren',
      'Overflaten er 465 °C, varmere enn Merkur',
      'Atmosfæren er 90 ganger tettere enn vår',
      'Snurrer BAKLENGS, og så sakte at et døgn er 243 av våre',
    ],
    utforskning: [
      { ar: '1962', tekst: 'Mariner 2 gjør den første passeringen av en annen planet.' },
      { ar: '1970', tekst: 'Venera 7 (Sovjet) sender de første målingene fra overflaten av en annen planet.' },
      { ar: '1975', tekst: 'Venera 9 tar det første bildet fra Venus-overflaten. Den overlevde 53 minutter.' },
      { ar: '1990–94', tekst: 'Magellan radarkartlegger 98 % av planeten gjennom skydekket.' },
      { ar: '2006–14', tekst: 'ESAs Venus Express studerer atmosfæren.' },
      { ar: '2030-tallet', tekst: 'DAVINCI og VERITAS (NASA) og EnVision (ESA) er planlagt.' },
    ],
    snl: 'https://snl.no/Venus',
    wikipedia: 'https://no.wikipedia.org/wiki/Venus_(planet)',
  },

  mars: {
    type: 'Den røde planeten',
    oppdaget: 'Kjent fra forhistorisk tid',
    maner: { antall: 2, navn: ['Phobos', 'Deimos'] },
    fakta: [
      'Et døgn er 24 t 37 min — nesten som vårt',
      'Et år er 687 døgn, så årstidene varer dobbelt så lenge',
      'Olympus Mons er 22 km høy, solsystemets største vulkan',
      'Begge månene ble funnet av Asaph Hall i 1877',
    ],
    utforskning: [
      { ar: '1965', tekst: 'Mariner 4 sender de første nærbildene av en annen planet — 21 bilder.' },
      { ar: '1971', tekst: 'Mars 3 (Sovjet) lander mykt, men sender bare 20 sekunder.' },
      { ar: '1976', tekst: 'Viking 1 og 2 lander og leter etter liv i jordprøver.' },
      { ar: '1997', tekst: 'Sojourner blir den første roveren på Mars — 100 meter i tre måneder.' },
      { ar: '2004', tekst: 'Spirit og Opportunity lander. Opportunity kjørte 45 km og holdt i 14 år.' },
      { ar: '2012', tekst: 'Curiosity lander i Gale-krateret og kjører fortsatt.' },
      { ar: '2018', tekst: 'InSight måler marsskjelv og kartlegger planetens indre.' },
      { ar: '2021', tekst: 'Perseverance lander i Jezero og samler prøver. Helikopteret Ingenuity fløy 72 ganger.' },
      { ar: '2021', tekst: 'Kinas Zhurong-rover lander med Tianwen-1.' },
    ],
    snl: 'https://snl.no/Mars_-_planet',
    wikipedia: 'https://no.wikipedia.org/wiki/Mars_(planet)',
  },

  jupiter: {
    type: 'Solsystemets største planet',
    oppdaget: 'Kjent fra forhistorisk tid',
    maner: {
      antall: 97,
      navn: ['Io', 'Europa', 'Ganymedes', 'Kallisto'],
    },
    fakta: [
      'Mer massiv enn alle de andre planetene til sammen',
      'Snurrer rundt på 9 t 56 min — merkbart flatklemt',
      'Den store røde flekken er bredere enn jorda',
      'Ganymedes er større enn Merkur',
    ],
    utforskning: [
      { ar: '1610', tekst: 'Galileo Galilei ser de fire store månene — det første beviset på at noe kretser om andre enn jorda.' },
      { ar: '1973', tekst: 'Pioneer 10 gjør den første passeringen.' },
      { ar: '1979', tekst: 'Voyager 1 og 2 finner vulkaner på Io og ringer rundt Jupiter.' },
      { ar: '1995–2003', tekst: 'Galileo går i bane i åtte år og slipper en sonde ned i atmosfæren.' },
      { ar: '2016', tekst: 'Juno går i polbane og måler hva som er under skyene.' },
      { ar: '2023', tekst: 'ESAs JUICE er på vei til Ganymedes, Europa og Kallisto — ankomst 2031.' },
      { ar: '2024', tekst: 'Europa Clipper (NASA) skal undersøke havet under Europas isskorpe.' },
    ],
    snl: 'https://snl.no/Jupiter',
    wikipedia: 'https://no.wikipedia.org/wiki/Jupiter_(planet)',
  },

  saturn: {
    type: 'Planeten med ringene',
    oppdaget: 'Kjent fra forhistorisk tid',
    maner: {
      antall: 274,
      navn: ['Titan', 'Enceladus', 'Mimas', 'Rhea', 'Iapetus'],
    },
    fakta: [
      'Så lett at den ville flytt i vann',
      'Ringene er milliarder av isbiter, laget stort sett under 20 m tykt',
      'Titan har innsjøer av flytende metan og en tett atmosfære',
      'Enceladus sprøyter vann fra et hav under isen',
    ],
    utforskning: [
      { ar: '1610', tekst: 'Galilei ser noe på hver side av Saturn, men skjønner ikke hva. Huygens forklarer ringene i 1655.' },
      { ar: '1655', tekst: 'Christiaan Huygens oppdager Titan.' },
      { ar: '1979', tekst: 'Pioneer 11 gjør den første passeringen.' },
      { ar: '1980–81', tekst: 'Voyager 1 og 2 sender de første skarpe bildene av ringene.' },
      { ar: '2004–17', tekst: 'Cassini går i bane i tretten år og finner vanngeysirene på Enceladus.' },
      { ar: '2005', tekst: 'Huygens-sonden lander på Titan — den fjerneste landingen som er gjort.' },
      { ar: '2017', tekst: 'Cassini sendes ned i Saturns atmosfære for ikke å forurense månene.' },
      { ar: '2028', tekst: 'Dragonfly (NASA) skal fly som et drone-helikopter på Titan.' },
    ],
    snl: 'https://snl.no/Saturn',
    wikipedia: 'https://no.wikipedia.org/wiki/Saturn_(planet)',
  },
}

/**
 * Faktablokka for et himmelobjekt fra `himmelObjekter()`.
 *
 * Objektet bærer id-en `mane` eller `planet:<id>`; her tar vi imot begge, så
 * kalleren slipper å kjenne formatet. Stjernebilder har ingen faktablokk — de har
 * sin egen tekst i `stjernebildeInfo.js` — og får null.
 *
 * @param {{id?: string, type?: string}} objekt
 * @returns {object|null}
 */
export function faktaFor(objekt) {
  if (!objekt) return null
  const id = objekt.type === 'mane' ? 'mane' : String(objekt.id ?? '').replace(/^planet:/, '')
  return HIMMEL_FAKTA[id] ?? null
}

/**
 * Månelinja som én lesbar setning.
 *
 * «97 måner» alene sier lite; «97 måner — de fire største er Io, Europa,
 * Ganymedes og Kallisto» sier hva man skal se etter i en kikkert. Og for de uten
 * måner er «ingen måner» et FAKTUM og ikke en manglende verdi.
 *
 * @param {{antall: number, navn: string[]}|null} maner
 * @returns {string|null} null når legemet selv er en måne
 */
export function manerLinje(maner) {
  if (!maner) return null
  if (!maner.antall) return 'Ingen måner'
  const antall = `${maner.antall} ${maner.antall === 1 ? 'måne' : 'måner'}`
  if (!maner.navn?.length) return antall
  const n = maner.navn
  const liste = n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} og ${n[n.length - 1]}`
  // «de største» og ikke «de fire største»: tallet står alt i lista, og en
  // hardkodet mengde blir feil neste gang noen legger til et navn.
  return maner.antall === n.length ? `${antall}: ${liste}` : `${antall} — de største er ${liste}`
}

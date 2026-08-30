// Hvilke himmellegemer som har en globe, og hva som finnes på dem.
//
// REN DATA-MODUL: ingen Three.js, ingen DOM. Det er grunnen til at den er skilt
// fra `himmelGlobe.js`, som bygger kula — `himmelObjekter.js` trenger å vite
// HVILKE legemer som har en globe (det styrer trykk-ringen på himmelen og hva
// søkefeltet tilbyr), og den er selv en ren modul som brukes av UI-et. En import
// av byggeren derfra ville trukket three.js inn i søkelista.
//
// Én tabell, ikke fire filer. Månen kom først (v6.0.0) og hadde sin egen fil; da
// Mars, Jupiter og Saturn skulle ha det samme, var spørsmålet CLAUDE.md tvinger
// fram: er den nye varianten egentlig en OPSJON på originalen? Den er det.

/**
 * Navngitte trekk på månens forside, med selenografiske koordinater
 * (breddegrad, lengdegrad — øst positiv). Utvalget er det man SER med bare øyet
 * eller en enkel kikkert; en liste over alle 9 000 navngitte krater ville vært
 * en database, ikke en opplevelse.
 *
 * Koordinatene er avrundet til hele grader. Presisjonen er rikelig: en label på
 * en kule tegnet 30° bred flytter seg noen piksler av én grad.
 */
export const MANE_TREKK = [
  { navn: 'Mare Imbrium', norsk: 'Regnhavet', lat: 33, lon: -16, type: 'hav' },
  { navn: 'Mare Serenitatis', norsk: 'Klarhetshavet', lat: 28, lon: 18, type: 'hav' },
  { navn: 'Mare Tranquillitatis', norsk: 'Stillhetens hav', lat: 9, lon: 31, type: 'hav',
    merk: 'Apollo 11 landet her i 1969.' },
  { navn: 'Mare Crisium', norsk: 'Krisehavet', lat: 17, lon: 59, type: 'hav' },
  { navn: 'Oceanus Procellarum', norsk: 'Stormhavet', lat: 19, lon: -57, type: 'hav',
    merk: 'Det største av alle — en tredjedel av forsidas mørke flater.' },
  { navn: 'Mare Nubium', norsk: 'Skyhavet', lat: -21, lon: -17, type: 'hav' },
  { navn: 'Mare Frigoris', norsk: 'Kuldehavet', lat: 56, lon: -1, type: 'hav' },
  { navn: 'Tycho', norsk: null, lat: -43, lon: -11, type: 'krater',
    merk: 'Det lyse krateret nede på skiva, med stråler av utkastet materiale '
      + 'som når en fjerdedel rundt månen. Lett å se med bare øyet ved fullmåne.' },
  { navn: 'Copernicus', norsk: null, lat: 10, lon: -20, type: 'krater',
    merk: '93 km bredt, med terrasserte vegger og fjell i midten.' },
  { navn: 'Kepler', norsk: null, lat: 8, lon: -38, type: 'krater' },
  { navn: 'Plato', norsk: null, lat: 51, lon: -9, type: 'krater' },
  { navn: 'Grimaldi', norsk: null, lat: -6, lon: -68, type: 'krater' },
]

/**
 * HIMMELLEGEMENE MED GLOBE, med det som skiller dem.
 *
 * HVORFOR BARE DISSE FIRE: månen, Mars, Jupiter og Saturn har trekk man kan
 * kjenne igjen og navngi. Merkur er en grå kule på skjermen, og Venus er et
 * ugjennomtrengelig skydekke — en globe av dem ville vært en påstand om at det
 * er noe å se. De to får derfor heller ingen trykk-ring på himmelen: et omriss
 * som lover en globe det ikke finnes, er verre enn ingen ring.
 *
 * `farge` er fallbacken når fotografiet ikke er der. Den er ikke pynt: teksturene
 * bakes i CI (scripts/bygg-himmelkart.mjs), og NASA/USGS er sperret fra
 * utviklingsmiljøene — så «uten tekstur» er den normale tilstanden lokalt, og
 * legemet må være gjenkjennelig likevel.
 *
 * `akseHelling` er aksens helling mot baneplanet. Den er med fordi den er
 * SYNLIG: Saturns ringer og Mars' polkalotter står skjevt, og en kule uten
 * helling ser ut som en feil for den som har sett et bilde.
 */
export const HIMMELLEGEMER = {
  mane: {
    navn: 'Månen',
    farge: '#d8d4cc',
    tekstur: 'maane.jpg',
    akseHelling: 0,
    trekk: MANE_TREKK,
    // Månen viser fase, og den er hele poenget med at kula er en kule.
    ambient: 0.055,
  },
  mars: {
    navn: 'Mars',
    farge: '#c1643c',
    tekstur: 'mars.jpg',
    akseHelling: 25.2,
    ambient: 0.07,
    trekk: [
      { navn: 'Olympus Mons', norsk: null, lat: 18, lon: -134, type: 'fjell',
        merk: 'Solsystemets største vulkan — 22 km høy, nesten tre ganger '
          + 'Everest, og så bred som Norge er lang.' },
      { navn: 'Valles Marineris', norsk: 'Marinerdalene', lat: -14, lon: -59,
        type: 'canyon',
        merk: 'Et canyon-system på 4 000 km. Grand Canyon ville forsvunnet i en '
          + 'sidegrein.' },
      { navn: 'Tharsis', norsk: null, lat: 2, lon: -100, type: 'fjell',
        merk: 'Vulkanplatået med tre kjempevulkaner på rad.' },
      { navn: 'Hellas Planitia', norsk: 'Hellasbassenget', lat: -42, lon: 70,
        type: 'krater',
        merk: '2 300 km bredt nedslagskrater, sju kilometer dypt.' },
      { navn: 'Elysium Mons', norsk: null, lat: 25, lon: 147, type: 'fjell' },
      { navn: 'Syrtis Major', norsk: null, lat: 8, lon: 70, type: 'flate',
        merk: 'Den mørke flekken de første teleskop-observatørene så — og trodde '
          + 'var et hav.' },
      { navn: 'Planum Australe', norsk: 'Sørpolkalotten', lat: -87, lon: 0,
        type: 'is', merk: 'Vannis og frossen CO₂. Den vokser og krymper med '
          + 'årstidene, akkurat som jordas.' },
      { navn: 'Planum Boreum', norsk: 'Nordpolkalotten', lat: 88, lon: 0,
        type: 'is' },
    ],
  },
  jupiter: {
    navn: 'Jupiter',
    farge: '#d8b48b',
    tekstur: 'jupiter.jpg',
    // BÅND SOM FALLBACK. En gassplanet uten bånd er en beige kule, og
    // teksturen bakes i CI fra NASA — altså ikke der lokalt. Båndene genereres
    // på klienten (se bandTekstur i himmelGlobe.js) og er gjenkjennelige selv
    // om fotografiet aldri kommer. Fargene er lest av Cassini-bilder: lyse soner
    // og mørkere belter i vekselvis brunt og kremhvitt.
    band: [
      [0.00, '#c8a878'], [0.08, '#e8dcc0'], [0.16, '#b08a5c'], [0.24, '#efe4cb'],
      [0.33, '#a87c50'], [0.42, '#f2e8d2'], [0.50, '#d9c39c'], [0.58, '#b8804e'],
      [0.66, '#f0e5cd'], [0.75, '#a97f55'], [0.84, '#e6d9bb'], [0.92, '#c0a074'],
      [1.00, '#d8c4a0'],
    ],
    akseHelling: 3.1,
    // Jupiter har ingen fast overflate og nesten ingen fase sett fra jorda.
    // Ambient er høyere så båndene leses over hele skiva.
    ambient: 0.12,
    trekk: [
      // MÅLT I DET BAKTE KARTET, ikke slått opp: flekken driver i lengdegrad, og
      // et Jupiter-kart er et øyeblikksbilde. Cassini-mosaikken fra desember 2000
      // har den på lat −21,7 / lon −47,5, og merkelappen skal treffe FOTOGRAFIET
      // brukeren ser. Byttes teksturkilden, må dette tallet måles på nytt — de to
      // reservekildene i bygg-himmelkart.mjs har den et annet sted.
      //
      // Og den er ikke rød i denne mosaikken, men lakse-oransje. Det er ekte:
      // flekken bleknet gjennom 1990-tallet, og «rød» er et navn fra 1800-tallet.
      { navn: 'Den store røde flekken', norsk: null, lat: -22, lon: -48,
        type: 'storm',
        merk: 'En storm som har rast i minst 190 år og er bredere enn jorda. '
          + 'Den krymper: på 1800-tallet var den mer enn dobbelt så vid.' },
      { navn: 'Ekvatorialbeltet', norsk: null, lat: 0, lon: 40, type: 'band',
        merk: 'Skyene går i motsatte retninger i nabobelter, med 500 km/t i '
          + 'grenseskiktet mellom dem.' },
      { navn: 'Nordlige tempererte belte', norsk: null, lat: 35, lon: 120,
        type: 'band' },
      { navn: 'Sørlige tempererte belte', norsk: null, lat: -38, lon: 150,
        type: 'band' },
    ],
  },
  saturn: {
    navn: 'Saturn',
    farge: '#e0cba0',
    tekstur: 'saturn.jpg',
    // Saturns bånd er svakere i kontrast enn Jupiters — det er en ekte forskjell
    // og ikke en forenkling: en dis av ammoniakk ligger over dem.
    band: [
      [0.00, '#cdb489'], [0.12, '#e8d7ae'], [0.26, '#dcc79c'], [0.40, '#f0e2bd'],
      [0.52, '#e6d3a6'], [0.64, '#eaddb4'], [0.78, '#d9c496'], [0.90, '#e4d3aa'],
      [1.00, '#cfb68c'],
    ],
    akseHelling: 26.7,
    ambient: 0.12,
    // RINGENE ER IKKE VALGFRIE. En Saturn uten ringer er ikke Saturn — det er
    // en blek Jupiter. Tallene er i planetradier: A-ringens ytterkant ligger på
    // 2,27 R, og Cassini-delingen på ~1,95 R.
    ringer: { indre: 1.24, ytre: 2.27, deling: 1.95 },
    trekk: [
      { navn: 'Sekskanten', norsk: null, lat: 78, lon: 0, type: 'storm',
        merk: 'En sekskantet jetstrøm rundt nordpolen, 30 000 km tvers over. '
          + 'Ingen vet hvorfor den har seks sider.' },
      { navn: 'Ekvatorbåndene', norsk: null, lat: 0, lon: 60, type: 'band',
        merk: 'Vinder på 1 800 km/t — de raskeste i solsystemet.' },
      { navn: 'Sørlige belte', norsk: null, lat: -40, lon: 140, type: 'band' },
    ],
  },
}

/**
 * Prosaen i infokortet, per legeme. Egen tabell og ikke inne i HIMMELLEGEMER
 * fordi den siste er GEOMETRI og tall — det som styrer hvordan kula tegnes — og
 * teksten er noe man skriver om uten å røre en eneste koordinat.
 *
 * `omtale` er det ene faktumet som er verdt å ta med seg, og kort med vilje:
 * kortet står oppå himmelen man ville se.
 *
 * DET FANTES ET `bruk`-FELT MED EN BRUKSANVISNING — «dra for å snurre, trykk for
 * å legge den tilbake» — og det er FJERNET i v6.3.3 etter felttest. Grunnen er at
 * gesten viste seg å ikke trenge ord: trykk-ringen (v6.3.2) sier at legemet kan
 * åpnes, og at man drar i en kule for å snurre den er det man prøver først
 * uansett. En instruksjon som forklarer det åpenbare stjeler linjer fra det man
 * faktisk kom for å lese. Ikke legg den tilbake uten en ny observasjon.
 */
export const GLOBE_TEKST = {
  mane: {
    omtale: 'Månen snur alltid samme side mot oss — den bruker like lang tid på '
      + 'én runde om sin egen akse som om jorda.',
  },
  mars: {
    omtale: 'Et døgn på Mars er 24 timer og 37 minutter — nesten vårt eget. Året '
      + 'er derimot nesten to av våre, så hver årstid varer dobbelt så lenge.',
  },
  jupiter: {
    omtale: 'Jupiter snurrer rundt på under ti timer, så rask at planeten er '
      + 'merkbart flatklemt ved polene. Den har ingen fast overflate å lande på — '
      + 'skyene bare blir tettere nedover.',
  },
  saturn: {
    omtale: 'Ringene er milliarder av isbiter, fra sandkorn til hus, i et lag som '
      + 'stort sett er under tjue meter tykt. Saturn er dessuten så lett at den '
      + 'ville flytt i vann.',
  },
}

/** Har dette legemet en globe man kan åpne? Brukt av ring-affordansen. */
export function harGlobe(id) {
  return Object.prototype.hasOwnProperty.call(HIMMELLEGEMER, id)
}

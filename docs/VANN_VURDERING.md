# Vann-stacken — foreløpige funn og problemstilling

## Status 2026-09-12 — vurdert på nytt: N50-innsjø som bakte fliser er en MIDDELS jobb

**Beslutning: AVVENTER. Ingen kode er endret.** Seksjonen er et minne for den
som skal gjøre jobben, så den kan starte på steg 1 og ikke på en ny kartlegging.
Notatet fra 2026-08-09 står urørt under; tre av premissene der har endret seg
siden, og de er merket her.

### Hva som har endret seg siden 2026-08-09

1. **Formatet koder flater med hull.** Notatet under sier at pakkeformatet bare
   kodet linjer. `src/lib/n50ArealPakke.js` (v5.24.0) koder ringer med hull,
   kvantisert til 1e-5°, i fliser på 0,5° × 1°. Målingen som «måtte gjøres først»
   kan nå gjøres med et flagg.
2. **Arealdekke ER målt.** Myr alene: **206 fliser, 56 MB, 643 274 flater over
   20 699 km²** (CHANGELOG v5.24.0). Myr + skog + isbre: 117 MB / 207 fliser i
   `public/data/n50-areal/`, største flis 2,4 MB. Stinettet er 12 MB.
3. **`filterOsmWaterElements` bor i `src/lib/vannMerge.js` (L136)**, ikke i
   `createMapFlow`, og deles av appen og headless (v5.18.3). Flaggene avledes
   av kildens innhold (`vannKildeFlagg`, L98). Lappeteppet er samlet, ikke borte.

### Det som allerede finnes — derfor er jobben middels og ikke stor

- **Baken leser laget som holder innsjøene.** `scripts/bygg-n50-areal.mjs`
  leser `N50_Arealdekke_omrade` fra Geonorge-FGDB-en (via
  `scripts/geonorgeN50.mjs`), og det er SAMME lag som bærer `Innsjø`,
  `InnsjøRegulert`, `ElvBekk`, `Havflate` og `FerskvannTørrfall`. De filtreres
  bort i `OBJTYPE`-tabellen (L155–166) — ikke av at de mangler i kilden.
- **Formatet har plass.** `TYPER` i `n50ArealPakke.js` (L45) utvides BAKERST;
  dekoderen (L138) dropper ukjente indekser, så gamle klienter tåler nye typer.
- **Sammenslåingen har alt en `n50Water`-plass.** `slaaSammenVann({ osm,
  n50Water, nveLakes })` (`vannMerge.js` L183) er delt av `createMapFlow`
  (L711) og `mcp/headless.js` (L261). Elementer med `natural=water` og
  `_source: 'n50'` er det den forventer i dag — fra NVE. Kilden kan byttes uten
  at forsoningen røres.
- **Én dør for flisene.** `fetchN50Areal` (`n50ArealFetcher.js`) brukes av app,
  headless og Worker (`n50ArealKilde` i `mcp/headless.js` L94 velger fil/URL).
  Manifest-hash som cache-nøkkel (`lib/n50FlisNokkel.js`) og service workerens
  uversjonerte `lende-n50`-cache virker uendret for en ny type.

### Plan i tre steg — i denne rekkefølgen

**Steg 1 — MÅL, uten å skrive (én PR, ingen klientendring).**

- `scripts/bygg-n50-areal.mjs`: legg `innsjø`/`innsjo` og
  `innsjøregulert`/`innsjoregulert` → `'innsjo'` i `OBJTYPE` (L155).
  `ElvBekk` → `'elv'` er valgfritt, se «Utenfor rammen». Per-type-skruer i
  `STANDARD_TOLERANSE`/`STANDARD_MINAREAL` (L107–108): start med myras
  **4 m / 2 500 m²** — øyene er hele poenget (Kolstadøya i Setten), og 8 m
  forenkling fjerner små øyer før man har målt hva de koster.
- `src/lib/n50ArealPakke.js`: `TYPER` → `[..., 'isbre', 'innsjo']` (bakerst!).
- `.github/workflows/bygg-n50-areal.yml` (L53): `typer`-beskrivelsen MÅ nevne
  `innsjo` — «en knott ingen vet om er ingen knott».
- La `--typer`-defaulten (L69) stå på `myr,skog,isbre` til steg 2 er bestemt.
- Kjør workflowen med `bare_mal = true` og `typer = innsjo`. Den laster hele
  landet (~2,5 GB, ~19 min) og skriver ingenting. Les av: MB, flater, km²,
  største flis. Sammenlikn med myras tall over. Estimatet før måling er
  **40–70 MB** — Norges innsjøareal (~17–19 000 km²) er i samme størrelsesorden
  som myra, men strandlinjer er lengre per km² enn myrkanter.

**Steg 2 — KLIENT: flisene på kritisk sti, NVE som fallback.**

- `src/lib/n50ArealFetcher.js`: de dekodede flatene deles ETTER type — areal-
  typene går som før til `n50Areal`; `innsjo` blir elementer med
  `natural=water`, `water=lake`, `_source: 'n50'` (formen i
  `polygonToElement`, `n50Fetcher.js` L139), IKKE gjennom `n50ArealTilElementer`
  (L230), som tagger alt `lende:n50areal`. Én flis-henting, to utganger — ellers
  lastes hver flis to ganger.
- `src/lib/createMapFlow.js`: `n50P` (L398) blir flis-innsjøene, med NVE-query
  (`fetchN50Water`) som fallback når manifest/fliser feiler (offline, 404, kart
  bygget før baken). `nveLakesP` (identify, L413) forblir fallbackens fallback.
  Innsjøene VENTES på i `Promise.all` (L666); arealtypene blir under
  restbudsjettet (L667–689). Samme endring i `mcp/headless.js` (L200/L242).
- `vannMerge.js`: `vannKildeFlagg` gir `harInnsjo` av seg selv.
  `filterOsmWaterElements` beholdes uendret — punkt-i-ring-forsoningen er
  fortsatt det som holder øyene åpne.
- Fasit: `scripts/fasit-kart.js` vil flytte vann-tallene i Kolstadøya, Gjende
  og Strykenåsen. LES diffen, og kjør `--oppdater` bare fra CI-workflowen
  (NVE gir 403 herfra, se CLAUDE.md).
- Tester som skal ha en linje: `n50ArealPakke.test.js` (ny indeks dekodes,
  ukjent droppes), `n50ArealFetcher.test.js` (delingen), `vannMerge.test.js`
  (flis-innsjø undertrykker OSM-kopi med hull intakt), `n50Fetcher.test.js`
  (fallback-stien). Røyk: `npm run royk` og `npm run frie -- <fil>`.
- Levering: versjons-bump i fire filer, CHANGELOG, og skriv vann/sjø-seksjonen
  i CLAUDE.md om — «`fetchN50Water` er NVE» blir da usant.

**Steg 3 — ÅPENT VALG: innsjønavn.** N50 Arealdekke har ingen navn. I dag
kommer de fra NVE (`OUT_FIELDS 'objectid,navn'`, `n50Fetcher.js` L83) og OSM
(`name`); `mapBuilder.js` leser `tags.name ?? tags.navn` (L1360, L2106, L2432).
Tre veier, i anbefalt rekkefølge:

1. **Arv navnet fra OSM-kopien som undertrykkes.** `filterOsmWaterElements`
   dropper OSM-ferskvann inne i en N50-ring; representasjonspunktet og ringene
   finnes alt (`elementRepPoint`, `ytreRinger`). Flytt `name` over på
   N50-polygonet før droppet. Null nye data; dekningen er OSMs, altså god ved
   folk og tynn i utmark.
2. **Bak navn fra N50 stedsnavn** som `isbrenavn.json` (navnepasset i baken:
   `NAVN_LAG`, `NAVN_FELT`, `TYPE_FELT`, filter på innsjø/vann/tjern). Full
   dekning, men langt flere punkter enn breenes 548 — må måles.
3. **Behold NVE-query bare for navn.** Forkastes: da står NVE på kritisk sti
   igjen, og hele gevinsten i steg 2 faller.

### Prisen

| Hva | Tall |
|---|---|
| Nye data i `public/` | est. 40–70 MB (mål i steg 1) |
| Nedlasting for brukerne | ALLE fliser én gang — typene deler flisfil, så hver flis får ny hash |
| master-historikk | +~160 MB per bake som endrer flisene; `filter-repo`-ryddingen står fortsatt igjen |
| CI | én bake (~25 min) + én fasit `--oppdater` |
| Grenser | 100 MB/fil (største flis 2,4 MB i dag), 1 GB Pages (`dist/` er 133 MB) |

### Gevinst — og hva det IKKE gir

- **Robusthet, ikke fart.** NVE forsvinner fra kritisk sti; MCP/Worker og
  sandkasser der NVE gir 403 får innsjøer; en `.lendekart` er uberørt. Overpass
  er fortsatt 81–97 % av byggetida, så kartet blir ikke merkbart raskere.
- Elveflater fra N50 blir MULIG (OSM har dem sporadisk) — men se under.

### Utenfor rammen — bevisst

- **Havflate.** Funn 4 under står: DEM-kystlinja (5 m) er finere enn N50.
- **Å droppe OSM.** Funn 5 står: 76 selektorer, ingen N50-erstatning for POI.
- **`ElvBekk` som flate.** OSM-elveflater BEHOLDES ALLTID i
  `filterOsmWaterElements`; N50-elveflater oppå dem trenger en ny
  undertrykkelsesregel, og `harBekk` (linjer: `waterway=stream|ditch`) er ikke
  det flagget. Ta det som egen PR etter innsjøene, eller ikke.
- **Opasitets-spørsmålet** fra 2026-08-09 er fortsatt ikke undersøkt, og det
  er uavhengig av kildebyttet.

---

## Notat 2026-08-09 — den opprinnelige vurderingen

**Status da: ikke besluttet. Ingen kode er endret på grunnlag av dette notatet.**
Tre premisser er endret siden — se seksjonen over.

Skrevet 2026-08-09 (v5.0.16), rett etter at N50-stiløftet ble ferdig. Spørsmålet
kom opp underveis og ble utsatt bevisst — notatet finnes så utgangspunktet ikke
må graves fram på nytt.

## Spørsmålet som ble stilt

> Kunne vi egentlig droppet OSM helt og tatt alt fra N50? Og da samtidig ryddet
> i gamle problemer med overgang sjø og land? Et mylder av logikk/lappeteppe.

Lappeteppet er ekte. Spørsmålet er om «alt fra N50» er kuren, eller om den
behandler symptomet.

## Slik ser vann-stacken ut i dag

Bakgrunnen ER land (ISOM 001 kremgul). Vann males oppå i lag:

| Lag | Kilde | Merknad |
|---|---|---|
| Sjø | `seaFromDem.js` — Kartverket DTM | Primær. CORS-trygg, avledet fra DEM-en vi likevel henter |
| Dybdeareal (ISOM 307) | Sjøkart-WFS | Klippes mot den autoritative sjø-geometrien |
| Innsjø | `n50Fetcher.js` → **NVE Innsjødatabase** | N50-avledet geometri, hentet live |
| Elv/bekk, resten | OSM | Fyller der de andre ikke har dekning |

`marineTopology.js` bygger ÉN autoritativ sjø-geometri. En land-maske (union av
alt vann) hindrer konturer og vegetasjon over vann.

## Funn 1 — «N50» er allerede delvis der, men ikke som en N50-tjeneste

`src/lib/n50Fetcher.js` heter N50, men henter fra **NVE Innsjødatabase** via
ArcGIS REST `query` på bbox. Geometrien er N50-avledet (NVE bygger databasen på
N50-vann) og elementene beholder `_source: 'n50'`, men kilden er NVE.

Grunnen står i filhodet: **Kartverkets N50 vektor-WFS er avviklet.** Det er den
harde begrensningen bak hele spørsmålet. «Ta alt fra N50» betyr i praksis «bak
alt fra N50 til statiske filer», ikke «bytt til en annen live-tjeneste».

NVE har ingen Havflate. Sjø kommer fra DEM/Sjøkart, og må fortsette å gjøre det.

## Funn 2 — dette har vært forsøkt før, og feilet på størrelse

Fra filhodet i `n50Fetcher.js`: en periode ble N50-innsjøer bakt til statiske
FlatGeobuf-filer i git — **400–800 MB**, med kvalitets-ødeleggende forenkling
for å komme under GitHubs 100 MB-grense per fil. Kalt «Munkeskjæra-problemet».
Det ble forlatt til fordel for live NVE-henting, som gir øy-hullene intakte i
full N50-detalj (Setten-ringen: 1861 punkter, identisk med uforenklet N50).

**Men:** N50-stiløftet (v5.0.13–16) viser at premisset for den gamle
konklusjonen ikke lenger holder uten videre. Hele landets stinett — 179 706 km —
ble 12 MB i 208 fliser med et eget pakkeformat (delta + zigzag varint, 3 m
forenkling). FlatGeobuf var feil verktøy, ikke nødvendigvis feil idé.

Om innsjø-polygoner pakker like godt er **ikke målt**. Flater med hull er en
annen sak enn linjer, og innsjøkystlinjer er lange. Dette er det første som må
måles hvis spørsmålet tas opp igjen.

## Funn 3 — den egentlige gevinsten er neppe kildebyttet

Lappeteppet brukeren beskriver sitter i stor grad i ÉN funksjon:
`filterOsmWaterElements` i `src/lib/createMapFlow.js` (linje 105). Den avgjør
per polygon hvilken kilde som vinner:

- Saltvann → drop hvis N50 har sjø
- Elveløp som flate → behold alltid (verken NVE eller N50 har dem)
- Ferskvann inne i en N50-ring → drop (N50 har de riktige øy-hullene)
- Ferskvann inne i en NVE-ring → drop
- Navngitt ferskvann ellers → behold
- Resten → drop hvis N50 har ferskvann

Grunnen til at dette er så vrient: hvert vann-polygon males **opakt**. En
hull-løs OSM-kopi av samme innsjø malt oppå N50-versjonen dekker øya igjen
(Kolstadøya i Setten). Forsoningen er punkt-i-ring per flate, ikke en enkel
prioritering.

Klarer vi å fjerne behovet for denne funksjonen, forsvinner mesteparten av
lappeteppet — **uavhengig av hvilken kilde vannet kommer fra.** Det er den
tråden jeg ville trukket i først.

## Funn 4 — DEM-kystlinja er finere enn N50 ville vært

`seaFromDem.js` avleder sjø fra DTM-en på 5 m oppløsning (kystkart oppgraderes
eksplisitt til 5 m i et andre fetch-trinn, `COASTAL_DEM_RES_M`, nettopp for at
smale sund skal oppløses). N50 er 1:50 000-generalisert.

Å bytte kystlinja til N50 ville altså **forverre** den geometriske kvaliteten,
ikke forbedre den. Sjø-siden av «overgang sjø og land» bør bli der den er.

## Funn 5 — OSM kan ikke droppes uansett

Overpass-spørringen i `mapBuilder.js` har **76 selektorer**. Det aller meste er
POI og kultur-landskap som N50 ikke har i samme form: hytter, bommer, benker,
utsiktspunkter, gapahuker, klatrefelt, badeplasser. Det finnes ingen N50-erstatning
for det laget.

OSM er dessuten den ferske kilden. N50-baken kjøres manuelt ved behov; OSM hentes
live ved hver kart-bygging. Nye stier og nye hytter kommer inn der først — det var
en uttalt del av begrunnelsen for at stinett-baken ikke trenger fast oppdatering.

## Foreløpig standpunkt

Ikke bytt kilde. Angrip forsoningslaget.

Rekkefølge hvis dette tas opp igjen:

1. **Mål først.** Pakk N50 Innsjø + Havflate med samme verktøy som stinettet
   (`scripts/bygg-n50-sti.mjs` + `n50StiPakke.js`) og se hva flatene faktisk
   koster. Uten det tallet er alt annet gjetning. Merk at pakkeformatet i dag
   koder **linjer**, ikke flater med hull — det trenger en utvidelse før målingen
   i det hele tatt kan gjøres.
2. **Undersøk om opasiteten kan løses i stedet.** Hvis vann-polygoner kunne males
   slik at en hull-løs kopi ikke ødelegger en riktig versjon under, faller
   behovet for punkt-i-ring-forsoningen bort — og da er kildespørsmålet nesten
   uinteressant.
3. **Vurder Arealdekke separat.** Full N50-overgang trekker inn Arealdekke, som
   er det store temaet i N50 Kartdata. Størrelsen er **ikke målt** (hele
   N50-pakken for Buskerud er >300 MB som FGDB-zip, men fordelingen mellom temaer
   er ukjent). Ikke anta at den er håndterbar.

## Hva som IKKE er verifisert

Vær ærlig om dette hvis notatet plukkes opp senere:

- Innsjø-flatenes pakkede størrelse — ikke målt.
- Arealdekkes andel av N50-pakken — ikke målt.
- Om opasitets-problemet i det hele tatt er løsbart i SVG-rendringen — ikke undersøkt.
- Om N50 Havflate ville gitt bedre eller dårligere resultat enn DEM i indre farvann
  der DTM-en er upålitelig — ikke undersøkt. Funn 4 gjelder åpen kyst.

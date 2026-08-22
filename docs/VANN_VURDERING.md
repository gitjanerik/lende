# Vann-stacken — foreløpige funn og problemstilling

**Status: ikke besluttet. Ingen kode er endret på grunnlag av dette notatet.**

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

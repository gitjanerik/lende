# Vann-stacken — funn og problemstilling

**Status: MÅLT 2026-09-18, ikke besluttet. Ingen klientkode er endret på
grunnlag av dette notatet.** Målingen står øverst; notatet fra 2026-08-09 står
uendret under den, fordi spørsmålene der fortsatt er de riktige.

Samme innhold som lesestoff for mobil: https://claude.ai/artifact/XeTnaf2M6asAPr1eUdtLQX

## Målt 2026-09-18 — det som var gjetning i august, med tall

Skrevet på gren `claude/n50-vann-saturn-ringer-gyxpsp` etter to kjøringer av
`.github/workflows/probe-n50-vann.yml` (`npm run probe:n50vann`; skriver bare
til `probe-ut/`, endrer ingenting, siste kjøring run 35388440273) og én nasjonal
`--mal`-bake i «Bygg N50 arealdekke» med `typer = innsjo,elv` (run 35385801997).
Alt under er lest av CI-logger: Geonorge, NVE, Overpass og Kartverkets WCS er
sperret fra sandkassene, så ingenting av det kan måles der notatet skrives.

Utløseren var et skjermbilde fra Varangerbotn (Uhcit Vuoksajávri, 70.14522 N
28.45329 Ø): innsjøen så forskjøvet ut mot terrenget under, og eieren spurte om
N50-vann gir et mer enhetlig uttrekk, om det fjerner overgangsproblemer, om en
bake koster ~115 MB historikk for alltid — og hva mer detalj i SVG-en koster.

### 1. Registreringen er eksakt — også i Finnmark

Proben ber om et 8 × 8 km-ark rundt hvert punkt gjennom appens egne
WCS-endepunkter og leser GeoTIFF-hodet MOT den bestilte bboksen — noe
`fetchWCSDtm` aldri gjør; den strekker rasteret over bboksen den ba om.

| Sted | Endepunkt | bbox-avvik | CRS i hodet | pikselstørrelse |
|---|---|---|---|---|
| Nesseby | NHM_DTM_25833 (`RESPONSE_CRS` 25832) | 0,00 m på alle fire kanter | EPSG:25832 | 10,0030 × 9,9991 m |
| Vardåsen | NHM_DTM_25832 og _25833 | 0,00 m | EPSG:25832 | 10,0000 × 9,9959 m |
| Gjendesheim | begge | 0,00 m | EPSG:25832 | 9,9940 × 10,0036 m |
| Tromsø | _25833 | 0,00 m | EPSG:25832 | 9,9984 × 10,0034 m |

I Finnmark og Troms svarer 25832-endepunktet ServiceExceptionReport (HTTP 200,
`application/vnd.ogc.se_xml`), så de arkene går ALLTID via 25833-stien — og den
respekterer `RESPONSE_CRS`: hodet er identisk med et 25832-hode (PixelIsArea,
avvik i pikselstørrelse ≤ 0,03 %). Hadde rasteret kommet med sone 33-akser,
ville det stått −5,70° dreid ved Nesseby. Det gjør det ikke.

Så ble hver innsjø flyttet mot DTM-en: beste skift per innsjø er der andelen
flatt terreng INNE i ringen minus andelen i et bånd UTENFOR er størst (±100 m i
4 m-steg, så ±3 m i 1 m-steg; «sikker» = minst 60 % flatt inne), og en
similarity-transform (tx, ty, θ, skala) ble tilpasset over de sikre innsjøene:

| Sted | oppl. | skift (ΔE, ΔN) | rotasjon | RMS | median \|skift\| per innsjø |
|---|---|---|---|---|---|
| Nesseby (23 sikre) | 10 m | (−2,5, −7,1) m | −0,053° | 15,5 m | 5,8 m |
| Nesseby | 5 m | (−1,7, −8,5) m | −0,050° | 15,3 m | 8,2 m |
| Vardåsen, 25832 | 10 m | (1,0, −1,2) m | −0,037° | 4,7 m | 5,8 m |
| Vardåsen, 25833 | 10 m | (1,5, −0,8) m | – | 4,2 m | 7,1 m |
| Gjendesheim | 10 / 5 m | – | – | – | 7,3 / 6,1 m |
| Tromsø | 10 m | – | – | – | 3,6 m |

Alt ligger innenfor én DTM-celle, nord som sør. **Det finnes ingen
projeksjons- eller registreringsfeil i pipelinen, og N50-vann ville ikke flyttet
innsjøen én meter:** NVE-ringen ER N50-geometrien (IoU 0,92–0,97 mot rå N50,
4–8 m ringavstand — N50s egen generalisering), og OSM ligger 0,5 m fra NVE her.

### 2. Det eieren så, er flatt terreng — ikke en forskjøvet innsjø

DTM-en har et sammenhengende flatt speil på 35,02 m over 267 daa rundt en
innsjø på 59 daa: innsjøen er 22 % av flata, og strandlinja ligger på
34,9–35,1 m hele veien rundt. De tre innsjøene med store «beste skift»
(Vuoksajávri −83/−45 m, Uhcit +12/−23 m, en navnløs på 29 daa +4/−42 m)
beholder alle 36–63 % flatt terreng i båndet UTENFOR ringen — kriteriet finner
ingen kant fordi det ikke er noen. Myr og våtmark på innsjønivå ser ut som
«innsjøen ligger et annet sted enn terrenget sier» i relieff og kurver, og det
er nøyaktig det UT.no dekker med myrsymboler rundt vannet.

Én kandidat gjenstår på eierens egen enhet og kunne ikke måles herfra: et kart
bygget på syntetisk DEM (`source: 'synthetic (generic)'` når begge WCS-ene
feilet) eller med Terrarium-fyll i hull (`… + Terrarium-fyll`; Terrarium er
Web Mercator og registreres uavhengig av WCS). «Mine kart» viser «syntetisk
DEM» i info-linja, og punkt-skuffens kildelinje viser `DEM: <kilde> · <oppl.> m`.
Står det noe annet enn ren `NHM_DTM_…`, er forskyvningen DEM-ens, ikke
vannstackens.

### 3. En bake koster ~35 MB, ikke 115 — og går i sin egen katalog

Nasjonal `--mal`-bake (15 fylker, 16,5 min, 4 m forenkling, 400 m² gulv):

| Type | Flater | km² | Forkastet |
|---|---|---|---|
| innsjo | 772 480 | 18 715 | 252 218 (< 400 m² eller kollapset) |
| elv | 21 313 | 1 239 | 1 276 |

**210 fliser, 35,6 MB på disk (31,3 MB gzip), største flis 903 KB (59.0_6.0).**
Finnmark alene: 181 248 innsjøer, 17,70 MB rå → 6,83 MB ved 4 m (29 % av
hjørnene beholdes), gzip 6,02 MB. Per fylke: Finnmark 181k, Trøndelag 167k,
Nordland 145k, Vestland 140k.

De 115 MB i spørsmålet er AREAL-baken (myr + skog + isbre, 117 MB). Vann skal
ikke inn i den: i en egen `public/data/n50-vann/` med eget manifest er
areal-flisene urørte, ingen bruker laster dem om igjen, og hver vann-bake legger
≈ 31–35 MB i master-historikken — ikke 115. Målt referanse: to areal-baker er
171 MB rå men 103,4 MB pakket, fordi git delta-komprimerer flater som ikke
endret seg; en enkelt flis gzipper bare ~11 %.

### 4. «Enhetlig uttrekk» er sant for sømmen mot myra — og uten betydning for nøyaktigheten

N50-vann ligger i SAMME lag som myr og skog (`N50_Arealdekke_omrade`), og
partisjonen er ekte: 1 089 av 1 089 hjørner på vannflatene i probe-bboksen
finnes eksakt igjen i en naboflate (100 %). Tre ting demper det:

- **Sømmen er 5 m i dag.** Ved Uhcit er myr-hullet i den bakte flisen 58 daa
  mot NVE-ringens 59 (IoU 0,917, ringavstand snitt 5,4 m, p95 8,9 m). Det er
  sliveren av kremgul bakgrunn mellom vann og myr — 0,5–0,9 mm i 1:10 000.
  Bakt vann med myras 4 m ville lukket den; mot skog (8 m) ville den bestått,
  for toleransen er per type.
- **Hullene er ikke innsjøformede.** Gávpotláttu: skog-hull 31 daa mot innsjø
  14 daa (IoU 0,467). Hullet er «alt som ikke er skog», og ÅpentOmråde bakes
  bevisst ikke — så et bakt vann fyller ikke hullet, det ligger i det.
- **Nøyaktigheten er den samme.** NVE live ER N50 (IoU 0,92; 28 hjørner mot
  128 rå er N50s generalisering på vei inn i NVE). Baken ville i tillegg
  forenklet til 4 m og beholdt 29 % av hjørnene.

Sjøen er upåvirket: Havflate bakes ikke (Funn 4 under), så overgangen sjø–land
er DEM-ens som før.

### 5. Detalj koster lite — konturene eier arket

3 km-ark over probepunktet, headless: **242,1 KB (gzip 97,6 KB)**, 9,3–10,4 byte
per hjørne uansett lag.

| Lag | KB | andel | hjørner |
|---|---|---|---|
| kontur | 123,2 | 50,9 % | 12 844 |
| myr (N50, 4 m) | 56,1 | 23,2 % | 5 560 |
| style | 16,8 | 6,9 % | – |
| vann | 15,2 | 6,3 % | 825 |
| skog (N50, 8 m) | 13,0 | 5,4 % | 1 288 |
| sti | 3,1 | 1,3 % | 293 |
| bekk | 2,4 | 1,0 % | 219 |
| stupkant | 2,4 | 1,0 % | 133 |

OSM-forenklingen (`simpScale` 0,84 → toleranse 1,25–2,09 m) fjerner bare
2–17 % av hjørnene: vann 670 → 658, myr 392 → 325, skog 128 → 105, bekk
223 → 219. **Full OSM-detalj koster ≈ +1–4 KB per 3 km-ark.** Den ene knotten
som koster, er bakens toleranse: 2 m i stedet for 4 gir ~+50 % hjørner (målt på
Finnmark-innsjøene: 3 558k mot 2 334k), altså ~+28 KB på dette arket og en ny
nasjonal bake med full nedlasting for alle — for en forskjell under 4 m, 0,4 mm
i 1:10 000.

### 6. Hytter: OSM har omrissene, N50 har dem ikke

Norefjell 3 × 3 km (fylke 33): OSM har **319 bygninger, alle med omriss**
(0 punkt-bygninger; cabin 215, shed 28, apartments 26, farm_auxiliary 17),
grunnflate p10/p50/p90 32/100/218 m², 10,9 hjørner per bygning. I det bygde
arket er `bygning`-laget **12,4 KB av 393,4 KB (3,2 %)**; kontur 147,8,
kraftlinje 80,5, skog 22,9, myr 19,6, vei-liten 17,6, sti 12,9 KB.

N50 kan ikke legge til noe her: `_omrade` 2 objekter, `_posisjon` 244 punkter
(211 fritidsbygg), `_senterlinje` 13 (luftledning, skitrekk), `_grense` 3.
Kobling innen 10 m: 180 av 246 N50-bygninger (73 %) har et OSM-omriss, 66 har
ingenting i OSM; 132 OSM-omriss har ingen N50-bygning. Den eneste rikere kilden
er FKB-Bygning (Geonorge `8b4304ea-4fb0-479c-a24d-fa225e2c6e97`, Geovekst,
`GEONORGE:DOWNLOAD`, capabilities svarer 200) — lisens og åpen tilgang er IKKE
verifisert.

### Standpunkt etter målingen

1. **N50-vann er ikke fiksen for det eieren så**, og den øker ikke
   nøyaktigheten: NVE live er allerede N50-geometrien og ligger der DTM-en sier.
2. Det den gir: **robusthet** (NVE av kritisk sti — MCP, Worker og sandkasser
   der NVE gir 403 får innsjøer), en lukket **4 m-søm mot myra**, og mulige
   **elveflater** (21 313 flater, 1 239 km² — OSM har dem sporadisk). Prisen er
   35,6 MB i `public/`, ~31–35 MB historikk per bake, og klientjobben i planen
   i artifacten (middels).
3. **Anbefaling: la ligge** til robusthets-argumentet har et tall. Det som
   mangler er ikke en måling av N50, men av NVE: hvor ofte feiler query-en i
   felt? `nveInnsjoStatus` ligger i `data-meta` på hvert bygd kart og er
   stedet å telle.
4. Vil man ha «mer detalj», er den billige gevinsten å skru OSM-forenklingen
   ned (+1–4 KB per ark), og hytteomrissene finnes alt fra OSM. Konturene er
   halve arket; en flis-bake med finere toleranse er den ene detalj-knotten som
   koster brukerne noe.

### Verktøyet

`scripts/probe-n50-vann.mjs` (`npm run probe:n50vann`) og
`.github/workflows/probe-n50-vann.yml`. Inputs: `lat`/`lon`/`radius_m`/`fylke`
(probepunktet), `reg_halv_km` (registrerings-arket), `ekstra`
(`Navn@lat,lon;…` — flere steder for registreringen, tom = ingen), `hytter`
(`Navn@lat,lon#fylkesnr`), `hopp` (trinn som hoppes over: nve, osm, fliser,
geonorge, dem, reg, ekstra, sammenlign, kart, kurve, bygg, hytter, fylke, svg).
Trigger også på push når proben selv endres. Kjør den ikke samtidig med en
nasjonal bake — begge laster fra Geonorge. `MAL_TYPER` (`innsjo`, `elv`) i
`bygg-n50-areal.mjs` er BARE måling: `TYPER` i `n50ArealPakke.js` er ikke
utvidet, og ingen flis skrives med vann.

---

*Notatet fra 2026-08-09 følger uendret.*

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

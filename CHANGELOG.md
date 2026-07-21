# Endringslogg

## 2026-07-21 — v1.0.52: «Bruk rute» — følg valgt rundtur med fritt kart

Stifinner/rundtur får en «Bruk rute»-knapp i den grønne boksen. Den tar valgt
rute inn i en ny følge-modus: boksen minimeres til en liten pill, kun den
valgte ruta blir stående på kartet (samme farge som forslaget, litt kraftigere,
under GPS-prikken), og kartet slippes helt fri igjen — long-press, POI-tapp og
måling virker som normalt mens du går ruta. Pillen kan utvides til et panel med
distanse, estimert tid og høydemeter, og med GPS aktiv (startes automatisk ved
«Bruk rute») vises fremdrift langs ruta: «Gått X av Y · Z igjen», eller
«Utenfor ruta (NN m unna)» om du har forvillet deg bort. «Til forslag» går
tilbake til rutelisten; X avslutter. Rundtur-tvetydigheten der start == mål
løses med et monotont fremdrifts-anker (ny ren util `routeProgress.js`, testet)
så turen starter på 0 m og ikke «full runde». Kjente begrensninger: bytte/
utvidelse av kart avslutter ruta, og den overlever ikke en sideoppfriskning.

---

## 2026-07-21 — v1.0.51: LØST — «vannet forsvinner»: navn-LOD skjulte NVE-innsjøpolygonene

Gåten er løst, og vannet var aldri borte fra kartet. NVE-innsjøer bærer navnet
i `navn`-feltet (ArcGIS), ikke `name` — så `lakeLabels` ga dem aldri en egen
vann-navn-tekst. Søkeindeksen registrerte da SELVE POLYGONET som navnebærer,
og navn-LOD-en (declutter-budsjettet) satte `display:none` på hele innsjøen
når navnet tapte plasskampen: synlig ved 200 m-zoom (raust budsjett), borte i
oversikt (budsjett 60), flimrende ved panorering. Utvidelses-fliser viste
vannet fordi spøkelses-fliser stripper `data-name` og står utenfor indeksen —
nøkkelobservasjonen som løste saken. To fikser: (1) navn-LOD toggler ALDRI
geometri-paths, kun tekst-/gruppe-etiketter; (2) `lakeLabels` leser nå
`navn`-fallback, så NVE-innsjøer får ekte navnetekster som OSM-innsjøer.
E2E-bekreftet at Setten/Nesøytjernet lå i SVG-en med `display:none` fra
`name-lod-off`. Viewport-culling og NVE-hentingen var uskyldige hele veien.

---

## 2026-07-21 — v1.0.50: Slett-alle + hard refresh fikset, culling-bryter og eldre-ark-varsel

Tre ting i vann-jakten. (1) «Slett alle kart» + hard refresh ga «Kart ikke
funnet i lagring»: app-start gjenopptok sist viste kart via `lende-last-map`,
men slett-alle ryddet aldri nøkkelen. Nå ryddes gjenopptaks-nøklene ved
slett-alle, og lander appen likevel på et slettet kart, går den stille til
forsiden i stedet for feilsiden. (2) Utvikler-fanen har fått en
viewport-culling-bryter (av/på uten reload): forsvinner vann på telefonen,
slå culling AV — kommer vannet tilbake, er culling synderen; hvis ikke, er
det arkets data. Bygge-siden og cull-matematikken er verifisert konsistente
lokalt og i CI-E2E, så bryteren avgjør saken på telefonen. (3) Sømløs
auto-promotering til et ark bygd med en ELDRE app-versjon sier nå fra med en
toast — før så byttet ut som at innsjøer plutselig «forsvant». Midlertidige
E2E-probefiler er fjernet fra branchen.

---

## 2026-07-20 — v1.0.49: Meta-hviteliste fikset — versjonsstempel og NVE-status var usynlige

`useMapLoadPipeline` kopierer kart-metaen fra SVG-ens `data-meta` inn i appen
via en eksplisitt hviteliste — og feltene fra v1.0.45/47 (`appVersion`,
`nveInnsjoStatus`) manglet i den. Konsekvens: Utvikler-fanen viste «bygd med
eldre versjon» og «ingen status» på ALLE kart, også splitter ferske — hele
kveldens feilsøking gikk i blinde. Nå følger feltene med, og radene er endelig
til å stole på. E2E-verifisert i ekte Chromium mot deployet app: ferskbygd
Setten-kart har 29 innsjø-pather i både lagret SVG og DOM, synlige med ISOM
301-blått (skjermbilde-artefakt i CI). Nye meta-felter MÅ legges til i
hvitelisten — det står nå en advarsel i koden.

---

## 2026-07-20 — v1.0.48: Auto-flis-cachen versjons-gates (gamle fliser i «nye» kart)

Siste brikke i «innsjøer borte»-saken: selv HELT NYE kart viste gamle data.
Årsak: auto-flis-mosaikk-cachen i IndexedDB overlever app-oppdateringer —
`centerOverExistingTile` undertrykker nybygging der en spøkelses-flis alt
finnes («Allerede bygd — flytter dit»), og promotering gjør gamle fliser til
aktivt ark. Fliser bygd med ødelagt kode tidligere på kvelden ble dermed
servert på nytt i ferske kart. Nå stemples hver lagret flis med app-versjonen
(`appVersion` i lagringsposten), og auto-fliser bygd med en ANNEN versjon
usynliggjøres (gjenbrukes aldri, blokkerer aldri nybygging, kan aldri
promoteres) og ryddes fra IndexedDB i bakgrunnen. Brukerens egne lagrede kart
røres aldri — de har «Kart bygd med»-merkingen fra v1.0.47.

---

## 2026-07-20 — v1.0.47: Kart stemples med byggeversjon; NVE-rad alltid synlig

Kveldens feilsøking av «innsjøer borte» strandet gjentatte ganger på samme
spørsmål: hvilken app-versjon ble DETTE arket bygd med? Et kart bygd med gammel
kode ser identisk ut med et ferskt — og NVE-innsjø-raden fra v1.0.45 var
usynlig på gamle ark, som var umulig å skille fra «alt ok». Nå: (1) hvert kart
stemples med app-versjonen i metaen (`meta.appVersion`), og Utvikler-fanen
viser «Kart bygd med vX» — i gult med «bygg på nytt for ferske data» når den
avviker fra kjørende app; (2) NVE-innsjø-raden vises alltid når kart-meta
finnes — mangler status, står det eksplisitt at arket er bygd før v1.0.45 og
må bygges på nytt.

---

## 2026-07-20 — v1.0.46: Robust NVE-paginering, verifisert mot 33 400 innsjøer

NVE-pagineringen antok sidestørrelse («fikk færre enn forespurt → siste
side») — skjørt mot enhver server-konfigurasjon. Nå pagineres det på serverens
eget `exceededTransferLimit`-flagg med objectid-dedup (en server som ignorerer
`resultOffset` gir stopp, ikke dobling), og eventuell avkutting rapporteres i
NVE-innsjø-statusen («AVKUTTET»). CI-verifisert mot ekte NVE: gigantisk bbox
(halve Østlandet) ga 33 400 innsjøer over 17 sider på 66 s, med flagget
bekreftet til stede i geojson-svar. Merk: «innsjøer borte»-kartene fra tidligere
i kveld skyldtes IKKE paginering, men kart-fliser bygd i overgangsvinduet rett
etter v1.0.44-deployen (gammel klient lette etter FGB-filer som var fjernet fra
gh-pages) — kart bygd HELT på nytt med oppdatert app henter alt live fra NVE.

---

## 2026-07-20 — v1.0.45: NVE-innsjø-status i Utvikler-fanen + retry

Etter v1.0.44 manglet innsjøer på kart bygd rett etter deployen (Nesøytjern,
Setten). CI-verifisering viser at hele NVE-løypa er frisk (query gir Setten
med 38 øy-hull, CORS ok, full headless-bygging gir vann) — feilen skjer stille
på enheten i hente-øyeblikket. To sannsynlige årsaker: klienten kjørte fortsatt
v1.0.43 (som leter etter FGB-filene som ble fjernet fra gh-pages), eller et
forbigående nett-/NVE-glipp. Nå: (1) `fetchN50Water` prøver to ganger før den
gir opp, og (2) utfallet rapporteres i kart-metaen og vises i Utvikler-fanen
som «NVE-innsjø: OK — N innsjøer» eller «FEILET: <melding>» — samme grep som
Sjøkart-WFS-statusen, så mobil-feil ikke lenger er usynlige. Kart som mangler
innsjøer må bygges på nytt (SVG-en er lagret uten dem).

---

## 2026-07-20 — v1.0.44: Innsjøer live fra NVE — full detalj, bake-apparatet fjernet

v1.0.43s ~5 m-forenkling gjorde små øyer/skjær komisk kantete (Munkeskjæra i
Setten: hytter «utenfor» øya). Rot-årsaken til hele det statiske apparatet var
at N50 vektor-WFS ble avviklet — men CI-diagnose viste at NVE Innsjødatabasen,
spurt via ArcGIS REST `query` på bbox (ikke `identify`, som mister hull),
leverer innsjø-polygoner med øy-hullene intakte i FULL N50-detalj
(Setten-ringen: 1861 punkter, identisk med uforenklet N50) og med CORS.
`fetchN50Water` henter nå innsjøene live ved kart-bygging (som Overpass og DEM
allerede gjør). Hele FGB-bake-apparatet er fjernet: bake-script, workflows og
~408 MB statiske data ut av repoet, `flatgeobuf`-avhengigheten droppet. Ingen
forenkling, ingen terskler — og kartet virker i hele landet uten bakte filer.

---

## 2026-07-20 — v1.0.43: N50-innsjøer for hele landet (per-fylke)

N50-vann-datasettet dekket bare Akershus (én FlatGeobuf). Nå bakes hele landet:
CI-scriptet laster ned N50 for alle fylker og skriver ÉN FlatGeobuf per fylke
(`public/data/n50-water/<fylkeskode>.fgb`) pluss et manifest (`index.json`) med
hver fils bbox. Klienten leser manifestet, velger fila(ene) som overlapper
kart-bboxen, og spør hver på bbox via HTTP Range — så bare relevante utsnitt
lastes. Datasettet er KUN innsjøer (Innsjø + InnsjøRegulert): elve-/bekkeflater
tegnes fra OSM-linjer som før, og sjøen kommer autoritativt fra DEM
(`seaFromDem.js`) + Sjøkart. Innsjøene er selve tyngden (Norge er ekstremt
innsjø-tett), så omrissene forenkles til ~5 m — sub-piksel i kartskala, men
halverer datasettet til ~350 MB. Ekte øyer (Kolstadøya i Setten) beholdes som
ekte hull i hele landet, uten terskler eller heuristikk; kun holmer < ~5 m
glattes bort. Skulle et innsjø-tett fylke likevel bli > 95 MB, deles fila i
bbox-fliser (`<fylke>-<n>.fgb`) — hele innsjøflater tas med i hver flis (ingen
klipping), så øy-hull forblir intakte.

---

## 2026-07-20 — v1.0.42: Behold kartnavn ved ombygging

«Bygg om dette området i valgt størrelse» (long-press på nullstill-knotten)
døpte kartet om til «Kart». Årsaken: koden leste navnet fra `meta` (som ikke
har det), ikke fra `mapTitle` (lagringen). Nå beholdes kartets navn — stedsnavn
+ dato, f.eks. «Mjøsa 19. juli» — ved ombygging.

## 2026-07-20 — v1.0.41: N50-vann vinner over OSM/NVE der det finnes (Kolstadøya)

Kolstadøya i Setten manglet fortsatt selv om N50-datasettet har øya som et ekte
hull. Årsaken: OSM (og NVE) leverer SAMME innsjø uten de riktige hullene, og
siden hvert vann-polygon males opakt kunne en slik hull-løs kopi males OPPÅ og
dekke øya igjen (Landøya/Bolstadøya traff tilfeldigvis ikke). Nå er N50-vann
autoritativt der det har dekning: `createMapFlow` samler N50-vannets ytre ringer
og undertrykker overlappende OSM- (også navngitte) og NVE-ferskvann per flate,
så bare N50-polygonet med de korrekte øy-hullene rendres. Utenfor N50-dekning
beholdes OSM/NVE som før.

## 2026-07-20 — v1.0.40: N50-vann fra eget statisk datasett (øyer som ekte hull)

Innsjø-øyer (Kolstadøya i Setten) kommer nå fra autoritativ N50-geometri der
øya er et ekte hull i vannet — ingen terskler eller DEM-gjetting. Siden
Kartverkets N50 vektor-WFS er avviklet, bakes N50-vann i CI
(`scripts/build-n50-water.mjs` + workflow) fra Geonorges Nedlasting-API: vann-
flatene (Innsjø/InnsjøRegulert/ElvBekk/Havflate) trekkes ut med `ogr2ogr`,
reprojiseres til EPSG:4326 og skrives til `public/data/n50-water.fgb`
(FlatGeobuf). `fetchN50Water` leser fila på bbox via `flatgeobuf` (HTTP Range,
laster bare utsnittet) og konverterer gjennom den hull-bevarende
`geojsonToWays` → relation(outer+inner) → mapBuilder klipper øyene via evenodd.
Første datasett dekker Akershus (~4,5 MB); flere fylker kan bakes ved å kjøre
workflowen med annen `--area`. Den avviklede WFS-koden er fjernet.

## 2026-07-20 — v1.0.39: Fjernet DEM-basert øy-gjetting

Reverterer den DEM-avledede øy-karvingen fra v1.0.38. Den løste ikke Kolstadøya
i praksis, og den hvilte på terskelverdier («meter over vann», «minimum
øystørrelse») som er skjøre og feil verktøy for å avgjøre om en øy finnes — en
øy skal komme fra autoritativ vektor-geometri, ikke gjettes fra høydemodellen.
Fjernet `lib/lakeIslands.js` og krokene i `mapBuilder`. Øy-problemet løses i
stedet ved å gi den eksisterende pipelinen ekte N50-vann-geometri (der øyer er
indre ringer) fra et eget, statisk hostet datasett — se plan.

## 2026-07-20 — v1.0.38: Øyer i innsjøer karves ut fra høydemodellen

Innsjøer med øyer (Kolstadøya i Setten) ble malt som én solid blå flate over
øyene. Kartverkets N50 vektor-WFS — som modellerte innsjø-øyer som hull — er
avviklet, og verken NVE-innsjødatabasen eller OSM leverer øyene pålitelig. Men
øyene stiger over vannflaten, og det ser høydemodellen (DEM) vi allerede
henter. Ny `lib/lakeIslands.js` (`islandHolesForLake`) detekterer terreng som
stikker opp over innsjøens vannivå innenfor innsjø-polygonet — robust mot både
«vann leses som en flat høyde» og «vann er nodata» i NHM_DTM — og mapBuilder
karver de områdene ut som hull (fill-rule=evenodd) i innsjø-flaten (ISOM 301).
Da skinner land, relieff og høydekurver under vannet gjennom der øya ligger.
Kun ekte DEM, kun innsjøer over ~5 ha, og kun der kilden ikke allerede har
øy-hull. Løser øyene uten runtime-avhengighet til Kartverkets vektortjenester.

## 2026-07-20 — v1.0.37: Behold øy-hull fra NVE-innsjøer

NVE-innsjøer med øyer (f.eks. Kolstadøya i Setten) kunne miste øya og bli malt
som én solid vannflate. Årsaken: NVEs `identify?layers=all` returnerer samme
innsjø fra flere lag — noen generalisert uten øy-hull, andre med — og dedup-en
beholdt alltid den FØRSTE varianten. Kom den hull-løse først, ble øya forkastet.
Nå beholdes varianten med FLEST ringer (dvs. med øy-hull) når duplikater slås
sammen, uansett rekkefølge; navnet løftes fortsatt med fra et duplikat-lag.

Merk: dette forutsetter at NVE faktisk leverer øya som hull i minst ett lag.
Bakgrunn: N50-vektor-WFS-en (`wfs.n50_kartdata`) er avviklet av Kartverket, så
NVE er nå eneste autoritative vektorkilde for innlands-innsjøer med øyer.

---

## 2026-07-20 — v1.0.36: Kraftlinjer som eget kartlag

Kraftlinjer er nå et eget kartlag («Kraftlinjer», default PÅ) og tegnes som på
ut.no/Norgeskart — en tynn svart strek med jevne, tverrgående kryssmerker — så
laget skiller seg ut og fungerer som orienterings-landemerke. Tidligere lå
kraftlinjer sammen med gjerder i «Gjerde / kraft»-laget, som er skrudd av i
Tur-forhåndsvalget, så de forsvant på vanlige turkart. Overpass-spørringen
henter nå både `power=line` og `power=minor_line` (distribusjonslinjer), så alle
kraftlinjer kommer med, ikke bare de store transmisjonslinjene. «Gjerde / kraft»
heter nå bare «Gjerde».

---

## 2026-07-20 — v1.0.35: Øyer i innsjøer forsvant ikke lenger

Innsjøer med øyer (f.eks. Kolstadøya og Bolstadøya i Setten) ble malt som én
solid vannflate der øyene manglet helt, sammenlignet med ut.no. Årsaken var at
N50-vann-konverteringen (`geojsonToWays`) bare tok ytre ring og forkastet
hull-ringene i GeoJSON-polygonene — øyene er nettopp hull i vannet. Nå
emitteres polygoner med hull som en relation med `outer`- og `inner`-ringer,
slik at mapBuilder klipper øy-hullene via evenodd (samme vei som OSM-
multipolygoner). Polygoner uten hull forblir `way` så navn-baserte
sammenslåinger (Hestesund-splittede innsjøer) fungerer som før.

---

## 2026-07-19 — v1.0.34: Stedsnavn på «lag kart der jeg står»

Nye kart laget fra egen GPS-posisjon får nå navn etter nærmeste stedsnavn i
stedet for «Din posisjon». Et reverse-geokall (Nominatim) slår opp koordinaten
og velger det mest lokale leddet — grend/gård før tettsted før kommune — så
kartet blir f.eks. «Stormoen 19. juli». Oppslaget er best-effort: feiler det
(offline eller tjeneste nede) faller vi tilbake til «Min posisjon» som før.
Lagt til `reverseGeocode` og `nearestPlaceLabel` i `lib/geocode.js`.

---

## 2026-07-19 — v1.0.33: Gi kart nytt navn

Kart kan nå døpes om — både fra «Mine kart» på forsiden og inne i et åpent kart.
På forsiden har hvert kort fått en blyant-knapp ved siden av søppelbøtta; i kart-
visningen er navne-chipen i toppbaren blitt trykkbar (innebygde kart som Vardåsen
kan ikke gis nytt navn siden de ikke ligger i lagringen). Begge åpner det samme
bunn-arket (`RenameMapDialog`) med feltet forhåndsutfylt. Lagringen fikk en ny
`renameMap(id, navn)` som oppdaterer både `maps` (kilden) og det lette `meta`-
storet i samme transaksjon, så lista og det åpne kartet viser samme navn straks.

---

## 2026-07-19 — v1.0.32: «Installer som app»-knappen dukker nå faktisk opp

Knappen manglet i Chrome/Edge på Android. Årsaken var timing: `beforeinstallprompt`
fyres nøyaktig én gang og ofte før Vue er montert, mens `usePwaInstall` festet
lytteren sin i `onMounted` og holdt privat state per kall. Fyrte eventet før
mount — eller navigerte du til en side (som Om) som ble montert etter at eventet
alt var fyrt — mistet vi det og `canInstall` ble aldri sann. Nå fanges eventet av
en tidlig inline-lytter i `index.html` (før bundelen lastes) og stashes på
`window`, og `usePwaInstall` er gjort om til en delt singleton som leser stashen
ved oppstart og deler samme reaktive state på tvers av alle sider.

---

## 2026-07-19 — v1.0.31: Bedre iPad-deteksjon for installasjonsveiledning

iPad på iPadOS 13+ melder seg som «Macintosh» i user agent-strengen, så den
rene `/iPad|iPhone|iPod/`-sjekken i `usePwaInstall` bommet på iPad — brukeren
fikk verken «Installer som app»-knappen eller iOS-veiledningen. Deteksjonen
fanger nå også opp en «Macintosh»-UA med flerpunkts-touch (`maxTouchPoints > 1`),
som i praksis er en iPad, mens ekte pekeskjerm-frie Mac-er (0 touch-punkter)
holdes utenfor.

---

## 2026-07-19 — v1.0.30: Installasjonsknapp på Om-siden + første-gangs varsel

Å installere Så i lende som app er nå gjort mer intuitivt. Om-siden har fått en
«Installer som app»-knapp rett under innledningsteksten — samme diskrete drakt
og tekst som forsiden — som kun vises når appen ikke alt kjører installert
(standalone) og nettleseren faktisk tilbyr install (Chrome/Edge/Android) eller
på iOS med manuell veiledning. I tillegg viser appen ett native dialog-varsel
første gang den åpnes uinstallert, uansett hvilken URL brukeren lander på; ved
avvisning lagres et flagg i localStorage (`lende-install-prompt-dismissed`) så
meldingen aldri kommer igjen.

---

## 2026-07-18 — v1.0.29: Fjernet omtale av Vannmålestasjoner i Om-siden

Om-siden («Mer enn bare kart») reklamerte for kartlaget Vannmålestasjoner med
sanntids vannføring, vannstand og temperatur fra NVE HydAPI. Laget ligger
imidlertid i dvale i produksjon fordi HydAPI krever en API-nøkkel som ikke bør
bakes inn i den offentlige, statiske bundelen på GitHub Pages — så funksjonen
gir ingenting for vanlige brukere ennå. Avsnittet er fjernet inntil en
server-side proxy er på plass som holder nøkkelen skjult. Innsjø-fakta ved
long-press (NVE Innsjødatabase, virker uten nøkkel) er ikke berørt.

---

## 2026-07-17 — v1.0.28: Slutt på fantom-«hull» ved utvidelse og scrolling

«Fyll hullene»-banneret dukket stadig opp med hull som ikke fantes — også når
ingen utvidelse var avbrutt. Årsaken var hull-deteksjonen: den regnet ENHVER
tom celle inni mosaikkens omsluttende rektangel som et hull. Etter en avbrutt
utvidelse, eller bare ved fri panorering (der en nabo-flis auto-promoteres til
aktiv og cachen kappes), blir flis-settet ikke-rektangulært — og en diagonal
rekke fliser (f.eks. tre fliser på skrå) ga da flere «hull» for celler brukeren
aldri bygde. «Fyll hullene» prøvde så å bygge utsnitt ingen ba om. Nå regnes en
celle kun som hull hvis den er OMSLUTTET av bygde fliser på en hel akse (flis i
vest OG øst, eller nord OG sør) — genuint innelukkede hull midt i kartet fanges
fortsatt, mens diagonale/L-formede perimeter-celler ikke lenger utløser
banneret.

---

## 2026-07-17 — v1.0.27: Kartformat og høydekurver i Innstillinger + felles Nullstill

Innstillinger-fanen har nå de samme format-knappene som «Flere valg» i byggeren
(Kvadratisk / Portrett / Utskrift A4) og høydekurve-knappene (5–50 m, med samme
bredde-gating: tette kurver krever smalere kart), plassert rett under
størrelse-slideren. Valgene gjelder alle nye kart fra søk/GPS, «Lag kart der du
er» og «Bygg om»-knappen. En felles «Nullstill»-knapp setter standarden:
4 km bredde, 10 m høydekurver og kvadratisk format — app-standarden for nye
kart er samtidig endret fra 8 til 4 km (raskere bygging). Vardåsen-demokartet
bygges nå i samme standardutsnitt (4 km kvadrat, 10 m).

---

## 2026-07-17 — v1.0.26: Utheving i Om-teksten + CI på pull requests

Innledningsteksten på Om-siden fremhever nå «ymse kartdata» og «ut i lende» i
halvfet, litt lysere skrift, så nøkkelordene (og lende-ordspillet) bærer
setningen ved rask lesing. I tillegg er CI aktivert: en ny GitHub-workflow
kjører testsuiten og produksjonsbygget på hver pull request mot master, så
regresjoner fanges før merge.

---

## 2026-07-17 — v1.0.25: Fikser oppdatering, kartbygging og hull-fylling

Tre feil fra forrige runde rettet. (1) Kartbygging feilet av og til med
«buildSvg-worker-feil» — typisk en transient modul-last i web-workeren rett etter
en deploy; nå faller vi tilbake til synkron bygging i stedet for å feile hardt, så
kartet blir bygd uansett. (2) «Fyll hullene» startet, men fullførte ikke og lot
den oransje meldingen komme tilbake: reparasjonen håndterer nå hver flis for seg,
tegner mosaikken på nytt selv ved delvis feil, og teller hull på nytt etterpå.
(3) «Oppdater» kunne henge på «Oppdaterer …» uten å laste ny versjon (ingen/stale
ventende service worker); nå garanterer vi alltid en reload etter kort tid. Selve
oppdaterings-banneret er dessuten ryddet opp — i arbeid vises én ren linje med
spinner i stedet for en trang knapp med tekst på flere linjer.

---

## 2026-07-17 — v1.0.24: Fullfør ufullstendige kart og fyll mosaikk-hull

To ikke-destruktive reparasjons-verktøy for kart der en bygging ble avbrutt
(reload eller app-lukking midt i flisleggingen). Åpner du et kart som aldri ble
ferdig bygd (kun terreng, `partial`-flagget satt), tilbyr et banner nå «Fullfør
kartet» som bygger det om og fyller inn stier og detaljer. Har mosaikken et hull
— en manglende flis inni det rektangulære bruttokartet — oppdages det ved åpning
og et banner tilbyr «Fyll hullene», som bygger kun de manglende cellene uten å
røre eksisterende fliser. Begge krever nett (knappen gråes ut offline) og sletter
aldri noe. About-teksten er også oppdatert.

---

## 2026-07-17 — v1.0.23: «Oppdater» venter til kartbygging er ferdig

Trykket man «Oppdater» på ny-versjon-banneret mens en flis ble bygd eller
utvidet, reloadet appen midt i byggingen og etterlot et hull i den halvbygde
mosaikken. Nå settes en reload på vent så lenge en bygging pågår: banneret viser
«Ny versjon klar — venter på at kartet blir ferdig», og reloaden utføres
automatisk straks flisleggingen er komplett. Byggestatusen deles mellom MapView
og oppdaterings-banneret via et lite signal i swUpdate.

---

## 2026-07-17 — v1.0.22: Kompassnåla i FAB pekte 180° feil ved rotasjon

Kompass-FAB-en oppe til høyre roterte nåla med feil fortegn (`rotate(-rotation)`)
i forhold til kart-transformen (`rotate(+rotation)`). Ved nullstilt kart så det
riktig ut, men så snart kartet ble rotert speilet nåla seg og pekte motsatt vei
av de trykte «i lende»-kompassrosene — nøyaktig 180° feil ved 90°-rotasjoner.
Nåla bruker nå samme fortegn som kartet, så den peker mot skjerm-nord i takt med
rosene. Heading-modus (enhetskompass) var uendret korrekt og er ikke rørt.

---

## 2026-07-16 — v1.0.21: Kompassrose på «Utvid kart»-knappene

De åtte «Utvid kart»-knappene rundt kartet var store, dominerende blå «+»-sirkler.
De er nå små, diskrete kompassroser — én per himmelretning — der den ene armen
peker retningen knappen utvider og males rød, med teksten «Nord i lende»,
«Nordøst i lende» osv. ved siden (en flørt med app-navnet). Rosene ligger i
kart-rommet og roterer med kartet, så den røde armen alltid viser rett vei i
terrenget, mens teksten mot-roteres til vannrett av samme mekanikk som stedsnavn.
Knappenes funksjon er uendret (bygger ny kartflis i valgt retning), aria-label er
fortsatt «Utvid mot <retning>», og laget fjernes ved print/eksport som før.

---

## 2026-07-16 — v1.0.20: Øy-navn dupliseres ikke lenger (blått + brunt)

Navngitte øyer og holmer (place=island/islet) ble tidligere skrevet ut to
ganger: ett blått, kursivt sjø-navn (sjo-navn-laget) OPPÅ ett brunt, versal
land-navn (omrade-navn-laget). Øyer er land, så navnet hører hjemme i det brune
land-navn-laget — de er nå tatt ut av det blå sjø-navn-laget. Holme-noder uten
egen flate får fortsatt navnet sitt (nå som brunt land-navn på selve punktet),
så ingen øy mister etiketten. Bukt/sund/nes/grunne/skjær er uendret i sjø-navn.

---

## 2026-07-16 — v1.0.19: Nytt kartlag «Vannmålestasjoner» (NVE HydAPI)

Nytt togglebart lag som viser NVEs hydrologiske målestasjoner i kartutsnittet
som blå vanndråper. Trykk på en dråpe for siste vannføring (m³/s), vannstand og
vanntemperatur, med lenke til stasjonens side hos NVE (Sildre). Bygger på den
eksisterende HydAPI-integrasjonen (nveHydApi.js): stasjonslista hentes og caches
per sesjon, filtreres til utsnittet, og markørene tegnes runtime som fredet-
kulturminne-laget. Default av; henter data live og krever en gratis NVE HydAPI-
nøkkel (`VITE_NVE_HYDAPI_KEY`). Laget er i dvale til nøkkelen er satt — og siden
Vite inliner `VITE_`-variabler i det offentlige bundle-t, er aktivering i deploy
en bevisst avgjørelse som ikke er gjort her ennå. Blått tema med egen detalj-skuff.

---

## 2026-07-16 — v1.0.18: «Mer enn bare kart» på Om-siden

Ny infoboks på Om-siden som forklarer long-press-oppslagene: hold på et punkt
og få fakta om stedet fra Store norske leksikon, Wikipedia, Artsdatabanken,
naturtyper/verneområder og NVE — pluss trykkbare kulturminne- og fredet-markører
fra Kulturminnesøk. Vinkler det som en morsom måte å orientere seg og bli kjent
med landskapet på tur.

---

## 2026-07-16 — v1.0.17: Strammet inn Om-teksten

To presiseringer på Om-siden. Navne-forklaringen tar nå bare for seg «lende»
(terreng/landstrekning, av norrønt «lendi») og dropper utgreiingen om «så».
Innledningen sier «bygget fra ekte kartdata» i stedet for «ekte norske
kartdata» — kartdataene kommer fra flere kilder (bl.a. OpenStreetMap, som er
global), så «norske» overdrev opphavet.

---

## 2026-07-16 — v1.0.16: Om-siden virker offline

Om-siden var lazy-lastet, så JS-chunken lå ikke i offline-cachen før man hadde
åpnet `/om` mens man var på nett — resultatet var at info-knappen «ikke gjorde
noe» uten nettforbindelse. Om-siden importeres nå eagerly (bakt inn i oppstarts-
grafen som service-workeren cacher), så den alltid er tilgjengelig offline.
Versjonsnummeret vises fortsatt nederst på siden.

---

## 2026-07-16 — v1.0.15: Ryddet rute-ikonet på turkart-forsiden

Den siste gjenværende forekomsten av det gamle krusedull-rute-ikonet (buet
linje med grønn/rød endepunkt-prikk) satt fortsatt på «Bytt til ruteplanlegger»-
knappen øverst til venstre på turkart-forsiden. Byttet ut med samme rene pil-
venstre-i-sirkel som resten av modus-navigasjonen bruker, så knappen speiler
tilbake-knappen i ruteplanleggerens header.

---

## 2026-07-16 — v1.0.14: Appnavn «Så i lende», Om-side og ryddede headere

Appen har fått sitt egentlige navn i bruk: skrivebordsikonet og alle titler
heter nå «Så i lende» (uttrykket for noe som brer seg utover landskapet — der
«lende» er terrenget), og PWA-snarveien «Rute» heter nå «Ruteplanlegger».
Begge modus-headere viser «Så i lende: turkart» og «Så i lende: ruteplanlegger».
Ny Om-side (`/om`) nås fra en høyrestilt info-knapp i begge headere; i
ruteplanleggeren er lagringsknappen flyttet ett hakk inn for å gi plass. Om-siden
åpner med logoen og forklarer høydekurve-symbolikken og navnets norrøne opphav,
og har to faner — Turkart og Ruteplanlegger — som beskriver hva som er laget,
hvilken teknikk (Kartverket-DEM → d3-contour-høydekurver, canopy-høyde til
vegetasjon, OSM/N50/Sjøkart, graphology/BRouter-ruting, vektor-SVG) og hvilke
rammeverk og datakilder/lisenser som ligger bak.

---

## 2026-07-16 — v1.0.13: Flyplass-kartlag, ryddet rute-snarvei og bedre GPS-hint

Turkartet har fått et nytt togglebart lag «Flyplass» (ISOM-utvidelse 514):
flyplass-areal, apron og helikopterplass (OSM aeroway=aerodrome/apron/helipad)
males som en dempet, nøytral grå flate i terrenget — konvensjonen for asfaltert
flyplass — som stier, konturer og veier legger seg lesbart oppå. Rullebane/
taxebane utelates bevisst siden de som regel er linje-ways som ville blitt
degenererte slivere i polygon-rendereren; aerodrome-flaten dekker uansett hele
feltet. «Åpne ruteplanlegger»-snarveien i turkartets long-press-ark hadde et
rotete rute-glyf-ikon; det er byttet ut med samme «pil venstre i sirkelformet
knapp» som Ruteplanleggerens header-navigasjon, så de to modus-snarveiene deler
samme visuelle kontroll. Til slutt er GPS-feilmeldingen gjort handlingsrettet:
når posisjon ikke finnes (typisk fordi Stedstjenester/GPS er slått av på
enheten) eller tillatelsen er avvist, forklarer toasten hva som må gjøres og gir
en «Prøv igjen»-knapp som re-utløser forespørselen — nettleseren kan ikke skru
på enhetens GPS selv, men et nytt forsøk fanger opp at brukeren nettopp slo den
på.

---

## 2026-07-15 — v1.0.12: Gjenoppta ved app-start, ny ikon-drakt og UI-polering

Appen starter nå der du slapp: sist brukte modus (turkart eller ruteplanlegger)
gjenopptas ved fersk start, og i turkart-modus åpnes sist brukte kart med
gjenopprettet utsnitt (senter/zoom/rotasjon — lagres debounced per kart og
gjenopprettes via samme mekanisme som mosaikk-promoteringen). Deep-lenker og
navigasjon inne i appen berøres ikke. Forsiden fikk modus-knapp i headeren
(snarvei til Ruteplanleggeren, speiler tilbake-knappen der), og headerne heter
nå «Lende: Turkart» og «Lende: Ruteplanlegger» med diskrete kontur-ringer fra
logoen spredt fra øvre venstre hjørne. «Lag turkart»-knappen er grønn.
Logo/favicon/PNG-ikoner er tegnet om: mørkegrå bakgrunn (header-grå) med
høydekurver i Curves-temaets varme gul — PNG-ene er rasterert på nytt fra
icon.svg, og manifestets background_color matcher.

---

## 2026-07-15 — v1.0.11: Edge-mørkemodus-fiks + delings-frys på mottakersiden

To feilrettinger. (1) Edge på Android («Dark mode for nettsteder») og Chromiums
Auto Dark Theme tvangs-inverterte kart-SVG-en: svarte stedsnavn og stiplede
stier ble hvite/usynlige. Siden deklarerer nå `color-scheme: only light`
(meta i index.html + CSS på :root) — den dokumenterte opt-out-en; appens egen
mørke UI bruker eksplisitte farger og er upåvirket. (2) «Del kart og sted»-
lenker manglet avsenderens kart-aspekt, så mottakerens picker falt tilbake til
eget skjermaspekt: en mobil-mottaker av et 10 km-kart ville bygget 8,0 × 17,1
km (137 km²) — klient-side-byggingen av det frøs telefonen. Delingslenken
bærer nå `asp=` (høyde/bredde), og mottakeren bygger samme utsnitt-form
(verifisert i browser: 8,0 × 4,4 km med aspektet, mot 17,1 uten). Gamle lenker
uten `asp` beholder dagens oppførsel.

---

## 2026-07-15 — v1.0.10: Opprydning fullført — renderere, kontekst-oppslag og laste-pipeline i composables

Siste etappe av MapView-oppdelingen: de tre bevisst utsatte blokkene er nå
skilt ut. `useSymbolRenderers` samler alle de imperative SVG-rendererne
(søke-highlight, nærhetsvarsel-markør, måling, stifinner-ruter, annoteringer
med stedsmerke-animasjon, opp-rettede etiketter, GPS-spor, bruker-prikk og
pxToUserUnits). `useContextLookups` eier long-press-gesten, punkt-geometrien
og alle datakilde-oppslagene (NVE, Naturbase/GBIF, NiN, SNL/Wikipedia) med
sine watches. `useMapLoadPipeline` bærer selve orkestreringen — loadMap,
setupHostSvg, terreng-finalize, retry og reveal-animasjonen. `MapView.vue` er
nå 3714 linjer (fra 9123 ved starten — −59 %) og er redusert til skall:
refs, composable-sammenkobling, watch-tabellen og kart-verten. I tillegg til
lint/bygg/testsuite er endringene verifisert med en Playwright-røyktest i
ekte Chromium mot dev-serveren: kart-lasting, alle åtte drawer-faner, søk og
kontekstmenyen (inkl. detalj-inset) kjøres gjennom uten konsollfeil — testen
fanget og fikset to TDZ-feil underveis.

---

## 2026-07-15 — v1.0.9: Hurtigfiks — «autoMapArmed is not defined» ved kart-lasting

v1.0.8-oppdelingen etterlot fire referanser i `MapView.vue` til variabler som
var flyttet inn i composables: `autoMapArmed` (re-armering i loadMap — ga
«Kunne ikke laste kartet» på alle kart), `extendZonesBounds` (mosaikk-
minsteskala), `cachedBandsKey` (relieff-stil-bytte) og timer-oppryddingen i
onUnmounted. Composablene eksponerer nå `armAutoMap`, `extendZonesBounds`,
`invalidateReliefBands` og `teardownMapExtend`, og forelder-scriptet er
verifisert med samme ESLint `no-undef`-sjekk som composablene (den forrige
revisjonen dekket kun template-siden — det var blindsonen).

---

## 2026-07-15 — v1.0.8: Stor opprydning — MapView delt i komponenter og composables

Hoveddelen av den planlagte oppdelingen av `MapView.vue`, samlet i én stor
endring: hele fila er redusert fra 8756 til ca. 5550 linjer uten funksjonelle
endringer. Template-siden er skilt ut i egne komponenter — skalabar/attribusjon,
modus-chips og -bannere, FAB-innstillingspanelet, kulturminne-arket, alle åtte
drawer-fanene (`src/components/drawer/`) og hele long-press-kontekstmenyen
(`src/components/context-menu/`). Script-siden har fått fem nye composables som
mottar forelderens refs destrukturert med uendrede funksjonskropper:
`useDetailInset` (detalj-lupen), `useHeritageLayers` (fredet/kulturminne-WFS),
`useReliefRender` (hillshade), `useGhostTiles` (mosaikk-naboer) og
`useMapExtend` (kant-soner + auto-promotering). Kart-SVG-verten, transform-
eierskapet, watchene og laste-pipelinen ligger fortsatt i `MapView.vue`;
kontekst-oppslagene, symbol-rendererne og laste-pipelinen er kandidater for
senere oppdeling. Alle komponent-grensesnitt er verifisert med automatisk
identifikator-revisjon, og bygg + hele testsuiten er grønn.

---

## 2026-07-15 — v1.0.7: Opprydning — status/feil-overlays skilt ut

Fjerde steg i oppdelingen av `MapView.vue`: de transiente status- og feil-
overlayene (kart-skjelett/laste-pille, «kunne ikke laste», posisjons-status,
«utenfor kartet», detalj-feil og lav GPS-nøyaktighet) er samlet i
`src/components/MapStatusOverlays.vue`. Komponenten tar imot all tilstand som
props og sender ut handlinger (`retry-load`, `retry-details`, `dismiss-*`),
og reproduserer de tre uavhengige v-if/v-else-if-kjedene internt.
Lasteskjelettets scoped-CSS følger med til komponenten. Ingen funksjonell
endring.

---

## 2026-07-15 — v1.0.6: Opprydning — søke-overlay skilt ut

Tredje steg i oppdelingen av `MapView.vue`: søke-overlayet (søkefelt +
treffliste med Nominatim-fallback) er trukket ut til
`src/components/MapSearchOverlay.vue`. Komponenten er presentasjonell — den
tar imot søketilstand som props (`open`, `query`, `results`, `active-index`,
globale treff) og sender ut intensjoner (`select`, `select-global`, `close`,
`keydown`), mens all logikk (indeksering, sentrering, bygg nytt kart,
highlight) blir i forelderen. `query` og `active-index` er toveis via
`v-model`. Komponenten eier sin egen fade-transition og fokuserer feltet når
det åpnes, så `searchInputRef` er borte fra `MapView.vue`. Ingen funksjonell
endring.

---

## 2026-07-15 — v1.0.5: Opprydning — perf-logg-modal skilt ut

Andre steg i oppdelingen av `MapView.vue`: perf-logg-modalen (byggetider fra
localStorage, kun tilgjengelig fra Utvikler-fanen) er trukket ut til
`src/components/PerfLogModal.vue`. Komponenten eier hele perf-logg-konseptet —
den henter og tømmer loggen selv — og forelderen styrer bare synligheten via
`v-model:open`. Både `getPerfLog`/`clearPerfLog`-importen og de fire
hjelpefunksjonene er dermed borte fra `MapView.vue`. Ingen funksjonell endring.

---

## 2026-07-15 — v1.0.4: Opprydning — høydeprofil-modal skilt ut

Første steg i å bryte den massive `MapView.vue` (9000+ linjer) i mindre biter:
den store høydeprofil-modalen som åpnes ved tap på en turs sparkline er trukket
ut til en egen presentasjonskomponent, `src/components/TrackElevationSheet.vue`.
Komponenten tar imot valgt spor og en ferdig beregnet profil som props og
sender ut `close`; forelderen eier fortsatt DEM-en og profil-cachen. Ingen
funksjonell endring — ren strukturell opprydning som etablerer props-inn/
emit-ut-mønsteret for videre oppdeling.

---

## 2026-07-15 — v1.0.3: Nytt ikon — «Høydekurve»

Lende fikk et eget ikon tegnet i kartets eget språk: konsentriske høydekurver i
ISOM-konturbrun på kremgul land (ISOM 001), med toppen forskjøvet opp mot høyre
for en ekte terreng-følelse. Det erstatter det arvede svg-insights-ikonet (gul
topplinje på skifergrå), som var laget for tegneverktøyet, ikke et turkart. Hele
merket ligger innenfor maskable-sirkelen, så ingenting klippes på Android. Nye
`icon.svg` og `favicon.svg` (ren SVG) er kilden; PNG-ene (192/512/maskable-512
og apple-touch 180) er rasterisert fra `icon.svg`.

---

## 2026-07-15 — v1.0.2: «Installer som app» på forsiden

Forsiden (`MapHomeView`) fikk en «Installer som app»-knapp. Den kobler på den
eksisterende composablen `usePwaInstall` (samme som `MapPickerView` og
`GravelPlannerView` bruker), så ingen ny install-logikk er skrevet. Knappen
vises kun når nettleseren faktisk tilbyr PWA-install (Chrome/Edge/Android) eller
på iOS (der den viser en kort manuell veiledning via Del-menyen), og skjules når
appen allerede kjører installert. Klikk gir først en bekreftelses-dialog
(«Installer Lende som webapp?») før nettleserens egen install-prompt utløses.

---

## 2026-07-15 — v1.0.1: Automatisk root-sjekk etter deploy

Deploy-workflowen (`build-vardasen-map.yml`) fikk et nytt steg som poller
`https://gitjanerik.github.io/lende/` etter push til `gh-pages` og feiler
bygget hvis root ikke svarer 200 innen ~200 sekunder. Bakgrunn: innholdet
deployes korrekt til `gh-pages` (index.html, assets, `.nojekyll`, `404.html`),
men en manglende Pages-aktivering ga 404 på selve siden uten at noe fanget det.
Sjekken gjør slike konfigurasjonsbrudd synlige i CI med en tydelig feilmelding
som peker på Settings → Pages. CI har full nettverkstilgang, så dette
verifiseres faktisk der (det kan ikke sjekkes fra sandkassen).

---

## 2026-07-15 — v1.0.0: Lende fødes — kart og ruteplanlegging skilt ut fra svg-insights

Lende er en rendyrket turkart- og ruteplanleggingsapp, skilt ut fra
`gitjanerik/svg-insights` (v12.1.67). Kart-sporet — hele ISOM-pipelinen
(Kartverket WCS DTM/DOM, OSM Overpass, N50, Sjøkart, NVE, Naturbase, GBIF),
ruteplanleggeren med GPX-eksport, MCP-serveren og ~75 testfiler — er flyttet
over uendret i funksjon. Tegne- og font-sporene ble igjen i svg-insights, og
CurveBall-spillet er fjernet. Nytt: forenklede URL-er (`/` er kart-hjem,
`/nytt`, `/rute`), egne lagringsnavn (`lende-*` for IndexedDB og
localStorage — kart fra svg-insights følger ikke med), og `base: /lende/` på
GitHub Pages. Historikk før v1.0.0 ligger i svg-insights sin git-logg.

---

# CLAUDE.md — Prosjektkontekst for Claude Code

## Hva er Lende?

Lende er en Vue 3-mobilapp for **turkart og ruteplanlegging**. Den bygger
ISOM 2017-2-inspirerte sportskart fra ekte norske kartdata (Kartverket WCS
DTM + DOM, OSM Overpass, N50, Sjøkart-WFS, NVE, Naturbase m.fl.) og rendrer
print-kvalitets SVG. Ruteplanleggeren planlegger grus-/stiruter med
høydeprofil, cue-liste og GPX-eksport.

Prosjektet ble skilt ut fra `gitjanerik/svg-insights` (v12.1.67, juli 2026) —
tegne- og font-sporene ble igjen der, CurveBall-spillet ble fjernet. Historikk
eldre enn v1.0.0 ligger i svg-insights sin git-logg og CHANGELOG.

## Sync-modell — origin er sannheten

Lite, privat prosjekt der eieren mest jobber fra mobil/web. Hver Claude
Code-sesjon kjører i en fersk sandkasse — alt som ikke er pushet til origin
er borte. Derfor: **origin/master er alltid kilden, lokal state følger.**

### Sesjons-oppstart — ALLTID, før noe annet

```bash
git fetch origin
git branch -f master origin/master
```

Står du på en feature-branch basert på stale master: `git rebase origin/master`.

### Ny feature-branch — ALLTID fra origin/master

```bash
git fetch origin
git checkout -b claude/<navn> origin/master
```

### Sesjons-avslutning — ALLTID push

```bash
git push -u origin <branch>
```

Commits på lokal master er en bug — stopp og spør brukeren før push.

## Viktige kommandoer

```bash
npm run dev        # Utviklingsserver (port 5173)
npm run test       # Vitest (~130 filer, tester ligger ved siden av kilden)
npm run build      # Produksjonsbygg
npm run mcp        # MCP-server (stdio) — kart/rute-verktøy for Claude
npm run fasit      # Fasit: seks ekte kart mot invarianter (krever nett, ~1 min)
npm run royk       # Røyktest: monterer MapView i Chromium og trykker på domenene
npm run royk:ruter # Alle ruter, alle redirects og boot-gjenopptaket i Chromium
npm run navnediff  # Hva forsvant ut av MapView i denne endringen — og hvem overtok
npm run frie -- <fil>  # Refererer en fersk composable noe den ikke har fått inn?
npm run vedlikehold    # Sårbarheter, utdaterte pakker og versjonsdrift mellom
                       # de fire katalogene
npm run bygg:stjerner  # Baker stjernekatalogen for 3D-natthimmelen fra HYG.
                       # Kjør bare når utvalget eller stjernebildene endres.
npm run boot:workers   # Starter Cloudflare-Workerne i workerd. Rører du src/lib
                       # eller mcp/headless.js, kjør denne — se «Workerne» under.
npm run mcp:protokoll  # Kjører MCP-protokollen mot lende-mcp i workerd:
                       # initialize → tools/list → tools/call. Rører du et
                       # verktøys skjema eller MCP-SDK-en, kjør denne.
```

## Arkitektur (oversikt)

- **Kart-pipelinen orkestreres fra `src/lib/createMapFlow.js`** —
  `buildMapFromCenter()` kjører Overpass + N50 + DEM parallelt, gater
  Sjøkart-WFS på DEM-resultat, og kaller `buildSvg` (`src/lib/mapBuilder.js`).
  Endringer i hvordan kartet bygges skal komme her.
- **Symbolisering**: datadrevet ISOM-katalog (`src/lib/isomCatalog.json`) via
  `src/lib/symbolizer.js`. All SVG-CSS scopes til `.isom-map`.
- **Terreng**: `demFetcher.js` (Kartverket WCS, multi-endpoint, CORS-trygg),
  `dem.js` (konturer/stup via d3-contour + Chaikin + DP),
  `seaFromDem.js`/`marineTopology.js` (autoritativ kystlinje).
  **Det finnes INGEN høydemodell-avledet vegetasjon.** `canopyHeight.js`
  (CHM = DOM − DTM) ble slettet i v2.3.0 med begrunnelsen «Ga aldri synlig
  skog-nyanse», men sto oppført her som kjernefil helt til v5.23.0 — les
  seksjonen om arealdekke under før du bygger noe som antar den.
- **Ruteplanlegging**: `routing.js` (graphology), `brouterClient.js`,
  `gravelOverlay.js`, `routeElevation.js`, `gpxExport.js`;
  view: `GravelPlannerView.vue` (`/rute`).
- **Views**: `MapHomeView.vue` (`/` — forsiden), `MapPickerView.vue`
  (`/nytt`), `MapView.vue` (`/kart/:id`), `GravelPlannerView.vue` (`/rute`),
  `LegendView.vue` (`/tegnforklaring`).
- **Lagring**: IndexedDB — `lende-maps` (kart + grusruter, `mapStorage.js`),
  `lende-dem-tiles` (`demTileCache.js`), `lende-cache`
  (`protectedAreaCache.js`). localStorage-nøkler prefikses `lende-`.
- **MCP-server**: `mcp/server.js` (15 verktøy: bygg_kart, planlegg_rute,
  eksporter_gpx, hoydeprofil, turrapport_svg m.fl.) + `mcp/headless.js`
  (linkedom-basert headless bygging). Importerer fra `../src/lib`.
  **Feilsøker du en rute som tar en absurd omvei: bygg kartet og kall
  `finn_stinett_brudd`.** Den bygger grafen med samme opsjoner som ruteren
  (`RUTE_GRAF_OPTS`) og lister hull i stinettet med posisjon, hullstørrelse og
  omveien de koster — se `src/lib/stinettBrudd.js`.

## Viktig arkitektur-merknad — enheter i kart-SVG-en (IKKE skaler koordinatrommet)

1. **Geometri/koordinatrom = METER.** viewBox er `0 0 widthM heightM` i
   bakke-meter. GPS-projeksjonen (`utm.js`) antar 1 SVG-enhet = 1 m.
2. **Symbol-/strek-/font-størrelser = mm (print-mm)** i `isomCatalog.json`
   (`intendedScale: 10000`). `mm` er en CSS-absolutt enhet — de små tallene
   er små med hensikt (ISOM print-spec).

Ikke skaler koordinatrommet «×10» — vurdert og forkastet (bryter GPS,
detalj-inset, bakte mm→meter-konverteringer og `meta.widthM`-konsumenter).

## Viktig arkitektur-merknad — vann/sjø-stack

**Bakgrunnen ER land** (ISOM 001 kremgul). Vann males oppå i lag:
DEM-sjø (`seaFromDem.js`, primær, CORS-trygg) → Sjøkart Dybdeareal (307) →
N50/NVE-innsjø → OSM-vann. `marineTopology.js` bygger ÉN
autoritativ sjø-geometri; ISOM 307 klippes mot den.

**Sammenslåingen bor i `lib/vannMerge.js` — ÉN fil, delt av appen
(`createMapFlow`) og headless (`mcp/headless.js`, som MCP-serveren og fasiten
bygger gjennom).** Regelen er at en kilde er autoritativ for DET DEN LEVERER og
ikke noe mer: `fetchN50Water` het en gang hele N50-vannstacken (Havflate +
Innsjø + ElvBekk), men er siden juli 2026 NVE Innsjødatabasen — innsjøer alene.
Flaggene som styrer undertrykkelse avledes derfor av kildens FAKTISKE innhold
(`vannKildeFlagg`), ikke av at den svarte. Gjør du den om igjen: legger du til en
kilde med elver, skal `harBekk` bli sann av seg selv. Fram til v5.18.3 hadde
headless en egen, grovere variant som kastet alt OSM-vann straks kilden ga én
innsjø — MCP-bygde kart mistet bekker, elveflater og halve innsjø-settet uten at
noen gate så det. Land-mask (union av alt
vann) hindrer konturer/vegetasjon over vann. OSM multipolygon-relations MÅ
ring-sys via `assembleRelationRings` i `mapBuilder.js` (ellers wedge-artefakter).

## Viktig arkitektur-merknad — arealdekke: N50 bærer det den blir bedt om

Samme regel som for vann gjelder her: **en kilde er autoritativ for DET DEN
LEVERER.** Forskjellen er at for arealdekke er kilden noe man må BE om.

OSM er tynt i norsk utmark — samme diagnose `n50StiFetcher.js` åpner med for
stier, der løsningen ble å bake N50 til statiske fliser. Den baken finnes nå
også for arealdekke: `scripts/bygg-n50-areal.mjs` → `public/data/n50-areal/`.

**Baken bærer det den blir BEDT om, og det er en felle som har smelt én gang.**
`--typer` sto på sin default `myr` fra v5.24.0 til v5.26.0, og workflowen hadde
ingen knott for flagget — så skogen manglet på kartet i to leveranser uten at
noe var i veien med koden. Klassifiseringen kjente den igjen, formatet hadde
plass, klienten hadde taggen, `arealMerge` sto klar. Defaulten er nå
`myr,skog,isbre`: man må be om MINDRE, ikke om mer. Legger du til en type,
legg den til i workflowens `typer`-beskrivelse samtidig — en knott ingen vet om
er ingen knott.

**Skruene er PER TYPE** (`--toleranse myr=4,skog=8`, `--minareal`), fordi
flatene ikke ligner hverandre: en skogteig er kilometervis av kant der hver
meter koster byte og ingen er synlige i 1:10 000, mens en myr bæres av hvert
knekkpunkt. Myrens tall (4 m / 2 500 m²) skal stå urørt — en bake som endrer
dem skriver 206 fliser på nytt og sender hver bruker ut i full nedlasting for
en forskjell ingen kan se. `--mal` måler uten å skrive; kjør den FØRST.

**Turkart-temaet (v5.23.0) hevder skog i bakgrunnen, og påstanden viker for
kilden PER ARK (v5.26.0).** Grepet er det samme som «bakgrunnen ER land, vann
males oppå»: det flytter databyrden fra «skogpolygoner over hele Norge» til
unntakene. Prisen er en bevisst kartografisk påstand — vi hevder skog der vi
ikke vet bedre, og over tregrensa er den direkte gal.

Derfor: bærer arket ekte N50-skog, setter `mapBuilder` `data-areal="skog"` på
rot-SVG-en, og arkets eget stilark bytter `--bg` til temaets `--bg-apen`.
**Gaten står på ARKET og ikke i temaet med vilje.** `n50ArealFetcher` feiler
aldri hardt, så «ingen fliser» (offline, 404, kart bygget før baken) ser ut som
«ingen skog her» — et tema-nivå-bytte ville da gitt nøyaktig det tomme arket
Turkart finnes for å unngå. `--bg-apen` settes for ALLE temaer, lik den vanlige
bakgrunnen der det ikke er noe skille: fallbacken i regelen er katalogens
kremgule, og et mørkt tema uten variabelen ville fått lyst ark. Verdien MÅ være
en ren farge — `--bg: var(--bg-apen, var(--bg, …))` er en syklus, og CSS gjør da
hele deklarasjonen ugyldig.

**Isbre er kode 410 og er IKKE ISOM.** ISOM 2017-2 har ingen bre; norske turkart
har det, og konvensjonen er hvit flate med svak blågrå kant. Kanten er ikke pynt
— hvitt mot lys åpen mark har nesten ingen flate-kontrast. Bre-NAVN er punkter
(`isbrenavn.json` fra N50 stedsnavn + navngitte OSM-breer, som `arealMerge`
bevisst lar overleve undertrykkingen), ikke tagger på flatene: N50 Arealdekke
har ingen navn, og Jostedalsbreen ville uansett fått ETT navn der kartet trenger
armenes.

**`TYPER` i `n50ArealPakke.js` kan UTVIDES bakerst, aldri omordnes** —
rekkefølgen ER kodingen. Og en ukjent type skal DROPPES, ikke falle tilbake på
myr: fallbacken var ufarlig så lenge formatet var lukket, men betyr nå at en
klient som ikke kjenner `isbre` maler Jostedalsbreen som myr.

`ÅpentOmråde` bæres bevisst ikke: når bakgrunnen ER åpen-tonen, er åpenhet
standardtilstanden, og 112 020 flater som maler bakgrunnen på nytt er ren
datamengde.

**VED NESTE BAKE SKAL HISTORIKKEN RYDDES. Dette er en beslutning, ikke et
forslag.** Flisene er GENERERTE — de kan bakes på nytt fra Geonorge når som
helst — og gamle utgaver har derfor null verdi. Etter v5.26.1 er tallene:
`.git` 200 MB pack, 129 MB bakte fliser i arbeidstreet (117 areal + 12 sti),
og **gh-pages har 323 commits** som hver bærer et helt `dist/`. Hver bake som
endrer flisene legger et nytt sett på ~117 MB i historikken for alltid.

To ryddejobber, med ulik risiko:

1. **gh-pages — gjør dette først, det er gratis.** Grenen er ren generert
   output; ingen har noe der å miste. `build-vardasen-map.yml` bygger den med
   vanlige commits i et worktree, så historikken vokser monotont. Bytt til én
   enkelt commit (orphan-branch + force-push) og 323 utgaver av nettstedet
   forsvinner.
2. **master — større inngrep, men det er der flisene ligger.** `git filter-repo`
   kan droppe gamle flis-blobs fra historikken, etterfulgt av force-push. Det
   omskriver delt historikk. Repoet har én eier, så prisen er lav — men gjør
   det som en egen, bevisst operasjon, ikke som et biprodukt av en bake.

GitHubs grenser, for kontekst: **100 MB per fil** er hard sperre (største flis
er 2,4 MB, god margin), **5 GB repo** er der GitHub tar kontakt, og
**1 GB for det publiserte Pages-nettstedet** er hard grense — `dist/` er 133 MB
i dag. Ingen av dem er nære, men gh-pages-veksten er den som løper først.

## Viktig arkitektur-merknad — arket utvides BARE på bestilling

**Automatisk påfyll av nabofliser er VURDERT, BYGD, PRØVD I FELT OG FJERNET
(v5.19.0 → v6.5.22). Ikke ta det opp igjen uten nye argumenter.** Det er andre
gang funksjonen dør: første utgave (tileCache-æraen) slettet forrige flis og
gjorde det umulig å scrolle tilbake, og v5.19.0 rettet nettopp den feilen —
`useAutoNabo` navigerte aldri og slettet aldri noe, triggeren leste INTENSJON
(retning + dvele) og ikke geometri, og økt-taket lå på 12 fliser. Den var
teknisk sett i orden. Den døde av noe annet:

**Den lovet det de store kartappene gjør, og gjorde det dårligere.** Et
kontinuerlig kart betyr sømløse fliser i alle retninger i det du drar; her betyr
det ett 2 × 2 km-ark til, bygget på 5–30 sekunder fra Overpass og Kartverket, i
den ene retningen automatikken gjettet på. Avstanden mellom løftet og leveransen
er hele problemet, og den kan ikke lukkes med tuning: den er nettets og kildenes,
ikke kodens.

Derfor er **de åtte lende-pilene på arkkanten den ENESTE veien til en ny flis.**
De sier hvor, de sier hva det koster (`+N fliser` i pilla), og de bygger
ingenting uten et trykk. «Gjør arket firkantet» og «Fyll hullene» er fortsatt
BANNERE med kostnaden skrevet på, aldri automatikk — se `findRectangleGaps`.

**Det ene som overlevde er flis-ikonet** (`lib/flisIkon.js` +
`components/FlisIkon.vue`): arket i miniatyr, med rutene som bygges blinkende.
Det ble laget for automatikken og hørte hele tida hjemme i den manuelle
utvidelsen — der er retningen ikke gjettet, den er trykket. Ikonet fôres av
`byggerFlisRetning` fra `useMapExtend`, som er null for alt annet enn en
kant-utvidelse; da beholder bygge-chipen spinneren, fordi et ark-ikon uten
retning ville lovet en naboflis der det bygges et helt nytt kart.

## Viktig arkitektur-merknad — Fritt lende er FERSKVARE, og det er forutsetningen

`/fritt` (v6.5.0) er den avkledde turkartmodusen: ett fast 2 × 2 km ISOM-ark der
du står, hovedmenyknappen, linjalen og én knapp. Alt av beslutninger bor i
`lib/frittLende.js` — komponenten er kabling, fordi prosjektet ikke kan
enhetsteste en Vue-komponent (se «Arkitektur-gjeld» under).

**Arket er ferskvare, og de andre valgene henger i det.** Det har ikke navn, det
neste erstatter det, og det kan ikke tas med videre til «Mine kart».
**«Behold dette kartet» er VURDERT OG FORKASTET** — ikke ta det opp igjen uten
nye argumenter. Angre-toasten avløser en bekreftelsesdialog FORDI ingen ark er
verdt noe spesielt; kan ett av dem være det du ville beholde, blir en utilsiktet
rebygging dyr igjen og dialogen må tilbake — i hovedsløyfa, der den blir
blindtrykket. Den som vil ha et kart som varer, har allerede `/nytt`.

**Tre invarianter gjør bygging trygt uten dialog. Alle tre er lette å
«forenkle» bort:**
1. *Første tap etter en fersk last starter bare GPS.* Ved kald start er GPS
   alltid av, så det er alltid nøyaktig ETT trykk mellom å åpne modusen og å
   erstatte arket. Dette er svaret på at posisjonen din er et helt annet sted i
   dag enn da arket ble bygget.
2. *Ingenting bygger før du er 250 m fra arkets senter* (`NYTT_KART_M`). Se
   avstandsporten under — den avløste «tap kan aldri bygge mens du står på
   arket» i v6.5.27.
3. *Det gamle arket slettes aldri før det nye er ferdig bygget og tegnet.* Det er
   dette som gjør et feiltrykk ufarlig, ikke gestespråket. `saveMap` er en put,
   så overskrivingen ER slettingen — ingen `deleteMap`, som ville etterlatt
   brukeren uten kart hvis byggingen feilet.

**AVSTANDSPORTEN ER MODUSENS ENE TALL, OG DEN AVLØSTE ARKKANTEN (v6.5.27).**
Linjalen bærer «N m fra senter» så snart en posisjon er kjent, og ved
`NYTT_KART_M` = 250 m skifter tallet til aksentfarge. Det er SAMME grense
knappen står bak: over den bygger et trykk et nytt ark, under den sentrerer det
og svarer med `forNaerTekst`. Den gamle regelen — «tap kan aldri bygge mens du
står på arket», med et lang-trykk som eneste vei ut — var bygget rundt samme
frykt, men målte det gale: «utenfor arket» er en grense man krysser én gang,
mens spørsmålet man stiller på tur er «har jeg nok kart foran meg?». Tre ting
følger, og alle tre er lette å «rydde» bort:
1. **Porten gjelder ikke uten ark.** Det er den ene stien der modusen ikke har
   noe å miste; ellers ville en tom skjerm vært en blindvei.
2. **Er avstanden ukjent (GPS på, ingen fix ennå), sentreres det.** Å bygge der
   ville brutt porten; å si «for nær» ville vært en påstand vi ikke har.
3. **LANG-TRYKKET ER BORTE, og det er en konsekvens.** Med porten på plass gjør
   et hold nøyaktig det tapet gjør, eller nøyaktig ingenting — og en fyllring
   som lover noe nytt og leverer det samme er verre enn ingen ring. Legger du
   den tilbake, må den ha en betydning porten ikke alt dekker.

**Ekvidistansen står IKKE lenger på linjalen** (v6.5.27) — den er fast 10 m i
denne modusen og leses én gang, og plassen er avstandstellerens. Merk at
`MapScaleAttribution` derfor ikke har noen ekvidistanse-prop igjen; MapView har
tallet i punkt-skuffen.

**EN NEKTET POSISJON MÅ SIES, og det med en alert (v6.5.27).** Modusen var helt
stille når tillatelsen ble avvist: chipen sto og lette etter en fix som aldri
kunne komme. Teksten er den samme som «Lag kart der jeg er» viser, fra ÉN kilde
(`lib/gpsFeil.js`, delt med `MapLibrary` og `MapPickerContent` som hadde hver
sin kopi av kodetabellen). Alerten fyres på ENDRET feilkode og ikke per
feil-callback — `watchPosition` kaller handleren for hvert forsøk, og en dialog
per forsøk er en dialog man ikke slipper unna. Kode 1 (tillatelse) stopper
watchen, så knappen faller tilbake til «Start posisjon»; kode 2/3 er forbigående
og lar den prøve videre.

**To faste id-er (`fritt`, `fritt-forrige`), filtrert i `listMaps()` og ikke hos
kallerne** — «Mine kart» leses to steder som allerede filtrerer `isAuto` hver for
seg, og en tredje kaller ville glemt det. De gjenbruker bevisst IKKE `isAuto`:
det leses av `promoteView` og `useGhostTiles`' gitter-kompatibilitet, og ville
gjort arket til kandidat for mosaikk-promotering.

**`lende-last-mode` får aldri verdien `fritt`.** Modusen velges alltid bevisst fra
hovedmenyen, og inngangen bruker `router.replace` og ikke `push` — ellers lander
tilbake-knappen i det vanlige kartet, altså en modus-veksling uten om menyen.

**Relieff er av ved KONSTRUKSJON** (`useReliefRender` kalles aldri), ikke ved å
skrus av. Rotasjonen er låst til nord fordi kompasset er borte, og et rotert kart
uten kompass og uten noen kontroll som nullstiller er en navigasjonsfelle.

**Modusen krever nett for å LAGE et ark, men ikke for å vise det den har.** Det er
det ene stedet i Lende der premisset snus, og det må stå i UI-et. Etter at arket
er bygget varsles det IKKE om tapt dekning: arket er ferdig rendret SVG, og et
falskt alarmerende banner på et fjell er verre enn ingen.

## Viktig arkitektur-merknad — deling av kart har TO veier, og det er med vilje

1. **Lenke (`useKartDeling.js`)** — deler OPPSKRIFTEN: bbox, ekvidistanse,
   aspekt. Mottakeren bygger sin egen kopi. Lett, men krever nett hos begge.
2. **Fil (`useKartPakke.js` → `lib/kartPakke.js`)** — deler HELE kartet som en
   gzip-et `.lendekart`: ferdig SVG, DEM, kulturminner og NVE-stasjoner. Tung,
   men virker uten dekning. Fila går til telefonens delings-ark.

Ikke slå dem sammen. De løser hver sin situasjon, og begge skal stå.

**Datalagene virker offline fordi de allerede sjekker `protectedAreaCache` før
nettet.** Eksporten (`lib/offlinePakke.js`) fyller cachen mens den har dekning,
tar radene med i fila, og importen skriver dem inn igjen med FERSK TTL — en fil
kan ha ligget en måned i en chat. Lag-koden vet ingenting. **Legger du til et nytt
runtime-hentet lag, er det ÉN ting som må gjøres:** hent det i `samleOfflineData`
med nøyaktig samme cache-nøkkel som laget slår opp på.

**Unntaket, og det er med vilje: VÆRVARSEL PAKKES IKKE (v5.21.0).** Det er det
eneste laget der utdatert betyr FEIL og ikke bare mindre presist. Importen
(`skrivOfflineData`) setter FERSK TTL på hver rad — det er hele poenget for
kulturminner og verneområder — men en prognose fra en fil som har ligget en måned
i en chat ville da blitt vist som om den gjaldt nå. `vaer1:`-nøkkelen har derfor
ingen linje i `samleOfflineData`, og `ttlForKey` gir den 30 minutter. Ikke «rett»
dette som en glemt kilde. Bboksen må komme fra
`wgs84BboxFromMeta` (`utm.js`) — den lå i tre kopier fram til v5.20.0, og en
nøkkel som bommer med én desimal gir en fil full av data ingen leter etter.
Det oppdages først når turkameraten står på fjellet.

**Direkte overføring telefon-til-telefon (Bluetooth/WebRTC) er VURDERT OG
FORKASTET (v5.20.1).** Ikke ta det opp igjen uten nye argumenter:

- *Web Bluetooth* er blindvei. Safari/iOS støtter det ikke i det hele tatt, og
  Apple har sagt de ikke vil. På Android er API-et dessuten bare «central»: en
  nettside kan koble seg TIL en dings, men kan ikke selv annonsere seg som en.
  To telefoner ser derfor aldri hverandre. BLE-hastigheten ville uansett gjort
  et 5 MB-kart til flere minutters overføring.
- *WebRTC over felles hotspot med QR-håndhilsning* ville teknisk virket på begge
  plattformer, men krever kamera, QR, en SDP-utveksling som må gå opp, og Apples
  lokalnett-tillatelse. Eieren vurderte test-kostnaden i felt som for høy mot
  gevinsten.
- **Vi har allerede Bluetooth — via operativsystemet.** `navigator.share({files})`
  åpner delings-arket, der AirDrop, Quick Share, Nearby Share og Bluetooth bor.
  Ingen av dem trenger nett. Det er hele poenget med at eksporten leverer en FIL
  og ikke en strøm: OS-et er bedre på nærradio enn vi noen gang blir.

## Arkitektur-gjeld og duplikater — LES DETTE FØR DU BYGGER NYTT

Denne seksjonen finnes fordi Claude starter hver økt blind og bare leser det
oppgaven tvinger fram. To nesten identiske 3D-scener levde side om side i
måneder (`tourScene` + `exploreScene`, slått sammen i v5.7.0) uten at det ble
oppdaget, rett og slett fordi ingen oppgave hadde begge filene i konteksten
samtidig. Står gjelden her, er den i synsfeltet fra første melding.

**Regelen: skal du bygge en ny variant av noe som finnes, les originalen
FØRST og spør om varianten egentlig er en OPSJON på originalen.**

Kjent gjeld, oppdatert etter hver leveranse som rører den:

- **`MapView.vue` er ~3 153 linjer** og er fortsatt appens største risiko: alt
  møtes der, og Claude ser bare utsnitt av den om gangen. Fem domener ble
  trukket ut i v5.8.0 — `use3dEntry.js` (3D-inngangen), `useKartDeling.js`
  (utgående deling), `useDeltTur.js` (innkommende tur-lenke),
  `useLagStyring.js` (lag/presets/dybde), `useGpsSpor.js` (GPS, opptak,
  høydeprofil), og to i v5.9.0 — `useNavnLod.js` (navne-declutter) og
  `useViewportCull.js` (skjul vektorer utenfor utsnittet), og `useKartKnotter.js`
  i v5.10.0 (strek/relieff/tekst-skala/font + FAB-panelene), og i v5.11.0
  `useNaerhetsvarsel.js` + `useMaaling.js`, og i v5.12.0 `useKartEksport.js`,
  `useTemaBytte.js` + `useGpsTips.js`, og `useKartSok.js` i v5.13.0 (fritekst-søk,
  highlight, panToSettled), og i v5.15.0 `useGestPerf.js` (gest-perf-modus +
  jank-måler) og `usePanGrenser.js` (pan-clamp + zoom-ut-gulv).
  **Opprydningen er ferdig, og fila har et kart øverst — les det først.**
  Sytten domener er ute; det som står igjen er montering, livssyklus,
  komposisjonen av 50 composable-kall, modus-glue-en og malen.

  **Og én ting eieren la til (v5.16.0), som er en bedre begrunnelse enn
  «for mange avhengigheter»:** kode som møtes på tvers av domener HJELPER
  orienteringen når den ligger samlet i det sentrale viewet. Claude leser aldri
  hele kodebasen, men leser alltid noe av MapView — så et kryss som er synlig
  der er lettere å forstå enn ett som er skjult i en composable ingen oppgave
  tvinger fram. Målet er ikke færrest mulig linjer i MapView; det er at det som
  står der skal være det som fortjener å stå der.

  **To ting ble MÅLT og forkastet (v5.15.0) — ikke ta dem opp igjen uten nye
  argumenter:**
  1. *Stifinner-glue-en* (L1490–1700, 212 linjer): 23 avhengigheter. En
     composable med 23 deps er MapView med et lengre kallsted. Det er ikke en
     søm, det er et kryss der fire domener møtes (måling, annotering, sti,
     kontekstmeny). Skal den ut, må modus-maskinen formes om FØRST — en ekte
     refaktorering med atferdsrisiko på appens kjernefunksjon.
  2. *Drawer-ens 111 props* (fordelt på 8 `Drawer*Tab`-komponenter): ville
     spart ~60 mal-linjer (2 % av fila) mot å endre prop-kontrakten i åtte
     barn-komponenter. Feilmodusen er en feilstavet prop-sti → STILLE død
     funksjon, siden Vue ikke kaster på udefinerte props. Verktøyene her er
     svakest på nettopp det. Dårlig bytte. **Merk fra v5.10.0:** linjetallene her er anslag fra
  utsiden. FAB-blokka var anslått til 518 linjer og «ett domene», men inneholdt
  fire — knottene, standarder for nye kart, maks-fliser og navnespråk. Les
  blokka før du stoler på tallet, og følg sømmen framfor tallet.
  Rører du et domene som allerede er ute: gjør endringen i composable-en, ikke
  i MapView.
- **STEDSNAVN COUNTER-ROTERES LIVE UNDER GESTEN, og det er en MÅLT avveining
  (v6.5.25).** Fram til v6.5.24 hoppet `applyUprightLabels` over hele
  rotasjons-gesten. Grunnen var ekte: kart-diven er et composited lag under
  gesten (`will-change: transform`), så rotasjonen er gratis — men skriver vi en
  transform på tekstene, blir laget skittent og HELE SVG-en rasteriseres på nytt
  hver frame. Det er ikke fjernet, det er betalt for: én rAF-koalescert skriving
  per frame, ett snapshot per gest (querySelectorAll/closest/baseVal ut av
  frame-løkka, cullet og LOD-skjult ut av settet), og et frame-budsjett i
  `lib/mykRotasjon.js` som slår live-modus AV for kartets levetid når passene
  sprekker og skriver hvorfor i perf-loggen. **Budsjettet er ikke pynt** — det er
  det som gjør at en tung mosaikk på en gammel telefon får den gamle oppførselen
  i stedet for hakking, og «forenkler» man det bort, er det bare de raske
  telefonene som merker det. `forHverUpright` er ÉN iterasjon delt av den
  autoritative passeringen og snapshotet, nettopp for at de to aldri skal få
  hvert sitt syn på hva som skal stå opp. Røyk-sjekken måler MIDT I gesten med
  syntetiske to-finger-eventer; en måling etter gest-slutt er grønn også uten
  fiksen.
- **RØYKTESTENS VARDÅSEN-KART CACHES, og nøkkelen er poenget (v6.5.24).**
  Byggingen henter Overpass + Kartverket og er både det dyreste steget og det
  eneste som kan feile fordi en tredjepart har en dårlig dag. Kartet er en ren
  funksjon av `src/lib` + `scripts/build-vardasen-svg.js` + avhengighetstreet i
  `package-lock.json`, og nøkkelen (`scripts/kartcache-nokkel.mjs`, med tester)
  er hashet over nøyaktig de filene. **Lockfila må inn UTEN appens egen
  versjon:** prosjektet bumper den i hver PR, så en rå hash av fila gir en
  nøkkel som endrer seg hver gang og en cache som ALDRI treffer. Det ble målt i
  CI-kjøringen som innførte cachen — samme filtall, ny hash, ingen kartkilde
  rørt. **`src/lib/tour3d/**` er UTE av nøkkelen med vilje:**
  3D-motoren LESER kartet, den lager det ikke — og det er 3D-PR-ene som trenger
  et ekte kart, så en nøkkel som tok med tour3d ville bommet på hver kjøring som
  har nytte av cachen. **Ingen `restore-keys`:** et delvis treff ville gitt et
  kart bygget av kode som ikke lenger finnes, altså grønne sjekker på et ark de
  ikke beskriver — samme felle som `--hoppbygg` finnes for å unngå. Rører du
  kart-pipelinen, bygges kartet på nytt av seg selv; trenger du en fersk bake
  uten å røre en kildefil, bump `NOKKEL_VERSJON`.

  **OG DEN MÅ FYLLES FRA MASTER, ellers er hele cachen pynt (v6.5.26).** Et
  kjørende workflow henter bare caches fra SIN EGEN gren eller fra
  standardgrena. Kjørte røyktesten bare på `pull_request` — som den gjorde i to
  dager — skrev hver PR kartet til en gren som ble slettet i det den ble merget,
  og neste PR bygde fra Overpass på nytt. Det ble målt på PR #373: full bygging,
  og så «Cache saved with key: royk-vardasen-v1-123-…» til ingen nytte. Derfor
  kjører jobben også på push til master, UTEN paths-filter — GitHub Actions
  støtter ikke YAML-ankere, og en kopiert sti-liste drifter fra originalen
  første gang noen legger til en sti bare ett sted. På master står dessuten
  `cancel-in-progress` av: der er jobben å FYLLE cachen, og en avbrutt kjøring
  skriver ingen.
- **Rutingen har sin egen røyktest (v5.22.7).** `npm run royk:ruter` går gjennom
  hver rute, hver redirect og boot-gjenopptaket i `router.js`. `npm run royk`
  monterer ÉN rute (`/kart/:id`) og sier ingenting om at `/about` lander på `/om`
  eller at `redirect: to => ({ name, query: to.query })` fortsatt beholder
  query-en. Begge går i `royktest.yml`. Merk at testen MÅ nullstille
  localStorage før hver navigasjon: et besøk på `/rute` får GravelPlannerView til
  å skrive `lende-last-mode`, og da sender boot-hooken en senere fersk last av
  «/» videre — første utgave rapporterte det som at `/kart → /` var brutt i
  vue-router 5, og det var testen som forurenset seg selv.
- **Uttrekk fra MapView har to obligatoriske gater (v5.8.1).** Tre
  monteringsfeil under v5.8.0-uttrekket gikk gjennom BÅDE `npm run test`
  (1 978 tester) og `npm run build` uten en lyd — Vue-oppsettet kaster først
  ved montering, og et bygg monterer ingenting. Derfor:
  `npm run royk` (Chromium mot `/kart/vardasen`, trykker på hvert uttrukket
  domene, feiler på enhver JS-feil) fanger feil som KASTER;
  `npm run navnediff` (top-level-navn og composable-kall mot `origin/master`)
  fanger feil som forsvinner STILLE — en slettet watch, et kall ingen overtok.
  Villede slettinger kvitteres ut med `npm run navnediff -- --ok navn1,navn2`
  i PR-en som gjør dem, aldri ved å skru av jobben. **Legg til én røyk-sjekk
  per nytt uttrekk** (`SJEKKER`-lista i `scripts/royk-mapview.mjs`) — en sjekk
  skal TRYKKE på noe, ikke bare lete etter markup, og den skal FORLATE APPEN I
  NØYTRAL TILSTAND (måle-modus bytter ut fane-raden, og neste sjekk fant ikke
  3D-knappen). CI:
  `.github/workflows/royktest.yml`.
  **FAB-ene tåler ikke programmatiske klikk:** FabCluster (ankeret og knottene)
  er drevet av `pointerdown`/`pointerup` via useLongPress, så `el.click()` fra
  `page.evaluate` gjør ingenting. Bruk Playwright-locator (ekte peker-sekvens),
  eller `page.mouse.down()` + ventetid + `up()` for lang-trykk.
- **Hoisting-fella (v5.12.0):** `function foo()` er HOISTET, så noen kunne godt
  sende den inn i en composable lenger OPPE i fila. Flytter du den samme
  funksjonen ut, blir den en `const` fra en destrukturering — og den er ikke
  hoistet. `useMapLoadPipeline` fikk `applyTheme` som verdi og krasjet med
  «Cannot access before initialization» til kallet ble flyttet over pipelinen.
  Sjekk hvem som mottar funksjonen FØR du flytter den ut.
- **Sjekk frie variabler i den nye fila:** `npm run frie -- <fil>`. navnediff ser
  bare navn som forsvant fra MapView, ikke den motsatte retningen — at
  composable-en refererer noe som ble stående. Det skjedde to ganger under
  v5.12.0 (`withColophon`, og `wrapperRef`/`visibleLayers`).
- **TDZ-regelen:** sender du en verdi inn i en composable som deklareres lenger
  ned i fila, send en getter (`() => x`) — ikke verdien. To av de tre feilene
  over var dette. Må kallet stå etter en annen composable, skriv HVORFOR på
  kallstedet (se `useDeltTur`-kallet, som må stå etter `useGhostTiles`).
- **`mapBuilder.js` er ~3 300 linjer** og gjør henting, klassifisering,
  geometri-sying og SVG-emittering i én fil. Ikke del den opp uten grunn, men
  legg nye kilder som egne `*Fetcher.js` + et lite klassifiseringssteg.
- **Ingen dubletter kjent i 3D** etter v5.7.0: én scene (`scene3d.js`), én
  viser (`Viewer3D.vue`), to rigger (`cameraRigs.js` = følge, `freeRig.js` =
  fri). Kommer det en tredje inngang til 3D, skal den være en OPSJON på
  `create3dScene`, ikke en ny scene.
- **Skyene i 3D vises BARE med værvarselet på, og bare om dagen (v5.27.0).**
  Regelen bor i ÉN funksjon, `oppdaterSkySynlighet` i `sceneCore`, fordi den
  avhenger av to uavhengige brytere (`setVaer` og `setNightMode`) — to steder som
  setter `visible` etter hver sin halvdel av sannheten kommer i utakt straks den
  ene kalles alene. Skyskyggen følger samme regel: flekker på bakken uten skyer
  over leses som en feil i karteksturen. Nedbør, torden, sikt og vinddrift henger
  på VÆRET og ikke på skyene, så natt + vær gir fortsatt regn.
- **Himmelen FØLGER KAMERAET (v5.27.0).** Kuppelen (radius 25 km), stjernene og
  månen sto i origo, mens den frie riggen slipper kameraet
  `3 × max(widthM, heightM)` unna — på et 3×3-ark av 5 km er det 45 km, altså
  utenfor sin egen himmel. `updateAmbient` flytter derfor kuppelen og
  natthimmel-gruppa til kameraets posisjon hver frame. Bare POSISJONEN; roterer
  du dem, flytter stjernene seg med kameraet.
- **Natthimmelen er ASTRONOMISK, og koordinatene er BAKT (v5.27.0).**
  `lib/tour3d/astronomi.js` er ren (Meeus' korte serier) og gir sol/måne-posisjon,
  månefase og lyssidens retning — dreid fra ZENIT og ikke fra himmelpolen, for
  det er zenit som er «opp» på en skjerm (`parallaktiskVinkel`). Stjernene bakes
  av `scripts/bygg-stjerner.mjs` (`npm run bygg:stjerner`) fra HYG-databasen til
  `lib/tour3d/stjerner.js`: 173 stjerner + linjer for 15 stjernebilder.
  **Ikke skriv koordinater for hånd** — de er det eneste her som kan være FEIL
  uten at noe ser rart ut, og en stjerne 2° på skeive er en stjerne på feil
  plass. Testene er ankret i Meeus' egne gjennomregnede eksempler og i at
  Polstjerna står i nord i høyde lik breddegraden. **`solRetning` i `puffSkyer`
  er fortsatt LÅST til hillshade-azimuten** (se v5.22.1 under) — astronomien
  gjelder natthimmelen, ikke lyssettingen.
- **PRESESJON: stjerner og planeter JA, sol og måne NEI (v5.28.0).**
  `astronomi.presesserTilDato` flytter J2000-koordinater til middeljevndøgn for
  datoen. Katalogen (`stjerner.js`) og planetene (`planeter.js`) er J2000 og MÅ
  gjennom den før de møter en stjernetid; `solEkvatorial` og `maneEkvatorial` er
  allerede i jevndøgn for datoen — Meeus' serier bærer presesjonen selv — og skal
  IKKE. To himmelobjekter i ulike rammer er en feil ingen test fanger uten at man
  vet å se etter den. Fram til v5.28.0 manglet stjernene presesjonen helt: 16
  bueminutter i snitt, 22′ på det verste. Formen er den RIGORØSE (Meeus 21.3);
  tilnærmingen `Δα = m + n·sinα·tanδ` sprenger nær polene, og Polstjerna er den
  ene stjerna alle sjekker.
- **Planetene regnes lokalt, og det er et krav (v5.28.0).** `lib/tour3d/planeter.js`
  er JPL-ens «Approximate Positions of the Major Planets» + Kepler. Det FINNES
  API-er (JPL Horizons, astronomyapi.com) — de er utelukket fordi hele
  bruksområdet er en natt på fjellet uten dekning. Nøyaktighet, målt mot
  `astronomy-engine` (uavhengig VSOP87): under 1′ på de indre, 5′ på Saturn, som
  er prisen for at lineære elementer ikke modellerer Jupiters perturbasjoner.
  Magnitudene bruker Almanakkens POLYNOMER og ikke ett lineært fase-ledd — med
  lineært kom Venus ut på −5,9, og Venus kan ikke bli lysere enn −4,9.
- **Fasit fra uavhengige implementasjoner er BAKT INN i testene, ikke hentet
  (v5.28.0).** `planeter.test.js` bærer 25 referansepunkter fra
  `astronomy-engine`, og astronomi-testene er ankret i Meeus' egne
  gjennomregnede eksempler. Grunnen er den samme begge steder: en egenskrevet
  himmelmekanikk kan være helt internt konsistent og likevel peke feil vei, og en
  test som krever nett blir skrudd av. Trenger du et nytt anker, generer det ÉN
  gang og lim tallene inn med kildeangivelse.
- **`stjerner.js` er generert; prosaen bor i `stjernebildeInfo.js` (v5.28.0).**
  Baken skriver `STJERNER` (med `bayer` som felt — 41 av 173 mangler egennavn),
  `LINJER` og `FORMASJONER` (id, latin, stjerne- og linje-indekser, senter).
  Id-en er en slug av det NORSKE navnet, og infoteksten er nøklet på den: døper
  du om et stjernebilde i baken, mister teksten formasjonen sin, og testen
  feiler med vilje. Senterretningen regnes av retningsvektorer og ikke av tall —
  et snitt av rektascensjoner over 0h peker midt på motsatt side av himmelen.
- **NATTMODUS ÅPNER MOT NORD, og resetten er UMIDDELBAR (v6.4.0).**
  `scene3d.apneStjernehimmel` stiller kameraet tilbake til oversiktsposen (samme
  pose som «Oversikt»-knappen) og løfter så blikket. Grunnen er bestilt: man går
  nesten alltid inn i natta fra dagmodus etter å ha panorert rundt, og da lå
  blikket der turen tilfeldigvis endte — man visste ikke hvilken vei man så, og
  da bærer ingen stjernebildetekst. **De to bevegelsene kan ikke begge animeres:**
  `seMot` setter `transition = null`, så en flytur til oversikten ville blitt
  avbrutt midt i, og løftet ville lest av asimuten kameraet sto i FØR flyturen.
  Derfor `freeRig.settOversiktStraks()` (ingen animasjon, ingen autorotasjon) og
  så løftet. Asimuten leses av riggen etterpå og sendes uendret videre —
  oversiktsposen ER nordvendt, og å skrive 0 ville lagret det faktumet to steder.
  **Enhetstestene kan ikke se dette**: de ser at asimuten ikke endres, ikke hvilken
  asimut riggen sto i. Røyktesten leser himmelkompassets aria-label og krever
  «nord».
- **DE LØSE STJERNENE ER VALGBARE, og det er ikke en pynt (v6.4.0).** Katalogen
  tar ALT lysere enn magnitude 2,6 (`MAG_GRENSE`), mens figurene er håndplukket —
  57 av 173 stjerner inngår derfor ikke i noen figur vi tegner, Sirius, Aldebaran,
  Altair og Antares blant dem. Eieren leste en skjerm med prikker uten streker som
  en FEIL, og det er en rimelig lesning når ingenting svarer på et trykk. De er nå
  `type: 'stjerne'` i `himmelObjekter`, med `stjerner: [i]` og `linjer: []` inn i
  `skyDome.settValgt` — samme fremhevings-vei som en formasjon.
  **STJERNER SOM ER I EN FIGUR TILBYS IKKE OGSÅ SOM LØSE** (`I_FORMASJON`): to
  trefflater oppå hverandre stjeler trykk fra hverandre, og sikter man på Vega er
  svaret Lyren. Stjernenavnet er fortsatt søkbart gjennom figuren.
  **Trykk-vektingen har to tall med vilje** (`VEKT_PX` i `plukkHimmel`): en skive
  er et stort mål man sikter midt på (18 px), en stjerne er én piksel man sikter
  presist på (8 px). Fikk stjerna månens fradrag, ville den stjålet trykk fra en
  stjernebilde-strek den tilfeldigvis lå nær — og streken er det man ser.
  Prosaen bor i `stjerneFakta.js`, som er REN og skilt fra `stjernebildeInfo.js`
  av samme grunn som `himmelFakta` er skilt fra `himmellegemer`: den ene endres av
  en ny figur, den andre av en ny bake.
- **`STJERNEBILDE_NAVN` dekker BARE stjernebilder vi IKKE tegner (v6.4.0).** De
  femten figurene har sine navn i `FORMASJONER`; sto de også i tabellen, ville det
  norske navnet på Orion bodd to steder. Konsekvensen er at `bayerNavn('Alp Ori')`
  svarer null — det er riktig, betegnelsen brukes bare på løse stjerner — og
  testen holder begge halvdelene fast.
- **Andromeda og Pegasus kom inn i v6.4.0**, og Alpheratz står i BEGGE figurene.
  Det er ikke en dublett: stjerna er hjørnet i Pegasus-firkanten og hodet i
  Andromeda-kjeden samtidig. Legger du til en figur, husk begge bakene —
  `npm run bygg:stjerner` OG `npm run bygg:figurfasit` (med `KODE` utvidet), ellers
  feiler fasit-testen på en id den ikke kjenner.
- **Himmelen har ÉN kilde til «hva ser jeg nå?» (v6.0.0).**
  `lib/tour3d/himmelObjekter.js` er ren og deles av TRE kallere: søkefeltet,
  trykk-plukkingen i himmelen og infokortets naboer. Uten den ville de hatt hver
  sin mening om hva som er synlig, og søket ville tilbudt et stjernebilde trykk
  ikke finner — samme lærdom som mosaikk-regelen over. Lista inneholder BARE det
  som faktisk tegnes: en formasjon må ha 60 % av stjernene sine over horisonten
  (`MIN_ANDEL_OPPE`) for å være til å kjenne igjen, og en planet må stå mer enn
  12° fra sola. En nedtrekksliste som lover noe under horisonten er en felle.
- **Trykk i himmelen plukkes i SKJERMROM, og ligger der terrenget bommer
  (v6.0.0).** En stjernebilde-strek er 1,7 px bred og en planetskive 0,45° — å
  treffe dem med en stråle er praktisk umulig på en telefon. `plukkHimmel` i
  `scene3d` spør i stedet «hva er nærmest fingeren» innen 46 CSS-px. Den står
  presis der `handleTap` FØR returnerte på bommet terreng, og kan derfor per
  konstruksjon ikke stjele et trykk fra en nål, en sti eller GPS-en. Skiver
  (måne, planeter) veies 18 px foran formasjoner: et trykk PÅ månen skal velge
  månen, ikke stjernebildet bak.
- **EN NÅL TREFFES I SKJERMROM NÅR STRÅLEN BOMMER (v6.3.12).** `pins.raycast`
  krever et geometrisk treff på et lite kulehode eller en tynn stamme — noen få
  piksler på en telefon. `naermesteISkjerm` i `pinField` projiserer HODENE til de
  TEGNEDE instansene og tar den nærmeste innen 34 px. Hodet og ikke bakkepunktet:
  det er hodet man sikter på, og stammen er lang når nåla står langt unna.
  Terskelen er mindre enn himmelens 46 px med vilje — nålene står tett, og en sti
  under fingeren skal fortsatt kunne velges i sti-modus. Den ser BARE de tegnede
  slotene, så declutter-regelen og trefflaten kan ikke komme i utakt.
- **X-EN PÅ ET NÅLEKORT ANGRER HELE TRYKKET (v6.3.12).** Et trykk gjør to ting —
  fremhever nåla med en gul ring og flyr dit — og fram til nå forsvant bare
  kortet. Ringen ble stående på en nål ingenting lenger fortalte om, og man sto
  igjen i et nærbilde man ikke hadde bedt om å bli i. `scene3d.angreFeature`
  skjuler ringen og setter kameraposen tilbake; posen legges til side i
  `handleTap` FØR flyturen (`freeRig.hentPose`).
- **`vw` OG `vh` INNE I ET `zoom`-LAG SKALERES IKKE NED (v6.3.12).** De er
  absolutte mot viewporten og blir så ganget med zoomen. Målt i Chromium: en boks
  med `max-width: 78vw` inne i `zoom: 1.5` dekker 117 % av skjermen. Derfor deler
  `tekstBoks(vw, vh)` i Viewer3D taket på skalaen, og boksene selv bruker
  `max-w-full`. Zoomen ligger på hver enkelt boks og ikke på raden de står i:
  raden er `justify-between` over hele bredden, og en zoomet rad skalerer
  polstringen og dytter begge boksene utenfor skjermen.
- **EN FORMASJON TREFFES PÅ STJERNENE OG STREKENE SINE, ikke i senteret
  (v6.3.11).** `plukkHimmel` målte til formasjonens middelretning, og for en figur
  som spenner 40° — Dragen, Karlsvognen, Kefeus — ligger den i TOM HIMMEL: man
  måtte sikte på ingenting, og alt man faktisk så lå utenfor terskelen. Nå bærer
  hvert formasjons-objekt `punkter` + `segmenter` (bare stjerner over horisonten
  og streker med begge ender oppe, samme regel som `linjePunkter` i skyDome), og
  `naermesteTreff` i `himmelObjekter` måler mot begge — ren og enhetstestet, med en
  hul firkant som viser nettopp forskjellen. **Å gjøre strekene eller stjernene
  større, eller å gi hver formasjon en pulsende ring som planetene, ble VURDERT OG
  FORKASTET av eieren: det er støy på en natthimmel, og problemet var aldri at
  figuren var vanskelig å SE.**
- **HVERT LINJEBUFFER I 3D HAR ETT SEGMENT SLACK, og det er en driver-sak
  (v6.3.11, utvidet til alle fire i v6.5.5).** Regelen bor i
  `lib/tour3d/linjeSegmenter.js` — ikke kall `setPositions` direkte på en
  `LineSegmentsGeometry`; en test feiler om noen gjør det igjen. Den gjaldt fire
  buffere og hadde bare truffet ett: kurvene, stinettet og vegene manglet den, og
  DER er symptomet et helt annet enn i himmelen. Origo er kartets midtpunkt i
  havnivå, så siste kurvestrek ble en snorrett rød linje tvers over arket —
  eieren meldte det som «høydekurver som ikke følger terrenget» fra Stormoen og
  Stetind. Tellingen var diagnosen: NØYAKTIG to linjer i hvert skjermbilde, med
  hver sin strektykkelse, og `contourLines` bygger nøyaktig to `LineSegments2`.
  Én bom per buffer — en void-rampe eller et flatt platå i DEM-en ville gitt
  mange spøkelseslinjer spredt utover. `instanceCount` MÅ settes til de ekte
  segmentene: den er `Infinity` som default, og en strek fra origo til origo er
  ikke ingenting når `LineMaterial` har bredde i PIKSLER.
- **Mekanikken bak slacken (v6.3.11).** `LineSegmentsGeometry` legger start og ende i samme interleavede
  buffer: 24-byte stride, `instanceEnd` 12 byte inn. For den SISTE instansen
  slutter `instanceEnd` nøyaktig på bufferets siste byte — lovlig etter
  spesifikasjonen (`offset + stride·(n−1) + size`), men en driver som regner
  kravet som `offset + stride·n` finner 12 byte for lite og DROPPER instansen.
  Eierens telefon gjør nettopp det: Dragen har 13 streker og fikk tegnet 12.
  **SwiftShader og desktop tegner alle 13, så feilen er usynlig i CI og i
  enhetstester** — modellen ble funnet ved å se at den forklarer BÅDE dette og de
  tre gamle målingene (3 av 4, 4 av 5, 6 av 10) som `_maxInstanceCount` alene
  ikke gjorde. Slacken koster 24 byte. Tar du bufferet ned til eksakt størrelse
  igjen, mister du den siste streken i den største figuren.
  **RETTELSE FRA v6.5.5: driveren DROPPER trolig ikke instansen — den leverer
  NULLER for den** (robust buffer access). I himmelen er origo kuppelens sentrum,
  altså kameraets egen posisjon, så den bomme streken peker rett mot betrakteren
  og kollapser til ingenting på skjermen; «12 av 13» og «den 13. gikk til origo»
  er samme observasjon der. På kartet er origo et sted langt unna, og da SER man
  den. Fiksen er den samme uansett hvilken av de to driveren gjør.
- **KAMERAET STÅR ALDRI UNDER TERRENGET — i BEGGE riggene (v6.5.23).**
  Følge-riggen har alltid løftet kameraet over bakken; det er den som gjør at man
  ikke havner inne i fjellsida når stien går bratt. Den frie riggen hadde ikke
  noe gulv i det hele tatt: `controls.target` beholder høyden sin når man
  panorerer, og med polarvinkelen nesten vannrett (`POLAR_MAKS` = 89°) står
  kameraet omtrent i blikkpunktets høyde — så panorerte man inn i en fjellside,
  eller bare langt nok ut, havnet man under arket og kunne bevege seg fritt på
  UNDERSIDA av kartet. Regelen bor nå ETT sted, `terrainFloorY` i `cameraRigs`,
  med `KAMERA_KLARING_M` = 12 m (ganget med overdrivelsen).
  **Samplingen KLEMMES TIL ARKET, og det er selve poenget utenfor kanten:** en
  fallback på havnivå der ville gitt fritt leide under skjørtet. Med kantens egen
  høyde som gulv kommer man helt ut og ser arket fra sida, men aldri under det —
  **å zoome ut til kantene vises ER meningen**, gulvet er en HØYDE og ikke en
  lenke i planet.
  **I den frie riggen er løftet en STIV FORFLYTNING av hele orbiten**, kamera og
  blikkpunkt sammen. Det er det som gjør at det ikke slåss med noe: polarvinkel,
  asimut og avstand er uendret, så himmelvippens polarlås (`settPolarLast`,
  v6.5.6) klemmer ikke imot og zoomen driver ikke. Å klemme POLARVINKELEN i
  stedet ville slåss med nettopp den låsen; å klemme bare kameraets Y ville
  endret både avstand og tilt bak ryggen på brukeren. Løftet er HARDT OPP og
  MYKT NED (`loftSteg`, ren og testet): å stå inne i et fjell i ett eneste bilde
  er feilen dette finnes for, mens et hardt FALL når man panorerer ut over en
  kant leses som et rykk. `applyPose` nullstiller løftet — en programmatisk pose
  er absolutt og har sin egen klaring.
  **Enhetstestene ser bare regnestykket, og røyktesten ser ingenting**: det
  eneste observerbare i DOM-en er hint-tekster, så et kamera under bakken kan
  bare ses. Holder du regelen ren og her, er den i det minste ikke gjettet.
- **SOLA ER DET FEMTE LEGEMET MED GLOBE, og den står UNDER terrenget om natta
  (v6.5.6).** Den tegnes der den faktisk står — og om natta er det under
  horisonten, altså under det endelige terrengarket. Ingen fast plass, ingen
  tvang: invarianten «alt du ser står der det faktisk står» er ikke rørt, og at
  den havner under landskapet er en KONSEKVENS av den, ikke et unntak.
  Tre ting følger av det, og alle tre er lette å «rydde» bort:
  1. **Riggen måtte kunne se NED.** `seMot` rakk bare fra én grad under
     horisonten og opp, fordi HIMMELVIPPEN bærer høyden og bare går én vei.
     `freeRig.polarForHoyde` lar ORBITEN bære blikket i stedet under horisonten,
     ved å heve kameraet. **De to regimene kan aldri være i bruk samtidig** —
     enten står orbiten på taket og vippen bærer, eller så er vippen null og
     orbiten bærer. Låsen (`settPolarLast`) MÅ derfor være AV i det andre
     regimet, ellers klemmer hver `controls.update()` kameraet rett opp igjen.
  2. **Sola er i lista HELE DØGNET**, som det eneste legemet. Regelen «lista
     lover bare det som tegnes» holder fortsatt: sola TEGNES hele døgnet.
     `himmelUndertekst` sier «under horisonten» — fortegnet bæres av ORDET, ikke
     av et minustegn.
  3. **Utvikler-bryteren løfter den IKKE.** Bryteren finnes for legemer man må
     vente på; en tvungen sol ville motsagt hele grunnen til at den er der.
- **SOLA LYSER SELV, og ambient var ikke nok (v6.5.6).** `selvlysende` i
  `HIMMELLEGEMER` slår av retningslyset OG ambienten, og teksturen tegnes som
  `emissiveMap`. Første utgave skrudde bare ambient til 1 — men
  `MeshStandardMaterial` kjører ambient gjennom en diffus BRDF som deler på π, og
  målt i Chromium kom en lys gul sol ut SENNEPSBRUN. Randmørkningen (Eddingtons
  `0,4 + 0,6·μ`, hektet på `emissivemap_fragment` med `onBeforeCompile`, samme
  grep som `skyskygge.js`) er ikke pynt: uten den er kula en lampe.
  **Sola har INGEN faste trekk** — en solflekk lever noen uker og driver med
  rotasjonen — så de navngitte stedene er BREDDEGRADER: flekkbeltene på ±16°,
  ekvator og polområdene. Det er der differensiell rotasjon er å se, altså det
  ene en kule kan vise og en skive ikke kan. **Fotografiet mangler med vilje**:
  kilde-URL-er skal måles og ikke gjettes (v6.3.0), og hostene er sperret herfra.
  Av samme grunn er sola sine SNL-/Wikipedia-lenker et FORSLAG — «Sola» er også
  en kommune i Rogaland — og `probe-himmellenker` bærer kandidatene til CI kan
  avgjøre.
- **Globene er OBJEKT-INSPEKTØRER, ikke reiser (v6.0.0, utvidet i v6.2.0 og
  v6.5.6).**
  `lib/tour3d/himmelGlobe.js` (byggeren) + `lib/tour3d/himmellegemer.js` (dataen).
  Månen, Mars, Jupiter og Saturn kan åpnes som roterbare kuler. Eieren ba om en
  tur TIL månen; det ble forkastet i samråd, fordi det bryter invarianten som gjør
  3D til å stole på — *alt du ser står der det faktisk står, sett fra din
  posisjon* — og fordi det krever et andre kamera-regime, altså nøyaktig gjelden
  denne seksjonen finnes for. Kula henger `GLOBE_AVSTAND` foran kameraet i
  legemets virkelige himmelretning, og du står fortsatt på kartet ditt.

  **Bruksanvisningen i kortet er FJERNET (v6.3.3), og skal ikke tilbake.** Her
  sto «dra for å snurre Mars, og trykk én gang for å legge den tilbake» pluss en
  lukket-variant. Gesten trenger ikke ord: trykk-ringen sier at legemet kan åpnes,
  globe-merket i søkelista sier hvem som kan det, og at man drar i en kule for å
  snurre den er det man prøver først uansett. `GLOBE_TEKST` har derfor bare
  `omtale`, og testen krever at `bruk` er `undefined` — en tekst er lett å legge
  tilbake i god tro.

  **ÉN MODUL MED EN TABELL, ikke fire filer.** Da Mars, Jupiter og Saturn skulle
  ha det månen hadde, var spørsmålet regelen over tvinger fram: er varianten
  egentlig en OPSJON på originalen? Den er det. `HIMMELLEGEMER` bærer farge,
  tekstur, aksehelling, ambient, trekk og eventuelle ringer; `GLOBE_TEKST` bærer
  prosaen, skilt ut fordi den skrives om uten å røre en koordinat.

  **`himmellegemer.js` er REN og MÅ forbli det.** `himmelObjekter.js` — som er
  ren, og som UI-et bruker — trenger `harGlobe` for å vite hvilke legemer som får
  trykk-ring. En import av byggeren derfra ville trukket three.js inn i
  søkelista. Det var slik det ble skrevet først, og splittet er rettingen.

  **GLOBEN TEGNES I EN EGEN DYBDE-PASS (v6.3.4).** Kula henger `GLOBE_AVSTAND`
  (4 km) unna i legemets VIRKELIGE retning, så står legemet lavt — Mars på 3° —
  havner den under terrengnivå og arket skjærer gjennom planeten. `render()` i
  sceneCore tegner derfor hovedscenen (lag 0), tømmer dybdebufferet, og tegner
  globe-laget i en andre pass. Dybden er fortsatt riktig INNE i globen, så Saturns
  ringer ligger der de skal. De to nærliggende utveiene er forkastet: å LØFTE
  globen ville løyet om hvor legemet står, og `depthTest = false` ville lagt
  ringene foran planeten også der de går bak den. `autoClear` MÅ av rundt den
  andre passen, ellers vaskes landskapet bort.

  Regelen bor i `himmelGlobe.settRenderLag` og ikke på kallstedet, fordi den har
  to stille feller: **lysene må også bestå lagtesten** (et DirectionalLight som
  ikke gjør det bidrar ikke, og kula blir kullsvart uten en feilmelding), og
  **laget arves ikke** av barna, så `group.layers.set` alene etterlater innholdet
  på lag 0.

  Fem ting som MÅ stå:
  1. **`vendMot(kamera)` hver frame.** Uten den peker forsida mot verdens +Z,
     som i denne scenen er SØR — sto månen i nord, så man baksida.
  2. **Rullen er `−parallaktisk`.** Da står nordpolen der himmelens nordpol
     faktisk står, og skyggelinja som sigden man nettopp så. Uten den er
     terminatoren riktig i form og feil i retning. Planetene har ingen
     parallaktisk vinkel (se `settPlaneter`); der er den 0, og det er uten
     betydning fordi de ytre planetene er nær fullt opplyst.
  3. **Lyset er et EKTE `DirectionalLight` med `target = mesh`.** Standard-målet
     er verdens origo, og gruppa står 4 km unna det — uten `target` peker sola
     mot midten av kartet. At terminatoren er lys og ikke shader er hele grunnen
     til at kula er en kule: en skive KAN ikke skygges av et lys, og
     `buildHimmelSkive` tegner derfor en ellipse (som er riktig for 1,6° på
     himmelen, og bare der).
  4. **Aksehellingen ligger på en HOLDER mellom gruppa og meshet.** På meshet
     ville brukerens dreining overskrevet den; på gruppa ville `vendMot`
     overskrevet den hver frame. Saturns ringer henger i samme holder, så de
     skjevstiller seg med planeten.
  5. **Saturns ringer er ikke valgfrie.** En Saturn uten ringer er en blek
     Jupiter. Cassini-delingen er det ENE trekket ved ringene som er synlig i en
     liten kikkert, og derfor det som gjør dem ekte.

  **Teksturene er VALGFRIE og bakes i CI** (`npm run bygg:himmelkart`) fordi NASA
  og USGS er sperret fra utviklingsmiljøene — «uten fotografi» er den NORMALE
  tilstanden lokalt. Uten dem tegnes kula i legemets egenfarge, gassplanetene får
  bånd tegnet på klienten (`bandTekstur`) og sola granulasjon
  (`granulasjonTekstur`), så de er gjenkjennelige uansett. Les siste linje av
  bake-steget: «N av 5 kart på plass». Er N lavere enn ventet, har en kilde falt
  bort — og det er den eneste måten å oppdage det, siden alt annet fortsetter å
  virke.

  **PROBEN MÅ SPØRRE OM ETT LEGEME OM GANGEN (v6.5.7).** Med fem legemer i lista
  svarer Wikimedia 429 på nesten hele kjøringen, og en probe som blir
  ratebegrenset MÅLER INGENTING — samme lærdom som i runde to, bare med et legeme
  mer. `--probe sol` tar spørsmålene fra ~60 til ~8, og workflowen har en
  legeme-input. En 429 gir dessuten ett forsøk til: forskjellen på «filen finnes
  ikke» og «vi spurte for fort» er hele forskjellen på en måling og en gjetning.

  **EN KILDE-URL SKAL IKKE GJETTES, OG DET ER MÅLT (v6.3.0).** I v6.2.0 ble
  URL-ene til Mars, Jupiter og Saturn skrevet på gjetning fordi hostene er
  sperret herfra. Alle tre var feil, og det viste seg først i deploy-loggen etter
  merge. Rettingen er en MÅLING og ikke en ny hypotese — samme lærdom som skyene
  (v5.22.0) og knappenålene (v5.22.8–11): `.github/workflows/probe-himmelkart.yml`
  kjører `bygg-himmelkart.mjs --probe`, som spør Wikimedia Commons' API om
  kandidater i kuraterte kategorier, løser opp thumb-URL-en, leser lisensen og
  LASTER NED bildet for å se hva det veier (API-ets `size` er originalens, ikke
  nedskaleringens). Fire runder ga fire funn verdt å kjenne: Wikimedia krever en
  identifiserende `User-Agent`; fritekstsøk er ubrukelig (PDF-er fra 1834, bilder
  av Saturns måne Daphnis) mens kategorier er kuratert; femti forespørsler i
  slengen gir 429 fra én runner-IP; og kategoriene må plukkes i RUNDGANG, ellers
  spiser den første alfabetisk hele taket.

  **Derfor oppgis en Commons-kilde som en TITTEL (`{ commons: 'File:…' }`) og
  ikke som en URL.** Thumb-URL-ene har en md5-shard av filnavnet; en URL man
  skriver av kan råtne stille, mens tittelen slås opp ved hver bake og gir
  lisensen med. Månen beholder NASA SVS-URL-en, for den er den eneste av de fire
  som beviselig svarte. Mars og Saturn er CC BY 4.0 (Solar System Scope) —
  **attribusjonen på /om er et vilkår og ikke en høflighet.**
- **Fakta og utforskningshistorie bor i `himmelFakta.js`, ikke i `himmellegemer.js`
  (v6.3.0).** Den siste er GEOMETRI — aksehelling, farge, koordinater for
  stedsnavn — og den nye er PROSA og ÅRSTALL. De endres av helt ulike grunner, og
  en tabell som blander dem inviterer til at et faktum flyttes og en koordinat
  blir med. Modulen er REN og dekker månen pluss alle fem planetene; testen
  krever nettopp det mot `PLANETER` i `planeter.js`, så en ny planet i himmelen
  ikke kan vises uten fakta. Månetallene er merket med `MANETALL_AR` fordi de
  ENDRER seg — nye småmåner blir funnet — og et tall uten år blir feil uten at
  noen merker det. `utforskning` er ELDST FØRST (egen test): snudd rekkefølge ser
  helt normal ut i et panel og gjør historien uleselig. Kortet viser de fire
  nyeste sammenlagt, og «alle N» gir resten.

  **Lenkene til SNL og Wikipedia er veien VIDERE, ikke kilden.** Faktaene står i
  fila fordi bruksområdet er en kveld ute uten dekning; et oppslag i felt er et
  oppslag som feiler i felt. Legger du til et legeme, skriv faktaene inn — ikke en
  lenke og en tom blokk.
- **Trykk-ringen på himmelen er FAST I CSS-PIKSLER, ikke i grader (v6.2.0,
  rettet i v6.3.2).** `buildHimmelSkive({ ring })` tegner et pulserende omriss
  rundt legemet, i SAMME shader og på samme plan som skiva (planet blåses opp til
  det største av skive og ring; et eget mesh ville vært ett objekt mer å holde i
  takt med posisjon, skala og synlighet).

  **FEILEN SOM BLE RETTET ER VERDT Å KJENNE:** ringen var `RING_FAKTOR` × skivas
  VINKELSTØRRELSE. For månen (1,6°) ga det et brukbart omriss, men for en planet
  på 0,45° ble ringen 17 px i diameter og streken **under én piksel bred** —
  altså usynlig. Eieren meldte at «de tre planetene vises ikke og må åpnes via
  søk», og det var nettopp dette: affordansen var der, den var bare sub-piksel.
  Samme klasse feil som stjernestørrelsene i v6.0.0 — **en affordanse må måles i
  piksler, for det er piksler brukeren ser.**

  `RING_PX` er 46, og det er ikke et rundt tall: det er samme terskel
  `plukkHimmel` i scene3d bruker, så **det man ser er nøyaktig det man kan
  treffe.** Ringen er derfor LIK for alle fire, uavhengig av legemets størrelse.
  `settSkjermHoyde` regner den om ved hver resize (matet av `setResolution`) —
  en ring i piksler som bare regnes ut ved bygging er 46 px på den skjermen appen
  startet på og noe annet etterpå.

  Ripple-en er tre lag: et svakt FAST omriss, så det alltid er et mål å sikte på
  i det øyeblikket pulsene er svakest, pluss to pulser et halvt omløp i utakt.
  Bevegelse er det eneste øyet finner av seg selv på en natthimmel. Guarden
  `rq > uSkive` i shaderen er ikke valgfri: uten den kan en puls som passerer over
  legemet overskrive det, og da BLINKER Mars i stedet for å ligge stille.

  `MIN_SKIVE_PX` (5) er et GULV og ikke en forstørrelse: legemet skal ikke gjøres
  uproporsjonalt større enn på den virkelige natthimmelen — det var uttrykkelig
  bestillingen — men det må være noen piksler stort, ellers er det ingenting å se
  inni ringen.

  Porten står på nøyaktig de fire legemene som HAR en globe: `harGlobe`, ETT sted.
  Merkur og Venus får den ikke — et omriss som lover en globe som ikke finnes er
  verre enn ingen ring. **`nightSky.update(camera, tidS)` MÅ mate alle skivene**,
  ikke bare månen: en uniform som ikke mates står stille, og fram til v6.3.2
  vendte bare månen seg mot kameraet her.
- **Infokortet i himmelen har FAST HEADER og RULLBAR KROPP (v6.3.2).** Med fakta
  og utforskningshistorie inne (v6.3.0) vokste kortet rett ut av skjermen: navnet
  og de tre knappene forsvant oppover mens teksten lå igjen over terrenget, uten
  noen måte å lukke kortet på. Headeren — navn, retning, høyde og ikonene —
  er `shrink-0` og alltid synlig; bare lesestoffet ruller, med tak på 58 vh.
  `overscroll-contain` og `touch-pan-y` er ikke pynt: uten dem forplanter et drag
  som treffer enden av lista seg til 3D-lerretet og dreier kameraet under fingeren.
- **På desktop kan man ikke løfte blikket med et venstre-drag, og det er en ekte
  luke (v6.3.2).** `freeRig` setter `mouseButtons = { LEFT: PAN, RIGHT: ROTATE }`,
  så bare HØYRE knapp roterer — og ingenting på skjermen sier det. Uten en
  kontroll er hele stjernekikkeren utilgjengelig på en stor skjerm uten berøring.
  `Tour3dBlikkSkyv.vue` på høyre kant setter blikkets høyde direkte, i BÅDE dag og
  natt, bak porten `(hover: hover) and (pointer: fine)`.

  Tre ting som må stå: den bruker `freeRig.settBlikkHoyde` og ikke `seMot`, fordi
  en skyveknapp sender et event per piksel og hundre 0,9-sekunders animasjoner som
  avbryter hverandre gir et blikk som rykker etter håndtaket; området kommer fra
  `blikkHoydeGrenser()` og skrives IKKE av, ellers står håndtaket stille i endene;
  og `blikk`-eventet emittes fra v6.3.2 i ALLE moduser, ikke bare om natta — et
  håndtak som bare er sant om natta lyver om dagen. Vippen har fortsatt ÉN eier:
  `freeRig`.

  **AVLØST AV RETNINGSROSA (v6.5.19) — `Tour3dBlikkSkyv.vue` finnes ikke lenger.**
  Desktop-kontrollene bor nå i `src/components/kontroller/` og deles av BEGGE
  flatene: `ZoomSkyv.vue` (loddrett, med pluss/minus) og `RetningsRose.vue`, som
  bærer azimut og høyde i ÉN rund flate — rosa er himmelhvelvet sett ovenfra,
  senter rett opp, rand rett ned, horisonten den stiplede ringen imellom. I
  kart-modus faller høyden bort og skiva snurrer i stedet. Regnestykket er rent og
  testet i `lib/navKontroller.js`; zoomen er LOGARITMISK, så hver dobling får like
  mye vei. **En «kube» à la Blender er VURDERT OG FORKASTET:** den snakker om et
  objekt sett utenfra, mens man her står PÅ kartet og ser ut, og den har ingen
  naturlig tastaturbetjening.

  Fire ting som må stå. **`settBlikkRetning` i `freeRig` eier BEGGE regimene** —
  det er derfor rosa kan tilte NEDOVER der skyven ikke kunne: over horisonten
  bærer vippen, under bærer orbiten, og polarlåsen MÅ settes FØR vinklene (se
  v6.5.6). Området er `blikkHoydeGrenserFullt()` (−85…74), som skiller seg fra
  `blikkHoydeGrenser()` ved REGIME og ikke ved en strammere klamp. **De to
  `<input type="range">`-ene under rosa er EKTE** og ligger oppå med `opacity: 0`
  og `pointer-events: none` — ikke `sr-only` — så de beholder en ekte boks for
  tastatur, hjelpemidler og Playwright; rosa arver `blikk-skyv`-klassen slik at
  røyk-sjekken fra v6.3.2 fortsatt måler noe. **Zoom-området LESES** (`zoomGrenser`
  i `usePinchZoom`, `avstandsGrenser` i `freeRig`) og skrives aldri av: gulvet i
  kartet er mosaikk-avhengig. **Og søyla står 34 px innenfor viewportkanten** i
  MapView, fordi de åtte lende-pilene dokker i et bånd der ute og nordøst-dokka
  havnet under den — røyktesten fanget det, og den måler med `elementFromPoint`
  nettopp for at neste kollisjon skal fanges av seg selv.

  **SØYLA TAR PLASS AV OVERLEGGET, DEN LEGGER SEG IKKE OPPÅ DET (v6.5.20).** I 3D
  er den absolutt plassert på høyre kant, og infokortet er sentrert med inntil
  86 vw: på et smalt vindu la kortet seg under søyla, og «alle N» i et
  stjernebildekort var et trykk som traff zoom-skyven. Polstringen står på ROTEN
  av overlegget og ikke på hver rad — absolutt plasserte barn (lerretet,
  himmelkompasset, søyla selv) måler mot padding-BOKSEN og står stille, mens hver
  flyt-rad rykker inn i én operasjon. Den gjelder også rader som ikke kolliderer i
  dag: POI-panelet kan bli 60 vh og vokser rett inn i båndet.
  **Og en røyk-sjekk som fyller skyven med et FAST tall måler ingenting**: hvor
  skyven står ved start følger arkets størrelse og hva forrige sjekk etterlot —
  på ekte Vardåsen sto den på 0,757, så «0,8» var et lite steg OPP. Sjekken går
  fra ende til ende.
- **Fremhevings-bufferet allokeres ÉN gang, på maks størrelse (v6.3.9).** three
  setter `geometry._maxInstanceCount` FØRSTE gang en instansiert geometri bindes,
  av bufferets lengde den gang, og fjerner det aldri igjen (bare ved dispose).
  Tegnetallet er `min(instanceCount, _maxInstanceCount)`. `settValgt` kalte
  `setPositions` med et nytt, mindre buffer per valg — så taket ble satt av det
  FØRSTE valget i økta, og hver større formasjon etterpå fikk figuren KLIPPET.
  Målt i Chromium: `_max=4` etter Kassiopeia, altså fire streker av Dragens ti.
  Feilen ser ut som «noen streker mangler i stjernebildet», og den er usynlig i
  enhetstester fordi geometrien er helt riktig — det er bindingen som klemmer.
  Regelen er den samme som knappenålene (v5.22.11): `instanceCount` styrer hva
  som SUBMITTERES, kapasiteten er konstant. Invarianten står i `skyDome.test.js`
  og er verifisert i begge retninger.
- **Stjernebildefigurene har en INNBAKT FASIT, og bruken er ENSRETTET (v6.3.9).**
  `lib/tour3d/stjernefigurFasit.js` (bakt av `scripts/bygg-figurfasit.mjs`, npm
  `bygg:figurfasit`) er d3-celestials standardfigurer slått opp mot HYG. Testen
  krever at hver strek VI tegner finnes der; en strek i fasiten vi ikke tegner er
  greit, for kjedene i `bygg-stjerner.mjs` er bevisste forenklinger for en
  telefonskjerm. Grunnen til at den finnes: elleve streker i sju stjernebilder var
  snarveier vi hadde funnet opp — Algol rett på δ Per, Dragens hode som trekant
  der `stjernebildeInfo` alt sa «firkant» — og Karlsvogna hadde bollen ÅPEN.
  **Ingenting i koden avslører en oppfunnet strek**, og en figur kan være helt
  internt konsistent og likevel være feil. Legger du til et stjernebilde, kjør
  baken; mangler den en id, feiler testen med vilje.
- **Stjernestørrelser er i CSS-piksler, og det var en ekte feil (v6.0.0).**
  `gl_PointSize` og `LineMaterial`-bredder er i FRAMEBUFFER-piksler. Med
  `setPixelRatio` opptil 2 ble stjernene halv størrelse på telefon — usynlige i
  felt, upåfallende på desktop. `skyDome` multipliserer derfor med
  `uPikselForhold`. Og `LineBasicMaterial.linewidth` IGNORERES helt av WebGL:
  konstellasjonsstrekene må gå gjennom `LineSegments2`/`LineMaterial`, som er
  prosjektets etablerte vei. `settValgt` nullstiller ALLTID til grunnverdiene
  først — ellers ganger fremhevings-faktoren seg opp for hvert valg (1,6⁵ = 10×
  etter fem).
- **Maksimert modus skjuler alt unntatt himmelsøket (v6.0.0).** Bestillingen kom
  etter felttest i mørket, og grunnen er fysiologisk: et øye bruker 20–30 minutter
  på å mørkeadaptere, og en hvit flate kaster bort de minuttene. Søkefeltet MÅ
  bli stående — er det skjult fordi man ennå ikke har sett opp, er modusen en tom
  skjerm med to nesten usynlige knapper. Tilstanden persisteres bevisst IKKE: man
  skal ikke åpne 3D neste gang og finne en skjerm uten knapper.
- **`royktest.yml` trigget ikke på `src/lib/**` fram til v6.0.0.** Det var en
  reell luke, ikke en detalj: hele 3D-motoren bor der, og dens egne røyk-sjekker
  kunne hoppes over uten en lyd. Legger du til en sti i motoren, sjekk at både
  workflowens `paths` og `MAA_HA_EKTEKART` i `scripts/trenger-ektekart.mjs`
  dekker den.
- **Månen er geometri med en fase-shader, ikke en tekstur (v5.27.0).** Den var en
  `THREE.Sprite` med en 128 px radiell gradient, og eieren meldte at den ikke var
  sirkelformet. Samme klasse feil som skyene under: formen kan ikke reddes i
  teksturen når det er teksturveien som er problemet. En shader som forkaster alt
  utenfor `r = 1` KAN ikke tegne noe annet enn en sirkel. Vinkelstørrelsen er 3×
  for stor med vilje (0,52° er ni piksler på en telefon) — en bevisst
  overdrivelse, som symbolstørrelsene i ISOM-katalogen.
- **Man kan SE OPP i 3D, og gesten er en fortsettelse av draget (v5.27.0).**
  OrbitControls ser alltid PÅ blikkpunktet, så den kan ikke løfte blikket over
  horisonten — 85° fra senit var taket. `freeRig` legger derfor en `himmelVipp` PÅ
  kameraets orientering etter `controls.update()` (hver frame, siden update setter
  kvaternionen på nytt), og FRYSER polarvinkelen mens vippen er i bruk framfor å
  forsøke å trekke bevegelsen fra i etterkant. Asimuten er fortsatt fri. Vippen
  nulles av `applyPose`, så «Oversikt» alltid gir oversikt. Regelen er ren og
  testet (`himmelVippSteg`); at `camera.rotateX(+v)` peker OPP og ikke ned er egen
  test, for det er den ene tingen som kan være snudd.
  **RETNINGEN ER OPPOVER, og det er ikke til å gjette:** `rotateUp` gjør
  `phi -= dy`, så et drag oppover senker blikket mot horisonten og fortsetter
  derfra inn i himmelen; nedover løfter kameraet til fugleperspektiv. Fortegnet
  var snudd i første utgave, og enhetstestene sto grønne hele veien — de tester
  regelen, ikke retningen. Det var røyktesten i Chromium som fanget det, sammen
  med at et VENSTRE-drag i denne appen panorerer (`mouseButtons` er satt om), så
  en test som drar med venstre knapp roterer ingenting.
- **Stier draperes IKKE på havnivå der DEM-en mangler (v5.27.0).**
  `pathNetwork.yAt` returnerer null og linja BRYTES. Før ble høyden 0, og
  stinettet plunget rett ned fra fjellsida og løp videre langs et sjøplan
  hundrevis av meter under terrenget — synlig i felt som «stier som faller ut av
  3D». `pinField.drapedWorld` beholder havnivå-fallbacken MED VILJE, og det står
  hvorfor i fila: `terrainGrid` flater noData til havnivå, så der DEM-en mangler
  ER det tegnede terrenget på 0, og en nål på 0 står PÅ bakken som vises. En sti
  er en sammenhengende strek fra ekte terreng og ned dit, og det er streken man
  ser. Bytt den ikke til null/NaN — verdien går rett inn i `holder.position.set`
  i `waypointMarkers`, og en ikke-endelig instans-matrise er feilen v5.22.9–11
  gikk tre runder på.
- **Tekststørrelsene i 3D-overlegget er `rem`, ikke `px` (v5.27.0).** UU-tilpasning:
  Chrome på Android skalerer rot-fontstørrelsen etter Tilgjengelighet →
  Tekstskalering, og `rem` følger den. Faste `px` gjør det aldri. Tailwinds
  avstandsskala er også rem-basert, så polstring og knappehøyder vokser i takt —
  det er derfor teksten ikke sprenger boksene. Resten av appen er px (605
  forekomster); 3D er første flate som følger systemet, og det er en bevisst
  start. iOS trenger `font: -apple-system-body` for Dynamic Type, og
  `index.html` setter fortsatt `user-scalable=no` — begge egne saker.
- **Skyene i 3D er KLYNGER AV PUFFER, ikke sprites (v5.22.0, `lib/tour3d/puffSkyer.js`).**
  Hver sky er 13 kamera-vendte firkanter med hver sin posisjon i rommet, og hver
  puff skyggelegges som en kule (normal av firkantens egne koordinater, sol-retning
  oversatt til view-space hver frame). Klyngen har ekte utstrekning i tre akser, så
  silhuetten endrer seg når man flyr rundt, toppen buler, og puffene passerer forbi
  én for én når man flyr inn. Én draw call pr sky — samme budsjett som sprites hadde.
  **Historikken er verdt å kjenne, for den kostet en dag:** skyene var sprites, og
  eieren meldte at de så «kuttet» og flate i toppen. Det ble forsøkt rettet ÅTTE
  ganger i teksturen (radius-klipping, høyere lerret, alfa-vignett, `fog: false`,
  materiale pr sprite, `alphaTest`, større felt, nær-kamera-demping) — alle feil
  sted. En GPU-måling fra eierens egen telefon frikjente hele teksturveien: sRGB,
  mipmap-generering, NPOT og både tømt lerret og ufullstendig tekstur var rene.
  En `THREE.Sprite` ER en flat plate som alltid vender mot kameraet; toppen er flat
  uansett hva teksturen inneholder. **Lærdommen: når en visuell feil bare finnes på
  én enhet, mål på enheten før du endrer kode — og spør om formen i det hele tatt
  KAN komme fra det du mistenker.**
  De fire tallene som styrer uttrykket (`radiusFaktor`, `kantMyk`, `tetthet`,
  `lysKontrast`) står samlet i toppen av `buildPuffClouds`. De er smak, ikke
  mekanikk. `puffSkyer.test.js` håndhever det som IKKE er smak: utstrekning i alle
  tre akser, og at puffene overlapper nok til at man ser skya og ikke kulene.
- **Værhimmelen er en OPSJON, ikke et lag ved siden av (v5.21.1).** `setVaer(preg)`
  på `sceneCore` justerer skyene som alt finnes (antall synlige sprites, farge,
  vinddrift) og skrur på ett `Points`-objekt for nedbør. `setVaer(null)` skal gi
  nøyaktig standard-himmelen igjen — værmodus av etterlater ingen spor. Selve
  oversettelsen fra METs `symbol_code` til preg bor i `lib/tour3d/vaerHimmel.js`,
  som er REN og enhetstestet: rekkefølgen på regex-ene der bestemmer hvilken
  familie som vinner, og en regel plassert for høyt stjeler treff fra dem under.
  Takene (`SKY_OPASITET_TAK`, `NEDBOR_TAK`) er lesbarhet, ikke smak — 3D har
  ingen adaptiv kvalitets-nedtrapping å skru ned senere.
- **Sol-retningen i 3D er LÅST til relieffet (v5.22.1).** `puffSkyer.solRetning`
  er `(−0.5, 0.707, −0.5)` fordi `computeHillshade` baker karttekstur med azimuth
  315° og elevasjon 45°, og scenen har nord = −Z. Fram til v5.22.1 sto z positiv,
  altså sol fra sørvest — skyene ble lyssatt fra motsatt side av fjellene under
  dem. Skyskyggene (`skyskygge.js`) tar retningen FRA skyene av samme grunn: to
  steder med hver sin sol kommer i utakt uten at noen test ser det.
- **Skyskygger er ANALYTISKE, ikke et skyggekart.** Terrenget er
  `MeshBasicMaterial` med bakt karttekstur — det finnes ingen lyssetting å
  modulere og ingen skyggekart-pass. `skyskygge.js` sender skyenes senter og
  radius inn som uniformer og hekter seg på via `onBeforeCompile`, ETTER
  `dithering_fragment` (før den ville fargen blitt satt sammen på nytt over
  skyggen). Taket er `MAKS_SKYER` = 14 iterasjoner per fragment. Skyggen dempes
  med skydekket: fullt dekke gir jevnt skyggelagt bakke, der enkeltflekker leses
  som en tekstur-feil.
- **Knappenålene i 3D tegner BARE det som vises — `count`, ikke parkering
  (v5.22.11).** `pinField` komprimerer de synlige instansene fremst i bufferet og
  setter `InstancedMesh.count` til antallet. Grunnen er en feiljakt over fire
  runder: 3D viste flimrende, heldekkende flater i nålefargene på eierens telefon,
  usynlig på desktop og i SwiftShader. Alle tre første forsøkene behandlet
  GEOMETRIEN (vinkel-tak på hodet, parkering utenfor far-planet,
  `DynamicDrawUsage`), og de var alle feil sted. Feilen var at vi submitterte
  ~693 av 727 instanser vi ikke skulle se, hver frame, og lot GPU-en klippe dem
  bort — først som singulære nullflater (skala 0 = alle 260 vertekser i ett
  punkt), så som kuler 200 km unna, altså utenfor guard-bandet en tile-basert
  mobil-GPU regner med. Begge er inndata desktop forkaster stille og en
  mobil-driver står fritt til å gjøre hva som helst med. **Regel: en instans som
  ikke skal ses, skal ikke submitteres.** To feller kompakteringen tvinger fram,
  begge testdekket: `instanceColor` følger SLOTEN og ikke nåla (fargene må
  skrives om når declutteren bytter sammensetning), og `InstancedMesh` cacher en
  bounding sphere som three IKKE invaliderer når matrisene endres — den brukes av
  raycast, så den må nulles, ellers bommer trykk på nåla som nettopp flyttet inn
  i sloten.
- **Finnes feilen bare på eierens telefon: BYGG EN MÅLING, ikke en hypotese.**
  Dette er samme lærdom som skyene ga (se puffSkyer over), og den ble gjentatt i
  full bredde i v5.22.8–11: tre versjoner med hver sin plausible fiks, alle
  bommet, fordi de eneste observasjonene var skjermbilder. Det som løste saken på
  ti minutter var fire tall i Info-panelet — «34 vist / 693 parkert av 727,
  største hode 0,8 % av et tak på 12 %» — som beviste at hver matrise vi skrev
  var riktig og flyttet mistanken til det vi ikke hadde rørt. Legg målingen inn
  FØRST, la eieren lese den av, og fjern den etterpå (den ble tatt ut igjen i
  v5.22.12). Praktisk: en farge kan måles. Kvantiser skjermbildet og slå hex-en
  opp i palettene — `#8e44ad`, `#7f8c8d` og `#1d4ed8` pekte rett på
  `poiColors.js` og sparte all gjetting om HVA som ble tegnet.
- **Retur fra bakgrunn i 3D må VERIFISERES, ikke antas (v5.22.12).** Er man i 3D
  og bytter til en annen app i noen minutter, sto visningen frosset ved retur —
  ingen zoom, ingen panorering, ingen knapper — til man lukket 3D og gikk inn
  igjen. Tre uavhengige årsaker, og vi kan ikke skille dem fra hverandre i felt:
  `visibilitychange` kommer ikke alltid når Android har fryst siden (Chrome
  sender `resume`), GL-contexten kan være tapt uten at `webglcontextrestored`
  noen gang fires, og — den verste — et unntak i `onFrame` hoppet over linja som
  ber om neste frame, så ÉN feil drepte loopen for godt. `engineLoop` ber nå
  alltid om neste frame (feilen logges én gang), lytter på `visibilitychange`,
  `resume`, `pageshow` og `focus`, og har en vaktbikkje som sjekker at det
  FAKTISK kom en frame etter oppvåkning: ingen frame på 1,5 s → én omstart, og
  fortsatt ingen → `onDead`, som får viseren til å bygge motoren om. Rører du
  loopen: en frame som kaster skal koste én frame, aldri økta.
- **Værsymbolene bruker variantene MET selv setter, ikke lysmodusen i 3D
  (v5.22.12).** `symbol_code` fra Locationforecast er allerede regnet ut for
  tidspunktet og stedet (`clearsky_day` / `_night` / `_polartwilight`). Fram til
  v5.22.12 overstyrte 3D-viseren varianten med dag/natt-knappen, med
  begrunnelsen «ser man en natthimmel, skal symbolet vise natt» — og da sto det
  sol i raden klokka 00 så snart man var i dagmodus. Raden er et VARSEL, ikke en
  illustrasjon av himmelen man har valgt. Månen i settet er dessuten byttet fra
  METs grå til solas gule i byggeskriptet (`MAANE_FARGER` i
  `scripts/build-vaerikoner.js`), fordi den grå forsvant mot det
  halvgjennomsiktige feltet i kartet; det er vårt ENESTE avvik fra kildens
  palett.
- **Effekter som bare finnes i BEVEGELSE må måles i skjermbrøk, ikke i «faktor»
  (v5.22.1).** Vinden var dempet der den skulle vært forsterket, og feilen levde
  til eieren sto i felt og ikke så forskjell mellom 2 og 18 m/s. Målt var
  forskjellen 1,9 % mot 7,1 % av synsfeltet på ti sekunder — ratioen fantes, men
  begge var under terskelen for hva et øye oppfatter som bevegelse. Skru du på
  drift, nedbørsfart eller lyn-frekvens: regn ut hvor mange prosent av bildet det
  flytter seg på tida brukeren faktisk ser på, og bruk `npm run dev` med
  vær-demoen (Utvikler-fanen) framfor et stillbilde. Vi ligger nå bevisst rundt
  7× virkelig skyfart på det sterkeste; alternativet er en egenskap ingen ser.
- **Tåke er redusert SIKT, ikke flere skyer.** `siktFaktor` fra `vaerHimmel.js`
  skalerer `scene.fog.near/far`. Uten den så tåke ut som overskyet, som var
  tilfellet fram til v5.22.1. `setVaer(null)` setter dis-avstandene tilbake til
  de eksakte utgangsverdiene, som resten av værmodusen.
- **Sol/måne-knappen i 3D har TO stillinger (v6.1.0): dag med vær ↔ natt.** Den
  hadde fire, og de to som falt bort var begge bilder ingen hadde bedt om: dag
  UTEN vær (varselet er ett oppslag med 30 min cache, og en skyfri dagshimmel er
  ikke mer nøytral enn en riktig) og natt MED vær (værhimmelen skjuler stjernene
  som er hele grunnen til å slå på natt — og skyene vises uansett bare om dagen,
  se `oppdaterSkySynlighet`). Knappen står nå HELT TIL VENSTRE i topprada, foran
  nålene: den skifter hele bildet, og i nattmodus er den den eneste som blir
  igjen på venstresida.
- **VÆRET LUKKES MED EN X I VÆRRADEN, ikke med modus-knappen (v6.3.8).** Et trykk
  tar bort både raden og værhimmelen (`vaerAvvist` i Viewer3D gater `vaerOn`, som
  alt styrer begge). Den erstatter det tredje steget sol/måne-knappen hadde fram
  til v6.1.0: knappen svarer på «dag eller natt», dette er «vis meg været eller
  ikke», og to spørsmål på én bryter var nettopp det som gjorde tri-staten uklar.
  **Tilstanden lagres IKKE** — dag/natt avgjøres av klokka, så neste gang 3D åpnes
  er været med igjen; et bytte av lysmodus nullstiller flagget, og det er den ene
  veien tilbake i samme økt.
- **VÆRRADEN RULLER IKKE — den fyller bredden (v6.3.9).** Den var en rulleflate
  med åtte FASTE timer, og på en 430 px-telefon fikk seks plass: to timer lå gjemt
  bak en gest ingenting antydet, og eieren oppdaget rullingen først etter måneder.
  **En skjult gest er ikke en affordanse.** `maalPlass` i `Tour3dVaerRad` måler
  ledig bredde og viser bare timene som passer.

  Fem ting som MÅ stå. **Målingen må kjøre når RADEN FINNES, ikke ved montering
  (v6.3.12)** — raden står bak `v-else-if="timer.length"`, og ved montering er
  varselet ikke hentet, så ref-en er null: målingen returnerte, observeren ble
  aldri koblet på, og antallet sto på startverdien for alltid. Med vanlig
  rot-font passet den tilfeldigvis, så røyktesten var grønn uten å måle noe.
  **Ledig bredde er forelderens INNHOLDSBREDDE** — `getBoundingClientRect()`
  inkluderer `px-3`, som gjorde prognosen 24–30 px for raus, altså én time for
  mye — og det er forelderen og ikke raden, for radens egen bredde følger
  antallet vi nettopp valgte og ville jaget sin egen hale. **Kolonnebredden måles
  i PIKSLER fra DOM-en** og regnes ikke fra rem, fordi rot-fontstørrelsen følger
  systemets tekstskalering (v5.27.0); kolonnene må være `shrink-0`, ellers klemmes
  de mot `min-w` når det er trangt og man måler minstebredden. **Prognosen
  ettersjekkes mot den ekte layouten** (`scrollWidth > clientWidth` → ett hakk
  ned), for avrunding og skillelinjer gjør regnestykket ett hakk optimistisk.
  **Gulvet er to timer**, ikke tre: ved 150 % tekst på en 412 px-telefon får ikke
  tre plass sammen med kilden og X-en, og en knapp som klippes bort er verre enn
  en time mindre. Røyk-sjekken måler invarianten direkte — `scrollWidth −
  clientWidth` skal være 0 — BÅDE med vanlig og med 150 % rot-font, siden det var
  den siste som brakk.
- **STARGAZER STÅR DER BLIKKET ER, og bare der (v6.5.44).** Løfter man blikket i
  dagmodus, er himmelen tom, mens veien til det ene stedet det er noe å se opp
  på — nattmodus — er en sol/måne-knapp nede i venstre hjørne som ikke handler om
  himmelen man nettopp så opp i. Knappen vises på `serOpp` og forsvinner i det
  man drar seg ned igjen, så den koster ingen kartflate. Tre ting må stå:
  `z-[9]`, altså UNDER resten av overlegget — hjelpens nedtrekk og værraden skal
  male over den; `pointer-events-none` på raden og `auto` på knappen, ellers
  svelger den fullbreddes raden nettopp det draget nedover som er veien tilbake
  til kartet; og skjult under en gående tur, der kameraet er turens.
  `STARGAZER_TEKST` MÅ stå etter `finPeker` — den er en `const`, altså ikke
  hoistet (TDZ-regelen).
- **INFO-HEADEREN BLIR STÅENDE, OG KROPPEN ER ET NEDTREKK (v6.5.44).** Fram til
  nå BYTTET Info-pilla seg ut med den utvidede boksen, og boksen sto i FLYTEN i
  en `justify-between`-rad — så en åpnet hjelp dyttet det grønne POI-filteret ut
  av skjermen og tok med seg sin egen lukkeknapp ut av syne. Pilla er nå den
  eneste bryteren og står i flyten alene, så raden er like bred åpen som lukket.
  **Kroppen er ABSOLUTT plassert, og da kan kallstedet IKKE pakke den i en
  `overflow`-boks** — en slik boks klipper nedtrekket bort. Taket og rullingen
  bor derfor i panelet selv, med målene som CSS-lengder fra Viewer3D: det er DER
  `zoom` settes, og `vw`/`vh` skaleres ikke ned av den (v6.3.12).
- **NATTMODUS ER STJERNEKIKKEREN, ikke kartet i mørkt tema (v6.1.0).** Å slå på
  natt gjør fem ting på én gang, og det er en bevisst pakke: blikket løftes til
  50° med en ease-out over 1,5 s (`scene3d.seOppMotHimmelen`), kurver + stier +
  nåler skjules, hele overlegget forsvinner unntatt sol/måne, X og himmelsøket
  mellom dem, himmelkompasset kommer nede til høyre, og været slås av.
  **Maksimer-knappen fra v6.0.0 er FJERNET** — den var i veien for sin egen
  hensikt: den som slår på natt gjør det for å se stjerner, og da er hver hvite
  flate en feil, inkludert knappen man må finne for å bli kvitt dem.
  Lag-tilstanden HUSKES og gis tilbake når man går ut igjen (`lagForNatt` i
  Viewer3D) — de var brukerens valg. Blikket løftes uten å dreie: azimuten leses
  av riggen (`azimutFraTheta`, som er sin egen inverse) og sendes uendret inn i
  `seMot`. Ett drag nedover tar deg tilbake til landskapet; det står ingen
  forklaring, for bevegelsen er den samme man nettopp så bli kjørt.
- **Åpningsmodusen i 3D er HIMMELEN, ikke kart-temaet (v6.1.0).** `astronomi.erNatt`
  regner solas høyde for arkets senterpunkt og sammenlikner med den OFFISIELLE
  grensa −0°50′ (`SOL_HOYDE_SOLNEDGANG`: øvre rand ved horisonten −16′ pluss
  refraksjon −34′, samme definisjon MET og Yr regner tidene sine fra). Fram til
  v6.1.0 fulgte den `props.isDark`, altså om KARTET sto i mørkt tema — et helt
  annet spørsmål, for man kan godt lese et mørkt kart midt på dagen.
  **METs Sunrise-API ble vurdert og forkastet:** hele bruksområdet er en kveld
  ute uten dekning, og vi trenger ikke tidene — vi trenger solas høyde NÅ, som er
  det tidene er regnet ut FRA, og den har vi lokalt. Merk at grensa er
  soloppgang/solnedgang og IKKE skumring: rett etter solnedgang er himmelen
  fortsatt lys. Det er den offisielle grensa som ble bestilt.
- **Himmelkompasset er REN MATTE OG SVG, ikke en andre 3D-scene (v6.1.0).**
  `lib/tour3d/himmelKompass.js` + `Tour3dHimmelKompass.vue`, nede til høyre i
  nattmodus. To ringer i omriss — jordas plan med øst–vest-aksen, og en loddrett
  ring med N og S — pluss en rød prikk for blikket. Tre ting er verdt å vite:
  1. **Gizmo-kameraets azimut er 158° og ikke 180°.** Står det i nord–sør-planet,
     blir meridianringen EDGE-ON: en strek. Egen test holder det fast, så ingen
     «retter» det til 180.
  2. **Ringene står stille, prikken flytter seg.** N blir liggende samme sted på
     skjermen, så kompasset er noe man LESER framfor noe man må tolke. Snurret
     ringene i stedet, ville bokstavene vandret rundt i mørket.
  3. **Blikkretningen leses av KAMERAETS verdensmatrise** (`camera.getWorldDirection`
     i `scene3d.blikkNaa`), ikke av riggens vipp-tall. Det er den eneste kilden
     som er sann uansett hva riggen holder på med, og et kompass som viser noe
     annet enn det man ser er verre enn ingen. Emittes som `blikk` hver 120 ms,
     bare om natta.
  Rødt er ikke pynt: rødt lys ødelegger mørkeadaptasjonen minst, og det er den
  ene fargen som får lyse i nattmodus.
- **Infokortet i nattmodus kan MINIMERES, og et nabo-hopp minimerer det selv
  (v6.1.0).** Tilstanden eies av `Viewer3D` og ikke av kortet, fordi det er
  KALLEREN som vet hva som utløste valget: `velgHimmel` utvider (man har spurt hva
  noe er), `velgNabo` minimerer (man hopper for å SE, ikke for å lese videre).
  **`himmel-valgt`-handleren MÅ nullstille den også** (v6.1.1): den setter
  `valgtHimmel` direkte og går ikke gjennom `velgHimmel`, så uten det arvet et
  trykk på månen — eller et hvilket som helst himmellegeme — minimeringen fra
  forrige nabo-hopp, og kortet kom sammenlagt når man nettopp hadde spurt hva noe
  var.
  Minimert står navnet og retningen igjen som én linje — nok til å vite hva som er
  fremhevet — og BEGGE tilstandene har de samme TO ikonene i samme rekkefølge:
  minimer/utvid, lukk. Knappene skal ligge på samme sted enten kortet er
  sammenlagt eller åpent, så man ikke må lete etter dem på nytt.

  **ETHVERT VALG GIR SAMMENLAGT KORT (v6.3.11).** Søkelista, nabo-snarveiene og
  trykk i himmelen ender alle i pilla; kortet åpnes bare når brukeren trykker på
  den. Dette avløser TRE regler som alle prøvde å gjette om man ville lese eller
  se, ut fra hvordan valget kom inn: «første valg åpner» (v6.0.0), «et bytte
  beholder tilstanden» (v6.3.7) og «lista minimerer, trykket åpner» (v6.3.10).
  Sammenlagt som standard trenger ingen gjetning, og den er billig å angre.
  Tilstanden eies fortsatt av `Viewer3D` og ikke av kortet, og
  `himmel-valgt`-handleren MÅ sette den selv — den setter `valgtHimmel` direkte og
  går ikke gjennom `velgOgSe`, så uten det arver trykket tilstanden fra forrige
  valg (feilen i v6.1.1, den gang med motsatt fortegn).

  **«SETT I FOKUS» (krysshår) STÅR BARE I DEN MINIMERTE PILLA (v6.3.5).** Den
  retter blikket mot det som ALT er valgt, via `scene3d.fokuserHimmel` — som BARE
  flytter kameraet: `velgHimmel(samme)` ville også åpnet globen på nytt og skrevet
  fremhevingen om.

  Avgrensningen er presis og ikke en halv løsning. Med kortet sammenlagt og
  legemet tilbake i normal størrelse kan man PANORERE fritt, og da er krysshåret
  veien tilbake til det man så på. I det ÅPNE kortet har den ingen jobb: både et
  valg fra lista og et trykk i himmelen retter blikket dit selv, så der sto den
  bare og tok plass i en header man leser i mørket. Røyk-sjekken måler BEGGE sider
  — borte i åpent kort, til stede i pilla — fordi en knapp er lett å legge tilbake
  på feil sted i god tro.
- **ET TRYKK UT AV GLOBEN MINIMERER KORTET, det lukker det ikke (v6.3.5).**
  `handleTap` kalte `velgHimmel(null)` når globen sto åpen, og det nullstiller
  ALT — så infokortet forsvant i det man forlot nærbildet. Eieren meldte det som
  forvirrende, og det er riktig: man er fortsatt på Saturn, man har bare lagt kula
  tilbake på himmelen. Nå kalles `lukkGlobe()` og `globe-avsluttet` emittes, og
  Viewer3D legger kortet sammen.

  **EGEN HENDELSE OG IKKE `globe {apen:false}`, med vilje:** den siste fyres OGSÅ
  når man velger et legeme uten globe (Merkur, Venus) — og der har man nettopp
  spurt hva noe er, så kortet skal stå ÅPENT. To grunner til at globen lukkes er
  ikke samme grunn til at kortet skal legges sammen.
- **Utvikler-bryteren «Tvungne himmellegemer i 3D» løfter alle fire med globe
  (v6.1.0, utvidet i v6.3.1).** `lende-3d-himmel-tvang` i localStorage, satt i
  Utvikler-fanen, lest av Viewer3D som `tvingHimmel`. Månen er under horisonten
  store deler av døgnet, og Mars, Jupiter og Saturn store deler av året — da kan
  verken globene eller trykk-plukkingen prøves i det hele tatt.

  **TVANGEN BOR I ÉN KILDE PER LEGEMETYPE, og det er ikke en detalj:** månen i
  `astronomi.himmelFor`, planetene i `planeter.synligePlaneter`. Det er de ENE
  funksjonene både skivene (`skyDome`) og lista (`himmelObjekter`) bygges av.
  Tvang vi et legeme på to steder, ville søket tilbudt noe trykk ikke finner —
  samme lærdom som mosaikk-regelen over.

  **Porten for HVEM som løftes er `harGlobe`.** Merkur og Venus får ingen tvang:
  et legeme som dyttes opp på himmelen uten at man kan gjøre noe med det er en ren
  løgn om hva som står der, av samme grunn som at de ikke får trykk-ring. Og for
  planetene må BEGGE gatene vike — høyden OG `MIN_ELONGASJON`: en Jupiter i
  konjunksjon er like utestengt av nærheten til sola som av høyden, og en bryter
  som virker halve tida er verre enn ingen bryter.

  **Høydene er ulike med vilje** (`TVANG_HOYDER`: Mars 30°, Jupiter 40°, Saturn
  45°, pluss månens `MANE_TVANG_HOYDE` 35°): to tvungne legemer med nesten samme
  azimut ville landet oppå hverandre og vært umulige å skille med en finger, og
  hele poenget er å kunne trykke på dem. Alt annet er ekte — azimut, fase,
  lysside, avstand, lysstyrke — og et legeme som alt står høyere enn sin verdi
  røres ikke. `settTvingHimmel` finnes som runtime-setter for konsoll og test, men
  appen leser flagget ved MONTERING (som vær-demoen) og setteren oppdaterer ikke
  søkelista.
- **Nattmodus' tekst følger hovedmenyens 100/125/150/200-valg (v6.1.0).** Resten av
  3D-overlegget er rem-basert (v5.27.0, som følger SYSTEMETS tekstskalering);
  nattmodus' søkefelt og infokort får i tillegg `zoom: uiTextScale`, fordi det er
  den ENESTE teksten man faktisk leser i 3D. Knappene skalerer bevisst ikke —
  de er 44 px fordi en finger er det.
- **3D dekker HELE arket, ikke aktiv flis (v5.18.0).** `use3dEntry` regner
  utsnittet av mosaikk-kanten (`extendZonesBounds`) ∪ rutas bbox
  (`tourExtent.computeExtent`), henter DEM for hele utsnittet og forskyver ALT
  som sendes inn — rute, via, søkeindeks, stinett, barrierer, brukerminner. Legger
  du en ny datakilde inn i 3D, må den forskyves også. Kostnaden er
  tekstur-oppløsning: lerretet er 4096² uansett hvor stort arket er, så et
  3×3-ark får kartbildet i en tredjedel av detaljen per meter. Vertekstallet er
  derimot konstant (`terrainGrid.MAX_GRID_DIM` = 512), og mosaikken tegner maks 12
  nabofliser — så GPU-siden skalerer ikke med flisetallet.
- **Teksturen rasteriseres ÉN FLIS OM GANGEN (v5.18.1).** `mapSvgTilesFor3d`
  (useKartEksport) deler arket i fliser med hver sin rute; `mapTexture` dekoder
  hver for seg og tegner dem inn i lerretet. Ett samlet SVG for hele arket brakk
  ved ni fliser — bildet lastet ikke, og terrenget fikk gråtone-fallbacken.
  Naboflisene har ikke eget stilark (useGhostTiles fjerner det), så løsrevne
  fliser MÅ få aktiv flis' `<style>` + `#ghost-isom-style` med seg, ellers
  rendres de svarte. Alt relieff strippes ut av flisene og bakes fra utsnittets
  DEM — én sømløs belysning, og megabyte med base64 mindre å dekode.
- **Stinett-lesing finnes i tre varianter** med ulikt formål og det er med
  vilje: `stinettAnalyse.stinettFeaturesFromSvgEl` (nettleser, DOM),
  `mcp/headless.graphInputFromSvg` (node, streng), `useStifinner.featuresFromSvg`
  (nettleser + spøkelsesfliser). Endrer du kodesett i én, sjekk de to andre.
  **Flis-offsetet er derimot delt fra v5.18.0** — `lib/svgNestedOffset.js`. Det
  lå i tre nesten like kopier, to av dem manglet det, og resultatet var
  naboflisenes geometri limt oppå aktiv flis forskjøvet med hele flisebredder
  (Stifinneren ruter over Gjende; 3D tegner stier over vann). Leser du geometri
  ut av en LIVE kart-SVG, bruk den fila.
- **«Hva er arket mitt?» besvares to steder, og de MÅ svare likt (v5.19.9).**
  Kartflaten bruker `useGhostTiles` (`GHOST_RENDER_RADIUS_TILES` = 3,
  `MAX_GHOST_NODER` = 12, `utmBbox` + `tilesAreGridCompatible`). Lende-chatten
  bruker `velgMosaikkFliser` i `lendeAiTools.js` (`MOSAIKK_RADIUS_FLISER`,
  `MOSAIKK_MAKS_NABOER`). Chatten hadde en helt annen regel — WGS84-bbox innen
  0,3 km, altså bare fliser som RØRTE den aktive — og da svarte den «fant ingen
  treff i dette kartet» på et navn søkefeltet listet med merkelappen «i
  naboflis». Endrer du rekkevidden i den ene, endre den i den andre. Ikke lag en
  tredje regel: begge dør på at brukeren opplever mosaikken som ETT kart.
- **`RUTE_GRAF_OPTS` i `routing.js` er én kilde til sannhet** for grafen. Bygger
  du en graf et nytt sted, spre den inn — ellers svarer diagnosen (`stinettBrudd`)
  på et annet nett enn ruteren bruker.
- **Workerne kjører `src/lib` og `mcp/headless.js` i workerd, ikke i Node.**
  `cloudflare/mcp-worker` bundler inn begge. Der er `import.meta.url` UNDEFINED,
  det finnes ikke noe filsystem, og alt som kjøres på MODULNIVÅ kjøres i det
  Workeren starter. `mcp/headless.js` regnet ut en katalogsti med
  `fileURLToPath(import.meta.url)` som en toppnivå-konstant, og fra v5.0.16 til
  v5.18.2 feilet HVER ENESTE deploy av MCP-Workeren på det — mens alle
  PR-sjekker sto grønne, fordi feilen først skjer etter merge. Regel: node-ting
  (`node:fs`, `node:path`, `import.meta.url`) skal være LAZY og guardet i alt
  som bundles inn i en Worker. Gaten er `npm run boot:workers`
  (`.github/workflows/worker-boot.yml`), som faktisk starter dem — verken
  `npm run build`, `wrangler deploy --dry-run` eller `wrangler check startup`
  fanger det (den siste returnerer 0 selv når Workeren kaster).
- **`mcp:protokoll`s beredskaps-gate krever 2xx. `boot:workers`s gjør det IKKE,
  og det er med vilje (v6.3.6).** Forskjellen er hele poenget, og jeg tok feil om
  den én gang — les begge før du rører noen av dem.

  `mcp-protokoll.mjs` hadde `if (h.status) return`, og `status: 0` betyr «ingen
  forbindelse» — så gaten slapp gjennom i det porten svarte HVA SOM HELST. På en
  kald GitHub-runner svarer workerd før rutene er montert, altså 404, og
  `initialize` fikk 404 rett etterpå: 1,5 sekunder fra start til rødt, mens tre
  kjøringer på rad lokalt gikk grønt. Det var den falske røden som gjorde
  PR-kjøringer upålitelige. Den spør BARE lende-mcp, som HAR `/health` og svarer
  200 med `{"ok":true,…}` — så et 2xx-krav er riktig der. Verifisert i begge
  retninger: grønn på riktig kode, rød med lesbar melding når `/health` peker på
  en rute som gir 404.

  **`worker-boot.mjs` SKAL godta enhver status, og det står i filhodet:** den
  sjekker «svarer runtimen?», ikke «finnes ruta?». `lende-proxy` returnerer 404 på
  alt annet enn sine egne ruter — med vilje, den skal ikke være en åpen proxy — og
  et 2xx-krav gjør den EVIG RØD uten at noe er galt. Jeg strammet den likevel inn
  i første utgave av denne fiksen, uten å lese de 27 linjene rett over koden, og
  CI svarte umiddelbart med «GET /health 404» i loop og én Worker rød. Et 404-svar
  fra workerd BEVISER dessuten at modulen lastet og kjørte — hadde den kastet på
  modulnivå, ville wrangler gitt 500 og logget unntaket, som er nøyaktig feilen
  jobben ble laget for (v5.0.16). Gaten er altså løs FORDI den er riktig løs.
- **`boot:workers` er IKKE nok for MCP-verktøyene (v5.22.3).** Den spør
  `/health`. Verktøyenes zod-skjemaer serialiseres først i `tools/list` og brukes
  til validering først i `tools/call`, så Workeren kan starte helt fint og likevel
  levere verktøy ingen klient kan bruke. `npm run mcp:protokoll` kjører den stien
  i workerd og går i samme jobb som boot. Rører du et verktøys skjema, MCP-SDK-en
  eller `agents`, er det den gaten som svarer. Den er verifisert i BEGGE
  retninger — grønn på riktig kode, rød på en ødelagt handler-import — for en
  sjekk som ikke kan feile er verre enn ingen sjekk.
- **`agents`-handleren: vi kaller `createLegacyMcpHandler`, ikke
  `createMcpHandler` (v5.22.3).** Fra agents 0.21 er sistnevnte overlastet: en
  SDK v1-server gir den sessionful legacy-stien (deprecated), en SDK v2-fabrikk
  gir den stateless. Vi bruker v1-serveren, så vi navngir stien framfor å la
  overlast-oppløsningen bestemme. Merk at «tilstandsfri» i våre kommentarer
  handler om at kart-tilstanden bor i R2, ikke om transporten. Skal noen gå til
  SDK v2-fabrikken: det rører hvordan hvert enkelt verktøy registreres, ikke bare
  kallstedet — og `mcp:protokoll` er gaten som vil si om det gikk bra.

## Viktig arkitektur-merknad — høydedata for Svalbard er UNDERSØKT, ikke bygget

Ønsket kom opp i august 2026, ble MÅLT, og så lagt dødt av eieren. Seksjonen
finnes for at neste runde skal starte der denne sluttet og ikke på nytt.
Målingen står i `scripts/probe-svalbard-dem.mjs` (`npm run probe:svalbard`,
workflow `probe-svalbard-dem.yml`) — kjør den før du stoler på tallene her, for
katalogen kan ha endret seg.

**Hovedfunnet: det finnes INGEN WCS for Svalbards høydedata.** Geonorge har
datasettene, men alle som `GEONORGE:DOWNLOAD` — «Svalbard DTM 5»
(`010bfb4a-65aa-4d30-aba9-7d090a432df7`), «DTM 20»
(`9d118d31-182c-495b-b7be-d819cc7444b1`), «DTM 50»
(`3a83e0a7-113e-4850-8fed-1646838acb02`) og «Høydereferansemodell på Svalbard»
(`c551feb6-d833-4ba8-96bf-9566ed1c6548`). `demFetcher.js` kan derfor ikke få en
fjerde linje i `WCS_ENDPOINTS`: dette er en BAKE, som N50-flisene, ikke et
endepunkt. Mekanismen finnes allerede i `scripts/geonorgeN50.mjs` (capabilities
→ area/format/projection → direkte fil-URL, og `velgFormat` foretrekker alt
25833); det N50-spesifikke er tittelen, filnavnmønsteret og at nedlastingen er
FGDB-vektor der en DTM er GeoTIFF-raster.

Målte negativer, så ingen prøver dem igjen: NHM 25832/25833 svarer på
GetCapabilities, men GetCoverage over Longyearbyen gir `ServiceExceptionReport`
— Kartverkets fastlands-DTM dekker ikke Svalbard. Navnene `wcs.hoyde-dtm-svalbard`,
`wcs.hoyde-dtm20-svalbard`, `wcs.dtm-svalbard` og `wcs.hoyde-svalbard` finnes
ikke (200 med «UKJENT APPLIKASJON» i kroppen). NPIs `NP_S0_DTM20`/`DTM5`
WCSServer gir HTTP 400. NPIs ArcGIS har bare ferdigtegnede raster-produkter
(`NP_TerrengFjellskygge`, `NP_TerrengHelning`, `NP_TerrengKurvePunkt`), alle i
`Basisdata_Intern` — ingen høydeverdier.

**Terrarium over Svalbard er BEDRE enn antatt, og det var en overraskelse.**
Antakelsen var GMTED2010 (~230 m). Variogrammet sier noe annet: stigning 0,53
ved 16 m og 0,56 ved 4 m, altså ekte fraktalt terreng ned til minste piksel
uten interpolasjonsknekk noe sted. Web Mercator-piksler krymper med cos(lat),
så z14 er 2,0 m/px på 78°N mot 9,6 m ved ekvator. Den er dermed en reell
kandidat og ikke bare en nødløsning — og den avgjørende målingen før noen baker
noe er å sample Terrarium og DTM 20 over de SAMME punktene.

**UTM32 er ikke sperren, og det var også en overraskelse.** Målt med
prosjektets egen `utm.js`: 0,31 % skalafeil og 6,5° meridiankonvergens ved
Longyearbyen, 0,29 %/2,9° i Ny-Ålesund — på linje med det Øst-Finnmark allerede
lever med. De 35 ikke-test-kallstedene til `wgs84ToUtm32` trenger IKKE røres for
et brukbart ark over Spitsbergen. Øst for Edgeøya (0,37 %/11,6°) og på Kvitøya
(0,52 %/23,3°) slutter det å være forsvarlig.

**Proben fant også en død fallback, og den er FJERNET (v6.5.11).**
`hoyde_dom10_33` — appens tredje DEM-endepunkt, DOM 10 m som siste utvei —
svarer «UKJENT APPLIKASJON». Den lå serielt ETTER de to DTM-ene, så hvert
kart-bygg der begge feilet betalte en ekstra round-trip og et 15 s klient-tak
på nøyaktig den stien der brukeren allerede venter lengst. Testen i
`demFetcher.timeout.test.js` holder den nede, og den er verifisert i begge
retninger. Lærdommen for lista i `WCS_ENDPOINTS`: **et endepunkt er ikke sant
fordi det var sant en gang** — legges eller trimmes noe der, mål først.

**ÉN TING STÅR ÅPEN, og den er et bevisst utsatt valg:** over Svalbard
fabrikkerer pipelinen i stillhet. WCS feiler → `buildSyntheticDEM` → og
`maybeFillFromTerrarium` hopper eksplisitt over kilder som starter med
«synthetic». Resultatet er ikke en feilmelding, men et kart som ser ekte ut og
er oppdiktet. To veier ble skissert — la pipelinen NEKTE utenfor dekning, eller
la Terrarium bli primærkilde når WCS feiler — og eieren valgte i august 2026 å
la begge ligge framfor å endre kjernen på samme PR som en sletting. Terrarium-
veien er den målingene peker mot, men den gjør DEM-et «ekte» for `isRealDem`,
`demTileCache` og `seaFromDem`, altså en reell atferdsendring og ikke en
opprydning.

Og for helhetens skyld: DEM løser bare halve arket. N50-flisene (sti og areal)
er per fylke på fastlandet, ~60 % av Svalbard er isbre (kode 410, som bor i
nettopp den baken), og Turkart-temaets «hevd skog i bakgrunnen» er gal over hele
øygruppa.

## Fasit-suiten — kart-pipelinen mot ekte data

`node scripts/fasit-kart.js` bygger seks ekte kart og sjekker invarianter +
avvik mot `scripts/fasit/baseline.json`. Krever nett; kjører i CI
(`.github/workflows/fasit-kart.yml`), ikke i `npm run test`.

Stedene er valgt etter FEILKLASSE, ikke geografi: Vardåsen (referanse),
Kolstadøya (øyer = hull i vann), Strykenåsen (brutt stinett, elv, hovedvei),
Gjende (stor innsjø, DEM-nedskalering), Henningsvær (skjærgård/kystlinje),
Rondvassbu (høyfjell uten vegetasjon). Selve sjekkene bor i
`src/lib/kartFasit.js` og er enhetstestet offline — en sjekk som ikke virker
er verre enn ingen sjekk.

**Endrer du pipelinen og tallene flytter seg: LES DIFFEN før du kjører
`--oppdater`.** Fasiten er ikke noe som skal gjøres grønn; den er spørsmålet
«mente du dette?».

**Og `--oppdater` skal kjøres i CI, ikke lokalt (v5.18.3).** Den er bare korrekt
der ALLE kildene svarer. Herfra gir NVE 403, og en lokal `--oppdater` ville
skrevet en degradert pipelines tall inn som sannhet — stikk motsatt av hensikten.
Kjør fasit-workflowen med `oppdater`-haken i stedet; den commiter baselinen.
Nettopp dette skjedde: baselinen ble en gang tatt opp under NVE-nedetid, og da
NVE kom tilbake så det ut som en regresjon i seks kart.

Konsekvensen går også andre veien: baselinen beskriver pipelinen med ALLE kilder,
så `node scripts/fasit-kart.js` på en maskin der en kilde er blokkert vil vise
avvik i vann-tallene. Det er ikke en regresjon — sjekk loggen for
«NVE-innsjøer utilgjengelig» før du feilsøker noe annet. Advarsler (⚠) er datakvalitet i kildene — f.eks. en
Strava-sporet isrute over Rondvatnet — og feiler ikke bygget.

## Zoom-trappet detalj-LOD

`.zoomed-in`/`.zoom-near`-klasser settes av MapView (`applyZoomTierClasses`);
symbolizer-CSS gater lag mot disse VED BYGGING. Terskler + navnebudsjett er
RUNTIME (`src/lib/useLodTuning.js`, Utvikler-fanen, localStorage). Å flytte
et lag mellom trinn krever kode-endring + nybygd kart.

## Kjente issues

- WFS-kilder (Sjøkart/N50) leverer ikke alltid i nettleser (CORS) — graceful
  fallback finnes; CI har full nettverkstilgang.
- Diagnose-modus i drawer («Visning») farger polygoner etter kilde.

## Avhengigheter og vedlikehold

**`npm run vedlikehold` er inngangen.** Den kjører `npm audit` + `npm outdated` i
alle fire katalogene og sorterer etter FLATE, ikke alvorsgrad: nettleser-bunten
først, så det som er deployet, så dev-bare. Grunnen er at et `npm audit` fra rota
svarer på et annet spørsmål enn du tror — rot-treet er appen og verktøykjeden,
mens de tre Workerne har hver sin `package.json` som deployes for seg og kan ha
andre versjoner av samme pakke. I august 2026 sto `@modelcontextprotocol/sdk` på
1.29 i rot (dev-bare, uten betydning) og på 1.23 nestet inne i `agents` i den
DEPLOYEDE MCP-Workeren. En «high» i wrangler er dev-bare; en «moderate» i noe
brukerne laster ned er ikke.

**Rapporten har et tredje steg som stiller et ANNET spørsmål (v6.5.38).** Audit
og outdated spør «er denne katalogen i orden?»; versjonsdriften nederst spør
«svarer de fire katalogene likt om samme pakke?». Det siste kan Dependabot per
konstruksjon ikke svare på — den ser hver katalog for seg, og det var nettopp
slik `@modelcontextprotocol/sdk`-avviket over fikk stå. Regelen bor i
`scripts/versjonsdrift.mjs` (ren, enhetstestet, ingen fs og ingen nett).
**Deklarert og låst sammenliknes ALDRI mot hverandre:** `^4.0.0` og `4.125.3` er
ikke et avvik, de er to ulike spørsmål, og en katalog uten lockfile bidrar bare
til den deklarerte lista. Navnet leses etter SISTE `node_modules/` i stien, så
den nestede kopien er nettopp den som telles.

**Rot-lockfila har fem noder med FEIL `version`-felt, og det er ikke rettet.**
`ajv-formats`, `eventsource`, `mime-types`, `raw-body` og `shebang-regex` står
alle med appens egen versjon fra den gang (`3.0.17`) i stedet for pakkas — en
global søk-og-erstatt under en versjons-bump som er dratt videre én patch om
gangen siden. Installasjonen er likevel riktig, for npm installerer fra
`resolved` + `integrity`; det er `audit`, `outdated` og dedupe som leser
`version`, og det er trolig kilden til de sporadiske 400-ene («Invalid package
tree») fra audit-endepunktet. `npm install --package-lock-only` retter det IKKE
(målt: 13 av 348 noder før og etter) — det krever `rm package-lock.json &&
npm install`, altså en egen, bevisst PR.

**Dependabot-PR-er tas inn SELV, ikke merget rått (v5.22.4).** To grunner, og
begge er konkrete: (1) roboten bumper ikke appens egen versjon, og uten en ny
`CACHE_VERSION` i `public/sw.js` sitter mobil-klienten på gamle assets etter en
vite/vue-bump; (2) den re-serialiserer `package.json` og escaper æ/ø/å til
`\u00f8`. Framgangsmåten som virker: ny gren fra fersk master, `npm install
<pakke>@<versjon>` for det robotens gren foreslår, versjons-bump, og lukk
Dependabot-PR-ene som «superseded». Da ser roboten kravet som oppfylt.

**Dependabot** (`.github/dependabot.yml`) kjører ukentlig over de fire
katalogene + GitHub Actions. Patch og minor er GRUPPERT til én PR per katalog;
major står alene, fordi det er de som trenger en ekte gjennomgang. Merk semver-
fella for `0.x`-pakker: der er MINOR-feltet det brytende. `agents` 0.2 → 0.21 er
et API-brudd, og `vedlikehold.mjs` har en egen `erBrytende()` nettopp fordi en
naiv major-sammenlikning leste begge som «0» og la det i samle-PR-en med fontene.

**CI har to steg, og de er ulike med vilje:**
`npm run vedlikehold` rapporterer og feiler ALDRI — samme prinsipp som
tredjeparts-røyktestene i `deploy-proxy.yml`; en PR om skyene skal ikke blokkeres
av at wrangler fikk en rådgivning i natt, og en gate som feiler på ting utenfor
PR-ens kontroll blir skrudd av innen en måned. `npm audit --omit=dev
--audit-level=high` feiler DERIMOT: det er kode vi sender til nettleseren.
`--omit=dev` er hele skillet — merk at det slipper gjennom `postcss`/`nanoid`,
som npm regner som runtime via `@vue/compiler-sfc` selv om de bare kjører i
bygget.

**`npm audit fix` uten `--force` er trygt i rot-treet, men les diffen i Workerne.**
Der foreslo den `miniflare` 5.x-**alpha** og fjerning av
`@cloudflare/workers-types` for å lukke to dev-bare funn. Sjekk hva som faktisk
flyttet seg før du commiter — og kjør `npm run boot:workers`, som er den eneste
gaten som faktisk starter dem.

## Deploy

- GitHub Pages: https://gitjanerik.github.io/lende/ — `base: '/lende/'`.
- **Push til master = deploy.** `.github/workflows/build-vardasen-map.yml`
  bygger Vardåsen-demokartet fra ekte Kartverket WCS, kjører `npm run build`
  og pusher `dist/` til `gh-pages` via git worktree. Ikke deploy manuelt.
- `build-redlist.yml` regenererer `public/data/redlist-no.json` fra GBIF ved
  endring i script/CSV.
- **Proxy-Worker** (`cloudflare/proxy/`, deployes som `lende-proxy`): én
  frittstående Cloudflare Worker med tre ruter, valgt på path.
  `/api/v1/Stations|Observations` → NVE HydAPI, med nøkkelen som Cloudflare-secret
  (`NVE_HYDAPI_KEY`) — aldri i bundelen. `/brukerminner/*` → Kulturminnesøk
  (`api.ra.no`), som ikke trenger nøkkel men gikk hit for CORS + døgn-cache etter
  at klient-side-hentingen feilet (v4.8.7). Alt annet gir 404 — ingen åpen proxy.
  `/vaer/locationforecast/2.0/compact` → MET Norway (`api.met.no`), som heller
  ikke trenger nøkkel — men som KREVER en identifiserende `User-Agent`, og
  `User-Agent` er en forbudt header i nettleserens `fetch()`. Et direkte
  klient-kall kan derfor ikke oppfylle METs vilkår uansett hvor snill CORS-en
  deres er; det er hele grunnen til at værvarselet går gjennom Workeren og ikke
  rett fra appen. Ruta runder `lat`/`lon` til METs maks 4 desimaler og cacher i
  inntil 30 min. **`api.met.no` er blokkert fra utviklings-sandkassene**, så ruta
  kan bare prøves i CI — røyktesten i `deploy-proxy.yml` er den eneste som ser
  en 403 fra MET, og en 403 betyr nesten alltid vår egen `User-Agent`.
  Klientene peker hit via standard-URL i `nveHydApi.js`, `kulturminneFetcher.js`
  og `vaerFetcher.js` (overstyrbare med `VITE_NVE_HYDAPI_URL` /
  `VITE_KULTURMINNE_URL` / `VITE_MET_URL`).
  Deployes separat fra GitHub Pages; se `cloudflare/proxy/README.md`.
  Het `lende-nve-proxy` fram til v4.8.7 — eldre CHANGELOG-poster bruker det navnet.

## Konvensjoner

- **Norsk UI-tekst (bokmål)** med ekte æ/ø/å.
- Tailwind CSS 4 (`@import "tailwindcss"`, ingen config-fil).
- Tester ligger ved siden av kildekoden (`*.test.js`).
- `polygon-clipping` er eneste 3.-parts geometri-bibliotek.

## Versjonshåndtering — PR-per-endring, alltid bump

1. Hver endring brukeren skal teste → **ny PR fra fresh `origin/master`**.
2. Hver PR → bump versjon i fire filer som må matche:
   - `package.json` (`"version"`)
   - `package-lock.json` (`"version"` to steder) — ellers re-synker
     `npm install` den ved neste sesjon og lager en evig 2-linjers diff
   - `src/version.js` (`APP_VERSION`)
   - `public/sw.js` (`CACHE_VERSION`) — kritisk for at mobil-klienten henter
     ferske assets etter deploy
3. **Hver versjons-bump → ny post øverst i `CHANGELOG.md`.** Format:
   `## <YYYY-MM-DD> — v<versjon>: <kort tittel>`, ett forklarende avsnitt
   (bokmål), så `---`. Håndheves av `.claude/hooks/pre-commit-changelog.sh`.
4. Patch-bump (1.0.x) som default; brukeren sier fra ved minor/major.
5. Aldri gjenbruk en branch som allerede er merget.
6. **ÉN COMMIT OG ÉN PR PER LEVERANSE — minst mulig fuzz.** Regelen her sa en
   periode det motsatte («flere commits per PR»), og eieren strøk den: det er
   PR-en som er lese-enheten, og en oppdeling i fem commits gir fem ting å bla
   gjennom uten at noen av dem kan slippes ut for seg. Samle endringen i én
   commit, med versjons-bump og CHANGELOG i den samme. Flere commits er greit
   når en PR faktisk bærer to uavhengige ting som må kunne reverteres hver for
   seg — men da er spørsmålet først om det egentlig er to PR-er.

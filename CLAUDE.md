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
npm run navnediff  # Hva forsvant ut av MapView i denne endringen — og hvem overtok
npm run frie -- <fil>  # Refererer en fersk composable noe den ikke har fått inn?
npm run boot:workers   # Starter Cloudflare-Workerne i workerd. Rører du src/lib
                       # eller mcp/headless.js, kjør denne — se «Workerne» under.
```

## Arkitektur (oversikt)

- **Kart-pipelinen orkestreres fra `src/lib/createMapFlow.js`** —
  `buildMapFromCenter()` kjører Overpass + N50 + DEM parallelt, gater
  Sjøkart-WFS på DEM-resultat, og kaller `buildSvg` (`src/lib/mapBuilder.js`).
  Endringer i hvordan kartet bygges skal komme her.
- **Symbolisering**: datadrevet ISOM-katalog (`src/lib/isomCatalog.json`) via
  `src/lib/symbolizer.js`. All SVG-CSS scopes til `.isom-map`.
- **Terreng**: `demFetcher.js` (Kartverket WCS, multi-endpoint, CORS-trygg),
  `dem.js` (konturer/stup via d3-contour + Chaikin + DP), `canopyHeight.js`
  (CHM = DOM − DTM → vegetasjonsklassifisering ISOM 405–408),
  `seaFromDem.js`/`marineTopology.js` (autoritativ kystlinje).
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
- **SKYENE I 3D ER RULLET TILBAKE, OG SKAL IKKE «FIKSES» PÅ NYTT UTEN EN MÅLING
  FRA ENHETEN (v5.21.4).** Eieren rapporterte at skyene så kuttet ut på telefonen.
  Over tre runder (v5.20.2 → v5.21.3) ble det gjort åtte endringer i
  `skyDome.js` for å rette det: radius-klipping, høyere lerret, alfa-vignett,
  `fog: false`, materiale pr sprite, `alphaTest`, større felt, nær-kamera-demping.
  Ingen av dem kunne verifiseres — artefakten finnes BARE på den telefonens GPU,
  og aldri på skrivebordet eller i CI. Resultatet ble harde hvite firkanter,
  altså klart dårligere enn utgangspunktet, og alt er nå rullet tilbake til
  koden fra før v5.20.2 (pluss `setVaer`, som værmodus trenger).
  **Regelen som følger av dette:** en visuell feil som bare finnes på én enhet
  kan ikke rettes ved å endre kode og spørre om det ble bedre. Hver runde er et
  gjett, og gjett akkumulerer. Tas det opp igjen, må det starte med en MÅLING fra
  enheten — WebGL-capability-dump (webgl1 vs webgl2, NPOT-håndtering, maks
  tekstur) og gjerne en `readPixels`-prøve — ikke med en ny kodeendring.
- **Værhimmelen er en OPSJON, ikke et lag ved siden av (v5.21.1).** `setVaer(preg)`
  på `sceneCore` justerer skyene som alt finnes (antall synlige sprites, farge,
  vinddrift) og skrur på ett `Points`-objekt for nedbør. `setVaer(null)` skal gi
  nøyaktig standard-himmelen igjen — værmodus av etterlater ingen spor. Selve
  oversettelsen fra METs `symbol_code` til preg bor i `lib/tour3d/vaerHimmel.js`,
  som er REN og enhetstestet: rekkefølgen på regex-ene der bestemmer hvilken
  familie som vinner, og en regel plassert for høyt stjeler treff fra dem under.
  Takene (`SKY_OPASITET_TAK`, `NEDBOR_TAK`) er lesbarhet, ikke smak — 3D har
  ingen adaptiv kvalitets-nedtrapping å skru ned senere.
- **Sol/måne-knappen i 3D har FIRE steg** (dag → dag+vær → natt → natt+vær), ikke
  to. Egen vær-knapp ble vurdert og forkastet: topprada har alt fem-seks knapper,
  og kommentaren over den i `Viewer3D.vue` forteller hva som skjedde sist den
  vokste. Vær-biten persisteres (`lende-3d-vaer`); dag/natt-biten gjør det
  bevisst IKKE — den avledes av kart-temaet, så 3D følger lys/mørk-valget i
  kartet. Værvarselet hentes ÉN gang per ark, for senterpunktet — ikke per
  kamerabevegelse. Det er hele debouncingen.
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

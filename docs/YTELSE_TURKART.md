# Turkart-ytelse — analyse og arbeidsordre

> **Til neste Claude Code-sesjon: les dette først.** Fila er overlevering fra
> analysesesjonen 2026-09-11/12 (gren `claude/turkart-performance-optimization-bgny68`,
> basert på 786dad63 = v7.7.12). Analysen under er ferdig og etterprøvd; det som
> står igjen er implementasjonen. Fila ble committet alene, uten versjons-bump,
> for å overleve sesjonsbyttet — la den bli med i PR-en.

## Eierens beslutninger

1. **Død kode skal bort** — hele seksjon E under.
2. **Sovende kode for ekvidistanse < 5 m skal bort** — alle grener som krever
   `equidistanceM <= 5`, `contourIntervalM === 5` eller DEM ≤ 3,5 m. Gyldige
   ekvidistanser er 10/20/25/50 (`equidistanceRules.js`), Fritt lende er 10, MCP
   håndhever minimum. Eldre lagrede kart kan ha 5 m i `meta.equidistance`; klem
   dem til minst 10 der de leses inn i et nytt bygg (`useMapExtend.js:684`,
   `equidistanceM: m.equidistance ?? 20`), så ingen gren trengs.
3. **Optimaliseringer: «Rekkefølge jeg ville tatt» punkt 1–6**, altså tiltak
   1, 2, 17, 16, 3, 10, 11, 14, 4, 5, 6 og 7.
4. **Rekkefølge-punkt 7 (tiltak 21, rasterisert bakgrunn) er FORKASTET.**
   Turkartet er ren SVG, «genetisk» og med vilje: Lende skal ikke være som andre
   kartapper. De eneste raster-unntakene er de som alt finnes — det røde
   crosshair-ikonet ved lang-trykk og det mjuke relieffet (hillshade). Ikke
   foreslå hybrid igjen.
5. Fritt lende vurderes fjernet SENERE, hvis 1–6 gir det eieren håper. Ikke rør
   modusen i denne leveransen.

## Leveranseform

To commits på grenen, hver med patch-bump i fire filer (`package.json`,
`package-lock.json` ×2, `src/version.js`, `public/sw.js` CACHE_VERSION) og ny
post øverst i `CHANGELOG.md` (hooken blokkerer commit uten):

1. **Rydding** (v7.7.13): seksjon E + sovende kode. Ingenting her ligger på
   kritisk sti, men det står i veien for å lese pipelinen. Egen commit så den
   kan bli stående om optimaliseringen må reverteres.
2. **Optimalisering** (v7.7.14): punktene under i rekkefølgen de står.

Gater før push: `npm run test`, `npm run build`, `npm run royk` (Chromium mot
`/kart/vardasen`; Vardåsen-kartet caches i CI, bygges lokalt hvis nett), og
`npm run navnediff -- --ok navn1,navn2` bare hvis top-level-navn forsvinner fra
`MapView.vue`. `npm run frie -- <fil>` for hver ny composable. Fasit
(`scripts/fasit-kart.js`) kjøres i CI, ikke lokalt (NVE gir 403 herfra).
Ikke lag PR uten at eieren ber om det.

## Implementasjonsnotater per punkt (fil:linje mot v7.7.12)

**Rydding (E + sovende).** Sjekk kallere med grep før hver sletting, og slett
tilhørende tester. Kjente feller: `computeTPI` (`dem.js:395`) brukes av
`detectKnauser` (`dem.js:418`) — sjekk om noe annet bruker den før begge går.
`smoothGridGaussian` (`dem.js:116`) er bare konturglattingen (`mapBuilder.js:1175`).
`demProbeOpplosning` (`createMapFlow.js:178`) skal BEHOLDE `overstyring`-stien —
Fritt lende sender `DEM_OPPLOSNING_M` — men 10 m-grenen for `equidistanceM <= 5`
går. `scripts/build-vardasen-stub.js` slettes sammen med `knownArea`/`KNOWN_AREAS`/
`useReal: false` i `demFetcher.js`; `buildSyntheticDEM`-fallbacken ved WCS-feil
skal STÅ (den er en annen sti). `fetchDEM`-importen i `createMapFlow.js` blir død
når `DEM_TILE_CACHE_ENABLED`-grenen går. `n50ArealStatus` fjernes fra
`buildSvgClient`-opsjonene (L745) — `mapBuilder` leser den aldri. Aldri-varierte
`buildSvg`-opsjoner (`includeCliffs`, `includeKnauser`, `includeBuildingMass`,
`skipContoursIfSynthetic`) fjernes med grenene sine; sjekk `mcp/headless.js` og
`scripts/build-vardasen-svg.js`, som også kaller `buildSvg`.

**Tiltak 1 + 2 — preview fra probe-DEM, kystprobe ved t = 0.** Terreng-først
(`createMapFlow.js:772–814`) skal `await probeDemPromise` (L401), ikke
`demCorePromise` (L777). `coastalPromise` (L484–489) skal starte
`probeCoastline(bbox)` med en gang og bare bruke `hasNearSeaLevelPixels(probeDem)`
som et kortslutnings-nei; Sjøkart (L584) gates fortsatt på den. Behold
`skipDemSea: true` i previewen. Invariant for Fritt lende: det gamle arket
slettes aldri før det nye er bygget (`saveMap` er en put).

**Tiltak 17 — forhåndslast MapView-chunken.** `router.js:15` lazy-importerer
`MapView.vue` først ved `router.push`. Fyr `import('./views/MapView.vue')` når
byggingen starter (i `buildMapFromCenter` eller i `MapPickerContent.vue:368`).
Én linje; ikke gjør den til en composable.

**Tiltak 16 — entryen i minne.** `buildMapFromCenter` returnerer `entry`;
pickeren kaster den (`MapPickerContent.vue:368–380`), MapView leser IDB
(`useMapLoadPipeline.js:176` `loadStoredMap`) og parser (L208). Finalize
returnerer `fullEntry`, men `consumeTerrainFinalize` (L399–411) kaster den og
kaller `loadMap({ silent: true })`, som leser IDB igjen. Legg et register ved
siden av `mapFinalizers`/`consumeMapFinalize` (modul-Map i `createMapFlow.js`)
som leverer entryen én gang til `loadMap`, og la finalize rendre `fullEntry`
direkte. IDB-skrivingen skjer fortsatt, men utenfor visningsstien. Merk at
`loadMap` også brukes ved vanlig gjenåpning — registeret er en snarvei, ikke en
erstatning.

**Tiltak 3 — sekundære kilder av kritisk sti.** `assembleAndBuildFull`
(L668–766) venter på ni kilder i én `Promise.all`. Kulturminner, Turrutebasen,
N50-sti/-areal og Sjøkart skal få et budsjett (3–5 s etter at Overpass + DEM er
inne) eller et tredje pass gjennom `mapFinalizers`. Vann-reglene i
`vannMerge.js` og areal-reglene i `arealMerge.js` er delt med `mcp/headless.js`
og skal ikke endres. Kommentaren på L457 («default-AV lag») er feil — alle lag
unntatt lysløype er PÅ (`mapLayerCatalog.js:88`).

**Tiltak 10 + 11 + 14 — én worker, konturer én gang, ingen kopier.**
`buildSvgClient.js:26–77` starter én worker per kall og klone-sender elements +
DEM; terreng-først kjører derfor konturer, stup, topper og sjø to ganger. Én
langlivet worker per `buildMapFromCenter` som holder DEM-et og gjenbruker
kontur-resultatet når DEM-et er uendret (ingen Terrarium-fyll, L581). `buildEntry`
(L620–665) kjører `downsampleDem(dem, 10)` + `packDem` + `findHighestPoint` på
hovedtråden, to ganger — inn i workeren. I `dem.js`: `fillNoData` (L68) lager
alltid en `Float32Array.from`-kopi, og `buildContours` (L281) kopierer rutenettet
til et vanlig Array med begrunnelsen «d3-contour krever Array» — det gjør den
ikke. Målt i Node på syntetisk DEM: 200–850 ms per pass på store rutenett.
`mcp/headless.js` kaller `buildSvg` direkte uten worker — den stien må virke
uendret.

**Tiltak 4, 5, 6, 7 — nett-hygiene.** (4) `overpassClient.js:38–70`:
`Promise.any` over `res.json()` laster hele svaret fra alle tre speil; avgjør
vinner på svar-hodene og abort resten, eller start speil 2/3 forsinket.
(5) `demFetcher.js:135` `hedgedWCSDtm`, `HEDGE_DELAY_MS` 4 s: hedgen fyrer på
FULLFØRT nedlasting, så hvert stort DEM starter fallback-endepunktet; hedge på
tid-til-første-byte. (6) NVE spørres to ganger: `fetchN50Water`
(`n50Fetcher.js`, query, `outFields: '*'`) og `fetchNveLakePolygons`
(`nveLakeFetcher.js:386`, identify); identify-svaret kastes der query har dekning
(`vannMerge.js:199–201`). Gjør identify til fallback og begrens `outFields`.
(7) `public/sw.js` cacher ikke `data/n50-*`; flisene (0,5° × 1°, opptil 2,4 MB)
hentes rett fra nett i `n50ArealFetcher.js:36` / `n50StiFetcher.js:49`.
Cache-first i `lende-data`, nøklet på manifest-hash. Flisformatet
(`n50ArealPakke.js`, `TYPER` utvides bakerst) rører vi ikke.

## Invarianter som IKKE skal brytes

- Bit-eksakt DEM-fliserutenett (`snapUtmBboxToGrid`) og `lende-dem-tiles`.
- `isRealDem`-semantikken: Terrarium-fyll og syntetisk DEM må fortsatt skille seg.
- `vannMerge.js`/`arealMerge.js` er delt med headless — én fil, samme regler.
- Ren SVG ut av `buildSvg`. Ingen nye raster-lag.
- viewBox i meter, symbolstørrelser i mm (se CLAUDE.md).
- Norsk bokmål i UI og CHANGELOG; kommentarer bare der koden gjør noe spesielt.

---

# Turkart-ytelse: større ark på kortere tid

Revisjon av pipelinen «Lag kart» → `buildMapFromCenter` → fetchers → `buildSvg` (worker) → IndexedDB → MapView. Fem revisor-agenter fant 72 kandidater; alt under er etterprøvd mot koden (fil:linje). Effekt-tall er anslag fra kode og fra Node-målinger på syntetisk DEM; nett-tall kunne ikke måles herfra (Overpass, Geonorge og Pages er sperret fra sandkassen).

Standardkart i dag: 10 × 10 km, 25 m ekvidistanse → 20 m probe-DEM (250 k celler, ~1 MB), Overpass 0,4–5 MB avhengig av sted, kystkart får i tillegg 10 m-DEM (1 M celler, ~4 MB).

## Hvor tiden går

1. Overpass er flaskehalsen (81–97 % målt tidligere), og alt annet er organisert rundt å skjule den med terreng-først.
2. Terreng-først-previewen leverer ikke det den lover på kystkart: den venter på det oppgraderte DEM-et.
3. Etter at kartet er bygget gjør vi alt to ganger: to workere, to lagringer, to IDB-lesinger, to DOMParser-pass, to komplette apply-sekvenser, to relieff-beregninger.
4. Full-bygget venter på den tregeste av ni kilder, også lag som ikke bestemmer om kartet er lesbart.

## Tiltak, rangert etter gevinst per innsats

### A. Kritisk sti — nett og orkestrering (`src/lib/createMapFlow.js`)

1. **Bygg previewen fra probe-DEM-et straks.** L777 `await demCorePromise`, men `demCorePromise` (L521–579) venter på kystsignal (L555, som venter på `probeCoastline`-kappløpet) og så på 5/10 m-hentingen. På kystkart kommer «terrenget straks» først etter to WCS-rundturer pluss en Overpass-probe. Bruk `probeDemPromise` til previewen; full-bygget bruker det oppgraderte. *Liten.* Gevinst: hele andre DEM-hentingen (opptil 4 MB) + 1–3 s probe ut av tid-til-første-kart på kyst.
2. **Start `probeCoastline` ved t = 0**, ikke etter probe-DEM-et (L484–489). Den er ~200 B og trenger bare bbox. Sjøkart gates på samme promise (L584) og starter i dag tidligst etter probe-DEM. *Liten.*
3. **Ta de sekundære kildene av full-byggets kritiske sti.** L669 `Promise.all` venter på kulturminner (12 s × 3 forsøk × inntil 20 sider, `kulturminneFetcher.js:148–235`), Turrutebasen (15 s × 2), N50-sti/-areal (15 s), Sjøkart (arealskalert tak). Én treg tjeneste holder hele kartet. Gi dem et budsjett (3–5 s etter at Overpass + DEM er inne) eller et tredje pass gjennom `mapFinalizers`-mekanismen som alt finnes. *Middels.* Merk: kommentaren på L457 «default-AV lag» er feil — alle lag unntatt lysløype er PÅ (`mapLayerCatalog.js:88`), og fredete kulturminner hentes uansett på nytt ved hver kartlast (`useHeritageLayers.js:77–93`).
4. **Overpass-kappløpet laster hele svaret fra alle tre speil** (`overpassClient.js:38–70`): vinneren avgjøres etter `res.json()`, så de to taperne har alt strømmet mesteparten av 0,4–5 MB hver på mobilnett. Avgjør vinner på svar-hodene (første byte) og avbryt resten, eller start speil 2 og 3 forsinket (2 s) slik DEM-hedgen gjør. *Liten.* Sparer 2–3× båndbredde på det største kallet; total tid lik eller bedre.
5. **DEM-hedgen fyrer på fullført nedlasting** (`demFetcher.js:135`, `HEDGE_DELAY_MS` 4 s): et DEM som tar mer enn 4 s å laste ned starter alltid fallback-endepunktet, altså dobbel trafikk på nøyaktig de store hentingene. Hedge på tid-til-første-byte. *Liten.*
6. **NVE Innsjødatabasen spørres to ganger per bygg**: `fetchN50Water` (query, L410) og `fetchNveLakePolygons` (identify, L419) mot samme server, og identify-svaret kastes der query har dekning (`vannMerge.js:199–201`). Gjør identify til en fallback som bare fyres når query feiler/er tom, og begrens `outFields='*'` (`n50Fetcher.js:49`) til feltene som brukes. *Liten.*
7. **N50-flisene cacheres ikke av service workeren.** `sw.js` dekker `assets/`, `maps/` og statiske bilder; `data/n50-*` går rett på nett (`n50ArealFetcher.js:36`). Flisene er 0,5° × 1° (~55 × 55 km, opptil 2,4 MB), så et 10 km-kart laster ~97 % data utenfor arket — og laster den om igjen etter GitHub Pages' 10 min max-age. Kortsiktig: SW cache-first nøklet på manifest-hash. Langsiktig: mindre fliser (0,25°) eller én fil per type så et ark bare henter det det trenger. *Liten / middels.*
8. **WCS GeoTIFF bestilles ukomprimert** (`demFetcher.js:203–215`): Float32 rått, 4 B/celle, og geotiff-dekodingen kjører på hovedtråden etter nedlastingen. Mål i CI (fasit-workflowen har nett) om Geonorge honorerer `Accept-Encoding: gzip` og hvilken TIFF-komprimering den bruker (tag 259). Flytt dekodingen inn i workeren. *Måling først.*
9. **Tetthets-proben blokkerer alle flyter unntatt pickeren** (L266–301, 8 s tak), og pickeren sender `probe: null` når sonderingen ikke er ferdig — da hoppes tetthetsstyringen stille over (L274: `null !== undefined`). Kjør proben parallelt med DEM når `klampBredde` er false, og la pickeren vente på sin egen probe. *Middels.*

### B. Kritisk sti — CPU (`buildSvg`, `dem.js`)

10. **Terreng-først regner alle DEM-passene to ganger** (konturer, stup, topper, sjø) i to nye workere med to struktur-kloner av elements + DEM (L721, L779; `buildSvgClient.js:26–77`). Én langlivet worker som holder DEM-et og kontur-resultatet, og som gjenbruker kontur-SVG-en i full-bygget når DEM-et er uendret (ingen Terrarium-fyll). *Middels.* Sparer hele kontur+stup-passet (sekunder på 1 M celler) og én klone.
11. **Unødige kopier i konturpasset**: `fillNoData` lager en `Float32Array.from` med mapper også uten noData (`dem.js:70`), og `buildContours` kopierer hele rutenettet til et vanlig Array fordi «d3-contour krever Array» (`dem.js:281`) — det gjør den ikke. Målt i Node: 200–850 ms per pass på store rutenett. *Liten.*
12. **d3-contour er O(celler × terskler)** (`dem.js:275–284`): 25 m ekvidistanse over 0–1 500 m er 60 marching-squares-pass over hele rutenettet. Alternativ: ett-pass fler-nivå marching squares, eller konturer på et grovere rutenett enn sjø-masken (kurvene Chaikin-glattes uansett). *Stor — mål først.*
13. **Veier projiseres og forenkles to ganger** fordi `layerSvg` kalles per fase (casing + overlay, `mapBuilder.js:2799–2800`), og samme geometri projiseres 2–4 ganger gjennom passene (areal, path, sentroid, ferskvann, navn). Cache projiserte punkter per element. *Liten / middels.*
14. **`buildEntry` kjører `downsampleDem` + `packDem` + `findHighestPoint` på hovedtråden, på fullt DEM, to ganger** (L653–654). Gjør det i workeren, én gang. *Liten.*
15. Mindre: ferskvannsdifferansen klipper hvert DEM-sjø-polygon mot alle innsjøer uten bbox-forfilter (`mapBuilder.js:1269`); `buildSeaShallowBands` gjentar flood-fillen `buildSeaFromDem` alt har gjort (`seaFromDem.js:248`); `detectCliffs` skeletoniserer hele rutenettet med per-piksel-allokering (`skeleton.js:55`).

### C. Etter bygging — lagring og visning

16. **SVG-strengen tar omveien om IndexedDB mens entryen ligger i minnet.** `buildMapFromCenter` returnerer `entry`; pickeren kaster den og gjør `router.push` (`MapPickerContent.vue:368`), MapView leser IDB på nytt (`useMapLoadPipeline.js:176`) og parser (L208). Ved finalize returnerer promisen `fullEntry` — `consumeTerrainFinalize` (L399–411) kaster den og kaller `loadMap({silent})`, som leser IDB igjen. Lever entryen via et modul-register (som `mapFinalizers`) og la finalize rendre `fullEntry` direkte; skriv til IDB asynkront etterpå. *Middels.*
17. **MapView-chunken (439 kB, 133 kB gz, pluss avhengigheter) lastes først ved `router.push` etter at kartet er bygget** (`router.js:15`). Ingen forhåndslasting finnes. Fyr `import('./views/MapView.vue')` når pickeren monteres eller byggingen starter. *Liten.* På første besøk / etter ny SW-versjon er dette hundrevis av ms til sekunder rett foran første kart.
18. **Relieffet regnes på hovedtråden før første frame** (`useMapLoadPipeline.js:305` → `useReliefRender.js:138`) og regnes om ved finalize fordi `storedDem` er et nytt objekt. Flytt til det utsatte passet eller inn i workeren, og cache per kart-id. *Liten / middels.*
19. **Pass før første paint som kunne ventet**: `applyNameLanguage` skriver om alle navn mens de er skjult av `.lod-pending`; `applyUprightLabels` kjøres to ganger i samme last (L299, L386). Det utsatte passet (L463–505) er én lang oppgave (søkeindeks med `getBBox`, navn-LOD, cull-indeks) som blokkerer input rett etter første frame — del det opp med `requestIdleCallback`. *Liten.*
20. Avsløringsanimasjonen holder kartet usynlig i to frames + 130/540 ms (L525–545). Bevisst valg; nevnes bare fordi det er tid mellom «ferdig» og «synlig».

### D. Større ark — teknologivalg

21. **Vektor-SVG for alt er det som setter taket.** Alle paths har `non-scaling-stroke`, alle navn halo via `paint-order`, sju `<pattern>`-fyll (`symbolizer.js`); en 3 × 3-mosaikk er ni ganger nodene. Hybriden er halvveis der alt: 3D rasteriserer SVG-fliser til tekstur. Rasteriser arealfyll + relieff (evt. konturer) til én bakgrunns-PNG per flis i workeren (OffscreenCanvas), og behold linjer, punkter og navn som vektor. *Stor* — men den eneste hevarmen som skalerer med arkstørrelsen.
22. **Kant-utvidelsen bygger fliser serielt** (`useMapExtend.js:865`, `for … await`): «Gjør arket firkantet» med tre fliser er tre fulle pipeliner etter hverandre. Kjør to i parallell (tak på to av hensyn til Overpass). *Liten.*
23. **Overpass som primærkilde.** N50 er alt bakt for sti og areal; veier fra N50 ville krympe Overpass-spørringen til POI/navn/bygg. Bygninger fra N50 er derimot mye data — mål med `--mal` før noe bakes. Sammenlign selektorene i `buildOverpassQuery` (`mapBuilder.js:113–197`) mot det som faktisk tegnes; en selektor ingen lag leser er ren payload. Vurder `out geom qt` (raskere server-sortering) — krever at ingen pass avhenger av element-rekkefølge.
24. **Forhåndsbakte høydekurver (N50 20 m)** kolliderer med ekvidistanse-valget (10/20/25/50). Ikke anbefalt.
25. **Cloudflare-Workeren som Overpass-cache** gir lav treffrate (hver bbox er unik). Bare verdt det om WCS ikke komprimerer og Workeren kan gzippe på vei gjennom — se punkt 8.

### E. Død og sovende kode (verifisert med grep over src/, mcp/, scripts/, cloudflare/)

Bare brukt i egen testfil eller ingen steder:
- `src/lib/waterMaskFromTiles.js` og `src/lib/waterMaskFromWms.js` — hele moduler.
- `dem.js`: `buildHillshade` (dublett av `hillshade.js`), `contoursToSvgPaths`.
- `pathUtils.js`: `simplifyVW`, `generalize`.
- `marineTopology.js`: `clipPolygonToSea`, `multiPolygonToPathD`, `ringCentroid`.
- `demSampling.js`: `cropDem`, `sampleGradient`.
- `n50StiFetcher.fetchN50Sti`, `turrutebasenFetcher.fetchTurruter` («for MCP/headless» — headless kaller dem ikke), `n50ArealFetcher.nullstillNavnCache`.
- `mapBuilder.autoMapAFormat` (`autoMapSquare` lever, via `useMapSizePreference`).
- `hillshade.js`: opsjonene `feather`, `vignette`, `decorate` og `'opaque'`-modus.
- `stedsmerkeAnimation.js`: hele `*_HIT`-varianten (CurveInvaders-rest).
- `demFetcher.js`: `knownArea`/`KNOWN_AREAS`/`useReal: false` — eneste bruker er `scripts/build-vardasen-stub.js`, som ingen refererer. `fetchDEM` sitt `bbox`-argument brukes ikke.
- `createMapFlow.js`: `DEM_TILE_CACHE_ENABLED` er konstant `true` (L47) — AV-grenen (L362–364) og `fetchDEM`-importen er døde. `n50ArealStatus` sendes inn til `buildSvg` «→ meta» (L745) men leses aldri i `mapBuilder.js`.
- `buildSvg`-opsjoner ingen kaller varierer: `includeCliffs`, `includeKnauser`, `includeBuildingMass`, `skipContoursIfSynthetic` (alltid true).

Sovende — uoppnåelig med dagens ekvidistanse-liste (10/20/25/50 i `equidistanceRules.js`; MCP håndhever minimum; Fritt lende er 10):
- Fin-DEM-trappa: `fineDemResFor`, `FINE_DEM_STEPS_M`, `fineInlandTargetResM` (krever ≤ 5 m) og 10 m-grenen i `demProbeOpplosning`.
- `detectKnauser` (krever `contourIntervalM === 5`, `mapBuilder.js:1186`).
- Gaussisk konturglatting (krever DEM ≤ 3,5 m, `mapBuilder.js:1175`) — kyst-oppgraderingen stopper på 5 m.
- Eldre lagrede kart med 5 m ekvidistanse kan nå grenene via `useMapExtend` (`m.equidistance`).

Bekreftet levende, så ingen rydder dem: `tileCache.js` (mosaikk-tak), `webMercator.js` og `tileBackground.js` (picker/ruteplanlegger), `skeleton.js` (via `detectCliffs`), `ventendeFliser.js`, `linjeDedup.js`.

### F. Målinger som mangler

- Perf-loggen (L756–764) måler `terreng`-marken men skriver den ikke, og har ingen «tid til preview synlig». Terrarium-fyllet ligger utenfor `dem`-marken (L581). `buildSvg.timings` måler bare fire DEM-pass — OSM-emisjonen, sjø/ferskvann, navneplassering og strengbygging er umålt.
- `renderPerf` (hent/parse/dom/pass/indeks) finnes men forlater aldri enheten. Røyktesten kunne logge den for Vardåsen så trenden ses i CI.
- Ikke målbart herfra, målbart i fasit/røyk-workflowen: Overpass-payload per selektor, WCS-komprimering og gzip, Pages' `Cache-Control` for `.bin`-flisene.

## Rekkefølge jeg ville tatt

1. Punkt 1 + 2 (preview fra probe-DEM, kystprobe ved t = 0) — liten innsats, størst synlig effekt på kyst.
2. Punkt 17 (forhåndslast MapView-chunken) — én linje.
3. Punkt 16 (entry i minne, finalize rendrer direkte) — halverer visningsstien.
4. Punkt 3 (sekundære kilder av kritisk sti).
5. Punkt 10 + 11 + 14 (én worker, konturer én gang, ingen unødige kopier).
6. Punkt 4, 5, 6, 7 (nett-hygiene: speil-kappløp, DEM-hedge, NVE-dublett, SW-cache for fliser).
7. Punkt 21 når arkene skal bli større enn i dag — det er den eneste som skalerer.

Rydding av seksjon E er trygg å gjøre i én egen PR; ingenting der ligger på kritisk sti, men det står i veien for å lese pipelinen.

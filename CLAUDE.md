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
N50 Havflate/Innsjø/ElvBekk → OSM-vann. `marineTopology.js` bygger ÉN
autoritativ sjø-geometri; ISOM 307 klippes mot den. Land-mask (union av alt
vann) hindrer konturer/vegetasjon over vann. OSM multipolygon-relations MÅ
ring-sys via `assembleRelationRings` i `mapBuilder.js` (ellers wedge-artefakter).

## Arkitektur-gjeld og duplikater — LES DETTE FØR DU BYGGER NYTT

Denne seksjonen finnes fordi Claude starter hver økt blind og bare leser det
oppgaven tvinger fram. To nesten identiske 3D-scener levde side om side i
måneder (`tourScene` + `exploreScene`, slått sammen i v5.7.0) uten at det ble
oppdaget, rett og slett fordi ingen oppgave hadde begge filene i konteksten
samtidig. Står gjelden her, er den i synsfeltet fra første melding.

**Regelen: skal du bygge en ny variant av noe som finnes, les originalen
FØRST og spør om varianten egentlig er en OPSJON på originalen.**

Kjent gjeld, oppdatert etter hver leveranse som rører den:

- **`MapView.vue` er ~3 573 linjer** og er fortsatt appens største risiko: alt
  møtes der, og Claude ser bare utsnitt av den om gangen. Fem domener ble
  trukket ut i v5.8.0 — `use3dEntry.js` (3D-inngangen), `useKartDeling.js`
  (utgående deling), `useDeltTur.js` (innkommende tur-lenke),
  `useLagStyring.js` (lag/presets/dybde), `useGpsSpor.js` (GPS, opptak,
  høydeprofil), og to i v5.9.0 — `useNavnLod.js` (navne-declutter) og
  `useViewportCull.js` (skjul vektorer utenfor utsnittet), og `useKartKnotter.js`
  i v5.10.0 (strek/relieff/tekst-skala/font + FAB-panelene), og i v5.11.0
  `useNaerhetsvarsel.js` + `useMaaling.js`. Neste kandidater: eksport (~90
  linjer), tema+diagnose (~95), GPS-tips/toasts (~60), søk+panTo (~220),
  pan/zoom-gest (~180). **Merk fra v5.10.0:** linjetallene her er anslag fra
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
- **Stinett-lesing finnes i tre varianter** med ulikt formål og det er med
  vilje: `stinettAnalyse.stinettFeaturesFromSvgEl` (nettleser, DOM),
  `mcp/headless.graphInputFromSvg` (node, streng), `useStifinner.featuresFromSvg`
  (nettleser + spøkelsesfliser). Endrer du kodesett eller offset-håndtering i
  én, sjekk de to andre.
- **`RUTE_GRAF_OPTS` i `routing.js` er én kilde til sannhet** for grafen. Bygger
  du en graf et nytt sted, spre den inn — ellers svarer diagnosen (`stinettBrudd`)
  på et annet nett enn ruteren bruker.

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
«mente du dette?». Advarsler (⚠) er datakvalitet i kildene — f.eks. en
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
  frittstående Cloudflare Worker med to ruter, valgt på path.
  `/api/v1/Stations|Observations` → NVE HydAPI, med nøkkelen som Cloudflare-secret
  (`NVE_HYDAPI_KEY`) — aldri i bundelen. `/brukerminner/*` → Kulturminnesøk
  (`api.ra.no`), som ikke trenger nøkkel men gikk hit for CORS + døgn-cache etter
  at klient-side-hentingen feilet (v4.8.7). Alt annet gir 404 — ingen åpen proxy.
  Klientene peker hit via standard-URL i `nveHydApi.js` og `kulturminneFetcher.js`
  (overstyrbare med `VITE_NVE_HYDAPI_URL` / `VITE_KULTURMINNE_URL`).
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

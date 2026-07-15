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
npm run test       # Vitest (~75 filer, tester ligger ved siden av kilden)
npm run build      # Produksjonsbygg
npm run mcp        # MCP-server (stdio) — kart/rute-verktøy for Claude
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
- **MCP-server**: `mcp/server.js` (11 verktøy: bygg_kart, planlegg_rute,
  eksporter_gpx, hoydeprofil, turrapport_svg m.fl.) + `mcp/headless.js`
  (linkedom-basert headless bygging). Importerer fra `../src/lib`.

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

## Konvensjoner

- **Norsk UI-tekst (bokmål)** med ekte æ/ø/å.
- Tailwind CSS 4 (`@import "tailwindcss"`, ingen config-fil).
- Tester ligger ved siden av kildekoden (`*.test.js`).
- `polygon-clipping` er eneste 3.-parts geometri-bibliotek.

## Versjonshåndtering — PR-per-endring, alltid bump

1. Hver endring brukeren skal teste → **ny PR fra fresh `origin/master`**.
2. Hver PR → bump versjon i tre filer som må matche:
   - `package.json` (`"version"`)
   - `src/version.js` (`APP_VERSION`)
   - `public/sw.js` (`CACHE_VERSION`) — kritisk for at mobil-klienten henter
     ferske assets etter deploy
3. **Hver versjons-bump → ny post øverst i `CHANGELOG.md`.** Format:
   `## <YYYY-MM-DD> — v<versjon>: <kort tittel>`, ett forklarende avsnitt
   (bokmål), så `---`. Håndheves av `.claude/hooks/pre-commit-changelog.sh`.
4. Patch-bump (1.0.x) som default; brukeren sier fra ved minor/major.
5. Aldri gjenbruk en branch som allerede er merget.

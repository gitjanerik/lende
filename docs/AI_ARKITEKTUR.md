# KI-arkitektur i Lende — beslutningsnotat

Dette notatet fryser konklusjonene fra en arkitekturdiskusjon om å legge
KI-funksjonalitet til Lende, slik at vi kan ta opp tråden senere uten å
re-derivere alt. **Status: ingen kode skrevet ennå — dette er retningen, ikke
en ferdig implementasjon.**

## Bakgrunn

Utgangspunktet var en ChatGPT-tråd som anbefalte: serverless AI-proxy for å
skjule API-nøkkel, sende strukturert kartkontekst til modellen, eksponere
kartfunksjoner som verktøy, starte med en «Spør KI om dette stedet»-knapp, og
— mer tvilsomt — flytte hosting fra GitHub Pages til Cloudflare Pages.

## Konklusjon (forankret i faktisk kodebase)

ChatGPTs KI-arkitektur er riktig retning, med to viktige korreksjoner:

1. **«Verktøyene» finnes allerede.** Lende har 13 MCP-verktøy over `src/lib`
   (`mcp/server.js`). Ikke bygg på nytt; gjenbruk. Men MCP-serveren er
   Node/stdio-bundet (linkedom, `node:fs`, skriver filer) — en nettleser-KI kan
   ikke kalle den direkte.
2. **Ikke migrer hosting for KI-ens skyld.** En Cloudflare Worker-proxy funker
   kryss-origin med CORS-allowlist akkurat som NVE-proxyen gjør i dag.
   Migrering har reell kostnad og en stille PWA-felle. Egen beslutning.

## Anbefalt rekkefølge

### Fase 1 — Cloudflare AI-proxy (Worker)

- Ny Worker etter malen i `cloudflare/nve-proxy/` (secret-nøkkel,
  header-injeksjon, sti- og CORS-allowlist mot `https://gitjanerik.github.io`
  + localhost).
- **Nye behov vs. NVE-proxyen:** tillat `POST` (chat-body), og støtt
  **streaming** av svaret (NVE-proxyen mirror-er kun body).
- Leverandør-agnostisk design: ett `/api/ai`-endepunkt som kan stå foran
  Claude *eller* OpenAI (valg utsatt — se «Åpne valg»).
- Klient peker hit via `VITE_...`-env med default-URL, samme mønster som
  `HYDAPI_BASE` i `src/lib/nveHydApi.js`.

### Fase 2 — «Spør KI om dette stedet»-knapp

- Knapp i info-kortet i `src/views/MapView.vue` (der `selectedFeature` finnes).
- Send strukturert kontekst appen allerede har: senter/zoom, valgt objekt,
  synlige lag, nære objekter — ikke la KI hente alt automatisk.
- Kontekstbevisst enkelt-svar først; full chat med minne kommer senere.

### Fase 3 (senere) — La KI kalle kart-verktøy

- Gjenbruk `src/lib`-primitivene / MCP-logikken framfor å bygge nytt.
- To realistiske veier: (a) kall `src/lib`-funksjoner direkte i nettleseren
  (appen kjører allerede browser-ekvivalentene `useStifinner`, `useMapSearch`),
  eller (b) eksponer verktøyene som remote-endepunkt på Workeren.
- Se `docs/MCP_REMOTE_CHAT.md` — dette er tenkt på før.

## Gjenbruk — konkrete referanser

- **Proxy-mal:** `cloudflare/nve-proxy/src/index.js` (secret via
  `env.NVE_HYDAPI_KEY`, `ALLOWED_PATHS`, `ALLOWED_ORIGINS`, GET/OPTIONS-gate),
  `wrangler.toml`, `README.md`.
- **Klient-URL-mønster:** `src/lib/nveHydApi.js` (`VITE_NVE_HYDAPI_URL` ??
  default-Worker-URL).
- **Eksisterende verktøy (samme `src/lib` som appen):** `mcp/server.js` —
  `finn_poi_paa_kart`, `sok_kart`, `planlegg_rute`, `berik_rute`,
  `turrapport_svg` m.fl. NB: Node-bundet (linkedom, `node:fs`, skriver filer).
- **Browser-ekvivalenter:** `src/composables/useMapSearch.js`, `useStifinner`
  — kjører mot ekte DOM i appen.
- **Info-kort / valgt objekt:** `src/views/MapView.vue` (`selectedFeature`).

## Hva vi bevisst IKKE gjør (nå)

**Ingen hosting-migrering GitHub Pages → Cloudflare Pages** som del av KI.
Grunner: ikke nødvendig (CORS-allowlist funker kryss-origin), og reell kostnad
+ felle:

- `base: '/lende/'` i `vite.config.js` må flippes.
- **Hardkodet `const BASE = '/lende/'` i `public/sw.js`** (Vite transformerer
  ikke `public/`) — bommes den, feiler ikke bygget, men offline/PWA-caching
  knekker stille for installerte mobilklienter.
- `public/manifest.webmanifest` (4 steder), CORS-allowlist i proxyen, og
  ~50 linjer gh-pages-plumbing i `build-vardasen-map.yml`.
- Vurder migrering senere som egen sak (custom domene, D1/KV-caching).

## Åpne valg

- **KI-leverandør:** ikke bestemt. Design proxyen leverandør-agnostisk
  (Claude *eller* OpenAI bak samme `/api/ai`), valg tas ved implementering.

## Verifisering (når vi bygger)

- Worker: `wrangler dev` lokalt med `.dev.vars`-nøkkel; verifiser at
  `POST /api/ai` streamer og at CORS-allowlist slipper gjennom appens origin.
- Frontend: knapp i info-kort sender kontekst og viser svar; test fra
  `npm run dev` (5173) mot lokal Worker, deretter mot deployet Worker.
- Følg CLAUDE.md-konvensjon ved PR: bump versjon i alle fire filer + ny
  `CHANGELOG.md`-post; egen branch fra fersk `origin/master`.

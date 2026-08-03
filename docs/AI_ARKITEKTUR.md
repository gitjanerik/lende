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

- Ny Worker etter malen i `cloudflare/proxy/` (secret-nøkkel,
  header-injeksjon, sti- og CORS-allowlist mot `https://gitjanerik.github.io`
  + localhost).
- **Nye behov vs. NVE-proxyen:** tillat `POST` (chat-body), og støtt
  **streaming** av svaret (NVE-proxyen mirror-er kun body).
- Leverandør-agnostisk design: ett `/api/ai`-endepunkt som kan stå foran
  Claude *eller* OpenAI (valg utsatt — se «Åpne valg»).
- Klient peker hit via `VITE_...`-env med default-URL, samme mønster som
  `HYDAPI_BASE` i `src/lib/nveHydApi.js`.

### Fase 2 — Lende-chat (global modal) — BYGGET

*(Opprinnelig skisse var en knapp i info-kortet ved `selectedFeature`, men det
symbolet finnes ikke lenger i koden. Endelig design, valgt juli 2026: alltid
synlig inngang — ikke gjemt bak et objektvalg eller i en skuff.)*

- **Klassisk FAB nederst til høyre** med app-logoen (`LendeChatFab`): global
  `fixed`-knapp montert i App.vue (z-60 — dekkes naturlig av meny-backdrop og
  modaler). I kartvisningen, der knott-kolonnen (sentrer/strek/relieff)
  allerede eier hjørnet, monteres den som nederste knott i samme kolonne og
  arver panel-transisjonene; den globale viker for den ruten. Vises kun med
  invitasjonstoken (`lende-ai-token` i localStorage, plukkes opp fra
  `?ai-token=`-lenker i main.js).
- **Global chat-modal** (`LendeChat` i App.vue, AppModal-skallet) med delt
  tilstand i `useLendeChat` — historikken overlever lukking og navigasjon.
- **Kontekst følger visningen**: MapView setter kartnavn/senter/størrelse/
  ekvidistanse via `setChatContext`; planleggeren sin visning; forsiden ingen.
  Flettes i system-prompten ved hvert send.
- Fase 2 er ren spørsmål/svar (streaming); modellen sier ærlig fra at den ikke
  kan bygge kart/planlegge ruter ennå. Verktøykjøring kommer i Fase 3 i samme
  modal — global plassering er valgt nettopp så «lag et kart over Håøya» kan
  fungere fra hvor som helst i appen.

### Fase 3 — La KI kalle kart-verktøy — BYGGET (MVP, v3.0.34)

Valgte vei (a): klient-side verktøy — modellen foreslår kall (OpenAI
function-defs via Workers AI), appen kjører dem lokalt i nettleseren mot
samme maskineri som resten av appen. Ingen remote-MCP, ingen ny infrastruktur.

- **Verktøysettet** (`src/lib/lendeAiTools.js`): `sok_sted` (geocode.js),
  `mine_kart_og_ruter` (mapStorage), `apne_kart`, `foreslaa_nytt_kart`
  (navigerer til /nytt med utfylte felter — brukeren bekrefter og bygger
  selv), `vis_tur_i_3d` (dyplenke-params som `parseTourQuery` leser).
- **Løkka** bor i `useLendeChat.send`: maks 4 verktøy-runder, sekvensiell
  kjøring, `role:"tool"`-svar tilbake, norsk statuslinje per kall. Verktøy-
  runder kjører ikke-strømmende (Workers AI støtter ikke streaming+tools
  pålitelig); verktøy-utvekslinger persisteres ikke i visnings-historikken.
- **Stinett-analyse** (`analyser_stinett`, kjerne i
  `src/lib/stinettAnalyse.js`): total km sti (505/506/507 + skogsbilvei 504,
  hvert segment én gang), lengste sammenhengende turstrekning, og
  tur-kandidater (A→B/rundtur ≥ 0,5 km standard, justerbart med minTurKm)
  med stigning og bratteste/slakeste parti. Småveg (503) er bindeledd
  (≤ 300 m-strekk kobler stinett sammen, teller i turlengder, aldri i
  sti-summen); korte isolerte stumper ekskluderes med dynamisk minstelengde
  etter sti-tetthet (300–500 m). Samme kjerne
  eksponeres som MCP-verktøy i både `mcp/server.js` og
  `cloudflare/mcp-worker` — turenes koordinater kan sendes rett videre til
  foreslaa_tur/foreslaa_rundtur (MCP: planlegg_rute/planlegg_rundtur).
- **Ikke dekket ennå:** kjøre Stifinner-beregninger direkte fra chat
  (ruteforslag med lengde/høydemeter som svar), POI-søk i kartet, favoritt-
  markering/søkehistorikk (jf. «Personlig kontekst» i MCP_REMOTE_CHAT.md).

## Gjenbruk — konkrete referanser

- **Proxy-mal:** `cloudflare/proxy/src/index.js` (secret via
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

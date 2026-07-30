# Interface og chat mot Lende-MCP — utredning

Denne utredningen veier to spor for å gjøre MCP-verktøyene tilgjengelige for et
_interface_ / en chat, ikke bare for Claude Code lokalt. Den er en beslutnings-
skisse — ingenting av dette er bygget ennå.

## Utgangspunkt

MCP-serveren (`mcp/server.js`) kjører i dag som en **stdio**-prosess: Claude
Code starter `node mcp/server.js`, snakker JSON-RPC over stdin/stdout, og
verktøyene kaller rett inn i `src/lib`. To egenskaper ved dagens design er
avgjørende for hva som skal til for et interface:

1. **Tilstand i minnet.** `state.map`, `state.routingGraph`, `state.routes` og
   `state.innstillinger` holdes i prosessen (`server.js`). `bygg_kart` legger
   kartet i `state.map`; de andre verktøyene forutsetter at det er bygget
   (`requireMap()`). Én stdio-prosess = én bruker = én kart-kontekst.
2. **Fil-utdata.** SVG/GPX/Markdown skrives til disk (`writeFileSync` til
   `tmpdir()/lende-mcp/…`) og verktøyet returnerer en **filsti**. Det fungerer
   for en lokal klient som kan lese disk, men ikke for en fjern klient.

Begge må adresseres for remote/chat-bruk.

---

## Spor 1 — Remote MCP over HTTP (Cloudflare Worker)

MCP-spesifikasjonen har en **Streamable HTTP**-transport ved siden av stdio. En
Cloudflare Worker (samme deploy-mønster som `cloudflare/nve-proxy/`) kan hoste
serveren slik at en nettbasert klient — inkludert claude.ai / Claude Code på web
— kobler til over HTTPS.

**Hva som må endres:**

- **Transport.** Bytt/utvid fra `StdioServerTransport` til en HTTP-transport.
  Verktøy-registreringen (`server.registerTool(...)`) er transport-uavhengig og
  kan gjenbrukes uendret.
- **Tilstand pr. sesjon.** `state`-objektet må flyttes fra modul-globalt til en
  sesjons-nøkkel (MCP `sessionId`). På Cloudflare er **Durable Objects** den
  naturlige bæreren: ett objekt pr. sesjon som holder kartet/grafen mellom kall.
  Alternativt en tilstandsløs modell der klienten sender kart-konteksten inn i
  hvert kall — men kartet + routing-grafen er store, så sesjons-tilstand er å
  foretrekke.
- **Assets i stedet for filstier.** SVG/GPX/Markdown må returneres som innhold
  (base64 / MCP `resource`-lenker), ikke `writeFileSync`-stier. Enten inline i
  svaret (SVG-ene er titalls kB) eller lastet opp til R2/KV med en URL i retur.
- **CPU/tid.** `bygg_kart` gjør tunge parallelle henteoperasjoner (Kartverket
  WCS, Overpass, N50) og DEM-prosessering. Cloudflare Workers har CPU-tak;
  store kart kan trenge Durable Objects/Queues eller en oppdeling der bygging
  skjer asynkront og klienten poller.
- **Hemmeligheter.** NVE-nøkkelen ligger allerede som Worker-secret. Andre
  kilder (Kartverket, Overpass, GBIF, Riksantikvaren) er nøkkelfrie i dag.

**Vurdering:** Størst arkitektur-endring, men gir «ekte» MCP som en hvilken som
helst MCP-klient kan bruke. Tyngdepunktet er tilstands-flyttingen og
asset-håndteringen, ikke transporten i seg selv.

---

## Spor 2 — Chat-view i appen (`/chat`)

Et `/chat`-view i selve Lende-appen der en LLM får Lende-verktøyene og brukeren
skriver naturlig språk («lag et kart av Vardåsen og planlegg en rundtur innom
toppen»).

**Hva som må til:**

- **LLM-nøkkel bak en Worker.** Som med NVE kan ikke en API-nøkkel bo i den
  offentlige bundelen. En ny Cloudflare Worker (f.eks. `cloudflare/llm-proxy/`)
  som holder nøkkelen og videresender til Claude-API-et, med CORS låst til
  `gitjanerik.github.io` slik nve-proxyen er.
- **Verktøy-orkestrering.** To varianter:
  - **Klient-side verktøy:** LLM-en foreslår verktøykall, og appen kjører dem
    _lokalt i nettleseren_ mot `src/lib` (mesteparten er DOM-fri og kjører
    allerede klient-side via `buildSvgClient.js`). Da slipper man remote-MCP
    helt — chat-en blir bare et naturlig-språk-lag oppå funksjoner appen
    allerede har. Dette utnytter at Lende _er_ klienten.
  - **Remote MCP:** chat-en snakker med Spor 1. Mer infrastruktur, men delt med
    andre klienter.
- **Kartkontekst.** Chat-en bør operere på kartet brukeren ser (`MapView`), ikke
  et separat MCP-kart — altså binde verktøyene til app-tilstanden, ikke en
  frittstående `state.map`.

**Vurdering:** Gir mest _produkt_ for minst _infrastruktur_ hvis man velger
klient-side verktøy: ingen tilstands-migrering, ingen asset-opplasting, kun en
tynn LLM-proxy. Ulempen er at det er Lende-spesifikt (ikke gjenbrukbart som en
generell MCP-tjeneste).

---

## Personlig kontekst — «Lag favorittruta mi i 3D-visning»

Chat-en skal kunne relatere til brukerens eget innhold og historikk. Siden
Spor 2 kjører alt klient-side og all lagring er lokal (IndexedDB/localStorage
i brukerens nettleser), er dette automatisk per bruker — ingen kontoer eller
backend trengs. Tre byggeklosser, i stigende størrelse:

1. **Verktøy over lagret innhold (må bygges, lite).** Et klient-side verktøy
   à la `list_lagrede_ruter` / `list_lagrede_kart` som leser `lende-maps`
   (IndexedDB, `mapStorage.js`) og gir LLM-en navn, dato og nøkkeltall for
   brukerens lagrede kart og grusruter. I tillegg bør chat-konteksten alltid
   inkludere et kompakt sammendrag (de siste N navnene), så modellen kan
   forstå «favorittruta mi» / «ruta fra i går» uten ekstra rundtur.
2. **3D-dyplenke (finnes allerede).** `src/lib/tour3dLink.js` bygger lenker
   som åpner 3D-turvisningen (`v3d=1`), og MCP-verktøyene
   `planlegg_rute`/`planlegg_rundtur` returnerer allerede `tur3dUrl` nettopp
   så agenten kan foreslå «se turen i 3D». Chat-verktøyet trenger bare å
   navigere til lenken i stedet for å returnere den.
3. **Favoritt-markering og søkehistorikk (valgfritt, små tillegg).** I dag
   finnes ingen favoritt-stjerne og ingen søkehistorikk-logg. En favoritt-flagg
   på lagrede ruter og en enkel «siste søk»-liste (localStorage, `lende-`-
   prefikset) ville gjort referanser som «favorittruta» eksakte i stedet for
   navne-/nylighetsbaserte gjetninger.

Eksempelet «Lag favorittruta mi i 3D-visning» dekomponerer da til:
`list_lagrede_ruter` → finn ruta → `buildTour3dUrl` → naviger. Kun punkt 1
er ny kode av betydning.

---

## Modellvalg og kostnad — Cloudflare Workers AI ser ut til å holde

Utredet juli 2026, etter at Cloudflare-konto ble opprettet. Konklusjon:
**Workers AI ser ut til å fungere med gjeldende oppsett**, og er det
alternativet som gir minst infrastruktur totalt.

- **Ingen nøkkel å skjule.** Workers AI kalles via binding (`env.AI.run(...)`)
  direkte i Worker-koden. Hele grunnen til proxy-mønsteret (skjule API-nøkkel,
  jf. nve-proxy) bortfaller — Fase 1-Workeren krymper til CORS-allowlist +
  videresending til `env.AI` med streaming.
- **Verktøykall er blitt bra nok.** Katalogen har nå dedikerte
  tool-calling-modeller — `@cf/zai-org/glm-4.7-flash` (rask) og Kimi K2.6/K2.7
  (mer kapabel, multi-turn tool calling, structured outputs). Siden Spor 2
  kjører verktøyene klient-side trenger modellen bare returnere
  tool-call-JSON; appen gjør resten.
- **Gratiskvote:** 10 000 neurons/dag (nullstilles 00:00 UTC), deretter
  $0,011 per 1 000 (krever Workers Paid, $5/mnd som gulv). Estimat med
  5 brukere × 2 økter/uke à 30 min: en slank økt (kompakt kartkontekst,
  GLM-4.7-flash) koster ~2–4 000 neurons → normal bruk går gratis; en
  Claude-dimensjonert økt på Llama 3.3 70B (~300k input/15k output) koster
  ~11 000 neurons, altså litt over én dagskvote. Kontekst-trimming er
  hovedknappen. Verste realistiske utfall: øre-beløp per dag i overforbruk.
- **Til sammenligning** (betalte alternativer, samme scenario, med prompt-
  caching): Haiku 4.5 ~$8/mnd, Sonnet 5 ~$16–24/mnd, Opus 5 ~$39/mnd.
  Gemini Flash har også en gratis-tier (~15 req/min, ~1 500/dag, med
  function calling) som dekker volumet — men krever nøkkel i proxy.
- **Forbehold å teste tidlig:** norsk bokmål-kvalitet i svarene, og
  verktøykjede-pålitelighet på norske prompts. Siden `/api/ai`-endepunktet
  designes leverandør-agnostisk (jf. `AI_ARKITEKTUR.md`) er fallback til
  Gemini Flash eller Claude et konfigurasjonsbytte i Workeren, ikke en
  klientendring.

---

## Anbefaling

Start med **Spor 2 med klient-side verktøy**: en `/chat`-view + en liten
LLM-proxy-Worker, der modellen orkestrerer de eksisterende, DOM-frie
`src/lib`-funksjonene i nettleseren mot kartet brukeren allerede har åpent.
Det gir chat-opplevelsen brukeren etterspør uten å rive opp MCP-serverens
tilstands- og fil-modell.

Behold **Spor 1 (remote MCP)** som et senere steg dersom verktøyene skal deles
med eksterne MCP-klienter. Den største jobben der — sesjons-tilstand i Durable
Objects og assets via R2 i stedet for filstier — er verdt å ta først når det
finnes et konkret behov for en fjern, ikke-Lende-klient.

Naturlig neste steg uansett spor: en minimal LLM-proxy-Worker (kopi av
`cloudflare/nve-proxy/`-mønsteret) og en avklaring av hvilke ~5 verktøy en
chat-førstegangsbruker trenger (trolig `sok_sted` → `bygg_kart` →
`planlegg_rute`/`planlegg_rundtur` → `turrapport_svg`).

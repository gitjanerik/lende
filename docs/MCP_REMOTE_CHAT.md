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

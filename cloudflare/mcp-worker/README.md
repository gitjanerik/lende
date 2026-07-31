# Lende remote MCP-server (Cloudflare Worker)

Spor 1 fra `docs/MCP_REMOTE_CHAT.md`: Lendes MCP-verktøy over MCP-standardens
**Streamable HTTP**-transport, så eksterne MCP-klienter kan bruke dem over
internett — Claude Chat (custom connectors), Claude Code, Claude Desktop m.fl.
Verktøy-logikken importeres fra samme `src/lib` som appen og stdio-serveren
(`mcp/server.js`); wrangler bundler den inn.

**Fase A:** tilstandsfrie verktøy — `sok_sted`, `vannmalestasjoner`.
**Fase B (v4.1.0):** hele kart-kjeden — `bygg_kart`, `planlegg_rute`,
`planlegg_rundtur`, `hoydeprofil`, `eksporter_gpx`, `finn_poi_paa_kart`,
`sok_kart`. Tilstanden bor i **R2** (`kartlager.js`): bygg_kart returnerer en
`kartRef`, og alle senere kall laster kartet (SVG + DEM + meta) fra bucketen
`lende-mcp` — restart-trygt og uten Durable Objects. Utdata (kart-SVG, GPX,
rundtur-SVG) serveres via `GET /fil/…` med kallerens token i lenken.
Krever Workers Paid (30 s CPU — et 2×2 km-kart bygges på ~15–30 s totalt).

Endepunkter:

- `POST /mcp` — MCP Streamable HTTP (initialize / tools/list / tools/call).
  Krever token: `Authorization: Bearer <token>` **eller** `?token=<token>` i
  URL-en (for klienter som bare tar en ren URL). Samme kommaseparerte
  GUID-liste som lende-ai (`LENDE_AI_TOKENS`-secret).
- `GET /fil/<r2-sti>?token=…` — bygde kart og utdata fra R2 (token-gatet).
- `GET /health` — uautentisert deploy-sjekk (lister verktøyene).

## Koble til fra Claude

- **Claude Code** (`.mcp.json` eller `claude mcp add`):

  ```json
  {
    "mcpServers": {
      "lende-remote": {
        "type": "http",
        "url": "https://lende-mcp.jepedersen73.workers.dev/mcp",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```

- **Claude Chat / claude.ai** (custom connector — tar kun URL):
  `https://lende-mcp.jepedersen73.workers.dev/mcp?token=<token>`

## Deploy

Automatisk via `.github/workflows/deploy-mcp-worker.yml` (push til master som
endrer denne mappa). Gjenbruker repo-secretene `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID` og `LENDE_AI_TOKENS`. Røyktesten kjører ekte
MCP-protokoll (initialize → tools/list → sok_sted-kall) mot den deployede
Workeren.

Lokal utvikling: `.dev.vars` med `LENDE_AI_TOKENS=test-token`, så
`npm install && npx wrangler dev` og f.eks.:

```bash
curl -s -X POST http://localhost:8787/mcp \
  -H 'Authorization: Bearer test-token' \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Merknader

- Handler/server bygges **per forespørsel** — en McpServer-instans kan bare
  kobles til én transport (verifisert: gjenbruk gir «Already connected»).
- `agents`-pakken krever `ai` som peer-avhengighet; begge er pinnet i
  package-lock.json (API-et endret seg mellom versjoner).
- Tokens skal aldri committes; `.dev.vars` er git-ignorert.

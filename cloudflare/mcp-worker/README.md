# Lende remote MCP-server (Cloudflare Worker)

Spor 1 fra `docs/MCP_REMOTE_CHAT.md`: Lendes MCP-verktøy over MCP-standardens
**Streamable HTTP**-transport, så eksterne MCP-klienter kan bruke dem over
internett — Claude Chat (custom connectors), Claude Code, Claude Desktop m.fl.
Verktøy-logikken importeres fra samme `src/lib` som appen og stdio-serveren
(`mcp/server.js`); wrangler bundler den inn.

**Fase A (denne):** tilstandsfrie verktøy — `sok_sted`, `vannmalestasjoner`.
**Fase B (senere):** `bygg_kart` + rute-/rapportverktøyene, med kart-tilstand i
R2 (Workers Paid er aktivert, så CPU-taket er 30 s).

Endepunkter:

- `POST /mcp` — MCP Streamable HTTP (initialize / tools/list / tools/call).
  Krever token: `Authorization: Bearer <token>` **eller** `?token=<token>` i
  URL-en (for klienter som bare tar en ren URL). Samme kommaseparerte
  GUID-liste som lende-ai (`LENDE_AI_TOKENS`-secret).
- `GET /health` — uautentisert deploy-sjekk.

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

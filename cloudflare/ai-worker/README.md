# Lende KI-Worker (Cloudflare Workers AI)

Fase 1 av KI-planen: én Cloudflare Worker (`lende-ai`) som kjører chat-inferens
via **Workers AI** — modellene bor hos Cloudflare og kalles via `env.AI`-
bindingen, så det finnes **ingen API-nøkkel** å skjule. Tilgang styres i stedet
av per-bruker-tokens: secreten `LENDE_AI_TOKENS` er en kommaseparert liste, og
alle kall må ha `Authorization: Bearer <token>`. Gratiskvoten er 10 000
neurons/dag (nullstilles 00:00 UTC); på gratisplanen avvises kall over kvoten —
det kan ikke påløpe kostnader uten aktiv oppgradering til Workers Paid.

Endepunkter:

- `POST /api/ai` — body `{ messages: [...], tools?: [...], stream?: true,
  max_tokens?: n }`. Krever token. Svar er modellens JSON, eller SSE ved
  `stream: true`.
- `GET /health` — uautentisert deploy-sjekk, `{ ok: true, model: "..." }`.

Modellen er en var i `wrangler.toml` (`MODEL`) — bytte til annen Workers
AI-modell er én linje + deploy. Se «Modellvalg og kostnad» i
`docs/MCP_REMOTE_CHAT.md` for begrunnelsen bak defaultvalget.

---

## Deploy via GitHub Actions (anbefalt — fungerer fra mobil)

Workflowen `.github/workflows/deploy-ai-worker.yml` deployer automatisk ved
push til `master` som endrer denne mappa (og kan kjøres manuelt fra
Actions-fanen). Engangsoppsett — tre secrets i GitHub-repoet
(**Settings → Secrets and variables → Actions → New repository secret**):

1. `CLOUDFLARE_API_TOKEN` — lag i Cloudflare-dashbordet: **My Profile →
   API Tokens → Create Token → mal «Edit Cloudflare Workers»**. Kopier med en
   gang (vises kun én gang).
2. `CLOUDFLARE_ACCOUNT_ID` — vises i høyrekolonnen på **Workers & Pages**-
   oversikten i dashbordet (og i dashbord-URL-en).
3. `LENDE_AI_TOKENS` — kommaseparert liste med én GUID per bruker som skal ha
   tilgang, f.eks. `a1b2...,c3d4...`. Workflowen pusher denne videre som
   Worker-secret ved hver deploy — å legge til/fjerne en bruker er å redigere
   GitHub-secreten og kjøre workflowen på nytt.

## Oppsett fra PC (wrangler CLI — alternativ)

```bash
cd cloudflare/ai-worker
npm install
npx wrangler login
npx wrangler secret put LENDE_AI_TOKENS   # lim inn kommaseparert token-liste
npx wrangler deploy                       # skriver ut Worker-URL-en
```

Lokal test: lag `.dev.vars` med `LENDE_AI_TOKENS=test-token`, kjør
`npx wrangler dev` (Workers AI-kall går mot Cloudflare og kan koste neurons
også i dev), og:

```bash
curl -s http://localhost:8787/health
curl -s http://localhost:8787/api/ai \
  -H 'Authorization: Bearer test-token' -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Si hei på norsk"}]}'
```

---

## Sikkerhet

- **CORS er ikke tilgangskontroll** — origin-lista stopper bare andre
  nettsider i nettlesere. Tokenet er den ekte porten; uten gyldig token → 401.
- Tokens skal **aldri** committes; de bor kun i GitHub-secreten og som
  kryptert Worker-secret. `.dev.vars` er git-ignorert.
- Én token per bruker gjør at én person kan fjernes uten å bytte for alle,
  og Cloudflare-loggene viser forbruk per token ved behov.
- Workeren begrenser body-størrelse og `max_tokens`, og eksponerer kun de to
  endepunktene over — den er ingen åpen proxy.

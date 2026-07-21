# Lende NVE HydAPI-proxy (Cloudflare Worker)

En liten Cloudflare Worker som lar Lende bruke NVE HydAPI (sanntids vannføring,
vannstand, vanntemperatur) i produksjon **uten å eksponere API-nøkkelen**.
Nøkkelen bor kun som en kryptert Cloudflare-secret (`NVE_HYDAPI_KEY`); Worker-en
legger den på hvert kall server-side. Den speiler bare de to endepunktene Lende
bruker (`/api/v1/Stations` og `/api/v1/Observations`) og er ingen åpen proxy.

Klienten peker mot Worker-en via `VITE_NVE_HYDAPI_URL` (eller standard-URL-en
bakt inn i `src/lib/nveHydApi.js`).

---

## Oppsett fra mobil (Cloudflare-dashbordet — ingen kommandolinje)

1. **Skaff NVE-nøkkelen** (gratis): https://hydapi.nve.no/Users → «Create a new
   API-key». Kopier nøkkelen med en gang (den vises kun én gang).
2. Logg inn på https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Create Worker**. Gi den navnet `lende-nve-proxy` → **Deploy**.
3. Åpne Worker-en → **Edit code**. Slett malen og lim inn hele innholdet fra
   `src/index.js` i denne mappa → **Deploy**.
4. Legg inn nøkkelen som secret: Worker → **Settings** → **Variables and Secrets**
   → **Add** → navn `NVE_HYDAPI_KEY`, verdi = NVE-nøkkelen → trykk **Encrypt** →
   **Save and deploy**.
5. Noter Worker-URL-en (vises øverst, f.eks.
   `https://lende-nve-proxy.DITT-SUBDOMENE.workers.dev`). Denne bakes inn i
   `src/lib/nveHydApi.js`.

## Oppsett fra PC (wrangler CLI — alternativ)

```bash
cd cloudflare/nve-proxy
npm install
npx wrangler login
npx wrangler secret put NVE_HYDAPI_KEY   # lim inn NVE-nøkkelen
npx wrangler deploy                      # skriver ut Worker-URL-en
```

Lokal test: lag `.dev.vars` med `NVE_HYDAPI_KEY=…`, kjør `npx wrangler dev`, og
`curl 'http://localhost:8787/api/v1/Stations?Active=1'` (forvent JSON + CORS).

---

## Sikkerhet

- Nøkkelen skal **aldri** committes eller sendes i klartekst. `.dev.vars` er
  git-ignorert.
- Worker-en tillater kun `GET`/`OPTIONS` og kun de to tillatte stiene; CORS er
  begrenset til Lende-originene i `src/index.js`.

# Lende proxy-Worker (Cloudflare)

Én liten Cloudflare Worker med **to ruter**, valgt på path:

| Path | Videre til | Hvorfor |
|---|---|---|
| `/api/v1/Stations`, `/api/v1/Observations` | `hydapi.nve.no` | NVE krever en API-nøkkel. Vite inliner klient-env i den offentlige bundelen, så nøkkelen kan ikke bo i nettleseren — den ligger som kryptert secret `NVE_HYDAPI_KEY` og legges på server-side. |
| `/brukerminner/*` | `api.ra.no` | Kulturminnesøk brukerminner. Trenger **ingen** nøkkel, men klient-side-hentingen feilet i praksis (v4.8.7). Proxyen setter CORS selv, speiler opphavets statuskode og cacher i ett døgn. |

Alt annet gir 404 — Worker-en er bevisst ingen åpen proxy, og tillater bare
`GET`/`OPTIONS`. CORS er begrenset til Lende-originene i `src/index.js`.

Rutene er uavhengige: `NVE_HYDAPI_KEY` sjekkes kun på NVE-ruta, så en manglende
nøkkel stopper ikke kulturminner — og omvendt.

Klientene peker hit via standard-URL-er i `src/lib/nveHydApi.js` og
`src/lib/kulturminneFetcher.js`, overstyrbare med `VITE_NVE_HYDAPI_URL` og
`VITE_KULTURMINNE_URL`.

---

## Deploy — skjer automatisk fra GitHub

`.github/workflows/deploy-proxy.yml` deployer Workeren ved hver push til `master`
som endrer denne mappa (og kan startes manuelt fra Actions-fanen). **Ingen
kommandolinje og ingen lim-inn-i-dashbordet.** Samme mønster som `ai-worker` og
`mcp-worker`.

Workflowen pusher `NVE_HYDAPI_KEY` som Worker-secret først, deployer, og
røyktester begge rutene til slutt.

### Engangs-oppsett: én GitHub-secret

`CLOUDFLARE_API_TOKEN` og `CLOUDFLARE_ACCOUNT_ID` finnes allerede (de to andre
Workerne bruker dem). Det som mangler er NVE-nøkkelen:

1. GitHub → repoet → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**.
2. Navn: `NVE_HYDAPI_KEY`. Verdi: NVE-nøkkelen din.
   Har du den ikke lagret, lag en ny på https://hydapi.nve.no/Users →
   «Create a new API-key» (vises kun én gang).
3. Kjør workflowen **Deploy proxy-worker** på nytt fra Actions-fanen.

Mangler secreten, deployer Workeren likevel og kulturminne-ruta virker — bare
NVE-ruta svarer 500 til nøkkelen er på plass. Røyktesten sier det som en warning
i stedet for å feile.

### Navnebytte i v4.8.7 — én opprydding gjenstår

Workeren het **`lende-nve-proxy`** og heter nå **`lende-proxy`**, siden den
speiler mer enn NVE. Et navnebytte i `wrangler.toml` lager en **ny** Worker, så
den gamle lever videre til den slettes:

- Cloudflare-dashbordet → **Workers & Pages** → `lende-nve-proxy` →
  **Settings** → nederst **Delete**.

Gjør det etter at `Deploy proxy-worker` har kjørt grønt, ikke før.

Er ditt workers.dev-subdomene noe annet enn `jepedersen73`, må standard-URL-ene i
`src/lib/nveHydApi.js` og `src/lib/kulturminneFetcher.js` — og `BASE` i
røyktesten — rettes til å matche.

### Manuelt fra PC (wrangler CLI, om du vil)

```bash
cd cloudflare/proxy
npm install
npx wrangler login
npx wrangler secret put NVE_HYDAPI_KEY       # lim inn NVE-nøkkelen
npx wrangler deploy                          # skriver ut Worker-URL-en
npx wrangler delete --name lende-nve-proxy   # rydd bort den gamle
```

Lokal test: lag `.dev.vars` med `NVE_HYDAPI_KEY=…`, kjør `npx wrangler dev`, og

```bash
curl 'http://localhost:8787/api/v1/Stations?Active=1'
curl 'http://localhost:8787/brukerminner/collections/brukerminner/items?bbox=10.53,59.65,10.62,59.72&f=json&limit=5'
```

### Hva røyktesten forteller oss

Kulturminne-steget slår opp Håøya og skriver utfallet som en notice i
Actions-loggen. CI har full nettverkstilgang, så dette er målingen som ikke lot
seg gjøre fra mobil:

| Status | `X-Lende-Upstream` | Betyr |
|---|---|---|
| 200, `numberMatched` > 0 | — | Tjenesten virker. Virker det likevel ikke i appen, er det klient-siden |
| 200, `numberMatched` = 0 | — | Håøya har ingen registrerte brukerminner. «(0)» i appen er da sant |
| 599 | `unreachable` | Workeren fikk ikke opp forbindelse til `api.ra.no` i det hele tatt |
| 404 | `404` | Opphavets 404. Vedvarende → endepunktet er flyttet, `mapFeatureLight`/`mapFeatureFull` må oppdateres |
| 5xx | `<status>` | Opphavets feil, speilet. Tjenesten er nede |

`X-Lende-Upstream` finnes bare når statusen kommer fra opphavet. Det skillet er
nødvendig fordi `api.ra.no` selv ligger bak Cloudflare og returnerer feilsider som
ligner Workerens egne — i v4.8.7 ble en speilet 502 lest som «Workeren nådde ikke
fram», og røyktesten veltet deployen selv om alt vårt var i orden.

**Kulturminne-steget rapporterer, men feiler aldri jobben.** `api.ra.no` er en
tredjepart vi ikke eier; er den nede, er det ikke en feil i vår deploy. NVE-ruta og
«er det vår worker som svarer»-sjekken feiler derimot fortsatt hardt.

---

## Cache

Bare `/brukerminner/*` caches, kun vellykkede svar, i ett døgn (`RA_CACHE_S`).
Datasettet er brukerregistrerte kulturminner som endrer seg over dager, så et
døgn fjerner både mobil-timeouts og gjentatte kall for samme kartutsnitt.

Svaret har `X-Lende-Cache: hit|miss` så du kan se om det traff. Vil du tømme
cachen før TTL: Cloudflare-dashbordet → **Caching** → **Configuration** →
**Purge Everything**, eller bare vent ut døgnet.

**Merk:** OGC API Features paginerer med *absolutte* `links[rel=next]`-URL-er mot
`api.ra.no`. Worker-en skriver dem om til å peke på seg selv, ellers hadde
klienten hoppet av proxyen på side 2. Den rører bare `links[].href` —
bilde-URL-er og `linkkulturminnesok` skal peke dit de peker.

---

## Sikkerhet

- NVE-nøkkelen skal **aldri** committes eller sendes i klartekst. `.dev.vars` er
  git-ignorert.
- Worker-en tillater kun `GET`/`OPTIONS`, kun de tillatte stiene, og CORS kun for
  Lende-originene i `src/index.js`.

# Plan — kart uten å vente på Overpass

**Status: FASE 1 LEVERT.** Avtalt med eieren 1. november 2026. 1b (N50-arket)
levert i v7.9.35, 1a (veger i baken) i v7.9.36. Rekkefølgen ble snudd fordi 1b
ikke trenger en bake og gir mest med en gang. Kyst-svaret uten Overpass kom i
v7.9.37 (havmasken, se 1b), og kant-utvidelsen fikk N50-arket i v7.9.38.
**FASE 2 LEVERT i v7.9.39 (baken) og v8.0.0 (R2, Workeren og klienten).**
Kart bygges nå fra de bakte flisene, med Overpass som reserve.

## Hvorfor

Nye kart sto uten stier («Fikk ikke lastet stier og detaljer») fra slutten av
oktober 2026. Målt fra GitHub-runnere og i Chromium (v7.9.30–v7.9.32):

| Speil | Målt 1. nov. 2026 |
| --- | --- |
| overpass-api.de | 33–39 s til første byte på et 2–4 km-ark; **2 plasser per IP** (`/api/status`: «Rate limit: 2»); 429 når de er tatt |
| overpass.kumi.systems | svarer ikke (timeout) |
| overpass.openstreetmap.fr | 403 «only available to white-listed usages» / CORS-feil fra nettleser; svarer fra Node, men data fra august |
| overpass.private.coffee | 68 s, data fra juni, henger ofte |
| maps.mail.ru | 504 (aldri i appen, bare testet) |

v7.9.32 venter nå på ledig plass ved 429 og bruker ikke en plass på
tetthets-proben for ark ≤ 4 km. Det virker, men et kart tar 30–60 s, og på
mobilnett deler mange brukere samme IP (CGNAT), så de to plassene kan være tatt
over lang tid. **Overpass kan ikke lenger stå alene i den kritiske stien.**

Alternativer som ble vurdert og lagt bort: egen Overpass-server (drift og
månedskostnad), Worker-proxy med cache (fortsatt Overpass-kø, nå med én felles
IP for alle), ferdige vektorfliser à la Protomaps (generalisert — stityper og
`sac_scale` strippes, passer dårlig med ISOM-symboliseringen).

## Fase 1 — N50 i den kritiske stien (gjøres først, 2–3 PR-er)

Mål: brukbart kart på 3–8 s uansett hva Overpass gjør. OSM blir påfyll.

**1a. Veger (og ev. bygg/jernbane) inn i N50-baken.**
**LEVERT i v7.9.36** — `--lag veg` → `public/data/n50-veg/`, egen katalog.
Målt: 883 577 linjer, 199 fliser, 18,8 MB (15,2 MB gzip), største 934 KB —
langt under anslaget. Jernbanen ble med; bygg ble ikke (N50-bygg er punkter og
gir lite i et N50-ark som uansett erstattes). Vegene brukes bare i N50-arket.
Opprinnelig plan: `scripts/bygg-n50-sti.mjs`
leser alt fra `Samferdsel … senterlinje` (`Veglenke`) og kaster alt annet enn
`typeveg` sti/traktorveg/barmarksløype. Vegene ligger i samme lag. Utvid
`klassifiser` med bilveg-klassene → ISOM 501–505 (sjekk hvilke attributter som
skiller dem; Buskerud hadde `enkelBilveg` = 62 271 mot sti = 17 568).
- **Kjør `--mal` FØRST.** Anslag 30–50 MB ekstra fliser. Avgjør om vegene skal
  i egen katalog (samme grunn som `n50-vann`: manifestet er cache-nøkkelen, og
  en bake som endrer sti-flisene sender alle brukere ut i full nedlasting).
- Bygg som punkter og jernbane vurderes i samme runde.

**1b. Overpass ut av den kritiske stien** (`src/lib/createMapFlow.js`).
**LEVERT i v7.9.35** — se CLAUDE.md, «N50-arket». Kyst-svaret fikk sin
N50-vei i v7.9.37: havmasken (`lib/havmaske.js`, N50 Havflate som ~1 km-bitkart)
svarer på saltvann, og Overpass-proben er bare reserve. Kant-utvidelsen
(pilene, «Fyll hullene», «Gjør arket firkantet») fikk N50-arket i v7.9.38
(`n50Ark` i `buildMapFromCenter`). Røyk: `npm run royk:n50ark`.
I dag: `Promise.all([overpassP, n50P, nveLakesP, demPromise])` (~linje 760)
venter på OSM før fullbygget.
- Bygg et N50-ark når DEM + vann + N50 er inne og OSM ikke har kommet innen
  et kort budsjett (noen sekunder). Lagre det som kartet.
- Når OSM kommer: bygg om stille og erstatt (samme mønster som
  terreng-først → finalize, `consumeMapFinalize`).
- Feiler OSM: N50-arket står. Ny, mildere melding i stedet for
  «Kartet viser bare terreng nå» (`MapStatusOverlays.vue`), og
  «Prøv på nytt» beholdes.
- Uttynningen (`fjernGrovOsm`, Turrutebasen/N50 mot OSM) virker allerede uten
  OSM — alt blir «nye strekk». Verifiser at vann/kyst ikke antar OSM
  (`osmHasSaltwater` gater kyst-proben på OSM — må få en N50/DEM-vei).

**1c. Paritet og gater.** Samme logikk i `mcp/headless.js`. Fasit-sjekk for et
kart bygget uten OSM (stub Overpass til feil). Røyk-sjekk. `npm run navnediff`
hvis MapView røres. `npm run boot:workers` siden `src/lib` røres.

## Fase 2 — egen OSM-bake (etterpå, 4–6 PR-er)

**Versjon:** PR-en som fullfører fase 2 bumpes til **v8.0.0** (bestilt av eieren
14. nov. 2026). PR-ene underveis er patch-bumper som vanlig.

Mål: fullt OSM-innhold på sekunder, ingen tredjepart i stien. Data inntil en
uke gammel.

**Nøkkelgrep:** flisene skrives i NØYAKTIG samme JSON-form som Overpass svarer
(`elements` med `out geom`), så `mapBuilder` er urørt og bare transporten byttes.

1. **Bake-workflow** (ukentlig, senere månedlig): Geofabrik `norway-latest.osm.pbf`
   (~1,3 GB) → `osmium tags-filter` med taggene `buildOverpassQuery` ber om →
   fliser. Linjer og flater på tvers av flisgrenser dupliseres per flis og
   dedupes på id i klienten. Multipolygoner (innsjøer med øyer) må settes
   riktig sammen — **det er der feilene gjemmer seg** (jf.
   `assembleRelationRings`).
2. **Lagring i R2, ikke git** (anslag 100–250 MB komprimert). R2 er allerede i
   bruk (`lende-mcp`, opprettet av deploy-workflowen for MCP-Workeren), så
   kontoen og trolig nøklene finnes. Trengs: egen bøtte eller prefiks med
   offentlig lesing + CORS for `gitjanerik.github.io`. Se `docs/R2_FLISLAGER.md`
   for premissene rundt R2 og flis-gitter.
3. **Klient:** hent fliser for bboksen, slå sammen, Overpass bare der fliser
   mangler. Uversjonert SW-cache med manifest-hash som nøkkel, som
   `lende-n50` (`lib/n50FlisNokkel.js`).
4. **Verifisering:** fasit-kartene bygget fra fliser mot fra Overpass — samme
   tall innenfor toleranse.

### Slik ble fase 2 (v7.9.39 + v8.0.0)

- **Gitter 0,05° × 0,1° (~5,5 km).** Første måling med det dobbelte ga 9 MB
  gzip for Oslo-flisa; nå er den 3 MB, og et vanlig flis er noen få KB.
- **Elementer går i flisene STREKENE krysser**, ikke alle flisene boksen
  dekker, og klienten bruker Overpass' egen regel for hva som er med i et kart.
  Målt mot Overpass rundt Vardåsen og Drøbak: 0 mangler, 0 ekstra.
- **Store elementer i flere fliser lagres én gang** (`delt/`), og flisene peker
  på dem. Tyrifjorden alene er 107 KB × 19 fliser.
- **Pakket i R2, ikke én fil per flis.** Cloudflares API tar 1 200 kall per fem
  minutter; titusenvis av fliser ville tatt timer å laste opp. Pakkene er
  1° × 1° med en indeks (`lib/osmPakke.js`), og proxy-Workeren leser ut én flis
  med en range-GET. Manifestet skrives sist og peker på baken, så en halv
  opplasting aldri blandes med en hel.
- **Klienten** (`lib/osmKilde.js` → `lib/osmFlisFetcher.js`) prøver flisene
  med en frist på 15 s og faller til Overpass. `meta.osmStatus` sier hvem som
  svarte (Utvikler-fanen). Flisene caches i `lende-osm`, nøklet på baken.
- **Månedlig bake** (den 1., 02:23 UTC — `OSM_BAKE_PLAN` i `lib/osmFlis.js`
  og cron-en holdes like av en test). Planen sa ukentlig; eieren valgte
  månedlig, og data er altså inntil en måned gammel. Datoen for siste bake
  (`osmTid` i manifestet) står nederst i hovedmenyen og i «Om appen», som
  også viser neste kjøring.
- **Verifisering:** PR-er som rører baken bygger fasit-kartene fra både
  Overpass og flisene og krever samme tall (`fasit-kart.js --mot`).

## Rekkefølge

Fase 1 først: den løser brukerproblemet raskest, og den blir værende som
sikkerhetsnett også etter fase 2.

# Server-bygde kartfliser i R2 — utredning

Skal Lende bygge kartfliser på Cloudflare og lagre dem i R2, i stedet for å
bygge hver flis på telefonen? Utredningen er bestilt fordi appen nå laster
nabofliser automatisk mens brukeren panorerer, og spørsmålet er om skyen bør
overta byggejobben.

Dette er en beslutnings-skisse. **Ingenting av det som beskrives under er
bygget**, og konklusjonen er at det heller ikke skal bygges nå — men premissene
er verdt å skrive ned, fordi de fleste av dem er ikke-åpenbare og flere av dem
kan velte ideen hver for seg.

---

## Utgangspunkt — hva som allerede finnes

Tre ting er på plass, og de er grunnen til at spørsmålet i det hele tatt er
rimelig å stille:

- **Headless kart-bygging kjører allerede i workerd.** `mcp/headless.js`
  (`buildMapHeadless`) bygger et komplett kart uten DOM, og
  `cloudflare/mcp-worker` bundler både den og `src/lib` inn i Workeren.
  `bygg_kart` gjør nøyaktig dette i dag, i produksjon.
- **R2 er allerede i bruk som kart-lager.** Bucketen `lende-mcp` holder bygde
  MCP-kart under `kart/<ref>/{kart.svg,dem.bin,meta.json,…}` og utdata under
  `ut/<ref>/…` (`cloudflare/mcp-worker/src/kartlager.js`). Bucketen opprettes
  idempotent av deploy-workflowen.
- **Klienten har en flis-modell med eksplisitt gitter-geometri.**
  `src/lib/tileCache.js` definerer `tileOffset` (plassering av nabo i aktiv
  flis' meter-rom) og `tilesAreGridCompatible` (lik størrelse innen 1 m **og**
  origo-delta ≡ 0 mod flis-størrelse). Fliser markert `isAuto` er en ren cache
  kappet til `MAX_AUTO_TILES = 16`.

Standardflisa for nye kart er **8 × 8 km** kvadratisk
(`DEFAULT_MAP_WIDTH_KM = 8`, `useMapSizePreference.js`), med 20 m ekvidistanse.
Kant-utvidelsen arver aktiv flis' bredde, aspekt og ekvidistanse
(`autoMapBuildOpts` i `useMapExtend.js`), så en utvidelses-flis er like stor som
den brukeren står på.

---

## Hva gevinsten faktisk er — radio-bytes, ikke CPU

Den intuitive begrunnelsen («telefonen er treg, la skyen gjøre jobben») holder
ikke. **Appen fryser ikke i dag.** `buildSvg` kjører allerede i en Web Worker
via `buildSvgClient`, så det tunge geometri-passet ligger utenfor hovedtråden.
Å flytte CPU-arbeidet til Cloudflare løser et problem appen ikke har.

Det server-bygging faktisk sparer er **nettverket**. En flis-bygging i dag
laster ned, over brukerens 4G:

| Kilde | Hva som hentes | Størrelsesorden |
| --- | --- | --- |
| Overpass | OSM-JSON for hele bboksen | 0,4–5 MB (målt: 448 KB i Lierne, 5,2 MB i Oslo sentrum ved 8 km) |
| Kartverket WCS | DTM + DOM som GeoTIFF | flere MB ved 5 m oppløsning over 8 × 8 km |
| NVE / N50 / Sjøkart / Turrutebasen / N50-sti | vann, ruter, stinett | mindre, men flere rundturer |

Mot det står **én nedlasting av en ferdig flis**. Lagret SVG er ~1–5 MB
(`tileCache.js`-kommentaren) pluss ~160 KB pakket DEM; med gzip/brotli over
nett er ~1,5 MB et rimelig anslag for en typisk flis, men **det er ikke målt**
og bør ikke brukes som annet enn en størrelsesorden.

På et fjell med to streker dekning er dette forskjellen på om utvidelsen
fullfører i det hele tatt — ikke på om den føles rask. Og siden flisa lagres
lokalt og overlever `pruneAutoTiles` (cachen kappes til 16 fliser, de fjerneste
først), blir et gjenbesøk til et område brukeren har vært i en **nedlasting**
i stedet for en ny bygging.

### Hva gevinsten *ikke* er

**Delt cache mellom brukere er verdiløs her.** Lende er ett privat prosjekt med
noen inviterte brukere. Sannsynligheten for at to brukere ber om nøyaktig samme
gitter-celle er tilnærmet null, og en plan som selges på treffrate mellom
brukere selger noe den ikke kan levere. Den eneste treffraten som betyr noe er
**samme bruker, samme celle, senere** — altså et arkiv, ikke en delt cache.

---

## To målinger som må gjøres FØR noe bygges

Begge kan velte premisset hver for seg. Ingen av dem er gjort.

### 1. CPU-proben — tåler Workeren en 8 × 8 km-flis?

Deploy-røyktesten (`.github/workflows/deploy-mcp-worker.yml`) bygger i dag
Vardåsen med `halfKm: 0.5`, altså **1 × 1 km**. Standardflisa er 8 × 8 km —
**64 ganger arealet**. Worker-koden har allerede et tak på `halfKm ≤ 10`
(`MAX_HALF_KM_REMOTE` i `verktoyKart.js`) med begrunnelsen «CPU-grensen på
Workers Paid er 30 s», men taket er satt etter resonnement, ikke etter en
måling på standardstørrelsen.

Merk forskjellen som er lett å bomme på: Worker-README-en oppgir «~15–30 s
totalt» for et 2 × 2 km-kart — det er **veggklokke**, og det meste av den tiden
er venting på Overpass og WCS. Cloudflare-grensen gjelder **CPU-tid**, som ikke
belastes mens Workeren venter på I/O. De to tallene er ikke sammenlignbare, og
det er nettopp derfor målingen må gjøres i stedet for regnes ut.

**Målingen:** bygg én 8 × 8 km-flis gjennom `bygg_kart` mot den deployede
Workeren og les CPU-tiden i Cloudflare-loggen (ikke responstiden).

**Vurderingskriterium:** over 30 s CPU → ideen kollapser for standardstørrelsen.
Da gjenstår bare mindre fliser eller en oppdelt/asynkron bygging, og begge
endrer regnestykket så mye at utredningen må gjøres på nytt.

### 2. Fordelingsmålingen — hvor går tiden på ekte 4G?

`createMapFlow` logger allerede én linje per bygg:

```
[perf] kart 8.0km total … | tetthet … | overpass … | n50 … | nve … | dem … |
       sjøkart … | turrute … | n50sti … | buildSvg … [ms]
```

**Målingen:** kjør én kant-utvidelse på en ekte telefon på 4G og les linja.

**Vurderingskriterium:** er totalen dominert av `overpass`, er gevinsten mindre
enn den ser ut — for **serveren må betale den samme ventingen**. Den eneste
forskjellen er at Cloudflares vei til Overpass er bedre enn telefonens, og at
svaret ikke må over radioen. Det er en reell gevinst, men en langt mindre enn
«flytt byggingen til skyen» antyder. Er det derimot `dem` og nedlastings-
volumet som dominerer, er premisset styrket.

---

## Cache-nøkkelen er hele lønnsomheten

Dette er det punktet som avgjør om en R2-bøtte er verdt noe eller står tom.

Repoet **bumper `APP_VERSION` i hver eneste PR** — det er en konvensjon i
`CLAUDE.md`, håndhevet i fire filer. Og `tileIsCurrent` (`tileCache.js`)
forkaster auto-fliser bygd med en annen app-versjon:

```js
export function tileIsCurrent(entry, appVersion) {
  if (!entry?.isAuto) return true
  return entry.appVersion === appVersion
}
```

Regelen er riktig og har en historie: den kom av «innsjøer borte»-saken
2026-07-20, der en cache av ark bygd med gammel kode serverte gamle data inn i
«helt nye» kart.

Konsekvensen for R2 er absolutt: **nøkles bøtta på `appVersion`, er treffraten
tilnærmet 0 %.** Hver PR ugyldiggjør hele lageret, og bøtta koster lagring uten
noen gang å svare på et treff. Hele gevinsten forsvinner.

Nøkkelen må derfor bruke en egen **`KART_PIPELINE_VERSJON`** som bare bumpes når
byggingen faktisk endres — ikke når UI-et, 3D-viseren eller ruteplanleggeren
endres.

### Og den må ikke kunne glemmes

En manuelt vedlikeholdt pipeline-versjon er en tikkende bombe med nøyaktig den
feilmodusen prosjektet allerede har brent seg på: glemmes bumpen, serverer R2
fliser bygd med gammel pipeline inn i en ny app — «innsjøer borte»-saken om
igjen, denne gangen fra skyen, og uten at `tileIsCurrent` fanger den (flisa er
jo «gyldig» etter R2-nøkkelen).

Den bør derfor **utledes i CI** som en hash over en eksplisitt fil-liste — de
filene som faktisk bestemmer kart-innholdet (`mapBuilder.js`, `symbolizer.js`,
`isomCatalog.json`, `dem.js`, `vannMerge.js`, fetcherne, `mcp/headless.js`).
En eksplisitt liste, ikke et glob over `src/lib`, så en endring i
ruteplanleggeren ikke tømmer bøtta uten grunn. Deploy-workflowen har allerede
en beslektet path-filter-liste (`src/lib/**`, `mcp/headless.js`) å ta
utgangspunkt i.

### Nøkkelform

```
flis/<pipelineVersjon>/<minE>_<minN>_<W>x<H>_e<equi>/{meta.json,kart.svg,dem.bin}
```

Alle tall i **heltalls meter** (UTM32-hjørne, bredde, høyde, ekvidistanse). Det
gjør nøkkelen identisk for to klienter som ber om samme celle, og trivielt
idempotent: samme input → samme nøkkel → les-gjennom-cache uten koordinering.
`createMapFlow` snapper allerede UTM-bboksen til DEM-oppløsningens rutenett
(`snapUtmBboxToGrid`), så heltalls-meter er ikke en ny begrensning.

Livssyklus-regelen: **slett under prefikset `flis/` etter 60 dager**. Regelen må
være **scopet til prefikset** — en bøtte-global regel ville spist MCP-kartene
under `kart/` og utdataene under `ut/`, som er ordentlige artefakter med
kartRef-er brukere og agenter holder på.

---

## Frarådes — med begrunnelse

### Kanonisk globalt flis-gitter

Fristende, men ødeleggende. `tilesAreGridCompatible` krever **lik størrelse OG
modulo-null offset**. I dag defineres gitteret av brukerens *første* flis:
kant-utvidelsen arver bredde og aspekt fra den, så alt henger sammen.

Innfører man et kanonisk globalt gitter for utvidelsesfliser, blir de
inkompatible med brukerens egen første flis — og **hver eksisterende lagret flis
blir ubrukelig som nabo**. Mosaikken slutter å virke for alt som allerede er
bygd.

Snapper man også *første* flis til det kanoniske gitteret, flyttes brukerens
kart opptil en halv flis (4 km ved standardstørrelse) fra punktet de trykket på.
«Bygg kart her» slutter å bety *her*. Det er en dårlig byttehandel for en
cache-treffrate som uansett er ~1 bruker.

### Å nøkle på `appVersion`

Se over. Treffrate ~0 %, tom bøtte, all kostnad og ingen gevinst.

### Durable Objects eller Queues

Bevisst valgt bort allerede i `docs/MCP_REMOTE_CHAT.md`, der tilstandsvalget
landet på den tilstandsløse modellen med R2 som bærer. Et les-gjennom-cache med
en idempotent nøkkel trenger **ingen koordinering**: to samtidige forespørsler
om samme celle bygger den to ganger og skriver samme objekt to ganger. Det er
sløsing, ikke en feil, og prisen for å unngå det er en helt ny
infrastruktur-primitiv.

### Endepunktet i `lende-proxy`

Proxy-Workeren er liten og har ingen `src/lib`-bundel. Å legge flis-bygging der
ville krevd en **andre** bundel av `src/lib` + `mcp/headless.js` — altså en
andre overflate for den workerd-feilklassen som brakk **hver eneste deploy av
MCP-Workeren fra v5.0.16 til v5.18.2** (`import.meta.url` er undefined i
workerd, og modulnivå-kode kjører ved oppstart). Gaten som fanger det
(`npm run boot:workers`) finnes nå, men det er ingen grunn til å doble
angrepsflaten. Flis-bygging hører hjemme i `lende-mcp`, som allerede har
bundelen, R2-bindingen og token-sjekken.

### Å laste den lokalt bygde SVG-en opp til R2

To problemer. Det ene er tillit: innhold som ikke er verifisert av noe havner i
cachen og serveres videre til andre klienter (og til brukeren selv etter en
app-oppdatering). Det andre er praktisk: 1–5 MB **opplasting** på 4G er dyrere
enn nedlastingen man prøver å spare, og mobilt opplink er typisk den svakeste
retningen.

---

## Autentisering, hvis det noen gang bygges

Appen har allerede formen som trengs, og den skal gjenbrukes uendret:
`src/lib/lendeAi.js` plukker `?ai-token=<guid>` fra en delt lenke ved oppstart,
lagrer den i `localStorage` (`lende-ai-token`) og stripper den fra URL-en.
Tokenet valideres mot samme `LENDE_AI_TOKENS`-secret som `lende-mcp` bruker.
**Ingenting ligger i bundelen.**

Gaten bør splittes etter hva operasjonen koster:

| Rute | Tilgang | Begrunnelse |
| --- | --- | --- |
| `GET /flis/…` | Åpen, med CORS | Leser bare ferdige objekter avledet av offentlige kilder (Kartverket, OSM, N50, NVE). R2 Class B-operasjoner er gratis til 10 M/mnd, så en åpen lese-rute er ikke en kostnadsrisiko. |
| `POST /flis` | Token-gatet | Brenner CPU og skriver til bøtta. Dette er den dyre operasjonen, og den skal ha samme port som resten. |

---

## Forutsetning som er løst: N50-stinettet i workerd

Fram til nylig var dette en **hard blokker**, og det er verdt å forstå hvorfor.

N50-stinettet (179 706 km sti/traktorveg, 208 fliser) ligger som statiske filer
i `public/data/n50-sti/`. `mcp/headless.js` fant dem via `import.meta.url` —
som er undefined i workerd. Resultatet var at MCP-Workeren bygde **hvert eneste
kart uten N50-stier, helt stille**, siden `fetchN50StiLinjer` aldri feiler hardt.

For en flis-tjeneste ville det vært ødeleggende: OSM er tynt i norsk utmark
(nærmeste OSM-linje til Trettekollen ligger 478 m fra toppen). En server-bygd
flis uten N50-stier er **dårligere enn en klient-bygd**, og siden fliser limes
sammen til én mosaikk ville den forgiftet arket — nabofliser med tomt stinett
inntil en aktiv flis med fullt stinett, uten at noe i UI-et forklarer hvorfor
stiene stopper ved en flisegrense. Stifinneren ville også rutet rundt hull som
ikke finnes i virkeligheten.

**Dette er løst i samme leveranse som denne utredningen.** `buildMapHeadless`
tar nå en `n50StiBase`-opsjon, og Workeren sender HTTPS-adressen til nøyaktig de
samme filene appen bruker (`N50_STI_BASE` i `wrangler.toml`, som peker på
GitHub Pages). Leseren velges på protokoll: `file:`-URL-er går gjennom
disk-leseren (Node/stdio/fasit), `https:` gjennom fetcherens egen. Server- og
klient-bygde kart får dermed identisk N50-innhold — som er nøyaktig kravet en
flis-tjeneste stiller.

Deploy-røyktesten sjekker nå N50-utfallet direkte (`state: ok` og
`linjer > 0`), ikke `totalStiKm` — det tallet får bidrag fra OSM også, så et
gulv der ville stått grønt selv med tomt N50-nett. Regresjonen kan altså ikke
komme tilbake i stillhet.

---

## Minste eksperiment, hvis det skal prøves senere

Ikke skriv et endepunkt. Kall `buildMapHeadless` med en **eksplisitt `utmBbox`**
som matcher en flis klienten allerede har bygd, og verifiser med appens egne
regler:

```js
tilesAreGridCompatible(klientflis, serverflis) === true
tileOffset(klientflis, serverflis)             // → { dx: 0, dy: 0 }
```

Det er presist, gratis og bruker appens egen definisjon av «passer denne flisa
inn i mosaikken» som fasit — ikke en ny sannhet skrevet for anledningen. Er den
ikke grønn, er hele ideen død uansett hva målingene sier.

**Bygg ingenting mer før den er grønn.**

---

## Anbefaling

**Ikke bygg dette nå.**

Klient-siden er nettopp gjort vesentlig billigere: relieffet er flyttet ut av
den kritiske stien, nabofliser bruker vektor-relieff fra flisas egen DEM i
stedet for hillshade-PNG, og mosaikken holder maks 12 fliser i DOM-en innenfor
tre flis-bredder — resten er verken tegnet eller lastet. Problemet
server-bygging skulle løse er dermed mindre enn da spørsmålet ble stilt, og
ingen har målt hvor mye mindre.

**De to målingene må foreligge før noen skriver et endepunkt.** CPU-proben kan
avlyse ideen for standardstørrelsen alene, og fordelingsmålingen kan vise at
gevinsten er en brøkdel av det den ser ut som. Å bygge først og måle etterpå
ville her betydd å bygge en tjeneste hvis eneste eksistensberettigelse er
umålt.

Om spørsmålet tas opp igjen, er den riktige innrammingen dessuten en annen enn
den bestilte. **R2 er mest interessant som et rent flis-ARKIV** — «last ned
igjen en flis du har bygd før» — der gevinsten er konkret, treffraten er
forståelig (samme bruker, samme celle) og cache-nøkkelen er det eneste virkelig
vanskelige. **Den er minst interessant som byggetjeneste**, der gevinsten deles
med en server som må betale den samme Overpass-ventingen, og der hver ny flis
koster CPU-tid ingen har målt.

Rekkefølgen, om det noen gang skal skje: måling → `KART_PIPELINE_VERSJON` utledet
i CI → gitter-eksperimentet over → deretter, og først da, et endepunkt.

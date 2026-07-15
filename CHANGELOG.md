# Endringslogg

## 2026-07-15 — v1.0.7: Opprydning — status/feil-overlays skilt ut

Fjerde steg i oppdelingen av `MapView.vue`: de transiente status- og feil-
overlayene (kart-skjelett/laste-pille, «kunne ikke laste», posisjons-status,
«utenfor kartet», detalj-feil og lav GPS-nøyaktighet) er samlet i
`src/components/MapStatusOverlays.vue`. Komponenten tar imot all tilstand som
props og sender ut handlinger (`retry-load`, `retry-details`, `dismiss-*`),
og reproduserer de tre uavhengige v-if/v-else-if-kjedene internt.
Lasteskjelettets scoped-CSS følger med til komponenten. Ingen funksjonell
endring.

---

## 2026-07-15 — v1.0.6: Opprydning — søke-overlay skilt ut

Tredje steg i oppdelingen av `MapView.vue`: søke-overlayet (søkefelt +
treffliste med Nominatim-fallback) er trukket ut til
`src/components/MapSearchOverlay.vue`. Komponenten er presentasjonell — den
tar imot søketilstand som props (`open`, `query`, `results`, `active-index`,
globale treff) og sender ut intensjoner (`select`, `select-global`, `close`,
`keydown`), mens all logikk (indeksering, sentrering, bygg nytt kart,
highlight) blir i forelderen. `query` og `active-index` er toveis via
`v-model`. Komponenten eier sin egen fade-transition og fokuserer feltet når
det åpnes, så `searchInputRef` er borte fra `MapView.vue`. Ingen funksjonell
endring.

---

## 2026-07-15 — v1.0.5: Opprydning — perf-logg-modal skilt ut

Andre steg i oppdelingen av `MapView.vue`: perf-logg-modalen (byggetider fra
localStorage, kun tilgjengelig fra Utvikler-fanen) er trukket ut til
`src/components/PerfLogModal.vue`. Komponenten eier hele perf-logg-konseptet —
den henter og tømmer loggen selv — og forelderen styrer bare synligheten via
`v-model:open`. Både `getPerfLog`/`clearPerfLog`-importen og de fire
hjelpefunksjonene er dermed borte fra `MapView.vue`. Ingen funksjonell endring.

---

## 2026-07-15 — v1.0.4: Opprydning — høydeprofil-modal skilt ut

Første steg i å bryte den massive `MapView.vue` (9000+ linjer) i mindre biter:
den store høydeprofil-modalen som åpnes ved tap på en turs sparkline er trukket
ut til en egen presentasjonskomponent, `src/components/TrackElevationSheet.vue`.
Komponenten tar imot valgt spor og en ferdig beregnet profil som props og
sender ut `close`; forelderen eier fortsatt DEM-en og profil-cachen. Ingen
funksjonell endring — ren strukturell opprydning som etablerer props-inn/
emit-ut-mønsteret for videre oppdeling.

---

Lende fikk et eget ikon tegnet i kartets eget språk: konsentriske høydekurver i
ISOM-konturbrun på kremgul land (ISOM 001), med toppen forskjøvet opp mot høyre
for en ekte terreng-følelse. Det erstatter det arvede svg-insights-ikonet (gul
topplinje på skifergrå), som var laget for tegneverktøyet, ikke et turkart. Hele
merket ligger innenfor maskable-sirkelen, så ingenting klippes på Android. Nye
`icon.svg` og `favicon.svg` (ren SVG) er kilden; PNG-ene (192/512/maskable-512
og apple-touch 180) er rasterisert fra `icon.svg`.

---

## 2026-07-15 — v1.0.2: «Installer som app» på forsiden

Forsiden (`MapHomeView`) fikk en «Installer som app»-knapp. Den kobler på den
eksisterende composablen `usePwaInstall` (samme som `MapPickerView` og
`GravelPlannerView` bruker), så ingen ny install-logikk er skrevet. Knappen
vises kun når nettleseren faktisk tilbyr PWA-install (Chrome/Edge/Android) eller
på iOS (der den viser en kort manuell veiledning via Del-menyen), og skjules når
appen allerede kjører installert. Klikk gir først en bekreftelses-dialog
(«Installer Lende som webapp?») før nettleserens egen install-prompt utløses.

---

## 2026-07-15 — v1.0.1: Automatisk root-sjekk etter deploy

Deploy-workflowen (`build-vardasen-map.yml`) fikk et nytt steg som poller
`https://gitjanerik.github.io/lende/` etter push til `gh-pages` og feiler
bygget hvis root ikke svarer 200 innen ~200 sekunder. Bakgrunn: innholdet
deployes korrekt til `gh-pages` (index.html, assets, `.nojekyll`, `404.html`),
men en manglende Pages-aktivering ga 404 på selve siden uten at noe fanget det.
Sjekken gjør slike konfigurasjonsbrudd synlige i CI med en tydelig feilmelding
som peker på Settings → Pages. CI har full nettverkstilgang, så dette
verifiseres faktisk der (det kan ikke sjekkes fra sandkassen).

---

## 2026-07-15 — v1.0.0: Lende fødes — kart og ruteplanlegging skilt ut fra svg-insights

Lende er en rendyrket turkart- og ruteplanleggingsapp, skilt ut fra
`gitjanerik/svg-insights` (v12.1.67). Kart-sporet — hele ISOM-pipelinen
(Kartverket WCS DTM/DOM, OSM Overpass, N50, Sjøkart, NVE, Naturbase, GBIF),
ruteplanleggeren med GPX-eksport, MCP-serveren og ~75 testfiler — er flyttet
over uendret i funksjon. Tegne- og font-sporene ble igjen i svg-insights, og
CurveBall-spillet er fjernet. Nytt: forenklede URL-er (`/` er kart-hjem,
`/nytt`, `/rute`), egne lagringsnavn (`lende-*` for IndexedDB og
localStorage — kart fra svg-insights følger ikke med), og `base: /lende/` på
GitHub Pages. Historikk før v1.0.0 ligger i svg-insights sin git-logg.

---

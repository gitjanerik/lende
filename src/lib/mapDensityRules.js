// Tetthets-regler — delt mellom kart-pickeren, createMapFlow og MCP-serverens
// bygg_kart, etter samme mønster som equidistanceRules.js, så reglene ikke
// driver fra hverandre mellom appen og MCP.
//
// ── Hvorfor ────────────────────────────────────────────────────────────────
// Samme innstilling (8 km) gir vidt forskjellige kart, målt headless:
//
//   Lierne/Stormoen    448 KB    611 path,   16 use,  197 text
//   Vardåsen          2711 KB   3032 path,  844 use,  515 text
//   Asker/Bondi       ~2700 KB  (samme tetthet som Vardåsen)
//   Oslo sentrum      5166 KB   4481 path, 3524 use,  934 text
//
// Forskjellen er datamengden, ikke arealet. Uten en måling kan flyten ikke
// gjøre annet enn å bygge alt og håpe.
//
// ── Modellen ───────────────────────────────────────────────────────────────
// Vi holder oss til noe enkelt og forklarbart, ikke en tilpasset regresjon:
//
//   kostnad = tetthetsIndeks × areal × nivåfaktor   ≤   KOSTNADSBUDSJETT
//
// Vektene i indeksen kommer fra hva laget faktisk KOSTER i de målte filene
// (ikke fra kurvetilpasning): bygninger smeltes sammen til én bymasse-flate og
// er billige per stk, veier drar byte men bucketes til få elementer, mens hvert
// punktsymbol og hvert navn blir sin egen DOM-node.
//
// Rekkefølgen er bevisst: arealet brukeren ba om er det SISTE vi gir opp.
//   1. DETALJNIVÅ — finn det lettes nivået som holder budsjettet.
//   2. AREAL      — bare hvis selv `sparsom` ikke holder, klampes bredden.
//
// Kalibrert med scripts/kalibrer-tetthet.mjs. Endrer du tallene, kjør det på
// nytt — regresjonskravet er at Vardåsen og Lierne skal komme ut UENDRET.

// ── Tetthetsindeks ─────────────────────────────────────────────────────────

// Vekt per sondert feature, i «kostnadsenheter». Utledet fra byte-målingene:
//   bygning 0.1 — 47 759 bygninger i Oslo blir ÉN bymasse-flate + 1 485
//                 enkeltbygg; laget er 2,1 % av filen. Billig per stk.
//   vei     1   — drar byte (vei-liten er 15 % av filen) men bucketes per
//                 1024 m-celle, så elementtallet metter.
//   punkt   3   — parkering/holdeplass/kulturminne/fredet blir ett <use> +
//                 <g transform> hver, og havner i cull-indeksen.
//   sted    3   — hvert stedsnavn er en <text>-node med getBBox-kostnad.
export const KOSTNAD_VEKT = Object.freeze({
  bygning: 0.1, vei: 1, parkering: 3, holdeplass: 3, kulturminne: 3, fredet: 3, sted: 3,
})

/**
 * Vektet datatetthet for et utsnitt, i kostnadsenheter per km².
 * Målt: Lierne ≈ 4,5 · Vardåsen ≈ 255 · Asker ≈ 252 · Oslo sentrum ≈ 915.
 */
export function tetthetsIndeks(counts, arealKm2) {
  const areal = Number(arealKm2)
  if (!counts || !Number.isFinite(areal) || areal <= 0) return 0
  let sum = 0
  for (const [key, vekt] of Object.entries(KOSTNAD_VEKT)) {
    const n = Number(counts[key])
    if (Number.isFinite(n) && n > 0) sum += n * vekt
  }
  return sum / areal
}

// Grensene er satt fra de fire målte områdene: Vardåsen (255) og Asker (252)
// skal havne i «middels» og beholde FULL detalj — de er referansekartene og
// oppleves greie i dag. Oslo sentrum (915) skal havne i «svært tett».
export const TETTHET_GRENSER = Object.freeze({ middels: 150, tett: 400, svaertTett: 700 })

export function tetthetsklasse(indeks) {
  const d = Number(indeks)
  if (!Number.isFinite(d) || d < 0) return 'åpen'
  if (d >= TETTHET_GRENSER.svaertTett) return 'svært tett'
  if (d >= TETTHET_GRENSER.tett) return 'tett'
  if (d >= TETTHET_GRENSER.middels) return 'middels'
  return 'åpen'
}

// ── Detaljnivåer ───────────────────────────────────────────────────────────

export const DETALJ_NIVAAER = Object.freeze(['full', 'lett', 'sparsom'])

// Hvor stor andel av kostnaden som står igjen på hvert nivå. Utledet fra
// byte-målingene i Oslo: `lett` dropper kraftlinje (232 KB) og tynner bom
// (180→~40 KB) og bro (325→~90 KB); `sparsom` dropper i tillegg service-veier
// (brorparten av vei-liten på 786 KB), bygningsnavn og grend-navn.
export const NIVAA_FAKTOR = Object.freeze({ full: 1.0, lett: 0.75, sparsom: 0.55 })

// Minste avstand (meter) mellom to symboler av samme slag. `full` = dagens
// verdier, uendret — et åpent område skal bygges byte-likt med før. 0 betyr
// «ingen uttynning» (dagens oppførsel for bom og bro).
//
// 120 m er 12 mm på trykk ved 1:10 000, altså god klaring mellom naboer; ingen
// av verdiene gjør symbolet utydelig som stedsangivelse.
export const SEPARASJONER = Object.freeze({
  full:    Object.freeze({ parkering:  50, holdeplass:  25, kulturminne:  30, fredet: 25, bom:   0, bro:  0 }),
  lett:    Object.freeze({ parkering: 100, holdeplass:  60, kulturminne:  60, fredet: 50, bom:  60, bro: 40 }),
  sparsom: Object.freeze({ parkering: 150, holdeplass: 120, kulturminne: 100, fredet: 75, bom: 120, bro: 80 }),
})

// Lag som droppes helt. Alle er valgt fordi de er STØY på et turkart i tett
// bebyggelse, ikke fordi de tilfeldigvis er store:
//   kraftlinje      — 232 KB i Oslo, ingen navigasjonsverdi i by
//   servicevei      — highway=service er innkjørsler og parkeringsganger
//   hytte-navn      — bygningsnavn er nyttige i marka, uleselig teppe i by
//   stedsnavn-minor — grend/gård-navn, allerede zoom-gatet i CSS
//   dybdepunkt      — soundings; skjult detalj-lag som likevel koster byte
export const NIVAA_DROPP = Object.freeze({
  full:    Object.freeze([]),
  lett:    Object.freeze(['kraftlinje']),
  sparsom: Object.freeze(['kraftlinje', 'servicevei', 'hytte-navn', 'stedsnavn-minor', 'dybdepunkt']),
})

// Tak på antall kontur-tall (høydetall langs kurvene). Dagens verdi er 80.
export const KONTUR_TALL_TAK = Object.freeze({ full: 80, lett: 50, sparsom: 30 })

/** Separasjonene for et nivå. Ukjent nivå → `full` (dagens oppførsel). */
export function separasjonerFor(nivaa) {
  return SEPARASJONER[nivaa] ?? SEPARASJONER.full
}

/** Er laget droppet på dette nivået? */
export function erDroppet(lag, nivaa) {
  return (NIVAA_DROPP[nivaa] ?? NIVAA_DROPP.full).includes(lag)
}

/** Kontur-tall-taket for et nivå. */
export function konturTallTakFor(nivaa) {
  return KONTUR_TALL_TAK[nivaa] ?? KONTUR_TALL_TAK.full
}

// ── Budsjett og beslutning ─────────────────────────────────────────────────

// Taket for `indeks × areal × nivåfaktor`. Satt fra målingene: Vardåsen på
// 8 km lander på 255 × 64 = 16 320 og skal gå gjennom med full detalj, så
// taket må ligge over det. Oslo på 8 km lander på 915 × 64 = 58 560 og skal
// ikke gå gjennom selv på `sparsom` (32 208).
export const KOSTNADSBUDSJETT = 20000

export const BREDDE_STEG_KM = 0.5   // pickerens slider-steg (halfKm-steg 0,25)
export const BREDDE_MIN_KM = 1
export const BREDDE_MAKS_KM = 16

/** Kostnaden for et utsnitt på et gitt detaljnivå. */
export function kostnad(indeks, arealKm2, nivaa = 'full') {
  const d = Number(indeks), a = Number(arealKm2)
  if (!Number.isFinite(d) || !Number.isFinite(a) || d <= 0 || a <= 0) return 0
  return d * a * (NIVAA_FAKTOR[nivaa] ?? 1)
}

/**
 * Trinn 1: det LETTESTE nivået som holder budsjettet for ønsket areal.
 * Holder ingen av dem, returneres `sparsom` — da tar trinn 2 over.
 */
export function detaljNivaaFor(indeks, arealKm2, { budsjett = KOSTNADSBUDSJETT } = {}) {
  for (const nivaa of DETALJ_NIVAAER) {
    if (kostnad(indeks, arealKm2, nivaa) <= budsjett) return nivaa
  }
  return 'sparsom'
}

/**
 * Trinn 2: største kartbredde (km) som holder budsjettet ved gitt tetthet og
 * detaljnivå. Kostnaden vokser med arealet, altså med bredde² for et kvadrat,
 * så taket er ∝ 1/√tetthet.
 *
 * `aspect` (høyde/bredde) tas med — et portrettkart er opptil 2,2× så stort
 * som et kvadrat på samme bredde, og må derfor få et lavere bredde-tak.
 *
 * Returnerer alltid en verdi slideren kan stå på (rundet NED til
 * BREDDE_STEG_KM), klampet til [BREDDE_MIN_KM, BREDDE_MAKS_KM].
 */
export function maxWidthKmFor(indeks, nivaa = 'sparsom', {
  budsjett = KOSTNADSBUDSJETT, aspect = 1, minKm = BREDDE_MIN_KM, maksKm = BREDDE_MAKS_KM,
} = {}) {
  const d = Number(indeks)
  if (!Number.isFinite(d) || d <= 0) return maksKm
  const asp = Number.isFinite(Number(aspect)) && Number(aspect) > 0 ? Number(aspect) : 1
  const faktor = NIVAA_FAKTOR[nivaa] ?? 1
  const arealTak = budsjett / (d * faktor)          // km² vi har råd til
  const bredde = Math.sqrt(arealTak / asp)          // areal = bredde² × aspect
  const rundet = Math.floor(bredde / BREDDE_STEG_KM) * BREDDE_STEG_KM
  return Math.max(minKm, Math.min(maksKm, rundet))
}

/**
 * Hele beslutningen for et utsnitt — én funksjon både appen og MCP kaller, så
 * ingen kan glemme trinn-rekkefølgen.
 *
 * @param probe     resultat fra probeDensity(), eller null/undefined
 * @param breddeKm  ønsket kartbredde i km
 * @param aspect    høyde/bredde for formatet
 * @returns null når det ikke finnes sondering — kalleren skal da oppføre seg
 *          akkurat som før tetthets-reglene fantes.
 */
export function tetthetsBeslutning(probe, {
  breddeKm, aspect = 1, budsjett = KOSTNADSBUDSJETT,
  minKm = BREDDE_MIN_KM, maksKm = BREDDE_MAKS_KM,
} = {}) {
  if (!probe || !probe.counts || !Number.isFinite(Number(probe.arealKm2))) return null
  const indeks = tetthetsIndeks(probe.counts, probe.arealKm2)
  if (!(indeks > 0)) return null
  const asp = Number.isFinite(Number(aspect)) && Number(aspect) > 0 ? Number(aspect) : 1
  const ønsketBredde = Number(breddeKm)
  const ønsketAreal = Number.isFinite(ønsketBredde) && ønsketBredde > 0
    ? ønsketBredde * ønsketBredde * asp
    : Number(probe.arealKm2)

  const detaljNivaa = detaljNivaaFor(indeks, ønsketAreal, { budsjett })
  const maksBreddeKm = maxWidthKmFor(indeks, detaljNivaa, { budsjett, aspect: asp, minKm, maksKm })
  const overBudsjett = kostnad(indeks, ønsketAreal, detaljNivaa) > budsjett
  return {
    indeks,
    klasse: tetthetsklasse(indeks),
    detaljNivaa,
    maksBreddeKm,
    // Bredden som faktisk skal brukes: ønsket, med mindre selv sparsom sprakk.
    breddeKm: overBudsjett ? Math.min(ønsketBredde, maksBreddeKm) : ønsketBredde,
    breddeJustert: overBudsjett && maksBreddeKm < ønsketBredde,
  }
}

/** Norsk én-linjer til slideren og Utvikler-fanen. */
export function tetthetsBegrunnelse(indeks, maksBreddeKm, maksKm = BREDDE_MAKS_KM) {
  const klasse = tetthetsklasse(indeks)
  if (maksBreddeKm >= maksKm) {
    return klasse === 'åpen'
      ? 'Åpent område — hele skalaen er greit'
      : `${storForbokstav(klasse)} område — hele skalaen er greit`
  }
  return `${storForbokstav(klasse)} område — anbefalt inntil ${formatKm(maksBreddeKm)} km`
}

function storForbokstav(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatKm(km) {
  return Number.isInteger(km) ? String(km) : km.toFixed(1).replace('.', ',')
}

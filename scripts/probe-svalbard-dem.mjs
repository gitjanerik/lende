#!/usr/bin/env node
// Hvilken høydekilde svarer over Svalbard? EN MÅLING, IKKE EN GATE.
//
// HVORFOR DEN FINNES: `demFetcher.js` kan tre endepunkter, og alle tre er
// fastlands-Norge (NHM_DTM_25832/25833 + hoyde_dom10_33). Over Svalbard faller
// pipelinen derfor gjennom til `buildSyntheticDEM` — én gaussisk haug på 100 m —
// og `createMapFlow` hopper eksplisitt over Terrarium-fyllet for kilder som
// starter med «synthetic». Feilen er altså ikke en feilmelding, men et kart som
// ser ekte ut og er oppdiktet.
//
// Og kildene kan ikke prøves der spørsmålet stilles: både wcs.geonorge.no og
// geodata.npolar.no svarer 403 fra utviklings-sandkassene. Samme situasjon som
// himmelkartene i v6.2.0, der tre URL-er ble skrevet på gjetning og alle tre var
// feil — oppdaget først i deploy-loggen etter merge. Lærdommen derfra er hele
// grunnen til at denne fila finnes: BYGG EN MÅLING, IKKE EN HYPOTESE.
//
// Den skriver INGENTING og avslutter ALLTID med 0. LES UTSKRIFTEN — det er hele
// leveransen. Fem trinn:
//
//   1. OPPDAG    Geonorges kartkatalog-API spørres om høydedatasett for
//                Svalbard. Katalogen er den autoritative indeksen; å gjette
//                tjenestenavn ut fra navnekonvensjon er nøyaktig det som ga tre
//                døde DTM-1m-coverages i demFetcher (trimmet vekk i v8.10.18).
//   2. OPPDAG    Norsk Polarinstitutts ArcGIS-katalog listes opp på samme måte.
//                NPI er kilden til «S0 Terrengmodell», som er Svalbards DTM —
//                Kartverkets NHM slutter ved fastlandet.
//   3. FINNES    GetCapabilities mot hver kandidat: svarer tjenesten, og hvilke
//                coverage-navn har den? Her prøves OGSÅ appens tre nåværende
//                endepunkter, for spørsmålet «strekker NHM seg egentlig til
//                Svalbard?» er billig å måle og dyrt å anta.
//   4. VIRKER    Én ekte GetCoverage over 2 × 2 km ved Longyearbyen, gjennom
//                appens EGEN `fetchWCSDtm` — ikke en parallell klient, så det
//                som måles er det pipelinen faktisk ville gjort. Rapporterer
//                celler, oppløsning, høydespenn og noData-andel. Et svar på 200
//                med bare noData er en tom flis, ikke dekning.
//   5. REPROJ    Svarer vinneren også når bboksen er EPSG:25832 med
//                RESPONSE_CRS=25832? Det avgjør om Svalbard kan mates gjennom
//                dagens UTM32-rør (35 ikke-test-kallsteder til `wgs84ToUtm32`)
//                eller om rasteret må reprojiseres klientside.
//
// Til slutt måles Terrarium (AWS Terrain Tiles) på 78°N: den er global og dekker
// Svalbard, men kildedataene der oppe er trolig GMTED2010 (~230 m). Trinnet
// avgjør om det er ekte detalj eller en oppskalert grovmodell — forskjellen på
// «duger til relieff» og «duger til 5 m ekvidistanse».

// ── MÅLT 2026-08-30 (kjøring 33309964796) ────────────────────────────────
// Prosjektet ble lagt dødt etter denne kjøringen; oppsummeringen bor i
// CLAUDE.md, «høydedata for Svalbard er UNDERSØKT». Kortversjonen, så resultatet
// står ved siden av målingen som ga det:
//
//   • INGEN WCS FINNES. Geonorge har «Svalbard DTM 5/20/50» og
//     «Høydereferansemodell på Svalbard», men alle som GEONORGE:DOWNLOAD.
//     Dette er en BAKE (som N50-flisene), ikke et endepunkt i demFetcher.
//   • NHM 25832/25833 svarer på GetCapabilities, men gir ServiceExceptionReport
//     på GetCoverage over Longyearbyen. Fastlands-DTM-en dekker ikke Svalbard.
//   • De fire gjettede `wcs.*svalbard`-navnene finnes ikke, og NPIs
//     ImageServer-WCS gir HTTP 400. NPI har bare ferdigtegnede rasterprodukter.
//   • Terrarium har ekte detalj ned til minste piksel (variogram-stigning 0,53
//     ved 16 m). GMTED-antakelsen var feil.
//
// KJENT SVAKHET I DENNE PROBEN, ikke rettet fordi prosjektet ble lagt dødt:
// trinn 3 rapporterer ✓ for en tjeneste som svarer HTTP 200 med en feil-XML i
// kroppen — Geonorge gjør nettopp det («UKJENT APPLIKASJON», 319–335 B) for et
// navn som ikke finnes. Det ekte tegnet er «0 navn». Skal proben brukes igjen,
// la den kjenne igjen ServiceException og si ✗; ellers gjør den selv den feilen
// den er bygget for å hindre.

import { fetchWCSDtm } from '../src/lib/demFetcher.js'
import { wgs84ToUtm32, wgs84ToUtm33 } from '../src/lib/utm.js'
import { decodePng, decodeTerrariumPixels, lonToGlobalPx, latToGlobalPx } from '../src/lib/terrariumDem.js'

// Geonorge og NPI vil vite hvem som spør. Wikimedia svarte 400/403 uten dette
// under himmelkart-proben, og MET krever det uttrykkelig (se proxy-Workeren).
const UA = 'LendeSvalbardProbe/1.0 (https://github.com/gitjanerik/lende; turkart-app)'

const skriv = (s) => process.stdout.write(s + '\n')
const pust = (ms) => new Promise((r) => setTimeout(r, ms))

async function hent(url, { timeoutMs = 30000, ...opts } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(new Error(`timeout etter ${timeoutMs / 1000} s`)), timeoutMs)
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers ?? {}) },
    })
    return res
  } finally {
    clearTimeout(t)
  }
}

// ── Målepunkter ───────────────────────────────────────────────────────────
// Longyearbyen er primærpunktet: der bor folk, der går turene, og der er
// dekningen best hvis den finnes noe sted. Ny-Ålesund er med som andrepunkt
// BARE for vinneren, og er valgt fordi 11,93°E ligger i UTM-sone 32 mens
// Longyearbyen ligger i 33 — et datasett kan være delt på sone.
const STEDER = {
  longyearbyen: { navn: 'Longyearbyen', lat: 78.2232, lon: 15.6469 },
  nyalesund: { navn: 'Ny-Ålesund', lat: 78.9250, lon: 11.9300 },
}
const KANT_M = 1000  // 2 × 2 km rundt punktet — samme størrelse som et /fritt-ark

function bboxRundt(sted, tilUtm) {
  const c = tilUtm(sted.lat, sted.lon)
  return {
    minE: Math.round(c.e - KANT_M), maxE: Math.round(c.e + KANT_M),
    minN: Math.round(c.n - KANT_M), maxN: Math.round(c.n + KANT_M),
  }
}

// ── Trinn 1: Geonorges kartkatalog ────────────────────────────────────────
// Fritekstsøk er dårlig når katalogen er stor (himmelkart-proben lærte det på
// den harde måten: PDF-er fra 1834 kom opp i et bildesøk). Her er det derimot
// riktig verktøy — katalogen er kuratert og liten, og vi leter etter et navn vi
// ikke kjenner. Vi SKRIVER ut det vi får og gjetter ikke videre på det.
const GEONORGE_SOK = [
  'terrengmodell svalbard',
  'høydedata svalbard',
  'dtm svalbard',
]

async function oppdagGeonorge() {
  skriv('\n── 1. Geonorge kartkatalog ───────────────────────────────────────')
  const sett = new Map()
  for (const tekst of GEONORGE_SOK) {
    const url = `https://kartkatalog.geonorge.no/api/search?text=${encodeURIComponent(tekst)}&limit=15`
    try {
      const res = await hent(url)
      if (!res.ok) { skriv(`  ✗ «${tekst}»: HTTP ${res.status}`); continue }
      const json = await res.json()
      const treff = json?.Results ?? []
      skriv(`  «${tekst}» → ${treff.length} treff`)
      for (const r of treff) {
        const tittel = r.Title ?? r.title ?? '(uten tittel)'
        if (sett.has(tittel)) continue
        sett.set(tittel, r)
        const proto = r.DistributionProtocol ?? '—'
        const durl = r.DistributionUrl ?? r.GetCapabilitiesUrl ?? ''
        skriv(`     • ${tittel}`)
        skriv(`       uuid=${r.Uuid ?? '—'}  protokoll=${proto}`)
        if (durl) skriv(`       ${durl}`)
      }
    } catch (e) {
      skriv(`  ✗ «${tekst}»: ${e?.message ?? e}`)
    }
    await pust(300)
  }
  if (!sett.size) skriv('  (ingen treff — katalog-API-et kan ha endret svarformat, se rå-URL over)')
  return [...sett.values()]
}

// ── Trinn 2: Norsk Polarinstitutts ArcGIS-katalog ─────────────────────────
// Samme prinsipp: spør katalogen om hva som finnes framfor å skrive av et
// tjenestenavn. Vi går én mappe ned, for NPI legger basisdata i undermapper.
async function oppdagNpolar() {
  skriv('\n── 2. Norsk Polarinstitutt (ArcGIS REST) ─────────────────────────')
  const rot = 'https://geodata.npolar.no/arcgis/rest/services'
  let json
  try {
    const res = await hent(`${rot}?f=json`)
    if (!res.ok) { skriv(`  ✗ katalogrot: HTTP ${res.status}`); return [] }
    json = await res.json()
  } catch (e) {
    skriv(`  ✗ katalogrot: ${e?.message ?? e}`)
    return []
  }
  const mapper = json?.folders ?? []
  skriv(`  mapper: ${mapper.join(', ') || '(ingen)'}`)
  const funn = []
  const listOpp = (tjenester, prefiks) => {
    for (const t of tjenester ?? []) {
      const navn = t.name ?? ''
      if (!/dtm|dom|hoyde|høyde|terreng|elev/i.test(navn)) continue
      const url = `${rot}/${navn}/${t.type}`
      funn.push({ navn, type: t.type, url })
      skriv(`     • ${prefiks}${navn}  (${t.type})`)
      skriv(`       ${url}`)
    }
  }
  listOpp(json?.services, '')
  for (const m of mapper) {
    try {
      const res = await hent(`${rot}/${m}?f=json`)
      if (!res.ok) continue
      const j = await res.json()
      listOpp(j?.services, `${m}/`)
    } catch { /* en mappe som ikke svarer er ikke verdt en linje */ }
    await pust(200)
  }
  if (!funn.length) skriv('  (ingen tjeneste med dtm/dom/høyde/terreng i navnet)')
  else skriv(`\n  MERK: en ArcGIS ImageServer eksponerer WCS på .../ImageServer/WCSServer`)
  return funn
}

// ── Trinn 3: hvilke tjenester svarer, og hva heter coveragene? ────────────
// KANDIDATENE ER GJETNINGER, og det er nettopp derfor de står her og ikke i
// demFetcher.js: de skal MÅLES før noen av dem får lov til å bli kode. Listene
// over er oppdagelse; denne er verifisering. En kandidat som ikke svarer skal
// bare strykes — den koster en round-trip per kartbygg om den slipper inn.
const KANDIDATER = [
  // Appens tre nåværende endepunkter. Med på lista fordi spørsmålet «dekker
  // NHM egentlig Svalbard?» ellers blir stående som en antakelse.
  { navn: 'NHM_DTM_25833 (appens, UTM33)', url: 'https://wcs.geonorge.no/skwms1/wcs.hoyde-dtm-nhm-25833', coverage: 'NHM_DTM_25833' },
  { navn: 'NHM_DTM_25832 (appens, UTM32)', url: 'https://wcs.geonorge.no/skwms1/wcs.hoyde-dtm-nhm-25832', coverage: 'NHM_DTM_25832' },
  { navn: 'hoyde_dom10_33 (appens DOM)', url: 'https://wms.geonorge.no/skwms1/wcs.hoyde-dom10_33', coverage: 'hoyde_dom10_33' },
  // Svalbard-kandidater etter Geonorges navnekonvensjon. Ren gjetning.
  { navn: 'wcs.hoyde-dtm-svalbard', url: 'https://wcs.geonorge.no/skwms1/wcs.hoyde-dtm-svalbard', coverage: null },
  { navn: 'wcs.hoyde-dtm20-svalbard', url: 'https://wcs.geonorge.no/skwms1/wcs.hoyde-dtm20-svalbard', coverage: null },
  { navn: 'wcs.dtm-svalbard', url: 'https://wcs.geonorge.no/skwms1/wcs.dtm-svalbard', coverage: null },
  { navn: 'wcs.hoyde-svalbard', url: 'https://wcs.geonorge.no/skwms1/wcs.hoyde-svalbard', coverage: null },
  // NPI, ArcGIS ImageServer sin WCS-fasade. Også gjetning på tjenestenavnet.
  { navn: 'NPI NP_S0_DTM20', url: 'https://geodata.npolar.no/arcgis/services/Basisdata/NP_S0_DTM20/ImageServer/WCSServer', coverage: null },
  { navn: 'NPI NP_S0_DTM5', url: 'https://geodata.npolar.no/arcgis/services/Basisdata/NP_S0_DTM5/ImageServer/WCSServer', coverage: null },
]

/** Navnene i en WCS 1.0.0 GetCapabilities. Enkel regex — vi leser, ikke parser. */
function coverageNavn(xml) {
  const ut = []
  // WCS 1.0.0: <name>, WCS 2.0.1: <wcs:CoverageId>. Tar begge.
  for (const m of xml.matchAll(/<(?:\w+:)?(?:name|CoverageId)>([^<]{1,120})<\/(?:\w+:)?(?:name|CoverageId)>/gi)) {
    const n = m[1].trim()
    if (n && !ut.includes(n)) ut.push(n)
  }
  return ut
}

async function sjekkFinnes(kand) {
  const url = `${kand.url}?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCapabilities`
  try {
    const res = await hent(url, { timeoutMs: 25000 })
    const tekst = await res.text()
    if (!res.ok) {
      skriv(`  ✗ ${kand.navn}: HTTP ${res.status}  ${tekst.slice(0, 120).replace(/\s+/g, ' ')}`)
      return { ...kand, finnes: false }
    }
    const navn = coverageNavn(tekst)
    skriv(`  ✓ ${kand.navn}: HTTP 200, ${tekst.length} B, ${navn.length} navn`)
    const interessante = navn.filter((n) => /sval|dtm|dom|hoyde|høyde|terreng|elev/i.test(n))
    for (const n of (interessante.length ? interessante : navn).slice(0, 12)) {
      skriv(`       – ${n}`)
    }
    if (navn.length > 12) skriv(`       … (${navn.length - 12} til)`)
    return { ...kand, finnes: true, navn, interessante }
  } catch (e) {
    skriv(`  ✗ ${kand.navn}: ${e?.message ?? e}`)
    return { ...kand, finnes: false }
  }
}

// ── Trinn 4: én ekte GetCoverage, gjennom appens egen klient ──────────────
// `fetchWCSDtm` er den funksjonen kartbyggingen faktisk kaller. Å måle med en
// parallell klient ville målt noe annet enn det som skal virke.
function statistikk(dem) {
  let min = Infinity, maks = -Infinity, noData = 0, gyldige = 0, sum = 0
  for (const v of dem.data) {
    if (v === dem.noData || !Number.isFinite(v)) { noData++; continue }
    gyldige++
    sum += v
    if (v < min) min = v
    if (v > maks) maks = v
  }
  return {
    noDataAndel: noData / dem.data.length,
    gyldige,
    min: gyldige ? min : null,
    maks: gyldige ? maks : null,
    snitt: gyldige ? sum / gyldige : null,
  }
}

async function maalCoverage(ep, sted, utmBbox, merkelapp) {
  const t0 = Date.now()
  try {
    const dem = await fetchWCSDtm(utmBbox, 10, ep)
    const s = statistikk(dem)
    const ms = Date.now() - t0
    // Et 200-svar er ikke dekning. En tjeneste kan svare pent med et rutenett
    // der hver celle er noData — det er en tom flis, og den er lett å lese som
    // suksess i en logg som bare teller statuskoder.
    const tomt = s.gyldige === 0
    const flatt = !tomt && s.maks - s.min < 1
    skriv(
      `  ${tomt || flatt ? '⚠' : '✓'} ${merkelapp} @ ${sted.navn}: `
      + `${dem.cols}×${dem.rows} celler @ ${dem.resolution.toFixed(1)} m, ${ms} ms`,
    )
    skriv(
      `       høyde ${s.min == null ? '—' : `${s.min.toFixed(0)}–${s.maks.toFixed(0)} m `
      + `(snitt ${s.snitt.toFixed(0)})`}, noData ${(s.noDataAndel * 100).toFixed(1)} %`,
    )
    if (tomt) skriv('       ⚠ BARE noData — tjenesten svarer, men har ingen dekning her.')
    else if (flatt) skriv('       ⚠ helt flatt — ser ut som konstant fyll, ikke terreng.')
    return { ok: !tomt && !flatt, dem, stats: s }
  } catch (e) {
    skriv(`  ✗ ${merkelapp} @ ${sted.navn}: ${e?.message ?? e}`)
    return { ok: false }
  }
}

// ── Terrarium på 78°N: ekte detalj eller oppskalert grovmodell? ───────────
// AWS Terrain Tiles er global og CORS-åpen, og er derfor den billigste
// fallbacken vi har. Men den syr sammen ulike kilder, og hvilken som gjelder
// over Svalbard står ikke noe sted vi kan lese. Spørsmålet er ikke om den svarer
// — det gjør den — men om detaljen er EKTE eller oppskalert.
//
// TO MÅLINGER BLE FORKASTET FØR DENNE, og begge feilmåtene er verdt å kjenne:
//
//   1. «Tell BIT-IDENTISKE nabopiksler.» Fanger nearest-neighbour-oppskalering
//      og bare den. Resamples en grov modell BILINEÆRT — som er det vanlige —
//      får hver piksel sin egen lille verdi, andelen faller til et par prosent,
//      og målingen melder «ekte detalj» om en modell som ikke har noen.
//   2. «Finn perioden i |andrederiverte|.» Riktig idé, ubrukelig estimator:
//      den maksimerer over k, og med 16 grupper vinner støyen. Den landet på
//      k=15 og k=16 — taket i søket — for hver eneste flis, altså det svaret en
//      estimator gir når den ikke måler noe.
//
// DET SOM VIRKER er variogrammet: RMS-høydeforskjell mellom piksler som ligger
// d fra hverandre, for d = 1, 2, 4 … Ekte terreng er omtrent fraktalt, så
// RMS(d) ∝ d^H med H ≈ 0,5–0,8 helt ned til én piksel. Interpolerte data er
// STYKKEVIS LINEÆRE under blokkstørrelsen, og der er RMS(d) ∝ d — altså en
// merkbart BRATTERE kurve. Knekket mellom de to regimene ER den ekte
// cellestørrelsen, og det leses rett av tabellen uten noen terskel å tune.
const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'

/**
 * Variogram langs x for én flis: RMS-differanse ved hvert lag.
 * Ren regning på ferdig dekodede piksler.
 */
function variogram(h, bredde, hoyde, lags) {
  return lags.map((d) => {
    let sum = 0, n = 0
    for (let y = 0; y < hoyde; y++) {
      for (let x = 0; x + d < bredde; x++) {
        const diff = h[y * bredde + x + d] - h[y * bredde + x]
        sum += diff * diff
        n++
      }
    }
    return { d, rms: n ? Math.sqrt(sum / n) : 0 }
  })
}

async function hentFlis(z, sted) {
  const tx = Math.floor(lonToGlobalPx(sted.lon, z) / 256)
  const ty = Math.floor(latToGlobalPx(sted.lat, z) / 256)
  const res = await hent(`${TERRARIUM_URL}/${z}/${tx}/${ty}.png`, { timeoutMs: 20000 })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const png = await decodePng(new Uint8Array(await res.arrayBuffer()))
  return {
    h: decodeTerrariumPixels(png.pixels, png.channels, png.width * png.height),
    bredde: png.width, hoyde: png.height,
  }
}

async function maalTerrarium(sted) {
  skriv('\n── 6. Terrarium (AWS Terrain Tiles) på 78°N ──────────────────────')
  skriv('  Variogram per flis: RMS-høydeforskjell ved økende avstand, med')
  skriv('  log–log-stigningstall. Stigning ~1,0 = interpolert (stykkevis')
  skriv('  lineær). Stigning ~0,5–0,8 = ekte terreng. Knekket er den ekte cella.')
  const LAGS = [1, 2, 4, 8, 16, 32, 64]
  for (const z of [11, 12, 13, 14]) {
    try {
      const flis = await hentFlis(z, sted)
      let min = Infinity, maks = -Infinity
      for (const v of flis.h) { if (v < min) min = v; if (v > maks) maks = v }
      // Pikslene krymper med cos(lat) i Web Mercator: z14 er 2 m/px på 78°N
      // mot 9,6 m ved ekvator. Det er derfor Svalbard-fliser er finere enn man
      // venter av zoom-nivået alene.
      const mpp = (40075016.686 / 256 / 2 ** z) * Math.cos(sted.lat * Math.PI / 180)
      const v = variogram(flis.h, flis.bredde, flis.hoyde, LAGS)
      skriv(`  z${z}: ${mpp.toFixed(1)} m/px, høyde ${min.toFixed(0)}–${maks.toFixed(0)} m`)
      let linje = '       '
      for (let i = 0; i < v.length; i++) {
        const stig = i === 0 ? null
          : Math.log2(v[i].rms / v[i - 1].rms) / Math.log2(v[i].d / v[i - 1].d)
        linje += `${(v[i].d * mpp).toFixed(0)}m:${v[i].rms.toFixed(2)}`
          + (stig == null ? '' : `(${stig.toFixed(2)})`) + '  '
      }
      skriv(linje.trimEnd())
    } catch (e) {
      skriv(`  ✗ z${z}: ${e?.message ?? e}`)
    }
    await pust(200)
  }
  skriv('  Les: «avstand:RMS(stigning)». Der stigningen faller fra ~1 til ~0,7')
  skriv('  slutter interpolasjonen og det ekte terrenget begynner.')
}

// ── Kjør ──────────────────────────────────────────────────────────────────
skriv('PROBE — høydedata for Svalbard')
skriv('Måler. Skriver ingenting, feiler aldri. Les utskriften.')
skriv(`Målepunkt: ${STEDER.longyearbyen.navn} `
  + `(${STEDER.longyearbyen.lat}, ${STEDER.longyearbyen.lon}), ${2 * KANT_M / 1000} × ${2 * KANT_M / 1000} km`)

await oppdagGeonorge()
await oppdagNpolar()

skriv('\n── 3. Svarer kandidatene? (GetCapabilities) ──────────────────────')
skriv('  MERK: kandidatene under er GJETNINGER som skal måles, ikke kode.')
const svarende = []
for (const k of KANDIDATER) {
  const r = await sjekkFinnes(k)
  if (r.finnes) svarende.push(r)
  await pust(250)
}

skriv('\n── 4. Ekte GetCoverage over Longyearbyen ─────────────────────────')
const bbox33 = bboxRundt(STEDER.longyearbyen, wgs84ToUtm33)
const bbox32 = bboxRundt(STEDER.longyearbyen, wgs84ToUtm32)
skriv(`  bbox EPSG:25833 = ${bbox33.minE},${bbox33.minN},${bbox33.maxE},${bbox33.maxN}`)
skriv(`  bbox EPSG:25832 = ${bbox32.minE},${bbox32.minN},${bbox32.maxE},${bbox32.maxN}`)
skriv('')

const vinnere = []
for (const s of svarende) {
  // Har tjenesten navngitt coverage, bruk det; ellers prøv det mest lovende
  // navnet GetCapabilities faktisk oppga. Vi finner ikke på navn her.
  const coverage = s.coverage ?? s.interessante?.[0] ?? s.navn?.[0]
  if (!coverage) { skriv(`  – ${s.navn}: ingen coverage å be om, hoppet over`); continue }
  const ep = { url: s.url, coverage, bboxCrs: 'EPSG:25833', name: s.navn }
  const r = await maalCoverage(ep, STEDER.longyearbyen, bbox33, `${s.navn} [${coverage}]`)
  if (r.ok) vinnere.push({ ...s, coverage })
  await pust(300)
}

skriv('\n── 5. Tåler vinneren UTM32-røret? (RESPONSE_CRS=25832) ───────────')
if (!vinnere.length) {
  skriv('  (ingen kilde leverte data — ingenting å reprojisere)')
} else {
  skriv('  Svarer den her, kan Svalbard mates gjennom dagens wgs84ToUtm32-rør')
  skriv('  uten å røre de 35 kallstedene. Svarer den ikke, må rasteret')
  skriv('  reprojiseres klientside — en helt annen kostnad.')
  for (const v of vinnere) {
    const ep = {
      url: v.url, coverage: v.coverage,
      bboxCrs: 'EPSG:25832', responseCrs: 'EPSG:25832', name: v.navn,
    }
    await maalCoverage(ep, STEDER.longyearbyen, bbox32, `${v.navn} [25832-reprojisert]`)
    await pust(300)
    // Andrepunktet: Ny-Ålesund ligger i sone 32, Longyearbyen i 33. Et datasett
    // kan være delt på sone, og da er ett målepunkt en halv måling.
    await maalCoverage(
      { url: v.url, coverage: v.coverage, bboxCrs: 'EPSG:25833', name: v.navn },
      STEDER.nyalesund, bboxRundt(STEDER.nyalesund, wgs84ToUtm33), `${v.navn} [UTM33]`,
    )
    await pust(300)
  }
}

await maalTerrarium(STEDER.longyearbyen)

skriv('\n── Oppsummering ──────────────────────────────────────────────────')
skriv(`  ${svarende.length} av ${KANDIDATER.length} kandidater svarte på GetCapabilities.`)
skriv(`  ${vinnere.length} leverte ekte høydedata over Longyearbyen`
  + (vinnere.length ? `: ${vinnere.map((v) => `${v.navn} [${v.coverage}]`).join(', ')}` : '.'))
skriv('')
skriv('  Ingenting er skrevet og ingenting er endret. Skal en av disse inn i')
skriv('  demFetcher.js, kopier navnet HERFRA — ikke fra hukommelsen.')

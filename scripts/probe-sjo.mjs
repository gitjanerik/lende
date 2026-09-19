#!/usr/bin/env node
// Probe — hvorfor får et kystark ingen sjø?
//
// EN MÅLING, IKKE EN GATE. Den finnes fordi Kartverkets WCS, Overpass og
// Sjøkart-WFS alle er sperret fra utviklings-sandkassene: spørsmålet «hva
// leser DEM-et over havet her?» kan bare stilles i CI. Skriver bare til
// probe-ut/, feiler aldri.
//
// Bakgrunn: sjøen på et Lende-ark males av DEM-sjøen (seaFromDem), og den er
// gatet i createMapFlow:
//
//   coastal = hasNearSeaLevelPixels(probeDem) && saltvann     (probe-DEM, 20 m)
//   buildSvg(..., { skipDemSea: !coastal })
//
// hasNearSeaLevelPixels er sann bare hvis EN endelig celle (≠ noData) er
// ≤ 0.5 m. Er den usann, tegnes ingen sjø, Sjøkart-WFS spørres aldri, og
// OSM har ingen havflate å falle tilbake på (åpent hav er `natural=coastline`,
// en LINJE). Arket blir da land helt ut til kanten — nøyaktig symptomet.
//
// Proben måler begge halvdelene av gaten hver for seg, per sted, og legger
// ved en TERSKEL-SVEIP: den sier ikke bare «ingen celle ≤ 0.5 m», men hvilken
// terskel som HADDE funnet havet. Det er forskjellen på «DEM-et mangler sjø»
// og «sjøen ligger på feil høyde».

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildMapHeadless } from '../mcp/headless.js'
import { fetchDEM, fetchWCSDtm, WCS_ENDPOINTS } from '../src/lib/demFetcher.js'
import { fetchOverpass, probeCoastline, bboxFromCenter } from '../src/lib/mapBuilder.js'
import { buildSeaFromDem } from '../src/lib/seaFromDem.js'
import { fetchSjokart } from '../src/lib/sjokartFetcher.js'
import { isOsmWaterSalty } from '../src/lib/symbolizer.js'
import { utm32BboxFromWgs84, wgs84ToUtm32 } from '../src/lib/utm.js'

const UT = 'probe-ut'
const HALV_KM = Number(process.env.PROBE_HALV_KM || 4)
const ASPEKT = Number(process.env.PROBE_ASPEKT || 1)
const RES_M = Number(process.env.PROBE_RES_M || 20)
// Finere trinn kyst-oppgraderingen ville brukt. Tom = hopp over.
const FINE_RES = String(process.env.PROBE_FINE_RES ?? '10,5')
  .split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0)
const HOPP = new Set(String(process.env.PROBE_HOPP || '').split(',').map(s => s.trim()).filter(Boolean))

// «Navn@lat,lon» — standard er rapportstedet pluss to kystkart som VIRKER.
// Kontrollene er ikke pynt: «ingen celle ≤ 0.5 m» betyr noe helt annet hvis
// det også gjelder et ark vi vet tegner sjø.
const STEDER = String(process.env.PROBE_STEDER ||
  'Hamningberg@70.53900,30.58000;Henningsvær@68.15600,14.20400;Kirkenes@69.72700,30.04500')
  .split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)@(-?[\d.]+),(-?[\d.]+)$/)
    return m ? { navn: m[1].trim() || 'sted', lat: Number(m[2]), lon: Number(m[3]) } : null
  }).filter(Boolean)

const TERSKLER = [0, 0.25, 0.5, 1, 1.5, 2, 3, 5, 10]

// `fetchSjokart` legger disse ved siden av kategoriene, og to av tre er
// arrays. Uten settet teller steg 6 dem som om de var sjøkart-kategorier.
const SJOKART_META = new Set(['fetchErrors', 'debugSamples', 'trunkert', 'source'])

const linjer = []
const log = (s = '') => { console.log(s); linjer.push(s) }
const n = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '–'

// Kopi av gatens egen regel (createMapFlow er ikke eksportert). Holdes
// ordrett lik — en probe som måler en ANNEN regel enn appen svarer på feil
// spørsmål.
function hasNearSeaLevelPixels(dem) {
  if (!dem?.data) return false
  const { data, noData } = dem
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v === noData || !Number.isFinite(v)) continue
    if (v <= 0.5) return true
  }
  return false
}

function osmHasSaltwater(elements) {
  for (const el of elements ?? []) {
    const t = el?.tags
    if (!t) continue
    if (t.natural === 'coastline') return true
    if (isOsmWaterSalty(t)) return true
  }
  return false
}

function demStatistikk(dem) {
  const { data, noData } = dem
  let nd = 0, ikkeEndelig = 0, min = Infinity, max = -Infinity, endelige = 0
  const under = new Map(TERSKLER.map(t => [t, 0]))
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v === noData) { nd++; continue }
    if (!Number.isFinite(v)) { ikkeEndelig++; continue }
    endelige++
    if (v < min) min = v
    if (v > max) max = v
    for (const t of TERSKLER) if (v <= t) under.set(t, under.get(t) + 1)
  }
  return { celler: data.length, noData: nd, ikkeEndelig, endelige, min, max, under,
           kantHull: kantTilkobletHull(dem) }
}

// Hvor mange noData-celler henger sammen med bbox-kanten? Er havet levert som
// HULL i stedet for som 0 m, er dette tallet omtrent sjøarealet — og da er
// «ingen celle ≤ 0.5 m» ikke en gåte, men hele forklaringen. findSeaConnectedVoids
// kan ikke redde det: den sås BARE av celler med data[i] <= terskel, så uten en
// eneste slik celle starter flomfyllet aldri.
function kantTilkobletHull(dem) {
  const { data, cols, rows, noData } = dem
  const hull = (i) => data[i] === noData || !Number.isFinite(data[i])
  const sett = new Uint8Array(cols * rows)
  const ko = new Int32Array(cols * rows)
  let hode = 0, hale = 0
  const legg = (i) => { if (!sett[i] && hull(i)) { sett[i] = 1; ko[hale++] = i } }
  for (let x = 0; x < cols; x++) { legg(x); legg((rows - 1) * cols + x) }
  for (let y = 0; y < rows; y++) { legg(y * cols); legg(y * cols + cols - 1) }
  while (hode < hale) {
    const i = ko[hode++]
    const x = i % cols, y = (i / cols) | 0
    if (x > 0) legg(i - 1)
    if (x < cols - 1) legg(i + 1)
    if (y > 0) legg(i - cols)
    if (y < rows - 1) legg(i + cols)
  }
  return hale
}

function skrivDemStat(merkelapp, dem) {
  const s = demStatistikk(dem)
  const pst = (k) => `${((100 * k) / s.celler).toFixed(1)} %`
  log(`    ${merkelapp}: ${dem.cols}×${dem.rows} @ ${n(dem.resolution, 1)} m — kilde «${dem.source}»`)
  log(`      noData-verdi ${dem.noData}, noData ${s.noData} (${pst(s.noData)}), ikke-endelige ${s.ikkeEndelig}`)
  log(`      min ${n(s.min)} m, maks ${n(s.max)} m av ${s.endelige} endelige celler`)
  log(`      kumulativt under terskel: ${TERSKLER.map(t => `≤${t}m:${s.under.get(t)}`).join('  ')}`)
  log(`      noData som henger sammen med bbox-kanten: ${s.kantHull} (${pst(s.kantHull)})`)
  log(`      hasNearSeaLevelPixels → ${hasNearSeaLevelPixels(dem) ? 'SANN' : 'USANN'}`)
  return s
}

function sveipSjo(dem) {
  for (const t of TERSKLER) {
    if (t <= 0) continue
    let res
    try {
      res = buildSeaFromDem(dem, {
        thresholdM: t, minAreaM2: 2000, simplifyM: 2,
        requireBoundaryTouch: true, voidMask: dem.voidMask ?? null,
      })
    } catch (e) { log(`      terskel ${t} m → feilet (${e?.message ?? e})`); continue }
    const flater = res?.polygons?.length ?? 0
    log(`      terskel ${t} m → ${flater} sjøflate${flater === 1 ? '' : 'r'}`)
  }
}

async function malSted(sted) {
  log('')
  log(`══ ${sted.navn} (${sted.lat}, ${sted.lon}) ══`)
  const bbox = bboxFromCenter(sted.lat, sted.lon, HALV_KM, ASPEKT)
  const utmBbox = utm32BboxFromWgs84(bbox)
  const c = wgs84ToUtm32(sted.lat, sted.lon)
  log(`  bbox ${n(bbox.south, 4)},${n(bbox.west, 4)} → ${n(bbox.north, 4)},${n(bbox.east, 4)}`)
  log(`  UTM32 senter E ${Math.round(c.e)} N ${Math.round(c.n)} — ${Math.round((c.e - 500000) / 1000)} km fra sentralmeridianen`)

  // ── 1. Probe-DEM-et gaten faktisk leser ────────────────────────────────
  let probeDem = null
  if (!HOPP.has('dem')) {
    try {
      probeDem = await fetchDEM(utmBbox, { resolutionM: RES_M })
      log(`  [1] Probe-DEM (${RES_M} m) — det gaten leser:`)
      skrivDemStat('via fetchDEM', probeDem)
    } catch (e) { log(`  [1] Probe-DEM feilet: ${e?.message ?? e}`) }
  }

  // ── 2. Hvert WCS-endepunkt for seg ─────────────────────────────────────
  // fetchDEM hedger, så vi ser bare vinneren. Svarer de to ULIKT over havet,
  // er «ingen sjø» et endepunkt-valg og ikke en egenskap ved stedet.
  if (!HOPP.has('endepunkt')) {
    log(`  [2] Endepunktene hver for seg (${RES_M} m):`)
    for (const ep of WCS_ENDPOINTS) {
      try {
        const dem = await fetchWCSDtm(utmBbox, RES_M, ep)
        skrivDemStat(ep.name, dem)
      } catch (e) { log(`    ${ep.name}: feilet (${e?.message ?? e})`) }
    }
  }

  // ── 3. Finere oppløsning — ser kyst-oppgraderingen noe proben ikke ser? ─
  if (!HOPP.has('fin')) {
    for (const res of FINE_RES) {
      try {
        const dem = await fetchDEM(utmBbox, { resolutionM: res })
        log(`  [3] Finere DEM @ ${res} m:`)
        skrivDemStat(`via fetchDEM`, dem)
      } catch (e) { log(`  [3] DEM @ ${res} m feilet: ${e?.message ?? e}`) }
    }
  }

  // ── 4. Saltvanns-halvdelen av gaten ────────────────────────────────────
  let saltProbe = null, saltFull = null, osm = null
  if (!HOPP.has('osm')) {
    try { saltProbe = await probeCoastline(bbox) }
    catch (e) { log(`  [4] probeCoastline feilet: ${e?.message ?? e}`) }
    try {
      osm = await fetchOverpass(bbox)
      saltFull = osmHasSaltwater(osm?.elements)
    } catch (e) { log(`  [4] fetchOverpass feilet: ${e?.message ?? e}`) }
    const kyst = (osm?.elements ?? []).filter(el => el?.tags?.natural === 'coastline').length
    const salt = (osm?.elements ?? []).filter(el => el?.tags && isOsmWaterSalty(el.tags)).length
    log(`  [4] Saltvann: probeCoastline → ${saltProbe === null ? 'ukjent' : saltProbe ? 'SANN' : 'USANN'}`)
    log(`      osmHasSaltwater(full) → ${saltFull === null ? 'ukjent' : saltFull ? 'SANN' : 'USANN'}`)
    log(`      OSM: ${kyst} natural=coastline, ${salt} saltvanns-taggede, ${osm?.elements?.length ?? 0} elementer totalt`)
  }

  // ── 5. Gatens konklusjon, og hva sjøen HADDE blitt ─────────────────────
  const nærNull = probeDem ? hasNearSeaLevelPixels(probeDem) : null
  const salt = saltProbe ?? saltFull
  const coastal = nærNull === null || salt == null ? null : (nærNull && salt)
  log(`  [5] coastal = hasNearSeaLevelPixels(${nærNull}) && saltvann(${salt}) → ${coastal}`)
  log(`      ⇒ skipDemSea = ${coastal === null ? '?' : !coastal}`)
  if (probeDem && !HOPP.has('sveip')) {
    log(`      terskel-sveip på probe-DEM-et (appen bruker 0.5 m):`)
    sveipSjo(probeDem)
  }

  // ── 6. Sjøkart 307 — det gaten aldri rekker å spørre om ────────────────
  //
  // v7.9.4: steget TALTE FEIL, og det talte bare. `fetchSjokart` gir
  // kategoriene som RENE ARRAYS — filteret leste `v?.features`, som ingen av
  // dem har, så lista var tom uansett hva serveren svarte og «ingen
  // kategorier» betydde ingenting. Tre av nøklene ER arrays uten å være
  // kategorier (`fetchErrors`, `debugSamples`, `trunkert`), så de må ut.
  //
  // Og et blankt «0 features» er ikke en måling. Fetcheren samler allerede
  // HVORFOR — `fetchErrors` med `kind` (CORS, HTTP, non-JSON, zero-features)
  // per endepunkt og typename, `debugSamples` med de første bytene av det
  // serveren faktisk sendte, `trunkert` der COUNT-taket kuttet — og alt ble
  // kastet her. Forskjellen på «utdaterte typenames» (sist rettet i v7.1.9),
  // «snudd bbox-akserekkefølge» og «utenfor dekning» står i de feltene.
  if (!HOPP.has('sjokart')) {
    try {
      const sj = (await fetchSjokart(bbox)) ?? {}
      const tall = Object.entries(sj)
        .filter(([k, v]) => Array.isArray(v) && !SJOKART_META.has(k))
        .map(([k, v]) => `${k}:${v.length}`)
      log(`  [6] Sjøkart-WFS: ${tall.length ? tall.join('  ') : 'ingen kategorier'}`)
      log(`      kilde: ${sj.source ?? '– (ingen endepunkt ga data)'}`)
      for (const e of sj.fetchErrors ?? []) {
        const ep = String(e.endpoint ?? '').replace('https://wfs.geonorge.no/skwms1/', '')
        log(`      ✗ ${ep}${e.typeName ? ` [${e.typeName}]` : ''} — ${e.kind ?? '?'}: ${String(e.message ?? '').slice(0, 160)}`)
      }
      for (const t of sj.trunkert ?? []) {
        log(`      ⚠ COUNT-taket kuttet ${t.typeName}: ${t.returned} av ${t.matched}`)
      }
      // Det serveren FAKTISK sendte. Uten dette er «0 features» en gjetning.
      for (const d of (sj.debugSamples ?? []).slice(0, 6)) {
        const pre = typeof d === 'string' ? d : (d?.sample ?? JSON.stringify(d))
        log(`      prøve: ${String(pre).replace(/\s+/g, ' ').slice(0, 200)}`)
      }
    } catch (e) { log(`  [6] Sjøkart-WFS feilet: ${e?.message ?? e}`) }
  }

  // ── 7. Hele arket, ende til ende ───────────────────────────────────────
  // Steg 1–5 måler GATEN. Består arket gaten og likevel mangler sjø, er
  // eteren lenger nede: ferskvanns-fratrekket («vektor-vann er autoritativt»)
  // eller den autoritative sjø-geometrien. Bare et ekte ark kan skille dem —
  // og forskjellen mellom sveipets tall og `vann` her ER svaret.
  //
  // Merk at headless IKKE sender skipDemSea, altså alltid bygger DEM-sjøen.
  // Det er med vilje: her spør vi hva mapBuilder gjør med en sjø den FÅR.
  if (!HOPP.has('bygg')) {
    try {
      const { svg, meta } = await buildMapHeadless({ lat: sted.lat, lon: sted.lon, halfKm: HALV_KM })
      const demSjoLag = /data-src="dem-sea"/.test(svg)
      const demSjoBaner = (svg.match(/data-src="dem-sea"[\s\S]*?<\/g>/)?.[0]?.match(/<path/g) ?? []).length
      const alle303 = (svg.match(/data-iso="303"/g) ?? []).length
      log(`  [7] Headless-bygg: ${Math.round(svg.length / 1024)} KB SVG`)
      log(`      dem-sea-lag i arket: ${demSjoLag ? `JA (${demSjoBaner} baner)` : 'NEI'}`)
      log(`      meta.lagTellinger.vann (DEM-sjøflater etter ferskvanns-fratrekk): ${meta?.lagTellinger?.vann ?? '–'}`)
      log(`      data-iso="303"-grupper totalt: ${alle303}`)
      log(`      meta.n50VannStatus: ${JSON.stringify(meta?.n50VannStatus ?? null)}`)
      log(`      meta.dybdeKilde: ${meta?.dybdeKilde ?? '–'}`)
    } catch (e) { log(`  [7] Headless-bygg feilet: ${e?.message ?? e}`) }
  }
}

async function main() {
  mkdirSync(UT, { recursive: true })
  log('Probe — hvorfor får et kystark ingen sjø?')
  log(`Kjørt ${new Date().toISOString()} — halvKm ${HALV_KM}, aspekt ${ASPEKT}, probe-res ${RES_M} m`)
  log('')
  log('Gaten som måles (createMapFlow):')
  log('  coastal = hasNearSeaLevelPixels(probeDem) && saltvann')
  log('  buildSvg(..., { skipDemSea: !coastal })')

  for (const sted of STEDER) {
    try { await malSted(sted) }
    catch (e) { log(`══ ${sted.navn}: hele stedet feilet (${e?.message ?? e})`) }
  }

  log('')
  log('Sammenlikn [5] terskel 0.5 m med [7] «vann»: like tall = mapBuilder')
  log('beholder sjøen, og et ark uten sjø er da gatet bort på klienten. Sprik')
  log('= ferskvanns-fratrekket spiser en ekte kyst-sjø.')
  log('')
  log('Les kolonnen «kumulativt under terskel». Er ≤0.5m lik 0 men ≤2m stor,')
  log('ligger havflaten i DEM-et OVER gatens terskel — da er ikke sjøen borte,')
  log('den er på feil høyde. Er både ≤0.5m og ≤10m lik 0 mens noData er stor,')
  log('leverer WCS-en hull der havet er.')

  writeFileSync(join(UT, 'sjo-gate.txt'), linjer.join('\n') + '\n')
  console.log(`\n→ skrev ${join(UT, 'sjo-gate.txt')}`)
}

main().catch(e => {
  console.error('[probe-sjo] uventet feil:', e)
  try { mkdirSync(UT, { recursive: true }); writeFileSync(join(UT, 'sjo-gate.txt'), linjer.join('\n') + `\n\nAVBRUTT: ${e?.stack ?? e}\n`) } catch {}
  process.exit(0)   // en måling skal aldri felle bygget
})

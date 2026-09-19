#!/usr/bin/env node
// Probe — hvor langt øst lever `NHM_DTM_25832`?
//
// EN MÅLING, IKKE EN GATE. Den skriver bare til probe-ut/ og feiler ALDRI.
// Kartverkets WCS er sperret fra utviklings-sandkassene, så spørsmålet kan
// bare stilles her.
//
// BAKGRUNN. `WCS_ENDPOINTS` i demFetcher har to oppføringer: `NHM_DTM_25832`
// (UTM 32 native, primær) og `NHM_DTM_25833` (UTM 33, reprojisert til 32,
// fallback). Hamningberg-saken (v7.9.2) målte at primæren svarer
// `ServiceExceptionReport` i Øst-Finnmark — på to steder, E ≈ 1,29 M og
// E ≈ 1,30 M i UTM 32. To punkter er ikke en grense.
//
// HVA DET KOSTER, og hvorfor det ikke er latensen. `hedgedWCSDtm` starter
// fallbacken enten på HEDGE_DELAY_MS eller UMIDDELBART når primæren avviser,
// og en ServiceException avvises raskt: `fetchWCSDtm` sjekker content-type
// rett etter hodene og kaster der, altså FØR `onForsteByte` rekker å avlyse
// hedgen. Prisen er én bortkastet round-trip, ikke fire sekunder — proben
// måler den, så tallet slutter å være et resonnement.
//
// Det som faktisk koster er at REDUNDANSEN er borte: der primæren er død, er
// 25833 eneste kilde for alle tre DEM-hentingene et kystkart gjør (probe,
// kjerne, 5/10 m-oppgradering). Faller den ut ett øyeblikk, er neste steg
// `buildSyntheticDEM` — som alltid ligger over 0,5 m, og dermed gir
// `coastal = false` og et kystark uten hav. Nøyaktig Hamningberg-symptomet.
//
// HVA PROBEN SVARER PÅ: hvilken østing primæren slutter å svare ved. Under
// ligger en BRAKETT — østligste sted som virker, vestligste som ikke gjør
// det — og den er hele grunnlaget for om en region-gate er forsvarlig.
// CLAUDE.md er tydelig på at `WCS_ENDPOINTS` ikke endres på antakelse:
// «et endepunkt er ikke sant fordi det var sant en gang. Trimmes eller
// legges det til et til, skal det MÅLES først; proben er verktøyet.»

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { fetchWCSDtm, WCS_ENDPOINTS } from '../src/lib/demFetcher.js'
import { bboxFromCenter } from '../src/lib/mapBuilder.js'
import { utm32BboxFromWgs84, wgs84ToUtm32 } from '../src/lib/utm.js'

const UT = 'probe-ut'
// Lite ark med vilje: vi spør om endepunktet SVARER, ikke om terrenget.
// 0,5 km halvkant @ 20 m er 50 × 50 px ≈ 10 KB GeoTIFF — under `fetchWCSDtm`s
// 1000-byte-gulv kommer vi ikke, og hvert sted koster da under sekundet.
const HALV_KM = Number(process.env.PROBE_HALV_KM || 0.5)
const RES_M = Number(process.env.PROBE_RES_M || 20)
// Runder: samme sted spørres flere ganger, fordi ett avslag kan være en dårlig
// dag og ikke en grense. Første runde er dessuten kald hos Geonorge.
const RUNDER = Math.max(1, Number(process.env.PROBE_RUNDER || 2))

// Vest → øst langs kysten. Sørlandet og Vestlandet er kontrollene: svarer
// primæren nei DER, måler vi en tjeneste som er nede og ikke en dekningskant.
const STEDER = String(process.env.PROBE_STEDER ||
  'Bergen@60.3900,5.3200;Vardåsen@59.8390,10.0820;Trondheim@63.4300,10.3950;' +
  'Bodø@67.2800,14.4000;Tromsø@69.6500,18.9600;Alta@69.9700,23.2700;' +
  'Lakselv@70.0500,24.9700;Berlevåg@70.8600,29.0900;Kirkenes@69.7270,30.0450;' +
  'Hamningberg@70.5390,30.5800;Vardø@70.3700,31.1100')
  .split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)@(-?[\d.]+),(-?[\d.]+)$/)
    return m ? { navn: m[1].trim() || 'sted', lat: Number(m[2]), lon: Number(m[3]) } : null
  }).filter(Boolean)

const linjer = []
const log = (s = '') => { console.log(s); linjer.push(s) }
const n = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '–'

function spenn(dem) {
  const { data, noData } = dem
  let min = Infinity, max = -Infinity, endelige = 0
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v === noData || !Number.isFinite(v)) continue
    endelige++
    if (v < min) min = v
    if (v > max) max = v
  }
  return { endelige, min, max }
}

/** Ett endepunkt, ett sted, én runde. Kaster aldri — utfallet ER svaret. */
async function spor(ep, utmBbox) {
  const t0 = Date.now()
  try {
    const dem = await fetchWCSDtm(utmBbox, RES_M, ep)
    return { ok: true, ms: Date.now() - t0, dem }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, feil: String(e?.message ?? e) }
  }
}

async function malSted(sted) {
  const bbox = bboxFromCenter(sted.lat, sted.lon, HALV_KM, 1)
  const utmBbox = utm32BboxFromWgs84(bbox)
  const c = wgs84ToUtm32(sted.lat, sted.lon)
  const rad = { ...sted, e: Math.round(c.e), ep: {} }

  log('')
  log(`══ ${sted.navn} (lon ${n(sted.lon, 3)}) — UTM32 E ${rad.e}, ` +
      `${Math.round((c.e - 500000) / 1000)} km fra sentralmeridianen ══`)

  for (const ep of WCS_ENDPOINTS) {
    const forsok = []
    for (let r = 0; r < RUNDER; r++) forsok.push(await spor(ep, utmBbox))
    const ok = forsok.filter(f => f.ok)
    const msSnitt = Math.round(forsok.reduce((a, f) => a + f.ms, 0) / forsok.length)
    rad.ep[ep.coverage] = { ok: ok.length, av: forsok.length, ms: msSnitt }

    if (ok.length) {
      const s = spenn(ok[0].dem)
      log(`  ${ep.name}: OK ${ok.length}/${forsok.length} · ${msSnitt} ms · ` +
          `${ok[0].dem.cols}×${ok[0].dem.rows} · ${s.endelige} endelige celler, ` +
          `${n(s.min)}–${n(s.max)} m`)
      if (ok.length < forsok.length) {
        log(`    ⚠ én runde feilet likevel: ${forsok.find(f => !f.ok)?.feil?.slice(0, 200)}`)
      }
    } else {
      // Meldinga er hele poenget: en ServiceException sier noe annet enn en
      // timeout, og en timeout noe annet enn HTTP 500.
      log(`  ${ep.name}: FEILET ${forsok.length}/${forsok.length} · ${msSnitt} ms`)
      for (const f of forsok) log(`    ${f.feil.slice(0, 240)}`)
    }
  }
  return rad
}

async function main() {
  log('Probe — hvor langt øst lever NHM_DTM_25832?')
  log(`  ${STEDER.length} steder · halvkant ${HALV_KM} km · ${RES_M} m · ${RUNDER} runde(r) per endepunkt`)
  log(`  endepunkter: ${WCS_ENDPOINTS.map(e => e.coverage).join(', ')}`)

  const rader = []
  for (const sted of STEDER) {
    try { rader.push(await malSted(sted)) }
    catch (e) { log(`  ${sted.navn}: proben selv feilet — ${e?.message ?? e}`) }
  }

  // ── Oppsummering, sortert på østing ────────────────────────────────────
  rader.sort((a, b) => a.e - b.e)
  log('')
  log('══ Oppsummering (sortert vest → øst på UTM32-østing) ══')
  const bredde = Math.max(...rader.map(r => r.navn.length), 6)
  const hode = WCS_ENDPOINTS.map(e => e.coverage.padEnd(22)).join(' ')
  log(`  ${'sted'.padEnd(bredde)}  ${'E'.padStart(8)}  ${hode}`)
  for (const r of rader) {
    const celler = WCS_ENDPOINTS.map(ep => {
      const v = r.ep[ep.coverage]
      return (v ? `${v.ok}/${v.av} ${v.ms} ms` : '–').padEnd(22)
    }).join(' ')
    log(`  ${r.navn.padEnd(bredde)}  ${String(r.e).padStart(8)}  ${celler}`)
  }

  // ── Braketten: det eneste tallet en region-gate kan bygges på ──────────
  const primær = WCS_ENDPOINTS[0].coverage
  const virker = rader.filter(r => (r.ep[primær]?.ok ?? 0) > 0)
  const nekter = rader.filter(r => r.ep[primær] && r.ep[primær].ok === 0)
  log('')
  log(`══ ${primær} — hvor går kanten? ══`)
  if (!nekter.length) {
    log('  Ingen steder feilet. Enten er grensa lenger øst enn noe punkt her,')
    log('  eller så var Øst-Finnmark-avslaget i v7.9.2 forbigående — og da er')
    log('  det ingen region-gate å bygge. Kjør om igjen før du konkluderer.')
  } else if (!virker.length) {
    log('  INGEN steder virket, heller ikke kontrollene på Vestlandet. Det er')
    log('  en tjeneste som er nede, ikke en dekningskant. Måler ingenting.')
  } else {
    const østligsteOk = virker[virker.length - 1]
    const vestligsteNei = nekter[0]
    log(`  østligste som VIRKER:  ${østligsteOk.navn} — E ${østligsteOk.e}`)
    log(`  vestligste som NEKTER: ${vestligsteNei.navn} — E ${vestligsteNei.e}`)
    if (vestligsteNei.e > østligsteOk.e) {
      log(`  ⇒ kanten ligger i E ${østligsteOk.e} … ${vestligsteNei.e} ` +
          `(${Math.round((vestligsteNei.e - østligsteOk.e) / 1000)} km bredt)`)
      log('  Skal det bli en region-gate, er terskelen et sted HER — og')
      log('  braketten må snevres inn med flere punkter før et tall velges.')
    } else {
      log('  ⚠ Brakettene overlapper: et sted øst for et avslag virker likevel.')
      log('  Da er utfallet ikke en funksjon av østingen, og en region-gate på')
      log('  østing ville vært feil medisin. Se på meldingene per sted.')
    }
    // Den korrigerte kostnaden, målt i stedet for resonnert.
    const msNei = Math.round(nekter.reduce((a, r) => a + r.ep[primær].ms, 0) / nekter.length)
    log(`  bortkastet round-trip der den nekter: ${msNei} ms i snitt ` +
        `(hedgen fyrer umiddelbart på avvisning, så dette ER hele kostnaden)`)
  }

  mkdirSync(UT, { recursive: true })
  writeFileSync(join(UT, 'probe-dem-ost.txt'), linjer.join('\n') + '\n', 'utf-8')
  log('')
  log(`Skrevet til ${join(UT, 'probe-dem-ost.txt')}`)
}

main().catch(e => {
  // Feiler ALDRI: en probe som bryter kjøringen måler ingenting.
  console.error('Proben stoppet:', e)
  try {
    mkdirSync(UT, { recursive: true })
    writeFileSync(join(UT, 'probe-dem-ost.txt'),
      linjer.join('\n') + `\n\nPROBEN STOPPET: ${e?.stack ?? e}\n`, 'utf-8')
  } catch { /* ingenting mer å gjøre */ }
})

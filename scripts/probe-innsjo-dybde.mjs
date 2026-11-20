#!/usr/bin/env node
// Hvor ligger dybden i NVE Innsjødatabasen? EN MÅLING, IKKE EN GATE.
//
// Laget appen henter innsjøflatene fra (Innsjodatabase2/MapServer/5) har feltet
// `dybdekart`, men ingen dybde-TALL — det ble lest av i probe-n50-vann
// (nov. 2026). Lang-trykk-arket viser maks/snitt-dyp fra `identify` med
// `layers=all`, men om det faktisk kommer tall fra noe lag, og fra hvilket, er
// aldri målt: testene bruker oppdiktede feltnavn. NVE svarer 403 fra
// utviklings-sandkassene, så spørsmålet kan bare stilles her.
//
// Spørsmålene:
//   1. Hvilke lag og tjenester finnes, og hvilke har dybde i navn eller felt?
//   2. Hva står i `dybdekart`, og hvor mange innsjøer har det satt?
//   3. Hva svarer `identify` over kjente, oppmålte innsjøer — per lag?
//   4. Finnes dybdeKURVER eller -FLATER som geometri, og hva koster de?
//
// Skriver bare til probe-ut/, avslutter ALLTID med 0. LES UTSKRIFTEN.

import { mkdirSync, writeFileSync } from 'node:fs'

const ROT = 'https://kart.nve.no/enterprise/rest/services'
const TJENESTE = `${ROT}/Innsjodatabase2/MapServer`
const UA = { 'User-Agent': 'lende-probe/1.0 (github.com/gitjanerik/lende)' }

// Innsjøer som er kjent oppmålt, spredt over landet og i størrelse.
const INNSJOER = String(process.env.PROBE_INNSJOER ??
  'Bogstadvannet@59.9690,10.6320;Sognsvann@59.9785,10.7290;Mjøsa@60.7900,10.9300;' +
  'Tyrifjorden@60.0300,10.1800;Øyeren@59.8300,11.2100;Femunden@62.1500,11.8700;' +
  'Tinnsjøen@59.9000,8.9000;Gjende@61.4870,8.6500')
  .split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)@(-?[\d.]+),(-?[\d.]+)$/)
    return m ? { navn: m[1], lat: Number(m[2]), lon: Number(m[3]) } : null
  }).filter(Boolean)

const DYBDE_RE = /dyb|dyp|djup|depth|bathy|kote|kurve/i
const ut = []
const log = (...a) => { const s = a.join(' '); console.log(s); ut.push(s) }

async function hent(url, ms = 30000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) })
    const tekst = await res.text()
    let json = null
    try { json = JSON.parse(tekst) } catch { /* ikke JSON */ }
    return { status: res.status, ms: Date.now() - t0, bytes: tekst.length, json, tekst }
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, bytes: 0, json: null, feil: String(e?.message ?? e) }
  }
}

const q = (o) => new URLSearchParams(o).toString()
const kort = (v, n = 160) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + '…' : s }

function tellHjorner(geom) {
  if (!geom) return 0
  const deler = geom.rings ?? geom.paths ?? (geom.x != null ? [[0]] : [])
  return deler.reduce((s, r) => s + r.length, 0)
}

async function trinn1() {
  log('━━ 1. Tjenester og lag ━━')
  const kat = await hent(`${ROT}?f=json`)
  log(`katalog: HTTP ${kat.status}, ${kat.ms} ms${kat.feil ? ` (${kat.feil})` : ''}`)
  const tjenester = [...(kat.json?.services ?? [])]
  for (const mappe of kat.json?.folders ?? []) {
    const r = await hent(`${ROT}/${mappe}?f=json`)
    for (const s of r.json?.services ?? []) tjenester.push(s)
  }
  const treff = tjenester.filter(s => DYBDE_RE.test(s.name) || /innsj/i.test(s.name))
  log(`${tjenester.length} tjenester, ${treff.length} med innsjø/dybde i navnet:`)
  for (const s of treff) log(`  ${s.name} (${s.type})`)

  const meta = await hent(`${TJENESTE}?f=json`)
  log(`\nInnsjodatabase2: HTTP ${meta.status}`)
  const lag = [...(meta.json?.layers ?? []), ...(meta.json?.tables ?? []).map(t => ({ ...t, tabell: true }))]
  const dybdeLag = []
  for (const l of lag) {
    const d = await hent(`${TJENESTE}/${l.id}?f=json`)
    const felt = (d.json?.fields ?? []).map(f => f.name)
    const dybdeFelt = felt.filter(f => DYBDE_RE.test(f))
    log(`  [${l.id}] ${l.name}${l.tabell ? ' (tabell)' : ''} — ${d.json?.geometryType ?? '–'}, ` +
      `skala ${d.json?.minScale ?? '?'}–${d.json?.maxScale ?? '?'}, maxRecordCount ${d.json?.maxRecordCount ?? '?'}`)
    log(`      felter: ${felt.join(', ') || '–'}`)
    if (dybdeFelt.length || DYBDE_RE.test(l.name)) {
      dybdeLag.push({ id: l.id, navn: l.name, geometri: d.json?.geometryType, felt, dybdeFelt })
      log(`      ↳ DYBDE-KANDIDAT: ${dybdeFelt.join(', ') || '(navnet)'}`)
    }
  }
  return dybdeLag
}

async function trinn2() {
  log('\n━━ 2. Feltet `dybdekart` på lag 5 ━━')
  const alle = await hent(`${TJENESTE}/5/query?${q({ where: '1=1', returnCountOnly: 'true', f: 'json' })}`)
  const med = await hent(`${TJENESTE}/5/query?${q({ where: 'dybdekart IS NOT NULL', returnCountOnly: 'true', f: 'json' })}`)
  log(`innsjøer totalt: ${alle.json?.count ?? `HTTP ${alle.status}`}`)
  log(`med dybdekart satt: ${med.json?.count ?? `HTTP ${med.status} ${kort(med.json?.error ?? med.tekst ?? '')}`}`)
  const verdier = await hent(`${TJENESTE}/5/query?${q({
    where: 'dybdekart IS NOT NULL', outFields: 'dybdekart', returnDistinctValues: 'true',
    returnGeometry: 'false', f: 'json',
  })}`)
  const v = (verdier.json?.features ?? []).map(f => f.attributes?.dybdekart)
  log(`distinkte verdier (${v.length}): ${kort(v.slice(0, 12), 600)}`)
  const eks = await hent(`${TJENESTE}/5/query?${q({
    where: 'dybdekart IS NOT NULL', outFields: 'vatnlnr,navn,areal_km2,dybdekart',
    returnGeometry: 'false', resultRecordCount: '8', orderByFields: 'areal_km2 DESC', f: 'json',
  })}`)
  for (const f of eks.json?.features ?? []) log(`  ${kort(f.attributes, 300)}`)
  // Andel per arealklasse: små tjern er de fleste innsjøene, og det er der et
  // padle-ark mest sannsynlig mangler dybde.
  for (const [fra, til] of [[0, 0.1], [0.1, 1], [1, 10], [10, 1e6]]) {
    const w = `areal_km2 >= ${fra} AND areal_km2 < ${til}`
    const a = await hent(`${TJENESTE}/5/query?${q({ where: w, returnCountOnly: 'true', f: 'json' })}`)
    const b = await hent(`${TJENESTE}/5/query?${q({ where: `${w} AND dybdekart IS NOT NULL`, returnCountOnly: 'true', f: 'json' })}`)
    const na = a.json?.count, nb = b.json?.count
    const pst = na ? ` (${(100 * nb / na).toFixed(1)} %)` : ''
    log(`  ${fra}–${til >= 1e6 ? '∞' : til} km²: ${nb ?? '?'} av ${na ?? '?'}${pst}`)
  }
}

async function trinn3() {
  log('\n━━ 3. identify over kjente innsjøer (layers=all) ━━')
  for (const s of INNSJOER) {
    const d = 0.002
    const r = await hent(`${TJENESTE}/identify?${q({
      geometry: `${s.lon},${s.lat}`, geometryType: 'esriGeometryPoint', sr: '4326',
      layers: 'all', tolerance: '2', mapExtent: `${s.lon - d},${s.lat - d},${s.lon + d},${s.lat + d}`,
      imageDisplay: '400,400,96', returnGeometry: 'true', f: 'json',
    })}`)
    const res = r.json?.results ?? []
    log(`${s.navn}: HTTP ${r.status}, ${res.length} treff, ${r.ms} ms`)
    for (const t of res) {
      const a = t.attributes ?? {}
      const dyb = Object.entries(a).filter(([k]) => DYBDE_RE.test(k))
      log(`  [${t.layerId}] ${t.layerName} — ${t.geometryType ?? '–'}, ${tellHjorner(t.geometry)} hjørner` +
        (dyb.length ? ` · ${dyb.map(([k, v]) => `${k}=${v}`).join(', ')}` : ''))
    }
  }
}

async function trinn4(dybdeLag) {
  log('\n━━ 4. Dybde-geometri: hva koster den per innsjø? ━━')
  const geoLag = dybdeLag.filter(l => l.geometri && l.geometri !== 'esriGeometryPoint')
  if (!geoLag.length) log('ingen dybde-lag med linje-/flategeometri i Innsjodatabase2')
  for (const l of geoLag) {
    for (const s of INNSJOER.slice(0, 4)) {
      const d = 0.03
      const r = await hent(`${TJENESTE}/${l.id}/query?${q({
        geometry: `${s.lon - d},${s.lat - d},${s.lon + d},${s.lat + d}`,
        geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
        outFields: '*', returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', f: 'geojson',
      })}`, 60000)
      const f = r.json?.features ?? []
      const hj = f.reduce((s, x) => s + JSON.stringify(x.geometry?.coordinates ?? []).split('],[').length, 0)
      log(`  [${l.id}] ${l.navn} @ ${s.navn}: HTTP ${r.status}, ${f.length} objekter, ~${hj} hjørner, ` +
        `${(r.bytes / 1024).toFixed(0)} kB, ${r.ms} ms`)
      if (f[0]) log(`      eks: ${kort(f[0].properties, 300)}`)
      if (f.length) {
        const verdier = [...new Set(f.flatMap(x => l.dybdeFelt.map(k => x.properties?.[k])).filter(v => v != null))]
          .sort((a, b) => a - b)
        log(`      dybdeverdier: ${kort(verdier, 300)}`)
      }
    }
  }
}

async function main() {
  const dybdeLag = await trinn1().catch(e => { log(`trinn 1 feilet: ${e}`); return [] })
  await trinn2().catch(e => log(`trinn 2 feilet: ${e}`))
  await trinn3().catch(e => log(`trinn 3 feilet: ${e}`))
  await trinn4(dybdeLag).catch(e => log(`trinn 4 feilet: ${e}`))
  mkdirSync('probe-ut', { recursive: true })
  writeFileSync('probe-ut/innsjo-dybde.txt', ut.join('\n') + '\n')
}

main().catch(e => console.error(e)).finally(() => process.exit(0))

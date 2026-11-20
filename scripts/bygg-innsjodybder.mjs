#!/usr/bin/env node
// Baker NVEs dybdedata for oppmålte innsjøer:
//   • src/lib/innsjoDybderData.js       maksdyp/snittdyp/år per innsjø (lag 4)
//   • public/data/innsjo-dybde/<nr>.json dybdekurver (lag 2) + omriss (lag 3)
//   • public/data/innsjo-dybde/indeks.json  søkelista i «Om appen»: navn, kart-
//     utsnittet et klikk bygger (kartUtsnitt), maksdyp og areal
//
// Kildene er målt av probe-innsjo-dybde (nov. 2026): Innsjodatabase2 lag 4
// «Dybdekart» har `maksdyp_m`, `middeldyp_m`, `oppmaltaar`; lag 2 «DybdeKurve»
// har linjer med `dybde_m` og `objekttype` (Dybdekurve, Innsjøkant,
// ØyInnsjøGrense); lag 3 «Innsjo_ved_dybdemaling» er innsjøflata slik den var
// da den ble målt. Alt nøklet på `vatnlnr`.
//
// NVE svarer 403 fra utviklings-sandkassene, så baken kjøres i CI
// (bygg-innsjodybder.yml). Feiler hardt hvis tabellen blir tom eller kraftig
// mindre enn før: en halv tabell committet som sannhet er verre enn ingen bake.
//
//   --mal   mål størrelsen på kurvefilene, skriv ingenting

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { samleDybder, dybdeModulKilde } from '../src/lib/innsjoDybde.js'
import { byggKurveFil, lesKurveFil, kartUtsnitt } from '../src/lib/innsjoKurver.js'

const TJENESTE = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer'
const UT = new URL('../src/lib/innsjoDybderData.js', import.meta.url)
const KURVE_DIR = new URL('../public/data/innsjo-dybde/', import.meta.url)
const UA = { 'User-Agent': 'lende-bake/1.0 (github.com/gitjanerik/lende)' }
const MAL = process.argv.includes('--mal')
const SAMTIDIG = 4

async function query(lag, params, forsok = 3) {
  const p = new URLSearchParams({ orderByFields: 'objectid', ...params })
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(`${TJENESTE}/${lag}/query?${p}`, { headers: UA, signal: AbortSignal.timeout(90000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.error) throw new Error(`ArcGIS: ${j.error.message ?? j.error.code}`)
      return j
    } catch (e) {
      if (i + 1 >= forsok) throw e
      await new Promise(r => setTimeout(r, 1500 * (i + 1)))
    }
  }
}

async function alle(lag, params, felt) {
  const ut = []
  for (let offset = 0, n = 0; n < 100; n++) {
    const j = await query(lag, { ...params, resultOffset: String(offset) })
    const f = j.features ?? []
    ut.push(...f.map(felt))
    offset += f.length
    const mer = j.exceededTransferLimit === true || j.properties?.exceededTransferLimit === true
    if (!mer || f.length === 0) break
  }
  return ut
}

// ── Tabellen ────────────────────────────────────────────────────────────
const rader = await alle(4, {
  where: '1=1', outFields: 'vatnlnr,maksdyp_m,middeldyp_m,oppmaltaar', returnGeometry: 'false', f: 'json',
}, f => f.attributes)
const dybder = samleDybder(rader)
console.log(`${rader.length} rader → ${dybder.size} innsjøer med maksdyp`)

let forrige = 0
try { forrige = (readFileSync(UT, 'utf8').match(/^ {2}\d+:/gm) ?? []).length } catch { /* første bake */ }
if (dybder.size === 0) throw new Error('Tomt svar fra NVE — ingenting skrives')
if (forrige > 0 && dybder.size < forrige * 0.8) {
  throw new Error(`Bare ${dybder.size} innsjøer mot ${forrige} sist — ingenting skrives`)
}

// ── Kurvene, én innsjø om gangen (fire i flukt) ─────────────────────────
const geo = { outSR: '4326', geometryPrecision: '6', returnGeometry: 'true', f: 'geojson' }
const nrListe = [...dybder.keys()].sort((a, b) => a - b)
const filer = new Map()
const utsnitt = new Map()
let feil = 0, totalBytes = 0
const storste = []
let neste = 0
async function arbeider() {
  while (neste < nrListe.length) {
    const nr = nrListe[neste++]
    try {
      const where = `vatnlnr = ${nr}`
      const [kurver, omriss] = await Promise.all([
        alle(2, { where, outFields: 'dybde_m,objekttype', ...geo }, f => f),
        alle(3, { where, outFields: 'innsjonavn', ...geo }, f => f),
      ])
      const fil = byggKurveFil(nr, kurver, omriss)
      if (!fil.kurver.length || !fil.omriss.length) continue
      const tekst = JSON.stringify(fil)
      filer.set(nr, tekst)
      const lest = lesKurveFil(fil)
      utsnitt.set(nr, {
        ...kartUtsnitt(lest.omriss, lest.kurver),
        maaltNavn: omriss.find(f => f.properties?.innsjonavn)?.properties.innsjonavn ?? null,
      })
      totalBytes += tekst.length
      storste.push([nr, tekst.length])
    } catch (e) {
      feil++
      console.warn(`  ${nr}: ${e.message}`)
    }
  }
}
await Promise.all(Array.from({ length: SAMTIDIG }, arbeider))
storste.sort((a, b) => b[1] - a[1])
console.log(`${filer.size} innsjøer med dybdekurver, ${(totalBytes / 1e6).toFixed(1)} MB rå JSON, ${feil} feilet`)
console.log(`Største: ${storste.slice(0, 5).map(([nr, b]) => `${nr} (${(b / 1024).toFixed(0)} kB)`).join(', ')}`)
if (feil > nrListe.length * 0.1) throw new Error(`${feil} innsjøer feilet — ingenting skrives`)
// Taket er et anslag-vern, ikke et designmål: alt over dette er et tegn på at
// forenklingen ikke virket, og hver MB blir liggende i git-historikken.
const TAK_MB = 40
if (!MAL && totalBytes > TAK_MB * 1e6) {
  throw new Error(`${(totalBytes / 1e6).toFixed(1)} MB er over taket på ${TAK_MB} MB — ingenting skrives. Kjør med --mal og øk toleransen.`)
}

// ── Navnene: Innsjødatabasens eget navn (lag 5), som er det kartet viser.
// Navnet fra dybdemålingen er ofte et annet — Tyrifjorden ble målt som
// «Holsfjorden» — så det blir et søkbart alias.
const navn = new Map()
const areal = new Map()
const nrMedKurver = [...filer.keys()]
for (let i = 0; i < nrMedKurver.length; i += 100) {
  const bit = nrMedKurver.slice(i, i + 100)
  const rad = await alle(5, {
    where: `vatnlnr IN (${bit.join(',')})`, outFields: 'vatnlnr,navn,areal_km2', returnGeometry: 'false', f: 'json',
  }, f => f.attributes)
  for (const a of rad) {
    if (a.navn && !navn.has(a.vatnlnr)) navn.set(a.vatnlnr, a.navn)
    if (Number.isFinite(a.areal_km2)) areal.set(a.vatnlnr, Math.max(areal.get(a.vatnlnr) ?? 0, a.areal_km2))
  }
}
const indeks = nrMedKurver.map((nr) => {
  const u = utsnitt.get(nr)
  const n = navn.get(nr) ?? u.maaltNavn ?? null
  return {
    nr,
    navn: n,
    alias: u.maaltNavn && u.maaltNavn !== n ? u.maaltNavn : undefined,
    lat: Math.round(u.lat * 1e5) / 1e5,
    lon: Math.round(u.lon * 1e5) / 1e5,
    km: u.km,
    demo: u.demo || undefined,
    maks: dybder.get(nr)?.maks ?? null,
    km2: areal.has(nr) ? Math.round(areal.get(nr) * 100) / 100 : null,
  }
}).sort((a, b) => (a.navn ?? '~').localeCompare(b.navn ?? '~', 'nb'))
console.log(`Indeks: ${indeks.length} innsjøer, ${indeks.filter(i => i.navn).length} med navn, ${indeks.filter(i => i.demo).length} som demo-utsnitt`)
for (const vil of ['Tyrifjorden', 'Bogstadvannet', 'Gjende', 'Vansjø', 'Setten', 'Fjorda', 'Mjøsa', 'Femunden']) {
  const t = indeks.find(i => i.navn === vil || i.alias === vil)
  console.log(`  ${vil}: ${t ? `nr ${t.nr}, ${t.km} km${t.demo ? ' (demo)' : ''}, maks ${t.maks} m` : 'IKKE MED'}`)
}

if (MAL) {
  console.log('--mal: ingenting skrevet')
} else {
  mkdirSync(KURVE_DIR, { recursive: true })
  for (const fil of readdirSync(KURVE_DIR)) {
    const m = fil.match(/^(\d+)\.json$/)
    if (m && !filer.has(Number(m[1]))) rmSync(new URL(fil, KURVE_DIR))
  }
  for (const [nr, tekst] of filer) writeFileSync(new URL(`${nr}.json`, KURVE_DIR), tekst)
  writeFileSync(new URL('indeks.json', KURVE_DIR), JSON.stringify({ v: 1, innsjoer: indeks }))
  const hentet = new Date().toISOString().slice(0, 10)
  writeFileSync(UT, dybdeModulKilde(dybder, {
    kilde: 'NVE Innsjødatabasen, lag «Dybdekart»', hentet, medKurver: new Set(filer.keys()),
  }))
  const dypeste = [...dybder.entries()].sort((a, b) => b[1].maks - a[1].maks).slice(0, 3)
  console.log(`Dypeste: ${dypeste.map(([nr, d]) => `${nr} (${d.maks} m)`).join(', ')}`)
}

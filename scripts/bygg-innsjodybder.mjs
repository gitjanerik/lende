#!/usr/bin/env node
// Baker maksdyp for NVEs dybdekartlagte innsjøer til src/lib/innsjoDybderData.js.
//
// Kilden er laget «Dybdekart» (id 4) i Innsjodatabase2 — målt av
// probe-innsjo-dybde i nov. 2026: ~600 innsjøer, felt `maksdyp_m`,
// `middeldyp_m`, `oppmaltaar`, nøklet på `vatnlnr`. Laget appen henter
// innsjøflatene fra (id 5) har bare flagget `dybdekart = 'J'`.
//
// NVE svarer 403 fra utviklings-sandkassene, så baken kjøres i CI
// (bygg-innsjodybder.yml). Feiler hardt hvis svaret er tomt eller kraftig
// mindre enn før: en halv tabell committet som sannhet er verre enn ingen bake.

import { readFileSync, writeFileSync } from 'node:fs'
import { samleDybder, dybdeModulKilde } from '../src/lib/innsjoDybde.js'

const LAG = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/4'
const UT = new URL('../src/lib/innsjoDybderData.js', import.meta.url)
const UA = { 'User-Agent': 'lende-bake/1.0 (github.com/gitjanerik/lende)' }

async function side(offset) {
  const p = new URLSearchParams({
    where: '1=1',
    outFields: 'vatnlnr,maksdyp_m,middeldyp_m,oppmaltaar',
    returnGeometry: 'false',
    orderByFields: 'objectid',
    resultOffset: String(offset),
    f: 'json',
  })
  const res = await fetch(`${LAG}/query?${p}`, { headers: UA, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (j.error) throw new Error(`ArcGIS: ${j.error.message ?? j.error.code}`)
  return { rader: (j.features ?? []).map(f => f.attributes), mer: j.exceededTransferLimit === true }
}

const rader = []
for (let offset = 0, n = 0; n < 50; n++) {
  const { rader: r, mer } = await side(offset)
  rader.push(...r)
  offset += r.length
  if (!mer || r.length === 0) break
}

const dybder = samleDybder(rader)
console.log(`${rader.length} rader → ${dybder.size} innsjøer med maksdyp`)

let forrige = 0
try { forrige = (readFileSync(UT, 'utf8').match(/^ {2}\d+:/gm) ?? []).length } catch { /* første bake */ }
if (dybder.size === 0) throw new Error('Tomt svar fra NVE — tabellen skrives ikke')
if (forrige > 0 && dybder.size < forrige * 0.8) {
  throw new Error(`Bare ${dybder.size} innsjøer mot ${forrige} sist — tabellen skrives ikke`)
}

const hentet = new Date().toISOString().slice(0, 10)
writeFileSync(UT, dybdeModulKilde(dybder, { kilde: 'NVE Innsjødatabasen, lag «Dybdekart»', hentet }))
const dypeste = [...dybder.entries()].sort((a, b) => b[1].maks - a[1].maks).slice(0, 3)
console.log(`Dypeste: ${dypeste.map(([nr, d]) => `${nr} (${d.maks} m)`).join(', ')}`)

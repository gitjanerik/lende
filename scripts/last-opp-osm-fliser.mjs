#!/usr/bin/env node
// Laster OSM-flisene fra baken (scripts/bygg-osm-fliser.mjs) opp i R2, pakket
// per 1° × 1° (src/lib/osmPakke.js), via Cloudflares REST-API.
//
//   b/<bake-id>/<pakke>.bin        flisene etter hverandre
//   b/<bake-id>/<pakke>.idx.json   { "<sti>": [offset, lengde] }
//   manifest.json                  baken + `prefiks` — skrives SIST
//
// Manifestet skrives sist med vilje: Workeren slår opp pakkene gjennom det, så
// fram til det står, leser alle forrige bake ferdig og helt. En bake som
// feiler halvveis etterlater ubrukte pakker, ikke et kart med blandede fliser.
// Alle andre baker enn denne og den forrige (den manifestet pekte på) slettes
// til slutt — den forrige blir stående, for en klient kan være midt i et kart
// bygget av den.
//
// Kjør:  CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… \
//          node scripts/last-opp-osm-fliser.mjs --fliser osm-fliser [--torr]

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { osmPakkeForSti, pakkeNokkel, indeksNokkel, bakeId } from '../src/lib/osmPakke.js'

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const DIR = argVal('--fliser') ?? 'osm-fliser'
const TORR = args.includes('--torr')
const BOTTE = argVal('--botte') ?? 'lende-osm'
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: KONTO } = process.env
const API = `https://api.cloudflare.com/client/v4/accounts/${KONTO}/r2/buckets/${BOTTE}`

// Cloudflare: 1 200 kall per fem minutter per bruker. 3 i sekundet holder seg
// godt under, også når en annen workflow deployer samtidig.
const KALL_PER_S = 3
let nesteKall = 0
async function struping() {
  const naa = Date.now()
  const vent = Math.max(0, nesteKall - naa)
  nesteKall = Math.max(naa, nesteKall) + 1000 / KALL_PER_S
  if (vent) await new Promise(r => setTimeout(r, vent))
}

async function api(metode, sti, kropp, type = 'application/octet-stream') {
  for (let forsok = 1; ; forsok++) {
    await struping()
    const res = await fetch(`${API}${sti}`, {
      method: metode,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(kropp ? { 'Content-Type': type } : {}) },
      body: kropp,
    })
    if (res.ok) return res
    if (forsok >= 5 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`${metode} ${sti}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
    }
    await new Promise(r => setTimeout(r, 2000 * forsok))
  }
}

const legg = (nokkel, kropp, type) => api('PUT', `/objects/${encodeURIComponent(nokkel)}`, kropp, type)

async function listPrefikser() {
  const ut = new Set()
  let cursor = ''
  do {
    const q = new URLSearchParams({ prefix: 'b/', per_page: '1000', ...(cursor ? { cursor } : {}) })
    const svar = await (await api('GET', `/objects?${q}`)).json()
    for (const o of svar.result ?? []) ut.add(o.key.split('/').slice(0, 2).join('/'))
    cursor = svar.result_info?.cursor ?? ''
    if (!svar.result_info?.is_truncated) cursor = ''
  } while (cursor)
  return ut
}

async function forrigePrefiks() {
  await struping()
  const res = await fetch(`${API}/objects/manifest.json`, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET manifest.json: HTTP ${res.status}`)
  return (await res.json()).prefiks ?? null
}

async function slettPrefiks(prefiks) {
  let antall = 0
  let cursor = ''
  do {
    const q = new URLSearchParams({ prefix: `${prefiks}/`, per_page: '1000', ...(cursor ? { cursor } : {}) })
    const svar = await (await api('GET', `/objects?${q}`)).json()
    for (const o of svar.result ?? []) { await api('DELETE', `/objects/${encodeURIComponent(o.key)}`); antall++ }
    cursor = svar.result_info?.is_truncated ? (svar.result_info?.cursor ?? '') : ''
  } while (cursor)
  return antall
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'))
  const prefiks = `b/${bakeId(manifest.osmTid ?? manifest.bakt)}`
  const stier = readdirSync(DIR).filter(f => f.endsWith('.json.gz'))
  if (existsSync(join(DIR, 'delt'))) stier.push(...readdirSync(join(DIR, 'delt')).map(f => `delt/${f}`))

  const pakker = new Map()
  for (const sti of stier) {
    const p = osmPakkeForSti(sti)
    if (!p) throw new Error(`Ukjent fil i ${DIR}: ${sti}`)
    if (!pakker.has(p)) pakker.set(p, [])
    pakker.get(p).push(sti)
  }

  let bytes = 0
  const t0 = Date.now()
  console.log(`${stier.length} filer i ${pakker.size} pakker → ${BOTTE}/${prefiks}${TORR ? ' (tørrkjøring)' : ''}`)
  if (!TORR && (!TOKEN || !KONTO)) throw new Error('CLOUDFLARE_API_TOKEN og CLOUDFLARE_ACCOUNT_ID må være satt')
  for (const [pakke, liste] of [...pakker].sort()) {
    const deler = []
    const indeks = {}
    let offset = 0
    for (const sti of liste.sort()) {
      const b = readFileSync(join(DIR, sti))
      indeks[sti] = [offset, b.length]
      offset += b.length
      deler.push(b)
    }
    bytes += offset
    if (TORR) continue
    await legg(pakkeNokkel(prefiks, pakke), Buffer.concat(deler))
    await legg(indeksNokkel(prefiks, pakke), JSON.stringify(indeks), 'application/json')
  }
  console.log(`pakker: ${(bytes / 1e6).toFixed(1)} MB (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  if (TORR) return

  // Forrige bake er den manifestet peker på NÅ — ikke den nest nyeste prefiksen
  // i bøtta, som kan være en opplasting som døde før manifestet ble skrevet.
  const forrige = await forrigePrefiks()
  await legg('manifest.json', JSON.stringify({ ...manifest, prefiks, pakker: pakker.size }), 'application/json')
  console.log(`manifest.json → ${prefiks}${forrige ? ` (forrige: ${forrige})` : ''}`)

  // Alt annet slettes, så bøtta holder seg på to baker (~3 GB).
  const gamle = [...await listPrefikser()].filter(p => p !== prefiks && p !== forrige)
  for (const p of gamle) console.log(`slettet ${p}: ${await slettPrefiks(p)} objekter`)
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1) })

#!/usr/bin/env node
// Baker OSM-flisene (src/lib/osmFlis.js) fra et Geofabrik-uttrekk:
//
//   norway-latest.osm.pbf
//     → osmium tags-filter   (grovt, på nøklene selektorene krever)
//     → add-locations-to-ways (way-ene får koordinatene sine inline)
//     → OPL, to pass         (1: hvilke way-er er medlem av en relasjon vi
//                              skal ha; 2: alt, med eksakt selektor-test)
//     → én .json.gz per flis i Overpass' `out geom`-form + manifest.json
//
// Den grove filtreringen er osmiums, den eksakte er vår (`treffer`): osmium kan
// bare «nøkkel finnes / nøkkel=verdi», ikke regex og ikke flere krav på rad.
//
// Kjør:  node scripts/bygg-osm-fliser.mjs --pbf norway-latest.osm.pbf
//          [--bbox vest,sor,ost,nord] [--ut osm-fliser]
// CI:    .github/workflows/bygg-osm-fliser.yml

import { spawn, execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { mkdtempSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  osmSelektorer, filterNokler, treffer, flisNoklerForElement, deltFilnavn,
  GITTER, OSM_FLIS_VERSJON, DELT_TERSKEL_BYTES,
} from '../src/lib/osmFlis.js'
import { parseLinje, parseNoder } from './osmOpl.mjs'

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const PBF = argVal('--pbf')
const BBOX = argVal('--bbox')
const UT = argVal('--ut') ?? 'osm-fliser'
const log = (...a) => console.log(...a)

function osmium(...a) {
  execFileSync('osmium', a, { stdio: ['ignore', 'inherit', 'inherit'] })
}

/** Strøm OPL-linjer fra osmium cat. */
async function forHverLinje(pbf, ekstra, fn) {
  // Uten locations_on_ways skriver OPL-en bare node-id-ene, ikke koordinatene
  // add-locations-to-ways la inn — og hver way blir tom.
  const p = spawn('osmium', ['cat', pbf, ...ekstra, '-f', 'opl,locations_on_ways=true', '-o', '-'], { stdio: ['ignore', 'pipe', 'inherit'] })
  const rl = createInterface({ input: p.stdout, crlfDelay: Infinity })
  for await (const linje of rl) if (linje) fn(linje)
  const kode = await new Promise(r => p.on('close', r))
  if (kode !== 0) throw new Error(`osmium cat avsluttet med ${kode}`)
}

// Flis-skriving: buffer per flis, flush til disk når bufferet vokser. Et stort
// element i flere fliser skrives ÉN gang til delt/, og flisene får en peker.
function lagSkriver(dir, utDir) {
  const buf = new Map()
  const stat = { kopier: 0, delte: 0, deltBytes: 0, pekere: 0, storste: [] }
  mkdirSync(join(utDir, 'delt'), { recursive: true })
  const flush = (k, b) => { appendFileSync(join(dir, `${k}.ndjson`), b.deler.join('\n') + '\n'); b.deler = []; b.bytes = 0 }
  const legg = (k, linje) => {
    let b = buf.get(k)
    if (!b) buf.set(k, b = { deler: [], bytes: 0 })
    b.deler.push(linje)
    b.bytes += linje.length
    if (b.bytes > 1 << 18) flush(k, b)
  }
  return {
    stat,
    skriv(el) {
      const nokler = flisNoklerForElement(el)
      if (!nokler.length) return
      let json = JSON.stringify(el)
      if (json.length > DELT_TERSKEL_BYTES && nokler.length > 1) {
        const id = `${el.type}/${el.id}`
        const pakket = gzipSync(json, { level: 9 })
        writeFileSync(join(utDir, deltFilnavn(id)), pakket)
        stat.delte++
        stat.deltBytes += pakket.length
        stat.pekere += nokler.length
        stat.storste.push([id, pakket.length, nokler.length, el.tags?.name ?? ''])
        json = JSON.stringify({ $delt: id })
      } else stat.kopier += nokler.length
      for (const k of nokler) legg(k, json)
    },
    ferdig() { for (const [k, b] of buf) if (b.deler.length) flush(k, b) },
  }
}

async function bak() {
  if (!PBF) throw new Error('--pbf mangler')
  execFileSync('osmium', ['--version'], { stdio: 'ignore' })
  const sel = osmSelektorer()
  const nokler = filterNokler(sel)
  const tmp = mkdtempSync(join(tmpdir(), 'osm-fliser-'))
  const t0 = Date.now()
  const tid = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`
  try {
    let kilde = PBF
    if (BBOX) {
      kilde = join(tmp, 'utsnitt.pbf')
      // «smart» tar med hele way-er og multipolygoner som krysser kanten — som
      // Overpass gjør.
      osmium('extract', '-b', BBOX, '-s', 'smart', '-o', kilde, PBF)
      log(`utsnitt ${BBOX} (${tid()})`)
    }
    const filtrert = join(tmp, 'filtrert.pbf')
    const uttrykk = Object.entries({ n: nokler.node, w: nokler.way, r: nokler.relation })
      .filter(([, s]) => s.size).map(([t, s]) => `${t}/${[...s].join(',')}`)
    osmium('tags-filter', kilde, ...uttrykk, '-o', filtrert)
    log(`tags-filter: ${uttrykk.join(' ')} (${tid()})`)
    const lok = join(tmp, 'lokasjoner.pbf')
    osmium('add-locations-to-ways', filtrert, '-i', 'flex_mem', '-o', lok)
    log(`add-locations-to-ways (${tid()})`)

    // Pass 1: medlemmene til relasjonene vi skal ha.
    const medlemmer = new Set()
    let relasjoner = 0
    await forHverLinje(lok, ['-t', 'relation'], (linje) => {
      const r = parseLinje(linje)
      if (!treffer('relation', r.tags, sel)) return
      relasjoner++
      for (const m of r.medlemmer ?? []) if (m.type === 'way') medlemmer.add(m.ref)
    })
    log(`pass 1: ${relasjoner} relasjoner, ${medlemmer.size} medlems-way-er (${tid()})`)

    // Pass 2: alt. Medlems-geometrien holdes som Float64Array til relasjonene kommer.
    const ndDir = join(tmp, 'nd')
    mkdirSync(ndDir)
    rmSync(UT, { recursive: true, force: true })
    mkdirSync(UT, { recursive: true })
    const skriver = lagSkriver(ndDir, UT)
    const geom = new Map()
    const antall = { node: 0, way: 0, relation: 0 }
    await forHverLinje(lok, [], (linje) => {
      const el = parseLinje(linje)
      if (!el) return
      if (el.type === 'node') {
        if (el.lat == null || !treffer('node', el.tags, sel)) return
        antall.node++
        skriver.skriv({ type: 'node', id: el.id, lat: el.lat, lon: el.lon, tags: el.tags })
      } else if (el.type === 'way') {
        const hit = treffer('way', el.tags, sel)
        const medlem = medlemmer.has(el.id)
        if (!hit && !medlem) return
        const g = parseNoder(el.nodeFelt)
        if (medlem) {
          const a = new Float64Array(g.length * 2)
          g.forEach((p, i) => { a[2 * i] = p.lat; a[2 * i + 1] = p.lon })
          geom.set(el.id, a)
        }
        if (hit && g.length) {
          antall.way++
          skriver.skriv({ type: 'way', id: el.id, geometry: g, tags: el.tags })
        }
      } else {
        if (!treffer('relation', el.tags, sel)) return
        const members = []
        for (const m of el.medlemmer ?? []) {
          if (m.type !== 'way') continue
          const a = geom.get(m.ref)
          if (!a?.length) continue
          const geometry = []
          for (let i = 0; i < a.length; i += 2) geometry.push({ lat: a[i], lon: a[i + 1] })
          members.push({ type: 'way', ref: m.ref, role: m.role, geometry })
        }
        if (!members.length) return
        antall.relation++
        skriver.skriv({ type: 'relation', id: el.id, members, tags: el.tags })
      }
    })
    skriver.ferdig()
    if (!antall.way) throw new Error('ingen way-er kom gjennom — mangler koordinatene i OPL-en?')
    const sum = antall.node + antall.way + antall.relation
    const st = skriver.stat
    log(`pass 2: ${antall.node} noder, ${antall.way} way-er, ${antall.relation} relasjoner; ` +
      `${st.kopier} flis-kopier (${(st.kopier / Math.max(1, sum - st.delte)).toFixed(2)} per element), ` +
      `${st.delte} delte (${(st.deltBytes / 1e6).toFixed(1)} MB gzip, ${st.pekere} pekere) (${tid()})`)

    // Pakk.
    const fliser = {}
    let raa = 0, gz = 0
    const store = []
    for (const f of readdirSync(ndDir)) {
      const k = f.replace(/\.ndjson$/, '')
      const alle = readFileSync(join(ndDir, f), 'utf8').trimEnd().split('\n')
      const linjer = alle.filter(l => !l.startsWith('{"$delt"'))
      const delte = alle.filter(l => l.startsWith('{"$delt"')).map(l => JSON.parse(l).$delt)
      const json = `{"version":0.6,"generator":"lende-osm-fliser","elements":[${linjer.join(',')}]` +
        (delte.length ? `,"delte":${JSON.stringify(delte)}}` : '}')
      const pakket = gzipSync(json, { level: 9 })
      writeFileSync(join(UT, `${k}.json.gz`), pakket)
      fliser[k] = pakket.length
      raa += json.length
      gz += pakket.length
      store.push([k, pakket.length, linjer.length])
    }
    const tidsstempel = osmiumTidsstempel(PBF)
    writeFileSync(join(UT, 'manifest.json'), JSON.stringify({
      versjon: OSM_FLIS_VERSJON, gitter: GITTER, osmTid: tidsstempel, bakt: new Date().toISOString(),
      antall: Object.keys(fliser).length, bytes: gz + st.deltBytes,
    }))
    store.sort((a, b) => b[1] - a[1])
    log('\n── OSM-fliser ────────────────────────')
    log(`  ${Object.keys(fliser).length} fliser, ${(raa / 1e6).toFixed(1)} MB rå, ${(gz / 1e6).toFixed(1)} MB gzip` +
      ` + ${st.delte} delte på ${(st.deltBytes / 1e6).toFixed(1)} MB`)
    const p95 = store.map(s => s[1]).sort((a, b) => a - b)[Math.floor(store.length * 0.95)] ?? 0
    log(`  median ${((store.map(s => s[1]).sort((a, b) => a - b)[store.length >> 1] ?? 0) / 1e3).toFixed(0)} KB, p95 ${(p95 / 1e3).toFixed(0)} KB`)
    log(`  OSM-data fra ${tidsstempel ?? 'ukjent tidspunkt'}`)
    log(`  største: ${store.slice(0, 5).map(([k, b, n]) => `${k} ${(b / 1e6).toFixed(2)} MB (${n} el.)`).join(', ')}`)
    if (st.storste.length) {
      st.storste.sort((a, b) => b[1] - a[1])
      log(`  største delte: ${st.storste.slice(0, 5).map(([id, b, n, navn]) => `${id} ${navn} ${(b / 1e3).toFixed(0)} KB × ${n} fliser`).join(', ')}`)
    }
    log(`  manifest: ${(statSync(join(UT, 'manifest.json')).size / 1e3).toFixed(0)} KB (${tid()})`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function osmiumTidsstempel(pbf) {
  try {
    const ut = execFileSync('osmium', ['fileinfo', '-g', 'header.option.osmosis_replication_timestamp', pbf], { encoding: 'utf8' }).trim()
    return ut || null
  } catch { return null }
}

bak().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1) })

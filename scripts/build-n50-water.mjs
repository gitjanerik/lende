// Bygg statisk N50-vann-datasett (FlatGeobuf) fra Kartverket/Geonorge —
// NASJONALT, én fil per fylke + et manifest (index.json).
//
// Kjøres i CI (full nett-tilgang; nedlasting.geonorge.no er blokkert fra
// utviklingssandkassen). N50 vektor-WFS er avviklet, så vi laster ned N50
// Kartdata via Geonorge Nedlasting-API (per fylke), trekker ut KUN INNSJØER
// (Innsjø + InnsjøRegulert — Setten er regulert!) med ogr2ogr, reprojiserer
// til EPSG:4326 og skriver ÉN FlatGeobuf per fylke. Elve-/bekkeflater (ElvBekk)
// og havflate droppes bevisst: elver/bekker tegnes fra OSM-linjer som før, og
// sjøen kommer autoritativt fra DEM (seaFromDem.js) + Sjøkart. Å ta med alt
// ferskvann sprengte GitHubs 100 MB/fil-grense (Finnmark ~169 MB); innsjøer
// alene holder datasettet håndterbart.
//
// Er en enkelt fylkes-innsjøfil likevel > ~95 MB (lite sannsynlig, men mulig
// på innsjø-tette Finnmark), deles den i bbox-fliser (<code>-<n>.fgb) under
// grensen via en quadtree — HELE flater som skjærer flisen tas med (ingen
// klipping), så innsjø-hull (øyer) forblir intakte. Klienten leser manifestet,
// velger fila(ene) som overlapper kart-bboxen, og spør hver på bbox via HTTP
// Range. Innsjø-øyer beholdes som INDRE RINGER → ekte hull (Kolstadøya i
// Setten), helt uten terskler/heuristikk.
//
// Bruk: node scripts/build-n50-water.mjs --area all --out public/data/n50-water
//   --area  'all' (alle fylker) eller en enkelt fylkeskode (f.eks. 32 = Akershus)
//   --out   ut-KATALOG (får <fylkeskode>.fgb + index.json)
// Miljø: GEONORGE_EMAIL (valgfri; åpne data krever normalt ikke innlogging)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, statSync, writeFileSync, existsSync, rmSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const N50_UUID = 'ea192681-d039-42ec-b1bc-f3ce04c189ac'
const API = 'https://nedlasting.geonorge.no/api'
// KUN innsjøer. InnsjøRegulert er kritisk (Setten er regulert). ElvBekk +
// Havflate + FerskvannTørrfall er BEVISST utelatt — se topp.
const WATER_OBJTYPES = ['Innsjø', 'InnsjøRegulert']
const WHERE = `objtype IN (${WATER_OBJTYPES.map(o => `'${o}'`).join(',')})`
// Lett forenkling (~2 m i grader) — under klientens egen DP (2 m i mapBuilder)
// → ingen synlig tap, men holder filene små.
const SIMPLIFY_DEG = '0.00002'
// Del en fylkes-fil hvis den overstiger dette (GitHubs harde grense er 100 MB).
const SPLIT_LIMIT_MB = 95
// Slutt å dele under ~5 km — unngå patologisk oppdeling av én stor flate.
const MIN_TILE_SPAN = 0.05

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const AREA = arg('area', 'all')
const OUTDIR = arg('out', 'public/data/n50-water')

function sh(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 30, ...opts })
}

const HDRS = { Accept: 'application/json', 'User-Agent': 'lende-n50/1.0' }

async function listFylker() {
  const res = await fetch(`${API}/codelists/area/${N50_UUID}`, { headers: HDRS })
  if (!res.ok) throw new Error(`area-codelist HTTP ${res.status}`)
  const areas = await res.json()
  return areas.filter(a => a.type === 'fylke')
}

function pickProjection(area) {
  const codes = (area.projections ?? []).map(p => p.code)
  for (const pref of ['25833', '25832', '25835']) if (codes.includes(pref)) return pref
  return codes[0] ?? '25833'
}

// Bestill + last ned + pakk ut N50 FGDB for ett fylke. Returnerer .gdb-sti.
async function downloadFylke(area, work) {
  const proj = pickProjection(area)
  const body = {
    email: process.env.GEONORGE_EMAIL || null,
    orderLines: [{
      metadataUuid: N50_UUID,
      areas: [{ code: area.code, type: 'fylke', name: area.name }],
      formats: [{ name: 'FGDB' }],
      projections: [{ code: proj }],
    }],
  }
  const res = await fetch(`${API}/order`, {
    method: 'POST',
    headers: { ...HDRS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`order HTTP ${res.status}`)
  const order = JSON.parse(await res.text())
  let files = order.files ?? []
  const refLink = (order._links ?? []).find(l => /self/.test(l.rel))?.href
    || (order.referenceNumber ? `${API}/order/${order.referenceNumber}` : null)
  for (let t = 0; files.length === 0 && refLink && t < 20; t++) {
    await new Promise(r => setTimeout(r, 5000))
    const pj = await (await fetch(refLink, { headers: HDRS })).json().catch(() => ({}))
    files = pj.files ?? []
  }
  if (files.length === 0) throw new Error('ingen nedlastingsfiler')
  const dir = join(work, `f${area.code}`); mkdirSync(dir, { recursive: true })
  for (const f of files) {
    const url = f.downloadUrl || f.url
    if (!url) continue
    const dest = join(dir, f.name || `part-${area.code}.zip`)
    sh('curl', ['-sSL', '-H', 'User-Agent:lende-n50/1.0', '-o', dest, url])
    if (/\.zip$/i.test(dest)) sh('unzip', ['-oq', dest, '-d', dir])
  }
  const found = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (e.endsWith('.gdb') && statSync(p).isDirectory()) { found.push(p); continue }
      if (statSync(p).isDirectory()) walk(p)
    }
  }
  walk(dir)
  if (!found.length) throw new Error('fant ingen .gdb')
  return found[0]
}

function arealLayerOf(gdb) {
  const info = sh('ogrinfo', ['-so', gdb])
  const layers = [...info.matchAll(/^Layer:\s+(\S+)/gm)].map(m => m[1])
  return layers.find(l => /arealdekke.*(omr|flate|område)/i.test(l)) || layers.find(l => /arealdekke/i.test(l))
}

// Datautstrekning (WGS84) fra ogrinfo → [minLon, minLat, maxLon, maxLat].
function extentOf(src, layer = 'n50_water') {
  const info = sh('ogrinfo', ['-so', '-ro', src, layer])
  const m = info.match(/Extent:\s*\(([-\d.]+),\s*([-\d.]+)\)\s*-\s*\(([-\d.]+),\s*([-\d.]+)\)/)
  if (!m) return null
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])]
}

function featureCount(fgb) {
  const info = sh('ogrinfo', ['-so', '-ro', fgb, 'n50_water'])
  const m = info.match(/Feature Count:\s*(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

// Skriv innsjø-flater fra gpkg (evt. begrenset til bbox-rect) til FlatGeobuf.
// -spat tar med HELE flater som skjærer rektangelet (ingen klipping) → hull
// intakte. Returnerer størrelse i MB (0 hvis ingen fil).
function writeFgb(gpkg, rect, outFile) {
  const args = ['-f', 'FlatGeobuf', '-nln', 'n50_water', '-nlt', 'MULTIPOLYGON']
  if (rect) args.push('-spat', String(rect[0]), String(rect[1]), String(rect[2]), String(rect[3]))
  args.push(outFile, gpkg, 'n50_water')
  sh('ogr2ogr', args)
  return existsSync(outFile) ? statSync(outFile).size / 1e6 : 0
}

// Quadtree: del rect til hver flis er ≤ SPLIT_LIMIT_MB (eller min-span nådd).
// Skriver <code>-<n>.fgb og pusher manifest-innslag. Synkron/dybde-først → én
// probe-fil om gangen er trygt.
function emitTiles(gpkg, code, name, rect, entries, ctr, depth) {
  const probe = join(OUTDIR, '__probe.fgb')
  const mb = writeFgb(gpkg, rect, probe)
  if (mb === 0 || featureCount(probe) === 0) { rmSync(probe, { force: true }); return }
  const spanX = rect[2] - rect[0], spanY = rect[3] - rect[1]
  const splittable = spanX > MIN_TILE_SPAN && spanY > MIN_TILE_SPAN && depth < 6
  if (mb <= SPLIT_LIMIT_MB || !splittable) {
    const file = `${code}-${ctr.n++}.fgb`
    const dest = join(OUTDIR, file)
    renameSync(probe, dest)
    entries.push({ code, name, file, bbox: extentOf(dest), sizeMb: +mb.toFixed(2) })
    console.log(`  flis ${file} — ${mb.toFixed(1)} MB`)
    if (mb > SPLIT_LIMIT_MB) console.warn(`ADVARSEL: ${file} = ${mb.toFixed(1)} MB (udelelig ned til min-span)`)
    return
  }
  rmSync(probe, { force: true })
  const mx = (rect[0] + rect[2]) / 2, my = (rect[1] + rect[3]) / 2
  emitTiles(gpkg, code, name, [rect[0], rect[1], mx, my], entries, ctr, depth + 1)
  emitTiles(gpkg, code, name, [mx, rect[1], rect[2], my], entries, ctr, depth + 1)
  emitTiles(gpkg, code, name, [rect[0], my, mx, rect[3]], entries, ctr, depth + 1)
  emitTiles(gpkg, code, name, [mx, my, rect[2], rect[3]], entries, ctr, depth + 1)
}

// Konverter ett fylke: gdb → innsjø-gpkg (4326) → én fgb, eller fliser hvis
// for stor. Pusher manifest-innslag.
function processFylke(gdb, layer, area, work, entries) {
  const gpkg = join(work, `${area.code}.gpkg`)
  sh('ogr2ogr', [
    '-f', 'GPKG', '-t_srs', 'EPSG:4326',
    '-simplify', SIMPLIFY_DEG, '-makevalid',
    '-nln', 'n50_water', '-nlt', 'MULTIPOLYGON',
    '-where', WHERE,
    gpkg, gdb, layer,
  ])
  const whole = join(OUTDIR, `${area.code}.fgb`)
  const mb = writeFgb(gpkg, null, whole)
  if (mb === 0 || featureCount(whole) === 0) { rmSync(whole, { force: true }); return }
  if (mb <= SPLIT_LIMIT_MB) {
    entries.push({ code: area.code, name: area.name ?? null, file: `${area.code}.fgb`, bbox: extentOf(whole), sizeMb: +mb.toFixed(2) })
    console.log(`✓ ${area.code} ${area.name ?? ''} — ${mb.toFixed(1)} MB (én fil)`)
  } else {
    rmSync(whole, { force: true })
    const ext = extentOf(gpkg)
    const ctr = { n: 0 }
    emitTiles(gpkg, area.code, area.name ?? null, ext, entries, ctr, 0)
    console.log(`✓ ${area.code} ${area.name ?? ''} — ${mb.toFixed(1)} MB → ${ctr.n} fliser`)
  }
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'n50-'))
  console.log('workdir', work, '| area', AREA, '| out', OUTDIR)

  let areas
  if (AREA === 'all') {
    areas = await listFylker()
    console.log(`Fylker: ${areas.length} — ${areas.map(a => `${a.code}:${a.name}`).join(', ')}`)
  } else {
    areas = [{ code: AREA, type: 'fylke', projections: [{ code: '25833' }, { code: '25832' }] }]
  }

  mkdirSync(OUTDIR, { recursive: true })
  const manifest = { generated: process.env.BAKE_DATE || null, objtypes: WATER_OBJTYPES, fylker: [] }

  for (const area of areas) {
    const t0 = Date.now()
    try {
      const gdb = await downloadFylke(area, work)
      const layer = arealLayerOf(gdb)
      if (!layer) throw new Error('fant ikke arealdekke-lag')
      processFylke(gdb, layer, area, work, manifest.fylker)
      console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
    } catch (e) {
      console.warn(`✗ ${area.code} ${area.name ?? ''}: ${e.message}`)
    }
  }
  if (manifest.fylker.length === 0) throw new Error('ingen fylker lyktes')

  manifest.fylker.sort((a, b) => a.file.localeCompare(b.file))
  const maxMb = Math.max(...manifest.fylker.map(f => f.sizeMb))
  writeFileSync(join(OUTDIR, 'index.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`SKREV manifest — ${manifest.fylker.length} filer, største ${maxMb.toFixed(1)} MB`)

  // Selvtest: Kolstadøya-bboxen (Akershus = 32) skal ha innsjø-flater med hull.
  const akershus = join(OUTDIR, '32.fgb')
  if (existsSync(akershus)) {
    console.log('=== selvtest Kolstadøya (32) ===')
    console.log(sh('ogrinfo', ['-ro', '-so', '-spat', '11.66', '59.78', '11.71', '59.82', akershus, 'n50_water']).slice(0, 800))
  }
  console.log('DONE')
}

main().catch(e => { console.error('FEIL:', e.message); process.exit(1) })

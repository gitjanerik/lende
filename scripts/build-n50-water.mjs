// Bygg statisk N50-vann-datasett (FlatGeobuf) fra Kartverket/Geonorge —
// NASJONALT, én fil per fylke + et manifest (index.json).
//
// Kjøres i CI (full nett-tilgang; nedlasting.geonorge.no er blokkert fra
// utviklingssandkassen). N50 vektor-WFS er avviklet, så vi laster ned N50
// Kartdata via Geonorge Nedlasting-API (per fylke), trekker ut KUN
// FERSKVANN-flater (innsjø inkl. regulert, elv/bekk-flate, tørrlagt elveløp)
// med ogr2ogr, reprojiserer til EPSG:4326 og skriver ÉN FlatGeobuf per fylke.
// Havflate (sjø) droppes bevisst: den er enorm nasjonalt (sprenger GitHubs
// 100 MB/fil-grense) og Lende henter uansett sjø autoritativt fra DEM
// (seaFromDem.js) + Sjøkart. Klienten (n50Fetcher) leser manifestet, velger
// fylkes-fila(ene) som overlapper kart-bboxen, og spør hver fil på bbox via
// HTTP Range. Vann-polygonene beholder øyer som INDRE RINGER → øyene blir
// ekte hull i kartet (Kolstadøya i Setten) — helt uten terskler/heuristikk.
//
// Bruk: node scripts/build-n50-water.mjs --area all --out public/data/n50-water
//   --area  'all' (alle fylker) eller en enkelt fylkeskode (f.eks. 32 = Akershus)
//   --out   ut-KATALOG (får <fylkeskode>.fgb + index.json)
// Miljø: GEONORGE_EMAIL (valgfri; åpne data krever normalt ikke innlogging)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const N50_UUID = 'ea192681-d039-42ec-b1bc-f3ce04c189ac'
const API = 'https://nedlasting.geonorge.no/api'
// N50 ferskvann: Innsjø + InnsjøRegulert (Setten er regulert!) + ElvBekk-flate
// + FerskvannTørrfall (tørrlagt elveløp). Havflate er BEVISST utelatt — se topp.
const WATER_OBJTYPES = ['Innsjø', 'InnsjøRegulert', 'ElvBekk', 'FerskvannTørrfall']
const WHERE = `objtype IN (${WATER_OBJTYPES.map(o => `'${o}'`).join(',')})`
// Lett forenkling (~2 m i grader) på hver fylkes-FGB. Under klientens egen DP
// (2 m i mapBuilder) → ingen synlig tap, men holder filene små.
const SIMPLIFY_DEG = '0.00002'

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

// Les FGB-ens datautstrekning (WGS84) fra ogrinfo → [minLon, minLat, maxLon, maxLat].
function extentOf(fgb) {
  const info = sh('ogrinfo', ['-so', '-ro', fgb, 'n50_water'])
  const m = info.match(/Extent:\s*\(([-\d.]+),\s*([-\d.]+)\)\s*-\s*\(([-\d.]+),\s*([-\d.]+)\)/)
  if (!m) return null
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])]
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
  let maxMb = 0

  for (const area of areas) {
    const t0 = Date.now()
    try {
      const gdb = await downloadFylke(area, work)
      const layer = arealLayerOf(gdb)
      if (!layer) throw new Error('fant ikke arealdekke-lag')
      const outFile = join(OUTDIR, `${area.code}.fgb`)
      sh('ogr2ogr', [
        '-f', 'FlatGeobuf', '-t_srs', 'EPSG:4326',
        '-simplify', SIMPLIFY_DEG, '-makevalid',
        '-nln', 'n50_water', '-nlt', 'MULTIPOLYGON',
        '-where', WHERE,
        outFile, gdb, layer,
      ])
      if (!existsSync(outFile)) throw new Error('ogr2ogr skrev ingen fil')
      const mb = statSync(outFile).size / 1e6
      maxMb = Math.max(maxMb, mb)
      const bbox = extentOf(outFile)
      manifest.fylker.push({ code: area.code, name: area.name ?? null, file: `${area.code}.fgb`, bbox, sizeMb: +mb.toFixed(2) })
      console.log(`✓ ${area.code} ${area.name ?? ''} — ${mb.toFixed(1)} MB bbox=${JSON.stringify(bbox)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
      if (mb > 95) console.warn(`ADVARSEL: ${area.code} = ${mb.toFixed(1)} MB nærmer seg GitHubs 100 MB-grense.`)
    } catch (e) {
      console.warn(`✗ ${area.code} ${area.name ?? ''}: ${e.message}`)
    }
  }
  if (manifest.fylker.length === 0) throw new Error('ingen fylker lyktes')

  manifest.fylker.sort((a, b) => a.code.localeCompare(b.code))
  writeFileSync(join(OUTDIR, 'index.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`SKREV manifest — ${manifest.fylker.length} fylker, største fil ${maxMb.toFixed(1)} MB`)

  // Selvtest: Kolstadøya-bboxen (Akershus = 32) skal ha vann-flater med hull.
  const akershus = join(OUTDIR, '32.fgb')
  if (existsSync(akershus)) {
    console.log('=== selvtest Kolstadøya (32) ===')
    console.log(sh('ogrinfo', ['-ro', '-so', '-spat', '11.66', '59.78', '11.71', '59.82', akershus, 'n50_water']).slice(0, 800))
  }
  console.log('DONE')
}

main().catch(e => { console.error('FEIL:', e.message); process.exit(1) })

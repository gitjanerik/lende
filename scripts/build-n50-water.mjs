// Bygg statisk N50-vann-datasett (FlatGeobuf) fra Kartverket/Geonorge.
//
// Kjøres i CI (full nett-tilgang; nedlasting.geonorge.no er blokkert fra
// utviklingssandkassen). N50 vektor-WFS er avviklet, så vi laster ned N50
// Kartdata via Geonorge Nedlasting-API, trekker ut KUN vann-flater (innsjø
// inkl. regulert, elv/bekk-flate, havflate) med ogr2ogr, reprojiserer til
// EPSG:4326 og skriver FlatGeobuf. Klienten (n50Fetcher) spør fila på bbox via
// HTTP Range. Vann-polygonene beholder øyer som indre ringer → øyene blir
// ekte hull i kartet (ingen terskler/heuristikk).
//
// Bruk: node scripts/build-n50-water.mjs --area 32 --out public/data/n50-water.fgb
//   --area  fylkeskode (default 32 = Akershus; dekker Setten/Aurskog-Høland)
//   --out   utfil (FlatGeobuf)
// Miljø: GEONORGE_EMAIL (valgfri; åpne data krever normalt ikke innlogging)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const N50_UUID = 'ea192681-d039-42ec-b1bc-f3ce04c189ac'
const API = 'https://nedlasting.geonorge.no/api'
// N50-vann: objtyper i Arealdekke som er vann + ElvBekk-flate. InnsjøRegulert
// er kritisk (Setten er regulert). FerskvannTørrfall tas med (tørrlagt elveløp).
const WATER_OBJTYPES = ['Innsjø', 'InnsjøRegulert', 'ElvBekk', 'Havflate', 'FerskvannTørrfall']

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const AREA = arg('area', '32')
const OUT = arg('out', 'public/data/n50-water.fgb')

function sh(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 30, ...opts })
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'n50-'))
  console.log('workdir', work)

  // 1. Bestill N50 for fylket i FGDB / UTM33.
  const orderBody = {
    email: process.env.GEONORGE_EMAIL || null,
    orderLines: [{
      metadataUuid: N50_UUID,
      areas: [{ code: AREA, type: 'fylke' }],
      formats: [{ name: 'FGDB' }],
      projections: [{ code: '25833' }],
    }],
  }
  console.log('ORDER body:', JSON.stringify(orderBody))
  const orderRes = await fetch(`${API}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'lende-n50/1.0' },
    body: JSON.stringify(orderBody),
  })
  console.log('ORDER status', orderRes.status)
  const orderText = await orderRes.text()
  console.log('ORDER response (head):', orderText.slice(0, 1500))
  if (!orderRes.ok) throw new Error(`order feilet: HTTP ${orderRes.status}`)
  const order = JSON.parse(orderText)

  // 2. Finn nedlastings-URL-er. Åpne data leverer ofte `files` direkte; ellers
  // poll ordre-lenken til filene er klare.
  let files = order.files ?? []
  const refLink = (order._links ?? []).find(l => /order|self/.test(l.rel))?.href
    || (order.referenceNumber ? `${API}/order/${order.referenceNumber}` : null)
  for (let tries = 0; files.length === 0 && refLink && tries < 20; tries++) {
    await new Promise(r => setTimeout(r, 5000))
    const pr = await fetch(refLink, { headers: { Accept: 'application/json', 'User-Agent': 'lende-n50/1.0' } })
    const pj = await pr.json().catch(() => ({}))
    files = pj.files ?? []
    console.log(`poll ${tries}: status=${pr.status} files=${files.length}`)
  }
  console.log('FILES:', JSON.stringify(files.map(f => ({ name: f.name, url: f.downloadUrl })), null, 2).slice(0, 2000))
  if (files.length === 0) throw new Error('ingen nedlastingsfiler fra ordren')

  // 3. Last ned + pakk ut alle filene.
  const dl = join(work, 'dl'); mkdirSync(dl)
  for (const f of files) {
    const url = f.downloadUrl || f.url
    if (!url) continue
    const dest = join(dl, f.name || `part-${Math.random().toString(36).slice(2)}.zip`)
    console.log('download', url, '→', dest)
    sh('curl', ['-sSL', '-H', 'User-Agent:lende-n50/1.0', '-o', dest, url])
    if (/\.zip$/i.test(dest)) sh('unzip', ['-oq', dest, '-d', dl])
  }

  // 4. Finn .gdb-katalog (eller .gml) og list lag.
  const found = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (e.endsWith('.gdb') && statSync(p).isDirectory()) { found.push(p); continue }
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.gml$/i.test(e)) found.push(p)
    }
  }
  walk(dl)
  console.log('datasett funnet:', found)
  if (found.length === 0) throw new Error('fant ingen .gdb/.gml etter utpakking')
  const src = found[0]
  // 5. Finn areal-/vann-laget. FGDB-ogrinfo skriver «Layer: <navn> (<geom>)».
  const info = sh('ogrinfo', ['-so', src])
  console.log('=== ogrinfo lag ===')
  console.log(info.slice(0, 3000))
  const layers = [...info.matchAll(/^Layer:\s+(\S+)/gm)].map(m => m[1])
  console.log('lag:', layers)
  const arealLayer = layers.find(l => /arealdekke.*(omr|flate|område)/i.test(l))
    || layers.find(l => /arealdekke/i.test(l))
  if (!arealLayer) throw new Error(`fant ikke arealdekke-lag blant: ${layers.join(', ')}`)
  console.log('bruker arealdekke-lag:', arealLayer)

  // Logg distinkte objtype-verdier så vi ser eksakt staving (Innsjø/InnsjøRegulert…).
  console.log('=== distinkte objtype i arealdekke ===')
  try {
    console.log(sh('ogrinfo', ['-ro', '-q', '-dialect', 'OGRSQL',
      '-sql', `SELECT DISTINCT objtype FROM "${arealLayer}"`, src]).slice(0, 2000))
  } catch (e) { console.log('objtype-spørring feilet:', e.message) }

  // 6. ogr2ogr → FlatGeobuf, EPSG:4326, kun vann-objtyper.
  mkdirSync(dirname(OUT), { recursive: true })
  const where = `objtype IN (${WATER_OBJTYPES.map(o => `'${o}'`).join(',')})`
  sh('ogr2ogr', [
    '-f', 'FlatGeobuf',
    '-t_srs', 'EPSG:4326',
    '-nln', 'n50_water',
    '-nlt', 'MULTIPOLYGON',
    '-where', where,
    '-makevalid',
    OUT, src, arealLayer,
  ])
  const sz = statSync(OUT).size
  console.log(`SKREV ${OUT} — ${(sz / 1e6).toFixed(1)} MB`)

  // 7. Selvtest: har vann-polygonet ved Kolstadøya (59.802, 11.673) et hull?
  //    Spør FGB på en liten bbox rundt øya og logg ring-struktur.
  console.log('=== selvtest Kolstadøya ===')
  const probe = sh('ogrinfo', [
    '-ro', '-al', '-geom=SUMMARY',
    '-spat', '11.66', '59.79', '11.69', '59.82',
    OUT, 'n50_water',
  ]).slice(0, 2000)
  console.log(probe)
  console.log('DONE')
}

main().catch(e => { console.error('FEIL:', e.message); process.exit(1) })

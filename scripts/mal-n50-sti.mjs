#!/usr/bin/env node
// Rekognosering før N50-sti-løftet: HVOR STORT blir datasettet?
//
// Svaret avgjør arkitekturen. Under ~100 MB pakket kan stiene ligge som
// statiske fliser ved siden av appen på GitHub Pages — ingen ny infrastruktur,
// ingen hemmeligheter, ingen kostnad, og service worker-en cacher dem offline.
// Over det trengs egen lagring (Cloudflare R2 bak lende-proxy).
//
// Dette scriptet PUBLISERER INGENTING. Det laster ned, måler og rapporterer.
//
// ── Hvorfor det er skrevet så pratsomt ─────────────────────────────────────
// Sandkassa der scriptet ble skrevet når ikke nedlasting.geonorge.no (egress-
// policy), så API-formen måtte kartlegges via CI. Derfor logger hvert trinn
// hva det faktisk fant, og feiler med hele svaret i loggen.
//
// Bekreftet i CI 2026-08-09 (kjøring 31307348804):
//   · katalogsøk og capabilities virker som antatt
//   · områder er {type:'fylke', code:'33', name:'Buskerud'} osv.
//   · formater: FGDB, GML, PostGIS, SOSI — projeksjoner: 25832/25833/25835
//   · ORDREN ER ASYNKRON: POST gir referenceNumber + files: [], og filene
//     dukker opp på GET /api/order/{referanse} etter hvert som de pakkes.
//     Det var feilen i første utgave, som antok filer rett i POST-svaret.
// Fortsatt uverifisert: N50s objekttype-navn (STI_TYPER) — histogrammet under
// punkt 5 avslører dem så snart en nedlasting kommer helt gjennom.
//
// Kjør:  node scripts/mal-n50-sti.mjs [--fylke 33] [--behold]

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, existsSync, rmSync, statSync, readdirSync, createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { forenkleLinje, kodeFlis, delPaaFliser, lengdeM, flisNokkel } from '../src/lib/n50StiPakke.js'

const args = process.argv.slice(2)
const argVal = (navn) => { const i = args.indexOf(navn); return i >= 0 ? args[i + 1] : null }
const FYLKE = argVal('--fylke')          // null = hele landet
const BEHOLD = args.includes('--behold') // ikke rydd temp-katalogen

const KATALOG_SOK = 'https://kartkatalog.geonorge.no/api/search'
const NEDLASTING = 'https://nedlasting.geonorge.no/api'

// Objekttyper i N50 Samferdsel vi er ute etter. IKKE verifisert mot ekte data —
// scriptet logger hele objtype-histogrammet, så første kjøring forteller oss
// hva de faktisk heter, og lista rettes deretter.
const STI_TYPER = ['Sti', 'TraktorvegSti', 'Traktorveg', 'Barmarksløype', 'Barmarksloype', 'GangSykkelveg']
const TYPE_KART = {
  Sti: 'sti', TraktorvegSti: 'sti',
  Traktorveg: 'traktorveg',
  'Barmarksløype': 'barmarksloype', Barmarksloype: 'barmarksloype',
}

const log = (...a) => console.log(...a)
const seksjon = (t) => log(`\n${'─'.repeat(70)}\n${t}\n${'─'.repeat(70)}`)

async function hentJson(url, init) {
  const res = await fetch(url, init)
  const tekst = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}\nSvar (2000 første tegn):\n${tekst.slice(0, 2000)}`)
  }
  try { return JSON.parse(tekst) } catch {
    throw new Error(`Ikke JSON fra ${url}\nSvar (2000 første tegn):\n${tekst.slice(0, 2000)}`)
  }
}

function harOgr() {
  try { execFileSync('ogr2ogr', ['--version'], { stdio: 'pipe' }); return true } catch { return false }
}

// ── 1. Finn datasettet ─────────────────────────────────────────────────────

async function finnDatasett() {
  seksjon('1. Finner N50 Kartdata i Geonorge-katalogen')
  const url = `${KATALOG_SOK}?text=N50%20Kartdata&limit=20`
  const d = await hentJson(url)
  const treff = (d.Results ?? []).filter(r => /n50/i.test(r.Title ?? ''))
  log(`${(d.Results ?? []).length} treff, ${treff.length} med «N50» i tittelen:`)
  for (const r of treff) log(`  · ${r.Title} — uuid=${r.Uuid} type=${r.Type}`)
  const valgt = treff.find(r => /^n50 kartdata$/i.test(r.Title)) ?? treff[0]
  if (!valgt) throw new Error('Fant ingen N50-datasett. Hele svaret:\n' + JSON.stringify(d).slice(0, 3000))
  log(`\n→ Valgte: ${valgt.Title} (${valgt.Uuid})`)
  return valgt.Uuid
}

// ── 2. Hva kan lastes ned? ─────────────────────────────────────────────────

async function finnNedlasting(uuid) {
  seksjon('2. Henter nedlastingsalternativer')
  const cap = await hentJson(`${NEDLASTING}/capabilities/${uuid}`)
  log('capabilities (400 første tegn):', JSON.stringify(cap).slice(0, 400))

  const hent = async (rel) => {
    const lenke = (cap._links ?? []).find(l => l.rel?.endsWith(rel))
    if (!lenke) { log(`  (ingen «${rel}»-lenke)`); return [] }
    const d = await hentJson(lenke.href)
    return Array.isArray(d) ? d : []
  }
  const [omrader, formater, projeksjoner] = await Promise.all([
    hent('area'), hent('format'), hent('projection'),
  ])
  log(`\nOmråder: ${omrader.length}`)
  for (const o of omrader.slice(0, 8)) log(`  · ${o.type}/${o.code} — ${o.name}`)
  log(`Formater: ${formater.map(f => f.name).join(', ') || '(ingen)'}`)
  log(`Projeksjoner: ${projeksjoner.map(p => `${p.code} ${p.name}`).join(', ') || '(ingen)'}`)

  // Hele landet har typisk type=landsdekkende eller code 0000.
  const omrade = FYLKE
    ? omrader.find(o => o.code === FYLKE)
    : (omrader.find(o => /landsdekkende/i.test(o.type ?? '') || o.code === '0000') ?? omrader[0])
  if (!omrade) throw new Error(`Fant ikke ønsket område (--fylke ${FYLKE}). Tilgjengelige:\n` +
    omrader.map(o => `${o.type}/${o.code} ${o.name}`).join('\n'))

  // GML og GeoPackage er begge lesbare av ogr2ogr; FGDB krever nyere GDAL.
  const format = ['GML', 'GeoPackage', 'GEOPACKAGE', 'FGDB', 'SOSI']
    .map(n => formater.find(f => (f.name ?? '').toUpperCase() === n.toUpperCase()))
    .find(Boolean) ?? formater[0]
  const proj = projeksjoner.find(p => String(p.code) === '25833') ?? projeksjoner[0]
  if (!format || !proj) throw new Error('Mangler format eller projeksjon i capabilities')

  log(`\n→ Bestiller: ${omrade.name} (${omrade.type}/${omrade.code}) · ${format.name} · EPSG:${proj.code}`)
  return { omrade, format, proj }
}

async function bestill(uuid, { omrade, format, proj }) {
  seksjon('3. Legger inn ordre')
  const ordre = {
    email: 'lende-ci@example.invalid',
    softwareClient: 'lende',
    orderLines: [{
      metadataUuid: uuid,
      areas: [{ code: omrade.code, name: omrade.name, type: omrade.type }],
      formats: [{ name: format.name }],
      projections: [{ code: proj.code, name: proj.name, codespace: proj.codespace }],
    }],
  }
  const svar = await hentJson(`${NEDLASTING}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordre),
  })
  const filerNaa = svar.files ?? svar.Files ?? []
  const referanse = svar.referenceNumber ?? svar.ReferenceNumber
  log(`Ordre lagt inn. Referanse: ${referanse ?? '(ingen)'} · ${filerNaa.length} fil(er) med en gang.`)
  if (filerNaa.length) {
    for (const f of filerNaa) log(`  · ${f.name}`)
    return filerNaa
  }
  // Geonorge klargjør bestillingen ASYNKRONT: POST-svaret kommer med tom
  // files-liste og en self-lenke, og filene dukker opp der etter hvert som de
  // pakkes. (Målt i CI 2026-08-09: POST ga referenceNumber + files: [].)
  if (!referanse) {
    throw new Error('Ordren ga verken filer eller referansenummer. Hele svaret:\n' +
      JSON.stringify(svar).slice(0, 3000))
  }
  const selvLenke = (svar._links ?? []).find(l => l.rel === 'self')?.href
    ?? `${NEDLASTING}/order/${referanse}`
  return await ventPaaOrdre(selvLenke)
}

// Poll til filene er klargjort. Store bestillinger (landsdekkende N50) tar
// lengst tid, derfor et romslig tak — workflowen har 90 minutter totalt.
async function ventPaaOrdre(url, { maksMs = 45 * 60 * 1000, intervallMs = 10000 } = {}) {
  log(`\nVenter på klargjøring: ${url}`)
  const start = Date.now()
  let runde = 0
  let sisteSvar = null
  while (Date.now() - start < maksMs) {
    runde++
    let d
    try {
      d = await hentJson(url)
    } catch (e) {
      // Et forbigående 5xx midt i klargjøringen skal ikke drepe hele kjøringen.
      log(`  runde ${runde}: oppslag feilet (${e.message.split('\n')[0]}) — prøver igjen`)
      await new Promise(r => setTimeout(r, intervallMs))
      continue
    }
    sisteSvar = d
    const filer = d.files ?? d.Files ?? []
    if (runde === 1) log(`  (første svar: ${JSON.stringify(d).slice(0, 600)})`)
    if (filer.length) {
      // En fil er først nyttig når den har en nedlastingslenke.
      const klare = filer.filter(f => f.downloadUrl ?? f.DownloadUrl)
      log(`  runde ${runde} (${Math.round((Date.now() - start) / 1000)} s): ${filer.length} fil(er), ${klare.length} med lenke`)
      if (klare.length === filer.length) {
        for (const f of klare) log(`  · ${f.name} — ${f.downloadUrl ?? f.DownloadUrl}`)
        return klare
      }
    } else {
      log(`  runde ${runde} (${Math.round((Date.now() - start) / 1000)} s): ikke klar ennå`)
    }
    await new Promise(r => setTimeout(r, intervallMs))
  }
  throw new Error(`Ordren ble ikke klar innen ${Math.round(maksMs / 60000)} min.\n` +
    `Siste svar:\n${JSON.stringify(sisteSvar).slice(0, 3000)}`)
}

// ── 4. Last ned og pakk ut ─────────────────────────────────────────────────

async function lastNed(filer, dir) {
  seksjon('4. Laster ned')
  const stier = []
  for (const f of filer) {
    const url = f.downloadUrl ?? f.DownloadUrl
    const navn = f.name ?? url.split('/').pop()
    const sti = join(dir, navn)
    log(`  henter ${navn} …`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} ved nedlasting av ${url}`)
    writeFileSync(sti, Buffer.from(await res.arrayBuffer()))
    log(`    ${(statSync(sti).size / 1e6).toFixed(1)} MB`)
    stier.push(sti)
  }
  const utpakket = []
  for (const sti of stier) {
    if (!/\.zip$/i.test(sti)) { utpakket.push(sti); continue }
    const ut = sti.replace(/\.zip$/i, '')
    execFileSync('unzip', ['-q', '-o', sti, '-d', ut], { stdio: 'inherit' })
    utpakket.push(ut)
  }
  return utpakket
}

function finnKilder(baner) {
  const ut = []
  const gaa = (p) => {
    if (!existsSync(p)) return
    const st = statSync(p)
    if (st.isDirectory()) {
      if (/\.gdb$/i.test(p)) { ut.push(p); return }
      for (const n of readdirSync(p)) gaa(join(p, n))
    } else if (/\.(gml|gpkg|sos)$/i.test(p)) ut.push(p)
  }
  for (const b of baner) gaa(b)
  return ut
}

// ── 5. Les geometri via ogr2ogr ────────────────────────────────────────────

function lagListe(kilde) {
  const ut = execFileSync('ogrinfo', ['-so', '-al', kilde], { encoding: 'utf8', maxBuffer: 1 << 28 })
  return ut.split('\n').filter(l => /^Layer name:/.test(l)).map(l => l.replace('Layer name:', '').trim())
}

async function lesLinjer(kilde, lag, dir) {
  // GeoJSONSeq (én JSON-linje per feature) SKRIVES TIL FIL og leses strømmende.
  // Ikke via stdout: landsdekkende N50 Samferdsel blir flere hundre MB tekst,
  // og en execFileSync-buffer må da holde alt som ÉN streng — over V8s
  // strengegrense, og uansett unødvendig minnebruk.
  const utfil = join(dir, `lag-${lag.replace(/[^\w]/g, '_')}.geojsonl`)
  execFileSync('ogr2ogr', [
    '-f', 'GeoJSONSeq', utfil, kilde, lag,
    '-t_srs', 'EPSG:4326', '-nlt', 'MULTILINESTRING',
  ], { stdio: 'pipe' })
  const linjer = []
  const histogram = new Map()
  const rl = createInterface({ input: createReadStream(utfil), crlfDelay: Infinity })
  for await (const rad of rl) {
    if (!rad.trim()) continue
    let f
    try { f = JSON.parse(rad) } catch { continue }
    const p = f.properties ?? {}
    const objtype = p.objtype ?? p.OBJTYPE ?? p.objektType ?? '(uten objtype)'
    histogram.set(objtype, (histogram.get(objtype) ?? 0) + 1)
    if (!STI_TYPER.includes(objtype)) continue
    const g = f.geometry
    if (!g) continue
    const deler = g.type === 'MultiLineString' ? g.coordinates
      : g.type === 'LineString' ? [g.coordinates] : []
    for (const d of deler) {
      if (d.length < 2) continue
      linjer.push({ type: TYPE_KART[objtype] ?? 'annet', geometry: d.map(([lon, lat]) => ({ lat, lon })) })
    }
  }
  rmSync(utfil, { force: true })
  return { linjer, histogram }
}

// ── 6. Mål ─────────────────────────────────────────────────────────────────

function mal(linjer) {
  seksjon('6. Måler')
  const punkterRaa = linjer.reduce((a, l) => a + l.geometry.length, 0)
  const km = linjer.reduce((a, l) => a + lengdeM(l.geometry), 0) / 1000
  log(`Linjer: ${linjer.length.toLocaleString('no')}`)
  log(`Punkter: ${punkterRaa.toLocaleString('no')}`)
  log(`Total lengde: ${km.toFixed(0).toLocaleString('no')} km`)
  log(`Punkttetthet: ${(punkterRaa / km).toFixed(1)} punkter/km (${(km * 1000 / punkterRaa).toFixed(0)} m mellom hvert punkt)`)

  const rader = []
  for (const tol of [0, 2, 3, 5, 8]) {
    const forenklet = tol === 0 ? linjer
      : linjer.map(l => ({ ...l, geometry: forenkleLinje(l.geometry, tol) }))
    const punkter = forenklet.reduce((a, l) => a + l.geometry.length, 0)

    const fliser = new Map()
    for (const l of forenklet) {
      for (const d of delPaaFliser(l)) {
        let f = fliser.get(d.nokkel)
        if (!f) fliser.set(d.nokkel, (f = []))
        f.push(d)
      }
    }
    let raa = 0, gz = 0, storst = 0
    for (const [, innhold] of fliser) {
      const pakket = kodeFlis(innhold)
      const g = gzipSync(Buffer.from(pakket), { level: 9 }).length
      raa += pakket.length; gz += g
      if (g > storst) storst = g
    }
    rader.push({ tol, punkter, fliser: fliser.size, raa, gz, storst })
  }

  log('\nPakket størrelse ved ulike forenklingsnivåer:')
  log('  tol   punkter      fliser   pakket     gzip     største flis')
  for (const r of rader) {
    log(`  ${String(r.tol).padStart(2)} m  ${String(r.punkter).padStart(10)}  ${String(r.fliser).padStart(6)}  ` +
        `${(r.raa / 1e6).toFixed(1).padStart(7)} MB  ${(r.gz / 1e6).toFixed(1).padStart(6)} MB  ` +
        `${(r.storst / 1024).toFixed(0).padStart(7)} KB`)
  }
  return { km, rader }
}

function konkluder({ km, rader }, helLandet) {
  seksjon('KONKLUSJON')
  const valgt = rader.find(r => r.tol === 3) ?? rader.at(-1)
  const mb = valgt.gz / 1e6
  const skalert = helLandet ? mb : null
  log(`Ved 3 m forenkling: ${mb.toFixed(1)} MB gzip fordelt på ${valgt.fliser} fliser.`)
  log(`Største enkeltflis: ${(valgt.storst / 1024).toFixed(0)} KB — dette er det appen laster per rute.`)
  if (!helLandet) {
    log(`\nMERK: dette er ETT fylke, ikke hele landet. Gang opp med ~15-20 for et grovt landsanslag,`)
    log(`eller kjør uten --fylke for det ekte tallet.`)
  }
  const tall = skalert ?? mb
  log('')
  if (helLandet && tall < 100) {
    log(`ANBEFALING: ${tall.toFixed(0)} MB er godt under 100 MB-grensa.`)
    log(`→ Statiske fliser på GitHub Pages. Ingen R2, ingen worker, ingen hemmeligheter.`)
  } else if (helLandet) {
    log(`ANBEFALING: ${tall.toFixed(0)} MB er over det som er behagelig i git/Pages.`)
    log(`→ Cloudflare R2 bak lende-proxy, eller kraftigere forenkling (se 5/8 m-radene).`)
  }
}

// ── Kjør ───────────────────────────────────────────────────────────────────

const dir = mkdtempSync(join(tmpdir(), 'n50sti-'))
try {
  if (!harOgr()) {
    console.error('FEIL: ogr2ogr/ogrinfo mangler. Installer gdal-bin (workflowen gjør det).')
    process.exit(1)
  }
  const uuid = await finnDatasett()
  const valg = await finnNedlasting(uuid)
  const filer = await bestill(uuid, valg)
  const baner = await lastNed(filer, dir)

  seksjon('5. Leser geometri')
  const kilder = finnKilder(baner)
  log(`Kilder funnet: ${kilder.length}`)
  for (const k of kilder) log(`  · ${k}`)
  if (!kilder.length) throw new Error('Fant ingen lesbare kilder (.gml/.gpkg/.gdb) i nedlastingen')

  const alle = []
  const histTotal = new Map()
  for (const kilde of kilder) {
    const lag = lagListe(kilde).filter(n => /samferdsel|veg|sti/i.test(n))
    log(`\n${kilde}\n  aktuelle lag: ${lag.join(', ') || '(ingen som matcher samferdsel/veg/sti)'}`)
    for (const l of lag) {
      const { linjer, histogram } = await lesLinjer(kilde, l, dir)
      for (const [k, v] of histogram) histTotal.set(k, (histTotal.get(k) ?? 0) + v)
      log(`    ${l}: ${linjer.length} sti-linjer av ${[...histogram.values()].reduce((a, b) => a + b, 0)} features`)
      alle.push(...linjer)
    }
  }

  log('\nobjtype-histogram (HELE datasettet — bruk dette til å rette STI_TYPER):')
  for (const [k, v] of [...histTotal].sort((a, b) => b[1] - a[1])) {
    log(`  ${STI_TYPER.includes(k) ? '✓' : ' '} ${k.padEnd(28)} ${v.toLocaleString('no')}`)
  }

  if (!alle.length) {
    console.error('\nFEIL: ingen linjer matchet STI_TYPER. Se histogrammet over og rett lista i scriptet.')
    process.exit(1)
  }
  konkluder(mal(alle), !FYLKE)
} catch (e) {
  console.error(`\nFEILET: ${e.message}`)
  console.error('\nLoggen over viser hvor langt det kom. Katalogsøk, capabilities og den')
  console.error('asynkrone ordre-flyten er bekreftet i CI; objekttype-navnene i N50 er ikke.')
  console.error('Ser du et objtype-histogram over, er det fasit — rett STI_TYPER etter det.')
  process.exit(1)
} finally {
  if (BEHOLD) log(`\n(beholder ${dir})`)
  else rmSync(dir, { recursive: true, force: true })
}

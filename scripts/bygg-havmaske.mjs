#!/usr/bin/env node
// Baker havmasken (src/lib/havmaske.js): N50 Arealdekke «Havflate» → én bit
// per ~1 km-celle over fastlands-Norge → public/data/n50-hav/.
//
// Egen katalog av samme grunn som n50-vann og n50-veg: manifestet er klientens
// cache-nøkkel, og en maske i n50-areal/ ville gitt hver areal-flis ny nøkkel.
//
// Rasteriseringen gjøres av gdal_rasterize med «all touched» (-at): en celle
// der sjøen så vidt når inn skal svare ja. Kyst-gaten krever i tillegg
// havflate-piksler i DEM-et, så en raus maske kan ikke alene gjøre et
// innlandskart til et kystkart.
//
// Kjør:  node scripts/bygg-havmaske.mjs [--fylke 33] [--mal]
// CI:    bygg-n50-areal.yml med typer = hav

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { pakkMaske, MASKE_VERSJON } from '../src/lib/havmaske.js'
import { finnOmrader, velgFormat, lastNed, finnGdb, lagNavn, krevGdal } from './geonorgeN50.mjs'

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const FYLKE = argVal('--fylke')
const BARE_MAL = args.includes('--mal')

// Fastlandet med margin: Lindesnes 57,98° N, Knivskjellodden 71,19° N,
// Utsira 4,9° Ø, Grense Jakobselv 31,1° Ø. 0,02° × 0,01° er ~1,1 × 1,1 km på
// 60° N og 0,7 × 1,1 km i Finnmark.
export const RUTENETT = Object.freeze({ vest: 4, sor: 57.5, dLon: 0.02, dLat: 0.01, kolonner: 1400, rader: 1400 })

const UT_KATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'n50-hav')
const FIL = 'havmaske.bin'
const log = (...a) => console.log(...a)

if (import.meta.url === (process.argv[1] ? `file://${process.argv[1]}` : '')) {
  const dir = mkdtempSync(join(tmpdir(), 'havmaske-'))
  const gpkg = join(dir, 'hav.gpkg')
  try {
    krevGdal()
    const { omrader, formater, projeksjoner } = await finnOmrader()
    const fylker = FYLKE ? omrader.filter(o => o.code === FYLKE) : omrader.filter(o => o.type === 'fylke')
    if (!fylker.length) throw new Error(`Fant ingen områder (--fylke ${FYLKE})`)
    log(`${BARE_MAL ? 'MÅLER' : 'Bygger'} havmaske for ${fylker.length} fylke(r)\n`)

    let feilet = 0
    for (const [i, omrade] of fylker.entries()) {
      const kort = String(omrade.name).split(/\s+[–—-]\s+/)[0]
      log(`[${i + 1}/${fylker.length}] ${kort}`)
      const fdir = mkdtempSync(join(dir, 'f-'))
      try {
        const { format, proj } = velgFormat(omrade, formater, projeksjoner)
        const kilder = finnGdb(await lastNed(omrade, format, proj, fdir, log))
        if (!kilder.length) throw new Error('ingen lesbar kilde i nedlastingen')
        for (const kilde of kilder) {
          const lagListe = lagNavn(kilde, /arealdekke.*(omrade|område|flate|polygon)/i)
          if (!lagListe.length) log(`    ⚠ ingen arealdekke-lag. Lag i kilden: ${lagNavn(kilde, /./).join(', ')}`)
          for (const lag of lagListe) {
            const verdier = objtypeVerdier(kilde, lag)
            log(`    ${lag}: ${verdier.join(', ')}`)
            // Verdien slås opp i stedet for å gjettes: et attributtfilter med feil
            // store/små bokstaver gir null rader i stillhet.
            const navn = verdier.filter(k => k.toLowerCase() === 'havflate')
            if (!navn.length) continue
            execFileSync('ogr2ogr', ['-f', 'GPKG', gpkg, kilde, lag,
              '-where', `objtype IN (${navn.map(n => `'${n}'`).join(',')})`, '-t_srs', 'EPSG:4326',
              '-nlt', 'MULTIPOLYGON', '-nln', 'hav', ...(existsSync(gpkg) ? ['-append'] : [])],
            { stdio: 'pipe' })
          }
        }
        log(`    havflater så langt: ${antallFlater(gpkg)}`)
      } catch (e) {
        feilet++
        log(`    ⚠ ${kort} feilet: ${e.message}`)
      } finally {
        rmSync(fdir, { recursive: true, force: true })
      }
    }

    const flater = antallFlater(gpkg)
    if (!flater) {
      log('\n✗ Null havflater — sjekk lag- og objtype-navnene i N50 Arealdekke.')
      process.exit(1)
    }

    const { vest, sor, dLon, dLat, kolonner, rader } = RUTENETT
    const img = join(dir, 'maske.img')
    execFileSync('gdal_rasterize', ['-at', '-burn', '1', '-l', 'hav', '-init', '0', '-ot', 'Byte',
      '-of', 'ENVI', '-te', String(vest), String(sor), String(vest + kolonner * dLon), String(sor + rader * dLat),
      '-ts', String(kolonner), String(rader), gpkg, img], { stdio: 'pipe' })
    const celler = readFileSync(img)
    if (celler.length !== kolonner * rader) throw new Error(`rasteret har ${celler.length} byte, venter ${kolonner * rader}`)
    let sjo = 0
    for (const c of celler) if (c) sjo++
    const biter = pakkMaske(celler, kolonner, rader)

    log(`\n── Havmaske ──────────────────────────`)
    log(`  ${flater.toLocaleString('no')} havflater, ${sjo.toLocaleString('no')} av ${(kolonner * rader).toLocaleString('no')} celler er sjø`)
    log(`  ${(biter.length / 1e3).toFixed(0)} KB (${(gzipSync(biter).length / 1e3).toFixed(0)} KB gzip)`)
    if (feilet) log(`  ⚠ ${feilet} fylke(r) feilet`)

    if (BARE_MAL) {
      log('\n  --mal: ingenting er skrevet.')
    } else {
      mkdirSync(UT_KATALOG, { recursive: true })
      for (const f of readdirSync(UT_KATALOG)) rmSync(join(UT_KATALOG, f), { force: true })
      writeFileSync(join(UT_KATALOG, FIL), biter)
      writeFileSync(join(UT_KATALOG, 'manifest.json'), JSON.stringify({
        versjon: MASKE_VERSJON, ...RUTENETT, fil: FIL, sjoCeller: sjo,
      }))
      log(`\n  Skrev ${FIL} + manifest.json til public/data/n50-hav/`)
    }
    // En maske bakt med fylker som mangler er en maske som sier «innland» om
    // kysten deres. Bedre å feile enn å committe den.
    if (feilet && !FYLKE) process.exit(1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function objtypeVerdier(kilde, lag) {
  // OGR SQL kan DISTINCT, men ikke GROUP BY.
  const ut = execFileSync('ogrinfo', ['-q', kilde, '-sql', `SELECT DISTINCT objtype FROM "${lag}"`],
    { encoding: 'utf8', maxBuffer: 1 << 26 })
  return ut.split('\n').map(l => l.match(/^\s*objtype \(String\) = (.*)$/)?.[1]?.trim()).filter(Boolean)
}

function antallFlater(gpkg) {
  if (!existsSync(gpkg)) return 0
  const ut = execFileSync('ogrinfo', ['-so', gpkg, 'hav'], { encoding: 'utf8' })
  return Number(ut.match(/Feature Count:\s*(\d+)/)?.[1] ?? 0)
}

#!/usr/bin/env node
// Fasit for OSM-flisene: samme bbox fra flisene og fra Overpass, element for
// element. Flisene skal gi det Overpass gir — ikke mer (utenfor bboksen) og
// ikke mindre (en selektor eller en relasjon som falt bort i baken).
//
// Kjør:  node scripts/sammenlign-osm-fliser.mjs --fliser osm-fliser
//          [--sted lat,lon,halfKm]...
//
// Overpass er levende og Geofabrik-uttrekket er fra i natt, så noen få avvik er
// redigeringer i mellomtida. Terskelen er derfor en andel, ikke null.

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fetchOverpass, bboxFromCenter } from '../src/lib/mapBuilder.js'
import { flisNoklerForBbox, slaSammenFliser, delteIder, deltFilnavn } from '../src/lib/osmFlis.js'

const args = process.argv.slice(2)
const DIR = args[args.indexOf('--fliser') + 1] ?? 'osm-fliser'
const steder = args.flatMap((a, i) => a === '--sted' ? [args[i + 1]] : [])
  .map(s => s.split(',').map(Number))
if (!steder.length) steder.push([59.8416, 10.4107, 2])   // Vardåsen
const TERSKEL = 0.02

const id = (el) => `${el.type}/${el.id}`
const punkter = (el) => el.type === 'way'
  ? (el.geometry ?? []).filter(Boolean).length
  : el.type === 'relation' ? (el.members ?? []).reduce((s, m) => s + (m.geometry?.length ?? 0), 0) : 1

let feil = 0
for (const [lat, lon, halfKm] of steder) {
  const bbox = bboxFromCenter(lat, lon, halfKm)
  const fliser = flisNoklerForBbox(bbox).map((k) => {
    const f = join(DIR, `${k}.json.gz`)
    return existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f))) : null
  })
  const delte = new Map(delteIder(fliser).map((d) => {
    const f = join(DIR, deltFilnavn(d))
    return [d, existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f))) : null]
  }))
  const fra = slaSammenFliser(fliser, bbox, delte).elements
  const lastes = fliser.filter(Boolean).length
  const filer = [...flisNoklerForBbox(bbox).map(k => join(DIR, `${k}.json.gz`)), ...[...delte.keys()].map(d => join(DIR, deltFilnavn(d)))]
  const kb = filer.filter(existsSync).reduce((s, f) => s + statSync(f).size, 0) / 1e3
  let fasit
  try {
    fasit = (await fetchOverpass(bbox)).elements ?? []
  } catch (e) {
    // Overpass nede er ikke en feil i baken, og skal ikke stoppe opplastingen.
    console.log(`⚠ ${lat},${lon}: Overpass svarte ikke (${e?.message ?? e}) — ikke sammenlignet`)
    continue
  }
  const fraId = new Map(fra.map(el => [id(el), el]))
  const fasitId = new Map(fasit.map(el => [id(el), el]))
  const mangler = [...fasitId.keys()].filter(k => !fraId.has(k))
  const ekstra = [...fraId.keys()].filter(k => !fasitId.has(k))
  let ulikGeom = 0
  for (const [k, el] of fasitId) {
    const f = fraId.get(k)
    if (f && punkter(f) !== punkter(el)) ulikGeom++
  }
  const andel = mangler.length / Math.max(1, fasit.length)
  const ok = andel <= TERSKEL
  if (!ok) feil++
  console.log(`${ok ? '✓' : '✗'} ${lat},${lon} ±${halfKm} km: Overpass ${fasit.length}, fliser ${fra.length} — ` +
    `${mangler.length} mangler (${(andel * 100).toFixed(1)} %), ${ekstra.length} ekstra, ${ulikGeom} med ulik geometri; ` +
    `${lastes} fliser + ${delte.size} delte lest, ${kb.toFixed(0)} KB gzip`)
  const vis = (liste, kart) => liste.slice(0, 8)
    .map(k => `${k} ${JSON.stringify(kart.get(k).tags ?? {}).slice(0, 80)}`).join('\n      ')
  if (mangler.length) console.log(`    mangler:\n      ${vis(mangler, fasitId)}`)
  if (ekstra.length) console.log(`    ekstra:\n      ${vis(ekstra, fraId)}`)
}
process.exit(feil ? 1 : 0)

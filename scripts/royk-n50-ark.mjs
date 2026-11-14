#!/usr/bin/env node
// Røyktest for N50-arket: et nytt kart skal bli et turkart også når Overpass
// ikke svarer (docs/PLAN_OSM_UAVHENGIG.md, fase 1).
//
// Overpass blokkeres i nettleseren (alle speil går til /api/interpreter), og
// kartet bygges med appens egen buildMapFromCenter i dev-serveren. Sjekkene:
//   1. finalize resolver med N50-arket (utenOsm, partial) — ikke en feil.
//   2. arket har stier og veger fra N50-flisene, ikke bare terreng.
//   3. OSM-arket ligger i registeret som NESTE finalize, og det feiler.
//   4. etter omlasting sier banneret at kartet mangler OSM-detaljene, ikke at
//      det «viser bare terreng».
//   5. et kystkart (Drøbak) blir KYST med Overpass blokkert — saltvanns-svaret
//      kommer fra havmasken (lib/havmaske.js), ikke fra kystlinje-proben.
//   6. kant-utvidelsen (n50Ark uten terreng-først) leverer N50-arket som flisa,
//      lagret som partial, og OSM-arket feiler i bakgrunnen.
//
// Krever nett (Kartverket WCS, NVE) — kjøres i CI, ikke fra sandkassa.

import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 5189
const BASE = `http://localhost:${PORT}/lende`
// Vardåsen i Asker: innlands, N50-stifliser, kjent fra fasiten.
const SENTER = { lat: 59.8416, lon: 10.4107, name: 'N50-ark-røyk' }
// Drøbak: Oslofjorden midt i arket, så både DEM-havflate og saltvann skal si ja.
const KYST = { lat: 59.6633, lon: 10.6303, name: 'N50-ark-kyst-røyk' }

const sov = (ms) => new Promise((ok) => setTimeout(ok, ms))
const resultat = []
function sjekk(navn, ok, detalj) {
  resultat.push({ navn, ok })
  console.log(`${ok ? '✓' : '✗'} ${navn}${detalj ? ` — ${detalj}` : ''}`)
}

const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
for (let i = 0; i < 120; i++) {
  try { const r = await fetch(`${BASE}/`); if (r.ok) break } catch { /* ikke oppe ennå */ }
  await sov(500)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ serviceWorkers: 'block' })
let blokkert = 0
await ctx.route(/api\/interpreter/, (route) => { blokkert++; return route.abort('connectionrefused') })
// OSM-flisene (v8.0.0) er den andre veien til OSM. Uten denne ville testen målt
// flisene og ikke N50-arket — og blitt rød den dagen baken første gang er oppe.
await ctx.route(/\/osm\/(manifest\.json|.*\.json\.gz)/, (route) => route.abort('connectionrefused'))
const page = await ctx.newPage()
const feil = []
page.on('pageerror', (e) => feil.push(e.message))

try {
  await page.goto(`${BASE}/`)
  const t0 = Date.now()
  const svar = await page.evaluate(async (senter) => {
    const flow = await import('/lende/src/lib/createMapFlow.js')
    const { id, finalize } = await flow.buildMapFromCenter({
      center: senter, halfKm: 1, equidistanceM: 5, navn: senter.name, terrainFirst: true,
    })
    if (!finalize) return { id, ingenFinalize: true }
    const ark = await finalize
    const neste = flow.consumeMapFinalize(id)
    let nesteFeil = null
    if (neste) { try { await neste } catch (e) { nesteFeil = String(e?.message ?? e) } }
    return {
      id,
      utenOsm: ark.utenOsm, partial: ark.partial, source: ark.source,
      stilag: /data-layer="sti"/.test(ark.svg),
      n50sti: /N50-sti \(\d+ strekk\)/.test(ark.source),
      n50veg: /N50-veg \(\d+ strekk\)/.test(ark.source),
      vegLag: /data-layer="vei-(liten|stor)"/.test(ark.svg),
      harNeste: !!neste, nesteFeil,
    }
  }, SENTER)
  const sek = ((Date.now() - t0) / 1000).toFixed(0)

  sjekk('finalize gir N50-arket', svar.utenOsm === true && svar.partial === true,
    `utenOsm=${svar.utenOsm} partial=${svar.partial} etter ${sek} s`)
  sjekk('kilden sier at OSM venter', String(svar.source).startsWith('N50 (OSM venter)'), svar.source)
  sjekk('arket har N50-stier', svar.n50sti && svar.stilag, svar.source)
  sjekk('arket har N50-veger', svar.n50veg && svar.vegLag, svar.source)
  sjekk('OSM-arket er neste finalize, og det feiler', svar.harNeste && !!svar.nesteFeil, svar.nesteFeil)
  sjekk('Overpass ble faktisk blokkert', blokkert > 0, `${blokkert} forespørsler`)

  const kyst = await page.evaluate(async (senter) => {
    const flow = await import('/lende/src/lib/createMapFlow.js')
    const { finalize } = await flow.buildMapFromCenter({
      center: senter, halfKm: 1, equidistanceM: 5, navn: senter.name, terrainFirst: true,
    })
    const ark = await finalize
    const svg = new DOMParser().parseFromString(ark.svg, 'image/svg+xml').documentElement
    const meta = JSON.parse(svg.getAttribute('data-meta') ?? '{}')
    return { utenOsm: ark.utenOsm, coastal: meta.coastal, kystStatus: meta.kystStatus ?? null }
  }, KYST)
  const ks = kyst.kystStatus
  sjekk('kystkartet blir KYST uten Overpass', kyst.utenOsm === true && kyst.coastal === true,
    `utenOsm=${kyst.utenOsm} coastal=${kyst.coastal} ${JSON.stringify(ks)}`)
  sjekk('saltvanns-svaret kom fra havmasken', ks?.saltvannKilde === 'havmaske', ks?.saltvannKilde)

  const kant = await page.evaluate(async (senter) => {
    const flow = await import('/lende/src/lib/createMapFlow.js')
    const lager = await import('/lende/src/lib/mapStorage.js')
    const { id, entry, osmArk } = await flow.buildMapFromCenter({
      center: senter, halfKm: 1, equidistanceM: 5, navn: senter.name, isAuto: true, n50Ark: true,
    })
    const lagret = await lager.loadMap(id)
    const osmFeil = osmArk ? await osmArk.then(() => null, e => String(e?.message ?? e)) : null
    await lager.deleteMap(id)
    return {
      utenOsm: entry?.utenOsm, partial: lagret?.partial, harOsmArk: !!osmArk, osmFeil,
    }
  }, { ...SENTER, lat: SENTER.lat + 0.02, name: 'N50-ark-kant-røyk' })
  sjekk('kant-utvidelsen lagrer N50-arket som flisa',
    kant.utenOsm === true && kant.partial === true, JSON.stringify(kant))
  sjekk('kant-utvidelsens OSM-ark går i bakgrunnen, og det feiler', kant.harOsmArk && !!kant.osmFeil,
    kant.osmFeil)

  await page.goto(`${BASE}/kart/${svar.id}`)
  const banner = page.getByText('mangler detaljene fra OpenStreetMap')
  const synlig = await banner.waitFor({ timeout: 30000 }).then(() => true, () => false)
  sjekk('banneret sier hva kartet viser', synlig)
  sjekk('ingen JS-feil', feil.length === 0, feil.join(' | '))
} catch (e) {
  sjekk('kjøringen', false, e?.message ?? String(e))
} finally {
  await browser.close()
  dev.kill()
}

const rode = resultat.filter((r) => !r.ok)
console.log(`\n${resultat.length - rode.length}/${resultat.length} grønne`)
process.exit(rode.length ? 1 : 0)

// E2E-DIAGNOSE v3 (CI, kun logg): v2 viste FULLT kart i DOM (alle OSM-lag) men
// TOM vann-gruppe, og data-meta borte fra DOM-svg. Nå: les det LAGREDE arket
// rett fra IndexedDB (lende-maps/maps) — har SVG-STRENGEN vann-pather,
// data-meta og counts['301']? Skiller bygge-feil (vann mangler i lagret SVG)
// fra visnings-feil (vann finnes lagret men strippes i DOM).

import { chromium } from 'playwright'

const URL = 'https://gitjanerik.github.io/lende/nytt?lat=59.802&lon=11.673&km=4&hl=E2E-Setten'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } })
const page = await ctx.newPage()
page.on('console', m => {
  const t = m.text()
  if (/N50|NVE|perf|Terreng|feil|error/i.test(t)) console.log('[console]', t.slice(0, 220))
})
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
await page.click('button.bg-emerald-600', { timeout: 20000 })
await page.waitForURL(/\/kart\//, { timeout: 180000 })
const mapId = page.url().match(/\/kart\/([^?#]+)/)?.[1]
console.log('kart-id:', mapId)

// Vent på at full bygging + lagring er ferdig (perf-linja ~5 s; gi 30 s).
await page.waitForTimeout(30000)

const stored = await page.evaluate(async (id) => {
  const db = await new Promise((res, rej) => {
    const rq = indexedDB.open('lende-maps')
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
  })
  const entry = await new Promise((res, rej) => {
    const tx = db.transaction('maps', 'readonly')
    const rq = tx.objectStore('maps').get(id)
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
  })
  if (!entry) return { finnes: false }
  const svg = entry.svg ?? ''
  const vannMatch = svg.match(/<g data-layer="vann"[^>]*>([\s\S]*?)<\/g>/)
  const vannInnhold = vannMatch ? vannMatch[1] : null
  const metaMatch = svg.match(/data-meta='([^']*)'/)
  let meta = null
  try { meta = metaMatch ? JSON.parse(metaMatch[1].replace(/&apos;/g, "'")) : null } catch { meta = { PARSE_ERROR: true } }
  return {
    finnes: true,
    partial: entry.partial,
    entryAppVersion: entry.appVersion ?? null,
    counts301: entry.counts?.['301'] ?? null,
    counts304: entry.counts?.['304'] ?? null,
    svgLengde: svg.length,
    harDataMetaILagretSvg: !!metaMatch,
    metaAppVersion: meta?.appVersion ?? null,
    metaNveStatus: meta?.nveInnsjoStatus ?? null,
    vannGruppeFinnes: !!vannMatch,
    vannPatherILagretSvg: vannInnhold ? (vannInnhold.match(/<path/g) ?? []).length : 0,
    kilde: entry.source ?? null,
  }
}, mapId)
console.log('=== LAGRET ENTRY (IndexedDB) ===')
console.log(JSON.stringify(stored, null, 1))

const dom = await page.evaluate(() => {
  const vann = document.querySelector('g[data-layer="vann"]')
  return { vannPatherIDom: vann ? vann.querySelectorAll('path').length : -1 }
})
console.log('DOM:', JSON.stringify(dom))
console.log('KONKLUSJON:', stored.vannPatherILagretSvg > 0
  ? (dom.vannPatherIDom > 0 ? 'ALT OK?!' : 'VISNINGS-FEIL — vann i lagret SVG, strippes i DOM')
  : 'BYGGE-FEIL — vann mangler allerede i lagret SVG (counts301=' + stored.counts301 + ')')
await browser.close()

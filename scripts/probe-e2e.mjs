// E2E-DIAGNOSE v4 (CI): v3 avslørte at «tom vann-gruppe» var en måle-artefakt
// (fire data-layer="vann"-grupper; querySelector/regex traff den første, tomme
// 307-gruppa). Nå: mål 301-GRUPPA spesifikt i DOM og lagret SVG, og ta
// skjermbilde (e2e-setten.png — riktig navn for artefakt-opplasting).

import { chromium } from 'playwright'

const URL = 'https://gitjanerik.github.io/lende/nytt?lat=59.802&lon=11.673&km=4&hl=E2E-Setten'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } })
const page = await ctx.newPage()
page.on('console', m => {
  const t = m.text()
  if (/N50|NVE|perf|feil|error/i.test(t)) console.log('[console]', t.slice(0, 200))
})
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
await page.click('button.bg-emerald-600', { timeout: 20000 })
await page.waitForURL(/\/kart\//, { timeout: 180000 })
const mapId = page.url().match(/\/kart\/([^?#]+)/)?.[1]
await page.waitForTimeout(25000)

const fasit = await page.evaluate(async (id) => {
  const db = await new Promise((res, rej) => {
    const rq = indexedDB.open('lende-maps')
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
  })
  const entry = await new Promise((res, rej) => {
    const tx = db.transaction('maps', 'readonly')
    const rq = tx.objectStore('maps').get(id)
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
  })
  const svg = entry?.svg ?? ''
  const g301 = svg.match(/<g data-layer="vann" data-iso="301">([\s\S]*?)<\/g>/)
  const domG301 = document.querySelector('g[data-layer="vann"][data-iso="301"]')
  const domPaths = domG301 ? domG301.querySelectorAll('path').length : -1
  const domVisible = domG301 ? getComputedStyle(domG301).display !== 'none' : null
  const firstD = domG301?.querySelector('path')?.getAttribute('d') ?? ''
  return {
    counts301: entry?.counts?.['301'] ?? null,
    lagret301Pather: g301 ? (g301[1].match(/<path/g) ?? []).length : -1,
    dom301Pather: domPaths,
    dom301Synlig: domVisible,
    dom301FørstePathLen: firstD.length,
    fillIComputedStyle: domG301?.querySelector('path')
      ? getComputedStyle(domG301.querySelector('path')).fill : null,
  }
}, mapId)
console.log('=== FASIT (301-gruppa spesifikt) ===')
console.log(JSON.stringify(fasit, null, 1))

await page.screenshot({ path: 'e2e-setten.png' })
const ok = fasit.lagret301Pather > 0 && fasit.dom301Pather > 0 && fasit.dom301Synlig
console.log('KONKLUSJON:', ok
  ? 'FRISK ✅ — innsjøene ER i både lagret SVG og DOM, synlige med fill'
  : 'PROBLEM ❌ — se felt over for hvor det svikter')
await browser.close()

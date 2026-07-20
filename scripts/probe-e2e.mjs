// E2E-DIAGNOSE (CI, kun logg + skjermbilde-artefakt): kjør HELE bruker-flyten
// i ekte Chromium mot den deployede appen — åpne kart-velgeren med Setten-
// koordinater (del-lenke-format), trykk «Bygg», vent på ferdig kart, og les
// fasiten rett fra DOM-en: kartets appVersion-stempel, nveInnsjoStatus og om
// vann-laget faktisk har geometri. Fjerner brukeren fra feilsøkings-løkka:
// enten er alt bevist friskt ende-til-ende i nettleser, eller så er feilen
// endelig reproduserbar her.

import { chromium } from 'playwright'

const URL = 'https://gitjanerik.github.io/lende/nytt?lat=59.802&lon=11.673&km=4&hl=E2E-Setten'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } })
const page = await ctx.newPage()
page.on('console', m => {
  const t = m.text()
  if (/N50|NVE|feil|error|vann/i.test(t)) console.log('[console]', t.slice(0, 220))
})
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 220)))

console.log('goto', URL)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)

console.log('klikker Bygg …')
await page.click('button.bg-emerald-600', { timeout: 20000 })
await page.waitForURL(/\/kart\//, { timeout: 180000 })
console.log('på kart-visning:', page.url())

// Terreng-først: vent til den FULLE byggingen (med nveInnsjoStatus i meta) har
// erstattet terreng-arket.
let meta = null
for (let i = 0; i < 90; i++) {
  meta = await page.evaluate(() => {
    const svg = document.querySelector('svg.isom-map')
    const raw = svg?.getAttribute('data-meta')
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  })
  if (meta?.nveInnsjoStatus) break
  await page.waitForTimeout(2000)
}

console.log('=== FASIT fra DOM ===')
console.log('kartets appVersion-stempel:', meta?.appVersion ?? '(mangler!)')
console.log('nveInnsjoStatus:', JSON.stringify(meta?.nveInnsjoStatus ?? null))
console.log('sjokartStatus.state:', meta?.sjokartStatus?.state)

const water = await page.evaluate(() => {
  const g = document.querySelector('g[data-layer="vann"]')
  const paths = g ? [...g.querySelectorAll('path')] : []
  return {
    vannPaths: paths.length,
    dTegnTotalt: paths.reduce((s, p) => s + (p.getAttribute('d')?.length ?? 0), 0),
    subpather: paths.reduce((s, p) => s + ((p.getAttribute('d') ?? '').match(/M/g)?.length ?? 0), 0),
  }
})
console.log('vann-lag i DOM:', JSON.stringify(water))

await page.screenshot({ path: 'e2e-setten.png' })
const frisk = meta?.appVersion && meta?.nveInnsjoStatus?.state === 'ok' && water.vannPaths > 0
console.log(frisk ? 'KONKLUSJON: FRISK ✅ — appen bygger korrekt i ekte nettleser'
  : 'KONKLUSJON: PROBLEM ❌ — reproduserbart her, se over')
await browser.close()

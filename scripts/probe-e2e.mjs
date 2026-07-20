// E2E-DIAGNOSE v2 (CI, kun logg + skjermbilder): reproduserte i v1 at DOM-en
// viser terreng-arket (uten stempel/vann) LENGE etter at full bygging er
// ferdig og lagret. Nå: dump nøyaktig DOM-tilstand (alle svg, data-meta,
// data-layer-grupper), og test om en RELOAD henter det fulle arket fra
// lagringen — det skiller «stille re-render feiler» fra «fullt ark aldri lagret».

import { chromium } from 'playwright'

const URL = 'https://gitjanerik.github.io/lende/nytt?lat=59.802&lon=11.673&km=4&hl=E2E-Setten'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } })
const page = await ctx.newPage()
page.on('console', m => {
  const t = m.text()
  if (/N50|NVE|perf|Terreng|feil|error|finalize|partial/i.test(t)) console.log('[console]', t.slice(0, 220))
})
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)))

async function dumpState(label) {
  const s = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg.isom-map')]
    const layers = [...document.querySelectorAll('[data-layer]')].map(g => g.getAttribute('data-layer'))
    const uniq = [...new Set(layers)]
    const main = svgs[0]
    const rawMeta = main?.getAttribute('data-meta') ?? null
    let meta = null
    try { meta = rawMeta ? JSON.parse(rawMeta) : null } catch { meta = { PARSE_ERROR: true } }
    const vann = document.querySelector('g[data-layer="vann"]')
    return {
      antallIsomSvg: svgs.length,
      harDataMeta: rawMeta != null,
      metaHode: rawMeta ? rawMeta.slice(0, 120) : null,
      appVersion: meta?.appVersion ?? null,
      nveInnsjoStatus: meta?.nveInnsjoStatus ?? null,
      partialSource: meta?.source ?? null,
      dataLayers: uniq.slice(0, 20),
      vannPaths: vann ? vann.querySelectorAll('path').length : -1,
    }
  })
  console.log(`=== ${label} ===`)
  console.log(JSON.stringify(s, null, 1))
  return s
}

console.log('goto', URL)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
await page.click('button.bg-emerald-600', { timeout: 20000 })
await page.waitForURL(/\/kart\//, { timeout: 180000 })
console.log('på kart-visning:', page.url())

// Vent til full bygging bør være ferdig (perf-linja kom etter ~5 s i v1), og
// poll DOM i inntil 60 s.
let state = null
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000)
  state = await page.evaluate(() => {
    const raw = document.querySelector('svg.isom-map')?.getAttribute('data-meta')
    try { return raw ? (JSON.parse(raw)?.nveInnsjoStatus ?? null) : null } catch { return null }
  })
  if (state) break
}
await dumpState('DOM etter bygging + 60 s poll')
await page.screenshot({ path: 'e2e-1-live.png' })

console.log('--- RELOAD-TEST: henter reload det fulle arket fra lagringen? ---')
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
const after = await dumpState('DOM etter reload')
await page.screenshot({ path: 'e2e-2-reload.png' })

console.log('KONKLUSJON:',
  after.appVersion && after.nveInnsjoStatus?.state === 'ok' && after.vannPaths > 0
    ? 'Fullt ark FINNES i lagringen — kun den stille re-renderingen feiler'
    : 'Fullt ark mangler også etter reload — finalize-lagringen feiler')
await browser.close()

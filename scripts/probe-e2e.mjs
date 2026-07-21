// E2E-DIAGNOSE v6 (CI): «No dice» — ferske kart på telefonen mangler
// NVE-innsjøer (Nesøytjernet, Setten) mens småvann og sjø rendres. NVE-
// helseproben viser at tjenesten er frisk og returnerer innsjøene. Denne
// proben bygger de SAMME to arkene mot deployet app i ekte Chromium og
// dumper: app-konsollen ([N50]-loggene = NVE-utfallet), meta.appVersion +
// meta.nveInnsjoStatus, og alle vann-paths per ISO-gruppe.

import { chromium } from 'playwright'

const AREAS = [
  { label: 'Nesøya',  url: 'https://gitjanerik.github.io/lende/nytt?lat=59.867&lon=10.545&km=3&hl=E2E-Nesoya',  png: 'e2e-nesoya.png' },
  { label: 'Setskog', url: 'https://gitjanerik.github.io/lende/nytt?lat=59.802&lon=11.673&km=4&hl=E2E-Setskog', png: 'e2e-setskog.png' },
]

const browser = await chromium.launch()

for (const area of AREAS) {
  console.log(`\n\n######## ${area.label} ########`)
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)))
  page.on('console', m => {
    const t = m.text()
    if (/N50|NVE|Vann|vann|Sjøkart|Overpass|feil|Feil|error/i.test(t)) {
      console.log('[app]', t.slice(0, 400))
    }
  })

  await page.goto(area.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(3000)
  await page.click('button.bg-emerald-600', { timeout: 20000 })
  await page.waitForURL(/\/kart\//, { timeout: 180000 })
  await page.waitForTimeout(25000) // terreng-først finalize + render

  const s = await page.evaluate(() => {
    const svg = document.querySelector('svg.isom-map')
    const meta = (() => {
      try { return JSON.parse(svg?.getAttribute('data-meta') ?? 'null') } catch { return null }
    })()
    const groups = [...document.querySelectorAll('g[data-layer="vann"]')].map(g => {
      const paths = [...g.querySelectorAll('path')]
      return {
        iso: g.getAttribute('data-iso'),
        n: paths.length,
        paths: paths.map(p => ({
          src: p.getAttribute('data-src'),
          name: p.getAttribute('data-name') ?? '',
          bbox: p.getAttribute('data-bbox'),
          display: getComputedStyle(p).display,
          dLen: (p.getAttribute('d') ?? '').length,
        })),
      }
    })
    return {
      appVersion: meta?.appVersion ?? null,
      nveInnsjoStatus: meta?.nveInnsjoStatus ?? null,
      source: meta?.source ?? null,
      widthM: meta?.widthM, heightM: meta?.heightM,
      groups,
    }
  })
  console.log(`meta.appVersion=${s.appVersion}`)
  console.log(`meta.nveInnsjoStatus=${JSON.stringify(s.nveInnsjoStatus)}`)
  console.log(`meta.source=${s.source}`)
  console.log(`ark: ${s.widthM}×${s.heightM} m`)
  for (const g of s.groups) {
    console.log(`\n[iso=${g.iso}] ${g.n} paths`)
    for (const p of g.paths) {
      console.log(`  src=${p.src} name="${p.name}" display=${p.display} dLen=${p.dLen} bbox=${p.bbox}`)
    }
  }

  await page.screenshot({ path: area.png })
  await ctx.close()
}

await browser.close()
console.log('\nE2E-probe v6 ferdig.')

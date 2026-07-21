// E2E-DIAGNOSE v5 (CI): vann forsvinner ved zoom/pan på enheten (bekreftet
// bruker-rapport, v1.0.49, NVE OK — 9 innsjøer, blått ved 200 m-zoom, borte
// ved 500 m/pan). Mistenkt: viewport-culling skjuler vann-pathene feilaktig.
// Bygg kart, gjør PROGRAMMATISKE zoom/pan-gester, og dump per 301-path:
// data-bbox + computed display — sammenlignet med kontur-laget.

import { chromium } from 'playwright'

const URL = 'https://gitjanerik.github.io/lende/nytt?lat=59.802&lon=11.673&km=4&hl=E2E-Setten'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
await page.click('button.bg-emerald-600', { timeout: 20000 })
await page.waitForURL(/\/kart\//, { timeout: 180000 })
await page.waitForTimeout(20000) // finalize + første cull

async function dump(label) {
  const s = await page.evaluate(() => {
    const grab = (sel) => [...document.querySelectorAll(sel)].map(p => ({
      bbox: p.getAttribute('data-bbox'),
      display: getComputedStyle(p).display,
      inlineDisplay: p.style?.display ?? '',
    }))
    const vann = grab('g[data-layer="vann"][data-iso="301"] path')
    const kontur = grab('g[data-layer="kontur"] path').slice(0, 3)
    const meta = (() => {
      try { return JSON.parse(document.querySelector('svg.isom-map')?.getAttribute('data-meta') ?? 'null') } catch { return null }
    })()
    return {
      widthM: meta?.widthM, heightM: meta?.heightM,
      vannTotalt: vann.length,
      vannSkjult: vann.filter(v => v.display === 'none').length,
      vannEksempler: vann.slice(0, 6),
      konturEksempler: kontur.map(k => k.display),
    }
  })
  console.log(`=== ${label} ===`)
  console.log(JSON.stringify(s, null, 1))
}

await dump('etter bygging (ingen gester)')

// Zoom inn mot midten (wheel med ctrl for pinch-emulering, eller ren wheel).
await page.mouse.move(206, 450)
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(150) }
await page.waitForTimeout(1200)
await dump('etter zoom inn (~wheel x5)')

// Panorér: dra 250 px mot venstre og opp.
await page.mouse.move(206, 450)
await page.mouse.down()
for (let i = 1; i <= 10; i++) { await page.mouse.move(206 - i * 25, 450 - i * 15); await page.waitForTimeout(30) }
await page.mouse.up()
await page.waitForTimeout(1200)
await dump('etter pan (-250,-150)')

// Zoom ut igjen.
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(150) }
await page.waitForTimeout(1200)
await dump('etter zoom ut (~wheel x4)')

await page.screenshot({ path: 'e2e-setten.png' })
await browser.close()

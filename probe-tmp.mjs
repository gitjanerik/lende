import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage()
await p.goto('http://localhost:4173/lende/kart/vardasen', { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => !!document.querySelector('svg.isom-map'), null, { timeout: 30000 })
await p.waitForTimeout(1500)
console.log(JSON.stringify(await p.evaluate(async () => {
  const s = document.querySelector('svg.isom-map')
  const fila = await fetch('/lende/maps/vardasen.svg').then(r => r.text())
  const doc = new DOMParser().parseFromString(fila, 'image/svg+xml')
  const raa = doc.documentElement.getAttribute('data-meta')
  return {
    domAttributter: [...s.attributes].map(a => a.name),
    filaHarMeta: !!raa,
    filaHarLagTellinger: raa ? 'lagTellinger' in JSON.parse(raa) : null,
  }
}), null, 1))
await b.close()

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf8'),
)

describe('manifest.webmanifest', () => {
  // v6.5.43: sto på 'portrait' og låste den installerte appen til høykant på
  // Android. WCAG 2.1 SC 1.3.4 krever at innhold ikke er bundet til én
  // skjermretning med mindre retningen er vesentlig — og et kvadratisk kartark
  // er den ikke. Den som VIL låse, gjør det i telefonens egne
  // hurtiginnstillinger; da følger appen låsen. iOS har aldri støttet feltet, så
  // der har appen alltid rotert.
  it('låser ikke skjermretningen', () => {
    expect(manifest.orientation).toBe('any')
  })

  it('beholder resten av installasjonskontrakten', () => {
    expect(manifest.start_url).toBe('/lende/')
    expect(manifest.scope).toBe('/lende/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.length).toBeGreaterThan(0)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { n50StiBasePath, lesN50StiFraDisk } from './headless.js'
import { fetchN50StiLinjer, nullstillManifestCache } from '../src/lib/n50StiFetcher.js'

// Node-ens `fetch` støtter IKKE `file:` — den kaster «not implemented... yet...».
// Første forsøk på headless-lesing brukte en fil-URL rett i fetcheren, og MCP-bygde
// kart fikk null N50-stier helt stille: uthentingen feiler aldri hardt, så et kart
// uten stinettet så nøyaktig ut som et kart der flisene ikke var bakt ennå.
// Disse testene fanger regresjonen ved å gå gjennom den EKTE leseveien.

describe('N50-sti headless', () => {
  beforeEach(() => nullstillManifestCache())

  it('Node-fetch klarer ikke fil-URL-er — derfor finnes disk-leseren', async () => {
    await expect(fetch(`${n50StiBasePath()}manifest.json`)).rejects.toThrow()
  })

  it('leser manifestet fra repoets public/-katalog', async () => {
    const { status, bytes } = await lesN50StiFraDisk(`${n50StiBasePath()}manifest.json`)
    expect(status).toBe(200)
    const m = JSON.parse(new TextDecoder().decode(bytes))
    expect(Array.isArray(m.fliser)).toBe(true)
    expect(m.fliser.length).toBeGreaterThan(0)
  })

  it('gir 404 (ikke kast) for en flis som ikke finnes', async () => {
    const r = await lesN50StiFraDisk(`${n50StiBasePath()}0.0_0.0.bin`)
    expect(r).toEqual({ status: 404, bytes: null })
  })

  it('henter stier for Trettekollen gjennom hele lesekjeden', async () => {
    // Utsnittet mellom Lelangen og Haratjern i Finnemarka — nøyaktig området der
    // OSM manglet stien som UT.no viser.
    const bbox = { south: 59.8, north: 59.86, west: 10.02, east: 10.12 }
    const status = {}
    const linjer = await fetchN50StiLinjer(bbox, {
      basePath: n50StiBasePath(),
      hentBytes: lesN50StiFraDisk,
      onStatus: s => Object.assign(status, s),
    })
    expect(status.state).toBe('ok')
    expect(linjer.length).toBeGreaterThan(50)
    expect(linjer.some(l => l.merket)).toBe(true)
  })
})

describe('flisene i repoet', () => {
  it('holder seg innenfor det appen kan laste per kartrute', async () => {
    // Én kartrute laster typisk én flis. Vokser den forbi noen hundre kilobyte
    // er det verdt å vite før mobilbrukeren merker det — hev grensa bevisst,
    // ikke stille.
    const dir = fileURLToPath(new URL('../public/data/n50-sti/', import.meta.url))
    const { fliser } = JSON.parse(await readFile(`${dir}manifest.json`, 'utf8'))
    const storrelser = await Promise.all(
      fliser.map(async n => ({ n, b: (await readFile(`${dir}${n}.bin`)).length })),
    )
    const storst = storrelser.reduce((a, b) => (b.b > a.b ? b : a))
    expect(storst.b, `største flis er ${storst.n} (${Math.round(storst.b / 1024)} KB)`)
      .toBeLessThan(600 * 1024)
  })
})

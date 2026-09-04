import { describe, it, expect } from 'vitest'
import { deklarerteVersjoner, laasteVersjoner, finnDrift } from './versjonsdrift.mjs'

describe('deklarerteVersjoner', () => {
  it('tar med dependencies, devDependencies og optionalDependencies', () => {
    const m = deklarerteVersjoner({
      dependencies: { vue: '^3.5.0' },
      devDependencies: { vitest: '^4.1.0' },
      optionalDependencies: { fsevents: '^2.3.0' },
    })
    expect([...m.keys()].sort()).toEqual(['fsevents', 'vitest', 'vue'])
    expect(m.get('vitest')).toEqual({ omraade: '^4.1.0', dev: true })
    expect(m.get('vue').dev).toBe(false)
  })

  // peerDependencies er et KRAV til omgivelsene, ikke en versjon vi har valgt.
  // Tar vi dem med, rapporterer vi drift mellom to trær som er enige.
  it('tar IKKE med peerDependencies', () => {
    expect(deklarerteVersjoner({ peerDependencies: { react: '^18' } }).size).toBe(0)
  })

  it('tåler tomt og ugyldig', () => {
    expect(deklarerteVersjoner(null).size).toBe(0)
    expect(deklarerteVersjoner({ dependencies: { rar: { ikke: 'streng' } } }).size).toBe(0)
  })
})

describe('laasteVersjoner', () => {
  it('navngir etter SISTE node_modules, så nestede kopier teller med', () => {
    const m = laasteVersjoner({
      packages: {
        'node_modules/zod': { version: '3.25.0' },
        'node_modules/agents/node_modules/zod': { version: '3.22.0' },
      },
    })
    expect([...m.get('zod')].sort()).toEqual(['3.22.0', '3.25.0'])
  })

  // Rot-nodens `version` er prosjektets egen. Uten dette ville hver katalog
  // levert seg selv som en «pakke» og de fire kollidert på et navn de ikke har.
  it('hopper over rot-noden', () => {
    const m = laasteVersjoner({ packages: { '': { version: '6.5.33' }, 'node_modules/vue': { version: '3.5.1' } } })
    expect(m.has('')).toBe(false)
    expect([...m.keys()]).toEqual(['vue'])
  })

  it('hopper over lenker (workspaces) og noder uten versjon', () => {
    const m = laasteVersjoner({
      packages: {
        'node_modules/lokal': { resolved: 'pakker/lokal', link: true },
        'node_modules/uten': { resolved: 'https://…' },
      },
    })
    expect(m.size).toBe(0)
  })
})

describe('finnDrift', () => {
  const kat = (navn, flate, dep, lock) => ({
    navn, flate,
    deklarert: deklarerteVersjoner(dep),
    laast: laasteVersjoner(lock),
  })

  it('melder en pakke som to package.json ber ulikt om', () => {
    const { deklarert } = finnDrift([
      kat('proxy', 'DEPLOYERT', { devDependencies: { wrangler: '^4.0.0' } }),
      kat('mcp-worker', 'DEPLOYERT (token-gatet)', { devDependencies: { wrangler: '^4.125.0' } }),
    ])
    expect(deklarert).toHaveLength(1)
    expect(deklarert[0].navn).toBe('wrangler')
    expect(deklarert[0].antallVersjoner).toBe(2)
  })

  it('melder IKKE en pakke de er enige om', () => {
    const { deklarert } = finnDrift([
      kat('a', 'DEPLOYERT', { dependencies: { zod: '^3.25.0' } }),
      kat('b', 'DEPLOYERT', { dependencies: { zod: '^3.25.0' } }),
    ])
    expect(deklarert).toHaveLength(0)
  })

  it('melder IKKE en pakke som bare finnes i én katalog', () => {
    const { deklarert } = finnDrift([
      kat('a', 'DEPLOYERT', { dependencies: { alene: '^1.0.0' } }),
      kat('b', 'DEPLOYERT', { dependencies: { annen: '^2.0.0' } }),
    ])
    expect(deklarert).toHaveLength(0)
  })

  // Kjernen: `^4.0.0` og `4.125.3` er ikke et avvik, de er to ulike spørsmål.
  it('sammenlikner ALDRI deklarert mot låst', () => {
    const d = finnDrift([
      kat('a', 'DEPLOYERT', { dependencies: { zod: '^3.0.0' } }, { packages: { 'node_modules/zod': { version: '3.25.1' } } }),
      kat('b', 'DEPLOYERT', { dependencies: { zod: '^3.0.0' } }, { packages: { 'node_modules/zod': { version: '3.25.1' } } }),
    ])
    expect(d.deklarert).toHaveLength(0)
    expect(d.laast).toHaveLength(0)
  })

  it('en katalog uten lockfile bidrar bare til den deklarerte lista', () => {
    const d = finnDrift([
      kat('a', 'DEPLOYERT', { dependencies: { zod: '^3.0.0' } }, { packages: { 'node_modules/zod': { version: '3.25.1' } } }),
      kat('b', 'DEPLOYERT', { dependencies: { zod: '^4.0.0' } }, null),
    ])
    expect(d.deklarert.map((f) => f.navn)).toEqual(['zod'])
    expect(d.laast).toHaveLength(0)
  })

  // Rekkefølgen er etter FLATE, ikke navn: en drift som treffer noe deployet
  // skal aldri havne under en som bare treffer verktøykjeden.
  it('sorterer tyngste flate først', () => {
    const { deklarert } = finnDrift([
      kat('rot', 'nettleser + verktøykjede', { dependencies: { aaa: '^1.0.0', zzz: '^1.0.0' } }),
      kat('rot2', 'nettleser + verktøykjede', { dependencies: { aaa: '^2.0.0' } }),
      kat('mcp', 'DEPLOYERT (token-gatet)', { dependencies: { zzz: '^2.0.0' } }),
    ])
    expect(deklarert.map((f) => f.navn)).toEqual(['zzz', 'aaa'])
  })

  it('melder en nestet kopi som avviker fra rotas', () => {
    const { laast } = finnDrift([
      kat('rot', 'nettleser + verktøykjede', {}, { packages: { 'node_modules/zod': { version: '3.25.0' } } }),
      kat('mcp', 'DEPLOYERT (token-gatet)', {}, {
        packages: { 'node_modules/agents/node_modules/zod': { version: '3.22.0' } },
      }),
    ])
    expect(laast).toHaveLength(1)
    expect(laast[0].navn).toBe('zod')
    // Radene står i KATALOG-rekkefølge og ikke sortert: de skal leses i samme
    // rekkefølge som tabellen over dem. Det er lista av PAKKER som veies etter flate.
    expect(laast[0].rader.map((r) => r.katalog)).toEqual(['rot', 'mcp'])
    expect(laast[0].rader[1].versjoner).toEqual(['3.22.0'])
  })

  it('tåler tom inndata', () => {
    expect(finnDrift([])).toEqual({ deklarert: [], laast: [] })
  })
})

// Gaten for opprydningen i public/sw.js. Regelen kan ikke importeres — sw.js er
// en rå fil i public/ som ikke går gjennom bundleren og ikke kan importere fra
// src — så testen leser DEN FILEN og henter ut funksjonen. Det er med vilje:
// en kopi av regelen her ville kunne stå grønn mens den deployede versjonen var
// ødelagt, og det var nettopp det som skjedde fra v6.5.16 til v6.5.38 (filteret
// lette etter et prefiks navnene ikke lenger hadde, så ingenting ble slettet og
// flymodus bootet appen fra det eldste skallet på disk).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const kilde = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')

/** Klipp ut én navngitt funksjon ved å telle klammer. */
function hentFunksjon(navn) {
  const start = kilde.indexOf(`function ${navn}(`)
  if (start < 0) throw new Error(`public/sw.js har ingen function ${navn}() — er regelen omdøpt?`)
  let dybde = 0
  for (let i = kilde.indexOf('{', start); i < kilde.length; i++) {
    if (kilde[i] === '{') dybde++
    else if (kilde[i] === '}' && --dybde === 0) {
      return new Function(`${kilde.slice(start, i + 1)}; return ${navn}`)()
    }
  }
  throw new Error(`Fant ikke slutten av ${navn}()`)
}

const ryddesCache = hentFunksjon('ryddesCache')
const NAA = ['lende-6.5.39-shell', 'lende-6.5.39-assets', 'lende-data']

describe('ryddesCache', () => {
  it('beholder de gjeldende cachene', () => {
    for (const n of NAA) expect(ryddesCache(n, NAA)).toBe(false)
  })

  it('sletter eldre utgaver av vårt eget skall', () => {
    expect(ryddesCache('lende-6.5.38-shell', NAA)).toBe(true)
    expect(ryddesCache('lende-v6.5.15-assets', NAA)).toBe(true)
  })

  it('sletter de prefiksløse cachene v6.5.16–v6.5.38 la igjen', () => {
    expect(ryddesCache('6.5.17-shell', NAA)).toBe(true)
    expect(ryddesCache('6.5.38-assets', NAA)).toBe(true)
  })

  it('rører IKKE andre prosjekter på samme origin (github.io er én origin)', () => {
    expect(ryddesCache('svg-insights-v3-shell', NAA)).toBe(false)
    expect(ryddesCache('workbox-precache', NAA)).toBe(false)
    expect(ryddesCache('2.1.0-bilder', NAA)).toBe(false)
  })
})

describe('public/sw.js', () => {
  it('prefikser cache-navnene, ellers gjenkjenner opprydningen dem ikke', () => {
    expect(kilde).toMatch(/SHELL_CACHE\s*=\s*`lende-\$\{CACHE_VERSION\}-shell`/)
    expect(kilde).toMatch(/ASSET_CACHE\s*=\s*`lende-\$\{CACHE_VERSION\}-assets`/)
  })

  it('slår opp index.html i ET NAVNGITT skall — usikret caches.match() svarer fra det eldste', () => {
    expect(kilde).not.toMatch(/caches\.match\(`\$\{BASE\}index\.html`\)/)
    expect(kilde).toMatch(/caches\.open\(SHELL_CACHE\)\.then\(\(c\) => c\.match\(`\$\{BASE\}index\.html`\)\)/)
  })

  it('holder kartdata i en UVERSJONERT cache, så en deploy ikke tar offline-kartet', () => {
    expect(kilde).toMatch(/DATA_CACHE\s*=\s*'lende-data'/)
  })
})

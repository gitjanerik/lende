import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Kjøremiljøet er node, så `localStorage` må stubbes — samme grep som
// useEksterneLenker.test.js. Modulen cacher per nøkkel, så hver test laster den
// på nytt for å se en annen startverdi.
let lager
async function frisk() {
  vi.resetModules()
  return import('./useDemoFlagg.js')
}

describe('useDemoFlagg', () => {
  beforeEach(() => {
    lager = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (lager.has(k) ? lager.get(k) : null),
      setItem: (k, v) => lager.set(k, String(v)),
      removeItem: (k) => lager.delete(k),
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('er AV som standard', async () => {
    const { useDemoFlagg } = await frisk()
    expect(useDemoFlagg('lende-test-flagg').pa.value).toBe(false)
  })

  it('leser et lagret ja', async () => {
    lager.set('lende-test-flagg', '1')
    const { useDemoFlagg } = await frisk()
    expect(useDemoFlagg('lende-test-flagg').pa.value).toBe(true)
  })

  it('persisterer begge veier', async () => {
    const { useDemoFlagg } = await frisk()
    const { sett } = useDemoFlagg('lende-test-flagg')
    sett(true)
    await Promise.resolve()
    expect(lager.get('lende-test-flagg')).toBe('1')
    sett(false)
    await Promise.resolve()
    expect(lager.get('lende-test-flagg')).toBe('0')
  })

  // Cachen er hele grunnen til at modulen finnes som noe annet enn en `ref`:
  // to kallsteder på samme flagg må dele tilstand, ellers spriker de i det den
  // ene endres — samme klasse feil som to flater med hver sin mening om
  // relieffet (v7.8.4).
  it('deler ÉN ref per nøkkel, og skiller mellom ulike nøkler', async () => {
    const { useDemoFlagg } = await frisk()
    const a = useDemoFlagg('lende-test-flagg')
    const b = useDemoFlagg('lende-test-flagg')
    const annen = useDemoFlagg('lende-annet-flagg')
    expect(a.pa).toBe(b.pa)
    a.sett(true)
    expect(b.pa.value).toBe(true)
    expect(annen.pa.value).toBe(false)
  })

  it('tåler privat modus uten å kaste', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('nope') },
      setItem: () => { throw new Error('nope') },
    })
    const { useDemoFlagg } = await frisk()
    const { pa, sett } = useDemoFlagg('lende-test-flagg')
    expect(pa.value).toBe(false)
    expect(() => sett(true)).not.toThrow()
  })
})

describe('DEMO_NOKLER mot Viewer3D', () => {
  // VIEWER3D LESER NØKLENE DIREKTE VED MONTERING, og det er med vilje: en
  // reaktiv kilde ville lovet et bytte midt i en 3D-økt. Prisen er at
  // nøkkel-navnene står på to steder, og en skrivefeil i det ene ville gitt en
  // bryter som lagrer et flagg 3D-en aldri leser — en helt stille feil.
  // Prosjektet monterer ikke Vue-komponenter, så vi leser fila som TEKST.
  it('har samme nøkler som Viewer3D leser', async () => {
    const { DEMO_NOKLER } = await frisk()
    const kilde = readFileSync(
      new URL('../components/tour3d/Viewer3D.vue', import.meta.url), 'utf8')
    for (const nokkel of Object.values(DEMO_NOKLER)) {
      expect(kilde.includes(`'${nokkel}'`), `Viewer3D leser ikke ${nokkel}`).toBe(true)
    }
  })
})

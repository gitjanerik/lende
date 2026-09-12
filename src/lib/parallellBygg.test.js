import { describe, it, expect, vi } from 'vitest'
import {
  BYGG_SAMTIDIG, kjorMedTak, indeksTekst, byggeStatusTekst, lagFramdrift,
} from './parallellBygg.js'

function utsatt() {
  let resolve, reject
  const p = new Promise((res, rej) => { resolve = res; reject = rej })
  return { p, resolve, reject }
}
// Én makrotask lar alle ventende mikrotasks (await-fortsettelser) kjøre ferdig.
const tikk = () => new Promise(r => setTimeout(r, 0))
const abortFeil = () => new DOMException('Avbrutt', 'AbortError')

describe('BYGG_SAMTIDIG', () => {
  it('er to — Overpass sin grense, ikke vår (to speil per bygg → fire i flukt)', () => {
    expect(BYGG_SAMTIDIG).toBe(2)
  })
})

describe('kjorMedTak', () => {
  it('starter høyst `tak` samtidig, i rekkefølge, og lar en ledig plass ta neste', async () => {
    const d = [utsatt(), utsatt(), utsatt()]
    const startet = []
    const p = kjorMedTak(d.map((x, i) => () => { startet.push(i); return x.p }), { tak: 2 })
    expect(startet).toEqual([0, 1])
    d[1].resolve('b')
    await tikk()
    expect(startet).toEqual([0, 1, 2])
    d[2].resolve('c')
    d[0].resolve('a')
    expect(await p).toEqual([
      { status: 'ok', verdi: 'a' }, { status: 'ok', verdi: 'b' }, { status: 'ok', verdi: 'c' },
    ])
  })

  it('måler aldri mer enn `tak` i flukt, uansett hvor mange oppgaver', async () => {
    let iFlukt = 0, maks = 0
    const oppgaver = Array.from({ length: 7 }, (_, i) => async () => {
      iFlukt++; maks = Math.max(maks, iFlukt)
      await tikk()
      iFlukt--
      return i
    })
    const utfall = await kjorMedTak(oppgaver, { tak: 2 })
    expect(maks).toBe(2)
    expect(utfall.map(u => u.verdi)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('gir oppgaven sin indeks og bruker BYGG_SAMTIDIG som standard-tak', async () => {
    const sett = []
    const utfall = await kjorMedTak([
      async (i) => { sett.push(i); return 'x' },
      async (i) => { sett.push(i); return 'y' },
      async (i) => { sett.push(i); return 'z' },
    ])
    expect(sett).toEqual([0, 1, 2])
    expect(utfall.every(u => u.status === 'ok')).toBe(true)
  })

  it('isolerer én feil: naboene fullføres, og feilen ligger i sin rad', async () => {
    const feil = new Error('Overpass nede')
    const utfall = await kjorMedTak([
      async () => 'a',
      async () => { throw feil },
      async () => 'c',
    ], { tak: 2 })
    expect(utfall).toEqual([
      { status: 'ok', verdi: 'a' }, { status: 'feil', feil }, { status: 'ok', verdi: 'c' },
    ])
  })

  it('regner AbortError som avbrutt, ikke feilet', async () => {
    const utfall = await kjorMedTak([async () => { throw abortFeil() }], { tak: 2 })
    expect(utfall).toEqual([{ status: 'avbrutt' }])
  })

  it('starter ingen ny oppgave etter abort, men lar de som er i gang svare selv', async () => {
    const ac = new AbortController()
    const d = [utsatt(), utsatt()]
    const tredje = vi.fn(async () => 'aldri')
    const p = kjorMedTak([() => d[0].p, () => d[1].p, tredje], { tak: 2, signal: ac.signal })
    ac.abort()
    // Den ene i gang hører på signalet og kaster; den andre rakk å bli ferdig.
    d[0].reject(abortFeil())
    d[1].resolve('b')
    const utfall = await p
    expect(tredje).not.toHaveBeenCalled()
    expect(utfall).toEqual([{ status: 'avbrutt' }, { status: 'ok', verdi: 'b' }, { status: 'avbrutt' }])
  })

  it('melder start og slutt per indeks, slutt også når oppgaven feiler', async () => {
    const logg = []
    await kjorMedTak([
      async () => 'a',
      async () => { throw new Error('x') },
    ], {
      tak: 1,
      onStart: (i) => logg.push(`start ${i}`),
      onSlutt: (i) => logg.push(`slutt ${i}`),
    })
    expect(logg).toEqual(['start 0', 'slutt 0', 'start 1', 'slutt 1'])
  })

  it('tåler tom liste og et tak større enn lista', async () => {
    expect(await kjorMedTak([], { tak: 2 })).toEqual([])
    const startet = []
    const d = [utsatt(), utsatt()]
    const p = kjorMedTak(d.map((x, i) => () => { startet.push(i); return x.p }), { tak: 5 })
    expect(startet).toEqual([0, 1])
    d[0].resolve(1); d[1].resolve(2)
    expect((await p).map(u => u.verdi)).toEqual([1, 2])
  })

  it('klemmer et ugyldig tak til én i flukt', async () => {
    const startet = []
    const d = [utsatt(), utsatt()]
    const p = kjorMedTak(d.map((x, i) => () => { startet.push(i); return x.p }), { tak: 0 })
    expect(startet).toEqual([0])
    d[0].resolve(); await tikk()
    expect(startet).toEqual([0, 1])
    d[1].resolve(); await p
  })
})

describe('indeksTekst', () => {
  it('skriver spenn for sammenhengende og «og» for hull', () => {
    expect(indeksTekst([])).toBe('')
    expect(indeksTekst([2])).toBe('2')
    expect(indeksTekst([1, 2])).toBe('1–2')
    expect(indeksTekst([2, 3, 4])).toBe('2–4')
    expect(indeksTekst([1, 3])).toBe('1 og 3')
    expect(indeksTekst([1, 2, 4])).toBe('1, 2 og 4')
    expect(indeksTekst([3, 1])).toBe('1 og 3')
  })
})

const ORD = { stor: 'Utsnitt', liten: 'utsnitt', en: 'Bygger nytt utsnitt …' }

describe('byggeStatusTekst', () => {
  it('gir ÉN flis nøyaktig tekstene fra før — ingen prefiks', () => {
    expect(byggeStatusTekst({ ord: ORD, total: 1, paagaar: [1] })).toBe('Bygger nytt utsnitt …')
    expect(byggeStatusTekst({ ord: ORD, total: 1, paagaar: [1], melding: 'Henter kartdata …' }))
      .toBe('Henter kartdata …')
  })

  it('viser spennet som bygges når det er flere', () => {
    expect(byggeStatusTekst({ ord: ORD, total: 3, paagaar: [1, 2] })).toBe('Bygger utsnitt 1–2 av 3 …')
    expect(byggeStatusTekst({ ord: ORD, total: 3, paagaar: [1, 2], melding: 'Henter kartdata …' }))
      .toBe('Utsnitt 1–2/3: Henter kartdata …')
    expect(byggeStatusTekst({ ord: ORD, total: 3, paagaar: [3], melding: 'Bygger SVG …' }))
      .toBe('Utsnitt 3/3: Bygger SVG …')
  })

  it('faller tilbake på meldinga når ingenting pågår', () => {
    expect(byggeStatusTekst({ ord: ORD, total: 3, paagaar: [], melding: 'Siste' })).toBe('Siste')
    expect(byggeStatusTekst({ ord: ORD, total: 3, paagaar: [] })).toBe('Bygger nytt utsnitt …')
  })
})

describe('lagFramdrift', () => {
  it('viser den ferskeste meldinga fra et bygg som FORTSATT pågår', () => {
    const vis = vi.fn()
    const f = lagFramdrift({ ord: ORD, total: 3, vis })
    f.onStart(0); f.onStart(1)
    expect(vis).toHaveBeenLastCalledWith('Bygger utsnitt 1–2 av 3 …')
    f.onProgress(0, 'Henter kartdata …')
    expect(vis).toHaveBeenLastCalledWith('Utsnitt 1–2/3: Henter kartdata …')
    f.onProgress(1, 'Bygger SVG fra 900 elementer …')
    expect(vis).toHaveBeenLastCalledWith('Utsnitt 1–2/3: Bygger SVG fra 900 elementer …')
    // Bygg 2 blir ferdig: teksten skal IKKE bli stående på dets «Bygger SVG …»
    // mens bygg 1 fortsatt henter — det er bygg 1 sin siste melding som gjelder.
    f.onSlutt(1)
    expect(vis).toHaveBeenLastCalledWith('Utsnitt 1/3: Henter kartdata …')
    f.onStart(2)
    expect(vis).toHaveBeenLastCalledWith('Utsnitt 1 og 3/3: Henter kartdata …')
    f.onProgress(2, 'Måler …')
    expect(vis).toHaveBeenLastCalledWith('Utsnitt 1 og 3/3: Måler …')
    f.onSlutt(0)
    expect(vis).toHaveBeenLastCalledWith('Utsnitt 3/3: Måler …')
    const antall = vis.mock.calls.length
    f.onSlutt(2)
    expect(vis.mock.calls.length).toBe(antall)   // siste slutt: kalleren rydder chipen
  })

  it('bruker ord-settet til kalleren (flis-varianten)', () => {
    const vis = vi.fn()
    const f = lagFramdrift({ ord: { stor: 'Flis', liten: 'flis', en: 'Bygger flis …' }, total: 2, vis })
    f.onStart(0); f.onStart(1)
    expect(vis).toHaveBeenLastCalledWith('Bygger flis 1–2 av 2 …')
    f.onProgress(1, 'Henter høydedata (20 m) og kartdata …')
    expect(f.tekst()).toBe('Flis 1–2/2: Henter høydedata (20 m) og kartdata …')
  })
})

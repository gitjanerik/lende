import { describe, it, expect } from 'vitest'
import { lesSkrue, klassifiser, erBreNavnType } from './bygg-n50-areal.mjs'
import { TYPER } from '../src/lib/n50ArealPakke.js'

const ALLE = new Set(['myr', 'skog', 'isbre'])

describe('klassifisering — det som avgjorde om skogen kom med', () => {
  it('myr, skog og isbre kjennes igjen', () => {
    expect(klassifiser({ objtype: 'Myr' }, ALLE)).toBe('myr')
    expect(klassifiser({ objtype: 'Skog' }, ALLE)).toBe('skog')
    expect(klassifiser({ objtype: 'SnøIsbre' }, ALLE)).toBe('isbre')
  })

  it('skrivemåten på isbre er ikke gjettet på ÉN variant', () => {
    // Geonorge er blokkert fra utviklings-sandkassene, så feltet er ikke sett
    // herfra. Et bomskudd ville gitt null breer og en helt taus bake — samme
    // stillhet som lot den første areal-kjøringen laste ned 166 MB og melde
    // «success» med null flater.
    for (const v of ['SnøIsbre', 'snoisbre', 'ISBRE', 'Bre']) {
      expect(klassifiser({ objtype: v }, ALLE), v).toBe('isbre')
    }
  })

  it('ÅpentOmråde bæres bevisst ikke — åpenhet ER bakgrunnen', () => {
    expect(klassifiser({ objtype: 'ÅpentOmråde' }, ALLE)).toBe(null)
  })

  it('en type som ikke er BEDT om, faller ut — det var hele skog-feilen', () => {
    // v5.25.0 bakte med `--typer myr`, og klassifiseringen gjorde nøyaktig
    // dette: den kjente skogen igjen og forkastet den likevel. Feilen lå i
    // defaulten og i at workflowen ikke hadde noen knott for flagget.
    expect(klassifiser({ objtype: 'Skog' }, new Set(['myr']))).toBe(null)
    expect(klassifiser({ objtype: 'Myr' }, new Set(['myr']))).toBe('myr')
  })

  it('ukjent objtype gir null i stedet for å havne i en feil bøtte', () => {
    expect(klassifiser({ objtype: 'Alpinbakke' }, ALLE)).toBe(null)
    expect(klassifiser({}, ALLE)).toBe(null)
  })
})

describe('lesSkrue — ett tall for alt, eller ett per type', () => {
  it('tomt gir standarden til alle typer', () => {
    expect(lesSkrue('', 4)).toEqual(Object.fromEntries(TYPER.map((t) => [t, 4])))
    expect(lesSkrue(null, 7).myr).toBe(7)
  })

  it('ett tall treffer alle', () => {
    const ut = lesSkrue('6', 4)
    for (const t of TYPER) expect(ut[t], t).toBe(6)
  })

  it('per type treffer BARE de nevnte', () => {
    // Poenget med skruene: en skogteig er kilometervis av kant der hver meter
    // koster byte og ingen av dem er synlige i 1:10 000, mens en myr bæres av
    // hvert eneste knekkpunkt. Én felles skrue måtte valgt mellom å ødelegge
    // myra eller å bære skogen dyrere enn public/ tåler.
    const ut = lesSkrue('skog=12', null)
    expect(ut.skog).toBe(12)
    expect(ut.myr).toBe(null)
    expect(ut.isbre).toBe(null)
  })

  it('flere typer på én gang', () => {
    const ut = lesSkrue('myr=4, skog=8 ,isbre=3', null)
    expect([ut.myr, ut.skog, ut.isbre]).toEqual([4, 8, 3])
  })

  it('kaster på ukjent type og på tull i stedet for å tie', () => {
    expect(() => lesSkrue('gress=4', null)).toThrow(/Ukjent type/)
    expect(() => lesSkrue('skog=mye', null)).toThrow(/Ugyldig verdi/)
    expect(() => lesSkrue('mye', null)).toThrow(/Ugyldig tallverdi/)
  })
})

describe('erBreNavnType — hvilke stedsnavn som er bre-navn', () => {
  it('kjenner igjen bre-, fonn- og jøkul-navn', () => {
    for (const v of ['Isbre', 'isbre', 'Bre', 'Fonn', 'Jøkul', 'Snøskavl']) {
      expect(erBreNavnType(v), v).toBe(true)
    }
  })

  it('lar fjell, vann og gård være', () => {
    for (const v of ['Fjell', 'Innsjø', 'Gard', 'Berg', '', null]) {
      expect(erBreNavnType(v), String(v)).toBe(false)
    }
  })
})

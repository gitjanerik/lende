import { describe, it, expect } from 'vitest'
import {
  PA_KEY, FIRKANT_KEY,
  lesAutoNaboPa, skrivAutoNaboPa, lesFirkantPa, skrivFirkantPa,
  firkantKvitteringTekst,
} from './autoNaboValg.js'

const lager = (verdier = {}) => {
  const data = { ...verdier }
  return {
    data,
    lesLager: (k) => (k in data ? data[k] : null),
    skrivLager: (k, v) => { data[k] = v },
  }
}

describe('lesAutoNaboPa — automatikken er AV til noen sier noe annet', () => {
  it('urørt enhet får AV', () => {
    expect(lesAutoNaboPa(lager())).toBe(false)
  })

  it('bare en eksplisitt «1» slår den på', () => {
    expect(lesAutoNaboPa(lager({ [PA_KEY]: '1' }))).toBe(true)
    expect(lesAutoNaboPa(lager({ [PA_KEY]: '0' }))).toBe(false)
  })

  it('søppelverdi leses som AV, ikke som på', () => {
    expect(lesAutoNaboPa(lager({ [PA_KEY]: 'ja' }))).toBe(false)
    expect(lesAutoNaboPa(lager({ [PA_KEY]: '' }))).toBe(false)
  })

  it('en enhet som hadde den på før v5.19.7 uten å trykke, får den AV', () => {
    // Gammel lesing var «!== "0"», så et fravær av nøkkelen betydde PÅ. Det er
    // nøyaktig tilfellet som skal snus.
    expect(lesAutoNaboPa(lager())).toBe(false)
  })

  it('skriving tur-retur beholder verdien', () => {
    const l = lager()
    skrivAutoNaboPa(true, l)
    expect(lesAutoNaboPa(l)).toBe(true)
    skrivAutoNaboPa(false, l)
    expect(lesAutoNaboPa(l)).toBe(false)
  })
})

describe('lesFirkantPa — utfyllingen er PÅ når automatikken først er på', () => {
  it('urørt enhet får PÅ', () => {
    expect(lesFirkantPa(lager())).toBe(true)
  })

  it('bare en eksplisitt «0» slår den av', () => {
    expect(lesFirkantPa(lager({ [FIRKANT_KEY]: '0' }))).toBe(false)
    expect(lesFirkantPa(lager({ [FIRKANT_KEY]: '1' }))).toBe(true)
  })

  it('skriving tur-retur beholder verdien', () => {
    const l = lager()
    skrivFirkantPa(false, l)
    expect(lesFirkantPa(l)).toBe(false)
    skrivFirkantPa(true, l)
    expect(lesFirkantPa(l)).toBe(true)
  })

  it('de to valgene har hver sin nøkkel', () => {
    const l = lager()
    skrivAutoNaboPa(true, l)
    skrivFirkantPa(false, l)
    expect(l.data[PA_KEY]).toBe('1')
    expect(l.data[FIRKANT_KEY]).toBe('0')
  })
})

// Kvitteringen er hele bug-en fra v5.19.11: den påsto «Arket er firkantet» på
// et ark som synlig ikke var det, fordi den leste hvilken FASE løkka var i og
// ikke hva som faktisk sto igjen.
describe('firkantKvitteringTekst', () => {
  it('melder firkantet bare når ingenting står igjen', () => {
    expect(firkantKvitteringTekst({ rest: 0, stopp: null })).toBe('Arket er firkantet')
    expect(firkantKvitteringTekst()).toBe('Arket er firkantet')
  })

  it('melder ALDRI firkantet når fliser står igjen', () => {
    for (const stopp of ['økt-tak', 'offline', 'byggefeil', 'runde-tak', 'avbrutt', null]) {
      expect(firkantKvitteringTekst({ rest: 3, stopp })).not.toBe('Arket er firkantet')
    }
  })

  it('tar med hvor mange som står igjen, i entall og flertall', () => {
    expect(firkantKvitteringTekst({ rest: 1, stopp: 'byggefeil' })).toBe('Stoppet · 1 flis igjen')
    expect(firkantKvitteringTekst({ rest: 4, stopp: 'byggefeil' })).toBe('Stoppet · 4 fliser igjen')
  })

  it('navngir de to grunnene brukeren selv kan gjøre noe med', () => {
    expect(firkantKvitteringTekst({ rest: 2, stopp: 'offline' })).toBe('Uten nett · 2 fliser igjen')
    expect(firkantKvitteringTekst({ rest: 2, stopp: 'økt-tak' })).toBe('Auto-pause · 2 fliser igjen')
  })
})

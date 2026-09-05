import { describe, it, expect } from 'vitest'
import {
  mikrofonFeilTekst, mikrofonFeilForklaring,
  MIK_FEIL_TEKST, MIK_FEIL_RAAD, MIK_UKJENT_FEIL,
} from './mikrofonFeil.js'

describe('mikrofonFeilTekst', () => {
  it('dekker kodene Web Speech API faktisk sender', () => {
    expect(Object.keys(MIK_FEIL_TEKST).sort()).toEqual([
      'audio-capture', 'language-not-supported', 'network',
      'not-allowed', 'service-not-allowed',
    ])
  })

  it('nevner tillatelse på begge nekt-kodene — det er den brukeren kan gjøre noe med', () => {
    expect(mikrofonFeilTekst('not-allowed')).toMatch(/tillatt/)
    expect(mikrofonFeilTekst('service-not-allowed')).toMatch(/tillatt/)
  })

  it('faller tilbake på ukjent og manglende kode', () => {
    expect(mikrofonFeilTekst(undefined)).toBe(MIK_UKJENT_FEIL)
    expect(mikrofonFeilTekst('no-speech', 'egen tekst')).toBe('egen tekst')
  })
})

describe('mikrofonFeilForklaring', () => {
  it('har et råd for hver kode etiketten dekker', () => {
    expect(Object.keys(MIK_FEIL_RAAD).sort()).toEqual(Object.keys(MIK_FEIL_TEKST).sort())
  })

  it('setter etikett og råd sammen til én setning', () => {
    expect(mikrofonFeilForklaring('audio-capture'))
      .toBe(`${MIK_FEIL_TEKST['audio-capture']}. ${MIK_FEIL_RAAD['audio-capture']}`)
  })

  it('peker på innstillingen ved nektet tillatelse', () => {
    expect(mikrofonFeilForklaring('not-allowed')).toMatch(/Tillat/)
  })

  it('tilbyr alltid å skrive i stedet når mikrofonen ikke er en vei videre', () => {
    for (const kode of ['not-allowed', 'service-not-allowed', 'network', 'language-not-supported']) {
      expect(mikrofonFeilForklaring(kode)).toMatch(/[Ss]kriv søket/)
    }
  })

  it('gir bare etiketten når koden ikke har noe råd', () => {
    expect(mikrofonFeilForklaring('no-speech', 'egen tekst')).toBe('egen tekst')
  })
})

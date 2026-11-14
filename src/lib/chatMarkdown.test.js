import { describe, it, expect } from 'vitest'
import { chatSegmenter } from './chatMarkdown.js'

describe('chatSegmenter', () => {
  it('fet tekst mister stjernene', () => {
    expect(chatSegmenter('Kartet over **Kjekstadmarka, Asker** bygges nå')).toEqual([
      { tekst: 'Kartet over ' },
      { tekst: 'Kjekstadmarka, Asker', fet: true },
      { tekst: ' bygges nå' },
    ])
  })

  it('kursiv med én stjerne', () => {
    expect(chatSegmenter('en *rolig* tur')).toEqual([
      { tekst: 'en ' }, { tekst: 'rolig', kursiv: true }, { tekst: ' tur' },
    ])
  })

  it('punktliste med stjerner blir ikke kursiv', () => {
    const t = '* Dikemark\n* Kjekstad'
    expect(chatSegmenter(t)).toEqual([{ tekst: t }])
  })

  it('uavsluttet fet står som tekst', () => {
    expect(chatSegmenter('**halv')).toEqual([{ tekst: '**halv' }])
  })

  it('HTML forblir tekst', () => {
    expect(chatSegmenter('**<b>x</b>**')).toEqual([{ tekst: '<b>x</b>', fet: true }])
  })

  it('tom streng', () => {
    expect(chatSegmenter('')).toEqual([])
  })
})

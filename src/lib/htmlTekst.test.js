import { describe, it, expect } from 'vitest'
import { stripHtml, stripHtmlEnLinje, decodeHtmlEntities } from './htmlTekst.js'

describe('stripHtml — <br> blir linjeskift', () => {
  it('tar alle skrivemåter av br', () => {
    expect(stripHtml('A<br>B<br/>C<br />D<BR />E')).toBe('A\nB\nC\nD\nE')
  })

  it('rydder Charlottenborg-tilfellet (br på hver linje)', () => {
    const raw = 'CHARLOTTENBORG GÅRD OG TEGLVERK<br />Charlottenborgvn. 3<br />' +
      '<br />Charlottenborg gård<br />Helt i enden av Tronvikveien.'
    expect(stripHtml(raw)).toBe(
      'CHARLOTTENBORG GÅRD OG TEGLVERK\nCharlottenborgvn. 3\n\nCharlottenborg gård\n' +
      'Helt i enden av Tronvikveien.')
  })

  it('gir avsnittsskille for blokk-tagger', () => {
    expect(stripHtml('<p>Ett</p><p>To</p>')).toBe('Ett\n\nTo')
    expect(stripHtml('<ul><li>En</li><li>To</li></ul>')).toBe('En\nTo')
  })
})

describe('stripHtml — annen formatering ignoreres', () => {
  it('beholder teksten, mister fet/kursiv/farge/font', () => {
    expect(stripHtml('<b>Fet</b> og <i>kursiv</i>')).toBe('Fet og kursiv')
    expect(stripHtml('<span style="color:#f00;font-size:22px">Rød</span>')).toBe('Rød')
    expect(stripHtml('<font size="5" color="red">Stor</font>')).toBe('Stor')
    expect(stripHtml('Se <a href="https://ra.no">her</a>')).toBe('Se her')
  })

  it('fjerner kode og kommentarer med kropp og alt', () => {
    expect(stripHtml('Før<script>alert(1)</script>etter')).toBe('Føretter')
    expect(stripHtml('Før<style>p{color:red}</style>etter')).toBe('Føretter')
    expect(stripHtml('Før<!-- notat -->etter')).toBe('Føretter')
  })
})

describe('stripHtml — bilder', () => {
  it('fjerner img-tagger (vi kan ikke laste dem, og en brukket ramme er verre)', () => {
    expect(stripHtml('Teglverket<br /><img src="http://opphav/x.jpg" alt="foto"><br />sto her'))
      .toBe('Teglverket\nsto her')
    expect(stripHtml('<img src=x />')).toBe('')
  })
})

describe('stripHtml — entiteter og ren tekst', () => {
  it('dekoder entiteter, også dobbeltkodet markup', () => {
    expect(stripHtml('Kase &amp; sønner')).toBe('Kase & sønner')
    expect(stripHtml('A&lt;br /&gt;B')).toBe('A\nB')
    expect(stripHtml('Gr&aring;kallen &#8211; 552 moh')).toBe('Gråkallen – 552 moh')
  })

  it('lar ren tekst stå helt urørt', () => {
    const rein = 'Gården strekker seg ned mot Gullholmsundet.\n\nTeglverket'
    expect(stripHtml(rein)).toBe(rein)
  })

  it('rører ikke matematikk som ikke er tagger', () => {
    expect(stripHtml('5 < 10 og 3 > 2')).toBe('5 < 10 og 3 > 2')
  })

  it('håndterer null/tom input', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(undefined)).toBe('')
    expect(stripHtml('')).toBe('')
  })
})

describe('stripHtmlEnLinje — titler', () => {
  it('gjør linjeskift om til mellomrom', () => {
    expect(stripHtmlEnLinje('Gravhaug<br />ved elva')).toBe('Gravhaug ved elva')
    expect(stripHtmlEnLinje('<b>Fangstgrop</b>')).toBe('Fangstgrop')
  })
})

describe('decodeHtmlEntities', () => {
  it('lar ukjente entiteter stå (bedre enn å spise tekst)', () => {
    expect(decodeHtmlEntities('&ukjent; &amp;')).toBe('&ukjent; &')
  })
})

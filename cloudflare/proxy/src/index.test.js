// Proxy-Workerens rene hjelpefunksjoner. De to MET-funksjonene testes fordi de
// står mellom klienten og et API med harde krav: METs koordinat-grense på 4
// desimaler (som etter hvert gir 400 Bad Request), og cache-vinduet som avgjør
// hvor hardt vi poller en gratis, åpen tjeneste. Begge er rene, så de kan testes
// uten workerd — resten av fila trenger runtimen og dekkes av `npm run boot:workers`.
import { describe, it, expect } from 'vitest'
import { metKoordinat, metCacheSekunder, rewriteNextLinks } from './index.js'

describe('metKoordinat', () => {
  it('runder til METs maks på 4 desimaler', () => {
    // Ikke kosmetikk: MET sier rett ut at høyere presisjon ødelegger cachen
    // deres (modellen har ~1 km oppløsning) og at det vil gi 400 senere.
    expect(metKoordinat('59.8312345', 90)).toBe('59.8312')
    expect(metKoordinat(10.4400001, 180)).toBe('10.4400')
  })

  it('godtar tall som streng og som tall', () => {
    expect(metKoordinat('0', 90)).toBe('0.0000')
    expect(metKoordinat(-71.5, 90)).toBe('-71.5000')
  })

  it('avviser søppel framfor å sende det videre til MET', () => {
    // Sender vi tull videre, ser MET en klient uten peiling — og det er vår
    // User-Agent som får skylda.
    expect(metKoordinat(null, 90)).toBeNull()
    expect(metKoordinat('', 90)).toBeNull()
    expect(metKoordinat('nord', 90)).toBeNull()
    expect(metKoordinat(NaN, 90)).toBeNull()
  })

  it('avviser koordinater utenfor kloden', () => {
    expect(metKoordinat(91, 90)).toBeNull()
    expect(metKoordinat(-181, 180)).toBeNull()
    expect(metKoordinat(90, 90)).toBe('90.0000')      // grensa er gyldig
  })
})

describe('metCacheSekunder', () => {
  const naa = Date.parse('2026-08-23T09:00:00Z')

  it('bruker taket når MET ikke sier noe', () => {
    expect(metCacheSekunder(null, naa)).toBe(1800)
    expect(metCacheSekunder('', naa)).toBe(1800)
  })

  it('respekterer et kortere Expires fra MET', () => {
    expect(metCacheSekunder('Sun, 23 Aug 2026 09:10:00 GMT', naa)).toBe(600)
  })

  it('lar ikke MET presse cachen over vårt eget tak', () => {
    // Et Expires langt fram skal ikke få oss til å holde et værvarsel i timer.
    expect(metCacheSekunder('Sun, 23 Aug 2026 15:00:00 GMT', naa)).toBe(1800)
  })

  it('holder et minutt når Expires alt er utløpt', () => {
    // 0 ville betydd «ikke cache», og da ville hvert eneste trykk gått til MET.
    expect(metCacheSekunder('Sun, 23 Aug 2026 08:00:00 GMT', naa)).toBe(60)
  })

  it('faller tilbake til taket på en uleselig dato', () => {
    expect(metCacheSekunder('i går', naa)).toBe(1800)
  })
})

describe('rewriteNextLinks', () => {
  // Fanget aldri av en test før nå, men den er eksportert «for test» og er
  // grunnen til at side 2 av kulturminne-lista i det hele tatt virker.
  it('skriver om absolutte api.ra.no-lenker til Workeren', () => {
    const inn = JSON.stringify({ links: [
      { rel: 'next', href: 'https://api.ra.no/brukerminner/collections/x/items?offset=10' },
    ] })
    const ut = JSON.parse(rewriteNextLinks(inn, 'https://lende-proxy.example.dev'))
    expect(ut.links[0].href)
      .toBe('https://lende-proxy.example.dev/brukerminner/collections/x/items?offset=10')
  })

  it('rører ikke andre lenker', () => {
    const inn = JSON.stringify({ links: [{ rel: 'self', href: 'https://kulturminnesok.no/x' }] })
    expect(JSON.parse(rewriteNextLinks(inn, 'https://p.example.dev')).links[0].href)
      .toBe('https://kulturminnesok.no/x')
  })

  it('sender ikke-JSON videre urørt', () => {
    expect(rewriteNextLinks('<html>nei</html>', 'https://p.example.dev')).toBe('<html>nei</html>')
  })
})

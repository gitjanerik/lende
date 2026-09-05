import { describe, it, expect, beforeEach } from 'vitest'
import { parseHTML } from 'linkedom'
import { tegnBrukerPrikk } from './brukerPrikk.js'

const NS = 'http://www.w3.org/2000/svg'
let doc, layer
const px = (n) => n * 2   // 1 CSS-px = 2 brukerenheter

beforeEach(() => {
  doc = parseHTML('<html><body></body></html>').document
  const svg = doc.createElementNS(NS, 'svg')
  layer = doc.createElementNS(NS, 'g')
  svg.appendChild(layer)
  doc.body.appendChild(svg)
})

describe('tegnBrukerPrikk', () => {
  it('tegner ring før prikk, så prikken ligger øverst', () => {
    tegnBrukerPrikk(layer, { x: 100, y: 200, accuracyM: 30, pxToUserUnits: px })
    const barn = [...layer.children]
    expect(barn).toHaveLength(3)
    expect(barn[0].getAttribute('fill')).toBe('rgba(56, 189, 248, 0.10)')
    // Den mørke ytterkonturen ligger mellom nøyaktighetsringen og prikken, og
    // utenfor prikkens hvite strek — den er kontrast mot lys kartbunn, ikke pynt.
    expect(barn[1].getAttribute('stroke')).toBe('rgba(15, 23, 42, 0.55)')
    expect(Number(barn[1].getAttribute('r'))).toBeGreaterThan(Number(barn[2].getAttribute('r')))
    expect(barn[2].getAttribute('fill')).toBe('#0ea5e9')
    expect(barn[2].getAttribute('cx')).toBe('100')
    expect(barn[2].getAttribute('cy')).toBe('200')
  })

  it('tømmer laget først, så prikken ikke hoper seg opp', () => {
    tegnBrukerPrikk(layer, { x: 1, y: 1, accuracyM: 30, pxToUserUnits: px })
    tegnBrukerPrikk(layer, { x: 2, y: 2, accuracyM: 30, pxToUserUnits: px })
    expect(layer.children).toHaveLength(3)
  })

  it('tømmer laget og tegner ingenting uten posisjon', () => {
    tegnBrukerPrikk(layer, { x: 1, y: 1, accuracyM: 30, pxToUserUnits: px })
    tegnBrukerPrikk(layer, { x: null, y: null, accuracyM: 30, pxToUserUnits: px })
    expect(layer.children).toHaveLength(0)
  })

  // Kjernen i hele funksjonen: dårlig GPS skal ikke språke ringen utover halve
  // skjermen og dømme kart-innholdet.
  it('klamper ringen mellom 12 og 28 CSS-px radius', () => {
    const ringR = (acc) => {
      tegnBrukerPrikk(layer, { x: 0, y: 0, accuracyM: acc, pxToUserUnits: px })
      return Number(layer.children[0].getAttribute('r'))
    }
    expect(ringR(5000)).toBe(px(28))    // taket
    expect(ringR(2)).toBe(px(12))       // gulvet — aldri mindre enn dot+halo
    expect(ringR(40)).toBe(40)          // ekte meter innimellom
  })

  // Gulv og tak er i CSS-piksler, nøyaktigheten i meter — og de sammenliknes
  // direkte fordi 1 SVG-enhet ER 1 bakke-meter i denne appen. Zoomer man ut, er
  // 12 CSS-px flere titalls meter, og en god fix klampes derfor OPP. Det er
  // riktig: ringen er en skjermaffordanse, ikke en måling.
  it('gulvet er en skjermstørrelse, så god GPS klampes opp når man zoomer ut', () => {
    tegnBrukerPrikk(layer, { x: 0, y: 0, accuracyM: 20, pxToUserUnits: px })
    expect(Number(layer.children[0].getAttribute('r'))).toBe(px(12))
  })

  it('bruker 30 m som fallback når nøyaktighet mangler', () => {
    tegnBrukerPrikk(layer, { x: 0, y: 0, accuracyM: null, pxToUserUnits: px })
    expect(Number(layer.children[0].getAttribute('r'))).toBe(30)
  })

  it('skalerer strekbredder med samme omregner som radius', () => {
    tegnBrukerPrikk(layer, { x: 0, y: 0, accuracyM: 30, pxToUserUnits: px })
    expect(Number(layer.children[2].getAttribute('stroke-width'))).toBe(px(1.6))
    expect(Number(layer.children[1].getAttribute('stroke-width'))).toBe(px(1.6) * 0.6)
    expect(Number(layer.children[0].getAttribute('stroke-width'))).toBe(px(0.8))
  })

  it('tåler at laget mangler', () => {
    expect(() => tegnBrukerPrikk(null, { x: 0, y: 0, pxToUserUnits: px })).not.toThrow()
  })
})

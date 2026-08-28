// Himmelkompasset. Alt her er én regel — «markøren står, skiva dreier» — og det
// er ETT som kan være galt uten at noe kaster: dreieretningen. Et ombyttet
// fortegn gir et kompass som peker øst når man ser vest, og i mørket, uten kart i
// bildet, har brukeren ingen måte å oppdage det. Derfor er testene ankret i
// retninger man kan resonnere seg til, og ikke i tall.
import { describe, it, expect } from 'vitest'
import {
  skivePunkt, vinkelPaaSkiva, kompassGeometri, retningsNavn,
  HIMMELRETNINGER, KOMPASS_RADIUS,
} from './himmelKompass.js'

const merke = (g, navn) => g.merker.find((m) => m.navn === navn)

describe('skivePunkt', () => {
  it('0° er øverst, 180° nederst, 90° til høyre', () => {
    // SVG-y peker NEDOVER. Glemmer man fortegnet, står N nederst og hele
    // kompasset er opp-ned uten at noe feiler.
    expect(skivePunkt(0).y).toBeLessThan(0)
    expect(skivePunkt(180).y).toBeGreaterThan(0)
    expect(skivePunkt(90).x).toBeGreaterThan(0)
    expect(skivePunkt(270).x).toBeLessThan(0)
  })

  it('er en ELLIPSE og ikke en sirkel — skiva ses på skrå', () => {
    // «Jordas plan sett på skrå» var bestillingen. Blir hellingen 90°, er den en
    // sirkel og illusjonen av et plan er borte.
    const bredde = Math.abs(skivePunkt(90).x)
    const hoyde = Math.abs(skivePunkt(0).y)
    expect(hoyde).toBeLessThan(bredde * 0.95)
    expect(hoyde).toBeGreaterThan(bredde * 0.3)
  })

  it('den nære halvparten er den nederste', () => {
    expect(skivePunkt(180).naer).toBe(true)
    expect(skivePunkt(0).naer).toBe(false)
  })
})

describe('vinkelPaaSkiva', () => {
  it('ser du nord, står nord under markøren', () => {
    expect(vinkelPaaSkiva(0, 0)).toBe(0)
  })

  it('ser du øst, står nord til VENSTRE', () => {
    // Snur du deg mot øst, kommer nord på venstre hånd. Dette er retningen hele
    // kompasset står og faller på.
    expect(vinkelPaaSkiva(0, 90)).toBe(270)
  })

  it('ser du nord, står øst til HØYRE', () => {
    expect(vinkelPaaSkiva(90, 0)).toBe(90)
  })

  it('normaliserer til [0, 360) uansett hva som kommer inn', () => {
    for (const [a, b] of [[0, 720], [0, -90], [359, 1], [-45, 0]]) {
      const v = vinkelPaaSkiva(a, b)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(360)
    }
  })
})

describe('kompassGeometri', () => {
  it('ser du nord, ligger N øverst og S nederst', () => {
    const g = kompassGeometri({ azimut: 0, hoyde: 40 })
    expect(merke(g, 'N').y).toBeLessThan(merke(g, 'S').y)
    expect(merke(g, 'Ø').x).toBeGreaterThan(merke(g, 'V').x)
  })

  it('ser du øst, har skiva dreid: N til venstre, Ø øverst', () => {
    // Selve dreiningen. Uten den ville kompasset sett likt ut uansett hvor man
    // ser — og det er nettopp den feilen som er umulig å se på et stillbilde.
    const g = kompassGeometri({ azimut: 90, hoyde: 40 })
    expect(merke(g, 'N').x).toBeLessThan(0)
    expect(merke(g, 'Ø').y).toBeLessThan(merke(g, 'V').y)
  })

  it('snur du deg halvt rundt, bytter N og S plass', () => {
    const nord = kompassGeometri({ azimut: 0, hoyde: 40 })
    const sor = kompassGeometri({ azimut: 180, hoyde: 40 })
    expect(merke(nord, 'N').y).toBeCloseTo(merke(sor, 'S').y, 6)
    expect(merke(sor, 'N').y).toBeCloseTo(merke(nord, 'S').y, 6)
  })

  it('markøren står ALDRI et annet sted', () => {
    // Den er blikkretningen, og den er fast. Beveget den seg også, ville
    // kompasset vært to bevegelser man må skille fra hverandre.
    const a = kompassGeometri({ azimut: 0, hoyde: 0 })
    for (const az of [37, 90, 210, 359]) {
      const b = kompassGeometri({ azimut: az, hoyde: 50 })
      expect(b.markor.x).toBeCloseTo(a.markor.x, 9)
      expect(b.markor.y).toBeCloseTo(a.markor.y, 9)
    }
    expect(a.markor.y).toBeLessThan(0)   // øverst
  })

  it('alle fire retningene er med, og nord er merket', () => {
    const g = kompassGeometri({ azimut: 0, hoyde: 0 })
    expect(g.merker.map((m) => m.navn).sort()).toEqual(['N', 'S', 'V', 'Ø'])
    expect(g.merker.filter((m) => m.erNord)).toHaveLength(1)
    expect(merke(g, 'N').erNord).toBe(true)
    // NORSKE bokstaver: Ø og V, ikke E og W. UI-språket er bokmål.
    expect(HIMMELRETNINGER.map((r) => r.navn)).toContain('Ø')
    expect(HIMMELRETNINGER.map((r) => r.navn)).toContain('V')
  })

  it('serNord er sann bare når man faktisk ser nordover', () => {
    // Knappen slutter å love en bevegelse den ikke gir: står man alt i nord, er
    // det ingenting å vende.
    expect(kompassGeometri({ azimut: 0, hoyde: 0 }).serNord).toBe(true)
    expect(kompassGeometri({ azimut: 5, hoyde: 0 }).serNord).toBe(true)
    expect(kompassGeometri({ azimut: 356, hoyde: 0 }).serNord).toBe(true)
    expect(kompassGeometri({ azimut: 40, hoyde: 0 }).serNord).toBe(false)
    expect(kompassGeometri({ azimut: 180, hoyde: 0 }).serNord).toBe(false)
  })

  it('ringen er en lukket path med noe utstrekning i begge akser', () => {
    const { ring } = kompassGeometri({ azimut: 0, hoyde: 0 })
    expect(ring.endsWith('Z')).toBe(true)
    const tall = ring.match(/-?\d+\.\d+/g).map(Number)
    const xs = tall.filter((_, i) => i % 2 === 0)
    const ys = tall.filter((_, i) => i % 2 === 1)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2 * KOMPASS_RADIUS, 0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(KOMPASS_RADIUS * 0.5)
  })

  it('tåler tomt blikk uten å kaste', () => {
    // Kompasset tegnes før første blikk-event rekker fram.
    expect(() => kompassGeometri(null)).not.toThrow()
    expect(() => kompassGeometri({})).not.toThrow()
    expect(kompassGeometri(null).merker).toHaveLength(4)
  })
})

describe('retningsNavn', () => {
  it('gir norsk himmelretning i åtte deler', () => {
    expect(retningsNavn(0)).toBe('nord')
    expect(retningsNavn(90)).toBe('øst')
    expect(retningsNavn(180)).toBe('sør')
    expect(retningsNavn(270)).toBe('vest')
    expect(retningsNavn(45)).toBe('nordøst')
    // Runder til nærmeste, og tåler tall utenfor [0, 360).
    expect(retningsNavn(359)).toBe('nord')
    expect(retningsNavn(-90)).toBe('vest')
    expect(retningsNavn(720)).toBe('nord')
  })
})

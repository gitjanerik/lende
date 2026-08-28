// Himmelkompasset. Alt her er projeksjon, og det er ETT som kan være galt uten
// at noe kaster: retningene. Et ombyttet fortegn gir et kompass som peker sør
// når man ser nord — og i mørket, uten kart i bildet, har brukeren ingen måte å
// oppdage det. Derfor er testene ankret i retninger og ikke i tall.
import { describe, it, expect } from 'vitest'
import {
  retning, kompassBasis, projiser, kompassGeometri,
  KOMPASS_KAMERA, KOMPASS_RADIUS,
} from './himmelKompass.js'

describe('retning', () => {
  it('nord, øst, sør og vest ligger der de skal', () => {
    const [ø, n, o] = retning(0, 0)
    expect(n).toBeCloseTo(1, 9); expect(ø).toBeCloseTo(0, 9); expect(o).toBeCloseTo(0, 9)
    expect(retning(90, 0)[0]).toBeCloseTo(1, 9)     // øst = +x
    expect(retning(180, 0)[1]).toBeCloseTo(-1, 9)   // sør = −y
    expect(retning(270, 0)[0]).toBeCloseTo(-1, 9)   // vest = −x
  })

  it('zenit er rett opp, uansett himmelretning', () => {
    for (const a of [0, 90, 200, 350]) {
      expect(retning(a, 90)[2]).toBeCloseTo(1, 9)
    }
  })

  it('er en enhetsvektor', () => {
    for (const [a, h] of [[0, 0], [37, 12], [200, 75], [310, -20]]) {
      expect(Math.hypot(...retning(a, h))).toBeCloseTo(1, 9)
    }
  })
})

describe('kompassBasis', () => {
  it('står kameraet i sør og ser nordover, er høyre øst', () => {
    // Det konkrete tilfellet kryssproduktets fortegn kan sjekkes mot. Bommer
    // det, er hele kompasset speilvendt — og et speilvendt kompass er verre enn
    // ingen, for det ser like riktig ut.
    const b = kompassBasis({ azimut: 180, hoyde: 0 })
    expect(b.f[1]).toBeCloseTo(1, 9)        // ser mot nord
    expect(b.hoyre[0]).toBeCloseTo(1, 9)    // høyre er øst
    expect(b.opp[2]).toBeCloseTo(1, 9)      // opp er opp
  })

  it('basisen er ortonormal for gizmo-kameraet vi faktisk bruker', () => {
    const { f, hoyre, opp } = kompassBasis()
    for (const v of [f, hoyre, opp]) expect(Math.hypot(...v)).toBeCloseTo(1, 9)
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    expect(dot(f, hoyre)).toBeCloseTo(0, 9)
    expect(dot(f, opp)).toBeCloseTo(0, 9)
    expect(dot(hoyre, opp)).toBeCloseTo(0, 9)
  })
})

describe('projiser', () => {
  it('SVG-y peker NEDOVER, så zenit får negativ y', () => {
    // Den ene fella som ikke er matematikk men SVG: glemmer man fortegnet, ser
    // man opp og prikken går ned.
    const p = projiser(retning(0, 90))
    expect(p.y).toBeLessThan(0)
  })

  it('sier fra når punktet ligger på baksida av kula', () => {
    const b = kompassBasis()
    // Kameraet står i azimut 158°, så retningen DIT er mot kameraet (forside),
    // og motsatt retning er bak.
    expect(projiser(retning(KOMPASS_KAMERA.azimut, KOMPASS_KAMERA.hoyde), b).bak).toBe(false)
    expect(projiser(retning(KOMPASS_KAMERA.azimut + 180, -KOMPASS_KAMERA.hoyde), b).bak).toBe(true)
  })
})

describe('kompassGeometri', () => {
  it('N står over S på skjermen', () => {
    // Gizmo-kameraet ser fra sørøst-ish, så nord er den fjerne sida — og fjern
    // er OPP når kameraet står over planet. Snus dette, står bokstavene feil vei
    // og kompasset lyver.
    const { merker } = kompassGeometri({ azimut: 0, hoyde: 0 })
    const N = merker.find((m) => m.navn === 'N')
    const S = merker.find((m) => m.navn === 'S')
    expect(N.y).toBeLessThan(S.y)
  })

  it('begge ringene er ellipser og ikke streker', () => {
    // Står gizmo-kameraet i nord–sør-planet, blir meridianringen edge-on: en
    // strek. Azimuten er derfor 22° på skeive med vilje, og DET er det denne
    // testen holder fast — den feiler om noen «retter» den til 180°.
    const { horisont, meridian } = kompassGeometri({ azimut: 0, hoyde: 0 })
    for (const [navn, d] of [['horisont', horisont], ['meridian', meridian]]) {
      const tall = d.match(/-?\d+\.\d+/g).map(Number)
      const xs = tall.filter((_, i) => i % 2 === 0)
      const ys = tall.filter((_, i) => i % 2 === 1)
      const bredde = Math.max(...xs) - Math.min(...xs)
      const hoyde = Math.max(...ys) - Math.min(...ys)
      // Den smaleste aksen må være en merkbar brøk av den bredeste.
      expect(Math.min(bredde, hoyde) / Math.max(bredde, hoyde)).toBeGreaterThan(0.15)
      expect(Math.max(bredde, hoyde)).toBeGreaterThan(radiusOmtrent() * 1.5, navn)
    }
  })

  it('prikken følger blikket rundt kompasset', () => {
    // Ser man nord, skal prikken ligge på nordsida; ser man sør, på sørsida.
    // Sammenlikner mot bokstavene, som er den samme retningen — da fanges også
    // en feil som flytter BEGGE like mye.
    const nord = kompassGeometri({ azimut: 0, hoyde: 10 })
    const sor = kompassGeometri({ azimut: 180, hoyde: 10 })
    expect(nord.prikk.y).toBeLessThan(sor.prikk.y)
    const ost = kompassGeometri({ azimut: 90, hoyde: 10 })
    const vest = kompassGeometri({ azimut: 270, hoyde: 10 })
    expect(ost.prikk.x).toBeGreaterThan(vest.prikk.x)
  })

  it('prikken stiger når blikket løftes', () => {
    // Nattmodus løfter blikket til 50°; da må prikken flytte seg oppover, ellers
    // ser kompasset likt ut i det ene bildet man garantert er i.
    const lavt = kompassGeometri({ azimut: 0, hoyde: 0 })
    const hoyt = kompassGeometri({ azimut: 0, hoyde: 50 })
    expect(hoyt.prikk.y).toBeLessThan(lavt.prikk.y)
  })

  it('øst–vest-aksen går tvers over skiva', () => {
    const { ostVest } = kompassGeometri({ azimut: 0, hoyde: 0 })
    expect(ostVest.x1).toBeGreaterThan(0)     // øst til høyre
    expect(ostVest.x2).toBeLessThan(0)        // vest til venstre
    // Aksen er FORKORTET av projeksjonen — den står ikke normalt på
    // blikkretningen — så den er kortere enn 2r. Men den skal fortsatt spenne
    // det meste av skiva: blir den kort, står gizmo-kameraet nesten rett over
    // øst, og da er det horisontringen som er blitt en strek.
    const l = Math.hypot(ostVest.x2 - ostVest.x1, ostVest.y2 - ostVest.y1)
    expect(l).toBeLessThanOrEqual(2 * radiusOmtrent() + 1e-6)
    expect(l).toBeGreaterThan(1.5 * radiusOmtrent())
  })

  it('tåler tomt blikk uten å kaste', () => {
    // Kompasset tegnes før første blikk-event rekker fram.
    expect(() => kompassGeometri(null)).not.toThrow()
    expect(() => kompassGeometri({})).not.toThrow()
  })
})

function radiusOmtrent() { return KOMPASS_RADIUS }

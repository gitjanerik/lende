// Soloppgang og solnedgang. Testene er ankret i to helt ulike ting, og det er
// med vilje: ETT eksternt fasit-punkt fra Yr, og resten som INVARIANTER som
// holder uansett sted og dato. Et enkelt anker kan treffe ved flaks; en
// invariant som holder over hele året og fra ekvator til Svalbard kan ikke.
import { describe, it, expect } from 'vitest'
import { solTider, SOL_HOYDE_SOLNEDGANG, solEkvatorial, lokalStjernetid, tilHorisont } from './astronomi.js'

// Sola sin høyde på et gitt tidspunkt — den samme veien solTider går, brukt
// baklengs for å sjekke at tidene den gir FAKTISK er kryssingene.
const hoydeVed = (lat, lon, d) => {
  const s = solEkvatorial(d)
  return tilHorisont(s.ra, s.dek, lokalStjernetid(d, lon), lat).hoyde
}
const GRAD = 180 / Math.PI
const klokke = (d, tz) => d.toLocaleTimeString('nb-NO', {
  hour: '2-digit', minute: '2-digit', timeZone: tz,
})

const DRAMMEN = { lat: 59.744, lon: 10.205 }
const TROMSO = { lat: 69.65, lon: 18.96 }
const OSLO = { lat: 59.91, lon: 10.75 }

describe('solTider — mot Yr', () => {
  it('treffer Yrs tider for Drammen 30. august 2026', () => {
    // FASIT FRA YR (MET Norway), avlest av eieren: opp 06:10, ned 20:28.
    // Ett minutt slingring: Yr svarer for ETT punkt, vi regner for arkets
    // midtpunkt, og et par hundre meter flytter oppgangen et minutt. Ankeret er
    // her fordi en egenskrevet himmelmekanikk kan være helt internt konsistent
    // og likevel peke feil vei — samme grunn som at planet-testene bærer
    // referansepunkter fra astronomy-engine.
    const r = solTider({ ...DRAMMEN, dato: new Date('2026-08-30T12:00:00+02:00') })
    expect(r.tilstand).toBe('normal')
    expect(klokke(r.oppgang, 'Europe/Oslo')).toMatch(/^06:(09|10|11)$/)
    expect(klokke(r.nedgang, 'Europe/Oslo')).toMatch(/^20:(27|28|29)$/)
  })
})

describe('solTider — invariantene', () => {
  it('tidene ER kryssingene: sola står i horisont-høyden akkurat da', () => {
    // Den sterkeste testen som ikke trenger en ekstern kilde. Bommer søket, er
    // høyden på det oppgitte tidspunktet noe annet enn terskelen.
    for (const iso of ['2026-01-15', '2026-03-20', '2026-06-21', '2026-09-23', '2026-12-01']) {
      const r = solTider({ ...OSLO, dato: new Date(`${iso}T12:00:00Z`) })
      for (const t of [r.oppgang, r.nedgang]) {
        if (!t) continue
        expect(Math.abs(hoydeVed(OSLO.lat, OSLO.lon, t) - SOL_HOYDE_SOLNEDGANG) * GRAD)
          .toBeLessThan(0.02)
      }
    }
  })

  it('sola er nede før oppgang og oppe etter — og motsatt ved nedgang', () => {
    const r = solTider({ ...OSLO, dato: new Date('2026-04-10T12:00:00Z') })
    const min = 60 * 1000
    expect(hoydeVed(OSLO.lat, OSLO.lon, new Date(+r.oppgang - 5 * min)))
      .toBeLessThan(SOL_HOYDE_SOLNEDGANG)
    expect(hoydeVed(OSLO.lat, OSLO.lon, new Date(+r.oppgang + 5 * min)))
      .toBeGreaterThan(SOL_HOYDE_SOLNEDGANG)
    expect(hoydeVed(OSLO.lat, OSLO.lon, new Date(+r.nedgang - 5 * min)))
      .toBeGreaterThan(SOL_HOYDE_SOLNEDGANG)
    expect(hoydeVed(OSLO.lat, OSLO.lon, new Date(+r.nedgang + 5 * min)))
      .toBeLessThan(SOL_HOYDE_SOLNEDGANG)
  })

  it('dagen er lengst ved sommersolverv og kortest ved vintersolverv', () => {
    const dag = (iso) => {
      const r = solTider({ ...OSLO, dato: new Date(iso) })
      return (+r.nedgang - +r.oppgang) / 3600000
    }
    const sommer = dag('2026-06-21T12:00:00Z')
    const vinter = dag('2026-12-21T12:00:00Z')
    expect(sommer).toBeGreaterThan(18)   // Oslo har ~18,5 t ved solverv
    expect(vinter).toBeLessThan(6.5)     // og ~6 t ved vintersolverv
    expect(dag('2026-03-20T12:00:00Z')).toBeGreaterThan(12)  // jevndøgn, litt over
    expect(dag('2026-03-20T12:00:00Z')).toBeLessThan(12.5)
  })
})

describe('solTider — polardøgnet', () => {
  it('Tromsø har midnattssol i juni og mørketid i desember', () => {
    // POLARDØGNET FALLER UT AV METODEN og er ikke et spesialtilfelle: finnes
    // ingen kryssing, er sola enten oppe eller nede hele døgnet, og høyden ved
    // midnatt sier hvilken. En lukket formel ville gitt NaN her.
    expect(solTider({ ...TROMSO, dato: new Date('2026-06-21T12:00:00Z') }))
      .toMatchObject({ tilstand: 'midnattssol', oppgang: null, nedgang: null })
    expect(solTider({ ...TROMSO, dato: new Date('2026-12-21T12:00:00Z') }))
      .toMatchObject({ tilstand: 'morketid', oppgang: null, nedgang: null })
  })

  it('sør for polarsirkelen er det aldri polardøgn', () => {
    for (let m = 0; m < 12; m++) {
      const r = solTider({ ...OSLO, dato: new Date(Date.UTC(2026, m, 15, 12)) })
      expect(r.tilstand, `måned ${m + 1}`).toBe('normal')
      expect(r.oppgang).toBeTruthy()
      expect(r.nedgang).toBeTruthy()
    }
  })

  it('Tromsø har ett polardøgn-år som stemmer med virkeligheten', () => {
    // EKSTERNT ANKER NUMMER TO. Midnattssola i Tromsø varer i underkant av ti
    // uker og mørketida i overkant av sju — tallene varierer et par dager mellom
    // kilder, fordi de avhenger av nøyaktig breddegrad og av hvilken
    // horisont-definisjon som brukes. Derfor romslige grenser: testen skal fange
    // at noe er GALT, ikke låse et tall vi ikke kan begrunne på dagen.
    let midnattssol = 0
    let morketid = 0
    let bareEtt = 0
    for (let d = 0; d < 365; d++) {
      const r = solTider({ ...TROMSO, dato: new Date(Date.UTC(2026, 0, 1 + d, 12)) })
      if (r.tilstand === 'midnattssol') midnattssol++
      else if (r.tilstand === 'morketid') morketid++
      else if (!r.oppgang || !r.nedgang) bareEtt++
    }
    expect(midnattssol).toBeGreaterThan(60)
    expect(midnattssol).toBeLessThan(75)
    expect(morketid).toBeGreaterThan(42)
    expect(morketid).toBeLessThan(56)
    // OVERGANGSDØGNET: der midnattssola begynner eller slutter finnes bare den
    // ene kryssingen i døgnet. «normal» med ett tidspunkt er riktigere enn å
    // kalle det polardøgn, og kortet viser da bare det som finnes.
    //
    // HVILKEN dato det treffer avhenger av TIDSSONEN, siden døgnvinduet er det
    // lokale — testen teller derfor bare at det finnes, og pinner ikke datoen.
    // Første utgave gjorde nettopp det og var grønn i Oslo, rød i CI.
    expect(bareEtt).toBeGreaterThan(0)
  })
})

describe('solTider — tåler dårlige inndata', () => {
  it('gir null for et ubrukelig sted', () => {
    expect(solTider({ lat: NaN, lon: 10 })).toBeNull()
    expect(solTider({})).toBeNull()
    expect(solTider()).toBeNull()
  })
})

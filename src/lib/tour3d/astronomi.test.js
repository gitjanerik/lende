import { describe, it, expect } from 'vitest'
import { julianskDag, gmst, lokalStjernetid, solEkvatorial, maneEkvatorial, maneFase,
  tilHorisont, parallaktiskVinkel, horisontTilWorld, himmelFor, norm360,
  presesserTilDato, erNatt, SOL_HOYDE_SOLNEDGANG, MANE_TVANG_HOYDE } from './astronomi.js'
import { STJERNER } from './stjerner.js'

const GRAD = 180 / Math.PI
const utc = (s) => new Date(s)
const stjerne = (navn) => STJERNER.find((s) => s.navn === navn)

// Ankrene under er Meeus' egne gjennomregnede eksempler fra «Astronomical
// Algorithms». De er poenget med denne testfila: en egenskrevet
// astronomi-modul kan være internt konsistent og likevel peke feil vei, og da
// ser himmelen helt riktig ut til noen kjenner igjen Karlsvogna. Eksemplene er
// eksterne tall vi ikke selv har produsert.
//
// Datoene er Meeus' TD (dynamisk tid); vi regner i UTC og hopper over ΔT, som i
// 1992 var ~59 s. Det flytter månen ~0,5 bueminutt — derfor toleransene her, og
// ikke fordi formlene er upresise.
describe('astronomi — mot Meeus’ gjennomregnede eksempler', () => {
  it('sola: eksempel 25.a, 1992 oktober 13', () => {
    const s = solEkvatorial(utc('1992-10-13T00:00:00Z'))
    expect(s.lambda).toBeCloseTo(199.90895, 3)   // tilsynelatende lengde
    expect(s.dek).toBeCloseTo(-7.78528, 3)
    expect(s.ra * 15).toBeCloseTo(198.38083, 2)  // 13h13m31,4s
  })

  it('månen: eksempel 47.a, 1992 april 12', () => {
    const m = maneEkvatorial(utc('1992-04-12T00:00:00Z'))
    expect(m.lambda).toBeCloseTo(133.16265, 1)
    expect(m.beta).toBeCloseTo(-3.22913, 2)
    // Avstanden er den avkortede seriens svakeste punkt: 30 ledd av 60 gir
    // titalls kilometer. Det er 0,005 % av avstanden og usynlig i en skive.
    expect(m.avstandKm).toBeCloseTo(368409.7, -2)
  })

  it('fasen: eksempel 48.a — belyst andel og lyssidens retning', () => {
    const f = maneFase(utc('1992-04-12T00:00:00Z'))
    expect(f.lysAndel).toBeCloseTo(0.6786, 3)
    // Posisjonsvinkelen til den lyse randen, målt fra himmelens nordpol mot øst.
    expect(norm360(f.lyssideVinkel * GRAD)).toBeCloseTo(285.0, 0)
    expect(f.voksende).toBe(true)
  })
})

describe('astronomi — sola gjennom året', () => {
  // Deklinasjonen er årstiden. Bommer den, står himmelen feil på en måte ingen
  // annen test fanger.
  it('står i ekvator ved jevndøgn og i vendekretsene ved solverv', () => {
    expect(solEkvatorial(utc('2026-03-20T12:00:00Z')).dek).toBeCloseTo(0, 0)
    expect(solEkvatorial(utc('2026-09-23T12:00:00Z')).dek).toBeCloseTo(0, 0)
    expect(solEkvatorial(utc('2026-06-21T12:00:00Z')).dek).toBeCloseTo(23.44, 1)
    expect(solEkvatorial(utc('2026-12-21T12:00:00Z')).dek).toBeCloseTo(-23.44, 1)
  })

  it('avstanden svinger mellom perihel og aphel', () => {
    const AE = 149597870.7
    const jan = solEkvatorial(utc('2026-01-03T00:00:00Z')).avstandKm / AE
    const jul = solEkvatorial(utc('2026-07-05T00:00:00Z')).avstandKm / AE
    expect(jan).toBeLessThan(0.9835)
    expect(jul).toBeGreaterThan(1.0165)
  })
})

describe('astronomi — månen holder seg innenfor banen sin', () => {
  it('avstanden ligger mellom perigeum og apogeum', () => {
    for (let d = 0; d < 400; d += 3) {
      const km = maneEkvatorial(new Date(Date.UTC(2026, 0, 1 + d))).avstandKm
      expect(km).toBeGreaterThan(355000)
      expect(km).toBeLessThan(407000)
    }
  })

  it('den ekliptiske breddegraden holder seg innenfor baneskråningen', () => {
    for (let d = 0; d < 400; d += 3) {
      const beta = maneEkvatorial(new Date(Date.UTC(2026, 0, 1 + d))).beta
      expect(Math.abs(beta)).toBeLessThan(5.4)
    }
  })

  it('middelbevegelsen er sideriske 13,176° i døgnet', () => {
    // Over 2 000 døgn er de periodiske leddene (±6,9°) vasket ut; over hundre
    // døgn er de IKKE det, og en test der ville krevd en toleranse som ikke
    // fanger noe.
    let forrige = maneEkvatorial(new Date(Date.UTC(2026, 0, 1))).lambda
    let sum = 0
    for (let d = 1; d <= 2000; d++) {
      const na = maneEkvatorial(new Date(Date.UTC(2026, 0, 1 + d))).lambda
      let steg = na - forrige
      if (steg < 0) steg += 360
      sum += steg
      forrige = na
    }
    expect(sum / 2000).toBeCloseTo(13.1764, 2)
  })

  it('fasen gjentar seg etter en synodisk måned', () => {
    const t0 = utc('2026-04-01T00:00:00Z')
    const t1 = new Date(t0.getTime() + 29.530589 * 86400000)
    expect(maneFase(t1).lysAndel).toBeCloseTo(maneFase(t0).lysAndel, 2)
  })

  it('er full når den står motsatt sola, og ny når den står sammen med den', () => {
    // Vi leter oss fram til ytterpunktene framfor å stole på en dato: det er
    // sammenhengen mellom elongasjon og lys vi vil vise, ikke en almanakk.
    let full = null
    let ny = null
    for (let t = 0; t < 40 * 24; t++) {
      const dato = new Date(Date.UTC(2026, 3, 1) + t * 3600000)
      const dLambda = norm360(maneEkvatorial(dato).lambda - solEkvatorial(dato).lambda)
      if (Math.abs(dLambda - 180) < 0.3) full = dato
      if (Math.min(dLambda, 360 - dLambda) < 0.3) ny = dato
    }
    expect(full).not.toBeNull()
    expect(ny).not.toBeNull()
    // Ikke 1,000 og 0,000: månebanen ligger inntil 5,3° utenfor ekliptikken, så
    // ved 180° i LENGDE er den sanne elongasjonen fortsatt noen grader unna —
    // det er derfor de fleste fullmåner ikke er måneformørkelser.
    expect(maneFase(full).lysAndel).toBeGreaterThan(0.99)
    expect(maneFase(ny).lysAndel).toBeLessThan(0.01)
  })
})

describe('astronomi — horisont og orientering', () => {
  // Polstjerna er den ene stjerna hvor svaret er kjent uten en almanakk: den
  // står i nord, i en høyde lik breddegraden. Ett tall som fanger katalogen,
  // stjernetida OG horisont-transformen samtidig.
  it('polstjerna står i nord, i høyde lik breddegraden', () => {
    const polaris = stjerne('Polaris')
    expect(polaris).toBeDefined()
    for (const lat of [58, 61, 69.7]) {
      for (const time of [0, 6, 13, 21]) {
        const dato = new Date(Date.UTC(2026, 5, 14, time))
        const lst = lokalStjernetid(dato, 8.5)
        const { azimut, hoyde } = tilHorisont(polaris.ra, polaris.dek, lst, lat)
        // Polstjerna står 0,74° fra polen og går en liten sirkel rundt den, så
        // både høyden og azimuten svinger med den avstanden gjennom døgnet.
        // Toleransene her ER den sirkelen, ikke slark i formlene.
        expect(Math.abs(hoyde * GRAD - lat)).toBeLessThan(0.75)
        const fraNord = Math.min(azimut, 2 * Math.PI - azimut) * GRAD
        expect(fraNord).toBeLessThan(2)
      }
    }
  })

  it('en stjerne i sør står i azimut 180°, en i øst i 90°', () => {
    const lst = 120
    // Deklinasjon under breddegraden, i meridianen ⇒ rett sør.
    const sor = tilHorisont(lst / 15, 20, lst, 60)
    expect(sor.azimut * GRAD).toBeCloseTo(180, 0)
    // Timevinkelen er lst − ra, så en stjerne ØST for meridianen (som ennå
    // ikke har krysset den) har NEGATIV timevinkel — altså høyere ra enn
    // stjernetida. Snur man det, får man vest, og en himmel speilvendt om
    // øst–vest er nettopp feilen denne testen finnes for.
    const ost = tilHorisont((lst + 90) / 15, 0, lst, 60)
    expect(ost.azimut * GRAD).toBeCloseTo(90, 0)
    expect(ost.hoyde).toBeCloseTo(0, 2)
    const vest = tilHorisont((lst - 90) / 15, 0, lst, 60)
    expect(vest.azimut * GRAD).toBeCloseTo(270, 0)
  })

  it('himmelens sørpol er aldri over horisonten i Norge', () => {
    const lst = 200
    expect(tilHorisont(6, -89, lst, 61).hoyde).toBeLessThan(0)
  })

  it('den parallaktiske vinkelen er null i meridianen', () => {
    const lst = 100
    expect(parallaktiskVinkel(lst / 15, 10, lst, 60)).toBeCloseTo(0, 6)
    // Øst for meridianen dreies nordpolen én vei, vest for den andre.
    expect(parallaktiskVinkel((lst - 30) / 15, 10, lst, 60)).toBeGreaterThan(0)
    expect(parallaktiskVinkel((lst + 30) / 15, 10, lst, 60)).toBeLessThan(0)
  })

  // Scenen har nord = −Z og øst = +X. En himmel speilvendt om nord–sør-aksen
  // ser helt riktig ut helt til noen kjenner igjen et stjernebilde.
  it('world-aksene: nord er −Z, øst er +X, zenit er +Y', () => {
    const R = 1000
    // `|| 0` fordi Math.round(-1e-14) er −0, og −0 er ikke +0 for toEqual.
    const avrund = (v) => v.map((x) => Math.round(x) || 0)
    expect(avrund(horisontTilWorld(0, 0, R))).toEqual([0, 0, -R])
    expect(avrund(horisontTilWorld(Math.PI / 2, 0, R))).toEqual([R, 0, 0])
    expect(avrund(horisontTilWorld(Math.PI, 0, R))).toEqual([0, 0, R])
    expect(avrund(horisontTilWorld(0, Math.PI / 2, R))).toEqual([0, R, 0])
  })
})

describe('himmelFor — ett kall for ett sted og tidspunkt', () => {
  it('gir måne og sol i horisontkoordinater med fase', () => {
    const h = himmelFor({ lat: 61.2, lon: 8.4, dato: utc('2026-08-27T22:00:00Z') })
    expect(h.lat).toBe(61.2)
    expect(h.lst).toBeGreaterThanOrEqual(0)
    expect(h.lst).toBeLessThan(360)
    expect(h.mane.lysAndel).toBeGreaterThanOrEqual(0)
    expect(h.mane.lysAndel).toBeLessThanOrEqual(1)
    expect(Math.abs(h.mane.hoyde)).toBeLessThanOrEqual(Math.PI / 2)
    expect(Number.isFinite(h.mane.lyssideVinkel)).toBe(true)
    expect(Number.isFinite(h.sol.hoyde)).toBe(true)
  })

  it('sola står lavt ved midnatt og høyt ved middag', () => {
    const sted = { lat: 60, lon: 10 }
    // 10°E ⇒ sann middag rundt 11:20 UTC.
    const midt = himmelFor({ ...sted, dato: utc('2026-06-21T11:20:00Z') })
    const natt = himmelFor({ ...sted, dato: utc('2026-06-21T23:20:00Z') })
    expect(midt.sol.hoyde * GRAD).toBeGreaterThan(50)
    expect(natt.sol.hoyde * GRAD).toBeLessThan(0)
  })

  it('julianskDag og gmst er forankret i J2000', () => {
    expect(julianskDag(utc('2000-01-01T12:00:00Z'))).toBeCloseTo(2451545, 6)
    // GMST ved J2000.0 er 280,46°.
    expect(gmst(utc('2000-01-01T12:00:00Z'))).toBeCloseTo(280.46, 1)
  })
})

describe('presesjon J2000 → dato', () => {
  const vinkel = (a1, d1, a2, d2) => {
    const R = Math.PI / 180
    const c = Math.sin(d1 * R) * Math.sin(d2 * R)
      + Math.cos(d1 * R) * Math.cos(d2 * R) * Math.cos((a1 - a2) * 15 * R)
    return Math.acos(Math.max(-1, Math.min(1, c))) / R * 60   // bueminutter
  }

  it('gjør ingenting ved J2000 selv', () => {
    const p = presesserTilDato(6.75, -16.72, utc('2000-01-01T12:00:00Z'))
    expect(p.ra).toBe(6.75)
    expect(p.dek).toBe(-16.72)
  })

  it('flytter en stjerne ~50 buesekund i året langs ekliptikken', () => {
    // Presesjonens hastighet er 50,29″/år i lengde. En stjerne PÅ ekliptikken
    // flytter seg altså ~50″ i året; det er det tallet som gjør at katalogen
    // ikke kan brukes rått i 2026.
    const s = { ra: 6.0, dek: 23.44 }   // sommersolverv-punktet, på ekliptikken
    const p10 = presesserTilDato(s.ra, s.dek, utc('2010-01-01T00:00:00Z'))
    const p20 = presesserTilDato(s.ra, s.dek, utc('2020-01-01T00:00:00Z'))
    const d10 = vinkel(s.ra, s.dek, p10.ra, p10.dek)
    const d20 = vinkel(s.ra, s.dek, p20.ra, p20.dek)
    expect(d10 / 10).toBeCloseTo(50.3 / 60, 1)
    // Og den vokser lineært: dobbelt så lang tid, dobbelt så langt.
    expect(d20 / d10).toBeCloseTo(2, 1)
  })

  it('flytter Polstjerna så mye rotasjonen om ekliptikkpolen krever', () => {
    // Polstjerna er den harde prøven: den ligger nær himmelpolen, der den enkle
    // tilnærmingsformelen (Δα = m + n·sinα·tanδ) sprenger fordi tanδ → ∞. Den
    // rigorøse formen tåler det.
    //
    // Ankeret er GEOMETRIEN og ikke et husket tall: presesjon er en rotasjon om
    // EKLIPTIKKENS pol med 50,29″ i året, så en stjerne flytter seg
    //     rate × sin(vinkelavstand fra ekliptikkpolen).
    // Polstjerna står 23,44° fra den (den er nesten i himmelpolen), altså
    // 1,397° × sin 23,44° ≈ 33,4′ over hundre år. Går koden 28′ eller 40′, er
    // det ikke presesjon den regner.
    const p = STJERNER.find((s) => s.navn === 'Polaris')
    const dato = utc('2100-01-01T00:00:00Z')
    const f = presesserTilDato(p.ra, p.dek, dato)
    const R = Math.PI / 180
    const eps = 23.4393 * R
    // Vinkelavstand Polstjerna → ekliptikkens nordpol (ra 18h, dek 90−ε).
    const polRa = 18, polDek = 90 - 23.4393
    const cosD = Math.sin(p.dek * R) * Math.sin(polDek * R)
      + Math.cos(p.dek * R) * Math.cos(polDek * R) * Math.cos((p.ra - polRa) * 15 * R)
    const fraEkliptikkpol = Math.acos(Math.max(-1, Math.min(1, cosD)))
    const ventet = (50.2879 * 100 / 60) * Math.sin(fraEkliptikkpol)   // bueminutter
    expect(vinkel(p.ra, p.dek, f.ra, f.dek)).toBeCloseTo(ventet, 0)
    expect(eps).toBeGreaterThan(0)
    // Og den er på vei MOT polen — det er den kjente historien om Polaris:
    // nærmest rundt år 2100, deretter bort igjen.
    expect(f.dek).toBeGreaterThan(p.dek)
    expect(f.dek).toBeLessThan(90)
  })

  it('holder ekliptikkens pol nesten i ro', () => {
    // Presesjonen er en rotasjon OM ekliptikkens pol, så et punkt der flytter
    // seg minst. Den asymmetrien er selve signaturen på at aksen er riktig.
    const polRa = 18
    const polDek = 90 - 23.44
    const p = presesserTilDato(polRa, polDek, utc('2050-01-01T00:00:00Z'))
    const flyttetPol = vinkel(polRa, polDek, p.ra, p.dek)
    const ekvator = presesserTilDato(0, 0, utc('2050-01-01T00:00:00Z'))
    const flyttetEkvator = vinkel(0, 0, ekvator.ra, ekvator.dek)
    expect(flyttetPol).toBeLessThan(flyttetEkvator / 5)
  })

  it('bevarer vinkelen mellom to stjerner', () => {
    // Presesjon er en ren rotasjon av koordinatsystemet: himmelen skal ikke
    // deformeres. Karlsvogna må ha samme form i 2026 som i 2000, ellers er det
    // ikke presesjon vi har implementert.
    const a = STJERNER.find((s) => s.navn === 'Dubhe')
    const b = STJERNER.find((s) => s.navn === 'Alkaid')
    const dato = utc('2026-08-27T22:00:00Z')
    const pa = presesserTilDato(a.ra, a.dek, dato)
    const pb = presesserTilDato(b.ra, b.dek, dato)
    expect(vinkel(pa.ra, pa.dek, pb.ra, pb.dek))
      .toBeCloseTo(vinkel(a.ra, a.dek, b.ra, b.dek), 2)
  })
})


describe('erNatt — offisiell soloppgang/solnedgang', () => {
  // Grensa er solas høyde −0°50′, som er definisjonen MET og Yr regner tidene
  // sine fra: øvre rand ved horisonten (−16′) pluss refraksjon (−34′).
  it('bruker den offisielle grensa og ikke null', () => {
    expect(SOL_HOYDE_SOLNEDGANG).toBeCloseTo((-50 / 60) * Math.PI / 180, 12)
  })

  it('midt på dagen er det dag, midt på natta er det natt — Oslo, jevndøgn', () => {
    const oslo = { lat: 59.91, lon: 10.75 }
    // Vårjevndøgn: sola står opp ~06 og ned ~18 lokal tid, altså 05/17 UTC.
    expect(erNatt({ ...oslo, dato: new Date('2026-03-20T11:00:00Z') })).toBe(false)
    expect(erNatt({ ...oslo, dato: new Date('2026-03-20T23:00:00Z') })).toBe(true)
  })

  it('midnattssol og mørketid er de to prøvene som ikke kan jukses', () => {
    // Nordkapp, 71,17° N. Over polarsirkelen er svaret det samme HELE døgnet, og
    // et fortegn eller en tidssone på skeive faller straks igjennom her.
    const nordkapp = { lat: 71.17, lon: 25.78 }
    for (const t of ['00:00', '06:00', '12:00', '18:00']) {
      expect(erNatt({ ...nordkapp, dato: new Date(`2026-06-21T${t}:00Z`) }))
        .toBe(false)                                  // midnattssol
      expect(erNatt({ ...nordkapp, dato: new Date(`2026-12-21T${t}:00Z`) }))
        .toBe(true)                                   // mørketid
    }
  })

  it('sørover snur årstidene, ikke døgnet', () => {
    // Samme dato, motsatt halvkule: 21. juni er midnattssol i nord og mørketid
    // i sør. Uten breddegraden i regnestykket ville begge svart likt.
    const sorpolen = { lat: -71.17, lon: 25.78 }
    expect(erNatt({ ...sorpolen, dato: new Date('2026-06-21T12:00:00Z') })).toBe(true)
    expect(erNatt({ ...sorpolen, dato: new Date('2026-12-21T12:00:00Z') })).toBe(false)
  })

  it('gir null og ikke et gjett når stedet mangler', () => {
    // Kallstedet faller tilbake på kart-temaet; det krever at vi sier fra i
    // stedet for å svare «dag» på et ark uten posisjon.
    expect(erNatt({ lat: NaN, lon: 10 })).toBeNull()
    expect(erNatt({ lat: 59, lon: undefined })).toBeNull()
  })
})


describe('himmelFor — tvungen måne (utvikler-bryter)', () => {
  const oslo = { lat: 59.91, lon: 10.75 }

  // Finn et tidspunkt der månen FAKTISK er nede, uten å anta noe om månefasen:
  // månen står opp og ned nesten en time senere hvert døgn, så en fast dato ville
  // vært et lykketreff som slutter å gjelde.
  const naarMaanenErNede = () => {
    for (let t = 0; t < 24 * 30; t++) {
      const dato = new Date(Date.UTC(2026, 7, 1, t))
      if (himmelFor({ ...oslo, dato }).mane.hoyde < 0) return dato
    }
    throw new Error('fant ikke et tidspunkt med månen under horisonten')
  }

  it('løfter månen over horisonten når den står under', () => {
    const dato = naarMaanenErNede()
    const av = himmelFor({ ...oslo, dato })
    const paa = himmelFor({ ...oslo, dato, tvingMane: true })
    expect(av.mane.hoyde).toBeLessThan(0)
    expect(paa.mane.hoyde).toBeCloseTo(MANE_TVANG_HOYDE, 12)
  })

  it('rører BARE høyden — fase, lysside og retning er fortsatt de ekte', () => {
    // Poenget med bryteren er å kunne PRØVE månegloben, ikke å se en oppdiktet
    // måne. Er fasen falsk, tester man ingenting.
    const dato = naarMaanenErNede()
    const av = himmelFor({ ...oslo, dato })
    const paa = himmelFor({ ...oslo, dato, tvingMane: true })
    expect(paa.mane.azimut).toBeCloseTo(av.mane.azimut, 12)
    expect(paa.mane.lysAndel).toBeCloseTo(av.mane.lysAndel, 12)
    expect(paa.mane.lyssideVinkel).toBeCloseTo(av.mane.lyssideVinkel, 12)
    expect(paa.mane.faseVinkel).toBeCloseTo(av.mane.faseVinkel, 12)
    expect(paa.mane.parallaktisk).toBeCloseTo(av.mane.parallaktisk, 12)
    expect(paa.mane.voksende).toBe(av.mane.voksende)
  })

  it('rører INGENTING når månen alt står høyt', () => {
    // Ellers ville bryteren dratt en høytstående måne NED til 35°, og da flyttet
    // den seg i det man skrudde den på — en bryter som endrer noe den ikke skal.
    for (let t = 0; t < 24 * 30; t++) {
      const dato = new Date(Date.UTC(2026, 7, 1, t))
      const av = himmelFor({ ...oslo, dato })
      if (av.mane.hoyde <= MANE_TVANG_HOYDE) continue
      const paa = himmelFor({ ...oslo, dato, tvingMane: true })
      expect(paa.mane.hoyde).toBeCloseTo(av.mane.hoyde, 12)
      return
    }
    throw new Error('fant ikke et tidspunkt med månen høyt nok')
  })

  it('er av som default', () => {
    const dato = naarMaanenErNede()
    expect(himmelFor({ ...oslo, dato }).mane.hoyde).toBeLessThan(0)
  })
})

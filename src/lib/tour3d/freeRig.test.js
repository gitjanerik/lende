import { readFileSync } from 'node:fs'
import { Vector3, Spherical } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// Himmelvippen — regelen som gjør at man kan se OPP i 3D.
//
// Bare den rene funksjonen testes her. Selve riggen krever OrbitControls og et
// DOM-element, og monteringen dekkes av røyktesten (scripts/royk-mapview.mjs),
// som faktisk drar en finger nedover i Chromium og leser av blikkretningen.
// Det som IKKE kan feilsøkes fra et skjermbilde er regnestykket: at utslaget
// bare går inn i vippen når orbiten har gitt seg, og at det spises opp igjen
// FØR orbiten får bevege seg tilbake.
//
// Merk at `utslag` er i VIPPENS retning (positivt = mot himmelen) og ikke i
// skjermens. Oversettelsen fra fingerens dy bor på kallstedet, fordi det er der
// OrbitControls' eget fortegn hører hjemme — og det var nettopp DET som var feil
// i første utgave: `rotateUp` gjør `phi -= dy`, så retningen som fortsetter forbi
// horisonten er OPPOVER, ikke nedover. Enhetstestene her sto grønne gjennom hele
// den feilen; det var røyktesten som fanget den.
import { describe, it, expect } from 'vitest'
import { PerspectiveCamera, Vector3, Matrix4 } from 'three'
import {
  himmelVippSteg, HIMMEL_VIPP_MAKS, blikkMot, orbitPosisjon, azimutFraTheta, vippForHoyde, blikkHoydeGrenser, blikkHoydeGrenserFullt, polarForHoyde,
} from './freeRig.js'

// Radianer per piksel, som i riggen: 2π over elementets høyde.
const FART = (2 * Math.PI) / 900

describe('himmelVippSteg', () => {
  it('vipper ikke før orbiten står på taket', () => {
    // Dette er hele grunnen til at gesten er en fortsettelse og ikke en modus:
    // uten betingelsen ville hvert drag nedover både tiltet kartet OG løftet
    // blikket, og de to bevegelsene hadde lagt seg oppå hverandre.
    expect(himmelVippSteg(0, 50, false, FART)).toBe(0)
    expect(himmelVippSteg(0, 300, false, FART)).toBe(0)
  })

  it('tar utslaget når orbiten står på taket', () => {
    const etter = himmelVippSteg(0, 60, true, FART)
    expect(etter).toBeCloseTo(60 * FART, 10)
    expect(etter).toBeGreaterThan(0)
  })

  it('stopper på taket sitt', () => {
    // Et langt drag skal ikke kunne vippe kameraet forbi senit og opp-ned.
    expect(himmelVippSteg(0, 100000, true, FART)).toBe(HIMMEL_VIPP_MAKS)
    expect(himmelVippSteg(HIMMEL_VIPP_MAKS, 500, true, FART)).toBe(HIMMEL_VIPP_MAKS)
  })

  it('spiser vippen på vei tilbake, og bare den', () => {
    const start = 40 * FART
    // Halve veien tilbake.
    expect(himmelVippSteg(start, -20, true, FART)).toBeCloseTo(20 * FART, 10)
    // Hele veien og mer: den stopper på 0 og lar resten være orbitens.
    expect(himmelVippSteg(start, -400, true, FART)).toBe(0)
  })

  it('lar utslaget tilbake være orbitens når vippen er brukt opp', () => {
    // Uten dette ville orbiten stått fast: et drag tilbake ville alltid gått
    // inn i en vipp som allerede var null.
    expect(himmelVippSteg(0, -80, true, FART)).toBe(0)
    expect(himmelVippSteg(0, -80, false, FART)).toBe(0)
  })

  it('spiser vippen selv om orbiten ikke står på taket', () => {
    // Kan skje etter en zoom eller en dempet bevegelse: vippen er i bruk, men
    // polarvinkelen har glidd et hakk. Den skal fortsatt kunne dras ned.
    expect(himmelVippSteg(30 * FART, -10, false, FART)).toBeCloseTo(20 * FART, 10)
  })

  it('gjør ingenting på et tomt eller ugyldig utslag', () => {
    const v = 20 * FART
    expect(himmelVippSteg(v, 0, true, FART)).toBe(v)
    expect(himmelVippSteg(v, NaN, true, FART)).toBe(v)
    expect(himmelVippSteg(v, undefined, true, FART)).toBe(v)
  })

  it('taket er høyt nok til å se himmelen, men ikke opp-ned', () => {
    const grader = (HIMMEL_VIPP_MAKS * 180) / Math.PI
    // Orbiten selv gir 89° (blikket vannrett). 75° på toppen av det er nesten
    // rett opp; forbi senit ville bildet stått uten et eneste holdepunkt.
    expect(grader).toBeGreaterThan(60)
    expect(grader).toBeLessThan(90)
  })
})

describe('vippens retning', () => {
  // Den ene tingen som kan være snudd, og som ingen aritmetikk-test fanger:
  // vipper `camera.rotateX(vipp)` blikket OPP eller NED? Riggen legger den på
  // etter controls.update(), akkurat slik som her.
  const seVannrett = () => {
    const kamera = new PerspectiveCamera(55, 1, 1, 60000)
    kamera.position.set(0, 500, 1000)
    // Blikkpunkt i samme høyde ⇒ vannrett blikk, som orbiten på taket sitt.
    kamera.quaternion.setFromRotationMatrix(
      new Matrix4().lookAt(kamera.position, new Vector3(0, 500, 0), new Vector3(0, 1, 0)),
    )
    return kamera
  }
  const retningY = (kamera) => kamera.getWorldDirection(new Vector3()).y

  it('starter vannrett', () => {
    expect(retningY(seVannrett())).toBeCloseTo(0, 6)
  })

  it('løfter blikket over horisonten', () => {
    const kamera = seVannrett()
    kamera.rotateX(0.6)
    expect(retningY(kamera)).toBeGreaterThan(0.5)
  })

  it('ved fullt utslag peker blikket nesten rett opp', () => {
    const kamera = seVannrett()
    kamera.rotateX(HIMMEL_VIPP_MAKS)
    // sin(75°) ≈ 0,966 — altså himmelen og ikke horisonten.
    expect(retningY(kamera)).toBeCloseTo(Math.sin(HIMMEL_VIPP_MAKS), 5)
    expect(retningY(kamera)).toBeGreaterThan(0.95)
  })

  it('null vipp rører ingenting', () => {
    const kamera = seVannrett()
    const f0 = kamera.quaternion.clone()
    kamera.rotateX(0)
    expect(kamera.quaternion.equals(f0)).toBe(true)
  })
})

describe('blikkMot — himmelretning til orbit + vipp', () => {
  const GRAD = Math.PI / 180

  // Orbiten ser PÅ blikkpunktet, så kameraet står på motsatt side av retningen.
  // three sin spherical: theta = atan2(offset.x, offset.z), offset = kamera − mål.
  // Vil man se mot nord (−Z), må kameraet stå i sør (+Z) ⇒ theta = 0.
  const posisjonFra = (theta) => ({ x: Math.sin(theta), z: Math.cos(theta) })

  it('setter kameraet motsatt retningen man skal se', () => {
    // Nord: blikket mot −Z ⇒ kameraet på +Z.
    let p = posisjonFra(blikkMot(0, 0).theta)
    expect(p.z).toBeGreaterThan(0.99)
    expect(Math.abs(p.x)).toBeLessThan(0.01)
    // Øst: blikket mot +X ⇒ kameraet på −X.
    p = posisjonFra(blikkMot(90 * GRAD, 0).theta)
    expect(p.x).toBeLessThan(-0.99)
    // Sør: blikket mot +Z ⇒ kameraet på −Z.
    p = posisjonFra(blikkMot(180 * GRAD, 0).theta)
    expect(p.z).toBeLessThan(-0.99)
    // Vest: blikket mot −X ⇒ kameraet på +X.
    p = posisjonFra(blikkMot(270 * GRAD, 0).theta)
    expect(p.x).toBeGreaterThan(0.99)
  })

  it('legger all høyde over horisonten i vippen', () => {
    // Orbiten kan ikke løfte blikket over horisonten i det hele tatt, så
    // vippen må bære hele høyden — pluss den lille biten orbitens tak ligger
    // UNDER horisonten (90° − 89° = 1°).
    const fraTaket = 1 * GRAD
    expect(blikkMot(0, 0).vipp).toBeCloseTo(fraTaket, 4)
    expect(blikkMot(0, 30 * GRAD).vipp).toBeCloseTo(30 * GRAD + fraTaket, 4)
    expect(blikkMot(0, 60 * GRAD).vipp).toBeCloseTo(60 * GRAD + fraTaket, 4)
  })

  it('klipper mot vippens tak og gulv', () => {
    // Rett opp i senit er mer enn vippen rekker; den skal stoppe, ikke snurre.
    expect(blikkMot(0, 89 * GRAD).vipp).toBe(HIMMEL_VIPP_MAKS)
    // Og et objekt under horisonten skal ikke gi negativ vipp.
    expect(blikkMot(0, -20 * GRAD).vipp).toBe(0)
  })

  it('er kontinuerlig rundt nord', () => {
    // 359° og 1° skal gi nesten samme theta — ellers får man en 358°-sving når
    // man velger noe som står rett i nord.
    const a = blikkMot(359 * GRAD, 0).theta
    const b = blikkMot(1 * GRAD, 0).theta
    let d = Math.abs(a - b)
    if (d > Math.PI) d = 2 * Math.PI - d
    expect(d).toBeLessThan(3 * GRAD)
  })
})


describe('orbitPosisjon — samme konvensjon som three', () => {
  it('stemmer med three sin egen Spherical, tilfeldige vinkler', () => {
    // HVORFOR DENNE FINNES: OrbitControls i three 0.185 har `getPolarAngle` og
    // `getAzimuthalAngle`, men ingen SETTERE. `controls.setPolarAngle(...)` sto i
    // seMot fram til v6.0.0 og kastet «is not a function» — gjennom hele
    // enhetstest-suiten og bygget, fanget først av røyktesten i Chromium.
    // Løsningen er å plassere kameraet i sfæriske koordinater i stedet, og da er
    // det ETT som kan være galt uten at noe kaster: konvensjonen. Et ombyttet
    // fortegn sender kameraet til motsatt side av himmelen.
    const pr = [
      [1, 0, Math.PI / 2], [500, 0.3, 1.1], [2500, -2.4, 0.4],
      [80, Math.PI, 1.5], [1e4, 1.9, 2.7],
    ]
    for (const [r, theta, phi] of pr) {
      const [x, y, z] = orbitPosisjon(r, theta, phi)
      const v = new Vector3().setFromSpherical(new Spherical(r, phi, theta))
      expect(x).toBeCloseTo(v.x, 6)
      expect(y).toBeCloseTo(v.y, 6)
      expect(z).toBeCloseTo(v.z, 6)
      // Og tilbakeveien: three leser vinklene ut av posisjonen slik
      // controls.update() gjør, så rundturen må være identisk.
      const tilbake = new Spherical().setFromVector3(new Vector3(x, y, z))
      expect(tilbake.phi).toBeCloseTo(phi, 6)
      expect(tilbake.radius).toBeCloseTo(r, 6)
    }
  })
})

describe('OrbitControls-API-et vi faktisk lener oss på', () => {
  it('har getterne, og vi kaller ingen setter som ikke finnes', () => {
    // Grensesnitt-vakt mot neste three-oppgradering. Den påstår ikke at
    // setterne SKAL mangle — den påstår at kodebasen ikke kaller dem, og at
    // getterne vi bruker er der. Begge halvdeler ville fanget feilen over.
    expect(typeof OrbitControls.prototype.getPolarAngle).toBe('function')
    expect(typeof OrbitControls.prototype.getAzimuthalAngle).toBe('function')
    // Kommentarlinjer strippes: forklaringen på hvorfor setteren IKKE brukes
    // nevner den ved navn, og en vakt som feiler på sin egen dokumentasjon blir
    // slettet framfor rettet.
    const kode = readFileSync(new URL('./freeRig.js', import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    expect(kode).not.toMatch(/controls\.setPolarAngle\s*\(/)
    expect(kode).not.toMatch(/controls\.setAzimuthalAngle\s*\(/)
  })
})


describe('azimutFraTheta — inversen av blikkMot', () => {
  it('gir tilbake azimuten blikkMot fikk inn', () => {
    // Stjernemodus løfter blikket UTEN å dreie det: azimuten leses av riggen og
    // sendes uendret inn i seMot. Bommer denne, snurrer kameraet til en
    // tilfeldig himmelretning i det natta slås på — og det ser ut som en feil i
    // animasjonen, ikke i et fortegn.
    for (const grader of [0, 37, 90, 143, 180, 217, 270, 359]) {
      const a = (grader * Math.PI) / 180
      const { theta } = blikkMot(a, 0.5)
      const tilbake = azimutFraTheta(theta)
      // Sammenlikn som retning, ikke som tall: 359° og −1° er samme vei.
      expect(Math.cos(tilbake)).toBeCloseTo(Math.cos(a), 9)
      expect(Math.sin(tilbake)).toBeCloseTo(Math.sin(a), 9)
    }
  })

  it('er sin egen inverse', () => {
    // Det ser ut som en tilfeldighet at samme uttrykk brukes begge veier, og
    // derfor står det som en test: uttrykket er en speiling.
    for (const t of [-3, -1.2, 0, 0.4, 2.9]) {
      expect(azimutFraTheta(azimutFraTheta(t))).toBeCloseTo(t, 9)
    }
  })
})

describe('vippForHoyde og blikkHoydeGrenser', () => {
  // Skyveknappen på desktop (v6.3.2) leser området HERFRA. Skrev den sine egne
  // tall, ville et håndtak stått stille i endene og brukeren trodd at kontrollen
  // var ødelagt — så det som må holdes fast er at de to er samme regnestykke.
  it('blikkMot bruker samme regel som vippForHoyde — én kilde', () => {
    for (const grader of [-5, -1, 0, 10, 45, 70, 74, 90]) {
      const h = (grader * Math.PI) / 180
      expect(blikkMot(1.2, h).vipp).toBeCloseTo(vippForHoyde(h), 12)
    }
  })

  it('vippen klippes i begge ender', () => {
    // Under horisonten er orbitens jobb, ikke vippens: der skal den være 0.
    expect(vippForHoyde(-1)).toBe(0)
    expect(vippForHoyde(-(Math.PI / 2))).toBe(0)
    expect(vippForHoyde(Math.PI / 2)).toBeCloseTo(HIMMEL_VIPP_MAKS, 12)
  })

  it('grensene er DET RIGGEN KAN, og endene treffer nøyaktig', () => {
    const g = blikkHoydeGrenser()
    expect(g.minGrader).toBeLessThan(0)
    expect(g.maksGrader).toBeGreaterThan(60)
    // Nedre ende gir vipp 0 (blikket ligger i orbitens eget tak), øvre ende gir
    // taket. Traff de ikke, ville håndtaket hatt dødt slark i endene.
    expect(vippForHoyde((g.minGrader * Math.PI) / 180)).toBeCloseTo(0, 9)
    expect(vippForHoyde((g.maksGrader * Math.PI) / 180)).toBeCloseTo(HIMMEL_VIPP_MAKS, 9)
  })

  it('grensene er HELE GRADER — en range med step=1 må ha heltalls-stopp', () => {
    // Regnestykket gir flyttall-støy (−0,9999999999999887 og 74,00000000000001).
    // Med et brøkete `min` ligger ingen av skyveknappens stopp på et helt tall:
    // den viste verdien matcher ikke input-ens egen. Røyken avslørte det som en
    // «Malformed value» fra Playwright, men feilen var i koden og ikke i testen.
    const g = blikkHoydeGrenser()
    expect(Number.isInteger(g.minGrader)).toBe(true)
    expect(Number.isInteger(g.maksGrader)).toBe(true)
  })

  it('grensene er sammenhengende — ingen høyde faller utenfor', () => {
    const g = blikkHoydeGrenser()
    let forrige = -1
    for (let d = g.minGrader; d <= g.maksGrader; d += 1) {
      const v = vippForHoyde((d * Math.PI) / 180)
      expect(v).toBeGreaterThanOrEqual(forrige)
      forrige = v
    }
  })
})

describe('blikkHoydeGrenserFullt — rosas område', () => {
  it('deler tak med skyven, men rekker ned i orbitens regime', () => {
    // Samme øvre ende: over horisonten er det vippen som bærer, uansett hvem som
    // ber. Nedre ende er derimot hele forskjellen — skyven stopper ved
    // horisonten, rosa skal kunne legge kameraet over kartet.
    const skyv = blikkHoydeGrenser()
    const full = blikkHoydeGrenserFullt()
    expect(full.maksGrader).toBe(skyv.maksGrader)
    expect(full.minGrader).toBeLessThan(skyv.minGrader)
    expect(full.minGrader).toBeLessThan(-80)
  })

  it('endene treffer nøyaktig det polarForHoyde kan gi', () => {
    // Et håndtak med dødt slark i endene leses som en ødelagt kontroll.
    const full = blikkHoydeGrenserFullt()
    expect(polarForHoyde((full.minGrader * Math.PI) / 180) * (180 / Math.PI)).toBeCloseTo(5, 6)
    expect(vippForHoyde((full.maksGrader * Math.PI) / 180)).toBeCloseTo(HIMMEL_VIPP_MAKS, 9)
  })

  it('grensene er HELE GRADER — samme krav som skyven', () => {
    const full = blikkHoydeGrenserFullt()
    expect(Number.isInteger(full.minGrader)).toBe(true)
    expect(Number.isInteger(full.maksGrader)).toBe(true)
  })
})

describe('polarForHoyde — blikket under horisonten', () => {
  const GRAD = Math.PI / 180
  it('lar orbiten stå på taket for alt som er oppe', () => {
    // Over horisonten er det VIPPEN som bærer høyden, og da skal kallstedet
    // ikke røre orbiten i det hele tatt. Uendret oppførsel fra før v6.5.6.
    for (const h of [0, 10 * GRAD, 45 * GRAD, 74 * GRAD]) {
      expect(polarForHoyde(h) / GRAD).toBeCloseTo(89, 6)
    }
  })

  it('senker orbiten når målet er under horisonten', () => {
    // Kameraet står i polarvinkel φ og ser MOT blikkpunktet, så blikkets høyde
    // er −(90° − φ). Sola 35° under horisonten krever altså φ = 55°.
    expect(polarForHoyde(-35 * GRAD) / GRAD).toBeCloseTo(55, 6)
    expect(polarForHoyde(-60 * GRAD) / GRAD).toBeCloseTo(30, 6)
  })

  it('går ikke helt til senit — en orbit rett over blikkpunktet er degenerert', () => {
    // Der mister asimuten mening, og OrbitControls' oppvektor kan vippe rundt.
    expect(polarForHoyde(-89 * GRAD) / GRAD).toBeGreaterThanOrEqual(5)
    expect(polarForHoyde(-200 * GRAD) / GRAD).toBeGreaterThanOrEqual(5)
  })

  it('vippen er 0 under horisonten — de to regimene overlapper aldri', () => {
    // Dette er invarianten som gjør at seMot kan velge ETT av dem: enten bærer
    // vippen høyden og orbiten står på taket, eller så bærer orbiten den og
    // vippen er null. Begge samtidig ville lagt vinklene oppå hverandre.
    for (const h of [-5 * GRAD, -35 * GRAD, -80 * GRAD]) {
      expect(vippForHoyde(h)).toBe(0)
      expect(polarForHoyde(h)).toBeLessThan(89 * GRAD)
    }
    for (const h of [5 * GRAD, 40 * GRAD]) {
      expect(vippForHoyde(h)).toBeGreaterThan(0)
      expect(polarForHoyde(h) / GRAD).toBeCloseTo(89, 6)
    }
  })

  it('blikkMot bærer polaren videre, uten å røre asimuten', () => {
    const opp = blikkMot(Math.PI / 2, 30 * GRAD)
    const ned = blikkMot(Math.PI / 2, -30 * GRAD)
    expect(ned.theta).toBeCloseTo(opp.theta, 9)
    expect(ned.polar).toBeLessThan(opp.polar)
    expect(ned.vipp).toBe(0)
  })
})

// Månegloben. Ingen WebGL trengs: lysretningen, rotasjonsklemmingen og hvilke
// trekk som er synlige er alt tall i minnet — og det er nettopp de tallene som
// avgjør om skyggelinja står riktig og om labelene ligger på riktig side av kula.
import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import { buildManeGlobe, selenografiskTilPunkt, MANE_TREKK } from './maneGlobe.js'

const GRAD = Math.PI / 180

describe('selenografiskTilPunkt', () => {
  it('under-jord-punktet peker mot kameraet (+Z)', () => {
    // Orienteringen er hele grunnlaget for at man ser FORSIDA først.
    const [x, y, z] = selenografiskTilPunkt(0, 0)
    expect(z).toBeCloseTo(1, 6)
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(0, 6)
  })

  it('nord er +Y og øst er +X', () => {
    expect(selenografiskTilPunkt(90, 0)[1]).toBeCloseTo(1, 6)
    expect(selenografiskTilPunkt(-90, 0)[1]).toBeCloseTo(-1, 6)
    expect(selenografiskTilPunkt(0, 90)[0]).toBeCloseTo(1, 6)
    expect(selenografiskTilPunkt(0, -90)[0]).toBeCloseTo(-1, 6)
  })

  it('alle punkter ligger på enhetskula', () => {
    for (const t of MANE_TREKK) {
      const [x, y, z] = selenografiskTilPunkt(t.lat, t.lon)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
    }
  })
})

describe('MANE_TREKK', () => {
  it('er trekk man faktisk kan se, med gyldige koordinater', () => {
    expect(MANE_TREKK.length).toBeGreaterThan(8)
    for (const t of MANE_TREKK) {
      expect(t.navn).toBeTruthy()
      expect(Math.abs(t.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(t.lon)).toBeLessThanOrEqual(180)
      expect(['hav', 'krater']).toContain(t.type)
    }
  })

  it('ligger alle på FORSIDA — baksida kan ingen se fra jorda', () => {
    // Utvalget er «det man ser med bare øyet eller en enkel kikkert». Et trekk
    // på baksida ville aldri vært synlig når globen står urotert, og en label
    // man må snurre for å finne er ikke en introduksjon.
    for (const t of MANE_TREKK) {
      expect(Math.abs(t.lon), t.navn).toBeLessThan(90)
    }
  })

  it('har Apollo 11 og Tycho, som er de to alle spør om', () => {
    const tranq = MANE_TREKK.find((t) => t.navn === 'Mare Tranquillitatis')
    expect(tranq.merk).toMatch(/Apollo 11/)
    expect(MANE_TREKK.some((t) => t.navn === 'Tycho')).toBe(true)
  })
})

describe('buildManeGlobe — fasen er ekte lys', () => {
  it('fullmåne lyser rett på forsida', () => {
    // Fasevinkel 0 = sola bak oss. Lyset skal peke mot +Z, altså mot kameraet.
    const g = buildManeGlobe()
    g.settFase(0, 0)
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    expect(sol.position.z).toBeCloseTo(1, 5)
    expect(Math.hypot(sol.position.x, sol.position.y)).toBeCloseTo(0, 5)
    g.dispose()
  })

  it('nymåne lyser fra baksida', () => {
    const g = buildManeGlobe()
    g.settFase(Math.PI, 0)
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    expect(sol.position.z).toBeCloseTo(-1, 5)
    g.dispose()
  })

  it('halvmåne lyser fra siden, og lyssideVinkel bestemmer HVILKEN side', () => {
    const g = buildManeGlobe()
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    // Fasevinkel 90° ⇒ lyset står rett på tvers.
    g.settFase(90 * GRAD, 0)
    expect(sol.position.z).toBeCloseTo(0, 5)
    // lyssideVinkel 0 = lyssida opp.
    expect(sol.position.y).toBeCloseTo(1, 5)
    // 90° mot klokka = lyssida mot venstre (−X).
    g.settFase(90 * GRAD, 90 * GRAD)
    expect(sol.position.x).toBeCloseTo(-1, 5)
    // −90° = mot høyre.
    g.settFase(90 * GRAD, -90 * GRAD)
    expect(sol.position.x).toBeCloseTo(1, 5)
    g.dispose()
  })

  it('tåler tull uten å flytte lyset ut av enhetskula', () => {
    const g = buildManeGlobe()
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    g.settFase(NaN, undefined)
    expect(sol.position.length()).toBeCloseTo(1, 5)
    expect(Number.isFinite(sol.position.x)).toBe(true)
    g.dispose()
  })

  it('nattsida er ikke helt svart', () => {
    // Uten litt fyllys blir kula en sigd som svever, og man mister at det er en
    // kule man ser på.
    const g = buildManeGlobe()
    const fyll = g.group.children.find((c) => c.type === 'AmbientLight')
    expect(fyll.intensity).toBeGreaterThan(0)
    expect(fyll.intensity).toBeLessThan(0.15)
    g.dispose()
  })
})

describe('buildManeGlobe — rotasjon', () => {
  it('lengderotasjon går fritt rundt', () => {
    const g = buildManeGlobe()
    g.settRotasjon(7 * Math.PI, 0)
    expect(g.rotasjon.lengde).toBeCloseTo(7 * Math.PI, 6)
    g.dispose()
  })

  it('breddegrad klemmes, så månen ikke havner på hodet', () => {
    // Får man snurre forbi polene, står kula opp-ned og ingen finner tilbake.
    const g = buildManeGlobe()
    g.settRotasjon(0, 3)
    expect(g.rotasjon.bredde).toBeCloseTo(80 * GRAD, 6)
    g.settRotasjon(0, -3)
    expect(g.rotasjon.bredde).toBeCloseTo(-80 * GRAD, 6)
    g.dispose()
  })
})

describe('buildManeGlobe — synlige trekk', () => {
  it('urotert ser man forsidas trekk, og bare dem', () => {
    const g = buildManeGlobe()
    const synlige = g.synligeTrekk()
    expect(synlige.length).toBeGreaterThan(5)
    for (const t of synlige) {
      // Alle skal peke mot kameraet.
      expect(t.verden[2]).toBeGreaterThan(0.18)
      expect(t.navn).toBeTruthy()
    }
    g.dispose()
  })

  it('snurrer man en halv omdreining, forsvinner forsida', () => {
    // Dette er testen på at rotasjonen FAKTISK flytter trekkene, og ikke bare
    // kula: uten applyQuaternion ville lista vært den samme uansett.
    const g = buildManeGlobe()
    const for0 = g.synligeTrekk().map((t) => t.navn)
    g.settRotasjon(Math.PI, 0)
    const etter = g.synligeTrekk().map((t) => t.navn)
    expect(etter.length).toBeLessThan(for0.length)
    // Copernicus ligger på lon −20 og skal være borte etter en halv omdreining.
    expect(for0).toContain('Copernicus')
    expect(etter).not.toContain('Copernicus')
    g.dispose()
  })

  it('trekk nær kanten utelates, så labels ikke havner på silhuetten', () => {
    const g = buildManeGlobe()
    // Grimaldi ligger på lon −68, altså nær kanten. Snurr den til randen.
    g.settRotasjon(-22 * GRAD, 0)
    for (const t of g.synligeTrekk()) {
      expect(t.verden[2]).toBeGreaterThan(0.18)
    }
    g.dispose()
  })
})

describe('buildManeGlobe — vendMot og rull', () => {
  it('forsida vender mot kameraet uansett hvilken vei kula henger', () => {
    // DETTE ER FELLA MODULEN BLE SKREVET RUNDT: uten vendMot peker forsida mot
    // verdens +Z, som i denne scenen er SØR. Sto månen i nord, så man baksida.
    const g = buildManeGlobe()
    g.group.position.set(0, 0, -4000)          // månen i nord (nord = −Z)
    const kamera = new Vector3(0, 0, 0)
    g.vendMot(kamera)
    // Under-jord-punktet (lat 0, lon 0) skal nå peke MOT kameraet.
    const p = new Vector3(...selenografiskTilPunkt(0, 0)).applyQuaternion(g.group.quaternion)
    const motKamera = kamera.clone().sub(g.group.position).normalize()
    expect(p.dot(motKamera)).toBeGreaterThan(0.99)
    g.dispose()
  })

  it('rullen dreier kula, og bare den', () => {
    const g = buildManeGlobe()
    g.group.position.set(0, 0, -1000)
    g.settRull(0)
    g.vendMot(new Vector3(0, 0, 0))
    const utenRull = new Vector3(...selenografiskTilPunkt(90, 0))
      .applyQuaternion(g.group.quaternion)
    g.settRull(Math.PI / 2)
    g.vendMot(new Vector3(0, 0, 0))
    const medRull = new Vector3(...selenografiskTilPunkt(90, 0))
      .applyQuaternion(g.group.quaternion)
    // Nordpolen sto opp; en kvart rull mot klokka legger den til venstre.
    expect(utenRull.y).toBeGreaterThan(0.99)
    expect(medRull.y).toBeCloseTo(0, 5)
    expect(Math.abs(medRull.x)).toBeGreaterThan(0.99)
    g.dispose()
  })

  it('skalaen kan krympe kula uten å gjøre den til ingenting', () => {
    // Vokse-animasjonen kjører gjennom denne, og en skala på 0 ville gjort
    // matrisen singulær — samme klasse feil som nulflatene i pinField.
    const g = buildManeGlobe()
    g.settSkala(0)
    expect(g.skala).toBeGreaterThan(0)
    g.settSkala(1)
    expect(g.skala).toBe(1)
    g.dispose()
  })
})

describe('buildManeGlobe — teksturen er valgfri', () => {
  it('virker uten tekstur, og sier at den ikke har en', () => {
    // NASA og USGS er sperret fra utviklingsmiljøet, så teksturen hentes i CI.
    // En funksjon som krever en fil som kanskje ikke er der, skal virke uten den.
    const g = buildManeGlobe({ teksturUrl: null })
    expect(g.harTekstur).toBe(false)
    expect(g.materials[0].map).toBeFalsy()
    // Og kula skal ha en månegrå egenfarge, ikke svart.
    expect(g.materials[0].color.getHex()).toBeGreaterThan(0x808080)
    g.dispose()
  })

  it('er skjult til noen ber om den', () => {
    const g = buildManeGlobe()
    expect(g.group.visible).toBe(false)
    g.setVisible(true)
    expect(g.group.visible).toBe(true)
    g.dispose()
  })
})

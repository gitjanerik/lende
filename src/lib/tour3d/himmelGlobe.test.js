// Månegloben. Ingen WebGL trengs: lysretningen, rotasjonsklemmingen og hvilke
// trekk som er synlige er alt tall i minnet — og det er nettopp de tallene som
// avgjør om skyggelinja står riktig og om labelene ligger på riktig side av kula.
import { describe, it, expect } from 'vitest'
import { Vector3, Texture, RepeatWrapping, SRGBColorSpace } from 'three'
import {
  buildHimmelGlobe, selenografiskTilPunkt, justerTekstur, TEKSTUR_U_OFFSET,
} from './himmelGlobe.js'
import { HIMMELLEGEMER, GLOBE_TEKST, MANE_TREKK, harGlobe } from './himmellegemer.js'

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

describe('buildHimmelGlobe — fasen er ekte lys', () => {
  it('fullmåne lyser rett på forsida', () => {
    // Fasevinkel 0 = sola bak oss. Lyset skal peke mot +Z, altså mot kameraet.
    const g = buildHimmelGlobe()
    g.settFase(0, 0)
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    expect(sol.position.z).toBeCloseTo(1, 5)
    expect(Math.hypot(sol.position.x, sol.position.y)).toBeCloseTo(0, 5)
    g.dispose()
  })

  it('nymåne lyser fra baksida', () => {
    const g = buildHimmelGlobe()
    g.settFase(Math.PI, 0)
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    expect(sol.position.z).toBeCloseTo(-1, 5)
    g.dispose()
  })

  it('halvmåne lyser fra siden, og lyssideVinkel bestemmer HVILKEN side', () => {
    const g = buildHimmelGlobe()
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
    const g = buildHimmelGlobe()
    const sol = g.group.children.find((c) => c.type === 'DirectionalLight')
    g.settFase(NaN, undefined)
    expect(sol.position.length()).toBeCloseTo(1, 5)
    expect(Number.isFinite(sol.position.x)).toBe(true)
    g.dispose()
  })

  it('nattsida er ikke helt svart', () => {
    // Uten litt fyllys blir kula en sigd som svever, og man mister at det er en
    // kule man ser på.
    const g = buildHimmelGlobe()
    const fyll = g.group.children.find((c) => c.type === 'AmbientLight')
    expect(fyll.intensity).toBeGreaterThan(0)
    expect(fyll.intensity).toBeLessThan(0.15)
    g.dispose()
  })
})

describe('buildHimmelGlobe — rotasjon', () => {
  it('lengderotasjon går fritt rundt', () => {
    const g = buildHimmelGlobe()
    g.settRotasjon(7 * Math.PI, 0)
    expect(g.rotasjon.lengde).toBeCloseTo(7 * Math.PI, 6)
    g.dispose()
  })

  it('breddegrad klemmes, så månen ikke havner på hodet', () => {
    // Får man snurre forbi polene, står kula opp-ned og ingen finner tilbake.
    const g = buildHimmelGlobe()
    g.settRotasjon(0, 3)
    expect(g.rotasjon.bredde).toBeCloseTo(80 * GRAD, 6)
    g.settRotasjon(0, -3)
    expect(g.rotasjon.bredde).toBeCloseTo(-80 * GRAD, 6)
    g.dispose()
  })
})

describe('buildHimmelGlobe — synlige trekk', () => {
  it('urotert ser man forsidas trekk, og bare dem', () => {
    const g = buildHimmelGlobe()
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
    const g = buildHimmelGlobe()
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
    const g = buildHimmelGlobe()
    // Grimaldi ligger på lon −68, altså nær kanten. Snurr den til randen.
    g.settRotasjon(-22 * GRAD, 0)
    for (const t of g.synligeTrekk()) {
      expect(t.verden[2]).toBeGreaterThan(0.18)
    }
    g.dispose()
  })
})

describe('buildHimmelGlobe — vendMot og rull', () => {
  it('forsida vender mot kameraet uansett hvilken vei kula henger', () => {
    // DETTE ER FELLA MODULEN BLE SKREVET RUNDT: uten vendMot peker forsida mot
    // verdens +Z, som i denne scenen er SØR. Sto månen i nord, så man baksida.
    const g = buildHimmelGlobe()
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
    const g = buildHimmelGlobe()
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
    const g = buildHimmelGlobe()
    g.settSkala(0)
    expect(g.skala).toBeGreaterThan(0)
    g.settSkala(1)
    expect(g.skala).toBe(1)
    g.dispose()
  })
})

describe('buildHimmelGlobe — teksturen er valgfri', () => {
  it('virker uten tekstur, og sier at den ikke har en', () => {
    // NASA og USGS er sperret fra utviklingsmiljøet, så teksturen hentes i CI.
    // En funksjon som krever en fil som kanskje ikke er der, skal virke uten den.
    const g = buildHimmelGlobe({ teksturUrl: null })
    expect(g.harTekstur).toBe(false)
    expect(g.materials[0].map).toBeFalsy()
    // Og kula skal ha en månegrå egenfarge, ikke svart.
    expect(g.materials[0].color.getHex()).toBeGreaterThan(0x808080)
    g.dispose()
  })

  it('er skjult til noen ber om den', () => {
    const g = buildHimmelGlobe()
    expect(g.group.visible).toBe(false)
    g.setVisible(true)
    expect(g.group.visible).toBe(true)
    g.dispose()
  })
})


describe('HIMMELLEGEMER — tabellen', () => {
  it('har de fem legemene som faktisk kan åpnes, og bare dem', () => {
    // Merkur og Venus står bevisst UTENFOR: en globe av dem ville vært en
    // påstand om at det er noe å se. Og siden trykk-ringen på himmelen leser
    // harGlobe, ville de fått et omriss som lover en globe som ikke finnes.
    expect(Object.keys(HIMMELLEGEMER).sort())
      .toEqual(['jupiter', 'mane', 'mars', 'saturn', 'sol'])
    expect(harGlobe('sol')).toBe(true)
    expect(harGlobe('mane')).toBe(true)
    expect(harGlobe('mars')).toBe(true)
    expect(harGlobe('merkur')).toBe(false)
    expect(harGlobe('venus')).toBe(false)
    expect(harGlobe('orion')).toBe(false)
  })

  it('hvert legeme har fallback-farge, trekk og tekst', () => {
    // Fallback-fargen er ikke pynt: teksturene bakes i CI, og lokalt finnes de
    // ikke. «Uten fotografi» er den normale tilstanden, og legemet må være
    // gjenkjennelig likevel.
    for (const [id, spec] of Object.entries(HIMMELLEGEMER)) {
      expect(spec.farge, id).toMatch(/^#[0-9a-f]{6}$/i)
      // SOLA HAR INGEN BAKT FIL, og det er et valg: kilde-URL-er skal måles og
      // ikke gjettes (v6.3.0), og hostene er sperret fra utviklingsmiljøene.
      // Overflaten tegnes lokalt i stedet — se granulasjonTekstur. Da MÅ den
      // også si fra at den er selvlysende, ellers står halve sola i skygge.
      if (spec.tekstur === null) {
        expect(spec.granulasjon || spec.band, id).toBeTruthy()
        expect(spec.selvlysende, id).toBe(true)
      } else {
        expect(spec.tekstur, id).toMatch(/\.jpg$/)
      }
      expect(spec.trekk?.length, id).toBeGreaterThan(2)
      expect(GLOBE_TEKST[id], id).toBeTruthy()
      expect(GLOBE_TEKST[id].omtale, id).toBeTruthy()
      // BRUKSANVISNINGEN SKAL IKKE TILBAKE (v6.3.3). Den forklarte at man drar i
      // en kule for å snurre den — det man prøver først uansett — og trykk-ringen
      // sier alt om at legemet kan åpnes. Testen står her fordi en tekst er lett
      // å legge tilbake i god tro.
      expect(GLOBE_TEKST[id].bruk, id).toBeUndefined()
    }
    // Og motsatt: ingen tekst uten et legeme å høre til.
    for (const id of Object.keys(GLOBE_TEKST)) expect(HIMMELLEGEMER[id], id).toBeTruthy()
  })

  it('alle trekk ligger innenfor gyldige koordinater', () => {
    for (const [id, spec] of Object.entries(HIMMELLEGEMER)) {
      for (const t of spec.trekk) {
        expect(t.navn, id).toBeTruthy()
        expect(Math.abs(t.lat), `${id}/${t.navn}`).toBeLessThanOrEqual(90)
        expect(Math.abs(t.lon), `${id}/${t.navn}`).toBeLessThanOrEqual(180)
      }
    }
  })

  it('månens trekk er alle på FORSIDA', () => {
    // Baksida er aldri synlig fra jorda, og en label der ville vært en label på
    // noe man ikke kan peke på fra bakken.
    for (const t of MANE_TREKK) expect(Math.abs(t.lon), t.navn).toBeLessThan(90)
  })
})

describe('buildHimmelGlobe — per legeme', () => {
  it('hvert legeme bygger, og bærer sitt eget navn og sine egne trekk', () => {
    for (const id of Object.keys(HIMMELLEGEMER)) {
      const g = buildHimmelGlobe({ legeme: id })
      expect(g.legeme).toBe(id)
      expect(g.navn).toBe(HIMMELLEGEMER[id].navn)
      // Urotert skal noen trekk være synlige — ellers er tabellen eller
      // projeksjonen feil, og labelene ville aldri kommet.
      expect(g.synligeTrekk().length, id).toBeGreaterThan(0)
      g.dispose()
    }
  })

  it('BARE Saturn har ringer', () => {
    // En Saturn uten ringer er en blek Jupiter; en Jupiter MED ringer er feil.
    for (const id of Object.keys(HIMMELLEGEMER)) {
      expect(buildHimmelGlobe({ legeme: id }).harRinger, id).toBe(id === 'saturn')
    }
  })

  it('aksehellingen står på holderens X, ikke på kula og ikke på Z', () => {
    // Mars står 25° skjevt og Saturn 27°. Ligger hellingen på meshet, blir den
    // overskrevet av brukerens dreining; ligger den på gruppa, blir den
    // overskrevet av vendMot hver frame. Derfor en holder imellom.
    //
    // OG DEN MÅ STÅ PÅ X. Fram til v6.5.4 sto den på Z, altså en rull om
    // synslinja — usynlig på en kule, og dødelig for Saturns ringer, som en
    // rull aldri kan åpne. Testen holder aksen fast, ikke bare vinkelen.
    const mars = buildHimmelGlobe({ legeme: 'mars' })
    // Gruppa har ett barn som er holderen (pluss lysene).
    const holder = mars.group.children.find((c) => c.children.includes(mars.mesh))
    expect(holder).toBeTruthy()
    expect(Math.abs(holder.rotation.x)).toBeCloseTo(25.2 * Math.PI / 180, 6)
    expect(holder.rotation.z).toBe(0)
    expect(mars.mesh.rotation.z).toBe(0)
    mars.dispose()
  })

  it('ukjent legeme faller tilbake på månen framfor å kaste', () => {
    // Kallstedet gater på harGlobe, men en globe som kaster ville tatt hele
    // 3D-visningen med seg — og et fallback er billigere enn en krasj.
    const g = buildHimmelGlobe({ legeme: 'pluto' })
    expect(g.synligeTrekk().length).toBeGreaterThan(0)
    g.dispose()
  })
})

describe('settRenderLag — globen tegnes i en egen dybde-pass', () => {
  // HVORFOR: globen henger 4 km foran kameraet i legemets VIRKELIGE retning, så
  // står legemet lavt (Mars på 3°) skjærer terrenget gjennom kula. Fikset ved å
  // tegne globen i et eget lag etter at dybdebufferet er tømt. Da MÅ alt som
  // hører til globen ligge i laget — og de to fellene under er begge stille.
  const alle = (g) => { const ut = []; g.group.traverse((o) => ut.push(o)); return ut }

  it('flytter HVERT objekt, ikke bare gruppa — laget arves ikke', () => {
    const g = buildHimmelGlobe({ legeme: 'mars', radius: 100 })
    g.settRenderLag(1)
    for (const o of alle(g)) {
      expect(o.layers.test({ mask: 1 << 1 }), o.type).toBe(true)
      // Og de skal være UTE av lag 0, ellers tegnes de i begge passene.
      expect(o.layers.test({ mask: 1 << 0 }), o.type).toBe(false)
    }
    g.dispose()
  })

  it('LYSENE er med — uten dem er kula kullsvart i passen', () => {
    // three.js tester laget per objekt også for lys. Et DirectionalLight som
    // ikke består testen bidrar ikke, og feilen kommer uten en melding.
    const g = buildHimmelGlobe({ legeme: 'mars', radius: 100 })
    g.settRenderLag(1)
    const lys = alle(g).filter((o) => o.isLight)
    expect(lys.length).toBeGreaterThanOrEqual(2)
    for (const l of lys) expect(l.layers.test({ mask: 1 << 1 }), l.type).toBe(true)
    g.dispose()
  })

  it('tar Saturns ringer med seg', () => {
    // En Saturn uten ringer er en blek Jupiter — og en ring som blir igjen på
    // lag 0 forsvinner bak terrenget mens planeten ligger oppå.
    const g = buildHimmelGlobe({ legeme: 'saturn', radius: 100 })
    expect(g.harRinger).toBe(true)
    g.settRenderLag(1)
    const mesher = alle(g).filter((o) => o.isMesh)
    expect(mesher.length).toBeGreaterThanOrEqual(2)
    for (const m of mesher) expect(m.layers.test({ mask: 1 << 1 })).toBe(true)
    g.dispose()
  })

  it('avviser et ugyldig lag i stedet for å flytte noe halvveis', () => {
    const g = buildHimmelGlobe({ legeme: 'mars', radius: 100 })
    for (const ugyldig of [-1, 32, 1.5, NaN, null, undefined, '1']) {
      g.settRenderLag(ugyldig)
      expect(g.mesh.layers.test({ mask: 1 << 0 })).toBe(true)
    }
    g.dispose()
  })
})

describe('buildHimmelGlobe — teksturen ligger der navnene står', () => {
  it('lengdegrad 0 samler seg på kartets nullmeridian', () => {
    // INVARIANTEN, IKKE TALLET: SphereGeometry legger u = 0,25 mot kameraet,
    // mens et equirektangulært kart har nullmeridianen på u = 0,5. Uten
    // forskyvningen viser kula kartets lengdegrad −90 der merkelappene sier 0,
    // og «Den store røde flekken» står midt på Jupiter uten noen flekk under seg.
    const g = buildHimmelGlobe()
    const pos = g.mesh.geometry.attributes.position
    const uv = g.mesh.geometry.attributes.uv
    const mot = new Vector3(0, 0, 1)
    let best = -1
    let bestAvstand = Infinity
    for (let i = 0; i < pos.count; i++) {
      const d = new Vector3().fromBufferAttribute(pos, i).distanceTo(mot)
      if (d < bestAvstand) { bestAvstand = d; best = i }
    }
    const u = (uv.getX(best) + TEKSTUR_U_OFFSET) % 1
    expect(u).toBeCloseTo(0.5, 6)
    g.dispose()
  })

  it('justerTekstur gjentar i u — ellers smøres kvartingen ut som en stripe', () => {
    const t = justerTekstur(new Texture())
    expect(t.offset.x).toBeCloseTo(TEKSTUR_U_OFFSET, 6)
    expect(t.wrapS).toBe(RepeatWrapping)
    expect(t.colorSpace).toBe(SRGBColorSpace)
  })
})

describe('buildHimmelGlobe — aksehellingen åpner ringene', () => {
  /** Ringplanets normal, i gruppas rom (der +Z er mot kameraet). */
  const ringNormal = (g) => {
    const ring = g.mesh.parent.children.find((c) => c.geometry?.type === 'RingGeometry')
    return new Vector3(0, 0, 1)
      .applyQuaternion(ring.quaternion)
      .applyQuaternion(g.mesh.parent.quaternion)
  }

  it('Saturns ringer er åpne mot betrakteren, ikke sett i kanten', () => {
    // FEILEN SOM BLE RETTET: hellingen sto på holderens Z, altså en RULL om
    // synslinja — og en rull kan per konstruksjon ikke åpne et plan man ser inn
    // i kanten på. Normalen fikk z = 0 uansett helling, og Saturn sto uten
    // ringer på skjermen mens harRinger var sann og shaderen kjørte.
    const g = buildHimmelGlobe({ legeme: 'saturn' })
    expect(g.harRinger).toBe(true)
    const n = ringNormal(g)
    const apning = Math.asin(Math.abs(n.z)) / GRAD
    expect(apning).toBeCloseTo(HIMMELLEGEMER.saturn.akseHelling, 4)
    expect(apning).toBeGreaterThan(20)
    g.dispose()
  })

  it('breddegrads-draget vipper ringene med, ikke bare kula', () => {
    // Lå bredde på meshet — som den gjorde til v6.5.4 — ville kula vridd seg ut
    // av ringer som sto stille så snart man dro oppover.
    const g = buildHimmelGlobe({ legeme: 'saturn' })
    const for0 = ringNormal(g).z
    g.settRotasjon(0, 20 * GRAD)
    expect(ringNormal(g).z).not.toBeCloseTo(for0, 3)
    g.dispose()
  })

  it('klemmen gjelder summen, så aksen ikke passerer polen', () => {
    const g = buildHimmelGlobe({ legeme: 'saturn' })
    g.settRotasjon(0, 3)
    const helling = HIMMELLEGEMER.saturn.akseHelling * GRAD
    expect((g.rotasjon.bredde + helling) / GRAD).toBeCloseTo(80, 4)
    g.settRotasjon(0, -3)
    expect((g.rotasjon.bredde + helling) / GRAD).toBeCloseTo(-80, 4)
    g.dispose()
  })

  it('månen har ingen helling, så ±80° står urørt', () => {
    const g = buildHimmelGlobe()
    g.settRotasjon(0, 3)
    expect(g.rotasjon.bredde).toBeCloseTo(80 * GRAD, 6)
    g.dispose()
  })
})

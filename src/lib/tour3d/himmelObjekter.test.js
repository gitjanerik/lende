import { describe, it, expect } from 'vitest'
import {
  himmelObjekter, filtrerHimmel, naboerFor, vinkelAvstand, kompass, himmelUndertekst, naermesteTreff,
} from './himmelObjekter.js'
import { FORMASJONER, STJERNER } from './stjerner.js'

const STED = { lat: 61.2, lon: 8.4 }
const GRAD = Math.PI / 180
// Vinternatt: Orion, Tvillingene og Kjøresvennen er oppe, Løven er på vei.
const VINTER = new Date('2026-01-15T21:00:00Z')
const SOMMER = new Date('2026-07-15T23:00:00Z')

describe('himmelObjekter', () => {
  it('lister bare det som faktisk er oppe — sola unntatt, den tegnes uansett', () => {
    for (const dato of [VINTER, SOMMER]) {
      const liste = himmelObjekter({ ...STED, dato })
      expect(liste.length).toBeGreaterThan(3)
      for (const o of liste) {
        // Sola er det ene legemet som tegnes hele døgnet: er den ikke på
        // himmelen, står den under terrengarket der den faktisk er. Regelen
        // «lista lover bare det som tegnes» er altså ikke brutt.
        if (o.type !== 'sol') {
          expect(o.hoyde, `${o.navn} skal være over horisonten`).toBeGreaterThan(0)
        }
        expect(o.id).toBeTruthy()
        expect(o.navn).toBeTruthy()
        expect(['formasjon', 'planet', 'mane', 'stjerne', 'sol']).toContain(o.type)
      }
    }
  })

  it('sola er ALLTID med, også midt på natta når den er under føttene dine', () => {
    // Hele grunnen til at den er unntatt regelen over: et legeme som forsvinner
    // ut av lista uten forklaring er verre enn ett som står der og sier hvor
    // det er.
    for (const dato of [VINTER, SOMMER, new Date('2026-01-01T01:00:00Z')]) {
      const sol = himmelObjekter({ ...STED, dato }).find((o) => o.type === 'sol')
      expect(sol, `sola mangler for ${dato.toISOString()}`).toBeTruthy()
      expect(sol.harGlobe).toBe(true)
      expect(Number.isFinite(sol.hoyde)).toBe(true)
    }
  })

  it('utelater formasjoner som bare delvis er oppe', () => {
    // En figur med to av sju stjerner over horisonten er ikke til å kjenne
    // igjen, og å tilby den i lista er å love noe vi ikke tegner.
    const liste = himmelObjekter({ ...STED, dato: VINTER })
    for (const o of liste) {
      if (o.type !== 'formasjon') continue
      expect(o.andelOppe, o.navn).toBeGreaterThanOrEqual(0.6)
    }
  })

  it('himmelen snur seg gjennom året', () => {
    // Orion er en vinterfigur og Lyren en sommerfigur. Er lista den samme i
    // januar og juli, står himmelen stille — og da er stjernetida ignorert.
    const navn = (d) => new Set(himmelObjekter({ ...STED, dato: d })
      .filter((o) => o.type === 'formasjon').map((o) => o.id))
    const vinter = navn(VINTER)
    const sommer = navn(SOMMER)
    expect(vinter).not.toEqual(sommer)
    expect([...vinter].some((id) => !sommer.has(id))).toBe(true)
  })

  it('Karlsvogna er alltid oppe fra Norge', () => {
    // Sirkumpolar på 61°N. Faller denne, er breddegraden eller horisont-
    // transformen feil.
    for (let m = 0; m < 12; m++) {
      const dato = new Date(Date.UTC(2026, m, 15, 22))
      const liste = himmelObjekter({ ...STED, dato })
      expect(liste.some((o) => o.id === 'karlsvogna'), `måned ${m + 1}`).toBe(true)
    }
  })

  it('sorterer månen først, så planetene, formasjonene og til slutt stjernene', () => {
    // Rekkefølgen man legger merke til dem i: månen er umulig å overse, en
    // planet er neste, et stjernebilde må man lete etter — og en enkeltstjerne
    // er det man ender med å lure på når figurene er talt opp.
    for (let d = 0; d < 200; d += 13) {
      const liste = himmelObjekter({ ...STED, dato: new Date(Date.UTC(2026, 0, 1 + d, 22)) })
      const typer = liste.map((o) => o.type)
      const rang = { sol: 0, mane: 1, planet: 2, formasjon: 3, stjerne: 4 }
      for (let i = 1; i < typer.length; i++) {
        expect(rang[typer[i]]).toBeGreaterThanOrEqual(rang[typer[i - 1]])
      }
      const planeter = liste.filter((o) => o.type === 'planet')
      for (let i = 1; i < planeter.length; i++) {
        expect(planeter[i].mag).toBeGreaterThanOrEqual(planeter[i - 1].mag)
      }
      const form = liste.filter((o) => o.type === 'formasjon')
      for (let i = 1; i < form.length; i++) {
        expect(form[i].navn.localeCompare(form[i - 1].navn, 'nb')).toBeGreaterThanOrEqual(0)
      }
      const stjerner = liste.filter((o) => o.type === 'stjerne')
      for (let i = 1; i < stjerner.length; i++) {
        expect(stjerner[i].mag).toBeGreaterThanOrEqual(stjerner[i - 1].mag)
      }
    }
  })

  it('gir de løse stjernene alt infokortet trenger', () => {
    // v6.4.0: stjerner som ikke inngår i en figur vi tegner er nå valgbare, og
    // kortet skal kunne svare på «hva er den lyse prikken der?». Uten navn,
    // stjernebilde og fremhevings-indeks er valget en tom rad.
    const liste = himmelObjekter({ ...STED, dato: VINTER })
    const stjerner = liste.filter((o) => o.type === 'stjerne')
    expect(stjerner.length).toBeGreaterThan(0)
    for (const o of stjerner) {
      expect(o.navn, o.id).toBeTruthy()
      expect(Number.isFinite(o.mag), o.navn).toBe(true)
      expect(o.stjernebilde, o.navn).toBeTruthy()
      expect(o.stjernebilde.norsk, o.navn).toBeTruthy()
      // Det som skal videre til skyDome.settValgt: én indeks, ingen strek.
      expect(o.stjerner.length, o.navn).toBe(1)
      expect(o.linjer, o.navn).toEqual([])
      // Og indeksen må peke på den stjerna kortet snakker om.
      expect(STJERNER[o.stjerner[0]].mag, o.navn).toBe(o.mag)
    }
  })

  it('en stjerne som inngår i en figur tilbys ikke også som løs stjerne', () => {
    // TO TREFFLATER OPPÅ HVERANDRE ville stjålet trykk fra hverandre: sikter man
    // på Vega, er svaret Lyren. Stjernenavnet er fortsatt søkbart gjennom
    // figuren, så ingenting går tapt.
    const liste = himmelObjekter({ ...STED, dato: VINTER })
    const iFigur = new Set(FORMASJONER.flatMap((f) => f.stjerner))
    for (const o of liste.filter((x) => x.type === 'stjerne')) {
      expect(iFigur.has(o.stjerner[0]), o.navn).toBe(false)
    }
    // Og motprøven: figur-stjernene er fortsatt søkbare via figuren sin.
    expect(filtrerHimmel(liste, 'Vega').some((o) => o.type === 'formasjon')).toBe(true)
  })

  it('en stjerne kan søkes opp på navn, betegnelse og stjernebilde', () => {
    // «Tyren» er ikke en figur vi tegner, men Aldebaran ER svaret på den — og
    // en søkeliste som ikke svarer på et stjernebildenavn er en søkeliste som
    // ser tom ut.
    const liste = himmelObjekter({ ...STED, dato: VINTER })
    const aldebaran = liste.find((o) => o.navn === 'Aldebaran')
    expect(aldebaran, 'Aldebaran skal være oppe en vinterkveld').toBeTruthy()
    for (const q of ['aldebaran', 'α Tauri', 'Alp Tau', 'Tyren', 'Taurus']) {
      expect(filtrerHimmel(liste, q).some((o) => o.navn === 'Aldebaran'), q).toBe(true)
    }
  })

  it('gir formasjonene alt infokortet trenger', () => {
    const liste = himmelObjekter({ ...STED, dato: VINTER })
    for (const o of liste.filter((x) => x.type === 'formasjon')) {
      expect(o.latin).toBeTruthy()
      expect(o.info, o.navn).toBeTruthy()
      expect(o.info.mytologi).toBeTruthy()
      expect(o.antallStjerner).toBeGreaterThan(3)
      expect(o.lysesteStjerne, o.navn).toBeTruthy()
      // Og det som skal videre til skyDome.settValgt.
      expect(Array.isArray(o.stjerner)).toBe(true)
      expect(Array.isArray(o.linjer)).toBe(true)
    }
  })

  it('svarer tomt uten sted framfor å gjette', () => {
    expect(himmelObjekter({ lat: NaN, lon: 8 })).toEqual([])
    expect(himmelObjekter({ lat: 61 })).toEqual([])
  })
})

describe('filtrerHimmel', () => {
  const liste = himmelObjekter({ ...STED, dato: VINTER })

  it('tom søkestreng gir hele lista — det er nedtrekkslista', () => {
    expect(filtrerHimmel(liste, '')).toBe(liste)
    expect(filtrerHimmel(liste, '   ')).toBe(liste)
    expect(filtrerHimmel(liste, null)).toBe(liste)
  })

  it('finner på norsk navn', () => {
    const t = filtrerHimmel(liste, 'karlsvogn')
    expect(t.length).toBe(1)
    expect(t[0].id).toBe('karlsvogna')
  })

  it('finner på latinsk navn', () => {
    expect(filtrerHimmel(liste, 'ursa major')[0]?.id).toBe('karlsvogna')
  })

  it('finner formasjonen via en STJERNE i den', () => {
    // Dette er hele grunnen til at søket finnes: man husker «Vega», ikke «Lyra».
    const dubhe = filtrerHimmel(liste, 'dubhe')
    expect(dubhe.map((o) => o.id)).toContain('karlsvogna')
  })

  it('finner Lille bjørn på «Polstjerna»', () => {
    // Norske stjernenavn, fordi ingen skriver «Polaris» når de leter etter
    // Polstjerna.
    expect(filtrerHimmel(liste, 'polstjern').map((o) => o.id)).toContain('lille-bjorn')
  })

  it('bryr seg ikke om store bokstaver', () => {
    expect(filtrerHimmel(liste, 'ORION').length).toBe(filtrerHimmel(liste, 'orion').length)
  })

  it('gir tomt på noe som ikke finnes', () => {
    expect(filtrerHimmel(liste, 'skorpionen')).toEqual([])
  })
})

describe('naboerFor', () => {
  const liste = himmelObjekter({ ...STED, dato: VINTER })

  it('gir de nærmeste, sortert, og aldri seg selv', () => {
    const orion = liste.find((o) => o.id === 'orion')
    if (!orion) return
    const n = naboerFor(orion, liste, 3)
    expect(n.length).toBeLessThanOrEqual(3)
    expect(n.some((x) => x.id === 'orion')).toBe(false)
    for (let i = 1; i < n.length; i++) {
      expect(n[i].avstandGrader).toBeGreaterThanOrEqual(n[i - 1].avstandGrader)
    }
    // Naboene skal være i nærheten, ikke på motsatt side av himmelen.
    if (n.length) expect(n[0].avstandGrader).toBeLessThan(90)
  })

  it('Orions nærmeste er en vinterfigur, ikke en sommerfigur', () => {
    const orion = liste.find((o) => o.id === 'orion')
    if (!orion) return
    const naboIder = naboerFor(orion, liste, 4).map((o) => o.id)
    // Tvillingene og Kjøresvennen ligger rett ved Orion; Lyren er 180° unna.
    expect(naboIder).not.toContain('lyren')
  })

  it('tåler tomt og null', () => {
    expect(naboerFor(null, liste)).toEqual([])
    expect(naboerFor(liste[0], [liste[0]])).toEqual([])
  })
})

describe('vinkelAvstand og kompass', () => {
  it('vinkelAvstand er 0 til seg selv og 180 til motsatt punkt', () => {
    const a = { azimut: 1.2, hoyde: 0.4 }
    expect(vinkelAvstand(a, a)).toBeCloseTo(0, 6)
    const senit = { azimut: 0, hoyde: Math.PI / 2 }
    const horisont = { azimut: 0, hoyde: 0 }
    expect(vinkelAvstand(senit, horisont)).toBeCloseTo(90, 4)
  })

  it('kompass gir norske himmelretninger', () => {
    expect(kompass(0)).toBe('nord')
    expect(kompass(90)).toBe('øst')
    expect(kompass(180)).toBe('sør')
    expect(kompass(270)).toBe('vest')
    expect(kompass(45)).toBe('nordøst')
    // Og den skal gå rundt, ikke sprekke.
    expect(kompass(359)).toBe('nord')
    expect(kompass(-90)).toBe('vest')
    expect(kompass(720)).toBe('nord')
  })
})

describe('himmelUndertekst', () => {
  const liste = himmelObjekter({ ...STED, dato: VINTER })

  it('sier hva det er og hvor det står', () => {
    for (const o of liste) {
      const t = himmelUndertekst(o)
      // Sola kan stå under horisonten, og da skal teksten SI det — «−42° over
      // horisonten» er tull, og det var slik den leste før v6.5.6.
      expect(t).toMatch(o.hoyde < 0 ? /under horisonten/ : /over horisonten/)
      // Ingen minus foran GRADENE — fortegnet bæres av ordet. (Lysstyrke er
      // legitimt negativ for Jupiter og Venus, så testen ser bare på høyden.)
      expect(t).not.toMatch(/[-−]\d+°/)
      expect(t).toMatch(/nord|øst|sør|vest/)
    }
  })

  it('formasjoner får latinsk navn og stjernetall', () => {
    const f = liste.find((o) => o.type === 'formasjon')
    expect(himmelUndertekst(f)).toContain(f.latin)
    expect(himmelUndertekst(f)).toMatch(/\d+ stjerner/)
  })

  it('bruker komma som desimalskilletegn, som resten av appen', () => {
    const p = liste.find((o) => o.type === 'planet')
    if (p) expect(himmelUndertekst(p)).toMatch(/lysstyrke -?\d+,\d/)
  })

  it('formasjonene i lista finnes i katalogen', () => {
    const ider = new Set(FORMASJONER.map((f) => f.id))
    for (const o of liste.filter((x) => x.type === 'formasjon')) {
      expect(ider.has(o.id)).toBe(true)
    }
  })
})


describe('himmelObjekter — tvungne himmellegemer må gjelde HER OGSÅ', () => {
  // FELLA denne testen finnes for: bryteren løfter månen i himmelen (skiva i
  // skyDome) og i LISTA (her), og begge går gjennom himmelFor. Gjorde de det
  // ikke, ville søket manglet en måne man tydelig ser — og trykk-plukkingen
  // ville ikke funnet den, siden den plukker fra denne lista. Samme regel som
  // mosaikken i CLAUDE.md.
  const oslo = { lat: 59.91, lon: 10.75 }
  const naarMaanenErNede = () => {
    for (let t = 0; t < 24 * 30; t++) {
      const dato = new Date(Date.UTC(2026, 7, 1, t))
      if (!himmelObjekter({ ...oslo, dato }).some((o) => o.type === 'mane')) return dato
    }
    throw new Error('fant ikke et tidspunkt uten måne i lista')
  }

  it('månen kommer i lista når bryteren står på', () => {
    const dato = naarMaanenErNede()
    expect(himmelObjekter({ ...oslo, dato }).some((o) => o.type === 'mane')).toBe(false)
    const mane = himmelObjekter({ ...oslo, dato, tvingHimmel: true })
      .find((o) => o.type === 'mane')
    expect(mane).toBeTruthy()
    expect(mane.hoyde).toBeGreaterThan(0)
    // Og den må bære det månegloben trenger, ellers åpner ikke nærbildet.
    expect(Number.isFinite(mane.faseVinkel)).toBe(true)
    expect(Number.isFinite(mane.lyssideVinkel)).toBe(true)
    expect(Number.isFinite(mane.parallaktisk)).toBe(true)
  })

  it('månen står først etter sola, som ellers', () => {
    const dato = naarMaanenErNede()
    const liste = himmelObjekter({ ...oslo, dato, tvingHimmel: true })
    expect(liste[0].type).toBe('sol')
    expect(liste[1].type).toBe('mane')
  })
})

describe('himmelObjekter — bryteren gir alle fire globe-legemene', () => {
  // ENDEN AV KJEDEN. Dette er lista søkefeltet, trykk-plukkingen og infokortets
  // naboer leses av — og hele grunnen til at tvangen bor i ÉN kilde per
  // legemetype er at denne lista og himmelen ikke skal komme i utakt. Står et
  // legeme her uten å være tegnet, tilbyr søket noe trykk ikke finner.
  const oslo = { lat: 59.91, lon: 10.75 }

  it('månen, Mars, Jupiter og Saturn er med, uansett dato', () => {
    for (const iso of ['2026-01-15T02:00:00Z', '2026-04-15T14:00:00Z',
      '2026-07-15T22:00:00Z', '2026-10-15T10:00:00Z']) {
      const ider = himmelObjekter({ ...oslo, dato: new Date(iso), tvingHimmel: true })
        .map((o) => o.id)
      for (const id of ['mane', 'planet:mars', 'planet:jupiter', 'planet:saturn']) {
        expect(ider).toContain(id)
      }
    }
  })

  it('de fire tvungne står over horisonten — sola gjør bevisst ikke det', () => {
    // SOLA TVINGES IKKE OPP, og det er ikke en forglemmelse: hele poenget med
    // den er at den står der den står, og om natta er det under terrenget.
    // Bryteren finnes for legemer man ellers må VENTE på; sola er alltid der.
    const liste = himmelObjekter({
      ...oslo, dato: new Date('2026-01-15T02:00:00Z'), tvingHimmel: true,
    }).filter((o) => o.harGlobe)
    expect(liste.length).toBe(5)
    for (const o of liste) {
      if (o.type === 'sol') continue
      expect(o.hoyde, o.navn).toBeGreaterThan(0)
    }
    expect(liste.find((o) => o.type === 'sol').hoyde).toBeLessThan(0)
  })

  it('uten flagget er lista den ekte igjen', () => {
    // Bryteren skal ikke etterlate spor. Er den av, er himmelen himmelen.
    const dato = new Date('2026-01-15T02:00:00Z')
    const av = himmelObjekter({ ...oslo, dato })
    const paa = himmelObjekter({ ...oslo, dato, tvingHimmel: true })
    expect(paa.length).toBeGreaterThanOrEqual(av.length)
    expect(av.filter((o) => o.harGlobe).length).toBeLessThan(4)
  })
})

describe('naermesteTreff — trefflaten for et stjernebilde', () => {
  // Regelen som avgjør om en figur er til å treffe med en finger. Fram til
  // v6.3.11 ble trykket målt mot formasjonens SENTER, som for en stor figur
  // ligger i tom himmel — man måtte sikte på ingenting.
  const firkant = {
    // En hul firkant, 200 px på hver side, med hjørne i (100,100). Kefeus og
    // Karlsvognas bolle er nettopp dette: alt gjenkjennelig ligger på KANTEN.
    punkter: [
      { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 },
    ],
    segmenter: [[0, 1], [1, 2], [2, 3], [3, 0]],
  }
  const treff = (x, y, f = firkant) => naermesteTreff(x, y, f.punkter, f.segmenter)

  it('treffer en stjerne på null avstand', () => {
    expect(treff(100, 100)).toBeCloseTo(0, 6)
    expect(treff(300, 300)).toBeCloseTo(0, 6)
  })

  it('treffer STREKEN mellom to stjerner, ikke bare endepunktene', () => {
    // Midt på oversida: 200 px fra begge hjørnene, men rett på streken.
    expect(treff(200, 100)).toBeCloseTo(0, 6)
    expect(treff(200, 112)).toBeCloseTo(12, 6)
  })

  it('senteret av en hul figur er LANGT unna — det var den gamle feilen', () => {
    // Midt i firkanten er man 100 px fra nærmeste strek. Med senter-regelen var
    // dette punktet selve målet, og hvert punkt PÅ figuren var utenfor terskelen.
    expect(treff(200, 200)).toBeCloseTo(100, 6)
  })

  it('måler mot streken og ikke mot linja den ligger på', () => {
    // 100 px til venstre for venstre kant, på høyde med toppen: uten klipping av
    // projeksjonen ville en uendelig lang linje gitt 0 her.
    expect(treff(0, 100)).toBeCloseTo(100, 6)
    // Diagonalt utenfor hjørnet: avstanden er til HJØRNET.
    expect(treff(40, 40)).toBeCloseTo(Math.hypot(60, 60), 6)
  })

  it('hopper over punkter bak kameraet', () => {
    const f = {
      punkter: [{ x: 10, y: 10, bak: true }, { x: 500, y: 500 }],
      segmenter: [[0, 1]],
    }
    // Punktet bak kameraet projiserer til et speilbilde foran; tok vi det med,
    // ville en stjerne i ryggen stjålet trykket.
    expect(naermesteTreff(10, 10, f.punkter, f.segmenter))
      .toBeCloseTo(Math.hypot(490, 490), 6)
  })

  it('tåler tom og ødelagt inndata', () => {
    expect(naermesteTreff(0, 0, [], [])).toBe(Infinity)
    expect(naermesteTreff(0, 0, undefined, undefined)).toBe(Infinity)
    expect(naermesteTreff(0, 0, [{ x: 0, y: 0 }], [[0, 9]])).toBeCloseTo(0, 6)
    // Nullengde-strek skal ikke gi NaN.
    expect(naermesteTreff(5, 0, [{ x: 0, y: 0 }], [[0, 0]])).toBeCloseTo(5, 6)
  })
})

describe('formasjonenes trefflate følger det som tegnes', () => {
  it('bærer punkter og segmenter for stjernene over horisonten', () => {
    const formasjoner = himmelObjekter({ ...STED, dato: VINTER })
      .filter((o) => o.type === 'formasjon')
    expect(formasjoner.length).toBeGreaterThan(0)
    for (const o of formasjoner) {
      expect(o.punkter.length).toBeGreaterThan(0)
      expect(o.punkter.length).toBeLessThanOrEqual(o.antallStjerner)
      for (const p of o.punkter) {
        expect(p.hoyde).toBeGreaterThan(0)
        expect(Number.isFinite(p.azimut)).toBe(true)
      }
      // Hvert segment peker inn i punkter — en indeks på skeive gir en strek til
      // et sted på himmelen ingen kan trykke på.
      for (const [a, b] of o.segmenter) {
        expect(a).toBeGreaterThanOrEqual(0)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThan(o.punkter.length)
        expect(b).toBeLessThan(o.punkter.length)
        expect(a).not.toBe(b)
      }
      expect(o.segmenter.length).toBeLessThanOrEqual(o.linjer.length)
    }
  })

  it('utelater strek der en ende er under horisonten, som skyDome gjør', () => {
    // Samme regel som linjePunkter i skyDome: en halv figur med en strek ned i
    // bakken er verre enn ingen strek — og det man KAN treffe skal være det som
    // faktisk tegnes.
    const delvis = himmelObjekter({ ...STED, dato: VINTER })
      .filter((o) => o.type === 'formasjon' && o.punkter.length < o.antallStjerner)
    for (const o of delvis) {
      expect(o.segmenter.length).toBeLessThan(o.linjer.length)
    }
  })
})

describe('sola i himmellista', () => {
  const oslo = { lat: 59.91, lon: 10.75 }

  it('står først, med globe og et søkbart navn', () => {
    const liste = himmelObjekter({ ...oslo, dato: new Date('2026-01-15T22:00:00Z') })
    expect(liste[0].type).toBe('sol')
    expect(liste[0].harGlobe).toBe(true)
    for (const q of ['sol', 'Sola', 'solen', 'sun']) {
      expect(filtrerHimmel(liste, q).some((o) => o.type === 'sol'), q).toBe(true)
    }
  })

  it('står under horisonten om natta og over midt på dagen', () => {
    // Invarianten som gjør hele plasseringen riktig: sola tegnes der den er, og
    // om natta ER det under terrengarket. Ingen tvang, ingen fast plass.
    const natt = himmelObjekter({ ...oslo, dato: new Date('2026-01-15T23:00:00Z') })
      .find((o) => o.type === 'sol')
    const dag = himmelObjekter({ ...oslo, dato: new Date('2026-06-15T10:00:00Z') })
      .find((o) => o.type === 'sol')
    expect(natt.hoyde).toBeLessThan(0)
    expect(dag.hoyde).toBeGreaterThan(0)
  })

  it('undertekstene sier hvilken side av horisonten den er på', () => {
    const natt = himmelObjekter({ ...oslo, dato: new Date('2026-01-15T23:00:00Z') })
      .find((o) => o.type === 'sol')
    const t = himmelUndertekst(natt)
    expect(t).toContain('under horisonten')
    expect(t).not.toContain('over horisonten')
    expect(t).not.toMatch(/[-−]\d+°/)
  })

  it('kan velges som nabo, og gir ikke NaN for en høyde under null', () => {
    // vinkelAvstand regner med sin/cos av høyden, så en negativ høyde er helt
    // lovlig — men det er verdt å holde fast, siden alt annet i lista er positivt.
    const liste = himmelObjekter({ ...oslo, dato: new Date('2026-01-15T23:00:00Z') })
    const sol = liste.find((o) => o.type === 'sol')
    for (const n of naboerFor(sol, liste, 3)) {
      expect(Number.isFinite(n.avstandGrader)).toBe(true)
      expect(n.avstandGrader).toBeGreaterThanOrEqual(0)
      expect(n.avstandGrader).toBeLessThanOrEqual(180)
    }
  })
})

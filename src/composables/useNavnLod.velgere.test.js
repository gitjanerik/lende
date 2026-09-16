// VELGERNE I NAVN-LOD-EN MOT DET `mapBuilder` FAKTISK EMITTERER (v7.8.25).
//
// `SKJUL_VELGERE` er CSS-strenger som slås opp i en live kart-SVG. Slutter en av
// dem å matche — et lag bytter `data-layer`, et symbol får en gruppe til over
// seg — feiler den STILLE: ingenting kaster, ingenting ser rart ut, symbolet
// blir bare stående og lese tvers gjennom snarvei-raden igjen. Det er nøyaktig
// feilen dette sporet ble laget for, så testen bygger et ekte lite ark og spør
// om velgerne treffer det.
import { describe, it, expect } from 'vitest'
import { DOMParser } from 'linkedom'
import { buildSvg } from '../lib/mapBuilder.js'
import { _internals, spokelsesVelger } from './useNavnLod.js'

const BBOX = { south: 59.83, west: 10.44, north: 59.85, east: 10.48 }

// Ett av hvert: P-plass, holdeplass, en vei lang nok til å få skilt (>60 m), et
// hus, og en bymasse-flate som IKKE skal treffes av bygg-velgeren. Pluss et
// brenavn — den navne-typen som ble meldt fra felt (v7.8.30), og den eneste
// TEKSTEN i arket som ikke er et veinummer-skilt.
const ELEMENTER = [
  { type: 'node', id: 'bre1', lat: 59.8425, lon: 10.462,
    tags: { natural: 'glacier', name: 'Illåbrean', 'lende:n50navn': 'isbre' } },
  { type: 'node', id: 'p1', lat: 59.840, lon: 10.456, tags: { amenity: 'parking' } },
  { type: 'node', id: 'b1', lat: 59.8405, lon: 10.457, tags: { highway: 'bus_stop' } },
  {
    type: 'way', id: 'r1', tags: { highway: 'primary', ref: 'E18' },
    geometry: [{ lat: 59.834, lon: 10.445 }, { lat: 59.848, lon: 10.478 }],
  },
  {
    type: 'way', id: 'h1', tags: { building: 'yes' },
    geometry: [
      { lat: 59.8380, lon: 10.4520 }, { lat: 59.8380, lon: 10.4526 },
      { lat: 59.8384, lon: 10.4526 }, { lat: 59.8384, lon: 10.4520 },
      { lat: 59.8380, lon: 10.4520 },
    ],
  },
]

function arket() {
  const { svg } = buildSvg(ELEMENTER, BBOX)
  return new DOMParser().parseFromString(svg, 'image/svg+xml')
}

const velger = (sel) => _internals.SKJUL_VELGERE.find((v) => v.sel === sel)

describe('SKJUL_VELGERE treffer mapBuilders egne lag', () => {
  const doc = arket()

  it.each([
    ['g[data-layer="veinummer"] > g'],
    ['g[data-layer="parkering"] > g'],
    ['g[data-layer="holdeplass"] > g'],
    ['g[data-layer="bygning"][data-iso="521"] > path'],
  ])('%s finner minst ett element', (sel) => {
    expect(velger(sel), `${sel} står ikke i SKJUL_VELGERE`).toBeTruthy()
    expect(doc.querySelectorAll(sel).length).toBeGreaterThan(0)
  })

  it('veinummer-velgeren tar HELE skiltet, ikke bare teksten', () => {
    // Skjules bare teksten, står det hvite rektangelet igjen under raden — som
    // er verre enn tallet var.
    const skilt = doc.querySelector('g[data-layer="veinummer"] > g')
    expect(skilt.querySelector('rect')).toBeTruthy()
    expect(skilt.querySelector('text[data-label="veinummer"]')).toBeTruthy()
  })

  it('bygg-velgeren rører ikke tett bebyggelse (522)', () => {
    // Bymassen er BAKGRUNN i samme forstand som skogen: tar man den bort under
    // raden får man et hull i arket i stedet for et renere overlegg. Koden er
    // det som skiller dem, og det gjelder BEGGE formene den har hatt — på kart
    // bygget før v9.1.31 lå 522 under `data-layer="bygning"`, altså samme
    // lag-navn som husene.
    const sel = 'g[data-layer="bygning"][data-iso="521"] > path'
    const gammelt = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<g data-layer="bygning" data-iso="521"><path d="M0,0"/></g>'
      + '<g data-layer="bygning" data-iso="522"><path d="M1,1"/></g>'
      + '<g data-layer="bymasse" data-iso="522"><path d="M2,2"/></g>'
      + '</svg>', 'image/svg+xml')
    expect(gammelt.querySelectorAll(sel).length).toBe(1)
    expect(gammelt.querySelector(sel).getAttribute('d')).toBe('M0,0')
  })
})

describe('reglene per velger', () => {
  it('bygg krever full dekning, punkt-symbolene gjør det ikke', () => {
    // Se heltUnderHindring i labelDeclutter.js: bygg merges per rutenett-celle,
    // og en overlapp-test ville tatt bort hele cella.
    expect(velger('g[data-layer="bygning"][data-iso="521"] > path').helt).toBe(true)
    for (const sel of [
      'text[data-label="peak-ele"]',
      'g[data-layer="veinummer"] > g',
      'g[data-layer="parkering"] > g',
      'g[data-layer="holdeplass"] > g',
    ]) {
      expect(velger(sel).helt).toBe(false)
    }
  })

  it('bare punkt-symbolene har en reserve-boks', () => {
    // Høydetallet estimeres fra teksten sin, og et bygg har ingenting å gjette
    // fra — en gjettet boks der ville med full-dekning-regelen skjult en hel celle.
    expect(velger('text[data-label="peak-ele"]').reserve).toBeNull()
    expect(velger('g[data-layer="bygning"][data-iso="521"] > path').reserve).toBeNull()
    expect(velger('g[data-layer="parkering"] > g').reserve).toBeGreaterThan(0)
  })
})

// NABOFLISENES VELGERE (v7.8.30).
//
// `useGhostTiles` kloner arket, døper om `data-layer` → `data-ghost-layer` og
// nester det som et `<svg x y>` inne i `#ghost-tiles`. Det gjør at hver velger
// over treffer NULL elementer i en naboflis — stille, som alltid her. Testen
// bygger derfor den samme kloningen og spør om de avledede velgerne treffer.
describe('spøkelsesfliser', () => {
  function medNaboflis() {
    const doc = arket()
    const rot = doc.querySelector('svg')
    const flis = rot.cloneNode(true)
    // Nøyaktig det useGhostTiles gjør med lag-attributtet.
    for (const el of flis.querySelectorAll('[data-layer]')) {
      el.setAttribute('data-ghost-layer', el.getAttribute('data-layer'))
      el.removeAttribute('data-layer')
    }
    flis.setAttribute('x', '2000')
    flis.setAttribute('y', '0')
    const boks = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    boks.setAttribute('id', 'ghost-tiles')
    boks.appendChild(flis)
    rot.insertBefore(boks, rot.firstChild)
    return doc
  }

  const doc = medNaboflis()

  it.each(_internals.SKJUL_VELGERE.filter((v) => v.sel.includes('data-layer=')))(
    'den avledede velgeren for %o finner elementet i naboflisa',
    ({ sel }) => {
      const ghost = spokelsesVelger(sel)
      expect(ghost).toContain('data-ghost-layer=')
      expect(ghost).not.toContain('data-layer=')
      expect(doc.querySelectorAll(ghost).length).toBeGreaterThan(0)
      // Og den skal IKKE plukke opp aktiv flis — den har fortsatt data-layer.
      expect(doc.querySelectorAll(sel).length)
        .toBe(arket().querySelectorAll(sel).length)
    })

  it('navne-velgeren tar naboflisas tekst, men ikke veinummer-teksten', () => {
    const tekst = [...doc.querySelectorAll(_internals.GHOST_NAVN.sel)]
    expect(tekst.length).toBeGreaterThan(0)
    for (const t of tekst) {
      expect(t.closest('#ghost-tiles')).toBeTruthy()
      // Skiltet eies av `data-ghost-layer`-velgeren, som tar rect-en med.
      expect(t.getAttribute('data-label')).not.toBe('veinummer')
    }
    // Og veinummeret finnes faktisk i flisa — ellers måler ikke testen noe.
    expect(doc.querySelectorAll(
      '#ghost-tiles text[data-label="veinummer"]').length).toBeGreaterThan(0)
  })

  it('navne-velgeren rører ikke aktiv flis', () => {
    for (const t of doc.querySelectorAll('#ghost-tiles text[data-label]')) {
      expect(t.closest('#ghost-tiles')).toBeTruthy()
    }
    const utenNabo = arket()
    expect(utenNabo.querySelectorAll(_internals.GHOST_NAVN.sel).length).toBe(0)
  })
})

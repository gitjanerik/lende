// Hva kan man velge på himmelen akkurat nå — og hva heter det.
//
// Ren modul: ingen Three.js, ingen DOM. Den er delt av TRE kallere, og det er
// hele grunnen til at den finnes som egen fil:
//   • søkefeltet          — lista og fritekst-filteret
//   • trykk i himmelen    — kandidatene å plukke blant
//   • infokortet          — snarveiene til naboene
//
// Uten en felles kilde ville de tre hatt hver sin mening om hva som er synlig,
// og da svarer søket «Orion» på noe trykk ikke finner. Samme lærdom som
// mosaikk-regelen i CLAUDE.md: to steder som besvarer «hva ser jeg nå?» må
// svare likt.
//
// LISTA INNEHOLDER BARE DET LENDE FAKTISK TEGNER. En nedtrekksliste som lover
// et stjernebilde under horisonten er en felle, ikke en tjeneste.

import { FORMASJONER, STJERNER } from './stjerner.js'
import { STJERNEBILDE_INFO, sokeNavnFor } from './stjernebildeInfo.js'
import { synligePlaneter } from './planeter.js'
import { lokalStjernetid, tilHorisont, presesserTilDato, himmelFor } from './astronomi.js'

const GRAD = Math.PI / 180

/** Under dette regnes en formasjon som «ikke oppe» selv om noen stjerner er det. */
const MIN_ANDEL_OPPE = 0.6

/**
 * Vinkelavstand mellom to himmelretninger, i grader. Brukt til naboene.
 * @returns {number}
 */
export function vinkelAvstand(a, b) {
  const c = Math.sin(a.hoyde) * Math.sin(b.hoyde)
    + Math.cos(a.hoyde) * Math.cos(b.hoyde) * Math.cos(a.azimut - b.azimut)
  return Math.acos(Math.max(-1, Math.min(1, c))) / GRAD
}

/**
 * Alt som er valgbart på himmelen nå, sortert: månen først, så planetene etter
 * lysstyrke, så formasjonene alfabetisk. Rekkefølgen er den man legger merke
 * til dem i — månen er umulig å overse, en planet er neste, og et stjernebilde
 * må man lete etter.
 *
 * @param {{lat:number, lon:number, dato?: Date}} sted
 * @returns {Array<object>} hvert objekt har minst
 *   { id, type, navn, azimut, hoyde } — azimut/hoyde i RADIANER, som resten av
 *   3D-koden bruker.
 */
export function himmelObjekter({ lat, lon, dato = new Date() }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const lst = lokalStjernetid(dato, lon)
  const ut = []

  // --- Månen ---------------------------------------------------------------
  try {
    const h = himmelFor({ lat, lon, dato })
    if (h.mane.hoyde > 0) {
      ut.push({
        id: 'mane',
        type: 'mane',
        navn: 'Månen',
        latin: 'Luna',
        azimut: h.mane.azimut,
        hoyde: h.mane.hoyde,
        lysAndel: h.mane.lysAndel,
        voksende: h.mane.voksende,
        sokeNavn: ['Månen', 'Måne', 'Luna', 'Moon'],
      })
    }
  } catch { /* uten måne: resten av himmelen står fortsatt */ }

  // --- Planetene -----------------------------------------------------------
  for (const p of synligePlaneter({ lat, lon, dato })) {
    ut.push({
      id: `planet:${p.id}`,
      type: 'planet',
      navn: p.navn,
      azimut: p.azimut,
      hoyde: p.hoyde,
      mag: p.mag,
      farge: p.farge,
      avstandAE: p.avstandAE,
      lysAndel: p.lysAndel,
      elongasjon: p.elongasjon,
      sokeNavn: [p.navn],
    })
  }

  // --- Formasjonene --------------------------------------------------------
  for (const f of FORMASJONER) {
    // Hvor mye av figuren er oppe? En formasjon med to stjerner over horisonten
    // er ikke til å kjenne igjen, og å tilby den er å love noe vi ikke viser.
    let oppe = 0
    for (const i of f.stjerner) {
      const s = STJERNER[i]
      const j = presesserTilDato(s.ra, s.dek, dato)
      if (tilHorisont(j.ra, j.dek, lst, lat).hoyde > 0) oppe++
    }
    const andel = f.stjerner.length ? oppe / f.stjerner.length : 0
    if (andel < MIN_ANDEL_OPPE) continue

    // Senterretningen presesseres som stjernene, ellers peker blikket 16′ feil.
    const js = presesserTilDato(f.senterRa, f.senterDek, dato)
    const { azimut, hoyde } = tilHorisont(js.ra, js.dek, lst, lat)
    const info = STJERNEBILDE_INFO[f.id] ?? null
    const navngitte = f.stjerner
      .map((i) => STJERNER[i])
      .filter((s) => s.navn)
      .sort((a, b) => a.mag - b.mag)

    ut.push({
      id: f.id,
      type: 'formasjon',
      navn: f.navn,
      latin: f.latin,
      azimut,
      hoyde,
      andelOppe: andel,
      antallStjerner: f.stjerner.length,
      lysesteStjerne: navngitte[0] ?? null,
      stjernenavn: navngitte.map((s) => s.navn),
      info,
      // Sendes til skyDome.settValgt.
      stjerner: f.stjerner,
      linjer: f.linjer,
      sokeNavn: [
        f.navn,
        f.latin,
        ...f.stjerner.flatMap((i) => sokeNavnFor(STJERNER[i])),
      ],
    })
  }

  const rang = { mane: 0, planet: 1, formasjon: 2 }
  return ut.sort((a, b) => {
    if (rang[a.type] !== rang[b.type]) return rang[a.type] - rang[b.type]
    if (a.type === 'planet') return (a.mag ?? 99) - (b.mag ?? 99)
    return a.navn.localeCompare(b.navn, 'nb')
  })
}

/**
 * Fritekst-filter. Treffer norsk navn, latinsk navn og stjernenavn — så «Vega»
 * finner Lyren og «Polstjerna» finner Lille bjørn.
 *
 * Tom søkestreng gir hele lista uendret; det er nedtrekkslista.
 *
 * @param {Array<object>} objekter
 * @param {string} q
 */
export function filtrerHimmel(objekter, q) {
  const s = (q ?? '').trim().toLowerCase()
  if (!s) return objekter
  return objekter.filter((o) => (o.sokeNavn ?? [o.navn])
    .some((n) => n && n.toLowerCase().includes(s)))
}

/**
 * De nærmeste andre objektene på himmelen — snarveiene i infokortet. Det er
 * stjernehopping, og det er den beste måten å lære seg himmelen.
 *
 * @param {object} valgt
 * @param {Array<object>} alle
 * @param {number} [antall]
 */
export function naboerFor(valgt, alle, antall = 3) {
  if (!valgt) return []
  return alle
    .filter((o) => o.id !== valgt.id)
    .map((o) => ({ ...o, avstandGrader: vinkelAvstand(valgt, o) }))
    .sort((a, b) => a.avstandGrader - b.avstandGrader)
    .slice(0, antall)
}

/**
 * Hva skal stå som undertittel i lista? Én linje som sier hva slags objekt det
 * er og hvor det står, fordi «Jupiter» alene ikke hjelper noen med å finne det.
 */
export function himmelUndertekst(o) {
  const hoyde = Math.round(o.hoyde / GRAD)
  const retning = kompass(o.azimut / GRAD)
  if (o.type === 'planet') {
    return `Planet · ${retning}, ${hoyde}° over horisonten · lysstyrke ${komma(o.mag, 1)}`
  }
  if (o.type === 'mane') {
    return `Månen · ${retning}, ${hoyde}° over horisonten · ${Math.round(o.lysAndel * 100)} % opplyst`
  }
  return `${o.latin} · ${retning}, ${hoyde}° over horisonten · ${o.antallStjerner} stjerner`
}

const komma = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '–')

/** Himmelretning på norsk, i åtte deler. */
export function kompass(grader) {
  const navn = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest']
  const i = Math.round(((grader % 360) + 360) % 360 / 45) % 8
  return navn[i]
}

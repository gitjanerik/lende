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
import { stjerneNavn, bayerNavn, stjernebildeFor, faktaFor } from './stjerneFakta.js'
import { synligePlaneter } from './planeter.js'
import { harGlobe } from './himmellegemer.js'
import { lokalStjernetid, tilHorisont, presesserTilDato, himmelFor } from './astronomi.js'

const GRAD = Math.PI / 180

/** Under dette regnes en formasjon som «ikke oppe» selv om noen stjerner er det. */
const MIN_ANDEL_OPPE = 0.6

/**
 * Katalog-indeksene som inngår i en figur vi tegner.
 *
 * Alt som IKKE er her, er en «løs» stjerne: den tegnes på himmelen uten en
 * eneste strek til noe annet, fordi vi ikke har figuren dens. Det er 57 av 173,
 * og de er ikke svake — katalogen tar alt lysere enn magnitude 2,6, så det er
 * blant andre Sirius, Aldebaran, Altair, Antares og Spica.
 *
 * FRAM TIL v6.4.0 VAR DE IKKE VALGBARE, og det leste eieren som en feil: en
 * skjerm med prikker uten streker, uten noen måte å spørre hva de er. De er nå
 * med i lista på lik linje med formasjonene — søkbare, valgbare og med et
 * infokort — mens stjernene som ER i en figur bevisst IKKE er det: der er
 * figuren svaret, og to trefflater oppå hverandre ville bare stjålet trykk fra
 * hverandre. (Stjernenavnene i en figur er fortsatt søkbare gjennom figuren:
 * «Vega» finner Lyren.)
 */
const I_FORMASJON = new Set(FORMASJONER.flatMap((f) => f.stjerner))

/** De latinske navnene på figurene vi FAKTISK tegner. Se `tegnesFigur` under. */
const TEGNEDE_FIGURER = new Set(FORMASJONER.map((f) => f.latin))

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
 * @param {{lat:number, lon:number, dato?: Date, tvingHimmel?: boolean}} sted
 *   tvingHimmel  UTVIKLER-BRYTER: løft alle legemer med globe over horisonten.
 * @returns {Array<object>} hvert objekt har minst
 *   { id, type, navn, azimut, hoyde } — azimut/hoyde i RADIANER, som resten av
 *   3D-koden bruker.
 */
export function himmelObjekter({ lat, lon, dato = new Date(), tvingHimmel = false }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const lst = lokalStjernetid(dato, lon)
  const ut = []

  // --- Månen ---------------------------------------------------------------
  // tvingHimmel er utvikler-bryteren, og for månen bor den i himmelFor — som er
  // den samme funksjonen skiva på himmelen bygges av. Da kan lista og himmelen
  // ikke komme i utakt. For planetene bor den i synligePlaneter, av samme grunn.
  try {
    const h = himmelFor({ lat, lon, dato, tvingMane: tvingHimmel })
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
        // Med til månegloben: fase, lyssidens retning på skjermen, og rullen
        // som setter kula i samme stilling som sigden på himmelen.
        faseVinkel: h.mane.faseVinkel,
        lyssideVinkel: h.mane.lyssideVinkel,
        parallaktisk: h.mane.parallaktisk,
        harGlobe: true,
        sokeNavn: ['Månen', 'Måne', 'Luna', 'Moon'],
      })
    }
  } catch { /* uten måne: resten av himmelen står fortsatt */ }

  // --- Planetene -----------------------------------------------------------
  for (const p of synligePlaneter({ lat, lon, dato, tving: tvingHimmel })) {
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
      // Med til globen. Fasevinkelen regnes ut av den opplyste andelen —
      // k = (1 + cos f) / 2 — så lyset på kula står der det faktisk står. For de
      // ytre planetene er f nær 0 (nesten fullt opplyst); for Merkur og Venus kan
      // den være stor, men de har ingen globe.
      faseVinkel: Math.acos(Math.max(-1, Math.min(1, 2 * (p.lysAndel ?? 1) - 1))),
      // Ingen parallaktisk vinkel for planetene (se settPlaneter i skyDome): på
      // 0,45° er retningen på en sigd under det man ser. Lyssida står opp.
      lyssideVinkel: 0,
      harGlobe: harGlobe(p.id),
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
    // TREFFLATEN. Fram til v6.3.11 ble et trykk målt mot formasjonens SENTER, og
    // for en figur som spenner 40° — Dragen, Karlsvognen — ligger senteret i tom
    // himmel langt fra alt man ser. Man måtte altså sikte på ingenting. Nå bærer
    // objektet stjernene og strekene sine, og `naermesteTreff` måler mot dem: du
    // treffer figuren der den ER.
    //
    // Bare stjerner OVER horisonten, og bare streker med begge ender oppe — samme
    // regel som `linjePunkter` i skyDome, så det man kan treffe er nøyaktig det
    // som tegnes.
    const punktIndeks = new Map()
    const punkter = []
    for (const i of f.stjerner) {
      const s = STJERNER[i]
      const j = presesserTilDato(s.ra, s.dek, dato)
      const h = tilHorisont(j.ra, j.dek, lst, lat)
      if (h.hoyde <= 0) continue
      punktIndeks.set(i, punkter.length)
      punkter.push({ azimut: h.azimut, hoyde: h.hoyde })
    }
    const segmenter = []
    for (const [a, b] of f.linjer) {
      const ia = punktIndeks.get(a)
      const ib = punktIndeks.get(b)
      if (ia == null || ib == null) continue
      segmenter.push([ia, ib])
    }

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
      // Sendes til plukkHimmel (scene3d) — se naermesteTreff.
      punkter,
      segmenter,
      sokeNavn: [
        f.navn,
        f.latin,
        ...f.stjerner.flatMap((i) => sokeNavnFor(STJERNER[i])),
      ],
    })
  }

  // --- Løse stjerner -------------------------------------------------------
  // Se I_FORMASJON over for hvorfor bare disse er med.
  for (let i = 0; i < STJERNER.length; i++) {
    if (I_FORMASJON.has(i)) continue
    const s = STJERNER[i]
    const j = presesserTilDato(s.ra, s.dek, dato)
    const { azimut, hoyde } = tilHorisont(j.ra, j.dek, lst, lat)
    // Samme port som resten av lista: den lover bare det som faktisk tegnes.
    // Den tar samtidig hånd om at katalogen er hel-himmels — Canopus og
    // Sørkorset står i HYG, men kommer aldri over en norsk horisont.
    if (hoyde <= 0) continue
    const sb = stjernebildeFor(s.bayer)
    ut.push({
      id: `stjerne:${i}`,
      type: 'stjerne',
      navn: stjerneNavn(s),
      // Bayer-betegnelsen skrevet ut («α Tauri») står som sekundærnavn, der
      // formasjonene har det latinske navnet sitt. For en stjerne UTEN egennavn
      // ER den navnet, og da settes den ikke to ganger.
      latin: s.navn ? bayerNavn(s.bayer) : null,
      azimut,
      hoyde,
      mag: s.mag,
      // Hvilket stjernebilde stjerna hører til — det er svaret på «hvorfor står
      // den alene?»: figuren finnes, vi tegner den bare ikke.
      stjernebilde: sb,
      // Tegner vi figuren stjerna hører til? I dag er svaret alltid nei — en
      // stjerne er løs nettopp fordi ingen av kjedene våre bruker den — men det
      // er ikke garantert av noe: en figur kan godt utelate en lys stjerne
      // innenfor sine egne grenser. Kortet sier «vi tegner ikke figuren» bare
      // når det er sant, framfor å anta det.
      tegnesFigur: !!sb && TEGNEDE_FIGURER.has(sb.latin),
      fakta: faktaFor(s),
      // Sendes til skyDome.settValgt, som løfter stjerna. Tom linjeliste er
      // meningen: en enkeltstjerne har ingen strek å fremheve.
      stjerner: [i],
      linjer: [],
      sokeNavn: [
        ...sokeNavnFor(s),
        bayerNavn(s.bayer),
        // Stjernebildets navn er søkbart gjennom stjerna: skriver man «Tyren»,
        // er Aldebaran det nærmeste et svar vi har.
        sb?.norsk,
        sb?.latin,
      ].filter(Boolean),
    })
  }

  // Rekkefølgen er den man legger merke til dem i: månen er umulig å overse, en
  // planet er neste, et stjernebilde må man lete etter — og en enkeltstjerne er
  // det man ender med å lure på når figurene er talt opp. Stjernene sorteres på
  // lysstyrke som planetene: er man i tvil om hvilken prikk man trykket på, er
  // den lyseste det beste første gjettet.
  const rang = { mane: 0, planet: 1, formasjon: 2, stjerne: 3 }
  return ut.sort((a, b) => {
    if (rang[a.type] !== rang[b.type]) return rang[a.type] - rang[b.type]
    if (a.type === 'planet' || a.type === 'stjerne') return (a.mag ?? 99) - (b.mag ?? 99)
    return a.navn.localeCompare(b.navn, 'nb')
  })
}

/**
 * Korteste avstand fra fingeren til en figur, i SKJERMPIKSLER.
 *
 * Trykk i himmelen plukkes i skjermrom (se plukkHimmel i scene3d) fordi en
 * stjernebilde-strek er under to piksler bred og en stjerne en prikk — å treffe
 * dem med en stråle er praktisk umulig på en telefon. Denne funksjonen svarer på
 * «hvor nær er fingeren figuren», og den måler mot BÅDE punktene og strekene:
 * en tom firkant som Kefeus har alt det gjenkjennelige på kantene, ikke i midten.
 *
 * Ren og enhetstestet, fordi det er regelen som avgjør om noe er til å treffe.
 *
 * @param {number} fx fingerens x i CSS-piksler
 * @param {number} fy fingerens y
 * @param {Array<{x:number,y:number,bak:boolean}>} punkter projiserte stjerner.
 *   `bak` = bak kameraet; slike hoppes over, ellers ville et punkt rett bak deg
 *   projisert til et speilbilde foran deg og stjålet trykket.
 * @param {Array<[number,number]>} segmenter indekspar inn i punkter
 * @returns {number} avstand i piksler, Infinity om ingenting er synlig
 */
export function naermesteTreff(fx, fy, punkter, segmenter) {
  let best = Infinity
  if (!punkter?.length) return best
  for (const p of punkter) {
    if (!p || p.bak) continue
    const d = Math.hypot(p.x - fx, p.y - fy)
    if (d < best) best = d
  }
  for (const [ia, ib] of segmenter ?? []) {
    const a = punkter[ia]
    const b = punkter[ib]
    if (!a || !b || a.bak || b.bak) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    // Nullengde-strek: endepunktene er alt målt over.
    if (len2 <= 1e-9) continue
    // Projeksjonen klippes til [0,1] så vi måler mot STREKEN og ikke mot linja
    // den ligger på — uten klippingen treffer man en uendelig lang strek.
    const t = Math.max(0, Math.min(1, ((fx - a.x) * dx + (fy - a.y) * dy) / len2))
    const d = Math.hypot(a.x + t * dx - fx, a.y + t * dy - fy)
    if (d < best) best = d
  }
  return best
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
  if (o.type === 'stjerne') {
    const hvor = o.stjernebilde ? `Stjerne i ${o.stjernebilde.norsk}` : 'Stjerne'
    return `${hvor} · ${retning}, ${hoyde}° over horisonten · lysstyrke ${komma(o.mag, 1)}`
  }
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

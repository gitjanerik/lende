// Kartinnhold for Lende-chatten: kulturminner, målestasjoner og stier i ÉN
// indeks, slik at chatten kan telle, søke og måle avstand uten at modellen
// regner noe selv. Ren og DOM-fri — lendeAiTools henter dataene og sender dem
// inn, testene sender inn hånd-lagde lister.
//
// Alle objekter har formen { id, type, kilde, navn, kategori, lat, lon, x, y,
// attrs }. x/y er kartets meter-koordinater (samme rom som stiene), og stier
// har i tillegg `geom` (meter) og `lengdeM`.

import { kulturminneKategori } from './kulturminneFetcher.js'

const KATEGORI_NAVN = {
  fangst: 'Fangstanlegg',
  gravminne: 'Gravminne',
  stein: 'Stein/bergkunst',
  bygning: 'Bygning/tuft',
  annet: 'Annet kulturminne',
}

const STI_TYPER = {
  503: { type: 'vei', kategori: 'Småvei' },
  504: { type: 'vei', kategori: 'Skogsvei' },
  505: { type: 'sti', kategori: 'Sti' },
  506: { type: 'sti', kategori: 'Uklar sti' },
  507: { type: 'sti', kategori: 'Stitråkk' },
}

export const PUNKT_TYPER = ['kulturminne', 'malestasjon']

/**
 * @param {object} kilder
 * @param {Array} [kilder.brukerminner]  fra fetchKulturminnerMedStatus (Kulturminnesøk)
 * @param {Array} [kilder.fredede]       fra fetchFredaKulturminner (Askeladden via WFS)
 * @param {Array} [kilder.stasjoner]     fra fetchStationsForBbox (NVE HydAPI)
 * @param {Array} [kilder.stier]         fra stinettFeaturesFromSvgEl ({coordinates, isomCode})
 * @param {(lat:number, lon:number) => {x:number,y:number}} tilMeter
 * @param {(x:number, y:number) => {lat:number,lon:number}} tilWgs
 */
export function byggIndeks({ brukerminner = [], fredede = [], stasjoner = [], stier = [] }, tilMeter, tilWgs) {
  const ut = []
  const punkt = (o) => {
    if (!Number.isFinite(o.lat) || !Number.isFinite(o.lon)) return
    const { x, y } = tilMeter(o.lat, o.lon)
    ut.push({ ...o, x, y })
  }
  for (const k of brukerminner) {
    const kat = k.kategori ?? kulturminneKategori(k.tittel)
    punkt({
      id: `km:${k.id}`, type: 'kulturminne', kilde: 'brukerminne',
      navn: k.tittel || 'Kulturminne uten navn',
      kategori: KATEGORI_NAVN[kat] ?? KATEGORI_NAVN.annet,
      lat: k.lat, lon: k.lon, attrs: { kildeNavn: 'Kulturminnesøk (brukerregistrert)' },
    })
  }
  for (const f of fredede) {
    punkt({
      id: `fm:${f.id}`, type: 'kulturminne', kilde: 'fredet',
      navn: f.navn || f.art || 'Fredet kulturminne',
      kategori: f.art || f.kategoriLabel || 'Arkeologisk kulturminne',
      lat: f.lat, lon: f.lon,
      attrs: utenTomme({
        kildeNavn: 'Riksantikvaren (Askeladden)',
        art: f.art, enkeltminnekategori: f.kategoriLabel, datering: f.datering,
        vern: f.vernetype, beskrivelse: kortTekst(f.informasjon ?? f.lokalitetInfo, 400),
        lenke: f.link,
      }),
    })
  }
  for (const s of stasjoner) {
    punkt({
      id: `nve:${s.stationId}`, type: 'malestasjon', kilde: 'nve',
      navn: s.stationName || `Stasjon ${s.stationId}`,
      kategori: 'Hydrologisk målestasjon',
      lat: Number(s.latitude), lon: Number(s.longitude),
      attrs: utenTomme({
        kildeNavn: 'NVE HydAPI', stasjonsnummer: s.stationId, vassdrag: s.riverName,
        moh: Number.isFinite(Number(s.masl)) ? Number(s.masl) : null,
        nedborfeltKm2: Number.isFinite(Number(s.drainageBasinArea)) ? Number(s.drainageBasinArea) : null,
      }),
    })
  }
  let n = 0
  for (const f of stier) {
    const def = STI_TYPER[f.isomCode]
    const geom = f.coordinates
    if (!def || !Array.isArray(geom) || geom.length < 2) continue
    const lengdeM = linjeLengde(geom)
    const mid = punktLangs(geom, lengdeM / 2)
    const ll = tilWgs(mid[0], mid[1])
    ut.push({
      id: `${def.type}:${n++}`, type: def.type, kilde: 'kart', navn: def.kategori,
      kategori: def.kategori, lat: ll.lat, lon: ll.lon, x: mid[0], y: mid[1],
      geom, lengdeM, attrs: {},
    })
  }
  return ut
}

/** Antall per type, fordelt på kategori og kilde. Uten type: alle punkt-typer. */
export function tell(indeks, { type } = {}) {
  const typer = type ? [type] : PUNKT_TYPER
  const ut = {}
  for (const t of typer) {
    const rader = indeks.filter((o) => o.type === t)
    const perKategori = {}
    const perKilde = {}
    let lengdeM = 0
    for (const o of rader) {
      perKategori[o.kategori] = (perKategori[o.kategori] ?? 0) + 1
      perKilde[o.kilde] = (perKilde[o.kilde] ?? 0) + 1
      lengdeM += o.lengdeM ?? 0
    }
    ut[t] = {
      antall: rader.length,
      perKategori: sortertEtterAntall(perKategori),
      ...(Object.keys(perKilde).length > 1 ? { perKilde } : {}),
      ...(lengdeM ? { lengdeKm: +(lengdeM / 1000).toFixed(1) } : {}),
    }
  }
  return ut
}

/**
 * Fritekstsøk i navn, kategori og art. Alle ordene må finnes; treff der
 * navnet starter med søket kommer først.
 */
export function sok(indeks, { type, tekst = '', maks = 8 } = {}) {
  const ord = fold(tekst).split(/\s+/).filter(Boolean)
  const kandidater = indeks.filter((o) => (type ? o.type === type : PUNKT_TYPER.includes(o.type)))
  if (!ord.length) return kandidater.slice(0, maks)
  const treff = []
  for (const o of kandidater) {
    const hay = fold(`${o.navn} ${o.kategori} ${o.attrs?.art ?? ''} ${o.attrs?.vassdrag ?? ''}`)
    if (!ord.every((w) => hay.includes(w))) continue
    treff.push({ o, rang: fold(o.navn).startsWith(ord[0]) ? 0 : fold(o.navn).includes(ord[0]) ? 1 : 2 })
  }
  treff.sort((a, b) => a.rang - b.rang || a.o.navn.localeCompare(b.o.navn, 'nb'))
  return treff.slice(0, maks).map((t) => t.o)
}

/**
 * Nærmeste objekter av en type fra et punkt ({x,y,lat,lon}). Punkt mot punkt
 * måles med haversine, punkt mot sti som korteste avstand til et linjestykke.
 */
export function naermeste(indeks, fra, { type, maks = 5, unntak = null } = {}) {
  const ut = []
  for (const o of indeks) {
    if (type ? o.type !== type : !PUNKT_TYPER.includes(o.type)) continue
    if (unntak && o.id === unntak) continue
    let avstandM
    let retningTil = o
    if (o.geom) {
      const naer = naermestePaaLinje(o.geom, fra.x, fra.y)
      avstandM = naer.avstand
      retningTil = { x: naer.x, y: naer.y }
    } else {
      avstandM = haversineM(fra.lat, fra.lon, o.lat, o.lon)
    }
    ut.push({ o, avstandM, retning: kompass(fra, retningTil) })
  }
  ut.sort((a, b) => a.avstandM - b.avstandM)
  return ut.slice(0, maks)
}

/** For hvert objekt i `fra`: avstand til nærmeste objekt av `type`. Stigende. */
export function naermesteFor(indeks, fraListe, { type, maks = 5 } = {}) {
  const ut = []
  for (const fra of fraListe) {
    const [beste] = naermeste(indeks, fra, { type, maks: 1, unntak: fra.id })
    if (beste) ut.push({ fra, til: beste.o, avstandM: beste.avstandM, retning: beste.retning })
  }
  ut.sort((a, b) => a.avstandM - b.avstandM)
  return ut.slice(0, maks)
}

/** Kompakt form til modellen. Koordinatene trengs for foreslaa_tur. */
export function kort(o) {
  const ut = { id: o.id, navn: o.navn, type: o.type, kategori: o.kategori }
  if (o.lengdeM != null) ut.lengdeM = Math.round(o.lengdeM)
  ut.lat = +o.lat.toFixed(5)
  ut.lon = +o.lon.toFixed(5)
  return ut
}

export function beskriv(o) {
  return { ...kort(o), kilde: o.kilde, ...o.attrs }
}

// ---------------------------------------------------------------------------

export function haversineM(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLon = (lon2 - lon1) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function naermestePaaLinje(geom, px, py) {
  let best = { avstand: Infinity, x: geom[0][0], y: geom[0][1] }
  for (let i = 1; i < geom.length; i++) {
    const [ax, ay] = geom[i - 1]
    const [bx, by] = geom[i]
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
    const x = ax + t * dx
    const y = ay + t * dy
    const d = Math.hypot(px - x, py - y)
    if (d < best.avstand) best = { avstand: d, x, y }
  }
  return best
}

function linjeLengde(geom) {
  let l = 0
  for (let i = 1; i < geom.length; i++) l += Math.hypot(geom[i][0] - geom[i - 1][0], geom[i][1] - geom[i - 1][1])
  return l
}

function punktLangs(geom, m) {
  let rest = m
  for (let i = 1; i < geom.length; i++) {
    const [ax, ay] = geom[i - 1]
    const [bx, by] = geom[i]
    const l = Math.hypot(bx - ax, by - ay)
    if (rest <= l && l > 0) return [ax + (bx - ax) * (rest / l), ay + (by - ay) * (rest / l)]
    rest -= l
  }
  return geom[geom.length - 1]
}

// Kartets y vokser SØROVER (SVG), derfor -dy for nord.
const RETNINGER = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest']
export function kompass(fra, til) {
  const dx = til.x - fra.x
  const dy = til.y - fra.y
  if (Math.hypot(dx, dy) < 1) return null
  const grader = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
  return RETNINGER[Math.round(grader / 45) % 8]
}

export function fold(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

function sortertEtterAntall(obj) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]))
}

function utenTomme(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''))
}

function kortTekst(s, maks) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t || null
}

/**
 * Hvilke treff fra verktøysvarene skal bli klikkbare i chatboblen? De som
 * svaret faktisk nevner ved navn; nevner det ingen, de første (svaret kan
 * godt si «tre gravhauger» uten å navngi dem).
 */
export function velgPekere(treff, tekst, maks = 6) {
  const unike = []
  const sett = new Set()
  for (const t of treff) {
    if (!t?.id || sett.has(t.id) || !Number.isFinite(t.lat)) continue
    sett.add(t.id)
    unike.push(t)
  }
  const f = fold(tekst)
  // Stinavnet er bare «Sti», som står i nesten hvert svar — en sti tas med når
  // den var et svar, ikke fordi ordet ble nevnt.
  const nevnt = unike.filter((t) => t.type === 'sti' || t.type === 'vei' || (t.navn && f.includes(fold(t.navn))))
  if (!unike.some((t) => t.type !== 'sti' && t.type !== 'vei' && f.includes(fold(t.navn)))) {
    return unike.slice(0, maks)
  }
  return (nevnt.length ? nevnt : unike).slice(0, maks)
}

// Offisielle fredede kulturminner (Riksantikvaren/Askeladden) som EKTE VEKTOR
// via Geonorge WFS — https://wfs.geonorge.no/skwms1/wfs.kulturminner
//
// Dette er kilden vi lette lenge etter: WFS 2.0.0 (deegree), CORS `*`, bbox-
// filter, geometri, rike felt OG `resultType=hits` for eksakt antall. Erstatter
// det tidligere WMS-raster-forsøket (se minne «askeladden-no-vector-api»).
//
// Vi henter LOKALITETER (sted-nivå = færre, ryddigere enn enkeltminner) i
// kartets bbox, regner et sentroide fra flate-geometrien, og MapView tegner dem
// som egne vektor-ikoner (roterer/zoomer/print-trygt) med klikk → detalj + lenke.
//
// Output er GML 3.2 (ikke GeoJSON) — vi parser med regex (DOM-fri, testbar).
// EPSG:4258 (ETRS89) ≈ WGS84; akserekkefølge lat,lon (både i bbox og posList).

const WFS_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_KULTURMINNE_WFS_URL) ||
  'https://wfs.geonorge.no/skwms1/wfs.kulturminner'
const APP_NS = 'http://skjema.geonorge.no/SOSI/produktspesifikasjon/LokaliteterEnkeltminnerOgSikringssoner/20210217'
// Enkeltminne (ikke Lokalitet): gir detalj PR KOORDINAT — hvert enkeltminne har
// eget navn (f.eks. «Kasernen», «Ammunisjonsarbeidshus», bunker/stilling) og egen
// `informasjon`. Lokalitet-nivå ga samme tekst for hele f.eks. «Oscarsborg festning».
const TYPE = 'app:Enkeltminne'
const CRS = 'urn:ogc:def:crs:EPSG::4258'

function bboxParam(bbox) {
  // EPSG:4258 → lat,lon-rekkefølge, med CRS-URI som femte ledd (WFS 2.0.0).
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east},${CRS}`
}

/**
 * Bygg WFS GetFeature-URL. `hits: true` gir kun antall (numberMatched), ellers
 * hentes inntil `count` features med geometri.
 */
export function buildWfsUrl(bbox, { hits = false, count = 400 } = {}) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: TYPE,
    namespaces: `xmlns(app,${APP_NS})`,
    srsName: CRS,
    bbox: bboxParam(bbox),
  })
  if (hits) p.set('resultType', 'hits')
  else p.set('count', String(count))
  return `${WFS_BASE}?${p}`
}

async function safeFetchText(url, { signal, timeoutMs = 12000, retries = 1 }) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return null
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (res.ok) return await res.text()
    } catch (e) {
      if (signal?.aborted) return null
      if (attempt === retries) console.warn(`[Fredet-kulturminne] WFS feilet (${retries + 1} forsøk): ${e?.message ?? e}`)
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    if (attempt < retries && !signal?.aborted) await new Promise((r) => setTimeout(r, 600))
  }
  return null
}

/** Rask teller (numberMatched) for kartets bbox — liten payload, ingen geometri. */
export async function fetchFredaCount(bbox, opts = {}) {
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) return null
  const txt = await safeFetchText(buildWfsUrl(bbox, { hits: true }), opts)
  if (!txt) return null
  const m = txt.match(/numberMatched="?(\d+)"?/)
  return m ? Number(m[1]) : null
}

/**
 * Hent lokaliteter i bbox som flate objekter.
 * @returns {Promise<Array<{id,lat,lon,navn,art,vernetype,kommune,link,kategori}>>}
 */
export async function fetchFredaKulturminner(bbox, opts = {}) {
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) return []
  const txt = await safeFetchText(buildWfsUrl(bbox, { count: opts.maxTotal ?? 600 }), opts)
  if (!txt) return []
  return parseWfsKulturminner(txt)
}

// Enkel klynging: dropp punkter som ligger nærmere enn `minM` meter fra et
// allerede beholdt punkt (greedy, i input-rekkefølge). Tette lokalitet-felt
// (Håøya har 244) blir ellers en uleselig klump ved oversikts-zoom.
export function clusterByMinMeters(items, minM = 45) {
  const kept = []
  const R = 6371000, toRad = Math.PI / 180
  const near = (a, b) => {
    const lat0 = ((a.lat + b.lat) / 2) * toRad
    const dLat = (b.lat - a.lat) * toRad
    const dLon = (b.lon - a.lon) * toRad * Math.cos(lat0)
    return R * Math.hypot(dLat, dLon) < minM
  }
  for (const it of items) {
    if (!kept.some((k) => near(k, it))) kept.push(it)
  }
  return kept
}

// Sentroide (gjennomsnitt) fra en gml:posList «lat lon lat lon …» (EPSG:4258).
export function centroidFromPosList(posList) {
  if (!posList) return null
  const nums = posList.trim().split(/\s+/).map(Number)
  if (nums.length < 2) return null
  let sLat = 0, sLon = 0, n = 0
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const lat = nums[i], lon = nums[i + 1]
    if (Number.isFinite(lat) && Number.isFinite(lon)) { sLat += lat; sLon += lon; n++ }
  }
  if (!n) return null
  return { lat: sLat / n, lon: sLon / n }
}

// `informasjon` på et enkeltminne er ofte «Beskrivelse fra lokalitet: <felles>
// [nl][nl] Beskrivelse fra Enkeltminne: <unik>». Del i to så vi kan vise den
// UNIKE (enkeltminne-)teksten tydelig og lokalitet-teksten som sekundær kontekst
// — ellers ser alle punktene i f.eks. «Oscarsborg festning» like ut på toppen.
export function splitInformasjon(raw) {
  if (!raw) return { enkeltminne: null, lokalitet: null }
  const s = String(raw)
  const enkIdx = s.search(/Beskrivelse fra Enkeltminne\s*:/i)
  const lokIdx = s.search(/Beskrivelse fra lokalitet\s*:/i)
  if (enkIdx >= 0) {
    const enk = s.slice(enkIdx).replace(/^Beskrivelse fra Enkeltminne\s*:\s*/i, '').trim()
    let lok = null
    if (lokIdx >= 0 && lokIdx < enkIdx) {
      lok = s.slice(lokIdx, enkIdx).replace(/^Beskrivelse fra lokalitet\s*:\s*/i, '').trim() || null
    }
    return { enkeltminne: enk || null, lokalitet: lok }
  }
  const whole = s.replace(/^Beskrivelse fra lokalitet\s*:\s*/i, '').trim()
  return { enkeltminne: whole || null, lokalitet: null }
}

function firstTag(block, tag) {
  // Tåler æ/ø/å i tagnavn (linkKulturminnesøk, område …).
  const re = new RegExp(`<app:${tag}>([^<]*)</app:${tag}>`, 'i')
  const m = block.match(re)
  return m ? decodeEntities(m[1].trim()) : null
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

// WFS-en gir vernetype som SOSI-KODE (ikke tekst). Kartlegg til lesbar tekst +
// farge-kategori. (Observerte koder: AUT, VED, LIST, UAV, IKKEV, FJE, FPG.)
const VERNETYPE = {
  AUT: ['Automatisk fredet', 'automatisk'],
  VED: ['Vedtaksfredet', 'vedtak'],
  MFR: ['Midlertidig fredet', 'vedtak'],
  FPG: ['Fredet', 'vedtak'],
  LIST: ['Listeført', 'listefort'],
  FJE: ['Fjernet', 'annet'],
  UAV: ['Uavklart vern', 'annet'],
  IKKEV: ['Ikke fredet', 'annet'],
}
export function vernInfo(code) {
  const k = String(code ?? '').toUpperCase()
  const v = VERNETYPE[k]
  return { text: v ? v[0] : (code || null), kategori: v ? v[1] : 'annet' }
}

// SOSI-kodelister fra Riksantikvarens produkt «Lokaliteter, enkeltminner og
// sikringssoner» (v20210217). Kodene kommer som tall/E-strenger i WFS-en; vi
// oversetter til lesbar bokmål her. Ukjente koder → null (visningen faller
// tilbake / hopper over feltet), så vi aldri viser en gjettet etikett.
const ENKELTMINNEKATEGORI = {
  'E-ARK': 'Arkeologisk enkeltminne',
  'E-BER': 'Bergkunst',
  'E-BYG': 'Bygning',
  'E-MAR': 'Kulturminne under vann',
  'E-TEK': 'Teknisk/industrielt enkeltminne',
  'E-UTE': 'Utomhuselement',
}
export function enkeltminnekategoriLabel(code) {
  return ENKELTMINNEKATEGORI[String(code ?? '').toUpperCase()] ?? null
}

// Datering (arkeologisk periode / tidsrom). Verifisert mot RA/Geonorge-kodelisten.
const DATERING = {
  '000': 'Førreformatorisk tid', '020': 'Steinalder', '021': 'Eldre steinalder',
  '022': 'Yngre steinalder', '030': 'Bronsealder', '031': 'Eldre bronsealder',
  '032': 'Yngre bronsealder', '040': 'Jernalder', '041': 'Eldre jernalder',
  '042': 'Førromersk jernalder', '043': 'Romertid', '044': 'Folkevandringstid',
  '045': 'Yngre jernalder', '046': 'Merovingertid', '047': 'Vikingtid',
  '050': 'Middelalder', '053': 'Senmiddelalder', '060': 'Sein steinbrukende tid',
  '061': 'Tidlig metalltid', '063': 'Eldre enn 100 år', '070': 'Steinalder – bronsealder',
  '071': 'Senneolitikum – bronsealder', '072': 'Bronsealder – jernalder',
  '073': 'Jernalder – middelalder', '075': 'Vikingtid – middelalder',
  '100': 'Etterreformatorisk tid', '150': '1537–1599', '160': '1600–1699',
  '163': '1650–1674', '170': '1700–1799', '171': '1700–1724', '172': '1725–1749',
  '174': '1775–1799', '180': '1800–1899', '182': '1825–1849', '184': '1875–1899',
  '190': '1900–1999', '191': '1900–1924', '192': '1925–1949', '193': '1950–1974',
  '999': 'Uviss tid',
}
export function dateringLabel(code) {
  return DATERING[String(code ?? '').trim()] ?? null
}

// Enkeltminneart (finkornet type). Verifisert mot RA/Geonorge-kodelisten.
const ENKELTMINNEART = {
  '10109': 'Bolig', '10119': 'Fjøs/stall', '10123': 'Garasje', '10134': 'Kontor',
  '10137': 'Lagerbygning', '10155': 'Bur/stabbur/loft', '10159': 'Teknisk bygning',
  '10164': 'Uthus/skjul', '10165': 'Vaktstue', '10194': 'Ukjent', '10204': 'Bunker',
  '1102': 'Helleristning', '1104': 'Skålgrop', '1201': 'Boplass', '1202': 'Bosetningsspor',
  '1203': 'Heller', '1204': 'Kulturlag', '1210': 'Gammetuft', '1211': 'Hustuft',
  '1215': 'Ildsted', '1216': 'Kokegrop', '1225': 'Port/portal', '1226': 'Stolpehull',
  '1228': 'Veggrille', '1402': 'Nausttuft', '1515': 'Forsvarsverk/installasjon',
  '1601': 'Park', '1701': 'Grav', '1702': 'Gravhaug', '1703': 'Gravrøys',
  '1704': 'Flatmarksgrav', '1707': 'Steinsetning', '2037': 'Båtstø', '2038': 'Ankerplass',
  '2039': 'Båtfunn', '2040': 'Anker', '2045': 'Skipslast', '2046': 'Marint løsfunn',
  '2056': 'Skipsdel', '2211': 'Tradisjon', '2232': 'Bautastein', '2306': 'Kalkbrudd',
  '2308': 'Klebersteinsbrudd', '2313': 'Kalkovn', '2321': 'Kullgrop', '2322': 'Kullmile',
  '2323': 'Slaggforekomst', '2348': 'Blestertuft', '2352': 'Jernvinneovn',
  '2401': 'Fangstgrav', '2402': 'Fangstgrop', '2409': 'Bogastelle', '2507': 'Rydningsrøys',
  '2509': 'Åkerrein', '2521': 'Steingard/gjerde', '2523': 'Steinstreng',
  '2524': 'Dyrkingsflate', '9903': 'Løsfunn', '9905': 'Grop', '9906': 'Haug',
  '9907': 'Mur', '9909': 'Røys', '9913': 'Plass/gårdsrom', '9915': 'Tuft',
  '9917': 'Naturdannelse', '9921': 'Kullforekomst', '9923': 'Grophus',
  '9927': 'Utomhuselement (andre)', '9990': 'Annet arkeologisk enkeltminne',
}
export function enkeltminneartLabel(code) {
  return ENKELTMINNEART[String(code ?? '').trim()] ?? null
}

/**
 * Parse GML 3.2 fra WFS til enkeltminne-objekter. Ett pr <app:Enkeltminne>.
 * Hvert enkeltminne har eget navn + informasjon → detalj pr koordinat.
 * @param {string} gml
 */
export function parseWfsKulturminner(gml) {
  if (!gml || typeof gml !== 'string') return []
  const out = []
  const blockRe = /<app:Enkeltminne\b[\s\S]*?<\/app:Enkeltminne>/g
  let m
  while ((m = blockRe.exec(gml))) {
    const block = m[0]
    const posMatch = block.match(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/)
    let c = posMatch ? centroidFromPosList(posMatch[1]) : null
    if (!c) {
      const pt = block.match(/<gml:pos[^>]*>([^<]+)<\/gml:pos>/)
      c = pt ? centroidFromPosList(pt[1]) : null
    }
    if (!c) continue
    const idm = block.match(/gml:id="([^"]+)"/)
    const link = firstTag(block, 'linkKulturminnesøk')
    const vi = vernInfo(firstTag(block, 'vernetype'))
    out.push({
      id: firstTag(block, 'kulturminneId') || firstTag(block, 'lokalId') || idm?.[1] || null,
      lat: c.lat,
      lon: c.lon,
      navn: firstTag(block, 'navn'),
      // lokalitetsart er en tallkode i WFS-en (ikke lesbar) → utelatt; full
      // lesbar info ligger i `informasjon` og bak kulturminnesok-lenken.
      vernetype: vi.text,
      kategori: vi.kategori,
      kategoriLabel: enkeltminnekategoriLabel(firstTag(block, 'enkeltminnekategori')),
      art: enkeltminneartLabel(firstTag(block, 'enkeltminneart')),
      // `datering` er nøstet: <app:datering><app:Datering><app:datering>KODE</…>.
      // Ta den indre 3-sifrede koden (første datering hvis flere).
      datering: dateringLabel((block.match(/<app:datering>\s*(\d{3})\s*<\/app:datering>/i) || [])[1]),
      opphav: firstTag(block, 'opphav'),
      noyaktighetM: (() => { const n = Number(firstTag(block, 'nøyaktighet')); return Number.isFinite(n) && n > 0 ? n : null })(),
      ...(() => { const s = splitInformasjon(firstTag(block, 'informasjon')); return { informasjon: s.enkeltminne, lokalitetInfo: s.lokalitet } })(),
      kommune: firstTag(block, 'kommune'),
      link: link && /^https?:\/\//i.test(link) ? link : null,
    })
  }
  return out
}

// Stedssøk. Delt kjerne for useNominatim (UI-composable) og MCP-serveren
// (sok_sted / bygg_kart med sted-navn). Rene funksjoner som tar fetch injisert,
// så de kan testes og kjøres i Node uten avhengighet av et globalt fetch eller vue.
//
// To kilder flettes av searchPlaces():
//  1. Kartverket SSR (Sentralt stedsnavnregister) via Geonorge — autoritativ for
//     norske stedsnavn (fjell, setre, gårder, grender, vann), med fuzzy-søk.
//  2. OpenStreetMap Nominatim — dekker adresser og POI-er (hoteller, severdigheter)
//     som SSR ikke har.
//
// Begge er gratis tjenester — vær rate-limit-vennlig (debounce i UI) og send
// User-Agent i server-kontekst (Nominatim krever det for ikke-nettleser-klienter).

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const STEDSNAVN = 'https://ws.geonorge.no/stedsnavn/v1/navn'

// Kortnavn: «Navn, tettsted» der det finnes, ellers de to første leddene av
// display_name. Trekker ut det mest gjenkjennelige stedsnavnet fra adressen.
export function shortNameFor(d) {
  const a = d.address ?? {}
  const place = a.suburb || a.village || a.town || a.city || a.municipality || a.county || ''
  const parts = []
  if (d.name) parts.push(d.name)
  else if (a.road) parts.push(a.road)
  else if (a.postcode) parts.push(a.postcode)
  if (place && place !== parts[0]) parts.push(place)
  return parts.join(', ') || d.display_name.split(',').slice(0, 2).join(',')
}

// Normaliser ett Nominatim-treff til vårt interne format.
export function normalizeNominatim(d) {
  return {
    id: d.place_id,
    name: d.display_name,
    shortName: shortNameFor(d),
    type: d.type,
    importance: d.importance,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    bbox: d.boundingbox?.map(parseFloat) ?? null,
    source: 'nominatim',
  }
}

// Normaliser ett Kartverket SSR-treff (v1 /navn) til samme interne format.
// SSR er punkt-baserte navn uten bounding box (bbox=null) — extentInfo() i
// MCP-serveren tåler det. Feltnavn med æ/ø leses via bracket-tilgang.
// Returnerer null hvis representasjonspunktet mangler gyldige koordinater.
export function normalizeKartverket(item) {
  const rp = item?.representasjonspunkt ?? {}
  const lat = parseFloat(rp['nord'])
  const lon = parseFloat(rp['øst'])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const skrivemate = item['skrivemåte'] ?? ''
  const kommune = item.kommuner?.[0]?.kommunenavn ?? ''
  const label = kommune ? `${skrivemate}, ${kommune}` : skrivemate
  return {
    id: `ssr:${item.stedsnummer ?? skrivemate}`,
    name: label,
    shortName: label,
    type: (item.navneobjekttype ?? '').toLowerCase() || null,
    // Vist til brukeren når to treff har samme navn i samme kommune. SSR
    // registrerer NAVNEOBJEKTER, ikke bare topper: «Vardåsen» i Asker er både
    // to åser, et alpinanlegg og et boligfelt.
    objekttype: item.navneobjekttype ?? null,
    importance: 0.5,
    lat,
    lon,
    bbox: null,
    source: 'kartverket',
  }
}

// Nærmeste gjenkjennelige stedsnavn fra et reverse-treff. Prioriterer det MEST
// lokale leddet (gård/grend/boligfelt) og faller gradvis tilbake til større
// enheter, så et GPS-punkt ute i terrenget får «Stormoen» framfor kommunenavnet.
// Returnerer null hvis ingenting brukbart finnes (kaller faller tilbake selv).
export function nearestPlaceLabel(d) {
  if (!d) return null
  const a = d.address ?? {}
  const label =
    a.hamlet || a.isolated_dwelling || a.farm || a.village ||
    a.neighbourhood || a.quarter || a.suburb || a.town ||
    a.city_district || a.city || a.municipality ||
    d.name ||
    (d.display_name ? d.display_name.split(',')[0].trim() : '')
  return label || null
}

// Stedsnavn til å SKILLE to søketreff med samme navn. Merk at prioriteringen er
// motsatt av nearestPlaceLabel over: den er laget for GPS-posisjonen din og skal
// gi det mest LOKALE navnet («Stormoen» framfor kommunen). Til søk vil du ha det
// mest GJENKJENNELIGE: «Vardåsen, Asker (Rønningen)» hjelper mer enn
// «(Hauger)», som er navnet på én gård.
//
// Målt på de fire Vardåsen-toppene i Asker (2026-08-12) er dette hva Nominatim
// faktisk har på reverse/zoom=14, og det er verdt å vite før man forventer mer:
//   59.8140 → farm Hauger, suburb Rønningen, town Asker
//   59.5583 → farm Toftebråten, neighbourhood Tofteplassen, quarter Fuglebakk, hamlet Rød
//   59.6895 → farm Grimsrud, hamlet Grimsrud   (ingenting større finnes)
// Tettsted-nivået («Dikemark», «Røyken») ligger altså IKKE i svaret for disse
// punktene. Vi tar det største som finnes, og gården som siste utvei.
// Returnerer en ORDNET liste, ikke ett navn: det største kandidatnavnet er ofte
// kommunen selv («Asker»), som ikke skiller noe. Kalleren tar det første som
// tilfører informasjon — ellers mistet vi «Rønningen» til «Asker».
export function stedsnavnKandidater(d) {
  const a = d?.address ?? {}
  return [
    a.town, a.city_district, a.suburb, a.village,
    a.quarter, a.neighbourhood,
    a.hamlet, a.farm, a.isolated_dwelling,
    a.city,
  ].filter(Boolean)
}

/**
 * Revers-geokod en koordinat til nærmeste stedsnavn (Nominatim /reverse).
 * @param {number} lat
 * @param {number} lon
 * @param {{signal?:AbortSignal, fetchImpl?:Function, endpoint?:string,
 *          userAgent?:string, zoom?:number}} opts
 * @returns {Promise<{id,name,shortName,type,importance,lat,lon,bbox,placeLabel}|null>}
 */
export async function reverseGeocode(lat, lon, opts = {}) {
  const { signal, fetchImpl, endpoint = NOMINATIM_REVERSE, userAgent, zoom = 14 } = opts
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const doFetch = fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('Ingen fetch tilgjengelig for geokoding')

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), format: 'jsonv2',
    addressdetails: '1', zoom: String(zoom),
  })
  const headers = { Accept: 'application/json' }
  if (userAgent) headers['User-Agent'] = userAgent

  const res = await doFetch(`${endpoint}?${params}`, { signal, headers })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = await res.json()
  if (!data || data.error) return null
  return {
    ...normalizeNominatim(data),
    placeLabel: nearestPlaceLabel(data),      // mest lokalt — for GPS-posisjonen
    skilleKandidater: stedsnavnKandidater(data),  // ordnet, mest gjenkjennelig først
  }
}

/**
 * Geokod et fritekst-søk til en liste normaliserte treff (viktigst først).
 * @param {string} query
 * @param {{countryCode?:string, limit?:number, signal?:AbortSignal,
 *          fetchImpl?:Function, endpoint?:string, userAgent?:string}} opts
 * @returns {Promise<Array<{id,name,shortName,type,importance,lat,lon,bbox}>>}
 */
export async function geocodePlace(query, opts = {}) {
  const { countryCode = 'no', limit = 20, signal, fetchImpl, endpoint = NOMINATIM, userAgent } = opts
  const q = (query ?? '').trim()
  if (q.length < 2) return []

  const doFetch = fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('Ingen fetch tilgjengelig for geokoding')

  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: String(limit), addressdetails: '1', countrycodes: countryCode,
  })
  const headers = { Accept: 'application/json' }
  if (userAgent) headers['User-Agent'] = userAgent

  const res = await doFetch(`${endpoint}?${params}`, { signal, headers })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(normalizeNominatim) : []
}

/**
 * Geokod et fritekst-søk mot Kartverket SSR (autoritativt norsk stedsnavnregister).
 * Bruker fuzzy-søk så små avvik (f.eks. «Bøseter» vs «Bøsetra») fanges opp, og
 * ber om koordinater i WGS84 (utkoordsys=4258) så nord=lat, øst=lon.
 * @param {string} query
 * @param {{limit?:number, signal?:AbortSignal, fetchImpl?:Function,
 *          endpoint?:string, userAgent?:string}} opts
 * @returns {Promise<Array<{id,name,shortName,type,importance,lat,lon,bbox,source}>>}
 */
export async function geocodeKartverket(query, opts = {}) {
  const { limit = 20, signal, fetchImpl, endpoint = STEDSNAVN, userAgent } = opts
  const q = (query ?? '').trim()
  if (q.length < 2) return []

  const doFetch = fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('Ingen fetch tilgjengelig for geokoding')

  const params = new URLSearchParams({
    sok: q, fuzzy: 'true', utkoordsys: '4258', treffPerSide: String(limit), side: '1',
  })
  const headers = { Accept: 'application/json' }
  if (userAgent) headers['User-Agent'] = userAgent

  const res = await doFetch(`${endpoint}?${params}`, { signal, headers })
  if (!res.ok) throw new Error(`Kartverket ${res.status}`)
  const data = await res.json()
  const navn = Array.isArray(data?.navn) ? data.navn : []
  return navn.map(normalizeKartverket).filter(Boolean)
}

// Match-kvalitet mellom søket og et treff (lavere = bedre). Sammenlikner mot
// selve navnet (første ledd før komma), ikke hele «Navn, kommune»-etiketten.
function matchRank(query, r) {
  const q = query.trim().toLowerCase()
  const label = (r.shortName || r.name || '').toLowerCase()
  const head = label.split(',')[0].trim()
  if (head === q) return 0
  if (head.startsWith(q)) return 1
  if (head.includes(q)) return 2
  if (label.includes(q)) return 3
  return 4
}

// Dedup-nøkkel: navnet + koordinat avrundet til ~100 m. Samme sted fra to
// kilder kolliderer og telles én gang (første forekomst vinner).
function dedupKey(r) {
  const head = (r.shortName || r.name || '').split(',')[0].trim().toLowerCase()
  return `${head}@${r.lat.toFixed(3)},${r.lon.toFixed(3)}`
}

// ─── Tvetydige treff ────────────────────────────────────────────────────────
// «Vardåsen, Asker» ga fem identiske rader i søkelista, og det var ikke en bug i
// dedupliseringen: SSR registrerer NAVNEOBJEKTER, ikke topper. Etter
// kommunesammenslåingen i 2020 er Røyken, Hurum og gamle Asker ÉN kommune, så
// flere ulike objekter deler navnet innenfor samme kommune — to åser, pluss det
// som er oppkalt etter dem (alpinanlegg, boligfelt, kirke). Etiketten vår var
// bare «skrivemåte, kommune», så alle fem så like ut.
//
// Vi fjerner dem ikke: de ER forskjellige steder, og brukeren skal kunne velge.
// Vi KVALIFISERER dem i stedet, med det billigste som skiller:
//   1. Navneobjekttypen, som vi allerede har gratis fra SSR — skiller
//      alpinanlegget fra åsen.
//   2. Nærmeste stedsnavn (ett reverse-oppslag), som er det eneste som skiller
//      to åser med samme navn i samme kommune: «(Dikemark)» vs «(Røyken)».
// Steg 2 koster nettverk, så det gjøres BARE for treff som fortsatt er
// tvetydige etter steg 1, og maks `maksOppslag` av dem.

const MAKS_KVALIFISER_OPPSLAG = 3

// Har dubletten et sted-ledd som den beholdte etiketten mangler? «Vardåsen,
// Tofte» mot «Vardåsen, Asker» → «Tofte». Kun første ledd etter navnet;
// resten av Nominatims display_name er fylke og land.
function ekstraStedsledd(beholdtEtikett, dublettEtikett) {
  const ledd = (t) => (t || '').split(',').map((d) => d.trim()).filter(Boolean)
  const b = ledd(beholdtEtikett), d = ledd(dublettEtikett)
  if (d.length < 2) return null
  const kandidat = d[1]
  if (!kandidat) return null
  return b.some((x) => x.toLowerCase() === kandidat.toLowerCase()) ? null : kandidat
}

// Grupper treff som ville vist samme tekst i lista.
export function grupperEtterEtikett(treff) {
  const grupper = new Map()
  for (const r of treff) {
    const k = (r.shortName || r.name || '').trim().toLowerCase()
    if (!k) continue
    if (!grupper.has(k)) grupper.set(k, [])
    grupper.get(k).push(r)
  }
  return grupper
}

// Steg 1: skiller objekttypen gruppa? Da er den kvalifikatoren — men bare hvis
// den faktisk VARIERER. To åser får ikke «(Ås)» bak begge; det ville se ut som
// en feil og hjelpe ingen.
function kvalifiserMedType(gruppe) {
  const typer = gruppe.map((r) => r.objekttype || '')
  const unike = new Set(typer.filter(Boolean))
  if (unike.size < 2) return false
  let noenSatt = false
  for (const r of gruppe) {
    // Kun de som har en type SOM ER UNIK i gruppa. Er to av fem åser, skal de to
    // videre til steg 2 mens alpinanlegget klarer seg med typen sin.
    if (r.objekttype && typer.filter((t) => t === r.objekttype).length === 1) {
      r.kvalifikator = r.objekttype.toLowerCase()
      noenSatt = true
    }
  }
  return noenSatt
}

/**
 * Gjør treff med identisk etikett skillbare. Muterer ikke inn-lista; returnerer
 * en ny liste der `shortName` har fått et kvalifiserende ledd i parentes.
 *
 * @param {Array} treff
 * @param {{reverse?: (lat:number, lon:number) => Promise<{placeLabel?:string}|null>,
 *          maksOppslag?: number}} opts
 *   `reverse` injiseres (reverseGeocode i praksis, en stubb i test). Utelates
 *   den, brukes bare objekttype-kvalifikatoren — helt uten nettverk.
 */
export async function kvalifiserTvetydige(treff, opts = {}) {
  const {
    reverse,
    maksOppslag = MAKS_KVALIFISER_OPPSLAG,
    // Nominatim ber om maks ett kall i sekundet. Uten pause fikk tre raske
    // reverse-kall rett etter søket 429, og alle tre treffene ble stående
    // ukvalifiserte — som er nøyaktig det brukeren så etter v5.16.0.
    pauseMs = 1100,
    onOppdatert = null,
  } = opts
  const ut = treff.map((r) => ({ ...r }))
  // Hvert oppslag som lykkes oppdaterer lista med en gang. Ellers måtte
  // brukeren vente på ALLE (3+ sekunder med pausene) før noe ble skilt.
  const oppdater = (liste) => {
    if (!onOppdatert) return
    onOppdatert(liste.map((r) => (
      r.kvalifikator ? { ...r, shortName: `${r.shortName} (${r.kvalifikator})` } : { ...r }
    )))
  }
  const grupper = grupperEtterEtikett(ut)

  const trengerOppslag = []
  for (const gruppe of grupper.values()) {
    if (gruppe.length < 2) continue
    // Gratis-kvalifikatorene først, i rekkefølge etter hvor gjenkjennelige de er.
    for (const r of gruppe) if (r.tvillingSted) r.kvalifikator = r.tvillingSted
    kvalifiserMedType(gruppe.filter((r) => !r.kvalifikator))
    for (const r of gruppe) if (!r.kvalifikator) trengerOppslag.push(r)
  }

  // Steg 2 — sekvensielt med vilje: Nominatim ber om maks ett kall i sekundet,
  // og en tvetydig gruppe er sjelden større enn tre.
  if (reverse && trengerOppslag.length) {
    for (const r of trengerOppslag.slice(0, maksOppslag)) {
      try {
        const d = await reverse(r.lat, r.lon)
        // Første kandidat som TILFØRER noe. «Asker» gjentar kommunen i etiketten
        // og skiller ingenting, så vi går videre til neste (suburb «Rønningen»).
        const kandidater = d?.skilleKandidater ?? (d?.placeLabel ? [d.placeLabel] : [])
        r.kvalifikator = kandidater.find((k) => k && !sammeLedd(k, r.shortName)) ?? null
        if (r.kvalifikator) oppdater(ut)
      } catch { /* nett nede eller 429: la treffet stå ukvalifisert */ }
      if (pauseMs) await new Promise((ok) => setTimeout(ok, pauseMs))
    }
  }

  for (const r of ut) {
    if (r.kvalifikator) r.shortName = `${r.shortName} (${r.kvalifikator})`
    delete r.kvalifikator
    delete r.tvillingSted
  }
  return ut
}

// «Vardåsen» mot «Vardåsen, Asker» → samme ledd, ingen ny informasjon.
function sammeLedd(kandidat, etikett) {
  const k = kandidat.trim().toLowerCase()
  return (etikett || '').toLowerCase().split(',').some((d) => d.trim() === k)
}

/**
 * Flett stedssøk fra Kartverket SSR og OpenStreetMap Nominatim til én liste.
 * Kildene kjøres parallelt; feiler/CORS-blokkeres den ene (allSettled), brukes
 * den andre alene. Treff dedupliseres (SSR foretrekkes for norsk skrivemåte) og
 * rangeres etter match-kvalitet, så kilde (SSR før OSM), så importance.
 * @param {string} query
 * @param {{limit?:number, signal?:AbortSignal, fetchImpl?:Function,
 *          userAgent?:string, countryCode?:string}} opts
 * @returns {Promise<Array<{id,name,shortName,type,importance,lat,lon,bbox,source}>>}
 */
export async function searchPlaces(query, opts = {}) {
  const { limit = 20 } = opts
  const q = (query ?? '').trim()
  if (q.length < 2) return []

  const [kv, nom] = await Promise.allSettled([
    geocodeKartverket(q, opts),
    geocodePlace(q, opts),
  ])
  const kvHits = kv.status === 'fulfilled' ? kv.value : []
  const nomHits = nom.status === 'fulfilled' ? nom.value : []

  // Dedup, men vi KASTER ikke informasjonen i dubletten. SSR vinner (autoritativ
  // norsk skrivemåte) og har bare kommunenavn i etiketten, mens Nominatim-
  // tvillingen kan ha tettstedet: «Vardåsen, Tofte» mot SSR-ens «Vardåsen,
  // Asker». Det er det mest gjenkjennelige skille-navnet vi kan få, og det
  // koster ingenting — det ligger alt i svaret vi har hentet.
  const seen = new Map()
  const merged = []
  for (const r of [...kvHits, ...nomHits]) {
    const key = dedupKey(r)
    const beholdt = seen.get(key)
    if (beholdt) {
      const ledd = ekstraStedsledd(beholdt.shortName, r.shortName)
      if (ledd && !beholdt.tvillingSted) beholdt.tvillingSted = ledd
      continue
    }
    seen.set(key, r)
    merged.push(r)
  }

  merged.forEach((r, i) => { r._order = i })
  merged.sort((a, b) => {
    const ra = matchRank(q, a), rb = matchRank(q, b)
    if (ra !== rb) return ra - rb
    const sa = a.source === 'kartverket' ? 0 : 1
    const sb = b.source === 'kartverket' ? 0 : 1
    if (sa !== sb) return sa - sb
    const ia = a.importance ?? 0, ib = b.importance ?? 0
    if (ia !== ib) return ib - ia
    return a._order - b._order
  })

  const kuttet = merged.slice(0, limit).map(({ _order, ...r }) => r)
  // Gratis-kvalifikatoren (objekttype) legges på HER, så både UI-et og
  // MCP-serveren får den uten et ekstra nettverkskall. Reverse-oppslaget som
  // skiller to åser med samme navn skjer i UI-et etter første visning
  // (useNominatim) — det skal ikke gjøre søkelista tregere å få opp.
  return kvalifiserTvetydige(kuttet)
}

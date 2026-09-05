// Filformatet for offline-deling av ett kart: «.lendekart».
//
// Bakgrunnen: useKartDeling deler OPPSKRIFTEN (bbox + ekvidistanse + aspekt) som
// en URL, og mottakeren bygger sin egen kopi. Det forutsetter nett mot
// Kartverket, Overpass, N50, NVE og Sjøkart — altså nøyaktig det man ikke har
// på fjellet. Denne fila pakker i stedet HELE kartet: den ferdige SVG-en, det
// innebygde DEM-rutenettet og de datalagene som ellers hentes live
// (offlinePakke.js samler dem). Fila går telefon-til-telefon med AirDrop,
// Nearby Share, Bluetooth eller minnepinne.
//
// Formatet er gzip-et UTF-8 JSON. Gzip fordi kart-SVG-en er 1–5 MB tekst som
// komprimerer 5–10×; mangler CompressionStream skrives det ukomprimert, og
// leseren kjenner igjen begge på gzip-magien (1f 8b).
//
// DEM-et er en Float32-ArrayBuffer (se demSampling.packDem) og må base64-es for
// å overleve JSON. Det er den ene delen av kart-posten som ikke er ren JSON.

export const PAKKE_FORMAT = 'lende-kart'
export const PAKKE_FORMAT_VERSION = 1
export const PAKKE_FILENDELSE = '.lendekart'

// Felter som IKKE følger med: brukerens egne markeringer og GPS-spor er
// personlige, og eieren valgte bort dem. De nullstilles ved import i stedet for
// å bli skrevet ut her, så en gammel fil aldri kan smugle dem inn.
//
// STJERNEMERKEDE KULTURMINNER (`stjerneminner`) HØRER BEVISST IKKE HJEMME HER
// (v6.5.53). De ser ut som personlig innhold og er det ikke: en stjerne er
// kuratering — «disse er verdt å se på denne turen» — og det er nettopp det som
// har verdi for den som får fila. Markeringer og spor er en dagbok; dette er en
// anbefaling. Nøklene er dessuten kildens egne ider (k:/f:), altså de samme hos
// mottakeren, og offlinePakke tar allerede med både bboksene og detaljteksten
// bak hvert ikon — så merkene har markører å feste seg på uten dekning.
const PERSONLIGE_FELTER = ['annotations', 'tracks', 'trackStyle']

// ── base64 ──────────────────────────────────────────────────────────────────
// I chunks: btoa(String.fromCharCode(...arr)) sprenger call-stacken rundt
// ~100 k argumenter, og et 1 MB DEM er en million bytes.
const B64_CHUNK = 0x8000

function bytesTilB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + B64_CHUNK))
  }
  return btoa(s)
}

function b64TilBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ── DEM ─────────────────────────────────────────────────────────────────────

/** Pakket DEM (demSampling.packDem) → JSON-trygt objekt. */
export function demTilJson(dem) {
  if (!dem?.buffer) return null
  return {
    b64: bytesTilB64(new Uint8Array(dem.buffer)),
    cols: dem.cols,
    rows: dem.rows,
    transform: dem.transform ? { ...dem.transform } : null,
    noData: dem.noData ?? null,
  }
}

/** Motstykket: JSON-objekt → pakket DEM som demSampling.unpackDem forstår. */
export function demFraJson(o) {
  if (!o?.b64) return null
  const bytes = b64TilBytes(o.b64)
  return {
    buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    cols: o.cols,
    rows: o.rows,
    transform: o.transform ? { ...o.transform } : null,
    noData: o.noData ?? null,
  }
}

// ── gzip ────────────────────────────────────────────────────────────────────

function erGzip(bytes) {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

async function gzip(bytes) {
  if (typeof CompressionStream !== 'function') return bytes
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return bytes   // ukomprimert er fortsatt en gyldig pakke
  }
}

async function gunzip(bytes) {
  if (!erGzip(bytes)) return bytes
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Denne nettleseren kan ikke pakke ut kartfila.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ── filnavn ─────────────────────────────────────────────────────────────────

/** Samme slugging som eksport-knappene i useKartEksport (filenameBase). */
export function pakkeFilnavn(navn) {
  const base = String(navn ?? '').replace(/[^a-z0-9æøå]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${base || 'turkart'}${PAKKE_FILENDELSE}`
}

// ── data-meta ───────────────────────────────────────────────────────────────
// Kartets geo-forankring bor i SVG-ens `data-meta` (mapBuilder skriver den).
// LAGREDE kart har den — vi pakker den lagrede strengen direkte. INNEBYGDE kart
// (vardasen) finnes ikke i IndexedDB, så der pakker vi det som står på skjermen
// — og den DOM-SVG-en er et NYTT rot-element (useMapLoadPipeline.setupHostSvg
// kopierer bare viewBox/class/width/height, ikke data-meta). Uten attributtet
// ville mottakerens laster kastet «Mangler data-meta i SVG» og kartet aldri
// åpnet seg. Vi bygger den derfor tilbake fra meta-objektet appen alt har.

// Samme escaping som mapBuilder bruker på sitt data-meta-attributt.
function metaAttr(obj) {
  return JSON.stringify(obj)
    .replace(/'/g, '&apos;')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

/**
 * Sørg for at markupen har et `data-meta` på rot-SVG-en. Har den det allerede,
 * røres den ikke.
 * @param {string} markup
 * @param {object} meta  MapViews meta (metaFromSvgMeta-formen)
 */
export function sikreDataMeta(markup, meta) {
  if (typeof markup !== 'string' || !markup) return markup
  const start = markup.match(/<svg\b[^>]*>/)
  if (!start || /\sdata-meta\s*=/.test(start[0])) return markup
  if (!meta) return markup
  const { minE, minN, maxE, maxN, ...rest } = meta
  const gjenoppbygd = { ...rest, utmBbox: { minE, minN, maxE, maxN } }
  const tag = start[0].replace(/>$/, ` data-meta='${metaAttr(gjenoppbygd)}'>`)
  return markup.replace(start[0], tag)
}

// ── skriv ───────────────────────────────────────────────────────────────────

/**
 * @param {{ kart: object, cache?: Array<{key:string,data:any,expires:number}>,
 *           appVersion?: string }} arg
 * @returns {Promise<Blob>} gzip-et JSON, klar for nedlasting eller navigator.share
 */
export async function lagKartPakke({ kart, cache = [], appVersion = null }) {
  if (!kart?.svg) throw new Error('Kartet mangler SVG — kan ikke pakkes.')
  const ut = { ...kart }
  for (const f of PERSONLIGE_FELTER) delete ut[f]
  ut.dem = demTilJson(kart.dem)
  const json = JSON.stringify({
    format: PAKKE_FORMAT,
    formatVersion: PAKKE_FORMAT_VERSION,
    appVersion: appVersion ?? kart.appVersion ?? null,
    eksportert: Date.now(),
    kart: ut,
    cache,
  })
  const bytes = await gzip(new TextEncoder().encode(json))
  return new Blob([bytes], { type: 'application/gzip' })
}

// ── les ─────────────────────────────────────────────────────────────────────

/**
 * Nettleserens egne lesefeil på norsk, med handlingen brukeren mangler.
 *
 * Den vanligste er `NotFoundError`: Filer-appen VISER fila selv når den bare
 * ligger i iCloud eller Google Drive og ikke er lastet ned. Brukeren velger
 * den, og nettleseren finner ingenting å lese. Rå-meldingen fra nettleseren er
 * «A requested file or directory could not be found at the time an operation
 * was processed» — engelsk, og den sier ikke hva man skal gjøre.
 */
export function lesefeilPaaNorsk(err) {
  switch (err?.name) {
    case 'NotFoundError':
      return 'Fant ikke fila. Ligger den i iCloud eller Google Drive? '
           + 'Åpne Filer-appen, last den ned til telefonen, og prøv igjen.'
    case 'NotReadableError':
      return 'Kunne ikke lese fila. Den kan ha blitt flyttet eller endret mens '
           + 'appen leste den. Prøv én gang til.'
    case 'SecurityError':
      return 'Nettleseren fikk ikke lov til å åpne fila. Prøv å kopiere den til '
           + 'telefonen først.'
    default:
      return null
  }
}

async function tilBytes(kilde) {
  if (kilde instanceof Uint8Array) return kilde
  if (kilde instanceof ArrayBuffer) return new Uint8Array(kilde)
  if (typeof kilde?.arrayBuffer !== 'function') throw new Error('Ukjent filkilde.')
  try {
    return new Uint8Array(await kilde.arrayBuffer())
  } catch (err) {
    const norsk = lesefeilPaaNorsk(err)
    if (!norsk) throw err
    // Behold originalen som `cause` — konsollen skal fortsatt vise hva
    // nettleseren egentlig sa når noen feilsøker.
    throw new Error(norsk, { cause: err })
  }
}

/**
 * @param {Blob|File|ArrayBuffer|Uint8Array} kilde
 * @returns {Promise<{kart: object, cache: Array, appVersion: string|null, eksportert: number|null}>}
 */
export async function lesKartPakke(kilde) {
  const rå = await gunzip(await tilBytes(kilde))
  let pakke
  try {
    pakke = JSON.parse(new TextDecoder().decode(rå))
  } catch {
    throw new Error('Fila er ødelagt eller ikke en Lende-kartfil.')
  }
  if (pakke?.format !== PAKKE_FORMAT) {
    throw new Error('Dette er ikke en Lende-kartfil.')
  }
  // Hardt avvist framover: en nyere fil kan ha felter vi ville tapt stille.
  if (Number(pakke.formatVersion) > PAKKE_FORMAT_VERSION) {
    throw new Error('Fila er laget med en nyere versjon av Lende. Oppdater appen.')
  }
  const kart = pakke.kart
  if (!kart?.svg) throw new Error('Kartfila mangler selve kartet.')
  kart.dem = demFraJson(kart.dem)
  for (const f of PERSONLIGE_FELTER) delete kart[f]
  return {
    kart,
    cache: Array.isArray(pakke.cache) ? pakke.cache : [],
    appVersion: pakke.appVersion ?? null,
    eksportert: Number.isFinite(pakke.eksportert) ? pakke.eksportert : null,
  }
}

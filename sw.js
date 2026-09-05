/**
 * sw.js — Service worker for Lende.
 *
 * Strategy:
 *   - Versioned cache: bump CACHE_VERSION on each deploy to invalidate
 *   - Install: pre-cache the shell (index.html + offline essentials). Does NOT
 *     skipWaiting — a new version waits until the user confirms via the
 *     "Ny versjon"-banner (which posts SKIP_WAITING; see message handler below).
 *   - Activate: delete old caches so stale bundles don't linger, then claim
 *     clients so the reload after SKIP_WAITING lands on the new SW.
 *   - Fetch:
 *       HTML (navigation)  → network first, fall back to cached index.html
 *       Hashed assets (/assets/*-HASH.ext) → cache first, forever
 *       Map data (/maps/*.svg) → network first, fall back to UVERSJONERT cache
 *       Icons, manifest, favicon → stale-while-revalidate
 *       Everything else → network only (Google Fonts, opentype from CDN, etc.)
 */

const CACHE_VERSION = '6.5.46'
// NAVNENE MÅ HA `lende-`-PREFIKSET, og det er ikke pynt: opprydningen under
// gjenkjenner sine egne cacher på det, og github.io er ÉN origin delt med
// eierens andre Pages-prosjekter — en opprydning uten prefiks ville slettet
// deres skall. Fra v6.5.16 til v6.5.38 het de bare `6.5.x-shell`, altså uten
// prefikset, og da traff filteret INGENTING: hver utgave la igjen sitt eget
// skall for alltid. Uten nett svarte `caches.match()` fra den ELDSTE av dem
// (den søker cachene i opprettelsesrekkefølge), så flymodus startet appen i
// v6.5.17 mens nettleseren hadde v6.5.38 på disk.
const SHELL_CACHE   = `lende-${CACHE_VERSION}-shell`
const ASSET_CACHE   = `lende-${CACHE_VERSION}-assets`
// Kartdata er UVERSJONERT med vilje. Et bygget kart-SVG er ikke en app-asset:
// det endres ikke av at appen får en ny versjon, og det er det ENESTE som gjør
// demokartet lesbart i flymodus. Lå det i det versjonerte skallet, ville hver
// deploy slettet offline-kartet til brukeren var på nett igjen.
const DATA_CACHE    = 'lende-data'
const BASE = '/lende/'

// Hvilke cacher opprydningen eier. `beholdes` er de tre gjeldende; alt annet som
// ser ut som VÅRT slettes. Andre mønster enn de to her røres ikke — de kan være
// et annet prosjekt på samme origin.
function ryddesCache(navn, beholdes) {
  if (beholdes.includes(navn)) return false
  if (navn.startsWith('lende-')) return true
  // Etterlatt av v6.5.16–v6.5.38, som droppet prefikset.
  return /^\d+\.\d+\.\d+-(shell|assets)$/.test(navn)
}

// DEMOKARTET ER EN DEL AV APPEN, ikke noe brukeren har lagret. Det ligger
// ferdig bygget i bundelen (`public/maps/vardasen.svg`), men fram til v6.5.41
// havnet det bare i cachen hvis man tilfeldigvis hadde ÅPNET det mens man var
// på nett: kart-ruta under er network-first, og en cache fylles ikke av et
// oppslag som aldri ble gjort. Flymodus ga da et kart som ikke fantes — på det
// ene kartet som ikke kan mangle. Det hentes derfor ved INSTALLASJON, altså ved
// hver deploy, som også er det som holder det ferskt: `lende-data` er
// uversjonert, så uten en henting her ville den aller første kopien blitt
// liggende for alltid.
const DATA_URLS = [
  `${BASE}maps/vardasen.svg`,
]

// Absolute minimum to boot the app offline
const SHELL_URLS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}favicon.svg`,
  `${BASE}icon.svg`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${BASE}manifest.webmanifest`,
]

self.addEventListener('install', (e) => {
  // Merk: vi kaller IKKE skipWaiting() her. En ny versjon skal stå og VENTE til
  // brukeren bekrefter via «Oppdater»-banneret (som sender SKIP_WAITING, se
  // message-handleren nederst). Første installasjon (ingen gammel SW som
  // kontrollerer) aktiveres uansett umiddelbart — «waiting» oppstår kun når en
  // gammel SW allerede styrer klientene.
  e.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then((c) =>
      c.addAll(SHELL_URLS).catch(() => {
        // Ignore individual failures — a missing icon shouldn't block install
      })
    ),
    // `cache: 'reload'` og ikke `addAll`: HTTP-cachen kan sitte på forrige
    // deploys kart, og da ville installasjonen skrevet det gamle inn i den
    // uversjonerte cachen som ferskt. Feiler hentingen (offline installasjon),
    // skal den IKKE blokkere — kart-ruta fyller cachen ved første oppslag på
    // nett, som er nøyaktig oppførselen vi hadde før.
    caches.open(DATA_CACHE).then((c) => Promise.all(DATA_URLS.map((u) =>
      fetch(u, { cache: 'reload' })
        .then((res) => (res && res.ok ? c.put(u, res) : null))
        .catch(() => null)))),
  ]))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => ryddesCache(n, [SHELL_CACHE, ASSET_CACHE, DATA_CACHE]))
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Only handle our origin
  if (url.origin !== self.location.origin) return

  // Navigation → network-first with index.html fallback (SPA routing)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Cache fresh copy of index.html
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(`${BASE}index.html`, copy))
          return res
        })
        // SCOPET til gjeldende skall. `caches.match()` uten cacheName søker
        // ALLE cacher i opprettelsesrekkefølge og svarer fra den eldste som har
        // treff — det var den halvdelen av flymodus-feilen som gjorde at appen
        // faktisk BOOTET i en gammel versjon. Slår opprydningen feil igjen, er
        // dette gjerdet som holder.
        .catch(() => caches.open(SHELL_CACHE).then((c) => c.match(`${BASE}index.html`)))
    )
    return
  }

  // Hashed assets → cache-first (safe: filename changes when content changes)
  if (url.pathname.startsWith(`${BASE}assets/`)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
      })
    )
    return
  }

  // Map data (built SVG kart, e.g. maps/vardasen.svg) → network-first.
  // These are large data payloads that the app parses as XML — they must NOT
  // go through the icon stale-while-revalidate branch below, which could serve
  // a stale or truncated cached copy on first load ("Ugyldig SVG"; a refresh
  // then succeeds once the background revalidation has replaced the entry).
  // Always prefer fresh network; fall back to cache only when offline.
  if (url.pathname.startsWith(`${BASE}maps/`)) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone()
          caches.open(DATA_CACHE).then((c) => c.put(req, copy))
        }
        return res
      }).catch(() => caches.open(DATA_CACHE).then((c) => c.match(req)))
    )
    return
  }

  // Icons, manifest, favicon → stale-while-revalidate
  if (/\.(svg|png|webmanifest|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fetching = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy))
          }
          return res
        }).catch(() => hit)
        return hit || fetching
      })
    )
    return
  }

  // Everything else (fallback): network, let browser handle errors
})

// Optional: allow the page to ask the SW to activate immediately after update
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

// Nærhetsvarsel: brukeren trykker på notification-en (eller dens «Avbryt»-
// knapp) → lukk den, fokuser kart-vinduet og be siden avbryte alarmen. Både
// body-klikk og action behandles som avbryt (tap-for-å-stoppe).
self.addEventListener('notificationclick', (e) => {
  const n = e.notification
  if (!n || n.tag !== 'proximity-alert') return
  n.close()
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of cs) c.postMessage({ type: 'PROXIMITY_CANCEL' })
    if (cs.length && 'focus' in cs[0]) {
      try { await cs[0].focus() } catch { /* ignore */ }
    } else if (self.clients.openWindow) {
      try { await self.clients.openWindow(BASE) } catch { /* ignore */ }
    }
  })())
})

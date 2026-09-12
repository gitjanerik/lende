// Overpass-transport: speil-kappløp + retry med backoff. Flyttet ordrett ut av
// mapBuilder.js (v12.1.0) så Ruteplanleggerens grusvei-overlay kan gjenbruke
// samme battle-testede nettverkslag uten å dra inn hele kart-pipelinen.
//
// Overpass-ventetid er den dominerende flaskehalsen i kart-bygging (81–97 % av
// total tid, målt v9.3.25 — 4,7–11,5 s), og det varierer hvilket speil som er
// overlastet. Vi kjører derfor flere speil i kappløp (Promise.any) og tar det
// første gyldige svaret. Alle støtter CORS for browser-fetch.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]
const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'lende/1.0 (https://github.com/gitjanerik/lende)',
}

// Klient-side tak PER FORSØK på Overpass-ventetid. Se mapBuilder.js
// (overpassTimeoutForBbox) for areal-skaleringen som bygger på disse.
export const OVERPASS_TIMEOUT_MS = 30000
export const OVERPASS_TIMEOUT_MAX_MS = 90000   // matcher [timeout:90] i spørringen

// Overpass-speilene feiler ofte forbigående (429/502/504/timeout under last) og
// lykkes på neste forsøk. Vi prøver på nytt med backoff i stedet for å gi opp
// etter ett kappløp.
const OVERPASS_ATTEMPTS = 3
const OVERPASS_BACKOFF_MS = [1500, 4000]   // ventetid før forsøk 2 og 3

// Ett kappløp mellom speilene: første gyldige svar vinner, resten avbrytes
// (sparer båndbredde/last). Hvert speil har egen AbortController, lenket til
// ekstern signal slik at prefetch-avbrudd stopper alle. Klient-tak avbryter alle
// hvis ingen har svart, så et hengende endpoint ikke fryser oss til server-
// timeouten (90 s). Kaster ved feil; retry-laget håndterer det.
export async function raceOverpassMirrors(body, { signal, timeoutMs = OVERPASS_TIMEOUT_MS } = {}) {
  if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')
  const controllers = OVERPASS_MIRRORS.map(() => new AbortController())
  const abortAll = () => controllers.forEach(c => { try { c.abort() } catch { /* noop */ } })
  if (signal) signal.addEventListener('abort', abortAll, { once: true })
  let timedOut = false
  const timeoutTimer = setTimeout(() => { timedOut = true; abortAll() }, timeoutMs)

  // Vinneren avgjøres på SVAR-HODENE, ikke på ferdig parset JSON (v7.7.14).
  // Med `Promise.any` over `res.json()` hadde de to taperne strømmet det meste
  // av 0,4–5 MB hver før vi i det hele tatt visste at de tapte — tre ganger
  // payloaden på det største kallet i hele pipelinen, på mobilnett. Nå aborteres
  // de i det første speil svarer 200; taper speilet på kroppen etterpå, tar
  // retry-laget (tre forsøk med backoff) det som før.
  const attempts = OVERPASS_MIRRORS.map((url, i) => (async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: OVERPASS_HEADERS,
      body,
      signal: controllers[i].signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Overpass-feil ${res.status} (${url}): ${text.slice(0, 200)}`)
    }
    return { res, i }
  })())

  try {
    const vinner = await Promise.any(attempts)
    // Bare taperne — vinneren skal få strømme kroppen ferdig. Klient-taket
    // (timeoutTimer) dekker fortsatt nedlastingen, som før.
    controllers.forEach((c, j) => { if (j !== vinner.i) { try { c.abort() } catch { /* noop */ } } })
    return await vinner.res.json()
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')
    if (timedOut) throw new Error(`Overpass svarte ikke innen ${Math.round(timeoutMs / 1000)} s`)
    // Promise.any → AggregateError når ALLE speil feilet. Kaster derimot
    // vinnerens kropp (nettverksbrudd midt i strømmen), er `e` en vanlig feil.
    if (!e?.errors) throw new Error(`Overpass-svaret brøt sammen: ${e?.message ?? String(e)}`)
    throw new Error(`Alle Overpass-speil feilet: ${e.errors.map(x => x?.message ?? String(x)).join(' | ')}`)
  } finally {
    clearTimeout(timeoutTimer)
    if (signal) signal.removeEventListener('abort', abortAll)
  }
}

export const delay = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  if (signal) signal.addEventListener('abort', () => {
    clearTimeout(t)
    reject(new DOMException('Avbrutt', 'AbortError'))
  }, { once: true })
})

// Retry-loop med backoff rundt speil-kappløpet. onProgress varsler brukeren
// før hvert nye forsøk — tidligere var retries usynlige og spinneren så «død»
// ut i opptil flere minutter.
export async function fetchOverpassWithRetry(body, { signal, timeoutMs, onProgress } = {}) {
  let lastErr
  for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')
    if (attempt > 0) {
      const backoff = OVERPASS_BACKOFF_MS[attempt - 1] ?? OVERPASS_BACKOFF_MS.at(-1)
      console.warn(`[Overpass] forsøk ${attempt} feilet (${lastErr?.message ?? lastErr}) — prøver igjen om ${backoff} ms`)
      onProgress?.(`Henter kartdata … (forsøk ${attempt + 1} av ${OVERPASS_ATTEMPTS})`)
      await delay(backoff, signal)
    }
    try {
      return await raceOverpassMirrors(body, { signal, timeoutMs })
    } catch (e) {
      if (e?.name === 'AbortError' || signal?.aborted) throw e
      lastErr = e
    }
  }
  throw new Error(`Overpass feilet etter ${OVERPASS_ATTEMPTS} forsøk: ${lastErr?.message ?? lastErr}`)
}

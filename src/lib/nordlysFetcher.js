// Nordlysdata fra NOAA SWPC.
//
// KILDE: services.swpc.noaa.gov. Data fra NOAA Space Weather Prediction Center er
// offentlig eiendom (U.S. Government work), men attribusjonen står i /om fordi
// det er god skikk og fordi en bruker skal kunne se hvor tallene kommer fra.
//
// HVORFOR IKKE GJENNOM PROXYEN, når værvarselet må det: MÅLT (probe-nordlys,
// 2026-08-31). NOAA sender `Access-Control-Allow-Origin: *` og krever INGEN
// User-Agent. MET-ruta i lende-proxy finnes utelukkende fordi MET krever en
// identifiserende User-Agent, og den headeren er FORBUDT i nettleserens fetch().
// Det kravet finnes ikke her, så en Worker-rute ville vært en omvei uten grunn.
//
//   DET SOM DERIMOT TALER FOR EN RUTE SENERE, er datamengde: OVATION er 897 kB
//   rå / 152 kB gzippet, mens en Norge-skive (55–85°N, −5–40°E) er 1426 punkter
//   og 3 kB gzippet — femti ganger mindre. På en telefon i felt er det en reell
//   forskjell. Det er en bevisst utsatt optimalisering og ikke en forglemmelse:
//   den krever en Worker-deploy, og dette laget skulle kunne stå på egne bein
//   først. Legger du den til, klipp i Workeren og la klienten be om bbox.
//
// PAKKES IKKE OFFLINE — og det er den viktigste regelen i fila. Nordlysvarsel er
// i nøyaktig samme klasse som værvarselet (v5.21.0): utdatert betyr FEIL, ikke
// bare mindre presist. `skrivOfflineData` setter FERSK TTL på hver rad, som er
// hele poenget for kulturminner og verneområder — men et nordlysvarsel fra en
// fil som har ligget en uke i en chat ville da blitt vist som om det gjaldt i
// kveld. Derfor har `nordlys:`-nøklene INGEN linje i `samleOfflineData`. Ikke
// «rett» dette som en glemt kilde.
//
// Merk: fila kan bundles inn i Cloudflare-Workerne via src/lib, så ingenting
// node-spesifikt og ingenting på modulnivå. Se CLAUDE.md om boot:workers.

const NOAA_BASE =
  import.meta.env?.VITE_NOAA_SWPC_URL ?? 'https://services.swpc.noaa.gov'

export const OVATION_URL = `${NOAA_BASE}/json/ovation_aurora_latest.json`
export const KP_URL = `${NOAA_BASE}/json/planetary_k_index_1m.json`
export const VIND_URL = `${NOAA_BASE}/products/summary/solar-wind-speed.json`
export const MAGFELT_URL = `${NOAA_BASE}/products/summary/solar-wind-mag-field.json`

/**
 * Hent JSON med timeout og ett nytt forsøk. Kaster aldri — samme wrapper som
 * vaerFetcher og kulturminneFetcher. Uten dekning returneres null, og kalleren
 * viser INGEN nordlyslinje framfor en oppdiktet.
 */
async function safeFetchJson(url, { signal, timeoutMs = 12_000, retries = 1 } = {}) {
  for (let forsok = 0; forsok <= retries; forsok++) {
    if (signal?.aborted) return null
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      if (res.ok) return await res.json()
    } catch (e) {
      if (signal?.aborted) return null
      if (forsok === retries) console.warn(`[NOAA] Henting feilet: ${e?.message ?? e}`)
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    if (forsok < retries && !signal?.aborted) await new Promise((r) => setTimeout(r, 700))
  }
  return null
}

/**
 * Nyeste rad i en NOAA-tabell.
 *
 * DETTE ER EN FELLE SOM SER RIKTIG UT, og den er målt: rtsw-filene fletter ACE og
 * DSCOVR, og ARRAYET ER IKKE TIDSSORTERT. Siste rad i wind-fila var en passiv
 * ACE-rad fra dagen før, mens nyeste rad var samme kveld. En klient som gjør
 * `d[d.length − 1]` får altså et helt plausibelt, men døgngammelt tall — uten at
 * noe ser galt ut. Vi filtrerer derfor på `active` der feltet finnes, og velger
 * STØRSTE tidsstempel framfor det siste.
 *
 * Kp-fila er sortert i praksis, men går gjennom samme funksjon: en antakelse om
 * rekkefølge som holder i dag er en antakelse som brekker stille.
 */
export function nyesteRad(rader) {
  if (!Array.isArray(rader) || !rader.length) return null
  const tid = (o) => {
    const s = String(o?.time_tag ?? '')
    if (!s) return NaN
    // NOAA blander «2026-08-31T22:18:00» og «…Z». Uten Z tolker Date.parse den
    // som lokal tid, og da spretter alderen med brukerens tidssone.
    return Date.parse(/[Zz]$/.test(s) ? s : `${s.replace(' ', 'T')}Z`)
  }
  const gyldige = rader.filter((o) => Number.isFinite(tid(o)))
  if (!gyldige.length) return null
  const harAktiv = gyldige.some((o) => 'active' in o)
  const utvalg = harAktiv ? gyldige.filter((o) => o.active) : gyldige
  if (!utvalg.length) return null
  return utvalg.reduce((a, b) => (tid(b) > tid(a) ? b : a))
}

/**
 * Hent alt et nordlyspanel trenger, i ÉN runde.
 *
 * De fire kildene hentes PARALLELT og hver for seg: faller solvinden bort, skal
 * ikke sannsynligheten forsvinne med den. Panelet viser det som finnes og tier om
 * resten — samme regel som resten av datalagene i Lende.
 *
 * @returns {Promise<{
 *   rutenett: Array|null, observert: string|null, varselFor: string|null,
 *   kp: number|null, vindKmS: number|null, bt: number|null, bz: number|null,
 *   maalt: number
 * }|null>} null bare når INGENTING svarte.
 */
export async function hentNordlys({ signal } = {}) {
  const [ovation, kpRader, vind, mag] = await Promise.all([
    safeFetchJson(OVATION_URL, { signal }),
    safeFetchJson(KP_URL, { signal }),
    safeFetchJson(VIND_URL, { signal }),
    safeFetchJson(MAGFELT_URL, { signal }),
  ])
  if (!ovation && !kpRader && !vind && !mag) return null

  const kpNaa = nyesteRad(kpRader)
  // Summary-filene er ETT objekt, ikke en tabell — målt. De pakkes i array av
  // NOAA i noen tilfeller, så begge former tas imot.
  const vindNaa = Array.isArray(vind) ? nyesteRad(vind) : vind
  const magNaa = Array.isArray(mag) ? nyesteRad(mag) : mag

  const tall = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
  return {
    rutenett: Array.isArray(ovation?.coordinates) ? ovation.coordinates : null,
    // BEGGE tidene bæres videre. «latest» er et varsel ~1 time fram, og panelet
    // skal kunne si det — se nordlys.js.
    observert: ovation?.['Observation Time'] ?? null,
    varselFor: ovation?.['Forecast Time'] ?? null,
    kp: tall(kpNaa?.estimated_kp ?? kpNaa?.kp_index),
    vindKmS: tall(vindNaa?.proton_speed),
    bt: tall(magNaa?.bt),
    // Bz i GSM er den som avgjør: peker feltet SØR (negativ), kobler det seg til
    // jordas felt og slipper energien inn. Bz nord kan gi Kp 5 uten nordlys.
    bz: tall(magNaa?.bz_gsm),
    maalt: Date.now(),
  }
}

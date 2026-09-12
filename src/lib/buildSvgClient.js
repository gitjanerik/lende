// buildSvgClient.js — kjør buildSvg i en Web Worker når mulig, ellers synkront.
//
// buildSvg gjør tunge synkrone pass (stupkant-skeletonisering, marching-squares-
// konturer, polygon-clipping-unions) som ellers fryser UI-en i flere sekunder.
//
// ÉN WORKER PER KART-BYGGING, ikke én per kall (v7.7.14). Terreng-først bygger
// SAMME kart to ganger — først konturer alene, så hele arket — og med en fersk
// worker per kall betydde det to struktur-kloner av DEM-et (opptil 4 MB) og to
// komplette kontur-, stup- og topp-pass over det samme rutenettet. Økta holder
// DEM-et og det DEM-avledede resultatet i workeren, så andre bygg sender bare
// OSM-elementene og gjenbruker resten. Er DEM-et byttet ut i mellomtiden (kyst-
// oppgradering, Terrarium-fyll) sier kalleren fra, og alt regnes på nytt.
//
// Økta pakker også det lagrede DEM-et (downsample + packDem + findHighestPoint)
// der arbeidet hører hjemme: det lå på hovedtråden, på fullt rutenett, én gang
// per bygg. Den pakkede bufferet TRANSFERERES tilbake — ingen kopi.
//
// I Node/CI/test (ingen Worker) faller vi tilbake til synkron buildSvg med
// nøyaktig samme gjenbruks-regler, så enhetstestene ser samme oppførsel.
import { buildSvg } from './mapBuilder.js'
import { pakkLagretDem } from './demSampling.js'

const avbrutt = () => new DOMException('Avbrutt', 'AbortError')

/**
 * Åpne en bygge-økt. Kall `bygg()` én eller flere ganger, og `avslutt()` når
 * kartet er ferdig — den terminerer workeren og frigjør DEM-et den holder.
 *
 * bygg(elements, bbox, options, { dem, gjenbrukDem, pakkDem })
 *   dem          — DEM-et dette bygget skal bruke. Utelatt sammen med
 *                  gjenbrukDem: true ⇒ bruk det økta allerede har.
 *   gjenbrukDem  — DEM-et er BIT-IDENTISK med forrige bygg, så konturer,
 *                  stupkanter og topper kan gjenbrukes. Kalleren avgjør dette
 *                  (identitets-sjekk på DEM-objektet), ikke workeren.
 *   pakkDem      — returner også pakket lagrings-DEM + høyeste punkt.
 */
export function apneByggeOkt({ signal } = {}) {
  if (typeof Worker === 'undefined') return synkronOkt({ signal })
  let worker
  try {
    worker = new Worker(new URL('./mapSvg.worker.js', import.meta.url), { type: 'module' })
  } catch {
    // Klarte ikke å lage worker (gammel nettleser / CSP) → synkron fallback.
    return synkronOkt({ signal })
  }

  let nesteId = 0
  const venter = new Map()          // id → { resolve, reject }
  let dodByFeil = null              // satt når workeren selv falt fra
  let avsluttet = false

  const feilAlle = (lagFeil) => {
    for (const { reject } of venter.values()) reject(lagFeil())
    venter.clear()
  }
  const onAbort = () => { avslutt(); feilAlle(avbrutt) }
  if (signal) {
    if (signal.aborted) { try { worker.terminate() } catch { /* noop */ } ; return synkronOkt({ signal }) }
    signal.addEventListener('abort', onAbort)
  }

  worker.onmessage = (e) => {
    const d = e.data ?? {}
    const p = venter.get(d.id)
    if (!p) return
    venter.delete(d.id)
    if (d.ok) p.resolve(d)
    else p.reject(new Error(d.error ?? 'buildSvg-worker-feil'))
  }
  // Worker-nivå-feil (typisk transient modul-last på GitHub Pages rett etter en
  // deploy: worker-chunken eller en avhengighet lå ikke i SW-cachen ennå).
  // e.message er ofte tom (cross-origin script error). Marker økta som død;
  // bygg() faller da til hovedtråden i stedet for å feile hardt.
  worker.onerror = () => {
    dodByFeil = new Error('buildSvg-worker falt fra')
    feilAlle(() => dodByFeil)
  }

  // Økta holder sitt eget DEM-speil: bygg() trenger DEM-objektet på
  // hovedtråden hvis workeren faller fra midtveis og vi må bygge synkront.
  let sisteDem = null
  let sisteAvledet = null

  function avslutt() {
    if (avsluttet) return
    avsluttet = true
    try { worker.terminate() } catch { /* noop */ }
    if (signal) signal.removeEventListener('abort', onAbort)
    sisteDem = null
    sisteAvledet = null
  }

  async function bygg(elements, bbox, options = {}, { dem = null, gjenbrukDem = false, pakkDem = false } = {}) {
    if (signal?.aborted) throw avbrutt()
    if (!gjenbrukDem) sisteDem = dem ?? null
    if (avsluttet || dodByFeil) return synkronBygg(elements, bbox, options, sisteDem, gjenbrukDem, pakkDem)
    const id = ++nesteId
    try {
      const svar = await new Promise((resolve, reject) => {
        venter.set(id, { resolve, reject })
        // elements (kan være noen MB) struktur-klones til workeren. DEM-et
        // sendes KUN når det er nytt, og transfereres ikke: hovedtråden
        // beholder det som fallback og til buildEntry-metadataene.
        worker.postMessage({
          id, elements, bbox, options,
          dem: gjenbrukDem ? null : sisteDem,
          gjenbrukDem, pakkDem,
        })
      })
      return svar
    } catch (e) {
      if (signal?.aborted) throw avbrutt()
      // Workeren rapporterte en intern feil eller falt fra → siste utvei er
      // hovedtråden. Fryser UI kort, men et kart er bedre enn en feilmelding.
      return synkronBygg(elements, bbox, options, sisteDem, gjenbrukDem, pakkDem)
    }
  }

  function synkronBygg(elements, bbox, options, dem, gjenbrukDem, pakkDem) {
    if (signal?.aborted) throw avbrutt()
    const res = buildSvg(elements, bbox, {
      ...options, dem,
      demDerived: gjenbrukDem ? sisteAvledet : null,
    })
    sisteAvledet = res.demDerived ?? sisteAvledet
    return { ...res, ...(pakkDem && dem ? pakkLagretDem(dem) : {}) }
  }

  return { bygg, avslutt }
}

/** Node / ingen Worker: samme kontrakt, alt på kalle-tråden. */
function synkronOkt({ signal } = {}) {
  let sisteDem = null
  let sisteAvledet = null
  return {
    async bygg(elements, bbox, options = {}, { dem = null, gjenbrukDem = false, pakkDem = false } = {}) {
      if (signal?.aborted) throw avbrutt()
      if (!gjenbrukDem) { sisteDem = dem ?? null; sisteAvledet = null }
      const res = buildSvg(elements, bbox, {
        ...options, dem: sisteDem,
        demDerived: gjenbrukDem ? sisteAvledet : null,
      })
      sisteAvledet = res.demDerived ?? sisteAvledet
      return { ...res, ...(pakkDem && sisteDem ? pakkLagretDem(sisteDem) : {}) }
    },
    avslutt() { sisteDem = null; sisteAvledet = null },
  }
}

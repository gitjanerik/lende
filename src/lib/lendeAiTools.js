// Verktøyene Lende-chatten kan kalle (Fase 3 — klient-side verktøy, jf.
// docs/MCP_REMOTE_CHAT.md Spor 2). Modellen foreslår kall; appen utfører dem
// LOKALT i nettleseren — mot samme maskineri som resten av appen bruker
// (geocode.js, mapStorage.js, router + dyplenke-params fra tour3dLink-flyten).
// Ingen server, ingen ny infrastruktur: chatten er et naturlig-språk-lag oppå
// funksjoner appen allerede har.
//
// Bevisste valg:
//  • `foreslaa_nytt_kart` navigerer til /nytt med pre-utfylte felter — selve
//    byggingen skjer først når BRUKEREN trykker bygg (innebygd bekreftelse;
//    chatten kan ikke brenne mobildata/kvote på egen hånd).
//  • Verktøy som navigerer lukker chat-modalen, ellers skjer alt «bak» den.
//  • Skjemaene er OpenAI-stil function-defs — det Workers AI-modellene leser.

import { geocodePlace } from './geocode.js'
import { listMaps, loadMap, listGravelRoutes } from './mapStorage.js'
import { buildSearchIndex, filterIndex, formatAreaShort } from '../composables/useMapSearch.js'
import { svgToWgs84, wgs84ToSvg } from './utm.js'
import { unpackDem } from './demSampling.js'
import {
  analyserStinett, formatStinettSvar, stinettFeaturesFromSvgEl, estGangtidMin,
} from './stinettAnalyse.js'
import {
  buildRoutingGraph, planRoutesThrough, planLoop, ROUTABLE_CODES, MAX_SNAP_M, FAR_SNAP_M,
} from './routing.js'
import { sampleProfile } from './elevationProfile.js'

// Router lastes lat: da kan testene importere de rene delene (buildTourQuery,
// projectForModel) uten å evaluere hele router→view-treet.
async function navigerTil(target) {
  const { default: router } = await import('../router')
  await router.push(target)
}

export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'sok_sted',
      description:
        'Søk etter et stedsnavn i Norge og få koordinater (lat/lon). Bruk dette først når brukeren nevner et sted ved navn.',
      parameters: {
        type: 'object',
        properties: {
          navn: { type: 'string', description: 'Stedsnavnet, f.eks. «Håøya» eller «Konnerudkollen»' },
        },
        required: ['navn'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mine_kart_og_ruter',
      description:
        'List brukerens lagrede turkart og grusruter (navn, id, størrelse, sist endret). Bruk når brukeren refererer til egne kart/ruter («kartet mitt», «favorittruta», «det fra i går»).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apne_kart',
      description: 'Åpne et av brukerens lagrede turkart. Finn id med mine_kart_og_ruter først.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter' },
        },
        required: ['kartId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'foreslaa_nytt_kart',
      description:
        'Åpne «Nytt turkart» med senter, størrelse og navn ferdig utfylt — brukeren bekrefter og bygger selv. Bruk sok_sted først hvis du bare har et stedsnavn.',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number', description: 'Senter-breddegrad' },
          lon: { type: 'number', description: 'Senter-lengdegrad' },
          km: { type: 'number', description: 'Kartbredde i km (1–16, standard 4)' },
          navn: { type: 'string', description: 'Foreslått kartnavn, f.eks. stedsnavnet' },
        },
        required: ['lat', 'lon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lag_kart',
      description:
        'Bygg et NYTT turkart med én gang: byggingen starter automatisk med senter, størrelse og ' +
        'navn, og kartet åpnes når det er ferdig (tar 15–60 sekunder). Bruk KUN når brukeren ' +
        'eksplisitt ber om å lage/bygge et kart — bruk foreslaa_nytt_kart når du bare foreslår. ' +
        'Bruk sok_sted først hvis du bare har et stedsnavn.',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number', description: 'Senter-breddegrad' },
          lon: { type: 'number', description: 'Senter-lengdegrad' },
          km: { type: 'number', description: 'Kartbredde i km (1–16, standard 4)' },
          navn: { type: 'string', description: 'Kartnavn, f.eks. stedsnavnet' },
        },
        required: ['lat', 'lon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sok_i_kartet',
      description:
        'Søk etter navngitte steder INNE i et lagret kart og naboflisene dets (mosaikken) — ' +
        'tjern/vann, topper, hytter, parkeringer, stedsnavn — med kartets egne, eksakte ' +
        'koordinater (samme søk som appens søkefelt). Hvert treff oppgir hvilken kartflis det ' +
        'ligger i (kartId). Bruk ALLTID denne for å finne start/mål/vendepunkt til foreslaa_tur/' +
        'foreslaa_rundtur — den er fasit; sok_sted (nettbasert geokoding) kan treffe navnebrødre ' +
        'andre steder. Nøkkelord «vann», «topp», «parkering» gir rangerte oversikter.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          sok: { type: 'string', description: 'Fritekst (f.eks. «Stordammen») ELLER nøkkelord: «vann», «topp», «parkering»' },
          maks: { type: 'number', description: 'Maks antall treff (standard 8)' },
        },
        required: ['kartId', 'sok'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyser_stinett',
      description:
        'Analyser stinettet i et lagret kart: total km sti (sti 505/506/507 + skogsbilvei 504, ' +
        'hvert stisegment telt én gang), lengste sammenhengende turstrekning, og tur-kandidater ' +
        '(A→B eller rundtur, minst 0,5 km — hev med minTurKm hvis brukeren vil ha lengre turer) ' +
        'med lengde, gangtid, stigning/fall og bratteste/slakeste parti. Korte småveg-strekk regnes som bindeledd mellom stier, men teller ikke ' +
        'i sti-summen; korte isolerte stumper ekskluderes. Bruk ved spørsmål som «hvor mange km ' +
        'sti er det her?», «hva er den lengste turen?», «hvilken tur har minst stigning?». Hver ' +
        'tur returnerer koordinater du kan sende rett videre: start/slutt/via → foreslaa_tur, ' +
        'origo/via → foreslaa_rundtur. Analysen gjelder kun dette kartet (ikke nabofliser). ' +
        'treff kan være 0 når nettet bare har korte fragmenter — si det ærlig da. Står ' +
        'brukeren i et kart trengs INGEN argumenter — kall verktøyet uten kartId.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter — KUN for et annet kart enn det brukeren står i (ellers utelat, kartet hentes fra konteksten)' },
          minTurKm: { type: 'number', description: 'Minste turlengde i km for tur-kandidater (standard 0,5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'foreslaa_rundtur',
      description:
        'Foreslå og tegn inn en RUNDTUR (start = mål) på et av brukerens lagrede kart: fra et ' +
        'startpunkt, innom et vendepunkt, og tilbake — langs kartets stier og veier. Ruten ' +
        'markeres i kartet. Bruk denne når brukeren ber om en rundtur/runde i kartet — IKKE ' +
        'foreslaa_nytt_kart. Begge punktene må ligge i kartet; bruk sok_sted for koordinater. ' +
        'Verktøyet beregner sløyfen før den tegnes og returnerer «rute» med ekte lengde, ' +
        'stigning og gangtid — bruk DE tallene, aldri egne anslag.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          origoLat: { type: 'number', description: 'Startpunkt = målpunkt (breddegrad). Spør brukeren hvor turen skal starte hvis ukjent.' },
          origoLon: { type: 'number', description: 'Startpunkt = målpunkt (lengdegrad)' },
          viaLat: { type: 'number', description: 'Vendepunkt turen skal innom (breddegrad), f.eks. en topp' },
          viaLon: { type: 'number', description: 'Vendepunkt (lengdegrad)' },
          navn: { type: 'string', description: 'Turnavn, f.eks. «Rundtur Konnerudkollen»' },
          vis3d: { type: 'boolean', description: 'Åpne 3D-visningen automatisk (KUN når brukeren har bedt om 3D — ruten tegnes uansett)' },
        },
        required: ['kartId', 'origoLat', 'origoLon', 'viaLat', 'viaLon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'foreslaa_tur',
      description:
        'Foreslå og tegn inn en fottur fra A til B på et av brukerens lagrede kart, langs ' +
        'kartets stier og veier (Stifinneren). Ruten markeres i kartet. Begge punktene må ligge ' +
        'innenfor kartet. Verktøyet beregner ruten før den tegnes og returnerer «rute» med ekte ' +
        'lengde, stigning og gangtid — bruk DE tallene i svaret, aldri egne anslag. Mangler ' +
        '«rute», er turen ikke beregnet ennå: nevn da ingen tall. Sett vis3d KUN når brukeren ' +
        'eksplisitt har bedt om 3D — ellers tegnes ruten bare, og du kan tilby 3D som neste steg.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          fraLat: { type: 'number' },
          fraLon: { type: 'number' },
          tilLat: { type: 'number' },
          tilLon: { type: 'number' },
          navn: { type: 'string', description: 'Turnavn, f.eks. «Stormoen–Konnerudkollen»' },
          vis3d: { type: 'boolean', description: 'Åpne 3D-visningen automatisk (KUN når brukeren har bedt om 3D)' },
        },
        required: ['kartId', 'fraLat', 'fraLon', 'tilLat', 'tilLon'],
      },
    },
  },
]

/**
 * Km fra et WGS84-punkt til nærmeste kant av kartets bbox — 0 når punktet er
 * innenfor. Equirektangulær tilnærming (god nok for «er dette i kartet?»).
 * Vaktpost for vis_tur_i_3d: geokoding kan treffe feil navnebror (mange
 * steder heter det samme), og da skal turen IKKE startes med punkter milevis
 * utenfor kartet.
 */
export function kmUtenforBbox(bbox, { lat, lon }) {
  if (!bbox || !Number.isFinite(lat) || !Number.isFinite(lon)) return 0
  const dLat = Math.max(bbox.south - lat, 0, lat - bbox.north)
  const dLon = Math.max(bbox.west - lon, 0, lon - bbox.east)
  if (dLat === 0 && dLon === 0) return 0
  const midLat = (bbox.south + bbox.north) / 2
  return Math.hypot(dLat * 111, dLon * 111 * Math.cos(midLat * Math.PI / 180))
}

/** Km i luftlinje mellom to WGS84-punkter (samme tilnærming). */
export function kmMellom(a, b) {
  const midLat = ((a.lat + b.lat) / 2) * Math.PI / 180
  return Math.hypot((b.lat - a.lat) * 111, (b.lon - a.lon) * 111 * Math.cos(midLat))
}

/**
 * Ren bygging av lag_kart-query (samme parametre som parseShareInvite i
 * MapPickerContent leser, pluss auto=1 som starter byggingen). Skilt ut for
 * testbarhet.
 */
export function buildLagKartQuery({ lat, lon, km, navn }) {
  const query = { lat: Number(lat).toFixed(5), lon: Number(lon).toFixed(5), auto: '1' }
  const b = Number(km)
  query.km = String(Number.isFinite(b) ? Math.min(Math.max(b, 1), 16) : 4)
  if (navn) query.hl = String(navn).slice(0, 60)
  return query
}

/**
 * Ren bygging av rundtur-query (parseTourQuery: olat/olon + rtv uten dest =
 * rundtur). Skilt ut for testbarhet.
 */
export function buildRundturQuery({ origoLat, origoLon, viaLat, viaLon, navn, vis3d }) {
  const q = {
    olat: Number(origoLat).toFixed(6),
    olon: Number(origoLon).toFixed(6),
    rtv: `${Number(viaLat).toFixed(6)},${Number(viaLon).toFixed(6)}`,
    ri: '0',
  }
  if (vis3d) q.v3d = '1'
  if (navn) q.tn = String(navn).slice(0, 60)
  return q
}

/**
 * Ren bygging av tur-query (samme parametre som parseTourQuery i tour3dLink.js
 * leser i MapView). Skilt ut for testbarhet.
 */
export function buildTourQuery({ fraLat, fraLon, tilLat, tilLon, navn, vis3d }) {
  const q = {
    olat: Number(fraLat).toFixed(6),
    olon: Number(fraLon).toFixed(6),
    dlat: Number(tilLat).toFixed(6),
    dlon: Number(tilLon).toFixed(6),
  }
  if (vis3d) q.v3d = '1'
  if (navn) q.tn = String(navn).slice(0, 60)
  return q
}

/** Kompakt liste-projeksjon for modellen — små tokens, nok til å velge. */
export function projectForModel(maps, routes) {
  return {
    kart: maps.map((m) => ({
      id: m.id,
      navn: m.navn ?? 'Uten navn',
      kmBredde: m.meta?.widthM ? +(m.meta.widthM / 1000).toFixed(1) : null,
      sistEndret: m.updatedAt ?? m.createdAt ?? null,
    })),
    grusruter: routes.map((r) => ({
      id: r.id,
      navn: r.navn ?? 'Uten navn',
      sistEndret: r.updatedAt ?? r.createdAt ?? null,
    })),
  }
}

/**
 * Kjør ett verktøykall. Returnerer et JSON-vennlig resultat-objekt som sendes
 * tilbake til modellen som `role: "tool"`-melding. Kaster aldri — feil
 * returneres som { feil } så modellen kan forklare/prøve på nytt.
 * `onNavigate` kalles når verktøyet navigerer (chat-modalen bør lukkes).
 */
// Kartets UTM-forankring leses fra SVG-ens eget data-meta-attributt — lagrede
// app-kart (MapEntry) har IKKE noe meta-felt; det er kun MCP-/headless-bygde
// objekter som bærer meta separat. Returnerer {minE,minN,widthM,heightM} | null.
export function metaFraSvgEl(svgEl) {
  try {
    const gm = JSON.parse(svgEl.getAttribute('data-meta'))
    const minE = gm?.utmBbox?.minE ?? gm?.minE
    const minN = gm?.utmBbox?.minN ?? gm?.minN
    if (![minE, minN, gm?.widthM, gm?.heightM].every(Number.isFinite)) return null
    return { minE, minN, widthM: gm.widthM, heightM: gm.heightM }
  } catch {
    return null
  }
}

// Fliser i mosaikken rundt et kart (inkl. kartet selv): lagrede kart hvis
// WGS84-bbox ligger inntil (≤ ~0,3 km fra) kartets bbox. Bevisst bbox-basert
// (ikke UTM-gitter som spøkelses-flisene): lagrede kart bærer alltid bbox,
// og for søk/vaktpost er nabo-skap nok — Stifinneren gir uansett ærlig feil
// hvis stinettet ikke henger sammen.
async function mosaikkFliser(id, kart) {
  const alle = (await listMaps()) ?? []
  return [kart, ...alle.filter((e) => e.id !== id && e.bbox
    && bboxAvstandKm(kart.bbox, e.bbox) <= 0.3)]
}

/** Km mellom to WGS84-bbokser (0 = overlapper/berører). Eksportert for test. */
export function bboxAvstandKm(a, b) {
  const dLat = Math.max(a.south - b.north, b.south - a.north, 0)
  const dLon = Math.max(a.west - b.east, b.west - a.east, 0)
  if (dLat === 0 && dLon === 0) return 0
  const midLat = ((a.south + a.north + b.south + b.north) / 4) * Math.PI / 180
  return Math.hypot(dLat * 111, dLon * 111 * Math.cos(midLat))
}

// Km utenfor NÆRMESTE flis i mosaikken (0 = inne i en av dem). Turer kan gå
// på tvers av flisegrenser (Stifinner ruter via spøkelses-flisene), så
// vaktposten skal godta punkter i hele mosaikken — ikke bare aktiv flis.
function kmUtenforMosaikk(fliser, p) {
  return Math.min(...fliser.map((f) => kmUtenforBbox(f.bbox, p)))
}

// Løs kart-id for kart-verktøyene: modellens oppgitte id kan mangle
// (beskrivelsene sier «utelat når brukeren står i kartet») eller være
// utdatert fra tidligere i samtalen — fall tilbake til kontekstens kartId
// (kartet brukeren faktisk ser på). Returnerer { id, kart } eller null.
async function losKart(args, kontekst) {
  const oppgitt = String(args?.kartId ?? '').trim()
  if (oppgitt) {
    const kart = await loadMap(oppgitt)
    if (kart?.svg) return { id: oppgitt, kart }
  }
  const kontekstId = String(kontekst?.kartId ?? '').trim()
  if (kontekstId && kontekstId !== oppgitt) {
    const kart = await loadMap(kontekstId)
    if (kart?.svg) return { id: kontekstId, kart }
  }
  return null
}

// Forhåndsberegning mot et lagret kart. Returnerer null når den ikke kan
// gjøres trygt — da navigerer vi som før og lover ingen tall:
//  • kartet mangler geodata (data-meta)
//  • et punkt ligger UTENFOR kartets egen flis (kartvisningen ruter da via
//    spøkelses-flisene, som ikke finnes i den lagrede SVG-en)
function forhaandsberegnFraKart(kart, punkter, isLoop) {
  try {
    if (punkter.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) return null
    if (punkter.some((p) => kmUtenforBbox(kart.bbox, p) > 0)) return null
    const doc = new DOMParser().parseFromString(kart.svg, 'image/svg+xml')
    const svgEl = doc.documentElement
    const meta = metaFraSvgEl(svgEl)
    if (!meta) return null
    return forhaandsberegnTur({
      svgEl, meta, dem: kart.dem ? unpackDem(kart.dem) : null, punkter, isLoop,
    })
  } catch {
    return null
  }
}

export async function runTool(name, args, { onNavigate, kontekst } = {}) {
  try {
    switch (name) {
      case 'sok_sted': {
        const treff = await geocodePlace(String(args?.navn ?? '').trim())
        if (!treff?.length) return { feil: `Fant ingen steder for «${args?.navn}».` }
        // Med et kart åpent: avstand fra kartsenteret per treff, nærmest
        // først — så modellen velger riktig navnebror («Stormoen» finnes
        // mange steder i Norge).
        const senter = kontekst?.senter
        const harSenter = Number.isFinite(senter?.lat) && Number.isFinite(senter?.lon)
        const rader = treff.slice(0, 3).map((t) => {
          const rad = {
            navn: t.name,
            lat: +Number(t.lat).toFixed(5),
            lon: +Number(t.lon).toFixed(5),
            beskrivelse: t.label ?? t.type ?? null,
          }
          if (harSenter) rad.avstandKmFraKartet = +kmMellom(senter, rad).toFixed(1)
          return rad
        })
        if (harSenter) rader.sort((a, b) => a.avstandKmFraKartet - b.avstandKmFraKartet)
        return { treff: rader }
      }
      case 'mine_kart_og_ruter': {
        const [maps, routes] = await Promise.all([listMaps(), listGravelRoutes()])
        return projectForModel(maps ?? [], routes ?? [])
      }
      case 'apne_kart': {
        const id = String(args?.kartId ?? '')
        const maps = await listMaps()
        const kart = (maps ?? []).find((m) => m.id === id)
        if (!kart) return { feil: `Fant ikke kart med id «${id}». Bruk mine_kart_og_ruter.` }
        onNavigate?.()
        await navigerTil({ name: 'kart-vis', params: { id } })
        return { ok: true, aapnet: kart.navn ?? id }
      }
      case 'foreslaa_nytt_kart': {
        const lat = Number(args?.lat)
        const lon = Number(args?.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { feil: 'lat/lon mangler.' }
        const query = { lat: lat.toFixed(5), lon: lon.toFixed(5) }
        const km = Number(args?.km)
        if (Number.isFinite(km)) query.km = String(Math.min(Math.max(km, 1), 16))
        if (args?.navn) query.hl = String(args.navn).slice(0, 60)
        onNavigate?.()
        await navigerTil({ name: 'kart-nytt', query })
        return {
          ok: true,
          merknad: 'Byggeskjemaet er åpnet med feltene utfylt — brukeren bekrefter og bygger selv.',
        }
      }
      case 'lag_kart': {
        const lat = Number(args?.lat)
        const lon = Number(args?.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { feil: 'lat/lon mangler.' }
        const query = buildLagKartQuery({ lat, lon, km: args?.km, navn: args?.navn })
        onNavigate?.()
        await navigerTil({ name: 'kart-nytt', query })
        return {
          ok: true,
          merknad:
            'Byggingen er startet (tar 15–60 sekunder) — kartet åpnes automatisk når det er ' +
            'ferdig. VIKTIG: ikke lov brukeren at det lykkes; ved feil vises en melding i ' +
            'byggeskjemaet der brukeren kan justere og prøve igjen.',
        }
      }
      case 'sok_i_kartet': {
        const løst = await losKart(args, kontekst)
        if (!løst) return { feil: `Fant ikke kart med id «${args?.kartId}». Bruk mine_kart_og_ruter.` }
        const { id, kart } = løst
        const maks = Math.min(Math.max(Number(args?.maks) || 8, 1), 30)

        // Mosaikk: den viste flaten kan bestå av flere grid-kompatible fliser
        // (spøkelses-fliser i MapView). Søk i aktiv flis + naboene, så hele det
        // synlige kartet oppleves som ETT kart — treffene merkes med hvilken
        // flis de ligger i.
        const naboer = (await mosaikkFliser(id, kart)).slice(1, 9)

        // getBBox() krever et RENDRET element (kaster på detached dokument) —
        // monter den parsede SVG-en usynlig i DOM-en mens indeksen bygges.
        const sokIEttKart = (entry) => {
          const doc = new DOMParser().parseFromString(entry.svg, 'image/svg+xml')
          const svgEl = document.importNode(doc.documentElement, true)
          // UTM-forankringen leses fra SVG-ens data-meta — lagrede app-kart
          // har ikke noe meta-felt på entry-en.
          const m = metaFraSvgEl(svgEl)
          if (!m) return []
          const holder = document.createElement('div')
          holder.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none'
          holder.appendChild(svgEl)
          document.body.appendChild(holder)
          let rader
          try {
            rader = filterIndex(buildSearchIndex(svgEl), String(args?.sok ?? ''), maks)
          } finally {
            holder.remove()
          }
          return rader.map((r) => {
            const ll = svgToWgs84(r.x, r.y, m)
            const o = {
              navn: r.name,
              type: r.label ?? r.kind,
              lat: +ll.lat.toFixed(6),
              lon: +ll.lon.toFixed(6),
              kartId: entry.id,
              kart: entry.navn ?? entry.id,
            }
            if (Number.isFinite(r.ele)) o.moh = Math.round(r.ele)
            if (Number.isFinite(r.areaM2) && r.areaM2 > 0) o.areal = formatAreaShort(r.areaM2)
            return o
          })
        }

        const treff = [...sokIEttKart(kart)]
        for (const nabo of naboer) {
          if (treff.length >= maks) break
          const full = await loadMap(nabo.id)
          if (full?.svg) treff.push(...sokIEttKart(full))
        }
        if (!treff.length) {
          return {
            treff: [],
            sokteKart: [kart.navn ?? id, ...naboer.map((n) => n.navn ?? n.id)],
            merknad:
              `Ingen treff for «${args?.sok}» i kartet «${kart.navn ?? id}»` +
              (naboer.length ? ` eller de ${naboer.length} naboflisene` : '') +
              '. Stedet ligger trolig utenfor — forklar det ærlig, og tilby å bygge et nytt ' +
              'kart som dekker området (lag_kart) hvis brukeren vil dit.',
          }
        }
        return {
          treff: treff.slice(0, maks),
          merknad:
            'Treff med annen kartId enn brukerens aktive kart ligger i en NABOFLIS i samme ' +
            'mosaikk — turer kan tegnes på tvers: bruk koordinatene direkte i foreslaa_tur/' +
            'foreslaa_rundtur (appen laster naboflisene automatisk).',
        }
      }
      case 'analyser_stinett': {
        const løst = await losKart(args, kontekst)
        if (!løst) {
          return {
            feil: args?.kartId
              ? `Fant ikke kart med id «${args.kartId}». Bruk mine_kart_og_ruter.`
              : 'Ingen kart er åpent — finn kartId med mine_kart_og_ruter og oppgi den, eller be brukeren åpne kartet.',
          }
        }
        const { id, kart } = løst
        // Trenger ikke montering (ingen getBBox) — geometrien leses rett fra
        // path-d-attributtene i den parsede SVG-en.
        const doc = new DOMParser().parseFromString(kart.svg, 'image/svg+xml')
        const svgEl = doc.documentElement
        const m = metaFraSvgEl(svgEl)
        if (!m) return { feil: `Kartet «${kart.navn ?? id}» mangler geodata (data-meta) — bygg kartet på nytt.` }
        const minTurKm = Number(args?.minTurKm)
        const analyse = analyserStinett(stinettFeaturesFromSvgEl(svgEl), {
          // Lagrede kart bærer dem kun når høydedataene er ekte (createMapFlow
          // dropper syntetisk DEM) — null her = utelat stigningsfelter.
          dem: kart.dem ? unpackDem(kart.dem) : null,
          arealKm2: (m.widthM * m.heightM) / 1e6,
          minTurM: Number.isFinite(minTurKm)
            ? Math.min(Math.max(minTurKm, 0.5), 20) * 1000
            : 500,
        })
        return {
          kart: kart.navn ?? id,
          kartId: id,
          kartKm: { bredde: +(m.widthM / 1000).toFixed(1), hoyde: +(m.heightM / 1000).toFixed(1) },
          ...formatStinettSvar(analyse, { toWgs84: (x, y) => svgToWgs84(x, y, m) }),
        }
      }
      case 'foreslaa_rundtur': {
        const løst = await losKart(args, kontekst)
        if (!løst) return { feil: `Fant ikke kart med id «${args?.kartId}». Bruk mine_kart_og_ruter.` }
        const { id, kart } = løst
        const fliser = await mosaikkFliser(id, kart)
        for (const [navn, p] of [
          ['Startpunktet', { lat: Number(args?.origoLat), lon: Number(args?.origoLon) }],
          ['Vendepunktet', { lat: Number(args?.viaLat), lon: Number(args?.viaLon) }],
        ]) {
          const km = kmUtenforMosaikk(fliser, p)
          if (km > 0.2) {
            return {
              feil:
                `${navn} (${p.lat}, ${p.lon}) ligger ~${km.toFixed(1)} km utenfor kartet ` +
                `«${kart.navn ?? id}» og naboflisene — ingen rundtur ble startet. Sjekk ` +
                'sok_i_kartet-/sok_sted-treffet eller spør brukeren.',
            }
          }
        }
        // Forhåndsberegn mot kartets egen SVG: gir ekte tall å svare med, og
        // fanger «ingen sti i nærheten» FØR vi navigerer til en feilmelding.
        const forh = forhaandsberegnFraKart(kart, [
          { lat: Number(args?.origoLat), lon: Number(args?.origoLon) },
          { lat: Number(args?.viaLat), lon: Number(args?.viaLon) },
        ], true)
        if (forh?.feil) return { feil: `${forh.feil} Ingen rundtur ble startet.` }

        const q = buildRundturQuery(args ?? {})
        onNavigate?.()
        await navigerTil({ name: 'kart-vis', params: { id }, query: q })
        return {
          ok: true,
          rute: forh?.rute,
          merknad: forh?.rute
            ? `Rundturen er beregnet på kartets stier og tegnes inn i «${kart.navn ?? id}» nå. ` +
              'Tallene i «rute» er de kartet viser — bruk dem, ikke gjett.'
            : `Åpner «${kart.navn ?? id}» og beregner rundturen på kartets stier — ruten tegnes ` +
              'inn hvis en sløyfe finnes. VIKTIG: ikke lov brukeren at det lykkes, og oppgi ' +
              'ALDRI lengde, høydemeter eller gangtid: de er ikke beregnet ennå.',
        }
      }
      // vis_tur_i_3d er det gamle navnet — beholdes som alias fordi pågående
      // samtaler kan ha det i historikken sin.
      case 'foreslaa_tur':
      case 'vis_tur_i_3d': {
        const løst = await losKart(args, kontekst)
        if (!løst) return { feil: `Fant ikke kart med id «${args?.kartId}». Bruk mine_kart_og_ruter.` }
        const { id, kart } = løst
        // Vaktpost: punkter utenfor mosaikken (typisk feil geokode-treff) skal
        // ikke starte en tur — chatten forblir åpen og modellen må forklare.
        const fliser = await mosaikkFliser(id, kart)
        for (const [navn, p] of [
          ['Startpunktet', { lat: Number(args?.fraLat), lon: Number(args?.fraLon) }],
          ['Målpunktet', { lat: Number(args?.tilLat), lon: Number(args?.tilLon) }],
        ]) {
          const km = kmUtenforMosaikk(fliser, p)
          if (km > 0.2) {
            return {
              feil:
                `${navn} (${p.lat}, ${p.lon}) ligger ~${km.toFixed(1)} km utenfor kartet ` +
                `«${kart.navn ?? id}» og naboflisene — ingen tur ble startet. Sjekk ` +
                'sok_i_kartet-/sok_sted-treffet: flere steder kan hete det samme, eller ' +
                'tilby å bygge et nytt kart over riktig område med lag_kart.',
            }
          }
        }
        // Forhåndsberegn mot kartets egen SVG: gir ekte tall å svare med, og
        // fanger «ingen sti i nærheten» FØR vi navigerer til en feilmelding.
        const forh = forhaandsberegnFraKart(kart, [
          { lat: Number(args?.fraLat), lon: Number(args?.fraLon) },
          { lat: Number(args?.tilLat), lon: Number(args?.tilLon) },
        ], false)
        if (forh?.feil) return { feil: `${forh.feil} Ingen tur ble startet.` }

        const q = buildTourQuery(args ?? {})
        onNavigate?.()
        await navigerTil({ name: 'kart-vis', params: { id }, query: q })
        return {
          ok: true,
          rute: forh?.rute,
          merknad: (forh?.rute
            ? `Turen er beregnet på kartets stier og tegnes inn i «${kart.navn ?? id}» nå. ` +
              'Tallene i «rute» er de kartet viser — bruk dem, ikke gjett.'
            : `Åpner «${kart.navn ?? id}» og beregner turen på kartets stier — ruten tegnes inn ` +
              'hvis en sti-forbindelse finnes. VIKTIG: ikke lov brukeren at det lykkes, og oppgi ' +
              'ALDRI lengde, høydemeter eller gangtid: de er ikke beregnet ennå.') +
            (args?.vis3d ? ' 3D åpnes automatisk.' : ' Tilby gjerne 3D-visning som neste steg.'),
        }
      }
      default:
        return { feil: `Ukjent verktøy «${name}».` }
    }
  } catch (err) {
    return { feil: `Verktøyet feilet: ${err?.message ?? 'ukjent årsak'}` }
  }
}

/**
 * Er dette et stinett-spørsmål som bør besvares med analyser_stinett?
 * Deterministisk klient-side ruting: llama-modellens verktøyvelging er skjør
 * («Your input is lacking necessary details» i stedet for kall), så når
 * brukeren står i et kart og spør om km sti / lengste tur / bratteste tur,
 * kjører chatten analysen SELV før modellen spør — modellen skal bare
 * formulere svaret.
 */
export function erStinettSporsmaal(tekst) {
  const s = String(tekst ?? '').toLowerCase()
  if (!s) return false
  if (/stinett/.test(s)) return true
  if (/(km|kilometer|mil)[^.!?]{0,30}(sti|tursti)|(sti|tursti)[^.!?]{0,30}(km|kilometer|mil)/.test(s)) return true
  if (/(hvor (mange|mye)|antall|total)[^.!?]{0,30}(stier|sti\b|tursti)/.test(s)) return true
  if (/lengste[^.!?]{0,30}(tur|sti|vandring)/.test(s)) return true
  if (/(bratteste?|slakeste?|minst stigning|mest stigning)[^.!?]{0,30}(tur|sti)/.test(s)) return true
  return false
}

const kommaTall = (n) => String(n).replace('.', ',')

/**
 * Deterministisk norsk svar bygget rett fra analyser_stinett-resultatet —
 * nødutgangen når modellen svarer med hermetisk engelsk («Your input is
 * lacking …») i stedet for å formulere analysen den fikk servert. Brukeren
 * skal ALDRI se de meldingene når analysen faktisk er kjørt.
 */
export function stinettSvarTekst(a) {
  if (!a?.stinett) return ''
  const deler = []
  const dim = a.kartKm ? ` (kartet er ${kommaTall(a.kartKm.bredde)} × ${kommaTall(a.kartKm.hoyde)} km)` : ''
  deler.push(a.totalStiTekst
    ? `Det er ${a.totalStiTekst} turstier i kartet${dim}.`
    : `Det er ${kommaTall(a.stinett.totalStiKm)} km tursti i kartet${dim}.`)
  if (a.lengsteVandringKm > 0) {
    deler.push(`Den lengste sammenhengende strekningen er ${kommaTall(a.lengsteVandringKm)} km.`)
  }
  if (a.treff > 0) {
    const t = a.turer[0]
    const beskrivelse = `en ${t.type === 'rundtur' ? 'rundtur' : 'tur'} på ${kommaTall(t.lengdeKm)} km${t.stigningM != null ? ` med ${t.stigningM} m stigning` : ''}`
    deler.push(a.treff === 1
      ? `Jeg fant ett turforslag — ${beskrivelse}.`
      : `Jeg fant ${a.treff} turforslag — det lengste er ${beskrivelse}.`)
    deler.push('Si fra hvis du vil ha turen tegnet inn i kartet.')
  } else {
    deler.push('Ingen sammenhengende strekninger nådde minstekravet til turforslag.')
  }
  return deler.join(' ')
}

/**
 * Forhåndsberegn turen chatten er i ferd med å sende til kartet, mot kartets
 * EGEN lagrede SVG — samme graf-parametre, samme snap-terskler og samme
 * rute-valg (indeks 0) som Stifinneren bruker i kartvisningen, så tallene i
 * chatten er de samme brukeren ser når ruten er tegnet inn.
 *
 * @returns {{rute: {lengdeKm:number, stigningM?:number, fallM?:number, gangtidMin:number, snapMerknad?:string}}
 *   | {feil: string} | {ingenRute: true}}
 */
export function forhaandsberegnTur({ svgEl, meta, dem = null, punkter, isLoop = false }) {
  const features = stinettFeaturesFromSvgEl(svgEl, ROUTABLE_CODES)
  if (!features.length) return { ingenRute: true }
  const rg = buildRoutingGraph(features, { snapM: 6, componentBridgeM: 80 })

  const navnFor = (i) => (
    isLoop ? (i === 0 ? 'startpunktet' : `vendepunkt ${i}`)
      : i === 0 ? 'startpunktet' : i === punkter.length - 1 ? 'målet' : `via-punkt ${i}`
  )
  const snapped = []
  const fjerne = []
  for (let i = 0; i < punkter.length; i++) {
    const p = wgs84ToSvg(punkter[i].lat, punkter[i].lon, meta)
    const n = rg.nearestNode([p.x, p.y])
    if (!n || n.distM > FAR_SNAP_M) {
      return {
        feil: `Ingen sti eller vei i nærheten av ${navnFor(i)} — nærmeste er ` +
          `${n ? Math.round(n.distM) : 'over 1000'} m unna (grensen er ${FAR_SNAP_M} m).`,
      }
    }
    if (n.distM > MAX_SNAP_M) fjerne.push(`${navnFor(i)} ${Math.round(n.distM)} m`)
    snapped.push(n)
  }

  const ids = snapped.map((n) => n.id)
  const funnet = isLoop
    ? planLoop(rg, ids[0], ids.slice(1), { k: 3 })
    : planRoutesThrough(rg, ids, { k: 3 })
  // Kartvisningen velger indeks 0 (ri=0 i dyplenken), og planRoutes sorterer
  // stigende på lengde — samme rute her.
  const r = funnet[0]
  if (!r) return { ingenRute: true }

  const rute = { lengdeKm: +(r.lengthM / 1000).toFixed(1) }
  const profil = dem
    ? sampleProfile({ points: r.coordinates.map(([x, y]) => ({ x, y })) }, dem)
    : null
  if (profil) {
    rute.stigningM = Math.round(profil.totalAscent)
    rute.fallM = Math.round(profil.totalDescent)
  }
  rute.gangtidMin = estGangtidMin(r.lengthM, rute.stigningM ?? 0, rute.fallM ?? 0)
  if (fjerne.length) {
    rute.snapMerknad = `Ruten går så nær som stinettet kommer — ${fjerne.join(', ')} fra nærmeste sti.`
  }
  return { rute }
}

/**
 * Inneholder svaret tall som IKKE kan være kjent? foreslaa_tur/foreslaa_rundtur
 * navigerer bare — ruten beregnes i kartvisningen etterpå, så verktøysvaret har
 * aldri lengde, høydemeter eller gangtid. Nevner modellen slike tall likevel,
 * har den diktet dem opp («Turen er tegnet inn. Den er 4,7 km lang med 180
 * høydemeter …» på en tur som aldri ble beregnet).
 */
export function harOppdiktedeTurtall(tekst) {
  const s = String(tekst ?? '')
  return /\d+(?:[.,]\d+)?\s*(?:km\b|kilometer|meter\b|m\b|høydemeter|hm\b)/i.test(s) ||
    /\d+\s*(?:min\b|minutt|timer?\b)/i.test(s)
}

/** «74» → «1 t 14 min», «45» → «45 min». */
export function formatGangtid(min) {
  const m = Math.max(1, Math.round(min))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} t ${String(m % 60).padStart(2, '0')} min`
}

/**
 * Deterministisk, ærlig bekreftelse etter at en tur er sendt til kartet.
 * Med `rute` fra forhaandsberegnTur oppgis EKTE tall (samme som kartet
 * tegner); uten den nevnes ingen tall i det hele tatt.
 */
export function turSvarTekst({ type = 'tur', vis3d = false, rute = null } = {}) {
  const ordet = type === 'rundtur' ? 'Rundturen' : 'Turen'
  const treD = vis3d ? 'Turen åpnes i 3D.' : 'Si fra hvis du vil se den i 3D.'
  if (!rute) {
    return `Jeg åpner kartet og beregner ${ordet.toLowerCase()} nå — lengde, stigning og ` +
      `gangtid vises i kartet så snart ruten er tegnet inn. ${treD}`
  }
  const biter = [`${ordet} er ${String(rute.lengdeKm).replace('.', ',')} km`]
  if (rute.stigningM != null) biter.push(`${rute.stigningM} høydemeter stigning`)
  biter.push(`omtrent ${formatGangtid(rute.gangtidMin)} gangtid`)
  const hale = biter.length > 2
    ? `${biter.slice(0, -1).join(', ')} og ${biter[biter.length - 1]}`
    : biter.join(' og ')
  return `${hale}. Den tegnes inn i kartet nå.` +
    (rute.snapMerknad ? ` ${rute.snapMerknad}` : '') + ` ${treD}`
}

/**
 * Ber brukeren om å se den nettopp tegnede turen i 3D? Deterministisk, fordi
 * modellen ellers må gjenskape hele foreslaa_tur-kallet med koordinater fra
 * historikken — skjørt, og «se ruta i 3D» kunne feile der «se ruten i 3D»
 * lyktes. Bokmål har flere bestemte former (ruta/ruten, løypa/løypen), og et
 * bart «ja» rett etter at vi tilbød 3D betyr det samme.
 *
 * @param {string} tekst          brukerens melding
 * @param {boolean} tilbudt3d     nevnte forrige assistent-svar 3D?
 */
export function er3dOnske(tekst, tilbudt3d = false) {
  const s = String(tekst ?? '').trim().toLowerCase()
  if (!s) return false
  if (/\b3\s*-?d\b/.test(s)) return true
  if (tilbudt3d && /^(ja|ja takk|jada|gjerne|ok|okey|greit|jepp|yes|vis den|vis meg den)\b/.test(s)) return true
  return false
}

/** Kort norsk statuslinje per verktøy — vises i chatten mens kallet kjører. */
export function toolStatusLabel(name, args) {
  switch (name) {
    case 'sok_sted': return `Søker etter «${args?.navn ?? '…'}» …`
    case 'mine_kart_og_ruter': return 'Ser i kartene og rutene dine …'
    case 'apne_kart': return 'Åpner kartet …'
    case 'foreslaa_nytt_kart': return 'Gjør klart nytt kart …'
    case 'lag_kart': return 'Starter kartbygging …'
    case 'sok_i_kartet': return `Søker i kartet etter «${args?.sok ?? '…'}» …`
    case 'analyser_stinett': return 'Analyserer stinettet …'
    case 'foreslaa_tur':
    case 'vis_tur_i_3d': return 'Beregner turen …'
    case 'foreslaa_rundtur': return 'Beregner rundtur …'
    default: return `Kjører ${name} …`
  }
}

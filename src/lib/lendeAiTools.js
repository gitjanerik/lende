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
import { listMaps, listGravelRoutes } from './mapStorage.js'

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
      name: 'foreslaa_rundtur',
      description:
        'Foreslå og tegn inn en RUNDTUR (start = mål) på et av brukerens lagrede kart: fra et ' +
        'startpunkt, innom et vendepunkt, og tilbake — langs kartets stier og veier. Ruten ' +
        'markeres i kartet. Bruk denne når brukeren ber om en rundtur/runde i kartet — IKKE ' +
        'foreslaa_nytt_kart. Begge punktene må ligge i kartet; bruk sok_sted for koordinater.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          origoLat: { type: 'number', description: 'Startpunkt = målpunkt (breddegrad). Spør brukeren hvor turen skal starte hvis ukjent.' },
          origoLon: { type: 'number', description: 'Startpunkt = målpunkt (lengdegrad)' },
          viaLat: { type: 'number', description: 'Vendepunkt turen skal innom (breddegrad), f.eks. en topp' },
          viaLon: { type: 'number', description: 'Vendepunkt (lengdegrad)' },
          navn: { type: 'string', description: 'Turnavn, f.eks. «Rundtur Konnerudkollen»' },
          vis3d: { type: 'boolean', description: 'Åpne 3D-visningen automatisk (standard false — ruten tegnes uansett)' },
        },
        required: ['kartId', 'origoLat', 'origoLon', 'viaLat', 'viaLon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'vis_tur_i_3d',
      description:
        'Vis en fottur fra A til B i 3D-visningen på et av brukerens lagrede kart. Begge punktene må ligge innenfor kartet. Bruk mine_kart_og_ruter for kartId og sok_sted for koordinater ved behov.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          fraLat: { type: 'number' },
          fraLon: { type: 'number' },
          tilLat: { type: 'number' },
          tilLon: { type: 'number' },
          navn: { type: 'string', description: 'Turnavn, f.eks. «Stormoen–Konnerudkollen»' },
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
export function buildTourQuery({ fraLat, fraLon, tilLat, tilLon, navn }) {
  const q = {
    olat: Number(fraLat).toFixed(6),
    olon: Number(fraLon).toFixed(6),
    dlat: Number(tilLat).toFixed(6),
    dlon: Number(tilLon).toFixed(6),
    v3d: '1',
  }
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
      case 'foreslaa_rundtur': {
        const id = String(args?.kartId ?? '')
        const maps = await listMaps()
        const kart = (maps ?? []).find((m) => m.id === id)
        if (!kart) return { feil: `Fant ikke kart med id «${id}». Bruk mine_kart_og_ruter.` }
        for (const [navn, p] of [
          ['Startpunktet', { lat: Number(args?.origoLat), lon: Number(args?.origoLon) }],
          ['Vendepunktet', { lat: Number(args?.viaLat), lon: Number(args?.viaLon) }],
        ]) {
          const km = kmUtenforBbox(kart.bbox, p)
          if (km > 0.2) {
            return {
              feil:
                `${navn} (${p.lat}, ${p.lon}) ligger ~${km.toFixed(1)} km utenfor kartet ` +
                `«${kart.navn ?? id}» — ingen rundtur ble startet. Sjekk sok_sted-treffet ` +
                '(velg treffet med lavest avstandKmFraKartet) eller spør brukeren.',
            }
          }
        }
        const q = buildRundturQuery(args ?? {})
        onNavigate?.()
        await navigerTil({ name: 'kart-vis', params: { id }, query: q })
        return {
          ok: true,
          merknad:
            `Åpner «${kart.navn ?? id}» og beregner rundturen på kartets stier — ruten tegnes ` +
            'inn hvis en sløyfe finnes. VIKTIG: ikke lov brukeren at det lykkes; si at appen ' +
            'prøver, og at punkter uten sti i nærheten gir en feilmelding i kartet i stedet.',
        }
      }
      case 'vis_tur_i_3d': {
        const id = String(args?.kartId ?? '')
        const maps = await listMaps()
        const kart = (maps ?? []).find((m) => m.id === id)
        if (!kart) return { feil: `Fant ikke kart med id «${id}». Bruk mine_kart_og_ruter.` }
        // Vaktpost: punkter utenfor kartet (typisk feil geokode-treff) skal
        // ikke starte en tur — chatten forblir åpen og modellen må forklare.
        for (const [navn, p] of [
          ['Startpunktet', { lat: Number(args?.fraLat), lon: Number(args?.fraLon) }],
          ['Målpunktet', { lat: Number(args?.tilLat), lon: Number(args?.tilLon) }],
        ]) {
          const km = kmUtenforBbox(kart.bbox, p)
          if (km > 0.2) {
            return {
              feil:
                `${navn} (${p.lat}, ${p.lon}) ligger ~${km.toFixed(1)} km utenfor kartet ` +
                `«${kart.navn ?? id}» — ingen tur ble startet. Sjekk sok_sted-treffet: flere ` +
                'steder kan hete det samme (velg treffet med lavest avstandKmFraKartet), eller ' +
                'tilby å bygge et nytt kart over riktig område med lag_kart.',
            }
          }
        }
        const q = buildTourQuery(args ?? {})
        onNavigate?.()
        await navigerTil({ name: 'kart-vis', params: { id }, query: q })
        return {
          ok: true,
          merknad: `Åpner «${kart.navn ?? id}» og beregner turen på kartets stier — 3D åpnes automatisk hvis en rute finnes. VIKTIG: ikke lov brukeren at 3D vises; si at appen prøver, og at punkter utenfor kartet eller uten sti i nærheten gir en feilmelding i kartet i stedet.`,
        }
      }
      default:
        return { feil: `Ukjent verktøy «${name}».` }
    }
  } catch (err) {
    return { feil: `Verktøyet feilet: ${err?.message ?? 'ukjent årsak'}` }
  }
}

/** Kort norsk statuslinje per verktøy — vises i chatten mens kallet kjører. */
export function toolStatusLabel(name, args) {
  switch (name) {
    case 'sok_sted': return `Søker etter «${args?.navn ?? '…'}» …`
    case 'mine_kart_og_ruter': return 'Ser i kartene og rutene dine …'
    case 'apne_kart': return 'Åpner kartet …'
    case 'foreslaa_nytt_kart': return 'Gjør klart nytt kart …'
    case 'lag_kart': return 'Starter kartbygging …'
    case 'vis_tur_i_3d': return 'Gjør klar turen i 3D …'
    case 'foreslaa_rundtur': return 'Beregner rundtur …'
    default: return `Kjører ${name} …`
  }
}

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
export async function runTool(name, args, { onNavigate } = {}) {
  try {
    switch (name) {
      case 'sok_sted': {
        const treff = await geocodePlace(String(args?.navn ?? '').trim())
        if (!treff?.length) return { feil: `Fant ingen steder for «${args?.navn}».` }
        return {
          treff: treff.slice(0, 3).map((t) => ({
            navn: t.name,
            lat: +Number(t.lat).toFixed(5),
            lon: +Number(t.lon).toFixed(5),
            beskrivelse: t.label ?? t.type ?? null,
          })),
        }
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
      case 'vis_tur_i_3d': {
        const id = String(args?.kartId ?? '')
        const maps = await listMaps()
        const kart = (maps ?? []).find((m) => m.id === id)
        if (!kart) return { feil: `Fant ikke kart med id «${id}». Bruk mine_kart_og_ruter.` }
        const q = buildTourQuery(args ?? {})
        onNavigate?.()
        await navigerTil({ name: 'kart-vis', params: { id }, query: q })
        return { ok: true, merknad: `Åpner «${kart.navn ?? id}» med turen i 3D.` }
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
    case 'vis_tur_i_3d': return 'Gjør klar turen i 3D …'
    default: return `Kjører ${name} …`
  }
}

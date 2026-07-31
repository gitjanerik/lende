// Lende — remote MCP-server (Cloudflare Worker, Spor 1 fase A).
//
// Eksponerer Lendes MCP-verktøy over MCP-standardens Streamable HTTP-transport
// (`POST /mcp`), så eksterne MCP-klienter — Claude Chat (custom connectors),
// Claude Code, Claude Desktop m.fl. — kan bruke dem over internett. Verktøy-
// logikken importeres fra samme `src/lib` som appen og stdio-MCP-serveren
// (`mcp/server.js`) bruker; wrangler bundler den inn.
//
// Fase A er TILSTANDSFRI (createMcpHandler fra Agents-SDK-en): kun verktøyene
// som ikke trenger et bygget kart. Fase B (bygg_kart + rute-verktøyene) kommer
// med kart-tilstand i R2, jf. docs/MCP_REMOTE_CHAT.md.
//
// Tilgang: samme per-bruker-GUID-er som lende-ai (secret LENDE_AI_TOKENS).
// Token kan sendes som `Authorization: Bearer <token>` ELLER `?token=<token>`
// i URL-en — sistnevnte fordi Claude Chats connector-oppsett tar en ren URL.

import { createMcpHandler } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchPlaces } from '../../../src/lib/geocode.js'
import { utm32BboxFromWgs84 } from '../../../src/lib/utm.js'
import {
  fetchStationsForBbox, fetchStationLatest, pickStationInfo, sildreStationUrl,
} from '../../../src/lib/nveHydApi.js'

const GEOCODE_UA = 'lende-mcp-remote/1.0 (turkart-generator)'
const MAX_HALF_KM = 20

const ALLOWED_ORIGINS = new Set([
  'https://gitjanerik.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}

function jsonResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }
}

// Speiler extentInfo i mcp/server.js — utstrekning fra Nominatim-bbox.
function extentInfo(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const [south, north, west, east] = bbox
  const ub = utm32BboxFromWgs84({ south, north, west, east })
  const breddeKm = (ub.maxE - ub.minE) / 1000
  const hoydeKm = (ub.maxN - ub.minN) / 1000
  if (!(breddeKm > 0) || !(hoydeKm > 0)) return null
  return {
    breddeKm: Number(breddeKm.toFixed(2)),
    hoydeKm: Number(hoydeKm.toFixed(2)),
    arealKm2: Number((breddeKm * hoydeKm).toFixed(2)),
    anbefaltHalfKm: Number(clamp(Math.max(breddeKm, hoydeKm) / 2, 0.5, MAX_HALF_KM).toFixed(2)),
  }
}

function bboxAround(lat, lon, radiusKm) {
  const dLat = radiusKm / 111
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos(lat * Math.PI / 180)))
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon }
}

// Verktøyene speiler stdio-serverens registreringer (mcp/server.js) — hold
// beskrivelser/utdata i synk til logikken en dag deles i en felles modul.
function buildServer() {
  const server = new McpServer({ name: 'lende', version: '1.0.0' })

  server.registerTool(
    'sok_sted',
    {
      title: 'Søk sted (geokoding)',
      description:
        'Geokoder et fritekst-stedsnavn til koordinater ved å flette Kartverket SSR ' +
        '(autoritativt norsk stedsnavnregister) og OpenStreetMap Nominatim (begrenset til Norge). ' +
        'Returnerer inntil `antall` treff med lat/lon OG stedets utstrekning: bredde/høyde/areal ' +
        'i km² (fra Nominatims bounding box; SSR-treff er punkt og gir null her) og en anbefalt ' +
        '«halfKm» som dekker hele stedet.',
      inputSchema: {
        sok: z.string().min(2).describe('Stedsnavn å søke etter (f.eks. «Wentzelhytta»)'),
        antall: z.number().int().min(1).max(20).default(5).describe('Maks antall treff'),
      },
    },
    async ({ sok, antall }) => {
      const treff = await searchPlaces(sok, { limit: antall, userAgent: GEOCODE_UA })
      if (!treff.length) throw new Error(`Ingen treff for «${sok}».`)
      return jsonResult({
        status: 'ok',
        treff: treff.map(t => {
          const ext = extentInfo(t.bbox)
          return {
            navn: t.name,
            kortnavn: t.shortName,
            type: t.type,
            lat: Number(t.lat.toFixed(6)),
            lon: Number(t.lon.toFixed(6)),
            breddeKm: ext?.breddeKm ?? null,
            hoydeKm: ext?.hoydeKm ?? null,
            arealKm2: ext?.arealKm2 ?? null,
            anbefaltHalfKm: ext?.anbefaltHalfKm ?? null,
          }
        }),
      })
    },
  )

  server.registerTool(
    'vannmalestasjoner',
    {
      title: 'NVE vannmålestasjoner (sanntid)',
      description:
        'Henter hydrologiske målestasjoner (NVE HydAPI) i et område med SISTE vannføring ' +
        '(m³/s), vannstand (m) og vanntemperatur (°C), pluss nedbørfelt-areal, moh, kommune og ' +
        'eier + lenke til NVEs Sildre-side. Område: senter {lat,lon} + radiusKm, ELLER ' +
        'eksplisitt bbox (denne remote-serveren har ikke «sist bygde kart»-tilstand ennå).',
      inputSchema: {
        senter: z.object({ lat: z.number(), lon: z.number() }).optional()
          .describe('Senterpunkt for søket (brukes med radiusKm)'),
        radiusKm: z.number().min(0.5).max(50).default(10)
          .describe('Søkeradius i km rundt senter (default 10)'),
        bbox: z.object({
          south: z.number(), west: z.number(), north: z.number(), east: z.number(),
        }).optional().describe('Eksplisitt WGS84-bbox — overstyrer senter'),
        maks: z.number().int().min(1).max(200).default(60).describe('Maks antall stasjoner'),
      },
    },
    async ({ senter, radiusKm, bbox, maks }) => {
      const omrade = bbox ?? (senter ? bboxAround(senter.lat, senter.lon, radiusKm) : null)
      if (!omrade) throw new Error('Oppgi senter {lat,lon} (+ radiusKm) eller bbox.')
      const stations = await fetchStationsForBbox(omrade)
      const stasjoner = await Promise.all(
        stations.slice(0, maks).map(async st => {
          const latest = await fetchStationLatest(st).catch(() => ({}))
          const info = pickStationInfo(st)
          const o = {
            navn: st.stationName ?? 'NVE-stasjon',
            stasjonsId: st.stationId,
            lat: Number(Number(st.latitude).toFixed(6)),
            lon: Number(Number(st.longitude).toFixed(6)),
            sildreUrl: sildreStationUrl(st.stationId),
          }
          if (latest?.discharge) o.vannforing = { verdi: latest.discharge.value, tid: latest.discharge.time }
          if (latest?.waterLevel) o.vannstand = { verdi: latest.waterLevel.value, tid: latest.waterLevel.time }
          if (latest?.waterTemp) o.vanntemp = { verdi: latest.waterTemp.value, tid: latest.waterTemp.time }
          if (info.basinArea != null) o.nedborfeltKm2 = info.basinArea
          if (info.masl != null) o.moh = info.masl
          if (info.council) o.kommune = info.council
          if (info.stationType) o.stasjonstype = info.stationType
          if (info.owner) o.eier = info.owner
          return o
        }),
      )
      return jsonResult({ status: 'ok', omrade, antall: stasjoner.length, stasjoner })
    },
  )

  return server
}

function validToken(request, env) {
  if (!env.LENDE_AI_TOKENS) return false
  const url = new URL(request.url)
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ')
    ? auth.slice('Bearer '.length).trim()
    : url.searchParams.get('token')?.trim()
  if (!token) return false
  const tokens = env.LENDE_AI_TOKENS.split(',').map(t => t.trim()).filter(Boolean)
  return tokens.includes(token)
}

// v0.2-API-et tar server-INSTANSEN, og en instans kan bare kobles til ÉN
// transport — handleren lager en ny WorkerTransport per forespørsel, så både
// server og handler må bygges per kall (verifisert lokalt: gjenbruk gir
// «Already connected to a transport» på kall nr. 2).
function mcpHandler(request, env, ctx) {
  return createMcpHandler(buildServer(), { route: '/mcp' })(request, env, ctx)
}

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://gitjanerik.github.io'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({ ok: true, mcp: 'streamable-http', verktoy: ['sok_sted', 'vannmalestasjoner'] }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (url.pathname === '/mcp') {
      const cors = corsHeaders(request.headers.get('Origin'))
      // Preflight slipper gjennom uten token (nettleser-klienter sender den
      // før Authorization-headeren kan legges på).
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors })
      }
      if (!validToken(request, env)) {
        return new Response(JSON.stringify({ error: 'Ugyldig eller manglende token.' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      const res = await mcpHandler(request, env, ctx)
      const utvidet = new Response(res.body, res)
      for (const [k, v] of Object.entries(cors)) utvidet.headers.set(k, v)
      return utvidet
    }

    return new Response('Not Found', { status: 404 })
  },
}

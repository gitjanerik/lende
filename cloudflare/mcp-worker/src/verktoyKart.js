// Fase B-verktøyene for remote MCP-serveren: bygg_kart + alt som opererer på
// et bygget kart. Portert fra stdio-serveren (mcp/server.js) med to
// forskjeller: (1) tilstand bor i R2 via kartRef (ikke `state.map` i minnet),
// (2) filer skrives til R2 og returneres som URL-er (ikke node:fs-stier).
// Verktøy-logikken (buildMapHeadless, routing, gpx, …) er identisk — samme
// src/lib som appen.

import { z } from 'zod'
import { buildMapHeadless, routableFeaturesFromSvg, extractMapPoiFromSvg, searchMapSvg } from '../../../mcp/headless.js'
import { buildRoutingGraph, planRoutes, planRoutesThrough, planLoop } from '../../../src/lib/routing.js'
import { analyserStinett, formatStinettSvar } from '../../../src/lib/stinettAnalyse.js'
import { wgs84ToSvg, svgToWgs84 } from '../../../src/lib/utm.js'
import { sampleProfile } from '../../../src/lib/elevationProfile.js'
import { sampleElevation } from '../../../src/lib/demSampling.js'
import { buildRouteGpx } from '../../../src/lib/gpxExport.js'
import { searchPlaces } from '../../../src/lib/geocode.js'
import { minEquidistanceForWidthKm, DEFAULT_EQUIDISTANCE_M } from '../../../src/lib/equidistanceRules.js'
import { buildRouteOverlaySvg, injectOverlay } from '../../../src/lib/routeOverlay.js'
import { filterPoi, POI_LABELS } from '../../../src/lib/mapPoi.js'
import { formatAreaShort } from '../../../src/composables/useMapSearch.js'
import { buildTour3dUrl } from '../../../src/lib/tour3dLink.js'
import { applyMapSettings } from '../../../src/lib/mapSettingsApply.js'
import { nyKartRef, lagreKart, lastKart, lagreRuter, lastRuter, lagreUtdata, lastInnstillinger } from './kartlager.js'

const GEOCODE_UA = 'lende-mcp-remote/1.0 (turkart-generator)'
// Remote-taket er lavere enn stdio-serverens 20: CPU-grensen på Workers Paid
// er 30 s, og halfKm=10 (20×20 km, 25 m DEM) er romslig for turområder.
const MAX_HALF_KM_REMOTE = 10
const MAX_SNAP_M = 150

export function jsonResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }
}

export function svgMeta(meta) {
  return { minE: meta.utmBbox.minE, minN: meta.utmBbox.minN, widthM: meta.widthM, heightM: meta.heightM }
}

function insideMap(meta, p) {
  return p.x >= 0 && p.y >= 0 && p.x <= meta.widthM && p.y <= meta.heightM
}

export function climbFor(dem, coordinates) {
  const profile = sampleProfile({ points: coordinates.map(([x, y]) => ({ x, y })) }, dem)
  return profile
    ? { ascent: Math.round(profile.totalAscent), descent: Math.round(profile.totalDescent) }
    : null
}

function downsample(coords, n = 80) {
  if (coords.length <= n) return coords
  const out = []
  for (let i = 0; i < n; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (n - 1))])
  return out
}

function tour3dUrlFor(kart, tour) {
  const { bbox, meta } = kart
  return buildTour3dUrl({
    map: {
      lat: (bbox.south + bbox.north) / 2,
      lon: (bbox.west + bbox.east) / 2,
      kmBredde: Math.round((meta.widthM / 1000) * 10) / 10,
      equidistanceM: meta.equidistance,
      aspekt: meta.heightM / meta.widthM,
    },
    tour,
  })
}

export function byggGraf(svg) {
  const features = routableFeaturesFromSvg(svg)
  if (!features.length) throw new Error('Kartet inneholder ingen stier eller veier å rute på.')
  return buildRoutingGraph(features, { snapM: 6, gapBridgeM: 30, componentBridgeM: 80 })
}

export function snapPunkter(rg, meta, punkter) {
  return punkter.map((ll, i) => {
    const p = wgs84ToSvg(ll.lat, ll.lon, meta)
    if (!insideMap({ widthM: meta.widthM, heightM: meta.heightM }, p)) {
      throw new Error(`Punkt ${i + 1} ligger utenfor kartet — bygg et større kart eller flytt punktet.`)
    }
    const node = rg.nearestNode([p.x, p.y])
    if (!node || node.distM > MAX_SNAP_M) throw new Error(`Ingen sti/vei nær punkt ${i + 1} (>150 m).`)
    return { p, node }
  })
}

export async function kreveKart(env, kartRef) {
  const kart = await lastKart(env, String(kartRef ?? ''))
  if (!kart) throw new Error(`Fant ikke kart «${kartRef}» — kall bygg_kart først og bruk kartRef fra svaret.`)
  return kart
}

// Kart-SVG med kartRef-ens lagrede juster_kart-innstillinger påført (urørt
// hvis ingen finnes) — brukes av alle verktøy som skriver SVG-utdata.
export async function svgForOutput(env, kartRef, svg) {
  const innstillinger = await lastInnstillinger(env, kartRef)
  return innstillinger ? applyMapSettings(svg, innstillinger) : svg
}

function ruteSvar(found, meta, dem) {
  return found.map((r, i) => {
    const climb = climbFor(dem, r.coordinates)
    const min = r.lengthM / (4000 / 60) + (climb?.ascent ?? 0) / 10 + (climb?.descent ?? 0) / 30
    return {
      indeks: i,
      type: r.shortest ? 'kortest' : 'sti-foretrukket',
      lengdeM: Math.round(r.lengthM),
      stigningM: climb?.ascent ?? null,
      fallM: climb?.descent ?? null,
      estimertGangtidMin: Math.round(min),
      punkterWgs84: downsample(r.coordinates).map(([x, y]) => {
        const ll = svgToWgs84(x, y, meta)
        return [Number(ll.lon.toFixed(6)), Number(ll.lat.toFixed(6))]
      }),
    }
  })
}

/**
 * Registrer fase B-verktøyene. `ctx` = { env, filUrl(r2Sti) } — filUrl bygger
 * en hentbar URL (inkl. kallerens token) for R2-objekter.
 */
export function registerKartVerktoy(server, ctx) {
  const { env, filUrl } = ctx

  server.registerTool(
    'bygg_kart',
    {
      title: 'Bygg turkart',
      description:
        'Bygger et ISOM-inspirert turkart (SVG) for et område, med ekte Kartverket-terreng ' +
        '(DTM/DOM), OSM-stier/veier og N50-vann. Kartet lagres og får en kartRef som brukes i ' +
        'planlegg_rute/planlegg_rundtur/hoydeprofil/sok_kart/finn_poi_paa_kart/eksporter_gpx. ' +
        'halfKm 1–3 gir rask respons; opptil 10 dekker store turområder (grovere terreng, opptil ' +
        '~1 min byggetid). Oppgi enten lat+lon ELLER et stedsnavn i «sted» (geokodes). Tips: kall ' +
        'sok_sted først for anbefalt halfKm. Ekvidistanse: 20 m er turkart-standard og default.',
      inputSchema: {
        sted: z.string().optional().describe('Stedsnavn å geokode (f.eks. «Vardåsen, Asker») — alternativ til lat/lon'),
        lat: z.number().min(57).max(72).optional().describe('Senter-breddegrad (Norge)'),
        lon: z.number().min(4).max(32).optional().describe('Senter-lengdegrad (Norge)'),
        halfKm: z.number().min(0.5).max(MAX_HALF_KM_REMOTE).optional()
          .describe(`Halv kartbredde i km (0.5–${MAX_HALF_KM_REMOTE}). Utelates: auto fra stedets utstrekning, ellers 2 km`),
        equidistanceM: z.number().optional()
          .describe('Ekvidistanse i meter. Utelatt = 20. Bredde-regler håndheves (bredde > 2 km → min 5 m, ≥ 4 km → min 10 m, ≥ 6 km → min 20 m).'),
        navn: z.string().default('mcp-kart').describe('Kartnavn'),
      },
    },
    async ({ sted, lat, lon, halfKm, equidistanceM, navn }) => {
      let geokodet = null
      if (lat == null || lon == null) {
        if (!sted) throw new Error('Oppgi enten lat+lon eller et stedsnavn i «sted».')
        const treff = await searchPlaces(sted, { limit: 1, userAgent: GEOCODE_UA })
        if (!treff.length) throw new Error(`Fant ikke stedet «${sted}» via geokoding.`)
        geokodet = treff[0]
        lat = geokodet.lat
        lon = geokodet.lon
        if (navn === 'mcp-kart') navn = geokodet.shortName || sted
      }
      const effHalfKm = Math.min(halfKm ?? 2, MAX_HALF_KM_REMOTE)
      const widthKm = effHalfKm * 2
      const effEq = Math.max(equidistanceM ?? DEFAULT_EQUIDISTANCE_M, minEquidistanceForWidthKm(widthKm))
      const built = await buildMapHeadless({ lat, lon, halfKm: effHalfKm, equidistanceM: effEq })

      const ref = nyKartRef(navn)
      await lagreKart(env, ref, { ...built, navn })

      const { meta, counts } = built
      return jsonResult({
        status: 'ok',
        kartRef: ref,
        kartUrl: filUrl(`kart/${ref}/kart.svg`),
        halfKm: Number(effHalfKm.toFixed(2)),
        geokodet: geokodet ? { navn: geokodet.name, lat, lon } : null,
        svgKb: Math.round(built.svg.length / 1024),
        kartStorrelseM: { bredde: Math.round(meta.widthM), hoyde: Math.round(meta.heightM) },
        terreng: {
          kilde: meta.demSource,
          ekvidistanseM: meta.equidistance,
          hoydeM: meta.elevationRange
            ? { min: Math.round(meta.elevationRange.min), maks: Math.round(meta.elevationRange.max) }
            : null,
          kyst: meta.coastal,
        },
        featureAntall: counts,
      })
    },
  )

  server.registerTool(
    'planlegg_rute',
    {
      title: 'Planlegg fotrute',
      description:
        'Planlegger 1–3 fotruter mellom to punkter (valgfritt innom via-punkter) på et bygget ' +
        'kart (kartRef fra bygg_kart), langs stier og veier (ISOM-vektet Dijkstra). Returnerer ' +
        'distanse, stigning/fall, gangtid (Naismith), rutepunkter i WGS84 og tur3dUrl — en lenke ' +
        'som åpner turen i Lende-appens 3D-visning. Rutene lagres for eksporter_gpx.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        start: z.object({ lat: z.number(), lon: z.number() }).describe('Startpunkt'),
        maal: z.object({ lat: z.number(), lon: z.number() }).describe('Målpunkt'),
        via: z.array(z.object({ lat: z.number(), lon: z.number(), navn: z.string().optional() }))
          .optional().describe('Via-punkter i rekkefølge'),
        maalNavn: z.string().optional().describe('Navn på målet — turen får navnet «Tur til <navn>»'),
      },
    },
    async ({ kartRef, start, maal, via, maalNavn }) => {
      const kart = await kreveKart(env, kartRef)
      const meta = svgMeta(kart.meta)
      const rg = byggGraf(kart.svg)
      const viaPts = via ?? []
      const snaps = snapPunkter(rg, { ...meta, widthM: kart.meta.widthM, heightM: kart.meta.heightM },
        [start, ...viaPts, maal])
      const found = viaPts.length
        ? planRoutesThrough(rg, snaps.map(s => s.node.id))
        : planRoutes(rg, snaps[0].node.id, snaps[snaps.length - 1].node.id)
      if (!found.length) throw new Error('Fant ingen rute (frakoblet sti-nett eller punkt uten stiforbindelse?).')

      await lagreRuter(env, kartRef, found.map(r => ({ coordinates: r.coordinates, lengthM: r.lengthM, shortest: !!r.shortest })))

      const turNavn = maalNavn?.trim() ? `Tur til ${maalNavn.trim()}`
        : viaPts.find(v => v.navn?.trim())?.navn?.trim()
          ? `Tur om ${viaPts.find(v => v.navn?.trim()).navn.trim()}` : null
      return jsonResult({
        status: 'ok',
        kartRef,
        tur3dUrl: tour3dUrlFor(kart, { origin: start, dest: maal, via: viaPts, routeIdx: 0, name: turNavn }),
        snappingM: { start: Math.round(snaps[0].node.distM), maal: Math.round(snaps[snaps.length - 1].node.distM) },
        ruter: ruteSvar(found, meta, kart.dem),
      })
    },
  )

  server.registerTool(
    'planlegg_rundtur',
    {
      title: 'Planlegg rundtur (sløyfe)',
      description:
        'Planlegger en RUNDTUR fra et startpunkt innom ett eller flere vendepunkt og tilbake, på ' +
        'et bygget kart (kartRef). Hjemveien straffes mot utturen så det blir en ekte runde. ' +
        'Returnerer 1–3 sløyfer (lengde, stigning, gangtid, WGS84-punkter), tur3dUrl, og kan ' +
        'valgfritt tegne sløyfen inn i kartet (kartMedRuteUrl). Lagres for eksporter_gpx.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        origo: z.object({ lat: z.number(), lon: z.number() }).describe('Startpunkt = mål'),
        via: z.array(z.object({ lat: z.number(), lon: z.number(), navn: z.string().optional() }))
          .min(1).describe('Vendepunkt (minst ett), i rekkefølge'),
        tegnSvg: z.boolean().default(false).describe('Tegn sløyfen inn i kart-SVG (returnerer URL)'),
        ruteIndeks: z.number().int().min(0).default(0).describe('Hvilken sløyfe som markeres (ved tegnSvg)'),
        origoNavn: z.string().optional().describe('Etikett ved startpunktet'),
      },
    },
    async ({ kartRef, origo, via, tegnSvg, ruteIndeks, origoNavn }) => {
      const kart = await kreveKart(env, kartRef)
      const meta = svgMeta(kart.meta)
      const rg = byggGraf(kart.svg)
      const snaps = snapPunkter(rg, { ...meta, widthM: kart.meta.widthM, heightM: kart.meta.heightM },
        [origo, ...via])
      const loops = planLoop(rg, snaps[0].node.id, snaps.slice(1).map(s => s.node.id))
      if (!loops.length) throw new Error('Fant ingen rundtur (vendepunkt uten stiforbindelse eller blindvei?).')

      await lagreRuter(env, kartRef, loops.map(r => ({ coordinates: r.coordinates, lengthM: r.lengthM, shortest: !!r.shortest })))

      const viaNavn = via.find(v => v.navn?.trim())?.navn?.trim()
      const turNavn = viaNavn ? `Rundtur ${viaNavn}`
        : origoNavn?.trim() ? `Rundtur fra ${origoNavn.trim()}` : null
      const svar = {
        status: 'ok',
        kartRef,
        tur3dUrl: tour3dUrlFor(kart, { origin: origo, via, routeIdx: ruteIndeks ?? 0, name: turNavn }),
        snappingM: { origo: Math.round(snaps[0].node.distM) },
        ruter: ruteSvar(loops, meta, kart.dem),
      }

      if (tegnSvg) {
        const sel = Math.min(ruteIndeks ?? 0, loops.length - 1)
        const o = snaps[0].p
        const markers = []
        if (origoNavn) markers.push({ x: o.x, y: o.y, color: '#16a34a', label: origoNavn, anchor: 'start' })
        via.forEach((v, i) => {
          const s = snaps[i + 1]
          markers.push({ x: s.p.x, y: s.p.y, color: '#f59e0b', label: v.navn, anchor: 'start' })
        })
        const overlay = buildRouteOverlaySvg({
          routes: loops.map(r => ({ coordinates: r.coordinates, shortest: r.shortest })),
          selectedIndex: sel,
          connectors: [{ from: [o.x, o.y], to: snaps[0].node.pos }],
          markers,
          start: [o.x, o.y], dest: [o.x, o.y],
        })
        const medRute = injectOverlay(await svgForOutput(env, kartRef, kart.svg), overlay)
        const sti = await lagreUtdata(env, kartRef, 'rundtur.svg', medRute, 'image/svg+xml; charset=utf-8')
        svar.kartMedRuteUrl = filUrl(sti)
      }

      return jsonResult(svar)
    },
  )

  server.registerTool(
    'analyser_stinett',
    {
      title: 'Analyser stinettet',
      description:
        'Analyserer stinettet i et bygget kart (kartRef): total km sti (sti + skogsbilvei, ' +
        'hvert segment telt én gang), lengste sammenhengende turstrekning, og tur-kandidater ' +
        '(A→B eller rundtur, minst minTurKm) med lengde, gangtid, stigning/fall og bratteste/' +
        'slakeste parti. Korte småveg-strekk regnes som bindeledd mellom stier men teller ikke ' +
        'i sti-summen; korte isolerte stumper ekskluderes (dynamisk minstelengde etter ' +
        'sti-tetthet). Hver tur returnerer koordinater som kan sendes videre: start/slutt/via → ' +
        'planlegg_rute, origo/via → planlegg_rundtur. treff kan være 0 når nettet bare har ' +
        'korte fragmenter.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        minTurKm: z.number().min(0.5).max(20).default(0.5)
          .describe('Minste turlengde i km for tur-kandidater (standard 0,5)'),
        maksKoblerM: z.number().min(0).max(1000).default(300)
          .describe('Lengste småveg-strekk (meter) som godtas som bindeledd mellom stinett'),
      },
    },
    async ({ kartRef, minTurKm, maksKoblerM }) => {
      const kart = await kreveKart(env, kartRef)
      const meta = svgMeta(kart.meta)
      // Analysen bygger egen graf med componentBridgeM: 0 — byggGraf-ens
      // 80 m-komponentbroer ville forfalsket konnektiviteten som skal måles.
      const features = routableFeaturesFromSvg(kart.svg)
      const dem = kart.dem?.source?.startsWith?.('synthetic') ? null : kart.dem
      const analyse = analyserStinett(features, {
        dem,
        arealKm2: (kart.meta.widthM * kart.meta.heightM) / 1e6,
        minTurM: minTurKm * 1000,
        maksKoblerM,
      })
      return jsonResult({
        status: 'ok',
        kartRef,
        kart: kart.navn,
        kartKm: { bredde: +(kart.meta.widthM / 1000).toFixed(1), hoyde: +(kart.meta.heightM / 1000).toFixed(1) },
        ...formatStinettSvar(analyse, { toWgs84: (x, y) => svgToWgs84(x, y, meta) }),
      })
    },
  )

  server.registerTool(
    'hoydeprofil',
    {
      title: 'Høydeprofil',
      description:
        'Sampler terrenghøyde langs en linje av WGS84-punkter mot et bygget karts DEM (kartRef). ' +
        'Returnerer total stigning/fall, min/maks høyde og samplede høyder.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        punkter: z.array(z.object({ lat: z.number(), lon: z.number() })).min(2)
          .describe('Linje å profilere (minst 2 punkter)'),
      },
    },
    async ({ kartRef, punkter }) => {
      const kart = await kreveKart(env, kartRef)
      const meta = svgMeta(kart.meta)
      const points = punkter.map(p => {
        const s = wgs84ToSvg(p.lat, p.lon, meta)
        return { x: s.x, y: s.y }
      })
      if (!points.every(p => insideMap(kart.meta, p))) throw new Error('Minst ett punkt ligger utenfor kartet.')
      const profile = sampleProfile({ points }, kart.dem)
      if (!profile) throw new Error('Klarte ikke å sample profil (mangler DEM?).')
      return jsonResult({
        status: 'ok',
        distanseM: Math.round(profile.totalDistM),
        stigningM: Math.round(profile.totalAscent),
        fallM: Math.round(profile.totalDescent),
        minHoydeM: Math.round(profile.minElev),
        maksHoydeM: Math.round(profile.maxElev),
        samples: profile.samples
          .filter((_, i) => i % 4 === 0)
          .map(s => ({ distM: Math.round(s.distM), hoydeM: s.elev == null ? null : Math.round(s.elev) })),
      })
    },
  )

  server.registerTool(
    'eksporter_gpx',
    {
      title: 'Eksporter GPX',
      description:
        'Eksporterer en rute fra siste planlegg_rute/planlegg_rundtur på kartet (kartRef) som ' +
        'GPX 1.1 (<rte> med <ele>), klar for Garmin/Strava/OsmAnd. Returnerer nedlastings-URL.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        ruteIndeks: z.number().int().min(0).default(0).describe('Indeks fra planlegg_rute-svaret'),
        navn: z.string().default('Lende-rute').describe('Rutenavn i GPX-en'),
      },
    },
    async ({ kartRef, ruteIndeks, navn }) => {
      const kart = await kreveKart(env, kartRef)
      const ruter = await lastRuter(env, kartRef)
      const route = ruter?.[ruteIndeks]
      if (!route) throw new Error(`Ingen rute med indeks ${ruteIndeks} — kall planlegg_rute/planlegg_rundtur først.`)
      const meta = svgMeta(kart.meta)
      const points = route.coordinates.map(([x, y]) => {
        const ll = svgToWgs84(x, y, meta)
        const ele = sampleElevation(kart.dem, x, y)
        return [ll.lon, ll.lat, Number.isFinite(ele) ? ele : undefined]
      })
      const gpx = buildRouteGpx({ points, navn, opprettet: Date.now() })
      const slug = navn.replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase()
      const sti = await lagreUtdata(env, kartRef, `${slug}.gpx`, gpx, 'application/gpx+xml; charset=utf-8')
      return jsonResult({
        status: 'ok',
        gpxUrl: filUrl(sti),
        punkter: points.length,
        lengdeM: Math.round(route.lengthM),
      })
    },
  )

  server.registerTool(
    'finn_poi_paa_kart',
    {
      title: 'Finn interessepunkter på kartet',
      description:
        'Leser navngitte interessepunkter fra et bygget kart (kartRef) — topper, hytter, vann, ' +
        'steder, områder og naturreservat — med WGS84-koordinater. Filtrer på type og/eller søk.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        typer: z.array(z.enum(Object.values(POI_LABELS))).optional()
          .describe('Begrens til typer, f.eks. ["topp","hytte","vann"]'),
        sok: z.string().optional().describe('Fritekst-filter på navnet'),
        maks: z.number().int().min(1).max(200).default(60).describe('Maks antall treff'),
      },
    },
    async ({ kartRef, typer, sok, maks }) => {
      const kart = await kreveKart(env, kartRef)
      const meta = svgMeta(kart.meta)
      const all = extractMapPoiFromSvg(kart.svg)
      const filtered = filterPoi(all, { typer, sok })
        .map(p => {
          const ll = svgToWgs84(p.x, p.y, meta)
          return { navn: p.navn, type: p.type, lat: Number(ll.lat.toFixed(6)), lon: Number(ll.lon.toFixed(6)) }
        })
        .slice(0, maks)
      const perType = {}
      for (const p of all) perType[p.type] = (perType[p.type] ?? 0) + 1
      return jsonResult({ status: 'ok', antall: filtered.length, perType, poi: filtered })
    },
  )

  server.registerTool(
    'sok_kart',
    {
      title: 'Søk på kartet (vann / topp / navn)',
      description:
        'Søker i et bygget kart (kartRef) med samme logikk som appens søkefelt. Fritekst matcher ' +
        'stedsnavn/vann/topper/områder; nøkkelord «vann», «topp», «parkering» gir rangerte ' +
        'oversikter. Returnerer navn, type, WGS84-koordinat og evt. moh/areal.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        sok: z.string().min(1).describe('Fritekst ELLER nøkkelord: «vann», «topp», «parkering»'),
        maks: z.number().int().min(1).max(200).default(30).describe('Maks antall treff'),
      },
    },
    async ({ kartRef, sok, maks }) => {
      const kart = await kreveKart(env, kartRef)
      const meta = svgMeta(kart.meta)
      const treff = searchMapSvg(kart.svg, sok, maks).map(r => {
        const ll = svgToWgs84(r.x, r.y, meta)
        const o = {
          navn: r.name,
          type: r.label ?? r.kind,
          lat: Number(ll.lat.toFixed(6)),
          lon: Number(ll.lon.toFixed(6)),
        }
        if (Number.isFinite(r.ele)) o.moh = Math.round(r.ele)
        if (Number.isFinite(r.areaM2) && r.areaM2 > 0) {
          o.arealM2 = Math.round(r.areaM2)
          o.areal = formatAreaShort(r.areaM2)
        }
        return o
      })
      return jsonResult({ status: 'ok', sok, antall: treff.length, treff })
    },
  )
}

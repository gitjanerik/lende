// Fase C-verktøyene for remote MCP-serveren: berik_rute, turrapport_svg og
// juster_kart. Portert fra stdio-serveren (mcp/server.js) med samme
// remote-tilpasninger som fase B: kart lastes via kartRef fra R2, utdata
// skrives til R2 og returneres som token-bærende URL-er, og visnings-
// innstillingene (juster_kart) bor i R2 per kartRef i stedet for i minnet.
// Rødlista bundles inn fra public/data (stdio leser den fra disk).

import { z } from 'zod'
import { planRoutesThrough } from '../../../src/lib/routing.js'
import { wgs84ToSvg, svgToWgs84 } from '../../../src/lib/utm.js'
import { sampleProfile } from '../../../src/lib/elevationProfile.js'
import { buildRouteOverlaySvg, injectOverlay, DEFAULT_OVERLAY_STYLE } from '../../../src/lib/routeOverlay.js'
import { resolveVisibleLayers, buildSettingsCss, listThemes } from '../../../src/lib/mapSettingsApply.js'
import { LAYERS } from '../../../src/lib/mapLayerCatalog.js'
import { KARTSTILER } from '../../../src/lib/kartStiler.js'
import { STROKE_GROUPS } from '../../../src/lib/strokeOverrides.js'
import { enrichRoute } from '../../../src/lib/routeEnrichment.js'
import { routeCues, extractNamedPointsFromSvg } from '../../../src/lib/routeCues.js'
import { buildTripReportSvg, buildTripReportMarkdown } from '../../../src/lib/tripReport.js'
import { collectRedListed } from '../../../src/lib/redListNo.js'
import { fetchFredaKulturminner } from '../../../src/lib/kulturminneWfs.js'
import { fetchProtectedArea } from '../../../src/lib/verneFetcher.js'
import { fetchSpeciesSummary } from '../../../src/lib/gbifSpecies.js'
import {
  fetchStationsForBbox, fetchStationLatest, pickStationInfo, sildreStationUrl,
} from '../../../src/lib/nveHydApi.js'
import { extractMapPoiFromSvg } from '../../../mcp/headless.js'
import redListLookup from '../../../public/data/redlist-no.json' with { type: 'json' }
import {
  jsonResult, svgMeta, climbFor, byggGraf, snapPunkter, kreveKart, svgForOutput,
} from './verktoyKart.js'
import { lagreUtdata, lagreInnstillinger, lastInnstillinger } from './kartlager.js'

// Gangtid etter Naismith — samme konstanter som useStifinner.estWalkMinutes.
function estWalkMinutes(lengthM, ascent = 0, descent = 0) {
  const min = lengthM / (4000 / 60) + ascent / 10 + descent / 30
  return Math.max(1, Math.round(min))
}

// Rute-overlayets strekbredder skalert med én faktor (rutebreddeFaktor).
// Markører og etiketter beholder størrelsen.
function overlayStyleFor(faktor) {
  if (!Number.isFinite(faktor) || faktor === 1) return undefined
  const s = DEFAULT_OVERLAY_STYLE
  return {
    lineSelected: s.lineSelected * faktor,
    lineOther: s.lineOther * faktor,
    haloSelected: s.haloSelected * faktor,
    haloOther: s.haloOther * faktor,
    connector: s.connector * faktor,
  }
}

// De ekte fetcherne pakket for enrichRoute (injiseres så lib-en er testbar).
// Alle er fetch-baserte og CORS er irrelevant server-side; hver kilde faller
// pent tilbake til tomt hvis den er utilgjengelig.
const ENRICH_FETCHERS = {
  fetchFredaKulturminner: (bbox, o) => fetchFredaKulturminner(bbox, o),
  fetchProtectedArea: (lat, lon, o) => fetchProtectedArea(lat, lon, o),
  fetchSpeciesSummary: (geom, o) => fetchSpeciesSummary(geom, o),
  fetchHydroStations: (bbox, o) => fetchStationsForBbox(bbox, o),
  fetchStationLatest: (station, o) => fetchStationLatest(station, o),
}

// Normaliser en HydAPI-stasjon (+ siste måleverdier + korridor-posisjon) til
// MCP-retur. Tar bare med felt som faktisk finnes (aldri oppdiktet verdi).
function mapHydroStation(st, { distM, alongM, latest }) {
  const info = pickStationInfo(st)
  const o = {
    navn: st.stationName ?? 'NVE-stasjon',
    stasjonsId: st.stationId,
    lat: Number(Number(st.latitude).toFixed(6)),
    lon: Number(Number(st.longitude).toFixed(6)),
    avstandM: Math.round(distM),
    langsM: Math.round(alongM),
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
}

// Rute gjennom [start, ...via, maal] på et lastet kart. Som stdio-serverens
// planThrough, men grafen bygges per kall (tilstandsløst).
function planGjennom(kart, punkter) {
  const rg = byggGraf(kart.svg, kart.dem)
  const meta = svgMeta(kart.meta)
  const snaps = snapPunkter(rg, meta, punkter)
  const found = planRoutesThrough(rg, snaps.map(s => s.node.id))
  if (!found.length) throw new Error('Fant ingen gjennomgående rute (frakoblet sti-nett eller via-punkt uten stiforbindelse?).')
  return { rg, meta, snaps, found }
}

// Planlegg, velg én rute og berik den langs traséen (kulturminner/vern/
// arter/vannstasjoner). Delt av berik_rute og turrapport_svg.
async function planOgBerik(kart, punkter, { bufferM = 150, ruteIndeks = 0 } = {}) {
  const { rg, meta, snaps, found } = planGjennom(kart, punkter)
  const sel = Math.min(ruteIndeks, found.length - 1)
  const route = found[sel].coordinates
  const enrichment = await enrichRoute(route, {
    toWgs84: (x, y) => svgToWgs84(x, y, meta),
    toSvg: (lat, lon) => wgs84ToSvg(lat, lon, meta),
    bufferM,
    fetchers: ENRICH_FETCHERS,
    collectRedListed,
    redListLookup,
    mapHydroStation,
  })
  return { rg, meta, snaps, found, sel, route, enrichment }
}

// Gyldige nøkler listes i beskrivelsen så klienten slipper prøving/feiling —
// hentet fra SAMME katalog som appens drawer (mapLayerCatalog/strokeOverrides).
const LAG_DOC = LAYERS.map(l => `${l.key} (${l.label})`).join(', ')
const KARTSTIL_KEYS = KARTSTILER.map(s => s.key)
const KARTSTIL_DOC = KARTSTILER.map(s => `«${s.key}» (${s.label}): ${s.beskrivelse}`).join(' ')
const STREK_DOC = STROKE_GROUPS.map(g => `${g.id} (${g.label})`).join(', ')
const THEMES = listThemes()
const TEMA_KEYS = THEMES.map(t => t.key)
const TEMA_DOC = THEMES
  .map(t => `«${t.key}» (${t.label}, ${t.group}): ${t.beskrivelse}${t.autoHideLayers ? ' Skjuler automatisk alle lag unntatt høydekurver.' : ''}`)
  .join(' ')

/**
 * Registrer fase C-verktøyene. `ctx` = { env, filUrl(r2Sti) } — som fase B.
 */
export function registerRapportVerktoy(server, ctx) {
  const { env, filUrl } = ctx

  server.registerTool(
    'berik_rute',
    {
      title: 'Berik rute (kulturminner / vern / arter)',
      description:
        'Planlegger en rute (evt. innom via-punkter) på et bygget kart (kartRef) og finner hva ' +
        'som ligger LANGS den: fredede kulturminner (Riksantikvaren), verneområder ruten går ' +
        'gjennom (Naturbase), rødlistede arter i korridoren (GBIF × norsk rødliste) og NVE-' +
        'vannmålestasjoner. Hver kilde faller pent tilbake til tomt hvis den er utilgjengelig ' +
        '(se «kilder»).',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        start: z.object({ lat: z.number(), lon: z.number() }).describe('Startpunkt'),
        maal: z.object({ lat: z.number(), lon: z.number() }).describe('Målpunkt'),
        via: z.array(z.object({ lat: z.number(), lon: z.number(), navn: z.string().optional() }))
          .optional().describe('Via-punkter ruten må innom, i rekkefølge'),
        bufferM: z.number().min(20).max(1000).default(150).describe('Korridor-bredde (halv) i meter'),
      },
    },
    async ({ kartRef, start, maal, via, bufferM }) => {
      const kart = await kreveKart(env, kartRef)
      const { found, sel, route, enrichment } = await planOgBerik(
        kart, [start, ...(via ?? []), maal], { bufferM })
      const climb = climbFor(kart.dem, route)
      return jsonResult({
        status: 'ok',
        kartRef,
        rute: {
          lengdeM: Math.round(found[sel].lengthM),
          stigningM: climb?.ascent ?? null,
          fallM: climb?.descent ?? null,
          estimertGangtidMin: estWalkMinutes(found[sel].lengthM, climb?.ascent, climb?.descent),
        },
        kulturminner: enrichment.kulturminner,
        reservater: enrichment.reservater,
        arter: enrichment.arter,
        vannstasjoner: enrichment.vannstasjoner,
        kilder: enrichment.kilder,
      })
    },
  )

  server.registerTool(
    'turrapport_svg',
    {
      title: 'Turrapport (samle-SVG)',
      description:
        'Lager én komplett turrapport for et bygget kart (kartRef): kartutsnitt med ruten ' +
        'tegnet inn, høydeprofil, funn langs ruten (kulturminner / verneområder / rødlistede ' +
        'arter / vannstasjoner) og veibeskrivelse med sti-kryss-varsler («ta til venstre ved …»). ' +
        'Skriver både SVG-en og en delbar Markdown-versjon og returnerer URL-er. ' +
        'Ett kall = ferdig oppsummering.',
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        start: z.object({ lat: z.number(), lon: z.number() }).describe('Startpunkt'),
        maal: z.object({ lat: z.number(), lon: z.number() }).describe('Målpunkt'),
        via: z.array(z.object({ lat: z.number(), lon: z.number(), navn: z.string().optional() }))
          .optional().describe('Via-punkter ruten må innom, i rekkefølge'),
        bufferM: z.number().min(20).max(1000).default(150).describe('Korridor-bredde (halv) i meter for funn'),
        ruteIndeks: z.number().int().min(0).default(0).describe('Hvilket rute-alternativ som brukes'),
        startNavn: z.string().optional().describe('Etikett ved start'),
        maalNavn: z.string().optional().describe('Etikett ved mål'),
        rutebreddeFaktor: z.number().min(0.1).max(3).default(1)
          .describe('Skalerer rutestrekens bredde (1 = appens standard, 0.33 = tredjedel)'),
        tittel: z.string().optional().describe('Rapport-tittel'),
        navn: z.string().default('turrapport').describe('Rapportnavn, brukes i filnavn'),
      },
    },
    async ({ kartRef, start, maal, via, bufferM, ruteIndeks, startNavn, maalNavn, rutebreddeFaktor, tittel, navn }) => {
      const kart = await kreveKart(env, kartRef)
      const viaPts = via ?? []
      const { rg, snaps, found, sel, route, enrichment } = await planOgBerik(
        kart, [start, ...viaPts, maal], { bufferM, ruteIndeks })

      // Rute-overlay på kartet (samme stil som appens Stifinner).
      const startSnap = snaps[0], maalSnap = snaps[snaps.length - 1]
      const a = startSnap.p, b = maalSnap.p
      const connectors = [
        { from: [a.x, a.y], to: startSnap.node.pos },
        { from: [b.x, b.y], to: maalSnap.node.pos },
      ]
      const markers = []
      if (startNavn) markers.push({ x: a.x, y: a.y, color: '#16a34a', label: startNavn, anchor: 'start' })
      viaPts.forEach((v, i) => markers.push({ x: snaps[i + 1].p.x, y: snaps[i + 1].p.y, color: '#f59e0b', label: v.navn, anchor: 'start' }))
      if (maalNavn) markers.push({ x: b.x, y: b.y, color: '#dc2626', label: maalNavn, anchor: 'end' })
      const overlay = buildRouteOverlaySvg({
        routes: [{ coordinates: route, shortest: found[sel].shortest }],
        selectedIndex: 0, connectors, markers, start: [a.x, a.y], dest: [b.x, b.y],
        style: overlayStyleFor(rutebreddeFaktor),
      })
      const mapSvg = injectOverlay(await svgForOutput(env, kartRef, kart.svg), overlay)

      // Høydeprofil + sti-kryss-varsler. POI-ene har transform-korrekte
      // posisjoner (bedre kryss-anker enn rå <text>-x/y); faller tilbake til
      // alle tekst-etiketter om ingen POI finnes.
      const profile = sampleProfile({ points: route.map(([x, y]) => ({ x, y })) }, kart.dem)
      const poi = extractMapPoiFromSvg(kart.svg).map(p => ({ x: p.x, y: p.y, name: p.navn }))
      const namedPoints = poi.length ? poi : extractNamedPointsFromSvg(kart.svg)
      const junctionAt = ([x, y]) => { const id = rg.nodeAt([x, y], 5); return id ? rg.graph.degree(id) >= 3 : false }
      const cues = routeCues(route, { junctionAt, namedPoints })

      const climb = climbFor(kart.dem, route)
      const lengthM = found[sel].lengthM
      const reportArgs = {
        title: tittel ?? `${startNavn ?? 'Start'} → ${maalNavn ?? 'Mål'}`,
        summary: {
          distanceM: lengthM, ascentM: climb?.ascent, descentM: climb?.descent,
          timeMin: estWalkMinutes(lengthM, climb?.ascent, climb?.descent),
          viaNavn: viaPts.map(v => v.navn).filter(Boolean),
        },
        enrichment, cues,
      }
      const svg = buildTripReportSvg({ ...reportArgs, mapSvg, profile })
      const md = buildTripReportMarkdown(reportArgs)

      const slug = navn.replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase()
      const [svgSti, mdSti] = await Promise.all([
        lagreUtdata(env, kartRef, `${slug}.svg`, svg, 'image/svg+xml; charset=utf-8'),
        lagreUtdata(env, kartRef, `${slug}.md`, md, 'text/markdown; charset=utf-8'),
      ])

      return jsonResult({
        status: 'ok',
        kartRef,
        rapportUrl: filUrl(svgSti),
        markdownUrl: filUrl(mdSti),
        svgKb: Math.round(svg.length / 1024),
        rute: {
          lengdeM: Math.round(lengthM),
          stigningM: climb?.ascent ?? null,
          estimertGangtidMin: estWalkMinutes(lengthM, climb?.ascent, climb?.descent),
        },
        funn: {
          kulturminner: enrichment.kulturminner.length,
          reservater: enrichment.reservater.length,
          rodliste: enrichment.arter?.rodliste?.antall ?? null,
          vannstasjoner: enrichment.vannstasjoner.length,
          veibeskrivelseSteg: cues.length,
        },
        kilder: enrichment.kilder,
      })
    },
  )

  server.registerTool(
    'juster_kart',
    {
      title: 'Juster kartvisning (kartstil / lag / strek)',
      description:
        'Justerer visningen av et bygget kart (kartRef) med SAMME valg som en bruker har i ' +
        'appens drawer: kartstil, tema, lag-toggles fra Kartlag-fanen, global strek-skala ' +
        '(Strek-knotten) og per-gruppe strektykkelse (Strek-panelet). Innstillingene huskes per ' +
        'kartRef og påføres alle senere SVG-utdata (turrapport_svg / planlegg_rundtur med ' +
        'tegnSvg) til de nullstilles. Original-SVG-en røres ikke; en justert kopi skrives og ' +
        'returneres som URL. ' +
        `Kartstiler (ETT valg som setter tema, lag, strek og sti-farger samtidig — start her): ${KARTSTIL_DOC} ` +
      `Temaer (finjustering av fargene alene): ${TEMA_DOC} ` +
        `Lag-nøkler: ${LAG_DOC}, dybde (Sjøkart-dybde på hovedkartet). ` +
        `Strek-grupper: ${STREK_DOC}.`,
      inputSchema: {
        kartRef: z.string().describe('Kart-referansen fra bygg_kart'),
        tema: z.enum(TEMA_KEYS).optional()
          .describe('Fargetema (som Tema-knappene i appen) — «light» er default ISOM'),
        kartstil: z.enum(KARTSTIL_KEYS).optional()
          .describe('Kartstil (som Kartstil-fanen i appen): setter tema, lag, strek-profil og '
            + 'sti-farger i én operasjon. Nullstiller tidligere lag-valg. Eksplisitte felter '
            + 'under overstyrer stilens verdier.'),
        // Nøkkeltypen skrives eksplisitt: det er zod 4s dokumenterte signatur.
        // (Ett-argument-formen virker fortsatt i 4.4 — dette er tydelighet, ikke
        // en tvungen migrering.)
        lag: z.record(z.string(), z.boolean()).optional()
          .describe('Enkelt-lag av/på oppå kartstil/default, f.eks. {"kontur": false}'),
        strekSkala: z.number().min(0.1).max(3).optional()
          .describe('Global strek-skala (--stroke-scale), 1 = som bygget'),
        strek: z.record(z.string(), z.number().min(0.4).max(3)).optional()
          .describe('Per-gruppe strek-multiplikator, f.eks. {"sti": 0.6} (0.4–3, 1 = nøytral)'),
        stiFarger: z.object({
          fg: z.string().optional().describe('Farge på den stiplede sti-streken (505/506/507)'),
          bg: z.string().optional().describe('Farge på den kontinuerlige underlinja (505/506)'),
        }).optional()
          .describe('Sti-farger som 6-sifret hex, f.eks. {"fg": "#7a4fa3"} — utelatt = følg temaet'),
        nullstill: z.boolean().default(false)
          .describe('Fjern alle innstillinger først (som «Nullstill» i Lag-fanen)'),
      },
    },
    async ({ kartRef, tema, kartstil, lag, strekSkala, strek, stiFarger, nullstill }) => {
      const kart = await kreveKart(env, kartRef)
      const prev = nullstill ? {} : (await lastInnstillinger(env, kartRef) ?? {})
      // Tema-bytte nullstiller enkelt-lag-valg når temaet auto-skjuler lag
      // (Curves) — speiler appens onThemeChange.
      const nextTema = tema ?? prev.tema
      const temaResetsLag = tema && THEMES.find(t => t.key === tema)?.autoHideLayers
      const next = {
        tema: nextTema === 'light' ? undefined : nextTema,
        kartstil: kartstil ?? (temaResetsLag ? undefined : prev.kartstil),
        // Kartstil-bytte nullstiller enkelt-lag-valg (samme semantikk som appen).
        lag: (kartstil || temaResetsLag) ? { ...(lag ?? {}) } : { ...(prev.lag ?? {}), ...(lag ?? {}) },
        strekSkala: strekSkala ?? prev.strekSkala,
        strek: { ...(prev.strek ?? {}), ...(strek ?? {}) },
        stiFarger: { ...(prev.stiFarger ?? {}), ...(stiFarger ?? {}) },
      }
      // Validerer nøkler (kaster med liste over gyldige ved feil).
      const visible = resolveVisibleLayers(next)
      buildSettingsCss(next)

      const neutral = !next.tema && !next.kartstil && !Object.keys(next.lag).length
        && next.strekSkala == null && !Object.keys(next.strek).length
        && !Object.keys(next.stiFarger).length
      await lagreInnstillinger(env, kartRef, neutral ? null : next)

      const sti = await lagreUtdata(env, kartRef, 'kart-justert.svg',
        await svgForOutput(env, kartRef, kart.svg), 'image/svg+xml; charset=utf-8')

      const skjulteLag = LAYERS.filter(l => !visible.has(l.key)).map(l => l.key)
      return jsonResult({
        status: 'ok',
        kartRef,
        kartJustertUrl: filUrl(sti),
        innstillinger: neutral ? 'nullstilt (som bygget)' : next,
        skjulteLag,
        merknad: 'Innstillingene huskes for kartRef-en og påføres også senere rapport-/rute-SVG-er.',
      })
    },
  )
}

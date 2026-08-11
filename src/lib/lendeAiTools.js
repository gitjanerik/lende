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
import { buildSearchIndex, filterIndex, formatAreaShort, foldName } from '../composables/useMapSearch.js'
import { svgToWgs84, wgs84ToSvg } from './utm.js'
import { unpackDem } from './demSampling.js'
import {
  analyserStinett, formatStinettSvar, stinettFeaturesFromSvgEl, estGangtidMin,
} from './stinettAnalyse.js'
import {
  buildRoutingGraph, planRoutesThrough, planLoop, ROUTABLE_CODES, MAX_SNAP_M, FAR_SNAP_M,
} from './routing.js'
import { sampleProfile } from './elevationProfile.js'
import { listThemes } from './mapSettingsApply.js'
import { LAYERS, LAYER_PRESETS } from './mapLayerCatalog.js'
import { useMapTheme } from '../composables/useMapTheme.js'
import { useMapLayerControl, sendLagKommando } from '../composables/useMapLayerControl.js'
import { useMapHighlight, sendMerkeKommando } from '../composables/useMapHighlight.js'

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
        'Åpne «Nytt turkart» med senter, størrelse og navn ferdig utfylt — brukeren bekrefter og ' +
        'bygger selv. OPPGI HELST «sted» (stedsnavnet slik brukeren sa det, gjerne med kommune: ' +
        '«Sirikjerke, Øvre Eiker») — appen geokoder det selv. Da slipper du sok_sted, og du kan ' +
        'ikke komme i skade for å gjenbruke koordinater fra et annet sted i samtalen.',
      parameters: {
        type: 'object',
        properties: {
          sted: { type: 'string', description: 'ANBEFALT: stedsnavn å geokode, f.eks. «Sirikjerke, Øvre Eiker»' },
          lat: { type: 'number', description: 'Senter-breddegrad (kun nødvendig uten «sted»)' },
          lon: { type: 'number', description: 'Senter-lengdegrad (kun nødvendig uten «sted»)' },
          km: { type: 'number', description: 'Kartbredde i km (1–16, standard 4)' },
          navn: { type: 'string', description: 'Foreslått kartnavn (standard: stedsnavnet)' },
          turFraNavn: { type: 'string', description: 'Startsted for en tur som skal tegnes inn straks kartet er bygget' },
          turTilNavn: { type: 'string', description: 'Målsted for turen. Må oppgis sammen med turFraNavn.' },
        },
        required: [],
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
        'OPPGI HELST «sted» (stedsnavnet slik brukeren sa det, gjerne med kommune: «Sirikjerke, ' +
        'Øvre Eiker») — appen geokoder det selv, så du slipper sok_sted og kan ikke gjenbruke ' +
        'koordinater fra et annet sted i samtalen. Vil brukeren OGSÅ gå en tur i det nye ' +
        'kartet: oppgi turFraNavn og turTilNavn i SAMME kall — turen tegnes da inn automatisk ' +
        'når kartet er ferdig bygget. Kall ALDRI foreslaa_tur for et kart som ikke finnes ennå.',
      parameters: {
        type: 'object',
        properties: {
          sted: { type: 'string', description: 'ANBEFALT: stedsnavn å geokode, f.eks. «Sirikjerke, Øvre Eiker»' },
          lat: { type: 'number', description: 'Senter-breddegrad (kun nødvendig uten «sted»)' },
          lon: { type: 'number', description: 'Senter-lengdegrad (kun nødvendig uten «sted»)' },
          km: { type: 'number', description: 'Kartbredde i km (1–16, standard 4)' },
          navn: { type: 'string', description: 'Kartnavn (standard: stedsnavnet)' },
          turFraNavn: { type: 'string', description: 'Startsted for en tur som skal tegnes inn straks kartet er bygget, f.eks. «Brynsetertjern»' },
          turTilNavn: { type: 'string', description: 'Målsted for turen, f.eks. «Sirikjerke». Må oppgis sammen med turFraNavn.' },
          vis3d: { type: 'boolean', description: 'Åpne turen i 3D når kartet er klart (KUN når brukeren har bedt om 3D)' },
        },
        required: [],
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
        'andre steder. Nøkkelord gir OVERSIKTER: «vann»/«innsjø» alle ferskvann sortert på ' +
        'areal (største først, arealM2 per treff), «topp» de høyeste toppene (moh), ' +
        '«parkering» alle parkeringer.',
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
      name: 'styr_kartlag',
      description:
        'Skru kartlag av og på i det åpne kartet (sti, høydekurver, vann, skog, bygninger, ' +
        'navn, parkering, kulturminner …), bytt til et forhåndsvalg, eller nullstill. Bruk ved ' +
        '«skjul navnene», «vis bare stier og høydekurver», «slå på parkering», «bytt til ' +
        'padling», «nullstill kartlagene». Kall UTEN argumenter for å få listen over alle lag ' +
        'og hva som er synlig nå — gjør det når du er usikker på hva brukeren mener. ' +
        'Lagnavn kan skrives på norsk («høydekurver») eller som nøkkel («kontur»).',
      parameters: {
        type: 'object',
        properties: {
          vis: { type: 'array', items: { type: 'string' }, description: 'Lag som skal slås PÅ, f.eks. ["parkering","vann"]' },
          skjul: { type: 'array', items: { type: 'string' }, description: 'Lag som skal slås AV, f.eks. ["navn"]' },
          bare: { type: 'array', items: { type: 'string' }, description: 'Vis KUN disse lagene (alt annet av) — «vis bare stier og høydekurver»' },
          forhandsvalg: { type: 'string', description: 'tur | padling | detaljert | print' },
          nullstill: { type: 'boolean', description: 'Sett alle lag tilbake til standard' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bytt_kart_tema',
      description:
        'Bytt fargetema på kartflaten (mørkt nattkart, sepia, monokrome varianter, eller ' +
        'tilbake til standard ISOM-palett). Bruk ved «bytt til mørkt kart», «dark mode», ' +
        '«gjør kartet mørkere», «tilbake til vanlige farger». Utelat «tema» for å få listen ' +
        'over tilgjengelige temaer i svaret. Endringen gjelder alle kart og huskes til neste ' +
        'gang. Dette er kartets farger — det er IKKE appens meny-utseende, og heller ikke 3D.',
      parameters: {
        type: 'object',
        properties: {
          tema: {
            type: 'string',
            description: 'Tema-nøkkel («dark», «light», …) eller norsk beskrivelse («mørkt», «lyst», «sepia»). Utelat for å liste alternativene.',
          },
        },
        required: [],
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
      name: 'merk_i_kartet',
      description:
        'Merk et sted i kartet med den rosa, blinkende ringen og pan dit — helt samme markering ' +
        'som når brukeren velger et treff i søkefeltet. Bruk når brukeren ber om det («kan du ' +
        'merke det», «marker Stordammen», «vis meg hvor det er»), og tilby det gjerne selv rett ' +
        'etter at du har navngitt et sted i kartet. Oppgi HELST bare «navn» — appen slår det opp ' +
        'i kartets egne navn og finner koordinatene selv; lat/lon er bare for punkter uten navn. ' +
        'Ligger stedet i en naboflis, åpnes den flisen. Sett «fjern» for å fjerne markeringen. ' +
        'Påstå ALDRI at noe er merket uten at dette verktøyet har svart ok.',
      parameters: {
        type: 'object',
        properties: {
          navn: { type: 'string', description: 'Stedsnavnet som skal merkes, f.eks. «Bijjie Gaajsjaevrie»' },
          kartId: { type: 'string', description: 'Kart-id — KUN for et annet kart enn det brukeren står i (ellers utelat)' },
          lat: { type: 'number', description: 'Breddegrad (kun for punkter uten navn i kartet)' },
          lon: { type: 'number', description: 'Lengdegrad (kun for punkter uten navn i kartet)' },
          fjern: { type: 'boolean', description: 'Fjern markeringen som står i kartet nå' },
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
        'foreslaa_nytt_kart. Begge punktene må ligge i kartet. OPPGI HELST STEDSNAVNENE ' +
        '(origoNavn/viaNavn) — appen slår dem opp i kartets egne navn, som er fasit. ' +
        'Verktøyet beregner sløyfen før den tegnes og returnerer «rute» med ekte lengde, ' +
        'stigning og gangtid — bruk DE tallene, aldri egne anslag.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          origoNavn: { type: 'string', description: 'ANBEFALT: startstedets navn slik brukeren sa det — appen slår det opp i kartets egne navn' },
          viaNavn: { type: 'string', description: 'ANBEFALT: vendepunktets navn — appen slår det opp i kartets egne navn' },
          origoLat: { type: 'number', description: 'Startpunkt = målpunkt (kun nødvendig uten origoNavn). Spør brukeren hvor turen skal starte hvis ukjent.' },
          origoLon: { type: 'number', description: 'Startpunkt = målpunkt (lengdegrad)' },
          viaLat: { type: 'number', description: 'Vendepunkt turen skal innom (kun nødvendig uten viaNavn), f.eks. en topp' },
          viaLon: { type: 'number', description: 'Vendepunkt (lengdegrad)' },
          navn: { type: 'string', description: 'Turnavn, f.eks. «Rundtur Konnerudkollen»' },
          vis3d: { type: 'boolean', description: 'Åpne 3D-visningen automatisk (KUN når brukeren har bedt om 3D — ruten tegnes uansett)' },
        },
        required: ['kartId'],
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
        'innenfor kartet. OPPGI HELST STEDSNAVNENE (fraNavn/tilNavn) — appen slår dem opp i ' +
        'kartets egne navn, som er fasit, så du slipper å hente eller huske koordinater. ' +
        'Verktøyet beregner ruten før den tegnes og returnerer «rute» med ekte ' +
        'lengde, stigning og gangtid — bruk DE tallene i svaret, aldri egne anslag. Mangler ' +
        '«rute», er turen ikke beregnet ennå: nevn da ingen tall. Sett vis3d KUN når brukeren ' +
        'eksplisitt har bedt om 3D — ellers tegnes ruten bare, og du kan tilby 3D som neste steg.',
      parameters: {
        type: 'object',
        properties: {
          kartId: { type: 'string', description: 'Kart-id fra mine_kart_og_ruter (utelat hvis brukeren står i kartet — bruk kartId fra konteksten)' },
          fraNavn: { type: 'string', description: 'ANBEFALT: startstedets navn slik brukeren sa det («Krokekra») — appen slår det opp i kartets egne navn' },
          tilNavn: { type: 'string', description: 'ANBEFALT: målstedets navn («Fan-i-vold») — appen slår det opp i kartets egne navn' },
          fraLat: { type: 'number', description: 'Startpunkt (kun nødvendig uten fraNavn)' },
          fraLon: { type: 'number' },
          tilLat: { type: 'number', description: 'Målpunkt (kun nødvendig uten tilNavn)' },
          tilLon: { type: 'number' },
          navn: { type: 'string', description: 'Turnavn, f.eks. «Stormoen–Konnerudkollen»' },
          vis3d: { type: 'boolean', description: 'Åpne 3D-visningen automatisk (KUN når brukeren har bedt om 3D)' },
        },
        required: ['kartId'],
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
export function buildLagKartQuery({ lat, lon, km, navn, turFraNavn, turTilNavn, vis3d }) {
  const query = { lat: Number(lat).toFixed(5), lon: Number(lon).toFixed(5), auto: '1' }
  const b = Number(km)
  query.km = String(Number.isFinite(b) ? Math.min(Math.max(b, 1), 16) : 4)
  if (navn) query.hl = String(navn).slice(0, 60)
  // Tur bestilt i samme melding som kartet: navnene følger med gjennom
  // byggingen (kartet finnes ikke ennå, så koordinater kan ikke slås opp) og
  // løses mot kartets egen søkeindeks i MapView når stiene er tegnet.
  const fra = String(turFraNavn ?? '').trim()
  const til = String(turTilNavn ?? '').trim()
  if (fra && til) {
    query.tfn = fra.slice(0, 60)
    query.ttn = til.slice(0, 60)
    if (vis3d) query.v3d = '1'
  }
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

// Søk i ÉN lagret kart-flis med appens egen søkeindeks (samme som søkefeltet).
// getBBox() krever et RENDRET element (kaster på detached dokument) — monter
// derfor den parsede SVG-en usynlig mens indeksen bygges.
function sokIEttKart(entry, sok, maks) {
  const doc = new DOMParser().parseFromString(entry.svg, 'image/svg+xml')
  const svgEl = document.importNode(doc.documentElement, true)
  // UTM-forankringen leses fra SVG-ens data-meta — lagrede app-kart har ikke
  // noe meta-felt på entry-en.
  const m = metaFraSvgEl(svgEl)
  if (!m) return []
  const holder = document.createElement('div')
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none'
  holder.appendChild(svgEl)
  document.body.appendChild(holder)
  let rader
  try {
    rader = filterIndex(buildSearchIndex(svgEl), String(sok ?? ''), maks)
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
    if (r.elv) o.elv = true
    if (Number.isFinite(r.areaM2) && r.areaM2 > 0) {
      o.areal = formatAreaShort(r.areaM2)
      // Rått areal i tillegg til den formaterte teksten: rangering («største
      // innsjø») skal gjøres på tall, ikke på «~2,1 km²»-strenger.
      o.arealM2 = Math.round(r.areaM2)
    }
    return o
  })
}

// Kategori-ord chatten skal tolke som en OVERSIKT, ikke som et stedsnavn —
// foldet form (foldName: ø→oe, å→aa, æ→ae). Bevisst smal: «Andedammen» og
// «Stordammen» er stedsnavn, så «dam»/«dammen» står ikke her.
const KATEGORI_ORD = {
  vann: 'vann', vannet: 'vann', vatn: 'vann', vatnet: 'vann', vatna: 'vann',
  innsjoe: 'vann', innsjoeen: 'vann', innsjoeer: 'vann', innsjoeene: 'vann',
  sjoe: 'vann', sjoeen: 'vann', tjern: 'vann', tjernet: 'vann', tjerna: 'vann',
  topp: 'topp', toppen: 'topp', toppene: 'topp', topper: 'topp',
}

/**
 * Tolk «den største innsjøen i kartet» som en RANGERING, ikke som et stedsnavn.
 *
 * Kartsøkets kategori-oversikt («vann») sorterer navngitte vann ALFABETISK —
 * første treff er «Andedammen», ikke det største vannet. Tok chatten treff nr.
 * 0 som svar på et superlativ, merket den omtrent det minste vannet i kartet
 * (v4.8.10). Her avgjøres i stedet hvilken kategori og hvilken retning
 * brukeren ba om, så rangeringen kan gjøres på ekte tall.
 *
 * @returns {{kategori: 'vann'|'topp', retning: 'storst'|'minst'|null} | null}
 */
export function tolkKategoriOnske(navn) {
  const s0 = foldName(navn)
  if (!s0) return null
  const retning = /\bminst|\blavest/.test(s0)
    ? 'minst'
    : /\bstoerst|\bhoeyest|\bstoerre/.test(s0) ? 'storst' : null
  const kjerne = s0
    .replace(/\b(stoerst\w*|minst\w*|hoeyest\w*|lavest\w*|stoerre)\b/g, ' ')
    .replace(/\b(den|det|de|som|er|i|pa|paa|her|av|hele|dette|kartet|omraadet|utsnittet)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const kategori = KATEGORI_ORD[kjerne] ?? null
  return kategori ? { kategori, retning } : null
}

/**
 * Velg ETT treff etter størrelse: areal for vann, høyde for topper.
 * Rader uten tallet er ikke med i rangeringen (men telles i `utenTall`, så
 * svaret kan være ærlig om hva som ikke kunne veies).
 */
export function velgEtterStorrelse(rader, { kategori = 'vann', retning = null } = {}) {
  const nokkel = kategori === 'topp' ? 'moh' : 'arealM2'
  const alle = (rader ?? []).filter((r) => Number.isFinite(r?.[nokkel]) && r[nokkel] > 0)
  // Elveflater er blå flater, men ikke vann i norsk forstand: Drammenselva
  // vant «største innsjø i kartet» med 3,4 km² (v4.8.11). De rangeres ikke —
  // men telles, så svaret kan si hvorfor elva ikke ble svaret.
  const med = kategori === 'vann' ? alle.filter((r) => !r.elv) : alle
  const elver = alle.length - med.length
  if (!med.length) return null
  const sortert = [...med].sort((a, b) => (
    retning === 'minst' ? a[nokkel] - b[nokkel] : b[nokkel] - a[nokkel]
  ))
  return {
    valgt: sortert[0],
    antall: med.length,
    utenTall: (rader?.length ?? 0) - alle.length,
    elverUtelatt: elver,
    kategori,
    retning: retning ?? 'storst',
  }
}

/**
 * Slå opp ett stedsnavn i kartets EGNE navn (aktiv flis først, så naboflisene).
 * Kartets navn er fasit for tur-punkter: nettbasert geokoding (sok_sted) kan
 * treffe navnebrødre andre steder i landet — det var slik «Krokekra» endte
 * «veldig langt utenfor kartet» selv om stedet ligger midt i det.
 */
async function finnStedIKartet(kart, naboer, navn) {
  const q = String(navn ?? '').trim()
  if (!q) return null
  const eget = sokIEttKart(kart, q, 3)
  if (eget.length) return eget[0]
  for (const nabo of naboer) {
    const full = await loadMap(nabo.id)
    if (!full?.svg) continue
    const t = sokIEttKart(full, q, 3)
    if (t.length) return t[0]
  }
  return null
}

/**
 * Løs ett tur-punkt. Et oppgitt STEDSNAVN slår koordinater — appen slår det
 * opp i kartets egne navn i stedet for å stole på at modellen har riktige
 * lat/lon. Finnes ikke navnet, faller vi tilbake til koordinatene (som uansett
 * valideres av mosaikk-vaktposten).
 * @returns {{punkt: {lat,lon}, kilde?: object} | {feil: string}}
 */
async function losTurPunkt({ rolle, navn, lat, lon, kart, naboer }) {
  if (navn) {
    const treff = await finnStedIKartet(kart, naboer, navn)
    if (treff) return { punkt: { lat: treff.lat, lon: treff.lon }, kilde: treff }
  }
  const p = { lat: Number(lat), lon: Number(lon) }
  if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) return { punkt: p }
  return {
    feil: navn
      ? `Fant ikke «${navn}» blant kartets egne navn, og ingen koordinater ble oppgitt for ${rolle.toLowerCase()}.`
      : `${rolle} mangler både stedsnavn og koordinater.`,
  }
}

/**
 * Løs senterpunktet for et NYTT kart. Et oppgitt `sted` geokodes her i stedet
 * for å stole på lat/lon fra modellen — den gjenbrukte koordinater fra et
 * tidligere sted i samtalen («Sirikjerke i Øvre Eiker» ga et kart over
 * Stormoen). Uten `sted` brukes lat/lon som før.
 * @returns {{lat:number, lon:number, stedsnavn?:string} | {feil:string}}
 */
async function losKartSenter(args) {
  const sted = String(args?.sted ?? '').trim()
  if (sted) {
    const treff = await geocodePlace(sted)
    if (treff?.length) {
      return { lat: Number(treff[0].lat), lon: Number(treff[0].lon), stedsnavn: treff[0].name ?? sted }
    }
    const lat = Number(args?.lat), lon = Number(args?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { feil: `Fant ingen steder for «${sted}». Sjekk skrivemåten, eller oppgi lat/lon.` }
    }
    return { lat, lon }
  }
  const lat = Number(args?.lat), lon = Number(args?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { feil: 'Oppgi enten «sted» (stedsnavn) eller lat/lon.' }
  }
  return { lat, lon }
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
        const senter = await losKartSenter(args)
        if (senter.feil) return { feil: senter.feil }
        const { lat, lon, stedsnavn } = senter
        const query = { lat: lat.toFixed(5), lon: lon.toFixed(5) }
        const km = Number(args?.km)
        if (Number.isFinite(km)) query.km = String(Math.min(Math.max(km, 1), 16))
        const tittel = args?.navn ?? stedsnavn
        if (tittel) query.hl = String(tittel).slice(0, 60)
        // Tur bestilt i samme melding: navnene følger med gjennom byggingen
        // (samme mekanikk som lag_kart) og tegnes inn når kartet er ferdig.
        const fra = String(args?.turFraNavn ?? '').trim()
        const til = String(args?.turTilNavn ?? '').trim()
        if (fra && til) {
          query.tfn = fra.slice(0, 60)
          query.ttn = til.slice(0, 60)
          if (args?.vis3d) query.v3d = '1'
        }
        onNavigate?.()
        await navigerTil({ name: 'kart-nytt', query })
        return {
          ok: true,
          senter: { lat, lon, sted: stedsnavn ?? null },
          turBestilt: query.tfn ? { fra: query.tfn, til: query.ttn } : undefined,
          merknad: 'Byggeskjemaet er åpnet med feltene utfylt — brukeren bekrefter og bygger selv.' +
            (query.tfn ? ` Turen ${query.tfn} → ${query.ttn} tegnes inn når kartet er bygget.` : ''),
        }
      }
      case 'lag_kart': {
        const senter = await losKartSenter(args)
        if (senter.feil) return { feil: senter.feil }
        const { lat, lon, stedsnavn } = senter
        const query = buildLagKartQuery({
          lat, lon, km: args?.km, navn: args?.navn ?? stedsnavn,
          turFraNavn: args?.turFraNavn, turTilNavn: args?.turTilNavn, vis3d: args?.vis3d,
        })
        const medTur = !!query.tfn
        onNavigate?.()
        await navigerTil({ name: 'kart-nytt', query })
        return {
          ok: true,
          senter: { lat, lon, sted: stedsnavn ?? null },
          turBestilt: medTur ? { fra: query.tfn, til: query.ttn } : undefined,
          merknad:
            'Byggingen er startet (tar 15–60 sekunder) — kartet åpnes automatisk når det er ' +
            'ferdig. VIKTIG: ikke lov brukeren at det lykkes; ved feil vises en melding i ' +
            'byggeskjemaet der brukeren kan justere og prøve igjen.' +
            (medTur
              ? ` Turen ${query.tfn} → ${query.ttn} tegnes inn av seg selv når kartet er ` +
                'klart — si det, og oppgi ingen tall (ruten er ikke beregnet ennå).'
              : ' Skal brukeren ha en tur i det nye kartet, oppgi turFraNavn/turTilNavn i ' +
                'SAMME lag_kart-kall — da tegnes den inn automatisk når kartet er ferdig.'),
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

        const treff = [...sokIEttKart(kart, args?.sok, maks)]
        for (const nabo of naboer) {
          if (treff.length >= maks) break
          const full = await loadMap(nabo.id)
          if (full?.svg) treff.push(...sokIEttKart(full, args?.sok, maks))
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
        // Kategori-søk («vann», «topp»): kartsøkets egen rekkefølge er
        // ALFABETISK for navngitte treff — tok modellen første rad som «det
        // største», merket den «Andedammen» (v4.8.10). Her sorteres oversikten
        // på ekte tall, så rad 1 faktisk ER den største/høyeste.
        const kategoriOnske = tolkKategoriOnske(args?.sok)
        if (kategoriOnske) {
          const nokkel = kategoriOnske.kategori === 'topp' ? 'moh' : 'arealM2'
          const verdi = (r) => (Number.isFinite(r?.[nokkel]) ? r[nokkel] : -1)
          treff.sort((a, b) => verdi(b) - verdi(a))
        }
        return {
          treff: treff.slice(0, maks),
          sortering: kategoriOnske
            ? (kategoriOnske.kategori === 'topp'
              ? 'Høyeste først (moh).'
              : 'Største først (arealM2). Vann uten kjent areal ligger nederst.')
            : undefined,
          merknad:
            'Treff med annen kartId enn brukerens aktive kart ligger i en NABOFLIS i samme ' +
            'mosaikk — turer kan tegnes på tvers: bruk koordinatene direkte i foreslaa_tur/' +
            'foreslaa_rundtur (appen laster naboflisene automatisk).' +
            (kategoriOnske
              ? ' Skal brukeren ha det største/minste merket, send ønsket ordrett videre til ' +
                'merk_i_kartet (f.eks. navn: «største innsjø») — appen rangerer selv.'
              : ''),
        }
      }
      case 'merk_i_kartet': {
        const { merkeKlar } = useMapHighlight()
        if (!merkeKlar.value) {
          return {
            feil: 'Ingen kartvisning er åpen, så jeg kan ikke merke noe. Åpne kartet først ' +
              '(apne_kart), så kan markeringen settes.',
          }
        }
        if (args?.fjern) {
          sendMerkeKommando({ fjern: true })
          return { ok: true, fjernet: true, merknad: 'Markeringen er fjernet fra kartet.' }
        }
        const løst = await losKart(args, kontekst)
        if (!løst) return { feil: `Fant ikke kart med id «${args?.kartId}». Bruk mine_kart_og_ruter.` }
        const { id, kart } = løst
        const navn = String(args?.navn ?? '').trim()

        // Navnet slår koordinater, som i turverktøyene: kartets egne navn er
        // fasit, og modellen har gjerne bare lest koordinatene et annet sted i
        // samtalen. Naboflisene søkes også — mosaikken oppleves som ett kart.
        const naboer = (await mosaikkFliser(id, kart)).slice(1, 9)

        // «Den største innsjøen» er en RANGERING, ikke et navn. Kategori-lista
        // er alfabetisk, så et navne-oppslag ville merket «Andedammen» —
        // omtrent det minste vannet i kartet. Rangeringen gjøres på areal
        // (vann) eller høyde (topper), og bare i flisen brukeren står i:
        // «i kartet» betyr dette kartet, som i analyser_stinett.
        const onske = tolkKategoriOnske(navn)
        const rangering = onske
          ? velgEtterStorrelse(sokIEttKart(kart, onske.kategori, 500), onske)
          : null
        const treff = rangering?.valgt
          ?? (navn ? await finnStedIKartet(kart, naboer, navn) : null)
        let punkt = treff ? { lat: treff.lat, lon: treff.lon } : null
        if (!punkt) {
          const lat = Number(args?.lat), lon = Number(args?.lon)
          if (Number.isFinite(lat) && Number.isFinite(lon)) punkt = { lat, lon }
        }
        if (!punkt) {
          if (onske) {
            return {
              feil: `Kartet «${kart.navn ?? id}» har ingen ${onske.kategori === 'topp' ? 'topper med kjent høyde' : 'innsjøer eller tjern med kjent areal'} ` +
                'å rangere, så jeg kan ikke peke ut den ' +
                `${onske.retning === 'minst' ? 'minste' : 'største'}. Si det ærlig` +
                `${onske.kategori === 'vann' ? ' — elveflater teller ikke som innsjø' : ''}.`,
            }
          }
          return {
            feil: navn
              ? `Fant ikke «${navn}» blant navnene i kartet «${kart.navn ?? id}» eller naboflisene. ` +
                'Si det ærlig, og tilby å bygge et kart over området (lag_kart).'
              : 'Oppgi navnet på stedet som skal merkes (navn), eller lat/lon for et punkt uten navn.',
          }
        }
        const merketNavn = treff?.navn ?? navn ?? 'Markert sted'
        const målKart = treff?.kartId ?? id
        const merket = {
          navn: merketNavn,
          lat: punkt.lat,
          lon: punkt.lon,
          kart: treff?.kart ?? kart.navn ?? id,
        }
        if (rangering) {
          merket.rangering = {
            kategori: rangering.kategori,
            retning: rangering.retning,
            antall: rangering.antall,
            storrelse: rangering.kategori === 'topp'
              ? (treff.moh != null ? `${treff.moh} moh` : null)
              : (treff.areal ?? null),
            elverUtelatt: rangering.elverUtelatt || 0,
          }
        }
        // Stedet ligger i flisen brukeren står i: merk direkte, uten navigasjon.
        if (kontekst?.kartId && kontekst.kartId === målKart) {
          sendMerkeKommando({ navn: merketNavn, lat: punkt.lat, lon: punkt.lon })
          onNavigate?.()
          return {
            ok: true,
            merket,
            merknad: 'Markeringen (rosa, blinkende ring) står i kartet nå, og utsnittet er ' +
              'pannet dit. Bekreft kort at stedet er merket — ikke gjenta koordinatene.',
          }
        }
        // Annen flis eller et annet lagret kart: åpne det med samme dyplenke
        // «Del kart og sted» bruker, så markeringen settes når kartet er lastet.
        onNavigate?.()
        await navigerTil({
          name: 'kart-vis',
          params: { id: målKart },
          query: {
            hl: merketNavn.slice(0, 60),
            slat: punkt.lat.toFixed(6),
            slon: punkt.lon.toFixed(6),
          },
        })
        return {
          ok: true,
          merket,
          byttetKart: merket.kart,
          merknad: `Stedet ligger i «${merket.kart}» — kartet åpnes med markeringen satt. ` +
            'Bekreft kort, og nevn at du byttet kartflis. Ikke gjenta koordinatene.',
        }
      }
      case 'styr_kartlag': {
        const { synligeLag } = useMapLayerControl()
        const naa = synligeLag.value
        if (!naa) {
          return { feil: 'Ingen kartvisning er åpen — kartlag styres i et åpent kart. Åpne kartet først (apne_kart).' }
        }
        const katalog = LAYERS.map((l) => ({ nokkel: l.key, navn: String(l.label).replace(/­/g, '') }))
        const listeSvar = () => ({
          synlige: naa,
          alleLag: katalog,
          forhandsvalg: LAYER_PRESETS.map((p) => p.key),
          merknad: 'Fortell brukeren hva som er på nå, eller spør hva hun vil endre.',
        })

        if (args?.nullstill) {
          sendLagKommando({ nullstill: true })
          return { ok: true, handling: 'nullstilt', merknad: 'Kartlagene er satt tilbake til standard.' }
        }

        const onsketPreset = String(args?.forhandsvalg ?? '').trim().toLowerCase()
        if (onsketPreset) {
          const p = LAYER_PRESETS.find((x) => x.key === onsketPreset)
            ?? LAYER_PRESETS.find((x) => String(x.label).toLowerCase() === onsketPreset)
          if (!p) {
            return {
              feil: `Kjenner ikke forhåndsvalget «${args.forhandsvalg}».`,
              forhandsvalg: LAYER_PRESETS.map((x) => ({ nokkel: x.key, navn: x.label })),
            }
          }
          sendLagKommando({ keys: p.keys })
          return { ok: true, forhandsvalg: p.key, navn: p.label, antallLag: p.keys.length }
        }

        const vis = losLagNokler(args?.vis, LAYERS)
        const skjul = losLagNokler(args?.skjul, LAYERS)
        const bare = losLagNokler(args?.bare, LAYERS)
        if (!vis.nokler.length && !skjul.nokler.length && !bare.nokler.length) {
          const ukjente = [...vis.ukjente, ...skjul.ukjente, ...bare.ukjente]
          if (ukjente.length) {
            return { feil: `Kjenner ikke laget/lagene ${ukjente.map((u) => `«${u}»`).join(', ')}.`, alleLag: katalog }
          }
          return listeSvar()
        }

        const neste = bare.nokler.length ? new Set(bare.nokler) : new Set(naa)
        for (const k of vis.nokler) neste.add(k)
        for (const k of skjul.nokler) neste.delete(k)
        sendLagKommando({ keys: [...neste] })
        const navnFor = (k) => katalog.find((c) => c.nokkel === k)?.navn ?? k
        const svar = { ok: true, antallSynlige: neste.size }
        if (bare.nokler.length) svar.bare = bare.nokler.map(navnFor)
        if (vis.nokler.length) svar.slattPaa = vis.nokler.map(navnFor)
        if (skjul.nokler.length) svar.slattAv = skjul.nokler.map(navnFor)
        const ukjente = [...vis.ukjente, ...skjul.ukjente, ...bare.ukjente]
        if (ukjente.length) svar.ukjente = ukjente
        return svar
      }
      case 'bytt_kart_tema': {
        const temaer = listThemes()
        const valgbare = temaer.map((t) => ({ nokkel: t.key, navn: t.label }))
        const onske = String(args?.tema ?? '').trim()
        if (!onske) {
          return {
            temaer: valgbare,
            merknad: 'Spør brukeren hvilket tema hun vil ha, og kall verktøyet på nytt med «tema».',
          }
        }
        const nokkel = losTemaNokkel(onske, temaer)
        if (!nokkel) {
          return {
            feil: `Kjenner ikke temaet «${onske}».`,
            temaer: valgbare,
          }
        }
        const { setMapTheme } = useMapTheme()
        setMapTheme(nokkel)
        const valgt = temaer.find((t) => t.key === nokkel)
        return {
          ok: true,
          tema: nokkel,
          navn: valgt?.label ?? nokkel,
          merknad: `Kartet vises nå i temaet «${valgt?.label ?? nokkel}». Bekreft kort til brukeren.`,
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
        const naboer = fliser.slice(1, 9)

        // Stedsnavn slår koordinater: appen slår dem opp i kartets EGNE navn.
        const løste = []
        for (const [rolle, navn, lat, lon] of [
          ['Startpunktet', args?.origoNavn, args?.origoLat, args?.origoLon],
          ['Vendepunktet', args?.viaNavn, args?.viaLat, args?.viaLon],
        ]) {
          const r = await losTurPunkt({ rolle, navn, lat, lon, kart, naboer })
          if (r.feil) return { feil: `${r.feil} Ingen rundtur ble startet.` }
          const km = kmUtenforMosaikk(fliser, r.punkt)
          if (km > 0.2) {
            return {
              feil:
                `${rolle} (${r.punkt.lat}, ${r.punkt.lon}) ligger ~${km.toFixed(1)} km utenfor ` +
                `kartet «${kart.navn ?? id}» og naboflisene — ingen rundtur ble startet. ` +
                'Prøv på nytt med stedsnavnet i origoNavn/viaNavn i stedet for koordinater: ' +
                'da slår appen det opp i kartets egne navn, som er fasit.',
            }
          }
          løste.push(r.punkt)
        }
        args = {
          ...args,
          origoLat: løste[0].lat, origoLon: løste[0].lon,
          viaLat: løste[1].lat, viaLon: løste[1].lon,
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
        const naboer = fliser.slice(1, 9)

        // Stedsnavn slår koordinater: appen slår dem opp i kartets EGNE navn,
        // så en navnebror i en annen del av landet ikke kan snike seg inn.
        const løste = []
        for (const [rolle, navn, lat, lon] of [
          ['Startpunktet', args?.fraNavn, args?.fraLat, args?.fraLon],
          ['Målpunktet', args?.tilNavn, args?.tilLat, args?.tilLon],
        ]) {
          const r = await losTurPunkt({ rolle, navn, lat, lon, kart, naboer })
          if (r.feil) return { feil: `${r.feil} Ingen tur ble startet.` }
          const km = kmUtenforMosaikk(fliser, r.punkt)
          if (km > 0.2) {
            return {
              feil:
                `${rolle} (${r.punkt.lat}, ${r.punkt.lon}) ligger ~${km.toFixed(1)} km utenfor ` +
                `kartet «${kart.navn ?? id}» og naboflisene — ingen tur ble startet. Prøv på ` +
                'nytt med stedsnavnet i fraNavn/tilNavn i stedet for koordinater: da slår ' +
                'appen det opp i kartets egne navn, som er fasit. Finnes stedet ikke der, ' +
                'tilby å bygge et nytt kart over riktig område med lag_kart.',
            }
          }
          løste.push(r.punkt)
        }
        args = {
          ...args,
          fraLat: løste[0].lat, fraLon: løste[0].lon,
          tilLat: løste[1].lat, tilLon: løste[1].lon,
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
  const rg = buildRoutingGraph(features, { snapM: 6, gapBridgeM: 30, componentBridgeM: 80 })

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

/**
 * Påstår svaret at en tur/rute ER tegnet inn, beregnet eller planlagt?
 * harOppdiktedeTurtall alene skiller ikke et løgnaktig turSvar fra et helt
 * ærlig svar som bare inneholder tall — «Det er 370 km turstier i kartet»,
 * «Otersjøen ligger 612 moh», «kartet er 5,0 × 5,0 km». Vakten mot oppdiktede
 * turtall må derfor kreve BEGGE: tall + en påstand om at turen finnes.
 */
export function paastaarTegnetTur(tekst) {
  // Setning for setning, fordi et tilbud ikke er en påstand: «Si fra hvis du
  // vil ha turen tegnet inn» avslutter det ærlige stinett-svaret og skal ikke
  // gjøre hele svaret til en løgn.
  return String(tekst ?? '').toLowerCase().split(/[.!?\n]+/).some((s) => {
    if (/hvis du vil|vil du|ønsker du|si fra/.test(s)) return false
    // Framtidsform er et løfte, ikke en påstand: «… vises i kartet SÅ SNART
    // ruten er tegnet inn» er nettopp det den deterministiske turSvarTekst
    // sier når ruten ikke er beregnet ennå, og den er sann.
    if (/så snart|straks|når (den|ruten|ruta|turen) er/.test(s)) return false
    if (!/\b(tur|turen|turene|rundtur|rundturen|rute|ruta|ruten|løype|løypa|løypen)\b/.test(s)) return false
    return /(tegnet|tegnes|lagt inn|planlagt|beregnet|sendt til kartet|vises i kartet|er klar)/.test(s)
  })
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
 * Deterministisk, ærlig bekreftelse etter at et sted ble merket i kartet.
 * Skrives her i stedet for av modellen fordi den (v4.8.9) både påsto merking
 * den ikke hadde utført OG dumpet rå koordinater i svaret — brukeren spurte
 * om en markering, ikke om desimalgrader.
 */
export function merkeSvarTekst({ navn, fjernet = false, byttetKart = null, rangering = null } = {}) {
  if (fjernet) return 'Markeringen er fjernet fra kartet.'
  const stedet = navn ? `«${navn}»` : 'Stedet'
  const ringen = 'merket i kartet med en rosa, blinkende ring'
  if (byttetKart) {
    return `${stedet} ligger i kartflisen «${byttetKart}» — jeg åpnet den og merket stedet med den rosa ringen.`
  }
  // Var det en rangering («den største innsjøen»), skal svaret si HVILKET sted
  // som vant og hvor mange det ble målt mot — ellers kan brukeren ikke se at
  // spørsmålet faktisk ble besvart.
  if (rangering?.antall) {
    const erTopp = rangering.kategori === 'topp'
    const minst = rangering.retning === 'minst'
    const superlativ = erTopp
      ? (minst ? 'den laveste' : 'den høyeste')
      : (minst ? 'det minste' : 'det største')
    const mål = rangering.storrelse ? ` (${rangering.storrelse})` : ''
    const omfang = rangering.antall > 1
      ? `${superlativ} av ${rangering.antall} ${erTopp ? 'topper' : 'vann'} i kartet`
      : `${superlativ} ${erTopp ? 'toppen' : 'vannet'} i kartet`
    // Elveflater kan være kartets største blå flate uten å være et vann —
    // si det, ellers virker svaret feil for den som ser elva renne forbi.
    const elvNote = rangering.elverUtelatt
      ? ` ${rangering.elverUtelatt === 1 ? 'Én elveflate er' : `${rangering.elverUtelatt} elveflater er`} holdt utenfor — rennende vann regnes ikke som innsjø.`
      : ''
    return `${stedet} er ${omfang}${mål}, og er ${ringen}.${elvNote}`
  }
  return `${stedet} er ${ringen}, og utsnittet er flyttet dit.`
}

/**
 * Ber brukeren om å få noe merket i kartet? Brukes til å avgjøre om et svar som
 * PÅSTÅR merking skal etterprøves — «stien er markert med rødt» er en helt
 * gyldig setning om karttegnene, og skal ikke overskrives av vakten.
 */
export function erMerkeOnske(tekst) {
  const s = String(tekst ?? '').toLowerCase()
  if (!s) return false
  return /\b(merk|merke|merker|marker|markere|marker\w*|uthev\w*|highlight\w*)\b/.test(s)
    || /vis (meg )?(hvor|hvilket|hvilken)/.test(s)
}

/**
 * Ordgrense-match som tåler norsk. JS-regexens `\b` er ASCII-basert: æ, ø og å
 * er IKKE-ord-tegn, så `/\båpnet\b/` matcher aldri « åpnet» — mellomrom og «å»
 * er begge non-word, og da finnes det ingen grense mellom dem. Fella tok
 * paastaarNyttKart i første forsøk: både «Jeg åpner «Nytt turkart» …» og
 * «Byggeskjemaet er åpnet» slapp gjennom vakten. \p{L} med u-flagget kjenner
 * hele alfabetet.
 */
const ORD = (...ord) => new RegExp(`(?:^|[^\\p{L}])(?:${ord.join('|')})(?![\\p{L}])`, 'u')

/**
 * Påstår svaret at et NYTT kart er opprettet, bygget, eller at byggeskjemaet er
 * åpnet? Bare foreslaa_nytt_kart og lag_kart kan gjøre noe av det — begge
 * navigerer bort og lukker chatten. Skrev modellen «Jeg åpner «Nytt turkart»
 * med Hurum i Asker som senter» uten å ha kalt noen av dem, skjedde ingenting:
 * chatten ble stående åpen, og brukeren satt igjen med en beskjed om en
 * handling som aldri fant sted (v5.0.1).
 *
 * Vurderes setning for setning, som paastaarTegnetTur/paastaarMerking, så et
 * tilbud («skal jeg lage et kart over Hurum?») ikke regnes som en påstand.
 * «Åpner» krever i tillegg at det gjelder et NYTT kart — den deterministiske
 * tur-teksten sier «Jeg åpner kartet og beregner turen nå», og den er sann.
 */
export function paastaarNyttKart(tekst) {
  return String(tekst ?? '').toLowerCase().split(/[.!?\n]+/).some((s) => {
    if (/hvis du vil|vil du|ønsker du|skal jeg|kan jeg|si fra/.test(s)) return false
    if (ORD('oppretter', 'opprettet', 'lager', 'laget', 'bygger', 'bygget',
      'genererer', 'generert').test(s) && /kart/.test(s)) return true
    return ORD('åpner', 'åpnet').test(s) && /nytt\s+(tur)?kart|byggeskjema/.test(s)
  })
}

/**
 * Påstår svaret at noe ER merket i kartet? Som paastaarTegnetTur vurderes det
 * setning for setning, så et tilbud («vil du at jeg skal merke det?») ikke
 * regnes som en påstand.
 */
export function paastaarMerking(tekst) {
  return String(tekst ?? '').toLowerCase().split(/[.!?\n]+/).some((s) => {
    if (/hvis du vil|vil du|ønsker du|skal jeg|si fra|kan jeg/.test(s)) return false
    return /\b(merket|markert|merker|markerer|uthevet)\b/.test(s)
  })
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

/**
 * Løs brukerens tema-ønske til en gyldig tema-nøkkel. Modellen (og brukeren)
 * sier «mørkt», «dark mode» eller «vanlige farger» — ikke katalognøkler — så
 * vi matcher først på nøkkel, så på etikett, så på noen norske synonymer.
 * @param {string} onske
 * @param {Array<{key:string,label:string}>} temaer
 * @returns {string|null}
 */
export function losTemaNokkel(onske, temaer) {
  const s = String(onske ?? '').trim().toLowerCase()
  if (!s) return null
  const nokler = new Set(temaer.map((t) => t.key))
  if (nokler.has(s)) return s
  const påEtikett = temaer.find((t) => String(t.label).toLowerCase() === s)
  if (påEtikett) return påEtikett.key
  if (/(mørk|mork|natt|dark)/.test(s) && nokler.has('dark')) return 'dark'
  if (/(lys|standard|vanlig|normal|default|light|dag)/.test(s) && nokler.has('light')) return 'light'
  const delvis = temaer.find((t) => String(t.label).toLowerCase().includes(s) || t.key.includes(s))
  return delvis?.key ?? null
}

/**
 * Løs en liste lag-ønsker («sti», «Høydekurver», «kontur», «hus») til gyldige
 * lag-nøkler. Brukeren og modellen sier etiketter eller omtrentligheter, ikke
 * katalognøkler. Returnerer { nokler, ukjente }.
 */
export function losLagNokler(onsker, lag) {
  const nokler = []
  const ukjente = []
  for (const raa of [].concat(onsker ?? [])) {
    const s = String(raa ?? '').trim().toLowerCase()
    if (!s) continue
    // Etiketter kan ha myk bindestrek (&shy;) for pen orddeling — strip den.
    const rens = (t) => String(t).toLowerCase().replace(/­/g, '')
    const treff = lag.find((l) => l.key === s)
      ?? lag.find((l) => rens(l.label) === s)
      ?? lag.find((l) => rens(l.label).startsWith(s) || l.key.startsWith(s))
      ?? lag.find((l) => rens(l.label).includes(s) || l.key.includes(s))
    if (treff) { if (!nokler.includes(treff.key)) nokler.push(treff.key) }
    else ukjente.push(String(raa))
  }
  return { nokler, ukjente }
}

/**
 * Er meldingen en klar BESTILLING av et bestemt kart-tema? Da byttes temaet
 * deterministisk, uten å gå veien om modellen — den bekrefter av og til et
 * tema-bytte den aldri utførte («Karttema endret til curves.» uten kall).
 *
 * Spørsmål («hvilke temaer finnes?») returnerer null med vilje: der skal
 * modellen svare, med verktøyets liste.
 *
 * @returns {string|null} tema-nøkkel
 */
export function temaOnskeFra(tekst, temaer = listThemes()) {
  const s = String(tekst ?? '').trim().toLowerCase()
  if (!s || /\b(hvilke|hvilken|hva|finnes|list|liste|kan du)\b/.test(s)) return null
  if (!/(bytt|endre|skift|sett|velg|bruk|gå til|ga til|vis meg|vil ha|prøv)/.test(s)) return null
  if (!/(tema|farge|modus|mode|kart)/.test(s) && !/(mørk|mork|lys|sepia|indigo|petrol|mocha|forest|curves|natt)/.test(s)) return null
  // Finn et temanavn i setningen — lengste treff først, så «mono-sepia» ikke
  // taper mot et kortere delstreng-treff.
  const kandidater = []
  for (const t of temaer) {
    for (const ord of [t.key, String(t.label).toLowerCase()]) {
      if (ord && s.includes(ord)) kandidater.push({ key: t.key, len: ord.length })
    }
  }
  if (kandidater.length) {
    kandidater.sort((a, b) => b.len - a.len)
    return kandidater[0].key
  }
  return losTemaNokkel(s, temaer)
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
    case 'merk_i_kartet': return args?.fjern
      ? 'Fjerner markeringen …'
      : `Merker ${args?.navn ? `«${args.navn}»` : 'stedet'} i kartet …`
    case 'bytt_kart_tema': return 'Bytter kart-tema …'
    case 'styr_kartlag': return 'Justerer kartlagene …'
    case 'foreslaa_tur':
    case 'vis_tur_i_3d': return 'Beregner turen …'
    case 'foreslaa_rundtur': return 'Beregner rundtur …'
    default: return `Kjører ${name} …`
  }
}

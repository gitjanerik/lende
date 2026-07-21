// Hydrologiske målestasjoner (NVE HydAPI) som et togglebart kartlag — bygget
// etter samme mønster som fredet-kulturminne-laget (useHeritageLayers). Når
// laget slås på, hentes NVEs aktive stasjoner (cachet per sesjon), filtreres
// til kartutsnittet, og tegnes som blå stasjons-ikoner INNE i kart-SVG-en
// (data-upright → roterer/zoomer/print-trygt). Klikk på et ikon henter siste
// vannføring / vannstand / vanntemperatur og åpner en detalj-skuff med lenke
// til stasjonens side hos NVE (Sildre).
//
// Kallene går gjennom Cloudflare-proxyen (cloudflare/nve-proxy/) som holder
// NVE-nøkkelen server-side, så laget virker i produksjon uten nøkkel i klienten.
// En VITE_NVE_HYDAPI_KEY brukes kun i lokal dev mot NVE direkte.
import { ref } from 'vue'
import { svgToWgs84, wgs84ToSvg } from '../lib/utm.js'
import { fetchStationsForBbox, fetchStationLatest, sildreStationUrl, pickStationInfo } from '../lib/nveHydApi.js'

export function useHydroStations({
  svgHostRef, visibleLayers, meta, applyUprightLabels,
  hydroDetail, hydroLoading, hydroOpen, hydroDrawer,
}) {
  const HYDRO_SIZE_MM = 3.4
  const HYDRO_COLOR = '#38bdf8'      // sky-400 — «blått tema 💦»
  const HYDAPI_KEY = import.meta.env.VITE_NVE_HYDAPI_KEY ?? ''

  const hydroCount = ref(null)       // antall stasjoner i utsnittet — badge
  const hydroLoadingLayer = ref(false)
  let reqSeq = 0        // lag-bygging (applyHydroStationLayer)
  let detailSeq = 0     // detalj-oppslag (openHydroDetailFromEl)
  // stasjons-id → normalisert nedbørfelt/stasjon-info (fra stasjonsobjektet vi
  // allerede har lastet). Fylles ved lag-bygging, leses ved klikk — ingen ekstra
  // API-kall for metadataen.
  const stationInfoById = new Map()

  // WGS84-bbox fra kartets fire hjørner (SVG-meter → WGS84).
  function bboxFromMeta(m) {
    const cs = [
      svgToWgs84(0, 0, m), svgToWgs84(m.widthM, 0, m),
      svgToWgs84(0, m.heightM, m), svgToWgs84(m.widthM, m.heightM, m),
    ]
    let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
    for (const c of cs) {
      if (c.lat < south) south = c.lat
      if (c.lat > north) north = c.lat
      if (c.lon < west) west = c.lon
      if (c.lon > east) east = c.lon
    }
    return { south, west, north, east }
  }

  // Stasjons-ikon: rund blå medaljong med to hvite bølger (vann-nivå). Rund og
  // sentrert i en symmetrisk viewBox — i motsetning til den gamle vanndråpen
  // klippes ingenting bort, og formen leses like godt i alle rotasjoner.
  function ensureHydroDefs(svg) {
    const ns = 'http://www.w3.org/2000/svg'
    if (svg.querySelector('#hydro-sym')) return
    let defs = svg.querySelector('defs')
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild) }
    const sym = document.createElementNS(ns, 'symbol')
    sym.setAttribute('id', 'hydro-sym'); sym.setAttribute('viewBox', '-12 -12 24 24')
    const disc = document.createElementNS(ns, 'circle')
    disc.setAttribute('cx', '0'); disc.setAttribute('cy', '0'); disc.setAttribute('r', '10.5')
    disc.setAttribute('fill', 'currentColor'); disc.setAttribute('stroke', '#0c4a6e'); disc.setAttribute('stroke-width', '2')
    sym.appendChild(disc)
    for (const [y, opacity] of [['-2', '1'], ['3.5', '0.75']]) {
      const wave = document.createElementNS(ns, 'path')
      wave.setAttribute('d', `M-6.5,${y} q3.25,-3.6 6.5,0 t6.5,0`)
      wave.setAttribute('fill', 'none'); wave.setAttribute('stroke', '#fff')
      wave.setAttribute('stroke-width', '2'); wave.setAttribute('stroke-linecap', 'round')
      wave.setAttribute('opacity', opacity)
      sym.appendChild(wave)
    }
    defs.appendChild(sym)
  }

  async function applyHydroStationLayer() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const layer = svg.querySelector('#hydro-layer')
    const on = visibleLayers.value.has('vannstasjon')
    if (!on) { if (layer) layer.style.display = 'none'; return }
    if (layer) { layer.style.display = ''; return }   // allerede bygd
    const m = meta.value
    if (!m) return
    const reqId = ++reqSeq
    hydroLoadingLayer.value = true
    try {
      const bbox = bboxFromMeta(m)
      const stations = await fetchStationsForBbox(bbox, { apiKey: HYDAPI_KEY })
      // Bruker kan ha skrudd av / byttet kart mens vi lastet.
      if (reqId !== reqSeq || !visibleLayers.value.has('vannstasjon')) return
      if (!svgHostRef.value?.querySelector('svg')?.isSameNode(svg)) return
      const ns = 'http://www.w3.org/2000/svg'
      ensureHydroDefs(svg)
      const g = document.createElementNS(ns, 'g')
      g.setAttribute('id', 'hydro-layer'); g.setAttribute('data-layer', 'vannstasjon')
      const half = HYDRO_SIZE_MM / 2
      let placed = 0
      stationInfoById.clear()
      for (const st of stations) {
        const p = wgs84ToSvg(Number(st.latitude), Number(st.longitude), m)
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        // Kun stasjoner som faktisk faller innenfor kart-rektangelet.
        if (p.x < 0 || p.x > m.widthM || p.y < 0 || p.y > m.heightM) continue
        if (st.stationId) stationInfoById.set(st.stationId, pickStationInfo(st))
        const mk = document.createElementNS(ns, 'g')
        mk.setAttribute('data-hydro-station-id', st.stationId || '')
        mk.setAttribute('data-upright', '1')
        if (st.stationName) mk.setAttribute('data-navn', st.stationName)
        if (st.riverName) mk.setAttribute('data-elv', st.riverName)
        if (Number.isFinite(Number(st.masl))) mk.setAttribute('data-masl', String(st.masl))
        mk.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`)
        mk.style.color = HYDRO_COLOR
        mk.style.cursor = 'pointer'
        const use = document.createElementNS(ns, 'use')
        use.setAttribute('href', '#hydro-sym')
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#hydro-sym')
        use.setAttribute('x', `-${half}mm`); use.setAttribute('y', `-${half}mm`)
        use.setAttribute('width', `${HYDRO_SIZE_MM}mm`); use.setAttribute('height', `${HYDRO_SIZE_MM}mm`)
        mk.appendChild(use); g.appendChild(mk); placed++
      }
      hydroCount.value = placed
      svg.appendChild(g)
      applyUprightLabels()
    } finally {
      if (reqId === reqSeq) hydroLoadingLayer.value = false
    }
  }

  // Klikk på et ikon → åpne detalj-skuff og hent siste verdier.
  async function openHydroDetailFromEl(el) {
    const stationId = el.getAttribute('data-hydro-station-id') || null
    const masl = el.getAttribute('data-masl')
    hydroDetail.value = {
      stationId,
      stationName: el.getAttribute('data-navn') || 'Målestasjon',
      riverName: el.getAttribute('data-elv') || null,
      masl: masl != null ? Number(masl) : null,
      link: stationId ? sildreStationUrl(stationId) : null,
      info: (stationId && stationInfoById.get(stationId)) || {},
      discharge: null, waterLevel: null, waterTemp: null,
    }
    hydroOpen.value = true
    hydroDrawer.reset()
    hydroLoading.value = true
    const reqId = ++detailSeq
    try {
      const latest = await fetchStationLatest({ stationId, seriesList: [
        { parameter: 1001 }, { parameter: 1000 }, { parameter: 1003 },
      ] }, { apiKey: HYDAPI_KEY })
      // Skuffen kan være lukket / byttet til en annen stasjon mens vi hentet.
      if (reqId !== detailSeq || hydroDetail.value?.stationId !== stationId) return
      hydroDetail.value = { ...hydroDetail.value, ...latest }
    } catch { /* behold navn/lenke */ }
    finally { if (reqId === detailSeq) hydroLoading.value = false }
  }

  // Badge-teller: antall stasjoner i utsnittet (billig — cachet stasjonsliste).
  async function refreshHydroCount(m) {
    if (!m) { hydroCount.value = null; return }
    try {
      const stations = await fetchStationsForBbox(bboxFromMeta(m), { apiKey: HYDAPI_KEY })
      if (meta.value === m) hydroCount.value = stations.length
    } catch { /* ignorer */ }
  }

  return {
    hydroCount, hydroLoadingLayer,
    applyHydroStationLayer, openHydroDetailFromEl, refreshHydroCount,
  }
}

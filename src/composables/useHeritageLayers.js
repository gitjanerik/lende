// Fredet-kulturminne-vektorlag (Geonorge WFS) + runtime-fallback for
// brukerminne-laget — skilt ut fra MapView v1.0.8 (kode uendret). Composablen
// eier fredet-tellerne og render-funksjonene; forelderen eier fortsatt
// kart-SVG-en (svgHostRef), lag-togglingen og kulturminne-skuffens tilstand,
// som kommer inn destrukturert.
import { ref } from 'vue'
import { svgToWgs84, wgs84ToSvg } from '../lib/utm.js'
import { fetchFredaKulturminner, fetchFredaCount, clusterByMinMeters } from '../lib/kulturminneWfs.js'
import { fetchKulturminner } from '../lib/kulturminneFetcher.js'
import { cacheGet, cacheSet, kulturminneBboxKey, fredetKulturminneBboxKey, TTL } from '../lib/protectedAreaCache.js'
import { isomCatalog, buildPointSymbolDef } from '../lib/symbolizer.js'

export function useHeritageLayers({
  svgHostRef, visibleLayers, meta, applyUprightLabels, kulturminneCount,
  kulturminneDetail, kulturminneLoading, kulturminneOpen, kulturminneDrawer,
}) {
  // Offisielle fredede kulturminner (Riksantikvaren/Askeladden) som EKTE VEKTOR
  // via Geonorge WFS (se kulturminneWfs.js — erstattet et tidligere WMS-raster-
  // forsøk). Lokalitetene hentes live når laget slås på, klynges, og tegnes som
  // egne diamant-ikoner INNE i kart-SVG-en (data-upright → roterer/zoomer/print-
  // trygt). Farge pr vernetype. Klikk → detalj-skuff fra data-attributter + lenke.
  const FREDET_SIZE_MM = 3.2
  const FREDET_KAT_COLOR = {
    automatisk: '#8e44ad', forskrift: '#c0392b', vedtak: '#d35400',
    listefort: '#138d75', annet: '#7f8c8d',
  }
  const fredetCount = ref(null)     // antall lokaliteter i bbox (WFS) — badge
  const fredetLoading = ref(false)
  let fredetReqId = 0

  // WGS84-bbox fra kartets fire hjørner (SVG-meter → WGS84) til WFS-spørring.
  function fredetBboxFromMeta(m) {
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

  function ensureFredetDefs(svg) {
    const ns = 'http://www.w3.org/2000/svg'
    if (svg.querySelector('#fredet-km-sym')) return
    let defs = svg.querySelector('defs')
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild) }
    const sym = document.createElementNS(ns, 'symbol')
    sym.setAttribute('id', 'fredet-km-sym'); sym.setAttribute('viewBox', '-1 -1 2 2')
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M0,-0.85 L0.85,0 L0,0.85 L-0.85,0 Z')
    path.setAttribute('fill', 'currentColor'); path.setAttribute('stroke', '#2b2b2b'); path.setAttribute('stroke-width', '0.12')
    const dot = document.createElementNS(ns, 'circle')
    dot.setAttribute('cx', '0'); dot.setAttribute('cy', '0'); dot.setAttribute('r', '0.24'); dot.setAttribute('fill', '#fff')
    sym.appendChild(path); sym.appendChild(dot); defs.appendChild(sym)
  }

  async function applyFredetKulturminneLayer() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const layer = svg.querySelector('#fredet-km-layer')
    const on = visibleLayers.value.has('fredet-kulturminne')
    if (!on) { if (layer) layer.style.display = 'none'; return }
    if (layer) { layer.style.display = ''; return }   // allerede bygd
    const m = meta.value
    if (!m) return
    const reqId = ++fredetReqId
    fredetLoading.value = true
    try {
      const bbox = fredetBboxFromMeta(m)
      const key = fredetKulturminneBboxKey(bbox)
      let data = await cacheGet(key)
      if (!Array.isArray(data)) {
        data = await fetchFredaKulturminner(bbox)
        if (data.length) cacheSet(key, data, TTL.kulturminne)
      }
      // Bruker kan ha skrudd av / byttet kart mens vi lastet.
      if (reqId !== fredetReqId || !visibleLayers.value.has('fredet-kulturminne')) return
      if (!svgHostRef.value?.querySelector('svg')?.isSameNode(svg)) return
      fredetCount.value = data.length
      const ns = 'http://www.w3.org/2000/svg'
      ensureFredetDefs(svg)
      const g = document.createElementNS(ns, 'g')
      g.setAttribute('id', 'fredet-km-layer'); g.setAttribute('data-layer', 'fredet-kulturminne')
      const half = FREDET_SIZE_MM / 2
      for (const it of clusterByMinMeters(data, 25)) {
        const p = wgs84ToSvg(it.lat, it.lon, m)
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        const mk = document.createElementNS(ns, 'g')
        mk.setAttribute('data-fredet-id', it.id || '')
        mk.setAttribute('data-kat', it.kategori || 'annet')
        mk.setAttribute('data-upright', '1')
        if (it.navn) mk.setAttribute('data-navn', it.navn)
        if (it.vernetype) mk.setAttribute('data-vernetype', it.vernetype)
        if (it.kategoriLabel) mk.setAttribute('data-kategori-label', it.kategoriLabel)
        if (it.opphav) mk.setAttribute('data-opphav', it.opphav)
        if (it.noyaktighetM) mk.setAttribute('data-noyaktighet', String(it.noyaktighetM))
        if (it.informasjon) mk.setAttribute('data-informasjon', it.informasjon)
        if (it.lokalitetInfo) mk.setAttribute('data-lokinfo', it.lokalitetInfo)
        if (it.kommune) mk.setAttribute('data-kommune', it.kommune)
        if (it.link) mk.setAttribute('data-link', it.link)
        mk.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`)
        mk.style.color = FREDET_KAT_COLOR[it.kategori] || FREDET_KAT_COLOR.annet
        mk.style.cursor = 'pointer'
        const use = document.createElementNS(ns, 'use')
        use.setAttribute('href', '#fredet-km-sym')
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#fredet-km-sym')
        use.setAttribute('x', `-${half}mm`); use.setAttribute('y', `-${half}mm`)
        use.setAttribute('width', `${FREDET_SIZE_MM}mm`); use.setAttribute('height', `${FREDET_SIZE_MM}mm`)
        mk.appendChild(use); g.appendChild(mk)
      }
      // Legg laget øverst. (Tidligere insertBefore(svg.querySelector('[data-label]'))
      // KRÆSJET: første [data-label] er en NESTet node (f.eks. kontur-tall inne i
      // data-layer=kontur), ikke et direkte svg-barn → insertBefore kaster
      // NotFoundError og laget ble aldri satt inn. appendChild er robust.)
      svg.appendChild(g)
      applyUprightLabels()   // orienter de nye data-upright-markørene til kart-rotasjonen
    } finally {
      if (reqId === fredetReqId) fredetLoading.value = false
    }
  }

  // Runtime-fallback for brukerminne-laget: hvis kartet IKKE har innbakte
  // brukerminne-ikoner (typisk fordi bygge-tids-hentingen mot api.ra.no glapp på
  // mobil — se v12.1.45), men laget er på, henter vi dem live og injiserer (samme
  // mønster som fredet-laget). Desktop med innbakte ikoner røres ikke.
  let kmFallbackReqId = 0
  function ensureKulturminneSymbolDef(svg) {
    if (svg.querySelector('#iso-sym-kulturminne')) return
    const spec = isomCatalog.pointSymbols?.kulturminne
    if (!spec) return
    const ns = 'http://www.w3.org/2000/svg'
    let defs = svg.querySelector('defs')
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild) }
    const symStr = buildPointSymbolDef('iso-sym-kulturminne', spec)
    const parsed = new DOMParser().parseFromString(`<svg xmlns="${ns}">${symStr}</svg>`, 'image/svg+xml')
    const sym = parsed.querySelector('symbol')
    if (sym) defs.appendChild(document.importNode(sym, true))
  }
  async function applyKulturminneFallback() {
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svg || !m || !visibleLayers.value.has('kulturminne')) return
    // Har kartet allerede brukerminne-ikoner (innbakt) eller et fallback-lag? Da ingenting.
    if (svg.querySelector('[data-kulturminne-id]') || svg.querySelector('#km-fallback-layer')) return
    const reqId = ++kmFallbackReqId
    try {
      const bbox = m.bbox || fredetBboxFromMeta(m)
      const key = kulturminneBboxKey(bbox)
      let data = await cacheGet(key)
      if (!Array.isArray(data)) {
        data = await fetchKulturminner(bbox)
        if (data.length) cacheSet(key, data, TTL.kulturminne)
      }
      if (reqId !== kmFallbackReqId || !visibleLayers.value.has('kulturminne')) return
      if (!svgHostRef.value?.querySelector('svg')?.isSameNode(svg)) return
      if (!data.length || svg.querySelector('[data-kulturminne-id]')) return
      ensureKulturminneSymbolDef(svg)
      const ns = 'http://www.w3.org/2000/svg'
      const g = document.createElementNS(ns, 'g')
      g.setAttribute('id', 'km-fallback-layer'); g.setAttribute('data-layer', 'kulturminne')
      const size = 3.6, half = size / 2
      for (const it of clusterByMinMeters(data, 30)) {
        const p = wgs84ToSvg(it.lat, it.lon, m)
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        const mk = document.createElementNS(ns, 'g')
        mk.setAttribute('data-kulturminne-id', it.id || '')
        mk.setAttribute('data-kat', it.kategori || 'annet')
        if (it.tittel) mk.setAttribute('data-tittel', it.tittel)
        mk.setAttribute('data-upright', '1')
        mk.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`)
        const use = document.createElementNS(ns, 'use')
        use.setAttribute('href', '#iso-sym-kulturminne')
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#iso-sym-kulturminne')
        use.setAttribute('x', `-${half}mm`); use.setAttribute('y', `-${half}mm`)
        use.setAttribute('width', `${size}mm`); use.setAttribute('height', `${size}mm`)
        mk.appendChild(use); g.appendChild(mk)
      }
      svg.appendChild(g)
      kulturminneCount.value = data.length
      applyUprightLabels()
    } catch (e) { console.warn('[Kulturminne] runtime-fallback feilet:', e?.message ?? e) }
  }

  // Detalj-skuff for et fredet-kulturminne (leser data-attributter fra ikonet).
  function openFredetDetailFromEl(el) {
    const link = el.getAttribute('data-link') || null
    const noyaktighet = Number(el.getAttribute('data-noyaktighet'))
    kulturminneDetail.value = {
      id: null, kategori: 'annet',
      tittel: el.getAttribute('data-navn') || 'Fredet kulturminne',
      kategoriLabel: el.getAttribute('data-kategori-label') || null,
      vernestatus: el.getAttribute('data-vernetype') || 'Fredet kulturminne',
      beskrivelse: el.getAttribute('data-informasjon') || '',
      lokalitetInfo: el.getAttribute('data-lokinfo') || null,
      kommune: el.getAttribute('data-kommune'), fylke: null,
      opprettetAv: el.getAttribute('data-opphav') || null,
      noyaktighetM: Number.isFinite(noyaktighet) && noyaktighet > 0 ? noyaktighet : null,
      link, bilder: [],
    }
    kulturminneLoading.value = false
    kulturminneOpen.value = true
    kulturminneDrawer.reset()
  }

  // Rask antall-teller (WFS hits) for badgen — kalles når kartet er lastet.
  async function refreshFredetCount(m) {
    if (!m) return
    try {
      const n = await fetchFredaCount(fredetBboxFromMeta(m))
      if (meta.value === m && n != null) fredetCount.value = n
    } catch { /* ignorer */ }
  }

  return {
    fredetCount, fredetLoading,
    applyFredetKulturminneLayer, applyKulturminneFallback,
    openFredetDetailFromEl, refreshFredetCount,
  }
}

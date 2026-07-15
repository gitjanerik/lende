// Symbol-/overlay-rendererne — skilt ut fra MapView v1.0.10 (kode uendret).
// Familien av imperative SVG-renderere som tegner klient-lag oppå kartet:
// søke-highlight, nærhetsvarsel-markør, måling, stifinner-ruter, annoteringer
// (inkl. animert stedsmerke), opp-rettede etiketter, GPS-spor og bruker-
// prikken — pluss pxToUserUnits som holder dem i konstant skjermstørrelse.
// Forelderen eier SVG-verten og all tilstand (destrukturert inn); watchene
// som kaller rendererne ligger fortsatt i MapView.
import { isomCatalog, buildPointSymbolDef } from '../lib/symbolizer.js'
import { polylineToPath } from '../lib/pathUtils.js'
import {
  STEDSMERKE_KEY_TIMES, STEDSMERKE_DUR, STEDSMERKE_SHADOW_OPACITY,
  PIN_SCALE_VALUES, SHADOW_SCALE_VALUES,
  pinTranslateValues, randomBegin, pinPath,
} from '../lib/stedsmerkeAnimation.js'
import { ANNOTATION_SYMBOLS } from './useMapAnnotations.js'

export function useSymbolRenderers({
  svgHostRef, wrapperRef, wrapperSize, scale, rotation,
  highlightedFeature, proximity,
  measureVertices, measureClosed,
  sti, onSelectRoute, annot, tracker, userPos, compass,
}) {
  // Pulsering tegnes som SVG-circle i et eget overlay-lag, lik annoteringer.
  // Holder konstant skjerm-størrelse ved å konvertere CSS-px til user-units via
  // scale.value.
  function renderHighlight() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const ns = 'http://www.w3.org/2000/svg'
    let layer = svg.querySelector('#search-highlight-layer')
    const h = highlightedFeature.value
    if (!h) {
      if (layer) layer.remove()
      return
    }
    if (!layer) {
      layer = document.createElementNS(ns, 'g')
      layer.setAttribute('id', 'search-highlight-layer')
      layer.setAttribute('data-layer', 'search-highlight')
      layer.setAttribute('pointer-events', 'none')
      svg.appendChild(layer)
    }
    layer.replaceChildren()
    const r1 = pxToUserUnits(18)
    const r2 = pxToUserUnits(34)
    const sw = pxToUserUnits(2.5)

    // Indre ring — solid stroke, sterk farge
    const inner = document.createElementNS(ns, 'circle')
    inner.setAttribute('cx', h.x); inner.setAttribute('cy', h.y)
    inner.setAttribute('r', r1)
    inner.setAttribute('fill', 'rgba(244, 114, 182, 0.18)')
    inner.setAttribute('stroke', '#f472b6')
    inner.setAttribute('stroke-width', String(sw))
    layer.appendChild(inner)

    // Ytre puls-ring — SMIL-animasjon, ekspanderer + fader
    const pulse = document.createElementNS(ns, 'circle')
    pulse.setAttribute('cx', h.x); pulse.setAttribute('cy', h.y)
    pulse.setAttribute('r', String(r1))
    pulse.setAttribute('fill', 'none')
    pulse.setAttribute('stroke', '#f472b6')
    pulse.setAttribute('stroke-width', String(sw))
    pulse.setAttribute('opacity', '0.8')
    const anR = document.createElementNS(ns, 'animate')
    anR.setAttribute('attributeName', 'r')
    anR.setAttribute('values', `${r1};${r2}`)
    anR.setAttribute('dur', '1.4s')
    anR.setAttribute('repeatCount', 'indefinite')
    pulse.appendChild(anR)
    const anO = document.createElementNS(ns, 'animate')
    anO.setAttribute('attributeName', 'opacity')
    anO.setAttribute('values', '0.85;0')
    anO.setAttribute('dur', '1.4s')
    anO.setAttribute('repeatCount', 'indefinite')
    pulse.appendChild(anO)
    layer.appendChild(pulse)
  }

  // Mål-markør for et aktivt nærhetsvarsel: en fast-skjerm-størrelse pin pluss
  // en sirkel som viser den ekte utløsnings-radiusen (i meter = user-units).
  function renderProximityTarget() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const ns = 'http://www.w3.org/2000/svg'
    let layer = svg.querySelector('#proximity-layer')
    const a = proximity.active.value
    if (!a) {
      if (layer) layer.remove()
      return
    }
    if (!layer) {
      layer = document.createElementNS(ns, 'g')
      layer.setAttribute('id', 'proximity-layer')
      layer.setAttribute('data-layer', 'proximity')
      layer.setAttribute('pointer-events', 'none')
      svg.appendChild(layer)
    }
    layer.replaceChildren()
    const sw = pxToUserUnits(2)
    const dot = pxToUserUnits(5)

    // Utløsnings-radius i ekte meter
    const radius = document.createElementNS(ns, 'circle')
    radius.setAttribute('cx', a.svgX); radius.setAttribute('cy', a.svgY)
    radius.setAttribute('r', String(a.distanceM))
    radius.setAttribute('fill', 'rgba(56, 189, 248, 0.12)')
    radius.setAttribute('stroke', '#38bdf8')
    radius.setAttribute('stroke-width', String(sw))
    radius.setAttribute('stroke-dasharray', `${pxToUserUnits(4)} ${pxToUserUnits(4)}`)
    layer.appendChild(radius)

    // Senter-prikk (fast skjermstørrelse)
    const center = document.createElementNS(ns, 'circle')
    center.setAttribute('cx', a.svgX); center.setAttribute('cy', a.svgY)
    center.setAttribute('r', String(dot))
    center.setAttribute('fill', '#0284c7')
    center.setAttribute('stroke', '#ffffff')
    center.setAttribute('stroke-width', String(pxToUserUnits(1.5)))
    layer.appendChild(center)
  }

  /**
   * Konverter CSS-piksler til SVG user-units. Brukes til å holde symboler
   * (annoterings-ikoner, GPS-prikk) på konstant skjerm-størrelse uansett zoom.
   *
   * v8.9.2: tidligere brukte vi svg.getBoundingClientRect() som inkluderer CSS-
   * transformer. Det ga en subtil bug: når man tappet «Nullstill zoom» midt
   * under en pinch-transition, returnerte rect-en mid-animasjons-verdier — vi
   * malte stedsmerker basert på rect ved scale=20 selv om scale-ref var 1,
   * og så ble pin-ene ekstremt små etter at animasjonen var ferdig.
   *
   * Nå bruker vi wrapperSize (fast container målt på mount/resize) + scale.value
   * (mål-skala fra pinch-state) som er garantert konsistent uansett om CSS-
   * transitionen er ferdig eller ikke.
   */
  function pxToUserUnits(cssPx) {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return cssPx
    const vb = svg.viewBox.baseVal
    // v11.0.31: mål wrapperen LIVE i stedet for det snapshot-ede wrapperSize.
    // wrapperRef har ingen CSS-transform (pinch-transformen ligger på det indre
    // mapInnerRef), så rect-en er alltid den ekte viewport-størrelsen — upåvirket
    // av pinch/anim, så v8.9.2-fellen (mid-animasjons-rect) gjelder ikke her.
    // Snapshot-et kunne fryse en for-tidlig / for liten måling på iOS Safari der
    // resize-eventet ikke fyrer etter at layouten settler eller toolbaren skjuler
    // seg; da ble pxPerUnit altfor liten og alle skjerm-låste symboler (GPS-prikk,
    // accuracy-ring, annoterings-ikoner) ballong-blåste til halve skjermen.
    const r = wrapperRef.value?.getBoundingClientRect()
    const w = r?.width || wrapperSize.value.w
    const h = r?.height || wrapperSize.value.h
    if (!w || !h || !vb.width || !vb.height) return cssPx
    // SVG fits-with-meet til wrapperen: minste dim bestemmer pxPerUnit
    const fitPxPerUnit = Math.min(w / vb.width, h / vb.height)
    const pxPerUnit = fitPxPerUnit * (scale.value || 1)
    if (!pxPerUnit) return cssPx
    return cssPx / pxPerUnit
  }

  function renderMeasure() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const ns = 'http://www.w3.org/2000/svg'
    let layer = svg.querySelector('#measure-layer')
    if (!layer) {
      layer = document.createElementNS(ns, 'g')
      layer.setAttribute('id', 'measure-layer')
      layer.setAttribute('data-layer', 'maaling')
      layer.setAttribute('pointer-events', 'none')
      svg.appendChild(layer)
    }
    layer.replaceChildren()
    const v = measureVertices.value
    if (!v.length) return

    // Stroke-widths: paths inne i [data-layer] arver vector-effect:
    // non-scaling-stroke fra global SVG-CSS (symbolizer.js linje 394). Det
    // betyr at stroke-width tolkes i CSS-px, ikke i user-units — så
    // pxToUserUnits ville gjort linjene ~10× for tykke (v8.9.5).
    // For å holde konstant skjerm-tykkelse under pinch-zoom: del på scale.
    const s = scale.value || 1
    const haloW = 6 / s
    const lineW = 2.5 / s
    // Vertices er circles, IKKE paths — de arver ikke non-scaling-stroke,
    // så radius må fortsatt konverteres via pxToUserUnits.
    const vertR = pxToUserUnits(4)

    // Areal-polygon (fill) hvis lukket
    if (measureClosed.value && v.length >= 3) {
      const ptsAttr = v.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      const poly = document.createElementNS(ns, 'polygon')
      poly.setAttribute('points', ptsAttr)
      poly.setAttribute('fill', 'rgba(34, 197, 94, 0.22)')
      poly.setAttribute('stroke', 'none')
      layer.appendChild(poly)
    }

    // To-lags polyline: hvit halo + grønn linje
    if (v.length >= 2) {
      let d = `M${v[0].x.toFixed(1)},${v[0].y.toFixed(1)}`
      for (let i = 1; i < v.length; i++) d += ` L${v[i].x.toFixed(1)},${v[i].y.toFixed(1)}`
      if (measureClosed.value) d += ' Z'
      const halo = document.createElementNS(ns, 'path')
      halo.setAttribute('d', d); halo.setAttribute('fill', 'none')
      halo.setAttribute('stroke', 'rgba(255,255,255,0.9)')
      halo.setAttribute('stroke-width', String(haloW))
      halo.setAttribute('stroke-linecap', 'round')
      halo.setAttribute('stroke-linejoin', 'round')
      layer.appendChild(halo)
      const line = document.createElementNS(ns, 'path')
      line.setAttribute('d', d); line.setAttribute('fill', 'none')
      line.setAttribute('stroke', '#16a34a')
      line.setAttribute('stroke-width', String(lineW))
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('stroke-linejoin', 'round')
      layer.appendChild(line)
    }

    // Vertices (circles — får ikke non-scaling-stroke fra CSS-regelen som
    // kun matcher `path`, så vi gir dem den eksplisitt for å unngå at
    // strok-bredden vokser ved zoom inn).
    for (let i = 0; i < v.length; i++) {
      const c = document.createElementNS(ns, 'circle')
      c.setAttribute('cx', v[i].x); c.setAttribute('cy', v[i].y)
      c.setAttribute('r', vertR)
      c.setAttribute('fill', '#16a34a')
      c.setAttribute('stroke', '#fff')
      c.setAttribute('stroke-width', String(1.5 / s))
      c.setAttribute('vector-effect', 'non-scaling-stroke')
      layer.appendChild(c)
    }
  }

  // Stifinner-overlay: 1–3 fargede ruter + start/mål-markører + connector-
  // strek fra valgt punkt til snappet sti-node. Tegnes i et eget <g> på SVG-en
  // (mønster fra renderMeasure). Stroke-bredder deles på scale for konstant
  // skjerm-tykkelse. Valgt rute er kraftig; øvrige dempet og tynnere.
  const ROUTE_COLORS = ['#dc2626', '#7c3aed', '#0891b2'] // rød, lilla, cyan
  function renderRoutes() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const ns = 'http://www.w3.org/2000/svg'
    let layer = svg.querySelector('#stifinner-layer')
    if (!layer) {
      layer = document.createElementNS(ns, 'g')
      layer.setAttribute('id', 'stifinner-layer')
      layer.setAttribute('data-layer', 'stifinner')
      svg.appendChild(layer)
    }
    layer.replaceChildren()
    // Tegn i både 'showing' og 'pickingVia' (behold ruten synlig mens brukeren
    // sikter et nytt via-punkt).
    if (sti.mode.value !== 'showing' && sti.mode.value !== 'pickingVia') return

    const s = scale.value || 1
    const mk = (d, stroke, width, opts = {}) => {
      const p = document.createElementNS(ns, 'path')
      p.setAttribute('d', d)
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke', stroke)
      p.setAttribute('stroke-width', String(width / s))
      p.setAttribute('stroke-linecap', 'round')
      p.setAttribute('stroke-linejoin', 'round')
      if (opts.dash) p.setAttribute('stroke-dasharray', `${opts.dash / s} ${opts.dash / s}`)
      if (opts.opacity != null) p.setAttribute('opacity', String(opts.opacity))
      if (opts.pe) p.setAttribute('pointer-events', opts.pe)
      return p
    }

    // Connector-strek (valgt punkt → snappet node). Stiplet grå. Ved rundtur er
    // start == mål (samme origo), så mål-connectoren droppes (den overlapper).
    const a = sti.start.value, b = sti.destination.value
    const aSnap = sti.startSnap.value, bSnap = sti.destSnap.value
    if (a && aSnap) layer.appendChild(mk(`M${a.svgX},${a.svgY}L${aSnap.x},${aSnap.y}`, '#64748b', 1.5, { dash: 3, pe: 'none' }))
    if (!sti.isLoop.value && b && bSnap) layer.appendChild(mk(`M${b.svgX},${b.svgY}L${bSnap.x},${bSnap.y}`, '#64748b', 1.5, { dash: 3, pe: 'none' }))
    const viaPts = sti.via.value, viaSnapArr = sti.viaSnaps.value
    for (let i = 0; i < viaPts.length; i++) {
      const v = viaPts[i], vs = viaSnapArr[i]
      if (v && vs) layer.appendChild(mk(`M${v.svgX},${v.svgY}L${vs.x},${vs.y}`, '#64748b', 1.5, { dash: 3, pe: 'none' }))
    }

    // Tegn ikke-valgte ruter først (under), valgt rute øverst.
    const order = sti.routes.value.map((_, i) => i)
      .sort((i, j) => (i === sti.selectedRouteIdx.value ? 1 : 0) - (j === sti.selectedRouteIdx.value ? 1 : 0))
    for (const i of order) {
      const r = sti.routes.value[i]
      const d = polylineToPath(r.coordinates, false)
      const selected = i === sti.selectedRouteIdx.value
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length]
      // Hvit halo
      layer.appendChild(mk(d, 'rgba(255,255,255,0.9)', selected ? 7 : 5, { pe: 'none', opacity: selected ? 1 : 0.6 }))
      // Farget linje
      layer.appendChild(mk(d, color, selected ? 3.5 : 2.2, { pe: 'none', opacity: selected ? 1 : 0.55 }))
      // Bred usynlig hit-path for lett tapp-treff
      const hit = mk(d, 'transparent', 16, { pe: 'stroke' })
      hit.style.cursor = 'pointer'
      hit.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectRoute(i) })
      layer.appendChild(hit)
    }

    // Start (A, grønn) og mål (B, rød) markører.
    const dot = (x, y, fill) => {
      const c = document.createElementNS(ns, 'circle')
      c.setAttribute('cx', x); c.setAttribute('cy', y)
      c.setAttribute('r', String(pxToUserUnits(6)))
      c.setAttribute('fill', fill)
      c.setAttribute('stroke', '#fff')
      c.setAttribute('stroke-width', String(2 / s))
      c.setAttribute('pointer-events', 'none')
      return c
    }
    if (a) layer.appendChild(dot(a.svgX, a.svgY, '#16a34a'))
    for (const v of viaPts) if (v) layer.appendChild(dot(v.svgX, v.svgY, '#f59e0b'))
    // Ved rundtur er mål == origo (grønn prikk allerede tegnet) → ingen egen rød.
    if (!sti.isLoop.value && b) layer.appendChild(dot(b.svgX, b.svgY, '#dc2626'))
  }

  // Sørg for at annoterings-symbolenes <symbol id="iso-sym-X"> finnes i kart-
  // SVG-ens <defs>. Nødvendig fordi mapBuilder (v9.1.10+) kun emitterer defs
  // for symboler som faktisk BRUKES av auto-features i body — annoterings-
  // symboler (knaus/stein/brønn/bro) plasseres klient-side og er typisk ikke
  // auto-brukt, så <use href="#iso-sym-knaus"> fant ingenting (kun stedsmerke,
  // som har egen custom-rendering, virket). Vi injiserer de manglende defs-ene
  // fra katalogen. Stedsmerke hoppes over (rendres via appendStedsmerkeSymbol).
  function ensureAnnotationDefs(svg) {
    const ns = 'http://www.w3.org/2000/svg'
    let defs = svg.querySelector('defs')
    if (!defs) {
      defs = document.createElementNS(ns, 'defs')
      svg.insertBefore(defs, svg.firstChild)
    }
    for (const s of ANNOTATION_SYMBOLS) {
      if (s.symbolKey === 'stedsmerke') continue
      const id = `iso-sym-${s.symbolKey}`
      if (svg.querySelector(`[id="${id}"]`)) continue
      const spec = isomCatalog.pointSymbols?.[s.symbolKey]
      if (!spec) continue
      const parsed = new DOMParser().parseFromString(
        `<svg xmlns="${ns}">${buildPointSymbolDef(id, spec)}</svg>`, 'image/svg+xml')
      const symEl = parsed.querySelector('symbol')
      if (symEl) defs.appendChild(document.importNode(symEl, true))
    }
  }

  function renderAnnotations() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    ensureAnnotationDefs(svg)
    const ns = 'http://www.w3.org/2000/svg'
    const xlink = 'http://www.w3.org/1999/xlink'
    let layer = svg.querySelector('#annotation-layer')
    if (!layer) {
      layer = document.createElementNS(ns, 'g')
      layer.setAttribute('id', 'annotation-layer')
      layer.setAttribute('data-layer', 'annotering')
      layer.setAttribute('pointer-events', 'none')
      svg.appendChild(layer)
    }
    layer.replaceChildren()

    // Symbol-størrelse: ~32 CSS px på skjerm uansett zoom-nivå. ISOM-print-
    // størrelse (1.5–2 mm = 6–7.5 px) er usynlig på telefon ved standard
    // kart-zoom (5 km bbox i ~380 px container → 1 m ≈ 0.076 CSS px).
    // pxToUserUnits konverterer ønsket skjerm-px til user-units (meter)
    // basert på faktisk getBoundingClientRect — inkluderer pinch-zoom CSS-
    // transform så symbolet holder konstant skjerm-størrelse.
    const SYMBOL_M = pxToUserUnits(32)
    const HALF = SYMBOL_M / 2

    for (const a of annot.annotations.value) {
      if (a.type !== 'point') continue
      const sym = ANNOTATION_SYMBOLS.find(s => s.code === a.isomCode)
      if (!sym) continue
      // Per-type synlighet (drawer-laget «Annoteringer»). Når brukeren skjuler
      // f.eks. alle «Knaus» beholdes annotasjonen i lagring men ikke rendres.
      if (!annot.visibleTypes.value.has(sym.symbolKey)) continue

      const g = document.createElementNS(ns, 'g')
      // Stedsmerke (rød dråpe-pin) og stedsnavn skal alltid vises «opp» på
      // skjermen selv om kartet er rotert. Counter-rotate g-en med samme
      // mengde som kartets rotasjon, rundt anker-punktet (som nå er (0,0)
      // etter translate). applyUprightLabels() oppdaterer transformen ved
      // hver rotasjons-endring uten å re-rendre noden (v8.9.3).
      if (sym.symbolKey === 'stedsmerke') {
        g.setAttribute('transform', `translate(${a.x},${a.y}) rotate(${-rotation.value})`)
      } else {
        g.setAttribute('transform', `translate(${a.x},${a.y})`)
      }
      g.setAttribute('data-annot-id', a.id)
      g.setAttribute('data-annot-type', sym.symbolKey)

      // Lys ring (lilla) bak symbolet er et editor-hint som vises kun mens
      // brukeren er i annoteringsmodus. Når modusen lukkes (deselect i
      // drawer) forsvinner ringen og symbolet rendres «rent» som på print.
      if (annot.isAnnotateMode.value) {
        const halo = document.createElementNS(ns, 'circle')
        halo.setAttribute('cx', '0')
        halo.setAttribute('cy', '0')
        halo.setAttribute('r', String(HALF * 0.95))
        halo.setAttribute('fill', '#fffef0')
        halo.setAttribute('fill-opacity', '0.9')
        halo.setAttribute('stroke', '#7a3aa3')
        halo.setAttribute('stroke-width', '2')
        halo.setAttribute('vector-effect', 'non-scaling-stroke')
        g.appendChild(halo)
      }

      if (sym.symbolKey === 'stedsmerke') {
        // I annoteringsmodus tegnes pin-en statisk (brukeren plasserer/
        // justerer — animasjon ville vært forstyrrende). Når kartet
        // gjenåpnes fra lagring rendres med squash & stretch hver 5s, med
        // tilfeldig pre-roll pr instans så ikke alle spretter i takt.
        // (Spillmodus skjules tidligere via early return ovenfor.)
        appendStedsmerkeSymbol(g, HALF, !annot.isAnnotateMode.value)
      } else {
        const use = document.createElementNS(ns, 'use')
        const href = `#iso-sym-${sym.symbolKey}`
        use.setAttribute('href', href)
        use.setAttributeNS(xlink, 'xlink:href', href)
        use.setAttribute('x', String(-HALF))
        use.setAttribute('y', String(-HALF))
        use.setAttribute('width', String(SYMBOL_M))
        use.setAttribute('height', String(SYMBOL_M))
        g.appendChild(use)
      }

      layer.appendChild(g)
    }
  }

  /**
   * Bygg Stedsmerke-symbolet inn i en eksisterende g-node.
   * - s        = halv symbol-bredde (user-units, ~16 CSS-px på skjerm)
   * - animated = true → squash & stretch + random pre-roll. false → ren hvile-
   *              positur (brukes i annoteringsmodus mens brukeren plasserer)
   * - parent g er allerede translate-positionert til annotasjonens (x,y)
   *
   * Visuell design: klassisk rød dråpe-pin med hvit prikk og halvgjennom-
   * siktig skygge under. Pin-tip-en peker presist på annotasjonens (x, y) —
   * pin-en strekker seg oppover derfra. SMIL — ingen JS-timer.
   *
   * Animasjonen er nestet g-er: ytterste plasserer pin-tip-en, midtre
   * animerer translate Y (sprett), innerste animerer scale (squash &
   * stretch). `animateTransform type` må være translate eller scale —
   * `type="matrix"` finnes IKKE i SVG SMIL.
   */
  function appendStedsmerkeSymbol(parent, s, animated) {
    const ns = 'http://www.w3.org/2000/svg'
    const mk = (tag, attrs) => {
      const el = document.createElementNS(ns, tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      return el
    }

    // s = half-symbol-bredde. Pin head-radius på 0.55*s gir kompakt pin
    // som passer i symbol-boksen uten å dominere kartet.
    const r = s * 0.55
    const shadowRx = r
    const shadowRy = r * 0.22
    const shadowPy = r * 0.18  // Like under pin-tip-en (annotasjonspunktet).

    // Skygge: outer g plasserer + skalerer til ønsket størrelse.
    const shadowOuter = mk('g', {
      transform: `translate(0 ${shadowPy}) scale(${shadowRx} ${shadowRy})`,
    })
    const shadowEl = mk('ellipse', {
      cx: '0', cy: '0', rx: '1', ry: '1',
      fill: '#000', opacity: '0.55',
    })

    // Pin: outer g (rest-pos er allerede annotasjonspunkt, så ingen translate).
    // v9.1.1: ingen border — pin-en er en ren rød silhuett (samme stil som
    // parkering-P). Tidligere mørkerød kontur dempet hodets distinkte form.
    const pinPosG = mk('g', {})
    const pinPathEl = mk('path', {
      d: pinPath(r),
      fill: '#dc2626',
    })
    const pinDotEl = mk('circle', {
      cx: '0', cy: String(-1.85 * r), r: String(r * 0.38),
      fill: '#fff',
    })

    if (!animated) {
      // Statisk: ingen sprett, ingen scale, ingen random offset.
      shadowOuter.appendChild(shadowEl)
      pinPosG.appendChild(pinPathEl)
      pinPosG.appendChild(pinDotEl)
      parent.appendChild(shadowOuter)
      parent.appendChild(pinPosG)
      return
    }

    // Animert: shadow får inner-g for scale, pin får mid-g for translate
    // og inner-g for scale. Felles random begin på alle 4 animatorer.
    const begin = randomBegin()

    const shadowAnim = mk('g', {})
    shadowAnim.appendChild(mk('animateTransform', {
      attributeName: 'transform', type: 'scale',
      values: SHADOW_SCALE_VALUES, keyTimes: STEDSMERKE_KEY_TIMES,
      dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
    }))
    shadowEl.appendChild(mk('animate', {
      attributeName: 'opacity',
      values: STEDSMERKE_SHADOW_OPACITY,
      keyTimes: STEDSMERKE_KEY_TIMES,
      dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
    }))
    shadowAnim.appendChild(shadowEl)
    shadowOuter.appendChild(shadowAnim)
    parent.appendChild(shadowOuter)

    const pinTranslateG = mk('g', {})
    pinTranslateG.appendChild(mk('animateTransform', {
      attributeName: 'transform', type: 'translate',
      values: pinTranslateValues(r), keyTimes: STEDSMERKE_KEY_TIMES,
      dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
    }))
    const pinScaleG = mk('g', {})
    pinScaleG.appendChild(mk('animateTransform', {
      attributeName: 'transform', type: 'scale',
      values: PIN_SCALE_VALUES, keyTimes: STEDSMERKE_KEY_TIMES,
      dur: STEDSMERKE_DUR, repeatCount: 'indefinite', begin,
    }))
    pinScaleG.appendChild(pinPathEl)
    pinScaleG.appendChild(pinDotEl)
    pinTranslateG.appendChild(pinScaleG)
    pinPosG.appendChild(pinTranslateG)
    parent.appendChild(pinPosG)
  }

  /**
   * Hold ALL tekst i kart-SVG-en samt stedsmerke-piner stående «opp» på
   * skjermen mens resten av kartet roterer. Counter-rotation appliseres
   * rundt hver etikets eget ankerpunkt slik at de blir lesbare uansett
   * kart-vinkel.
   *
   * v8.9.3: kun stedsnavn + stedsmerke. v8.9.7: utvidet til alle <text>
   * (vann-navn, kontur-tall, dybde-tall, peak, peak-ele, lanterne-tall,
   * skjaer-navn, dybde-kontur-tall, slipp-navn …). Symboler (use/path)
   * roterer fortsatt med terrenget — kun tekst og pin holdes opp.
   *
   * Bruker text.x.baseVal[0].value som gir resolved numeric verdi i
   * user-units uansett om attributtet er "2mm" eller et tall — browseren
   * konverterer mm → user-units for oss. Faller tilbake til 0 hvis x/y
   * mangler (multi-coordinate texts og defaults).
   *
   * Kjøres som lett attributt-oppdatering ved hver rotasjons-endring —
   * ingen DOM-creation, så det er trygt å kalle hver touchmove-frame.
   */
  function applyUprightLabels() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const rot = -rotation.value
    // Alle tekst-labels i kart-innholdet
    const texts = svg.querySelectorAll('text')
    for (const el of texts) {
      // v9.3.6 — Hopp over <text> som er en symbol-mal i <defs> (f.eks. «WC»-
      // teksten i ISOM 554-symbolet). Slike instansieres via <use> inne i en
      // <g data-upright="1">-gruppe som ALLEREDE counter-roteres lenger ned;
      // å rotere mal-teksten i tillegg ga dobbel counter-rotation, så WC endte
      // på -rotation (roterte «feil vei») i stedet for å stå rett opp.
      let inDefs = el.__indefs
      if (inDefs === undefined) {
        inDefs = !!el.closest('defs')
        el.__indefs = inDefs
      }
      if (inDefs) continue
      // v12.0.16 — Veinummer-skilt håndteres som HEL gruppe (rect + tekst)
      // lenger ned: å counter-rotere teksten alene skjevstiller den mot
      // skilt-boksen (rapportert etter v12.0.15).
      if (el.dataset.label === 'veinummer') continue
      // v9.1.11 — Perf: cache BÅDE lag-referansen og x/y per element. closest()
      // og baseVal er dyrt; å kjøre dem for hver av 1000+ labels HVER rotasjons-
      // /kompass-frame ga jank (v9.1.10-regresjon: closest per frame). Statisk
      // per element, så vi regner det ut én gang og leser deretter bare den
      // billige inline `style.display` per frame.
      let layerG = el.__layer
      if (layerG === undefined) {
        layerG = el.closest('[data-layer]')
        el.__layer = layerG
      }
      // Hopp over labels i skjulte lag (stedsnavn default av → 1000+ noder
      // itereres ikke). Re-orienteres når laget slås på (applyLayerVisibility).
      if (layerG && layerG.style.display === 'none') continue
      let xVal = el.__ux
      if (xVal === undefined) {
        xVal = el.x?.baseVal?.[0]?.value ?? 0
        el.__ux = xVal
        el.__uy = el.y?.baseVal?.[0]?.value ?? 0
      }
      el.setAttribute('transform', `rotate(${rot} ${xVal} ${el.__uy})`)
    }
    // Stedsmerke-annoteringer (rød dråpe-pin). G-en har allerede
    // translate(x,y) — counter-rotate rundt (0,0) i lokalt rom holder
    // pin-tipp-en forankret mens hodet vippes opp.
    const pins = svg.querySelectorAll('[data-annot-type="stedsmerke"]')
    for (const el of pins) {
      // Bevarer eksisterende translate, bytter ut/setter rotate-segment
      const existing = el.getAttribute('transform') ?? ''
      const m = existing.match(/translate\([^)]+\)/)
      const trans = m ? m[0] : ''
      el.setAttribute('transform', `${trans} rotate(${rot})`)
    }
    // Auto-genererte symboler markert med data-upright (foreløpig kun
    // parkerings-P) skal leses vannrett med skjermens topp — bruker samme
    // mønster som stedsmerke: bevar translate, bytt rotate-segmentet.
    const upright = svg.querySelectorAll('[data-upright="1"]')
    for (const el of upright) {
      const existing = el.getAttribute('transform') ?? ''
      const m = existing.match(/translate\([^)]+\)/)
      const trans = m ? m[0] : ''
      el.setAttribute('transform', `${trans} rotate(${rot})`)
    }
    // v12.0.16 — Veinummer-skilt: beholder vei-bæringen sin (ikke billboard),
    // men flippes 180° når kart-rotasjonen ville lagt teksten på hodet.
    // Skiltet ligger dermed alltid LANGS veien og er alltid lesbart. Bygge-
    // vinkelen caches fra transform-strengen første gang (virker dermed også
    // på kart generert før denne fiksen).
    const badges = svg.querySelectorAll('[data-layer="veinummer"] > g')
    for (const el of badges) {
      if (el.__deg === undefined) {
        const t = el.getAttribute('transform') ?? ''
        el.__trans = t.match(/translate\([^)]+\)/)?.[0] ?? ''
        el.__deg = Number(t.match(/rotate\((-?[\d.]+)/)?.[1] ?? 0)
        // Kart lagret mens v12.0.15-buggen var aktiv kan ha en gammel
        // counter-rotation baket inn på selve teksten — fjern den.
        el.querySelector('text')?.removeAttribute('transform')
      }
      el.setAttribute('transform', `${el.__trans} rotate(${roadRefUprightDeg(el.__deg, rotation.value)})`)
    }
  }

  // Skilt-vinkel som holder veinummer-teksten lesbar: behold bygge-vinkelen
  // hvis effektiv skjermvinkel (bygge + kart-rotasjon) er innenfor ±90°,
  // ellers flipp 180°. Returnerer vinkel i kart-rom.
  function roadRefUprightDeg(bakedDeg, mapRotDeg) {
    const eff = ((bakedDeg + mapRotDeg) % 360 + 540) % 360 - 180
    return (eff > 90 || eff <= -90) ? bakedDeg + 180 : bakedDeg
  }

  /**
   * Render alle synlige GPS-spor i et eget SVG-lag som ligger mellom kart-
   * innholdet og annotation/user-laget. Stilen styres av tracker.trackStyle
   * — 'line' (polyline med marsjerende prikker), 'footprints' eller
   * 'breadcrumbs'. Live-tracket (det som spilles inn nå) har ekstra
   * pulserende hode-markør så brukeren ser at opptaket lever.
   */
  function renderTracks() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const ns = 'http://www.w3.org/2000/svg'
    let layer = svg.querySelector('#track-layer')
    if (!layer) {
      layer = document.createElementNS(ns, 'g')
      layer.setAttribute('id', 'track-layer')
      layer.setAttribute('data-layer', 'spor')
      layer.setAttribute('pointer-events', 'none')
      // Plasser før user-layer + annotation-layer hvis de finnes,
      // ellers append. Spor skal ligge UNDER GPS-dot/annoteringer.
      const userLayer = svg.querySelector('#user-layer')
      const annotLayer = svg.querySelector('#annotation-layer')
      const ref = userLayer ?? annotLayer
      if (ref) svg.insertBefore(layer, ref)
      else svg.appendChild(layer)
    }
    layer.replaceChildren()

    // v8.9.5: paths inne i [data-layer] arver vector-effect: non-scaling-
    // stroke fra global SVG-CSS, så stroke-width tolkes i CSS-px. Del kun på
    // pinch-scale for å kompensere for CSS-transform-zoom. (Tidligere brukte
    // vi pxToUserUnits her — det ga ~10× for tykk linje på 4 km-kart.)
    const s = scale.value || 1
    const haloW = 7 / s
    const lineW = 3.5 / s
    // Circle/ellipse-radii er geometri, ikke stroke → fortsatt user-units
    const dotR  = pxToUserUnits(2.5)
    const footW = pxToUserUnits(5)

    const TRACK_COLOR = '#ec4899'         // magenta — kontrasterer mot ISOM
    const HALO_COLOR  = 'rgba(255,255,255,0.85)'

    const style = tracker.trackStyle.value
    for (const tr of tracker.tracks.value) {
      if (!tracker.visibleTrackIds.value.has(tr.id)) continue
      if (!tr.points || tr.points.length === 0) continue
      const isActive = tracker.isRecording.value && (tracker.activeTrack.value?.id === tr.id)
      const g = document.createElementNS(ns, 'g')
      g.setAttribute('data-track-id', tr.id)

      if (style === 'breadcrumbs') {
        // Diskrete prikker hver ~10 m. Bruk avstands-basert sampling så
        // tett-pakkede punkter ikke gir cluster.
        const pts = sampleByDistance(tr.points, 10)
        for (const p of pts) {
          const c = document.createElementNS(ns, 'circle')
          c.setAttribute('cx', p.x); c.setAttribute('cy', p.y)
          c.setAttribute('r', dotR)
          c.setAttribute('fill', TRACK_COLOR)
          c.setAttribute('stroke', HALO_COLOR)
          c.setAttribute('stroke-width', pxToUserUnits(1.5))
          g.appendChild(c)
        }
      } else if (style === 'footprints') {
        // Fotavtrykk: små elliptiske prikker alternerende venstre/høyre av
        // bevegelses-retningen, ~5 m mellomrom. Rotasjon følger lokal vinkel.
        const pts = sampleByDistance(tr.points, 5)
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i]
          const next = pts[i + 1] ?? pts[i - 1] ?? p
          const dx = next.x - p.x
          const dy = next.y - p.y
          const angDeg = Math.atan2(dy, dx) * 180 / Math.PI
          const side = (i % 2 === 0) ? 1 : -1
          const off = footW * 0.6
          const perpAng = (angDeg + 90) * Math.PI / 180
          const fx = p.x + Math.cos(perpAng) * off * side
          const fy = p.y + Math.sin(perpAng) * off * side
          const fp = document.createElementNS(ns, 'ellipse')
          fp.setAttribute('cx', fx); fp.setAttribute('cy', fy)
          fp.setAttribute('rx', footW * 0.45)
          fp.setAttribute('ry', footW * 0.85)
          fp.setAttribute('transform', `rotate(${angDeg},${fx},${fy})`)
          fp.setAttribute('fill', TRACK_COLOR)
          fp.setAttribute('stroke', HALO_COLOR)
          fp.setAttribute('stroke-width', pxToUserUnits(1))
          fp.setAttribute('opacity', '0.9')
          g.appendChild(fp)
        }
      } else {
        // Default: to-lags polyline med marsjerende prikker. Halo bak gir
        // lesbarhet på både lyse og mørke kart-temaer.
        const d = pointsToPathD(tr.points)
        const halo = document.createElementNS(ns, 'path')
        halo.setAttribute('d', d)
        halo.setAttribute('fill', 'none')
        halo.setAttribute('stroke', HALO_COLOR)
        halo.setAttribute('stroke-width', haloW)
        halo.setAttribute('stroke-linecap', 'round')
        halo.setAttribute('stroke-linejoin', 'round')
        g.appendChild(halo)

        const line = document.createElementNS(ns, 'path')
        line.setAttribute('d', d)
        line.setAttribute('fill', 'none')
        line.setAttribute('stroke', TRACK_COLOR)
        line.setAttribute('stroke-width', lineW)
        line.setAttribute('stroke-linecap', 'round')
        line.setAttribute('stroke-linejoin', 'round')
        // Marsjerende prikker: stiplet + animasjon på offset. Dasharray
        // arver også non-scaling-stroke, så CSS-px / pinch-scale.
        const dash = 6 / s
        const gap = 8 / s
        line.setAttribute('stroke-dasharray', `${dash} ${gap}`)
        const anim = document.createElementNS(ns, 'animate')
        anim.setAttribute('attributeName', 'stroke-dashoffset')
        anim.setAttribute('from', String(dash + gap))
        anim.setAttribute('to', '0')
        anim.setAttribute('dur', '1.4s')
        anim.setAttribute('repeatCount', 'indefinite')
        line.appendChild(anim)
        g.appendChild(line)
      }

      // Live-puls på siste punkt mens opptaket pågår. Gjør det visuelt
      // tydelig at hovedet av sporet er "her og nå" og at appen henter
      // friske GPS-fix-er.
      if (isActive && tr.points.length > 0) {
        const last = tr.points[tr.points.length - 1]
        const headR = pxToUserUnits(8)
        const pulse = document.createElementNS(ns, 'circle')
        pulse.setAttribute('cx', last.x); pulse.setAttribute('cy', last.y)
        pulse.setAttribute('r', headR)
        pulse.setAttribute('fill', 'none')
        pulse.setAttribute('stroke', TRACK_COLOR)
        pulse.setAttribute('stroke-width', pxToUserUnits(2))
        const aR = document.createElementNS(ns, 'animate')
        aR.setAttribute('attributeName', 'r')
        aR.setAttribute('values', `${headR};${headR * 2.4};${headR}`)
        aR.setAttribute('dur', '1.6s'); aR.setAttribute('repeatCount', 'indefinite')
        pulse.appendChild(aR)
        const aO = document.createElementNS(ns, 'animate')
        aO.setAttribute('attributeName', 'opacity')
        aO.setAttribute('values', '0.9;0;0.9'); aO.setAttribute('dur', '1.6s')
        aO.setAttribute('repeatCount', 'indefinite')
        pulse.appendChild(aO)
        g.appendChild(pulse)
      }

      layer.appendChild(g)
    }
  }

  /** Forenkle path til "M x,y L x,y L ..." fra point-array. */
  function pointsToPathD(points) {
    if (!points.length) return ''
    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`
    }
    return d
  }

  /** Sample punkter med min-avstand i SVG-meter. Beholder første og siste. */
  function sampleByDistance(points, minDistM) {
    if (points.length <= 1) return points.slice()
    const out = [points[0]]
    for (let i = 1; i < points.length; i++) {
      const last = out[out.length - 1]
      const dx = points[i].x - last.x
      const dy = points[i].y - last.y
      if (Math.hypot(dx, dy) >= minDistM) out.push(points[i])
    }
    // Sørg for at siste punkt alltid er med (viktig for live-puls)
    if (out[out.length - 1] !== points[points.length - 1]) {
      out.push(points[points.length - 1])
    }
    return out
  }

  function updateUserDot() {
    const svg = svgHostRef.value?.querySelector('svg')
    const layer = svg?.querySelector('#user-layer')
    if (!layer) return
    const x = userPos.svgX
    const y = userPos.svgY
    const acc = userPos.accuracyM ?? 30
    // Kjegla peker dit telefonen vender (kompass/magnetometer via DeviceOrientation)
    // når kompasset er aktivt — det er retningen orienteringsbrukeren vil ha, og
    // det virker også stillestående. GPS-kurs (coords.heading) er fallback når
    // kompasset mangler/avvist; den er kun definert i bevegelse og peker dit du
    // er på vei, ikke dit du vender.
    const heading = (compass.isActive && Number.isFinite(compass.headingDeg))
      ? compass.headingDeg
      : userPos.headingDeg
    layer.replaceChildren()
    if (x == null || y == null) return
    const ns = 'http://www.w3.org/2000/svg'

    // Dynamiske skjerm-størrelser. Dot er fast 14 CSS-px, kjegle 60 CSS-px
    // ut fra dot. Accuracy-ringen reflekterer ekte fysisk usikkerhet (i meter)
    // men cappes på ~28 CSS-px radius slik at dårlig GPS (urban / tog / tunnel)
    // ikke språker ringen utover halve skjermen og dømmer kart-innholdet.
    // v8.5.3: stroke-bredder via pxToUserUnits — non-scaling-stroke virker
    // ikke når SVG-en CSS-transformeres av pinch-zoom-wrapperen, så stroke
    // ble fete på høy zoom og det blå fyllet forsvant under den hvite kant-
    // linjen. Nå skaleres bredden eksplisitt på samme måte som radius.
    const dotR = pxToUserUnits(7)         // ~14 CSS-px diameter
    const dotStroke = pxToUserUnits(1.6)  // tynn hvit halo
    const coneR = pxToUserUnits(30)       // ~60 CSS-px ut fra dot
    const minRingR = pxToUserUnits(12)    // ringen blir aldri mindre enn dot+halo
    const maxRingR = pxToUserUnits(28)    // visuelt cap
    const ringR = Math.min(maxRingR, Math.max(minRingR, acc))
    const ringStroke = pxToUserUnits(0.8)

    const ring = document.createElementNS(ns, 'circle')
    ring.setAttribute('cx', x)
    ring.setAttribute('cy', y)
    ring.setAttribute('r', ringR)
    ring.setAttribute('fill', 'rgba(56, 189, 248, 0.10)')
    ring.setAttribute('stroke', 'rgba(56, 189, 248, 0.40)')
    ring.setAttribute('stroke-width', ringStroke)
    layer.appendChild(ring)

    if (Number.isFinite(heading)) {
      const cone = document.createElementNS(ns, 'path')
      const ang = (heading - 90) * Math.PI / 180
      const ang1 = ang - 0.35
      const ang2 = ang + 0.35
      const x1 = x + Math.cos(ang1) * coneR
      const y1 = y + Math.sin(ang1) * coneR
      const x2 = x + Math.cos(ang2) * coneR
      const y2 = y + Math.sin(ang2) * coneR
      cone.setAttribute('d', `M${x},${y} L${x1},${y1} A${coneR},${coneR} 0 0 1 ${x2},${y2} Z`)
      cone.setAttribute('fill', 'rgba(56, 189, 248, 0.35)')
      layer.appendChild(cone)
    }

    const dot = document.createElementNS(ns, 'circle')
    dot.setAttribute('cx', x)
    dot.setAttribute('cy', y)
    dot.setAttribute('r', dotR)
    dot.setAttribute('fill', '#0ea5e9')
    dot.setAttribute('stroke', '#fff')
    dot.setAttribute('stroke-width', dotStroke)
    layer.appendChild(dot)
  }

  return {
    pxToUserUnits, renderHighlight, renderProximityTarget, renderMeasure,
    renderRoutes, ensureAnnotationDefs, renderAnnotations,
    applyUprightLabels, roadRefUprightDeg, renderTracks, updateUserDot,
  }
}

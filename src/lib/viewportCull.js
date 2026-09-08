// Viewport-culling — «out of sight, out of mind» for kart-SVG-en.
//
// Rene funksjoner (ingen DOM-import) som MapView bruker til å skjule
// elementer utenfor synlig utsnitt + hysterese-margin, og vise dem igjen
// momentant når brukeren panorerer tilbake. Indeksen er et rbush R-tre
// (allerede dependency via buildingMass/routing) over bbokser i SVG-meter.
//
// Ytelsesmodellen som styrer designet: pan/zoom er CSS-transform på en
// composited wrapper, så ren panning koster ~ingenting — gevinsten ligger i
// re-raster (pinch-zoom, gest-slutt-repaint, lag-toggles, første paint) og
// raster-minne. Derfor: cull-rekt = viewport ekspandert med raus margin, så
// normale pans avdekker allerede-synlig innhold uten JS i det hele tatt, og
// re-beregning skjer kun når utsnittet har rømt forrige margin (hysterese).
import RBush from 'rbush'

// Margin per side som andel av viewport-bredde/-høyde. 0.75 → cull-rekta
// dekker 2.5×2.5 viewports areal: nok til at raske flings ikke blottlegger
// tomrom før debounce/gest-slutt-recompute rekker å kjøre.
export const CULL_MARGIN_FACTOR = 0.75

// Hysterese-slakk: re-beregn først når view-rekta har rømt den forrige
// ekspanderte rekta med mer enn denne andelen av marginen.
export const RECULL_SLACK = 0.5

// Skala-endring (forhold) som tvinger re-beregning selv uten pan.
export const RECULL_SCALE_RATIO = 1.2

/**
 * Invers-transformér wrapper-viewporten til en AABB i SVG-meter-rom.
 * Samme matte som visibleCenterSvg i MapView (M = T(tx,ty)∘R(rot)∘S(s) på
 * «meet»-fittet innhold), generalisert til alle fire hjørner så resultatet
 * er rotasjonstrygt: AABB-en til den roterte viewport-firkanten.
 *
 * @param {object} p { w, h, widthM, heightM, scale, rotation, tx, ty }
 *   w/h = wrapper-px, widthM/heightM = viewBox-meter, rotation i grader.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
 */
export function viewRectSvg({ w, h, widthM, heightM, scale, rotation, tx, ty }) {
  if (!w || !h || !widthM || !heightM) return null
  const fit = Math.min(w / widthM, h / heightM)
  if (!fit || !Number.isFinite(fit)) return null
  const offX = (w - widthM * fit) / 2
  const offY = (h - heightM * fit) / 2
  const s = scale || 1
  const rot = ((rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [sx, sy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const A = (sx - (tx || 0)) / s
    const B = (sy - (ty || 0)) / s
    const px = A * cos + B * sin
    const py = -A * sin + B * cos
    const x = (px - offX) / fit
    const y = (py - offY) / fit
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/** Ekspandér en rekt med marginFactor av dens egen bredde/høyde per side. */
export function expandRect(rect, marginFactor = CULL_MARGIN_FACTOR) {
  const mx = (rect.maxX - rect.minX) * marginFactor
  const my = (rect.maxY - rect.minY) * marginFactor
  return {
    minX: rect.minX - mx,
    minY: rect.minY - my,
    maxX: rect.maxX + mx,
    maxY: rect.maxY + my,
  }
}

/** True når `outer` dekker hele `inner`. */
export function rectContains(outer, inner) {
  return outer.minX <= inner.minX && outer.minY <= inner.minY &&
         outer.maxX >= inner.maxX && outer.maxY >= inner.maxY
}

/** True når to rekter overlapper (deler kant teller som overlapp). */
export function rectsOverlap(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY
}

/**
 * Bygg rbush-indeks fra entries `{ minX, minY, maxX, maxY, el }`.
 * `el` er en opaque referanse (DOM-element i MapView, plain object i test).
 */
export function buildCullIndex(entries) {
  const tree = new RBush()
  tree.load(entries)
  return tree
}

/**
 * Hysterese: trenger vi re-beregne cull-settet?
 * prevState = { viewRect, expandedRect, scale } fra forrige kjøring (null → ja).
 * Re-beregn når den nye (u-ekspanderte) view-rekta har spist mer enn
 * RECULL_SLACK av forrige kjørings margin, eller skalaen har endret seg
 * mer enn RECULL_SCALE_RATIO i en av retningene.
 */
export function needsRecull(prevState, viewRect, scale) {
  if (!prevState || !prevState.expandedRect || !prevState.viewRect) return true
  const prevScale = prevState.scale || 1
  const ratio = (scale || 1) / prevScale
  if (ratio > RECULL_SCALE_RATIO || ratio < 1 / RECULL_SCALE_RATIO) return true
  const prev = prevState.expandedRect
  const prevView = prevState.viewRect
  // Marginen forrige kjøring la på (per side); behold RECULL_SLACK av den
  // som «trygg sone» — utenfor den må vi re-beregne.
  const slackX = (((prev.maxX - prev.minX) - (prevView.maxX - prevView.minX)) / 2) * RECULL_SLACK
  const slackY = (((prev.maxY - prev.minY) - (prevView.maxY - prevView.minY)) / 2) * RECULL_SLACK
  return !rectContains(
    { minX: prev.minX + slackX, minY: prev.minY + slackY, maxX: prev.maxX - slackX, maxY: prev.maxY - slackY },
    viewRect
  )
}

/**
 * Beregn diff mot forrige synlighets-sett.
 * @param {RBush} index
 * @param {object} expandedRect cull-rekta i SVG-meter
 * @param {Set} prevVisible Set av `el` som var synlige sist
 * @returns {{ show: el[], hide: el[], visible: Set }}
 *   show = var skjult, skal vises; hide = var synlig, skal skjules;
 *   visible = nytt komplett synlighets-sett (blir neste prevVisible).
 */
export function computeCullDiff(index, expandedRect, prevVisible) {
  const hits = index.search(expandedRect)
  const visible = new Set()
  for (const h of hits) visible.add(h.el)
  const show = []
  const hide = []
  for (const el of visible) {
    if (!prevVisible || !prevVisible.has(el)) show.push(el)
  }
  if (prevVisible) {
    for (const el of prevVisible) {
      if (!visible.has(el)) hide.push(el)
    }
  }
  return { show, hide, visible }
}

/**
 * Rommet en spøkelses-flis opptar i den AKTIVE flisas meter-rom, utledet av
 * attributtene buildGhostSvg skrev på den nestede <svg>-en.
 *
 * En spøkelses-flis er `x/y = dx-bleed`, `viewBox = "-bleed -bleed …"` og
 * `width/height = W+2·bleed` (se GHOST_EDGE_BLEED_M). Skalaen er dermed 1:1, og
 * et indre koordinat `u` ligger på `x - viewBoxMinX + u` i aktiv flis. Vi leser
 * viewBox framfor å anta blø-bredden: gjør noen om på blø-sonen, følger
 * forskyvningen med av seg selv i stedet for å bomme med et halvt hakk.
 *
 * @returns {{ dx:number, dy:number, rect:{minX,minY,maxX,maxY} }|null}
 */
export function ghostFlisRom({ x, y, width, height, viewBox } = {}) {
  const px = Number(x), py = Number(y)
  const w = Number(width), h = Number(height)
  if (![px, py, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null
  const vb = String(viewBox ?? '').trim().split(/[\s,]+/).map(Number)
  const vbMinX = vb.length === 4 && Number.isFinite(vb[0]) ? vb[0] : 0
  const vbMinY = vb.length === 4 && Number.isFinite(vb[1]) ? vb[1] : 0
  return {
    dx: px - vbMinX,
    dy: py - vbMinY,
    rect: { minX: px, minY: py, maxX: px + w, maxY: py + h },
  }
}

/**
 * Parse `data-bbox="minX,minY,maxX,maxY"` (Fase B-attributt fra mapBuilder).
 * Returnerer null på manglende/ugyldig input — kalleren behandler null som
 * «ikke indekserbar = aldri cullet» (graceful for gamle lagrede kart).
 */
export function parseBboxAttr(str) {
  if (!str || typeof str !== 'string') return null
  const parts = str.split(',')
  if (parts.length !== 4) return null
  const [minX, minY, maxX, maxY] = parts.map(Number)
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null
  if (maxX < minX || maxY < minY) return null
  return { minX, minY, maxX, maxY }
}

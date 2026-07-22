// Flater nestede <svg>-elementer ut til klippede <g transform>-grupper.
//
// Bakgrunn: turrapporten (og kart med detalj-inset) nester et kart-<svg> med
// egen viewBox inne i et ytre <svg>. Nettlesere rendrer dette korrekt på skjerm
// og til canvas, MEN Chromiums print-sti («Lagre som PDF» / window.print())
// håndterer ikke nestede SVG-viewporter riktig — innholdet flommer utover eller
// skaleres feil. Ved å erstatte hvert nestede <svg x y width height viewBox>
// med et <g clip-path><g transform="translate scale"> som reproduserer viewBox-
// og preserveAspectRatio-avbildningen selv, står ingen nestet viewport igjen
// som print kan rote til. Resultatet er visuelt identisk for korrekte renderere
// og forblir ren vektor.
//
// Ren streng-transformasjon (ingen DOM) — kjører like godt i nettleser, i
// headless (linkedom) og i Node-tester.

function parseAttrs(openTag) {
  const attrs = {}
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g
  let m
  while ((m = re.exec(openTag))) attrs[m[1]] = m[2]
  return attrs
}

// Regn ut klippeboks + transform for en nestet SVG-viewport. Returnerer null
// hvis elementet mangler viewBox eller numerisk width/height (da lar vi det stå
// urørt — trygg fallback framfor å gjette).
function boxFrom(a) {
  if (!a.viewBox || a.width == null || a.height == null) return null
  const num = (v) => { const f = parseFloat(v); return Number.isFinite(f) ? f : null }
  const X = num(a.x ?? '0'), Y = num(a.y ?? '0'), W = num(a.width), H = num(a.height)
  if ([X, Y, W, H].some((v) => v == null)) return null
  const vb = a.viewBox.trim().split(/[\s,]+/).map(Number)
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) return null
  const [minX, minY, vbW, vbH] = vb
  if (!(vbW > 0) || !(vbH > 0)) return null

  const par = (a.preserveAspectRatio || 'xMidYMid meet').trim().split(/\s+/)
  const align = par[0] === 'none' ? null : (par[0] || 'xMidYMid')
  const meetOrSlice = par[1] || 'meet'
  let sx, sy
  if (!align) {
    sx = W / vbW; sy = H / vbH
  } else {
    sx = sy = meetOrSlice === 'slice'
      ? Math.max(W / vbW, H / vbH)
      : Math.min(W / vbW, H / vbH)
  }
  const fx = align ? (align.includes('xMid') ? 0.5 : align.includes('xMax') ? 1 : 0) : 0
  const fy = align ? (align.includes('YMid') ? 0.5 : align.includes('YMax') ? 1 : 0) : 0
  const tx = X - sx * minX + fx * (W - sx * vbW)
  const ty = Y - sy * minY + fy * (H - sy * vbH)

  const r = (n) => Number(n.toFixed(4))
  return {
    X: r(X), Y: r(Y), W: r(W), H: r(H),
    transform: `translate(${r(tx)} ${r(ty)}) scale(${r(sx)} ${r(sy)})`,
  }
}

// Finn det innerste nestede <svg>…</svg> (aldri rot-elementet). Første </svg> i
// en venstre-mot-høyre-skann lukker alltid den innerste åpne <svg>-en; er den
// ikke roten, er det den vi vil flate ut først. Returnerer posisjoner + åpne-tag.
function findInnermostNested(s) {
  const tokenRe = /<svg\b[^>]*>|<\/svg>/gi
  const openStack = []
  let m
  while ((m = tokenRe.exec(s))) {
    if (m[0][1] === '/') {
      const open = openStack.pop()
      if (!open) continue
      // Tom stack etter pop ⇒ det var rot-elementet — hopp over.
      if (openStack.length > 0) {
        return {
          openStart: open.start,
          openEnd: open.tagEnd,
          closeStart: m.index,
          closeEnd: tokenRe.lastIndex,
          openTag: open.tag,
        }
      }
    } else {
      openStack.push({ start: m.index, tagEnd: tokenRe.lastIndex, tag: m[0] })
    }
  }
  return null
}

/**
 * Flat ut alle nestede <svg>-elementer i en SVG-streng. Rot-<svg> beholdes.
 * Trygg å kalle på hvilken som helst SVG — uten nestede elementer returneres
 * strengen uendret.
 */
export function flattenNestedSvg(svgString) {
  if (typeof svgString !== 'string' || !svgString.includes('<svg')) return svgString
  let s = svgString
  const clips = []
  let clipId = 0

  // Ett innerste nestet element per runde; hver runde fjerner én <svg-token, så
  // antallet synker monotont. Vakt-grense mot patologiske innganger.
  for (let guard = 0; guard < 2000; guard++) {
    const spot = findInnermostNested(s)
    if (!spot) break
    const attrs = parseAttrs(spot.openTag)
    const inner = s.slice(spot.openEnd, spot.closeStart)
    const cls = attrs.class ? ` class="${attrs.class}"` : ''
    const box = boxFrom(attrs)
    let replacement
    if (box) {
      const id = `lende-flat-clip-${clipId++}`
      clips.push(`<clipPath id="${id}"><rect x="${box.X}" y="${box.Y}" width="${box.W}" height="${box.H}"/></clipPath>`)
      replacement = `<g${cls} clip-path="url(#${id})"><g transform="${box.transform}">${inner}</g></g>`
    } else {
      // Uten beregnbar viewport: pakk om til <g> uten klipping (behold innhold).
      replacement = `<g${cls}>${inner}</g>`
    }
    s = s.slice(0, spot.openStart) + replacement + s.slice(spot.closeEnd)
  }

  if (clips.length) {
    const rootOpenEnd = s.indexOf('>', s.indexOf('<svg')) + 1
    s = s.slice(0, rootOpenEnd) + `<defs>${clips.join('')}</defs>` + s.slice(rootOpenEnd)
  }
  return s
}

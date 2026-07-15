// Long-press detalj-inset — skilt ut fra MapView v1.0.8 (kode uendret).
// Et roambart utsnitt rundt long-press-punktet, rendret som eget lite SVG
// i bottom-sheeten med de skjulte detalj-lagene (dybdetall m.m.) skrudd PÅ.
// Mottar forelderens refs/state destrukturert så funksjonskroppene er
// identiske med før flyttingen; watch-en som kaller buildDetailInset ligger
// fortsatt i MapView.

export function useDetailInset({
  detailInsetRef, svgHostRef, contextMenuPoint, detachedDetailLayers,
  rotation, roadRefUprightDeg, meta, DETAIL_INSET_M,
}) {
  // ── Long-press detalj-inset ──────────────────────────────────────────────
  // Et 150×150 m utsnitt rundt long-press-punktet, rendret som et eget lite
  // SVG i bottom-sheeten. Her skrur vi PÅ de skjulte detalj-lagene
  // (data-detail="1": dybdepunkt-soundings + dybdekurver) som er for tette på
  // hovedkartet. Fungerer uten GPS og uten manuell toggle — KISS. Bygges når
  // sheeten åpnes; kloner kart-innholdet og setter viewBox til utsnittet.
  function buildDetailInset() {
    const host = detailInsetRef.value
    if (!host) return
    host.replaceChildren()
    const src = svgHostRef.value?.querySelector('svg')
    const p = contextMenuPoint.value
    if (!src || !p) return
    const ns = 'http://www.w3.org/2000/svg'

    const svg = document.createElementNS(ns, 'svg')
    // viewBox settes av attachInsetPanZoom (start: ~600 m synlig bredde i det
    // 1 km roambare vinduet, 16:9-aspekt).
    svg.setAttribute('xmlns', ns)
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    // zoom-near/zoomed-in: lupen ER per definisjon «helt inne» — uten disse
    // klassene holder zoom-LOD-CSS-en igjen kontur-tall, vann-tall og de fine
    // dybde-tallene (data-fine) også i inset-en (inline display:'' nuller bare
    // inline-styles, ikke stylesheet-regler).
    svg.setAttribute('class', 'isom-map zoom-near zoomed-in')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svg.style.touchAction = 'none'   // vi håndterer pan/zoom selv

    // Klon kart-innholdet (hopp over GPS-/pin-overlays).
    for (const child of Array.from(src.childNodes)) {
      if (child.nodeType === 1) {
        const id = child.getAttribute && child.getAttribute('id')
        if (id === 'user-layer' || id === 'contextmenu-pin-layer') continue
      }
      svg.appendChild(child.cloneNode(true))
    }
    // Detalj-lagene (dybdepunkt/dybdekurve) lever ikke lenger i hovedkartets
    // DOM (detachet i setupHostSvg for perf) — klon dem inn fra modul-refen.
    for (const g of detachedDetailLayers) {
      svg.appendChild(g.cloneNode(true))
    }

    // Skru PÅ de skjulte detalj-lagene + sørg for at sjø-POI vises i inset-en
    // uansett hovedkart-toggle, og at dybde-tall ikke er skjult av 'navn'-av.
    for (const g of svg.querySelectorAll('[data-detail="1"], [data-layer="sjo-poi"], [data-layer="kai"], [data-layer="sjo-navn"]')) {
      g.style.display = ''
      for (const el of g.querySelectorAll('*')) el.style.display = ''
    }

    // Klonene arver klasse-skjuling fra hovedkartet: vp-cull (viewport-culling)
    // og name-lod-off (navn-LOD) bruker begge display:none !important som
    // inline-style-nullingen over IKKE kan overstyre. Inset-en er en detalj-
    // lupe — her skal alt som finnes i vinduet vises.
    for (const el of svg.querySelectorAll('.vp-cull, .name-lod-off')) {
      el.classList.remove('vp-cull', 'name-lod-off')
    }

    // Vis ALLE navn i inset-en (på land er det rikelig plass ved denne zoomen):
    // overstyr både 'navn'-toggelen, stedsnavn-lagene og navn-LOD-en som ellers
    // skjuler overlappende stedsnavn på hovedkartet. Inset-en er en detalj-lupe
    // — her vil brukeren se alt som finnes.
    for (const g of svg.querySelectorAll('[data-layer="navn"], [data-layer^="stedsnavn"]')) {
      g.style.display = ''
    }
    for (const el of svg.querySelectorAll('[data-label]')) {
      el.style.display = ''
    }

    // Inset-en er ALLTID nord-opp (viewBox-basert, ingen rotasjon). NÅR hovedkartet
    // er rotert, har applyUprightLabels bakt en billboard-counter-rotation
    // (transform="rotate(-rotation x y)") inn i navn/symboler så de står vannrett
    // mens kartet roteres. I nord-opp-inset-en (ingen +rotation å kansellere) tipper
    // den samme transformen navnene skjevt/loddrett (rapportert). Nullstill da til
    // nord-opp: fjern rotate fra tekst, behold translate på upright-symboler/pins.
    // Når hovedkartet IKKE er rotert er klonen allerede korrekt (bekke-navn beholder
    // sin vannløp-bæring, ingen counter-rotation), så da rører vi ingenting.
    if (rotation.value) {
      for (const t of svg.querySelectorAll('text')) {
        if (t.closest('defs')) continue
        // Veinummer-teksten har ingen egen rotasjon (hele skilt-gruppen
        // roteres) — gruppen normaliseres under.
        if (t.dataset.label === 'veinummer') continue
        t.removeAttribute('transform')
      }
      for (const el of svg.querySelectorAll('[data-upright="1"], [data-annot-type="stedsmerke"]')) {
        const m = (el.getAttribute('transform') ?? '').match(/translate\([^)]+\)/)
        if (m) el.setAttribute('transform', m[0])
        else el.removeAttribute('transform')
      }
      // Veinummer-skilt i klonen kan stå med en 180°-flipp fra det roterte
      // hovedkartet — inset-en er nord-opp, så re-flipp til lesbar vinkel
      // (roadRefUprightDeg med rotasjon 0).
      for (const g of svg.querySelectorAll('[data-layer="veinummer"] > g')) {
        const t = g.getAttribute('transform') ?? ''
        const trans = t.match(/translate\([^)]+\)/)?.[0] ?? ''
        const deg = Number(t.match(/rotate\((-?[\d.]+)/)?.[1] ?? 0)
        g.setAttribute('transform', `${trans} rotate(${roadRefUprightDeg(deg, 0)})`)
      }
    }

    // Fadenkreuz på senterpunktet (samme posisjon som long-press-pin-en).
    const cross = document.createElementNS(ns, 'g')
    cross.setAttribute('pointer-events', 'none')
    const r = 9  // meter (v11.0.61: +50 % for bedre synlighet i inset-en)
    const mk = (d) => {
      const ln = document.createElementNS(ns, 'path')
      ln.setAttribute('d', d)
      ln.setAttribute('stroke', '#e11d48')
      ln.setAttribute('stroke-width', '2.1')
      ln.setAttribute('fill', 'none')
      ln.setAttribute('stroke-linecap', 'round')
      return ln
    }
    cross.appendChild(mk(`M${p.svgX - r},${p.svgY} L${p.svgX + r},${p.svgY}`))
    cross.appendChild(mk(`M${p.svgX},${p.svgY - r} L${p.svgX},${p.svgY + r}`))
    const ring = document.createElementNS(ns, 'circle')
    ring.setAttribute('cx', p.svgX); ring.setAttribute('cy', p.svgY)
    ring.setAttribute('r', 4.8)
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', '#e11d48')
    ring.setAttribute('stroke-width', '1.8')
    cross.appendChild(ring)
    svg.appendChild(cross)

    host.appendChild(svg)
    const mapW = meta.value?.widthM ?? DETAIL_INSET_M
    const mapH = meta.value?.heightM ?? DETAIL_INSET_M
    attachInsetPanZoom(svg, p.svgX, p.svgY, mapW, mapH)
  }

  // viewBox-basert pan + zoom (ingen rotasjon) på detalj-inset-en. Et 500×500 m
  // vindu sentrert på long-press-punktet er roambart; start-visningen er
  // 250×250 m (= 25 % av arealet). Vektor-skarp ved enhver zoom siden vi
  // manipulerer viewBox, ikke en CSS-transform.
  function attachInsetPanZoom(svg, cx, cy, mapW, mapH) {
    const ASPECT = 16 / 9                  // matcher inset-boksen (aspect-[16/9])
    const WINDOW = DETAIL_INSET_M          // 1×1 km roambar utstrekning (m)
    const MIN_W = 40                       // maks zoom-inn (synlig bredde)
    // Alt D — kamera-clamp: den roambare regionen er snittet av 1 km-vinduet
    // rundt punktet OG de ekte kartgrensene (0…mapW × 0…mapH). Slik ser man
    // aldri tomrom utenfor kartet; nær en kant glir visningen innover og den
    // røde kart-rammen viser naturlig hvor kartet slutter.
    const rxMin = Math.max(0, cx - WINDOW / 2)
    const rxMax = Math.min(mapW, cx + WINDOW / 2)
    const ryMin = Math.max(0, cy - WINDOW / 2)
    const ryMax = Math.min(mapH, cy + WINDOW / 2)
    const regionW = Math.max(1, rxMax - rxMin)
    const regionH = Math.max(1, ryMax - ryMin)
    // Maks synlig bredde: fyll regionen, men hold 3:2-aspekt (ikke større enn
    // regionen i noen retning).
    const maxVw = () => Math.min(regionW, regionH * ASPECT)

    // Start-visning: ~600 m synlig bredde (v11.0.61 — var 350). Lavere start-zoom
    // gir rom til å zoome BÅDE inn (mot 40 m) OG ut (mot 1 km-vinduet); 350 m lå
    // nesten på maks-zoom-ut for et midt-kart, så det føltes som «kun innover».
    let vw = Math.min(maxVw(), 600)
    let vh = vw / ASPECT
    let vx = cx - vw / 2, vy = cy - vh / 2

    const clampApply = () => {
      vw = Math.max(MIN_W, Math.min(maxVw(), vw))
      vh = vw / ASPECT
      vx = Math.max(rxMin, Math.min(rxMax - vw, vx))
      vy = Math.max(ryMin, Math.min(ryMax - vh, vy))
      svg.setAttribute('viewBox', `${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`)
    }
    clampApply()

    const rect = () => svg.getBoundingClientRect()
    const zoomAt = (factor, clientX, clientY) => {
      const r = rect()
      if (!r.width || !r.height) return
      const relX = (clientX - r.left) / r.width
      const relY = (clientY - r.top) / r.height
      const fx = vx + relX * vw
      const fy = vy + relY * vh
      vw = vw / factor; vh = vw / ASPECT
      vx = fx - relX * vw
      vy = fy - relY * vh
      clampApply()
    }
    const panBy = (dxPx, dyPx) => {
      const r = rect()
      if (!r.width || !r.height) return
      vx -= (dxPx / r.width) * vw
      vy -= (dyPx / r.height) * vh
      clampApply()
    }
    const tdist = (e) => Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY)
    const tcenter = (e) => ({
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2 })

    svg.addEventListener('wheel', (e) => {
      e.preventDefault()
      zoomAt(e.deltaY > 0 ? 1 / 1.12 : 1.12, e.clientX, e.clientY)
    }, { passive: false })

    let dragging = false, lastX = 0, lastY = 0, pinchDist = 0
    svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { pinchDist = tdist(e); dragging = false }
      else if (e.touches.length === 1) { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY }
    }, { passive: false })
    svg.addEventListener('touchmove', (e) => {
      e.preventDefault()
      if (e.touches.length === 2) {
        const d = tdist(e)
        if (pinchDist > 0) { const c = tcenter(e); zoomAt(d / pinchDist, c.x, c.y) }
        pinchDist = d
      } else if (e.touches.length === 1 && dragging) {
        panBy(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY)
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY
      }
    }, { passive: false })
    svg.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) pinchDist = 0
      if (e.touches.length < 1) dragging = false
    })

    // Mus: dra for å panorere.
    svg.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return
      dragging = true; lastX = e.clientX; lastY = e.clientY
      try { svg.setPointerCapture(e.pointerId) } catch { /* noop */ }
    })
    svg.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerType !== 'mouse') return
      panBy(e.clientX - lastX, e.clientY - lastY)
      lastX = e.clientX; lastY = e.clientY
    })
    svg.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') dragging = false })
  }

  return { buildDetailInset }
}

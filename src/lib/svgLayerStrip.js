// Balansert fjerning av <g>-grupper fra en serialisert SVG-streng.
//
// En non-greedy regex (`<g …>[^]*?</g>`) kutter ved FØRSTE `</g>`. Har
// gruppa nestede <g> (hydro-stasjoner, annoteringer, spor) fjernes da to
// åpninger men bare én lukking → ubalansert XML. En blob med
// `image/svg+xml` hard-feiler på det (img.onerror), så 3D-teksturen falt
// til grå hillshade og eksporterte SVG-er kunne bli uåpnbare. Derfor
// skannes lukke-taggen med dybdeteller i stedet.
//
// Delt mellom 3D-teksturen (tour3d/mapTexture.js) og 2D-eksporten
// (printExport.js) — hold modulen fri for three/DOM-imports.

/** Fjern alle <g>-grupper hvis åpnings-tag matcher openRe, med balansert
 *  tag-skanning (gruppene kan ha nestede <g>). */
export function stripBalancedGroups(svg, openRe) {
  let out = svg
  let m
  while ((m = openRe.exec(out)) !== null) {
    const start = m.index
    const tagRe = /<\/?g\b[^>]*>/g
    tagRe.lastIndex = start + m[0].length
    let depth = 1
    let end = -1
    let t
    while ((t = tagRe.exec(out)) !== null) {
      if (t[0][1] === '/') depth--
      else if (!t[0].endsWith('/>')) depth++
      if (depth === 0) { end = tagRe.lastIndex; break }
    }
    if (end < 0) return out
    out = out.slice(0, start) + out.slice(end)
  }
  return out
}

/** Fjern <g id="…">-lag (runtime-overlays) balansert, ett id om gangen. */
export function stripGroupsById(svg, ids) {
  let out = svg
  for (const id of ids) {
    out = stripBalancedGroups(out, new RegExp(`<g\\b[^>]*id="${id}"[^>]*>`))
  }
  return out
}

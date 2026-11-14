// OPL-linjer fra `osmium cat -f opl` (etter add-locations-to-ways) → Overpass-
// formen flisene lagres i. Ren og testet; I/O bor i bygg-osm-fliser.mjs.
//
// OPL: én linje per objekt, felt skilt med mellomrom, hvert felt merket med én
// bokstav. Alt som ikke er trygt ASCII er skrevet som %hex% — også mellomrom,
// komma og likhetstegn inne i tagger og roller, så det er trygt å splitte på dem.

const avkod = (s) => s.includes('%')
  ? s.replace(/%([0-9a-fA-F]+)%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  : s

export function parseTags(felt) {
  if (!felt) return null
  const tags = {}
  for (const par of felt.split(',')) {
    if (!par) continue
    const i = par.indexOf('=')
    tags[avkod(i < 0 ? par : par.slice(0, i))] = i < 0 ? '' : avkod(par.slice(i + 1))
  }
  return tags
}

/** Way-noder med lokasjon: `n1x10.1y59.2,n2x…`. Noder uten lokasjon hoppes over. */
export function parseNoder(felt) {
  const ut = []
  if (!felt) return ut
  for (const n of felt.split(',')) {
    const x = n.indexOf('x')
    const y = n.indexOf('y', x)
    if (x < 0 || y < 0) continue
    const lon = n.slice(x + 1, y)
    const lat = n.slice(y + 1)
    if (!lon || !lat) continue
    ut.push({ lat: Number(lat), lon: Number(lon) })
  }
  return ut
}

export function parseMedlemmer(felt) {
  const ut = []
  if (!felt) return ut
  for (const m of felt.split(',')) {
    if (!m) continue
    const at = m.indexOf('@')
    ut.push({
      type: m[0] === 'n' ? 'node' : m[0] === 'w' ? 'way' : 'relation',
      ref: Number(m.slice(1, at < 0 ? undefined : at)),
      role: at < 0 ? '' : avkod(m.slice(at + 1)),
    })
  }
  return ut
}

/**
 * Én OPL-linje → { type, id, tags, lat/lon | nodeFelt | medlemmer }. Way-
 * geometrien parses IKKE her: de fleste way-ene i uttrekket er referanser som
 * aldri skal ut, og en parse per linje var det som kostet i en fullbake.
 */
export function parseLinje(linje) {
  const felter = linje.split(' ')
  const hode = felter[0]
  const type = hode[0] === 'n' ? 'node' : hode[0] === 'w' ? 'way' : hode[0] === 'r' ? 'relation' : null
  if (!type) return null
  const ut = { type, id: Number(hode.slice(1)), tags: null }
  for (let i = 1; i < felter.length; i++) {
    const f = felter[i]
    const v = f.slice(1)
    switch (f[0]) {
      case 'T': ut.tags = parseTags(v); break
      case 'x': ut.lon = v ? Number(v) : null; break
      case 'y': ut.lat = v ? Number(v) : null; break
      case 'N': ut.nodeFelt = v; break
      case 'M': ut.medlemmer = parseMedlemmer(v); break
    }
  }
  return ut
}

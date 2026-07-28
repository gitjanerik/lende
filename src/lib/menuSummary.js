// Undertekstene på hovedmenyens primærkort (v2.4.13): «12 lagrede · sist Håøya
// i går» og «5 ruter · 41 km planlagt». Rene funksjoner over listMaps()- og
// listGravelRoutes()-projeksjonene, så de er testbare uten IndexedDB.

// Relativ dag på norsk. «i dag»/«i går» for de to ferskeste døgnene, ellers
// «12. mar» (årstall bare når året er et annet enn nå). `now` injiseres i test.
export function relativeDayNo(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const n = new Date(now)
  // Sammenlign KALENDERDAGER, ikke timer: et kart lagret 23:50 er «i går»
  // klokka 00:10, ikke «i dag». Math.round tåler sommertids-skiftets ±1 time.
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((midnight(n) - midnight(d)) / 86400000)
  if (days <= 0) return 'i dag'
  if (days === 1) return 'i går'
  const opts = { day: 'numeric', month: 'short' }
  if (d.getFullYear() !== n.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('no-NO', opts)
}

// «12 lagrede · sist Håøya i går». Tom liste → oppfordring i stedet for «0».
export function mapsSummary(maps, now = Date.now()) {
  const n = maps?.length ?? 0
  if (!n) return 'Ingen lagrede kart ennå'
  const parts = [`${n} ${n === 1 ? 'lagret' : 'lagrede'}`]
  // listMaps() sorterer nyeste først.
  const newest = maps[0]
  const navn = (newest?.navn ?? '').trim()
  const when = relativeDayNo(newest?.opprettet, now)
  if (navn || when) parts.push(`sist ${[navn, when].filter(Boolean).join(' ')}`)
  return parts.join(' · ')
}

// «5 ruter · 41 km planlagt». Summen rundes til hele km over 10 km, ellers én
// desimal — 0,8 km skal ikke bli «1 km planlagt».
export function routesSummary(routes) {
  const n = routes?.length ?? 0
  if (!n) return 'Ingen ruter ennå'
  const parts = [`${n} ${n === 1 ? 'rute' : 'ruter'}`]
  const totalM = (routes ?? []).reduce(
    (sum, r) => sum + (Number.isFinite(r?.lengthM) ? r.lengthM : 0), 0)
  if (totalM > 0) {
    const km = totalM / 1000
    parts.push(`${km >= 10 ? Math.round(km) : km.toFixed(1).replace('.', ',')} km planlagt`)
  }
  return parts.join(' · ')
}

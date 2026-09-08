// «Hvor stort er kartet mitt, og hva koster det?» — ÉN kilde til de to tallene
// som beskriver et ark (v6.5.72).
//
// De ble tidligere regnet ut hver for seg i «Mine kart» og i info-arket, og de
// svarte ulikt: biblioteket viste flisas egen bredde som et KVADRAT fra halfKm
// (et 10 × 20 km-kart ble «10,0 × 10,0 km»), og MB-tallet gjaldt bare
// midtflisa — så det sto stille mens brukeren utvidet arket. Km-tallet beskrev
// altså arket og MB-tallet flisa, i samme setning.
//
// Regelen er derfor: BEGGE tallene gjelder det samme — hele arket, aktiv flis
// pluss naboene. Modulen er ren og enhetstestet; kallerne henter utstrekningen
// fra hver sin kilde (arkExtentFor i biblioteket, mosaikk-modellen i kartet).

/** Byte → «412 KB» / «12,4 MB». Norsk desimalkomma. null under 1 byte. */
export function formatKartBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Meter → km med én desimal og komma. */
export function formatKartKm(m) {
  return (m / 1000).toFixed(1).replace('.', ',')
}

/**
 * «10,0 × 20,0 km · 12,4 MB» — arkets mål og datamengde på én linje.
 * Deler som mangler utelates stille; alt som mangler gir tom streng.
 * `fliser` tas med bare når arket faktisk er mer enn én flis — «1 fliser» er
 * støy, og for et enkelt kart er målene selvforklarende.
 */
export function kartdataTekst({ widthM, heightM, bytes, fliser } = {}) {
  const deler = []
  if (widthM > 0 && heightM > 0) deler.push(`${formatKartKm(widthM)} × ${formatKartKm(heightM)} km`)
  const mb = formatKartBytes(bytes)
  if (mb) deler.push(mb)
  if (Number.isFinite(fliser) && fliser > 1) deler.push(`${fliser} fliser`)
  return deler.join(' · ')
}

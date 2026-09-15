// Soneinndelingen i UTM — den REGELEN, ikke projeksjonen.
//
// Fila finnes for å forklare, ikke for å projisere: `utm.js` regner koordinater
// og nordavvik, mens dette er svaret på «hvilken sone ville man normalt brukt
// her, og hvor ligger dens sentralmeridian». Lende projiserer hele landet i
// sone 32 uansett (se `wgs84ToUtm32`), så ingenting i kart-pipelinen spør denne
// fila — det er UtmSoneFigur i «Om appen» som gjør det, og et par tall i
// prosaen der.
//
// Ren og uten avhengigheter, slik at unntakene kan testes for seg. Og de MÅ
// testes: de to Norge/Svalbard-unntakene er nettopp det figuren skal vise, og
// en sonegrense som ligger feil er en påstand som ser helt normal ut.

export const SONE_BREDDE_DEG = 6

// Sonen Lende faktisk bruker, overalt. Se «Nord er nord» i AboutContent.
export const LENDE_SONE = 32

/** Sentralmeridianen i sone n, i grader øst. Sone 32 → 9°. */
export function sentralmeridian(sone) {
  return sone * SONE_BREDDE_DEG - 183
}

/**
 * Sonen et punkt normalt hører hjemme i — med begge de kjente unntakene.
 *
 * Sørvestlandet: sone 32 er strukket vestover til 3° mellom 56° og 64° nord, så
 * en grense ikke skal dele kysten. Uten det ville Bergen ligget i sone 31.
 *
 * Svalbard: fire soner à 9°/12° i stedet for seks à 6° mellom 72° og 84° nord,
 * så 32, 34 og 36 finnes ikke der oppe i det hele tatt.
 */
export function utmSone(lat, lon) {
  const la = Number(lat), lo = normaliserLengde(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (la >= 72 && la < 84) {
    if (lo >= 0 && lo < 9) return 31
    if (lo >= 9 && lo < 21) return 33
    if (lo >= 21 && lo < 33) return 35
    if (lo >= 33 && lo < 42) return 37
  }
  if (la >= 56 && la < 64 && lo >= 3 && lo < 12) return 32
  return Math.min(60, Math.max(1, Math.floor((lo + 180) / SONE_BREDDE_DEG) + 1))
}

/**
 * Sonebåndene mellom `fra` og `til` grader øst, slik de FAKTISK ligger på denne
 * breddegraden. Det er her unntakene blir synlige: figuren tegner det denne
 * returnerer, så en grense som flytter seg når man drar nordover er regelen selv
 * og ikke en tegning av den.
 */
export function sonebaand(lat, fra = 0, til = 36) {
  const ut = []
  const steg = 0.25
  for (let lo = fra; lo < til - 1e-9; lo += steg) {
    const s = utmSone(lat, lo + steg / 2)
    const siste = ut[ut.length - 1]
    if (siste && siste.sone === s) siste.til = Math.min(til, lo + steg)
    else ut.push({ sone: s, fra: lo, til: Math.min(til, lo + steg), sentral: sentralmeridian(s) })
  }
  return ut
}

/**
 * Nordavviket som tekst: tallet og ordet hver for seg, så kallstedet kan sette
 * dem i hver sin flate. Fortegnet bæres av ORDET og ikke av et minustegn — det
 * er samme regel som himmel-undertekstene i 3D, og av samme grunn: «1,5° mot
 * vest» leses, «−1,5°» må tolkes.
 */
export function avvikTekst(deg) {
  const d = Number(deg)
  if (!Number.isFinite(d)) return { tall: '0,0°', retning: '', hel: '0,0°' }
  const tall = Math.abs(d).toFixed(1).replace('.', ',') + '°'
  const retning = Math.abs(d) < 0.05 ? '' : (d > 0 ? 'mot øst' : 'mot vest')
  return { tall, retning, hel: retning ? `${tall} ${retning}` : tall }
}

function normaliserLengde(lon) {
  const lo = Number(lon)
  if (!Number.isFinite(lo)) return NaN
  return ((lo + 180) % 360 + 360) % 360 - 180
}

// Steder som viser HVER SIN ting, ikke en geografi-liste: Bergen er unntaket som
// flytter en sonegrense, Oslo er fortegnet som snur, Tromsø og Vardø er prisen
// Lende betaler for å bli i sone 32, og Longyearbyen er Svalbard-inndelingen.
export const STEDER = [
  { navn: 'Bergen', lat: 60.39, lon: 5.32 },
  { navn: 'Oslo', lat: 59.91, lon: 10.75 },
  { navn: 'Trondheim', lat: 63.43, lon: 10.40 },
  { navn: 'Tromsø', lat: 69.65, lon: 18.96 },
  { navn: 'Vardø', lat: 70.37, lon: 31.10 },
  { navn: 'Longyearbyen', lat: 78.22, lon: 15.63 },
]

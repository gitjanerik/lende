// Regnestykkene bak desktop-navigasjonen: zoom-skyven og retningsrosa.
//
// HVORFOR EN EGEN, REN FIL: prosjektet kan ikke enhetsteste en Vue-komponent
// (se «Arkitektur-gjeld» i CLAUDE.md), og det som kan være FEIL her er nettopp
// tallene — en logaritme med feil grunnlinje gir en skyv der halve området
// ligger i de siste ti prosentene, og et ombyttet fortegn i rosa sender kartet
// motsatt vei av fingeren. Komponentene er kabling; regelen bor her.

/**
 * Zoom-skyven er LOGARITMISK, og det er ikke en detalj.
 *
 * Kart-skalaen spenner 0,06–60, altså tre tierpotenser. Lineært ville 1× —
 * hele oversikten, og det man er innom oftest — ligget på 1,6 % av skyven, og
 * hele den nedre halvdelen av området vært umulig å treffe. Logaritmisk gir
 * hvert HALVERINGS-/DOBLINGS-steg like mye plass, som er slik zoom oppleves.
 *
 * @param {number} skala
 * @param {number} min
 * @param {number} maks
 * @returns {number} 0…1
 */
export function zoomBroek(skala, min, maks) {
  if (!(min > 0) || !(maks > min) || !Number.isFinite(skala)) return 0
  const s = Math.max(min, Math.min(maks, skala))
  return Math.log(s / min) / Math.log(maks / min)
}

/**
 * Inversen av `zoomBroek`.
 * @param {number} broek 0…1
 * @param {number} min
 * @param {number} maks
 * @returns {number} skala
 */
export function zoomFraBroek(broek, min, maks) {
  if (!(min > 0) || !(maks > min) || !Number.isFinite(broek)) return min
  const f = Math.max(0, Math.min(1, broek))
  return min * Math.pow(maks / min, f)
}

// Under denne avstanden fra rosas senter har pekeren ingen RETNING — atan2(0,0)
// er 0, altså nord, og en finger som passerer midten ville snurret kartet dit
// på veien. Da beholder vi azimuten vi står i og endrer bare høyden.
const DODSONE_PX = 5

/**
 * Peker-posisjon i rosa → blikkretning.
 *
 * ROSA ER HIMMELHVELVET SETT OVENFRA: senter er rett opp (senit), randen er
 * rett ned, og horisonten er en ring et stykke inne. Å dra pucken innover er
 * derfor å løfte blikket, og utover er å legge seg på magen og se ned på kartet
 * — samme bevegelse man gjør med fingeren i selve 3D-bildet.
 *
 * @param {number} dx piksler fra senter, mot høyre
 * @param {number} dy piksler fra senter, NEDOVER (skjermens retning)
 * @param {number} radius rosas radius i piksler
 * @param {{minHoyde?: number, maksHoyde?: number, hoyde?: boolean}} [opts]
 *   hoyde=false for kart-modus, der rosa bare er en kompass-skive.
 * @returns {{azimut: number|null, hoyde: number|null}} grader; null = «uendret»
 */
export function roseTilRetning(dx, dy, radius, opts = {}) {
  const { minHoyde = -85, maksHoyde = 74, hoyde: hoydeAktiv = true } = opts
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radius > 0)) {
    return { azimut: null, hoyde: null }
  }
  const lengde = Math.hypot(dx, dy)
  // Skjermen har nord OPP, altså mot negativ y. Azimut vokser med klokka
  // (nord → øst), som et kompass.
  const azimut = lengde < DODSONE_PX ? null : normaliserGrader(Math.atan2(dx, -dy) * 180 / Math.PI)
  if (!hoydeAktiv) return { azimut, hoyde: null }
  const f = Math.max(0, Math.min(1, lengde / radius))
  return { azimut, hoyde: maksHoyde - f * (maksHoyde - minHoyde) }
}

/**
 * Blikkretning → pucken sin plass i rosa. Inversen av `roseTilRetning`.
 *
 * @param {number} azimut grader, 0 = nord
 * @param {number} hoyde grader over horisonten
 * @param {number} radius piksler
 * @param {{minHoyde?: number, maksHoyde?: number, hoyde?: boolean}} [opts]
 * @returns {{x: number, y: number}} piksler fra senter (y nedover)
 */
export function retningTilRose(azimut, hoyde, radius, opts = {}) {
  const { minHoyde = -85, maksHoyde = 74, hoyde: hoydeAktiv = true } = opts
  const a = (Number.isFinite(azimut) ? azimut : 0) * Math.PI / 180
  const f = hoydeAktiv ? hoydeBroek(hoyde, minHoyde, maksHoyde) : 1
  const r = (radius > 0 ? radius : 0) * f
  return { x: r * Math.sin(a), y: -r * Math.cos(a) }
}

/**
 * Hvor stor andel av radien en gitt blikkhøyde ligger på. Egen funksjon fordi
 * KOMPONENTEN trenger den til horisont-ringen: uten en synlig horisont er det
 * ikke til å gjette at innsida er himmel og utsida er bakke.
 *
 * @returns {number} 0 (senit, senter) … 1 (rett ned, randen)
 */
export function hoydeBroek(hoyde, minHoyde = -85, maksHoyde = 74) {
  if (!(maksHoyde > minHoyde)) return 1
  const h = Math.max(minHoyde, Math.min(maksHoyde, Number.isFinite(hoyde) ? hoyde : 0))
  return (maksHoyde - h) / (maksHoyde - minHoyde)
}

/** Grader inn i (−180, 180]. */
export function normaliserGrader(deg) {
  if (!Number.isFinite(deg)) return 0
  let d = deg % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

// Fokusfella — regelen, uten DOM.
//
// En modal som ikke holder på fokus er en modal bare for musa: Tab vandrer ut i
// sida under, som fortsatt er der, og skjermleseren leser opp et grensesnitt
// brukeren ikke kan se. Regelen er enkel nok til å bo alene, og da kan den
// testes uten en nettleser — wiringen (`useFokusFelle`) er bare lyttere.

/** CSS-utvalget som fanger det nettleseren faktisk lar Tab treffe. `-1` er ute
 *  med vilje: et element med tabindex="-1" kan fokuseres programmatisk, men er
 *  ikke i Tab-rekka, og en felle som stoppet der ville hoppet over knappen
 *  etter. */
export const FOKUSERBART = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
  '[tabindex]', 'audio[controls]', 'video[controls]', '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',')

/** Hvem av kandidatene er faktisk i Tab-rekka nå. `synlig` er en callback så
 *  regelen kan testes uten layout — i nettleseren er den offsetParent-sjekken. */
export function tabbbare(kandidater, synlig) {
  return [...kandidater].filter((el) => {
    if (el.disabled) return false
    if (el.getAttribute?.('aria-hidden') === 'true') return false
    if (Number(el.getAttribute?.('tabindex')) < 0) return false
    return synlig(el)
  })
}

/**
 * Hvor Tab skal lande, gitt hvem som har fokus nå.
 * Returnerer null når nettleserens egen oppførsel er riktig — altså midt inne i
 * lista, der vi ikke skal blande oss.
 */
export function nesteFokus(liste, aktiv, bakover) {
  if (!liste.length) return null
  const i = liste.indexOf(aktiv)
  // Fokus er utenfor fella (eller ingensteds): dra det inn i riktig ende.
  if (i === -1) return bakover ? liste[liste.length - 1] : liste[0]
  if (bakover && i === 0) return liste[liste.length - 1]
  if (!bakover && i === liste.length - 1) return liste[0]
  return null
}

// Myk tekst-rotasjon — beslutningene bak at stedsnavn følger kartet MENS man
// roterer, i stedet for å vippe med og snappe opp når fingrene slipper.
//
// HVORFOR DETTE ER EN AVVEINING OG IKKE BARE «fjern if-en»: under en gest er
// kart-diven promotert til et composited lag (will-change: transform i
// MapView), så selve rotasjonen er gratis — compositoren snurrer en ferdig
// tekstur. I det vi skriver en ny transform på tekstene, blir laget skittent og
// HELE SVG-en må rasteriseres på nytt hver frame. Kostnaden vokser med arket:
// et 2 km-kart med culling på er noen hundre labels, en 3x3-mosaikk uten er
// tusenvis. Det er nettopp den kostnaden `isGesturing`-hoppet unngikk.
//
// Derfor er svaret MÅLT og ikke gjettet (samme regel som skyene og
// knappenålene i CLAUDE.md): vi kjører live, tar tida på hvert pass, og gir opp
// hvis passene ikke får plass i et frame-budsjett. Da faller vi tilbake til den
// gamle oppførselen — labels vipper med kartet og rettes opp ved gest-slutt —
// i stedet for å levere hakking.
//
// Budsjettet er KUMULATIVT og lever så lenge kartet gjør: en telefon som
// hakket to ganger skal ikke prøve på nytt ved hver eneste gest.

// Under en gest endrer usePinchZoom rotasjonen i steg på minst 1,5° (dødsonen
// mot skjelving), så terskelen her handler om noe annet: flere touchmove-
// eventer kan lande i samme frame, og da skal vi skrive ÉN gang. Vi
// sammenlikner mot sist SKREVNE vinkel, ikke mot forrige event.
export const ROT_TERSKEL_GRAD = 0.4

// 8 ms av et 16,7 ms-budsjett. Resten av framen skal fortsatt rekke
// rasteriseringen — et pass som alene spiser halve framen er allerede for dyrt.
export const PASS_BUDSJETT_MS = 8
export const MAKS_OVERSKRIDELSER = 2

/**
 * Er rotasjonen endret nok til at det er verdt å skrive om transformene?
 * `forrige === null` betyr «ingenting skrevet ennå» og er alltid sant.
 */
export function rotasjonEndret(forrige, naa, terskel = ROT_TERSKEL_GRAD) {
  if (forrige == null || !Number.isFinite(forrige)) return true
  return Math.abs(naa - forrige) >= terskel
}

/**
 * Frame-budsjettet for de live passene. `registrer(ms)` returnerer om live-
 * modus fortsatt er i live, så kallstedet kan slå av i samme setning som det
 * måler.
 */
export function lagRotasjonsBudsjett({
  budsjettMs = PASS_BUDSJETT_MS,
  maksOverskridelser = MAKS_OVERSKRIDELSER,
} = {}) {
  let overskridelser = 0
  let verstMs = 0
  let pass = 0
  return {
    registrer(ms) {
      pass++
      if (ms > verstMs) verstMs = ms
      if (ms > budsjettMs) overskridelser++
      return overskridelser < maksOverskridelser
    },
    erAktiv: () => overskridelser < maksOverskridelser,
    nullstill() { overskridelser = 0; verstMs = 0; pass = 0 },
    status: () => ({ pass, verstMs, overskridelser, budsjettMs, maksOverskridelser }),
  }
}

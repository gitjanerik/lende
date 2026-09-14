/**
 * kartFlate.js — flatene som ligger PÅ kartet, og blekket som leses av dem.
 *
 * HVORFOR DETTE FINNES (v7.8.18). Kompassnåla har hatt sin egen skive siden
 * v6.5.67: en halvgjennomsiktig hvit (eller zink-grå) rundskive med varmt
 * mørkt blekk. Snarvei-raden hadde en HELT ANNEN flate — `bg-overlay/90`, som
 * er UI-temaets token og altså nesten svart i mørkt tema. To flater som ligger
 * side om side over det samme arket, med hver sin regel, og eieren så det:
 * raden og nåla matchet ikke.
 *
 * TO TING SKILTE DEM, og bare den ene var fargen:
 *
 *   1. VERDIEN. Nåla er `rgba(255,255,255,0.82)`; raden var `#09090b` på 90 %.
 *   2. HVA DE FØLGER — og dette er det viktige. Nåla følger KARTET (`mork` =
 *      arkets valør), raden fulgte UI-TEMAET. Det er to ulike spørsmål: man kan
 *      godt lese et lyst kart i mørkt UI-tema, og da var nåla lys og raden
 *      svart. Å bare kopiere hex-en over ville altså latt dem sprike igjen i
 *      nøyaktig den situasjonen `mork`-propen finnes for.
 *
 * Derfor bor paret her, i ÉN ren modul, og begge flatene spør den. Skal en
 * tredje ting legge seg på arket, spør den samme funksjonene.
 *
 * ALFAEN ER IKKE PYNT. En ugjennomsiktig flate blir en klistrelapp på kartet;
 * på 0,82 leses den som en del av arket, og terrenget under aner man.
 *
 * Ren modul: ingen DOM, ingen Vue, ingen farge-logikk utenfor tabellen.
 */

/** Skiva — flata som legger seg på arket. Alfaen er bakt inn. */
export const KART_SKIVE = {
  lys:  'rgba(255,255,255,0.82)',
  mork: 'rgba(63,63,70,0.82)',
}

/**
 * Skiva UTEN alfa — bare til tekst som står PÅ blekket, altså motsatt vei av
 * alt annet her («Ferdig»-knappen i sorterings-modus er den ene i dag).
 *
 * En halvgjennomsiktig tekstfarge over en ugjennomsiktig flate slipper flata
 * under gjennom bokstavene, og et ord i 11 px tåler ikke det. Verdien er
 * skivas egen kjerne, så paret leses som samme materiale snudd.
 */
export const KART_SKIVE_OPAK = {
  lys:  '#ffffff',
  mork: '#3f3f46',
}

/**
 * Blekket som leses av skiva, i tre nivåer.
 *
 * Nivåene er samme idé som `--color-ink-2/-3` i style.css og finnes av samme
 * grunn: hierarki skrevet som OPASITET komponerer mot ulik bunn i de to
 * valørene, så «tredje nivå» ville vært to ulike kontraster med ett navn. Faste
 * farger per valør, målt i `kartFlate.test.js` mot de ytterste kart-bunnene
 * katalogen har — den lyseste av de mørke arkene og den mørkeste av de lyse.
 *
 * Bare `ink` og de to nivåene brukes; et fjerde ville vært et nivå ingen flate
 * har bruk for og en verdi ingen måler.
 */
export const KART_BLEKK = {
  lys:  { ink: '#1c1917', ink2: '#443f3b', ink3: '#5c554f' },
  mork: { ink: '#e4e4e7', ink2: '#c2c2c8', ink3: '#a6a6ae' },
}

/** Skiva for arkets valør. `mork` er KARTETS tone, ikke UI-temaets. */
export function kartSkive(mork) {
  return mork ? KART_SKIVE.mork : KART_SKIVE.lys
}

/** Skivas ugjennomsiktige kjerne — til tekst som står på blekket. */
export function kartSkiveOpak(mork) {
  return mork ? KART_SKIVE_OPAK.mork : KART_SKIVE_OPAK.lys
}

/** Blekk-nivåene for arkets valør. `mork` er KARTETS tone, ikke UI-temaets. */
export function kartBlekk(mork) {
  return mork ? KART_BLEKK.mork : KART_BLEKK.lys
}

// panIntensjon.js — panorerer brukeren MÅLRETTET i én retning, eller bare fikler?
//
// Kontinuerlig flis-lasting må svare på ett spørsmål før den bruker nett og
// batteri: er dette en reise mot noe, eller er det småjustering rundt der man
// allerede er? Geometrien alene svarer ikke — et skjermsenter som glir 30 m mot
// nordøst ser likt ut enten brukeren er på vei ut av arket eller bare retter opp
// et bomtrykk. Forskjellen ligger i FORLØPET: samme retning, langt nok, uten
// altfor lange opphold.
//
// Derfor denne lille tilstandsmaskinen. Den er ren aritmetikk (ingen Vue, ingen
// timere) fordi tersklene er det eneste her som er verdt å teste — timeren for
// dvele bor hos konsumenten, som er den som vet når skjermen faktisk står i ro.

// Under dette regnes en prøve som støy og anker-punktet står stille — slik at en
// langsom drag i mange små steg fortsatt akkumulerer riktig.
export const DODSONE_FRAC = 0.02      // × flisbredde
// Konusen er hysteresen: så lenge de nye stegene peker innenfor ±30° av den
// løpende retningen, er det samme reise. Kvantiserer vi til oktanter FØR vi
// sammenligner, ville hvert eneste sprang over en oktant-grense (45°) telle som
// retningsskifte, og en litt buet panorering aldri bli moden.
export const KONUS_GRADER = 60        // total åpning; > halvparten fra løpende retning = skifte
// Hvor langt drag som skal til før reisen regnes som målrettet. Var 0.40 i
// v5.19.0 — 3,2 km på et 8 km-ark, og det er MYE når man er zoomet inn, der en
// full skjermbredde med drag bare flytter senteret noen hundre meter. Terskelen
// er ikke det som beskytter mot utilsiktet bygging uansett; det gjør
// «naerKant»-gaten hos konsumenten, som krever at du faktisk er på vei UT av
// arket. Denne skiller bare reise fra fikling.
export const MODEN_DRAG_FRAC = 0.25   // × flisbredde akkumulert i samme oktant
// Hvor lenge skjermen må stå i ro før konsumenten regner intensjonen som «her
// vil jeg være» og handler på den.
export const DVELE_MS = 1200
// Et opphold lengre enn dette er ikke en pause i samme bevegelse, det er en ny
// bevegelse — brukeren har sett seg om og bestemt seg på nytt.
//
// Var 2500 i v5.19.0, og det var for stramt for hvordan folk faktisk panorerer:
// dra, stopp og se, dra videre. Med 2,5 s ble akkumulatoren nullstilt mellom
// hvert drag, og en reise mot arkkanten ble aldri moden. Merk at en pause i seg
// selv ikke koster noe — dvele-timeren (1,2 s) har alt forsøkt å bygge når det
// har gått så lenge — så denne verdien styrer bare om et AVVIST forsøk kan
// fortsette å samle opp når brukeren drar videre.
export const MAKS_PAUSE_MS = 8000

// Kompass-retningen til et delta, i grader (0 = nord, med klokka). SVG-y vokser
// NEDOVER, så nord er NEGATIV dy — derfor atan2(dx, −dy) og ikke atan2(dy, dx).
function retningGrader(dx, dy) {
  const g = Math.atan2(dx, -dy) * 180 / Math.PI
  return g < 0 ? g + 360 : g
}

// Korteste vinkelavstand mellom to kompass-retninger (0–180).
function vinkelAvvik(a, b) {
  return Math.abs(((a - b) % 360 + 540) % 360 - 180)
}

/**
 * Delta i kart-meter → oktant 0..7, eller null når bevegelsen er under dødsonen.
 *
 * Indekseringen er MED VILJE den samme som `EDGE_DIRS` i useMapExtend
 * (['N','NE','E','SE','S','SW','W','NW']), slik at `EDGE_DIRS[oktant]` gir
 * retningen kant-utvidelsen skal bygge i — uten en oversettelsestabell som kan
 * komme i utakt. Grensene runder MED KLOKKA: nøyaktig 22,5° er NØ, ikke N.
 */
export function oktantFraDelta(dx, dy, dodsoneM = 0) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (Math.hypot(dx, dy) < dodsoneM) return null
  if (dx === 0 && dy === 0) return null
  return Math.round(retningGrader(dx, dy) / 45) % 8
}

/** Fersk, tom intensjon. Ingen løpende retning, ingen akkumulert vei. */
export function nyIntensjon() {
  return {
    oktant: null,          // løpende retning (0..7) eller null
    retningGrader: null,   // samme retning ukvantisert — konusen måles mot denne
    akkumulert: 0,         // meter tilbakelagt i den retningen
    moden: false,          // har 'moden' alt fyrt for denne intensjonen?
    sistX: null,
    sistY: null,
    sistBevegelseT: null,  // tidspunkt for siste prøve OVER dødsonen
  }
}

/**
 * Ta imot en ny prøve av synlig sentrum og returner neste tilstand + hendelsen
 * den utløste. Muterer ikke `state` — konsumenten bytter selv ut referansen.
 *
 * @param {object} state  fra nyIntensjon() eller forrige kall
 * @param {{x:number, y:number, t:number}} prove  synlig sentrum i kartets
 *        meter-rom (IKKE skjerm-px — zoom skal ikke endre tersklene) og ms
 * @param {{flisBreddeM:number, flisHoydeM?:number}} cfg
 * @returns {{neste:object, hendelse:'ingen'|'retningsskifte'|'moden'}}
 */
export function oppdaterIntensjon(state, prove, cfg) {
  const s = state ?? nyIntensjon()
  const W = cfg?.flisBreddeM
  // Tersklene måles i FLISBREDDER, også loddrett — flisene er ikke kvadratiske
  // (A-format), og med hver sin målestokk på de to aksene ville en diagonal drag
  // blitt bedømt strengere nordover enn østover. cfg.flisHoydeM er med i
  // kontrakten fordi konsumenten har den, men tersklene er isotrope med vilje.
  if (!Number.isFinite(W) || W <= 0 || !prove || !Number.isFinite(prove.x) || !Number.isFinite(prove.y)) {
    return { neste: { ...s }, hendelse: 'ingen' }
  }
  const t = Number.isFinite(prove.t) ? prove.t : (s.sistBevegelseT ?? 0)
  const dodsone = DODSONE_FRAC * W
  const modenTerskel = MODEN_DRAG_FRAC * W

  // Første prøve: bare anker-punktet, ingenting å måle mot ennå.
  if (s.sistX == null || s.sistY == null) {
    return {
      neste: { ...s, sistX: prove.x, sistY: prove.y, sistBevegelseT: t },
      hendelse: 'ingen',
    }
  }

  const dx = prove.x - s.sistX
  const dy = prove.y - s.sistY
  const lengde = Math.hypot(dx, dy)
  const pause = s.sistBevegelseT == null ? 0 : t - s.sistBevegelseT
  const forGammel = pause > MAKS_PAUSE_MS

  // Under dødsonen: anker-punktet står, så neste prøve måles fra samme sted og
  // en langsom drag i mange småsteg går ikke tapt. Men et for langt opphold
  // avslutter intensjonen uansett hvor lite som skjedde.
  if (lengde < dodsone) {
    if (!forGammel) return { neste: { ...s }, hendelse: 'ingen' }
    return {
      neste: { ...nyIntensjon(), sistX: prove.x, sistY: prove.y, sistBevegelseT: t },
      hendelse: 'retningsskifte',
    }
  }

  const grader = retningGrader(dx, dy)
  const oktant = Math.round(grader / 45) % 8
  const skifte = forGammel ||
    (s.oktant != null && vinkelAvvik(grader, s.retningGrader) > KONUS_GRADER / 2)

  // Retningsskifte: akkumulatoren nullstilles og den nye etappen begynner her.
  // 'moden' vurderes ikke i samme prøve — hendelses-sporet har plass til én ting,
  // og neste prøve i samme retning tar den.
  if (skifte) {
    return {
      neste: {
        oktant, retningGrader: grader, akkumulert: lengde, moden: false,
        sistX: prove.x, sistY: prove.y, sistBevegelseT: t,
      },
      hendelse: 'retningsskifte',
    }
  }

  // Samme reise (eller den aller første etappen): legg veien til.
  const fersk = s.oktant == null
  const akkumulert = (fersk ? 0 : s.akkumulert) + lengde
  const neste = {
    // Den løpende retningen settes av etappen som startet reisen og flyttes
    // ikke etterpå; ellers kunne kartet dreie fritt i små steg innenfor konusen.
    oktant: fersk ? oktant : s.oktant,
    retningGrader: fersk ? grader : s.retningGrader,
    akkumulert,
    moden: s.moden || akkumulert >= modenTerskel,
    sistX: prove.x, sistY: prove.y, sistBevegelseT: t,
  }
  return { neste, hendelse: neste.moden && !s.moden ? 'moden' : 'ingen' }
}

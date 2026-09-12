// Parallell flisbygging — ren, og delt av kant-utvidelsen (`extendMap`) og
// «Fyll hullene» / «Gjør arket firkantet» (`byggCeller`) i useMapExtend.
//
// Fram til v7.8.8 bygde begge løkkene flisene SERIELT (`for … await`): et trykk
// på en hjørnepil med tre nye fliser var tre fulle pipeliner etter hverandre,
// og Overpass er 81–97 % av hver. Nå kjøres høyst BYGG_SAMTIDIG i flukt.
//
// TAKET ER TO, OG DET ER OVERPASS SIN GRENSE, IKKE VÅR. Hvert bygg kappløper
// alt to speil (overpassClient), så to bygg er fire samtidige forespørsler mot
// tjenester som svarer 429 når én IP har for mange i gang — og hver 429 spiser
// ett av tre forsøk med backoff. Tre i flukt ville altså kostet retries på
// nøyaktig den hentingen som dominerer. Prisen på telefonen er to workere og to
// DEM-er i minnet samtidig; gevinsten ligger i nettventinga.
export const BYGG_SAMTIDIG = 2

/**
 * Kjører `oppgaver` — funksjoner som får sin indeks og returnerer et promise —
 * med høyst `tak` i flukt. De startes i rekkefølge, og en ledig plass tar neste.
 * Ingen ny oppgave startes etter at `signal` er avbrutt; de som alt er i gang
 * må selv høre på signalet. Svaret er én rad per oppgave, i samme rekkefølge
 * som inn:
 *
 *   { status: 'ok', verdi } | { status: 'feil', feil } | { status: 'avbrutt' }
 *
 * En oppgave som kaster AbortError regnes som AVBRUTT og ikke feilet — kalleren
 * skal ikke telle brukerens eget trykk på X som en feil.
 */
export async function kjorMedTak(oppgaver, { tak = BYGG_SAMTIDIG, signal, onStart, onSlutt } = {}) {
  const utfall = new Array(oppgaver.length)
  let neste = 0
  async function arbeider() {
    while (neste < oppgaver.length) {
      const i = neste++
      if (signal?.aborted) { utfall[i] = { status: 'avbrutt' }; continue }
      onStart?.(i)
      try {
        const verdi = await oppgaver[i](i)
        utfall[i] = { status: 'ok', verdi }
      } catch (feil) {
        utfall[i] = feil?.name === 'AbortError' ? { status: 'avbrutt' } : { status: 'feil', feil }
      } finally {
        onSlutt?.(i)
      }
    }
  }
  const plasser = Math.max(1, Math.min(Math.floor(tak) || 1, oppgaver.length))
  await Promise.all(Array.from({ length: plasser }, arbeider))
  return utfall
}

// «1–3» for sammenhengende, «1 og 3» / «1, 2 og 4» ellers. Tom liste → ''.
export function indeksTekst(indekser) {
  const s = [...indekser].sort((a, b) => a - b)
  if (!s.length) return ''
  if (s.length === 1) return String(s[0])
  const sammenhengende = s.every((v, i) => i === 0 || v === s[i - 1] + 1)
  if (sammenhengende) return `${s[0]}–${s[s.length - 1]}`
  return `${s.slice(0, -1).join(', ')} og ${s[s.length - 1]}`
}

/**
 * Teksten bygge-chipen viser. `ord` = { stor: 'Utsnitt', liten: 'utsnitt',
 * en: 'Bygger nytt utsnitt …' }; `paagaar` er 1-baserte indekser i flukt.
 * ÉN flis gir nøyaktig tekstene fra før parallelliseringen (ingen prefiks).
 * Flere gir spennet som bygges: «Bygger utsnitt 1–2 av 3 …», og med melding
 * «Utsnitt 1–2/3: Henter kartdata …».
 */
export function byggeStatusTekst({ ord, total, paagaar, melding = '' }) {
  const spenn = total > 1 ? indeksTekst(paagaar) : ''
  if (!spenn) return melding || ord.en
  return melding
    ? `${ord.stor} ${spenn}/${total}: ${melding}`
    : `Bygger ${ord.liten} ${spenn} av ${total} …`
}

/**
 * Framdrifts-samler for flere bygg i flukt. Hvert bygg melder på sin indeks,
 * og teksten viser spennet som pågår pluss den FERSKESTE meldinga fra et bygg
 * som FORTSATT pågår. Ikke bare den siste som kom: den kan være «Bygger SVG …»
 * fra et bygg som nettopp ble ferdig, mens naboen fortsatt henter kartdata.
 * `vis` kalles med teksten hver gang den endrer seg; ingenting vises når det
 * siste bygget er ferdig — da er det kalleren som rydder chipen.
 */
export function lagFramdrift({ ord, total, vis }) {
  const paagaar = new Set()
  const meldinger = new Map()   // indeks → { tekst, t }
  let t = 0
  function tekst() {
    let beste = null
    for (const i of paagaar) {
      const m = meldinger.get(i)
      if (m && (!beste || m.t > beste.t)) beste = m
    }
    return byggeStatusTekst({
      ord, total, paagaar: [...paagaar].map(i => i + 1), melding: beste?.tekst ?? '',
    })
  }
  const oppdater = () => vis(tekst())
  return {
    onStart(i) { paagaar.add(i); oppdater() },
    onSlutt(i) { paagaar.delete(i); meldinger.delete(i); if (paagaar.size) oppdater() },
    onProgress(i, melding) { meldinger.set(i, { tekst: melding, t: ++t }); oppdater() },
    tekst,
  }
}

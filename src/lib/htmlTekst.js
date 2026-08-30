// Strip HTML ut av fritekst fra eksterne kilder.
//
// Kulturminnesøk-tekstene er skrevet av BRUKERE i et redigeringsfelt som slipper
// gjennom markup, og API-et leverer den rått. Beskrivelsen av Charlottenborg gård
// kom ut med et synlig «<br />» på hver eneste linje — teksten var uleselig uten at
// noe var galt med hentingen. Vi kan ikke rendre markupen (den er ukjent HTML fra
// et fritekstfelt, altså en injeksjonsflate), så vi TAR DEN BORT.
//
// Reglene, i den rekkefølgen de kjøres:
//   1. `<br>` (alle skrivemåter) og blokk-tagger blir LINJESKIFT — det er den ene
//      formateringen som bærer mening i en beskrivelse. Uten blokk-taggene ville
//      to avsnitt limt seg sammen til én setning.
//   2. `<img>` fjernes HELT. En bildelenke i teksten peker på et opphav vi verken
//      har hentet eller kan nå offline, og en brukket bilderamme er verre enn
//      ingen. Bildene vi FAKTISK viser kommer fra `bilder`-feltet, ikke herfra.
//   3. Alt annet (fet, kursiv, farger, fontstørrelse, lenker, tabeller) mistes
//      stille — teksten består, formateringen ignoreres, som bestilt.
//
// Entiteter dekodes FØR taggene fjernes, så en dobbeltkodet kilde
// («&lt;br /&gt;», som er nøyaktig det Kulturminnesøk lagrer når brukeren limer
// inn HTML) ikke slipper gjennom som synlig markup. Prisen er at prosa som
// bevisst skriver «&lt;noe&gt;» mister vinkelparentesene; det har vi aldri sett i
// disse kildene, mens synlig markup ser vi hele tiden.

const ENTITETER = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', deg: '°',
}

// Tagger der ÅPNING eller LUKKING betyr «ny linje», i to klasser. Et avsnitt
// («</p><p>») skal ha en TOM linje mellom seg, et listepunkt («</li><li>») bare
// ett linjeskift — ellers blir en punktliste dobbelt så høy som den skal.
const AVSNITT = 'p|div|h[1-6]|blockquote|section|article|pre|hr|table|tr'
const LINJE = 'li|ul|ol|td|th|dl|dt|dd'
// Merkelapper vi setter i stedet for taggene, så vi kan slå sammen NABO-tagger
// («</li><li>» er én overgang, ikke to) før de blir ekte linjeskift. `<br>` blir
// derimot ett linjeskift PER tagg — to på rad er brukerens egen tomme linje.
const AVSNITT_MERKE = '\u0001'
const LINJE_MERKE = '\u0002'
const BILDE_MERKE = '\u0003'

/**
 * Dekod HTML-entiteter (navngitte + numeriske) til tegn.
 * @param {string} s
 * @returns {string}
 */
export function decodeHtmlEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (Object.hasOwn(ENTITETER, n) ? ENTITETER[n] : m))
}

/**
 * Fjern HTML fra en fritekst. `<br>` og blokk-tagger blir linjeskift, `<img>`
 * forsvinner, all annen formatering ignoreres. Ren tekst kommer uendret ut.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function stripHtml(raw) {
  if (raw == null) return ''
  let s = String(raw)
  if (!s.includes('<') && !s.includes('&')) return s

  s = decodeHtmlEntities(s)
  // Innholdet i script/style er kode, ikke tekst — ta med kroppen.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Bildet merkes først og fjernes etter at <br> er blitt linjeskift: sto det på
  // EGEN linje, skal linja forsvinne med det (ellers gaper et tomt hull der
  // bildet var), men et bilde MIDT i en setning skal ikke spise setningens neste
  // linjeskift.
  s = s.replace(/<img\b[^>]*>/gi, BILDE_MERKE)
  s = s.replace(/<br\s*\/?\s*>/gi, '\n')
  s = s.replace(new RegExp(`\n?[ \t]*${BILDE_MERKE}+[ \t]*\n`, 'g'), '\n')
  s = s.replace(new RegExp(BILDE_MERKE, 'g'), '')
  s = s.replace(new RegExp(`</?(${AVSNITT})\\b[^>]*>`, 'gi'), AVSNITT_MERKE)
  s = s.replace(new RegExp(`</?(${LINJE})\\b[^>]*>`, 'gi'), LINJE_MERKE)
  // Alt som står igjen er ren formatering. Kravet om en bokstav (eller «/»)
  // etter «<» gjør at prosa som «5 < 10» står urørt.
  s = s.replace(/<\/?[a-z][^>]*>/gi, '')
  // Slå sammen nabo-merker til ÉN overgang; et avsnittsskille vinner over et
  // linjeskift når begge står i samme overgang.
  s = s.replace(/[\u0001\u0002][\s\u0001\u0002]*/g,
    (m) => (m.includes(AVSNITT_MERKE) ? '\n\n' : '\n'))

  return s
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Som stripHtml, men til ETT-LINJES felt (titler, navn). Linjeskift fra `<br>`
 * eller blokk-tagger blir mellomrom — en tittel med linjeskift i seg havner som
 * `data-*`-attributt på kart-ikonet og i søkeindeksen, der et linjeskift bare er
 * støy.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function stripHtmlEnLinje(raw) {
  return stripHtml(raw).replace(/\s*\n+\s*/g, ' ').trim()
}

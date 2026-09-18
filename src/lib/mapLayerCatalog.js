// Delt lag-katalog for kart-visningen — én kilde til sannhet for hvilke
// togglebare lag som finnes (data-layer-nøkler + norske etiketter), hvilke som
// er av som default. De navngitte kartstilene bor i kartStiler.js.
// Brukes både av MapView.vue (Kartlag-fanen i drawer-en) og
// MCP-serveren (juster_kart), så en ekspert-bruker i appen og Claude via MCP
// alltid snakker samme vokabular. Endres et lag her, følger begge med.

// Lag-kategorier som matcher mapBuilder.js sin categoryFor().
// 'spor' er et klient-side syntetisk lag (ikke fra mapBuilder). Relieff
// (hillshade) er ikke en lag-toggle — det styres av relieff-knotten i MapView.
// Rekkefølge = hvordan toggles vises i drawer-en (IKKE render-z-order, som
// styres av LAYER_ORDER i mapBuilder). De tre mest brukte øverst (sti,
// høydekurver, vann), navne-lagene samlet mot slutten, og de sære
// vinter-tingene (heistrasé, slalombakke) aller sist.
export const LAYERS = [
  // Mest brukt — øverst.
  { key: 'sti',        label: 'Sti' },
  { key: 'kontur',     label: 'Høydekurver' },
  { key: 'vann',       label: 'Vann' },
  // Terreng / natur.
  { key: 'skog',       label: 'Skog' },
  { key: 'aapen',      label: 'Åpen mark' },
  { key: 'aker',       label: 'Åker' },
  { key: 'myr',        label: 'Myr' },
  { key: 'isbre',      label: 'Isbre' },
  { key: 'bekk',       label: 'Bekk' },
  { key: 'strand',     label: 'Strand' },
  { key: 'naturreservat', label: 'Naturreservat' },
  { key: 'stein',      label: 'Stein / skjær' },
  { key: 'stupkant',   label: 'Stupkant' },
  // Bebyggelse / infrastruktur.
  { key: 'bygning',    label: 'Hus og hytter' },
  { key: 'bymasse',    label: 'Tett bebyggelse' },
  { key: 'kirke',      label: 'Kirker' },
  // Kirkegård / gravplass (ISOM-derivert 516). Default PÅ, og delt av alle
  // kartstiler av seg selv: kartStiler bygger hvert sett som en UNNTAKS-liste
  // fra ALL_LAYER_KEYS. En ny nøkkel som ikke står i DEFAULT_OFF_LAYERS er
  // dermed på overalt uten flere kallesteder.
  { key: 'kirkegard',  label: 'Kirkegård' },
  { key: 'parkering',  label: 'Parkering' },
  { key: 'holdeplass', label: 'Holdeplass' },
  { key: 'bro',        label: 'Bro' },
  { key: 'bom',        label: 'Bom / barriere' },
  { key: 'vei-stor',   label: 'Storveg' },
  { key: 'vei-liten',  label: 'Småveg' },
  { key: 'veinummer',  label: 'Veinummer' },
  { key: 'tog',        label: 'Jernbane' },
  { key: 'flyplass',   label: 'Flyplass' },
  { key: 'linje',      label: 'Gjerde' },
  { key: 'kraftlinje', label: 'Kraftlinjer' },
  // Kulturminne-overlegg (Kulturminnesøk brukerminner) — klikkbare tema-ikoner.
  // ­ = myk bindestrek (&shy;): eksplisitt orddelingspunkt så det lange
  // ordet bryter pent på den trange lag-knappen i stedet for å flyte over.
  { key: 'kulturminne', label: 'Kultur­minner' },
  // Arkeologiske kulturminner (Riksantikvaren/Askeladden WFS) — server-side
  // filtrert til arkeologiske funn, bergkunst og kulturminner under vann
  // (se kulturminneWfs.js). Layer-key beholdes for bakoverkompatibilitet.
  { key: 'fredet-kulturminne', label: 'Arkeologiske kulturminner' },
  // Hydrologiske målestasjoner (NVE HydAPI) — blå medaljong-ikoner, klikk for
  // vannføring/vannstand/temperatur + lenke til NVE. Live-lag via proxy.
  { key: 'vannstasjon', label: 'Vannmåle­stasjoner' },
  // Navn — samlet mot slutten.
  { key: 'navn',       label: 'Navn' },
  // Stedsnavn delt i tre viktighets-nivåer — egne lag så de kan toggles
  // hver for seg (f.eks. landsby av, by på).
  { key: 'stedsnavn-major', label: 'By / tettsted' },
  { key: 'stedsnavn-mid',   label: 'Landsby / bydel' },
  { key: 'stedsnavn-minor', label: 'Grend / gård' },
  { key: 'spor',       label: 'GPS-spor' },
  // Sære vinter-ting — aller sist (lysløype er lite relevant for de fleste
  // turkart og default AV).
  { key: 'lysloype',   label: 'Lysløype' },
  { key: 'heistrase',  label: 'Heistrasé' },
  { key: 'slalombakke', label: 'Slalombakke' },
  { key: 'idrettsanlegg', label: 'Idrettsanlegg' },
  // Sjø & padling — marine POI (fyr, sjømerker, skjær, marina, toalett,
  // drikkevann) + fareområde (data-layer 'sjo-poi'). Dybdepunkt/dybdekurver
  // er IKKE her — de er skjulte detalj-lag (long-press-inset / 'dybde').
  // Båtruter (ISOM-derivert 561): trafikkerte båt-/fergeruter i sjøen. Egen
  // toggle fordi de er ferdselslinjer og ikke sjø-POI — men de bor i den
  // marine seksjonen, som er der man leter etter dem. Default PÅ.
  { key: 'batrute',    label: 'Båtruter' },
  { key: 'kai',        label: 'Kai / brygge / molo' },
  { key: 'sjo-poi',    label: 'Sjø & padling' },
  // Sjønavn — geografiske navn i/ved sjøen. Eget lag så man kan slå av
  // navnerikt arkipel uten å miste padle-POI.
  { key: 'sjo-navn',   label: 'Sjønavn' },
]

/**
 * ISOM-kode → lag-nøkkel. FLYTTET HIT FRA `mapBuilder.categoryFor` i v7.8.35,
 * og flyttingen er grunnen til at den er verdt et blikk: kommentaren over
 * `LAYERS` sa «lag-kategorier som matcher mapBuilder.js sin categoryFor()», og
 * «matcher» er nettopp den formen på gjeld denne fila finnes for å unngå — to
 * lister som må holdes i takt for hånd. Lag-tellingen (`lib/lagTelling.js`)
 * trengte dessuten den samme oversettelsen fra klient-siden, og en tredje kopi
 * ville betydd at et nytt lag måtte legges inn tre steder.
 *
 * Flere koder ender i samme lag med vilje: skog samler 406–409, stein samler
 * 210/213/215/216. `'other'` er svaret for en kode uten lag — den rendres
 * fortsatt, men har ingen bryter.
 *
 * @param {string} code ISOM-kode, som streng («406», ikke 406)
 * @returns {string} lag-nøkkel, eller 'other'
 */
export function kategoriForIsomKode(code) {
  switch (code) {
    case '001':                                  return 'land'
    case '401': case '403':                     return 'aapen'
    case '404':                                  return 'aker'
    case '406': case '407': case '408': case '409': return 'skog'
    case '410':                                  return 'isbre'
    case '308': case '309':                     return 'myr'
    case '301': case '302': case '303': case '307': return 'vann'
    case '304': case '305':                     return 'bekk'
    case '520':                                  return 'naturreservat'
    case '521':                                  return 'bygning'
    case '522':                                  return 'bymasse'
    case '501': case '502':                     return 'vei-stor'
    case '503': case '504':                     return 'vei-liten'
    case '505': case '506': case '507':         return 'sti'
    case '510':                                  return 'lysloype'
    case '511':                                  return 'heistrase'
    case '512':                                  return 'slalombakke'
    case '513':                                  return 'idrettsanlegg'
    case '514':                                  return 'flyplass'
    case '516':                                  return 'kirkegard'
    case '515':                                  return 'tog'
    case '201': case '203':                     return 'stupkant'
    case '210': case '213':
    case '215': case '216':                     return 'stein'
    case '525':                                  return 'linje'
    case '528':                                  return 'kraftlinje'
    case '509':                                  return 'bro'
    case '526':                                  return 'bom'
    case '534':                                  return 'parkering'
    case '560':                                  return 'holdeplass'
    case '561':                                  return 'batrute'
    case '551':                                  return 'kai'
    case '552':                                  return 'sjo-poi'
    case '556':                                  return 'strand'
    case '101': case '102': case '103': case '104': return 'kontur'
    default:                                     return 'other'
  }
}

// Lag som hører til den marine «Sjø & padling»-seksjonen i drawer-en.
export const MARINE_LAYER_KEYS = new Set(['batrute', 'kai', 'sjo-poi', 'sjo-navn'])

export const DEFAULT_OFF_LAYERS = new Set(['lysloype'])

// Kanonisk default-synlighet (alt PÅ unntatt DEFAULT_OFF_LAYERS). Brukes både
// til init, art-mode-restaurering og «Nullstill»-knappen i Lag-fanen.
export const DEFAULT_VISIBLE_LAYER_KEYS = LAYERS
  .filter((l) => !DEFAULT_OFF_LAYERS.has(l.key))
  .map((l) => l.key)

export const ALL_LAYER_KEYS = LAYERS.map((l) => l.key)

// Lag-forhåndsvalgene bodde her fram til v5.23.0. De er erstattet av
// KARTSTILER (lib/kartStiler.js), som binder lag SAMMEN MED tema, strek og
// sti-farger. Grunnen står i den fila: et forhåndsvalg som bare skrudde lag
// av og på endret ikke ett piksel-uttrykk, og «Detaljert» skilte seg fra
// «Tur» på ni lag-nøkler hvorav seks sjelden har data i innlandsterreng.

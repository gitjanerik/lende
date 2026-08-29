// Vert-SVG-en: den tomme .isom-map-roten som kart-innholdet adopteres inn i,
// pluss de tre svarene som bare kan gis mens man har hele treet i hånda —
// detalj-lagene som løftes ut, antall innbakte kulturminner, og om kartet har
// routbare sti-lag.
//
// Trukket ut av useMapLoadPipeline.setupHostSvg i v6.5.0 fordi Fritt lende
// trenger nøyaktig denne DOM-byggingen og ingenting av Vue-bokføringen rundt
// (culling-reset, LOD-cacher, reveal, zoom-klasser, Stifinner-avbrudd) som
// blir stående hos kalleren.
//
// Ren funksjon over to dokumenter: `doc` er MÅL-dokumentet (der SVG-en skal
// leve), mens `sourceRoot` kommer fra DOMParser og tømmes med adoptNode.

const NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

// ISOM-kodene som gjør et kart routbart («Naviger hit»).
export const STI_ISO_KODER = ['501', '502', '503', '504', '505', '506', '507', '509']
const STI_SELEKTOR = STI_ISO_KODER.map((k) => `[data-iso="${k}"]`).join(',')

export function byggVertSvg(sourceRoot, { doc = document } = {}) {
  const svg = doc.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', sourceRoot.getAttribute('viewBox'))
  svg.setAttribute('xmlns', NS)
  // v8.9.26: xmlns:xlink må deklareres her — hill-shading og dybde-skygge
  // legger til `xlink:href` på <image>-elementer via setAttributeNS, og uten
  // denne deklarasjonen på root får serialisert eksport "Namespace prefix
  // xlink for href on image is not defined" i Chrome (Android).
  svg.setAttribute('xmlns:xlink', XLINK_NS)
  svg.setAttribute('class', 'isom-map')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  // v10.x mosaikk: la innhold utenfor viewBox (spøkelses-nabofliser) vises i
  // stedet for å klippes ved SVG-viewporten. Skjermkanten (kart-flate-
  // wrapperen) klipper fortsatt, og UI-chrome ligger over (høyere z-index).
  svg.style.overflow = 'visible'

  // Kart-innholdet adopteres direkte inn i SVG-roten — adoptNode re-homer
  // nodene fra DOMParser-dokumentet uten å kopiere (den gamle
  // cloneNode(true)-loopen traverserte hele multi-MB-treet en gang til).
  // Parse-dokumentet brukes aldri etterpå (ghost tiles re-leser lagret
  // SVG-tekst selv). Overlays (GPS/annotering/spor/måling/søk) appendes
  // ETTERPÅ så de ligger øverst. Relieffet (#hillshade-layer) settes inn foran
  // [data-layer="vann"].
  // adoptNode finnes ikke i linkedom (som testene kjører i). appendChild
  // adopterer selv i moderne DOM, så fallbacken er atferdslik — det eksplisitte
  // kallet står fordi det er det nettleserne faktisk gjør, og fordi det gjør
  // hensikten lesbar.
  const adopter = typeof doc.adoptNode === 'function'
    ? (n) => doc.adoptNode(n)
    : (n) => n
  while (sourceRoot.firstChild) {
    svg.appendChild(adopter(sourceRoot.firstChild))
  }

  // v10.2.9 (perf): detalj-lagene (data-detail="1": dybdepunkt/dybdekurve) er
  // usynlige på hovedkartet (display:none) men kostet likevel parse,
  // style-recalc og deep-clone ved hver buildDetailInset. Løft dem UT av
  // live-DOM-en og la kalleren holde dem i en ref — inset-en (eneste konsument)
  // appender kloner derfra i stedet.
  const detaljLag = []
  for (const g of svg.querySelectorAll('[data-detail="1"]')) {
    detaljLag.push(g)
    g.remove()
  }

  // Tell INNBAKTE kulturminne-ikoner (til toggel-badgen).
  // v4.8.6: ingen innbakte ikoner betyr IKKE «ingen finnes» — bygge-tids-
  // hentingen glipper rutinemessig på mobil, og runtime-fallbacken henter live
  // etterpå. Da er svaret «vet ikke» (null), ikke 0, ellers påstår badgen at
  // området er tomt før noen har spurt.
  const innbakte = svg.querySelectorAll('[data-kulturminne-id]').length

  const userLayer = doc.createElementNS(NS, 'g')
  userLayer.setAttribute('id', 'user-layer')
  // v8.5.2: GPS-laget skal aldri sluke pinch-to-zoom-gester når brukerens
  // finger lander på prikken/ringen.
  userLayer.setAttribute('pointer-events', 'none')
  svg.appendChild(userLayer)

  // Navn-lagene holdes usynlige til navn-LOD-passet har kjørt — ellers ville
  // ALLE navn blinke frem i 1–2 frames før decluttering. KALLEREN MÅ FJERNE
  // DENNE IGJEN: en vert uten et LOD-pass etterpå har usynlige navn for alltid.
  svg.classList.add('lod-pending')

  return {
    svg,
    detaljLag,
    kulturminneAntall: innbakte || null,
    harStier: !!svg.querySelector(STI_SELEKTOR),
  }
}

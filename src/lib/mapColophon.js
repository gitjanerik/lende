// Kolofon for eksporterte kart: linjal (skalabar), målestokk, ekvidistanse og
// app/kart/dato-kreditt, nederst til venstre i kart-SVG-en. Skjerm-UI-et viser
// bare linjalen (MapScaleAttribution) — de tallene som IKKE går inn i en fil
// står i punkt-skuffen. Et eksportert ark har ingen app rundt seg, så alt må
// stå på selve kartet.
//
// ENHETER: kart-viewBox-en er i METER (1 SVG-enhet = 1 m). Kolofonen legges ut
// i print-mm som regnes om til meter med `scaleDenom / 1000` — samme mm→m-regel
// som mapBuilder bruker for bro-parapetene. Da får boksen samme FYSISKE
// størrelse på papiret uansett kartstørrelse og målestokk. Ingenting her er
// oppgitt i «mm»-enheter i SVG-en selv: alt er ferdig omregnede tall, så
// resultatet er identisk i nettleser, canvas-rasterisering og headless.

const APP_NAME = 'Så i lende'

// Linjal-lengder i meter bakke. Største som gir en strek innenfor
// BAR_MIN_MM–BAR_MAX_MM på papiret velges.
const BAR_CANDIDATES_M = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000]
const BAR_MIN_MM = 12
const BAR_MAX_MM = 45

// Print-mm for kolofonen. Tekststørrelsene ligger i ISOM-sjiktet (~2 mm) —
// lesbare på arket uten å spise kart.
const PAD_MM = 2.2
const TICK_MM = 1.5
const BAR_STROKE_MM = 0.3
const GAP_MM = 1.8            // linjal → lengde-etikett
const FS_MAIN_MM = 2.4        // linjal-etikett + målestokk/ekvidistanse
const FS_CREDIT_MM = 2.0      // app · kart · dato
const ROW_GAP_MM = 1.3
const MARGIN_MM = 4           // kolofon → kartkant

// Grov bredde-estimering for bakgrunnsboksen. SVG kan ikke måle tekst uten et
// layout-steg, og kolofonen bygges som en ren streng (også i headless), så vi
// gjetter litt raust: kreditt-linjen ble målt til ~0,41 × fontstørrelse pr tegn
// i Chromium, og 0,5 gir slark for bredere navn uten å etterlate et stort tomt
// felt til høyre i boksen.
const CHAR_W_FACTOR = 0.5
const textWidthMm = (s, fsMm) => String(s).length * fsMm * CHAR_W_FACTOR

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// «10000» → «10 000» med hardt mellomrom, så målestokken ikke brytes over to
// linjer og ser like ut uansett locale (Intl varierer mellom miljøer).
export function formatDenom(n) {
  const digits = String(Math.round(Math.abs(Number(n) || 0)))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ' '
    out += digits[i]
  }
  return out
}

export function formatDato(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (v) => String(v).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

/**
 * Velg linjal-lengde: største runde bakke-avstand som gir en akseptabel
 * strek-lengde på papiret, og som ikke er bredere enn en tredjedel av kartet.
 * @returns {{ groundM: number, printMm: number, label: string }}
 */
export function chooseScaleBar(scaleDenom, widthM) {
  const mmFor = (m) => m * 1000 / scaleDenom
  const maxMm = Math.min(BAR_MAX_MM, mmFor(widthM) / 3)
  let pick = null
  for (const m of BAR_CANDIDATES_M) {
    const mm = mmFor(m)
    if (mm > maxMm) break
    if (mm >= BAR_MIN_MM) pick = m
  }
  // Ingen kandidat passer (svært lite kart eller ekstrem målestokk) — ta den
  // korteste og la den bli kort heller enn å droppe linjalen.
  if (pick == null) pick = BAR_CANDIDATES_M[0]
  return {
    groundM: pick,
    printMm: mmFor(pick),
    label: pick >= 1000 ? `${pick / 1000} km` : `${pick} m`,
  }
}

/**
 * Bygg kolofonen som ett `<g>`-element, klart til å limes inn rett før
 * `</svg>` i kart-markupen.
 *
 * @param {object} o
 * @param {number} o.widthM        kart-bredde i meter (viewBox)
 * @param {number} o.heightM       kart-høyde i meter (viewBox)
 * @param {number} o.scaleDenom    målestokk-nevner (10000 = 1:10 000)
 * @param {number} [o.equidistance] ekvidistanse i meter
 * @param {string} [o.title]       kartets navn
 * @param {string} [o.generated]   ISO-tidspunkt kartet ble bygd
 * @returns {string} `<g …>…</g>`, eller '' hvis geometrien mangler
 */
export function buildColophonSvg({
  widthM, heightM, scaleDenom,
  equidistance = null, title = '', generated = null, appName = APP_NAME,
} = {}) {
  const w = Number(widthM), h = Number(heightM), denom = Number(scaleDenom)
  if (!(w > 0) || !(h > 0) || !(denom > 0)) return ''

  // mm → bruker-enheter (meter). Alt under regnes i mm og konverteres til slutt.
  const u = (mm) => Number((mm * denom / 1000).toFixed(3))

  const bar = chooseScaleBar(denom, w)

  const scaleText = `1:${formatDenom(denom)}`
  const infoText = equidistance
    ? `${scaleText}  ·  Ekvidistanse ${equidistance} m`
    : scaleText
  const creditText = [appName, String(title || '').trim(), formatDato(generated)]
    .filter(Boolean).join('  ·  ')

  // Rad-layout i mm, målt fra boksens topp-venstre hjørne.
  const barBaselineY = PAD_MM + TICK_MM
  const infoBaselineY = barBaselineY + ROW_GAP_MM + FS_MAIN_MM
  const creditBaselineY = infoBaselineY + ROW_GAP_MM + FS_CREDIT_MM
  const boxHMm = creditBaselineY + PAD_MM * 0.7

  const boxWMm = PAD_MM * 2 + Math.max(
    bar.printMm + GAP_MM + textWidthMm(bar.label, FS_MAIN_MM),
    textWidthMm(infoText, FS_MAIN_MM),
    textWidthMm(creditText, FS_CREDIT_MM),
  )

  // Ankeret er boksens TOPP-venstre hjørne, slik at alle interne koordinater
  // er positive nedover: nederst til venstre i kartet, MARGIN_MM fra kanten.
  const ax = u(MARGIN_MM)
  const ay = Number((h - u(MARGIN_MM) - u(boxHMm)).toFixed(3))

  const ticks = []
  for (let i = 0; i <= 4; i++) {
    const x = u(PAD_MM + (bar.printMm * i) / 4)
    const top = u(barBaselineY - (i === 0 || i === 4 ? TICK_MM : TICK_MM * 0.6))
    ticks.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${u(barBaselineY)}"/>`)
  }

  // font-size som UNITLESS presentasjons-attributt = bruker-enheter, altså
  // samme mm→m-regnestykke som all annen geometri her. IKKE «2.4mm»: en CSS-mm
  // inne i SVG-innhold er 96 dpi-basert (1 mm = 3,78 bruker-enheter), som ved
  // 1:10 000 blir 0,378 mm på arket — målt i Chromium. Bare unitless tall
  // treffer virkelige print-mm. Resten av typografien står i style, som slår
  // kart-CSS-en.
  const font = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
  const textStyle = (weight) => `font-family:${font};font-weight:${weight};fill:#1a1a1a`

  return [
    `<g data-kolofon="1" transform="translate(${ax} ${ay})" style="pointer-events:none">`,
    `<rect x="0" y="0" width="${u(boxWMm)}" height="${u(boxHMm)}" rx="${u(0.8)}"`,
    ` fill="#ffffff" fill-opacity="0.88" stroke="#1a1a1a" stroke-opacity="0.45"`,
    ` stroke-width="${u(0.18)}"/>`,
    `<g stroke="#1a1a1a" stroke-width="${u(BAR_STROKE_MM)}" stroke-linecap="butt">`,
    `<line x1="${u(PAD_MM)}" y1="${u(barBaselineY)}"`,
    ` x2="${u(PAD_MM + bar.printMm)}" y2="${u(barBaselineY)}"/>`,
    ticks.join(''),
    `</g>`,
    `<text x="${u(PAD_MM + bar.printMm + GAP_MM)}" y="${u(barBaselineY)}"`,
    ` font-size="${u(FS_MAIN_MM)}" style="${textStyle(600)}">${escapeXml(bar.label)}</text>`,
    `<text x="${u(PAD_MM)}" y="${u(infoBaselineY)}"`,
    ` font-size="${u(FS_MAIN_MM)}" style="${textStyle(600)}">${escapeXml(infoText)}</text>`,
    `<text x="${u(PAD_MM)}" y="${u(creditBaselineY)}"`,
    ` font-size="${u(FS_CREDIT_MM)}" style="${textStyle(400)};fill:#3d3d3d">${escapeXml(creditText)}</text>`,
    `</g>`,
  ].join('')
}

/**
 * Lim kolofonen inn i kart-markup. Geometrien leses fra root-viewBox-en (den
 * er autoritativ for det arket som faktisk eksporteres); resten kommer fra
 * meta. Returnerer markupen uendret hvis noe mangler — en eksport skal aldri
 * feile på grunn av kolofonen.
 */
export function withColophon(svgString, { meta = null, title = '', generated = null } = {}) {
  if (!svgString) return svgString
  const vb = /viewBox="([^"]+)"/.exec(svgString)?.[1]?.trim().split(/[\s,]+/).map(Number)
  if (!vb || vb.length < 4 || !(vb[2] > 0) || !(vb[3] > 0)) return svgString

  const g = buildColophonSvg({
    widthM: vb[2],
    heightM: vb[3],
    scaleDenom: meta?.scaleDenom ?? 10000,
    equidistance: meta?.equidistance ?? null,
    title,
    generated: generated ?? meta?.generated ?? null,
  })
  if (!g) return svgString

  const i = svgString.lastIndexOf('</svg>')
  if (i < 0) return svgString
  return svgString.slice(0, i) + g + svgString.slice(i)
}

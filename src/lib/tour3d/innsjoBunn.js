// Innsjøbunnen fra NVEs dybdekurver — et dybde-rutenett på DEM-ets eget gitter.
//
// Ren tallknusing uten three/DOM, så den kan testes i node. Kurvene er linjer;
// terrenget er et rutenett. Mellom dem står en interpolasjon, og valget er
// Laplace: kurvene og strandlinja holdes fast (strand = 0 m), og alt imellom
// løses som den glatteste flata som går gjennom dem. Det treffer hver kurve
// eksakt og lager ingen rygger eller groper kurvene ikke har — i motsetning til
// avstandsvekting, som gir terrasser rundt hver kurve. Prisen er at det dypeste
// bassenget blir flatt på innerste kurve: NVE oppgir ikke hvor maksdypet står.
//
// Alle koordinater er i arkets SVG-meter (x øst, y sør), samme rom som DEM-ets
// gitter: vertex (c, r) står i (c · pw, r · ph).

/** Er linja en lukket ring (første og siste punkt innen tolM)? */
export function erLukket(punkter, tolM = 3) {
  if (!punkter || punkter.length < 4) return false
  const [ax, ay] = punkter[0]
  const [bx, by] = punkter[punkter.length - 1]
  return Math.hypot(ax - bx, ay - by) <= tolM
}

/**
 * Even-odd-rasterisering av ringer til gitteret (scanline per rad). Et punkt
 * telles inne når det ligger innenfor et odde antall ringer — øy-hull i
 * omrisset virker da av seg selv.
 */
export function rasterMaske({ cols, rows, transform }, ringer) {
  const pw = transform.pixelWidth
  const ph = transform.pixelHeight
  const maske = new Uint8Array(cols * rows)
  const kryss = []
  for (let r = 0; r < rows; r++) {
    const y = r * ph
    kryss.length = 0
    for (const ring of ringer) {
      for (let i = 0, n = ring.length; i < n; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[(i + 1) % n]
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
          kryss.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
        }
      }
    }
    if (kryss.length < 2) continue
    kryss.sort((a, b) => a - b)
    for (let k = 0; k + 1 < kryss.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(kryss[k] / pw))
      const c1 = Math.min(cols - 1, Math.floor(kryss[k + 1] / pw))
      for (let c = c0; c <= c1; c++) maske[r * cols + c] = 1
    }
  }
  return maske
}

function median(verdier) {
  if (!verdier.length) return null
  const s = Float64Array.from(verdier).sort()
  return s[s.length >> 1]
}

/**
 * @param {{cols:number, rows:number, transform:object, data:ArrayLike<number>, noData:number}} dem
 * @param {{omriss: number[][][], kurver: {dybde:number, type:number, punkter:number[][]}[]}} innsjo
 *   omriss og kurver allerede projisert til SVG-meter.
 * @returns {null | {maske: Uint8Array, dybde: Float32Array, nivaa: number,
 *   maksDybde: number, celler: number, ramme: {c0:number,c1:number,r0:number,r1:number}}}
 */
export function byggInnsjoBunn(dem, innsjo, { maksIter = 4000, toleranse = 0.005 } = {}) {
  const { cols, rows, transform, data, noData } = dem
  const pw = transform.pixelWidth
  const ph = transform.pixelHeight
  if (!innsjo?.omriss?.length) return null

  const maske = rasterMaske(dem, innsjo.omriss)
  // Øyene står også som lukkede 0-kurver. Har omrisset dem som hull, er dette
  // en no-op; har det dem ikke, er det dette som holder vannet av holmen.
  const oyer = innsjo.kurver.filter(k => k.type === 2 && erLukket(k.punkter)).map(k => k.punkter)
  if (oyer.length) {
    const land = rasterMaske(dem, oyer)
    for (let i = 0; i < maske.length; i++) if (land[i]) maske[i] = 0
  }

  let celler = 0
  let c0 = cols, c1 = -1, r0 = rows, r1 = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!maske[r * cols + c]) continue
      celler++
      if (c < c0) c0 = c
      if (c > c1) c1 = c
      if (r < r0) r0 = r
      if (r > r1) r1 = r
    }
  }
  if (!celler) return null

  // Vannflata: DTM-en har innsjøspeilet flatt, så medianen INNE i masken er
  // nivået. Mangler den (noData over vann), tar vi strandcellene rett utenfor.
  const inne = []
  const strand = []
  for (let r = Math.max(0, r0 - 1); r <= Math.min(rows - 1, r1 + 1); r++) {
    for (let c = Math.max(0, c0 - 1); c <= Math.min(cols - 1, c1 + 1); c++) {
      const i = r * cols + c
      const v = data[i]
      if (v === noData || !Number.isFinite(v)) continue
      if (maske[i]) { inne.push(v); continue }
      const nabo = (c > 0 && maske[i - 1]) || (c < cols - 1 && maske[i + 1])
        || (r > 0 && maske[i - cols]) || (r < rows - 1 && maske[i + cols])
      if (nabo) strand.push(v)
    }
  }
  const nivaa = inne.length >= celler / 2 ? median(inne) : (median(strand) ?? median(inne) ?? 0)

  // Brenn kurvene inn som faste verdier. Steget er et halvt gitter, så ingen
  // celle en kurve passerer gjennom blir hoppet over.
  const dybde = new Float32Array(cols * rows).fill(Number.NaN)
  const fast = new Uint8Array(cols * rows)
  const steg = Math.min(Math.abs(pw), Math.abs(ph)) / 2
  let maksDybde = 0
  for (const k of innsjo.kurver) {
    if (!Number.isFinite(k.dybde)) continue
    if (k.dybde > maksDybde) maksDybde = k.dybde
    const p = k.punkter
    for (let j = 0; j + 1 < p.length; j++) {
      const [ax, ay] = p[j]
      const [bx, by] = p[j + 1]
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / steg))
      for (let s = 0; s <= n; s++) {
        const c = Math.round((ax + ((bx - ax) * s) / n) / pw)
        const r = Math.round((ay + ((by - ay) * s) / n) / ph)
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue
        const i = r * cols + c
        if (!maske[i]) continue
        dybde[i] = k.dybde
        fast[i] = 1
      }
    }
  }

  // SOR-løsning av Laplace innenfor masken. Naboer utenfor masken er strand
  // (0 m); naboer utenfor gitteret speiles (ingen kant-effekt).
  let sum = 0, antall = 0
  for (let i = 0; i < dybde.length; i++) if (fast[i]) { sum += dybde[i]; antall++ }
  const start = antall ? sum / antall : 0
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * cols + c
      if (maske[i] && !fast[i]) dybde[i] = start
    }
  }
  const omega = 1.85
  const verdi = (i) => (maske[i] ? dybde[i] : 0)
  for (let it = 0; it < maksIter; it++) {
    let maksEndring = 0
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c
        if (!maske[i] || fast[i]) continue
        const v = (verdi(c > 0 ? i - 1 : i) + verdi(c < cols - 1 ? i + 1 : i)
          + verdi(r > 0 ? i - cols : i) + verdi(r < rows - 1 ? i + cols : i)) / 4
        const ny = dybde[i] + omega * (v - dybde[i])
        const d = Math.abs(ny - dybde[i])
        if (d > maksEndring) maksEndring = d
        dybde[i] = ny
      }
    }
    if (maksEndring < toleranse) break
  }

  return { maske, dybde, nivaa, maksDybde, celler, ramme: { c0, c1, r0, r1 } }
}

/**
 * Hvor mye dybden forsterkes. En innsjø på 10 m dyp og en kilometer bred er
 * nesten flat sett i 3D; forsterkningen gjør at bunnen får form, og viseren
 * SKRIVER tallet så det ikke er en skjult løgn. Heltall, 1–6.
 */
export function autoDybdeFaktor(bunn, { transform }) {
  if (!bunn?.maksDybde) return 1
  const bredde = Math.sqrt(bunn.celler * Math.abs(transform.pixelWidth * transform.pixelHeight))
  return Math.max(1, Math.min(6, Math.round((0.06 * bredde) / bunn.maksDybde)))
}

/** Kopi av DEM-et med bunnen senket inn: nivå − dybde · faktor i masken. */
export function senketDem(dem, bunn, faktor = 1) {
  const data = Float32Array.from(dem.data)
  for (let i = 0; i < data.length; i++) {
    if (bunn.maske[i]) data[i] = bunn.nivaa - Math.max(0, bunn.dybde[i]) * faktor
  }
  return { ...dem, data }
}

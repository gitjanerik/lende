// Fylkesnavn slik Geonorge staver dem i filnavn.
//
// Deles av måleskriptet og bake-scriptet. Duplisering her ble dyrt én gang
// allerede: første bake feilet fordi bake-scriptet bare erstattet mellomrom,
// mens måleskriptet også translittererte. Trøndelag og Østfold ga 404, og
// vakten stoppet hele baken — riktig oppførsel, men en unødvendig runde.
//
// Vi kjenner ikke Geonorges nøyaktige normalisering, så vi genererer flere
// varianter og prøver dem i tur. Bekreftet i CI (kjøring 31314135592):
// «Buskerud» og «Vestland» går rett inn; «Trøndelag» og «Østfold» må
// translittereres.

/**
 * Kandidat-skrivemåter for et fylkesnavn, i prøve-rekkefølge.
 * Samiske parallellnavn står etter tankestrek («Nordland – Nordlánnda») og er
 * ikke med i filnavnet.
 */
export function navnevarianter(navn) {
  const base = String(navn).split(/\s+[–—-]\s+/)[0].trim()
  const utenDiakritikk = base
    .replace(/ø/g, 'o').replace(/Ø/g, 'O')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
    .replace(/å/g, 'a').replace(/Å/g, 'A')
  const varianter = new Set()
  for (const n of [base, utenDiakritikk]) {
    varianter.add(n.replace(/\s+/g, '_'))
    varianter.add(n.replace(/\s+/g, ''))
  }
  return [...varianter]
}

// Målestokk-linjalen: hvor lang baren skal være, hva den heter, og hvor tikkene
// står. Trukket ut av MapView i v6.5.0 fordi Fritt lende har samme linjal uten å
// ha noe annet av MapView.
//
// Ren funksjon — ingen Vue, ingen DOM. Kallerne holder selv rede på wrapper-
// størrelse og zoom-skala.

export const SCALE_BAR_MAX_PX = 180

// Dekker hele zoom-spennet: km-verdier holder linjalen synlig når man zoomer
// langt ut (1000 m ble < 30 px og baren forsvant), og finere meter-verdier når
// man zoomer langt inn. Største verdi som passer ≤ MAX_PX velges først.
const KANDIDATER = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]

const TOM = { px: 0, label: '', ticks: [] }

export function beregnMaalestokk({ w, h, widthM, heightM, scale }) {
  if (!w || !h || !widthM || !heightM) return { ...TOM, ticks: [] }
  const fit = Math.min(w / widthM, h / heightM)
  const pxPerMeter = fit * scale
  for (const m of KANDIDATER) {
    const px = m * pxPerMeter
    if (px <= SCALE_BAR_MAX_PX && px >= 30) {
      const tickStep = m / 4
      const ticks = []
      for (let i = 0; i <= 4; i++) {
        ticks.push({ px: i * px / 4, m: i * tickStep })
      }
      return { px, label: m >= 1000 ? `${m / 1000} km` : `${m} m`, ticks }
    }
  }
  return { ...TOM, ticks: [] }
}

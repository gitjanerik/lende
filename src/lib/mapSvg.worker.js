// mapSvg.worker.js — kjører buildSvg (DOM-fri) utenfor main-thread.
//
// Workeren lever gjennom HELE byggingen av ett kart (se buildSvgClient.js), ikke
// per kall. Den holder to ting mellom kallene:
//
//   dem       — DEM-et, så terreng-først-previewen og fullbygget ikke koster to
//               struktur-kloner av opptil 4 MB.
//   avledet   — konturer, stupkanter og topper fra det DEM-et, så andre bygg
//               ikke kjører de samme marching-squares- og skeletoniserings-
//               passene på nytt. Gjenbruken er kallerens beslutning: den vet om
//               DEM-et ble byttet ut av kyst-oppgraderingen eller Terrarium.
//
// buildSvg er ren string-bygging uten DOM-avhengighet (kjører også i Node i CI,
// scripts/build-vardasen-svg.js), så den kan løftes rett inn hit.
import { buildSvg } from './mapBuilder.js'
import { pakkLagretDem } from './demSampling.js'

let dem = null
let avledet = null

self.onmessage = (e) => {
  const { id, elements, bbox, options, dem: nyttDem, gjenbrukDem, pakkDem } = e.data ?? {}
  try {
    if (!gjenbrukDem) { dem = nyttDem ?? null; avledet = null }
    const res = buildSvg(elements, bbox, {
      ...options, dem,
      demDerived: gjenbrukDem ? avledet : null,
    })
    avledet = res.demDerived ?? avledet
    // demDerived blir IGJEN i workeren — hele poenget er at den ikke krysser
    // tråd-grensa. Det som sendes tilbake er SVG-en og tallene.
    const ut = { ok: true, id, svg: res.svg, counts: res.counts, timings: res.timings }
    const overfor = []
    if (pakkDem && dem) {
      const { pakketDem, hoyestePunkt } = pakkLagretDem(dem)
      ut.pakketDem = pakketDem
      ut.hoyestePunkt = hoyestePunkt
      if (pakketDem?.buffer) overfor.push(pakketDem.buffer)
    }
    self.postMessage(ut, overfor)
  } catch (err) {
    self.postMessage({ ok: false, id, error: err?.message ?? String(err) })
  }
}

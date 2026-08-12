import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { parseHTML } from 'linkedom'
import { useKartEksport } from './useKartEksport.js'

// 3D-teksturen bygges av arkets fliser HVER FOR SEG (v5.18.1). Delingen skjer
// her, i DOM-en, og det er den som er lett å få subtilt feil: en naboflis uten
// stilark rendres svart, og en feil rute plasserer den en flisebredde bort.
// Rasteriseringen selv (Blob → Image → canvas) er nettleser-plumbing og dekkes
// av røyktesten.

const META = { widthM: 4000, heightM: 3000, minE: 580000, minN: 6640000, maxN: 6643000 }

// linkedom gir oss et DOM uten nettleser; useKartEksport bruker det globale
// `document` til å lage <style>/<rect>, så det må peke hit under testen.
let forrigeDocument

function arkMedNaboer(ghosts = '') {
  const { document } = parseHTML(`<html><body>
    <div id="vert"><svg class="isom-map" viewBox="0 0 4000 3000" width="100%" height="100%">
      <style id="ghost-isom-style">.isom-map [data-iso="522"]{fill:#f0f}</style>
      <style>.isom-map [data-iso="301"]{fill:#8cf}</style>
      <g id="bakgrunn"><rect width="4000" height="3000" fill="#fffbf0"/></g>
      <g id="ghost-tiles">${ghosts}</g>
      <g data-layer="vann" data-iso="301"><path d="M10,10 L20,20"/></g>
      <g id="user-layer"><circle r="3"/></g>
    </svg></div>
  </body></html>`)
  forrigeDocument = globalThis.document
  globalThis.document = document
  return document.querySelector('#vert')
}

const NABO = (x, y) =>
  `<svg class="isom-map" x="${x}" y="${y}" width="4000.5" height="3000.5"
        viewBox="-0.5 -0.5 4001 3001" preserveAspectRatio="none">
     <g data-ghost-layer="vann" data-iso="301"><path d="M5,5 L9,9"/></g>
   </svg>`

function lagEksport(vert) {
  return useKartEksport({
    svgHostRef: ref(vert),
    meta: ref(META),
    mapTitle: ref('Testkart'),
    currentTheme: ref('dark'),
    autoMapToast: ref(''),
    hooks: { applyUprightLabels: () => {} },
  })
}

afterEach(() => {
  if (forrigeDocument === undefined) delete globalThis.document
  else globalThis.document = forrigeDocument
  forrigeDocument = undefined
})

describe('mapSvgTilesFor3d', () => {
  it('ett kart uten naboer gir én flis som dekker hele utsnittet', () => {
    const { mapSvgTilesFor3d } = lagEksport(arkMedNaboer())
    const spec = mapSvgTilesFor3d()
    expect(spec.widthM).toBe(4000)
    expect(spec.heightM).toBe(3000)
    expect(spec.tiles).toHaveLength(1)
    expect(spec.tiles[0]).toMatchObject({ w: 4000, h: 3000 })
    expect(spec.tiles[0].x).toBeCloseTo(0, 9)
    expect(spec.tiles[0].y).toBeCloseTo(0, 9)
    expect(spec.tiles[0].svg).toContain('data-iso="301"')
  })

  it('hver naboflis blir sin egen flis, med sin rute i utsnittets rom', () => {
    const vert = arkMedNaboer(NABO(4000, 0) + NABO(-4000, -3000))
    const { mapSvgTilesFor3d } = lagEksport(vert)
    const spec = mapSvgTilesFor3d({
      extent: { minX: -4000, minY: -3000, widthM: 12000, heightM: 9000 },
    })
    expect(spec.widthM).toBe(12000)
    expect(spec.heightM).toBe(9000)
    expect(spec.tiles).toHaveLength(3)
    // Aktiv flis ligger i midten av det forskjøvede rommet.
    expect(spec.tiles[0]).toMatchObject({ x: 4000, y: 3000, w: 4000, h: 3000 })
    expect(spec.tiles[1]).toMatchObject({ x: 8000, y: 3000 })
    expect(spec.tiles[2]).toMatchObject({ x: 0, y: 0 })
  })

  it('naboflisene får aktiv flis sine stilark — uten dem rendres de svarte', () => {
    const vert = arkMedNaboer(NABO(4000, 0))
    const { mapSvgTilesFor3d } = lagEksport(vert)
    const nabo = mapSvgTilesFor3d().tiles[1].svg
    expect(nabo).toContain('[data-iso="301"]')     // aktiv flis' <style>
    expect(nabo).toContain('[data-iso="522"]')     // #ghost-isom-style-supplementet
    expect(nabo).toContain('--bg')                 // tema-variablene
  })

  it('hver flis er et frittstående dokument — eget namespace, ingen x/y-offset', () => {
    const vert = arkMedNaboer(NABO(4000, 0))
    const { mapSvgTilesFor3d } = lagEksport(vert)
    for (const t of mapSvgTilesFor3d().tiles) {
      expect(t.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(t.svg.slice(0, t.svg.indexOf('>'))).not.toMatch(/\sx="/)
    }
  })

  it('naboflisas blø-hakk følger med, så nabofliser overlapper i stedet for å møtes', () => {
    const vert = arkMedNaboer(NABO(3999.5, -0.5))
    const { mapSvgTilesFor3d } = lagEksport(vert)
    const nabo = mapSvgTilesFor3d().tiles[1]
    expect(nabo).toMatchObject({ x: 3999.5, y: -0.5, w: 4000.5, h: 3000.5 })
  })

  it('temaet bakes inn, og bakgrunnen følger med som farge på spec-en', () => {
    const { mapSvgTilesFor3d } = lagEksport(arkMedNaboer())
    const mørk = mapSvgTilesFor3d({ theme: 'dark' })
    const lys = mapSvgTilesFor3d({ theme: 'light' })
    expect(mørk.background).not.toBe(lys.background)
    expect(mørk.tiles[0].svg).toContain(mørk.background)
  })

  it('naboflisene tas ut av den aktive flisa — ingen skal tegnes to ganger', () => {
    const vert = arkMedNaboer(NABO(4000, 0))
    const { mapSvgTilesFor3d } = lagEksport(vert)
    expect(mapSvgTilesFor3d().tiles[0].svg).not.toContain('ghost-tiles')
    expect(mapSvgTilesFor3d().tiles[0].svg).not.toContain('data-ghost-layer')
  })

  it('uten kart eller vert gir den null i stedet for å kaste', () => {
    globalThis.document = parseHTML('<html><body></body></html>').document
    const { mapSvgTilesFor3d } = useKartEksport({
      svgHostRef: ref(null), meta: ref(null), mapTitle: ref(''),
      currentTheme: ref('light'), autoMapToast: ref(''),
      hooks: { applyUprightLabels: () => {} },
    })
    expect(mapSvgTilesFor3d()).toBeNull()
  })
})

describe('mapSvgMarkupForExport', () => {
  beforeEach(() => { arkMedNaboer(NABO(4000, 0)) })

  it('eksport uten utsnitt klipper bort naboflisene', () => {
    const { mapSvgMarkupForExport } = lagEksport(globalThis.document.querySelector('#vert'))
    const ut = mapSvgMarkupForExport({ colophon: false })
    expect(ut).not.toContain('ghost-tiles')
  })
})

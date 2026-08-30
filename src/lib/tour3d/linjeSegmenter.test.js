// Slacken på siste segment. Testene kan IKKE se feilen den retter — den bor i
// en mobil-GPU-driver, og SwiftShader/desktop leser innenfor spesifikasjonen —
// så de holder fast MEKANIKKEN: at halen finnes, og at den aldri tegnes.
import { describe, it, expect } from 'vitest'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { settLinjeSegmenter, antallSegmenter, SEGMENT_SLACK } from './linjeSegmenter.js'

const segmenter = (n) => {
  const ut = []
  for (let i = 1; i <= n; i++) ut.push(i, i, i, i + 0.5, i + 0.5, i + 0.5)
  return ut
}

describe('settLinjeSegmenter', () => {
  it('lar siste ekte segment ha 12 byte bak seg', () => {
    // DETTE ER HELE POENGET. instanceEnd ligger 12 byte inn i en 24-byte stride,
    // så for siste instans slutter den nøyaktig på bufferets siste byte. En
    // driver som krever `offset + stride·n` finner da for lite og leverer nuller
    // — og null i tre floats er world-origo, altså en snorrett strek tvers over
    // kartet.
    const geo = new LineSegmentsGeometry()
    settLinjeSegmenter(geo, segmenter(5))
    const buf = geo.getAttribute('instanceStart').data
    expect(buf.count).toBe(5 + SEGMENT_SLACK)
    // Siste TEGNEDE instans sin instanceEnd må ha en hel stride etter seg.
    const flyt = buf.array.length
    expect(flyt - (geo.instanceCount * 6)).toBeGreaterThanOrEqual(6)
    geo.dispose()
  })

  it('tegner bare de ekte segmentene — slacken er ikke en strek', () => {
    // Uten dette ville slacken selv blitt tegnet: instanceCount er Infinity som
    // default, og tegnetallet blir da bufferets fulle lengde. En strek fra origo
    // til origo er ikke ingenting — LineMaterial har bredde i PIKSLER, så det
    // blir en flekk midt på kartet.
    const geo = new LineSegmentsGeometry()
    const n = settLinjeSegmenter(geo, segmenter(7))
    expect(n).toBe(7)
    expect(geo.instanceCount).toBe(7)
    geo.dispose()
  })

  it('kapasitet allokerer for et buffer som fylles om igjen senere', () => {
    // three låser `_maxInstanceCount` ved FØRSTE binding og hever det aldri
    // (v6.3.9), så et buffer som skal vokse må allokeres på maks med én gang.
    const geo = new LineSegmentsGeometry()
    settLinjeSegmenter(geo, [], { kapasitet: 12 })
    expect(geo.getAttribute('instanceStart').data.count).toBe(12 + SEGMENT_SLACK)
    expect(geo.instanceCount).toBe(0)
    geo.dispose()
  })

  it('en halv hale droppes framfor å tegnes med søppel i andre enden', () => {
    const geo = new LineSegmentsGeometry()
    expect(settLinjeSegmenter(geo, segmenter(3).concat([9, 9, 9]))).toBe(3)
    expect(geo.instanceCount).toBe(3)
    geo.dispose()
  })

  it('antallSegmenter tåler tomt og udefinert', () => {
    expect(antallSegmenter([])).toBe(0)
    expect(antallSegmenter(undefined)).toBe(0)
  })
})

describe('bufferne i 3D bruker regelen', () => {
  it('ingen setPositions uten slack i tour3d', async () => {
    // Regelen er verdiløs om neste buffer kaller setPositions direkte igjen.
    // Fire buffere hadde nettopp det, og tre av dem tegnet over hele kartet.
    const { readdirSync, readFileSync } = await import('node:fs')
    const dir = new URL('.', import.meta.url).pathname
    const synder = []
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.js') || f.endsWith('.test.js') || f === 'linjeSegmenter.js') continue
      const kode = readFileSync(dir + f, 'utf8')
      if (/\.setPositions\s*\(/.test(kode)) synder.push(f)
    }
    expect(synder).toEqual([])
  })
})

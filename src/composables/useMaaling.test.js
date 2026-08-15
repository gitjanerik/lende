import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMaaling } from './useMaaling.js'

// 3×3 DEM, 10 m per celle: høyden er 10 × radnummer, så y=0 → 0 moh og
// y=20 → 20 moh. Nok til å skille A fra B uten å teste sampleElevation på nytt.
function lagDem() {
  return {
    data: Float32Array.from([0, 0, 0, 10, 10, 10, 20, 20, 20]),
    cols: 3, rows: 3,
    transform: { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
    noData: -9999,
  }
}

function lagDeps(dem) {
  return {
    scale: ref(1),
    dem: () => dem,
    annot: { selectedSymbol: ref(null), isAnnotateMode: ref(false) },
    sti: { blocking: ref(false), cancel: vi.fn() },
    hooks: { renderMeasure: vi.fn(), renderRoutes: vi.fn(), ensureDem: vi.fn() },
  }
}

describe('useMaaling — høyde A/B og differanse', () => {
  it('gir null før to punkter er satt', () => {
    const m = useMaaling(lagDeps(lagDem()))
    expect(m.measureStats.value.eleDiffM).toBe(null)
    m.measureVertices.value = [{ x: 0, y: 0 }]
    expect(m.measureStats.value.eleA).toBe(0)
    expect(m.measureStats.value.eleB).toBe(null)
    expect(m.measureStats.value.eleDiffM).toBe(null)
  })

  it('måler høyde i første og siste punkt, ikke mellompunktene', () => {
    const m = useMaaling(lagDeps(lagDem()))
    m.measureVertices.value = [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 20, y: 10 }]
    const s = m.measureStats.value
    expect(s.eleA).toBe(0)
    expect(s.eleB).toBe(10)
    expect(s.eleDiffM).toBe(10)
  })

  it('gir negativ differanse når siste punkt ligger lavere', () => {
    const m = useMaaling(lagDeps(lagDem()))
    m.measureVertices.value = [{ x: 0, y: 20 }, { x: 0, y: 0 }]
    expect(m.measureStats.value.eleDiffM).toBe(-20)
  })

  it('gir null uten DEM, og distansen står som før', () => {
    const m = useMaaling(lagDeps(null))
    m.measureVertices.value = [{ x: 0, y: 0 }, { x: 30, y: 40 }]
    const s = m.measureStats.value
    expect(s.eleA).toBe(null)
    expect(s.eleDiffM).toBe(null)
    expect(s.distM).toBe(50)
  })

  it('henter DEM når målingen starter', () => {
    const deps = lagDeps(null)
    useMaaling(deps).startMeasure()
    expect(deps.hooks.ensureDem).toHaveBeenCalled()
  })
})

import { describe, it, expect } from 'vitest'
import { orientertRektangel } from './byggRektangel.js'

// Rektangel w × h sentrert i (cx, cy), dreid θ radianer.
const rekt = (w, h, theta = 0, cx = 0, cy = 0) => {
  const c = Math.cos(theta), s = Math.sin(theta)
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c])
}
const sider = (r) => [r.lengde, r.bredde].map(v => Math.round(v * 1000) / 1000)
const grader = (r) => ((r.vinkel * 180 / Math.PI) % 180 + 180) % 180

describe('orientertRektangel', () => {
  it('gir et akse-justert rektangel nøyaktig tilbake', () => {
    const r = orientertRektangel(rekt(20, 10))
    expect(sider(r)).toEqual([20, 10])
    expect(r.senter[0]).toBeCloseTo(0, 6)
    expect(r.senter[1]).toBeCloseTo(0, 6)
    expect(grader(r)).toBeCloseTo(0, 6)
  })

  // Hele poenget: et hus på skrå skal STÅ på skrå. Det gamle kvadratet var
  // akse-justert uansett hva bygningen gjorde.
  it('finner retningen til et dreid bygg', () => {
    for (const deg of [15, 30, 45, 60, 120, 175]) {
      const r = orientertRektangel(rekt(24, 8, deg * Math.PI / 180))
      expect(sider(r), `${deg}°`).toEqual([24, 8])
      expect(grader(r), `${deg}°`).toBeCloseTo(deg % 180, 4)
    }
  })

  it('senteret følger bygningen, ikke origo', () => {
    const r = orientertRektangel(rekt(12, 6, 0.4, 1234.5, -987.25))
    expect(r.senter[0]).toBeCloseTo(1234.5, 6)
    expect(r.senter[1]).toBeCloseTo(-987.25, 6)
  })

  // Lengste kant er den nærliggende heuristikken, og den bommer her: den
  // lange diagonale veggen på et utbygg ligger på skrå av huskroppen.
  it('velger minste areal, ikke lengste kant', () => {
    // Et 20 × 10-hus med et trekantet utbygg — den lengste ENKELTKANTEN er
    // hypotenusen på skrå, men minste omsluttende rektangel står med huset.
    const L = [[0, 0], [20, 0], [20, 10], [0, 10], [-6, 5]]
    const r = orientertRektangel(L)
    expect(grader(r)).toBeCloseTo(0, 4)
    expect(sider(r)).toEqual([26, 10])
  })

  it('en lukket ring gir samme svar som en åpen', () => {
    const åpen = rekt(14, 9, 0.7)
    const lukket = [...åpen, åpen[0]]
    expect(sider(orientertRektangel(lukket))).toEqual(sider(orientertRektangel(åpen)))
  })

  it('godtar både [x,y] og {x,y}', () => {
    const a = rekt(20, 10, 0.3)
    const b = a.map(([x, y]) => ({ x, y }))
    expect(sider(orientertRektangel(b))).toEqual(sider(orientertRektangel(a)))
  })
})

describe('orientertRektangel — gulvet', () => {
  // Gulvet er en MINSTESTØRRELSE. Ei hytte på 5,7 × 5,7 m er 0,57 mm i
  // 1:10 000 og maskeres av en sti som går forbi; den skal vokse til den er
  // synlig, men ikke miste formen sin.
  it('løfter en for liten side opp til gulvet', () => {
    const r = orientertRektangel(rekt(5.7, 5.7), { gulvM: 9 })
    expect(sider(r)).toEqual([9, 9])
  })

  it('løfter BARE den korte siden — den lange står', () => {
    const r = orientertRektangel(rekt(18, 4), { gulvM: 9 })
    expect(sider(r)).toEqual([18, 9])
  })

  // Uten Math.max ville gulvet vært en tvangsstørrelse og krympet et stort
  // bygg. Det er stikk motsatt av hensikten, og feilen ville sett ut som om
  // alle bygg ble like igjen.
  it('krymper ALDRI et bygg som alt er stort nok', () => {
    const r = orientertRektangel(rekt(40, 25), { gulvM: 9 })
    expect(sider(r)).toEqual([40, 25])
  })

  it('gulvet bevarer retningen', () => {
    const r = orientertRektangel(rekt(4, 3, Math.PI / 6), { gulvM: 9 })
    expect(sider(r)).toEqual([9, 9])
    expect(r.senter[0]).toBeCloseTo(0, 6)
  })

  it('uten gulv er rektangelet bygningens eget', () => {
    expect(sider(orientertRektangel(rekt(3, 2)))).toEqual([3, 2])
  })
})

describe('orientertRektangel — degenererte ringer', () => {
  it('for få punkter gir null', () => {
    expect(orientertRektangel([[0, 0], [1, 1]])).toBeNull()
    expect(orientertRektangel([])).toBeNull()
    expect(orientertRektangel(null)).toBeNull()
  })

  it('en ring der alle punktene er like gir null', () => {
    expect(orientertRektangel([[5, 5], [5, 5], [5, 5], [5, 5]])).toBeNull()
  })

  it('ikke-endelige koordinater filtreres bort', () => {
    // En NaN som slipper gjennom havner i en instans-matrise eller et
    // d-attributt, og da forsvinner hele pathen — se v5.22.9–11.
    const r = orientertRektangel([...rekt(20, 10), [NaN, 0], [0, Infinity]])
    expect(sider(r)).toEqual([20, 10])
    for (const [x, y] of r.hjorner) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    }
  })

  it('fire hjørner, og de spenner rektangelet', () => {
    const r = orientertRektangel(rekt(20, 10, 0.5), { gulvM: 9 })
    expect(r.hjorner).toHaveLength(4)
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
    expect(d(r.hjorner[0], r.hjorner[1])).toBeCloseTo(20, 6)
    expect(d(r.hjorner[1], r.hjorner[2])).toBeCloseTo(10, 6)
  })
})

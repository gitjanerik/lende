import { describe, it, expect } from 'vitest'
import {
  strekGruppeFor, effektivBredde, dashFaktorer, dashMm, dashCss, faktorVar,
} from './strekMonster.js'
import { buildStrokeOverrideCss } from './strokeOverrides.js'
import { themeVarEntries } from './mapSettingsApply.js'

describe('strekMonster — mønster som faktorer av strekbredden', () => {
  it('slår opp strek-gruppa fra strek-overstyringens katalog', () => {
    expect(strekGruppeFor('507')).toBe('sti')
    expect(strekGruppeFor('501')).toBe('storVei')
    expect(strekGruppeFor('305')).toBeNull()
  })

  it('effektiv bredde tar med gruppe-faktoren bare der det finnes en gruppe', () => {
    expect(effektivBredde(0.1, '507')).toBe('calc(0.1mm * var(--stroke-scale, 1) * var(--strek-sti, 1))')
    expect(effektivBredde(0.09, '305')).toBe('calc(0.09mm * var(--stroke-scale, 1))')
  })

  it('dobbelstrek: strek, indre gap, strek, gruppegap', () => {
    const f = dashFaktorer({ widthMm: 0.1, dashFaktor: { strek: 5.5, gapIndre: 1.4, gapGruppe: 24 } })
    expect(f.map(x => x.navn)).toEqual(['dash', 'gap-indre', 'dash', 'gap-gruppe'])
    expect(dashMm({ widthMm: 0.1, dashFaktor: { strek: 5.5, gapIndre: 1.4, gapGruppe: 24 } }))
      .toEqual([0.55, 0.14, 0.55, 2.4])
  })

  it('mm-mønstre regnes om og gir samme mm tilbake — nøytral skala er uendret', () => {
    expect(dashFaktorer({ widthMm: 0.1, dasharray: [0.36, 0.3] })).toEqual([
      { navn: 'dash', f: 3.6 }, { navn: 'gap', f: 3 },
    ])
    expect(dashMm({ widthMm: 0.08, dasharray: [0.3, 0.25] })).toEqual([0.3, 0.25])
    expect(dashMm({ widthMm: 0.55, dasharray: [0, 1.4] })).toEqual([0, 1.4])
  })

  it('en heltrukken strek har intet mønster', () => {
    expect(dashFaktorer({ widthMm: 0.2 })).toBeNull()
  })

  it('dasharray-verdien er calc per ledd, med tema-variabel når koden er gitt', () => {
    const f = [{ navn: 'dash', f: 1.2 }, { navn: 'gap', f: 0.9 }]
    expect(dashCss(f, 'var(--w)', '505')).toBe(
      'calc(var(--w) * var(--iso-505-dash-faktor, 1.2)) calc(var(--w) * var(--iso-505-gap-faktor, 0.9))')
    expect(dashCss(f, 'X')).toBe('calc(X * 1.2) calc(X * 0.9)')
    expect(faktorVar('507', 'gap-gruppe')).toBe('--iso-507-gap-gruppe-faktor')
  })
})

describe('«Stier»-slideren når stiplingen', () => {
  it('strek-overstyringen setter gruppe-faktoren som variabel', () => {
    expect(buildStrokeOverrideCss({ sti: 1.5 })).toContain('.isom-map { --strek-sti: 1.5; }')
  })

  it('nøytral slider gir fortsatt tom CSS', () => {
    expect(buildStrokeOverrideCss({ sti: 1 })).toBe('')
  })
})

describe('temaet setter faktorer, og mm for kart bygget før v7.9.13', () => {
  const vars = Object.fromEntries(themeVarEntries('turkart'))

  it('507: tre navngitte faktorer — gruppegapet kan finjusteres alene', () => {
    expect(vars['--iso-507-dash-faktor']).toBe('5.5')
    expect(vars['--iso-507-gap-indre-faktor']).toBe('1.4')
    expect(vars['--iso-507-gap-gruppe-faktor']).toBe('24')
  })

  it('det gamle mm-navnet får mm, aldri en faktor (et gammelt kart ville lest 5,5 som meter)', () => {
    expect(vars['--iso-507-dash']).toBe('0.55mm 0.14mm 0.55mm 2.4mm')
    expect(vars['--iso-505-dash']).toBe('0.12mm 0.09mm')
  })

  it('505 beholder dagens mønster, nå også som faktorer', () => {
    expect(vars['--iso-505-dash-faktor']).toBe('1.2')
    expect(vars['--iso-505-gap-faktor']).toBe('0.9')
  })
})

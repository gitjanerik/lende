import { describe, it, expect } from 'vitest'
import { LENDE_SONE, STEDER, avvikTekst, sentralmeridian, sonebaand, utmSone } from './utmSoner.js'
import { nordavvikDeg, nordavvikISoneDeg } from './utm.js'

describe('sentralmeridian', () => {
  it('gir 6n − 183', () => {
    expect(sentralmeridian(31)).toBe(3)
    expect(sentralmeridian(32)).toBe(9)
    expect(sentralmeridian(33)).toBe(15)
    expect(sentralmeridian(35)).toBe(27)
  })

  it('legger Greenwich på en sonegrense og aldri i en sonemidte', () => {
    for (let s = 1; s <= 60; s++) expect(sentralmeridian(s)).not.toBe(0)
  })
})

describe('utmSone — vanlige 6°-bånd', () => {
  it('teller fra datolinja', () => {
    expect(utmSone(0, -180)).toBe(1)
    expect(utmSone(0, 0)).toBe(31)
    expect(utmSone(0, 5.9)).toBe(31)
    expect(utmSone(0, 6)).toBe(32)
    expect(utmSone(0, 179.9)).toBe(60)
  })

  it('svarer null på tull', () => {
    expect(utmSone(NaN, 5)).toBeNull()
    expect(utmSone(60, undefined)).toBeNull()
  })
})

describe('utmSone — Sørvestlands-unntaket', () => {
  it('strekker sone 32 vestover til 3° mellom 56° og 64° nord', () => {
    expect(utmSone(60.39, 5.32)).toBe(32)   // Bergen
    expect(utmSone(60, 3)).toBe(32)
    expect(utmSone(60, 2.9)).toBe(31)
  })

  it('gjelder ikke utenfor breddebåndet', () => {
    expect(utmSone(55.9, 5.32)).toBe(31)
    expect(utmSone(64, 5.32)).toBe(31)
  })
})

describe('utmSone — Svalbard', () => {
  it('bruker fire brede soner over 72° nord', () => {
    expect(utmSone(78.22, 15.63)).toBe(33)   // Longyearbyen
    expect(utmSone(78, 8.9)).toBe(31)
    expect(utmSone(78, 9)).toBe(33)
    expect(utmSone(78, 21)).toBe(35)
    expect(utmSone(78, 33)).toBe(37)
  })

  it('har ingen sone 32, 34 eller 36 der oppe', () => {
    for (let lo = 0; lo < 42; lo += 0.5) {
      expect([31, 33, 35, 37]).toContain(utmSone(78, lo))
    }
  })
})

describe('sonebaand', () => {
  it('dekker hele spennet uten hull', () => {
    for (const lat of [55, 60, 69, 78]) {
      const b = sonebaand(lat, 0, 36)
      expect(b[0].fra).toBe(0)
      expect(b[b.length - 1].til).toBeCloseTo(36, 6)
      for (let i = 1; i < b.length; i++) expect(b[i].fra).toBeCloseTo(b[i - 1].til, 6)
    }
  })

  it('flytter grensa mot sone 31 fra 6° til 3° inne i unntaks-båndet', () => {
    expect(sonebaand(69).map(b => `${b.sone}:${b.fra}`)).toContain('32:6')
    expect(sonebaand(60).map(b => `${b.sone}:${b.fra}`)).toContain('32:3')
  })

  it('gir fire soner på Svalbard og seks i Norge', () => {
    expect(sonebaand(78).map(b => b.sone)).toEqual([31, 33, 35, 37])
    expect(sonebaand(69).map(b => b.sone)).toEqual([31, 32, 33, 34, 35, 36])
  })

  it('bærer sentralmeridianen til sin egen sone', () => {
    for (const b of sonebaand(60)) expect(b.sentral).toBe(sentralmeridian(b.sone))
  })
})

describe('avvikTekst — fortegnet bæres av ordet', () => {
  it('skiller øst og vest', () => {
    expect(avvikTekst(3.2)).toEqual({ tall: '3,2°', retning: 'mot øst', hel: '3,2° mot øst' })
    expect(avvikTekst(-1.5).hel).toBe('1,5° mot vest')
  })

  it('lar null stå uten retning', () => {
    expect(avvikTekst(0).retning).toBe('')
    expect(avvikTekst(0).hel).toBe('0,0°')
  })

  it('tåler tull', () => {
    expect(avvikTekst(undefined).hel).toBe('0,0°')
  })
})

describe('nordavvikISoneDeg', () => {
  it('er nøyaktig nordavvikDeg i sone 32', () => {
    for (const s of STEDER) {
      expect(nordavvikISoneDeg(s.lat, s.lon, LENDE_SONE)).toBe(nordavvikDeg(s.lat, s.lon))
    }
  })

  it('er null på sonens egen sentralmeridian', () => {
    expect(Math.abs(nordavvikISoneDeg(69, 15, 33))).toBeLessThan(0.001)
    expect(Math.abs(nordavvikISoneDeg(60, 9, 32))).toBeLessThan(0.001)
  })

  it('snur fortegn rundt sentralmeridianen', () => {
    expect(nordavvikDeg(60.39, 5.32)).toBeGreaterThan(0)   // Bergen: sann nord mot øst
    expect(nordavvikDeg(59.91, 10.75)).toBeLessThan(0)     // Oslo: mot vest
  })

  it('viser hva sone 32 koster i nord — og at egen sone er mildere', () => {
    const vardo = { lat: 70.37, lon: 31.10 }
    const egen = utmSone(vardo.lat, vardo.lon)
    expect(Math.abs(nordavvikDeg(vardo.lat, vardo.lon))).toBeGreaterThan(20)
    expect(Math.abs(nordavvikISoneDeg(vardo.lat, vardo.lon, egen))).toBeLessThan(4)
  })

  it('svarer 0 på tull', () => {
    expect(nordavvikISoneDeg(NaN, 5, 32)).toBe(0)
    expect(nordavvikISoneDeg(60, 5, NaN)).toBe(0)
  })
})

describe('STEDER', () => {
  it('dekker begge unntakene, så figuren kan vise dem med ett trykk', () => {
    const soner = STEDER.map(s => utmSone(s.lat, s.lon))
    expect(soner).toContain(32)   // Bergen, inne i Sørvestlands-unntaket
    expect(soner).toContain(33)   // Longyearbyen, Svalbard-inndelingen
  })
})

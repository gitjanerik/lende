import { describe, it, expect } from 'vitest'
import {
  STJERNEBILDE_NAVN, STJERNE_FAKTA, bayerNavn, stjernebildeFor, stjerneNavn, faktaFor,
} from './stjerneFakta.js'
import { STJERNER, FORMASJONER } from './stjerner.js'

// De løse stjernene: alt i katalogen som ikke inngår i en figur vi tegner.
// Samme regel som I_FORMASJON i himmelObjekter.js — den står i to filer fordi
// den ene er kilden og den andre er vakten, og en vakt som importerer svaret
// sitt fra det den vokter, vokter ingenting.
const I_FIGUR = new Set(FORMASJONER.flatMap((f) => f.stjerner))
const LOSE = STJERNER.filter((_, i) => !I_FIGUR.has(i))

// Nord for denne deklinasjonen kommer stjerna over horisonten et sted i Norge
// (Lindesnes ligger på 58°N, så alt over −32° står så vidt opp). Sør for den er
// den aldri synlig herfra, og et infokort for den kan ingen åpne.
const SYNLIG_FRA_NORGE = -31

describe('STJERNEBILDE_NAVN dekker de løse stjernene', () => {
  it('hver løs stjerne finner navnet på stjernebildet sitt', () => {
    // FEILMODUSEN: en bake med en høyere magnitudegrense — eller bare en ny
    // stjerne i HYG — slipper inn et stjernebilde tabellen ikke kjenner, og
    // kortet viser da en stjerne uten opphav. Det ser ut som en tom rad, ikke
    // som et manglende oppslag.
    for (const s of LOSE) {
      expect(stjernebildeFor(s.bayer), `${s.navn ?? s.bayer} (${s.bayer})`).toBeTruthy()
    }
  })

  it('inneholder ikke stjernebilder vi tegner figuren for', () => {
    // De femten figurene har sine navn i FORMASJONER og teksten sin i
    // stjernebildeInfo.js. Sto de også her, ville det norske navnet på Orion
    // bodd to steder — og to steder med samme faktum kommer i utakt.
    const tegnet = new Set(FORMASJONER.map((f) => f.latin))
    for (const [kode, sb] of Object.entries(STJERNEBILDE_NAVN)) {
      expect(tegnet.has(sb.latin), `${kode} tegnes alt som figur`).toBe(false)
    }
  })

  it('hver oppføring har latin, genitiv og norsk', () => {
    for (const [kode, sb] of Object.entries(STJERNEBILDE_NAVN)) {
      for (const felt of ['latin', 'genitiv', 'norsk']) {
        expect(typeof sb[felt], `${kode}.${felt}`).toBe('string')
        expect(sb[felt].trim().length, `${kode}.${felt}`).toBeGreaterThan(2)
      }
    }
  })
})

describe('bayerNavn', () => {
  it('skriver ut betegnelsen med gresk bokstav og genitiv', () => {
    expect(bayerNavn('Alp CMa')).toBe('α Canis Majoris')
    expect(bayerNavn('Zet Oph')).toBe('ζ Ophiuchi')
    expect(bayerNavn('Sig Sgr')).toBe('σ Sagittarii')
  })

  it('svarer null for et stjernebilde vi tegner figuren for', () => {
    // Betegnelsen bygges av STJERNEBILDE_NAVN, som med vilje BARE dekker dem vi
    // ikke tegner — figurene har navnet sitt i FORMASJONER. «Alp Tau» svarte
    // «α Tauri» fram til v6.5.14, og slutta å gjøre det i det Tyren ble tegnet.
    // Det er riktig: betegnelsen brukes bare på løse stjerner.
    expect(bayerNavn('Alp Tau')).toBeNull()
    expect(bayerNavn('Alp Aql')).toBeNull()
    expect(bayerNavn('Alp CrB')).toBeNull()
    expect(bayerNavn('Alp Ori')).toBeNull()
  })

  it('beholder komponent-nummeret som hevet skrift', () => {
    // γ¹ og γ² Velorum er to ulike stjerner. Slippes tallet, er navnet
    // tvetydig — og det er nettopp doble som bærer suffikset i HYG.
    expect(bayerNavn('Gam-2 Vel')).toBe('γ² Velorum')
    expect(bayerNavn('Bet-1 Sco')).toBe('β¹ Scorpii')
  })

  it('svarer null på noe den ikke kan tyde, framfor å gjette', () => {
    expect(bayerNavn(null)).toBeNull()
    expect(bayerNavn('')).toBeNull()
    expect(bayerNavn('Alp')).toBeNull()
    // Ukjent stjernebilde-kode: bedre ingen betegnelse enn «α ?». Merk at
    // figurene VI tegner også svarer null her — tabellen dekker bare de løse,
    // og det er dem betegnelsen brukes til.
    expect(bayerNavn('Alp Xyz')).toBeNull()
    expect(bayerNavn('Alp Ori')).toBeNull()
    // Ukjent bokstav-forkortelse.
    expect(bayerNavn('Qqq Tau')).toBeNull()
  })

  it('kan tyde betegnelsen til hver eneste løse stjerne', () => {
    for (const s of LOSE) {
      expect(bayerNavn(s.bayer), s.bayer).toBeTruthy()
    }
  })
})

describe('stjerneNavn', () => {
  it('foretrekker egennavnet', () => {
    expect(stjerneNavn({ navn: 'Aldebaran', bayer: 'Alp Tau' })).toBe('Aldebaran')
  })

  it('faller tilbake på betegnelsen når stjerna ikke har egennavn', () => {
    expect(stjerneNavn({ navn: null, bayer: 'Zet Oph' })).toBe('ζ Ophiuchi')
  })

  it('gir alltid noe å vise', () => {
    for (const s of LOSE) {
      expect(stjerneNavn(s).trim().length, s.bayer).toBeGreaterThan(1)
    }
  })
})

describe('STJERNE_FAKTA', () => {
  it('hver tekst hører til en stjerne vi faktisk kan vise', () => {
    // En tekst om en stjerne som ikke er i lista er et kort ingen kan åpne.
    const navn = new Set(LOSE.map((s) => s.navn).filter(Boolean))
    for (const key of Object.keys(STJERNE_FAKTA)) {
      expect(navn.has(key), `${key} er ikke en løs stjerne i katalogen`).toBe(true)
    }
  })

  it('handler bare om stjerner som kan sees fra Norge', () => {
    // Canopus og Sørkorset står i HYG, men kommer aldri over en norsk horisont —
    // og himmelObjekter slipper dem derfor aldri inn i lista.
    const dek = new Map(LOSE.map((s) => [s.navn, s.dek]))
    for (const key of Object.keys(STJERNE_FAKTA)) {
      expect(dek.get(key), `${key}`).toBeGreaterThan(SYNLIG_FRA_NORGE)
    }
  })

  it('hver navngitt stjerne innenfor katalogens egen lysstyrkegrense har en tekst', () => {
    // GRENSA FØLGER BAKEN og er ikke et tall vi fant på: 2,6 er MAG_GRENSE i
    // scripts/bygg-stjerner.mjs, altså «alt katalogen tar med fordi det er
    // lyst». Løftes den grensa en gang, skal ikke denne testen kreve prosa om
    // tusen nye stjerner — den skal fortsatt kreve det om de lyse.
    const mangler = LOSE
      .filter((s) => s.navn && s.mag <= 2.6 && s.dek > SYNLIG_FRA_NORGE)
      .filter((s) => !STJERNE_FAKTA[s.navn])
      .map((s) => `${s.navn} (${s.bayer}, mag ${s.mag})`)
    expect(mangler, 'lyse stjerner over norsk horisont uten tekst').toEqual([])
  })

  it('ingen tekst er en stubb, og ingen er en artikkel', () => {
    for (const [navn, tekst] of Object.entries(STJERNE_FAKTA)) {
      expect(tekst.trim().length, `${navn} er for kort`).toBeGreaterThan(60)
      expect(tekst.length, `${navn} er for lang for et kort på en telefon`)
        .toBeLessThan(500)
    }
  })

  it('faktaFor slår opp på egennavnet og svarer null ellers', () => {
    expect(faktaFor({ navn: 'Sirius' })).toBeTruthy()
    expect(faktaFor({ navn: null })).toBeNull()
    expect(faktaFor(null)).toBeNull()
    expect(faktaFor({ navn: 'Finnes ikke' })).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { navnevarianter } from './mal-n50-sti.mjs'

// Geonorges statiske filnavn normaliserer fylkesnavn, men vi vet ikke nøyaktig
// hvordan (æ/ø/å, mellomrom, samiske parallellnavn). Scriptet prober derfor
// flere varianter. Disse testene sikrer at settet faktisk dekker de formene
// som finnes i Norge — en variant som mangler er en kandidat vi aldri prøver.
//
// MERK: scriptet har toppnivå-kode som kjører ved import. Den avslutter tidlig
// (og stille) uten GDAL i PATH, som er tilfellet i testmiljøet.

describe('navnevarianter', () => {
  it('gir både understrek- og sammenskrevet form', () => {
    const v = navnevarianter('Møre og Romsdal')
    expect(v).toContain('Møre_og_Romsdal')
    expect(v).toContain('MøreogRomsdal')
    expect(v).toContain('More_og_Romsdal')
    expect(v).toContain('MoreogRomsdal')
  })

  it('stripper samisk parallellnavn etter tankestrek', () => {
    // «Nordland – Nordlánnda» → filnavnet bruker bare «Nordland».
    expect(navnevarianter('Nordland – Nordlánnda')).toEqual(['Nordland'])
    expect(navnevarianter('Finnmark – Finnmárku – Finmarkku')).toEqual(['Finnmark'])
  })

  it('translittererer æ, ø og å', () => {
    expect(navnevarianter('Værøy')).toContain('Vaeroy')
    expect(navnevarianter('Ålesund')).toContain('Alesund')
    expect(navnevarianter('Tromsø')).toContain('Tromso')
  })

  it('lar enkle navn stå urørt (én variant, ingen støy)', () => {
    expect(navnevarianter('Buskerud')).toEqual(['Buskerud'])
    expect(navnevarianter('Oslo')).toEqual(['Oslo'])
  })

  it('gir aldri duplikater', () => {
    for (const n of ['Buskerud', 'Møre og Romsdal', 'Nordland – Nordlánnda', 'Agder']) {
      const v = navnevarianter(n)
      expect(new Set(v).size).toBe(v.length)
    }
  })

  it('tåler navn uten mellomrom eller diakritikk uten å blåse opp settet', () => {
    expect(navnevarianter('Innlandet')).toHaveLength(1)
  })
})

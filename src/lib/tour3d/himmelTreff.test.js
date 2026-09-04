// KILDE-INVARIANTER for trykk i himmelen og veien ut av en globe.
//
// scene3d.js kan ikke enhetstestes — den eier three.js, en renderer og en
// WebGL-kontekst — men de tre reglene under er lette å «rydde» bort i god tro,
// og da svikter de STILLE: et trykk som ikke velger noe ser ut som et trykk som
// bommet. Testen leser derfor kilden, som `swCacheRydding.test.js` gjør for
// service-workeren.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const her = fileURLToPath(new URL('.', import.meta.url))
const scene3d = readFileSync(`${her}scene3d.js`, 'utf8')
const sceneCore = readFileSync(`${her}sceneCore.js`, 'utf8')

describe('himmelen vinner over terrenget om natta', () => {
  it('spør himmelen også når strålen TRAFF terrenget — gatet på natt', () => {
    // Uten denne linja virker bare den øvre halvdelen av trefflaten til en
    // stjerne som står rett over horisonten: bommer man nedover, spiser
    // terrenget trykket.
    expect(scene3d).toMatch(/if \(core\.erNatt && plukkHimmel\(\)\) return/)
  })

  it('gaten leser natta fra sceneCore, som er den ene eieren av flagget', () => {
    expect(sceneCore).toMatch(/get erNatt\(\) \{ return nightOn \}/)
  })

  it('gaten står ETTER terrenget — om dagen er rekkefølgen uendret', () => {
    // Himmellista ryddes ikke når natta slås av, så en dagshimmel bærer
    // fortsatt objekter ingen kan se. Sto gaten uten `core.erNatt`, ville et
    // trykk i en blå himmel valgt en usynlig stjerne.
    const iTreff = scene3d.indexOf('if (core.erNatt && plukkHimmel()) return')
    const iBom = scene3d.indexOf('if (!hit) return void plukkHimmel()')
    expect(iBom).toBeGreaterThan(0)
    expect(iTreff).toBeGreaterThan(iBom)
  })

  it('plukkHimmel svarer med en boolean, ellers kan gaten ikke lese den', () => {
    // `return` uten verdi ville gjort gaten alltid-falsk, og fiksen til pynt.
    expect(scene3d).toMatch(/function plukkHimmel\(\) \{\s*\n\s*if \(!himmelListe\.length\) return false/)
    expect(scene3d).toMatch(/if \(!best\) return false/)
  })
})

describe('veien ut av en globe har ÉN kilde', () => {
  it('avsluttGlobe lukker kula OG melder at kortet skal legges sammen', () => {
    const i = scene3d.indexOf('function avsluttGlobe()')
    expect(i).toBeGreaterThan(0)
    const kropp = scene3d.slice(i, i + 400)
    expect(kropp).toContain('lukkGlobe()')
    expect(kropp).toContain("emit('globe-avsluttet'")
  })

  it('trykket utenfor kula går gjennom den, ikke gjennom en egen kopi', () => {
    expect(scene3d).toMatch(/if \(core\.globeAapen\) \{ avsluttGlobe\(\); return \}/)
    // Bare ÉN kilde emitter hendelsen — to steder kommer i utakt.
    expect(scene3d.match(/emit\('globe-avsluttet'/g)).toHaveLength(1)
  })

  it('er eksponert på motoren, så knappen i viseren kan bruke samme vei', () => {
    expect(scene3d).toMatch(/^\s*avsluttGlobe,$/m)
  })
})

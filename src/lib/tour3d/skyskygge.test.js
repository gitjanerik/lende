// Skyskyggene. Ingen WebGL: det som kan gå galt her er BOKFØRINGEN — hvilke
// skyer som havner i uniform-tabellen, i hvilken rekkefølge feltene ligger, og
// at klarvær faktisk gir null skygge. Selve projeksjonen skjer i shaderen og er
// verifisert med en render; det som testes her er tallene den får inn.
import { describe, it, expect } from 'vitest'
import { Vector3, MeshBasicMaterial } from 'three'
import { lagSkyskygge, MAKS_SKYER } from './skyskygge.js'

function sky(x, y, z, radius, visible = true) {
  return { position: new Vector3(x, y, z), visible, userData: { skyggeRadius: radius } }
}

describe('lagSkyskygge', () => {
  it('pakker senter som (x, z, radius) — ikke (x, y, z)', () => {
    const s = lagSkyskygge()
    s.oppdater([sky(100, 1500, -200, 480)], 900, null)
    const a = s.uniforms.uSkySenter.value
    expect(a[0]).toBe(100)
    expect(a[1]).toBe(-200)
    expect(a[2]).toBe(480)
    expect(s.uniforms.uSkyAntall.value).toBe(1)
  })

  it('hopper over usynlige skyer — klarvær kaster ingen skygge', () => {
    const s = lagSkyskygge()
    s.oppdater([sky(0, 1500, 0, 400, false), sky(50, 1500, 60, 400, false)], 900, null)
    expect(s.uniforms.uSkyAntall.value).toBe(0)
  })

  it('pakker de synlige tett, uten hull etter de usynlige', () => {
    const s = lagSkyskygge()
    s.oppdater([sky(0, 1500, 0, 100, false), sky(9, 1500, 8, 200)], 900, null)
    const a = s.uniforms.uSkySenter.value
    expect(s.uniforms.uSkyAntall.value).toBe(1)
    expect(a[0]).toBe(9)
    expect(a[2]).toBe(200)
  })

  it('stopper på MAKS_SKYER framfor å skrive utenfor tabellen', () => {
    const s = lagSkyskygge()
    const mange = Array.from({ length: MAKS_SKYER + 9 }, (_, i) => sky(i * 10, 1500, 0, 300))
    expect(() => s.oppdater(mange, 900, null)).not.toThrow()
    expect(s.uniforms.uSkyAntall.value).toBe(MAKS_SKYER)
  })

  it('setter skyhøyden til gjennomsnittet av de synlige', () => {
    const s = lagSkyskygge()
    s.oppdater([sky(0, 1000, 0, 300), sky(0, 2000, 0, 300), sky(0, 5000, 0, 300, false)], 900, null)
    expect(s.uniforms.uSkyHoyde.value).toBe(1500)
  })

  it('faller tilbake til radius-argumentet når skya mangler sin egen', () => {
    const s = lagSkyskygge()
    s.oppdater([{ position: new Vector3(0, 1500, 0), visible: true, userData: {} }], 777, null)
    expect(s.uniforms.uSkySenter.value[2]).toBe(777)
  })

  it('tar sol-retningen fra kallet, så den følger relieffet', () => {
    const s = lagSkyskygge()
    const sol = new Vector3(-0.5, 0.707, -0.5).normalize()
    s.oppdater([sky(0, 1500, 0, 300)], 900, sol)
    expect(s.uniforms.uSolRetning.value.z).toBeLessThan(0)
    expect(s.uniforms.uSolRetning.value.y).toBeGreaterThan(0)
  })

  it('festTil injiserer skyggen etter at kartfargen er ferdig', () => {
    const s = lagSkyskygge({ styrke: 0.4 })
    const mat = new MeshBasicMaterial()
    s.festTil(mat)
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <project_vertex>\n',
      fragmentShader: '#include <common>\n#include <dithering_fragment>\n',
    }
    mat.onBeforeCompile(shader)
    expect(shader.uniforms.uSkySenter).toBe(s.uniforms.uSkySenter)
    expect(shader.vertexShader).toContain('vVerden =')
    expect(shader.fragmentShader).toContain('gl_FragColor.rgb *= 1.0 - skygge')
    // Skyggen MÅ komme etter dithering_fragment, ellers ganges den bort igjen.
    const iDither = shader.fragmentShader.indexOf('#include <dithering_fragment>')
    expect(shader.fragmentShader.indexOf('gl_FragColor.rgb *= 1.0 - skygge')).toBeGreaterThan(iDither)
    expect(s.uniforms.uSkyggeStyrke.value).toBe(0.4)
  })
})

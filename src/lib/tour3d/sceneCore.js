// Rute-uavhengig kjerne for alle 3D-visninger i Lende.
//
// Alt som handler om SELVE VERDEN — renderer, kamera, koordinatrom, terreng,
// karttekstur (aktivt tema), himmel, skyer, natt, høydekurver og render-loopen
// — bor her. Turvisningen (tourScene) og utforskeren (exploreScene) bygger
// begge på denne, slik at en forbedring av terreng eller himmel treffer begge
// uten at noen må huske å kopiere den.
//
// Kjernen eier IKKE tid, rute eller kamerabevegelse. Kallerens onFrame styrer
// kameraet og bestemmer selv når `render()` skjer — rekkefølgen er signifikant,
// fordi `project()` leser kameraets matriser slik de sto ved siste render.

import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, SRGBColorSpace, NoToneMapping, Vector3,
} from 'three'
import { makeCoords } from './coords.js'
import { buildTerrainMesh } from './terrainMesh.js'
import { buildMapTexture, buildFallbackTexture } from './mapTexture.js'
import { buildSkyDome, buildClouds, buildNightSky, makeFog, FOG_COLOR, NIGHT_FOG_COLOR } from './skyDome.js'
import { createEngineLoop } from './engineLoop.js'

export class TourSceneError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.code = code
  }
}

/**
 * @param {HTMLElement} container
 * @param {{dem: object, meta: object, svgText: string, options?: {exaggeration?: number}}} spec
 * @param {{onFrame: (dt:number, timeS:number)=>void, onResize?: (w:number,h:number)=>void,
 *          onContextLost?: ()=>void}} hooks
 */
export async function createSceneCore(container, { dem, meta, svgText, options = {} }, hooks = {}) {
  if (!dem) throw new TourSceneError('no-dem', 'Kartet mangler høydedata')

  const { exaggeration = 1.15 } = options

  const dpr = Math.min(window.devicePixelRatio || 1, (navigator.deviceMemory ?? 4) <= 4 ? 1.5 : 2)
  let renderer
  try {
    renderer = new WebGLRenderer({
      antialias: dpr < 1.8,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    })
  } catch {
    throw new TourSceneError('no-webgl', 'WebGL utilgjengelig')
  }
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  container.appendChild(renderer.domElement)
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;'

  const scene = new Scene()
  scene.background = new Color(FOG_COLOR)
  scene.fog = makeFog(Math.max(meta.widthM, meta.heightM))
  const camera = new PerspectiveCamera(55, 1, 1, 60000)

  const coords = makeCoords({ widthM: meta.widthM, heightM: meta.heightM, exaggeration })

  // Tekstur: kart-SVG rasterisert; hillshade-fallback ved feil. Natt-
  // teksturen (mørkt tema) bygges lazily ved første sol/måne-bytte.
  let texture
  try {
    texture = await buildMapTexture(svgText, dem, { renderer })
  } catch {
    texture = buildFallbackTexture(dem)
  }
  let nightTexture = null
  let nightOn = false

  const terrain = buildTerrainMesh(dem, coords, texture)
  scene.add(terrain.mesh)

  const sky = buildSkyDome()
  scene.add(sky.mesh)
  const clouds = buildClouds({
    widthM: meta.widthM,
    heightM: meta.heightM,
    baseY: Math.max(1200, terrain.maxElev * exaggeration + 350),
  })
  scene.add(clouds.group)
  // Måne + bitte små gule stjerner (v4.8.5). Skjult som default; setNightMode
  // slår hele gruppa av/på sammen med skyene.
  const nightSky = buildNightSky()
  scene.add(nightSky.group)

  // Høydekurver i terrenget: togglebart lag — bygges lazily.
  let contours = null
  let contoursVisible = false
  const contourIntervalM = Number.isFinite(meta.equidistance) && meta.equidistance > 0
    ? meta.equidistance : 20

  const loop = createEngineLoop({
    renderer, camera, container,
    onResize(w, h) {
      contours?.setResolution(w, h)
      hooks.onResize?.(w, h)
    },
    onFrame: (dt, timeS) => hooks.onFrame?.(dt, timeS),
    onContextLost: () => hooks.onContextLost?.(),
    onContextRestored: () => { texture.needsUpdate = true },
  })

  for (const d of [
    texture, terrain.geometry, terrain.material,
    sky.geometry, sky.material, clouds, nightSky,
  ]) loop.track(d)

  const _v = new Vector3()

  return {
    renderer,
    scene,
    camera,
    coords,
    terrain,
    loop,
    track: (d) => loop.track(d),
    start: () => loop.start(),
    resize: () => loop.resize(),

    render() { renderer.render(scene, camera) },

    // Bakgrunnsbevegelse som ikke avhenger av hva kalleren gjør med kameraet.
    updateAmbient(dt) { clouds.update(dt) },

    // Skjermkoordinat for et world-punkt. Leser kameraets matriser fra siste
    // render — kall etter render() for et resultat uten én frames etterslep.
    project(x, y, z) {
      _v.set(x, y, z).project(camera)
      const w = container.clientWidth
      const h = container.clientHeight
      return { x: ((_v.x + 1) / 2) * w, y: ((1 - _v.y) / 2) * h, behind: _v.z > 1 }
    },

    async setContoursVisible(v) {
      contoursVisible = !!v
      if (contoursVisible && !contours) {
        const { buildContourLines } = await import('./contourLines.js')
        contours = buildContourLines(terrain.dem, coords, { intervalM: contourIntervalM })
        contours.setResolution(container.clientWidth, container.clientHeight)
        loop.track(contours)
        scene.add(contours.group)
      }
      if (contours) contours.group.visible = contoursVisible
    },
    get contoursVisible() { return contoursVisible },

    // Sol/måne: bytt terrengtekstur til mørkt tema (rasterisert lazily fra
    // medsendt SVG), nattehimmel, mørk dis og skyene av.
    async setNightMode(on, { svgText: nightSvgText } = {}) {
      nightOn = !!on
      if (nightOn && !nightTexture && nightSvgText) {
        try {
          nightTexture = await buildMapTexture(nightSvgText, dem, { renderer, night: true })
          loop.track(nightTexture)
        } catch { /* beholder dag-teksturen */ }
      }
      const tex = nightOn && nightTexture ? nightTexture : texture
      if (terrain.material.map !== tex) {
        terrain.material.map = tex
        terrain.material.needsUpdate = true
      }
      sky.setNight(nightOn)
      nightSky.setNight(nightOn)
      clouds.group.visible = !nightOn
      scene.fog.color.set(nightOn ? NIGHT_FOG_COLOR : FOG_COLOR)
      scene.background.set(nightOn ? NIGHT_FOG_COLOR : FOG_COLOR)
    },
    get nightOn() { return nightOn },

    dispose() { loop.dispose() },
  }
}

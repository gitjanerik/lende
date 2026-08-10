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
import {
  buildMapTexture, buildFallbackTexture, textureSourceIsBlank,
  pickTextureSize, PREVIEW_TEXTURE_PX,
  prepareMapTextureSource, rasterizeMapTexture,
} from './mapTexture.js'
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
 * @param {{dem: object, meta: object, svgText: string,
 *          getSvgText?: (opts?: object) => string,
 *          onProgress?: (msg: string|null) => void,
 *          options?: {exaggeration?: number}}} spec
 *   getSvgText brukes til å bygge teksturen PÅ NYTT senere — både når den
 *   skjerpes til full oppløsning og når nettleseren har tømt kilde-lerretet.
 * @param {{onFrame: (dt:number, timeS:number)=>void, onResize?: (w:number,h:number)=>void,
 *          onContextLost?: ()=>void}} hooks
 */
export async function createSceneCore(container, {
  dem, meta, svgText, getSvgText = null, onProgress = null, options = {},
}, hooks = {}) {
  if (!dem) throw new TourSceneError('no-dem', 'Kartet mangler høydedata')

  const { exaggeration = 1.15 } = options
  const melding = (m) => { try { onProgress?.(m) } catch { /* UI-feil skal ikke stoppe bygging */ } }

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

  // Tekstur: kart-SVG rasterisert; hillshade-fallback ved feil. Vi åpner på en
  // liten forhåndsvisning og skjerper i bakgrunnen (upgradeTexture), fordi
  // opplastingen av et 4096²-lerret til GPU-en er det som får store kart til å
  // føles trege — selve rasteriseringen tar under et par hundre millisekunder.
  // Natt-teksturen (mørkt tema) bygges lazily ved første sol/måne-bytte.
  melding('Tegner kartet på terrenget …')
  const fullPx = pickTextureSize(renderer)
  let texturePx = Math.min(PREVIEW_TEXTURE_PX, fullPx)
  let texture
  // Dag-kilden holdes åpen til teksturen er skjerpet, så skjerpingen slipper å
  // rasterisere SVG-en på nytt (det er den dyre delen, ikke lerret-størrelsen).
  let daySource = null
  try {
    daySource = await prepareMapTextureSource(svgText)
    texture = rasterizeMapTexture(daySource, dem, { renderer, sizePx: texturePx })
  } catch {
    daySource?.dispose()
    daySource = null
    texture = buildFallbackTexture(dem)
    texturePx = fullPx   // ingen vits i å skjerpe en fallback
  }
  let nightTexture = null
  let nightOn = false
  let disposed = false

  melding('Bygger terrengmodellen …')
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

  // Den aktive teksturen — den som faktisk ligger på terrenget nå.
  const aktivTekstur = () => (nightOn && nightTexture ? nightTexture : texture)

  /**
   * Sjekk at terrengteksturen fortsatt har innhold, og bygg den på nytt hvis
   * nettleseren har tømt kilde-lerretet mens vi lå i bakgrunnen. Uten dette
   * kom man tilbake til et helt SVART terreng (stier og himmel sto igjen,
   * siden de ikke bruker teksturer).
   */
  async function revalidateTexture() {
    if (disposed) return
    const tex = aktivTekstur()
    if (!textureSourceIsBlank(tex)) {
      tex.needsUpdate = true
      terrain.material.needsUpdate = true
      return
    }
    console.warn('[3D] Terrengteksturen var tømt — bygger den på nytt')
    const kilde = getSvgText?.({ dark: nightOn })
    if (!kilde) return
    try {
      const ny = await buildMapTexture(kilde, dem, { renderer, sizePx: texturePx, night: nightOn })
      if (disposed) { ny.dispose(); return }
      loop.track(ny)
      const gammel = tex
      if (nightOn && nightTexture) nightTexture = ny
      else texture = ny
      terrain.material.map = aktivTekstur()
      terrain.material.needsUpdate = true
      gammel.dispose()
    } catch {
      // Klarer vi ikke rasterisere på nytt, er hillshade bedre enn svart.
      const fallback = buildFallbackTexture(dem)
      loop.track(fallback)
      if (nightOn && nightTexture) nightTexture = fallback
      else texture = fallback
      terrain.material.map = aktivTekstur()
      terrain.material.needsUpdate = true
    }
  }

  const loop = createEngineLoop({
    renderer, camera, container,
    onResize(w, h) {
      contours?.setResolution(w, h)
      hooks.onResize?.(w, h)
    },
    onFrame: (dt, timeS) => hooks.onFrame?.(dt, timeS),
    onContextLost: () => hooks.onContextLost?.(),
    // Etter kontekst-tap laster three teksturene opp igjen fra kilden — er
    // kilden tom, må den bygges på nytt.
    onContextRestored: () => { void revalidateTexture() },
    onVisible: () => { void revalidateTexture() },
  })

  /**
   * Bytt forhåndsvisningen mot full oppløsning når scenen er i gang. Bruker
   * den allerede dekodede kilden, så dette er bare en ny drawImage — ikke en
   * ny rasterisering av kart-SVG-en.
   */
  async function upgradeTexture() {
    if (disposed || texturePx >= fullPx) return
    try {
      melding('Skjerper kartbildet …')
      const kilde = daySource ?? await prepareMapTextureSource(getSvgText?.({ dark: false }) ?? svgText)
      const ny = rasterizeMapTexture(kilde, dem, { renderer, sizePx: fullPx })
      if (disposed) { ny.dispose(); return }
      loop.track(ny)
      const gammel = texture
      texture = ny
      texturePx = fullPx
      // Står brukeren i nattmodus, skal dag-teksturen bare ligge klar.
      if (!nightOn) {
        terrain.material.map = texture
        terrain.material.needsUpdate = true
      }
      gammel.dispose()
    } catch {
      /* behold forhåndsvisningen — den er fullt brukbar */
    } finally {
      // Kilden holdt SVG-rasteret i minne; nå er den gjort sitt.
      daySource?.dispose()
      daySource = null
      melding(null)
    }
  }

  // Etter at scenen er tegnet én gang: skjerp i bakgrunnen.
  if (texturePx < fullPx) {
    const start = () => { void upgradeTexture() }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2500 })
    else setTimeout(start, 600)
  }

  for (const d of [
    texture, terrain.geometry, terrain.material,
    sky.geometry, sky.material, clouds, nightSky,
  ]) loop.track(d)

  melding(null)

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
      const tex = aktivTekstur()
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

    // Eksponert for testing og for kallere som vil sjekke etter en lang pause.
    revalidateTexture,

    dispose() {
      disposed = true
      // Lukkes visningen før skjerpingen rakk å kjøre, ligger SVG-rasteret
      // fortsatt og holder minne via objectURL-en.
      daySource?.dispose()
      daySource = null
      loop.dispose()
    },
  }
}

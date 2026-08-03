// Orkestratoren: bygger scene, terreng, rute, playback, kameraer og
// feature-koreografi, og eksponerer controller-API-et som Vue-komponentene
// binder seg tynt mot. All GPU-ressurs registreres i engineLoop-ens
// dispose-register.

import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, SRGBColorSpace, NoToneMapping, Vector3,
} from 'three'
import { sampleElevation } from '../demSampling.js'
import { makeCoords } from './coords.js'
import { buildTerrainMesh } from './terrainMesh.js'
import { buildMapTexture, buildFallbackTexture } from './mapTexture.js'
import { buildRoutePath, makePositionLookup } from './routePath.js'
import { buildRouteLine, buildRouteMarker } from './routeLine.js'
import { buildFlybyPath } from './flybyPath.js'
import { createPlayback, buildCumulativeAscent } from './playback.js'
import { createCameraRigs } from './cameraRigs.js'
import { buildFeatureTimeline } from './featureTimeline.js'
import { createFeatureDirector } from './featureDirector.js'
import { buildHighlightMarker } from './highlightMarkers.js'
import { buildSkyDome, buildClouds, buildNightSky, makeFog, FOG_COLOR, NIGHT_FOG_COLOR } from './skyDome.js'
import { buildWaypointMarkers } from './waypointMarkers.js'
import { createEngineLoop } from './engineLoop.js'

export class TourSceneError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.code = code
  }
}

const PROGRESS_EMIT_MS = 250

export async function createTourScene(container, {
  dem, meta, svgText, route, features = [],
  via = [], isLoop = false, parkingSpots = [], pauseSpots = [],
  profileSamples = null, estWalkMinutes = null,
  options = {},
}) {
  if (!dem) throw new TourSceneError('no-dem', 'Kartet mangler høydedata')
  if (!route?.coordinates || route.coordinates.length < 2) {
    throw new TourSceneError('no-route', 'Ingen rute å vise')
  }

  const {
    exaggeration = 1.15,
    initialCameraMode = 'follow',
    speedKmh = 4.5,
    timeScale = 128,
  } = options

  const dpr = Math.min(window.devicePixelRatio || 1, (navigator.deviceMemory ?? 4) <= 4 ? 1.5 : 2)
  let renderer
  try {
    renderer = new WebGLRenderer({
      antialias: dpr < 1.8,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    })
  } catch (err) {
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

  const waypoints = buildWaypointMarkers({ route, via, isLoop, parkingSpots, pauseSpots }, dem, coords)
  scene.add(waypoints.group)

  // Høydekurver i terrenget: togglebart lag, default av — bygges lazily.
  let contours = null
  let contoursVisible = false
  const contourIntervalM = Number.isFinite(meta.equidistance) && meta.equidistance > 0
    ? meta.equidistance : 20

  const routePath = buildRoutePath(route.coordinates, dem, coords)
  const routeLookup = makePositionLookup(routePath)
  const routeLine = buildRouteLine(routePath)
  scene.add(routeLine.mesh)
  const marker = buildRouteMarker()
  scene.add(marker.sphere)
  scene.add(marker.ring)

  const flybyPath = buildFlybyPath(route.coordinates, dem, coords)
  const flybyLookup = makePositionLookup(flybyPath)

  const playback = createPlayback({
    totalM: routePath.totalM,
    estWalkMinutes,
    cumAscent: profileSamples ? buildCumulativeAscent(profileSamples) : null,
    speedKmh,
    timeScale,
  })

  const listeners = new Map()
  const emit = (event, payload) => {
    for (const cb of listeners.get(event) ?? []) {
      try { cb(payload) } catch { /* lytterfeil skal ikke stoppe loopen */ }
    }
  }

  const highlight = buildHighlightMarker()
  scene.add(highlight.group)

  const featureWorldPos = (f) => {
    const e = sampleElevation(dem, f.x, f.y)
    const elev = Number.isFinite(e) ? e : 0
    return coords.toWorld(f.x, f.y, elev)
  }

  const rigs = createCameraRigs({
    camera, dem, coords, routeLookup, flybyLookup, domElement: renderer.domElement,
  })

  const director = createFeatureDirector(buildFeatureTimeline(features, route.coordinates), {
    onEnter: (ev) => {
      const [fx, fy, fz] = featureWorldPos(ev)
      highlight.showAt(fx, fy, fz)
      if (rigs.mode !== 'free') {
        rigs.setFrameTarget({
          x: fx, y: fy, z: fz,
          radius: ev.areaM2 ? Math.sqrt(ev.areaM2 / Math.PI) : 60,
        })
      }
      emit('feature-enter', { feature: ev, screenPos: project(fx, fy, fz) })
    },
    onExit: (ev) => {
      highlight.hide()
      rigs.clearFrameTarget()
      emit('feature-exit', { feature: ev })
    },
  })

  const _v = new Vector3()
  function project(x, y, z) {
    _v.set(x, y, z).project(camera)
    const w = container.clientWidth
    const h = container.clientHeight
    return { x: ((_v.x + 1) / 2) * w, y: ((1 - _v.y) / 2) * h, behind: _v.z > 1 }
  }

  let lastProgressEmit = 0
  let disposedFlag = false

  // Forhåndsvist feature under scrubbing (tidsakse-drag) — uavhengig av
  // direktørens HOLD-koreografi. featuresEnabled speiler nål/POI-togglen.
  let featuresEnabled = true
  let previewFeature = null
  const clearPreview = () => {
    if (!previewFeature) return
    emit('feature-exit', { feature: previewFeature })
    previewFeature = null
    highlight.hide()
  }

  const loop = createEngineLoop({
    renderer, camera, container,
    onResize(w, h) {
      contours?.setResolution(w, h)
    },
    onFrame(dt, timeS) {
      const dtMs = dt * 1000
      const varFerdig = playback.finished
      playback.tick(dt)
      const alongM = playback.alongM
      // Tok turen slutt midt i et POI-stopp, må holdet avsluttes: direktøren
      // fryses under (kjører bare mens turen spiller), så kortet ville ellers
      // stått igjen på skjermen for alltid. seek() kaller onExit.
      if (!varFerdig && playback.finished) director.seek(alongM)
      // Direktøren kjører BARE mens turen spiller (v4.8.5). Står visningen
      // pauset eller ferdig, skal ingen severdighet utløses — kameraet ville
      // ellers pendlet mellom POI-innramming og posisjonen turen stoppet på.
      // Scrubbing viser POI-kort via eventNear/clearPreview, uavhengig av dette.
      const dir = playback.playing
        ? director.tick(alongM, dtMs)
        : { speedFactor: 1, state: director.state, active: director.active }
      playback.setSpeedFactor(dir.speedFactor)

      const p = routeLookup.at(alongM)
      marker.setPosition(p[0], p[1], p[2])
      marker.pulse(timeS)
      routeLine.setProgress(alongM)
      highlight.update(timeS, camera)
      clouds.update(dt)
      waypoints.update(camera)
      rigs.update(dt, alongM)

      renderer.render(scene, camera)

      const nowMs = timeS * 1000
      if (nowMs - lastProgressEmit > PROGRESS_EMIT_MS) {
        lastProgressEmit = nowMs
        const stats = playback.stats()
        emit('progress', {
          ...stats,
          elevM: coords.worldYToElev(p[1]) - 3,
          screenPos: project(p[0], p[1], p[2]),
          cameraMode: rigs.mode,
          directorState: dir.state,
          activeFeature: dir.active,
        })
        if (stats.finished) emit('finished', stats)
      }
    },
    onContextLost: () => emit('context-lost', {}),
    onContextRestored: () => { texture.needsUpdate = true },
  })

  for (const d of [
    texture, terrain.geometry, terrain.material,
    routeLine.geometry, routeLine.material,
    ...marker.geometries, ...marker.materials,
    ...highlight.geometries, ...highlight.materials,
    sky.geometry, sky.material, clouds, nightSky, waypoints,
  ]) loop.track(d)

  await rigs.setMode(initialCameraMode, 0)
  loop.start()
  emit('ready', {})

  return {
    play: () => {
      clearPreview()
      playback.play()
    },
    pause: () => playback.pause(),
    restart: () => {
      clearPreview()
      playback.restart()
      director.seek(0)
    },
    seek: (alongM) => {
      playback.seek(alongM)
      director.seek(alongM)
    },
    // Tidsakse-scrubbing: brukeren drar seg fram/tilbake langs turen.
    // Kameraet følger (rigs.update går på alongM hver frame), POI innen
    // vindu vises som forhåndsvisning, og avspillingen forblir pauset.
    scrubStart: () => playback.pause(),
    scrub: (alongM) => {
      playback.seek(alongM)
      director.seek(alongM)
      const ev = featuresEnabled ? director.eventNear(alongM, 150) : null
      if (ev !== previewFeature) {
        if (previewFeature) emit('feature-exit', { feature: previewFeature })
        previewFeature = ev
        if (ev) {
          const [fx, fy, fz] = featureWorldPos(ev)
          highlight.showAt(fx, fy, fz)
          emit('feature-enter', { feature: ev, screenPos: project(fx, fy, fz) })
        } else {
          highlight.hide()
        }
      }
    },
    scrubEnd: () => {},
    setSpeed: (kmh) => playback.setSpeed(kmh),
    setTimeScale: (x) => playback.setTimeScale(x),
    setCameraMode: async (m) => {
      const prev = rigs.mode
      await rigs.setMode(m, playback.alongM)
      if (prev === 'free' && m !== 'free') rigs.syncFromCamera(playback.alongM)
      emit('mode-changed', { mode: m })
    },
    setFollowParams: (p) => rigs.setFollowParams(p),
    skipFeature: () => director.skip(),
    setFeaturesEnabled: (v) => {
      featuresEnabled = !!v
      director.setEnabled(featuresEnabled)
      // Synk direktøren til der turen FAKTISK står (v4.8.5). Var POI av under
      // avspillingen, sto peker-indeksen urørt på 0 — slo man den så på etter
      // at turen var ferdig, spilte direktøren seg gjennom hele lista fra
      // starten mens posisjonen lå på mål: kameraet rammet inn en severdighet,
      // returnerte til punkt B, rammet inn neste … «hopper tilbake til B
      // annenhver gang». Etter seek peker indeksen forbi nåværende posisjon,
      // så bare severdigheter man ennå ikke har passert kan utløses.
      if (featuresEnabled) director.seek(playback.alongM)
      if (!featuresEnabled) clearPreview()
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
    setPinsVisible(v) { waypoints.setPinsVisible(v) },
    // Sol/måne: bytt terrengtekstur til mørkt tema (rasterisert lazily fra
    // medsendt SVG), nattehimmel, mørk dis og skyene av. Kurve-tvang i natt-
    // modus håndheves av UI-laget.
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
    setFeatures: (features) => {
      director.setEvents(buildFeatureTimeline(features, route.coordinates), playback.alongM)
    },
    on: (event, cb) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(cb)
    },
    off: (event, cb) => listeners.get(event)?.delete(cb),
    resize: () => loop.resize(),
    get state() {
      return { ...playback.stats(), cameraMode: rigs.mode, activeFeature: director.active }
    },
    get totalM() { return routePath.totalM },
    dispose() {
      if (disposedFlag) return
      disposedFlag = true
      rigs.dispose()
      listeners.clear()
      loop.dispose()
    },
  }
}

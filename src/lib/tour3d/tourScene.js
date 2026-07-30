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
import { buildSkyDome, buildClouds, makeFog, FOG_COLOR } from './skyDome.js'
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
  via = [], isLoop = false, parkingSpots = [],
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
    timeScale = 30,
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

  // Tekstur: kart-SVG rasterisert; hillshade-fallback ved feil.
  let texture
  try {
    texture = await buildMapTexture(svgText, dem, { renderer })
  } catch {
    texture = buildFallbackTexture(dem)
  }

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

  const waypoints = buildWaypointMarkers({ route, via, isLoop, parkingSpots }, dem, coords)
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
  // direktørens HOLD-koreografi.
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
      playback.tick(dt)
      const alongM = playback.alongM
      const dir = director.tick(alongM, dtMs)
      playback.setSpeedFactor(dir.speedFactor)

      const p = routeLookup.at(alongM)
      marker.setPosition(p[0], p[1], p[2])
      marker.pulse(timeS)
      routeLine.setProgress(alongM)
      highlight.update(timeS, camera)
      clouds.update(dt)
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
    sky.geometry, sky.material, clouds, waypoints,
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
      const ev = director.eventNear(alongM, 150)
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
    setFeaturesEnabled: (v) => director.setEnabled(v),
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

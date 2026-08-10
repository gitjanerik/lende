// Orkestratoren for TURVISNINGEN: legger rute, playback, kameraer og
// feature-koreografi oppå den delte scene-kjernen (sceneCore), og eksponerer
// controller-API-et som Vue-komponentene binder seg tynt mot. Verden selv —
// terreng, tekstur, himmel, natt, kurver, render-loop — eies av kjernen og
// deles med utforskeren.

import { sampleElevation } from '../demSampling.js'
import { createSceneCore, TourSceneError } from './sceneCore.js'
import { buildRoutePath, makePositionLookup } from './routePath.js'
import { buildRouteLine, buildRouteMarker } from './routeLine.js'
import { buildFlybyPath } from './flybyPath.js'
import { createPlayback, buildCumulativeAscent } from './playback.js'
import { createCameraRigs } from './cameraRigs.js'
import { buildFeatureTimeline } from './featureTimeline.js'
import { createFeatureDirector } from './featureDirector.js'
import { buildHighlightMarker } from './highlightMarkers.js'
import { buildWaypointMarkers } from './waypointMarkers.js'
import { buildGpsMarker } from './gpsMarker.js'

export { TourSceneError }

const PROGRESS_EMIT_MS = 250

export async function createTourScene(container, {
  dem, meta, svgText, getSvgText = null, onProgress = null, route, features = [],
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

  // Verden bygges av den delte kjernen; onFrame/onResize kobles på under.
  const hooks = {}
  const core = await createSceneCore(
    container,
    { dem, meta, svgText, getSvgText, onProgress, options: { exaggeration } },
    hooks,
  )
  const { scene, camera, coords, loop } = core
  const project = core.project

  const waypoints = buildWaypointMarkers({ route, via, isLoop, parkingSpots, pauseSpots }, dem, coords)
  scene.add(waypoints.group)

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

  // Live GPS-posisjon — bygges lazily ved første posisjon fra viewer-laget.
  let gps = null

  const featureWorldPos = (f) => {
    const e = sampleElevation(dem, f.x, f.y)
    const elev = Number.isFinite(e) ? e : 0
    return coords.toWorld(f.x, f.y, elev)
  }

  const rigs = createCameraRigs({
    camera, dem, coords, routeLookup, flybyLookup, domElement: core.renderer.domElement,
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

  Object.assign(hooks, {
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
      gps?.update(timeS, camera)
      core.updateAmbient(dt)
      waypoints.update(camera)
      rigs.update(dt, alongM)

      core.render()

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
  })

  for (const d of [
    routeLine.geometry, routeLine.material,
    ...marker.geometries, ...marker.materials,
    ...highlight.geometries, ...highlight.materials,
    waypoints,
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
    setContoursVisible: (v) => core.setContoursVisible(v),
    get contoursVisible() { return core.contoursVisible },
    setPinsVisible(v) { waypoints.setPinsVisible(v) },
    setUserPosition(pos) {
      if (pos && !gps) {
        gps = buildGpsMarker(dem, coords)
        scene.add(gps.group)
        loop.track(gps)
      }
      gps?.setPosition(pos)
    },
    // Sol/måne håndteres av kjernen; kurve-tvang i nattmodus av UI-laget.
    setNightMode: (on, opts) => core.setNightMode(on, opts),
    setFeatures: (features) => {
      director.setEvents(buildFeatureTimeline(features, route.coordinates), playback.alongM)
    },
    on: (event, cb) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(cb)
    },
    off: (event, cb) => listeners.get(event)?.delete(cb),
    resize: () => core.resize(),
    get state() {
      return { ...playback.stats(), cameraMode: rigs.mode, activeFeature: director.active }
    },
    get totalM() { return routePath.totalM },
    dispose() {
      if (disposedFlag) return
      disposedFlag = true
      rigs.dispose()
      listeners.clear()
      core.dispose()
    },
  }
}

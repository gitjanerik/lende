// Orkestratoren for 3D-UTFORSKEREN: hele kartet i 3D, uten noen rute.
//
// Tre ting skiller den fra turvisningen:
//   1. Kameraet er fritt og starter i fugleperspektiv mot nord (exploreRig).
//   2. Stinettet tegnes som eget lag og er klikkbart (pathNetwork + pathWalk).
//   3. POI-er står som knappenåler med autofiltrering (pinField + declutter).
//
// Alt annet — terreng, karttekstur med aktivt tema, himmel, natt, kurver,
// render-loop — kommer fra den delte kjernen (sceneCore), samme som
// turvisningen bruker. Trykker brukeren på en sti, bygges en tur av
// stinettet og MATES INN I DET EKSISTERENDE turmaskineriet (routePath,
// playback, follow-riggen), slik at fart, framdrift og kamerafølelse er
// nøyaktig den samme som i stifinner-turene.

import { Raycaster, Vector2, Group } from 'three'
import { buildRoutingGraph } from '../routing.js'
import { declutter } from '../labelDeclutter.js'
import { poiColor } from '../poiColors.js'
import { createSceneCore, TourSceneError } from './sceneCore.js'
import { createExploreRig } from './exploreRig.js'
import { buildPathNetwork } from './pathNetwork.js'
import { buildPinField } from './pinField.js'
import { walkFromNode, walkStartAt, rerouteAtJunction } from './pathWalk.js'
import { buildRoutePath, makePositionLookup } from './routePath.js'
import { buildRouteLine, buildRouteMarker } from './routeLine.js'
import { createPlayback } from './playback.js'
import { createCameraRigs } from './cameraRigs.js'
import { buildHighlightMarker } from './highlightMarkers.js'
import { buildGpsMarker } from './gpsMarker.js'
import { createGpsMovement } from './gpsMovement.js'
import { kindMeta } from './featureTimeline.js'
import { groupOfKind } from './exploreData.js'

export { TourSceneError }

const PROGRESS_EMIT_MS = 250
// Nålene filtreres i skjermrom på egen kadens. Hver frame ville vært bortkastet
// (og ustabilt); et kvart sekund er raskt nok til at det leses som direkte.
const DECLUTTER_MS = 220
const MAX_VISIBLE_PINS = 120
// Trykk regnes som klikk, ikke drag, når fingeren har flyttet seg mindre enn
// dette. Terskelen må tåle at en finger aldri står helt stille.
const TAP_SLOP_PX = 12
const TAP_MAX_MS = 600
// Hvor langt fra en sti et trykk kan lande og fortsatt starte en tur.
const PATH_HIT_TOL_M = 90
// Med krysspause på stopper turen så mange meter FØR krysset — nær nok til å
// se grenene, langt nok unna til at valget skjer før man er forbi.
const JUNCTION_PAUSE_M = 25

export async function createExploreScene(container, {
  dem, meta, svgText, getSvgText = null, onProgress = null,
  pathFeatures = [], features = [],
  options = {},
}) {
  if (!dem) throw new TourSceneError('no-dem', 'Kartet mangler høydedata')

  const {
    exaggeration = 1.15,
    speedKmh = 4.5,
    timeScale = 128,
  } = options

  const hooks = {}
  const core = await createSceneCore(
    container,
    { dem, meta, svgText, getSvgText, onProgress, options: { exaggeration } },
    hooks,
  )
  const { scene, camera, coords, terrain, loop } = core

  const listeners = new Map()
  const emit = (event, payload) => {
    for (const cb of listeners.get(event) ?? []) {
      try { cb(payload) } catch { /* lytterfeil skal ikke stoppe loopen */ }
    }
  }

  // ---- Stinettet -----------------------------------------------------------

  const paths = buildPathNetwork(pathFeatures, dem, coords)
  scene.add(paths.group)
  loop.track(paths)
  paths.setResolution(container.clientWidth, container.clientHeight)

  // Grafen bygges med samme parametre som Stifinneren: kryss blir eksplisitte
  // noder, og løse fragmenter kobles til hovednettet så et trykk på en
  // adkomststump ikke ender i en isolert stubb.
  let graph = null
  const ensureGraph = () => {
    if (graph === null) {
      graph = pathFeatures?.length
        ? buildRoutingGraph(pathFeatures, { snapM: 6, componentBridgeM: 80 })
        : false
    }
    return graph || null
  }

  // ---- Knappenåler ---------------------------------------------------------

  let pinItems = []
  let pins = null
  const pinGroup = new Group()
  scene.add(pinGroup)
  let enabledGroups = null    // null = alle
  let pinsVisible = true

  const rebuildPins = (list) => {
    if (pins) {
      pinGroup.remove(pins.stems)
      pinGroup.remove(pins.heads)
      pins.dispose()
      pins = null
    }
    pinItems = list
    if (!list.length) return
    pins = buildPinField(
      list.map(f => ({ x: f.x, y: f.y, color: poiColor(f) })),
      dem, coords,
    )
    pinGroup.add(pins.stems)
    pinGroup.add(pins.heads)
  }

  const activePins = () => pinItems
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !enabledGroups || enabledGroups.has(groupOfKind(f.kind)))

  // Skjermrom-filtrering: samme declutter som 2D-kartets navnebudsjett bruker.
  // Den er hysterese-stabil, så nåler slutter å blinke når kameraet beveger seg.
  let prevShown = new Set()
  let lastDeclutter = 0
  const runDeclutter = () => {
    if (!pins) return
    const cands = []
    for (const { f, i } of activePins()) {
      const [wx, wy, wz] = pins.basePosition(i)
      const p = core.project(wx, wy + 60, wz)
      if (p.behind) continue
      const meta2 = kindMeta(f.kind, f.categories)
      cands.push({
        id: String(i),
        score: (meta2?.priority ?? 3) * 10,
        sx: p.x,
        sy: p.y,
        halfW: 16,
        halfH: 26,
        group: (meta2?.priority ?? 0) >= 5 ? 'priority' : 'quota',
      })
    }
    const shown = declutter(cands, {
      cellPx: 150, K: 3, pad: 3, prevShown, maxVisible: MAX_VISIBLE_PINS,
    })
    prevShown = shown
    pins.setVisibleSet(new Set([...shown].map(Number)))
  }

  // ---- Sti-følging ---------------------------------------------------------

  const highlight = buildHighlightMarker()
  scene.add(highlight.group)
  loop.track({ dispose: () => { for (const g of highlight.geometries) g.dispose(); for (const m of highlight.materials) m.dispose() } })

  let walk = null          // { coordinates, nodeIds, lengthM, junctions }
  let walkLine = null
  let walkMarker = null
  let walkLookup = null
  let playback = null
  let followRigs = null
  let junctionIdx = 0
  let activeJunction = null
  // Tempoet overlever reroute (playback bygges på nytt per gren-valg) og
  // gjelder også neste tur man starter i samme økt.
  let currentTimeScale = timeScale
  // Krysspause: brukerens valg om å stoppe i hvert stikryss. pausedJunction
  // hindrer at samme kryss pauser igjen når brukeren trykker play for å
  // fortsette rett fram.
  let autoPauseJunctions = false
  let pausedJunction = null

  const teardownWalk = () => {
    if (walkLine) { scene.remove(walkLine.mesh); walkLine.geometry.dispose(); walkLine.material.dispose(); walkLine = null }
    if (walkMarker) {
      scene.remove(walkMarker.sphere)
      scene.remove(walkMarker.ring)
      for (const g of walkMarker.geometries) g.dispose()
      for (const m of walkMarker.materials) m.dispose()
      walkMarker = null
    }
    followRigs?.dispose()
    followRigs = null
    playback = null
    walkLookup = null
    walk = null
    activeJunction = null
    pausedJunction = null
    junctionIdx = 0
  }

  async function buildWalkScene(nextWalk, { alongM = 0, autoplay = true } = {}) {
    if (walkLine) { scene.remove(walkLine.mesh); walkLine.geometry.dispose(); walkLine.material.dispose() }
    if (walkMarker) {
      scene.remove(walkMarker.sphere); scene.remove(walkMarker.ring)
      for (const g of walkMarker.geometries) g.dispose()
      for (const m of walkMarker.materials) m.dispose()
    }
    walk = nextWalk
    const rp = buildRoutePath(nextWalk.coordinates, dem, coords)
    walkLookup = makePositionLookup(rp)
    walkLine = buildRouteLine(rp)
    scene.add(walkLine.mesh)
    walkMarker = buildRouteMarker()
    scene.add(walkMarker.sphere)
    scene.add(walkMarker.ring)

    playback = createPlayback({ totalM: rp.totalM, speedKmh, timeScale: currentTimeScale })
    if (alongM > 0) playback.seek(Math.min(alongM, rp.totalM))

    if (!followRigs) {
      followRigs = createCameraRigs({
        camera, dem, coords,
        routeLookup: walkLookup,
        flybyLookup: walkLookup,
        domElement: core.renderer.domElement,
      })
      await followRigs.setMode('follow', playback.alongM)
    } else {
      // Riggen leser posisjoner gjennom lookup-objektet; bytt det ut i stedet
      // for å bygge riggen på nytt, ellers nullstilles brukerens blikkvinkel
      // hver gang de velger en annen gren i et kryss.
      followRigs.setRouteLookup(walkLookup)
    }

    junctionIdx = 0
    activeJunction = null
    pausedJunction = null
    while (junctionIdx < walk.junctions.length && walk.junctions[junctionIdx].alongM <= playback.alongM) junctionIdx++
    if (autoplay) playback.play()
  }

  async function startWalkAt(svgX, svgY) {
    const rg = ensureGraph()
    if (!rg) return false
    const camXY = rig.cameraSvgXY()
    const start = walkStartAt(rg, [svgX, svgY], camXY, { tolM: PATH_HIT_TOL_M })
    if (!start) return false
    const w = walkFromNode(rg, start.nodeId, { headingXY: start.headingXY })
    if (w.coordinates.length < 2) return false
    rig.controls.enabled = false
    // Ingen autostart: kameraet glir inn i følge-posen ved stistart, og
    // avspillingen venter på play — brukeren skal rekke å orientere seg.
    // Gren-valg i kryss (chooseBranch) fortsetter derimot av seg selv;
    // der HAR brukeren nettopp sagt «gå denne veien».
    await buildWalkScene(w, { autoplay: false })
    emit('walk-start', { lengthM: w.lengthM, junctions: w.junctions.length })
    return true
  }

  function endWalk() {
    if (!walk) return
    const p = walkLookup?.at(playback?.alongM ?? 0)
    teardownWalk()
    rig.controls.enabled = true
    if (p) rig.controls.target.set(p[0], p[1], p[2])
    rig.controls.update()
    emit('walk-end', {})
  }

  // ---- Live GPS-posisjon -----------------------------------------------------

  // Bygges lazily ved første posisjon — de fleste øktene har ikke GPS på.
  // Bevegelses-sporet mater «fly til meg»: har man forflyttet seg nylig,
  // legges kameraet bak posisjonen så blikket peker videre framover.
  let gps = null
  const movement = createGpsMovement()
  const setUserPosition = (pos) => {
    if (pos && !gps) {
      gps = buildGpsMarker(dem, coords)
      scene.add(gps.group)
      loop.track(gps)
    }
    gps?.setPosition(pos)
    if (pos) movement.push(pos.x, pos.y, Date.now())
    else movement.reset()
  }

  // ---- Kamera --------------------------------------------------------------

  const rig = await createExploreRig({ camera, dem, coords, domElement: core.renderer.domElement })

  if (features?.length) rebuildPins(features)

  // ---- Trykk-håndtering ----------------------------------------------------

  const raycaster = new Raycaster()
  const ndc = new Vector2()
  let downAt = null

  const domListeners = []
  const onDom = (event, fn, opts) => {
    core.renderer.domElement.addEventListener(event, fn, opts)
    domListeners.push([event, fn, opts])
  }

  onDom('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
  })

  onDom('pointerup', (e) => {
    const d = downAt
    downAt = null
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) return
    if (performance.now() - d.t > TAP_MAX_MS) return
    handleTap(e)
  })

  async function handleTap(e) {
    const rect = core.renderer.domElement.getBoundingClientRect()
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)

    // GPS-nåla først — «fly til meg». Med fersk forflytning (siste 5 min)
    // vinkles kameraet slik at man ser videre i sannsynlig bevegelsesretning.
    if (!walk && gps?.visible) {
      const hit = raycaster.intersectObjects(gps.hitMeshes, false)[0]
      if (hit) {
        const p = gps.position
        highlight.hide()
        rig.flyTo(p.x, p.y, p.z, { radius: 90, headingXY: movement.heading(Date.now()) })
        emit('fly-to-gps', {})
        return
      }
    }

    // Nåler — de stikker opp av terrenget og er det mest presise målet.
    if (pins && pinsVisible) {
      const idx = pins.raycast(raycaster)
      if (idx != null && pinItems[idx]) {
        const f = pinItems[idx]
        const [wx, wy, wz] = pins.basePosition(idx)
        highlight.showAt(wx, wy, wz)
        rig.flyTo(wx, wy, wz, {
          radius: f.areaM2 ? Math.sqrt(f.areaM2 / Math.PI) : 60,
        })
        emit('feature', { feature: f })
        return
      }
    }

    // Ellers: traff vi terrenget, ser vi etter en sti der.
    const hit = raycaster.intersectObject(terrain.mesh, false)[0]
    if (!hit) return
    const { x, y } = coords.toSvg(hit.point.x, hit.point.z)
    if (walk) return                       // pågående tur: la kontrollene styre
    const started = await startWalkAt(x, y)
    if (!started) emit('no-path', { x, y })
  }

  // ---- Loop ----------------------------------------------------------------

  let lastProgressEmit = 0
  let disposedFlag = false

  Object.assign(hooks, {
    onResize(w, h) {
      paths.setResolution(w, h)
    },
    onFrame(dt, timeS) {
      if (walk && playback) {
        playback.tick(dt)
        const alongM = playback.alongM
        const p = walkLookup.at(alongM)
        walkMarker.setPosition(p[0], p[1], p[2])
        walkMarker.pulse(timeS)
        walkLine.setProgress(alongM)
        followRigs.update(dt, alongM)

        // Meld fra om krysset i god tid før man er der, så brukeren rekker å
        // velge. Gjør de ingenting, går turen rett fram som planlagt.
        const nextJ = walk.junctions[junctionIdx]
        if (nextJ && alongM >= nextJ.alongM - 120 && activeJunction !== nextJ) {
          activeJunction = nextJ
          emit('junction', { junction: nextJ })
        }
        // Krysspause: stopp like før krysset så valget kan tas i ro. Gjelder
        // hvert kryss én gang — play etterpå betyr «fortsett rett fram».
        if (autoPauseJunctions && activeJunction && pausedJunction !== activeJunction
            && playback.playing && alongM >= activeJunction.alongM - JUNCTION_PAUSE_M) {
          pausedJunction = activeJunction
          playback.pause()
          emit('junction-pause', { junction: activeJunction })
        }
        if (nextJ && alongM > nextJ.alongM + 30) {
          junctionIdx++
          if (pausedJunction === nextJ) pausedJunction = null
          if (activeJunction === nextJ) {
            activeJunction = null
            emit('junction', { junction: null })
          }
        }
      } else {
        rig.update(dt)
      }

      highlight.update(timeS, camera)
      gps?.update(timeS, camera)
      core.updateAmbient(dt)
      if (pins && pinsVisible) pins.update(camera)

      core.render()

      const nowMs = timeS * 1000
      if (pins && pinsVisible && nowMs - lastDeclutter > DECLUTTER_MS) {
        lastDeclutter = nowMs
        runDeclutter()
      }
      if (nowMs - lastProgressEmit > PROGRESS_EMIT_MS) {
        lastProgressEmit = nowMs
        if (walk && playback) {
          const stats = playback.stats()
          const p = walkLookup.at(playback.alongM)
          emit('progress', {
            ...stats,
            walking: true,
            elevM: coords.worldYToElev(p[1]) - 3,
          })
          if (stats.finished) emit('finished', stats)
        } else {
          emit('progress', {
            walking: false,
            autoRotating: rig.autoRotating,
            elevM: coords.worldYToElev(camera.position.y),
          })
        }
      }
    },
    onContextLost: () => emit('context-lost', {}),
  })

  loop.start()
  emit('ready', { pathCount: pathFeatures?.length ?? 0 })

  return {
    // --- nåler ---
    setFeatures(list) {
      rebuildPins(list ?? [])
      prevShown = new Set()
      pinGroup.visible = pinsVisible
      runDeclutter()
    },
    setPinsVisible(v) {
      pinsVisible = !!v
      pinGroup.visible = pinsVisible
      if (!pinsVisible) highlight.hide()
    },
    /** @param {Set<string>|null} groups null = alle grupper */
    setPinGroups(groups) {
      enabledGroups = groups
      prevShown = new Set()
      runDeclutter()
    },

    // --- stinett ---
    setPathsVisible(v) { paths.setVisible(v) },
    get hasPaths() { return !paths.isEmpty },

    // --- live GPS-posisjon ---
    setUserPosition,

    // --- kamera ---
    resetView() {
      endWalk()
      highlight.hide()
      rig.resetToOverview()
    },
    get autoRotating() { return rig.autoRotating },

    // --- tur langs sti ---
    get walking() { return !!walk },
    get walkLengthM() { return walk?.lengthM ?? 0 },
    play() { playback?.play() },
    pause() { playback?.pause() },
    stopWalk() { endWalk() },
    get totalM() { return walkLookup?.totalM ?? 0 },

    // Tidsakse-scrubbing: brukeren drar seg fram og tilbake langs sti-turen.
    // Kameraet følger av seg selv (follow-riggen leser alongM hver frame), og
    // avspillingen forblir pauset når man slipper — som i turvisningen.
    scrubStart() { playback?.pause() },
    scrub(alongM) {
      if (!playback || !walk) return
      playback.seek(alongM)
      // Kryss-pekeren må flyttes med, ellers ville turen meldt kryss man alt
      // har dratt forbi — eller hoppet over dem man dro tilbake til.
      junctionIdx = 0
      while (junctionIdx < walk.junctions.length
        && walk.junctions[junctionIdx].alongM <= playback.alongM) junctionIdx++
      if (activeJunction) {
        activeJunction = null
        pausedJunction = null
        emit('junction', { junction: null })
      }
    },
    scrubEnd() {},
    setTimeScale(x) {
      currentTimeScale = x
      playback?.setTimeScale(x)
    },
    setAutoPauseJunctions(v) { autoPauseJunctions = !!v },
    /** Velg en annen gren i krysset som er meldt aktivt. */
    async chooseBranch(nodeId) {
      const rg = ensureGraph()
      if (!rg || !walk || !activeJunction) return
      const next = rerouteAtJunction(rg, walk, activeJunction, nodeId)
      if (next === walk) return
      const alongM = playback.alongM
      activeJunction = null
      emit('junction', { junction: null })
      await buildWalkScene(next, { alongM })
    },

    // --- delt med turvisningen ---
    setContoursVisible: (v) => core.setContoursVisible(v),
    get contoursVisible() { return core.contoursVisible },
    setNightMode: (on, opts) => core.setNightMode(on, opts),

    on: (event, cb) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(cb)
    },
    off: (event, cb) => listeners.get(event)?.delete(cb),
    resize: () => core.resize(),
    dispose() {
      if (disposedFlag) return
      disposedFlag = true
      for (const [event, fn, opts] of domListeners) {
        core.renderer.domElement.removeEventListener(event, fn, opts)
      }
      domListeners.length = 0
      teardownWalk()
      rig.dispose()
      if (pins) pins.dispose()
      listeners.clear()
      core.dispose()
    },
  }
}

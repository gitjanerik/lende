// Orkestratoren for HELE 3D-visningen — én scene, tre innganger.
//
// Fram til v5.7.0 fantes to nesten like scener: `tourScene` (planlagt rute fra
// Stifinneren, kamera låst til ruta, POI som en tidslinje) og `exploreScene`
// (hele kartet, fri kamera, klikkbare nåler og stinett). Splitten var historisk,
// ikke teknisk — og den kostet: turvisningen hadde ingen trefftesting i det hele
// tatt, så POI-klikk var umulig der, og utforskerens POI-klikk under en sti-tur
// var en stille no-op fordi følge-riggen skrev kameraet på nytt hver frame.
//
// Nå er det ÉN scene:
//   • uten tur    → fri utforsking av kartet (fugleperspektiv, stinett, nåler)
//   • med tur     → turen står klar i følge-kameraet; `tour.fixed` skiller den
//                   PLANLAGTE ruta (som kryssvalg ikke får skrive om) fra en
//                   generert sti-tur brukeren startet med et trykk i stinettet
//
// Kameraet har to tilstander, uten modusknapper:
//   FESTET  — følge-riggen (cameraRigs) ruller langs turen. Drag orbiterer.
//   LØSNET  — den frie riggen (freeRig) eier kameraet: panorér, zoom, fly til
//             en nål. Skjer når turen står stille og brukeren tar kameraet,
//             eller når man trykker på en nål (som også pauser).
// Play (og scrubbing) fester kameraet igjen, og ARVER perspektivet man sto i —
// se deriveFollowView i cameraRigs.js.
//
// Verden selv (terreng, karttekstur, himmel, natt, kurver, render-loop) eies av
// den delte kjernen, sceneCore.

import { Raycaster, Vector2 } from 'three'
import { buildRoutingGraph, RUTE_GRAF_OPTS } from '../routing.js'
import { realElevationAt, sampleElevation } from '../demSampling.js'
import { createSceneCore, TourSceneError } from './sceneCore.js'
import { createFreeRig } from './freeRig.js'
import { createFollowRig } from './cameraRigs.js'
import { buildPathNetwork } from './pathNetwork.js'
import { createPinLayer } from './pinLayer.js'
import { attachTapDispatcher } from './tapDispatcher.js'
import { walkFromNode, walkStartAt, rerouteAtJunction } from './pathWalk.js'
import { buildRoutePath, makePositionLookup, elevationSamples } from './routePath.js'
import { buildRouteLine, buildRouteMarker } from './routeLine.js'
import { createPlayback, buildCumulativeAscent, defaultTimeScale } from './playback.js'
import { buildFeatureTimeline } from './featureTimeline.js'
import { createFeatureDirector } from './featureDirector.js'
import { buildWaypointMarkers } from './waypointMarkers.js'
import { buildHighlightMarker } from './highlightMarkers.js'
import { buildGpsMarker } from './gpsMarker.js'
import { createGpsMovement } from './gpsMovement.js'
import { featureType } from './exploreData.js'

export { TourSceneError }

const PROGRESS_EMIT_MS = 250
// Hvor langt fra en sti et trykk kan lande og fortsatt starte en tur.
const PATH_HIT_TOL_M = 90
// Med krysspause på stopper turen så mange meter FØR krysset — nær nok til å
// se grenene, langt nok unna til at valget skjer før man er forbi.
const JUNCTION_PAUSE_M = 25
// Kryss meldes i god tid før man er der, og pekeren flyttes forbi litt etter.
const JUNCTION_LEAD_M = 120
const JUNCTION_PAST_M = 30

export async function create3dScene(container, {
  dem, meta, svgText, getSvgText = null, onProgress = null,
  pathFeatures = [], barrierFeatures = [], features = [],
  tour = null,
  options = {},
}) {
  if (!dem) throw new TourSceneError('no-dem', 'Kartet mangler høydedata')
  if (tour && (!tour.route?.coordinates || tour.route.coordinates.length < 2)) {
    throw new TourSceneError('no-route', 'Ingen rute å vise')
  }

  const {
    exaggeration = 1.15,
    speedKmh = 4.5,
    timeScale = null,
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

  const estWalkMinutes = tour?.estWalkMinutes ?? options.estWalkMinutes ?? null
  let currentTimeScale = timeScale ?? (tour ? defaultTimeScale(tour.route.lengthM) : 128)

  // ---- Stinettet -----------------------------------------------------------

  const paths = buildPathNetwork(pathFeatures, dem, coords)
  let pathsVisible = true
  scene.add(paths.group)
  loop.track(paths)
  paths.setResolution(container.clientWidth, container.clientHeight)

  // Grafen bygges med samme parametre som Stifinneren: kryss blir eksplisitte
  // noder, og løse fragmenter kobles til hovednettet så et trykk på en
  // adkomststump ikke ender i en isolert stubb. Terreng + barrierer sendes med
  // fordi hull-broingen — og sti-vandringens hull-hopp — skal nekte å krysse
  // vann, hovedvei, jernbane, bygning og stup.
  let graph = null
  const ensureGraph = () => {
    if (graph === null) {
      graph = pathFeatures?.length
        ? buildRoutingGraph(pathFeatures, {
          ...RUTE_GRAF_OPTS,
          elevationAt: realElevationAt(dem),
          barriers: barrierFeatures,
        })
        : false
    }
    return graph || null
  }

  // ---- Nåler, markører, GPS ------------------------------------------------

  const pins = createPinLayer({ scene, dem, coords, project: core.project })
  if (features?.length) pins.setFeatures(features)

  const highlight = buildHighlightMarker()
  scene.add(highlight.group)
  loop.track({
    dispose: () => {
      for (const g of highlight.geometries) g.dispose()
      for (const m of highlight.materials) m.dispose()
    },
  })

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

  // Start-/mål-/via-nåler + P-skilt og hjem-skilt hører til en PLANLAGT tur.
  // En generert sti-tur har ingen avtalte punkter — der er markøren nok.
  let waypoints = null
  if (tour) {
    waypoints = buildWaypointMarkers({
      route: tour.route,
      via: tour.via ?? [],
      isLoop: !!tour.isLoop,
      parkingSpots: tour.parkingSpots ?? [],
      pauseSpots: tour.pauseSpots ?? [],
    }, dem, coords)
    scene.add(waypoints.group)
    loop.track(waypoints)
  }

  // ---- Turen ---------------------------------------------------------------

  // `fixed` = planlagt rute som kom inn med visningen. Kryssvalg, krysspause og
  // «Avslutt turen» gjelder bare genererte turer — en planlagt tur skal ikke
  // kunne bli en annen tur enn den brukeren la.
  let trip = null
  let tripLookup = null
  let tripLine = null
  let tripMarker = null
  let playback = null
  let followRig = null
  let junctionIdx = 0
  let activeJunction = null
  let autoPauseJunctions = false
  let pausedJunction = null

  // Kameraets tilstand: 'follow' = festet til turen, 'free' = løsnet.
  let camMode = 'free'
  let reattachPending = false

  const featureWorldPos = (f) => {
    const e = sampleElevation(dem, f.x, f.y)
    return coords.toWorld(f.x, f.y, Number.isFinite(e) ? e : 0)
  }

  // POI-koreografien: turen bremser og stopper ved severdigheter, kameraet
  // rammer dem inn. Direktøren finnes alltid, men er tom (og dermed inert) for
  // turer uten tidslinje — og den rører aldri et løsnet kamera.
  const director = createFeatureDirector([], {
    onEnter: (ev) => {
      const [fx, fy, fz] = featureWorldPos(ev)
      highlight.showAt(fx, fy, fz)
      if (camMode === 'follow') {
        followRig?.setFrameTarget({
          x: fx, y: fy, z: fz,
          radius: ev.areaM2 ? Math.sqrt(ev.areaM2 / Math.PI) : 60,
        })
      }
      emit('feature-enter', { feature: ev })
    },
    onExit: (ev) => {
      highlight.hide()
      followRig?.clearFrameTarget()
      emit('feature-exit', { feature: ev })
    },
  })
  let poiStopsEnabled = false
  director.setEnabled(false)

  const dropTripMeshes = () => {
    if (tripLine) {
      scene.remove(tripLine.mesh)
      tripLine.geometry.dispose()
      tripLine.material.dispose()
      tripLine = null
    }
    if (tripMarker) {
      scene.remove(tripMarker.sphere)
      scene.remove(tripMarker.ring)
      for (const g of tripMarker.geometries) g.dispose()
      for (const m of tripMarker.materials) m.dispose()
      tripMarker = null
    }
  }

  const teardownTrip = () => {
    dropTripMeshes()
    followRig?.dispose()
    followRig = null
    playback = null
    tripLookup = null
    trip = null
    activeJunction = null
    pausedJunction = null
    junctionIdx = 0
    director.setEvents([], 0)
  }

  /**
   * Bygg (eller bygg om) scenen rundt en tur.
   * @param {{fixed:boolean, coordinates:Array, lengthM:number, nodeIds?:Array,
   *          junctions?:Array, hops?:Array}} next
   */
  function buildTripScene(next, { alongM = 0, autoplay = false, animateCamera = true } = {}) {
    dropTripMeshes()
    trip = next
    const rp = buildRoutePath(next.coordinates, dem, coords)
    tripLookup = makePositionLookup(rp)
    tripLine = buildRouteLine(rp)
    scene.add(tripLine.mesh)
    tripMarker = buildRouteMarker()
    scene.add(tripMarker.sphere)
    scene.add(tripMarker.ring)

    // Stigning og ETA: den planlagte turen bruker 2D-sidens egen høydeprofil
    // (samme tall som ruteinfoen viste), en generert sti-tur måler terrenget
    // langs kurven vi nettopp bygde.
    const samples = next.fixed && tour?.profileSamples?.length
      ? tour.profileSamples
      : elevationSamples(rp, coords)
    playback = createPlayback({
      totalM: rp.totalM,
      estWalkMinutes,
      cumAscent: buildCumulativeAscent(samples),
      speedKmh,
      timeScale: currentTimeScale,
    })
    if (alongM > 0) playback.seek(Math.min(alongM, rp.totalM))

    if (!followRig) {
      followRig = createFollowRig({
        camera, dem, coords,
        routeLookup: tripLookup,
        domElement: core.renderer.domElement,
      })
    } else {
      // Riggen leser posisjoner gjennom lookup-objektet; bytt det ut i stedet
      // for å bygge riggen på nytt, ellers nullstilles brukerens blikkvinkel
      // hver gang de velger en annen gren i et kryss.
      followRig.setRouteLookup(tripLookup)
    }

    // POI-tidslinjen bygges av severdighetene langs NETTOPP denne kurven.
    director.setEvents(
      tour?.routeFeatures?.length ? buildFeatureTimeline(tour.routeFeatures, next.coordinates) : [],
      playback.alongM,
    )
    director.setEnabled(poiStopsEnabled)

    junctionIdx = 0
    activeJunction = null
    pausedJunction = null
    while (junctionIdx < (trip.junctions?.length ?? 0)
      && trip.junctions[junctionIdx].alongM <= playback.alongM) junctionIdx++

    attachCamera({ inherit: false, animate: animateCamera })
    if (autoplay) playback.play()
    else armFreeRigIfIdle()
  }

  // ---- Kamera: festet ↔ løsnet --------------------------------------------

  function attachCamera({ inherit = true, animate = true } = {}) {
    if (!trip || !followRig) return
    camMode = 'follow'
    reattachPending = false
    // Ringen rundt det man fløy bort for å se på hører til avstikkeren, ikke
    // til turen — den skal ikke stå og lyse midt i bildet når turen ruller.
    // (POI-stopp langs turen setter den på nytt selv, gjennom direktøren.)
    highlight.hide()
    freeRig.setEnabled(false)
    followRig.enter(playback.alongM, { inherit, animate })
    followRig.setInputEnabled(playback.playing)
    emit('camera', { detached: false })
  }

  function detachCamera() {
    if (!trip) return
    if (camMode === 'free') return
    camMode = 'free'
    reattachPending = false
    followRig?.setInputEnabled(false)
    followRig?.clearFrameTarget()
    const p = tripLookup.at(playback.alongM)
    const distM = Math.hypot(
      camera.position.x - p[0], camera.position.y - p[1], camera.position.z - p[2],
    )
    freeRig.armFromCamera(distM)
    emit('camera', { detached: true })
  }

  // Står turen stille, skal fingeren kunne ta kameraet: den frie riggen skrus
  // på (uten å røre bildet — følge-riggen skriver fortsatt posen) og melder fra
  // når brukeren faktisk tar over. Spiller turen, er det vogn-draget som eier
  // fingeren i stedet.
  function armFreeRigIfIdle() {
    if (!trip || camMode !== 'follow') return
    const spiller = playback.playing
    freeRig.setEnabled(!spiller)
    followRig?.setInputEnabled(spiller)
  }

  const freeRig = await createFreeRig({
    camera, dem, coords,
    domElement: core.renderer.domElement,
    // Med en tur eier følge-riggen åpningsbildet; da skal ikke den frie riggen
    // sette fugleperspektivet først (et blaff av oversikt før turen).
    autoRotate: !tour,
    enabled: !tour,
  })
  freeRig.onTakeOver(() => {
    if (!trip || playback?.playing) return
    detachCamera()
  })
  freeRig.onTakeOverCancelled(() => {
    // Gesten var et rent trykk. Var det et trykk på en nål, sørger trykk-
    // håndteringen for å bli stående løsnet (den nuller flagget); ellers festes
    // kameraet tilbake på neste frame, uten å flytte bildet.
    if (trip && camMode === 'free') reattachPending = true
  })

  // ---- Turer fra stinettet -------------------------------------------------

  function startWalkAt(svgX, svgY) {
    const rg = ensureGraph()
    if (!rg) return false
    const camXY = freeRig.cameraSvgXY()
    const start = walkStartAt(rg, [svgX, svgY], camXY, { tolM: PATH_HIT_TOL_M })
    if (!start) return false
    const w = walkFromNode(rg, start.nodeId, { headingXY: start.headingXY })
    if (w.coordinates.length < 2) return false
    // Ingen autostart: kameraet glir inn i følge-posen ved stistart, og
    // avspillingen venter på play — brukeren skal rekke å orientere seg.
    // Gren-valg i kryss (chooseBranch) fortsetter derimot av seg selv;
    // der HAR brukeren nettopp sagt «gå denne veien».
    buildTripScene({ ...w, fixed: false }, { autoplay: false })
    emit('trip-start', { lengthM: w.lengthM, junctions: w.junctions.length, fixed: false })
    return true
  }

  function endTrip() {
    if (!trip || trip.fixed) return
    const p = tripLookup?.at(playback?.alongM ?? 0)
    const distM = p
      ? Math.hypot(camera.position.x - p[0], camera.position.y - p[1], camera.position.z - p[2])
      : 400
    teardownTrip()
    highlight.hide()
    camMode = 'free'
    freeRig.armFromCamera(distM)
    emit('trip-end', {})
  }

  // ---- Trykk ---------------------------------------------------------------

  const raycaster = new Raycaster()
  const ndc = new Vector2()

  // Se på noe: turen pauser (man skal ikke gå videre mens man studerer et
  // vann), kameraet løsner og flyr dit.
  function lookAt(world, { radiusM = 60, headingXY = null } = {}) {
    if (trip) {
      playback.pause()
      detachCamera()
      reattachPending = false
    }
    freeRig.flyTo(world[0], world[1], world[2], { radiusM, headingXY })
  }

  function handleTap(e) {
    const rect = core.renderer.domElement.getBoundingClientRect()
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)

    // GPS-nåla først — «fly til meg». Med fersk forflytning (siste 5 min)
    // vinkles kameraet slik at man ser videre i sannsynlig bevegelsesretning.
    if (gps?.visible && raycaster.intersectObjects(gps.hitMeshes, false)[0]) {
      const p = gps.position
      highlight.hide()
      lookAt([p.x, p.y, p.z], { radiusM: 90, headingXY: movement.heading(Date.now()) })
      emit('fly-to-gps', {})
      return
    }

    // Nåler — de stikker opp av terrenget og er det mest presise målet.
    const pin = pins.raycast(raycaster)
    if (pin) {
      highlight.showAt(...pin.world)
      lookAt(pin.world, { radiusM: pin.radiusM })
      emit('feature', { feature: { ...pin.feature, type: featureType(pin.feature) } })
      return
    }

    // Turens egne nåler: start, mål, vendepunkt, parkering, rasteplass.
    const wp = waypoints?.pick(raycaster)
    if (wp) {
      highlight.showAt(...wp.world)
      lookAt(wp.world, { radiusM: 70 })
      emit('feature', {
        feature: {
          name: wp.name,
          type: wp.kind === 'parkering' || wp.kind === 'rast' ? wp.kind : 'veipunkt',
          waypoint: wp.kind,
        },
      })
      return
    }

    // Ellers: traff vi terrenget, ser vi etter en sti der.
    const hit = raycaster.intersectObject(terrain.mesh, false)[0]
    if (!hit) return
    const { x, y } = coords.toSvg(hit.point.x, hit.point.z)

    // Traff trykket en sti? Grafen bygges bare når svaret betyr noe — den
    // koster, og under en pågående tur er dette bare en forklaring.
    const stiUnder = () => {
      const rg = ensureGraph()
      return !!rg && !!walkStartAt(rg, [x, y], freeRig.cameraSvgXY(), { tolM: PATH_HIT_TOL_M })
    }

    // Står en PLANLAGT tur i visningen, skal et trykk i stinettet ikke bytte
    // den ut med en annen tur — da mister brukeren ruta si uten å ha bedt om det.
    if (trip) {
      if (trip.fixed && pathsVisible && stiUnder()) emit('tour-locked', {})
      return
    }
    // Med stinettet skjult starter et trykk ingen tur: man skal ikke bli tatt
    // med langs en sti man ikke kan se.
    if (!pathsVisible) {
      if (stiUnder()) emit('paths-hidden', { x, y })
      return
    }
    if (!startWalkAt(x, y)) emit('no-path', { x, y })
  }

  const taps = attachTapDispatcher(core.renderer.domElement, handleTap)

  // ---- Loop ----------------------------------------------------------------

  let lastProgressEmit = 0
  let disposedFlag = false

  Object.assign(hooks, {
    onResize(w, h) {
      paths.setResolution(w, h)
    },
    onFrame(dt, timeS) {
      if (reattachPending) attachCamera({ inherit: true, animate: false })

      if (trip && playback) {
        const dtMs = dt * 1000
        const varFerdig = playback.finished
        playback.tick(dt)
        const alongM = playback.alongM
        // Tok turen slutt midt i et POI-stopp, må holdet avsluttes: direktøren
        // fryses under (kjører bare mens turen spiller), så kortet ville ellers
        // stått igjen på skjermen for alltid. seek() kaller onExit.
        if (!varFerdig && playback.finished) {
          director.seek(alongM)
          armFreeRigIfIdle()
        }
        // Direktøren kjører BARE mens turen spiller (v4.8.5). Står visningen
        // pauset eller ferdig, skal ingen severdighet utløses — kameraet ville
        // ellers pendlet mellom POI-innramming og posisjonen turen stoppet på.
        const dir = playback.playing
          ? director.tick(alongM, dtMs)
          : { speedFactor: 1, state: director.state, active: director.active }
        playback.setSpeedFactor(dir.speedFactor)

        const p = tripLookup.at(alongM)
        tripMarker.setPosition(p[0], p[1], p[2])
        tripMarker.pulse(timeS)
        tripLine.setProgress(alongM)
        if (camMode === 'follow') followRig.update(dt, alongM)
        else freeRig.update(dt)

        tickJunctions(alongM)
      } else {
        freeRig.update(dt)
      }

      highlight.update(timeS, camera)
      gps?.update(timeS, camera)
      waypoints?.update(camera)
      core.updateAmbient(dt)
      pins.update(camera)

      core.render()

      const nowMs = timeS * 1000
      pins.maybeDeclutter(nowMs)
      if (nowMs - lastProgressEmit > PROGRESS_EMIT_MS) {
        lastProgressEmit = nowMs
        if (trip && playback) {
          const stats = playback.stats()
          const p = tripLookup.at(playback.alongM)
          emit('progress', {
            ...stats,
            walking: true,
            fixed: !!trip.fixed,
            detached: camMode === 'free',
            elevM: coords.worldYToElev(p[1]) - 3,
          })
          if (stats.finished) emit('finished', stats)
        } else {
          emit('progress', {
            walking: false,
            autoRotating: freeRig.autoRotating,
            elevM: coords.worldYToElev(camera.position.y),
          })
        }
      }
    },
    onContextLost: () => emit('context-lost', {}),
  })

  // Kryss gjelder bare genererte turer — en planlagt rute har ingen valg å ta.
  function tickJunctions(alongM) {
    if (!trip.junctions?.length) return
    const nextJ = trip.junctions[junctionIdx]
    // Meld fra om krysset i god tid før man er der, så brukeren rekker å
    // velge. Gjør de ingenting, går turen rett fram som planlagt.
    if (nextJ && alongM >= nextJ.alongM - JUNCTION_LEAD_M && activeJunction !== nextJ) {
      activeJunction = nextJ
      emit('junction', { junction: nextJ })
    }
    // Krysspause: stopp like før krysset så valget kan tas i ro. Gjelder
    // hvert kryss én gang — play etterpå betyr «fortsett rett fram».
    if (autoPauseJunctions && activeJunction && pausedJunction !== activeJunction
        && playback.playing && alongM >= activeJunction.alongM - JUNCTION_PAUSE_M) {
      pausedJunction = activeJunction
      playback.pause()
      armFreeRigIfIdle()
      emit('junction-pause', { junction: activeJunction })
    }
    if (nextJ && alongM > nextJ.alongM + JUNCTION_PAST_M) {
      junctionIdx++
      if (pausedJunction === nextJ) pausedJunction = null
      if (activeJunction === nextJ) {
        activeJunction = null
        emit('junction', { junction: null })
      }
    }
  }

  // Åpningsbildet: en tur står klar i følge-kameraet ved startpunktet.
  if (tour) {
    buildTripScene(
      { ...tour.route, fixed: true },
      { autoplay: false, animateCamera: false },
    )
  }

  loop.start()
  emit('ready', { pathCount: pathFeatures?.length ?? 0, fixed: !!tour })

  return {
    // --- nåler ---
    setFeatures(list) { pins.setFeatures(list ?? []) },
    setPinsVisible(v) {
      pins.setVisible(v)
      waypoints?.setPinsVisible(v)
      if (!v) highlight.hide()
    },
    /** @param {Set<string>|null} groups null = alle grupper */
    setPinGroups(groups) { pins.setGroups(groups) },

    // --- stinett ---
    setPathsVisible(v) {
      pathsVisible = !!v
      paths.setVisible(pathsVisible)
    },
    get hasPaths() { return !paths.isEmpty },

    // --- live GPS-posisjon ---
    setUserPosition,

    // --- kamera ---
    /** Fugleperspektiv over hele kartet. En planlagt tur beholdes. */
    overview() {
      highlight.hide()
      if (trip) {
        playback.pause()
        detachCamera()
        reattachPending = false
      }
      freeRig.resetToOverview()
    },
    /** Fest kameraet til turen igjen, med perspektivet man står i. */
    followRoute() { attachCamera({ inherit: true }) },
    get detached() { return camMode === 'free' },
    get autoRotating() { return freeRig.autoRotating },

    // --- turen ---
    get walking() { return !!trip },
    get isFixedTour() { return !!trip?.fixed },
    get tripLengthM() { return trip?.lengthM ?? 0 },
    get totalM() { return tripLookup?.totalM ?? 0 },
    play() {
      if (!playback) return
      // Play er også veien tilbake til turen: er kameraet løsnet, festes det —
      // med perspektivet brukeren nettopp sto i.
      if (camMode === 'free') attachCamera({ inherit: true })
      playback.play()
      armFreeRigIfIdle()
    },
    pause() {
      playback?.pause()
      armFreeRigIfIdle()
    },
    restart() {
      if (!playback) return
      // Var kameraet løsnet, festes det tilbake; sto det alt i følge-riggen,
      // rører vi det ikke — den glir selv tilbake til start med posisjonen.
      if (camMode === 'free') attachCamera({ inherit: true })
      playback.restart()
      director.seek(0)
      armFreeRigIfIdle()
    },
    stopTrip() { endTrip() },

    // Tidsakse-scrubbing: brukeren drar seg fram og tilbake langs turen.
    // Kameraet festes igjen (man navigerer i turen, da skal man se den), og
    // avspillingen forblir pauset når man slipper — som før.
    // Å dra i tidsaksen er å navigere I turen — da skal man se den, så kameraet
    // festes tilbake (med perspektivet man sto i) og følger dragingen.
    scrubStart() {
      playback?.pause()
      if (camMode === 'free') attachCamera({ inherit: true })
      armFreeRigIfIdle()
    },
    scrub(alongM) {
      if (!playback || !trip) return
      playback.seek(alongM)
      director.seek(alongM)
      // Kryss-pekeren må flyttes med, ellers ville turen meldt kryss man alt
      // har dratt forbi — eller hoppet over dem man dro tilbake til.
      junctionIdx = 0
      while (junctionIdx < (trip.junctions?.length ?? 0)
        && trip.junctions[junctionIdx].alongM <= playback.alongM) junctionIdx++
      if (activeJunction) {
        activeJunction = null
        pausedJunction = null
        emit('junction', { junction: null })
      }
    },
    scrubEnd() { armFreeRigIfIdle() },
    setTimeScale(x) {
      currentTimeScale = x
      playback?.setTimeScale(x)
    },

    // --- kryss (genererte turer) ---
    setAutoPauseJunctions(v) { autoPauseJunctions = !!v },
    /** Velg en annen gren i krysset som er meldt aktivt. */
    chooseBranch(nodeId) {
      const rg = ensureGraph()
      if (!rg || !trip || trip.fixed || !activeJunction) return
      const next = rerouteAtJunction(rg, trip, activeJunction, nodeId)
      if (next === trip) return
      const alongM = playback.alongM
      activeJunction = null
      emit('junction', { junction: null })
      buildTripScene({ ...next, fixed: false }, { alongM, autoplay: true })
    },

    // --- severdigheter langs en planlagt tur ---
    setPoiStops(v) {
      poiStopsEnabled = !!v
      director.setEnabled(poiStopsEnabled)
      // Synk direktøren til der turen FAKTISK står (v4.8.5). Var POI-stopp av
      // under avspillingen, sto peker-indeksen urørt på 0 — slo man den så på
      // etter at turen var ferdig, spilte direktøren seg gjennom hele lista fra
      // starten mens posisjonen lå på mål.
      if (poiStopsEnabled && playback) director.seek(playback.alongM)
    },
    skipFeature() { director.skip() },

    // --- delt verden ---
    setContoursVisible: (v) => core.setContoursVisible(v),
    get contoursVisible() { return core.contoursVisible },
    setNightMode: (on, opts) => core.setNightMode(on, opts),

    on: (event, cb) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(cb)
    },
    off: (event, cb) => listeners.get(event)?.delete(cb),
    resize: () => core.resize(),
    get state() {
      return playback
        ? { ...playback.stats(), walking: true, fixed: !!trip?.fixed, detached: camMode === 'free' }
        : { walking: false }
    },
    dispose() {
      if (disposedFlag) return
      disposedFlag = true
      taps.dispose()
      teardownTrip()
      freeRig.dispose()
      pins.dispose()
      listeners.clear()
      core.dispose()
    },
  }
}

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
import { buildSkyDome, buildNedbor, buildLyn, buildNightSky, makeFog, FOG_COLOR, NIGHT_FOG_COLOR } from './skyDome.js'
import { buildPuffClouds } from './puffSkyer.js'
import { lagSkyskygge } from './skyskygge.js'
import { NEDBOR_TAK } from './vaerHimmel.js'
import { createEngineLoop } from './engineLoop.js'

export class TourSceneError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.code = code
  }
}

/**
 * @param {HTMLElement} container
 * @param {{dem: object, meta: object,
 *          getTextureSpec: (opts?: {dark?: boolean}) => object,
 *          onProgress?: (msg: string|null) => void,
 *          onTextureNote?: (msg: string|null) => void,
 *          options?: {exaggeration?: number}}} spec
 *   getTextureSpec gir arkets fliser (se mapTexture.prepareMapTextureSource).
 *   Den kalles på nytt hver gang teksturen må bygges om — når den skjerpes til
 *   full oppløsning, ved nattmodus, og når nettleseren har tømt kilde-lerretet.
 *   onTextureNote melder fra når kartbildet IKKE kom på terrenget, med tall nok
 *   til at det går an å feilsøke uten konsoll.
 * @param {{onFrame: (dt:number, timeS:number)=>void, onResize?: (w:number,h:number)=>void,
 *          onContextLost?: ()=>void}} hooks
 */
export async function createSceneCore(container, {
  dem, meta, getTextureSpec, onProgress = null, onTextureNote = null, options = {},
}, hooks = {}) {
  if (!dem) throw new TourSceneError('no-dem', 'Kartet mangler høydedata')

  const { exaggeration = 1.15 } = options
  const melding = (m) => { try { onProgress?.(m) } catch { /* UI-feil skal ikke stoppe bygging */ } }
  const teksturNotis = (m) => { try { onTextureNote?.(m) } catch { /* samme */ } }

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
  // rasterisere flisene på nytt (det er den dyre delen, ikke lerret-størrelsen).
  let daySource = null
  try {
    daySource = await prepareMapTextureSource(getTextureSpec(), { sizePx: fullPx })
    texture = rasterizeMapTexture(daySource, dem, { renderer, sizePx: texturePx })
    if (daySource.missing) {
      teksturNotis(`${daySource.missing} av ${daySource.tileCount} kartfliser kunne ikke tegnes på terrenget`)
    }
  } catch (err) {
    // Fallbacken er hillshade i ISOM-krem: terrengformene uten kartografi. Den
    // er brukbar, men den ser ut som et månelandskap, og uten en melding er det
    // umulig å vite at man ser en nødløsning. Tallene er med fordi de er det
    // som skiller «for stort ark» fra «ødelagt markup» neste gang.
    daySource?.dispose()
    daySource = null
    texture = buildFallbackTexture(dem)
    texturePx = fullPx   // ingen vits i å skjerpe en fallback
    console.warn('[3D] Kartbildet kunne ikke rasteriseres:', err)
    teksturNotis('Kartbildet kunne ikke tegnes på terrenget — viser terrengformene alene')
  }
  let nightTexture = null
  let nightOn = false
  let disposed = false

  melding('Bygger terrengmodellen …')
  const terrain = buildTerrainMesh(dem, coords, texture)
  scene.add(terrain.mesh)

  const sky = buildSkyDome()
  scene.add(sky.mesh)
  const clouds = buildPuffClouds({
    widthM: meta.widthM,
    heightM: meta.heightM,
    baseY: Math.max(1200, terrain.maxElev * exaggeration + 350),
  })
  scene.add(clouds.group)
  // Nedbør — skjult til setVaer sier noe annet. Punktbudsjettet avsettes én gang
  // her; setVaer flytter bare drawRange, så en værendring allokerer ingenting.
  const nedbor = buildNedbor({
    widthM: meta.widthM,
    heightM: meta.heightM,
    toppY: Math.max(2200, terrain.maxElev * exaggeration + 1400),
    maks: NEDBOR_TAK,
  })
  scene.add(nedbor.group)
  // Lyn-streken som vises i torden-blinket. Skjult til oppdaterTorden ber om den.
  const lyn = buildLyn({ toppY: Math.max(1800, terrain.maxElev * exaggeration + 900) })
  scene.add(lyn.group)
  // Skyskygger på terrenget. Analytisk (se skyskygge.js) fordi terrenget bruker
  // MeshBasicMaterial med bakt karttekstur — det finnes ingen lyssetting å
  // modulere. Sol-retningen tas FRA skyene, så skygge og skyggelegging aldri
  // kan komme i utakt.
  const skyskygge = lagSkyskygge()
  // Skygge-styrken slik været sier den skal være; nattmodus nuller den.
  let skyggeGrunn = 0.30
  skyskygge.uniforms.uSolRetning.value.copy(clouds.solRetning)
  skyskygge.festTil(terrain.material)

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
    const kilde = getTextureSpec?.({ dark: nightOn })
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

  // ── Værmodus ──────────────────────────────────────────────────────────────
  // Alt her er AV som standard: uten et værpreg skal 3D-visningen se nøyaktig ut
  // som før værmodus fantes. setVaer(null) er veien tilbake.
  let vaerVindX = 1
  let vaerVindZ = 0
  // Dis-avstandene slik de var uten vær. Tåke skalerer dem ned; setVaer(null)
  // setter dem tilbake til nøyaktig disse.
  const disNear = scene.fog.near
  const disFar = scene.fog.far
  let tordenPaa = false
  // Torden er et kort løft av dis- og bakgrunnsfargen — ingen geometri, ingen
  // lyskilde. Rate-begrenset og av ved prefers-reduced-motion: et lyn som
  // blinker uventa over et kart man leser er en tilgjengelighetssak, ikke en
  // effekt. Uten mediespørringen ville den blitt slått på for alle.
  const reduserBevegelse = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
  // Tettere lyn enn realismen tilsier: eieren ba om at Tor får vise vreden sin,
  // og et lyn hvert 17. sekund er en lang stund å vente på en effekt man leter
  // etter. Fortsatt langt nok mellom til at det ikke blir stroboskop.
  const TORDEN_MIN_S = 3
  const TORDEN_MAKS_S = 9
  const TORDEN_VARIGHET_S = 0.30
  let tilNesteLyn = TORDEN_MIN_S
  let lynIgjen = 0
  const grunnfarge = new Color(FOG_COLOR)
  const lynfarge = new Color('#e8f1ff')

  function oppdaterTorden(dt) {
    if (!tordenPaa || reduserBevegelse) return
    if (lynIgjen > 0) {
      lynIgjen -= dt
      if (lynIgjen <= 0) {
        scene.fog.color.copy(grunnfarge)
        scene.background.copy(grunnfarge)
        lyn.slukk()
      }
      return
    }
    tilNesteLyn -= dt
    if (tilNesteLyn > 0) return
    // Ingen Math.random-forbud her (det gjelder workflow-skript), men et
    // deterministisk intervall ville lest som en blinkende LED. Litt slark.
    tilNesteLyn = TORDEN_MIN_S + Math.random() * (TORDEN_MAKS_S - TORDEN_MIN_S)
    lynIgjen = TORDEN_VARIGHET_S
    scene.fog.color.copy(lynfarge)
    scene.background.copy(lynfarge)
    // Glimtet INNE i en sky først — det er den som bestemmer hvor lynet er.
    // Streken henges under nøyaktig samme sky: et glimt i én sky og en strek
    // under en annen leses som to ubeslektede effekter.
    const skyPos = clouds.glimt()
    lyn.blink(
      skyPos ? skyPos.x : (Math.random() - 0.5) * meta.widthM * 1.1,
      skyPos ? skyPos.z : (Math.random() - 0.5) * meta.heightM * 1.1,
      skyPos ? skyPos.y - 120 : undefined,
      Math.random() * Math.PI * 2,
    )
  }

  /** Slå torden av og sett fargene trygt tilbake — også midt i et lyn. */
  function stoppTorden() {
    tordenPaa = false
    lynIgjen = 0
    lyn.slukk()
    scene.fog.color.set(nightOn ? NIGHT_FOG_COLOR : FOG_COLOR)
    scene.background.set(nightOn ? NIGHT_FOG_COLOR : FOG_COLOR)
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
      const kilde = daySource
        ?? await prepareMapTextureSource(getTextureSpec({ dark: false }), { sizePx: fullPx })
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
    sky.geometry, sky.material, clouds, nedbor, lyn, nightSky,
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
    updateAmbient(dt) {
      // Kameraet må med: puff-skyene oversetter sol-retningen til view-space
      // hver frame. Uten den roterer lyset med kameraet, og skyene leses som
      // lykter framfor opplyste former.
      clouds.update(dt, camera)
      nedbor.update(dt, vaerVindX, vaerVindZ)
      // Skyggene følger skyene. Oppdateres etter clouds.update, så de aldri
      // ligger én frame bak det man ser i himmelen.
      skyskygge.oppdater(clouds.skyer, 900, clouds.solRetning)
      oppdaterTorden(dt)
    },

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

    // Sol/måne: bytt terrengtekstur til mørkt tema (flisene hentes lazily med
    // dark-flagget), nattehimmel, mørk dis og skyene av.
    async setNightMode(on) {
      nightOn = !!on
      if (nightOn && !nightTexture) {
        try {
          const spec = getTextureSpec({ dark: true })
          nightTexture = await buildMapTexture(spec, dem, { renderer, sizePx: fullPx, night: true })
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
      // Ingen sol om natta, altså ingen skyskygge. Uten dette lå skyggene igjen
      // på et mørkt terreng, der de leses som flekker i kartet.
      skyskygge.uniforms.uSkyggeStyrke.value = nightOn ? 0 : skyggeGrunn
      grunnfarge.set(nightOn ? NIGHT_FOG_COLOR : FOG_COLOR)
      lynIgjen = 0            // et pågående lyn skal ikke overleve modus-byttet
      scene.fog.color.copy(grunnfarge)
      scene.background.copy(grunnfarge)
    },
    /**
     * Legg et værpreg (lib/tour3d/vaerHimmel.js) på himmelen: skydekke, farge,
     * vinddrift, nedbør og torden. `null` setter alt tilbake til standard-
     * himmelen — værmodus av skal ikke etterlate spor.
     *
     * Skyene er skjult i nattmodus (setNightMode), og det er de fortsatt: et
     * værpreg endrer ikke HVEM som er synlig, bare hvordan de ser ut.
     */
    setVaer(preg) {
      clouds.setVaer(preg)
      // Sikt: tåke er redusert sikt, ikke flere skyer. Uten dette ser tåke ut
      // som overskyet, og det gjorde den fram til v5.22.1.
      const sikt = preg?.siktFaktor ?? 1
      scene.fog.near = disNear * sikt
      scene.fog.far = disFar * sikt
      // Skyskygger krever ÅPNINGER i skydekket. Ved fullt dekke er bakken jevnt
      // skyggelagt, og enkeltflekker ville lest som feil; i tåke finnes ingen
      // retningsbestemt sol i det hele tatt.
      const dekning = preg?.dekning ?? 0.55
      skyggeGrunn = 0.30 * (1 - dekning * 0.6) * (sikt < 0.3 ? 0.15 : 1)
      skyskygge.uniforms.uSkyggeStyrke.value = nightOn ? 0 : skyggeGrunn
      nedbor.setNedbor(preg?.nedbor ?? null, preg?.nedborTetthet ?? 0)
      vaerVindX = preg?.driftX ?? 1
      vaerVindZ = preg?.driftZ ?? 0
      // Grunnfargen for torden-blinket må følge natt/dag, ellers blinker
      // natthimmelen tilbake til dagens tåkefarge og blir stående der.
      grunnfarge.set(nightOn ? NIGHT_FOG_COLOR : FOG_COLOR)
      if (preg?.torden) tordenPaa = true
      else stoppTorden()
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

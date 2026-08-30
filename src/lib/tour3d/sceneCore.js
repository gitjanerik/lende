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
import { horisontTilWorld } from './astronomi.js'
import { buildPuffClouds } from './puffSkyer.js'
import { lagSkyskygge } from './skyskygge.js'
import { NEDBOR_TAK } from './vaerHimmel.js'
import { createEngineLoop } from './engineLoop.js'
import { buildHimmelGlobe } from './himmelGlobe.js'
import { HIMMELLEGEMER, harGlobe } from './himmellegemer.js'
import { svgToWgs84 } from '../utm.js'

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
 *          options?: {exaggeration?: number, tvingHimmel?: boolean}}} spec
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

  // tvingHimmel er en UTVIKLER-BRYTER (Utvikler-fanen): vis månen og planetene
  // med globe selv når de er under horisonten, så globene kan prøves når som
  // helst. Den het tvingMane til v6.3.1, da de tre planetene ble med.
  const { exaggeration = 1.15, tvingHimmel = false } = options
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

  // Hvor stor del av utsnittet mangler høydedata? terrainGrid flater noData til
  // havnivå, som er riktig for kystkart — der ER noData sjø. Men når utsnittet
  // er utvidet med nabofliser og DEM-hentingen feilet, fyller
  // mosaikkDemFallback naboene med noData, og da får man et flatt sjøplan der
  // det skulle vært fjell. Det ser ut som terreng, bare feil terreng, og det er
  // umulig å vite at man ser på en nødløsning.
  //
  // Samme prinsipp som tekstur-notisen rett over: en nødløsning man ikke kan se
  // at man ser på, er verre enn nødløsningen selv. Taket er høyt (en tredjedel),
  // fordi et vanlig kystkart har mye ekte sjø og ikke skal melde noe.
  {
    const { data, noData } = dem
    let hull = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i] === noData || !Number.isFinite(data[i])) hull++
    }
    const andel = data.length ? hull / data.length : 0
    if (andel > 0.33) {
      teksturNotis(`${Math.round(andel * 100)} % av utsnittet mangler høydedata `
        + '— terrenget der vises på havnivå')
    }
  }

  const sky = buildSkyDome()
  scene.add(sky.mesh)
  // Skyene er skjult til noen ber om vær (v5.27.0). Fram til da sto de på i all
  // dagvisning, og da var himmelen den samme enten man hadde slått på værvarselet
  // eller ikke — skyene sa altså ingenting. Nå er de en DEL av værvarselet:
  // ingen vær, ingen skyer, og en tom himmel er da et ærlig «vi viser ikke vær».
  const clouds = buildPuffClouds({
    widthM: meta.widthM,
    heightM: meta.heightM,
    baseY: Math.max(1200, terrain.maxElev * exaggeration + 350),
  })
  clouds.group.visible = false
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
  // Skygge-styrken slik været sier den skal være; skjulte skyer nuller den.
  let skyggeGrunn = 0.30
  skyskygge.uniforms.uSolRetning.value.copy(clouds.solRetning)
  skyskygge.festTil(terrain.material)

  // Globene — bygges lazily ved første trykk på et legeme (se aapneGlobe).
  //
  // GLOBE_AVSTAND er hvor langt foran kameraet kula henger, og GLOBE_GRADER hvor
  // stor den skal se ut. 34° er stort nok til at hav og krater er til å se på en
  // telefon, og lite nok til at himmelen rundt fortsatt er der — man skal se at
  // man ser på månen FRA kartet sitt, ikke at man har reist til den.
  const GLOBE_AVSTAND = 4000
  const GLOBE_GRADER = 34
  /**
   * Skjul eller vis skiva på himmelen for ett legeme. Sola og månen har hver sin
   * egen skive (`nightSky.sol`, `nightSky.mane`), planetene ligger i
   * `nightSky.planetSkive`.
   */
  const skjulSkive = (id, skjul) => {
    const s = id === 'sol' ? nightSky.sol
      : id === 'mane' ? nightSky.mane
        : nightSky.planetSkive?.(id)
    if (!s) return
    // Planetskivene skjules og vises også av settPlaneter etter om de er over
    // horisonten. Vi rører bare den ene som globen står for, og settPlaneter
    // spør globen før den viser noe igjen — se `globeLegeme` under.
    s.mesh.visible = !skjul
    // settPlaneter kalles på nytt når himmelen oppdateres, og den ville ellers
    // vist skiva igjen midt inne i globen.
    nightSky.settGlobeLegeme?.(skjul ? id : null)
  }

  // Én globe PER LEGEME, bygd første gang den åpnes og deretter gjenbrukt: en
  // sfære med tekstur er ikke gratis, og de fleste åpner aldri Saturn. `globe`
  // er den som står framme nå.
  const globeCache = new Map()
  let globe = null

  /**
   * RENDER-LAGET GLOBEN LIGGER I, og hvorfor den trenger et eget.
   *
   * Globen henger `GLOBE_AVSTAND` (4 km) foran kameraet i legemets VIRKELIGE
   * himmelretning — det er invarianten som gjør 3D til å stole på. Står legemet
   * lavt, som Mars på 3° over horisonten, havner kula altså delvis under
   * terrengets nivå, og arket skjærer rett gjennom planeten. Eieren så en Mars
   * kuttet i to av en kartflis.
   *
   * De to andre utveiene ble forkastet: å LØFTE globen ville løyet om hvor
   * legemet står, og `depthTest = false` på materialene ville lagt Saturns ringer
   * foran planeten også der de går bak den.
   *
   * Løsningen er standardmønsteret for et «alltid øverst»-objekt: hovedscenen
   * tegnes først, dybdebufferet tømmes, og globen tegnes i en andre pass. Da er
   * dybden fortsatt korrekt INNE i globen (ringene ligger riktig), men ingenting
   * i landskapet kan skjære den. Globen er en objekt-inspektør, og en inspektør
   * hører øverst.
   */
  const GLOBE_LAG = 1
  let globeRetning = null
  // Kula vokser fram fra skiva den var. Tallet er andelen av full størrelse.
  let globeSkala = 0
  let globeMaal = 0

  // Måne + stjerner. Skjult som default; setNightMode slår hele gruppa av/på.
  //
  // Fra v5.27.0 er himmelen ASTRONOMISK: stjernene står der de står over dette
  // arket i kveld, og månen har riktig posisjon og fase. Det krever ett
  // koordinat — arkets senterpunkt — og det er samme oppslag værvarselet gjør.
  // Klarer vi ikke å regne det ut, faller natthimmelen tilbake på det gamle
  // pseudo-tilfeldige feltet: en himmel er bedre enn en tom kuppel.
  let senterLat = null
  let senterLon = null
  try {
    const p = svgToWgs84(meta.widthM / 2, meta.heightM / 2, meta)
    if (Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) {
      senterLat = p.lat
      senterLon = p.lon
    }
  } catch { /* uten sted: pseudo-tilfeldig himmel, se buildNightSky */ }
  const nightSky = buildNightSky({
    lat: senterLat,
    lon: senterLon,
    dato: new Date(),
    // gl_PointSize og LineMaterial-bredder er i FRAMEBUFFER-piksler. Uten
    // pixelRatio inn ble stjernene halv størrelse på en telefon (v6.0.0).
    pikselForhold: renderer.getPixelRatio(),
    tvingHimmel,
  })
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
  // Er et værpreg lagt på? Skyene henger på DENNE, ikke på om det er dag.
  let vaerAktiv = false

  /**
   * Skyene vises bare når værvarselet vises OG det er dag (v5.27.0). Regelen bor
   * her, i én funksjon, fordi den avhenger av to uavhengige brytere — setVaer og
   * setNightMode — og to steder som setter `visible` etter hver sin halvdel av
   * sannheten kommer i utakt så snart den ene kalles alene.
   *
   * Skyskyggen følger med: uten skyer over bakken leses flekker på terrenget som
   * en feil i karteksturen, ikke som skygge. Om natta er det ingen sol å kaste
   * dem med i det hele tatt.
   */
  function oppdaterSkySynlighet() {
    const synlig = vaerAktiv && !nightOn
    clouds.group.visible = synlig
    skyskygge.uniforms.uSkyggeStyrke.value = synlig ? skyggeGrunn : 0
  }
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
      // Stjernebilde-linjene tegnes i piksler og trenger samme oppslag.
      nightSky.setResolution(w, h)
      hooks.onResize?.(w, h)
    },
    onFrame: (dt, timeS) => hooks.onFrame?.(dt, timeS),
    onContextLost: () => hooks.onContextLost?.(),
    // Loopen kom ikke i gang igjen etter retur fra bakgrunn, selv etter én
    // omstart. Kalleren må bygge motoren om — det er det brukeren ellers gjør
    // for hånd ved å lukke 3D og gå inn igjen.
    onDead: () => hooks.onDead?.(),
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

  // Skjermkoordinat for et world-punkt. Egen lokal funksjon fordi både det
  // returnerte API-et og månegloben trenger den.
  function project(x, y, z) {
    _v.set(x, y, z).project(camera)
    const w = container.clientWidth
    const h = container.clientHeight
    return { x: ((_v.x + 1) / 2) * w, y: ((1 - _v.y) / 2) * h, behind: _v.z > 1 }
  }

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

    render() {
      // Hovedscenen: alt UNNTATT globe-laget.
      camera.layers.set(0)
      renderer.render(scene, camera)
      // Globen oppå, med tømt dybdebuffer. Se GLOBE_LAG for hvorfor.
      // `autoClear` MÅ av rundt den andre passen — med den på ville
      // `render` tømt fargebufferet og vasket bort landskapet vi nettopp tegnet.
      if (globe?.group.visible) {
        renderer.autoClear = false
        renderer.clearDepth()
        camera.layers.set(GLOBE_LAG)
        renderer.render(scene, camera)
        renderer.autoClear = true
        camera.layers.set(0)
      }
    },

    // Bakgrunnsbevegelse som ikke avhenger av hva kalleren gjør med kameraet.
    updateAmbient(dt, timeS = null) {
      // Himmelen følger kameraet (v5.27.0). Kuppelen har radius 25 km og sto i
      // ORIGO, mens den frie riggen slipper kameraet 3 × arkets største mål unna
      // — på et 3×3-ark av 5 km er det 45 km, altså UTENFOR sin egen himmel.
      // Da fløy man ut av kuppelen og så bakgrunnsfargen. Flytter vi den med,
      // ligger himmelen i det uendelige uansett hvor kameraet står, månen har
      // konstant vinkelstørrelse (som en måne skal), og ingenting av himmelen kan
      // klippes av nær-planet. Bare posisjonen flyttes — orienteringen står, så
      // stjernene blir stående der de står.
      sky.mesh.position.copy(camera.position)
      nightSky.group.position.copy(camera.position)
      // Globen henger i månens retning, et fast stykke foran kameraet. Den
      // følger kameraets POSISJON som himmelen, så den blir stående i samme
      // himmelretning når man panorerer — man ser på månen der månen er.
      if (globe?.group.visible && globeRetning) {
        globe.group.position.set(
          camera.position.x + globeRetning[0],
          camera.position.y + globeRetning[1],
          camera.position.z + globeRetning[2],
        )
        // Vendes mot kameraet HVER frame: uten det peker forsida mot verdens
        // +Z, som i denne scenen er sør (se vendMot i globe).
        globe.vendMot(camera.position)
        // Vokse-animasjonen. Eksponentiell demping og ikke en tidslinje: den
        // tåler at en frame kommer sent, og den snur uten et eget «lukker»-steg.
        if (globeSkala !== globeMaal) {
          const k = 1 - Math.exp(-dt / 0.18)
          globeSkala += (globeMaal - globeSkala) * k
          if (Math.abs(globeMaal - globeSkala) < 0.004) globeSkala = globeMaal
          globe.settSkala(globeSkala)
          // Ferdig krympet: nå kan den skjules, ikke før.
          if (globeSkala === 0) {
            globe.setVisible(false)
            skjulSkive(globe.legeme, false)
          }
        }
      }
      // Skivene skal vende mot kameraet, og tida driver trykk-ringenes ripple.
      nightSky.update(camera, timeS)
      // Kameraet må med: puff-skyene oversetter sol-retningen til view-space
      // hver frame. Uten den roterer lyset med kameraet, og skyene leses som
      // lykter framfor opplyste former.
      // Skjulte skyer koster ingenting: driften og view-space-lyssettingen er
      // bare interessant for noe som tegnes, og standard-himmelen har ingen skyer.
      if (clouds.group.visible) {
        clouds.update(dt, camera)
        // Skyggene følger skyene. Oppdateres etter clouds.update, så de aldri
        // ligger én frame bak det man ser i himmelen.
        skyskygge.oppdater(clouds.skyer, 900, clouds.solRetning)
      }
      nedbor.update(dt, vaerVindX, vaerVindZ)
      oppdaterTorden(dt)
    },

    // Skjermkoordinat for et world-punkt. Leser kameraets matriser fra siste
    // render — kall etter render() for et resultat uten én frames etterslep.
    project,

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
    // dark-flagget), nattehimmel, mørk dis og skyene av (de er en dagting —
    // se oppdaterSkySynlighet).
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
      // Slås natta av, skal ikke en måneglobe stå igjen og henge i dagslyset.
      // Uten dette ville den blitt stående usynlig-men-åpen, og neste trykk
      // hadde lukket den i stedet for å velge noe.
      if (!nightOn && globe) {
        globeMaal = 0
        globeSkala = 0
        globe.settSkala(0.001)
        globe.setVisible(false)
        skjulSkive(globe.legeme, false)
      }
      oppdaterSkySynlighet()
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
     * Skyene er en DEL av værvarselet fra v5.27.0: `null` skjuler dem, og de er
     * fortsatt skjult om natta. Et værpreg bestemmer altså både hvem som er
     * synlig og hvordan de ser ut — se oppdaterSkySynlighet.
     */
    setVaer(preg) {
      vaerAktiv = !!preg
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
      oppdaterSkySynlighet()
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

    /** Fremhev én stjerneformasjon på natthimmelen (null rydder). */
    settValgtFormasjon(formasjon) {
      nightSky.settValgt(formasjon)
    },

    /**
     * UTVIKLER-BRYTER: vis månen selv når den står under horisonten, så
     * månegloben kan prøves når som helst. Ikke bare en byggeopsjon — brytes den
     * mens 3D står åpen, skal månen komme uten at man må lukke og åpne.
     */
    settTvingHimmel(paa) { nightSky.settTvingHimmel(paa) },
    get tvingHimmel() { return nightSky.tvingHimmel },

    // ── Globene: månen, Mars, Jupiter, Saturn ───────────────────────────────
    // Bygges LAZILY ved første trykk på legemet: en sfære med tekstur er ikke
    // gratis, og de fleste åpner aldri Saturn. Samme mønster som høydekurvene.
    /**
     * @param {{legeme: string, azimut: number, hoyde: number,
     *          faseVinkel?: number, lyssideVinkel?: number,
     *          parallaktisk?: number}} o
     * @returns {boolean} false når legemet ikke har en globe
     */
    aapneGlobe(o) {
      if (!o || !Number.isFinite(o.azimut) || !harGlobe(o.legeme)) return false
      // Bytter man fra månen til Mars, skal månen bort først — ellers står to
      // kuler i samme retning.
      if (globe && globe.legeme !== o.legeme) {
        globe.setVisible(false)
        globe.settSkala(0.001)
      }
      globe = globeCache.get(o.legeme) ?? null
      if (!globe) {
        globe = buildHimmelGlobe({
          legeme: o.legeme,
          radius: GLOBE_AVSTAND * Math.tan((GLOBE_GRADER / 2) * Math.PI / 180),
          // Bakt av scripts/bygg-himmelkart.mjs, som kjører i CI. Ligger fila
          // ikke der, tegnes kula i legemets egenfarge — globen er laget for å
          // tåle det, og lokalt er det den normale tilstanden (NASA og USGS er
          // sperret fra utviklingsmiljøene).
          // null for SOLA: den har ingen bakt fil, og overflaten tegnes lokalt
          // (se granulasjonTekstur i himmelGlobe.js). Uten denne porten ville
          // URL-en blitt «data/null» og gitt en 404 i loggen ved hver åpning.
          teksturUrl: HIMMELLEGEMER[o.legeme].tekstur
            ? `${import.meta.env?.BASE_URL ?? '/'}data/${HIMMELLEGEMER[o.legeme].tekstur}`
            : null,
        })
        // HELE gruppa inn i globe-laget, LYSENE MED. Regelen bor i globen selv
        // (settRenderLag) fordi den har to feller som er lette å tråkke i her:
        // lys må også bestå lagtesten, og laget arves ikke av barna.
        globe.settRenderLag(GLOBE_LAG)
        scene.add(globe.group)
        loop.track(globe)
        globeCache.set(o.legeme, globe)
      }
      globeRetning = horisontTilWorld(o.azimut, o.hoyde, GLOBE_AVSTAND)
      globe.settFase(o.faseVinkel ?? 0, o.lyssideVinkel ?? 0)
      // Rullen er den parallaktiske vinkelen med motsatt fortegn — da står
      // skyggelinja på kula slik sigden står på himmelen. Planetene har ikke en
      // egen parallaktisk vinkel (se settPlaneter); der er den 0, og det er
      // uten betydning fordi de ytre planetene er nær fullt opplyst.
      globe.settRull(-(o.parallaktisk ?? 0))
      globe.settRotasjon(0, 0)
      globeSkala = 0.05
      globeMaal = 1
      globe.settSkala(globeSkala)
      globe.setVisible(true)
      // Skiva på himmelen skjules mens kula er framme: to av samme legeme i
      // samme retning, den ene halvt inni den andre, leses som en tegnefeil.
      skjulSkive(o.legeme, true)
      return true
    },
    lukkGlobe() {
      // Krympes ned, og skjules først når den er nede — ellers forsvinner en
      // tredjedel av skjermen i ett klipp.
      globeMaal = 0
    },
    // ÅPEN betyr «brukeren har den framme», ikke «det tegnes noe»: krympingen
    // varer noen frames, og et trykk i den perioden skal ikke åpne den igjen.
    get globeAapen() { return !!globe?.group.visible && globeMaal > 0 },
    /**
     * Drei globen. Utslaget er i PIKSLER, og oversettes til radianer med samme
     * følsomhet som orbiten bruker — da kjennes det som å snurre den samme
     * verdenen, ikke som et annet instrument.
     */
    dreiGlobe(dxPx, dyPx) {
      if (!globe?.group.visible) return
      const h = container.clientHeight || 1
      const radPrPiksel = (2 * Math.PI) / h
      const r = globe.rotasjon
      globe.settRotasjon(
        r.lengde + dxPx * radPrPiksel,
        r.bredde + dyPx * radPrPiksel,
      )
    },
    /**
     * De navngitte trekkene som er synlige nå, med SKJERMKOORDINATER. Kalles
     * etter render, som project() krever.
     */
    globeTrekkPaaSkjerm() {
      if (!globe?.group.visible || globeSkala < 0.6) return []
      const ut = []
      for (const t of globe.synligeTrekk()) {
        const skj = project(t.verden[0], t.verden[1], t.verden[2])
        if (skj.behind) continue
        ut.push({ navn: t.navn, norsk: t.norsk, merk: t.merk, type: t.type, x: skj.x, y: skj.y })
      }
      return ut
    },
    get globeHarTekstur() { return !!globe?.harTekstur },
    /** Hvilket legeme globen står for nå, eller null. */
    get globeLegeme() { return globe?.group.visible && globeMaal > 0 ? globe.legeme : null },
    /** Navnet på legemet globen står for — viseren bruker det i overskrifter. */
    get globeNavn() { return globe?.navn ?? null },
    /** Planetene som står over horisonten nå — viseren bruker dem i lista. */
    get synligePlaneter() { return nightSky.synligePlaneter },

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

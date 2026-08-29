// Knappenåler i 3D — den delte formen og den delte matematikken.
//
// En nål er en hvit stamme med et farget kulehode, plantet med foten i
// terrenget. Turvisningen bruker noen få (start/mål/via), utforskeren kan ha
// hundrevis, så feltet tegnes som to InstancedMesh-er med per-instans farge:
// én tegnekall for stammene og én for hodene uansett antall.
//
// Avstandsoverdrivelsen er felles og bevisst: nær kamera står nåla i naturlig
// størrelse, langt unna vokser den opptil 5× så den fortsatt kan lokaliseres
// i horisonten. Skaleringen skjer fra bakkepunktet, så nåla løftes aldri fra
// terrenget.

import {
  SphereGeometry, CylinderGeometry, MeshBasicMaterial, InstancedMesh, Color,
  Object3D, Vector3, DynamicDrawUsage,
} from 'three'
import { sampleElevation } from '../demSampling.js'

export const PIN_STEM_H = 55
export const PIN_STEM_R = 2.2
export const PIN_HEAD_R = 9

const MAX_SCALE = 5
const SCALE_REF_M = 1200

// Tak på HODETS vinkelstørrelse: hode-radius delt på avstanden til HODET.
// 0,12 svarer til ~14° i diameter, altså en fjerdedel av bildehøyden ved 55°
// synsfelt — en stor, men leselig markør. Over ~75 m binder taket ikke i det
// hele tatt, så nålene ser ut akkurat som før på all normal avstand.
const MAKS_HODE_ANDEL = 0.12
// Hodets senter over bakkepunktet ved skala 1.
const HODE_LOFT = PIN_STEM_H + PIN_HEAD_R * 0.6

// Største world-koordinat en nål kan ha og fortsatt være ekte data. Det største
// arket er noen titalls kilometer, og kameraets far-plan står på 60 km, så 1000
// km er rundelig — det slår bare til på tall som ikke KAN være et sted i kartet.
// Hvorfor grensa finnes: se `ugyldig` i buildPinField.
const MAKS_WORLD_M = 1e6

/**
 * Bakkepunktet i world-rommet. Mangler DEM-en en høyde her, brukes HAVNIVÅ.
 *
 * Og det er RIKTIG her, i motsetning til i pathNetwork (v5.27.0), der samme
 * fallback ble fjernet fordi stiene plunget ned fra fjellsida og løp langs et
 * sjøplan. Forskjellen er at `terrainGrid` flater noData til havnivå: der DEM-en
 * mangler, ER det tegnede terrenget på 0. En nål på 0 står altså PÅ bakken som
 * vises — feil høyde, men ikke i løse lufta. En sti er en sammenhengende strek
 * fra ekte terreng og NED dit, og det er streken man ser.
 *
 * Ikke bytt dette til null eller NaN: verdien går rett inn i
 * `holder.position.set` i waypointMarkers, og en ikke-endelig instans-matrise er
 * nøyaktig feilen v5.22.9–11 gikk tre runder på å bli kvitt.
 */
export function drapedWorld(dem, coords, x, y, liftM = 0) {
  const e = sampleElevation(dem, x, y)
  return coords.toWorld(x, y, (Number.isFinite(e) ? e : 0) + liftM)
}

/**
 * Avstandsavhengig skala for en nål — delt av alle nåletyper.
 * @param {number} distM avstand kamera→nålas BAKKEPUNKT i world-enheter
 */
export function pinScaleAt(distM) {
  return Math.min(MAX_SCALE, Math.max(1, distM / SCALE_REF_M))
}

/**
 * Skalaen en nål FAKTISK skal tegnes med, gitt kameraet og bakkepunktet.
 *
 * Hvorfor dette ikke er `pinScaleAt` alene: hodet sitter ~60 m OVER
 * bakkepunktet, så avstanden til FOTEN sier lite om hvor nær HODET er kameraet.
 * Flyr man i nålehøyde er foten 60 m unna — skala 1, hode-radius 9 m — mens
 * hodet kan ligge én meter foran linsa. Da dekker det ene hodet hele skjermen i
 * sin egen flate farge, og idet kameraet krysser kuleflata forsvinner det helt
 * (baksideflatene klippes bort). Det leses som flimrende, heldekkende bånd i
 * nålefargen — rapportert fra felt, og reprodusert i Chromium: ett hode fylte
 * 100 % av bildet på 10 m (v5.22.8).
 *
 * Taket måles derfor fra HODET, ikke foten. Avstand 0 gir skala 0: står man
 * inne i hodet, er nåla ingenting å se på.
 *
 * @param {{x:number,y:number,z:number}} camPos
 * @param {number} bx bakkepunkt, world
 * @param {number} by
 * @param {number} bz
 */
export function pinScaleForCamera(camPos, bx, by, bz) {
  // Et bakkepunkt som ikke er et tall (eller er uendelig) skal ikke tegnes i det
  // hele tatt — se `ugyldig` i buildPinField for hvorfor. Sjekken står FØR
  // regnestykket, fordi Infinity inn her gir en fullt endelig skala ut (5) og
  // dermed en instans-matrise full av Infinity.
  if (![bx, by, bz].every(Number.isFinite)) return 0
  const s = pinScaleAt(Math.hypot(camPos.x - bx, camPos.y - by, camPos.z - bz))
  // Hodet sitter HODE_LOFT·s over bakkepunktet, så avstanden til hodet er en
  // funksjon av den skalaen vi leter etter. Da må den løses, ikke gjettes — en
  // enkelt runde med «regn taket fra hodet der det ville stått i full skala»
  // bommer med opptil 25 %, fordi et lavere hode kommer NÆRMERE et kamera som
  // står under det. Betingelsen er
  //
  //   (R·s)² ≤ A²·(r² + (dy − HODE_LOFT·s)²)
  //
  // med R = PIN_HEAD_R, A = MAKS_HODE_ANDEL, r = vannrett avstand kamera→nål og
  // dy = kamerahøyde over bakkepunktet. Ordnet er det en andregradsulikhet:
  //
  //   (R² − A²·HODE_LOFT²)·s² + (2·A²·HODE_LOFT·dy)·s − A²·(dy² + r²) ≤ 0
  //
  // og den positive roten er taket. Førstekoeffisienten er positiv så lenge
  // A < R/HODE_LOFT ≈ 0,149; settes taket høyere enn det finnes ingen øvre
  // grense, og hele beregningen slutter å beskytte noe.
  const dy = camPos.y - by
  const r2 = (camPos.x - bx) ** 2 + (camPos.z - bz) ** 2
  const A2 = MAKS_HODE_ANDEL * MAKS_HODE_ANDEL
  const a = PIN_HEAD_R * PIN_HEAD_R - A2 * HODE_LOFT * HODE_LOFT
  const b = 2 * A2 * HODE_LOFT * dy
  const tak = (-b + Math.sqrt(b * b + 4 * a * A2 * (dy * dy + r2))) / (2 * a)
  const ut = Math.min(s, tak)
  // Siste skanse: en ikke-endelig skala skriver NaN inn i instans-matrisen, og
  // en GPU tegner da vilkårlige flater. Bedre å ikke tegne nåla.
  return Number.isFinite(ut) ? ut : 0
}

/**
 * Bygg et nålefelt.
 * @param {Array<{x:number, y:number, color:number|string}>} items i SVG-meter
 * @param {object} dem
 * @param {object} coords
 * @param {{stemColor?: number}} [opts]
 */
export function buildPinField(items, dem, coords, { stemColor = 0xffffff } = {}) {
  const n = items.length
  const stemGeo = new CylinderGeometry(PIN_STEM_R, PIN_STEM_R, PIN_STEM_H, 8)
  const headGeo = new SphereGeometry(PIN_HEAD_R, 12, 10)
  const stemMat = new MeshBasicMaterial({ color: stemColor })
  const headMat = new MeshBasicMaterial({ vertexColors: false })

  const stems = new InstancedMesh(stemGeo, stemMat, Math.max(1, n))
  const heads = new InstancedMesh(headGeo, headMat, Math.max(1, n))
  stems.frustumCulled = false
  heads.frustumCulled = false
  // Matrisene skrives om HVER frame (avstandsskalaen følger kameraet), og da må
  // bufferet være merket dynamisk. Med standard StaticDrawUsage laster three opp
  // med bufferSubData i et buffer driveren har lov til å tro er skrivebeskyttet
  // etter opplasting: den slipper å lage en ny kopi, og på flere mobil-GPU-er
  // skriver vi da over minne GPU-en fortsatt leser forrige frame fra. Resultatet
  // er revne matriser for enkelte instanser — heldekkende, flimrende flater i
  // nålas egen farge, som aldri viser seg på desktop eller i SwiftShader.
  // DynamicDrawUsage er den dokumenterte måten å si «denne skrives ofte».
  stems.instanceMatrix.setUsage(DynamicDrawUsage)
  heads.instanceMatrix.setUsage(DynamicDrawUsage)

  // Bakkepunktene lagres slik at update() kan skalere om hver frame uten å
  // sample DEM-en på nytt.
  const bases = new Float32Array(n * 3)
  const dummy = new Object3D()
  const color = new Color()

  // Nåler uten et troverdig bakkepunkt. De MÅ beholde indeksen sin (raycast og
  // declutter slår opp på den), så de parkeres i stedet for å fjernes.
  //
  // Hvorfor dette er nødvendig: én eneste ikke-endelig verdi i instans-matrisen
  // gir udefinert oppførsel i vertex-shaderen, og en mobil-GPU tegner det som
  // vilkårlige flater — flimrende, knivtynne kiler med spissen langt utenfor
  // kartet, i nålas egen flate farge. Rapportert fra felt (v5.22.9): grå kiler
  // rett opp i himmelen, med kilden bortenfor horisonten. Kildene er begge
  // realistiske: `it.x`/`it.y` kommer fra nettbaserte POI-lag som projiseres med
  // wgs84ToSvg (feil akserekkefølge i én WFS-post er nok), og høyden kommer fra
  // DEM-en, der et fyllverdi-tall som IKKE er lik `noData` (f.eks. 3,4e38) blir
  // Infinity i det øyeblikket det lagres i denne Float32Array-en.
  const ugyldig = new Set()

  for (let i = 0; i < n; i++) {
    const it = items[i]
    const [wx, wy, wz] = drapedWorld(dem, coords, it.x, it.y)
    const ok = [wx, wy, wz].every(v => Number.isFinite(v) && Math.abs(v) <= MAKS_WORLD_M)
    if (ok) {
      bases[i * 3] = wx
      bases[i * 3 + 1] = wy
      bases[i * 3 + 2] = wz
    } else {
      ugyldig.add(i)   // bases står på 0 — verdien brukes ikke, men skal være trygg
    }
  }

  const _cam = new Vector3()
  const _camForrige = new Vector3(NaN, NaN, NaN)
  let maaSkrives = true

  // Instansene som FAKTISK tegnes ligger fremst i bufferet: slot k hører til
  // items[slots[k]]. Resten submitteres ikke i det hele tatt — count settes ned.
  //
  // Dette er tredje forsøk på å bli kvitt de flimrende flatene, og det første
  // som fjerner problemet i stedet for å flytte det. Målingen fra felt (lagt inn
  // i Info-panelet i v5.22.10) avgjorde: 34 nåler vist, 693 PARKERT, av 727 —
  // og det største hodet dekket 0,8 % av synsfeltet mot et tak på 12 %. Altså
  // var hver matrise vi skrev riktig, mens vi likevel sendte 693 instanser til
  // GPU-en hver frame og ba den klippe dem bort. Først som singulære nullflater
  // (skala 0, alle vertekser i ett punkt), så — etter v5.22.9 — som kuler 200 km
  // under bakken, altså langt utenfor guard-bandet en tile-basert mobil-GPU
  // regner med. Begge er inndata en desktop-GPU forkaster stille og en
  // mobil-driver kan gjøre hva som helst med, og det den gjorde var heldekkende,
  // flimrende flater i nålenes egne farger.
  //
  // En instans som ikke submitteres kan ingen driver tegne feil. Det er også
  // 20× mindre arbeid: 34 instanser i stedet for 727.
  //
  // Prisen er at instanceColor følger SLOTEN og ikke nåla, så fargene må skrives
  // om når sammensetningen endres. Det skjer bare når declutteren bytter
  // (maks ~4,5 ganger i sekundet), ikke når kameraet flytter seg.
  const slots = new Int32Array(n).fill(-1)
  // Hodets verdensposisjon per SLOT, skrevet samtidig med matrisen. Brukes av
  // skjermrom-plukkingen (se naermesteISkjerm) — den må kjenne hodet der det
  // FAKTISK står, med gjeldende skala, og det tallet finnes bare her.
  const hodeVerden = new Float32Array(n * 3)
  let tegnet = 0
  let fargerSkitne = true

  const writeInstances = (scaleOf) => {
    let k = 0
    for (let i = 0; i < n; i++) {
      if (ugyldig.has(i)) continue
      const bx = bases[i * 3], by = bases[i * 3 + 1], bz = bases[i * 3 + 2]
      const s = scaleOf(i, bx, by, bz)
      if (!(s > 0)) continue
      dummy.position.set(bx, by + (PIN_STEM_H / 2) * s, bz)
      dummy.scale.setScalar(s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      stems.setMatrixAt(k, dummy.matrix)
      dummy.position.set(bx, by + HODE_LOFT * s, bz)
      dummy.updateMatrix()
      heads.setMatrixAt(k, dummy.matrix)
      hodeVerden[k * 3] = dummy.position.x
      hodeVerden[k * 3 + 1] = dummy.position.y
      hodeVerden[k * 3 + 2] = dummy.position.z
      if (slots[k] !== i) { slots[k] = i; fargerSkitne = true }
      k++
    }
    tegnet = k
    stems.count = k
    heads.count = k
    stems.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    // InstancedMesh cacher en bounding sphere over instansene, og three
    // invaliderer den IKKE når matrisene endres — den brukes av raycast. Med
    // kompaktering bytter innholdet i slotene, så en sphere fra forrige
    // sammensetning kan utelukke nåla brukeren nettopp trykket på. Nulles her og
    // regnes om lazily; det skjer bare ved et trykk, over maks ~120 instanser.
    stems.boundingSphere = null
    heads.boundingSphere = null
    stems.boundingBox = null
    heads.boundingBox = null
    if (fargerSkitne) {
      for (let j = 0; j < k; j++) {
        color.set(items[slots[j]].color)
        heads.setColorAt(j, color)
      }
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true
      fargerSkitne = false
    }
  }
  writeInstances(i => (ugyldig.has(i) ? 0 : 1))

  // Skjulte nåler faller ut av tegningen (count senkes). Nåle-INDEKSENE holder
  // seg like fullt stabile utad: declutter, raycast og basePosition snakker om
  // items-indeksen, og `slots` oversetter til og fra bufferets slot.
  let visible = null   // null = alle synlige

  return {
    stems,
    heads,
    geometries: [stemGeo, headGeo],
    materials: [stemMat, headMat],
    get count() { return n },
    /** Indekser uten troverdig bakkepunkt — parkert, aldri tegnet. */
    get invalidIndices() { return ugyldig },
    isUgyldig(i) { return ugyldig.has(i) },
    basePosition(i) {
      return [bases[i * 3], bases[i * 3 + 1], bases[i * 3 + 2]]
    },
    setVisibleSet(set) { visible = set; maaSkrives = true },
    isVisible(i) { return !visible || visible.has(i) },
    update(camera) {
      _cam.copy(camera.position)
      // Står kameraet stille og declutteren ikke har endret seg, er matrisene
      // allerede riktige. Da skal vi heller ikke laste opp bufferet på nytt:
      // en opplasting per frame som ingen trenger er både bortkastet båndbredde
      // og et vindu der GPU-en kan lese et buffer vi skriver i.
      if (!maaSkrives && _cam.distanceToSquared(_camForrige) < 0.0625) return
      maaSkrives = false
      _camForrige.copy(_cam)
      writeInstances((i, bx, by, bz) => {
        if (visible && !visible.has(i)) return 0
        return pinScaleForCamera(_cam, bx, by, bz)
      })
    },
    /**
     * Nærmeste TEGNEDE nål til et skjermpunkt, i CSS-piksler (v6.3.12).
     *
     * Raycasten over krever at strålen treffer geometrien. Et nålehode er en
     * liten kule og stammen er tynn — på en telefon er det et mål på noen få
     * piksler, og eieren meldte at det var vrient å treffe. Dette er samme grep
     * som stjernebildene fikk i v6.3.11: spør «hva er nærmest fingeren» framfor
     * å kreve et geometrisk treff.
     *
     * Måler mot HODET og ikke bakkepunktet: det er hodet man sikter på, og
     * stammen kan være lang når nåla står langt unna.
     *
     * @param {(x:number,y:number,z:number)=>{x:number,y:number,behind:boolean}} project
     * @param {number} fx fingerens x i CSS-piksler
     * @param {number} fy fingerens y
     * @param {number} terskel maks avstand i CSS-piksler
     * @returns {number|null} nåle-indeks (i items), ikke slot
     */
    naermesteISkjerm(project, fx, fy, terskel) {
      let best = null
      let bestAvstand = terskel
      for (let k = 0; k < tegnet; k++) {
        const p = project(hodeVerden[k * 3], hodeVerden[k * 3 + 1], hodeVerden[k * 3 + 2])
        if (!p || p.behind) continue
        const d = Math.hypot(p.x - fx, p.y - fy)
        if (d < bestAvstand) {
          bestAvstand = d
          best = slots[k]
        }
      }
      return best != null && best >= 0 ? best : null
    },
    // Raycast treffer stamme eller hode; begge peker tilbake på samme indeks.
    raycast(raycaster) {
      const hits = raycaster.intersectObjects([heads, stems], false)
      for (const h of hits) {
        // instanceId er en SLOT i bufferet, ikke nåle-indeksen. Bare de tegnede
        // instansene finnes der, så et treff er per definisjon en synlig nål.
        if (h.instanceId == null || h.instanceId >= tegnet) continue
        const i = slots[h.instanceId]
        if (i >= 0) return i
      }
      return null
    },
    dispose() {
      stemGeo.dispose()
      headGeo.dispose()
      stemMat.dispose()
      headMat.dispose()
      stems.dispose()
      heads.dispose()
    },
  }
}

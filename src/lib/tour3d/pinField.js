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
  Object3D, Vector3,
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

// Hvor en parkert nål legges: rett ned, langt utenfor kameraets far-plan (60 km),
// men ikke så langt at float32 mister presisjon. Se kommentaren over
// `writeInstances` for hvorfor de ikke lenger parkeres med skala 0.
export const PARK_Y = -2e5

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
  stems.count = n
  heads.count = n

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
    color.set(it.color)
    heads.setColorAt(i, color)
  }
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true

  const _cam = new Vector3()

  // Første oppsett med skala 1 så feltet er riktig plassert før første update.
  //
  // `scaleOf` som gir 0 betyr PARKER: nåla skal ikke ses. Den flyttes da rett ned
  // til PARK_Y i FULL størrelse, i stedet for å stå igjen på plassen sin med
  // skala 0. Forskjellen er ikke kosmetisk. En skala-0-matrise er singulær —
  // alle 260 vertekser i kula faller sammen i ett punkt — og et flertall av
  // instansene er parkert i hver frame (declutteren slipper gjennom 120 av
  // f.eks. 272). Desktop-GPU-er og SwiftShader forkaster slike nullflater
  // stille, men i felt kom det flimrende, knivtynne kiler i nålenes egne flate
  // farger, med spissen langt utenfor kartet — også i farger som tilhørte nåler
  // man ikke så noe annet sted i bildet, altså nettopp de parkerte (v5.22.9).
  // En nål 200 km under bakken er derimot en helt vanlig kule med en gyldig
  // matrise, som havner utenfor far-planet og klippes bort etter spec.
  const writeInstances = (scaleOf) => {
    for (let i = 0; i < n; i++) {
      const bx = bases[i * 3], by = bases[i * 3 + 1], bz = bases[i * 3 + 2]
      const s = scaleOf(i, bx, by, bz)
      if (!(s > 0)) {
        dummy.position.set(bx, PARK_Y, bz)
        dummy.scale.setScalar(1)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        stems.setMatrixAt(i, dummy.matrix)
        heads.setMatrixAt(i, dummy.matrix)
        continue
      }
      dummy.position.set(bx, by + (PIN_STEM_H / 2) * s, bz)
      dummy.scale.setScalar(s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      stems.setMatrixAt(i, dummy.matrix)
      dummy.position.set(bx, by + HODE_LOFT * s, bz)
      dummy.updateMatrix()
      heads.setMatrixAt(i, dummy.matrix)
    }
    stems.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
  }
  writeInstances(i => (ugyldig.has(i) ? 0 : 1))

  // Skjulte nåler (autofiltrering) parkeres i stedet for at count endres —
  // indeksene må holde seg stabile for raycast-oppslaget (og for instanceColor,
  // som er satt én gang per indeks).
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
    setVisibleSet(set) { visible = set },
    isVisible(i) { return !visible || visible.has(i) },
    update(camera) {
      _cam.copy(camera.position)
      writeInstances((i, bx, by, bz) => {
        if (ugyldig.has(i)) return 0
        if (visible && !visible.has(i)) return 0
        return pinScaleForCamera(_cam, bx, by, bz)
      })
    },
    // Raycast treffer stamme eller hode; begge peker tilbake på samme indeks.
    raycast(raycaster) {
      const hits = raycaster.intersectObjects([heads, stems], false)
      for (const h of hits) {
        if (h.instanceId == null || ugyldig.has(h.instanceId)) continue
        if (!visible || visible.has(h.instanceId)) return h.instanceId
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

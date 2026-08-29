// POI-nålelaget i 3D: hundrevis av knappenåler oppå terrenget, autofiltrert i
// skjermrom, klikkbare.
//
// Trukket ut av 3D-scenen fordi BÅDE den frie utforskingen og en planlagt tur
// bruker det samme laget nå — samme nåler, samme filter, samme trykk-oppførsel,
// uansett hvilken vei brukeren kom inn i 3D. Laget eier sin egen gruppe i
// scenen, sin egen declutter-kadens og oversettelsen fra nåle-indeks tilbake
// til POI-en nåla står for.

import { Group, Vector3 } from 'three'
import { buildPinField, pinScaleForCamera, PIN_STEM_H, PIN_HEAD_R } from './pinField.js'
import { declutter } from '../labelDeclutter.js'
import { poiColor } from '../poiColors.js'
import { kindMeta } from './featureTimeline.js'
import { groupOfKind } from './exploreData.js'

// Nålene filtreres i skjermrom på egen kadens. Hver frame ville vært bortkastet
// (og ustabilt); et kvart sekund er raskt nok til at det leses som direkte.
const DECLUTTER_MS = 220
const MAX_VISIBLE_PINS = 120
// Luft mellom to nåler som begge får stå (skjerm-px). Nålehodene er runde og
// kollisjonsboksen er en firkant, så uten litt margin kan to hoder se ut som
// de tar på hverandre selv når boksene så vidt går klar.
const PIN_PAD_PX = 5
// Nåla er en loddrett pinne, og bredden dens på skjermen er hodets diameter
// målt mot hele nålehøyden: 2·PIN_HEAD_R / (PIN_STEM_H + 0,6·PIN_HEAD_R) ≈ 0,3.
// Halve det er halvbredden. Gulvene holder boksen brukbar helt ute i horisonten,
// der nåla er noen få piksler høy.
const PIN_W_OF_H = 0.15
const PIN_MIN_HALF_W = 11
const PIN_MIN_HALF_H = 14

/**
 * @param {{scene: import('three').Scene,
 *          dem: object, coords: object,
 *          project: (x:number,y:number,z:number) => {x:number,y:number,behind:boolean}}} arg
 */
export function createPinLayer({ scene, dem, coords, project, maxVisible = MAX_VISIBLE_PINS }) {
  const group = new Group()
  scene.add(group)

  let items = []
  let field = null
  let enabledGroups = null      // null = alle grupper
  let visible = true
  let prevShown = new Set()
  let lastDeclutter = 0
  // Kameraposisjonen fra siste frame. Declutteringen trenger den for å regne
  // ut hvor stor hver nål FAKTISK er på skjermen — avstandsoverdrivelsen i
  // pinField gjør en fjern nål opptil 5× større enn en nær.
  const camPos = new Vector3()
  let harKam = false

  const dropField = () => {
    if (!field) return
    group.remove(field.stems)
    group.remove(field.heads)
    field.dispose()
    field = null
  }

  const activeIndices = () => items
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => !field?.isUgyldig(i)
      && (!enabledGroups || enabledGroups.has(groupOfKind(f.kind))))

  // Skjermrom-filtrering: samme declutter som 2D-kartets navnebudsjett bruker.
  // Den er hysterese-stabil, så nåler slutter å blinke når kameraet beveger seg.
  //
  // Kollisjonsboksen er HELE nåla slik den står på skjermen (v5.18.0). Den var
  // en fast 32×52 px-firkant rundt hodet, og det holdt ikke: nåler skaleres
  // opptil 5× med avstanden, så to fjerne nåler kunne stå med hodene delvis
  // oppå hverandre og likevel «gå klar» i en boks som var regnet for en nær nål.
  // Nå måler vi føttene og hodet i skjermrommet og lar boksen dekke pinnen —
  // en stamme som krysser et annet hode er like uleselig som to hoder i hop.
  const runDeclutter = () => {
    if (!field) return
    const cands = []
    for (const { f, i } of activeIndices()) {
      const [wx, wy, wz] = field.basePosition(i)
      const distM = harKam
        ? Math.hypot(camPos.x - wx, camPos.y - wy, camPos.z - wz)
        : 0
      // MÅ være samme skala som renderingen bruker (pinScaleForCamera), ellers
      // regnes kollisjonsboksen på en nål som tegnes i en annen størrelse.
      const s = harKam ? pinScaleForCamera(camPos, wx, wy, wz) : 1
      const head = project(wx, wy + (PIN_STEM_H + PIN_HEAD_R * 0.6) * s, wz)
      if (head.behind) continue
      const foot = project(wx, wy, wz)
      const halfH = Math.max(PIN_MIN_HALF_H, Math.abs(foot.y - head.y) / 2)
      const meta = kindMeta(f.kind, f.categories)
      cands.push({
        id: String(i),
        // Prioritet i tiere, nærhet som brøkdel: to nåler av samme slag som
        // konkurrerer om samme flekk skal avgjøres av hvem som står nærmest
        // betrakteren — den fjerne er den som ser feilplassert ut når den
        // vinner over noe man har rett foran seg.
        score: (meta?.priority ?? 3) * 10 + 1 / (1 + distM / 1000),
        sx: (foot.x + head.x) / 2,
        sy: (foot.y + head.y) / 2,
        halfW: Math.max(PIN_MIN_HALF_W, halfH * 2 * PIN_W_OF_H),
        halfH,
        group: (meta?.priority ?? 0) >= 5 ? 'priority' : 'quota',
      })
    }
    const shown = declutter(cands, {
      cellPx: 150, K: 3, pad: PIN_PAD_PX, prevShown, maxVisible,
    })
    prevShown = shown
    field.setVisibleSet(new Set([...shown].map(Number)))
  }

  // Nåle-indeks → det trykket skal gi. Delt av begge plukkeveiene, så en tapt
  // nål og en truffet nål aldri kan svare ulikt.
  const treff = (i) => {
    if (i == null || !items[i]) return null
    const f = items[i]
    return {
      feature: f,
      world: field.basePosition(i),
      radiusM: f.areaM2 ? Math.sqrt(f.areaM2 / Math.PI) : 60,
    }
  }

  return {
    group,
    get visible() { return visible },
    get count() { return items.length },
    /** Nåle-indeksene declutteren slapp gjennom sist. */
    get visibleIndices() { return new Set([...prevShown].map(Number)) },

    setFeatures(list) {
      dropField()
      items = list ?? []
      if (items.length) {
        field = buildPinField(
          items.map(f => ({ x: f.x, y: f.y, color: poiColor(f) })),
          dem, coords,
        )
        group.add(field.stems)
        group.add(field.heads)
        // Én POI med ubrukelig posisjon skal ikke ødelegge bildet for alle de
        // andre — den parkeres av pinField. Men den skal SIES fra om: en nål som
        // stille forsvinner er en POI brukeren ikke får trykke på, og navnet er
        // det eneste sporet tilbake til kilden som leverte den.
        if (field.invalidIndices.size) {
          const navn = [...field.invalidIndices]
            .slice(0, 5)
            .map(i => `${items[i]?.kind ?? '?'}:${items[i]?.name ?? '?'}`)
          console.warn(
            `[3D] ${field.invalidIndices.size} nål(er) hadde ubrukelig posisjon `
            + `og er utelatt: ${navn.join(', ')}`,
          )
        }
      }
      prevShown = new Set()
      group.visible = visible
      runDeclutter()
    },

    setVisible(v) {
      visible = !!v
      group.visible = visible
    },

    /** @param {Set<string>|null} groups null = alle grupper */
    setGroups(groups) {
      enabledGroups = groups
      prevShown = new Set()
      runDeclutter()
    },

    update(camera) {
      camPos.copy(camera.position)
      harKam = true
      if (field && visible) field.update(camera)
    },

    /** Declutter på egen kadens — kalles hver frame, jobber ~4 ganger i sekundet. */
    maybeDeclutter(nowMs) {
      if (!field || !visible) return
      if (nowMs - lastDeclutter <= DECLUTTER_MS) return
      lastDeclutter = nowMs
      runDeclutter()
    },

    /**
     * Trykk-treff → POI-en nåla står for, med bakkepunktet i world-koordinater.
     * @returns {{feature: object, world: [number,number,number], radiusM: number}|null}
     */
    raycast(raycaster) {
      if (!field || !visible) return null
      return treff(field.raycast(raycaster))
    },

    /**
     * Nærmeste nål til et skjermpunkt — brukes når strålen bommet. Se
     * naermesteISkjerm i pinField for hvorfor.
     */
    naermesteISkjerm(project, fx, fy, terskel) {
      if (!field || !visible) return null
      return treff(field.naermesteISkjerm(project, fx, fy, terskel))
    },

    dispose() {
      dropField()
      scene.remove(group)
    },
  }
}

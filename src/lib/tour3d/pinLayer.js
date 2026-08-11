// POI-nålelaget i 3D: hundrevis av knappenåler oppå terrenget, autofiltrert i
// skjermrom, klikkbare.
//
// Trukket ut av 3D-scenen fordi BÅDE den frie utforskingen og en planlagt tur
// bruker det samme laget nå — samme nåler, samme filter, samme trykk-oppførsel,
// uansett hvilken vei brukeren kom inn i 3D. Laget eier sin egen gruppe i
// scenen, sin egen declutter-kadens og oversettelsen fra nåle-indeks tilbake
// til POI-en nåla står for.

import { Group } from 'three'
import { buildPinField } from './pinField.js'
import { declutter } from '../labelDeclutter.js'
import { poiColor } from '../poiColors.js'
import { kindMeta } from './featureTimeline.js'
import { groupOfKind } from './exploreData.js'

// Nålene filtreres i skjermrom på egen kadens. Hver frame ville vært bortkastet
// (og ustabilt); et kvart sekund er raskt nok til at det leses som direkte.
const DECLUTTER_MS = 220
const MAX_VISIBLE_PINS = 120

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

  const dropField = () => {
    if (!field) return
    group.remove(field.stems)
    group.remove(field.heads)
    field.dispose()
    field = null
  }

  const activeIndices = () => items
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !enabledGroups || enabledGroups.has(groupOfKind(f.kind)))

  // Skjermrom-filtrering: samme declutter som 2D-kartets navnebudsjett bruker.
  // Den er hysterese-stabil, så nåler slutter å blinke når kameraet beveger seg.
  const runDeclutter = () => {
    if (!field) return
    const cands = []
    for (const { f, i } of activeIndices()) {
      const [wx, wy, wz] = field.basePosition(i)
      const p = project(wx, wy + 60, wz)
      if (p.behind) continue
      const meta = kindMeta(f.kind, f.categories)
      cands.push({
        id: String(i),
        score: (meta?.priority ?? 3) * 10,
        sx: p.x,
        sy: p.y,
        halfW: 16,
        halfH: 26,
        group: (meta?.priority ?? 0) >= 5 ? 'priority' : 'quota',
      })
    }
    const shown = declutter(cands, {
      cellPx: 150, K: 3, pad: 3, prevShown, maxVisible,
    })
    prevShown = shown
    field.setVisibleSet(new Set([...shown].map(Number)))
  }

  return {
    group,
    get visible() { return visible },
    get count() { return items.length },

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
      const i = field.raycast(raycaster)
      if (i == null || !items[i]) return null
      const f = items[i]
      return {
        feature: f,
        world: field.basePosition(i),
        radiusM: f.areaM2 ? Math.sqrt(f.areaM2 / Math.PI) : 60,
      }
    },

    dispose() {
      dropField()
      scene.remove(group)
    },
  }
}

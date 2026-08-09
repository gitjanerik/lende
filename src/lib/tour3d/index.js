// Offentlig inngang til 3D-motoren. Hele tour3d-mappa (inkl. three) lever i
// én lazy chunk — importer aldri herfra statisk utenfor mappa.

export { createTourScene, TourSceneError } from './tourScene.js'
export { createExploreScene } from './exploreScene.js'
export { collectMapFeatures, findParkingSpots, findPauseSpots, loadNveFeatures, loadHeritageFeatures } from './tourData.js'
export {
  collectAllFeatures, collectBrukerminnePins, loadHeritageForMap,
  clusterFeaturesByMeters, PIN_GROUPS, groupOfKind, countByGroup, featureType,
} from './exploreData.js'
export { poiColor } from '../poiColors.js'
export { buildFeatureTimeline } from './featureTimeline.js'
export { fmtKm, fmtDurationMin, fmtMoh, fmtAscent } from './tourFormat.js'
export { defaultTimeScale } from './playback.js'

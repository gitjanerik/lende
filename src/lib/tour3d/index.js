// Offentlig inngang til 3D-motoren. Hele tour3d-mappa (inkl. three) lever i
// én lazy chunk — importer aldri herfra statisk utenfor mappa.

export { createTourScene, TourSceneError } from './tourScene.js'
export { collectMapFeatures, loadNveFeatures, loadHeritageFeatures } from './tourData.js'
export { buildFeatureTimeline } from './featureTimeline.js'
export { fmtKm, fmtDurationMin, fmtMoh, fmtAscent } from './tourFormat.js'

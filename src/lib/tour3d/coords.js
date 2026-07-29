// Koordinatmapping for 3D-turvisning: kartets SVG-meter-rom ↔ Three.js-world.
//
// World-rommet er høyrehendt med X = øst, Y = opp, Z = sør, sentrert i
// kartets midtpunkt (holder float32-presisjonen og gir OrbitControls et
// naturlig target i origo). SVG-y øker sørover, så Z = svgY − heightM/2
// uten flip. Høyder skaleres med vertikal overdrivelse (norsk kystterreng
// leser flatt fra dronehøyde ved 1.0).

export function makeCoords({ widthM, heightM, exaggeration = 1.15 }) {
  const cx = widthM / 2
  const cz = heightM / 2
  return {
    widthM,
    heightM,
    exaggeration,
    toWorld(svgX, svgY, elevM = 0) {
      return [svgX - cx, elevM * exaggeration, svgY - cz]
    },
    toSvg(worldX, worldZ) {
      return { x: worldX + cx, y: worldZ + cz }
    },
    elevToWorldY(elevM) {
      return elevM * exaggeration
    },
    worldYToElev(worldY) {
      return worldY / exaggeration
    },
    // Tekstur-canvas tegnes med nord øverst mens three sin UV-v øker oppover.
    uvOf(svgX, svgY) {
      return [svgX / widthM, 1 - svgY / heightM]
    },
  }
}

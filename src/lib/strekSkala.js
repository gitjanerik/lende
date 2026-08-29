// Strek-skalaen: knott-hakkene og kartstørrelse-basisen som ganges inn i
// --stroke-scale. Trukket ut av useKartKnotter i v6.5.0 fordi Fritt lende låser
// streken til default-hakket uten å ta med resten av knott-maskineriet.
//
// Ren modul — verdiene er de samme som før uttrekket, og strekSkala.test.js
// holder dem fast.

// v10.2.38 — hele skalaen senket 30% (× 0.7 fra [0.4, 0.6, 0.85, 1.2, 1.6, 2.2]).
// Maks-hakket × strokeSizeBase var litt for voldsomt (effektiv ~1.3–1.5×);
// 30%-kuttet lander effektiv maks på drøyt 1 på både små og store kart.
export const STROKE_STEPS = [0.28, 0.42, 0.6, 0.84, 1.12, 1.54]
export const STROKE_DEFAULT_IDX = 2  // 0.6× (var 0.85×) etter 30%-nedjustering

// Kartstørrelse-basis: 1 km → 1.0, 10 km → 0.4 (lineær mellom). Klam utenfor.
// Gjør at samme knott-hakk gir tynnere streker på store kart der konturene
// ligger tett, så maks ikke blir et svart rot og default matcher ~1 km-følelsen.
export function strokeSizeBase(widthM) {
  if (!Number.isFinite(widthM) || widthM <= 0) return 1
  const t = Math.min(1, Math.max(0, (widthM - 1000) / 9000))
  return 1 - 0.6 * t
}

// Effektiv --stroke-scale for et hakk på et kart av gitt bredde.
export function strekSkala(stepIdx, widthM) {
  const i = Math.min(STROKE_STEPS.length - 1, Math.max(0, stepIdx | 0))
  return STROKE_STEPS[i] * strokeSizeBase(widthM)
}

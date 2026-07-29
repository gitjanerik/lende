// Formattering for 3D-HUD-en — bokmål med komma-desimal og tabular-vennlige
// korte strenger.

export function fmtKm(m) {
  if (!Number.isFinite(m)) return '–'
  const km = m / 1000
  if (km >= 100) return `${Math.round(km)} km`
  return `${km.toFixed(1).replace('.', ',')} km`
}

export function fmtDurationMin(min) {
  if (!Number.isFinite(min) || min < 0) return null
  const rounded = Math.round(min)
  if (rounded < 60) return `${rounded} min`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return `${h} t ${String(m).padStart(2, '0')} min`
}

export function fmtMoh(elev) {
  if (!Number.isFinite(elev)) return '–'
  return `${Math.round(elev)} moh`
}

export function fmtAscent(m) {
  if (!Number.isFinite(m)) return '–'
  return `↗ ${Math.round(m)} m`
}

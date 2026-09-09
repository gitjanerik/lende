// holdVaken.js — regnestykkene bak «Hold skjermen våken» (hovedmenyen).
//
// Ren modul med vilje: komponentene er kabling, og det eneste her som kan være
// FEIL uten at noe ser rart ut er ringen rundt hamburgeren — en nedtelling som
// tegner feil vei ser helt normal ut på et stillbilde.

export const MAKS_MINUTTER = 60
export const MS_PER_MIN = 60_000

// Slider-verdien: hele minutter i [0, 60]. 0 er AV, og det er defaulten.
export function klemMinutter(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.min(MAKS_MINUTTER, v)
}

// Minutter som VISES. Rundes OPP, så «1 minutt igjen» står helt til det faktisk
// er nede i null — en teller som viser 0 mens skjermen fortsatt holdes våken er
// en teller man slutter å tro på.
export function minutterIgjen(gjenstaarMs) {
  if (!Number.isFinite(gjenstaarMs) || gjenstaarMs <= 0) return 0
  return Math.ceil(gjenstaarMs / MS_PER_MIN)
}

export function andelIgjen(gjenstaarMs, totalMs) {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return 0
  const a = gjenstaarMs / totalMs
  if (!Number.isFinite(a)) return 0
  return Math.min(1, Math.max(0, a))
}

// Ringen rundt hamburgeren: en analog klokke som spises MED klokka fra toppen.
//
// Streken tegnes fra `C·(1−andel)` og fram til slutten av omkretsen, altså med
// FAST ende ved toppen og en start som vandrer med klokka. Den nærliggende
// varianten — `dasharray: C`, `dashoffset: C·(1−andel)` som FAB-knottenes
// hold-ring bruker — har fast START og en ende som trekker seg MOT klokka.
// Begge krymper; bare denne ser ut som en nedtelling.
export function ringDash(andel, omkrets) {
  const a = Math.min(1, Math.max(0, Number(andel) || 0))
  const tegnet = omkrets * a
  return {
    dasharray: `${tegnet} ${omkrets}`,
    dashoffset: `${tegnet - omkrets}`,
  }
}

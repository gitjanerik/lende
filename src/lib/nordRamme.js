// Ramma rundt et ark som er rotert til SANN NORD.
//
// På skjermen er nord-opp gratis: rotasjonen bor på wrapper-diven og arket under
// den er urørt. En eksportert fil har ingen wrapper — der må selve SVG-en roteres,
// og et rotert rektangel får ikke plass i sitt eget omriss. Papiret må altså vokse,
// og hjørnene som blir til overs males i bakgrunnsfargen.
//
// Prisen er MÅLT og er verdt å kjenne før noen «forenkler» rotasjonen inn i den
// vanlige eksporten: 1,5° koster 5 % mer flate, 3,2° koster 11 %, 7,8° koster
// 27 % og 19,9° (Kirkenes) koster 64 %. Det er hele grunnen til at bryteren i
// Eksport-fanen finnes.
//
// Ren modul: ingen DOM, ingen Vue. Kallstedet (useKartEksport) gjør selve
// innpakkingen i et <g>.

/**
 * @param {object} o
 * @param {number} o.minX     viewBox-origo (0 for et vanlig ark)
 * @param {number} o.minY
 * @param {number} o.widthM   arkets bredde i meter
 * @param {number} o.heightM  arkets høyde i meter
 * @param {number} o.rotDeg   rotasjonen som legges på (positiv med klokka)
 * @returns {{widthM:number, heightM:number, transform:string, vekst:number}}
 *   `transform` legges på et <g> som pakker inn HELE arkinnholdet; den nye
 *   viewBoxen er `0 0 widthM heightM`. `vekst` er flate-forholdet mot arket.
 */
export function roterRamme({ minX = 0, minY = 0, widthM, heightM, rotDeg }) {
  const w = Number(widthM), h = Number(heightM)
  const rot = Number(rotDeg) || 0
  if (!(w > 0) || !(h > 0)) return null
  const r = Math.abs(rot) * Math.PI / 180
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r))
  const W = w * c + h * s
  const H = w * s + h * c
  // Rekkefølgen leses HØYRE→VENSTRE i SVG: flytt arkets senter til den nye
  // rammas senter, roter så om det samme punktet. Å rotere først ville dreid om
  // et punkt arket ikke lenger står i.
  const dx = W / 2 - (minX + w / 2)
  const dy = H / 2 - (minY + h / 2)
  const f = (v) => Number(v.toFixed(4))
  return {
    widthM: f(W),
    heightM: f(H),
    transform: `rotate(${f(rot)} ${f(W / 2)} ${f(H / 2)}) translate(${f(dx)} ${f(dy)})`,
    vekst: f((W * H) / (w * h)),
  }
}

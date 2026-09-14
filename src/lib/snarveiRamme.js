/**
 * snarveiRamme.js — omrisset rundt snarvei-raden, som ÉN sammenhengende bane.
 *
 * HVORFOR SVG OG IKKE `border` (v7.8.21). Ramma ble født som CSS i v7.8.19: en
 * boks med `border-radius` på toppen, to kant-stumper som tegnet bunnstreken,
 * og en «bule» med egne kanter imellom. Den satt sammen, men den var SATT
 * SAMMEN — tre elementer som møttes i to skjøter, og i hver skjøt gikk en rett
 * strek rett inn i en annen rett strek. Der en linje skal svinge ned rundt
 * håndtaket, ble det et hjørne.
 *
 * En bane kan gjøre det en `border` per definisjon ikke kan: gå UT av
 * rektangelet. Overgangen inn til bula er derfor en KONKAV bue — streken bøyer
 * seg utover før den bøyer innover — og det er den som gjør at bula leses som
 * en utbuling AV kanten og ikke som en knapp hengt under den. Fire radier i
 * spill: arkets hjørner, bulas hjørner, og de to overgangene.
 *
 * BANEN REGNES I EKTE PIKSLER, og det er hele grunnen til at den kan være
 * ren. Alternativet — én SVG som strekkes med `preserveAspectRatio="none"` —
 * ville dratt hjørnebuene og streken ut av form i det raden ble bredere enn
 * høy. Kallstedet måler boksen og setter `viewBox` til de samme tallene, så
 * én brukerenhet ER én piksel og ingenting skaleres.
 *
 * Ren modul: ingen DOM, ingen Vue. Bare geometri.
 */

/** Formen, i piksler ved 100 % tekst. Kallstedet skalerer det som skal skalere. */
export const RAMME = {
  /** Arkets egne hjørner. Skalerer IKKE — det er pillas form, ikke tekstens. */
  hjorne: 16,
  /** Bulas bredde og hvor dypt den henger under bunnstreken. */
  buleBredde: 76,
  buleDybde: 22,
  /**
   * Bulas egne hjørner, nede. Tallet er valgt slik at `buleHjorne + overgang`
   * er NØYAKTIG `buleDybde`: da går den konkave overgangen rett over i det
   * konvekse hjørnet uten en rett strek imellom, og profilen er én
   * sammenhengende S. Endrer du ett av de tre, endre de to andre — `rammeBane`
   * klemmer så banen aldri kan folde seg, men en klemt verdi gir et lite rett
   * stykke midt i svingen, og det er nettopp det denne formen ikke skal ha.
   */
  buleHjorne: 13,
  /** Overgangen: den konkave buen der streken forlater bunnlinja. */
  overgang: 9,
  /**
   * Strekbredde. CSS-ramma var 1 px; en bane som skal LESES som en strek rundt
   * et sett brikker tåler mer, og eieren ba om litt tykkere. 2 px er der den
   * fortsatt er en strek og ikke en kant.
   */
  strek: 2,
}

const rund = (n) => Math.round(n * 100) / 100

/**
 * Omrisset som en SVG-bane.
 *
 * Banen tegnes MED KLOKKA fra toppen, og de to overgangsbuene er de eneste med
 * `sweep-flag: 0`: de svinger andre veien enn alle hjørnene, fordi de er
 * konkave. Bytter man dem til 1, får man et hakk i stedet for en flyt — det
 * ser ut som en tegnefeil og er lett å «rette» feil vei.
 *
 * @param {object} o
 * @param {number} o.w      boksens bredde i piksler
 * @param {number} o.h      boksens høyde i piksler (til BUNNLINJA, ikke til bulas bunn)
 * @param {number} [o.bule] bulas bredde. 0 = ingen bule (sorterings-modus)
 * @param {number} [o.skala] tekstskalaen; bula og overgangen vokser med den
 * @returns {string|null} `d`-attributtet, eller null om boksen er for liten
 */
export function rammeBane({ w, h, bule = RAMME.buleBredde, skala = 1 }) {
  if (!(w > 0) || !(h > 0)) return null
  const i = RAMME.strek / 2
  // Hjørneradien kan ikke være større enn halve boksen — en smal rad ville
  // ellers fått buer som krysser hverandre og en bane som folder seg.
  const r = Math.max(0, Math.min(RAMME.hjorne, (w - RAMME.strek) / 2, (h - RAMME.strek) / 2))
  const s = skala > 0 ? skala : 1
  const t = RAMME.overgang * s
  const bd = RAMME.buleDybde * s
  // Bula må ha plass mellom de to hjørnene, med begge overgangene innenfor.
  const maksBule = w - RAMME.strek - 2 * (r + t)
  const bw = Math.min(bule * s, Math.max(0, maksBule))
  // `bd - t` er taket som hindrer at banen folder seg: uten den kan den
  // konkave buen ende DYPERE enn der hjørnet begynner, og `V` snur oppover.
  const br = Math.max(0, Math.min(RAMME.buleHjorne * s, bw / 2, bd - t))

  const hoyre = w - i
  const bunn = h - i
  const cx = w / 2
  const d = []
  d.push(`M ${rund(i + r)} ${rund(i)}`)
  d.push(`H ${rund(hoyre - r)}`)
  d.push(`A ${rund(r)} ${rund(r)} 0 0 1 ${rund(hoyre)} ${rund(i + r)}`)
  d.push(`V ${rund(bunn - r)}`)
  d.push(`A ${rund(r)} ${rund(r)} 0 0 1 ${rund(hoyre - r)} ${rund(bunn)}`)
  if (bw > 0) {
    d.push(`H ${rund(cx + bw / 2 + t)}`)
    // Konkav: streken bøyer UTOVER før den går ned. Sweep 0.
    d.push(`A ${rund(t)} ${rund(t)} 0 0 0 ${rund(cx + bw / 2)} ${rund(bunn + t)}`)
    d.push(`V ${rund(bunn + bd - br)}`)
    d.push(`A ${rund(br)} ${rund(br)} 0 0 1 ${rund(cx + bw / 2 - br)} ${rund(bunn + bd)}`)
    d.push(`H ${rund(cx - bw / 2 + br)}`)
    d.push(`A ${rund(br)} ${rund(br)} 0 0 1 ${rund(cx - bw / 2)} ${rund(bunn + bd - br)}`)
    d.push(`V ${rund(bunn + t)}`)
    d.push(`A ${rund(t)} ${rund(t)} 0 0 0 ${rund(cx - bw / 2 - t)} ${rund(bunn)}`)
  }
  d.push(`H ${rund(i + r)}`)
  d.push(`A ${rund(r)} ${rund(r)} 0 0 1 ${rund(i)} ${rund(bunn - r)}`)
  d.push(`V ${rund(i + r)}`)
  d.push(`A ${rund(r)} ${rund(r)} 0 0 1 ${rund(i + r)} ${rund(i)}`)
  d.push('Z')
  return d.join(' ')
}

/**
 * Hvor høy SVG-en må være: boksen PLUSS bula, pluss en halv strek så den ikke
 * klippes av sin egen viewBox.
 */
export function rammeHoyde(h, { bule = RAMME.buleBredde, skala = 1 } = {}) {
  if (!(h > 0)) return 0
  return h + (bule > 0 ? RAMME.buleDybde * (skala > 0 ? skala : 1) : 0) + RAMME.strek
}

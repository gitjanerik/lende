// Vær-demo for 3D: en fast runde gjennom værtypene, slik at de kan SES.
//
// Hvorfor den finnes: flere av uttrykkene er ren bevegelse og kan ikke vurderes
// i et stillbilde. Vinden er bare driftretning og fart. Torden er et blink som
// varer 0,16 s. Nedbøren faller. Et skjermbilde viser ingen av dem, og det er
// nettopp derfor sky-arbeidet gikk i ring i august 2026: uttrykk ble endret og
// vurdert på stillbilder, én runde av gangen.
//
// Rekkefølgen er valgt for å gjøre NABOENE sammenliknbare: skydekket trappes
// opp først (klart → overskyet), så nedbørstypene i økende styrke, og torden
// rett etter regnet den skal skille seg fra. Ikke sorter den alfabetisk.

/** Sekunder per type. Lenge nok til å se drift og rekke et lyn-blink. */
export const DEMO_SEKUNDER = 10

export const DEMO_STEG = [
  { kode: 'clearsky_day', navn: 'Klarvær', merk: 'nesten skyfri' },
  { kode: 'fair_day', navn: 'Lettskyet', merk: '' },
  { kode: 'partlycloudy_day', navn: 'Delvis skyet', merk: '' },
  { kode: 'cloudy', navn: 'Overskyet', merk: 'fullt dekke' },
  { kode: 'fog', navn: 'Tåke', merk: '' },
  { kode: 'lightrain', navn: 'Lett regn', merk: 'se nedbøren falle' },
  { kode: 'heavyrain', navn: 'Kraftig regn', merk: 'mørkere skyer' },
  { kode: 'rainshowersandthunder_day', navn: 'Torden', merk: 'vent på blinket' },
  { kode: 'lightsnow', navn: 'Lett snø', merk: 'faller saktere' },
  { kode: 'heavysnow', navn: 'Kraftig snø', merk: '' },
  // Vind til slutt, og med SAMME skydekke i to styrker rett etter hverandre:
  // det er den eneste måten å se forskjellen, siden vind ikke har noe eget
  // utseende — bare fart og retning på driften.
  { kode: 'partlycloudy_day', navn: 'Vind 2 m/s', merk: 'fra sørvest', vindMs: 2, vindRetningGrader: 225 },
  { kode: 'partlycloudy_day', navn: 'Vind 18 m/s', merk: 'samme skyer, annen fart', vindMs: 18, vindRetningGrader: 225 },
]

/** Måleverdiene demoen sender inn i vaerTilHimmel for et gitt steg. */
export function demoMaling(steg) {
  return {
    vindMs: steg.vindMs ?? 6,
    vindRetningGrader: steg.vindRetningGrader ?? 200,
  }
}

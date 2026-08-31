// Nordlys-demo for 3D: en fast runde gjennom styrkene, slik at de kan SES.
//
// Samme begrunnelse som vær-demoen (vaerDemo.js), og den er sterkere her: et
// nordlys er PER DEFINISJON bevegelse. Foldene bruker minutter på å gå rundt,
// strålene driver sidelengs, og intensiteten puster. Ingen av delene finnes i et
// stillbilde, og ingen av dem kan vurderes på et skjermbilde i en PR.
//
// OG DEN ER DEN ENESTE MÅTEN Å SE ARBEIDET PÅ I DET HELE TATT. Vær-demoen finnes
// for at man skal slippe å vente på riktig vær; nordlys-demoen finnes fordi et
// synlig nordlys over Sør-Norge er noe som skjer noen netter i året. Uten den kan
// laget bare prøves av en som tilfeldigvis står i Tromsø på en klar natt med Kp 5
// — altså i praksis aldri, og aldri i CI.
//
// Rekkefølgen trapper OPP, så naboene er sammenliknbare: hvert steg legger til
// nøyaktig én ting, og man kan se hva den ene tingen gjør.

/** Sekunder per steg. Lenger enn værets ti: en fold tar tid å lese. */
export const DEMO_SEKUNDER = 14

export const DEMO_STEG = [
  { navn: 'Svakt, lavt i nord', prosent: 8, ovalGradNord: 6, kp: 1,
    merk: 'et grønt slør over horisonten' },
  { navn: 'Synlig bånd', prosent: 22, ovalGradNord: 5, kp: 3,
    merk: 'strålene kommer fram' },
  { navn: 'Sterkt', prosent: 45, ovalGradNord: 3, kp: 5,
    merk: 'rødt i toppen, fiolett frynse' },
  { navn: 'Svært sterkt', prosent: 72, ovalGradNord: 1, kp: 7,
    merk: 'fyller himmelen' },
  // OVER HODET er et annet bilde enn foran deg, og det er verdt et eget steg:
  // her står gardinene i senit og strålene peker mot betrakteren. Det er den
  // situasjonen folk beskriver som en «korona», og den man ikke får sett uten
  // å reise nordover.
  { navn: 'Rett over hodet', prosent: 80, ovalGradNord: 0, kp: 8,
    merk: 'ovalen står i senit' },
  // TIL SLUTT: samme styrke, ULIK AVSTAND. Den eneste måten å se at
  // høydevinkelen faktisk regnes ut — og at et nordlys langt nord ligger lavt.
  { navn: 'Sterkt, men langt nord', prosent: 55, ovalGradNord: 12, kp: 5,
    merk: 'samme styrke, mye lavere på himmelen' },
]

/** Målingen demoen sender inn i nordlysPreg for et gitt steg. */
export function demoMaling(steg) {
  return {
    prosent: steg.prosent,
    ovalGradNord: steg.ovalGradNord,
    kp: steg.kp,
  }
}

/** Tallene demoen viser i panelet, så det ser ut som en ekte måling. */
export function demoTall(steg) {
  return {
    prosent: steg.prosent,
    kp: steg.kp,
    // Grovt realistiske følgetall: solvinden stiger med aktiviteten, og Bz peker
    // sørover (negativ) når nordlyset faktisk kommer. Et demopanel som viser
    // Bz nord ved Kp 8 ville lært bort noe galt.
    vindKmS: Math.round(380 + steg.kp * 55),
    bt: Math.round(4 + steg.kp * 1.6),
    bz: -Math.round(1 + steg.kp * 1.3),
    skydekke: 10,
  }
}

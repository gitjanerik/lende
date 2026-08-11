// Fasit-stedene: seks kart som til sammen dekker feilklassene som HAR rammet
// Lende. Hvert sted står her fordi noe konkret gikk galt der (eller i en
// geografi som den), ikke fordi det er et pent turområde.
//
// Koordinatene er hentet med appens egen geokoder (sok_sted → Kartverket SSR +
// Nominatim), så de er de samme punktene brukeren ville fått.

export const STEDER = [
  {
    id: 'vardasen',
    navn: 'Vardåsen, Asker',
    lat: 59.813746,
    lon: 10.414616,
    halfKm: 2,
    // Referansekartet: demokartet CI bygger uansett. Innlands skog, tett
    // stinett, små vann. Fanger «alt gikk i stå»-regresjoner først.
    hvorfor: 'referanse — demokartet, tett stinett og småvann',
    forvent: { forventVann: true, forventSti: true, forventKonturer: true },
  },
  {
    id: 'kolstadoya',
    navn: 'Kolstadøya, Aurskog-Høland',
    lat: 59.798393,
    lon: 11.693825,
    halfKm: 1.5,
    // v1.0.35–v1.0.41: øyer i innsjø mistet hullene sine, gang på gang, mens
    // vann-kilden vekslet mellom OSM, NVE og N50.
    hvorfor: 'øy i innsjø — hull i vannflater (v1.0.35–41)',
    forvent: { forventVann: true, forventKonturer: true, forventHull: 1 },
  },
  {
    id: 'strykenasen',
    navn: 'Strykenåsen, Drammen',
    lat: 59.740636,
    lon: 10.083294,
    halfKm: 2,
    // v5.5.4/v5.6.1: stinettet var brutt i praksis (12,9 m hull ga 14 km
    // omvei), og hull-broingen måtte lære å nekte over hovedvei og elv.
    hvorfor: 'brutt stinett + elv og hovedvei tett på (v5.5.4–5.6.1)',
    forvent: { forventVann: true, forventSti: true, forventKonturer: true },
  },
  {
    id: 'gjende',
    navn: 'Gjende, Vågå',
    lat: 61.47275,
    lon: 8.589882,
    halfKm: 4,
    // Stor innsjø i høyfjell: her dukket spøkelsesflis-forskyvningen opp
    // (ruter tvers over vannet, v4.3.0), og DEM-oppløsningen faller på areal.
    hvorfor: 'stor innsjø i høyfjell — ruting over vann, DEM-nedskalering (v4.3.0)',
    forvent: { forventVann: true, forventSti: true, forventKonturer: true },
  },
  {
    id: 'henningsvaer',
    navn: 'Henningsvær, Vågan',
    lat: 68.152888,
    lon: 14.200724,
    halfKm: 2,
    // Kysten er den delen som surrer mest: DEM-sjø, Sjøkart-dybdeareal,
    // N50-havflate og OSM-kystlinje skal bli ÉN autoritativ sjøgeometri.
    hvorfor: 'skjærgård — kystlinje, dybdeareal og holmer',
    forvent: { forventVann: true, forventKonturer: true },
  },
  {
    id: 'rondvassbu',
    navn: 'Rondvassbu, Sel',
    lat: 61.880432,
    lon: 9.795985,
    halfKm: 3,
    // Høyfjell over tregrensa: bart fjell, stup, blokkmark, nesten ingen
    // vegetasjon. Motsatt ytterpunkt av Vardåsen for kontur/vegetasjon.
    hvorfor: 'høyfjell — stup, blokkmark, kontur uten vegetasjon',
    forvent: { forventSti: true, forventKonturer: true },
  },
]

export const stedById = (id) => STEDER.find(s => s.id === id) ?? null

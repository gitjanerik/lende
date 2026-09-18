// RUTE-PREFERANSE — foretrekker Stifinneren og Runde STI eller VEG I MARKA?
//
// HVORFOR DEN FINNES. `ISOM_COST` i routing.js bærer ÉN rangering: sti →
// skogsveg → småveg → veg, med et bevisst SMALT bånd (maks ~1,7× fra sti til
// motorvei) så avstand dominerer. Den rangeringen er riktig for den som GÅR.
// De fleste som planlegger tur i Lende sitter på terreng-/stisykkel, og for dem
// er den snudd: skogsvegen er det man vil ha under seg, og stien er omveien.
// Båndet er dessuten for smalt til at et ønske i det hele tatt slår gjennom —
// 1,15 mot 1,0 avgjør ingenting når en rute er to kilometer lang.
//
// MODELLEN ER EN MULTIPLIKATOR, ALDRI ET FORBUD, OG DET ER HELE SLAKKEN.
// Dijkstra er hukommelsesløs: en kant vet ikke hvor lenge man har vært på feil
// underlag, så «maks 200 m sti om gangen» kan ikke uttrykkes som en kantvekt.
// Men straffen er PROPORSJONAL med lengden, og det gir nøyaktig den slakken
// eieren ba om: med faktor F er en avstikker på L meter verdt en omvei på
// L × F meter på ønsket underlag. Går sti og skogsveg på kryss og tvers, er
// forbindelses-stumpene korte — de overlever. En halv kilometer sti fordi
// skogsvegen tar slutt, gjør det ikke. Et ekte forbud ville i stedet gitt
// «fant ingen rute», som er det verste svaret av alle.
//
// SLAKKEN VED ENDEPUNKTENE ER GEOMETRISK OG BOR I routing.js
// (`medEndepunktSlakk`): innenfor `slakkM` fra start, mål og hvert vendepunkt
// gjelder preferansen ikke. Det er eierens andre spørsmål — «hvor langt unna
// målet skal en foreslått skogsveg finnes» — og det er ikke det samme som
// straffen: hytta ligger der den ligger, og den siste stien fram til den er
// ingen innvending mot ruta.
//
// DEFAULT ENDRER INGENTING. `sti` + «foretrekk» gir INGEN faktorer i det hele
// tatt (`kostnadsFaktorer` svarer null), så en graf bygget uten preferanse er
// den samme grafen som før v7.8.38. Det er med vilje: ISOM_COST ER allerede
// sti-preferansen, og en ny modul som ganger 1,0 inn overalt ville flyttet
// tallene uten å endre noe.

/** De to underlagene brukeren kan foretrekke. */
export const UNDERLAG = Object.freeze({ STI: 'sti', VEG: 'veg' })

/** Sti-kodene (ISOM 505 godt løp, 506 uklar, 507 stitråkk). */
export const STI_KODER = Object.freeze(['505', '506', '507'])

/**
 * Veg-kodene, i prioritert rekkefølge. 504 er vegen I MARKA — skogsbilveg,
 * traktorveg og OSM `highway=track`, ofte bak bom — og det er den eieren
 * mener når han sier «Småveg». 503 er den offentlige småvegen og er nest
 * best: den er kjørbar, men den har biler på seg.
 *
 * 501/502 står bevisst UTENFOR. En preferanse for veg i marka er ikke en
 * preferanse for hovedveg, og motorvegen er alt blokkert i «kortest mulig».
 */
export const VEG_KODER = Object.freeze(['504', '503'])

// Faktorene ganges INN I ISOM_COST, de erstatter den ikke. Effektiv vekt blir
// altså `ISOM_COST[kode] × faktor`, og det er forholdet mellom klassene som
// styrer ruta — ikke tallene hver for seg.
//
//   foretrekk: veg ~0,75 mot sti ~1,7–1,9  → forhold ≈ 2,3. En sti-stump på
//              100 m tas når alternativet på veg er mer enn ~230 m lenger.
//   krav:      sti × 9                     → forhold ≈ 12. Samme stump tas
//              bare når vegen koster over en kilometer ekstra.
//
// Ni og ikke nitti: straffen skal kunne TAPE mot geografien. Et tall stort nok
// til å aldri tape er et forbud med flere trinn, og da er vi tilbake til «fant
// ingen rute» på et kart der skogsvegen tilfeldigvis er brutt i ett kryss.
const ONSKET_FAKTOR = 0.65
const SEKUNDAER_FAKTOR = 0.8
const AVVIK_FORETREKK = 1.7
const AVVIK_KRAV = 9

/** Slakk-sonen rundt hvert endepunkt: grenser, steg og standard. */
export const SLAKK_MIN_M = 0
export const SLAKK_MAKS_M = 1000
export const SLAKK_STEG_M = 50

export const DEFAULT_RUTE_PREF = Object.freeze({
  underlag: UNDERLAG.STI,
  krav: false,
  slakkM: 250,
})

/**
 * Klem et vilkårlig objekt (localStorage, et MCP-argument, en chat-parameter)
 * til en gyldig preferanse. Ukjent underlag faller til `sti` — standarden er
 * den som ikke endrer noe, så en tastefeil kan ikke i stillhet legge om
 * ruteren.
 *
 * @param {{underlag?: string, krav?: boolean, slakkM?: number}} [pref]
 * @returns {{underlag: string, krav: boolean, slakkM: number}}
 */
export function normaliserRutePref(pref) {
  const p = pref ?? {}
  const underlag = p.underlag === UNDERLAG.VEG ? UNDERLAG.VEG : UNDERLAG.STI
  const rå = Number(p.slakkM)
  const slakkM = Number.isFinite(rå)
    ? Math.min(SLAKK_MAKS_M, Math.max(SLAKK_MIN_M, Math.round(rå / SLAKK_STEG_M) * SLAKK_STEG_M))
    : DEFAULT_RUTE_PREF.slakkM
  return { underlag, krav: !!p.krav, slakkM }
}

/**
 * Kostnadsfaktorer per ISOM-kode, til `buildRoutingGraph({ kostnad })`.
 *
 * Svarer `null` for den nøytrale preferansen (sti uten krav) — se filhodet:
 * grafen skal da være bit for bit den samme som før preferansen fantes.
 *
 * @param {object} [pref]
 * @returns {Record<string, number>|null}
 */
export function kostnadsFaktorer(pref) {
  const p = normaliserRutePref(pref)
  if (p.underlag === UNDERLAG.STI && !p.krav) return null

  const avvik = p.krav ? AVVIK_KRAV : AVVIK_FORETREKK
  const ut = {}
  if (p.underlag === UNDERLAG.VEG) {
    ut['504'] = ONSKET_FAKTOR
    ut['503'] = SEKUNDAER_FAKTOR
    for (const k of STI_KODER) ut[k] = avvik
  } else {
    // Sti med krav: alt som er kjørbart straffes likt. Skogsvegen er ikke
    // «nesten sti» her — den som har krysset av for krav, vil gå på sti.
    for (const k of ['503', '504', '502', '501']) ut[k] = avvik
  }
  return ut
}

/** Kodene preferansen ØNSKER seg. Brukt av oppsummeringen og av UI-teksten. */
export function onskedeKoder(pref) {
  return normaliserRutePref(pref).underlag === UNDERLAG.VEG
    ? [...VEG_KODER]
    : [...STI_KODER]
}

/**
 * Nøkkel som endrer seg når og bare når ruteresultatet kan endre seg. Brukes
 * som del av graf-cachens nøkkel i Stifinneren: uten den ville en bryter i
 * Preferanser ikke slått gjennom før kartet ble lastet på nytt.
 */
export function prefNokkel(pref) {
  const p = normaliserRutePref(pref)
  return `${p.underlag}|${p.krav ? 'krav' : 'foretrekk'}|${p.slakkM}`
}

/** Er preferansen den nøytrale (= grafen er uendret)? */
export function erNoytral(pref) {
  return kostnadsFaktorer(pref) === null
}

/**
 * Én norsk setning om hva preferansen betyr. Delt av Preferanser-fana, av
 * Lende-chattens systemkontekst og av MCP-svarene, så alle tre sier det samme
 * med de samme ordene.
 */
export function prefTekst(pref) {
  const p = normaliserRutePref(pref)
  const slakk = p.slakkM > 0
    ? ` Siste ${p.slakkM} m fram til start, mål og vendepunkt er fri — der velges korteste vei uansett underlag.`
    : ' Ingen slakk ved endepunktene.'
  if (p.underlag === UNDERLAG.VEG) {
    return (p.krav
      ? 'Ruter skal så langt det lar seg gjøre gå på skogsveg eller småveg; sti brukes bare der vegen er brutt.'
      : 'Ruter foretrekker skogsveg og småveg framfor sti, men en kortere sti-variant kan vinne.'
    ) + slakk
  }
  return (p.krav
    ? 'Ruter skal så langt det lar seg gjøre gå på sti; veg brukes bare der stien er brutt.'
    : 'Ruter foretrekker sti, som er standard i Lende.'
  ) + slakk
}

/**
 * Hvor mye av ruta gikk på ønsket underlag?
 *
 * Tallene er POST-HOC og sier noe annet enn vektene: vektene styrer hva
 * ruteren VELGER, dette forteller hva den faktisk fant. De to spriker når
 * geografien ikke har noe å tilby, og det er nettopp da brukeren skal få vite
 * det i stedet for å tro at kravet ble oppfylt.
 *
 * `bro`-kanter (hull-broing) telles som avvik: de er ikke kartlagt underlag i
 * det hele tatt.
 *
 * @param {Record<string, number>} meterPerKode  fra `meterPerKode()` i routing.js
 * @param {object} [pref]
 * @returns {{totalM:number, onsketM:number, avvikM:number, andel:number,
 *            oppfylt:boolean, tekst:string}}
 */
export function oppsummerUnderlag(meterPerKode, pref) {
  const p = normaliserRutePref(pref)
  const onsket = new Set(onskedeKoder(p))
  let totalM = 0
  let onsketM = 0
  for (const [kode, m] of Object.entries(meterPerKode ?? {})) {
    if (!Number.isFinite(m) || m <= 0) continue
    totalM += m
    if (onsket.has(kode)) onsketM += m
  }
  const andel = totalM > 0 ? onsketM / totalM : 0
  // Terskelen er lavere enn man skulle tro, og med vilje: et krav er oppfylt
  // når ruta i hovedsak ligger på ønsket underlag, ikke når den er ren.
  const oppfylt = andel >= (p.krav ? 0.75 : 0.5)
  const navn = p.underlag === UNDERLAG.VEG ? 'skogsveg/småveg' : 'sti'
  const pst = Math.round(andel * 100)
  return {
    totalM: Math.round(totalM),
    onsketM: Math.round(onsketM),
    avvikM: Math.round(totalM - onsketM),
    andel,
    oppfylt,
    tekst: totalM > 0
      ? `${pst} % av ruta går på ${navn}.`
      : `Ingen underlagsdata for ruta.`,
  }
}

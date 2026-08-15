// Automatisk påfyll av nabofliser — «kontinuerlig kart».
//
// Panorerer du jevnt i én retning og blir stående, hentes utsnittet du er på vei
// mot i bakgrunnen. Kartflaten står helt stille: ingen full-skjerm-loader, ingen
// navigasjon, ingen zoom-endring. Flisa glir inn i periferien når den er klar,
// og relieffet toner inn til slutt som kvittering (useGhostTiles).
//
// ── Hvorfor dette ikke er «auto-kart» på nytt ───────────────────────────────
// Funksjonen fantes en gang og ble fjernet. De to feilene den døde av er
// adressert eksplisitt:
//
//   • Den SLETTET forrige flis (router.replace + deleteMap), så det var umulig å
//     scrolle tilbake (tileCache.js). Her navigerer vi aldri og sletter aldri —
//     mosaikk-cachen er hele poenget.
//   • Hull-deteksjon på GEOMETRI bygde utsnitt ingen ba om, fordi form ikke kan
//     skille «avbrutt bygging» fra «diagonal panorering» (CHANGELOG v1.0.28,
//     v5.18.4/5). Triggeren her leser INTENSJON — retning og dvele — og aldri
//     form.
//
// Og det farligste punktet, som er verdt å lese før du rører avbrudds-stien:
// planen bokføres i `lende-ventende-fliser` FØR byggingen, så et avbrudd fra
// reload eller app-lukking er reparerbart. Men et avbrudd fordi BRUKEREN snudde
// er ikke et hull — det er et valg. Bokføres det, akkumulerer vanlig fram-og-
// tilbake-panorering falske oppføringer, «Fyll hullene» dukker opp med hull
// ingen laget, og appen begynner å bygge utsnitt ingen ba om. Det er presis
// v1.0.28-regresjonen via en annen vei. Derfor: fjernVentende() ved abort.
import { ref, reactive } from 'vue'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { pruneAutoTiles } from '../lib/tileCache.js'
import {
  nyIntensjon, oppdaterIntensjon, DVELE_MS,
} from '../lib/panIntensjon.js'
import { leggTilVentende, fjernVentende, cellenokkel } from '../lib/ventendeFliser.js'
import { AUTO_NABO_OKTTAK, oktTakNadd, okOkt, nullstillOkt } from '../lib/nettGjerde.js'
import {
  lesAutoNaboPa, skrivAutoNaboPa, lesFirkantPa, skrivFirkantPa,
} from '../lib/autoNaboValg.js'
import { EDGE_DIRS } from './useMapExtend.js'
import { logPerf } from '../lib/perfLog.js'

// Stopp-vakt for utfyllings-løkka. Den kaller firkantCeller() på nytt hver runde
// og stoler på at settet krymper; gjør det ikke det (en flis som bygges «ok» men
// aldri dukker opp i ghostRects), skal løkka dø av seg selv og ikke bygge i evig
// tid. Taket er romslig: et 3×3-ark mangler maks åtte fliser.
const FIRKANT_MAKS_RUNDER = 16

export function useAutoNabo({
  meta, mapId, isGesturing, isAlive,
  buildingOnTheFly, fillingInDetails,
  visibleCenterSvg, extendZonesBounds, extendMapGeometry,
  centerOverExistingTile, autoMapBuildOpts, autoMapModeBusy,
  leggTilSpokelse, maxTiles, refreshAutoTileCount, refreshMosaicGaps,
  firkantCeller = () => [],
}) {
  // Standardene bor i lib/autoNaboValg.js — se begrunnelsene der.
  const autoNaboPa = ref(lesAutoNaboPa())
  function settAutoNaboPa(v) {
    autoNaboPa.value = !!v
    skrivAutoNaboPa(autoNaboPa.value)
  }

  // «Gjør arket firkantet» som automatikk i stedet for banner. Betyr ingenting
  // når autoNaboPa er av: da er det kanthåndtakene som utvider, og de holder
  // arket rektangulært i seg selv.
  const firkantPa = ref(lesFirkantPa())
  function settFirkantPa(v) {
    firkantPa.value = !!v
    skrivFirkantPa(firkantPa.value)
  }

  const autoNaboStatus = reactive({
    retning: null,
    dragProsent: 0,
    byggerNokkel: null,
    bygdIOkt: 0,
    tak: AUTO_NABO_OKTTAK,
    sisteAvvisning: null,
    sisteFlis: null,
    // 'retning' = flisa du panorerte mot, 'firkant' = utfyllingen etterpå,
    // null = ingenting på gang. Chipen bruker den til å velge tekst og til å
    // skru AV retnings-blinket mens hele arket fylles ut.
    fase: null,
    // Hvor mange fliser som gjenstår av utfyllingen, inkludert den som bygges nå.
    firkantIgjen: 0,
  })

  let intensjon = nyIntensjon()
  let dveleTimer = null
  let byggerNaa = null          // cellenokkel-streng, eller null
  let avbryter = null           // AbortController for flisa under bygging

  const byggerNaaNokkel = () => byggerNaa

  function ryddDvele() {
    if (dveleTimer) { clearTimeout(dveleTimer); dveleTimer = null }
  }

  // Brukeren gjorde noe eksplisitt (trykket et kanthåndtak, åpnet et nytt kart,
  // fylte hull) — det er en handling som sier «ja, fortsett», så økt-taket
  // nullstilles.
  function kvitterEksplisittHandling() {
    nullstillOkt({})
    autoNaboStatus.bygdIOkt = 0
  }

  function avbrytBakgrunnsbygg(grunn = 'retningsskifte') {
    ryddDvele()
    if (!byggerNaa) return
    // Bokføringen skal IKKE overleve brukerens eget retningsvalg. Se notatet
    // øverst — dette er planens farligste linje.
    if (sisteSpek) fjernVentende(sisteSpek.utmBbox)
    try { avbryter?.abort() } catch { /* noop */ }
    avbryter = null
    byggerNaa = null
    sisteSpek = null
    autoNaboStatus.byggerNokkel = null
    autoNaboStatus.firkantIgjen = 0
    autoNaboStatus.sisteAvvisning = grunn
    refreshMosaicGaps?.()
  }

  let sisteSpek = null

  // Gatene, billigst først. Returnerer retningen som skal bygges, eller null.
  function modenRetning(oktant) {
    const dir = EDGE_DIRS[oktant]
    if (!dir) return null
    if (!autoNaboPa.value) { autoNaboStatus.sisteAvvisning = 'av'; return null }
    if (autoMapModeBusy()) { autoNaboStatus.sisteAvvisning = 'annet modus'; return null }
    if (buildingOnTheFly.value || fillingInDetails.value) { autoNaboStatus.sisteAvvisning = 'bygger alt'; return null }
    if (isGesturing?.value) { autoNaboStatus.sisteAvvisning = 'gest'; return null }
    if (byggerNaa) { autoNaboStatus.sisteAvvisning = 'opptatt'; return null }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      autoNaboStatus.sisteAvvisning = 'offline'; return null
    }
    if (oktTakNadd({ tak: AUTO_NABO_OKTTAK })) { autoNaboStatus.sisteAvvisning = 'økt-tak'; return null }
    const m = meta.value
    const c = visibleCenterSvg()
    if (!m || !c) return null
    // Er vi i det hele tatt på vei UT av arket i den retningen? Uten denne ville
    // et stort ark trigget bygging hver gang brukeren dro nordover MIDT inni det.
    const b = extendZonesBounds()
    const naerKant =
      (dir.includes('N') && c.y < b.minY + m.heightM / 2) ||
      (dir.includes('S') && c.y > b.maxY - m.heightM / 2) ||
      (dir.includes('W') && c.x < b.minX + m.widthM / 2) ||
      (dir.includes('E') && c.x > b.maxX - m.widthM / 2)
    if (!naerKant) { autoNaboStatus.sisteAvvisning = 'ikke ved kanten'; return null }
    return dir
  }

  // Én flis, aldri en rad. Kanthåndtakene er stedet for «bygg hele raden» — en
  // kardinal-retning på et 3×1-ark ville ellers kostet tre fliser brukeren ikke
  // har bedt om. Vi tar cellen nærmest synlig sentrum.
  function nesteFlis(dir) {
    const m = meta.value
    const geom = extendMapGeometry(dir)
    if (!geom) return null
    const c = visibleCenterSvg()
    const kandidater = geom.neighborCenters
      .map((center, i) => ({ center, utmBbox: geom.neighborBboxes[i] }))
      .filter(({ center }) => !centerOverExistingTile(center, m))
    if (!kandidater.length) return null
    kandidater.sort((a, b) =>
      Math.hypot(a.center.x - c.x, a.center.y - c.y) - Math.hypot(b.center.x - c.x, b.center.y - c.y))
    return kandidater[0]
  }

  // Bygger ÉN flis stille: ingen loader, ingen navigasjon, kartflaten står i ro.
  // Returnerer id-en, eller null hvis den ikke ble bygd (avbrutt eller feilet).
  // Delt av retnings-byggingen og utfyllingen — de skiller seg bare i HVILKEN
  // celle de ber om og hva chipen kaller det.
  async function byggStille(spek, fase) {
    const nokkel = cellenokkel(spek.utmBbox)
    byggerNaa = nokkel
    sisteSpek = spek
    avbryter = new AbortController()
    autoNaboStatus.byggerNokkel = nokkel
    autoNaboStatus.fase = fase
    autoNaboStatus.sisteAvvisning = null
    // Bokfør FØR byggingen: blir økta avbrutt av en reload eller app-lukking, er
    // dette det eneste sporet av hva som skulle bygges.
    leggTilVentende([spek])
    refreshMosaicGaps?.()
    const t0 = performance.now()
    try {
      const { id } = await buildMapFromCenter({
        ...spek.opts,
        utmBbox: spek.utmBbox,   // bit-eksakt gitter-flukt + hopper over tetthets-sonderingen
        terrainFirst: false,
        signal: avbryter.signal,
      })
      if (!isAlive() || !id) return null
      fjernVentende(spek.utmBbox)
      autoNaboStatus.bygdIOkt = okOkt({})   // telles først ved FULLFØRING
      autoNaboStatus.sisteFlis = id
      await leggTilSpokelse(id)
      logPerf(`[auto-nabo] ${fase} bygd på ${Math.round(performance.now() - t0)} ms`)
      // Kappingen sentreres på flisa vi nettopp bygde. autoMapBuildOpts har
      // allerede regnet senteret om til lat/lon, så det trengs ingen ny
      // projeksjon her — og utfyllings-cellene får den gratis på samme vis.
      const c = spek.opts?.center
      if (Number.isFinite(c?.lat) && Number.isFinite(c?.lon)) {
        pruneAutoTiles({
          center: { lat: c.lat, lon: c.lon },
          max: maxTiles.value,
          protectIds: [mapId.value, id],
        }).then(() => { void refreshAutoTileCount?.() }).catch(() => {})
      }
      return id
    } catch (e) {
      if (e?.name === 'AbortError') return null   // avbrytBakgrunnsbygg har alt ryddet
      console.warn('[auto-nabo] bygging feilet:', e?.message ?? e)
      fjernVentende(spek.utmBbox)
      autoNaboStatus.sisteAvvisning = 'byggefeil'
      return null
    } finally {
      if (byggerNaa === nokkel) {
        byggerNaa = null
        sisteSpek = null
        avbryter = null
        autoNaboStatus.byggerNokkel = null
      }
      refreshMosaicGaps?.()
    }
  }

  // Utfylling til firkant, som en FORTSETTELSE av bakgrunnsbyggingen: like
  // stille, samme gater, samme økt-tak. Her slutter «Gjør arket firkantet» å
  // være et banner og blir en innstilling.
  //
  // Merk at dette ikke er den automatikken v1.0.28 døde av. Den leste FORM og
  // bygde utsnitt ingen hadde bedt om. Denne henger på en bryter brukeren har
  // slått på, og fyrer bare i halen av en flis brukeren nettopp panorerte fram.
  //
  // Løkka regner ut cellene på nytt hver runde i stedet for å iterere over en
  // liste: hver ny flis endrer arkets omsluttende rektangel, så en liste tatt på
  // forhånd ville vært feil fra andre runde.
  async function fyllUtArket() {
    if (!firkantPa.value) return
    for (let runde = 0; runde < FIRKANT_MAKS_RUNDER; runde++) {
      if (!isAlive() || !autoNaboPa.value) break
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        autoNaboStatus.sisteAvvisning = 'offline'; break
      }
      if (oktTakNadd({ tak: AUTO_NABO_OKTTAK })) { autoNaboStatus.sisteAvvisning = 'økt-tak'; break }
      const celler = firkantCeller()
      if (!celler.length) break
      autoNaboStatus.firkantIgjen = celler.length
      if (!await byggStille(celler[0], 'firkant')) break
    }
    autoNaboStatus.firkantIgjen = 0
  }

  async function byggIBakgrunnen(dir) {
    const flis = nesteFlis(dir)
    if (!flis) { autoNaboStatus.sisteAvvisning = 'alt bygd'; return }
    autoNaboStatus.retning = dir
    const id = await byggStille({ opts: autoMapBuildOpts(flis.center), utmBbox: flis.utmBbox }, 'retning')
    if (id && isAlive()) await fyllUtArket()
  }

  // Kalles fra MapViews transform-watch. Billig: én prøve, ren aritmetikk.
  function sporPanIntensjon() {
    const m = meta.value
    const c = visibleCenterSvg()
    if (!m || !c) return
    const { neste, hendelse } = oppdaterIntensjon(
      intensjon,
      { x: c.x, y: c.y, t: Date.now() },
      { flisBreddeM: m.widthM, flisHoydeM: m.heightM },
    )
    intensjon = neste
    autoNaboStatus.retning = neste.oktant == null ? null : EDGE_DIRS[neste.oktant]
    autoNaboStatus.dragProsent = Math.round(100 * (neste.akkumulert ?? 0) / (m.widthM || 1))
    if (hendelse === 'retningsskifte') {
      avbrytBakgrunnsbygg('retningsskifte')
      return
    }
    // Vi handler på TILSTANDEN «moden», ikke på hendelsen.
    //
    // v5.19.0 gjorde det motsatte, og da kunne funksjonen aldri fyre: denne
    // funksjonen kalles fra transform-watchen, altså MENS fingeren er nede.
    // `moden`-hendelsen fyrer nøyaktig én gang (panIntensjon returnerer
    // 'moden' bare i overgangen), gaten avviste den på isGesturing — og når
    // fingeren slapp, endret ikke transformen seg mer, så watchen kjørte aldri
    // igjen. Hendelsen var brukt opp, og ingenting ble noen gang bygd.
    //
    // Nå restartes dvele-timeren ved HVER prøve så lenge intensjonen er moden.
    // Da fyrer den først når prøvene stopper — som er nøyaktig definisjonen av
    // «brukeren har stoppet». Gatene kjøres ved FYRING, ikke ved arming, så
    // isGesturing er falsk da.
    if (!neste.moden) return
    if (!autoNaboPa.value) { autoNaboStatus.sisteAvvisning = 'av'; return }
    ryddDvele()
    dveleTimer = setTimeout(() => {
      dveleTimer = null
      if (!isAlive()) return
      const dir = modenRetning(intensjon.oktant)
      if (dir) void byggIBakgrunnen(dir)
    }, DVELE_MS)
  }

  function teardownAutoNabo() {
    ryddDvele()
    try { avbryter?.abort() } catch { /* noop */ }
    avbryter = null
    byggerNaa = null
    sisteSpek = null
    autoNaboStatus.firkantIgjen = 0
  }

  return {
    autoNaboPa, settAutoNaboPa, firkantPa, settFirkantPa, autoNaboStatus,
    sporPanIntensjon, avbrytBakgrunnsbygg, byggerNaaNokkel,
    kvitterEksplisittHandling, teardownAutoNabo,
  }
}

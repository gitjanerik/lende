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
import { svgToWgs84 } from '../lib/utm.js'
import {
  nyIntensjon, oppdaterIntensjon, DVELE_MS,
} from '../lib/panIntensjon.js'
import { leggTilVentende, fjernVentende, cellenokkel } from '../lib/ventendeFliser.js'
import { AUTO_NABO_OKTTAK, oktTakNadd, okOkt, nullstillOkt } from '../lib/nettGjerde.js'
import { EDGE_DIRS } from './useMapExtend.js'
import { logPerf } from '../lib/perfLog.js'

const PA_KEY = 'lende-auto-nabo'

function lesPa() {
  try { return localStorage.getItem(PA_KEY) !== '0' } catch { return true }
}

export function useAutoNabo({
  meta, mapId, isGesturing, isAlive,
  buildingOnTheFly, fillingInDetails,
  visibleCenterSvg, extendZonesBounds, extendMapGeometry,
  centerOverExistingTile, autoMapBuildOpts, autoMapModeBusy,
  leggTilSpokelse, maxTiles, refreshAutoTileCount, refreshMosaicGaps,
}) {
  // Default PÅ. Funksjonen er ikke-blokkerende, kartflaten står stille, og
  // økt-taket er gjerdet — og en opt-in-bryter ville aldri blitt slått på nok
  // til at vi fikk måletall å justere tersklene etter.
  const autoNaboPa = ref(lesPa())
  function settAutoNaboPa(v) {
    autoNaboPa.value = !!v
    try { localStorage.setItem(PA_KEY, v ? '1' : '0') } catch { /* privat modus */ }
  }

  const autoNaboStatus = reactive({
    retning: null,
    dragProsent: 0,
    byggerNokkel: null,
    bygdIOkt: 0,
    tak: AUTO_NABO_OKTTAK,
    sisteAvvisning: null,
    sisteFlis: null,
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

  async function byggIBakgrunnen(dir) {
    const m = meta.value
    const flis = nesteFlis(dir)
    if (!flis) { autoNaboStatus.sisteAvvisning = 'alt bygd'; return }
    const nokkel = cellenokkel(flis.utmBbox)
    const spek = { opts: autoMapBuildOpts(flis.center), utmBbox: flis.utmBbox }
    byggerNaa = nokkel
    sisteSpek = spek
    avbryter = new AbortController()
    autoNaboStatus.byggerNokkel = nokkel
    autoNaboStatus.retning = dir
    autoNaboStatus.sisteAvvisning = null
    // Bokfør FØR byggingen: blir økta avbrutt av en reload eller app-lukking, er
    // dette det eneste sporet av hva som skulle bygges.
    leggTilVentende([spek])
    refreshMosaicGaps?.()
    const t0 = performance.now()
    try {
      const { id } = await buildMapFromCenter({
        ...spek.opts,
        utmBbox: flis.utmBbox,   // bit-eksakt gitter-flukt + hopper over tetthets-sonderingen
        terrainFirst: false,
        signal: avbryter.signal,
      })
      if (!isAlive()) return
      if (id) {
        fjernVentende(flis.utmBbox)
        autoNaboStatus.bygdIOkt = okOkt({})   // telles først ved FULLFØRING
        autoNaboStatus.sisteFlis = id
        await leggTilSpokelse(id)
        logPerf(`[auto-nabo] ${dir} bygd på ${Math.round(performance.now() - t0)} ms`)
        try {
          const ll = svgToWgs84(flis.center.x, flis.center.y, m)
          pruneAutoTiles({
            center: { lat: ll.lat, lon: ll.lon },
            max: maxTiles.value,
            protectIds: [mapId.value, id],
          }).then(() => { void refreshAutoTileCount?.() }).catch(() => {})
        } catch { /* svgToWgs84 feilet → hopp over pruning */ }
      }
    } catch (e) {
      if (e?.name === 'AbortError') return   // avbrytBakgrunnsbygg har alt ryddet
      console.warn('[auto-nabo] bygging feilet:', e?.message ?? e)
      fjernVentende(flis.utmBbox)
      autoNaboStatus.sisteAvvisning = 'byggefeil'
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
  }

  return {
    autoNaboPa, settAutoNaboPa, autoNaboStatus,
    sporPanIntensjon, avbrytBakgrunnsbygg, byggerNaaNokkel,
    kvitterEksplisittHandling, teardownAutoNabo,
  }
}

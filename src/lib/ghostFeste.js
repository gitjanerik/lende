// ghostFeste.js — hvilke nabofliser skal være FESTET i DOM akkurat nå?
//
// Mosaikken kan ha langt flere nabofliser enn skjermen viser, og hver festet
// flis er tusenvis av SVG-noder nettleseren må ta med i layout og paint. Så vi
// fester bare de som er i nærheten av utsnittet. Problemet med én enkelt grense
// er at en flis som ligger akkurat på den, festes og løsnes for hver eneste
// pan-frame — nodene rives ned og bygges opp igjen, og panoreringen hakker
// nøyaktig der brukeren er mest oppmerksom.
//
// Derfor to rektangler: ett smalt der en flis FESTES, og ett romsligere der den
// får LOV til å bli hengende. Mellom dem er det ingenting som skjer — flisa blir
// stående til den er tydelig ute. Policyen er ren aritmetikk her, uten DOM, så
// hysteresen kan testes uten en nettleser.

/** Utvid et rektangel like mye i alle fire retninger (dx vannrett, dy loddrett). */
export function utvidRekt(rekt, dx, dy = dx) {
  if (!rekt) return null
  return {
    minX: rekt.minX - dx,
    minY: rekt.minY - dy,
    maxX: rekt.maxX + dx,
    maxY: rekt.maxY + dy,
  }
}

// Berøring teller som skjæring: en flis som ligger kant-i-kant med grensa er
// synlig i det pikselet, og «nesten innenfor» er ikke et nyttig skille her.
function skjaerer(a, b) {
  return !!a && !!b &&
    a.minX <= b.maxX && a.maxX >= b.minX &&
    a.minY <= b.maxY && a.maxY >= b.minY
}

const somRekt = (t) => ({ minX: t.x, minY: t.y, maxX: t.x + t.w, maxY: t.y + t.h })

/**
 * @param {Array<{id:string, x:number, y:number, w:number, h:number}>} modell
 *        naboflisene i aktiv flis' meter-rom
 * @param {{festeRekt:object, losneRekt?:object, forrigeFestede?:Set<string>}} opts
 *        festeRekt = der en flis festes; losneRekt = der den får bli hengende
 *        (typisk utvidRekt(festeRekt, …)). Uten losneRekt er det ingen hysterese.
 * @returns {{fest:string[], losne:string[], festede:Set<string>}}
 *        `fest`/`losne` er DIFFEN konsumenten skal utføre; `festede` er hele
 *        tilstanden etterpå og sendes tilbake som forrigeFestede neste gang.
 */
export function velgFestede(modell, { festeRekt, losneRekt, forrigeFestede } = {}) {
  const forrige = forrigeFestede instanceof Set ? forrigeFestede : new Set(forrigeFestede ?? [])
  const festede = new Set()
  const fest = []
  const losne = []
  const sett = new Set()

  for (const t of (modell ?? [])) {
    if (!t?.id) continue
    sett.add(t.id)
    const r = somRekt(t)
    const varFestet = forrige.has(t.id)
    if (skjaerer(r, festeRekt)) {
      festede.add(t.id)
      if (!varFestet) fest.push(t.id)
    } else if (varFestet && skjaerer(r, losneRekt)) {
      // Mellom de to rektanglene: hverken ny eller ute. Blir stående.
      festede.add(t.id)
    } else if (varFestet) {
      losne.push(t.id)
    }
  }
  // Fliser som har forsvunnet HELT ut av modellen (mosaikken er tegnet på nytt,
  // cachen kappet) kan ikke bli hengende — de finnes ikke lenger å holde på.
  for (const id of forrige) if (!sett.has(id)) losne.push(id)

  return { fest, losne, festede }
}

/**
 * Hvilke MODELL-fliser mangler en parset node innenfor feste-rektangelet?
 *
 * Dette er halvdelen feste-passet ikke hadde: det festet bare fliser som ALT
 * hadde node, så en flis modellen kjente men som aldri ble parset var usynlig
 * for alltid — panorerte man dit, sto cellen tom, og «Fyll hull» så ingenting
 * å fylle fordi modellen var komplett. Ark på 16–36 fliser kunne derfor aldri
 * tegne mer enn de tolv naboene som tilfeldigvis lå nærmest AKTIV flis.
 *
 * Nærmest utsnittets senter først: det er den cellen brukeren ser på, og
 * parsingen er dyr nok til at rekkefølgen er merkbar.
 *
 * @param {Array<{id:string,x:number,y:number,w:number,h:number}>} modell
 * @param {{festeRekt:object, harNode:(id:string)=>boolean, senter?:{x:number,y:number}, ledige?:number}} opts
 * @returns {string[]} id-er å parse, nærmest først
 */
export function manglendeNoder(modell, { festeRekt, harNode, senter, ledige = Infinity } = {}) {
  if (!festeRekt || typeof harNode !== 'function' || !(ledige > 0)) return []
  const c = senter ?? { x: (festeRekt.minX + festeRekt.maxX) / 2, y: (festeRekt.minY + festeRekt.maxY) / 2 }
  return (modell ?? [])
    .filter(t => t?.id && !harNode(t.id) && skjaerer(somRekt(t), festeRekt))
    .map(t => ({ id: t.id, d: Math.hypot(t.x + t.w / 2 - c.x, t.y + t.h / 2 - c.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, ledige === Infinity ? undefined : ledige)
    .map(t => t.id)
}

/**
 * Hvilken parset node skal slippes når node-taket er nådd?
 *
 * Fjernest fra UTSNITTET, ikke fra flisa som nettopp kom inn: taket ble før
 * målt fra den nye flisa, så en flis brukeren så på kunne ryke for en nabo
 * utenfor skjermen. Fliser som ikke er festet ryker først — de er ikke i DOM,
 * og å slippe dem koster ingenting synlig.
 *
 * @param {Iterable<string>} nodeIds       parsede noder nå
 * @param {{modell:Array, festede?:Set<string>, senter?:{x:number,y:number}, beskyttId?:string}} opts
 * @returns {string|null}
 */
export function fjernesteNode(nodeIds, { modell, festede, senter, beskyttId } = {}) {
  const kandidater = [...(nodeIds ?? [])].filter(id => id !== beskyttId)
  if (!kandidater.length) return null
  const rekt = new Map((modell ?? []).filter(r => r?.id).map(r => [r.id, r]))
  const erFestet = (id) => !!(festede && festede.has ? festede.has(id) : false)
  const avstand = (id) => {
    const r = rekt.get(id)
    if (!r || !senter) return Infinity
    return Math.hypot(r.x + r.w / 2 - senter.x, r.y + r.h / 2 - senter.y)
  }
  kandidater.sort((a, b) => (erFestet(a) - erFestet(b)) || (avstand(b) - avstand(a)))
  return kandidater[0]
}

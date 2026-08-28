// Månen og planetene som roterbare glober — med ekte terminator og navngitte
// steder på overflata.
//
// ÉN MODUL, EN TABELL PER LEGEME (`HIMMELLEGEMER`). Månen kom først (v6.0.0) og
// hadde sin egen fil; da Mars, Jupiter og Saturn skulle ha det samme, var
// spørsmålet CLAUDE.md tvinger fram: er den nye varianten egentlig en OPSJON på
// originalen? Den er det. Fire filer med hver sin nesten like kule er nøyaktig
// den gjelden som lot to 3D-scener leve side om side i månedsvis.
//
// HVA DEN ER, OG HVA DEN IKKE ER. Den er en OBJEKT-INSPEKTØR: du står fortsatt
// på kartet ditt, månen står fortsatt i sin virkelige himmelretning, og
// skyggelinja er der den faktisk er i kveld. Du får bare snurre kula for å se
// hva som er hvor. Den er IKKE en ny verden man reiser til — det ble vurdert og
// forkastet, fordi det bryter invarianten som gjør 3D-visningen til å stole på
// («alt du ser står der det faktisk står, sett fra din posisjon») og fordi det
// ville krevd et andre kamera-regime, som er den største gjelden CLAUDE.md
// advarer mot.
//
// TERMINATOREN ER EKTE LYS, IKKE EN SHADER-TRIKS. Kula er MeshStandardMaterial
// med et DirectionalLight fra solas virkelige retning. Det gir skyggelinja
// gratis og riktig, i motsetning til skive-shaderen (buildHimmelSkive), som
// tegner en ellipse fordi en skive ikke KAN skygges av et lys. Skiva er
// fortsatt riktig valg for månen på himmelen — den er 1,6° og skal koste
// ingenting. Globen er det man får når man trykker på den.
//
// FRI ROTASJON VISER BAKSIDEN, og det er verdt å si til brukeren: baksida er
// ekte kartdata fra LRO, men den er aldri synlig fra jorda. Infopanelet sier
// det; her står det som en påminnelse til neste leser.
//
// TEKSTUREN ER VALGFRI. NASA og USGS er sperret fra utviklingsmiljøene, så den
// hentes av scripts/bygg-himmelkart.mjs i CI. Uten den tegnes kula i legemets
// egenfarge med samme lys og samme navn — og gassplanetene får bånd tegnet på
// klienten (bandTekstur), så de er gjenkjennelige uansett. En funksjon som
// krever en fil som kanskje ikke er der, skal virke uten den.

import {
  Group, Mesh, SphereGeometry, MeshStandardMaterial, DirectionalLight,
  AmbientLight, TextureLoader, SRGBColorSpace, Vector3, Color,
  RingGeometry, ShaderMaterial, DoubleSide,
  CanvasTexture, RepeatWrapping, ClampToEdgeWrapping,
} from 'three'
import { HIMMELLEGEMER } from './himmellegemer.js'

const GRAD = Math.PI / 180

/**
 * Selenografisk lat/lon → punkt på enhetskula, i globens EGET koordinatsystem.
 *
 * Orienteringen er valgt slik at (0, 0) — under-jord-punktet — peker mot +Z, og
 * gruppa vendes mot kameraet (`vendMot`), så +Z ER mot kameraet. Nord er +Y og
 * selenografisk øst er +X, som er høyre på skjermen — samme stilling som Mare
 * Crisium står i når man ser opp. Da ser man forsida først, slik man gjør fra
 * bakken.
 */
export function selenografiskTilPunkt(latGrader, lonGrader) {
  const la = latGrader * GRAD
  const lo = lonGrader * GRAD
  return [
    Math.cos(la) * Math.sin(lo),
    Math.sin(la),
    Math.cos(la) * Math.cos(lo),
  ]
}

/**
 * Månegloben.
 *
 * @param {{legeme?: string, radius?: number, teksturUrl?: string|null,
 *          onTekstur?: (ok: boolean) => void}} [opts]
 *   legeme      nøkkel i HIMMELLEGEMER: 'mane' | 'mars' | 'jupiter' | 'saturn'
 *   teksturUrl  albedo-kart (equirektangulært, sentrert på lengdegrad 0).
 *               null = ingen tekstur, og kula tegnes i legemets egenfarge.
 */
/**
 * Båndtekstur for en gassplanet, tegnet lokalt.
 *
 * HVORFOR: teksturene fra NASA bakes i CI, og lokalt (og om en URL skulle råtne)
 * finnes de ikke. En gassplanet uten bånd er en beige kule som ikke er til å
 * kjenne igjen — mens et par striper gjør Jupiter til Jupiter. Fotografiet
 * overstyrer denne straks det er lastet.
 *
 * Bredden er 4 px: båndene er rene breddegrads-striper, så det finnes ingenting
 * å variere langs lengdegraden. Høyden bærer detaljen.
 *
 * Returnerer null der det ikke finnes et lerret (node, test) — kaller tåler det.
 */
function bandTekstur(band) {
  if (!band?.length || typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createLinearGradient(0, 0, 0, c.height)
  for (const [stopp, farge] of band) grad.addColorStop(stopp, farge)
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  // Gjentas rundt planeten; klemmes i høyden så polene ikke folder.
  t.wrapS = RepeatWrapping
  t.wrapT = ClampToEdgeWrapping
  return t
}

export function buildHimmelGlobe({
  legeme = 'mane', radius = 1, teksturUrl = null, onTekstur = null,
} = {}) {
  const spec = HIMMELLEGEMER[legeme] ?? HIMMELLEGEMER.mane
  const group = new Group()
  group.visible = false

  // 48×32 segmenter: silhuetten er glatt på en telefonskjerm, og en kule er
  // billig. Terrenget rundt bruker 512² — dette er ingenting.
  const geometry = new SphereGeometry(radius, 48, 32)
  const material = new MeshStandardMaterial({
    color: new Color(spec.farge),
    roughness: 1,
    metalness: 0,
    // Månen er ikke i atmosfæren. Scenen har dis for å gi dybde til terrenget,
    // og uten dette ville kula druknet i den samme grå tonen som fjellene
    // 4 km unna — den henger jo et fast stykke foran kameraet.
    fog: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  // Båndene legges på FØR fotografiet forsøkes: da er kula gjenkjennelig fra
  // første frame, og et fotografi som kommer senere bare gjør den bedre.
  const bandTekstur0 = bandTekstur(spec.band)
  if (bandTekstur0) {
    material.map = bandTekstur0
    material.color.set('#ffffff')
  }

  // Lyset. Retningen settes fra solas virkelige posisjon, så skyggelinja er der
  // den faktisk er. Ambient er lav og ikke null: en helt svart nattside gjør
  // kula til en sigd som svever, og man mister følelsen av at det er en kule.
  const sol = new DirectionalLight(0xfff6e6, 3.1)
  sol.position.set(1, 0, 0)
  // MÅLET MÅ VÆRE KULA, ikke standard-målet. Et DirectionalLight lyser fra sin
  // posisjon mot `target`, som som default er et objekt i verdens ORIGO — og
  // gruppa her står 4 km foran kameraet, altså langt fra origo. Uten dette
  // ville lyset pekt mot midten av kartet og fasen blitt tilfeldig.
  sol.target = mesh
  group.add(sol)
  const fyll = new AmbientLight(0xffffff, spec.ambient ?? 0.055)
  group.add(fyll)

  // AKSEHELLINGEN legges på MESHET og ikke på gruppa: gruppa eies av vendMot og
  // rullen, og en helling der ville blitt overskrevet hver frame. På meshet blir
  // den en fast del av legemets egen orientering, som er hva den er.
  const helling = (spec.akseHelling ?? 0) * GRAD

  // SATURNS RINGER. Ikke valgfritt — en Saturn uten ringer er en blek Jupiter.
  // Ett flatt annulus i planetens ekvatorplan, med Cassini-delingen som et hull
  // i opasiteten. Teksturløst med vilje: ringene er nesten hvite, og en
  // radiell gradient i shaderen er både lettere og skarpere enn en 4k-strimmel.
  let ringMesh = null
  if (spec.ringer) {
    const { indre, ytre, deling } = spec.ringer
    const ringGeo = new RingGeometry(radius * indre, radius * ytre, 96, 1)
    const ringMat = new ShaderMaterial({
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uIndre: { value: indre },
        uYtre: { value: ytre },
        uDeling: { value: deling },
        uFarge: { value: new Color('#e8ddc4') },
      },
      vertexShader: `
        varying vec3 vLokal;
        void main() {
          vLokal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uIndre;
        uniform float uYtre;
        uniform float uDeling;
        uniform vec3 uFarge;
        varying vec3 vLokal;
        void main() {
          // Avstand fra sentrum i PLANETRADIER. RingGeometry legger uv-en langs
          // ringen, ikke radielt, så vi regner den ut selv.
          float rr = length(vLokal.xy);
          float t = (rr - uIndre) / max(0.0001, uYtre - uIndre);
          // Cassini-delingen: et mørkt gap. Det er det ENE trekket ved ringene
          // som er synlig i en liten kikkert, og derfor det som gjør dem ekte.
          float gap = smoothstep(0.0, 0.035, abs(rr - uDeling));
          // Innerst tynn, tettest på midten, tynn ut mot A-ringens kant.
          float tetthet = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.72, 1.0, t));
          gl_FragColor = vec4(uFarge, tetthet * gap * 0.85);
        }
      `,
    })
    ringMesh = new Mesh(ringGeo, ringMat)
    // RingGeometry ligger i xy-planet; planetens ekvator er xz. Derfor −90°.
    ringMesh.rotation.x = -Math.PI / 2
    ringMesh.frustumCulled = false
  }

  // Holderen bærer aksehellingen og samler kule + ringer, så de skjevstiller seg
  // sammen. Brukerens dreining går på MESHET inne i holderen — da spinner
  // planeten om sin egen akse, ikke om en akse som står rett opp.
  const holder = new Group()
  holder.rotation.z = helling
  holder.add(mesh)
  if (ringMesh) holder.add(ringMesh)
  group.add(holder)

  let teksturObjekt = null
  if (teksturUrl) {
    // Lastes lazily og feiler MYKT: uten fotografiet er kula fortsatt en måne.
    new TextureLoader().load(
      teksturUrl,
      (t) => {
        t.colorSpace = SRGBColorSpace
        teksturObjekt = t
        material.map = t
        // Hvit så fotografiet får bære fargen selv. Uten dette ganges bildet med
        // egenfargen, og Mars blir rustrød to ganger.
        material.color.set('#ffffff')
        material.needsUpdate = true
        try { onTekstur?.(true) } catch { /* UI-feil skal ikke stoppe globen */ }
      },
      undefined,
      () => { try { onTekstur?.(false) } catch { /* samme */ } },
    )
  }

  const _v = new Vector3()
  let rull = 0

  return {
    group,
    mesh,
    legeme,
    navn: spec.navn,
    geometries: ringMesh ? [geometry, ringMesh.geometry] : [geometry],
    materials: ringMesh ? [material, ringMesh.material] : [material],
    get harTekstur() { return !!teksturObjekt },
    get harRinger() { return !!ringMesh },

    /**
     * Sett lysretningen fra solas posisjon RELATIVT TIL MÅNEN.
     *
     * Vi har fasevinkelen (sol–måne–jord) fra astronomi.maneFase. Ved fullmåne
     * står sola bak oss (fasevinkel 0) og lyser rett på forsida; ved nymåne står
     * den bak månen (180°). Så lysretningen ligger i planet gjennom
     * jord–måne–sol, dreid `faseVinkel` av fra retningen mot kameraet.
     *
     * `lyssideVinkel` sier hvilken VEI i det planet — samme tall skiva bruker,
     * målt mot klokka fra «opp» på skjermen.
     *
     * @param {number} faseVinkel radianer, 0 = full, π = ny
     * @param {number} lyssideVinkel radianer
     */
    settFase(faseVinkel, lyssideVinkel) {
      const f = Number.isFinite(faseVinkel) ? faseVinkel : 0
      const v = Number.isFinite(lyssideVinkel) ? lyssideVinkel : 0
      // Retningen TIL sola, i globens koordinatsystem: +Z er mot kameraet.
      // Dreies `f` bort fra +Z, i retningen `v` (mot klokka fra +Y).
      const s = Math.sin(f)
      sol.position.set(-s * Math.sin(v), s * Math.cos(v), Math.cos(f))
    },

    /**
     * Vend kula mot kameraet, og RULL den så månens nordpol står der himmelens
     * nordpol faktisk står.
     *
     * HVORFOR DETTE MÅ KALLES HVER FRAME, og hvorfor det er en egen metode:
     * gruppa henger et fast stykke foran kameraet, men uten en orientering
     * peker forsida (+Z) mot verdens +Z — som i denne scenen er SØR. Da ville
     * man sett månens bakside når månen sto i nord. `lookAt` gjør +Z mot
     * kameraet, og velger samtidig lokal +Y så nær verdens opp som mulig, altså
     * skjermens opp. Rullen er den parallaktiske vinkelen med motsatt fortegn:
     * en stjerne i himmelens nord står `−q` mot klokka fra zenit på skjermen.
     *
     * @param {import('three').Vector3} kameraPos
     */
    vendMot(kameraPos) {
      group.lookAt(kameraPos)
      // Etter lookAt, ikke før: lookAt skriver hele kvaternionen på nytt.
      group.rotateZ(rull)
    },
    /** Rullen i radianer. Settes fra den parallaktiske vinkelen. */
    settRull(v) { rull = Number.isFinite(v) ? v : 0 },

    /**
     * Uniform skala, som brukes til å la kula VOKSE fram fra skiva den var.
     * Gruppa og ikke meshet: da følger labelene med av seg selv, siden de
     * regnes gjennom `group.matrixWorld`.
     */
    settSkala(s) { group.scale.setScalar(Math.max(1e-3, s)) },
    get skala() { return group.scale.x },

    /**
     * Rotasjonen brukeren har dratt inn. Egen metode og ikke direkte tilgang til
     * mesh.rotation, fordi breddegrads-rotasjonen må klemmes: får man snurre
     * forbi polene, står månen på hodet og ingen finner tilbake.
     *
     * @param {number} lengde radianer om Y (fri, går rundt)
     * @param {number} bredde radianer om X (klemt til ±80°)
     */
    settRotasjon(lengde, bredde) {
      mesh.rotation.y = lengde
      mesh.rotation.x = Math.max(-80 * GRAD, Math.min(80 * GRAD, bredde))
    },
    get rotasjon() { return { lengde: mesh.rotation.y, bredde: mesh.rotation.x } },

    /**
     * Hvilke navngitte trekk som er synlige nå (på den halvkula som vender mot
     * kameraet), med WORLD-POSISJON.
     *
     * Vi returnerer verdenskoordinater og ikke skjermkoordinater: viseren har
     * `project()` og vet hvor lerretet er, og modulen skal ikke kjenne DOM-en.
     *
     * Synlighetstesten gjøres FØR gruppas orientering, i gruppas eget rom, der
     * +Z er mot kameraet (se vendMot). Etterpå er punktet en verdensposisjon, og
     * da finnes det ingen «mot kameraet»-akse å teste mot uten kameraet.
     */
    synligeTrekk() {
      const ut = []
      group.updateMatrixWorld(true)
      // Hellingen ligger på holderen mellom gruppa og meshet, så punktet må
      // gjennom BÅDE meshets egen dreining og holderens. Bruker vi bare
      // mesh.quaternion, står trekkene rett opp mens kula står skjevt.
      holder.updateMatrixWorld(true)
      for (const t of (spec.trekk ?? [])) {
        const [x, y, z] = selenografiskTilPunkt(t.lat, t.lon)
        _v.set(x, y, z).applyQuaternion(mesh.quaternion).applyQuaternion(holder.quaternion)
        // Punkter med z ≤ 0.18 er på baksida eller så nær kanten at en label
        // ville ligget oppå silhuetten.
        if (_v.z <= 0.18) continue
        // Litt utenfor overflata: labelen skal ikke ligge inne i kula.
        _v.multiplyScalar(radius * 1.02).applyMatrix4(group.matrixWorld)
        ut.push({
          ...t,
          verden: [_v.x, _v.y, _v.z],
        })
      }
      return ut
    },

    setVisible(v) { group.visible = !!v },

    dispose() {
      geometry.dispose()
      material.dispose()
      ringMesh?.geometry.dispose()
      ringMesh?.material.dispose()
      teksturObjekt?.dispose()
      bandTekstur0?.dispose()
    },
  }
}

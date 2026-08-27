// Månen som en roterbar globe — med ekte terminator og navngitte hav.
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
// TEKSTUREN ER VALGFRI. NASA og USGS er sperret fra utviklingsmiljøet, så den
// hentes av scripts/bygg-maanekart.mjs i CI. Uten den tegnes kula i månegrå med
// samme lys og samme navn — gjenkjennelig, bare uten fotografiet. En funksjon
// som krever en fil som kanskje ikke er der, skal virke uten den.

import {
  Group, Mesh, SphereGeometry, MeshStandardMaterial, DirectionalLight,
  AmbientLight, TextureLoader, SRGBColorSpace, Vector3, Color,
} from 'three'

const GRAD = Math.PI / 180

/**
 * Navngitte trekk på månens forside, med selenografiske koordinater
 * (breddegrad, lengdegrad — øst positiv). Utvalget er det man SER med bare øyet
 * eller en enkel kikkert; en liste over alle 9 000 navngitte krater ville vært
 * en database, ikke en opplevelse.
 *
 * Koordinatene er avrundet til hele grader. Presisjonen er rikelig: en label på
 * en kule tegnet 30° bred flytter seg noen piksler av én grad.
 */
export const MANE_TREKK = [
  { navn: 'Mare Imbrium', norsk: 'Regnhavet', lat: 33, lon: -16, type: 'hav' },
  { navn: 'Mare Serenitatis', norsk: 'Klarhetshavet', lat: 28, lon: 18, type: 'hav' },
  { navn: 'Mare Tranquillitatis', norsk: 'Stillhetens hav', lat: 9, lon: 31, type: 'hav',
    merk: 'Apollo 11 landet her i 1969.' },
  { navn: 'Mare Crisium', norsk: 'Krisehavet', lat: 17, lon: 59, type: 'hav' },
  { navn: 'Oceanus Procellarum', norsk: 'Stormhavet', lat: 19, lon: -57, type: 'hav',
    merk: 'Det største av alle — en tredjedel av forsidas mørke flater.' },
  { navn: 'Mare Nubium', norsk: 'Skyhavet', lat: -21, lon: -17, type: 'hav' },
  { navn: 'Mare Frigoris', norsk: 'Kuldehavet', lat: 56, lon: -1, type: 'hav' },
  { navn: 'Tycho', norsk: null, lat: -43, lon: -11, type: 'krater',
    merk: 'Det lyse krateret nede på skiva, med stråler av utkastet materiale '
      + 'som når en fjerdedel rundt månen. Lett å se med bare øyet ved fullmåne.' },
  { navn: 'Copernicus', norsk: null, lat: 10, lon: -20, type: 'krater',
    merk: '93 km bredt, med terrasserte vegger og fjell i midten.' },
  { navn: 'Kepler', norsk: null, lat: 8, lon: -38, type: 'krater' },
  { navn: 'Plato', norsk: null, lat: 51, lon: -9, type: 'krater' },
  { navn: 'Grimaldi', norsk: null, lat: -6, lon: -68, type: 'krater' },
]

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
 * @param {{radius?: number, teksturUrl?: string|null,
 *          onTekstur?: (ok: boolean) => void}} [opts]
 *   teksturUrl  albedo-kart (equirektangulært, forsida sentrert på lon 0).
 *               null = ingen tekstur, og kula tegnes i månegrå.
 */
export function buildManeGlobe({ radius = 1, teksturUrl = null, onTekstur = null } = {}) {
  const group = new Group()
  group.visible = false

  // 48×32 segmenter: silhuetten er glatt på en telefonskjerm, og en kule er
  // billig. Terrenget rundt bruker 512² — dette er ingenting.
  const geometry = new SphereGeometry(radius, 48, 32)
  const material = new MeshStandardMaterial({
    color: new Color('#d8d4cc'),
    roughness: 1,
    metalness: 0,
    // Månen er ikke i atmosfæren. Scenen har dis for å gi dybde til terrenget,
    // og uten dette ville kula druknet i den samme grå tonen som fjellene
    // 4 km unna — den henger jo et fast stykke foran kameraet.
    fog: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  group.add(mesh)

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
  const fyll = new AmbientLight(0xffffff, 0.055)
  group.add(fyll)

  let teksturObjekt = null
  if (teksturUrl) {
    // Lastes lazily og feiler MYKT: uten fotografiet er kula fortsatt en måne.
    new TextureLoader().load(
      teksturUrl,
      (t) => {
        t.colorSpace = SRGBColorSpace
        teksturObjekt = t
        material.map = t
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
    geometries: [geometry],
    materials: [material],
    get harTekstur() { return !!teksturObjekt },

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
      for (const t of MANE_TREKK) {
        const [x, y, z] = selenografiskTilPunkt(t.lat, t.lon)
        _v.set(x, y, z).applyQuaternion(mesh.quaternion)
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
      teksturObjekt?.dispose()
    },
  }
}

// Skyskygger på terrenget.
//
// Terrenget bruker MeshBasicMaterial med den bakte karttekstur — det finnes
// ingen lyssetting å modulere, og ingen skyggekart-pass. Løsningen er derfor
// ANALYTISK: hver skys senter og radius sendes inn som uniformer, og
// fragment-shaderen regner ut om punktet ligger i skyggen av noen av dem.
//
// Projeksjonen: for et terrengpunkt P går vi OPP mot sola til vi er i skyhøyden,
// og ser om vi da er innenfor skyas radius:
//
//   t          = (skyY − P.y) / sol.y
//   treffpunkt = P.xz + sol.xz · t
//   i skygge   ⇔ |treffpunkt − sky.xz| < radius
//
// Sol-retningen MÅ være den samme som relieffet er bakt med (azimuth 315°,
// elevasjon 45° — se hillshade.js), ellers kaster skyene skygge fra en annen
// side enn fjellene gjør, og hjernen ser det med én gang.
//
// Kostnaden er MAKS_SKYER iterasjoner per fragment, uten kvadratrot (vi
// sammenlikner kvadrerte avstander). 3D har ingen adaptiv nedtrapping, så taket
// er lavt med vilje.

import { Vector3 } from 'three'

/** Hvor mange skyer som kan kaste skygge samtidig. Resten ignoreres. */
export const MAKS_SKYER = 14

/**
 * Bygg skygge-tilbehøret til terrengmaterialet.
 *
 * Returnerer uniformene og en `oppdater(skyer, sol)` som skrives hver frame.
 * `festTil(material)` hekter shader-koden på via onBeforeCompile.
 */
export function lagSkyskygge({ styrke = 0.30 } = {}) {
  // xz = senter, w = radius. y i egen uniform (skyhøyde er felles nok).
  const senter = new Float32Array(MAKS_SKYER * 3)   // x, z, radius
  const uniforms = {
    uSkySenter: { value: senter },
    uSkyAntall: { value: 0 },
    uSkyHoyde: { value: 1500 },
    uSolRetning: { value: new Vector3(-0.5, 0.707, -0.5).normalize() },
    uSkyggeStyrke: { value: styrke },
  }

  return {
    uniforms,
    /**
     * @param {Array<{position: Vector3, userData: object}>} skyer  mesh-ene fra buildPuffClouds
     * @param {number} radius  skyggeradius i meter (skyenes bredde)
     * @param {Vector3} sol    retning MOT sola, normalisert
     */
    oppdater(skyer, radius, sol) {
      let n = 0
      let hoyde = 0
      for (const s of skyer) {
        if (n >= MAKS_SKYER) break
        if (!s.visible) continue          // klarvær skal ikke kaste skygge
        senter[n * 3] = s.position.x
        senter[n * 3 + 1] = s.position.z
        senter[n * 3 + 2] = s.userData.skyggeRadius ?? radius
        hoyde += s.position.y
        n++
      }
      uniforms.uSkyAntall.value = n
      if (n) uniforms.uSkyHoyde.value = hoyde / n
      if (sol) uniforms.uSolRetning.value.copy(sol)
    },
    /** Hekt skyggen på et MeshBasicMaterial. */
    festTil(material) {
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms)
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
            varying vec3 vVerden;`)
          .replace('#include <project_vertex>', `#include <project_vertex>
            vVerden = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vVerden;
            uniform vec3 uSkySenter[${MAKS_SKYER}];
            uniform int uSkyAntall;
            uniform float uSkyHoyde;
            uniform vec3 uSolRetning;
            uniform float uSkyggeStyrke;`)
          // Legges HELT til slutt, etter at kartfargen er ferdig satt sammen.
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            {
              // Gå opp mot sola til skyhøyden, og se om vi treffer en sky.
              float t = (uSkyHoyde - vVerden.y) / max(uSolRetning.y, 0.15);
              vec2 traff = vVerden.xz + uSolRetning.xz * t;
              float skygge = 0.0;
              for (int i = 0; i < ${MAKS_SKYER}; i++) {
                if (i >= uSkyAntall) break;
                vec3 sky = uSkySenter[i];
                vec2 d = traff - sky.xy;
                float r = sky.z;
                // Kvadrert avstand: ingen kvadratrot per sky per fragment.
                float q = dot(d, d) / max(r * r, 1.0);
                // Myk kant hele veien fra kjernen og ut: en skarpt avgrenset
                // flekk leses som en tekstur-feil, ikke som en skygge.
                skygge = max(skygge, 1.0 - smoothstep(0.0, 1.0, q));
              }
              gl_FragColor.rgb *= 1.0 - skygge * uSkyggeStyrke;
            }`)
      }
      material.needsUpdate = true
    },
  }
}

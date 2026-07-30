// Himmel og atmosfære: gradient-kuppel (lys horisont → blå senit), drivende
// prosedurale skyer og avstandsdis. Disen (Fog) plukkes automatisk opp av
// terrengets MeshBasicMaterial og mykner horisonten; kuppelen selv ignorerer
// den (ShaderMaterial uten fog-chunk).

import {
  SphereGeometry, ShaderMaterial, Mesh, BackSide, Color, Fog,
  CanvasTexture, SpriteMaterial, Sprite, Group, SRGBColorSpace,
} from 'three'

const ZENITH = '#3d7ec9'
const HORIZON = '#dbe9f5'
export const FOG_COLOR = '#cfe0ee'

export function buildSkyDome({ radius = 25000 } = {}) {
  const geometry = new SphereGeometry(radius, 24, 12)
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new Color(ZENITH) },
      uHorizon: { value: new Color(HORIZON) },
    },
    vertexShader: `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      varying float vH;
      void main() {
        float t = smoothstep(-0.05, 0.5, vH);
        gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return { mesh, geometry, material }
}

export function makeFog(maxDimM) {
  return new Fog(new Color(FOG_COLOR), maxDimM * 0.6, maxDimM * 2.6)
}

// Myk skyflekk-tekstur: noen overlappende radielle gradienter på canvas.
function cloudTexture(seed) {
  const px = 256
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px / 2
  const ctx = canvas.getContext('2d')
  const rnd = mulberry32(seed)
  const blobs = 6 + Math.floor(rnd() * 4)
  for (let i = 0; i < blobs; i++) {
    const x = px * (0.2 + rnd() * 0.6)
    const y = (px / 2) * (0.35 + rnd() * 0.3)
    const r = px * (0.1 + rnd() * 0.12)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, px, px / 2)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Drivende skyer over kartet. Billboards med prosedural tekstur — ingen
 * eksterne assets, ~10 sprites, umerkelig på GPU-budsjettet.
 */
export function buildClouds({ widthM, heightM, baseY = 1200, count = 10 } = {}) {
  const group = new Group()
  const rnd = mulberry32(42)
  const spanX = widthM * 1.6
  const spanZ = heightM * 1.6
  const textures = [cloudTexture(7), cloudTexture(13), cloudTexture(29)]
  const materials = textures.map(t => new SpriteMaterial({
    map: t, transparent: true, opacity: 0.85, depthWrite: false,
  }))
  const sprites = []
  for (let i = 0; i < count; i++) {
    const sprite = new Sprite(materials[i % materials.length])
    const w = 1200 + rnd() * 2200
    sprite.scale.set(w, w * 0.35, 1)
    sprite.position.set(
      (rnd() - 0.5) * spanX,
      baseY + rnd() * 700,
      (rnd() - 0.5) * spanZ,
    )
    sprite.userData.driftM = 8 + rnd() * 14
    group.add(sprite)
    sprites.push(sprite)
  }
  return {
    group,
    materials,
    textures,
    update(dt) {
      for (const s of sprites) {
        s.position.x += s.userData.driftM * dt
        if (s.position.x > spanX / 2) s.position.x = -spanX / 2
      }
    },
    dispose() {
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}

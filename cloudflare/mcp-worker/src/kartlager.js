// R2-lagring for bygde kart (Spor 1 fase B). Erstatter stdio-serverens
// `state.map`-minne: hvert bygde kart får en kartRef, og alle senere verktøy-
// kall (planlegg_rute, hoydeprofil, …) laster kartet fra R2 via referansen.
// Tilstandsløst og restart-trygt — jf. «tilstandsløs modell»-alternativet i
// docs/MCP_REMOTE_CHAT.md, med R2 som svaret på at kart+DEM er store.
//
// Layout per kart:
//   kart/<ref>/meta.json  — { navn, bbox, meta, counts, demMeta, opprettet }
//   kart/<ref>/kart.svg   — kart-SVG-en (serveres via GET /fil/…)
//   kart/<ref>/dem.bin    — DEM-verdiene (Float32Array-buffer); resten av
//                           DEM-objektet (cols/rows/transform/noData) ligger
//                           som demMeta i meta.json
//   kart/<ref>/ruter.json — siste planlegg_rute/-rundtur (for eksporter_gpx)
//   ut/<ref>/<navn>       — genererte utdata (overlay-SVG, GPX)

export function nyKartRef(navn) {
  const slug = (navn || 'kart').replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase().slice(0, 40)
  const suffiks = crypto.randomUUID().slice(0, 8)
  return `${slug}-${suffiks}`
}

export async function lagreKart(env, ref, { svg, dem, meta, counts, bbox, navn }) {
  const { data, ...demMeta } = dem ?? {}
  const jobber = [
    env.LENDE_R2.put(`kart/${ref}/kart.svg`, svg, {
      httpMetadata: { contentType: 'image/svg+xml; charset=utf-8' },
    }),
    env.LENDE_R2.put(
      `kart/${ref}/meta.json`,
      JSON.stringify({ navn, bbox, meta, counts, demMeta, opprettet: new Date().toISOString() }),
      { httpMetadata: { contentType: 'application/json' } },
    ),
  ]
  if (data?.buffer) jobber.push(env.LENDE_R2.put(`kart/${ref}/dem.bin`, data.buffer))
  await Promise.all(jobber)
}

export async function lastKart(env, ref) {
  const metaObj = await env.LENDE_R2.get(`kart/${ref}/meta.json`)
  if (!metaObj) return null
  const { navn, bbox, meta, counts, demMeta } = JSON.parse(await metaObj.text())
  const [svgObj, demObj] = await Promise.all([
    env.LENDE_R2.get(`kart/${ref}/kart.svg`),
    env.LENDE_R2.get(`kart/${ref}/dem.bin`),
  ])
  if (!svgObj) return null
  const svg = await svgObj.text()
  let dem = null
  if (demObj && demMeta?.cols) {
    dem = { ...demMeta, data: new Float32Array(await demObj.arrayBuffer()) }
  }
  return { navn, bbox, meta, counts, dem, svg }
}

export async function lagreRuter(env, ref, ruter) {
  await env.LENDE_R2.put(`kart/${ref}/ruter.json`, JSON.stringify(ruter), {
    httpMetadata: { contentType: 'application/json' },
  })
}

export async function lastRuter(env, ref) {
  const obj = await env.LENDE_R2.get(`kart/${ref}/ruter.json`)
  return obj ? JSON.parse(await obj.text()) : null
}

// Visnings-innstillinger fra juster_kart (fase C) — remote-motstykket til
// stdio-serverens `state.innstillinger`: huskes per kartRef og påføres alle
// senere SVG-utdata til de nullstilles. kart.svg forblir urørt.
export async function lagreInnstillinger(env, ref, innstillinger) {
  const sti = `kart/${ref}/innstillinger.json`
  if (!innstillinger) {
    await env.LENDE_R2.delete(sti)
    return
  }
  await env.LENDE_R2.put(sti, JSON.stringify(innstillinger), {
    httpMetadata: { contentType: 'application/json' },
  })
}

export async function lastInnstillinger(env, ref) {
  const obj = await env.LENDE_R2.get(`kart/${ref}/innstillinger.json`)
  return obj ? JSON.parse(await obj.text()) : null
}

export async function lagreUtdata(env, ref, filnavn, innhold, contentType) {
  const sti = `ut/${ref}/${filnavn}`
  await env.LENDE_R2.put(sti, innhold, { httpMetadata: { contentType } })
  return sti
}

/** Serve et R2-objekt (GET /fil/<r2-sti>). Kalles etter token-sjekk. */
export async function serveFil(env, r2Sti) {
  const obj = await env.LENDE_R2.get(r2Sti)
  if (!obj) return new Response('Not Found', { status: 404 })
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

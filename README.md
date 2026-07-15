# Lende

**Turkart og ruteplanlegging** — ISOM-inspirerte sportskart bygget fra ekte
norske kartdata (Kartverket, OSM, NVE, Naturbase), rendret som
print-kvalitets SVG. Ruteplanlegger for grus og sti med høydeprofil og
GPX-eksport. Vue 3 + Vite, PWA.

Live: https://gitjanerik.github.io/lende/

Skilt ut fra [svg-insights](https://github.com/gitjanerik/svg-insights) i
juli 2026 — historikk før v1.0.0 ligger der.

## Utvikling

```bash
npm install
npm run dev     # utviklingsserver på port 5173
npm run test    # vitest
npm run build   # produksjonsbygg
npm run mcp     # MCP-server (kart/rute-verktøy over stdio)
```

Deploy skjer automatisk ved push til `master` (GitHub Actions bygger
Vardåsen-demokartet fra Kartverket WCS og publiserer til gh-pages).
Se `CLAUDE.md` for arkitektur og konvensjoner.

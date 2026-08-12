#!/usr/bin/env node
// Frie variabler: hvilke identifikatorer bruker en fil som den ikke selv
// deklarerer, importerer eller får inn som parameter?
//
// Hvorfor: navnediff ser på MapView og fanger navn som forsvant DERFRA. Den ser
// ikke motsatt retning — at en fersk composable refererer noe som ble stående i
// MapView. Under v5.12.0-uttrekket skjedde det to ganger på rad
// (`withColophon`, og `wrapperRef` + `visibleLayers` +
// `DEFAULT_VISIBLE_LAYER_KEYS`), begge ganger funnet av røyktesten — altså først
// etter et bygg og en nettleser-start. Dette scriptet finner dem på et sekund.
//
// Bruk:  node scripts/frie-variabler.mjs src/composables/useNoe.js
//
// Grov med vilje: regex, ikke AST. Den skal peke deg på noe å se på, ikke være
// en autoritet — forvent noen falske treff fra destrukturering og callback-
// parametre. Et navn du KJENNER IGJEN som app-tilstand er derimot en ekte feil.

import { readFileSync } from 'node:fs'

const fil = process.argv[2]
const s = readFileSync(fil, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''")
const def = new Set()
for (const re of [
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  // Flere deklaratorer per setning: `let minX = 0, minY = 0, maxX = w`.
  // Uten denne meldte verktøyet minY/maxX/sin som frie (v5.15.0).
  /[,(]\s*([A-Za-z_$][\w$]*)\s*=[^=>]/g,
  /function\s+([A-Za-z_$][\w$]*)/g,
  /([A-Za-z_$][\w$]*)\s*(?:,|\}|:)/g,        // destrukturering/params (raust)
]) for (const m of s.matchAll(re)) def.add(m[1])
for (const m of s.matchAll(/\{([^}]*)\}\s*from/g)) for (const n of m[1].split(',')) def.add(n.trim().split(' ').pop())
for (const m of s.matchAll(/import\s+([A-Za-z_$][\w$]*)/g)) def.add(m[1])
for (const m of s.matchAll(/\(([^)]*)\)\s*=>/g)) for (const n of m[1].split(',')) def.add(n.trim())
const innebygd = new Set(['Math','Object','Array','JSON','Number','String','Boolean','Set','Map','Date','Promise','console','document','window','navigator','localStorage','performance','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','URL','Blob','fetch','Error','RegExp','isNaN','parseInt','parseFloat','undefined','null','true','false','this','return','if','else','for','while','const','let','var','function','new','typeof','void','await','async','of','in','try','catch','finally','throw','break','continue','case','switch','default','delete','instanceof','do','class','extends','super','yield','import','export','from','as','getComputedStyle','structuredClone','CSS','Intl','ResizeObserver','IntersectionObserver','MutationObserver','AbortController','FileReader','Image','DOMParser','XMLSerializer','crypto','indexedDB','matchMedia','alert','confirm','prompt','queueMicrotask'])
const brukt = new Set()
for (const m of s.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)) brukt.add(m[1])
const frie = [...brukt].filter((n) => !def.has(n) && !innebygd.has(n)).sort()
console.log(fil.split('/').pop() + ':', frie.length ? frie.join(' ') : '(ingen frie variabler)')

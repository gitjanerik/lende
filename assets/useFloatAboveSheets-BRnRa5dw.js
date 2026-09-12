import{H as e,K as t,T as n,V as r,c as i}from"./_plugin-vue_export-helper-BVgFrZgr.js";import{i as a,u as o}from"./utm-CoCOUD1g.js";function s(e,t){if(!Number.isFinite(e)||e<=0||!Number.isFinite(t))return 14;let n=Math.log2(156543.03392*Math.cos(t*Math.PI/180)/e);return Number.isFinite(n)?Math.min(16,Math.max(4,Math.round(n))):14}function c({lat:e,lon:t,zoom:n=14}){return![e,t,n].every(Number.isFinite)||Math.abs(e)>90||Math.abs(t)>180?null:`https://ut.no/kart#${Math.min(16,Math.max(4,Math.round(n)))}/${e.toFixed(5)}/${t.toFixed(5)}`}function l(e,t){return`https://www.google.com/maps?q=${e.toFixed(6)},${t.toFixed(6)}`}function u(e,t){return`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.toFixed(6)},${t.toFixed(6)}`}function d({lat:e,lon:t,zoom:n=14}){if(![e,t,n].every(Number.isFinite)||Math.abs(e)>90||Math.abs(t)>180)return null;let r=Math.min(16,Math.max(3,Math.round(n))),{e:i,n:a}=o(e,t);return`https://vegkart.atlas.vegvesen.no/#kartlag:geodata/@${Math.round(i)},${Math.round(a)},${r}`}function f(e){return e?`https://www.kulturminnesok.no/kart/?id=${encodeURIComponent(e)}`:null}function p(e){return String(e).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&apos;`})[e])}function m(e,t,n=`Lende tur`){if(!e?.points?.length)return``;let r=new Date(e.opprettet??Date.now()).toISOString(),i=p(e.navn||`Tur `+new Date(e.opprettet??Date.now()).toLocaleString(`no-NO`)),o=e.points.map(e=>{let n=a(e.x,e.y,t),r=new Date(e.t).toISOString(),i=e.accM==null?``:`\n        <hdop>${(e.accM/5).toFixed(1)}</hdop>`;return`      <trkpt lat="${n.lat.toFixed(7)}" lon="${n.lon.toFixed(7)}">
        <time>${r}</time>${i}
      </trkpt>`}).join(`
`);return`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lende"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${p(n)}</name>
    <time>${r}</time>
  </metadata>
  <trk>
    <name>${i}</name>
    <trkseg>
${o}
    </trkseg>
  </trk>
</gpx>
`}function h(e){if(!e?.points?.length)return``;let t=new Date(e.opprettet??Date.now()).toISOString(),n=p(e.navn||`Grusrute`);return`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lende Ruteplanlegger"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${n}</name>
    <time>${t}</time>
  </metadata>
  <rte>
    <name>${n}</name>
${e.points.map(([e,t,n])=>{let r=Number.isFinite(n)?`\n      <ele>${n.toFixed(1)}</ele>`:``;return`    <rtept lat="${t.toFixed(7)}" lon="${e.toFixed(7)}">${r}
    </rtept>`}).join(`
`)}
  </rte>
</gpx>
`}function g(e,t){let n=h(e);if(!n)return;let r=new Blob([n],{type:`application/gpx+xml`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=t??`${(e.navn||`grusrute`).replace(/[^a-z0-9æøå]+/gi,`-`).toLowerCase()}.gpx`,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(i),1e3)}function _(e,t,n,r){let i=m(e,t,n);if(!i)return;let a=new Blob([i],{type:`application/gpx+xml`}),o=URL.createObjectURL(a),s=document.createElement(`a`);s.href=o,s.download=r??`${(n||`tur`).replace(/[^a-z0-9æøå]+/gi,`-`).toLowerCase()}.gpx`,document.body.appendChild(s),s.click(),document.body.removeChild(s),setTimeout(()=>URL.revokeObjectURL(o),1e3)}function v(e){let t=e?.points;if(!t||t.length<2)return 0;let n=0;for(let e=1;e<t.length;e++){let r=t[e].x-t[e-1].x,i=t[e].y-t[e-1].y;n+=Math.hypot(r,i)}return n}function y(e){let t=e?.points;return!t||t.length<2?0:t[t.length-1].t-t[0].t}function b(e,t,n,r=.25){if(!n||n.length===0)return t;let i=n[0],a=1/0;for(let e of n){let n=Math.abs(t-e);n<a&&(a=n,i=e)}let o=e-i;if(o===0)return i;let s=o<0?-1:1,c=n.filter(e=>s<0?e<i:e>i).sort((e,t)=>s<0?t-e:e-t),l=i,u=i;for(let t of c){let n=u+s*r*Math.abs(t-u);if(!(s<0?e<=n:e>=n))break;l=t,u=t}return l}function x({expandedHeight:t=.45,minimizedPeek:a=28,maxHeight:o=null,maxTopGapPx:s=null,allowMinimize:c=!0,commitFraction:l=.25,springMs:u=220}={}){let d=e(0),f=e(!1),p=e(!1),m=e(!1),h=e(0),g=e(0),_=e(0),v=r({startY:0,startTranslate:0}),y=i(()=>_.value>0?-(_.value-g.value):0),x=i(()=>c?h.value:0),S=i(()=>{let e=[0];return _.value>0&&e.push(y.value),c&&e.push(h.value),e.sort((e,t)=>e-t)});function C(){let e=window.innerHeight||800;g.value=Math.max(a+100,e*t),h.value=g.value-a,_.value=s==null?o?Math.max(g.value,e*o):0:Math.max(g.value,e-s)}C(),window.addEventListener(`resize`,C,{passive:!0}),n(()=>window.removeEventListener(`resize`,C));let w=i(()=>h.value<=0?0:Math.max(0,Math.min(1,d.value/h.value))),T=i(()=>Math.max(0,g.value-d.value)),E=i(()=>m.value?.6:1),D=i(()=>({height:Math.max(a,g.value-d.value)+`px`,transition:m.value?`none`:`height ${u}ms cubic-bezier(0.2, 0.8, 0.2, 1)`}));function O(e){m.value=!0,v.startY=e.clientY??e.touches?.[0]?.clientY??0,v.startTranslate=d.value;try{e.currentTarget.setPointerCapture?.(e.pointerId)}catch{}e.preventDefault()}function k(e){if(!m.value)return;let t=(e.clientY??e.touches?.[0]?.clientY??0)-v.startY;d.value=Math.max(y.value,Math.min(x.value,v.startTranslate+t))}function A(){if(m.value){if(m.value=!1,Math.abs(d.value-v.startTranslate)<4){j(v.startTranslate);return}j(b(d.value,v.startTranslate,S.value,l))}}function j(e){d.value=e,f.value=c&&Math.abs(e-h.value)<1,p.value=_.value>0&&Math.abs(e-y.value)<1}function M(e){j(e?h.value:0)}function N(e){j(e&&_.value>0?y.value:0)}function P(e){let t=S.value;if(t.length<2)return!1;let n=0;for(let e=1;e<t.length;e++)Math.abs(t[e]-d.value)<Math.abs(t[n]-d.value)&&(n=e);let r=n+(e<0?-1:1);return r<0||r>=t.length?!1:(j(t[r]),!0)}function F(){d.value=0,f.value=!1,p.value=!1,m.value=!1}return{translateY:d,progress:w,isMinimized:f,isMaximized:p,isDragging:m,dragRangePx:h,expandedPx:g,minimizedPeek:a,visibleHeightPx:T,drawerHeightStyle:D,handleOpacity:E,onPointerDown:O,onPointerMove:k,onPointerUp:A,setMinimized:M,setMaximized:N,stegSnap:P,snapPoints:S,reset:F}}var S=e=>typeof e==`function`?e():t(e);function C(e,t={}){let{basePx:n=12,needPx:r=132,mapWidthPx:a=null,panelMode:o=null}=t,s=`calc(env(safe-area-inset-bottom, 0px) + ${n}px)`,c=i(()=>(S(e)||[]).filter(e=>e&&e.drawer&&!!S(e.open))),l=i(()=>{let e=S(a);return e?Math.max(0,(e-700)/2)>=r:!1}),u=i(()=>!!S(o)||l.value),d=i(()=>{let e=0;for(let t of c.value){let n=S(t.drawer.visibleHeightPx)||0;if(n>(S(t.drawer.minimizedPeek)||0)+8)return null;n>e&&(e=n)}return e}),f=i(()=>!u.value&&c.value.length>0&&d.value===null);return{bottomStyle:i(()=>{if(u.value)return s;let e=d.value;return e?`${e+n}px`:s}),hidden:f,roomy:l}}export{g as a,f as c,u as d,c as f,_ as i,d as l,b as n,y as o,s as p,x as r,v as s,C as t,l as u};
import{C as e,I as t,L as n,u as r}from"./vue-router-CiL9TTnJ.js";import{B as i,I as a}from"./useSearchKeyboard-CFW6BM2R.js";function o(e,t){if(!Number.isFinite(e)||e<=0||!Number.isFinite(t))return 14;let n=Math.log2(156543.03392*Math.cos(t*Math.PI/180)/e);return Number.isFinite(n)?Math.min(16,Math.max(4,Math.round(n))):14}function s({lat:e,lon:t,zoom:n=14}){return![e,t,n].every(Number.isFinite)||Math.abs(e)>90||Math.abs(t)>180?null:`https://ut.no/kart#${Math.min(16,Math.max(4,Math.round(n)))}/${e.toFixed(5)}/${t.toFixed(5)}`}function c(e,t){return`https://www.google.com/maps?q=${e.toFixed(6)},${t.toFixed(6)}`}function l(e,t){return`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.toFixed(6)},${t.toFixed(6)}`}function u({lat:e,lon:t,zoom:n=14}){if(![e,t,n].every(Number.isFinite)||Math.abs(e)>90||Math.abs(t)>180)return null;let r=Math.min(16,Math.max(3,Math.round(n))),{e:a,n:o}=i(e,t);return`https://vegkart.atlas.vegvesen.no/#kartlag:geodata/@${Math.round(a)},${Math.round(o)},${r}`}function d(e){return e?`https://www.kulturminnesok.no/kart/?id=${encodeURIComponent(e)}`:null}function f(e){return String(e).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&apos;`})[e])}function p(e,t,n=`Lende tur`){if(!e?.points?.length)return``;let r=new Date(e.opprettet??Date.now()).toISOString(),i=f(e.navn||`Tur `+new Date(e.opprettet??Date.now()).toLocaleString(`no-NO`)),o=e.points.map(e=>{let n=a(e.x,e.y,t),r=new Date(e.t).toISOString(),i=e.accM==null?``:`\n        <hdop>${(e.accM/5).toFixed(1)}</hdop>`;return`      <trkpt lat="${n.lat.toFixed(7)}" lon="${n.lon.toFixed(7)}">
        <time>${r}</time>${i}
      </trkpt>`}).join(`
`);return`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lende"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${f(n)}</name>
    <time>${r}</time>
  </metadata>
  <trk>
    <name>${i}</name>
    <trkseg>
${o}
    </trkseg>
  </trk>
</gpx>
`}function m(e){if(!e?.points?.length)return``;let t=new Date(e.opprettet??Date.now()).toISOString(),n=f(e.navn||`Grusrute`);return`<?xml version="1.0" encoding="UTF-8"?>
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
`}function h(e,t){let n=m(e);if(!n)return;let r=new Blob([n],{type:`application/gpx+xml`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=t??`${(e.navn||`grusrute`).replace(/[^a-z0-9æøå]+/gi,`-`).toLowerCase()}.gpx`,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(i),1e3)}function g(e,t,n,r){let i=p(e,t,n);if(!i)return;let a=new Blob([i],{type:`application/gpx+xml`}),o=URL.createObjectURL(a),s=document.createElement(`a`);s.href=o,s.download=r??`${(n||`tur`).replace(/[^a-z0-9æøå]+/gi,`-`).toLowerCase()}.gpx`,document.body.appendChild(s),s.click(),document.body.removeChild(s),setTimeout(()=>URL.revokeObjectURL(o),1e3)}function _(e){let t=e?.points;if(!t||t.length<2)return 0;let n=0;for(let e=1;e<t.length;e++){let r=t[e].x-t[e-1].x,i=t[e].y-t[e-1].y;n+=Math.hypot(r,i)}return n}function v(e){let t=e?.points;return!t||t.length<2?0:t[t.length-1].t-t[0].t}function y(e,t,n,r=.25){if(!n||n.length===0)return t;let i=n[0],a=1/0;for(let e of n){let n=Math.abs(t-e);n<a&&(a=n,i=e)}let o=e-i;if(o===0)return i;let s=o<0?-1:1,c=n.filter(e=>s<0?e<i:e>i).sort((e,t)=>s<0?t-e:e-t),l=i,u=i;for(let t of c){let n=u+s*r*Math.abs(t-u);if(!(s<0?e<=n:e>=n))break;l=t,u=t}return l}function b({expandedHeight:i=.45,minimizedPeek:a=28,maxHeight:o=null,maxTopGapPx:s=null,allowMinimize:c=!0,commitFraction:l=.25,springMs:u=220}={}){let d=n(0),f=n(!1),p=n(!1),m=n(!1),h=n(0),g=n(0),_=n(0),v=t({startY:0,startTranslate:0}),b=r(()=>_.value>0?-(_.value-g.value):0),x=r(()=>c?h.value:0),S=r(()=>{let e=[0];return _.value>0&&e.push(b.value),c&&e.push(h.value),e.sort((e,t)=>e-t)});function C(){let e=window.innerHeight||800;g.value=Math.max(a+100,e*i),h.value=g.value-a,_.value=s==null?o?Math.max(g.value,e*o):0:Math.max(g.value,e-s)}C(),window.addEventListener(`resize`,C,{passive:!0}),e(()=>window.removeEventListener(`resize`,C));let w=r(()=>h.value<=0?0:Math.max(0,Math.min(1,d.value/h.value))),T=r(()=>Math.max(0,g.value-d.value)),E=r(()=>m.value?.6:1),D=r(()=>({height:Math.max(a,g.value-d.value)+`px`,transition:m.value?`none`:`height ${u}ms cubic-bezier(0.2, 0.8, 0.2, 1)`}));function O(e){m.value=!0,v.startY=e.clientY??e.touches?.[0]?.clientY??0,v.startTranslate=d.value;try{e.currentTarget.setPointerCapture?.(e.pointerId)}catch{}e.preventDefault()}function k(e){if(!m.value)return;let t=(e.clientY??e.touches?.[0]?.clientY??0)-v.startY;d.value=Math.max(b.value,Math.min(x.value,v.startTranslate+t))}function A(){if(m.value){if(m.value=!1,Math.abs(d.value-v.startTranslate)<4){j(v.startTranslate);return}j(y(d.value,v.startTranslate,S.value,l))}}function j(e){d.value=e,f.value=c&&Math.abs(e-h.value)<1,p.value=_.value>0&&Math.abs(e-b.value)<1}function M(e){j(e?h.value:0)}function N(e){j(e&&_.value>0?b.value:0)}function P(){d.value=0,f.value=!1,p.value=!1,m.value=!1}return{translateY:d,progress:w,isMinimized:f,isMaximized:p,isDragging:m,dragRangePx:h,expandedPx:g,visibleHeightPx:T,drawerHeightStyle:D,handleOpacity:E,onPointerDown:O,onPointerMove:k,onPointerUp:A,setMinimized:M,setMaximized:N,reset:P}}export{_ as a,c,o as d,v as i,l,g as n,d as o,h as r,u as s,b as t,s as u};
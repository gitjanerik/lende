import{$ as e,B as t,D as n,et as r}from"./symbolizer-DDqNqhHk.js";import{Q as i}from"./useSearchKeyboard-NYn2uP2B.js";function a(e){return String(e).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&apos;`})[e])}function o(e,t,n=`Lende tur`){if(!e?.points?.length)return``;let r=new Date(e.opprettet??Date.now()).toISOString(),o=a(e.navn||`Tur `+new Date(e.opprettet??Date.now()).toLocaleString(`no-NO`)),s=e.points.map(e=>{let n=i(e.x,e.y,t),r=new Date(e.t).toISOString(),a=e.accM==null?``:`\n        <hdop>${(e.accM/5).toFixed(1)}</hdop>`;return`      <trkpt lat="${n.lat.toFixed(7)}" lon="${n.lon.toFixed(7)}">
        <time>${r}</time>${a}
      </trkpt>`}).join(`
`);return`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lende"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${a(n)}</name>
    <time>${r}</time>
  </metadata>
  <trk>
    <name>${o}</name>
    <trkseg>
${s}
    </trkseg>
  </trk>
</gpx>
`}function s(e){if(!e?.points?.length)return``;let t=new Date(e.opprettet??Date.now()).toISOString(),n=a(e.navn||`Grusrute`);return`<?xml version="1.0" encoding="UTF-8"?>
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
`}function c(e,t){let n=s(e);if(!n)return;let r=new Blob([n],{type:`application/gpx+xml`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=t??`${(e.navn||`grusrute`).replace(/[^a-z0-9æøå]+/gi,`-`).toLowerCase()}.gpx`,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(i),1e3)}function l(e,t,n,r){let i=o(e,t,n);if(!i)return;let a=new Blob([i],{type:`application/gpx+xml`}),s=URL.createObjectURL(a),c=document.createElement(`a`);c.href=s,c.download=r??`${(n||`tur`).replace(/[^a-z0-9æøå]+/gi,`-`).toLowerCase()}.gpx`,document.body.appendChild(c),c.click(),document.body.removeChild(c),setTimeout(()=>URL.revokeObjectURL(s),1e3)}function u(e){let t=e?.points;if(!t||t.length<2)return 0;let n=0;for(let e=1;e<t.length;e++){let r=t[e].x-t[e-1].x,i=t[e].y-t[e-1].y;n+=Math.hypot(r,i)}return n}function d(e){let t=e?.points;return!t||t.length<2?0:t[t.length-1].t-t[0].t}function f(e,t,n,r=.25){if(!n||n.length===0)return t;let i=n[0],a=1/0;for(let e of n){let n=Math.abs(t-e);n<a&&(a=n,i=e)}let o=e-i;if(o===0)return i;let s=o<0?-1:1,c=n.filter(e=>s<0?e<i:e>i).sort((e,t)=>s<0?t-e:e-t),l=i,u=i;for(let t of c){let n=u+s*r*Math.abs(t-u);if(!(s<0?e<=n:e>=n))break;l=t,u=t}return l}function p({expandedHeight:i=.45,minimizedPeek:a=28,maxHeight:o=null,maxTopGapPx:s=null,allowMinimize:c=!0,commitFraction:l=.25,springMs:u=220}={}){let d=r(0),p=r(!1),m=r(!1),h=r(!1),g=r(0),_=r(0),v=r(0),y=e({startY:0,startTranslate:0}),b=n(()=>v.value>0?-(v.value-_.value):0),x=n(()=>c?g.value:0),S=n(()=>{let e=[0];return v.value>0&&e.push(b.value),c&&e.push(g.value),e.sort((e,t)=>e-t)});function C(){let e=window.innerHeight||800;_.value=Math.max(a+100,e*i),g.value=_.value-a,v.value=s==null?o?Math.max(_.value,e*o):0:Math.max(_.value,e-s)}C(),window.addEventListener(`resize`,C,{passive:!0}),t(()=>window.removeEventListener(`resize`,C));let w=n(()=>g.value<=0?0:Math.max(0,Math.min(1,d.value/g.value))),T=n(()=>Math.max(0,_.value-d.value)),E=n(()=>h.value?.6:1),D=n(()=>({height:Math.max(a,_.value-d.value)+`px`,transition:h.value?`none`:`height ${u}ms cubic-bezier(0.2, 0.8, 0.2, 1)`}));function O(e){h.value=!0,y.startY=e.clientY??e.touches?.[0]?.clientY??0,y.startTranslate=d.value;try{e.currentTarget.setPointerCapture?.(e.pointerId)}catch{}e.preventDefault()}function k(e){if(!h.value)return;let t=(e.clientY??e.touches?.[0]?.clientY??0)-y.startY;d.value=Math.max(b.value,Math.min(x.value,y.startTranslate+t))}function A(){if(h.value){if(h.value=!1,Math.abs(d.value-y.startTranslate)<4){j(y.startTranslate);return}j(f(d.value,y.startTranslate,S.value,l))}}function j(e){d.value=e,p.value=c&&Math.abs(e-g.value)<1,m.value=v.value>0&&Math.abs(e-b.value)<1}function M(e){j(e?g.value:0)}function N(e){j(e&&v.value>0?b.value:0)}function P(){d.value=0,p.value=!1,m.value=!1,h.value=!1}return{translateY:d,progress:w,isMinimized:p,isMaximized:m,isDragging:h,dragRangePx:g,expandedPx:_,visibleHeightPx:T,drawerHeightStyle:D,handleOpacity:E,onPointerDown:O,onPointerMove:k,onPointerUp:A,setMinimized:M,setMaximized:N,reset:P}}export{u as a,d as i,l as n,c as r,p as t};
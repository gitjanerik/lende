const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/contourLines-i86ZqzC-.js","assets/dem-ClMbyYkO.js","assets/pathUtils-CZm72ri7.js","assets/rolldown-runtime-XKyaHtl9.js","assets/three.core-CfUYDJ4e.js"])))=>i.map(i=>d[i]);
import{n as e}from"./rolldown-runtime-XKyaHtl9.js";import{l as t}from"./utm-C4TRMGkm.js";import{r as n}from"./poiColors-B4p52jof.js";import{a as r,i,n as a}from"./demSampling-sp1YKzp3.js";import{t as o}from"./preload-helper-DVlZOg2-.js";import{o as s,r as c,s as l}from"./routing-UiVjMAsY.js";import{G as u,W as d}from"./index-C5S4k6A2.js";import{$ as f,$n as p,A as m,An as h,Bn as g,C as _,Cn as v,Ct as y,Dn as b,E as x,En as S,F as C,Fn as w,G as T,Gn as E,H as D,Hn as O,I as k,In as A,J as ee,Jn as j,K as te,Kn as ne,L as re,Ln as ie,M,N as ae,Nn as N,O as oe,On as P,Q as se,Qn as F,R as I,Rn as L,S as ce,Sn as le,T as R,Tn as ue,U as de,Un as z,V as fe,Vn as B,W as V,Wn as pe,X as me,Xn as he,Y as ge,Yn as H,Zn as _e,_ as ve,_n as U,a as ye,at as be,b as W,bn as G,cn as xe,ct as Se,d as Ce,dt as we,en as K,er as Te,et as Ee,f as q,ft as De,g as Oe,gn as ke,gt as J,h as Ae,hn as Y,ht as X,i as je,in as Me,it as Ne,j as Pe,jn as Fe,k as Ie,kn as Le,l as Re,ln as ze,lt as Be,mn as Ve,mt as He,n as Ue,nn as We,nr as Ge,nt as Ke,o as qe,on as Je,ot as Ye,p as Xe,pt as Ze,q as Qe,qn as $e,r as et,rt as tt,s as nt,sn as rt,st as it,tn as at,tr as ot,tt as Z,u as st,ut as ct,v as lt,w as ut,wt as dt,x as ft,y as pt,yn as mt,yt as ht,z as gt,zn as _t}from"./three.core-CfUYDJ4e.js";import{a as vt,c as yt,d as bt,f as xt,h as St,i as Ct,l as wt,m as Tt,n as Et,p as Dt,r as Ot,s as kt,t as At,u as jt}from"./exploreData-C_LhLG49.js";import{S as Mt,_ as Nt,a as Pt,b as Ft,c as It,d as Lt,f as Rt,g as zt,h as Bt,i as Vt,l as Ht,m as Ut,n as Wt,o as Gt,p as Kt,r as qt,s as Jt,u as Yt,v as Xt,x as Zt,y as Qt}from"./Viewer3D-lCSE_QCY.js";import{n as $t,r as en}from"./MapView-Chcll9C9.js";function tn(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function nn(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var Q={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},$={common:{diffuse:{value:new q(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new f},alphaMap:{value:null},alphaMapTransform:{value:new f},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new f}},envmap:{envMap:{value:null},envMapRotation:{value:new f},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new f}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new f}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new f},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new f},normalScale:{value:new _t(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new f},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new f}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new f}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new f}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new q(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new g},probesMax:{value:new g},probesResolution:{value:new g}},points:{diffuse:{value:new q(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new f},alphaTest:{value:0},uvTransform:{value:new f}},sprite:{diffuse:{value:new q(16777215)},opacity:{value:1},center:{value:new _t(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new f},alphaMap:{value:null},alphaMapTransform:{value:new f},alphaTest:{value:0}}},rn={basic:{uniforms:p([$.common,$.specularmap,$.envmap,$.aomap,$.lightmap,$.fog]),vertexShader:Q.meshbasic_vert,fragmentShader:Q.meshbasic_frag},lambert:{uniforms:p([$.common,$.specularmap,$.envmap,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.fog,$.lights,{emissive:{value:new q(0)},envMapIntensity:{value:1}}]),vertexShader:Q.meshlambert_vert,fragmentShader:Q.meshlambert_frag},phong:{uniforms:p([$.common,$.specularmap,$.envmap,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.fog,$.lights,{emissive:{value:new q(0)},specular:{value:new q(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Q.meshphong_vert,fragmentShader:Q.meshphong_frag},standard:{uniforms:p([$.common,$.envmap,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.roughnessmap,$.metalnessmap,$.fog,$.lights,{emissive:{value:new q(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Q.meshphysical_vert,fragmentShader:Q.meshphysical_frag},toon:{uniforms:p([$.common,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.gradientmap,$.fog,$.lights,{emissive:{value:new q(0)}}]),vertexShader:Q.meshtoon_vert,fragmentShader:Q.meshtoon_frag},matcap:{uniforms:p([$.common,$.bumpmap,$.normalmap,$.displacementmap,$.fog,{matcap:{value:null}}]),vertexShader:Q.meshmatcap_vert,fragmentShader:Q.meshmatcap_frag},points:{uniforms:p([$.points,$.fog]),vertexShader:Q.points_vert,fragmentShader:Q.points_frag},dashed:{uniforms:p([$.common,$.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Q.linedashed_vert,fragmentShader:Q.linedashed_frag},depth:{uniforms:p([$.common,$.displacementmap]),vertexShader:Q.depth_vert,fragmentShader:Q.depth_frag},normal:{uniforms:p([$.common,$.bumpmap,$.normalmap,$.displacementmap,{opacity:{value:1}}]),vertexShader:Q.meshnormal_vert,fragmentShader:Q.meshnormal_frag},sprite:{uniforms:p([$.sprite,$.fog]),vertexShader:Q.sprite_vert,fragmentShader:Q.sprite_frag},background:{uniforms:{uvTransform:{value:new f},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Q.background_vert,fragmentShader:Q.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new f}},vertexShader:Q.backgroundCube_vert,fragmentShader:Q.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Q.cube_vert,fragmentShader:Q.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Q.equirect_vert,fragmentShader:Q.equirect_frag},distance:{uniforms:p([$.common,$.displacementmap,{referencePosition:{value:new g},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Q.distance_vert,fragmentShader:Q.distance_frag},shadow:{uniforms:p([$.lights,$.fog,{color:{value:new q(0)},opacity:{value:1}}]),vertexShader:Q.shadow_vert,fragmentShader:Q.shadow_frag}};rn.physical={uniforms:p([rn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new f},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new f},clearcoatNormalScale:{value:new _t(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new f},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new f},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new f},sheen:{value:0},sheenColor:{value:new q(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new f},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new f},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new f},transmissionSamplerSize:{value:new _t},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new f},attenuationDistance:{value:0},attenuationColor:{value:new q(0)},specularColor:{value:new q(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new f},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new f},anisotropyVector:{value:new _t},anisotropyMap:{value:null},anisotropyMapTransform:{value:new f}}]),vertexShader:Q.meshphysical_vert,fragmentShader:Q.meshphysical_frag};var an={r:0,b:0,g:0},on=new Ee,sn=new f;sn.set(-1,0,0,0,1,0,0,0,1);function cn(e,t,n,r,i,a){let o=new q(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new Z(new ye(1,1,1),new U({name:`BackgroundCubeMaterial`,uniforms:ne(rn.backgroundCube.uniforms),vertexShader:rn.backgroundCube.vertexShader,fragmentShader:rn.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(on.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(sn),l.material.toneMapped=Xe.getTransfer(i.colorSpace)!==Y,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new Z(new He(2,2),new U({name:`BackgroundMaterial`,uniforms:ne(rn.background.uniforms),vertexShader:rn.background.vertexShader,fragmentShader:rn.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Xe.getTransfer(i.colorSpace)!==Y,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(an,_e(e)),n.buffers.color.setClear(an.r,an.g,an.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function ln(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function un(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function dn(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(ot(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&ot(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function fn(e){let t=this,n=null,r=0,i=!1,a=!1,o=new Ze,s=new f,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var pn=4,mn=6,hn=20,gn=256,_n=new we,vn=new q,yn=null,bn=0,xn=0,Sn=!1,Cn=new g,wn=new g,Tn=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=Cn}=i;yn=this._renderer.getRenderTarget(),bn=this._renderer.getActiveCubeFace(),xn=this._renderer.getActiveMipmapLevel(),Sn=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Mn(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=jn(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(yn,bn,xn),this._renderer.xr.enabled=Sn,e.scissorTest=!1,On(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),yn=this._renderer.getRenderTarget(),bn=this._renderer.getActiveCubeFace(),xn=this._renderer.getActiveMipmapLevel(),Sn=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:te,minFilter:te,generateMipmaps:!1,type:k,format:y,colorSpace:ge,depthBuffer:!1},r=Dn(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Dn(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=En(r)),this._blurMaterial=An(r,e,t),this._ggxMaterial=kn(r,e,t)}return r}_compileMaterial(e){let t=new Z(new nt,e);this._renderer.compile(t,_n)}_sceneToCubeUV(e,t,n,r,i){let a=new De(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(vn),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Z(new ye,new Ke({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(vn),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;On(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Mn()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=jn());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;On(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,_n)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-pn?n-d+pn:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,On(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,_n),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,On(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,_n)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];On(t,3*l*(r>this._lodMax-pn?r-this._lodMax+pn:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,_n)}};function En(e){let t=[],n=[],r=e,i=e-pn+1+mn;for(let e=0;e<i;e++){let e=2**r;t.push(e);let i=1/(e-2),a=-i,o=1+i,s=[a,a,o,a,o,o,a,a,o,o,a,o],c=new Float32Array(108),l=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];c.set(r,18*e);for(let t=0;t<6;t++){let n=s[t*2]*2-1,r=s[t*2+1]*2-1;e===0?wn.set(1,r,n):e===1?wn.set(-n,1,-r):e===2?wn.set(-n,r,1):e===3?wn.set(-1,r,-n):e===4?wn.set(-n,-1,r):wn.set(n,r,-1),wn.toArray(l,(e*6+t)*3)}}let u=new nt;u.setAttribute(`position`,new qe(c,3)),u.setAttribute(`outputDirection`,new qe(l,3)),n.push(new Z(u,null)),r>pn&&r--}return{lodMeshes:n,sizeLods:t}}function Dn(e,t,n){let r=new z(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function On(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function kn(e,t,n){return new U({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:gn,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Nn(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function An(e,t,n){return new U({name:`SphericalGaussianBlur`,defines:{SAMPLES:hn,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Nn(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function jn(){return new U({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Nn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Mn(){return new U({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Nn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Nn(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Pn=class extends z{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new ve(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new ye(5,5,5),i=new U({name:`CubemapFromEquirect`,uniforms:ne(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new Z(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=te),new Ae(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function Fn(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new Pn(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Tn(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Tn(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function In(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&Ge(`WebGLRenderer: `+e+` extension not supported.`),t}}}function Ln(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0||(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++),t}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?Le:P)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function Rn(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function zn(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:H(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Bn(e,t,n){let r=new WeakMap,i=new B;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new W(h,p,m,u);g.type=Pe,g.needsUpdate=!0;let _=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*_;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new _t(p,m)},r.set(o,d);function v(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,v)}o.addEventListener(`dispose`,v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Vn(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var Hn={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Un(e,t,n,r,i,a){let o=new z(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=new nt;l.setAttribute(`position`,new m([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute(`uv`,new m([0,2,0,0,2,0],2));let u=new We({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new Z(l,u),f=new we(-1,1,1,-1,0,1),p=null,h=null,g=!1,_,v=null,y=[],b=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<y.length;n++){let r=y[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){y=e,b=y.length>0&&y[0].isRenderPass===!0;let t=o.width,n=o.height;y.length>0&&s===null&&(s=new z(t,n,{type:k,depthBuffer:!1,stencilBuffer:!1}),c=new z(t,n,{type:k,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<y.length;e++){let r=y[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(g||e.toneMapping===0&&y.length===0)return!1;if(v=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return b===!1&&e.setRenderTarget(o),_=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return b},this.end=function(e,t){e.toneMapping=_,g=!0;let n=o,r=s;for(let i=0;i<y.length;i++){let a=y[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(p!==e.outputColorSpace||h!==e.toneMapping){p=e.outputColorSpace,h=e.toneMapping,u.defines={},Xe.getTransfer(p)===`srgb`&&(u.defines.SRGB_TRANSFER=``);let t=Hn[h];t&&(u.defines[t]=``),u.needsUpdate=!0}u.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(v),e.render(d,f),v=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),l.dispose(),u.dispose()}}var Wn=new ue,Gn=new ut(1,1),Kn=new W,qn=new pt,Jn=new ve,Yn=[],Xn=[],Zn=new Float32Array(16),Qn=new Float32Array(9),$n=new Float32Array(4);function er(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=Yn[i];if(a===void 0&&(a=new Float32Array(i),Yn[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function tr(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function nr(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function rr(e,t){let n=Xn[t];n===void 0&&(n=new Int32Array(t),Xn[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function ir(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function ar(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tr(n,t))return;e.uniform2fv(this.addr,t),nr(n,t)}}function or(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(tr(n,t))return;e.uniform3fv(this.addr,t),nr(n,t)}}function sr(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tr(n,t))return;e.uniform4fv(this.addr,t),nr(n,t)}}function cr(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(tr(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),nr(n,t)}else{if(tr(n,r))return;$n.set(r),e.uniformMatrix2fv(this.addr,!1,$n),nr(n,r)}}function lr(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(tr(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),nr(n,t)}else{if(tr(n,r))return;Qn.set(r),e.uniformMatrix3fv(this.addr,!1,Qn),nr(n,r)}}function ur(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(tr(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),nr(n,t)}else{if(tr(n,r))return;Zn.set(r),e.uniformMatrix4fv(this.addr,!1,Zn),nr(n,r)}}function dr(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function fr(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tr(n,t))return;e.uniform2iv(this.addr,t),nr(n,t)}}function pr(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(tr(n,t))return;e.uniform3iv(this.addr,t),nr(n,t)}}function mr(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tr(n,t))return;e.uniform4iv(this.addr,t),nr(n,t)}}function hr(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function gr(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tr(n,t))return;e.uniform2uiv(this.addr,t),nr(n,t)}}function _r(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(tr(n,t))return;e.uniform3uiv(this.addr,t),nr(n,t)}}function vr(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tr(n,t))return;e.uniform4uiv(this.addr,t),nr(n,t)}}function yr(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(Gn.compareFunction=n.isReversedDepthBuffer()?518:515,a=Gn):a=Wn,n.setTexture2D(t||a,i)}function br(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||qn,i)}function xr(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||Jn,i)}function Sr(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||Kn,i)}function Cr(e){switch(e){case 5126:return ir;case 35664:return ar;case 35665:return or;case 35666:return sr;case 35674:return cr;case 35675:return lr;case 35676:return ur;case 5124:case 35670:return dr;case 35667:case 35671:return fr;case 35668:case 35672:return pr;case 35669:case 35673:return mr;case 5125:return hr;case 36294:return gr;case 36295:return _r;case 36296:return vr;case 35678:case 36198:case 36298:case 36306:case 35682:return yr;case 35679:case 36299:case 36307:return br;case 35680:case 36300:case 36308:case 36293:return xr;case 36289:case 36303:case 36311:case 36292:return Sr}}function wr(e,t){e.uniform1fv(this.addr,t)}function Tr(e,t){let n=er(t,this.size,2);e.uniform2fv(this.addr,n)}function Er(e,t){let n=er(t,this.size,3);e.uniform3fv(this.addr,n)}function Dr(e,t){let n=er(t,this.size,4);e.uniform4fv(this.addr,n)}function Or(e,t){let n=er(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function kr(e,t){let n=er(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Ar(e,t){let n=er(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function jr(e,t){e.uniform1iv(this.addr,t)}function Mr(e,t){e.uniform2iv(this.addr,t)}function Nr(e,t){e.uniform3iv(this.addr,t)}function Pr(e,t){e.uniform4iv(this.addr,t)}function Fr(e,t){e.uniform1uiv(this.addr,t)}function Ir(e,t){e.uniform2uiv(this.addr,t)}function Lr(e,t){e.uniform3uiv(this.addr,t)}function Rr(e,t){e.uniform4uiv(this.addr,t)}function zr(e,t,n){let r=this.cache,i=t.length,a=rr(n,i);tr(r,a)||(e.uniform1iv(this.addr,a),nr(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?Gn:Wn;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Br(e,t,n){let r=this.cache,i=t.length,a=rr(n,i);tr(r,a)||(e.uniform1iv(this.addr,a),nr(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||qn,a[e])}function Vr(e,t,n){let r=this.cache,i=t.length,a=rr(n,i);tr(r,a)||(e.uniform1iv(this.addr,a),nr(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||Jn,a[e])}function Hr(e,t,n){let r=this.cache,i=t.length,a=rr(n,i);tr(r,a)||(e.uniform1iv(this.addr,a),nr(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||Kn,a[e])}function Ur(e){switch(e){case 5126:return wr;case 35664:return Tr;case 35665:return Er;case 35666:return Dr;case 35674:return Or;case 35675:return kr;case 35676:return Ar;case 5124:case 35670:return jr;case 35667:case 35671:return Mr;case 35668:case 35672:return Nr;case 35669:case 35673:return Pr;case 5125:return Fr;case 36294:return Ir;case 36295:return Lr;case 36296:return Rr;case 35678:case 36198:case 36298:case 36306:case 35682:return zr;case 35679:case 36299:case 36307:return Br;case 35680:case 36300:case 36308:case 36293:return Vr;case 36289:case 36303:case 36311:case 36292:return Hr}}var Wr=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Cr(t.type)}},Gr=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Ur(t.type)}},Kr=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},qr=/(\w+)(\])?(\[|\.)?/g;function Jr(e,t){e.seq.push(t),e.map[t.id]=t}function Yr(e,t,n){let r=e.name,i=r.length;for(qr.lastIndex=0;;){let a=qr.exec(r),o=qr.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Jr(n,l===void 0?new Wr(s,e,t):new Gr(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new Kr(s),Jr(n,e)),n=e}}}var Xr=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);Yr(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function Zr(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var Qr=37297,$r=0;function ei(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var ti=new f;function ni(e){Xe._getMatrix(ti,Xe.workingColorSpace,e);let t=`mat3( ${ti.elements.map(e=>e.toFixed(4))} )`;switch(Xe.getTransfer(e)){case me:return[t,`LinearTransferOETF`];case Y:return[t,`sRGBTransferOETF`];default:return ot(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function ri(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+ei(e.getShaderSource(t),r)}return i}function ii(e,t){let n=ni(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var ai={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function oi(e,t){let n=ai[t];return n===void 0?(ot(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var si=new g;function ci(){return Xe.getLuminanceCoefficients(si),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${si.x.toFixed(4)}, ${si.y.toFixed(4)}, ${si.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function li(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(fi).join(`
`)}function ui(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function di(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function fi(e){return e!==``}function pi(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function mi(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var hi=/^[ \t]*#include +<([\w\d./]+)>/gm;function gi(e){return e.replace(hi,vi)}var _i=new Map;function vi(e,t){let n=Q[t];if(n===void 0){let e=_i.get(t);if(e!==void 0)n=Q[e],ot(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return gi(n)}var yi=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function bi(e){return e.replace(yi,xi)}function xi(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function Si(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var Ci={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function wi(e){return Ci[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var Ti={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function Ei(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:Ti[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var Di={302:`ENVMAP_MODE_REFRACTION`};function Oi(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:Di[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var ki={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function Ai(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:ki[e.combine]||`ENVMAP_BLENDING_NONE`}function ji(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function Mi(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=wi(n),l=Ei(n),u=Oi(n),d=Ai(n),f=ji(n),p=li(n),m=ui(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(fi).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(fi).join(`
`),_.length>0&&(_+=`
`)):(g=[Si(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(fi).join(`
`),_=[Si(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:Q.tonemapping_pars_fragment,n.toneMapping===0?``:oi(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,Q.colorspace_pars_fragment,ii(`linearToOutputTexel`,n.outputColorSpace),ci(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(fi).join(`
`)),o=gi(o),o=pi(o,n),o=mi(o,n),s=gi(s),s=pi(s,n),s=mi(s,n),o=bi(o),s=bi(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=Zr(i,i.VERTEX_SHADER,y),S=Zr(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=ri(i,x,`vertex`),n=ri(i,S,`fragment`);H(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):ot(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new Xr(i,h),T=di(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,Qr)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=$r++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var Ni=0,Pi=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Fi(e),t.set(e,n)),n}},Fi=class{constructor(e){this.id=Ni++,this.code=e,this.usedTimes=0}};function Ii(e){return e===1030||e===37490||e===36285}function Li(e,t,n,r,i,a){let o=new D,s=new Pi,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function g(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&ot(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=rn[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),k=e.id,A=t.id}let ee=e.getRenderTarget(),j=e.state.buffers.depth.getReversed(),te=h.isInstancedMesh===!0,ne=h.isBatchedMesh===!0,re=!!i.map,ie=!!i.matcap,M=!!x,ae=!!i.aoMap,N=!!i.lightMap,oe=!!i.bumpMap&&i.wireframe===!1,P=!!i.normalMap,se=!!i.displacementMap,F=!!i.emissiveMap,I=!!i.metalnessMap,L=!!i.roughnessMap,ce=i.anisotropy>0,le=i.clearcoat>0,R=i.dispersion>0,ue=i.retroreflectivity>0,de=i.iridescence>0,z=i.sheen>0,fe=i.transmission>0,B=ce&&!!i.anisotropyMap,V=le&&!!i.clearcoatMap,pe=le&&!!i.clearcoatNormalMap,me=le&&!!i.clearcoatRoughnessMap,he=de&&!!i.iridescenceMap,ge=de&&!!i.iridescenceThicknessMap,H=z&&!!i.sheenColorMap,_e=z&&!!i.sheenRoughnessMap,ve=!!i.specularMap,U=!!i.specularColorMap,ye=!!i.specularIntensityMap,be=fe&&!!i.transmissionMap,W=fe&&!!i.thicknessMap,G=!!i.gradientMap,xe=!!i.alphaMap,Se=i.alphaTest>0,Ce=!!i.alphaHash,we=!!i.extensions,K=0;i.toneMapped&&(ee===null||ee.isXRRenderTarget===!0)&&(K=e.toneMapping);let Te={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:ne,batchingColor:ne&&h._colorsTexture!==null,instancing:te,instancingColor:te&&h.instanceColor!==null,instancingMorph:te&&h.morphTexture!==null,outputColorSpace:ee===null?e.outputColorSpace:ee.isXRRenderTarget===!0?ee.texture.colorSpace:Xe.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:re,matcap:ie,envMap:M,envMapMode:M&&x.mapping,envMapCubeUVHeight:S,aoMap:ae,lightMap:N,bumpMap:oe,normalMap:P,displacementMap:se,emissiveMap:F,normalMapObjectSpace:P&&i.normalMapType===1,normalMapTangentSpace:P&&i.normalMapType===0,packedNormalMap:P&&i.normalMapType===0&&Ii(i.normalMap.format),metalnessMap:I,roughnessMap:L,anisotropy:ce,anisotropyMap:B,clearcoat:le,clearcoatMap:V,clearcoatNormalMap:pe,clearcoatRoughnessMap:me,dispersion:R,retroreflection:ue,iridescence:de,iridescenceMap:he,iridescenceThicknessMap:ge,sheen:z,sheenColorMap:H,sheenRoughnessMap:_e,specularMap:ve,specularColorMap:U,specularIntensityMap:ye,transmission:fe,transmissionMap:be,thicknessMap:W,gradientMap:G,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:xe,alphaTest:Se,alphaHash:Ce,combine:i.combine,mapUv:re&&m(i.map.channel),aoMapUv:ae&&m(i.aoMap.channel),lightMapUv:N&&m(i.lightMap.channel),bumpMapUv:oe&&m(i.bumpMap.channel),normalMapUv:P&&m(i.normalMap.channel),displacementMapUv:se&&m(i.displacementMap.channel),emissiveMapUv:F&&m(i.emissiveMap.channel),metalnessMapUv:I&&m(i.metalnessMap.channel),roughnessMapUv:L&&m(i.roughnessMap.channel),anisotropyMapUv:B&&m(i.anisotropyMap.channel),clearcoatMapUv:V&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:pe&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:me&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:he&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:ge&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:H&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:_e&&m(i.sheenRoughnessMap.channel),specularMapUv:ve&&m(i.specularMap.channel),specularColorMapUv:U&&m(i.specularColorMap.channel),specularIntensityMapUv:ye&&m(i.specularIntensityMap.channel),transmissionMapUv:be&&m(i.transmissionMap.channel),thicknessMapUv:W&&m(i.thicknessMap.channel),alphaMapUv:xe&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(P||ce),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(re||xe),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&P===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:j,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:K,decodeVideoTexture:re&&i.map.isVideoTexture===!0&&Xe.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:F&&i.emissiveMap.isVideoTexture===!0&&Xe.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:we&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(we&&i.extensions.multiDraw===!0||ne)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Te.vertexUv1s=c.has(1),Te.vertexUv2s=c.has(2),Te.vertexUv3s=c.has(3),c.clear(),Te}function _(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(v(n,t),y(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function v(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function y(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function b(e){let t=p[e.type],n;if(t){let e=rn[t];n=h.clone(e.uniforms)}else n=e.uniforms;return n}function x(t,n){let r=u.get(n);return r===void 0?(r=new Mi(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function S(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function C(e){s.remove(e)}function w(){s.dispose()}return{getParameters:g,getProgramCacheKey:_,getUniforms:b,acquireProgram:x,releaseProgram:S,releaseShaderCache:C,programs:l,dispose:w}}function Ri(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function zi(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Bi(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Vi(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||zi),r.length>1&&r.sort(t||Bi),i.length>1&&i.sort(t||Bi)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function Hi(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Vi,e.set(t,[i])):n>=r.length?(i=new Vi,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function Ui(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new g,color:new q};break;case`SpotLight`:n={position:new g,direction:new g,color:new q,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new g,color:new q,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new g,skyColor:new q,groundColor:new q};break;case`RectAreaLight`:n={color:new q,position:new g,halfWidth:new g,halfHeight:new g}}return e[t.id]=n,n}}}function Wi(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _t};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _t};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _t,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var Gi=0;function Ki(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function qi(e){let t=new Ui,n=Wi(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new g);let i=new g,a=new Ee,o=new Ee;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(Ki);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=$.LTC_FLOAT_1,r.rectAreaLTC2=$.LTC_FLOAT_2):(r.rectAreaLTC1=$.LTC_HALF_1,r.rectAreaLTC2=$.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=Gi++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function Ji(e){let t=new qi(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function Yi(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new Ji(e),t.set(n,[a])):r>=i.length?(a=new Ji(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var Xi=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Zi=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Qi=[new g(1,0,0),new g(-1,0,0),new g(0,1,0),new g(0,-1,0),new g(0,0,1),new g(0,0,-1)],$i=[new g(0,-1,0),new g(0,-1,0),new g(0,0,1),new g(0,0,-1),new g(0,-1,0),new g(0,-1,0)],ea=new Ee,ta=new g,na=new g;function ra(e,t,n){let r=new ae,i=new _t,a=new _t,o=new B,s=new tt,c=new Ne,l={},u=n.maxTextureSize,d={0:1,1:0,2:2},f=new U({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new _t},radius:{value:4}},vertexShader:Xi,fragmentShader:Zi}),p=f.clone();p.defines.HORIZONTAL_PASS=1;let m=new nt;m.setAttribute(`position`,new qe(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let h=new Z(m,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let _=this.type;this.render=function(t,n,s){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||t.length===0)return;this.type===2&&(ot(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let c=e.getRenderTarget(),l=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),f=e.state;f.setBlending(0),f.buffers.depth.getReversed()===!0?f.buffers.color.setClear(0,0,0,0):f.buffers.color.setClear(1,1,1,1),f.buffers.depth.setTest(!0),f.setScissorTest(!1);let p=_!==this.type;p&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let c=0,l=t.length;c<l;c++){let l=t[c],d=l.shadow;if(d===void 0){ot(`WebGLShadowMap:`,l,`has no shadow.`);continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;i.copy(d.mapSize);let m=d.getFrameExtents();i.multiply(m),a.copy(d.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(a.x=Math.floor(u/m.x),i.x=a.x*m.x,d.mapSize.x=a.x),i.y>u&&(a.y=Math.floor(u/m.y),i.y=a.y*m.y,d.mapSize.y=a.y));let h=e.state.buffers.depth.getReversed();if(d.camera._reversedDepth=h,d.map===null||p===!0){if(d.map!==null&&(d.map.depthTexture!==null&&(d.map.depthTexture.dispose(),d.map.depthTexture=null),d.map.dispose()),this.type===3){if(l.isPointLight){ot(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}d.map=new z(i.x,i.y,{format:K,type:k,minFilter:te,magFilter:te,generateMipmaps:!1}),d.map.texture.name=l.name+`.shadowMap`,d.map.depthTexture=new ut(i.x,i.y,Pe),d.map.depthTexture.name=l.name+`.shadowMapDepth`,d.map.depthTexture.format=ce,d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=it,d.map.depthTexture.magFilter=it}else l.isPointLight?(d.map=new Pn(i.x),d.map.depthTexture=new Oe(i.x,w)):(d.map=new z(i.x,i.y),d.map.depthTexture=new ut(i.x,i.y,w)),d.map.depthTexture.name=l.name+`.shadowMap`,d.map.depthTexture.format=ce,this.type===1?(d.map.depthTexture.compareFunction=h?518:515,d.map.depthTexture.minFilter=te,d.map.depthTexture.magFilter=te):(d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=it,d.map.depthTexture.magFilter=it);d.camera.updateProjectionMatrix()}d.map.isWebGLCubeRenderTarget!==!0&&(d.map.width!==i.x||d.map.height!==i.y)&&d.map.setSize(i.x,i.y);let g=d.map.isWebGLCubeRenderTarget?6:d.getViewportCount();l.isPointLight!==!0&&d.updateMatrices(l,s);for(let t=0;t<g;t++){let i=d.getCamera(t);if(l.isPointLight){let e=d.camera,n=d.matrix,r=l.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),ta.setFromMatrixPosition(l.matrixWorld),e.position.copy(ta),na.copy(e.position),na.add(Qi[t]),e.up.copy($i[t]),e.lookAt(na),e.updateMatrixWorld(),n.makeTranslation(-ta.x,-ta.y,-ta.z),ea.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),d._frustum.setFromProjectionMatrix(ea,e.coordinateSystem,e.reversedDepth)}if(d.map.isWebGLCubeRenderTarget)e.setRenderTarget(d.map,t),e.clear();else{t===0&&(e.setRenderTarget(d.map),e.clear());let n=d.getViewport(t);o.set(a.x*n.x,a.y*n.y,a.x*n.z,a.y*n.w),f.viewport(o)}r=d.getFrustum(t),b(n,s,i,l,this.type)}d.isPointLightShadow!==!0&&this.type===3&&v(d,s),d.needsUpdate=!1}_=this.type,g.needsUpdate=!1,e.setRenderTarget(c,l,d)};function v(n,r){let a=t.update(h);f.defines.VSM_SAMPLES!==n.blurSamples&&(f.defines.VSM_SAMPLES=n.blurSamples,p.defines.VSM_SAMPLES=n.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),n.mapPass===null?n.mapPass=new z(i.x,i.y,{format:K,type:k}):(n.mapPass.width!==n.map.width||n.mapPass.height!==n.map.height)&&n.mapPass.setSize(n.map.width,n.map.height),f.uniforms.shadow_pass.value=n.map.depthTexture,f.uniforms.resolution.value.set(n.map.width,n.map.height),f.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,f,h,null),p.uniforms.shadow_pass.value=n.mapPass.texture,p.uniforms.resolution.value.set(n.map.width,n.map.height),p.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,p,h,null)}function y(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?c:s,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=l[e];r===void 0&&(r={},l[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,x)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?d[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function b(n,i,a,o,s){if(n.visible===!1)return;if(n.layers.test(i.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||n.intersectsFrustum(r))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),c=n.material;if(Array.isArray(c)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=y(n,d,o,s);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(c.visible){let t=y(n,c,o,s);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)b(c[e],i,a,o,s)}function x(e){e.target.removeEventListener(`dispose`,x);for(let t in l){let n=l[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function ia(e,t){function n(){let t=!1,n=new B,r=null,i=new B(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?I(e.DEPTH_TEST):L(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=xe[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?I(e.STENCIL_TEST):L(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new q(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,ee=null,j=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),te=!1,ne=0,re=e.getParameter(e.VERSION);re.indexOf(`WebGL`)===-1?re.indexOf(`OpenGL ES`)!==-1&&(ne=parseFloat(/^OpenGL ES (\d)/.exec(re)[1]),te=ne>=2):(ne=parseFloat(/^WebGL (\d)/.exec(re)[1]),te=ne>=1);let ie=null,M={},ae=e.getParameter(e.SCISSOR_BOX),N=e.getParameter(e.VIEWPORT),oe=new B().fromArray(ae),P=new B().fromArray(N);function se(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let F={};F[e.TEXTURE_2D]=se(e.TEXTURE_2D,e.TEXTURE_2D,1),F[e.TEXTURE_CUBE_MAP]=se(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),F[e.TEXTURE_2D_ARRAY]=se(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),F[e.TEXTURE_3D]=se(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),I(e.DEPTH_TEST),o.setFunc(3),V(!1),pe(1),I(e.CULL_FACE),z(0);function I(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function L(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function ce(t,n){return f[t]!==n&&(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function le(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function R(t){return h!==t&&(e.useProgram(t),h=t,!0)}let ue={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};ue[103]=e.MIN,ue[104]=e.MAX;let de={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function z(t,n,r,i,a,o,s,c,l,u){if(t===0)g===!0&&(L(e.BLEND),g=!1);else if(g===!1&&(I(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:H(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:H(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:H(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:H(`WebGLState: Invalid blending: `,t)}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}}else a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(ue[n],ue[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(de[r],de[i],de[o],de[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function fe(t,n){t.side===2?L(e.CULL_FACE):I(e.CULL_FACE);let r=t.side===1;n&&(r=!r),V(r),t.blending===1&&t.transparent===!1?z(0):z(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),he(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?I(e.SAMPLE_ALPHA_TO_COVERAGE):L(e.SAMPLE_ALPHA_TO_COVERAGE)}function V(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function pe(t){t===0?L(e.CULL_FACE):(I(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function me(t){t!==k&&(te&&e.lineWidth(t),k=t)}function he(t,n,r){t?(I(e.POLYGON_OFFSET_FILL),(A!==n||ee!==r)&&(A=n,ee=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):L(e.POLYGON_OFFSET_FILL)}function ge(t){t?I(e.SCISSOR_TEST):L(e.SCISSOR_TEST)}function _e(t){t===void 0&&(t=e.TEXTURE0+j-1),ie!==t&&(e.activeTexture(t),ie=t)}function ve(t,n,r){r===void 0&&(r=ie===null?e.TEXTURE0+j-1:ie);let i=M[r];i===void 0&&(i={type:void 0,texture:void 0},M[r]=i),(i.type!==t||i.texture!==n)&&(ie!==r&&(e.activeTexture(r),ie=r),e.bindTexture(t,n||F[t]),i.type=t,i.texture=n)}function U(){let t=M[ie];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function ye(){try{e.compressedTexImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function be(){try{e.compressedTexImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function W(){try{e.texSubImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function G(){try{e.texSubImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Se(){try{e.compressedTexSubImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Ce(){try{e.compressedTexSubImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function we(){try{e.texStorage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function K(){try{e.texStorage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Te(){try{e.texImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Ee(){try{e.texImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function De(t){return d[t]===void 0?e.getParameter(t):d[t]}function Oe(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function ke(t){oe.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),oe.copy(t))}function J(t){P.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),P.copy(t))}function Ae(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Y(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function X(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},ie=null,M={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new q(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,ee=null,oe.set(0,0,e.canvas.width,e.canvas.height),P.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:I,disable:L,bindFramebuffer:ce,drawBuffers:le,useProgram:R,setBlending:z,setMaterial:fe,setFlipSided:V,setCullFace:pe,setLineWidth:me,setPolygonOffset:he,setScissorTest:ge,activeTexture:_e,bindTexture:ve,unbindTexture:U,compressedTexImage2D:ye,compressedTexImage3D:be,texImage2D:Te,texImage3D:Ee,pixelStorei:Oe,getParameter:De,updateUBOMapping:Ae,uniformBlockBinding:Y,texStorage2D:we,texStorage3D:K,texSubImage2D:W,texSubImage3D:G,compressedTexSubImage2D:Se,compressedTexSubImage3D:Ce,scissor:ke,viewport:J,reset:X}}function aa(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new _t,u=new WeakMap,d=new Set,f,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function h(e,t){return m?new OffscreenCanvas(e,t):j(`canvas`)}function g(e,t,n){let r=1,i=we(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=h(n,a));let o=t?h(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),ot(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&ot(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function v(e){return e.generateMipmaps}function y(t){e.generateMipmap(t)}function b(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function x(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];ot(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||ot(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?me:Xe.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function S(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,ot(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function C(e,t){return v(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function w(e){let t=e.target;t.removeEventListener(`dispose`,w),E(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&d.delete(t)}function T(e){let t=e.target;t.removeEventListener(`dispose`,T),O(t)}function E(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&D(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function D(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function O(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let k=0;function A(){k=0}function ne(){return k}function re(e){k=e}function ie(){let e=k;return e>=i.maxTextures&&ot(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),k+=1,e}function M(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function ae(t,i){let a=r.get(t);if(t.isVideoTexture&&G(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)ot(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)ot(`WebGLRenderer: Texture marked for update but image is incomplete`);else{ue(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function N(t,i){let a=r.get(t);t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version?ue(a,t,i):(t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null),n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i))}function oe(t,i){let a=r.get(t);t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version?ue(a,t,i):n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function P(t,i){let a=r.get(t);t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version?de(a,t,i):n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let se={[rt]:e.REPEAT,[Ce]:e.CLAMP_TO_EDGE,[Ye]:e.MIRRORED_REPEAT},F={[it]:e.NEAREST,[Be]:e.NEAREST_MIPMAP_NEAREST,[Se]:e.NEAREST_MIPMAP_LINEAR,[te]:e.LINEAR,[ee]:e.LINEAR_MIPMAP_NEAREST,[Qe]:e.LINEAR_MIPMAP_LINEAR},I={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function L(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&ot(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,se[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,se[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,se[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,F[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,F[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,I[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function ce(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,w));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=M(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&D(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function le(e,t,n){return Math.floor(Math.floor(e/n)/t)}function R(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=le(n.start,r.width,4),c=le(t.start,r.width,4);n.start<=i+1&&a===c&&le(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function ue(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=ce(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Xe.getPrimaries(Xe.workingColorSpace),r=o.colorSpace===``?null:Xe.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=g(o.image,!1,i.maxTextureSize);t=xe(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=x(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);L(c,o);let h,b=o.mipmaps,w=o.isVideoTexture!==!0,T=f.__version===void 0||l===!0,E=u.dataReady,D=C(o,t);if(o.isDepthTexture)m=S(o.format===_,o.type),T&&(w?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture){if(b.length>0){w&&T&&n.texStorage2D(e.TEXTURE_2D,D,m,b[0].width,b[0].height);for(let t=0,i=b.length;t<i;t++)h=b[t],w?E&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else w?(T&&n.texStorage2D(e.TEXTURE_2D,D,m,t.width,t.height),E&&R(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data)}else if(o.isCompressedTexture){if(o.isCompressedArrayTexture){w&&T&&n.texStorage3D(e.TEXTURE_2D_ARRAY,D,m,b[0].width,b[0].height,t.depth);for(let i=0,a=b.length;i<a;i++)if(h=b[i],o.format!==1023){if(r!==null){if(w){if(E){if(o.layerUpdates.size>0){let t=he(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0)}else ot(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else w?E&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{w&&T&&n.texStorage2D(e.TEXTURE_2D,D,m,b[0].width,b[0].height);for(let t=0,i=b.length;t<i;t++)h=b[t],o.format===1023?w?E&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?ot(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):w?E&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}}else if(o.isDataArrayTexture){if(w){if(T&&n.texStorage3D(e.TEXTURE_2D_ARRAY,D,m,t.width,t.height,t.depth),E){if(o.layerUpdates.size>0){let i=he(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data)}else if(o.isData3DTexture)w?(T&&n.texStorage3D(e.TEXTURE_3D,D,m,t.width,t.height,t.depth),E&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(T){if(w)n.texStorage2D(e.TEXTURE_2D,D,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<D;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(b.length>0){if(w&&T){let t=we(b[0]);n.texStorage2D(e.TEXTURE_2D,D,m,t.width,t.height)}for(let t=0,i=b.length;t<i;t++)h=b[t],w?E&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(w){if(T){let r=we(t);n.texStorage2D(e.TEXTURE_2D,D,m,r.width,r.height)}E&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);v(o)&&y(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function de(t,o,s){if(o.image.length!==6)return;let c=ce(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Xe.getPrimaries(Xe.workingColorSpace),r=o.colorSpace===``?null:Xe.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=g(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=xe(o,m[e]);let h=m[0],_=a.convert(o.format,o.colorSpace),b=a.convert(o.type),S=x(o.internalFormat,_,b,o.normalized,o.colorSpace),w=o.isVideoTexture!==!0,T=u.__version===void 0||c===!0,E=l.dataReady,D=C(o,h);L(e.TEXTURE_CUBE_MAP,o);let O;if(f){w&&T&&n.texStorage2D(e.TEXTURE_CUBE_MAP,D,S,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,_,b,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,S,i.width,i.height,0,_,b,i.data):_===null?ot(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):w?E&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,_,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,S,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,w&&T){O.length>0&&D++;let t=we(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,D,S,t.width,t.height)}for(let t=0;t<6;t++)if(p){w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,_,b,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,S,m[t].width,m[t].height,0,_,b,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,_,b,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,S,i.width,i.height,0,_,b,i.data)}}else{w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,_,b,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,S,_,b,m[t]);for(let r=0;r<O.length;r++){let i=O[r];w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,_,b,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,S,_,b,i.image[t])}}}v(o)&&y(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function z(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=x(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),W(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,be(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function fe(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=S(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;W(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,be(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,be(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=x(o.internalFormat,c,l,o.normalized,o.colorSpace);W(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,be(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,be(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function B(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,l.__webglTexture&&i.depthTexture.image.width===i.width&&i.depthTexture.image.height===i.height||(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,w)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),L(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else ae(i.depthTexture,0);let u=l.__webglTexture,d=be(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)W(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)W(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function V(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer){if(a)for(let e=0;e<6;e++)B(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?B(i.__webglFramebuffer[0],t,0):B(i.__webglFramebuffer,t,0)}}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),fe(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),fe(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function pe(t,n,i){let a=r.get(t);n!==void 0&&z(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&V(t)}function ge(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,T);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&W(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=x(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=be(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),fe(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),L(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)z(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else z(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);v(i)&&y(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),L(c,a),z(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),v(a)&&y(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),L(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)z(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else z(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);v(i)&&y(r),n.unbindTexture()}t.depthBuffer&&V(t)}function _e(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(v(a)){let t=b(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),y(t),n.unbindTexture()}}}let ve=[],U=[];function ye(t){if(t.samples>0){if(W(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(ve.length=0,U.length=0,ve.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&(ve.push(l),U.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,U)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,ve))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function be(e){return Math.min(i.maxSamples,e.samples)}function W(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function G(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function xe(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Xe.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&ot(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):H(`WebGLTextures: Unsupported texture color space:`,n)),t}function we(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=ie,this.resetTextureUnits=A,this.getTextureUnits=ne,this.setTextureUnits=re,this.setTexture2D=ae,this.setTexture2DArray=N,this.setTexture3D=oe,this.setTextureCube=P,this.rebindTextures=pe,this.setupRenderTarget=ge,this.updateRenderTargetMipmap=_e,this.updateMultisampleRenderTarget=ye,this.setupDepthRenderbuffer=V,this.setupFrameBufferTexture=z,this.useMultisampledRTT=W,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function oa(e,t){function n(n,r=``){let i,a=Xe.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var sa=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,ca=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,la=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Ie(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new U({vertexShader:sa,fragmentShader:ca,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Z(new He(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},ua=class extends oe{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,d=null,f=null,p=null,m=typeof XRWebGLBinding<`u`,h=new la,v={},b=t.getContextAttributes(),x=null,S=null,C=[],T=[],E=new _t,D=null,O=null,k=new De;k.viewport=new B;let A=new De;A.viewport=new B;let ee=[k,A],j=new et,te=null,ne=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=C[e];return t===void 0&&(t=new pe,C[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=C[e];return t===void 0&&(t=new pe,C[e]=t),t.getGripSpace()},this.getHand=function(e){let t=C[e];return t===void 0&&(t=new pe,C[e]=t),t.getHandSpace()};function re(e){let t=T.indexOf(e.inputSource);if(t===-1)return;let n=C[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ie(){r.removeEventListener(`select`,re),r.removeEventListener(`selectstart`,re),r.removeEventListener(`selectend`,re),r.removeEventListener(`squeeze`,re),r.removeEventListener(`squeezestart`,re),r.removeEventListener(`squeezeend`,re),r.removeEventListener(`end`,ie),r.removeEventListener(`inputsourceschange`,M);for(let e=0;e<C.length;e++){let t=T[e];t!==null&&(T[e]=null,C[e].disconnect(t))}te=null,ne=null,h.reset();for(let e in v)delete v[e];if(e.setRenderTarget(x),f=null,d=null,u=null,r=null,S=null,le.stop(),n.isPresenting=!1,e.setPixelRatio(D),e.setSize(E.width,E.height,!1),O!==null){let e=O.camera;e.fov=O.fov,e.zoom=O.zoom,e.updateProjectionMatrix(),O=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&ot(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&ot(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return d===null?f:d},this.getBinding=function(){return u===null&&m&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return p},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(x=e.getRenderTarget(),r.addEventListener(`select`,re),r.addEventListener(`selectstart`,re),r.addEventListener(`selectend`,re),r.addEventListener(`squeeze`,re),r.addEventListener(`squeezestart`,re),r.addEventListener(`squeezeend`,re),r.addEventListener(`end`,ie),r.addEventListener(`inputsourceschange`,M),b.xrCompatible!==!0&&await t.makeXRCompatible(),D=e.getPixelRatio(),e.getSize(E),m&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;b.depth&&(o=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=b.stencil?_:ce,a=b.stencil?N:w);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),d=u.createProjectionLayer(s),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),S=new z(d.textureWidth,d.textureHeight,{format:y,type:Fe,depthTexture:new ut(d.textureWidth,d.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let n={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:i};f=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),S=new z(f.framebufferWidth,f.framebufferHeight,{format:y,type:Fe,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),le.setContext(r),le.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function M(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=T.indexOf(n);r>=0&&(T[r]=null,C[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=T.indexOf(n);if(r===-1){for(let e=0;e<C.length;e++)if(e>=T.length){T.push(n),r=e;break}else if(T[e]===null){T[e]=n,r=e;break}if(r===-1)break}let i=C[r];i&&i.connect(n)}}let ae=new g,oe=new g;function P(e,t,n){ae.setFromMatrixPosition(t.matrixWorld),oe.setFromMatrixPosition(n.matrixWorld);let r=ae.distanceTo(oe),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function se(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;h.texture!==null&&(h.depthNear>0&&(t=h.depthNear),h.depthFar>0&&(n=h.depthFar)),j.near=A.near=k.near=t,j.far=A.far=k.far=n,(te!==j.near||ne!==j.far)&&(r.updateRenderState({depthNear:j.near,depthFar:j.far}),te=j.near,ne=j.far),j.layers.mask=e.layers.mask|6,k.layers.mask=j.layers.mask&-5,A.layers.mask=j.layers.mask&-3;let i=e.parent,a=j.cameras;se(j,i);for(let e=0;e<a.length;e++)se(a[e],i);a.length===2?P(j,k,A):j.projectionMatrix.copy(k.projectionMatrix),O===null&&e.isPerspectiveCamera&&(O={camera:e,fov:e.fov,zoom:e.zoom}),F(e,j,i)};function F(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=ht*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return j},this.getFoveation=function(){if(d!==null||f!==null)return s},this.setFoveation=function(e){s=e,d!==null&&(d.fixedFoveation=e),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=e)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(j)},this.getCameraTexture=function(e){return v[e]};let I=null;function L(t,i){if(l=i.getViewerPose(c||a),p=i,l!==null){let t=l.views;f!==null&&(e.setRenderTargetFramebuffer(S,f.framebuffer),e.setRenderTarget(S));let i=!1;t.length!==j.cameras.length&&(j.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(f!==null)a=f.getViewport(r);else{let t=u.getViewSubImage(d,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(S,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(S))}let o=ee[n];o===void 0&&(o=new De,o.layers.enable(n),o.viewport=new B,ee[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(j.matrix.copy(o.matrix),j.matrix.decompose(j.position,j.quaternion,j.scale)),i===!0&&j.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&m){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&h.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&m){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=v[n];e||(e=new Ie,v[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<C.length;e++){let t=T[e],n=C[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}I&&I(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),p=null}let le=new tn;le.setAnimationLoop(L),this.setAnimationLoop=function(e){I=e},this.dispose=function(){}}},da=new Ee,fa=new f;fa.set(-1,0,0,0,1,0,0,0,1);function pa(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,_e(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(da.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(fa),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function ma(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return H(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return r[a]=typeof i==`number`||typeof i==`boolean`?i:ArrayBuffer.isView(i)?i.slice():i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?ot(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):ot(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var ha=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),ga=null;function _a(){return ga===null&&(ga=new ft(ha,16,16,K,k),ga.name=`DFG_LUT`,ga.minFilter=te,ga.magFilter=te,ga.wrapS=Ce,ga.wrapT=Ce,ga.generateMipmaps=!1,ga.needsUpdate=!0),ga}var va=class{constructor(e={}){let{canvas:t=$e(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=Fe}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);p=n.getContextAttributes().alpha}else p=a;let m=f,h=new Set([dt,at,Je]),_=new Set([Fe,w,L,N,A,ie]),v=new Uint32Array(4),y=new Int32Array(4),b=new g,x=null,S=null,C=[],T=[],E=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let D=this,ee=!1,j=null,te=null,ne=null,re=null;this._outputColorSpace=Ve;let M=0,oe=0,P=null,se=-1,I=null,ce=new B,le=new B,R=null,ue=new q(0),de=0,fe=t.width,V=t.height,pe=1,me=null,he=null,ge=new B(0,0,fe,V),_e=new B(0,0,fe,V),ve=!1,U=new ae,ye=!1,be=!1,W=new Ee,G=new g,xe=new B,Se={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ce=!1;function we(){return P===null?pe:1}let K=n;function De(e,n){return t.getContext(e,n)}let Oe,ke,J,Ae,Y,X,je,Me,Ne,Pe,Ie,Le,Re,ze,Be,He,Ue,We,Ge,Ke,qe,Ye,Ze;try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,nt,!1),t.addEventListener(`webglcontextrestored`,rt,!1),t.addEventListener(`webglcontextcreationerror`,it,!1),K===null){let t=`webgl2`;if(K=De(t,e),K===null)throw De(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}et()}catch(e){throw t.removeEventListener(`webglcontextlost`,nt,!1),t.removeEventListener(`webglcontextrestored`,rt,!1),t.removeEventListener(`webglcontextcreationerror`,it,!1),H(`WebGLRenderer: `+e.message),e}function et(){Oe=new In(K),Oe.init(),qe=new oa(K,Oe),ke=new dn(K,Oe,e,qe),J=new ia(K,Oe),ke.reversedDepthBuffer&&d&&J.buffers.depth.setReversed(!0),te=K.createFramebuffer(),ne=K.createFramebuffer(),re=K.createFramebuffer(),Ae=new zn(K),Y=new Ri,X=new aa(K,Oe,J,Y,ke,qe,Ae),je=new Fn(D),Me=new nn(K),Ye=new ln(K,Me),Ne=new Ln(K,Me,Ae,Ye),Pe=new Vn(K,Ne,Me,Ye,Ae),We=new Bn(K,ke,X),Be=new fn(Y),Ie=new Li(D,je,Oe,ke,Ye,Be),Le=new pa(D,Y),Re=new Hi,ze=new Yi(Oe),Ue=new cn(D,je,J,Pe,p,s),He=new ra(D,Pe,ke),Ze=new ma(K,Ae,ke,J),Ge=new un(K,Oe,Ae),Ke=new Rn(K,Oe,Ae),Ae.programs=Ie.programs,D.capabilities=ke,D.extensions=Oe,D.properties=Y,D.renderLists=Re,D.shadowMap=He,D.state=J,D.info=Ae}m!==1009&&(E=new Un(m,t.width,t.height,o,r,i));let tt=new ua(D,K);this.xr=tt,this.getContext=function(){return K},this.getContextAttributes=function(){return K.getContextAttributes()},this.forceContextLoss=function(){let e=Oe.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=Oe.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return pe},this.setPixelRatio=function(e){e!==void 0&&(pe=e,this.setSize(fe,V,!1))},this.getSize=function(e){return e.set(fe,V)},this.setSize=function(e,n,r=!0){tt.isPresenting?ot(`WebGLRenderer: Can't change size while VR device is presenting.`):(fe=e,V=n,t.width=Math.floor(e*pe),t.height=Math.floor(n*pe),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),E!==null&&E.setSize(t.width,t.height),this.setViewport(0,0,e,n))},this.getDrawingBufferSize=function(e){return e.set(fe*pe,V*pe).floor()},this.setDrawingBufferSize=function(e,n,r){fe=e,V=n,pe=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(m===1009)H(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);else{if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){ot(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}E.setEffects(e||[])}},this.getCurrentViewport=function(e){return e.copy(ce)},this.getViewport=function(e){return e.copy(ge)},this.setViewport=function(e,t,n,r){e.isVector4?ge.set(e.x,e.y,e.z,e.w):ge.set(e,t,n,r),J.viewport(ce.copy(ge).multiplyScalar(pe).round())},this.getScissor=function(e){return e.copy(_e)},this.setScissor=function(e,t,n,r){e.isVector4?_e.set(e.x,e.y,e.z,e.w):_e.set(e,t,n,r),J.scissor(le.copy(_e).multiplyScalar(pe).round())},this.getScissorTest=function(){return ve},this.setScissorTest=function(e){J.setScissorTest(ve=e)},this.setOpaqueSort=function(e){me=e},this.setTransparentSort=function(e){he=e},this.getClearColor=function(e){return e.copy(Ue.getClearColor())},this.setClearColor=function(){Ue.setClearColor(...arguments)},this.getClearAlpha=function(){return Ue.getClearAlpha()},this.setClearAlpha=function(){Ue.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(P!==null){let t=P.texture.format;e=h.has(t)}if(e){let e=P.texture.type,t=_.has(e),n=Ue.getClearColor(),r=Ue.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(v[0]=i,v[1]=a,v[2]=o,v[3]=r,K.clearBufferuiv(K.COLOR,0,v)):(y[0]=i,y[1]=a,y[2]=o,y[3]=r,K.clearBufferiv(K.COLOR,0,y))}else r|=K.COLOR_BUFFER_BIT}t&&(r|=K.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=K.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&K.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),j=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,nt,!1),t.removeEventListener(`webglcontextrestored`,rt,!1),t.removeEventListener(`webglcontextcreationerror`,it,!1),Ue.dispose(),Re.dispose(),ze.dispose(),Y.dispose(),je.dispose(),Pe.dispose(),Ye.dispose(),Ze.dispose(),Ie.dispose(),tt.dispose(),tt.removeEventListener(`sessionstart`,pt),tt.removeEventListener(`sessionend`,mt),ht.stop()};function nt(e){e.preventDefault(),F(`WebGLRenderer: Context Lost.`),ee=!0}function rt(){F(`WebGLRenderer: Context Restored.`),ee=!1;let e=Ae.autoReset,t=He.enabled,n=He.autoUpdate,r=He.needsUpdate,i=He.type;et(),Ae.autoReset=e,He.enabled=t,He.autoUpdate=n,He.needsUpdate=r,He.type=i}function it(e){H(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function Z(e){let t=e.target;t.removeEventListener(`dispose`,Z),st(t)}function st(e){ct(e),Y.remove(e)}function ct(e){let t=Y.get(e).programs;t!==void 0&&(t.forEach(function(e){Ie.releaseProgram(e)}),e.isShaderMaterial&&Ie.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=Se);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=Tt(e,t,n,r,i);J.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Ne.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;Ye.setup(i,r,s,n,c);let h,g=Ge;if(c!==null&&(h=Me.get(c),g=Ke,g.setIndex(h)),i.isMesh)r.wireframe===!0?(J.setLineWidth(r.wireframeLinewidth*we()),g.setMode(K.LINES)):g.setMode(K.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),J.setLineWidth(e*we()),i.isLineSegments?g.setMode(K.LINES):i.isLineLoop?g.setMode(K.LINE_LOOP):g.setMode(K.LINE_STRIP)}else i.isPoints?g.setMode(K.POINTS):i.isSprite&&g.setMode(K.TRIANGLES);if(i.isBatchedMesh){if(Oe.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?Me.get(c).bytesPerElement:1,o=Y.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(K,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function lt(e,t,n,r){j!==null&&e.isNodeMaterial&&j.setObject(r,e),ye===!0&&Be.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,xt(e,t,r),e.side=0,e.needsUpdate=!0,xt(e,t,r),e.side=2):xt(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),j!==null&&j.renderStart(e,t,n),S=ze.get(n),S.init(t),T.push(S),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(S.pushLight(e),e.castShadow&&S.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(S.pushLight(e),e.castShadow&&S.pushShadow(e))}),S.setupLights(),j!==null&&j.updateLights(S.state.lightsArray),be=this.localClippingEnabled,ye=Be.init(this.clippingPlanes,be),ye===!0&&Be.setGlobalState(this.clippingPlanes,t),j!==null&&He.render(S.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i){if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];lt(o,n,t,e),r.add(o)}else lt(i,n,t,e),r.add(i)}}),S=T.pop(),j!==null&&j.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){r.forEach(function(e){let t=Y.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0?t(e):setTimeout(n,10)}Oe.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let ut=null;function ft(e){ut&&ut(e)}function pt(){ht.stop()}function mt(){ht.start()}let ht=new tn;ht.setAnimationLoop(ft),typeof self<`u`&&ht.setContext(self),this.setAnimationLoop=function(e){ut=e,tt.setAnimationLoop(e),e===null?ht.stop():ht.start()},tt.addEventListener(`sessionstart`,pt),tt.addEventListener(`sessionend`,mt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){H(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(ee===!0)return;j!==null&&j.renderStart(e,t);let n=tt.enabled===!0&&tt.isPresenting===!0,r=E!==null&&(P===null||n)&&E.begin(D,P);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),tt.enabled===!0&&tt.isPresenting===!0&&(E===null||E.isCompositing()===!1)&&(tt.cameraAutoUpdate===!0&&tt.updateCamera(t),t=tt.getCamera()),e.isScene===!0&&e.onBeforeRender(D,e,t,P),S=ze.get(e,T.length),S.init(t),S.state.textureUnits=X.getTextureUnits(),T.push(S),W.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),U.setFromProjectionMatrix(W,O,t.reversedDepth),be=this.localClippingEnabled,ye=Be.init(this.clippingPlanes,be),x=Re.get(e,C.length),x.init(),C.push(x),tt.enabled===!0&&tt.isPresenting===!0){let e=D.xr.getDepthSensingMesh();e!==null&&gt(e,t,-1/0,D.sortObjects)}gt(e,t,0,D.sortObjects),x.finish(),j!==null&&j.updateLights(S.state.lightsArray),D.sortObjects===!0&&x.sort(me,he),Ce=tt.enabled===!1||tt.isPresenting===!1||tt.hasDepthSensing()===!1,Ce&&Ue.addToRenderList(x,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ye===!0&&Be.beginShadows();let i=S.state.shadowsArray;if(He.render(i,e,t),ye===!0&&Be.endShadows(),(r&&E.hasRenderPass())===!1){let n=x.opaque,r=x.transmissive;if(S.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];vt(n,r,e,a)}Ce&&Ue.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];_t(x,e,n,n.viewport)}}else r.length>0&&vt(n,r,e,t),Ce&&Ue.render(e),_t(x,e,t)}P!==null&&oe===0&&(X.updateMultisampleRenderTarget(P),X.updateRenderTargetMipmap(P)),r&&E.end(D),e.isScene===!0&&e.onAfterRender(D,e,t),Ye.resetDefaultState(),se=-1,I=null,T.pop(),T.length>0?(S=T[T.length-1],X.setTextureUnits(S.state.textureUnits),ye===!0&&Be.setGlobalState(D.clippingPlanes,S.state.camera)):S=null,C.pop(),x=C.length>0?C[C.length-1]:null,j!==null&&j.renderEnd()};function gt(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)S.pushLightProbeGrid(e);else if(e.isLight)S.pushLight(e),e.castShadow&&S.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(U)){r&&xe.setFromMatrixPosition(e.matrixWorld).applyMatrix4(W);let i=Pe.update(e),a=e.material;a.visible&&x.push(e,i,a,n,xe.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(U))){let i=Pe.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),xe.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),xe.copy(e.boundingSphere.center)),xe.applyMatrix4(e.matrixWorld).applyMatrix4(W)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&x.push(e,i,c,n,xe.z,s,t)}}else a.visible&&x.push(e,i,a,n,xe.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)gt(i[e],t,n,r)}function _t(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;S.setupLightsView(n),ye===!0&&Be.setGlobalState(D.clippingPlanes,n),r&&J.viewport(ce.copy(r)),i.length>0&&yt(i,t,n),a.length>0&&yt(a,t,n),o.length>0&&yt(o,t,n),J.buffers.depth.setTest(!0),J.buffers.depth.setMask(!0),J.buffers.color.setMask(!0),J.setPolygonOffset(!1)}function vt(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[r.id]===void 0){let e=Oe.has(`EXT_color_buffer_half_float`)||Oe.has(`EXT_color_buffer_float`);S.state.transmissionRenderTarget[r.id]=new z(1,1,{generateMipmaps:!0,type:e?k:Fe,minFilter:Qe,samples:Math.max(4,ke.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Xe.workingColorSpace})}let a=S.state.transmissionRenderTarget[r.id],o=r.viewport||ce;a.setSize(o.z*D.transmissionResolutionScale,o.w*D.transmissionResolutionScale);let s=D.getRenderTarget(),c=D.getActiveCubeFace(),l=D.getActiveMipmapLevel();D.setRenderTarget(a),D.getClearColor(ue),de=D.getClearAlpha(),de<1&&D.setClearColor(16777215,.5),D.clear(),Ce&&Ue.render(n);let u=D.toneMapping;D.toneMapping=0;let d=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),S.setupLightsView(r),ye===!0&&Be.setGlobalState(D.clippingPlanes,r),yt(e,n,r),X.updateMultisampleRenderTarget(a),X.updateRenderTargetMipmap(a),Oe.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,bt(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(X.updateMultisampleRenderTarget(a),X.updateRenderTargetMipmap(a))}D.setRenderTarget(s,c,l),D.setClearColor(ue,de),d!==void 0&&(r.viewport=d),D.toneMapping=u}function yt(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&bt(o,t,n,s,l,c)}}function bt(e,t,n,r,i,a){j!==null&&i.isNodeMaterial&&j.setObject(e,i),e.onBeforeRender(D,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(D,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,D.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,D.renderBufferDirect(n,t,r,i,e,a),i.side=2):D.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(D,t,n,r,i,a)}function xt(e,t,n){t.isScene!==!0&&(t=Se);let r=Y.get(e),i=S.state.lights,a=S.state.shadowsArray,o=i.state.version,s=Ie.getParameters(e,i.state,a,t,n,S.state.lightProbeGridArray),c=Ie.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=je.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,Z),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return Ct(e,s),d}else s.uniforms=Ie.getUniforms(e),j!==null&&e.isNodeMaterial&&j.build(e,n,s),e.onBeforeCompile(s,D),d=Ie.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Be.uniform),Ct(e,s),r.needsLights=Dt(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=S.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function St(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=Xr.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function Ct(e,t){let n=Y.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function wt(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];b.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(b))return n}return null}function Tt(e,t,n,r,i){t.isScene!==!0&&(t=Se),X.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=P===null?D.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:Xe.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=je.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(h=D.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=Y.get(r),y=S.state.lights;if(ye===!0&&(be===!0||e!==I)){let t=e===I&&r.id===se;Be.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Be.numPlanes||v.numIntersection!==Be.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=S.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let x=v.currentProgram;b===!0&&(x=xt(r,t,i),j&&r.isNodeMaterial&&j.onUpdateProgram(r,x,v));let C=!1,w=!1,T=!1,E=x.getUniforms(),O=v.uniforms;if(J.useProgram(x.program)&&(C=!0,w=!0,T=!0),r.id!==se&&(se=r.id,w=!0),v.needsLights){let e=wt(S.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,w=!0)}if(C||I!==e){J.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),E.setValue(K,`projectionMatrix`,e.projectionMatrix),E.setValue(K,`viewMatrix`,e.matrixWorldInverse);let t=E.map.cameraPosition;t!==void 0&&t.setValue(K,G.setFromMatrixPosition(e.matrixWorld)),ke.logarithmicDepthBuffer&&E.setValue(K,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&E.setValue(K,`isOrthographic`,e.isOrthographicCamera===!0),I!==e&&(I=e,w=!0,T=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&E.setValue(K,`sunShadowMap`,y.state.sunShadowMap,X),y.state.directionalShadowMap.length>0&&E.setValue(K,`directionalShadowMap`,y.state.directionalShadowMap,X),y.state.spotShadowMap.length>0&&E.setValue(K,`spotShadowMap`,y.state.spotShadowMap,X),y.state.pointShadowMap.length>0&&E.setValue(K,`pointShadowMap`,y.state.pointShadowMap,X)),i.isSkinnedMesh){E.setOptional(K,i,`bindMatrix`),E.setOptional(K,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),E.setValue(K,`boneTexture`,e.boneTexture,X))}i.isBatchedMesh&&(E.setOptional(K,i,`batchingTexture`),E.setValue(K,`batchingTexture`,i._matricesTexture,X),E.setOptional(K,i,`batchingIdTexture`),E.setValue(K,`batchingIdTexture`,i._indirectTexture,X),E.setOptional(K,i,`batchingColorTexture`),i._colorsTexture!==null&&E.setValue(K,`batchingColorTexture`,i._colorsTexture,X));let k=n.morphAttributes;if((k.position!==void 0||k.normal!==void 0||k.color!==void 0)&&We.update(i,n,x),(w||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,E.setValue(K,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(O.envMapIntensity.value=t.environmentIntensity),O.dfgLUT!==void 0&&(O.dfgLUT.value=_a()),w){if(E.setValue(K,`toneMappingExposure`,D.toneMappingExposure),v.needsLights&&Et(O,T),a&&r.fog===!0&&Le.refreshFogUniforms(O,a),Le.refreshMaterialUniforms(O,r,pe,V,S.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;O.probesSH.value=e.texture,O.probesMin.value.copy(e.boundingBox.min),O.probesMax.value.copy(e.boundingBox.max),O.probesResolution.value.copy(e.resolution)}Xr.upload(K,St(v),O,X)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(Xr.upload(K,St(v),O,X),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&E.setValue(K,`center`,i.center),E.setValue(K,`modelViewMatrix`,i.modelViewMatrix),E.setValue(K,`normalMatrix`,i.normalMatrix),E.setValue(K,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];Ze.update(n,x),Ze.bind(n,x)}}return x}function Et(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function Dt(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return M},this.getActiveMipmapLevel=function(){return oe},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(e,t,n){let r=Y.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),Y.get(e.texture).__webglTexture=t,Y.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=Y.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){P=e,M=t,oe=n;let r=null,i=!1,a=!1;if(e){let o=Y.get(e);if(o.__useDefaultFramebuffer!==void 0){J.bindFramebuffer(K.FRAMEBUFFER,o.__webglFramebuffer),ce.copy(e.viewport),le.copy(e.scissor),R=e.scissorTest,J.viewport(ce),J.scissor(le),J.setScissorTest(R),se=-1;return}if(o.__webglFramebuffer===void 0)X.setupRenderTarget(e);else if(o.__hasExternalTextures)X.rebindTextures(e,Y.get(e.texture).__webglTexture,Y.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&Y.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);X.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=Y.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&X.useMultisampledRTT(e)===!1?Y.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,ce.copy(e.viewport),le.copy(e.scissor),R=e.scissorTest}else ce.copy(ge).multiplyScalar(pe).floor(),le.copy(_e).multiplyScalar(pe).floor(),R=ve;if(n!==0&&(r=te),J.bindFramebuffer(K.FRAMEBUFFER,r)&&J.drawBuffers(e,r),J.viewport(ce),J.scissor(le),J.setScissorTest(R),i){let r=Y.get(e.texture);K.framebufferTexture2D(K.FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=Y.get(e.textures[t]);K.framebufferTextureLayer(K.FRAMEBUFFER,K.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=Y.get(e.texture);K.framebufferTexture2D(K.FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_2D,t.__webglTexture,n)}se=-1};function Ot(e){let t=Y.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=ke.textureFormatReadable(e.format),t.__typeReadable=ke.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=Y.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){J.bindFramebuffer(K.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&K.readBuffer(K.COLOR_ATTACHMENT0+s);let u=Ot(o);if(u.__formatReadable===!1){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&K.readPixels(t,n,r,i,qe.convert(c),qe.convert(l),a)}finally{let e=P===null?null:Y.get(P).__webglFramebuffer;J.bindFramebuffer(K.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=Y.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){J.bindFramebuffer(K.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&K.readBuffer(K.COLOR_ATTACHMENT0+s);let d=Ot(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=K.createBuffer();K.bindBuffer(K.PIXEL_PACK_BUFFER,f),K.bufferData(K.PIXEL_PACK_BUFFER,a.byteLength,K.STREAM_READ),K.readPixels(t,n,r,i,qe.convert(l),qe.convert(u),0),K.bindBuffer(K.PIXEL_PACK_BUFFER,null);let p=P===null?null:Y.get(P).__webglFramebuffer;J.bindFramebuffer(K.FRAMEBUFFER,p);let m=K.fenceSync(K.SYNC_GPU_COMMANDS_COMPLETE,0);return K.flush(),await Te(K,m,4),K.bindBuffer(K.PIXEL_PACK_BUFFER,f),K.getBufferSubData(K.PIXEL_PACK_BUFFER,0,a),K.bindBuffer(K.PIXEL_PACK_BUFFER,null),K.deleteBuffer(f),K.deleteSync(m),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;X.setTexture2D(e,0),K.copyTexSubImage2D(K.TEXTURE_2D,n,0,0,o,s,i,a),J.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=qe.convert(t.format),_=qe.convert(t.type),v;t.isData3DTexture?(X.setTexture3D(t,0),v=K.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(X.setTexture2DArray(t,0),v=K.TEXTURE_2D_ARRAY):(X.setTexture2D(t,0),v=K.TEXTURE_2D),J.activeTexture(K.TEXTURE0),J.pixelStorei(K.UNPACK_FLIP_Y_WEBGL,t.flipY),J.pixelStorei(K.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),J.pixelStorei(K.UNPACK_ALIGNMENT,t.unpackAlignment);let y=J.getParameter(K.UNPACK_ROW_LENGTH),b=J.getParameter(K.UNPACK_IMAGE_HEIGHT),x=J.getParameter(K.UNPACK_SKIP_PIXELS),S=J.getParameter(K.UNPACK_SKIP_ROWS),C=J.getParameter(K.UNPACK_SKIP_IMAGES);J.pixelStorei(K.UNPACK_ROW_LENGTH,h.width),J.pixelStorei(K.UNPACK_IMAGE_HEIGHT,h.height),J.pixelStorei(K.UNPACK_SKIP_PIXELS,l),J.pixelStorei(K.UNPACK_SKIP_ROWS,u),J.pixelStorei(K.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=Y.get(e),r=Y.get(t),h=Y.get(n.__renderTarget),g=Y.get(r.__renderTarget);J.bindFramebuffer(K.READ_FRAMEBUFFER,h.__webglFramebuffer),J.bindFramebuffer(K.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(K.framebufferTextureLayer(K.READ_FRAMEBUFFER,K.COLOR_ATTACHMENT0,Y.get(e).__webglTexture,i,d+n),K.framebufferTextureLayer(K.DRAW_FRAMEBUFFER,K.COLOR_ATTACHMENT0,Y.get(t).__webglTexture,a,m+n)),K.blitFramebuffer(l,u,o,s,f,p,o,s,K.DEPTH_BUFFER_BIT,K.NEAREST);J.bindFramebuffer(K.READ_FRAMEBUFFER,null),J.bindFramebuffer(K.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||Y.has(e)){let n=Y.get(e),r=Y.get(t);J.bindFramebuffer(K.READ_FRAMEBUFFER,ne),J.bindFramebuffer(K.DRAW_FRAMEBUFFER,re);for(let e=0;e<c;e++)w?K.framebufferTextureLayer(K.READ_FRAMEBUFFER,K.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):K.framebufferTexture2D(K.READ_FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_2D,n.__webglTexture,i),T?K.framebufferTextureLayer(K.DRAW_FRAMEBUFFER,K.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):K.framebufferTexture2D(K.DRAW_FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_2D,r.__webglTexture,a),i===0?T?K.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):K.copyTexSubImage2D(v,a,f,p,l,u,o,s):K.blitFramebuffer(l,u,o,s,f,p,o,s,K.COLOR_BUFFER_BIT,K.NEAREST);J.bindFramebuffer(K.READ_FRAMEBUFFER,null),J.bindFramebuffer(K.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?K.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?K.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):K.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?K.texSubImage2D(K.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?K.compressedTexSubImage2D(K.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):K.texSubImage2D(K.TEXTURE_2D,a,f,p,o,s,g,_,h);J.pixelStorei(K.UNPACK_ROW_LENGTH,y),J.pixelStorei(K.UNPACK_IMAGE_HEIGHT,b),J.pixelStorei(K.UNPACK_SKIP_PIXELS,x),J.pixelStorei(K.UNPACK_SKIP_ROWS,S),J.pixelStorei(K.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&K.generateMipmap(v),J.unbindTexture()},this.initRenderTarget=function(e){Y.get(e).__webglFramebuffer===void 0&&X.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?X.setTextureCube(e,0):e.isData3DTexture?X.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?X.setTexture2DArray(e,0):X.setTexture2D(e,0),J.unbindTexture()},this.resetState=function(){M=0,oe=0,P=null,J.reset(),Ye.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return O}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Xe._getDrawingBufferColorSpace(e),t.unpackColorSpace=Xe._getUnpackColorSpace()}},ya=new je,ba=new g,xa=class extends re{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new m([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new m([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new I(t,6,1);return this.setAttribute(`instanceStart`,new fe(n,3,0)),this.setAttribute(`instanceEnd`,new fe(n,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new I(t,6,1);return this.setAttribute(`instanceColorStart`,new fe(n,3,0)),this.setAttribute(`instanceColorEnd`,new fe(n,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new E(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new je);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),ya.setFromBufferAttribute(t),this.boundingBox.union(ya))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new mt),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)ba.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(ba)),ba.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(ba));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}};$.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new _t},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}},rn.line={uniforms:h.merge([$.common,$.fog,$.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		float trimSegmentAlpha( const in vec4 start, const in vec4 end ) {

			// compute the interpolation factor needed to trim the segment so it terminates
			// between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column

			// we need different nearEstimate formula for reversed and default depth buffer
			// a is positive with a reversed depth buffer so it can be used for controlling the code flow
			float nearEstimate = ( a > 0.0 ) ? ( - b / ( a + 1.0 ) ) : ( - 0.5 * b / a );

			return ( nearEstimate - start.z ) / ( end.z - start.z );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef USE_DASH

				float lineDistanceStart = dashScale * instanceDistanceStart;
				float lineDistanceEnd = dashScale * instanceDistanceEnd;

			#endif

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( start, end );
					end.xyz = mix( start.xyz, end.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceEnd = mix( lineDistanceStart, lineDistanceEnd, alpha );

					#endif

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( end, start );
					start.xyz = mix( end.xyz, start.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceStart = mix( lineDistanceEnd, lineDistanceStart, alpha );

					#endif

				}

			}

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? lineDistanceStart : lineDistanceEnd;
				vUv = uv;

			#endif

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};var Sa=class extends U{constructor(e){super({type:`LineMaterial`,uniforms:h.clone(rn.line.uniforms),vertexShader:rn.line.vertexShader,fragmentShader:rn.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return`WORLD_UNITS`in this.defines}set worldUnits(e){e===!0!==this.worldUnits&&(this.needsUpdate=!0),e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return`USE_DASH`in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return`USE_ALPHA_TO_COVERAGE`in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE=``:delete this.defines.USE_ALPHA_TO_COVERAGE)}},Ca=new B,wa=new g,Ta=new g,Ea=new B,Da=new B,Oa=new B,ka=new g,Aa=new Ee,ja=new de,Ma=new g,Na=new je,Pa=new mt,Fa=new B,Ia,La;function Ra(e,t,n){return Fa.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),Fa.multiplyScalar(1/Fa.w),Fa.x=La/n.width,Fa.y=La/n.height,Fa.applyMatrix4(e.projectionMatrixInverse),Fa.multiplyScalar(1/Fa.w),Math.abs(Math.max(Fa.x,Fa.y))}function za(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){ja.start.fromBufferAttribute(i,r),ja.end.fromBufferAttribute(a,r),ja.applyMatrix4(n);let o=new g,s=new g;Ia.distanceSqToSegment(ja.start,ja.end,s,o),s.distanceTo(o)<La*.5&&t.push({point:s,pointOnLine:o,distance:Ia.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,uv1:null})}}function Ba(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;Ia.at(1,Oa),Oa.w=1,Oa.applyMatrix4(t.matrixWorldInverse),Oa.applyMatrix4(r),Oa.multiplyScalar(1/Oa.w),Oa.x*=i.x/2,Oa.y*=i.y/2,Oa.z=0,ka.copy(Oa),Aa.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(Ea.fromBufferAttribute(s,t),Da.fromBufferAttribute(c,t),Ea.w=1,Da.w=1,Ea.applyMatrix4(Aa),Da.applyMatrix4(Aa),Ea.z>u&&Da.z>u)continue;if(Ea.z>u){let e=Ea.z-Da.z,t=(Ea.z-u)/e;Ea.lerp(Da,t)}else if(Da.z>u){let e=Da.z-Ea.z,t=(Da.z-u)/e;Da.lerp(Ea,t)}Ea.applyMatrix4(r),Da.applyMatrix4(r),Ea.multiplyScalar(1/Ea.w),Da.multiplyScalar(1/Da.w),Ea.x*=i.x/2,Ea.y*=i.y/2,Da.x*=i.x/2,Da.y*=i.y/2,ja.start.copy(Ea),ja.start.z=0,ja.end.copy(Da),ja.end.z=0;let o=ja.closestPointToPointParameter(ka,!0);ja.at(o,Ma);let l=se.lerp(Ea.z,Da.z,o),d=l>=-1&&l<=1,f=ka.distanceTo(Ma)<La*.5;if(d&&f){ja.start.fromBufferAttribute(s,t),ja.end.fromBufferAttribute(c,t),ja.start.applyMatrix4(a),ja.end.applyMatrix4(a);let r=new g,i=new g;Ia.distanceSqToSegment(ja.start,ja.end,i,r),n.push({point:i,pointOnLine:r,distance:Ia.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,uv1:null})}}}var Va=class extends Z{constructor(e=new xa,t=new Sa({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)wa.fromBufferAttribute(t,e),Ta.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+wa.distanceTo(Ta);let i=new I(r,2,1);return e.setAttribute(`instanceDistanceStart`,new fe(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new fe(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;if(r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`),n===!1&&(this.material.resolution.x===0||this.material.resolution.y===0))return;let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;Ia=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;La=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),Pa.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?La*.5:Ra(r,Math.max(r.near,Pa.distanceToPoint(Ia.origin)),s.resolution),Pa.radius+=c,Ia.intersectsSphere(Pa)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),Na.copy(o.boundingBox).applyMatrix4(a);let l;l=n?La*.5:Ra(r,Math.max(r.near,Na.distanceToPoint(Ia.origin)),s.resolution),Na.expandByScalar(l),Ia.intersectsBox(Na)!==!1&&(n?za(this,t):Ba(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(Ca),this.material.uniforms.resolution.value.set(Ca.z,Ca.w))}};function Ha(e){return Math.floor((e?.length??0)/6)}function Ua(e,t,{kapasitet:n=0}={}){let r=Ha(t),i=Math.max(r,n)+1,a=new Float32Array(i*6);return r>0&&a.set(t.length===r*6?t:Array.prototype.slice.call(t,0,r*6)),e.setPositions(a),e.instanceCount=r,r}var Wa=.78,Ga=.37,Ka=2.6,qa=`#ff4d3d`,Ja=55;function Ya(e){return!e||e.type===`formasjon`||e.harGlobe?!1:Number.isFinite(e.azimut)&&Number.isFinite(e.hoyde)}function Xa(e){return!Number.isFinite(e)||e<0||e>=1.15?null:[0,Ga].map(t=>{let n=(e-t)/Wa;return n<0||n>=1?{vei:0,opasitet:0}:{vei:1-(1-n)**3,opasitet:(1-n)**1.5}})}function Za({radius:e=25e3,avstand:t=null}={}){let n=t??e*.82,r=new He(1,1),i=new U({transparent:!0,depthWrite:!1,side:2,uniforms:{uFarge:{value:new q(qa)},uR:{value:[0,0]},uA:{value:[0,0]},uStrek:{value:.02}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform vec3 uFarge;
      uniform float uR[2];
      uniform float uA[2];
      uniform float uStrek;
      varying vec2 vUv;

      void main() {
        vec2 q = (vUv - 0.5) * 2.0;
        float rq = length(q);
        if (rq > 1.0) discard;
        float a = 0.0;
        for (int i = 0; i < 2; i++) {
          if (uA[i] <= 0.0) continue;
          a += (1.0 - smoothstep(uStrek * 0.4, uStrek, abs(rq - uR[i]))) * uA[i];
        }
        if (a < 0.004) discard;
        gl_FragColor = vec4(uFarge, min(a, 0.92));
      }
    `}),a=new Z(r,i);a.frustumCulled=!1,a.visible=!1;let o=new C;o.add(a);let s=900,c=null,l=0,u=1;function d(){let e=2*n*Math.tan(Ja*Math.PI/180/2)/s,t=104*e*1.12;a.scale.setScalar(t),l=12*e/t,u=104*e/t,i.uniforms.uStrek.value=Ka*e*2/t}return d(),{group:o,mesh:a,geometries:[r],materials:[i],start({azimut:e,hoyde:t}={}){if(!Number.isFinite(e)||!Number.isFinite(t))return!1;let[r,i,o]=Rt(e,t,n);return a.position.set(r,i,o),c=null,a.visible=!0,!0},update(e,t=null){if(!a.visible||(e&&a.quaternion.copy(e.quaternion),!Number.isFinite(t)))return;c===null&&(c=t);let n=Xa(t-c);if(!n)a.visible=!1,c=null;else for(let e=0;e<2;e++)i.uniforms.uR.value[e]=l+(u-l)*n[e].vei,i.uniforms.uA.value[e]=n[e].opasitet},settSkjermHoyde(e){!Number.isFinite(e)||e<1||(s=e,d())},stopp(){a.visible=!1,c=null},get aktiv(){return a.visible},dispose(){r.dispose(),i.dispose()}}}function Qa({widthM:e,heightM:t,exaggeration:n=1.15}){let r=e/2,i=t/2;return{widthM:e,heightM:t,exaggeration:n,toWorld(e,t,a=0){return[e-r,a*n,t-i]},toSvg(e,t){return{x:e+r,y:t+i}},elevToWorldY(e){return e*n},worldYToElev(e){return e/n},uvOf(n,r){return[n/e,1-r/t]}}}function $a(e,t=512){let n=Math.max(e.cols,e.rows);if(n<=t)return e;let r=Math.abs(e.transform.pixelWidth)*Math.ceil(n/t);return a(e,r)}function eo(e,t,{skirtDropM:n=40}={}){let{data:r,cols:i,rows:a,transform:o,noData:s}=e,c=o.pixelWidth,l=o.pixelHeight,u=i*a,d=2*i+2*(a-2),f=new Float32Array((u+d)*3),p=new Float32Array((u+d)*2),m=1/0,h=-1/0;for(let e=0;e<a;e++)for(let n=0;n<i;n++){let a=e*i+n,o=r[a];o!==s&&Number.isFinite(o)||(o=0),o<m&&(m=o),o>h&&(h=o);let u=n*c,d=e*l,[g,_,v]=t.toWorld(u,d,o);f[a*3]=g,f[a*3+1]=_,f[a*3+2]=v;let[y,b]=t.uvOf(u,d);p[a*2]=y,p[a*2+1]=b}Number.isFinite(m)||(m=0,h=0);let g=[];for(let e=0;e<i;e++)g.push(e);for(let e=1;e<a-1;e++)g.push(e*i+i-1),g.push(e*i);for(let e=0;e<i;e++)g.push((a-1)*i+e);let _=n*t.exaggeration,v=new Map;g.forEach((e,t)=>{let n=u+t;f[n*3]=f[e*3],f[n*3+1]=f[e*3+1]-_,f[n*3+2]=f[e*3+2],p[n*2]=p[e*2],p[n*2+1]=p[e*2+1],v.set(e,n)});let y=(i-1)*(a-1),b=2*(i-1)+2*(a-1),x=new Uint32Array((y+b)*6),S=0;for(let e=0;e<a-1;e++)for(let t=0;t<i-1;t++){let n=e*i+t,r=n+1,a=n+i,o=a+1;x[S++]=n,x[S++]=a,x[S++]=r,x[S++]=r,x[S++]=a,x[S++]=o}let C=(e,t)=>{let n=v.get(e),r=v.get(t);x[S++]=e,x[S++]=n,x[S++]=t,x[S++]=t,x[S++]=n,x[S++]=r};for(let e=0;e<i-1;e++)C(e+1,e);for(let e=0;e<i-1;e++)C((a-1)*i+e,(a-1)*i+e+1);for(let e=0;e<a-1;e++)C(e*i,(e+1)*i);for(let e=0;e<a-1;e++)C((e+1)*i+i-1,e*i+i-1);return{positions:f,uvs:p,indices:x,cols:i,rows:a,minElev:m,maxElev:h}}function to(e,t,n,{skirtDropM:r=40}={}){let i=$a(e),a=eo(i,t,{skirtDropM:r}),o=new nt;o.setAttribute(`position`,new qe(a.positions,3)),o.setAttribute(`uv`,new qe(a.uvs,2)),o.setIndex(new qe(a.indices,1)),o.computeBoundingSphere();let s=new Ke({map:n,side:2}),c=new Z(o,s);return c.frustumCulled=!1,{mesh:c,geometry:o,material:s,minElev:a.minElev,maxElev:a.maxElev,dem:i}}var no=[`user-layer`,`annotation-layer`,`track-layer`,`measure-layer`,`stifinner-layer`,`hydro-layer`],ro=`data-(?:ghost-)?layer`;function io(e){return d(e,RegExp(`<g\\b[^>]*${ro}="kontur"[^>]*>`))}function ao(e){let t=d(e,/<g\b[^>]*id="hillshade-layer"[^>]*>/);return t=d(t,/<g\b[^>]*data-ghost-relief[^>]*>/),t.replace(/<image\b[^>]*(?:id="hillshade-layer"|data-ghost-relief)[^>]*\/?>(<\/image>)?/g,``)}var oo=[RegExp(`<g\\b[^>]*${ro}="parkering"[^>]*>`),RegExp(`<g\\b[^>]*${ro}="holdeplass"[^>]*>`),/<g\b[^>]*data-iso="554"[^>]*>/,RegExp(`<g\\b[^>]*${ro}="bymasse"[^>]*>`)];function so(e){let t=e;for(let e of oo)t=d(t,e);return t}function co(e){let t=u(e,no);return t=io(t),t=ao(t),t=so(t),t.includes(`xmlns:xlink`)||(t=t.replace(/<svg\b([^>]*)>/,`<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink">`)),t}function lo(e){let t=e?.capabilities?.maxTextureSize??4096,n=typeof navigator<`u`?navigator.deviceMemory??4:4;return t>=8192&&n>=6?4096:2048}var uo=1024;function fo(e){let t=e?.image;if(!t||!t.width||!t.height)return!1;try{let e=t.getContext(`2d`);if(!e)return!1;let n=t.width,r=t.height,i=[[n>>1,r>>1],[n>>2,r>>2],[n*3>>2,r>>2],[n>>2,r*3>>2],[n*3>>2,r*3>>2]];for(let[t,n]of i)if(e.getImageData(t,n,1,1).data[3]!==0)return!1;return!0}catch{return!1}}var po=`#fffbf0`;function mo(e,t,n){return e.replace(/<svg\b([^>]*)>/,(e,r)=>`<svg${r.replace(/\s(?:width|height|preserveAspectRatio)="[^"]*"/g,``)} width="${Math.max(1,Math.round(t))}" height="${Math.max(1,Math.round(n))}" preserveAspectRatio="none">`)}async function ho(e,{wPx:t,hPx:n}){let r=mo(co(e),t,n),i=new Blob([r],{type:`image/svg+xml;charset=utf-8`}),a=URL.createObjectURL(i),o=new Image;try{await new Promise((e,t)=>{o.onload=e,o.onerror=()=>t(Error(`SVG-rasterisering feilet`)),o.src=a})}catch(e){throw URL.revokeObjectURL(a),e}return{img:o,bytes:r.length,dispose:()=>URL.revokeObjectURL(a)}}async function go(e,{sizePx:t=4096}={}){let{tiles:n=[],widthM:r,heightM:i}=e??{};if(!n.length||!(r>0)||!(i>0))throw Error(`Tomt tekstur-utsnitt`);let a=(await Promise.allSettled(n.map(e=>ho(e.svg,{wPx:e.w/r*t,hPx:e.h/i*t}).then(t=>({...t,rect:e}))))).filter(e=>e.status===`fulfilled`).map(e=>e.value),o=n.length-a.length;if(!a.length)throw Error(`Ingen av ${n.length} kartfliser lot seg rasterisere`);o&&console.warn(`[3D] ${o} av ${n.length} kartfliser lot seg ikke rasterisere`);let s=null;return{background:e.background||po,tileCount:n.length,missing:o,bytes:a.reduce((e,t)=>e+t.bytes,0),draw(e,t){for(let n of a)e.drawImage(n.img,n.rect.x/r*t,n.rect.y/i*t,n.rect.w/r*t,n.rect.h/i*t)},shade(e){return!s&&e&&(s=yo(e)),s},dispose(){for(let e of a)e.dispose()}}}function _o(e,t,{sizePx:n,renderer:r,night:i=!1}={}){let a=n??lo(r),o=document.createElement(`canvas`);o.width=a,o.height=a;let s=o.getContext(`2d`);if(!s)throw Error(`Canvas-context utilgjengelig`);s.fillStyle=e.background||po,s.fillRect(0,0,a,a),e.draw(s,a),t&&bo(s,e.shade(t),a,i);let c=new Re(o);return c.colorSpace=Ve,c.minFilter=Qe,c.generateMipmaps=!0,r?.capabilities?.getMaxAnisotropy&&(c.anisotropy=Math.min(8,r.capabilities.getMaxAnisotropy())),c}async function vo(e,t,{sizePx:n,renderer:r,night:i=!1}={}){let a=n??lo(r),o=await go(e,{sizePx:a});try{return _o(o,t,{sizePx:a,renderer:r,night:i})}finally{o.dispose()}}function yo(e){let t=en(e),n=document.createElement(`canvas`);n.width=t.cols,n.height=t.rows;let r=n.getContext(`2d`);return r?(r.putImageData(new ImageData(t.rgba,t.cols,t.rows),0,0),n):null}function bo(e,t,n,r=!1){t&&(e.save(),e.globalCompositeOperation=r?`screen`:`multiply`,e.globalAlpha=r?.3:.55,e.imageSmoothingEnabled=!0,e.drawImage(t,0,0,n,n),e.restore())}function xo(e){let t=en(e),n=document.createElement(`canvas`);n.width=t.cols,n.height=t.rows;let r=n.getContext(`2d`);r.fillStyle=`#fffbf0`,r.fillRect(0,0,t.cols,t.rows);let i=document.createElement(`canvas`);i.width=t.cols,i.height=t.rows,i.getContext(`2d`).putImageData(new ImageData(t.rgba,t.cols,t.rows),0,0),r.globalCompositeOperation=`multiply`,r.drawImage(i,0,0);let a=new Re(n);return a.colorSpace=Ve,a}var So=`#3d7ec9`,Co=`#dbe9f5`,wo=`#cfe0ee`,To=`#070b1a`,Eo=`#1a2947`,Do=`#111a30`;function Oo({radius:e=25e3}={}){let t=new G(e,24,12),n=new U({side:1,depthWrite:!1,uniforms:{uZenith:{value:new q(So)},uHorizon:{value:new q(Co)}},vertexShader:`
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      varying float vH;
      void main() {
        float t = smoothstep(-0.05, 0.5, vH);
        gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
      }
    `}),r=new Z(t,n);return r.frustumCulled=!1,r.renderOrder=-1,{mesh:r,geometry:t,material:n,setNight(e){n.uniforms.uZenith.value.set(e?To:So),n.uniforms.uHorizon.value.set(e?Eo:Co)}}}function ko(e){return new M(new q(wo),e*.6,e*2.6)}var Ao=1.6,jo=.055;function Mo({radius:e=25e3,avstand:t=null}={}){return zo({radius:e,avstand:t??e*.82,grader:Ao,farge:`#ffd35c`,jordskinn:1,ring:!0})}function No({radius:e=25e3,avstand:t=null}={}){return zo({radius:e,avstand:t??e*.82,grader:Ao,farge:`#fdf6df`,jordskinn:jo,ring:!0})}var Po=46,Fo=1.8,Io=2.6,Lo=5,Ro=55;function zo({radius:e=25e3,avstand:t=null,grader:n=Ao,farge:r=`#ffffff`,jordskinn:i=jo,ring:a=!1}={}){let o=t??e*.82,s=new He(1,1),c=new U({transparent:!0,depthWrite:!1,side:2,uniforms:{uLysAndel:{value:.75},uLysside:{value:0},uFarge:{value:new q(r)},uJordskinn:{value:i},uSkive:{value:1},uRing:{value:+!!a},uRingR:{value:0},uRingStrek:{value:.02},uTid:{value:0},uPeriode:{value:Io}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float uLysAndel;
      uniform float uLysside;
      uniform vec3 uFarge;
      uniform float uJordskinn;
      uniform float uSkive;
      uniform float uRing;
      uniform float uRingR;
      uniform float uRingStrek;
      uniform float uTid;
      uniform float uPeriode;
      varying vec2 vUv;

      void main() {
        // Planets enheter: q i [-1, 1]². Skiva selv har radius uSkive; resten
        // av planet er luft, og der ligger eventuelt ringen.
        vec2 q = (vUv - 0.5) * 2.0;
        float rq = length(q);
        if (rq > 1.0) discard;

        // RINGEN: en pulserende ripple rundt legemet, som en radar-ping.
        //
        // Den er en AFFORDANSE og ikke pynt: den sier «dette kan du trykke på»,
        // og på en natthimmel er bevegelse det eneste øyet finner av seg selv.
        // Tre lag: et svakt FAST omriss, så det alltid er et mål å sikte på selv
        // i det øyeblikket pulsene er svakest, pluss to pulser som utvider seg
        // utover og dør ut, et halvt omløp i utakt.
        //
        // GUARDEN rq > uSkive er ikke valgfri: uten den kan en puls som passerer
        // over legemet overskrive det, og da blinker Mars i stedet for å ligge
        // stille inni ringen sin.
        if (uRing > 0.5 && rq > uSkive) {
          float a = (1.0 - smoothstep(uRingStrek * 0.45, uRingStrek, abs(rq - uRingR))) * 0.30;
          float indre = uSkive + (uRingR - uSkive) * 0.25;
          for (int i = 0; i < 2; i++) {
            float f = fract(uTid / uPeriode + float(i) * 0.5);
            float rr = mix(indre, uRingR, f);
            float d = abs(rq - rr);
            // Dør ut mot ytterkanten, så pulsen forsvinner der den slutter i
            // stedet for å bli klippet av planet.
            a += (1.0 - smoothstep(uRingStrek * 0.45, uRingStrek, d)) * 0.62 * (1.0 - f);
          }
          if (a > 0.004) {
            gl_FragColor = vec4(uFarge, min(a, 0.9));
            return;
          }
          discard;
        }

        // Enhetsskiva: p i [-1, 1]². Alt utenfor r = 1 finnes ikke.
        vec2 p = q / uSkive;
        float r = length(p);
        if (r > 1.0) discard;

        // Roter inn i lyssidas system: u peker MOT den lyse randen.
        float c = cos(uLysside);
        float sn = sin(uLysside);
        // «Opp» dreid mot klokka med uLysside blir (-sin, cos).
        vec2 lys = vec2(-sn, c);
        float u = dot(p, lys);
        float v = dot(p, vec2(lys.y, -lys.x));

        // Terminatoren på en kule projisert på skiva er en halv ellipse:
        //   u_t = -cos(fasevinkel) * sqrt(1 - v²),  cos(fase) = 2k - 1
        // k = 1 gir u_t på venstre kant (alt lyst), k = 0 på høyre (alt mørkt),
        // k = 0,5 gir u_t = 0 — en rett skillelinje, altså halvmåne.
        float kant = sqrt(max(0.0, 1.0 - v * v));
        float ut = -(2.0 * uLysAndel - 1.0) * kant;
        // Mykning på tvers av terminatoren. Skalert med kant slik at overgangen
        // ikke blir en hard hakk der terminatoren møter randen.
        float myk = 0.035 + 0.10 * (1.0 - kant);
        float lyst = smoothstep(ut - myk, ut + myk, u);

        // Randen: en myk kant i stedet for en trappet sirkel. Bredden er i
        // skive-enheter, så den følger skalaen og ikke pikslene.
        float rand = 1.0 - smoothstep(0.965, 1.0, r);

        float styrke = mix(uJordskinn, 1.0, lyst);
        gl_FragColor = vec4(uFarge * (0.55 + 0.45 * styrke), styrke * rand);
      }
    `}),l=new Z(s,c);l.frustumCulled=!1;let u=900,d=n;function f(){let e=2*o*Math.tan(Ro*Math.PI/180/2)/u,t=Math.max(2*o*Math.tan(d*Math.PI/180/2),Lo*e),n=a?Po*e*1.18:0,r=Math.max(t,n);l.scale.setScalar(r),c.uniforms.uSkive.value=t/r,c.uniforms.uRingR.value=a?Po*e/r:0,c.uniforms.uRingStrek.value=Fo*e*2/r}f();let p=new C;return p.add(l),{group:p,mesh:l,geometries:[s],materials:[c],sett(e){if(!e||!Number.isFinite(e.azimut)||!Number.isFinite(e.hoyde))return;let[t,n,r]=Rt(e.azimut,e.hoyde,o);l.position.set(t,n,r),c.uniforms.uLysAndel.value=Math.max(0,Math.min(1,e.lysAndel??.75)),c.uniforms.uLysside.value=Number.isFinite(e.lyssideVinkel)?e.lyssideVinkel:0,l.visible=e.hoyde>-2*Math.PI/180},update(e,t=null){e&&l.quaternion.copy(e.quaternion),Number.isFinite(t)&&(c.uniforms.uTid.value=t)},settSkjermHoyde(e){!Number.isFinite(e)||e<1||(u=e,f())},settGrader(e){!Number.isFinite(e)||e<=0||(d=e,f())},get skiveAndel(){return c.uniforms.uSkive.value},get ringAndel(){return c.uniforms.uRingR.value},dispose(){s.dispose(),c.dispose()}}}function Bo(e){return Math.max(1.7,Math.min(6.2,5.5-.66*e))}function Vo(e){return Math.max(.45,Math.min(1,1.1-.1*e))}var Ho=-1*Math.PI/180,Uo=.26,Wo=1.7,Go=.85,Ko=2.6,qo=Math.max(1,...zt.map(e=>e.linjer.length)),Jo=1.6,Yo=.45,Xo=.02;function Zo({radius:e=25e3,lat:t=null,lon:n=null,dato:r=null,starCount:i=160,pikselForhold:a=1,tvingHimmel:o=!1}={}){let s=new C;s.visible=!1;let c=e*.9,l=Number.isFinite(t)&&Number.isFinite(n),u=[],d=[],f=[],p=new Map;if(l){let e=r??new Date,i=Kt(e,n);for(let n=0;n<Xt.length;n++){let r=Xt[n],a=Ut(r.ra,r.dek,e),{azimut:o,hoyde:s}=Bt(a.ra,a.dek,i,t);if(s<Ho)continue;let[l,m,h]=Rt(o,s,c);p.set(n,u.length/3),u.push(l,m,h),d.push(Bo(r.mag)),f.push(Vo(r.mag))}}else{let e=Qo(1337);for(let t=0;t<i;t++){let t=e()*Math.PI*2,n=.12+e()*.88,r=Math.sqrt(Math.max(0,1-n*n));u.push(Math.cos(t)*r*c,n*c,Math.sin(t)*r*c),d.push(1.6+e()*1.6),f.push(.55+e()*.4)}}let m=new nt;m.setAttribute(`position`,new qe(new Float32Array(u),3)),m.setAttribute(`storrelse`,new qe(new Float32Array(d),1)),m.setAttribute(`styrke`,new qe(new Float32Array(f),1));let h=new U({transparent:!0,depthWrite:!1,blending:2,uniforms:{uFarge:{value:new q(`#ffeec4`)},uPikselForhold:{value:Math.max(1,a)}},vertexShader:`
      attribute float storrelse;
      attribute float styrke;
      uniform float uPikselForhold;
      varying float vStyrke;
      void main() {
        vStyrke = styrke;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = storrelse * uPikselForhold;
      }
    `,fragmentShader:`
      uniform vec3 uFarge;
      varying float vStyrke;
      void main() {
        // Rund prikk med myk kant. Uten dette er hver stjerne en firkant, og
        // det ser man på de lyseste.
        float d = length(gl_PointCoord - vec2(0.5));
        float a = (1.0 - smoothstep(0.22, 0.5, d)) * vStyrke;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(uFarge, a);
      }
    `}),g=new X(m,h);g.frustumCulled=!1,s.add(g);let _=[m],v=[h],y=[],b=null,x=null,S=null,w=e=>{let t=[];for(let[n,r]of e){let e=p.get(n),i=p.get(r);e!=null&&i!=null&&(t.push(u[e*3],u[e*3+1],u[e*3+2]),t.push(u[i*3],u[i*3+1],u[i*3+2]))}return t};if(l){let e=w(Nt);if(e.length){let t=new xa;Ua(t,e);let n=new Sa({color:new q(`#9fb6d8`),linewidth:Wo,transparent:!0,opacity:Uo,depthWrite:!1}),r=new Va(t,n);r.frustumCulled=!1,s.add(r),_.push(t),v.push(n),y.push(n)}b=new xa,Ua(b,[],{kapasitet:qo}),S=b.attributes.instanceStart.data.array;let t=new Sa({color:new q(`#ffe9a3`),linewidth:Ko,transparent:!0,opacity:Go,depthWrite:!1});x=new Va(b,t),x.frustumCulled=!1,x.visible=!1,s.add(x),_.push(b),v.push(t),y.push(t)}let T=new Map;if(l)for(let t of Jt){let n=zo({radius:e,avstand:e*.86,grader:Yo,farge:t.farge,jordskinn:Xo,ring:Yt(t.id)});n.mesh.visible=!1,s.add(n.group),_.push(...n.geometries),v.push(...n.materials),T.set(t.id,n)}let E=null,D=!!o;function O(e){if(!l)return[];let r=It({lat:t,lon:n,dato:e,tving:D}),i=new Set;for(let e of r){let t=T.get(e.id);t&&(i.add(e.id),e.id===E?t.mesh.visible=!1:t.sett({azimut:e.azimut,hoyde:e.hoyde,lysAndel:e.lysAndel,lyssideVinkel:0}))}for(let[e,t]of T)i.has(e)||(t.mesh.visible=!1);return r}let k=O(r??new Date),A=Mo({radius:e});s.add(A.group),_.push(...A.geometries),v.push(...A.materials);let ee=()=>{if(!l){A.mesh.visible=!1;return}let e=Lt({lat:t,lon:n,dato:r??new Date}).sol;A.sett({azimut:e.azimut,hoyde:e.hoyde,lysAndel:1,lyssideVinkel:0}),A.mesh.visible=E!==`sol`},j=No({radius:e});s.add(j.group),_.push(...j.geometries),v.push(...j.materials);let te=()=>{j.sett(Lt({lat:t,lon:n,dato:r??new Date,tvingMane:D}).mane)};l?te():j.sett({azimut:2.3,hoyde:.67,lysAndel:.5,lyssideVinkel:Math.PI/2}),l?ee():A.mesh.visible=!1;let ne=Za({radius:e});return s.add(ne.group),_.push(...ne.geometries),v.push(...ne.materials),{group:s,mane:j,sol:A,get stjerneAntall(){return u.length/3},get astronomisk(){return l},get synligeStjerner(){return new Set(p.keys())},get synligePlaneter(){return k},settPlaneter:O,geometries:_,materials:v,textures:[],setNight(e){s.visible=!!e,e||ne.stopp()},update(e,t=null){A.update(e,t),j.update(e,t);for(let n of T.values())n.update(e,t);ne.update(e,t)},startValgRipple(e){return ne.start(e??{})},stoppValgRipple(){ne.stopp()},get valgRippleAktiv(){return ne.aktiv},planetSkive(e){return T.get(e)??null},settGlobeLegeme(e){E=e??null},settSol:ee,settTvingHimmel(e){D=!!e,l&&(te(),k=O(r??new Date))},get tvingHimmel(){return D},setResolution(e,t){for(let n of y)n.resolution.set(e,t);j.settSkjermHoyde(t);for(let e of T.values())e.settSkjermHoyde(t);ne.settSkjermHoyde(t)},settValgt(e){let t=m.getAttribute(`storrelse`),n=m.getAttribute(`styrke`);for(let[e,r]of p){let i=Xt[e].mag;t.array[r]=Bo(i),n.array[r]=Vo(i)}if(e?.stjerner?.length)for(let r of e.stjerner){let e=p.get(r);e!=null&&(t.array[e]*=Jo,n.array[e]=1)}if(t.needsUpdate=!0,n.needsUpdate=!0,!x)return;let r=e?.linjer??[],i=w(r),a=Math.min(i.length/6,qo);if(b.instanceCount=a,!a)x.visible=!1;else{for(let e=0;e<a*6;e++)S[e]=i[e];b.attributes.instanceStart.data.needsUpdate=!0,b.boundingSphere=null,x.visible=!0}},dispose(){for(let e of _)e.dispose();for(let e of v)e.dispose()}}}function Qo(e){return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function $o({widthM:e,heightM:t,toppY:n=2200,maks:r=700}={}){let i=new C;i.visible=!1;let a=e*1.6,o=t*1.6,s=Math.max(600,n),c=Qo(4711),l=new Float32Array(r*3),u=new Float32Array(r);for(let e=0;e<r;e++)l[e*3]=(c()-.5)*a,l[e*3+1]=c()*s,l[e*3+2]=(c()-.5)*o,u[e]=.7+c()*.6;let d=new nt,f=new qe(l,3);d.setAttribute(`position`,f),d.setDrawRange(0,0);let p=new J({color:new q(`#ffffff`),size:3.2,sizeAttenuation:!1,transparent:!0,opacity:.62,depthWrite:!1,fog:!1}),m=new X(d,p);m.frustumCulled=!1,m.visible=!1,i.add(m);let h=new Float32Array(r*2*3),g=new nt,_=new qe(h,3);g.setAttribute(`position`,_),g.setDrawRange(0,0);let v=new V({color:new q(`#cfe0ee`),transparent:!0,opacity:.5,depthWrite:!1,fog:!1}),y=new T(g,v);y.frustumCulled=!1,y.visible=!1,i.add(y);let b={regn:{fall:300,drift:.3,strek:95,opacity:.48,farge:`#cfe0ee`,punkt:!1},sludd:{fall:190,drift:.42,strek:50,opacity:.55,farge:`#e4eef8`,punkt:!1},sno:{fall:70,drift:.7,strek:0,opacity:.62,farge:`#ffffff`,punkt:!0}},x=null,S=0;return{group:i,geometries:[d,g],materials:[p,v],setNedbor(e,t){if(x=b[e]?e:null,S=x?Math.max(0,Math.min(r,Math.round(t||0))):0,i.visible=S>0,!x){m.visible=!1,y.visible=!1,d.setDrawRange(0,0),g.setDrawRange(0,0);return}let n=b[x];m.visible=n.punkt,y.visible=!n.punkt,d.setDrawRange(0,n.punkt?S:0),g.setDrawRange(0,n.punkt?0:S*2),n.punkt?(p.opacity=n.opacity,p.color.set(n.farge)):(v.opacity=n.opacity,v.color.set(n.farge))},update(e,t=0,n=0){if(!S||!x)return;let r=b[x],i=t*r.fall*r.drift,c=n*r.fall*r.drift;for(let t=0;t<S;t++){let n=t*3;l[n+1]-=r.fall*u[t]*e,l[n]+=i*e,l[n+2]+=c*e,l[n+1]<0&&(l[n+1]=s,l[n]=(l[n]+a*1.5)%a-a/2,l[n+2]=(l[n+2]+o*1.5)%o-o/2)}if(r.punkt){f.needsUpdate=!0;return}let d=r.strek,p=-i,m=r.fall,g=-c,v=Math.hypot(p,m,g)||1,y=p/v*d,C=m/v*d,w=g/v*d;for(let e=0;e<S;e++){let t=e*3,n=e*6;h[n]=l[t],h[n+1]=l[t+1],h[n+2]=l[t+2],h[n+3]=l[t]+y,h[n+4]=l[t+1]+C,h[n+5]=l[t+2]+w}_.needsUpdate=!0},dispose(){d.dispose(),g.dispose(),p.dispose(),v.dispose()}}}function es({toppY:e=2e3,lengde:t=1400,former:n=3,ledd:r=9}={}){let i=new C;i.visible=!1;let a=Qo(913),o=[];for(let e=0;e<n;e++){let e=[],n=0,i=0,s=0;for(let o=0;o<r;o++){let c=i-t/r,l=n+(a()-.5)*t*.16,u=s+(a()-.5)*t*.1;if(e.push(n,i,s,l,c,u),n=l,i=c,s=u,o===Math.floor(r*.45)){let o=n,c=i,l=s;for(let n=0;n<2;n++){let n=o+(a()-.35)*t*.22,i=c-t/r*.7,s=l+(a()-.5)*t*.12;e.push(o,c,l,n,i,s),o=n,c=i,l=s}}}let c=new nt;c.setAttribute(`position`,new qe(new Float32Array(e),3)),o.push(c)}let s=new V({color:new q(`#f4f8ff`),transparent:!0,opacity:.95,depthWrite:!1,fog:!1}),c=o.map(e=>{let t=new T(e,s);return t.frustumCulled=!1,t.visible=!1,i.add(t),t}),l=0;return{group:i,geometries:o,materials:[s],blink(t,n,r=e,a=0){for(let e of c)e.visible=!1;l=(l+1)%c.length;let o=c[l];o.position.set(t,r,n),o.rotation.y=a,o.visible=!0,i.visible=!0},slukk(){i.visible=!1;for(let e of c)e.visible=!1},dispose(){for(let e of o)e.dispose();s.dispose()}}}function ts(e){return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}var ns=`
  attribute vec3 aSenter;      // puffens midtpunkt i sky-lokale meter
  attribute vec2 aHjorne;      // -1..1 i firkanten
  attribute float aRadius;     // puffens radius i meter
  varying vec2 vHjorne;
  varying float vHoyde;        // 0 = klyngens bunn, 1 = toppen — for fargetoning
  uniform float uKlyngeHoyde;
  void main() {
    vHjorne = aHjorne;
    vHoyde = clamp(aSenter.y / max(uKlyngeHoyde, 1.0) + 0.5, 0.0, 1.0);
    // Billboard i view-space: flytt hjørnet i kameraets eget plan, så puffen
    // alltid vender rett mot betrakteren uten at vi trenger kameraets akser.
    vec4 vp = modelViewMatrix * vec4(aSenter, 1.0);
    vp.xy += aHjorne * aRadius;
    gl_Position = projectionMatrix * vp;
  }
`,rs=`
  precision mediump float;
  varying vec2 vHjorne;
  varying float vHoyde;
  uniform vec3 uSolView;       // sol-retning i view-space, oppdatert pr frame
  uniform vec3 uLys;           // farge i lyset
  uniform vec3 uSkygge;        // farge i skyggen
  uniform float uTetthet;      // 0..1, hvor solid puffen er
  uniform float uKantMyk;      // hvor tidlig alfa faller
  uniform float uKontrast;     // kule-skyggingens styrke
  uniform float uGlimt;        // 0..1 — lyn INNE i skya
  uniform vec3 uGlimtFarge;
  void main() {
    float r = length(vHjorne);
    if (r > 1.0) discard;
    // Kule-normal av firkantens koordinater. Dette er hele grunnen til at det
    // leses som volum: hver puff får en rund, skyggelagt overflate.
    vec3 n = vec3(vHjorne, sqrt(max(0.0, 1.0 - r * r)));
    // Dempet kontrast med vilje: full kule-skyggelegging gir blanke biljardkuler.
    // Skyer er tett dis — lyset skal antyde form, ikke modellere en overflate.
    float lys = clamp(dot(n, uSolView) * uKontrast + (1.0 - uKontrast), 0.0, 1.0);
    // Litt ekstra lys mot toppen av klyngen, mørkere mot bunnen — cumulus har
    // flat, dempet base og lys, bulende topp.
    lys = clamp(lys * (0.82 + 0.26 * vHoyde), 0.0, 1.0);
    vec3 farge = mix(uSkygge, uLys, lys);
    // Lyn INNE i skya. Lyset kommer fra puffens KJERNE og ut, ikke fra sola:
    // derfor vektes glimtet mot midten. Det er den vektingen som gjør at det
    // leses som en blits inni en tett masse framfor et lag lagt oppå.
    //
    // Bevisst OVERDREVET (eieren ba om at Tor får vise vreden). To ledd, og
    // begge trengs: mix-leddet drar fargen mot glimtfargen, og det ADDITIVE leddet
    // lar den gå forbi hvitt, som er det som gjør at den blømmer framfor bare å
    // bli lys grå. Uten det additive leddet forsvant glimtet helt i en grå
    // tordensky — målt: knapt til å skille fra uopplyst.
    float kjerne = 1.0 - smoothstep(0.0, 1.05, r);
    float g = clamp(uGlimt, 0.0, 1.0);
    farge = mix(farge, uGlimtFarge, clamp(g * (0.35 + kjerne * 0.9), 0.0, 1.0));
    farge += uGlimtFarge * g * kjerne * 0.85;
    // Svært myk kant: alfa begynner å falle allerede midt i puffen, så puffene
    // SMELTER sammen framfor å ligge som separate kuler oppå hverandre. Det er
    // overlappet, ikke den enkelte puffen, som skal lese som en sky.
    float a = smoothstep(1.0, uKantMyk, r);
    // Glimtet gjør skya litt mer solid mens det står på — en opplyst sky ser
    // tettere ut, og uten dette lyser det «gjennom» henne.
    gl_FragColor = vec4(farge, clamp(a * uTetthet * (1.0 + uGlimt * 1.6), 0.0, 1.0));
  }
`;function is(e,t,n){let r=new Float32Array(156),i=new Float32Array(104),a=new Float32Array(52),o=new Uint16Array(78),s=1;for(let c=0;c<13;c++){let l=c===0?0:e(),u=1-.55*l,d=e()*Math.PI*2,f=Math.sqrt(e())*u,p=Math.cos(d)*f*t*.42,m=Math.sin(d)*f*t*.42*.72,h=(l*.4+e()*.05)*t*.5,g=t*(n-.38*n*l)*(.88+e()*.26);h>s&&(s=h);let _=[[-1,-1],[1,-1],[1,1],[-1,1]];for(let e=0;e<4;e++){let t=c*4+e;r[t*3]=p,r[t*3+1]=h,r[t*3+2]=m,i[t*2]=_[e][0],i[t*2+1]=_[e][1],a[t]=g}let v=c*4;o.set([v,v+1,v+2,v,v+2,v+3],c*6)}let c=new nt;return c.setAttribute(`aSenter`,new qe(r,3)),c.setAttribute(`aHjorne`,new qe(i,2)),c.setAttribute(`aRadius`,new qe(a,1)),c.setIndex(new qe(o,1)),c.boundingSphere=new mt(new g(0,s*.5,0),t),{geo:c,maksY:s}}function as({widthM:e,heightM:t,baseY:n=1200,count:r=14,solRetning:i=new g(-.5,.707,-.5).normalize(),radiusFaktor:a=.34,kantMyk:o=.18,tetthet:s=.62,lysKontrast:c=.42}={}){let l=new C,u=ts(42),d=e*1.9,f=t*1.9,p=new q(`#ffffff`),m=new q(`#c6d6e6`),h=[],_=[],v=[];for(let e=0;e<r;e++){let e=1500+u()*2600,{geo:t,maksY:r}=is(u,e,a),i=new U({vertexShader:ns,fragmentShader:rs,transparent:!0,depthWrite:!1,uniforms:{uSolView:{value:new g(0,1,0)},uLys:{value:p.clone()},uSkygge:{value:m.clone()},uTetthet:{value:s},uKantMyk:{value:o},uKontrast:{value:c},uGlimt:{value:0},uGlimtFarge:{value:new q(`#ffffff`)},uKlyngeHoyde:{value:r*2}}}),y=new Z(t,i);y.frustumCulled=!1,y.position.set((u()-.5)*d,n+u()*800,(u()-.5)*f),y.userData.driftM=8+u()*14,y.userData.skyggeRadius=e*.55,l.add(y),h.push(i),_.push(t),v.push(y)}let y=1,b=0,x=1,S=new g,w=[[0,.55],[.05,.15],[.09,1],[.2,.75],[.34,.22],[.48,0]],T=w[w.length-1][0],E=-1,D=0;function O(e){if(e<=0||e>=T)return 0;for(let t=1;t<w.length;t++){let[n,r]=w[t];if(e<=n){let[i,a]=w[t-1],o=(e-i)/Math.max(n-i,1e-6);return a+(r-a)*o}}return 0}return{group:l,materials:h,geometries:_,skyer:v,glimt(e){let t=v.map((e,t)=>e.visible?t:-1).filter(e=>e>=0);if(!t.length)return null;if(e!=null&&v[e]?.visible)E=e;else{let e=[...t].sort((e,t)=>v[t].scale.x-v[e].scale.x),n=e.slice(0,Math.max(1,Math.ceil(e.length/2)));E=n[Math.floor(Math.random()*n.length)]}return D=0,v[E].position},solRetning:i,setVaer(e){E>=0&&(h[E].uniforms.uGlimt.value=0,E=-1);let t=e?Math.max(1,Math.min(v.length,Math.round(e.antall??v.length))):v.length;for(let e=0;e<v.length;e++)v[e].visible=e<t;let n=e?.gratone??1;for(let t of h)t.uniforms.uTetthet.value=(e?.opasitet??.85)*(s/.85),t.uniforms.uLys.value.setRGB(p.r*n,p.g*n,p.b*n),t.uniforms.uSkygge.value.setRGB(m.r*n,m.g*n,m.b*n);let r=Math.hypot(e?.driftX??1,e?.driftZ??0)||1;y=(e?.driftX??1)/r,b=(e?.driftZ??0)/r,x=e?.driftFart??1},update(e,t){for(let t of v)t.position.x+=y*t.userData.driftM*x*e,t.position.z+=b*t.userData.driftM*x*e,t.position.x>d/2?t.position.x-=d:t.position.x<-d/2&&(t.position.x+=d),t.position.z>f/2?t.position.z-=f:t.position.z<-f/2&&(t.position.z+=f);if(E>=0){D+=e;let t=O(D);h[E].uniforms.uGlimt.value=t,t<=0&&(h[E].uniforms.uGlimt.value=0,E=-1)}if(t){S.copy(i).transformDirection(t.matrixWorldInverse);for(let e of h)e.uniforms.uSolView.value.copy(S)}},dispose(){for(let e of _)e.dispose();for(let e of h)e.dispose()}}}var os=48,ss=10;function cs({radius:e=24e3,maksAntall:t=7}={}){let n=new C;n.visible=!1,n.renderOrder=3;let r=[];for(let i=0;i<t;i++){let t=ls(e,i);t.visible=!1,n.add(t),r.push(t)}let i=0,a=.05;return{group:n,setPreg(e){if(!e){n.visible=!1;for(let e of r)e.visible=!1;i=0;return}i=e.styrke,a=e.fart;let t=Math.min(r.length,e.antall),o=new q(Wt.gronn),s=new q(Wt.rod),c=new q(Wt.fiolett);for(let n=0;n<r.length;n++){let i=r[n];if(i.visible=n<t,!i.visible)continue;let a=i.material.uniforms,l=e.bueGrader*Math.PI/180,u=t===1?0:n/(t-1)-.5;a.uAsimut.value=u*l,a.uFra.value=e.fraGrader*Math.PI/180,a.uTil.value=e.tilGrader*Math.PI/180,a.uStyrke.value=e.styrke,a.uRod.value=e.rodAndel,a.uFiolett.value=e.fiolettAndel,a.uStraaler.value=e.straaleAndel??1,a.uFoldUtslag.value=e.foldeUtslag??.1,a.uUro.value=e.uro??.5,a.uGronnFarge.value.copy(o),a.uRodFarge.value.copy(s),a.uFiolettFarge.value.copy(c),a.uFase.value=n*2.399963}n.visible=!0},update(e){if(n.visible)for(let t of r)t.visible&&(t.material.uniforms.uTid.value=e*a)},get styrke(){return i},get antallSynlige(){return r.filter(e=>e.visible).length},dispose(){for(let e of r)e.geometry.dispose(),e.material.dispose()}}}function ls(e,t){let n=[],r=[],i=[];for(let e=0;e<=ss;e++)for(let t=0;t<=os;t++)n.push(0,0,0),r.push(t/os,e/ss);for(let e=0;e<ss;e++)for(let t=0;t<os;t++){let n=e*49+t;i.push(n,n+1,n+49,n+1,n+49+1,n+49)}let a=new nt;a.setAttribute(`position`,new m(n,3)),a.setAttribute(`uv`,new m(r,2)),a.setIndex(i),a.computeBoundingSphere(),a.boundingSphere.radius=e*2;let o=new U({transparent:!0,depthWrite:!1,depthTest:!1,blending:2,uniforms:{uTid:{value:0},uFase:{value:t*2.399963},uRadius:{value:e},uAsimut:{value:0},uFra:{value:.2},uTil:{value:1},uStyrke:{value:0},uRod:{value:0},uFiolett:{value:0},uStraaler:{value:1},uFoldUtslag:{value:.1},uUro:{value:.5},uGronnFarge:{value:new q(Wt.gronn)},uRodFarge:{value:new q(Wt.rod)},uFiolettFarge:{value:new q(Wt.fiolett)}},vertexShader:`
      uniform float uTid, uFase, uRadius, uAsimut, uFra, uTil, uFoldUtslag;
      varying vec2 vUv;
      varying float vFold;

      void main() {
        vUv = uv;
        // u spenner ut draperiet i asimut, v fra nedre til øvre kant i høyde.
        float bredde = 0.55;
        float a = uAsimut + (uv.x - 0.5) * bredde;

        // HVER GARDIN HAR SIN EGEN HØYDE, og underkanten er ikke en sirkelbue
        // (v6.5.16). Uten disse to sto de sju gardinene som en jevn mur med
        // matematisk lik topp og bunn — det leses som en flate, ikke som et
        // draperi. Begge er deterministiske funksjoner av uFase, så ingen
        // tilfeldighet og ingen buffer å skrive om.
        // Aldri OVER uTil: taket der er satt for å unngå senit-degenerasjonen
        // (MAKS_TOPP_GRADER), og en faktor over 1 ville spist det opp igjen.
        float toppFaktor = 0.86 + 0.14 * sin(uFase * 3.3);
        float kantBolge = sin(uv.x * 6.2831 * 1.7 + uFase) * 0.035;
        // Klemt mot horisonten: gardinene tegnes uten depthTest, så en bølget
        // underkant under 0 ville malt grønt OVER terrenget — den ene løgnen
        // dette laget ikke skal fortelle.
        float fra = max(0.0, uFra + kantBolge);
        float h = mix(fra, fra + (uTil - fra) * toppFaktor, uv.y);

        // TRE FOLDER I UTAKT. Periodene er valgt til å IKKE gå opp i hverandre
        // (1 : 2,3 : 5,1), ellers gjentar mønsteret seg synlig hvert par sekund.
        //
        // FOLDEN ER SKJEVET MED HØYDEN (v6.5.17): «uv.y * 1.1» i fasen gjør at
        // samme fold treffer toppen litt senere enn bunnen, altså at bølgen
        // FORPLANTER SEG oppover gardinen framfor å svinge som en stiv plate.
        // Det er den enkleste endringen som gjør at draperiet vrir seg, og
        // det er også det et ekte nordlys gjør — foldene løper langs båndet.
        float t = uTid + uFase;
        float tv = t + uv.y * 1.1;
        float f1 = sin(uv.x * 6.2831 * 1.0 + tv * 1.00);
        float f2 = sin(uv.x * 6.2831 * 2.3 - tv * 0.61) * 0.55;
        float f3 = sin(uv.x * 6.2831 * 5.1 + tv * 0.33) * 0.22;
        float fold = f1 + f2 + f3;
        vFold = fold;

        // Folden slår ut i ASIMUT og ikke i høyde: en gardin bølger sidelengs
        // langs himmelen, den hopper ikke opp og ned. Utslaget vokser oppover,
        // slik en fri nedre kant henger roligere enn toppen.
        a += fold * uFoldUtslag * (0.35 + uv.y * 0.65);

        // Nord er −Z (samme konvensjon som horisontTilWorld i astronomi.js).
        float r = cos(h) * uRadius;
        vec3 p = vec3(sin(a) * r, sin(h) * uRadius, -cos(a) * r);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,fragmentShader:`
      uniform float uStyrke, uRod, uFiolett, uStraaler, uUro, uTid, uFase;
      uniform vec3 uGronnFarge, uRodFarge, uFiolettFarge;
      varying vec2 vUv;
      varying float vFold;

      void main() {
        // FARGEN SKIFTER MED HØYDEN, ikke på tvers: grønt nederst, rødt over,
        // fiolett frynse helt nede. Snudd er dette den ene feilen alle som har
        // sett nordlys kjenner igjen uten å kunne si hvorfor.
        // Toner ut i BEGGE ender: skarpe kanter avslører geometrien. Nedre kant
        // er hardere enn den øvre, fordi et ekte nordlys har en tydelig underkant
        // (der partiklene stopper) og en diffus topp.
        float loddrett = smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.55, 0.96, vUv.y));
        // SIDEKANTENE ER LANGE MED VILJE (v6.5.21). Platået var 56 % av bredden,
        // så nabogardinene møttes med full styrke mot full styrke — og additivt
        // er det dobbelt lys nøyaktig der de krysser. Med 32 % platå og lange
        // utoninger møtes kant mot kant, altså svakt mot svakt, og bunken av sju
        // gardiner leses som et draperi framfor én sammenhengende vegg.
        float sidelengs = smoothstep(0.0, 0.34, vUv.x) * (1.0 - smoothstep(0.66, 1.0, vUv.x));

        // FARGEN SKIFTER MED HØYDEN, ikke på tvers: grønt nederst, rødt over,
        // fiolett frynse helt nede. Snudd er dette den ene feilen alle som har
        // sett nordlys kjenner igjen uten å kunne si hvorfor.
        //
        // PORTENE MÅ LIGGE DER «loddrett» FAKTISK SLIPPER LYS GJENNOM, og det er
        // feilen som ble rettet i v6.5.16: rødt var portet på smoothstep(0.45,
        // 1.0) mens loddrett begynte å tone ut allerede på 0.55 og var null på
        // 1.0 — altså full rødblanding nøyaktig der alfaen var borte. Fiolett
        // hadde samme feil speilvendt: smoothstep(0.18, 0.0) er full på vUv.y = 0,
        // som er der den nedre utoningen er null. Begge fargene var i praksis
        // multiplisert bort, og resultatet var et nordlys som alltid var grønt.
        // Rører du den ene, se på den andre.
        vec3 farge = uGronnFarge;
        farge = mix(farge, uRodFarge, smoothstep(0.30, 0.85, vUv.y) * uRod);
        farge = mix(farge, uFiolettFarge, smoothstep(0.28, 0.04, vUv.y) * uFiolett);

        // LODDRETTE STRÅLER. Uten dem er gardinen en jevn flate, og en jevn flate
        // er ikke nordlys. To frekvenser i utakt så strålene ikke blir en kam.
        //
        // FREKVENSEN ER MÅLT I STRÅLER PER GRAD, ikke i «en pen verdi»: gardinen
        // er 0,55 rad ≈ 31° bred, så 190 ga tretti stråler over den — altså én
        // per grad, som på en telefon er skanline-striper og ikke et nordlys.
        // 58 gir ni, med drøye tre grader mellom, som er størrelsesordenen på
        // ekte stråler. «uStraaler» demper dem helt bort i svake bånd, som ER
        // diffuse buer uten struktur.
        float r1 = sin(vUv.x * 58.0 + vFold * 2.0 - uTid * 1.6);
        float r2 = sin(vUv.x * 23.0 - uTid * 0.4 + uFase);
        // Utslaget er dempet i v6.5.21: strålene er STRUKTUR og ikke styrke, og
        // toppene deres kom oppå både bølgen under og nabogardinene ved siden av.
        float s = 1.0 + uStraaler * (0.34 * r1 + 0.22 * r2);
        s = clamp(s, 0.0, 1.6);

        // SPILLET: en LYSBØLGE som løper langs båndet (v6.5.17). Det er dette
        // øyet leser som «dansende» nordlys, og det er lys og ikke form: en
        // gardin som fysisk svinger så fort ville sett ut som en animasjonsfeil,
        // mens en lysstyrke som bølger langs den er nettopp det man ser i et
        // kraftig utbrudd. To bølger i motsatt retning, så mønsteret ikke leses
        // som en marsjerende stripe.
        //
        // FARTEN MÅ VÆRE STOR HER. «uTid» er sekunder ganget med «fart» (0,045–
        // 0,095), så en koeffisient på 1 gir en periode på over et minutt. 15
        // gir rundt seks sekunder, som er størrelsesordenen på ekte strålespill.
        // «uUro» demper det bort i svake bånd, som står nesten stille.
        float surge = sin(vUv.x * 13.0 - uTid * 15.0 + uFase * 2.1)
                    + 0.6 * sin(vUv.x * 5.0 + uTid * 9.0 - uFase);
        float bolge = 1.0 + uUro * 0.24 * surge;

        // Svært langsom pulsering i intensitet — det er sånn et nordlys puster.
        float puls = 0.82 + 0.18 * sin(uTid * 0.7 + uFase * 1.7);

        // GRUNNIVÅET ER HALVERT (v6.5.21). Ved full styrke var toppen av en
        // ENKELT gardin alfa ≈ 0,55, og fire–sju av dem overlapper: summen
        // klippet i alle tre kanalene, som er derfor et «svært sterkt» nordlys
        // kom ut hvitgrønt og flatt i stedet for sterkt grønt med struktur. Det
        // er hodetallet som må tåles her, ikke enkeltgardinen.
        float a = uStyrke * s * max(0.0, bolge) * loddrett * sidelengs * puls * 0.24;
        if (a <= 0.002) discard;

        // IKKE «farge * a». AdditiveBlending i three er SRC_ALPHA + ONE, så en
        // ferdig premultiplisert farge blir ganget med alfaen ÉN GANG TIL: ved
        // a = 0,07 ga det 0,005 på skjermen, altså ingenting. Det var
        // hovedgrunnen til at de svake stegene i demoen var usynlige. Skal noen
        // premultiplisere her, må materialet samtidig få «premultipliedAlpha».
        gl_FragColor = vec4(farge, a);
      }
    `}),s=new Z(a,o);return s.frustumCulled=!1,s}function us({styrke:e=.3}={}){let t=new Float32Array(42),n={uSkySenter:{value:t},uSkyAntall:{value:0},uSkyHoyde:{value:1500},uSolRetning:{value:new g(-.5,.707,-.5).normalize()},uSkyggeStyrke:{value:e}};return{uniforms:n,oppdater(e,r,i){let a=0,o=0;for(let n of e){if(a>=14)break;n.visible&&(t[a*3]=n.position.x,t[a*3+1]=n.position.z,t[a*3+2]=n.userData.skyggeRadius??r,o+=n.position.y,a++)}n.uSkyAntall.value=a,a&&(n.uSkyHoyde.value=o/a),i&&n.uSolRetning.value.copy(i)},festTil(e){e.onBeforeCompile=e=>{Object.assign(e.uniforms,n),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
            varying vec3 vVerden;`).replace(`#include <project_vertex>`,`#include <project_vertex>
            vVerden = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
            varying vec3 vVerden;
            uniform vec3 uSkySenter[14];
            uniform int uSkyAntall;
            uniform float uSkyHoyde;
            uniform vec3 uSolRetning;
            uniform float uSkyggeStyrke;`).replace(`#include <dithering_fragment>`,`#include <dithering_fragment>
            {
              // Gå opp mot sola til skyhøyden, og se om vi treffer en sky.
              float t = (uSkyHoyde - vVerden.y) / max(uSolRetning.y, 0.15);
              vec2 traff = vVerden.xz + uSolRetning.xz * t;
              float skygge = 0.0;
              for (int i = 0; i < 14; i++) {
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
            }`)},e.needsUpdate=!0}}}function ds({renderer:e,camera:t,container:n,onFrame:r,onResize:i=null,onContextLost:a=null,onContextRestored:o=null,onVisible:s=null,onDead:c=null}){let l=new Set,u=[],d=0,f=!1,p=0,m=!1,h=0,g=!1,_=0,v=e=>(e&&typeof e.dispose==`function`&&l.add(e),e),y=e=>{if(!f||m)return;let t=Math.min(.1,p?(e-p)/1e3:.016);p=e,h++;try{r(t,e/1e3)}catch(e){g||(g=!0,console.error(`[3D] feil i render-loopen (loopen går videre):`,e))}d=requestAnimationFrame(y)},b=()=>{f||m||(f=!0,p=0,d=requestAnimationFrame(y))},x=()=>{f=!1,d&&cancelAnimationFrame(d),d=0},S=(e,t,n,r)=>{e.addEventListener(t,n,r),u.push([e,t,n,r])},C=()=>{if(m)return;let r=n.clientWidth,a=n.clientHeight;r&&a&&(e.setSize(r,a,!1),t.aspect=r/a,t.fov=a>r?65:55,t.updateProjectionMatrix(),i?.(r,a))},w=new ResizeObserver(C);w.observe(n),C(),S(e.domElement,`webglcontextlost`,e=>{e.preventDefault(),x(),a?.()}),S(e.domElement,`webglcontextrestored`,()=>{b(),o?.()});let T=()=>{if(m||document.hidden)return;b(),C(),s?.(),clearTimeout(_);let e=h;_=setTimeout(()=>{if(m||document.hidden||h>e)return;x(),b();let t=h;_=setTimeout(()=>{m||document.hidden||h>t||c?.()},1500)},1500)};return S(document,`visibilitychange`,()=>{document.hidden?x():T()}),S(document,`resume`,T),S(window,`pageshow`,T),S(window,`focus`,T),{track:v,start:b,stop:x,resize:C,get running(){return f},get frames(){return h},dispose(){if(!m){m=!0,x(),clearTimeout(_),w.disconnect();for(let[e,t,n,r]of u)e.removeEventListener(t,n,r);u.length=0;for(let e of l)try{e.dispose()}catch{}l.clear();try{e.dispose(),e.forceContextLoss()}catch{}e.domElement?.remove()}}}}var fs=Math.PI/180,ps=.25;function ms(e){return e.colorSpace=Ve,e.wrapS=rt,e.offset.x=ps,e}function hs(e,t){let n=e*fs,r=t*fs;return[Math.cos(n)*Math.sin(r),Math.sin(n),Math.cos(n)*Math.cos(r)]}function gs(e){if(!e?.length||typeof document>`u`)return null;let t=document.createElement(`canvas`);t.width=4,t.height=256;let n=t.getContext(`2d`);if(!n)return null;let r=n.createLinearGradient(0,0,0,t.height);for(let[t,n]of e)r.addColorStop(t,n);n.fillStyle=r,n.fillRect(0,0,t.width,t.height);let i=new Re(t);return i.colorSpace=Ve,i.wrapS=rt,i.wrapT=Ce,i}function _s(){if(typeof document>`u`)return null;let e=document.createElement(`canvas`);e.width=256,e.height=128;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#ffe7a4`,t.fillRect(0,0,e.width,e.height);for(let n of[16,-16]){let r=(.5-n/180)*e.height,i=t.createLinearGradient(0,r-14,0,r+14);i.addColorStop(0,`rgba(190,120,30,0)`),i.addColorStop(.5,`rgba(190,120,30,0.16)`),i.addColorStop(1,`rgba(190,120,30,0)`),t.fillStyle=i,t.fillRect(0,r-14,e.width,28)}let n=1,r=()=>(n=n*1103515245+12345&2147483647,n/2147483647);for(let n=0;n<9e3;n++){let n=r()*e.width,i=r()*e.height,a=.7+r()*1.5,o=r();t.fillStyle=o>.5?`rgba(255,253,240,${.05+(o-.5)*.18})`:`rgba(214,150,52,${.04+(.5-o)*.14})`,t.beginPath(),t.arc(n,i,a,0,Math.PI*2),t.fill()}let i=new Re(e);return i.colorSpace=Ve,i.wrapS=rt,i.wrapT=Ce,i}function vs({legeme:e=`mane`,radius:t=1,teksturUrl:n=null,onTekstur:r=null}={}){let i=Ht[e]??Ht.mane,a=new C;a.visible=!1;let o=new G(t,48,32),s=new be({color:new q(i.farge),roughness:1,metalness:0,fog:!1}),c=new Z(o,s);c.frustumCulled=!1;let l=i.granulasjon?_s():gs(i.band);l&&(s.map=l,s.color.set(`#ffffff`));let u=e=>{e.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
         float muSol = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
         totalEmissiveRadiance *= 0.40 + 0.60 * muSol;`)},e.needsUpdate=!0},d=e=>{i.selvlysende&&(s.emissive.set(`#ffffff`),s.emissiveMap=e??null,s.emissiveIntensity=1,s.color.set(e?`#000000`:i.farge),e||s.emissive.set(i.farge),s.needsUpdate=!0)};i.selvlysende&&u(s),d(l);let f=new R(16774886,i.selvlysende?0:3.1);f.position.set(1,0,0),f.target=c,a.add(f);let p=new Ue(16777215,i.selvlysende?0:i.ambient??.055);a.add(p);let m=(i.akseHelling??0)*fs,h=null;if(i.ringer){let{indre:e,ytre:n,deling:r}=i.ringer,a=new ze(t*e,t*n,96,1),o=new U({transparent:!0,side:2,depthWrite:!1,fog:!1,uniforms:{uIndre:{value:e},uYtre:{value:n},uDeling:{value:r},uRadius:{value:t},uFarge:{value:new q(`#e8ddc4`)}},vertexShader:`
        varying vec3 vLokal;
        void main() {
          vLokal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,fragmentShader:`
        uniform float uIndre;
        uniform float uYtre;
        uniform float uDeling;
        uniform float uRadius;
        uniform vec3 uFarge;
        varying vec3 vLokal;
        void main() {
          // Avstand fra sentrum i PLANETRADIER. RingGeometry legger uv-en langs
          // ringen, ikke radielt, så vi regner den ut selv — og deler på
          // planetradien, siden posisjonene er i scene-enheter.
          float rr = length(vLokal.xy) / max(0.0001, uRadius);
          float t = (rr - uIndre) / max(0.0001, uYtre - uIndre);
          // Cassini-delingen: et mørkt gap. Det er det ENE trekket ved ringene
          // som er synlig i en liten kikkert, og derfor det som gjør dem ekte.
          float gap = smoothstep(0.0, 0.035, abs(rr - uDeling));
          // Innerst tynn, tettest på midten, tynn ut mot A-ringens kant.
          float tetthet = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.72, 1.0, t));
          gl_FragColor = vec4(uFarge, tetthet * gap * 0.85);
        }
      `});h=new Z(a,o),h.rotation.x=-Math.PI/2,h.frustumCulled=!1}let _=new C;_.rotation.x=m,_.add(c),h&&_.add(h),a.add(_);let v=null;n&&new S().load(n,e=>{ms(e),v=e,s.map=e,s.color.set(`#ffffff`),d(e),s.needsUpdate=!0;try{r?.(!0)}catch{}},void 0,()=>{try{r?.(!1)}catch{}});let y=new g,b=0,x=0;return{group:a,mesh:c,legeme:e,navn:i.navn,geometries:h?[o,h.geometry]:[o],materials:h?[s,h.material]:[s],get harTekstur(){return!!v},get harRinger(){return!!h},settRenderLag(e){!Number.isInteger(e)||e<0||e>31||a.traverse(t=>t.layers.set(e))},settFase(e,t){let n=Number.isFinite(e)?e:0,r=Number.isFinite(t)?t:0,i=Math.sin(n);f.position.set(-i*Math.sin(r),i*Math.cos(r),Math.cos(n))},vendMot(e){a.lookAt(e),a.rotateZ(b)},settRull(e){b=Number.isFinite(e)?e:0},settSkala(e){a.scale.setScalar(Math.max(.001,e))},get skala(){return a.scale.x},settRotasjon(e,t){c.rotation.y=e;let n=Number.isFinite(t)?t:0,r=80*fs;x=Math.max(-r-m,Math.min(r-m,n)),_.rotation.x=m+x},get rotasjon(){return{lengde:c.rotation.y,bredde:x}},synligeTrekk(){let e=[];a.updateMatrixWorld(!0),_.updateMatrixWorld(!0);for(let n of i.trekk??[]){let[r,i,o]=hs(n.lat,n.lon);y.set(r,i,o).applyQuaternion(c.quaternion).applyQuaternion(_.quaternion),!(y.z<=.18)&&(y.multiplyScalar(t*1.02).applyMatrix4(a.matrixWorld),e.push({...n,verden:[y.x,y.y,y.z]}))}return e},setVisible(e){a.visible=!!e},dispose(){o.dispose(),s.dispose(),h?.geometry.dispose(),h?.material.dispose(),v?.dispose(),l?.dispose()}}}var ys=class extends Error{constructor(e,t){super(t??e),this.code=e}};async function bs(e,{dem:n,meta:r,getTextureSpec:i,onProgress:a=null,onTextureNote:s=null,options:c={}},l={}){if(!n)throw new ys(`no-dem`,`Kartet mangler høydedata`);let{exaggeration:u=1.15,tvingHimmel:d=!1}=c,f=e=>{try{a?.(e)}catch{}},p=e=>{try{s?.(e)}catch{}},m=Math.min(window.devicePixelRatio||1,(navigator.deviceMemory??4)<=4?1.5:2),h;try{h=new va({antialias:m<1.8,powerPreference:`high-performance`,alpha:!1,stencil:!1})}catch{throw new ys(`no-webgl`,`WebGL utilgjengelig`)}h.setPixelRatio(m),h.outputColorSpace=Ve,h.toneMapping=0,e.appendChild(h.domElement),h.domElement.style.cssText=`width:100%;height:100%;display:block;touch-action:none;`;let _=new ke;_.background=new q(wo),_.fog=ko(Math.max(r.widthM,r.heightM));let v=new De(55,1,1,6e4),y=Qa({widthM:r.widthM,heightM:r.heightM,exaggeration:u});f(`Tegner kartet på terrenget …`);let b=lo(h),x=Math.min(uo,b),S,C=null;try{C=await go(i(),{sizePx:b}),S=_o(C,n,{renderer:h,sizePx:x}),C.missing&&p(`${C.missing} av ${C.tileCount} kartfliser kunne ikke tegnes på terrenget`)}catch(e){C?.dispose(),C=null,S=xo(n),x=b,console.warn(`[3D] Kartbildet kunne ikke rasteriseres:`,e),p(`Kartbildet kunne ikke tegnes på terrenget — viser terrengformene alene`)}let w=null,T=!1,E=!1;f(`Bygger terrengmodellen …`);let D=to(c.terrengDem??n,y,S);c.terrengDem&&(D.dem=$a(n)),_.add(D.mesh);{let{data:e,noData:t}=n,r=0;for(let n=0;n<e.length;n++)e[n]!==t&&Number.isFinite(e[n])||r++;let i=e.length?r/e.length:0;i>.33&&p(`${Math.round(i*100)} % av utsnittet mangler høydedata — terrenget der vises på havnivå`)}let O=Oo();_.add(O.mesh);let k=as({widthM:r.widthM,heightM:r.heightM,baseY:Math.max(1200,D.maxElev*u+350)});k.group.visible=!1,_.add(k.group);let A=$o({widthM:r.widthM,heightM:r.heightM,toppY:Math.max(2200,D.maxElev*u+1400),maks:700});_.add(A.group);let ee=es({toppY:Math.max(1800,D.maxElev*u+900)});_.add(ee.group);let j=us(),te=.3;j.uniforms.uSolRetning.value.copy(k.solRetning),j.festTil(D.material);let ne=4e3,re=(e,t)=>{let n=e===`sol`?F.sol:e===`mane`?F.mane:F.planetSkive?.(e);n&&(n.mesh.visible=!t,F.settGlobeLegeme?.(t?e:null))},ie=new Map,M=null,ae=null,N=0,oe=0,P=null,se=null;try{let e=t(r.widthM/2,r.heightM/2,r);Number.isFinite(e?.lat)&&Number.isFinite(e?.lon)&&(P=e.lat,se=e.lon)}catch{}let F=Zo({lat:P,lon:se,dato:new Date,pikselForhold:h.getPixelRatio(),tvingHimmel:d}),I=cs({radius:24e3});F.group.add(I.group),_.add(F.group);let L=null,ce=!1,le=Number.isFinite(r.equidistance)&&r.equidistance>0?r.equidistance:20,R=()=>T&&w?w:S;async function ue(){if(E)return;let e=R();if(!fo(e)){e.needsUpdate=!0,D.material.needsUpdate=!0;return}console.warn(`[3D] Terrengteksturen var tømt — bygger den på nytt`);let t=i?.({dark:T});if(t)try{let r=await vo(t,n,{renderer:h,sizePx:x,night:T});if(E){r.dispose();return}Se.track(r);let i=e;T&&w?w=r:S=r,D.material.map=R(),D.material.needsUpdate=!0,i.dispose()}catch{let e=xo(n);Se.track(e),T&&w?w=e:S=e,D.material.map=R(),D.material.needsUpdate=!0}}let de=1,z=0,fe=!1;function B(){let e=fe&&!T&&!ge;k.group.visible=e,j.uniforms.uSkyggeStyrke.value=e?te:0}let V=null;function pe(){I.setPreg(T?V:null)}let me=_.fog.near,he=_.fog.far,ge=null,H=null,_e=!1,ve=typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches,U=3,ye=0,be=new q(wo),W=new q(`#e8f1ff`);function G(e){if(!_e||ve||ge)return;if(ye>0){ye-=e,ye<=0&&(_.fog.color.copy(be),_.background.copy(be),ee.slukk());return}if(U-=e,U>0)return;U=3+Math.random()*6,ye=.3,_.fog.color.copy(W),_.background.copy(W);let t=k.glimt();ee.blink(t?t.x:(Math.random()-.5)*r.widthM*1.1,t?t.z:(Math.random()-.5)*r.heightM*1.1,t?t.y-120:void 0,Math.random()*Math.PI*2)}function xe(){_e=!1,ye=0,ee.slukk(),_.fog.color.set(T?Do:wo),_.background.set(T?Do:wo)}let Se=ds({renderer:h,camera:v,container:e,onResize(e,t){L?.setResolution(e,t),F.setResolution(e,t),l.onResize?.(e,t)},onFrame:(e,t)=>l.onFrame?.(e,t),onContextLost:()=>l.onContextLost?.(),onDead:()=>l.onDead?.(),onContextRestored:()=>{ue()},onVisible:()=>{ue()}});async function Ce(){if(!(E||x>=b))try{f(`Skjerper kartbildet …`);let e=_o(C??await go(i({dark:!1}),{sizePx:b}),n,{renderer:h,sizePx:b});if(E){e.dispose();return}Se.track(e);let t=S;S=e,x=b,T||(D.material.map=S,D.material.needsUpdate=!0),t.dispose()}catch{}finally{C?.dispose(),C=null,f(null)}}if(x<b){let e=()=>{Ce()};typeof requestIdleCallback==`function`?requestIdleCallback(e,{timeout:2500}):setTimeout(e,600)}for(let e of[S,D.geometry,D.material,O.geometry,O.material,k,A,ee,F])Se.track(e);f(null);let we=new g;function K(t,n,r){we.set(t,n,r).project(v);let i=e.clientWidth,a=e.clientHeight;return{x:(we.x+1)/2*i,y:(1-we.y)/2*a,behind:we.z>1}}return{renderer:h,scene:_,camera:v,coords:y,terrain:D,loop:Se,track:e=>Se.track(e),start:()=>Se.start(),resize:()=>Se.resize(),render(){v.layers.set(0),h.render(_,v),M?.group.visible&&(h.autoClear=!1,h.clearDepth(),v.layers.set(1),h.render(_,v),h.autoClear=!0,v.layers.set(0))},updateAmbient(e,t=null){if(O.mesh.position.copy(v.position),F.group.position.copy(v.position),M?.group.visible&&ae&&(M.group.position.set(v.position.x+ae[0],v.position.y+ae[1],v.position.z+ae[2]),M.vendMot(v.position),N!==oe)){let t=1-Math.exp(-e/.18);N+=(oe-N)*t,Math.abs(oe-N)<.004&&(N=oe),M.settSkala(N),N===0&&(M.setVisible(!1),re(M.legeme,!1))}F.update(v,t),I.update(t),k.group.visible&&(k.update(e,v),j.oppdater(k.skyer,900,k.solRetning)),A.update(e,de,z),G(e)},project:K,async setContoursVisible(t){if(ce=!!t,ce&&!L){let{buildContourLines:t}=await o(async()=>{let{buildContourLines:e}=await import(`./contourLines-i86ZqzC-.js`);return{buildContourLines:e}},__vite__mapDeps([0,1,2,3,4]));L=t(D.dem,y,{intervalM:le}),L.setResolution(e.clientWidth,e.clientHeight),Se.track(L),_.add(L.group)}L&&(L.group.visible=ce)},get contoursVisible(){return ce},get erNatt(){return T},async setNightMode(e){if(T=!!e,T&&!w)try{w=await vo(i({dark:!0}),n,{renderer:h,sizePx:b,night:!0}),Se.track(w)}catch{}let t=R();D.material.map!==t&&(D.material.map=t,D.material.needsUpdate=!0),O.setNight(T),F.setNight(T),!T&&M&&(oe=0,N=0,M.settSkala(.001),M.setVisible(!1),re(M.legeme,!1)),B(),pe(),be.set(T?Do:wo),ye=0,_.fog.color.copy(be),_.background.copy(be)},setVaer(e){fe=!!e,k.setVaer(e);let t=e?.siktFaktor??1;ge?(H.near=me*t,H.far=he*t):(_.fog.near=me*t,_.fog.far=he*t),te=.3*(1-(e?.dekning??.55)*.6)*(t<.3?.15:1),B(),A.setNedbor(e?.nedbor??null,e?.nedborTetthet??0),ge&&(H.nedbor=A.group.visible,A.group.visible=!1),de=e?.driftX??1,z=e?.driftZ??0,be.set(T?Do:wo),e?.torden?_e=!0:xe()},setUnderVann(e){e?(ge||(H={near:_.fog.near,far:_.fog.far,nedbor:A.group.visible},A.group.visible=!1,ye=0,ee.slukk()),ge=e,_.fog.color.setHex(e.farge),_.background.setHex(e.farge),_.fog.near=e.near,_.fog.far=e.far,O.mesh.visible=!1,B()):ge&&(ge=null,_.fog.near=H.near,_.fog.far=H.far,A.group.visible=H.nedbor,H=null,_.fog.color.copy(be),_.background.copy(be),O.mesh.visible=!0,B())},setNordlys(e){V=e??null,pe()},get nordlysStyrke(){return I.styrke},get nordlysGardiner(){return I.antallSynlige},get nightOn(){return T},settValgtFormasjon(e){F.settValgt(e)},startValgRipple(e){return F.startValgRipple(e)},stoppValgRipple(){F.stoppValgRipple()},settTvingHimmel(e){F.settTvingHimmel(e)},get tvingHimmel(){return F.tvingHimmel},aapneGlobe(e){return!e||!Number.isFinite(e.azimut)||!Yt(e.legeme)?!1:(M&&M.legeme!==e.legeme&&(M.setVisible(!1),M.settSkala(.001)),M=ie.get(e.legeme)??null,M||(M=vs({legeme:e.legeme,radius:ne*Math.tan(17*Math.PI/180),teksturUrl:Ht[e.legeme].tekstur?`/lende/data/${Ht[e.legeme].tekstur}`:null}),M.settRenderLag(1),_.add(M.group),Se.track(M),ie.set(e.legeme,M)),ae=Rt(e.azimut,e.hoyde,ne),M.settFase(e.faseVinkel??0,e.lyssideVinkel??0),M.settRull(-(e.parallaktisk??0)),M.settRotasjon(0,0),N=.05,oe=1,M.settSkala(N),M.setVisible(!0),re(e.legeme,!0),!0)},lukkGlobe(){oe=0},get globeAapen(){return!!M?.group.visible&&oe>0},dreiGlobe(t,n){if(!M?.group.visible)return;let r=e.clientHeight||1,i=2*Math.PI/r,a=M.rotasjon;M.settRotasjon(a.lengde+t*i,a.bredde+n*i)},globeTrekkPaaSkjerm(){if(!M?.group.visible||N<.6)return[];let e=[];for(let t of M.synligeTrekk()){let n=K(t.verden[0],t.verden[1],t.verden[2]);n.behind||e.push({navn:t.navn,norsk:t.norsk,merk:t.merk,type:t.type,x:n.x,y:n.y})}return e},get globeHarTekstur(){return!!M?.harTekstur},get globeLegeme(){return M?.group.visible&&oe>0?M.legeme:null},get globeNavn(){return M?.navn??null},get synligePlaneter(){return F.synligePlaneter},revalidateTexture:ue,dispose(){E=!0,C?.dispose(),C=null,Se.dispose()}}}var xs=new Set([`505`,`506`,`507`]),Ss=14038815,Cs=9067038,ws=25;function Ts(e,t,n,{liftM:i=4}={}){let a=new C,o=[],s=[],c=(e,a)=>{let o=r(t,e,a);return Number.isFinite(o)?n.toWorld(e,a,o+i):null},l=(e,t,n,r,i)=>{let a=Math.hypot(r-t,i-n),o=Math.max(1,Math.ceil(a/ws)),s=c(t,n);for(let a=1;a<=o;a++){let l=a/o,u=c(t+(r-t)*l,n+(i-n)*l);s&&u&&e.push(s[0],s[1],s[2],u[0],u[1],u[2]),s=u}},u=t=>{let n=[];for(let r of e??[]){if(xs.has(r.isomCode)!==t)continue;let e=r.coordinates;for(let t=0;t+1<e.length;t++)l(n,e[t][0],e[t][1],e[t+1][0],e[t+1][1])}if(!n.length)return;let r=new xa;Ua(r,n);let i=new Sa({color:t?Ss:Cs,linewidth:t?2.6:3.4,transparent:!0,opacity:t?.95:.8,depthTest:!0});o.push(r),s.push(i);let c=new Va(r,i);c.frustumCulled=!1,a.add(c)};return u(!1),u(!0),{group:a,geometries:o,materials:s,get isEmpty(){return o.length===0},setVisible(e){a.visible=!!e},setResolution(e,t){for(let n of s)n.resolution.set(e,t)},dispose(){for(let e of o)e.dispose();for(let e of s)e.dispose()}}}var Es=2.2,Ds=5,Os=1200,ks=.12,As=60.4,js=1e6;function Ms(e,t,n,i,a=0){let o=r(e,n,i);return t.toWorld(n,i,(Number.isFinite(o)?o:0)+a)}function Ns(e){return Math.min(Ds,Math.max(1,e/Os))}function Ps(e,t,n,r){if(![t,n,r].every(Number.isFinite))return 0;let i=Ns(Math.hypot(e.x-t,e.y-n,e.z-r)),a=e.y-n,o=(e.x-t)**2+(e.z-r)**2,s=ks*ks,c=81-s*As*As,l=2*s*As*a,u=(-l+Math.sqrt(l*l+4*c*s*(a*a+o)))/(2*c),d=Math.min(i,u);return Number.isFinite(d)?d:0}function Fs(e,t,n,{stemColor:r=16777215}={}){let i=e.length,a=new lt(Es,Es,55,8),o=new G(9,12,10),s=new Ke({color:r}),c=new Ke({vertexColors:!1}),l=new gt(a,s,Math.max(1,i)),u=new gt(o,c,Math.max(1,i));l.frustumCulled=!1,u.frustumCulled=!1,l.instanceMatrix.setUsage(x),u.instanceMatrix.setUsage(x);let d=new Float32Array(i*3),f=new ct,p=new q,m=new Set;for(let r=0;r<i;r++){let i=e[r],[a,o,s]=Ms(t,n,i.x,i.y);[a,o,s].every(e=>Number.isFinite(e)&&Math.abs(e)<=js)?(d[r*3]=a,d[r*3+1]=o,d[r*3+2]=s):m.add(r)}let h=new g,_=new g(NaN,NaN,NaN),v=!0,y=new Int32Array(i).fill(-1),b=new Float32Array(i*3),S=0,C=!0,w=t=>{let n=0;for(let e=0;e<i;e++){if(m.has(e))continue;let r=d[e*3],i=d[e*3+1],a=d[e*3+2],o=t(e,r,i,a);o>0&&(f.position.set(r,i+55/2*o,a),f.scale.setScalar(o),f.rotation.set(0,0,0),f.updateMatrix(),l.setMatrixAt(n,f.matrix),f.position.set(r,i+As*o,a),f.updateMatrix(),u.setMatrixAt(n,f.matrix),b[n*3]=f.position.x,b[n*3+1]=f.position.y,b[n*3+2]=f.position.z,y[n]!==e&&(y[n]=e,C=!0),n++)}if(S=n,l.count=n,u.count=n,l.instanceMatrix.needsUpdate=!0,u.instanceMatrix.needsUpdate=!0,l.boundingSphere=null,u.boundingSphere=null,l.boundingBox=null,u.boundingBox=null,C){for(let t=0;t<n;t++)p.set(e[y[t]].color),u.setColorAt(t,p);u.instanceColor&&(u.instanceColor.needsUpdate=!0),C=!1}};w(e=>+!m.has(e));let T=null;return{stems:l,heads:u,geometries:[a,o],materials:[s,c],get count(){return i},get invalidIndices(){return m},isUgyldig(e){return m.has(e)},basePosition(e){return[d[e*3],d[e*3+1],d[e*3+2]]},setVisibleSet(e){T=e,v=!0},isVisible(e){return!T||T.has(e)},update(e){h.copy(e.position),!(!v&&h.distanceToSquared(_)<.0625)&&(v=!1,_.copy(h),w((e,t,n,r)=>T&&!T.has(e)?0:Ps(h,t,n,r)))},naermesteISkjerm(e,t,n,r){let i=null,a=r;for(let r=0;r<S;r++){let o=e(b[r*3],b[r*3+1],b[r*3+2]);if(!o||o.behind)continue;let s=Math.hypot(o.x-t,o.y-n);s<a&&(a=s,i=y[r])}return i!=null&&i>=0?i:null},raycast(e){let t=e.intersectObjects([u,l],!1);for(let e of t){if(e.instanceId==null||e.instanceId>=S)continue;let t=y[e.instanceId];if(t>=0)return t}return null},dispose(){a.dispose(),o.dispose(),s.dispose(),c.dispose(),l.dispose(),u.dispose()}}}var Is=220,Ls=120,Rs=5,zs=.15,Bs=11,Vs=14;function Hs({scene:e,dem:t,coords:r,project:i,maxVisible:a=Ls}){let o=new C;e.add(o);let s=[],c=null,l=null,u=!0,d=new Set,f=0,p=new g,m=!1,h=()=>{c&&=(o.remove(c.stems),o.remove(c.heads),c.dispose(),null)},_=()=>s.map((e,t)=>({f:e,i:t})).filter(({f:e,i:t})=>!c?.isUgyldig(t)&&(!l||l.has(yt(e.kind)))),v=()=>{if(!c)return;let e=[];for(let{f:t,i:n}of _()){let[r,a,o]=c.basePosition(n),s=m?Math.hypot(p.x-r,p.y-a,p.z-o):0,l=i(r,a+60.4*(m?Ps(p,r,a,o):1),o);if(l.behind)continue;let u=i(r,a,o),d=Math.max(Vs,Math.abs(u.y-l.y)/2),f=St(t.kind,t.categories);e.push({id:String(n),score:(f?.priority??3)*10+1/(1+s/1e3),sx:(u.x+l.x)/2,sy:(u.y+l.y)/2,halfW:Math.max(Bs,d*2*zs),halfH:d,group:(f?.priority??0)>=5?`priority`:`quota`})}let t=$t(e,{cellPx:150,K:3,pad:Rs,prevShown:d,maxVisible:a});d=t,c.setVisibleSet(new Set([...t].map(Number)))},y=e=>{if(e==null||!s[e])return null;let t=s[e];return{feature:t,world:c.basePosition(e),radiusM:t.areaM2?Math.sqrt(t.areaM2/Math.PI):60}};return{group:o,get visible(){return u},get count(){return s.length},get visibleIndices(){return new Set([...d].map(Number))},setFeatures(e){if(h(),s=e??[],s.length&&(c=Fs(s.map(e=>({x:e.x,y:e.y,color:n(e)})),t,r),o.add(c.stems),o.add(c.heads),c.invalidIndices.size)){let e=[...c.invalidIndices].slice(0,5).map(e=>`${s[e]?.kind??`?`}:${s[e]?.name??`?`}`);console.warn(`[3D] ${c.invalidIndices.size} nål(er) hadde ubrukelig posisjon og er utelatt: ${e.join(`, `)}`)}d=new Set,o.visible=u,v()},setVisible(e){u=!!e,o.visible=u},setGroups(e){l=e,d=new Set,v()},update(e){p.copy(e.position),m=!0,c&&u&&c.update(e)},maybeDeclutter(e){c&&u&&(e-f<=Is||(f=e,v()))},raycast(e){return!c||!u?null:y(c.raycast(e))},naermesteISkjerm(e,t,n,r){return!c||!u?null:y(c.naermesteISkjerm(e,t,n,r))},dispose(){h(),e.remove(o)}}}function Us(e,t,{now:n=()=>performance.now(),slopPx:r=12,maxMs:i=600}={}){let a=null,o=e=>{a={x:e.clientX,y:e.clientY,t:n()}},s=e=>{let o=a;a=null,o&&(Math.hypot(e.clientX-o.x,e.clientY-o.y)>r||n()-o.t>i||t(e))};return e.addEventListener(`pointerdown`,o),e.addEventListener(`pointerup`,s),{dispose(){e.removeEventListener(`pointerdown`,o),e.removeEventListener(`pointerup`,s)}}}var Ws=120*Math.PI/180,Gs=8*Math.PI/180,Ks=25e3,qs=2,Js=60,Ys=70*Math.PI/180,Xs=20,Zs=(e,t)=>Math.atan2(t[1]-e[1],t[0]-e[0]);function Qs(e,t){let n=Math.abs(e-t)%(Math.PI*2);return n>Math.PI&&(n=Math.PI*2-n),n}function $s(e,t){let n=(t-e)%(Math.PI*2);return n>Math.PI&&(n-=Math.PI*2),n<=-Math.PI&&(n+=Math.PI*2),n}function ec(e,t,n){let r=e.graph,i=r.getEdgeAttributes(t,n),a=r.getNodeAttribute(t,`pos`),o=r.getNodeAttribute(n,`pos`);return{node:n,pos:o,bearing:Zs(a,o),length:i?.length??Math.hypot(o[0]-a[0],o[1]-a[1]),isomCode:i?.isomCode??null}}function tc(e,t,n){let r=[];return e.graph.forEachNeighbor(t,i=>{i!==n&&r.push(ec(e,t,i))}),r}function nc(e,t,n,r){let i=e.graph,a=t,o=n,s=i.getEdgeAttribute(t,n,`length`),c=new Set([t,n]);for(;s<r;){let e=i.degree(o);if(e===1)return{deadEnd:!0,lengthM:s};if(e>=3)return{deadEnd:!1,lengthM:s};let t=null;if(i.forEachNeighbor(o,e=>{e!==a&&(t=e)}),!t||c.has(t))return{deadEnd:!1,lengthM:s};c.add(t),s+=i.getEdgeAttribute(o,t,`length`),a=o,o=t}return{deadEnd:!1,lengthM:s}}function rc(e,t,n,r=100){return nc(e,t,n,r).deadEnd}function ic(e,t,n=100){let r=e?.graph;if(!r?.hasNode?.(t))return!1;let i=r.degree(t);if(i===0)return!0;if(i>=3)return!1;let a=[];return i===1&&a.push({deadEnd:!0,lengthM:0}),r.forEachNeighbor(t,r=>a.push(nc(e,t,r,n))),a.some(e=>!e.deadEnd&&e.lengthM>=n)||!a.some(e=>e.deadEnd)?!1:a.reduce((e,t)=>e+t.lengthM,0)<n}function ac(e,t){let n=null;for(let r of e){let e=Qs(r.bearing,t),i=c[r.isomCode]??1.5;if(!n){n={...r,turn:e,cost:i};continue}let a=e-n.turn;a<-Gs?n={...r,turn:e,cost:i}:a>Gs||(i<n.cost||i===n.cost&&r.length>n.length)&&(n={...r,turn:e,cost:i})}return n}function oc(e,t,{visits:n=new Map,maxGapM:r=Js,coneRad:i=Ys}={}){let a=e?.graph;if(!a?.hasNode?.(t.node))return null;let o=e.nodesWithin?.(t.pos,r);if(!o?.length)return null;let s=new Set;a.forEachNeighbor(t.node,e=>s.add(e));for(let r of o){if(r.id===t.node||s.has(r.id)||n.has(r.id)||!(r.distM>.5))continue;let a=Zs(t.pos,r.pos);if(Qs(a,t.bearing)>i)continue;let o=ac(tc(e,r.id,null),a);if(!(!o||o.turn>Ws)&&!rc(e,r.id,o.node)&&!e.gapObstacle?.(t.pos,r.pos,r.distM))return{node:r.id,pos:r.pos,bearing:a,length:r.distM,isomCode:null}}return null}function sc(e,t,{headingXY:n=null,firstNodeId:r=null,maxLengthM:i=Ks,hopGapM:a=Js}={}){let o={coordinates:[],lengthM:0,nodeIds:[],junctions:[],hops:[]};if(!e?.graph?.hasNode?.(t))return o;let s=e.graph.getNodeAttribute(t,`pos`),c=[[s[0],s[1]]],l=[t],u=[],d=new Map([[t,1]]),f=tc(e,t,null);if(f.length>1){let n=f.filter(n=>!rc(e,t,n.node));n.length&&(f=n)}if(!f.length)return{...o,coordinates:c,nodeIds:l};let p;if(r&&(p=f.find(e=>e.node===r)??null),!p){if(n&&Math.hypot(n[0],n[1])>1e-9){let e=Math.atan2(n[1],n[0]);p=ac(f,e)}else p=f.reduce((e,t)=>t.length>e.length?t:e)}if(!p)return{...o,coordinates:c,nodeIds:l};let m=0,h=t,g=p,_=[];for(;g;){c.push([g.pos[0],g.pos[1]]),l.push(g.node),m+=g.length;let t=(d.get(g.node)??0)+1;if(d.set(g.node,t),t>qs||m>=i)break;let n=tc(e,g.node,h);n.length>1&&(n=n.filter(t=>!rc(e,g.node,t.node)));let r=n.length?ac(n,g.bearing):null;if(r&&r.turn>Ws&&(r=null),!r){if(a<=0||_.length>=Xs)break;let t=oc(e,g,{visits:d,maxGapM:a});if(!t)break;_.push({alongM:m,gapM:t.length}),h=null,g=t}else n.length>1&&u.push({alongM:m,nodeId:g.node,chosenNodeId:r.node,options:n.map(e=>({nodeId:e.node,bearing:e.bearing,turn:Qs(e.bearing,g.bearing),turnSigned:$s(g.bearing,e.bearing),isomCode:e.isomCode,lengthM:e.length})).sort((e,t)=>e.turn-t.turn)}),h=g.node,g=r}return{coordinates:c,lengthM:m,nodeIds:l,junctions:u,hops:_}}function cc(e,t,n,{tolM:r=120,stubM:i=100}={}){let a=e?.nearestNode?.(t);if(!a||a.distM>r||ic(e,a.id,i))return null;let o=e.graph.getNodeAttribute(a.id,`pos`),s=o[0]-n[0],c=o[1]-n[1],l=Math.hypot(s,c);return l<1e-6?{nodeId:a.id,headingXY:[1,0],distM:a.distM}:{nodeId:a.id,headingXY:[s/l,c/l],distM:a.distM}}function lc(e,t,n,r,i={}){let a=t.nodeIds.indexOf(n.nodeId);if(a<0)return t;let o=sc(e,n.nodeId,{...i,firstNodeId:r});if(o.coordinates.length<2)return t;let s=t.coordinates.slice(0,a+1),c=t.nodeIds.slice(0,a+1),l=0;for(let e=1;e<s.length;e++)l+=Math.hypot(s[e][0]-s[e-1][0],s[e][1]-s[e-1][1]);return{coordinates:[...s,...o.coordinates.slice(1)],nodeIds:[...c,...o.nodeIds.slice(1)],lengthM:l+o.lengthM,junctions:[...t.junctions.filter(e=>e.alongM<n.alongM),...o.junctions.map(e=>({...e,alongM:e.alongM+l}))],hops:[...(t.hops??[]).filter(e=>e.alongM<n.alongM),...(o.hops??[]).map(e=>({...e,alongM:e.alongM+l}))]}}function uc(e,t,n,{stepM:i=5,offsetM:a=3,maxPoints:o=2500}={}){let s=fc(e,i,o),c=s.length,l=new Float32Array(c),u=0;for(let e=0;e<c;e++){let n=t?r(t,s[e][0],s[e][1]):NaN;u=Number.isFinite(n)?n:u,l[e]=u}let d=0;for(;d<c&&l[d]===0&&t;){let e=r(t,s[d][0],s[d][1]);if(Number.isFinite(e))break;d++}for(let e=0;e<d&&d<c;e++)l[e]=l[d];let f=pc(l),p=new Float32Array(c*3),m=new Float32Array(c),h=0;for(let e=0;e<c;e++){let[t,r]=s[e],[i,o,c]=n.toWorld(t,r,f[e]+a);p[e*3]=i,p[e*3+1]=o,p[e*3+2]=c,e>0&&(h+=Math.hypot(t-s[e-1][0],r-s[e-1][1])),m[e]=h}return{points3:p,cumM:m,totalM:h}}function dc(e,t,{offsetM:n=3}={}){let r=[],i=e.cumM.length;for(let a=0;a<i;a++)r.push({distM:e.cumM[a],elev:t.worldYToElev(e.points3[a*3+1])-n});return r}function fc(e,t,n){if(!e||e.length<2)return(e??[]).map(e=>[e[0],e[1]]);let r=0;for(let t=1;t<e.length;t++)r+=Math.hypot(e[t][0]-e[t-1][0],e[t][1]-e[t-1][1]);let i=Math.max(t,r/Math.max(2,n-1)),a=[[e[0][0],e[0][1]]];for(let t=1;t<e.length;t++){let[n,r]=e[t-1],[o,s]=e[t],c=Math.hypot(o-n,s-r),l=Math.max(1,Math.ceil(c/i));for(let e=1;e<=l;e++)a.push([n+(o-n)*e/l,r+(s-r)*e/l])}return a}function pc(e){let t=e.length;if(t<3)return e;let n=new Float32Array(t);n[0]=e[0],n[t-1]=e[t-1];for(let r=1;r<t-1;r++)n[r]=(e[r-1]+e[r]+e[r+1])/3;return n}function mc({points3:e,cumM:t,totalM:n}){let r=t.length,i=(i,a=[0,0,0])=>{if(r===0)return a;let o=Math.max(0,Math.min(n,i)),s=0,c=r-1;for(;s<c;){let e=s+c>>1;t[e]<o?s=e+1:c=e}let l=Math.max(1,s),u=l-1,d=t[l]-t[u]||1,f=(o-t[u])/d;for(let t=0;t<3;t++)a[t]=e[u*3+t]+(e[l*3+t]-e[u*3+t])*f;return a};return{at:i,tangentAt:(e,t=[0,0,0])=>{let r=Math.max(1,n/500),a=i(Math.max(0,e-r)),o=i(Math.min(n,e+r),t),s=o[0]-a[0],c=o[1]-a[1],l=o[2]-a[2],u=Math.hypot(s,c,l)||1;return t[0]=s/u,t[1]=c/u,t[2]=l/u,t},totalM:n}}var hc=new q(`#dc2626`),gc=new q(`#f8b4b4`);function _c(e,{radiusM:t=5}={}){let n=[];for(let t=0;t<e.points3.length/3;t++)n.push(new g(e.points3[t*3],e.points3[t*3+1],e.points3[t*3+2]));let r=new st(n,!1,`centripetal`),i=Math.min(2200,Math.max(16,n.length-1)),a=new b(r,i,t,6,!1),o=a.attributes.position.count,s=new Float32Array(o);for(let t=0;t<=i;t++){let n=t/i*e.totalM;for(let e=0;e<7;e++){let r=t*7+e;r<o&&(s[r]=n)}}a.setAttribute(`aAlongM`,new qe(s,1));let c={uProgressM:{value:0}},l=new Ke({color:16777215});l.onBeforeCompile=e=>{e.uniforms.uProgressM=c.uProgressM,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
attribute float aAlongM;
varying float vAlongM;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vAlongM = aAlongM;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform float uProgressM;
varying float vAlongM;
const vec3 doneColor = vec3(${hc.r.toFixed(4)}, ${hc.g.toFixed(4)}, ${hc.b.toFixed(4)});
const vec3 remainColor = vec3(${gc.r.toFixed(4)}, ${gc.g.toFixed(4)}, ${gc.b.toFixed(4)});`).replace(`#include <color_fragment>`,`#include <color_fragment>
diffuseColor.rgb = mix(doneColor, remainColor, step(uProgressM, vAlongM));
// Glødende front rundt nåværende posisjon.
float glow = 1.0 - smoothstep(0.0, 30.0, abs(vAlongM - uProgressM));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 1.0), glow * 0.55);`)};let u=new Z(a,l);return u.frustumCulled=!1,{mesh:u,geometry:a,material:l,setProgress(e){c.uProgressM.value=e}}}function vc({radiusM:e=9}={}){let t=new G(e,16,12),n=new Ke({color:14427686}),r=new Z(t,n),i=new ze(e*1.6,e*2.2,32),a=new Ke({color:14427686,transparent:!0,opacity:.5,side:2}),o=new Z(i,a);return o.rotation.x=-Math.PI/2,{sphere:r,ring:o,geometries:[t,i],materials:[n,a],setPosition(e,t,n){r.position.set(e,t,n),o.position.set(e,t-6,n)},pulse(e){let t=1+.15*Math.sin(e*3);o.scale.setScalar(t),a.opacity=.35+.2*Math.sin(e*3)}}}function yc(e){return Number.isFinite(e)?e<3e3?64:e<=12e3?128:256:128}function bc({totalM:e,estWalkMinutes:t=null,cumAscent:n=null,speedKmh:r=4.5,timeScale:i=128}={}){let a=0,o=!1,s=1,c=0,l=!1,u=e=>{if(!n||!n.dM.length)return 0;let{dM:t,aM:r}=n,i=0,a=t.length-1;if(e<=t[0])return r[0];if(e>=t[a])return r[a];for(;i<a;){let n=i+a>>1;t[n]<e?i=n+1:a=n}let o=i-1,s=t[i]-t[o]||1,c=(e-t[o])/s;return r[o]+(r[i]-r[o])*c},d=n?.aM.length?n.aM[n.aM.length-1]:0;return{play(){l||(o=!0)},pause(){o=!1},restart(){a=0,c=0,l=!1,o=!0},seek(t){a=Math.max(0,Math.min(e,t)),l=a>=e,l&&(o=!1)},setSpeed(e){r=Math.max(.5,e)},setTimeScale(e){i=Math.max(.1,e)},setSpeedFactor(e){s=Math.max(0,Math.min(1,e))},tick(t){if(!o||l)return{alongM:a,finished:l};let n=Math.min(t,.1);return a+=r/3.6*i*n*s,c+=n*i*s,a>=e&&(a=e,l=!0,o=!1),{alongM:a,finished:l}},stats(){let n=Math.max(0,e-a),f=u(a),p=Math.max(0,d-f);return{alongM:a,totalM:e,remainingM:n,pctDone:e>0?a/e:0,ascentSoFarM:f,remainingClimbM:p,etaMin:t?t(n,p):null,virtualElapsedMin:c/60,playing:o,finished:l,speedKmh:r,timeScale:i,speedFactor:s}},get playing(){return o},get alongM(){return a},get finished(){return l}}}function xc(e){let t=(e??[]).filter(e=>e.elev!=null&&Number.isFinite(e.elev));if(t.length<2)return null;let n=new Float32Array(t.length),r=new Float32Array(t.length),i=0;n[0]=t[0].distM;for(let e=1;e<t.length;e++){let a=t[e].elev-t[e-1].elev;a>0&&(i+=a),n[e]=t[e].distM,r[e]=i}return{dM:n,aM:r}}var Sc=.25,Cc=2e3;function wc(e=[],{onEnter:t=null,onExit:n=null}={}){let r=e.slice(),i=0,a=`CRUISE`,o=0,s=0,c=null,l=!0,u=e=>{i=r.findIndex(t=>t.alongM>e),i<0&&(i=r.length)},d=()=>{c&&n&&n(c),c=null,a=`RESUME`,s=Cc,i++};return{tick(e,n){if(!l||!r.length)return{speedFactor:1,state:a,active:c};let u=r[i]??null;if(a===`CRUISE`&&u&&e>=u.alongM-u.approachM&&(a=`APPROACH`),a===`APPROACH`){if(!u)return a=`CRUISE`,{speedFactor:1,state:a,active:c};if(e>=u.alongM)a=`HOLD`,o=u.holdMs,c=u,t&&t(u);else{let t=Math.max(0,Math.min(1,(u.alongM-e)/u.approachM));return{speedFactor:Sc+.75*(t*t*(3-2*t)),state:a,active:c}}}if(a===`HOLD`){if(o-=n,o<=0)d();else return{speedFactor:0,state:a,active:c}}if(a===`RESUME`){if(s-=n,s<=0)a=`CRUISE`;else return{speedFactor:Sc+.75*(1-s/Cc),state:a,active:c}}return{speedFactor:1,state:a,active:c}},skip(){a===`HOLD`&&d()},seek(e){a===`HOLD`&&c&&n&&n(c),c=null,a=`CRUISE`,u(e)},setEvents(e,t=0){r=(e??[]).slice(),u((a===`HOLD`||a===`APPROACH`)&&c?c.alongM:t)},setEnabled(e){l=!!e,!l&&a===`HOLD`&&d()},eventNear(e,t=150){let n=null,i=1/0;for(let a of r){let r=Math.abs(a.alongM-e);r<=t&&r<i&&(i=r,n=a)}return n},get state(){return a},get active(){return c},get pending(){return r.length-i}}}var Tc=1483594,Ec=14427686,Dc=16096779;function Oc(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`);t.fillStyle=`#1d4ed8`,kc(t,8,8,112,112,26),t.fill(),t.strokeStyle=`#fff`,t.lineWidth=6,kc(t,8,8,112,112,26),t.stroke(),t.fillStyle=`#fff`,t.font=`bold 84px system-ui, sans-serif`,t.textAlign=`center`,t.textBaseline=`middle`,t.fillText(`P`,64,70);let n=new Re(e);return n.colorSpace=Ve,n}function kc(e,t,n,r,i,a){e.beginPath(),e.moveTo(t+a,n),e.arcTo(t+r,n,t+r,n+i,a),e.arcTo(t+r,n+i,t,n+i,a),e.arcTo(t,n+i,t,n,a),e.arcTo(t,n,t+r,n,a),e.closePath()}function Ac(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`);t.fillStyle=`#92400e`,kc(t,8,8,112,112,26),t.fill(),t.strokeStyle=`#fff`,t.lineWidth=6,kc(t,8,8,112,112,26),t.stroke(),t.strokeStyle=`#fff`,t.lineWidth=11,t.lineCap=`round`,t.beginPath(),t.moveTo(82,98),t.lineTo(82,58),t.arc(64,58,18,0,Math.PI,!0),t.lineTo(46,76),t.stroke(),t.fillStyle=`#fff`,t.beginPath(),t.moveTo(32,74),t.lineTo(60,74),t.lineTo(46,100),t.closePath(),t.fill();let n=new Re(e);return n.colorSpace=Ve,n}function jc({route:e,via:t=[],isLoop:n=!1,parkingSpots:r=[],pauseSpots:i=[]},a,o){let s=new C,c=new C;s.add(c);let l=[],u=[],d=[],f=[],p=new Map,m=(e,t,n,r)=>{let i=new C,c=new lt(Es,Es,55,8),m=new Ke({color:16777215}),h=new Z(c,m);h.position.y=55/2;let g=new G(9,16,12),_=new Ke({color:n}),v=new Z(g,_);v.position.y=60.4,i.add(h),i.add(v);let[y,b,x]=Ms(a,o,e,t);i.position.set(y,b,x),l.push(c,g),u.push(m,_),s.add(i),d.push(i);let S={...r,world:[y,b,x]};for(let e of[h,v])f.push(e),p.set(e,S)},h=e.coordinates,[g,_]=h[0];if(m(g,_,Tc,{kind:`start`,name:n?`Start og mål`:`Start`}),!n){let[e,t]=h[h.length-1];m(e,t,Ec,{kind:`mål`,name:`Mål`})}for(let e of t)m(e.svgX,e.svgY,Dc,{kind:`via`,name:`Vendepunkt`});let y=(e,t,{sizeM:n,liftM:r,parent:i,kind:s,label:c})=>{if(!e.length)return;let l=t(),d=new v({map:l,transparent:!0,depthWrite:!1});u.push(d),d.userData={tex:l};for(let t of e){let e=new le(d);e.scale.set(n,n,1);let[l,u,m]=Ms(a,o,t.x,t.y,r);e.position.set(l,u,m),i.add(e),f.push(e),p.set(e,{kind:s,name:t.name||c,world:Ms(a,o,t.x,t.y)})}};return y(r,Oc,{sizeM:46,liftM:40,parent:s,kind:`parkering`,label:`Parkering`}),y(i,Ac,{sizeM:42,liftM:95,parent:c,kind:`rast`,label:`Rasteplass`}),{group:s,geometries:l,materials:u,hitMeshes:f,pick(e){for(let t of e.intersectObjects(f,!1)){if(t.object.parent&&t.object.parent.visible===!1)continue;let e=p.get(t.object);if(e)return e}return null},setPinsVisible(e){c.visible=!!e},update(e){for(let t of d){let n=Ps(e.position,t.position.x,t.position.y,t.position.z);t.visible=n>0,n>0&&t.scale.setScalar(n)}},dispose(){for(let e of l)e.dispose();for(let e of u)e.userData?.tex?.dispose(),e.dispose()}}}function Mc({color:e=16498468}={}){let t=new C,n=new ze(24,34,40),r=new Ke({color:e,transparent:!0,opacity:.7,side:2,depthWrite:!1}),i=new Z(n,r);i.rotation.x=-Math.PI/2,t.add(i);let a=new He(14,220),o=new Ke({color:e,transparent:!0,opacity:.35,blending:2,depthWrite:!1,side:2}),s=new Z(a,o);return s.position.y=110,t.add(s),t.visible=!1,{group:t,geometries:[n,a],materials:[r,o],showAt(e,n,r){t.position.set(e,n+2,r),t.visible=!0},hide(){t.visible=!1},update(e,n){if(!t.visible)return;let a=1+.2*Math.sin(e*2.5);i.scale.setScalar(a),r.opacity=.5+.25*Math.sin(e*2.5);let o=n.position.x-t.position.x,c=n.position.z-t.position.z;s.rotation.y=Math.atan2(o,c)}}}var Nc=959977,Pc=3718648,Fc=1.5,Ic=15,Lc=120,Rc=3,zc=2.6;function Bc(e,t){let n=new C;n.visible=!1;let i=new C,a=new lt(Es,Es,55,8),o=new Ke({color:16777215}),s=new Z(a,o);s.position.y=55/2;let c=new G(9,16,12),l=new Ke({color:Nc}),u=new Z(c,l);u.position.y=60.4,i.add(s),i.add(u),n.add(i);let d=new ze(.9,1,48),f=[];for(let e=0;e<Rc;e++){let t=new Ke({color:Pc,transparent:!0,opacity:0,side:2,depthWrite:!1}),r=new Z(d,t);r.rotation.x=-Math.PI/2,r.position.y=Fc,n.add(r),f.push({mesh:r,mat:t,phase:e/Rc})}for(let e of[n,i,s,u,...f.map(e=>e.mesh)])e.frustumCulled=!1;let p=30;return{group:n,hitMeshes:[u,s],get visible(){return n.visible},get position(){return n.position},setPosition(i){let a=i&&Number.isFinite(i.x)&&Number.isFinite(i.y)&&i.x>=0&&i.x<=t.widthM&&i.y>=0&&i.y<=t.heightM;if(n.visible=!!a,!a)return;let o=r(e,i.x,i.y),[s,c,l]=t.toWorld(i.x,i.y,Number.isFinite(o)?o:0);n.position.set(s,c,l),p=Math.min(Lc,Math.max(Ic,i.accuracyM??30))},update(e,t){if(!n.visible)return;for(let t of f){let n=(e/zc+t.phase)%1,r=Math.max(.001,p*n);t.mesh.scale.set(r,r,1),t.mat.opacity=.5*(1-n)}let r=Ps(t.position,n.position.x,n.position.y,n.position.z);i.visible=r>0,r>0&&i.scale.setScalar(r)},dispose(){a.dispose(),c.dispose(),d.dispose(),o.dispose(),l.dispose();for(let e of f)e.mat.dispose()}}}var Vc=3e5,Hc=30;function Uc({windowMs:e=Vc,minMoveM:t=Hc}={}){let n=[],r=t=>{for(;n.length&&n[0].t<t-e;)n.shift()};return{push(e,t,i){Number.isFinite(e)&&Number.isFinite(t)&&Number.isFinite(i)&&(n.length&&i<=n[n.length-1].t||(n.push({x:e,y:t,t:i}),r(i)))},heading(e){if(r(e),n.length<2)return null;let i=n[0],a=n[n.length-1],o=a.x-i.x,s=a.y-i.y,c=Math.hypot(o,s);return c<t?null:[o/c,s/c]},reset(){n.length=0}}}function Wc(e,t=3){if(!e||e.length<4)return!1;let[n,r]=e[0],[i,a]=e[e.length-1];return Math.hypot(n-i,r-a)<=t}function Gc({cols:e,rows:t,transform:n},r){let i=n.pixelWidth,a=n.pixelHeight,o=new Uint8Array(e*t),s=[];for(let n=0;n<t;n++){let t=n*a;s.length=0;for(let e of r)for(let n=0,r=e.length;n<r;n++){let[i,a]=e[n],[o,c]=e[(n+1)%r];(a<=t&&t<c||c<=t&&t<a)&&s.push(i+(t-a)/(c-a)*(o-i))}if(!(s.length<2)){s.sort((e,t)=>e-t);for(let t=0;t+1<s.length;t+=2){let r=Math.max(0,Math.ceil(s[t]/i)),a=Math.min(e-1,Math.floor(s[t+1]/i));for(let t=r;t<=a;t++)o[n*e+t]=1}}}return o}function Kc(e){if(!e.length)return null;let t=Float64Array.from(e).sort();return t[t.length>>1]}function qc(e,t,{maksIter:n=4e3,toleranse:r=.005}={}){let{cols:i,rows:a,transform:o,data:s,noData:c}=e,l=o.pixelWidth,u=o.pixelHeight;if(!t?.omriss?.length)return null;let d=Gc(e,t.omriss),f=t.kurver.filter(e=>e.type===2&&Wc(e.punkter)).map(e=>e.punkter);if(f.length){let t=Gc(e,f);for(let e=0;e<d.length;e++)t[e]&&(d[e]=0)}let p=0,m=i,h=-1,g=a,_=-1;for(let e=0;e<a;e++)for(let t=0;t<i;t++)d[e*i+t]&&(p++,t<m&&(m=t),t>h&&(h=t),e<g&&(g=e),e>_&&(_=e));if(!p)return null;let v=[],y=[];for(let e=Math.max(0,g-1);e<=Math.min(a-1,_+1);e++)for(let t=Math.max(0,m-1);t<=Math.min(i-1,h+1);t++){let n=e*i+t,r=s[n];r!==c&&Number.isFinite(r)&&(d[n]?v.push(r):(t>0&&d[n-1]||t<i-1&&d[n+1]||e>0&&d[n-i]||e<a-1&&d[n+i])&&y.push(r))}let b=v.length>=p/2?Kc(v):Kc(y)??Kc(v)??0,x=new Float32Array(i*a).fill(NaN),S=new Uint8Array(i*a),C=Math.min(Math.abs(l),Math.abs(u))/2,w=0;for(let e of t.kurver){if(!Number.isFinite(e.dybde))continue;e.dybde>w&&(w=e.dybde);let t=e.punkter;for(let n=0;n+1<t.length;n++){let[r,o]=t[n],[s,c]=t[n+1],f=Math.max(1,Math.ceil(Math.hypot(s-r,c-o)/C));for(let t=0;t<=f;t++){let n=Math.round((r+(s-r)*t/f)/l),p=Math.round((o+(c-o)*t/f)/u);if(n<0||n>=i||p<0||p>=a)continue;let m=p*i+n;d[m]&&(x[m]=e.dybde,S[m]=1)}}}let T=0,E=0;for(let e=0;e<x.length;e++)S[e]&&(T+=x[e],E++);let D=E?T/E:0;for(let e=g;e<=_;e++)for(let t=m;t<=h;t++){let n=e*i+t;d[n]&&!S[n]&&(x[n]=D)}let O=e=>d[e]?x[e]:0;for(let e=0;e<n;e++){let e=0;for(let t=g;t<=_;t++)for(let n=m;n<=h;n++){let r=t*i+n;if(!d[r]||S[r])continue;let o=(O(n>0?r-1:r)+O(n<i-1?r+1:r)+O(t>0?r-i:r)+O(t<a-1?r+i:r))/4,s=x[r]+1.85*(o-x[r]),c=Math.abs(s-x[r]);c>e&&(e=c),x[r]=s}if(e<r)break}return{maske:d,dybde:x,nivaa:b,maksDybde:w,celler:p,ramme:{c0:m,c1:h,r0:g,r1:_}}}function Jc(e,{transform:t}){if(!e?.maksDybde)return 1;let n=Math.sqrt(e.celler*Math.abs(t.pixelWidth*t.pixelHeight));return Math.max(1,Math.min(6,Math.round(.06*n/e.maksDybde)))}function Yc(e,t,n=1){let r=Float32Array.from(e.data);for(let e=0;e<r.length;e++)t.maske[e]&&(r[e]=t.nivaa-Math.max(0,t.dybde[e])*n);return{...e,data:r}}var Xc=.3,Zc=[79,159,220],Qc=[29,86,132];function $c(e){return e>0?Math.min(1,Math.log1p(e)/Math.log1p(150)):0}function el(e){return Xc*$c(e)}function tl(e){let t=$c(e),n=0;for(let e=0;e<3;e++)n=n<<8|Math.round(Zc[e]+(Qc[e]-Zc[e])*t);return n}function nl(e,t){let n=700-450*$c(e);return{near:4,far:Math.max(n,2.5*Math.max(0,t)+300)}}var rl=(()=>{let e=315*Math.PI/180,t=Math.PI/4;return[Math.sin(e)*Math.cos(t),Math.cos(e)*Math.cos(t),Math.sin(t)]})();function il(e,t,{cols:n,rows:r,transform:i},a=1){let o=new Float32Array(n*r).fill(1),s=Math.abs(i.pixelWidth),c=Math.abs(i.pixelHeight),l=(t,i)=>e[Math.min(r-1,Math.max(0,i))*n+Math.min(n-1,Math.max(0,t))];for(let e=0;e<r;e++)for(let r=0;r<n;r++){let i=e*n+r;if(!t[i])continue;let u=(l(r+1,e)-l(r-1,e))*a/(2*s),d=(l(r,e-1)-l(r,e+1))*a/(2*c),f=Math.hypot(u,d,1),p=Math.max(0,(-u*rl[0]-d*rl[1]+rl[2])/f);o[i]=Math.min(1.35,Math.max(.3,1+.9*(p/rl[2]-1)))}return o}function al(e,t,{cols:n,rows:r,transform:i},a,o,{radiusM:s=400}={}){let c=Math.max(1,Math.round(s/Math.abs(i.pixelWidth))),l=[];for(let i=1;i<r-1;i++)for(let o=1;o<n-1;o++){let s=i*n+o;if(!t[s]||t[s-1]&&t[s+1]&&t[s-n]&&t[s+n])continue;let u=0,d=0;for(let s=Math.max(0,i-c);s<=Math.min(r-1,i+c);s++)for(let r=Math.max(0,o-c);r<=Math.min(n-1,o+c);r++){let i=s*n+r,o=e[i]-a;t[i]?-o>u&&(u=-o):o>d&&(d=o)}l.push({c:o,r:i,score:u+d,under:u,over:d})}l.sort((e,t)=>t.score-e.score);for(let e of l)if(ol(t,n,o,e))return{...e,x:e.c*i.pixelWidth,y:e.r*i.pixelHeight};return null}function ol(e,t,n,r){let i=Math.max(Math.abs(r.c-n.c),Math.abs(r.r-n.r))*2;for(let a=0;a<=i;a++){let o=i?a/i:0,s=Math.round(n.c+(r.c-n.c)*o);if(!e[Math.round(n.r+(r.r-n.r)*o)*t+s])return!1}return!0}function sl(e,t,n,r){return Math.atan2(n-e,-(r-t))}function cl(e,{cols:t,rows:n,transform:r},i,{andel:a=.5,minLengdeM:o=400}={}){let s=Math.abs(r.pixelWidth),c=Math.abs(r.pixelHeight),l=i.r*t+i.c,u=e.dybde[l];if(!e.maske[l]||!(u>0))return null;let d=a*u,f=t*n,p=new Float64Array(f).fill(1/0),m=new Int32Array(f).fill(-1),h=new ll;p[l]=0,h.push(0,l);let g=0,_=l;for(;h.size;){let[r,i]=h.pop();if(r>p[i])continue;g++,r>p[_]&&(_=i);let a=i%t,o=(i-a)/t;for(let l=-1;l<=1;l++)for(let f=-1;f<=1;f++){if(!l&&!f)continue;let g=a+f,_=o+l;if(g<0||_<0||g>=t||_>=n)continue;let v=_*t+g;if(!e.maske[v]||e.dybde[v]<d)continue;let y=Math.hypot(f*s,l*c)*(1+2*(1-e.dybde[v]/u));r+y<p[v]&&(p[v]=r+y,m[v]=i,h.push(r+y,v))}}let v=[];for(let e=_;e>=0;e=m[e])v.push(e);v.reverse();let y=v.map(e=>{let n=e%t;return[n*r.pixelWidth,(e-n)/t*r.pixelHeight]}),b=0;for(let e=1;e<y.length;e++)b+=Math.hypot(y[e][0]-y[e-1][0],y[e][1]-y[e-1][1]);let x=g*s*c;return b<o||b*b<2*x?null:{punkter:y,lengde:b}}var ll=class{constructor(){this.a=[]}get size(){return this.a.length}push(e,t){let n=this.a;n.push([e,t]);let r=n.length-1;for(;r>0;){let e=r-1>>1;if(n[e][0]<=n[r][0])break;[n[e],n[r]]=[n[r],n[e]],r=e}}pop(){let e=this.a,t=e[0],n=e.pop();if(e.length){e[0]=n;let t=0;for(;;){let n=2*t+1,r=n+1,i=t;if(n<e.length&&e[n][0]<e[i][0]&&(i=n),r<e.length&&e[r][0]<e[i][0]&&(i=r),i===t)break;[e[i],e[t]]=[e[t],e[i]],t=i}}return t}};function ul(e){let t=[0];for(let n=1;n<e.length;n++)t.push(t[n-1]+Math.hypot(e[n][0]-e[n-1][0],e[n][1]-e[n-1][1]));let n=t.at(-1);return{L:n,punkt:r=>{let i=Math.min(n,Math.max(0,r)),a=1;for(;a<e.length-1&&t[a]<i;)a++;let o=t[a]-t[a-1]||1,s=(i-t[a-1])/o;return[e[a-1][0]+(e[a][0]-e[a-1][0])*s,e[a-1][1]+(e[a][1]-e[a-1][1])*s]}}}function dl(e,t=3){return e.map((n,r)=>{if(r===0||r===e.length-1)return n;let i=Math.min(t,r,e.length-1-r),a=0,o=0;for(let t=r-i;t<=r+i;t++)a+=e[t][0],o+=e[t][1];return[a/(2*i+1),o/(2*i+1)]})}function fl({fra:e,ring:t,flateY:n,land:r=null,azimut:i=0}){let a=e.x-t.x,o=e.z-t.z,s=Math.hypot(a,o);s<1?(a=-Math.sin(i),o=Math.cos(i)):(a/=s,o/=s);let c=Math.max(.8*s,150),l=t.x+a*c,u=t.z+o*c,d=n+.6*c;if(r)for(let e=0;e<=4;e++)d=Math.max(d,r(t.x+a*c*(e/4),t.z+o*c*(e/4))+.25*c);return{pos:[l,d,u],hoyde:-Math.atan2(d-n,c),azimut:sl(l,u,t.x,t.z)}}function pl({fra:e,mot:t=null,rute:n=null,ring:r=null,flateY:i,gulv:a,land:o=null,klaring:s=6,redusert:c=!1}){let l=i-3,u,d;if(n?.length>=2)u=dl([[e.x,e.z],...n]),d=u.at(-1);else{let n=Math.hypot(t.x-e.x,t.z-e.z),r=Math.min(250,.4*n),i=e=>n?e/n:0,a=n=>[e.x+(t.x-e.x)*i(n),e.z+(t.z-e.z)*i(n)];u=[[e.x,e.z],a(Math.max(0,n-r))],d=a(Math.max(0,n-r)+r*.45)}let f=ul(u),p=f.L,m=e=>{let t=Math.min(80,p/4),n=f.punkt(e-t),r=f.punkt(e+t);return sl(n[0],n[1],r[0],r[1])},h=p<30?sl(e.x,e.z,d[0],d[1]):m(p),g=p<30?h:m(0),_={pos:[d[0],l,d[1]],hoyde:xl(30),azimut:h,tid:r?7:8,ease:`inn-ut`,fase:`stig`},v=[];if(r){let e=fl({fra:{x:d[0],z:d[1]},ring:r,flateY:i,land:o,azimut:h});v.push({pos:[d[0],i+6,d[1]],hoyde:xl(20),azimut:h,tid:1.4,ease:`inn-ut`,fase:`gjennom`},{...e,tid:5,ease:`inn-ut`,fase:`fugl`})}if(c)return[{...v.at(-1)??_,tid:0}];let y=[{pos:[e.x,e.y,e.z],hoyde:xl(5),azimut:g,tid:1.2,ease:`inn-ut`,fase:`snu`}];if(p<30)return[...y,_,...v];let b=Math.max(6,Math.min(n?60:30,Math.round(p/80))),x=p/Math.max(8,Math.min(n?30:18,p/120)),S=([e,t])=>Math.min(l,a(e,t)+s),C=[];for(let e=1;e<=b;e++)C.push(S(f.punkt(p*e/b)));let w=C.map((e,t)=>{let n=0,r=0;for(let e=Math.max(0,t-2);e<=Math.min(b-1,t+2);e++)n+=C[e],r++;return Math.max(C[t],Math.min(l,n/r))}),T=p/b/Math.max(1,x);for(let e=0;e<b;e++){let t=p*(e+1)/b,[r,i]=f.punkt(t),a=e===0?`inn-kvad`:e===b-1?`ut-kvad`:`lineaer`;y.push({pos:[r,w[e],i],hoyde:xl(8),azimut:n?m(t):h,tid:a===`lineaer`?T:2*T,ease:a,fase:`glid`})}return y.push(_,...v),y}function ml(e,{cols:t,rows:n,transform:r},i,a){let o=i/r.pixelWidth,s=a/r.pixelHeight,c=Math.floor(o),l=Math.floor(s),u=0,d=0;for(let r=0;r<=1;r++)for(let i=0;i<=1;i++){let a=c+i,f=l+r;if(a<0||f<0||a>=t||f>=n)continue;let p=f*t+a,m=(i?o-c:1-(o-c))*(r?s-l:1-(s-l));e.maske[p]&&(u+=m*e.dybde[p]),d+=m}return d>0?u/d:0}function hl(e,t,n,r){let i=0,a=n,o=r;for(let n=t;n<e.length;n++){let[t,,r]=e[n].pos;e[n].fase===`glid`&&(i+=Math.hypot(t-a,r-o)),a=t,o=r}return i}function gl(e,{cols:t,transform:n}){let r=-1,i=-1/0;for(let t=0;t<e.maske.length;t++)e.maske[t]&&e.dybde[t]>i&&(i=e.dybde[t],r=t);if(r<0)return null;let a=r%t,o=(r-a)/t;return{c:a,r:o,x:a*n.pixelWidth,y:o*n.pixelHeight,dybde:i}}function _l(e,{cols:t,rows:n,transform:r},i,a){let o=Math.round(i/r.pixelWidth),s=Math.round(a/r.pixelHeight);return o<0||s<0||o>=t||s>=n?!1:!!e.maske[s*t+o]}var vl=new Set([`vann-navn`,`vann-omrade`]);function yl(e,t,n){return!t||!e?.length?e??[]:e.filter(e=>!(vl.has(e.kind)&&_l(t,n,e.x,e.y)))}function bl(e,t,n,r,i){let a=Pt(e,t,n,r,0),o=i-a,s=a+Math.min(8,Math.max(0,o)*.3);return Math.min(s,i-2)}var xl=e=>e*Math.PI/180;function Sl({x:e,z:t,flateY:n,bunnY:r,redusert:i=!1}){if(i)return[{pos:[e,r,t],hoyde:xl(55),tid:0,fase:`bunn`}];let a=Math.max(1,n-r),o=2*(1+.5*Math.min(1,a/300));return[{pos:[e,n+60,t],hoyde:xl(-70),tid:1,ease:`inn-ut`,fase:`inn`},{pos:[e,n-Math.min(4,a*.2),t],hoyde:xl(-70),tid:.35,ease:`lineaer`,fase:`flate`},{pos:[e,r,t],hoyde:xl(40),tid:o,ease:`inn-ut`,fase:`ned`},{pos:[e,r,t],hoyde:xl(55),tid:.6,ease:`ut`,fase:`bunn`}]}function Cl({x:e,z:t,flateY:n,redusert:r=!1}){return r?[{pos:[e,n+60,t],hoyde:xl(-70),tid:0,fase:`over`}]:[{pos:[e,n-2,t],hoyde:xl(70),tid:1.2,ease:`inn-ut`,fase:`opp`},{pos:[e,n+60,t],hoyde:xl(-60),tid:.8,ease:`ut`,fase:`over`}]}function wl({camY:e,flateY:t,coords:n,faktor:r}){let i=n.elevToWorldY(1)-n.elevToWorldY(0);return Math.max(0,(t-e)/(i*(r||1)))}var Tl=new q(.86,.95,1),El=new q(.34,.52,.76),Dl=3112900,Ol=12575999,kl=15267583,Al=44;function jl(e,t,n,r,i,a=1){let{cols:o,rows:s}=r,c=e.getAttribute(`position`).count,l=new Float32Array(c*3).fill(1),u=new q,d=n.maksDybde||1,f=il(i.data,n.maske,r,a);for(let e=0;e<o*s;e++){if(!n.maske[e])continue;let t=Math.min(1,Math.max(0,n.dybde[e]/d));u.copy(Tl).lerp(El,Math.sqrt(t)).multiplyScalar(f[e]),l[e*3]=u.r,l[e*3+1]=u.g,l[e*3+2]=u.b}e.setAttribute(`color`,new qe(l,3)),t.vertexColors=!0,t.needsUpdate=!0}function Ml(e,{color:t,linewidth:n,opacity:r}){let i=new xa;Ua(i,e);let a=new Sa({color:t,linewidth:n,transparent:r<1,opacity:r}),o=new Va(i,a);return o.frustumCulled=!1,{obj:o,geo:i,mat:a}}function Nl({bunn:e,dem:t,coords:n,innsjo:r,faktor:i,dykkPunkt:a=null}){let{cols:o,rows:s,transform:c}=t,l=c.pixelWidth,u=c.pixelHeight,d=new C,f=[],p=[],m=[],h=n.elevToWorldY(e.nivaa)+.4,{c0:g,c1:_,r0:v,r1:y}=e.ramme,b=[],x=[],S=new Map,w=(e,t)=>{let r=t*o+e,i=S.get(r);if(i===void 0){i=b.length/3;let[a,,o]=n.toWorld(e*l,t*u,0);b.push(a,h,o),S.set(r,i)}return i};for(let t=Math.max(0,v-1);t<=Math.min(s-2,y);t++)for(let n=Math.max(0,g-1);n<=Math.min(o-2,_);n++){let r=t*o+n;if(!(e.maske[r]||e.maske[r+1]||e.maske[r+o]||e.maske[r+o+1]))continue;let i=w(n,t),a=w(n+1,t),s=w(n,t+1),c=w(n+1,t+1);x.push(i,s,a,a,s,c)}let T=null;if(x.length){let e=new nt;e.setAttribute(`position`,new qe(new Float32Array(b),3)),e.setIndex(x),e.computeBoundingSphere();let t=new Ke({color:Dl,transparent:!0,opacity:.3,depthWrite:!1,side:2});T=t;let n=new Z(e,t);n.renderOrder=2,d.add(n),f.push(e),p.push(t)}let E=[];for(let e of r.omriss)for(let t=0;t+1<e.length;t++){let r=n.toWorld(e[t][0],e[t][1],0),i=n.toWorld(e[t+1][0],e[t+1][1],0);E.push(r[0],h+.3,r[2],i[0],h+.3,i[2])}if(E.length){let e=Ml(E,{color:kl,linewidth:2,opacity:.9});d.add(e.obj),f.push(e.geo),m.push(e.mat)}let D=[];for(let t of r.kurver){if(t.type!==0||!(t.dybde>0))continue;let r=n.elevToWorldY(e.nivaa-t.dybde*i)+.6,a=t.punkter;for(let e=0;e+1<a.length;e++){let t=n.toWorld(a[e][0],a[e][1],0),i=n.toWorld(a[e+1][0],a[e+1][1],0);D.push(t[0],r,t[2],i[0],r,i[2])}}if(D.length){let e=Ml(D,{color:735854,linewidth:1.4,opacity:.7});d.add(e.obj),f.push(e.geo),m.push(e.mat)}let O=null;if(a){let[e,,t]=n.toWorld(a.x,a.y,0);O=new C;for(let[e,t,n]of[[.86,1,.95],[.3,.4,.8]]){let r=new ze(e,t,48),i=new Ke({color:kl,transparent:!0,opacity:n,depthWrite:!1,side:2,fog:!1}),a=new Z(r,i);a.rotation.x=-Math.PI/2,a.renderOrder=3,O.add(a),f.push(r),p.push(i)}O.position.set(e,h+.5,t),d.add(O)}let[k,,A]=n.toWorld((g+_)/2*l,(v+y)/2*u,0),ee=Math.max((_-g)*Math.abs(l),(y-v)*Math.abs(u))/2;return{group:d,senter:{x:k,y:h,z:A},radius:ee,flateY:h,setResolution(e,t){for(let n of m)n.resolution.set(e,t)},settUnderside(e){T&&(T.color.setHex(e?Ol:Dl),T.opacity=e?.22:.3)},oppdaterRing(e,t,n,r=0){if(!O||(O.visible=n,!n))return;let i=2*e.position.distanceTo(O.position)*Math.tan(e.fov*Math.PI/360)/Math.max(1,t),a=1+.08*Math.sin(r*3);O.scale.setScalar(Al/2*i*a)},get ringPunkt(){return O?O.position:null},dispose(){for(let e of f)e.dispose();for(let e of p)e.dispose();for(let e of m)e.dispose()}}}var Pl=250,Fl=120,Il=50*Math.PI/180,Ll=1.5,Rl=90,zl=25,Bl=120,Vl=30;async function Hl(e,{dem:t,meta:n,getTextureSpec:a,onProgress:o=null,onTextureNote:c=null,pathFeatures:u=[],barrierFeatures:d=[],features:f=[],tour:p=null,innsjo:m=null,options:h={}}){if(!t)throw new ys(`no-dem`,`Kartet mangler høydedata`);if(p&&(!p.route?.coordinates||p.route.coordinates.length<2))throw new ys(`no-route`,`Ingen rute å vise`);let{exaggeration:_=1.15,speedKmh:v=4.5,timeScale:y=null}=h,b=null;if(m?.omriss?.length)try{let e=$a(t),n=qc(e,m);if(n){let t=Jc(n,e);b={grov:e,bunn:n,faktor:t,terrengDem:Yc(e,n,t),dykk:gl(n,e)}}}catch(e){console.warn(`[3D] Innsjøbunnen kunne ikke bygges:`,e)}let x={},S=await bs(e,{dem:t,meta:n,getTextureSpec:a,onProgress:o,onTextureNote:c,options:{exaggeration:_,tvingHimmel:h.tvingHimmel??!1,terrengDem:b?.terrengDem??null}},x),{scene:C,camera:w,coords:T,terrain:E,loop:D}=S,O=null;if(b){let{grov:t,bunn:n,faktor:r}=b;jl(E.geometry,E.material,n,t,b.terrengDem,T.exaggeration),O=Nl({bunn:n,dem:t,coords:T,innsjo:m,faktor:r,dykkPunkt:b.dykk}),C.add(O.group),D.track(O),O.setResolution(e.clientWidth,e.clientHeight)}let k=new Map,A=(e,t)=>{for(let n of k.get(e)??[])try{n(t)}catch{}},ee=p?.estWalkMinutes??h.estWalkMinutes??null,j=y??(p?yc(p.route.lengthM):128),te=Ts(u,t,T),ne=!0;C.add(te.group),D.track(te),te.setResolution(e.clientWidth,e.clientHeight);let re=null,ie=()=>(re===null&&(re=u?.length?l(u,{...s,elevationAt:i(t),barriers:d}):!1),re||null),M=Hs({scene:C,dem:t,coords:T,project:S.project}),ae=e=>yl(e??[],b?.bunn,b?.grov);f?.length&&M.setFeatures(ae(f));let N=Mc();C.add(N.group),D.track({dispose:()=>{for(let e of N.geometries)e.dispose();for(let e of N.materials)e.dispose()}});let oe=null,P=Uc(),se=e=>{e&&!oe&&(oe=Bc(t,T),C.add(oe.group),D.track(oe)),oe?.setPosition(e),e?P.push(e.x,e.y,Date.now()):P.reset()},F=null;p&&(F=jc({route:p.route,via:p.via??[],isLoop:!!p.isLoop,parkingSpots:p.parkingSpots??[],pauseSpots:p.pauseSpots??[]},t,T),C.add(F.group),D.track(F));let I=null,L=null,ce=null,le=null,R=null,ue=null,de=0,z=null,fe=!1,B=null,V=`free`,pe=!1,me=e=>{let n=r(t,e.x,e.y);return T.toWorld(e.x,e.y,Number.isFinite(n)?n:0)},he=wc([],{onEnter:e=>{let[t,n,r]=me(e);N.showAt(t,n,r),V===`follow`&&ue?.setFrameTarget({x:t,y:n,z:r,radius:e.areaM2?Math.sqrt(e.areaM2/Math.PI):60}),A(`feature-enter`,{feature:e})},onExit:e=>{N.hide(),ue?.clearFrameTarget(),A(`feature-exit`,{feature:e})}}),ge=!1;he.setEnabled(!1);let H=()=>{if(ce&&=(C.remove(ce.mesh),ce.geometry.dispose(),ce.material.dispose(),null),le){C.remove(le.sphere),C.remove(le.ring);for(let e of le.geometries)e.dispose();for(let e of le.materials)e.dispose();le=null}},_e=()=>{H(),ue?.dispose(),ue=null,R=null,L=null,I=null,z=null,B=null,de=0,he.setEvents([],0)};function ve(e,{alongM:n=0,autoplay:r=!1,animateCamera:i=!0}={}){H(),I=e;let a=uc(e.coordinates,t,T);L=mc(a),ce=_c(a),C.add(ce.mesh),le=vc(),C.add(le.sphere),C.add(le.ring);let o=e.fixed&&p?.profileSamples?.length?p.profileSamples:dc(a,T);for(R=bc({totalM:a.totalM,estWalkMinutes:ee,cumAscent:xc(o),speedKmh:v,timeScale:j}),n>0&&R.seek(Math.min(n,a.totalM)),ue?ue.setRouteLookup(L):(ue=Vt({camera:w,dem:t,coords:T,routeLookup:L,domElement:S.renderer.domElement}),ue.onHold(e=>A(`camera-hold`,{holding:e}))),he.setEvents(p?.routeFeatures?.length?Tt(p.routeFeatures,e.coordinates):[],R.alongM),he.setEnabled(ge),de=0,z=null,B=null;de<(I.junctions?.length??0)&&I.junctions[de].alongM<=R.alongM;)de++;U({inherit:!1,animate:i}),r?R.play():be()}function U({inherit:e=!0,animate:t=!0}={}){I&&ue&&(V=`follow`,pe=!1,N.hide(),W.setEnabled(!1),ue.enter(R.alongM,{inherit:e,animate:t}),ue.setInputEnabled(R.playing),A(`camera`,{detached:!1}))}function ye(){if(!I||V===`free`)return;V=`free`,pe=!1,ue?.setInputEnabled(!1),ue?.clearFrameTarget();let e=L.at(R.alongM),t=Math.hypot(w.position.x-e[0],w.position.y-e[1],w.position.z-e[2]);W.armFromCamera(t),A(`camera`,{detached:!0})}function be(){if(!I||V!==`follow`)return;let e=R.playing;W.setEnabled(!e),ue?.setInputEnabled(e)}let W=await qt({camera:w,dem:t,coords:T,domElement:S.renderer.domElement,autoRotate:!p,enabled:!p});if(O){let{senter:e,radius:t}=O;W.flyTo(e.x,e.y,e.z,{radiusM:Math.max(150,t*.9)})}W.onTakeOver(()=>{I&&!R?.playing&&ye()}),W.onTakeOverCancelled(()=>{I&&V===`free`&&(pe=!0)});let G=null,xe=!1,Se=0,Ce,we;function K(){if(Ce!==void 0)return Ce;Ce=null;try{let{grov:e,bunn:t,terrengDem:n,dykk:r}=b;Ce=al(n.data,t.maske,e,t.nivaa,r)}catch(e){console.warn(`[3D] Fant ingen vegg for dykketuren:`,e)}return Ce}function Te(){if(we!==void 0)return we;we=null;try{let{grov:e,bunn:t,dykk:n}=b,r=cl(t,e,n);r&&(we=r.punkter.map(([e,t])=>{let[n,,r]=T.toWorld(e,t,0);return[n,r]}))}catch(e){console.warn(`[3D] Fant ingen renne for dykketuren:`,e)}return we}function Ee(){return b?Te()?`renne`:K()?`vegg`:null:null}function q({redusert:e=!1}={}){let t=Oe(),n=Ee();if(!t||!n||G!==`bunn`)return!1;let r=null;if(n===`vegg`){let[e,,t]=T.toWorld(Ce.x,Ce.y,0);r={x:e,z:t}}let i=w.position;return G=`tur`,W.spillSekvens(pl({fra:{x:i.x,y:i.y,z:i.z},mot:r,rute:n===`renne`?we:null,ring:{x:t.x,z:t.z},flateY:t.flateY,gulv:(e,n)=>bl(b.terrengDem,T,e,n,t.flateY),land:(e,t)=>Pt(b.terrengDem,T,e,t,0),klaring:6*T.exaggeration,redusert:e}),{friBlikk:!0,underVann:()=>w.position.y<t.flateY,blikkpunkt:[t.x,t.flateY,t.z],tempo:De,ferdig:()=>{G===`tur`&&(w.position.y<t.flateY?G=`bunn`:(G=null,W.settGulv(null)),Y(!0))}}),Y(!0),!0}let De=1;function Oe(){let e=b?.dykk;if(!e||!O)return null;let[t,,n]=T.toWorld(e.x,e.y,0),r=O.flateY;return{x:t,z:n,flateY:r,bunnY:bl(b.terrengDem,T,t,n,r)}}function ke({redusert:e=!1}={}){let t=Oe();return!t||G?!1:(I&&(R?.pause(),ye(),pe=!1),N.hide(),G=`ned`,W.settGulv((e,n)=>w.position.y<t.flateY?bl(b.terrengDem,T,e,n,t.flateY):-1/0),W.spillSekvens(Sl({...t,redusert:e}),{underVann:!0,ferdig:()=>{G=`bunn`,Y(!0),!e&&Ee()&&setTimeout(()=>{G===`bunn`&&q()},1500)}}),Y(!0),!0)}function J({redusert:e=!1}={}){if(!G||G===`opp`)return;let t=w.position;G=`opp`,W.spillSekvens(Cl({x:t.x,z:t.z,flateY:O.flateY,redusert:e}),{ferdig:()=>{G=null,W.settGulv(null),Y(!0);let{senter:e,radius:t}=O;W.flyTo(e.x,e.y,e.z,{radiusM:Math.max(150,t*.9)})}}),Y(!0)}function Ae(e){if(G!==`tur`)return{pauset:!1};let t=W.sekvensStatus,n=w.position,{x:r,y:i}=T.toSvg(n.x,n.z);return{pauset:W.pauset,bunnDybde:e?ml(b.bunn,b.grov,r,i):null,igjen:t?hl(t.steg,t.i,n.x,n.z):0}}function Y(e=!1,t=0){if(!e&&t-Se<Fl)return;Se=t;let n=!!O&&w.position.y<O.flateY,r=n?wl({camY:w.position.y,flateY:O.flateY,coords:T,faktor:b.faktor}):0;A(`dykk`,{tilstand:G,tur:G===`bunn`?Ee():null,fase:W.sekvensFase,under:n,dybde:r,morke:n?el(r):0,...Ae(n)})}function X(t){if(!O)return;let n=O.flateY,r=w.position.y<n;if(r){let e=wl({camY:w.position.y,flateY:n,coords:T,faktor:b.faktor}),{near:t,far:r}=nl(e,n-w.position.y);S.setUnderVann({farge:tl(e),near:t,far:r})}else xe&&S.setUnderVann(null);r===xe?G&&Y(!1,t):(xe=r,O.settUnderside(r),Y(!0,t));let i=(!G||W.sekvensFase===`fugl`)&&!r;O.oppdaterRing(w,e.clientHeight,i,t/1e3)}function je(e){let t=O?.ringPunkt;if(!t||G||w.position.y<O.flateY)return!1;let n=S.project(t.x,t.y,t.z);if(n.behind)return!1;let r=S.renderer.domElement.getBoundingClientRect(),i=e.clientX-r.left-n.x,a=e.clientY-r.top-n.y;return Math.hypot(i,a)>34?!1:ke({redusert:Ne()})}function Ne(){return typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches}function Pe(e,t){let n=ie();if(!n)return!1;let r=W.cameraSvgXY(),i=cc(n,[e,t],r,{tolM:Rl});if(!i)return!1;let a=sc(n,i.nodeId,{headingXY:i.headingXY});return a.coordinates.length<2?!1:(ve({...a,fixed:!1},{autoplay:!1}),A(`trip-start`,{lengthM:a.lengthM,junctions:a.junctions.length,fixed:!1}),!0)}function Fe(){if(!I||I.fixed)return;let e=L?.at(R?.alongM??0),t=e?Math.hypot(w.position.x-e[0],w.position.y-e[1],w.position.z-e[2]):400;_e(),N.hide(),V=`free`,W.armFromCamera(t),A(`trip-end`,{})}let Ie=new Me,Le=new _t;function Re(e,{radiusM:t=60,headingXY:n=null}={}){I&&(R.pause(),ye(),pe=!1),W.flyTo(e[0],e[1],e[2],{radiusM:t,headingXY:n})}let ze=new g;function Be(){return w.getWorldDirection(ze),{azimut:Math.atan2(ze.x,-ze.z)*180/Math.PI,hoyde:Math.asin(Math.max(-1,Math.min(1,ze.y)))*180/Math.PI,avstand:W.avstand}}let Ve=null,He=[],Ue=null,We={x:0,y:0},Ge={sol:18,mane:18,planet:18,stjerne:8};function Ke(){if(!He.length)return!1;let e=S.renderer.domElement.clientWidth,t=S.renderer.domElement.clientHeight,n=(We.x+1)/2*e,r=(1-We.y)/2*t,i=({azimut:e,hoyde:t})=>{let[n,r,i]=Rt(e,t,2e4),a=S.project(w.position.x+n,w.position.y+r,w.position.z+i);return{x:a.x,y:a.y,bak:a.behind}},a=null,o=1/0;for(let e of He){let t;if(e.type===`formasjon`)t=Gt(n,r,(e.punkter??[]).map(i),e.segmenter);else{let a=i(e);if(a.bak)continue;t=Math.hypot(a.x-n,a.y-r)}if(t>46)continue;let s=t-(Ge[e.type]??0);s<o&&(o=s,a=e)}return a?(qe(a),A(`himmel-valgt`,{objekt:a}),!0):!1}function qe(e){Ue=e??null;let t=e?.type===`formasjon`||e?.type===`stjerne`?e:null;S.settValgtFormasjon(t),Ya(e)?S.startValgRipple(e):S.stoppValgRipple(),e&&W.seMot(e.azimut,e.hoyde),e&&(e.type===`sol`||e.type===`mane`||e.type===`planet`)?Ye(e):Xe()}let Je=null;function Ye(e){let t=e.type===`mane`?`mane`:String(e.id??``).replace(/^planet:/,``);S.aapneGlobe({...e,legeme:t})?(W.setEnabled(!1),A(`globe`,{apen:!0,legeme:t,navn:S.globeNavn,harTekstur:S.globeHarTekstur})):Xe()}function Xe(){S.globeAapen&&(S.lukkGlobe(),Je=null,I&&V!==`free`&&R?.playing||W.setEnabled(!0),A(`globe`,{apen:!1}))}function Ze(){return S.globeAapen?(Xe(),A(`globe-avsluttet`,{objekt:Ue}),!0):!1}let Qe=e=>{S.globeAapen&&(Je={x:e.clientX,y:e.clientY})},$e=e=>{Je&&S.globeAapen&&(S.dreiGlobe(e.clientX-Je.x,e.clientY-Je.y),Je={x:e.clientX,y:e.clientY})},et=()=>{Je=null};function tt(e){if(V===`follow`&&ue?.holdConsumed)return;if(S.globeAapen){Ze();return}if(G||je(e))return;let t=S.renderer.domElement.getBoundingClientRect();if(Le.x=(e.clientX-t.left)/t.width*2-1,Le.y=-((e.clientY-t.top)/t.height)*2+1,Ie.setFromCamera(Le,w),We={x:Le.x,y:Le.y},oe?.visible&&Ie.intersectObjects(oe.hitMeshes,!1)[0]){let e=oe.position;N.hide(),Re([e.x,e.y,e.z],{radiusM:90,headingXY:P.heading(Date.now())}),A(`fly-to-gps`,{});return}let n=S.renderer.domElement.clientWidth,r=S.renderer.domElement.clientHeight,i=(Le.x+1)/2*n,a=(1-Le.y)/2*r,o=M.raycast(Ie)??M.naermesteISkjerm?.(S.project,i,a,34);if(o){Ve=W.hentPose?.()??null,N.showAt(...o.world),Re(o.world,{radiusM:o.radiusM}),A(`feature`,{feature:{...o.feature,type:kt(o.feature)}});return}let s=F?.pick(Ie);if(s){N.showAt(...s.world),Re(s.world,{radiusM:70}),A(`feature`,{feature:{name:s.name,type:s.kind===`parkering`||s.kind===`rast`?s.kind:`veipunkt`,waypoint:s.kind}});return}let c=Ie.intersectObject(E.mesh,!1)[0];if(!c)return void Ke();if(S.erNatt&&Ke())return;let{x:l,y:u}=T.toSvg(c.point.x,c.point.z),d=()=>{let e=ie();return!!e&&!!cc(e,[l,u],W.cameraSvgXY(),{tolM:Rl})};I?I.fixed&&ne&&d()&&A(`tour-locked`,{}):ne?Pe(l,u)||A(`no-path`,{x:l,y:u}):d()&&A(`paths-hidden`,{x:l,y:u})}let nt=Us(S.renderer.domElement,tt);{let e=S.renderer.domElement;e.addEventListener(`pointerdown`,Qe),e.addEventListener(`pointermove`,$e),e.addEventListener(`pointerup`,et),e.addEventListener(`pointercancel`,et)}let rt=0,it=0,at=0,ot=!1;Object.assign(x,{onResize(e,t){te.setResolution(e,t),O?.setResolution(e,t)},onFrame(e,t){if(pe&&U({inherit:!0,animate:!1}),I&&R){let n=e*1e3,r=R.finished;R.tick(e);let i=R.alongM;!r&&R.finished&&(he.seek(i),be());let a=R.playing?he.tick(i,n):{speedFactor:1,state:he.state,active:he.active};R.setSpeedFactor(a.speedFactor);let o=L.at(i);le.setPosition(o[0],o[1],o[2]),le.pulse(t),ce.setProgress(i),V===`follow`?ue.update(e,i):W.update(e),Z(i)}else W.update(e);N.update(t,w),oe?.update(t,w),F?.update(w),S.updateAmbient(e,t),M.update(w),X(t*1e3),S.render();let n=t*1e3;if(M.maybeDeclutter(n),S.globeAapen&&n-it>Fl&&(it=n,A(`globe-trekk`,{trekk:S.globeTrekkPaaSkjerm()})),n-at>Fl&&(at=n,A(`blikk`,Be())),n-rt>Pl){if(rt=n,I&&R){let e=R.stats(),t=L.at(R.alongM);A(`progress`,{...e,walking:!0,fixed:!!I.fixed,detached:V===`free`,serOpp:V===`free`&&W.himmelVipp>0,elevM:T.worldYToElev(t[1])-3}),e.finished&&A(`finished`,e)}else A(`progress`,{walking:!1,autoRotating:W.autoRotating,serOpp:W.himmelVipp>0,elevM:T.worldYToElev(w.position.y)})}},onContextLost:()=>A(`context-lost`,{}),onDead:()=>A(`engine-dead`,{})});function Z(e){if(!I.junctions?.length)return;let t=I.junctions[de];t&&e>=t.alongM-Bl&&z!==t&&(z=t,A(`junction`,{junction:t})),fe&&z&&B!==z&&R.playing&&e>=z.alongM-zl&&(B=z,R.pause(),be(),A(`junction-pause`,{junction:z})),t&&e>t.alongM+Vl&&(de++,B===t&&(B=null),z===t&&(z=null,A(`junction`,{junction:null})))}return p&&ve({...p.route,fixed:!0},{autoplay:!1,animateCamera:!1}),D.start(),A(`ready`,{pathCount:u?.length??0,fixed:!!p}),{setFeatures(e){M.setFeatures(ae(e))},setPinsVisible(e){M.setVisible(e),F?.setPinsVisible(e),e||N.hide()},setPinGroups(e){M.setGroups(e)},setPathsVisible(e){ne=!!e,te.setVisible(ne)},get hasPaths(){return!te.isEmpty},setUserPosition:se,innsjo:b?{navn:m.navn??null,faktor:b.faktor,maksDybde:m.maks??b.bunn.maksDybde}:null,get kanDykke(){return!!b?.dykk},dykkNed(e){return ke(e)},dykkOpp(e){J(e)},dykketur(e){return q(e)},pauseDykketur(e){G===`tur`&&(W.settPause(e),Y(!0))},settDykkeTempo(e){e>0&&(De=e,G===`tur`&&W.settTempo(e))},tilInnsjoen(){if(!O)return;if(G){J({redusert:Ne()});return}let{senter:e,radius:t}=O;W.flyTo(e.x,e.y,e.z,{radiusM:Math.max(150,t*.9)})},overview(){N.hide(),G&&(G=null,W.settGulv(null),Y(!0)),qe(null),I&&(R.pause(),ye(),pe=!1),W.resetToOverview()},followRoute(){U({inherit:!0})},get detached(){return V===`free`},get autoRotating(){return W.autoRotating},get himmelVipp(){return W.himmelVipp},get blikk(){return Be()},settTvingHimmel(e){S.settTvingHimmel(e)},seMotNord(){W.vendMotNord()},settBlikkHoyde(e){Number.isFinite(e)&&W.settBlikkHoyde(e*Math.PI/180)},settBlikkRetning(e,t){Number.isFinite(t)&&W.settBlikkRetning(Number.isFinite(e)?e*Math.PI/180:null,t*Math.PI/180)},get avstand(){return W.avstand},avstandsGrenser(){return W.avstandsGrenser()},settAvstand(e){W.settAvstand(e)},seOppMotHimmelen(e=Il){W.seMot(W.blikkAzimut,e,{tid:Ll,ease:`ut`})},apneStjernehimmel(e=Il){N.hide(),I&&(R.pause(),ye(),pe=!1),W.settOversiktStraks(),W.seMot(W.blikkAzimut,e,{tid:Ll,ease:`ut`})},setHimmelObjekter(e){He=Array.isArray(e)?e:[],Ue&&!He.some(e=>e.id===Ue.id)&&qe(null)},velgHimmel:qe,fokuserHimmel(){return Ue?(W.seMot(Ue.azimut,Ue.hoyde),!0):!1},get valgtHimmel(){return Ue},get globeAapen(){return S.globeAapen},lukkGlobe:Xe,avsluttGlobe:Ze,globeTrekkPaaSkjerm:()=>S.globeTrekkPaaSkjerm(),get walking(){return!!I},get isFixedTour(){return!!I?.fixed},get tripLengthM(){return I?.lengthM??0},get totalM(){return L?.totalM??0},play(){R&&(U({inherit:!1,animate:!0}),R.play(),be())},pause(){R?.pause(),be()},restart(){R&&(R.restart(),he.seek(0),U({inherit:!1,animate:!0}),be())},stopTrip(){Fe()},scrubStart(){R?.pause(),V===`free`&&U({inherit:!0}),be()},scrub(e){if(R&&I){for(R.seek(e),he.seek(e),de=0;de<(I.junctions?.length??0)&&I.junctions[de].alongM<=R.alongM;)de++;z&&(z=null,B=null,A(`junction`,{junction:null}))}},scrubEnd(){be()},setTimeScale(e){j=e,R?.setTimeScale(e)},setAutoPauseJunctions(e){fe=!!e},chooseBranch(e){let t=ie();if(!t||!I||I.fixed||!z)return;let n=lc(t,I,z,e);if(n===I)return;let r=R.alongM;z=null,A(`junction`,{junction:null}),ve({...n,fixed:!1},{alongM:r,autoplay:!0})},setPoiStops(e){ge=!!e,he.setEnabled(ge),ge&&R&&he.seek(R.alongM)},skipFeature(){he.skip()},angreFeature(){N.hide(),Ve&&=(W.settPose?.(Ve),null)},setContoursVisible:e=>S.setContoursVisible(e),get contoursVisible(){return S.contoursVisible},setNightMode:e=>S.setNightMode(e),setVaer:e=>S.setVaer(e),setNordlys:e=>S.setNordlys(e),get nordlysStyrke(){return S.nordlysStyrke},get nordlysGardiner(){return S.nordlysGardiner},on:(e,t)=>{k.has(e)||k.set(e,new Set),k.get(e).add(t)},off:(e,t)=>k.get(e)?.delete(t),resize:()=>S.resize(),get state(){return R?{...R.stats(),walking:!0,fixed:!!I?.fixed,detached:V===`free`}:{walking:!1}},dispose(){if(!ot){ot=!0,nt.dispose();{let e=S.renderer.domElement;e.removeEventListener(`pointerdown`,Qe),e.removeEventListener(`pointermove`,$e),e.removeEventListener(`pointerup`,et),e.removeEventListener(`pointercancel`,et)}_e(),W.dispose(),M.dispose(),k.clear(),S.dispose()}}}}var Ul=e({PIN_GROUPS:()=>At,TourSceneError:()=>ys,buildFeatureTimeline:()=>Tt,clusterFeaturesByMeters:()=>Et,collectAllFeatures:()=>Ot,collectBrukerminnePins:()=>Ct,collectMapFeatures:()=>jt,countByGroup:()=>vt,create3dScene:()=>Hl,defaultTimeScale:()=>yc,featureType:()=>kt,findParkingSpots:()=>bt,findPauseSpots:()=>xt,fmtAscent:()=>Qt,fmtDurationMin:()=>Ft,fmtKm:()=>Zt,fmtMoh:()=>Mt,groupOfKind:()=>yt,loadHeritageForMap:()=>wt,loadNveFeatures:()=>Dt,poiColor:()=>n});export{At as PIN_GROUPS,ys as TourSceneError,xa as a,Tt as buildFeatureTimeline,Et as clusterFeaturesByMeters,Ot as collectAllFeatures,Ct as collectBrukerminnePins,jt as collectMapFeatures,vt as countByGroup,Hl as create3dScene,yc as defaultTimeScale,kt as featureType,bt as findParkingSpots,xt as findPauseSpots,Qt as fmtAscent,Ft as fmtDurationMin,Zt as fmtKm,Mt as fmtMoh,yt as groupOfKind,Sa as i,wt as loadHeritageForMap,Dt as loadNveFeatures,Ua as n,n as poiColor,Va as r,Ul as t};
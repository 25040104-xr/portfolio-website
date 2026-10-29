import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "./palette.js";

const PANEL_W = 7.0; // each panel reaches the side walls of the stage: no gap at the edges
const EDGE = PANEL_W; // x of the outer edge of a panel

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vPleat;
  varying float vSlope;
  void main() {
    vUv = uv;
    vec3 p = position;
    float ph = uv.x * 24.0 * 3.14159265;
    vPleat = sin(ph);
    vSlope = cos(ph);
    float depth = 0.13 + 0.03 * (1.0 - uv.y);                                   // deeper folds toward the hem
    p.z += vPleat * depth;
    p.z += sin(uTime * 0.9 + uv.x * 7.0 + uv.y * 2.5) * 0.04 * (1.0 - uv.y);    // a gentle sway, strongest at the hem
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vPleat;
  varying float vSlope;
  void main() {
    float lit = clamp(vSlope * 0.5 + 0.5, 0.0, 1.0);            // the side of each fold that faces the light
    vec3 c = mix(uDeep, uLight, lit * 0.9);
    c *= 0.78 + 0.22 * (vPleat * 0.5 + 0.5);                    // valleys are darker than ridges
    c *= mix(0.45, 1.0, smoothstep(0.0, 0.3, 1.0 - vUv.y));     // the shadow under the valance
    c *= mix(0.7, 1.0, smoothstep(0.0, 0.12, vUv.y));           // the shadow at the floor
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const ease = (t) => t * t * (3 - 2 * t);

function Panel({ side, anim, reduced, open, onOpen }) {
  const mesh = useRef();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(C.deep) },
          uLight: { value: new THREE.Color(C.light) },
        },
      }),
    []
  );

  useFrame((state) => {
    if (!mesh.current) return;
    const e = ease(anim.current.curtain);
    // the panels slide to the sides and gather into folds, keeping their outer edge in place
    const sx = THREE.MathUtils.lerp(1, 0.16, e);
    mesh.current.scale.x = sx;
    mesh.current.position.x = side * (EDGE - (PANEL_W / 2) * sx);
    material.uniforms.uTime.value = reduced ? 0 : state.clock.elapsedTime;
  });

  return (
    <mesh
      ref={mesh}
      position={[side * (PANEL_W / 2), 3.2, 1.5]}
      material={material}
      onClick={(e) => {
        e.stopPropagation();
        if (!open) onOpen();
      }}
      onPointerOver={() => {
        if (!open) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <planeGeometry args={[PANEL_W, 6.4, 120, 40]} />
    </mesh>
  );
}

/* The curtain: two pleated panels, a seam of light between them, and that light spilling on the floor.
   It all goes out as the curtain opens, and is then switched off completely:
   a see-through plane left in the middle of the stage would still hide the light beam behind it. */
export default function Curtain({ anim, open, reduced, onOpen }) {
  const seam = useRef();
  const glow = useRef();
  const pool = useRef();
  const seamMesh = useRef();
  const glowMesh = useRef();
  const poolMesh = useRef();

  const glowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 4;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(255,233,176,0)");
    grad.addColorStop(0.5, "rgba(255,233,176,0.65)");
    grad.addColorStop(1, "rgba(255,233,176,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  // light that leaks under the seam and falls on the floor: brightest at the curtain, gone toward the audience
  const poolTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const g = c.getContext("2d");
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "rgba(255,233,176,0.8)");
    v.addColorStop(1, "rgba(255,233,176,0)");
    g.fillStyle = v;
    g.fillRect(0, 0, 128, 256);
    g.globalCompositeOperation = "destination-in";
    const hz = g.createLinearGradient(0, 0, 128, 0);
    hz.addColorStop(0, "rgba(0,0,0,0)");
    hz.addColorStop(0.5, "rgba(0,0,0,1)");
    hz.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = hz;
    g.fillRect(0, 0, 128, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    []
  );

  useFrame(() => {
    const o = 1 - ease(anim.current.curtain);
    if (seam.current) seam.current.opacity = o;
    if (glow.current) glow.current.opacity = o * 0.8;
    if (pool.current) pool.current.opacity = o * 0.9;
    const show = o > 0.003;
    if (seamMesh.current) seamMesh.current.visible = show;
    if (glowMesh.current) glowMesh.current.visible = show;
    if (poolMesh.current) poolMesh.current.visible = show;
  });

  return (
    <group>
      <Panel side={-1} anim={anim} reduced={reduced} open={open} onOpen={onOpen} />
      <Panel side={1} anim={anim} reduced={reduced} open={open} onOpen={onOpen} />

      <mesh ref={seamMesh} position={[0, 3.2, 1.42]}>
        <planeGeometry args={[0.1, 6.4]} />
        <meshBasicMaterial
          ref={seam}
          color="#FFE9B0"
          transparent
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh ref={glowMesh} position={[0, 3.2, 1.43]}>
        <planeGeometry args={[1.4, 6.4]} />
        <meshBasicMaterial
          ref={glow}
          map={glowTex}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh ref={poolMesh} position={[0, 0.03, 3.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 3.4]} />
        <meshBasicMaterial
          ref={pool}
          map={poolTex}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}
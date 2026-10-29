import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "./palette.js";
import Stage from "./Stage.jsx";
import Curtain from "./Curtain.jsx";
import Marquee from "./Marquee.jsx";
import Performer from "./Performer.jsx";
import Posters from "./Posters.jsx";

// ---- Things you may want to tune ---------------------------------------------
const SPOT_INTENSITY = 260; // brightness of the spotlight
const HEMI_INTENSITY = 0.7; // brightness of the general light
const FOV = 38;

// Where the camera stands, and what it looks at, for each act.
// In front of the closed curtain: high enough to see the whole curtain and the beam above it.
const CURTAIN_POSE = { pos: [0, 2.7, 11.8], look: [0, 3.2, 0] };
const POSES = [
  { pos: [1.2, 1.6, 4.6], look: [0.0, 1.4, -1.8] }, // 0 Home: me and the microphone
  { pos: [0.8, 1.7, 3.0], look: [-0.6, 2.2, -4.0] }, // 1 Work: the back wall
  { pos: [-2.4, 1.5, 2.2], look: [-1.3, 1.4, -1.8] }, // 2 About: close to me
  { pos: [0.5, 1.45, 2.7], look: [-0.9, 1.35, -1.8] }, // 3 Contact: close to the microphone
];
const POSES_PORTRAIT = [
  { pos: [0.4, 1.9, 8.2], look: [0.0, 1.2, -1.8] },
  { pos: [0.4, 2.2, 5.8], look: [-0.6, 2.4, -4.0] },
  { pos: [-1.6, 1.7, 5.0], look: [-1.3, 1.3, -1.8] },
  { pos: [0.2, 1.6, 5.0], look: [-0.9, 1.3, -1.8] },
];
// -------------------------------------------------------------------------------

const easeInOut = (t) => t * t * (3 - 2 * t);

/* Counts the time since the curtain was tapped, and turns it into
   the progress of each moment: the curtain opening, the riser rising, my wave. */
function Timeline({ open, anim, reduced }) {
  useFrame((_, dt) => {
    const a = anim.current;
    if (!open) return;
    if (reduced) {
      a.curtain = 1;
      a.rise = 1;
      a.wave = 99;
      return;
    }
    a.t += dt;
    a.curtain = Math.min(1, a.t / 1.9);
    a.rise = Math.min(1, Math.max(0, (a.t - 1.1) / 1.5));
    if (a.rise >= 1) a.wave += dt;
  });
  return null;
}

/* The camera. It stands in front of the closed curtain and breathes a little,
   glides in when the curtain opens, and then moves between poses as the visitor scrolls. */
function CameraRig({ anim, progressRef, reduced }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(...CURTAIN_POSE.pos), []);
  const look = useMemo(() => new THREE.Vector3(...CURTAIN_POSE.look), []);
  const cp = useMemo(() => new THREE.Vector3(...CURTAIN_POSE.pos), []);
  const cl = useMemo(() => new THREE.Vector3(...CURTAIN_POSE.look), []);
  const tp = useMemo(() => new THREE.Vector3(), []);
  const tl = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const mouse = useRef({ x: 0, y: 0 });

  // A small parallax with the mouse: the scene has depth. Not on touch screens, not with reduced motion.
  useEffect(() => {
    if (reduced) return undefined;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return undefined;
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useFrame((state, dt) => {
    const poses = size.width / size.height < 0.9 ? POSES_PORTRAIT : POSES;
    const p = THREE.MathUtils.clamp(progressRef.current, 0, poses.length - 1);
    const i = Math.min(Math.floor(p), poses.length - 2);
    const f = p - i;
    const s = easeInOut(f);

    a.set(...poses[i].pos);
    b.set(...poses[i + 1].pos);
    tp.lerpVectors(a, b, s);
    a.set(...poses[i].look);
    b.set(...poses[i + 1].look);
    tl.lerpVectors(a, b, s);

    // from the curtain pose to the current pose as the curtain opens
    const e = easeInOut(anim.current.curtain);
    tmp.copy(tp);
    tp.lerpVectors(cp, tmp, e);
    tmp.copy(tl);
    tl.lerpVectors(cl, tmp, e);

    // the mouse moves the view a little, also in front of the curtain
    const par = 0.45 + 0.55 * e;
    tp.x += mouse.current.x * 0.35 * par;
    tp.y -= mouse.current.y * 0.15 * par;
    // and the camera breathes, so that nothing is ever perfectly still
    if (!reduced) {
      const t = state.clock.elapsedTime;
      tp.x += Math.sin(t * 0.35) * 0.1;
      tp.y += Math.sin(t * 0.27) * 0.04;
    }

    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    pos.lerp(tp, k);
    look.lerp(tl, k);
    camera.position.copy(pos);
    camera.lookAt(look);
  });
  return null;
}

/* The light cone you can see in the air */
function Beam({ anim, blackout }) {
  const mat = useRef();
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "rgba(255,233,176,0.50)");
    grad.addColorStop(1, "rgba(255,233,176,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useFrame(() => {
    if (!mat.current) return;
    const on = THREE.MathUtils.smoothstep(anim.current.curtain, 0.35, 0.9);
    mat.current.opacity = on * (blackout.current ? 0.05 : 1) * 0.9;
  });

  return (
    <mesh position={[-1.4, 3.45, -0.5]} rotation={[0.4, 0, 0]} renderOrder={2}>
      <cylinderGeometry args={[0.12, 1.5, 6.63, 48, 1, true]} />
      <meshBasicMaterial
        ref={mat}
        map={tex}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/* The spotlight on me. It turns on as the curtain opens, and dims for the quick change. */
function Spot({ anim, blackout }) {
  const light = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    target.position.set(-1.35, 0.5, -1.8);
    if (light.current) light.current.target = target;
  }, [target]);

  useFrame((_, dt) => {
    if (!light.current) return;
    const on = THREE.MathUtils.smoothstep(anim.current.curtain, 0.35, 0.9);
    const goal = SPOT_INTENSITY * on * (blackout.current ? 0.03 : 1);
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, goal, 6, dt);
  });

  return (
    <>
      <spotLight
        ref={light}
        position={[-1.4, 6.6, 0.9]}
        angle={0.38}
        penumbra={0.85}
        intensity={0}
        decay={2}
        color="#FFE9B0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      <primitive object={target} />
      <Beam anim={anim} blackout={blackout} />
    </>
  );
}

export default function Scene({ open, progressRef, outfit, blackout, reduced, onOpen, onReady, work }) {
  const anim = useRef({ t: 0, curtain: 0, rise: 0, wave: 0 });
  const black = useRef(false);
  black.current = blackout;

  return (
    <Canvas
      shadows
      flat
      dpr={[1, 1.75]}
      camera={{ fov: FOV, near: 0.1, far: 80, position: CURTAIN_POSE.pos }}
      gl={{ antialias: true }}
      onCreated={() => onReady && onReady()}
    >
      <color attach="background" args={[C.navy]} />
      <fog attach="fog" args={[C.navy, 16, 36]} />
      <hemisphereLight args={[C.sky, C.navy, HEMI_INTENSITY]} />

      <Timeline open={open} anim={anim} reduced={reduced} />
      <CameraRig anim={anim} progressRef={progressRef} reduced={reduced} />
      <Spot anim={anim} blackout={black} />

      <Stage />
      <Posters progressRef={progressRef} work={work} />
      <Curtain anim={anim} open={open} reduced={reduced} onOpen={onOpen} />
      <Marquee anim={anim} open={open} reduced={reduced} onOpen={onOpen} />
      <Performer anim={anim} outfit={outfit} />
    </Canvas>
  );
}
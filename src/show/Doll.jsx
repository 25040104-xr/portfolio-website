import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { C } from "./palette.js";

const HEIGHT = 1.95; // a model of your own is scaled to this height

// How I look: brown hair to the collarbone, light-brown square glasses, a V-neck top
const HAIR = "#6E4A2E";
const FRAME = "#B88858";
const TOP_GREY = "#C9CED6";
const TOP_NAVY = "#1B2A4C";

async function exists(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const type = r.headers.get("content-type") || "";
    // the dev server answers unknown addresses with the web page itself, so check the type
    return r.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

/* Looks for a model of your own: public/models/doll-<outfit>.glb first, then public/models/doll.glb */
function useModelUrl(outfit) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const own = `/models/doll-${outfit}.glb`;
      const any = "/models/doll.glb";
      const found = (await exists(own)) ? own : (await exists(any)) ? any : null;
      if (live) setUrl(found);
    })();
    return () => {
      live = false;
    };
  }, [outfit]);
  return url;
}

function GlbDoll({ url }) {
  const gltf = useGLTF(url);
  const { object, scale } = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(o);
    const h = box.max.y - box.min.y || 1;
    o.position.y -= box.min.y; // the feet on the ground
    return { object: o, scale: HEIGHT / h };
  }, [gltf]);
  return (
    <group scale={scale}>
      <primitive object={object} />
    </group>
  );
}

function Arm({ shirt }) {
  return (
    <>
      <mesh position={[0, -0.2, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.3, 6, 12]} />
        <meshStandardMaterial color={shirt} roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.46, 0]} castShadow>
        <sphereGeometry args={[0.065, 16, 12]} />
        <meshStandardMaterial color={C.skin} roughness={0.7} />
      </mesh>
    </>
  );
}

/* Square glasses with light-brown frames */
function Glasses() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.5 }), []);
  const W = 0.18;
  const H = 0.13;
  const T = 0.014;
  return (
    <group position={[0, 0.01, 0.352]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.125, 0, 0]}>
          <mesh position={[0, H / 2, 0]} material={mat}>
            <boxGeometry args={[W, T, T]} />
          </mesh>
          <mesh position={[0, -H / 2, 0]} material={mat}>
            <boxGeometry args={[W, T, T]} />
          </mesh>
          <mesh position={[-W / 2, 0, 0]} material={mat}>
            <boxGeometry args={[T, H, T]} />
          </mesh>
          <mesh position={[W / 2, 0, 0]} material={mat}>
            <boxGeometry args={[T, H, T]} />
          </mesh>
        </group>
      ))}
      {/* the bridge */}
      <mesh position={[0, H / 2 - 0.02, 0]} material={mat}>
        <boxGeometry args={[0.06, T, T]} />
      </mesh>
      {/* the arms that go back to the ears */}
      {[-1, 1].map((s) => (
        <mesh key={`arm${s}`} position={[s * 0.275, H / 2 - 0.02, -0.12]} rotation={[0, s * -0.432, 0]} material={mat}>
          <boxGeometry args={[T, T, 0.286]} />
        </mesh>
      ))}
    </group>
  );
}

/* A toy-like figure built from simple shapes: the stand-in until you have a model of your own */
function ToyDoll({ outfit, anim }) {
  const root = useRef();
  const head = useRef();
  const eyes = useRef();
  const armWave = useRef();
  const work = outfit === "work";
  const shirt = work ? TOP_NAVY : TOP_GREY;

  const vShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.1, 0);
    s.lineTo(0.1, 0);
    s.lineTo(0, -0.16);
    s.closePath();
    return s;
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (root.current) root.current.position.y = Math.sin(t * 1.7) * 0.012;
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 0.8) * 0.04;
      head.current.rotation.y = Math.sin(t * 0.5) * 0.12;
    }
    if (eyes.current) eyes.current.scale.y = t % 4.3 < 0.12 ? 0.1 : 1;
    if (armWave.current) {
      // a wave once I have risen: this is how I say hello
      const w = outfit === "hello" ? anim.current.wave : 99;
      const goal = w > 0 && w < 2.4 ? 2.5 + Math.sin(w * 11) * 0.3 : 0.14;
      armWave.current.rotation.z = THREE.MathUtils.damp(armWave.current.rotation.z, goal, 10, dt);
    }
  });

  return (
    <group ref={root}>
      {[-1, 1].map((s) => (
        <mesh key={`shoe${s}`} position={[s * 0.1, 0.04, 0.04]} castShadow>
          <boxGeometry args={[0.15, 0.08, 0.26]} />
          <meshStandardMaterial color={C.cream} roughness={0.6} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`leg${s}`} position={[s * 0.1, 0.315, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.32, 6, 14]} />
          <meshStandardMaterial color={C.navy} roughness={0.7} />
        </mesh>
      ))}

      <mesh position={[0, 0.84, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.28, 8, 20]} />
        <meshStandardMaterial color={shirt} roughness={0.75} />
      </mesh>

      {/* the V-neck */}
      <mesh position={[0, 1.1, 0.192]}>
        <shapeGeometry args={[vShape]} />
        <meshStandardMaterial color={C.skin} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      <group position={[-0.26, 1.08, 0]} rotation={[0, 0, -0.14]}>
        <Arm shirt={shirt} />
      </group>
      <group ref={armWave} position={[0.26, 1.08, 0]} rotation={[0, 0, 0.14]}>
        <Arm shirt={shirt} />
      </group>

      {/* Hello: the pass on a lanyard */}
      {outfit === "hello" && (
        <group>
          {[-1, 1].map((s) => (
            <mesh key={`strap${s}`} position={[s * 0.075, 1.0, 0.2]} rotation={[0, 0, -s * 0.28]}>
              <boxGeometry args={[0.018, 0.3, 0.012]} />
              <meshStandardMaterial color={C.yellow} roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 0.82, 0.21]}>
            <boxGeometry args={[0.11, 0.15, 0.014]} />
            <meshStandardMaterial color={C.cobalt} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.88, 0.213]}>
            <boxGeometry args={[0.11, 0.03, 0.016]} />
            <meshStandardMaterial color={C.yellow} roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* Work: a laptop */}
      {work && (
        <group position={[0, 0.7, 0.34]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.025, 0.32]} />
            <meshStandardMaterial color="#DDE3EE" roughness={0.4} metalness={0.3} />
          </mesh>
          <group position={[0, 0.012, -0.16]} rotation={[0.3, 0, 0]}>
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.46, 0.3, 0.02]} />
              <meshStandardMaterial color="#C9D1E0" roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.15, 0.012]}>
              <sphereGeometry args={[0.025, 16, 12]} />
              <meshStandardMaterial color={C.yellow} roughness={0.4} />
            </mesh>
          </group>
        </group>
      )}

      {/* Contact: a phone */}
      {outfit === "contact" && (
        <group position={[0.34, 0.78, 0.14]} rotation={[-0.3, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.07, 0.14, 0.012]} />
            <meshStandardMaterial color={C.navy} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.007]}>
            <boxGeometry args={[0.058, 0.122, 0.002]} />
            <meshBasicMaterial color={C.cream} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* the head: large, like a toy */}
      <group ref={head} position={[0, 1.52, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.34, 40, 28]} />
          <meshStandardMaterial color={C.skin} roughness={0.7} />
        </mesh>

        {/* the hair: a cap tilted back so the hairline is above the eyes, the long hair behind, and a lock on each side */}
        <mesh rotation={[-0.5, 0, 0]} castShadow>
          <sphereGeometry args={[0.352, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={HAIR} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.1, -0.12]} scale={[1, 1.15, 0.65]} castShadow>
          <sphereGeometry args={[0.31, 32, 24]} />
          <meshStandardMaterial color={HAIR} roughness={0.8} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`lock${s}`} position={[s * 0.3, -0.2, 0.02]} rotation={[0, 0, s * 0.06]} castShadow>
            <capsuleGeometry args={[0.07, 0.3, 6, 12]} />
            <meshStandardMaterial color={HAIR} roughness={0.8} />
          </mesh>
        ))}

        <group ref={eyes} position={[0, 0.02, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={`eye${s}`} position={[s * 0.12, 0, 0.31]}>
              <sphereGeometry args={[0.034, 14, 12]} />
              <meshStandardMaterial color={C.navy} roughness={0.4} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, -0.11, 0.322]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.055, 0.009, 8, 20, Math.PI]} />
          <meshStandardMaterial color={C.navy} roughness={0.5} />
        </mesh>

        <Glasses />

        {/* Work: a crew headset */}
        {work && (
          <group position={[0, 0.02, 0]}>
            <mesh castShadow>
              <torusGeometry args={[0.39, 0.02, 10, 40, Math.PI]} />
              <meshStandardMaterial color={C.cream} roughness={0.5} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={`cup${s}`} position={[s * 0.39, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.085, 0.085, 0.07, 24]} />
                <meshStandardMaterial color={C.cream} roughness={0.5} />
              </mesh>
            ))}
            <mesh position={[-0.3, -0.12, 0.24]} rotation={[0.3, 0.6, 0]}>
              <capsuleGeometry args={[0.01, 0.16, 4, 8]} />
              <meshStandardMaterial color={C.cream} roughness={0.5} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export default function Doll({ outfit, anim }) {
  const url = useModelUrl(outfit);
  const toy = <ToyDoll outfit={outfit} anim={anim} />;
  if (!url) return toy;
  return (
    <Suspense fallback={toy}>
      <GlbDoll url={url} />
    </Suspense>
  );
}
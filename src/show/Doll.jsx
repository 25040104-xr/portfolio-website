import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { C } from "./palette.js";

const HEIGHT = 1.95; // a model of your own is scaled to this height

// How I look: brown hair to the collarbone, light-brown square glasses, a V-neck top
const HAIR = "#563822";
const FRAME = "#9A6A3A";
const TOP_GREY = "#C9CED6";
const TOP_NAVY = "#1B2A4C";
const SKIN_V = "#D9AA8C"; // the skin in the V of the neckline: a little darker, because the light makes it look yellow

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

/* A fine woven pattern, used as a bump map: the cloth is not perfectly smooth under the light */
function makeFabric() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.fillRect(0, i, 128, 1);
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(i, 0, 1, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 4);
  return t;
}

/* A long sleeve: it starts inside the shoulder, ends in a cuff, and the hand overlaps the cuff,
   so that no part is only touching the next one. */
function Arm({ shirt, trim, fabric }) {
  return (
    <>
      <mesh position={[0, -0.2, 0]} castShadow>
        <capsuleGeometry args={[0.062, 0.26, 6, 14]} />
        <meshStandardMaterial color={shirt} roughness={0.85} bumpMap={fabric} bumpScale={0.4} />
      </mesh>
      <mesh position={[0, -0.385, 0]} castShadow>
        <cylinderGeometry args={[0.066, 0.066, 0.045, 18]} />
        <meshStandardMaterial color={trim} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.44, 0]} castShadow>
        <sphereGeometry args={[0.066, 16, 12]} />
        <meshStandardMaterial color={C.skin} roughness={0.7} />
      </mesh>
    </>
  );
}

/* A white sneaker: the shoe, a rounded toe and a thin sole */
function Shoe({ s }) {
  return (
    <group position={[s * 0.1, 0, 0.04]}>
      <mesh position={[0, 0.055, 0]} castShadow>
        <boxGeometry args={[0.14, 0.07, 0.22]} />
        <meshStandardMaterial color={C.cream} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.058, 0.1]} scale={[1, 0.8, 1]} castShadow>
        <sphereGeometry args={[0.07, 18, 12]} />
        <meshStandardMaterial color={C.cream} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.0125, 0.01]} castShadow>
        <boxGeometry args={[0.15, 0.025, 0.26]} />
        <meshStandardMaterial color="#BFC5D0" roughness={0.7} />
      </mesh>
    </group>
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

/* A flat strap between two points */
const UP = new THREE.Vector3(0, 1, 0);
function Strap({ a, b, color }) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  const mid = A.clone().add(B).multiplyScalar(0.5);
  return (
    <mesh position={mid} quaternion={quat}>
      <boxGeometry args={[0.016, len, 0.006]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

/* The pass, worn: a lanyard loop round the neck, two straps that follow the body down to a metal clip,
   and a card with rounded corners that hangs from the clip, a little away from the chest. */
function Lanyard() {
  return (
    <group>
      <mesh position={[0, 1.135, 0.005]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
        <torusGeometry args={[0.1, 0.009, 8, 36]} />
        <meshStandardMaterial color={C.yellow} roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Strap a={[s * 0.075, 1.11, 0.1]} b={[s * 0.05, 1.045, 0.2]} color={C.yellow} />
          <Strap a={[s * 0.05, 1.045, 0.2]} b={[0, 0.958, 0.212]} color={C.yellow} />
        </group>
      ))}
      <group position={[0, 0.958, 0.212]} rotation={[-0.1, 0, 0]}>
        <mesh position={[0, -0.012, 0.004]}>
          <boxGeometry args={[0.03, 0.03, 0.014]} />
          <meshStandardMaterial color="#B8BFCC" metalness={0.7} roughness={0.35} />
        </mesh>
        <RoundedBox args={[0.11, 0.15, 0.012]} radius={0.012} smoothness={4} position={[0, -0.095, 0.008]} castShadow>
          <meshStandardMaterial color={C.cobalt} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, -0.045, 0.0145]}>
          <boxGeometry args={[0.1, 0.028, 0.004]} />
          <meshStandardMaterial color={C.yellow} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* A toy-like figure built from simple shapes, dressed in clothes that look like clothes:
   a V-neck top with a trimmed neckline, long sleeves with cuffs, a hem, trousers and sneakers.
   Every part overlaps the next one, so the body does not fall apart. */
function ToyDoll({ outfit, anim }) {
  const root = useRef();
  const head = useRef();
  const eyes = useRef();
  const armWave = useRef();
  const work = outfit === "work";
  const contact = outfit === "contact";
  const shirt = work ? TOP_NAVY : TOP_GREY;
  const trim = work ? "#111A30" : "#A5ACB9"; // a darker shade of the top: the neckline, hem and cuffs
  const trousers = work ? "#262B36" : C.navy;
  const fabric = useMemo(makeFabric, []);

  // In Work both arms come forward and hold the laptop; in Contact the right arm holds the phone
  const armL = work ? -0.75 : 0;
  const armR = work ? -0.75 : contact ? -1.1 : 0;

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
      const goal = w > 0 && w < 2.4 ? 2.5 + Math.sin(w * 11) * 0.3 : 0.12;
      armWave.current.rotation.z = THREE.MathUtils.damp(armWave.current.rotation.z, goal, 10, dt);
    }
  });

  return (
    <group ref={root}>
      {/* sneakers, and trousers that go up into the hips */}
      {[-1, 1].map((s) => (
        <Shoe key={`shoe${s}`} s={s} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`leg${s}`} position={[s * 0.1, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.092, 0.072, 0.5, 20]} />
          <meshStandardMaterial color={trousers} roughness={0.85} bumpMap={fabric} bumpScale={0.4} />
        </mesh>
      ))}
      {/* the hips narrow down into the legs, so the trousers are one piece of clothing, not a skirt */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.205, 0.188, 0.3, 28]} />
        <meshStandardMaterial color={trousers} roughness={0.85} bumpMap={fabric} bumpScale={0.4} />
      </mesh>

      {/* the top, and its hem where it meets the trousers */}
      <mesh position={[0, 0.84, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.28, 8, 24]} />
        <meshStandardMaterial color={shirt} roughness={0.85} bumpMap={fabric} bumpScale={0.4} />
      </mesh>
      <mesh position={[0, 0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.206, 0.011, 8, 32]} />
        <meshStandardMaterial color={trim} roughness={0.85} />
      </mesh>

      {/* the neck joins the head to the body */}
      <mesh position={[0, 1.17, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.095, 0.2, 20]} />
        <meshStandardMaterial color={C.skin} roughness={0.7} />
      </mesh>

      {/* the V-neck, with a trim along both edges */}
      <mesh position={[0, 1.1, 0.192]}>
        <shapeGeometry args={[vShape]} />
        <meshStandardMaterial color={SKIN_V} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`vtrim${s}`} position={[s * 0.05, 1.02, 0.198]} rotation={[0, 0, -s * 0.5586]}>
          <boxGeometry args={[0.014, 0.1887, 0.012]} />
          <meshStandardMaterial color={trim} roughness={0.85} />
        </mesh>
      ))}

      {/* the shoulders are balls, so the sleeves grow out of the body */}
      {[-1, 1].map((s) => (
        <mesh key={`shoulder${s}`} position={[s * 0.2, 1.08, 0]} castShadow>
          <sphereGeometry args={[0.088, 18, 14]} />
          <meshStandardMaterial color={shirt} roughness={0.85} bumpMap={fabric} bumpScale={0.4} />
        </mesh>
      ))}

      <group position={[-0.22, 1.08, 0]} rotation={[armL, 0, -0.12]}>
        <Arm shirt={shirt} trim={trim} fabric={fabric} />
      </group>
      <group ref={armWave} position={[0.22, 1.08, 0]} rotation={[armR, 0, 0.12]}>
        <Arm shirt={shirt} trim={trim} fabric={fabric} />
      </group>

      {/* Hello: the pass, worn on a lanyard */}
      {outfit === "hello" && <Lanyard />}

      {/* Work: a laptop in both hands. The keyboard is level; the screen is hinged at the far edge,
          leans back and faces me, so the audience sees its back, with a small yellow dot. */}
      {work && (
        <group position={[0, 0.74, 0.32]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.025, 0.32]} />
            <meshStandardMaterial color="#DDE3EE" roughness={0.4} metalness={0.3} />
          </mesh>
          <group position={[0, 0.012, 0.16]} rotation={[0.3, 0, 0]}>
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.46, 0.3, 0.02]} />
              <meshStandardMaterial color="#C9D1E0" roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.15, 0.0115]}>
              <sphereGeometry args={[0.025, 16, 12]} />
              <meshStandardMaterial color={C.yellow} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.15, -0.0105]}>
              <boxGeometry args={[0.42, 0.26, 0.002]} />
              <meshBasicMaterial color="#2A3A66" toneMapped={false} />
            </mesh>
          </group>
        </group>
      )}

      {/* Contact: a phone in the right hand (the hand is at about x 0.27, y 0.88, z 0.39).
          The screen faces me; the audience sees the back, with a small camera. */}
      {contact && (
        <group position={[0.273, 0.93, 0.4]} rotation={[0.15, 0, 0.12]}>
          <RoundedBox args={[0.075, 0.15, 0.012]} radius={0.01} smoothness={4} castShadow>
            <meshStandardMaterial color={C.navy} roughness={0.4} />
          </RoundedBox>
          <mesh position={[0, 0.055, 0.0075]}>
            <cylinderGeometry args={[0.012, 0.012, 0.004, 16]} />
            <meshStandardMaterial color={C.yellow} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.0065]}>
            <boxGeometry args={[0.062, 0.128, 0.002]} />
            <meshBasicMaterial color={C.cream} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* the head: large, like a toy. It sits low enough to overlap the neck. */}
      <group ref={head} position={[0, 1.47, 0]}>
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
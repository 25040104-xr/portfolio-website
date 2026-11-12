import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { C } from "./palette.js";

const HEIGHT = 1.95; // a model of your own is scaled to this height

// How I look: brown hair to the collarbone, light-brown square glasses, a V-neck top
const HAIR = "#4B2E1B";
const FRAME = "#9A6A3A";
const SKIN = "#CFA17C";
const SKIN_SHADE = "#BA8665"; // the skin in the V of the neckline
const BLUSH = "#E58F85";
const TOP_GREY = "#C9CED6";
const TOP_NAVY = "#1B2A4C";

// A thin dark line round every part: it ties the parts together into one figure (switch it off with false)
const OUTLINES = true;
const LINE = "#1B2540";

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

/* The outline: a dark copy of the part that is pushed outwards a little and drawn from the inside,
   so only a thin dark edge shows round the part. Its normals are smoothed, so it has no gaps at the edges. */
function makeHull(t) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: t }, uColor: { value: new THREE.Color(LINE) } },
    vertexShader:
      "uniform float uT; void main(){ vec3 p = position + normalize(normal) * uT; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }",
    fragmentShader: "uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }",
    side: THREE.BackSide,
  });
}

function Outline({ t = 0.016 }) {
  const ref = useRef();
  const mat = useMemo(() => makeHull(t), [t]);
  useLayoutEffect(() => {
    const parent = ref.current && ref.current.parent;
    if (!parent || !parent.geometry) return undefined;
    const g = parent.geometry.clone();
    ["normal", "uv", "uv1"].forEach((n) => g.getAttribute(n) && g.deleteAttribute(n));
    const merged = mergeVertices(g, 1e-4);
    merged.computeVertexNormals();
    ref.current.geometry = merged;
    return () => merged.dispose();
  }, []);
  return <mesh ref={ref} material={mat} />;
}

/* One part of the body: a mesh with a thin dark outline */
function Part({ children, line = 0.013, ...props }) {
  return (
    <mesh castShadow {...props}>
      {children}
      {OUTLINES && <Outline t={line} />}
    </mesh>
  );
}

/* A long sleeve: it starts inside the shoulder, ends in a cuff, and the hand overlaps the cuff */
function Arm({ shirt, trim, fabric }) {
  return (
    <>
      <Part position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.062, 0.26, 6, 14]} />
        <meshStandardMaterial color={shirt} roughness={0.9} bumpMap={fabric} bumpScale={0.4} />
      </Part>
      <Part position={[0, -0.385, 0]} line={0.009}>
        <cylinderGeometry args={[0.067, 0.067, 0.045, 18]} />
        <meshStandardMaterial color={trim} roughness={0.9} />
      </Part>
      <Part position={[0, -0.44, 0]} line={0.009}>
        <sphereGeometry args={[0.064, 16, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </Part>
    </>
  );
}

/* A white sneaker: one rounded shoe on a thin sole, turned out a little */
function Shoe({ s }) {
  return (
    <group position={[s * 0.105, 0, 0.06]} rotation={[0, s * 0.12, 0]}>
      <RoundedBox args={[0.15, 0.1, 0.28]} radius={0.04} smoothness={4} position={[0, 0.066, 0]} castShadow>
        <meshStandardMaterial color={C.cream} roughness={0.7} />
        {OUTLINES && <Outline t={0.01} />}
      </RoundedBox>
      <RoundedBox args={[0.156, 0.03, 0.286]} radius={0.012} smoothness={3} position={[0, 0.015, 0]} castShadow>
        <meshStandardMaterial color="#B9C0CC" roughness={0.8} />
      </RoundedBox>
    </group>
  );
}

/* Square glasses with light-brown frames, sitting close to the face, with arms that reach the ears */
function Glasses() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.5 }), []);
  const W = 0.18;
  const H = 0.13;
  const T = 0.016;
  return (
    <group position={[0, 0.02, 0.322]}>
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
      <mesh position={[0, H / 2 - 0.025, 0]} material={mat}>
        <boxGeometry args={[0.07, T, T]} />
      </mesh>
      {/* the arms: from the outer corner of each lens back to the ear */}
      {[-1, 1].map((s) => (
        <mesh key={`arm${s}`} position={[s * 0.275, H / 2 - 0.02, -0.139]} rotation={[0, s * -0.416, 0]} material={mat}>
          <boxGeometry args={[T, T, 0.3]} />
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
      <mesh position={[0, 1.15, 0.005]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
        <torusGeometry args={[0.105, 0.009, 8, 36]} />
        <meshStandardMaterial color={C.yellow} roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Strap a={[s * 0.085, 1.13, 0.1]} b={[s * 0.055, 1.05, 0.2]} color={C.yellow} />
          <Strap a={[s * 0.055, 1.05, 0.2]} b={[0, 0.93, 0.214]} color={C.yellow} />
        </group>
      ))}
      <group position={[0, 0.93, 0.214]} rotation={[-0.1, 0, 0]}>
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

/* A toy-like figure built from simple shapes, dressed in clothes that look like clothes.
   The top is one straight piece that ends in a hem, and the trousers are two legs that come out
   from under it, so it does not look like a skirt. Every part overlaps the next one. */
function ToyDoll({ outfit, anim }) {
  const root = useRef();
  const head = useRef();
  const eyes = useRef();
  const armWave = useRef();
  const work = outfit === "work";
  const contact = outfit === "contact";
  const shirt = work ? TOP_NAVY : TOP_GREY;
  const trim = work ? "#111A30" : "#A5ACB9"; // a darker shade of the top: the neckline, hem and cuffs
  const trousers = work ? "#2B303B" : C.navy;
  const fabric = useMemo(makeFabric, []);

  // In Work both arms come forward and hold the laptop; in Contact the right arm holds the phone
  const armL = work ? -0.75 : 0;
  const armR = work ? -0.75 : contact ? -1.1 : 0;

  const vShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.075, 0);
    s.lineTo(0.075, 0);
    s.lineTo(0, -0.13);
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
      {/* sneakers, and trousers: two legs, wide at the top, that go up under the hem of the top */}
      {[-1, 1].map((s) => (
        <Shoe key={`shoe${s}`} s={s} />
      ))}
      {[-1, 1].map((s) => (
        <Part key={`leg${s}`} position={[s * 0.105, 0.35, 0]}>
          <cylinderGeometry args={[0.108, 0.074, 0.6, 24]} />
          <meshStandardMaterial color={trousers} roughness={0.9} bumpMap={fabric} bumpScale={0.4} />
        </Part>
      ))}

      {/* the top: a straight piece with a rounded shoulder line, and its hem */}
      <Part position={[0, 0.87, 0]}>
        <cylinderGeometry args={[0.19, 0.206, 0.5, 32]} />
        <meshStandardMaterial color={shirt} roughness={0.9} bumpMap={fabric} bumpScale={0.4} />
      </Part>
      <Part position={[0, 1.12, 0]} scale={[1, 0.55, 0.86]}>
        <sphereGeometry args={[0.2, 32, 18]} />
        <meshStandardMaterial color={shirt} roughness={0.9} bumpMap={fabric} bumpScale={0.4} />
      </Part>
      <mesh position={[0, 0.625, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.206, 0.012, 8, 36]} />
        <meshStandardMaterial color={trim} roughness={0.9} />
      </mesh>

      {/* the neck joins the head to the body */}
      <Part position={[0, 1.2, 0]} line={0.009}>
        <cylinderGeometry args={[0.075, 0.085, 0.2, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </Part>

      {/* the V-neck: a small V of skin, with a trim along both edges */}
      <mesh position={[0, 1.15, 0.2]}>
        <shapeGeometry args={[vShape]} />
        <meshStandardMaterial color={SKIN_SHADE} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`vtrim${s}`} position={[s * 0.0375, 1.085, 0.205]} rotation={[0, 0, -s * 0.5247]}>
          <boxGeometry args={[0.013, 0.15, 0.01]} />
          <meshStandardMaterial color={trim} roughness={0.9} />
        </mesh>
      ))}

      {/* the shoulders are small balls, so the sleeves grow out of the body */}
      {[-1, 1].map((s) => (
        <Part key={`shoulder${s}`} position={[s * 0.2, 1.09, 0]} line={0.009}>
          <sphereGeometry args={[0.07, 18, 14]} />
          <meshStandardMaterial color={shirt} roughness={0.9} bumpMap={fabric} bumpScale={0.4} />
        </Part>
      ))}

      <group position={[-0.215, 1.09, 0]} rotation={[armL, 0, -0.12]}>
        <Arm shirt={shirt} trim={trim} fabric={fabric} />
      </group>
      <group ref={armWave} position={[0.215, 1.09, 0]} rotation={[armR, 0, 0.12]}>
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

      {/* Contact: a phone held up in the right hand: the hand holds its lower end (the hand is at about
          x 0.27, y 0.89, z 0.39). The screen faces me; the audience sees the back, with a small camera. */}
      {contact && (
        <group position={[0.27, 1.0, 0.405]} rotation={[0.12, 0, 0.1]}>
          <RoundedBox args={[0.105, 0.21, 0.014]} radius={0.014} smoothness={4} castShadow>
            <meshStandardMaterial color={C.navy} roughness={0.4} />
            <Outline t={0.008} />
          </RoundedBox>
          <mesh position={[-0.026, 0.075, 0.0085]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.005, 18]} />
            <meshStandardMaterial color={C.yellow} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.0075]}>
            <boxGeometry args={[0.088, 0.18, 0.002]} />
            <meshBasicMaterial color={C.cream} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* the head: large, like a toy. It sits low enough to overlap the neck. */}
      <group ref={head} position={[0, 1.47, 0]}>
        <Part>
          <sphereGeometry args={[0.34, 48, 32]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </Part>

        {/* the hair: a cap tilted back so the hairline is above the eyes, the long hair behind,
            and a lock on each side that reaches up into the cap, so nothing floats */}
        <Part rotation={[-0.5, 0, 0]} line={0.013}>
          <sphereGeometry args={[0.355, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.53]} />
          <meshStandardMaterial color={HAIR} roughness={0.85} side={THREE.DoubleSide} />
        </Part>
        <Part position={[0, -0.14, -0.1]} scale={[1, 1.25, 0.72]} line={0.013}>
          <sphereGeometry args={[0.32, 32, 24]} />
          <meshStandardMaterial color={HAIR} roughness={0.85} />
        </Part>
        {[-1, 1].map((s) => (
          <Part key={`lock${s}`} position={[s * 0.285, -0.1, 0.0]} rotation={[0, 0, s * 0.05]} line={0.013}>
            <capsuleGeometry args={[0.075, 0.3, 6, 12]} />
            <meshStandardMaterial color={HAIR} roughness={0.85} />
          </Part>
        ))}

        <group ref={eyes} position={[0, 0.02, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={`eye${s}`} position={[s * 0.12, 0, 0.31]}>
              <sphereGeometry args={[0.034, 14, 12]} />
              <meshStandardMaterial color={C.navy} roughness={0.4} />
            </mesh>
          ))}
        </group>

        {/* a little blush, and a smile */}
        {[-1, 1].map((s) => (
          <mesh key={`blush${s}`} position={[s * 0.19, -0.075, 0.272]} rotation={[0, s * 0.58, 0]}>
            <circleGeometry args={[0.045, 20]} />
            <meshBasicMaterial color={BLUSH} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        ))}
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
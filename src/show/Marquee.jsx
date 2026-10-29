import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "./palette.js";

// The logo, drawn from its own outlines: the letters, and the star at the top right of the r.
const XR =
  "M384 -105Q396 -69 418 8Q390 4 383 4L241 -1Q226 -29 216 -84L207 -124Q193 -75 167 6H119L69 7Q26 7 -6 -3Q4 -39 35 -135Q44 -162 53.0 -190.0Q62 -218 71 -247Q49 -339 -14 -501Q46 -505 72 -505Q165 -505 173 -497Q192 -414 205 -373Q212 -395 221 -433Q232 -480 239 -502Q261 -505 364 -507Q413 -507 436 -508Q424 -471 399 -411Q377 -357 364.5 -320.5Q352 -284 345 -246Q357 -186 384 -105Z M608 -489Q650 -502 717 -502Q766 -502 766 -497L765 -445L766 -310L739 -319L681 -333Q657 -336 638 -336Q607 -336 591.0 -321.0Q575 -306 576 -269Q580 -146 580 -1Q554 6 537.0 7.5Q520 9 494 8Q484 7 462 7Q438 7 416 9Q416 -111 415 -169Q413 -299 413 -366Q413 -415 415 -505Q447 -501 465 -501Q491 -501 516 -504Q540 -507 563 -507Q580 -507 580 -504L581 -480V-479Q586 -480 593.5 -483.5Q601 -487 608 -489Z";
const STAR = "M52 7 L54.3 15.2 L62.5 17.5 L54.3 19.8 L52 28 L49.7 19.8 L41.5 17.5 L49.7 15.2 Z";

const easeInOut = (t) => t * t * (3 - 2 * t);

function drawMark(g, x, y, size) {
  const k = size / 64;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.save();
  g.translate(32, 32);
  g.rotate((-6 * Math.PI) / 180);
  g.translate(-32, -32);
  g.translate(11.72, 50.79);
  g.scale(0.05128, 0.05128);
  g.fillStyle = C.cream;
  g.fill(new Path2D(XR));
  g.restore();
  g.fillStyle = C.yellow;
  g.fill(new Path2D(STAR));
  g.restore();
}

function frameRect(g, w, h) {
  g.beginPath();
  if (g.roundRect) g.roundRect(0, 0, w, h, 36);
  else g.rect(0, 0, w, h);
  g.fillStyle = "#0A1428";
  g.fill();
  g.beginPath();
  if (g.roundRect) g.roundRect(14, 14, w - 28, h - 28, 26);
  else g.rect(14, 14, w - 28, h - 28);
  g.strokeStyle = C.yellow;
  g.lineWidth = 10;
  g.stroke();
}

function spaced(g, px) {
  try {
    g.letterSpacing = px;
  } catch {
    // an older browser: the letters are simply not spaced out
  }
}

function drawSign(g, w, h, portrait) {
  frameRect(g, w, h);
  g.textBaseline = "alphabetic";
  if (!portrait) {
    drawMark(g, 70, 76, 340);
    g.textAlign = "left";
    g.fillStyle = C.cream;
    g.font = '900 172px "Londrina Solid", Impact, sans-serif';
    spaced(g, "4px");
    g.fillText("KHOO XIN RUI", 470, 300);
    g.fillStyle = C.yellow;
    g.font = '700 58px "DM Sans", system-ui, sans-serif';
    spaced(g, "9px");
    g.fillText("DEVELOPER & DESIGNER", 476, 392);
  } else {
    drawMark(g, (w - 300) / 2, 56, 300);
    g.textAlign = "center";
    g.fillStyle = C.cream;
    g.font = '900 150px "Londrina Solid", Impact, sans-serif';
    spaced(g, "3px");
    g.fillText("KHOO XIN RUI", w / 2, 520);
    g.fillStyle = C.yellow;
    g.font = '700 50px "DM Sans", system-ui, sans-serif';
    spaced(g, "6px");
    g.fillText("DEVELOPER & DESIGNER", w / 2, 616);
  }
  spaced(g, "0px");
}

/* The sign is made once the fonts have loaded, so it is never drawn in the wrong letters */
function useSignTexture(portrait) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let live = true;
    const make = () => {
      const w = portrait ? 1024 : 2048;
      const h = portrait ? 768 : 512;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      drawSign(c.getContext("2d"), w, h, portrait);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      if (live) setTex(t);
    };
    const fonts =
      document.fonts && document.fonts.load
        ? Promise.all([document.fonts.load('900 100px "Londrina Solid"'), document.fonts.load('700 40px "DM Sans"')])
        : Promise.resolve();
    fonts.then(make, make);
    return () => {
      live = false;
    };
  }, [portrait]);
  return tex;
}

/* The dark board of the sign: a slab with rounded corners, like the gold frame drawn on it */
function roundedSlab(w, h, r, depth) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* The bulbs around the sign. A wave of light runs along them: it says "this is a show", and draws the eye. */
function Bulbs({ w, h, reduced }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const yellow = useMemo(() => new THREE.Color(C.yellow), []);

  const points = useMemo(() => {
    const inset = 0.15;
    const step = 0.27;
    const x0 = -w / 2 + inset;
    const x1 = w / 2 - inset;
    const y0 = -h / 2 + inset;
    const y1 = h / 2 - inset;
    const pts = [];
    const along = (ax, ay, bx, by) => {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
      for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
    };
    along(x0, y1, x1, y1);
    along(x1, y1, x1, y0);
    along(x1, y0, x0, y0);
    along(x0, y0, x0, y1);
    return pts;
  }, [w, h]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    points.forEach(([x, y], i) => {
      dummy.position.set(x, y, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, yellow);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [points, dummy, yellow]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m || !m.instanceColor) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < points.length; i++) {
      const v = reduced ? 1 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 5 - i * 0.55));
      color.copy(yellow).multiplyScalar(v);
      m.setColorAt(i, color);
    }
    m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh key={points.length} ref={mesh} args={[null, null, points.length]}>
      <sphereGeometry args={[0.05, 12, 8]} />
      <meshBasicMaterial toneMapped={false} fog={false} />
    </instancedMesh>
  );
}

/* The light of the bulbs on the curtain around the sign: it makes the sign give light, not just sit there */
function Halo({ w, h, anim }) {
  const mat = useRef();
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(255,226,150,0.55)");
    r.addColorStop(0.5, "rgba(255,226,150,0.18)");
    r.addColorStop(1, "rgba(255,226,150,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useFrame(() => {
    if (mat.current) mat.current.opacity = 1 - easeInOut(anim.current.curtain);
  });

  return (
    <mesh position={[0, 0, -0.2]}>
      <planeGeometry args={[w * 1.7, h * 3.0]} />
      <meshBasicMaterial
        ref={mat}
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/* The sign above the curtain: it hangs on two chains in front of it, and leaves when the curtain opens.
   It is part of the stage, so it has depth and the camera moves around it.
   Tapping it opens the curtain too. */
export default function Marquee({ anim, open, reduced, onOpen }) {
  const size = useThree((s) => s.size);
  const portrait = size.width / size.height < 0.9;
  const tex = useSignTexture(portrait);
  const group = useRef();

  const w = portrait ? 4.2 : 6.8;
  const h = portrait ? 3.15 : 1.7;
  const y = portrait ? 3.7 : 4.5;

  // the corner radius of the gold frame drawn on the texture (36 px), in world units
  const slab = useMemo(() => roundedSlab(w, h, w * (36 / (portrait ? 1024 : 2048)), 0.3), [w, h, portrait]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const e = easeInOut(anim.current.curtain);
    g.position.y = y + e * 3.8;
    g.visible = e < 0.98;
  });

  return (
    <group
      ref={group}
      position={[0, y, 1.95]}
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
      <Halo w={w} h={h} anim={anim} />

      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.45), h / 2 + 0.3, -0.05]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          <meshStandardMaterial color="#9AA6C0" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      <mesh castShadow geometry={slab}>
        <meshStandardMaterial color="#0A1428" roughness={0.6} />
      </mesh>

      {tex && (
        <mesh position={[0, 0, 0.152]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} transparent toneMapped={false} fog={false} />
        </mesh>
      )}

      <group position={[0, 0, 0.17]}>
        <Bulbs w={w} h={h} reduced={reduced} />
      </group>
    </group>
  );
}
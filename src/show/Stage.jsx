import { useMemo } from "react";
import * as THREE from "three";
import { C } from "./palette.js";

function makeTexture(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/* The room: a floor of boards, a backdrop that fades from night to sky,
   flats at the sides, and the valance above the curtain. */
export default function Stage() {
  const floorTex = useMemo(
    () =>
      makeTexture(
        512,
        512,
        (g, w, h) => {
          g.fillStyle = C.haze;
          g.fillRect(0, 0, w, h);
          for (let i = 0; i < 8; i++) {
            g.fillStyle = i % 2 ? "rgba(23,42,82,0.05)" : "rgba(255,255,255,0.10)";
            g.fillRect(i * 64, 0, 64, h);
            g.fillStyle = "rgba(23,42,82,0.22)";
            g.fillRect(i * 64, 0, 2, h);
          }
        },
        [3, 3]
      ),
    []
  );

  const wallTex = useMemo(
    () =>
      makeTexture(8, 512, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, C.navy);
        grad.addColorStop(0.55, C.sky);
        grad.addColorStop(1, "#C9D4DA");
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }),
    []
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} receiveShadow>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial map={floorTex} roughness={0.6} metalness={0} />
      </mesh>

      <mesh position={[0, 4, -6.6]}>
        <planeGeometry args={[16, 8]} />
        <meshBasicMaterial map={wallTex} toneMapped={false} fog={false} />
      </mesh>

      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 7.4, 4, -1.5]}>
          <boxGeometry args={[0.8, 8, 12]} />
          <meshStandardMaterial color={C.navy} roughness={0.9} />
        </mesh>
      ))}

      <mesh position={[0, 6.5, 1.55]}>
        <boxGeometry args={[14.4, 1.2, 0.5]} />
        <meshStandardMaterial color="#10203F" roughness={0.8} />
      </mesh>
      <mesh position={[0, 5.88, 1.8]}>
        <boxGeometry args={[14.4, 0.06, 0.1]} />
        <meshBasicMaterial color={C.yellow} toneMapped={false} />
      </mesh>
    </group>
  );
}
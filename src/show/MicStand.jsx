import { useMemo } from "react";
import * as THREE from "three";
import { C } from "./palette.js";

/* A microphone stand: a heavy foot, a pole, a boom that leans toward me, and the microphone */
export default function MicStand() {
  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#C9D1E0", metalness: 0.7, roughness: 0.3 }),
    []
  );

  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.04, 32]} />
        <meshStandardMaterial color="#2C3A5E" roughness={0.5} />
      </mesh>

      <mesh position={[0, 0.64, 0]} material={metal} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.24, 12]} />
      </mesh>

      {/* the boom leans toward the performer (to the left) */}
      <group position={[0, 1.26, 0]} rotation={[0, 0, 0.9]}>
        <mesh position={[0, 0.17, 0]} material={metal} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.34, 10]} />
        </mesh>
        <mesh position={[0, 0.4, 0]} castShadow>
          <capsuleGeometry args={[0.04, 0.12, 6, 14]} />
          <meshStandardMaterial color={C.yellow} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
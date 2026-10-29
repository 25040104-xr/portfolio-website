import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import Doll from "./Doll.jsx";
import MicStand from "./MicStand.jsx";
import { C } from "./palette.js";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* The riser with me and the microphone stand on it. They stand on one platform,
   so they rise together, at the same speed. */
export default function Performer({ anim, outfit }) {
  const lift = useRef();

  useFrame(() => {
    if (lift.current) lift.current.position.y = -1.3 * (1 - easeOut(anim.current.rise));
  });

  return (
    <group position={[-1.1, 0, -1.8]}>
      <group ref={lift} position={[0, -1.3, 0]}>
        <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 0.36, 2]} />
          <meshStandardMaterial color={C.cobalt} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.372, 0]} receiveShadow>
          <boxGeometry args={[2.96, 0.024, 1.96]} />
          <meshStandardMaterial color={C.cream} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.34, 1.002]}>
          <boxGeometry args={[3.02, 0.04, 0.01]} />
          <meshBasicMaterial color={C.yellow} toneMapped={false} />
        </mesh>

        <group position={[-0.25, 0.384, 0]} rotation={[0, 0.28, 0]}>
          <Doll outfit={outfit} anim={anim} />
        </group>
        <group position={[0.55, 0.384, 0.15]} rotation={[0, -0.3, 0]}>
          <MicStand />
        </group>
      </group>
    </group>
  );
}
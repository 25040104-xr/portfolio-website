import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import projects from "../data/projects.json";
import { C } from "./palette.js";

// The projects hang on the back wall, in two zones: CODE on the left, DESIGN on the right.
const WALL_Z = -6.45;
const ZONES = { code: [-6.0, -2.0], design: [0.0, 4.8] }; // left and right edge of each zone
const TITLES = { code: "CODE", design: "DESIGN" };

const smooth = THREE.MathUtils.smoothstep;

// The posters belong to the Work act: they fade in as the camera arrives and out as it leaves
function visibility(p) {
  return smooth(p, 0.35, 0.9) * (1 - smooth(p, 1.15, 1.7));
}

/* How one side of the wall is laid out, by how many posters it shows:
   1-2 large in a row, 3-4 medium (2 by 2), 5-6 small (3 by 2). */
function layout(count, zone) {
  const [z0, z1] = zone;
  const zw = z1 - z0;
  const zc = (z0 + z1) / 2;
  let cols;
  let w;
  let gapX;
  let gapY;
  if (count <= 2) {
    cols = Math.max(1, count);
    w = 1.8;
    gapX = 0.3;
    gapY = 0.9;
  } else if (count <= 4) {
    cols = 2;
    w = 1.5;
    gapX = 0.3;
    gapY = 0.72;
  } else {
    cols = 3;
    w = 1.2;
    gapX = 0.22;
    gapY = 0.62;
  }
  const k = Math.min(1, (zw * 0.96) / (cols * w + (cols - 1) * gapX));
  w *= k;
  gapX *= k;
  gapY *= k;
  const h = w * 0.64;
  const rows = Math.ceil(count / cols);
  const pitch = h + gapY;
  const baseY = rows > 1 ? 2.95 : 3.0;
  const items = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, count - row * cols);
    items.push({
      x: zc + (col - (inRow - 1) / 2) * (w + gapX),
      y: baseY + ((rows - 1) / 2 - row) * pitch,
    });
  }
  return { w, h, items, signY: rows > 1 ? 4.85 : 4.4 };
}

/* A texture drawn with the logo's font. It is made once the font has loaded. */
function useDrawnTexture(width, height, draw, key) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let live = true;
    const make = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      draw(c.getContext("2d"), width, height);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (live) setTex(t);
    };
    const ready =
      document.fonts && document.fonts.load ? document.fonts.load('900 64px "Londrina Solid"') : Promise.resolve();
    ready.then(make, make);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width, height]);
  return tex;
}

/* CODE / DESIGN above each zone */
function Sign({ text, x, y, progressRef, dim }) {
  const tex = useDrawnTexture(
    512,
    160,
    (g) => {
      g.font = '900 120px "Londrina Solid", Impact, sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = C.cream;
      g.fillText(text, 256, 70);
      g.fillStyle = C.yellow;
      g.fillRect(156, 136, 200, 8);
    },
    text
  );
  const mat = useRef();

  useFrame((_, dt) => {
    if (!mat.current) return;
    const goal = visibility(progressRef.current) * (dim ? 0.3 : 1);
    mat.current.opacity = THREE.MathUtils.damp(mat.current.opacity, goal, 8, dt);
  });

  if (!tex) return null;
  return (
    <mesh position={[x, y, WALL_Z + 0.05]}>
      <planeGeometry args={[2.4, 0.75]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}

/* A poster on the wall, with a small plaque under it that says what it is.
   The group carries the project's slug, so the page can find it when the pointer is over it. */
function Poster({ project, x, y, w, h, progressRef, dim, lift }) {
  const group = useRef();
  const frame = useRef();
  const img = useRef();
  const plaqueMat = useRef();
  const [tex, setTex] = useState(null);

  const plaque = useDrawnTexture(
    640,
    120,
    (g, cw, ch) => {
      g.fillStyle = C.navy;
      if (g.roundRect) {
        g.beginPath();
        g.roundRect(0, 0, cw, ch, 26);
        g.fill();
      } else {
        g.fillRect(0, 0, cw, ch);
      }
      g.fillStyle = C.yellow;
      g.fillRect(24, ch - 16, 90, 6);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = C.cream;
      let size = 66;
      do {
        g.font = `900 ${size}px "Londrina Solid", Impact, sans-serif`;
        size -= 2;
      } while (g.measureText(project.title).width > cw - 60 && size > 24);
      g.fillText(project.title, cw / 2, ch / 2 - 6);
    },
    project.title
  );

  useEffect(() => {
    if (!project.thumb) return undefined;
    let live = true;
    new THREE.TextureLoader().load(
      project.thumb,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        if (live) setTex(t);
      },
      undefined,
      () => {}
    );
    return () => {
      live = false;
    };
  }, [project.thumb]);

  useFrame((_, dt) => {
    const v = visibility(progressRef.current);
    const goal = v * (dim ? 0.28 : 1);
    [frame.current, img.current, plaqueMat.current].forEach((m) => {
      if (m) m.opacity = THREE.MathUtils.damp(m.opacity, goal, 8, dt);
    });
    const g = group.current;
    if (!g) return;
    g.visible = v > 0.01;
    // the poster under the pointer comes forward a little
    g.position.z = THREE.MathUtils.damp(g.position.z, WALL_Z + 0.06 + lift * 0.45, 6, dt);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, 1 + lift * 0.12, 6, dt));
  });

  const pw = Math.min(1.7, w * 0.98);
  const ph = pw / (640 / 120);

  return (
    <group ref={group} position={[x, y, WALL_Z + 0.06]} visible={false} userData={{ slug: project.slug }}>
      <mesh>
        <boxGeometry args={[w + 0.14, h + 0.14, 0.06]} />
        <meshStandardMaterial ref={frame} color={C.cream} roughness={0.7} transparent opacity={0} />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          key={tex ? "image" : "plain"}
          ref={img}
          map={tex}
          color={tex ? "#ffffff" : C.cobalt}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {plaque && (
        <mesh position={[0, -(h / 2) - ph / 2 - 0.1, 0.03]}>
          <planeGeometry args={[pw, ph]} />
          <meshBasicMaterial ref={plaqueMat} map={plaque} transparent opacity={0} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/* Lets the page ask: "which poster is under this point of the screen?"
   It looks along a line from the camera. Anything that is not a poster (the beam of light, the curtain) is ignored. */
function Picker({ pickRef }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    if (!pickRef) return undefined;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const shown = (o) => {
      for (let n = o; n; n = n.parent) if (!n.visible) return false;
      return true;
    };
    pickRef.current = (clientX, clientY) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(scene.children, true);
      for (const hit of hits) {
        if (!shown(hit.object)) continue;
        for (let n = hit.object; n; n = n.parent) {
          if (n.userData && n.userData.slug) return n.userData.slug;
        }
      }
      return null;
    };
    return () => {
      pickRef.current = null;
    };
  }, [pickRef, camera, scene, gl]);

  return null;
}

export default function Posters({ progressRef, work }) {
  const perPage = work.perPage || 6;
  const page = work.page || 0;

  const groups = useMemo(() => {
    const out = {};
    projects.forEach((p) => {
      (out[p.category] = out[p.category] || []).push(p);
    });
    return out;
  }, []);

  return (
    <group>
      <Picker pickRef={work.pickRef} />
      {Object.entries(groups).map(([cat, all]) => {
        const zone = ZONES[cat] || [-3, 3];
        const list = all.slice(page * perPage, page * perPage + perPage);
        if (list.length === 0) return null;
        const lay = layout(list.length, zone);
        const dimZone = !!work.category && work.category !== cat;
        return (
          <group key={cat}>
            <Sign
              text={TITLES[cat] || cat.toUpperCase()}
              x={(zone[0] + zone[1]) / 2}
              y={lay.signY}
              progressRef={progressRef}
              dim={dimZone}
            />
            {list.map((p, i) => (
              <Poster
                key={p.slug}
                project={p}
                x={lay.items[i].x}
                y={lay.items[i].y}
                w={lay.w}
                h={lay.h}
                progressRef={progressRef}
                dim={dimZone}
                lift={work.hover === p.slug || work.open === p.slug ? 1 : 0}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
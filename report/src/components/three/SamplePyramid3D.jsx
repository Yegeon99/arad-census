import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BIN_COLOR } from "../../lib/palette.js";
import { GOLD } from "../../lib/palette.js";
import { radii } from "../charts/Pyramid2D.jsx";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { BinLegend } from "../charts/Legend.jsx";

const LAYER_H = 0.52;
const BASE_R = 1.95;

function Pyramid({ bins, x, onHover, hovered, paused }) {
  const r = radii(bins.map((b) => b.pct));
  const spin = useRef(null);
  useFrame((_, delta) => {
    if (spin.current && !paused) spin.current.rotation.y += delta * 0.2;
  });
  return (
    <group ref={spin} position={[x, -1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
      {bins.map((b, i) => {
        const on = hovered === b.range;
        return (
          <mesh
            key={b.range}
            position={[0, i * LAYER_H + LAYER_H / 2, 0]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(b.range); }}
            onPointerOut={() => onHover(null)}
          >
            <cylinderGeometry args={[r[i + 1] * BASE_R, r[i] * BASE_R, LAYER_H, 4]} />
            <meshStandardMaterial
              color={on ? GOLD : BIN_COLOR[b.range]}
              roughness={0.62}
              metalness={0.05}
              transparent
              opacity={hovered && !on ? 0.55 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** 표본 피라미드 입체 화면. 전체 표본과 완전 검색 표본을 나란히 세워 밑동 차이를 본다. */
export default function SamplePyramid3D({ full, complete, fullNote, completeNote }) {
  const [hovered, setHovered] = useState(null);
  const info = hovered
    ? { full: full.find((b) => b.range === hovered), complete: complete.find((b) => b.range === hovered) }
    : null;

  return (
    <div>
      <div style={{ height: 420, background: "var(--bg-sunken)" }}>
        <Canvas camera={{ position: [0, 1.9, 7.4], fov: 42 }} dpr={[1, 1.8]} gl={{ antialias: true }}>
          <color attach="background" args={["#F3F2EE"]} />
          <ambientLight intensity={0.72} />
          <directionalLight position={[4, 7, 5]} intensity={1.15} />
          <directionalLight position={[-5, 3, -4]} intensity={0.35} />
          <Pyramid bins={full} x={-2.5} onHover={setHovered} hovered={hovered} paused={Boolean(hovered)} />
          <Pyramid bins={complete} x={2.5} onHover={setHovered} hovered={hovered} paused={Boolean(hovered)} />
        </Canvas>
      </div>
      <BinLegend note="아래층이 레기온 입장 전, 위로 갈수록 높은 구간입니다." />
      <div className="mt-2 flex flex-wrap justify-between gap-2">
        <p className="t-small m-0"><b style={{ color: "var(--text-primary)" }}>왼쪽 전체 표본</b> {fullNote}</p>
        <p className="t-small m-0"><b style={{ color: "var(--text-primary)" }}>오른쪽 완전 검색 표본</b> {completeNote}</p>
      </div>
      <p className="t-body m-0 mt-1 min-h-[3rem] text-[0.92rem]">
        {info ? (
          <>
            <b style={{ color: "var(--text-primary)" }}>{hovered}</b>
            <span className="num"> 전체 표본 {fmtPct(info.full.pct)} {fmtPeople(info.full.count)}</span>
            <span style={{ opacity: 0.5 }}> · </span>
            <span className="num">완전 검색 표본 {fmtPct(info.complete.pct)} {fmtPeople(info.complete.count)}</span>
          </>
        ) : (
          <span className="t-small">층에 마우스를 올리면 회전이 멈추고 구간 이름과 비중이 나옵니다.</span>
        )}
      </p>
    </div>
  );
}

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BIN_COLOR, GOLD } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { bands } from "../../lib/pyramid.js";
import { BinLegend } from "../charts/Legend.jsx";

const BASE_R = 1.78;
const TOTAL_H = 3.1;
const GAP = 2.0; // 두 피라미드 사이 간격

function Stack({ rows, x, onHover, hovered, paused }) {
  const spin = useRef(null);
  useFrame((_, delta) => {
    if (spin.current && !paused) spin.current.rotation.y += delta * 0.11;
  });
  return (
    <group ref={spin} position={[x, -TOTAL_H / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
      {rows.map((b) => {
        const h = (b.to - b.from) * TOTAL_H;
        const on = hovered === b.bin;
        return (
          <mesh
            key={b.bin}
            position={[0, b.from * TOTAL_H + h / 2, 0]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(b.bin); }}
            onPointerOut={() => onHover(null)}
          >
            <cylinderGeometry args={[b.halfTo * BASE_R, b.halfFrom * BASE_R, h, 4]} />
            <meshStandardMaterial
              color={on ? GOLD : BIN_COLOR[b.bin]}
              roughness={0.6}
              metalness={0.04}
              transparent
              opacity={hovered && !on ? 0.5 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function BaseLabel({ x, row }) {
  const y = -TOTAL_H / 2 + row.mid * TOTAL_H;
  const halo = "0 0 4px #FAFAF8, 0 0 10px #FAFAF8";
  return (
    <Html center position={[x, y, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
        <div className="num" style={{ fontSize: 23, fontWeight: 700, color: "var(--ink-6)", textShadow: halo }}>
          {fmtPct(row.pct)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textShadow: halo }}>{row.bin}</div>
      </div>
    </Html>
  );
}

/** 표본 피라미드 입체 화면. 층 높이가 그 구간의 비중이다. */
export default function SamplePyramid3D({ full, complete, fullNote, completeNote }) {
  const [hovered, setHovered] = useState(null);
  const rowsFull = bands(full);
  const rowsComplete = bands(complete);
  const info = hovered
    ? { full: full.find((b) => b.range === hovered), complete: complete.find((b) => b.range === hovered) }
    : null;

  return (
    <div>
      <div style={{ height: 420, maxWidth: 880, margin: "0 auto", background: "var(--bg-base)" }}>
        <Canvas camera={{ position: [0, 0.9, 6.1], fov: 38 }} dpr={[1, 1.8]} gl={{ antialias: true }}>
          <color attach="background" args={["#FAFAF8"]} />
          <ambientLight intensity={0.76} />
          <directionalLight position={[4, 7, 5]} intensity={1.1} />
          <directionalLight position={[-5, 3, -4]} intensity={0.32} />
          <Stack rows={rowsFull} x={-GAP} onHover={setHovered} hovered={hovered} paused={Boolean(hovered)} />
          <Stack rows={rowsComplete} x={GAP} onHover={setHovered} hovered={hovered} paused={Boolean(hovered)} />
          <BaseLabel x={-GAP} row={rowsFull[0]} />
          <BaseLabel x={GAP} row={rowsComplete[0]} />
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
          <span className="t-small">맨 아래층 비중만 늘 보입니다. 다른 층은 마우스를 올리면 회전이 멈추고 수치가 나옵니다.</span>
        )}
      </p>
    </div>
  );
}

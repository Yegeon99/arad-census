import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BIN_ORDER, BIN_COLOR, GOLD } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { BinLegend } from "../charts/Legend.jsx";

const CELL = 0.46;
const DEPTH = 0.62;
const MAX_H = 3.0;

/** 직업 20종과 명성 6구간을 높이로 세운 지형. 막대 높이는 직업 안에서의 구간 비중이다. */
export default function JobTerrain3D({ rows, cellCount, cellShare, selected, setSelected, onHover, hovered }) {
  const bars = useMemo(() => {
    const out = [];
    rows.forEach((job, ri) => {
      BIN_ORDER.forEach((bin, ci) => {
        const count = cellCount(job, bin);
        const share = cellShare(job, bin);
        out.push({ job, bin, ri, ci, count, share, height: Math.max(0.02, share * MAX_H) });
      });
    });
    return out;
  }, [rows, cellCount, cellShare]);

  const originX = -((rows.length - 1) * CELL) / 2;
  const originZ = -((BIN_ORDER.length - 1) * DEPTH) / 2;

  return (
    <div>
      <div style={{ height: 440, background: "var(--bg-sunken)" }}>
        <Canvas camera={{ position: [0, 6.4, 9.2], fov: 42 }} dpr={[1, 1.8]} gl={{ antialias: true }}>
          <color attach="background" args={["#F3F2EE"]} />
          <ambientLight intensity={0.74} />
          <directionalLight position={[6, 9, 6]} intensity={1.1} />
          <directionalLight position={[-6, 4, -6]} intensity={0.3} />
          <OrbitControls
            enablePan={false}
            minDistance={6}
            maxDistance={16}
            maxPolarAngle={Math.PI / 2.15}
            autoRotate={!hovered && !selected}
            autoRotateSpeed={0.5}
          />
          <group position={[0, -0.6, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
              <planeGeometry args={[rows.length * CELL + 1.2, BIN_ORDER.length * DEPTH + 1.2]} />
              <meshStandardMaterial color="#E7E5DE" roughness={1} />
            </mesh>
            {bars.map((b) => {
              const dim = (selected && selected !== b.job) || (hovered && hovered.job !== b.job);
              const isHot = hovered && hovered.job === b.job && hovered.bin === b.bin;
              return (
                <mesh
                  key={`${b.job}/${b.bin}`}
                  position={[originX + b.ri * CELL, b.height / 2, originZ + b.ci * DEPTH]}
                  onPointerOver={(e) => { e.stopPropagation(); onHover(b); }}
                  onPointerOut={() => onHover(null)}
                  onClick={(e) => { e.stopPropagation(); setSelected(selected === b.job ? null : b.job); }}
                >
                  <boxGeometry args={[CELL * 0.78, b.height, DEPTH * 0.72]} />
                  <meshStandardMaterial
                    color={isHot ? GOLD : BIN_COLOR[b.bin]}
                    roughness={0.6}
                    metalness={0.04}
                    transparent
                    opacity={dim ? 0.28 : 1}
                  />
                </mesh>
              );
            })}
          </group>
        </Canvas>
      </div>
      <BinLegend note="앞줄이 레기온 입장 전, 뒤로 갈수록 높은 구간입니다." />
      <p className="t-body m-0 mt-2 min-h-[3rem] text-[0.92rem]">
        {hovered ? (
          <>
            <b style={{ color: "var(--text-primary)" }}>{hovered.job} · {hovered.bin}</b>
            <span className="num">
              {" "}직업 안에서 {fmtPct(hovered.share * 100)}
              {hovered.count === null ? ", 표본 10명 미만이라 공개하지 않습니다" : `, ${fmtPeople(hovered.count)}`}
            </span>
          </>
        ) : (
          <span className="t-small">
            끌어서 돌리고 휠로 당겨 볼 수 있습니다. 막대에 올리면 직업과 구간, 비중과 인원이 나옵니다.
          </span>
        )}
      </p>
    </div>
  );
}

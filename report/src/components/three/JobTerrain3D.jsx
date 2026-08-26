import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { BIN_ORDER, BIN_COLOR, GOLD } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";

const CELL = 0.48;      // 직업 사이 간격
const DEPTH = 0.62;     // 구간 사이 간격
const BAR_W = 0.34;
const BAR_D = 0.46;
const MAX_H = 2.3;
const LABEL_SHARE = 0.45; // 이 비중을 넘는 막대에만 숫자를 붙인다

/** 크기가 바뀌거나 탭이 돌아오면 다시 한 장 그린다. 필요할 때만 그리는 설정에서 화면이 비지 않게. */
function KeepDrawn() {
  const invalidate = useThree((state) => state.invalidate);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  useEffect(() => {
    invalidate();
    const raf = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(raf);
  }, [invalidate, width, height]);
  useEffect(() => {
    const again = () => invalidate();
    window.addEventListener("resize", again);
    document.addEventListener("visibilitychange", again);
    // 화면을 캡처하거나 브라우저가 그림을 버렸을 때를 대비해 1초에 한 장씩만 다시 그린다.
    const beat = setInterval(() => {
      if (document.visibilityState === "visible") invalidate();
    }, 1000);
    return () => {
      clearInterval(beat);
      window.removeEventListener("resize", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [invalidate]);
  return null;
}

const labelStyle = {
  pointerEvents: "none",
  whiteSpace: "nowrap",
  fontSize: 16.5,
  color: "var(--text-primary)",
};

/** 직업 20종과 명성 6구간을 높이로 세운 지형. 막대 높이는 직업 안에서의 구간 비중이다. */
export default function JobTerrain3D({ rows, cellCount, cellShare, selected, setSelected, onHover, hovered }) {
  const originX = -((rows.length - 1) * CELL) / 2;
  const frontZ = ((BIN_ORDER.length - 1) * DEPTH) / 2;

  const bars = useMemo(() => {
    const out = [];
    rows.forEach((job, ri) => {
      BIN_ORDER.forEach((bin, ci) => {
        const share = cellShare(job, bin);
        out.push({
          job,
          bin,
          ri,
          ci,
          count: cellCount(job, bin),
          share,
          height: Math.max(0.02, share * MAX_H),
          x: originX + ri * CELL,
          z: frontZ - ci * DEPTH,
        });
      });
    });
    return out;
  }, [rows, cellCount, cellShare, originX, frontZ]);

  return (
    <div>
      <div style={{ height: 476, maxWidth: 1160, margin: "0 auto", background: "var(--bg-base)" }}>
        <Canvas frameloop="demand" camera={{ position: [0, 5.3, 6.2], fov: 42 }} dpr={[1, 1.8]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={["#FAFAF8"]} />
          <KeepDrawn />
          <ambientLight intensity={0.78} />
          <directionalLight position={[5, 9, 7]} intensity={1.05} />
          <directionalLight position={[-6, 4, -5]} intensity={0.28} />
          <OrbitControls
            target={[1.15, -1.25, 0]}
            enablePan={false}
            minDistance={7}
            maxDistance={13}
            minPolarAngle={0.52}
            maxPolarAngle={1.12}
            minAzimuthAngle={-0.42}
            maxAzimuthAngle={0.42}
            enableDamping={false}
          />
          <group position={[1.15, -0.6, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
              <planeGeometry args={[rows.length * CELL + 0.6, BIN_ORDER.length * DEPTH + 0.6]} />
              <meshStandardMaterial color="#F1EFE9" roughness={1} />
            </mesh>

            {bars.map((b) => {
              const dim = (selected && selected !== b.job) || (hovered && hovered.job !== b.job);
              const hot = hovered && hovered.job === b.job && hovered.bin === b.bin;
              return (
                <mesh
                  key={`${b.job}/${b.bin}`}
                  position={[b.x, b.height / 2, b.z]}
                  onPointerOver={(e) => { e.stopPropagation(); onHover(b); }}
                  onPointerOut={() => onHover(null)}
                  onClick={(e) => { e.stopPropagation(); setSelected(selected === b.job ? null : b.job); }}
                >
                  <boxGeometry args={[BAR_W, b.height, BAR_D]} />
                  <meshStandardMaterial
                    color={hot ? GOLD : BIN_COLOR[b.bin]}
                    roughness={0.58}
                    metalness={0.04}
                    transparent
                    opacity={dim ? 0.22 : 1}
                  />
                </mesh>
              );
            })}

            {/* 비중이 큰 막대에만 숫자를 얹는다 */}
            {bars.filter((b) => b.share >= LABEL_SHARE).map((b) => (
              <Html key={`v/${b.job}/${b.bin}`} center position={[b.x, b.height + 0.34, b.z]} zIndexRange={[6, 0]}>
                <span className="num" style={{ ...labelStyle, fontSize: 12, fontWeight: 700 }}>
                  {fmtPct(b.share * 100)}
                </span>
              </Html>
            ))}

            {/* 앞줄 가장자리의 직업 이름 */}
            {rows.map((job, ri) => (
              <Html
                key={`j/${job}`}
                position={[originX + ri * CELL, 0.02, frontZ + (ri % 2 ? 0.94 : 0.46)]}
                zIndexRange={[5, 0]}
                style={{ transform: "translate(-100%, -50%) rotate(-30deg)", transformOrigin: "100% 50%" }}
              >
                <span
                  onClick={() => setSelected(selected === job ? null : job)}
                  style={{
                    ...labelStyle,
                    pointerEvents: "auto",
                    cursor: "pointer",
                    fontWeight: selected === job ? 700 : 500,
                    color: selected === job ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {job}
                </span>
              </Html>
            ))}

            {/* 옆면의 구간 이름 */}
            {BIN_ORDER.map((bin, ci) => (
              <Html
                key={`b/${bin}`}
                position={[originX - CELL * 1.4, 0.06, frontZ - ci * DEPTH]}
                zIndexRange={[5, 0]}
                style={{ transform: "translate(-100%, -50%)" }}
              >
                <span style={{ ...labelStyle, fontWeight: 600, color: "var(--text-primary)" }}>{bin}</span>
              </Html>
            ))}
          </group>
        </Canvas>
      </div>
      <p className="t-body m-0 mt-8 min-h-[3rem] text-[0.92rem]">
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
            끌어서 좌우로 조금 돌리고 휠로 당겨 볼 수 있습니다. 직업 이름을 누르면 그 줄만 남고, 막대에 올리면 인원이 나옵니다.
          </span>
        )}
      </p>
    </div>
  );
}

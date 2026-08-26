import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BIN_COLOR, GOLD } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { bands } from "../../lib/pyramid.js";

const BASE_R = 1.3;
const TOTAL_H = 2.78;
const GAP = 1.42;      // 두 피라미드 사이 간격
const LABEL_DX = 0.3; // 층 이름을 피라미드 바깥으로 뺀 거리
const INTRO_MS = 6000; // 이만큼만 돌리고 멈춘다 (계속 돌면 화면이 쉬지 않는다)

/** 도는 동안에만 프레임을 요청한다. 멈추면 그리기도 멈춘다. */
function IntroFrames({ active }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const tick = () => {
      invalidate();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, invalidate]);
  return null;
}

/** 붙자마자 첫 장면을 바로 그린다. 빈 화면이 남지 않게. */
function FirstFrame({ onReady }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    const raf = requestAnimationFrame(() => {
      invalidate();
      onReady();
    });
    return () => cancelAnimationFrame(raf);
  }, [invalidate, onReady]);
  return null;
}

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

function Stack({ rows, x, onHover, hovered, spinning }) {
  const spin = useRef(null);
  useFrame((_, delta) => {
    if (spin.current && spinning) spin.current.rotation.y += Math.min(delta, 0.05) * 0.11;
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
              roughness={0.5}
              metalness={0.02}
              transparent
              opacity={hovered && !on ? 0.5 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** 층 이름과 비율을 피라미드 옆에 세로로 늘어놓고 얇은 층까지 늘 보이게 한다. */
function SideLabels({ rows, x, side, hovered, onHover }) {
  const top = [...rows].reverse();
  const slot = TOTAL_H / rows.length;
  return top.map((b, i) => {
    const y = TOTAL_H / 2 - slot * (i + 0.5);
    const anchor = x + side * (BASE_R + LABEL_DX);
    const on = hovered === b.bin;
    return (
      <Html key={b.bin} position={[anchor, y, 0]} zIndexRange={[8, 0]}
        style={{ transform: `translate(${side > 0 ? "0" : "-100%"}, -50%)` }}>
        <span
          onPointerEnter={() => onHover(b.bin)}
          onPointerLeave={() => onHover(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            fontSize: 11.5,
            fontWeight: on ? 700 : 500,
            color: on ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "default",
          }}
        >
          {side < 0 && <span className="num">{fmtPct(b.pct)}</span>}
          <span style={{ display: "inline-block", width: 9, height: 9, background: BIN_COLOR[b.bin] }} />
          <span>{b.bin}</span>
          {side > 0 && <span className="num">{fmtPct(b.pct)}</span>}
        </span>
      </Html>
    );
  });
}

function Title({ x, text, note }) {
  return (
    <Html center position={[x, TOTAL_H / 2 + 0.3, 0]} zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{text}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{note}</div>
      </div>
    </Html>
  );
}

function BaseCallout({ x, row }) {
  const y = -TOTAL_H / 2 + row.mid * TOTAL_H;
  const halo = "0 0 4px #FAFAF8, 0 0 10px #FAFAF8";
  return (
    <Html center position={[x, y, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
        <div className="num" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink-6)", textShadow: halo }}>
          {fmtPct(row.pct)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textShadow: halo }}>
          레이드 이전 단계
        </div>
      </div>
    </Html>
  );
}

/** 표본 피라미드 입체 화면. 층 높이가 그 단계의 비중이다. */
export default function SamplePyramid3D({ full, complete, fullNote, completeNote }) {
  const [hovered, setHovered] = useState(null);
  const [intro, setIntro] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(id);
  }, []);
  const spinning = intro && !hovered;
  const rowsFull = bands(full);
  const rowsComplete = bands(complete);
  const info = hovered
    ? { full: full.find((b) => b.range === hovered), complete: complete.find((b) => b.range === hovered) }
    : null;

  return (
    <div>
      <div className="relative" style={{ height: 450, maxWidth: 1080, margin: "0 auto", background: "var(--bg-base)" }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="t-small m-0">피라미드를 그리는 중입니다.</p>
          </div>
        )}
        <Canvas frameloop="demand" camera={{ position: [0, 0.2, 5.75], fov: 38 }} dpr={[1, 1.8]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={["#FAFAF8"]} />
          <ambientLight intensity={0.95} />
          <directionalLight position={[4, 7, 5]} intensity={0.85} />
          <directionalLight position={[-5, 3, -4]} intensity={0.3} />
          <FirstFrame onReady={() => setReady(true)} />
          <KeepDrawn />
          <IntroFrames active={spinning} />
          <Stack rows={rowsFull} x={-GAP} onHover={setHovered} hovered={hovered} spinning={spinning} />
          <Stack rows={rowsComplete} x={GAP} onHover={setHovered} hovered={hovered} spinning={spinning} />
          <Title x={-GAP} text="전체 표본" note={fullNote} />
          <Title x={GAP} text="빠짐없이 모은 표본만" note={completeNote} />
          <SideLabels rows={rowsFull} x={-GAP} side={-1} hovered={hovered} onHover={setHovered} />
          <SideLabels rows={rowsComplete} x={GAP} side={1} hovered={hovered} onHover={setHovered} />
          <BaseCallout x={-GAP} row={rowsFull[0]} />
          <BaseCallout x={GAP} row={rowsComplete[0]} />
        </Canvas>
      </div>
      <p className="t-body m-0 mt-2 min-h-[2.6rem] text-[0.92rem]">
        {info ? (
          <>
            <b style={{ color: "var(--text-primary)" }}>{hovered}</b>
            <span className="num"> 전체 표본 {fmtPct(info.full.pct)} {fmtPeople(info.full.count)}</span>
            <span style={{ opacity: 0.5 }}> · </span>
            <span className="num">빠짐없이 모은 표본 {fmtPct(info.complete.pct)} {fmtPeople(info.complete.count)}</span>
          </>
        ) : (
          <span className="t-small">처음 몇 초만 천천히 돌고 멈춥니다. 층에 마우스를 올리면 인원이 나옵니다.</span>
        )}
      </p>
    </div>
  );
}

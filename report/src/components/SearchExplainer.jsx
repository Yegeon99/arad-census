import { BIN_COLOR, BIN_ORDER } from "../lib/palette.js";

/**
 * 검색이 어떻게 잘리는지, 쏠림 없는 표본이 무엇인지 네 칸 그림으로 보여 준다.
 * 줄 하나가 캐릭터 하나이고, 줄이 짙을수록 강한 캐릭터다.
 */
const W = 170;
const H = 150;
const ROW_H = 9;
const ROW_GAP = 3;
const LEFT = 18;
const ROW_W = 134;

const STRONG = BIN_COLOR[BIN_ORDER[5]];
const MID = BIN_COLOR[BIN_ORDER[3]];
const WEAK = BIN_COLOR[BIN_ORDER[0]];

function Row({ y, tone, width = ROW_W, dim }) {
  return <rect x={LEFT} y={y} width={width} height={ROW_H} rx="1.5" fill={tone} opacity={dim ? 0.28 : 1} />;
}

function SearchBox({ y }) {
  return (
    <g>
      <rect x={LEFT} y={y} width={ROW_W} height={18} rx="2" fill="none" stroke="var(--hairline-strong)" strokeWidth="1.1" />
      <text x={LEFT + 8} y={y + 13} fontSize="10.5" fill="var(--text-primary)" fontWeight="600">가나</text>
      <circle cx={LEFT + ROW_W - 16} cy={y + 8} r="4.2" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" />
      <path d={`M${LEFT + ROW_W - 13} ${y + 11}l3.5 3.5`} stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

const TONES = [STRONG, STRONG, MID, MID, WEAK, WEAK, WEAK];

function Panel1() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="검색창에 두 글자를 넣으면 결과 목록이 나온다">
      <SearchBox y={10} />
      {TONES.slice(0, 6).map((t, i) => (
        <Row key={i} y={40 + i * (ROW_H + ROW_GAP)} tone={t} />
      ))}
      <text x={LEFT} y={H - 6} fontSize="9" fill="var(--text-muted)">줄 하나가 캐릭터 하나</text>
    </svg>
  );
}

function Panel2() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="결과가 200명을 넘으면 목록이 잘린다">
      <SearchBox y={10} />
      {TONES.slice(0, 3).map((t, i) => (
        <Row key={i} y={40 + i * (ROW_H + ROW_GAP)} tone={t} />
      ))}
      <line x1={LEFT - 4} x2={LEFT + ROW_W + 4} y1={40 + 3 * (ROW_H + ROW_GAP) - 2} y2={40 + 3 * (ROW_H + ROW_GAP) - 2}
        stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 3" />
      <text x={LEFT + ROW_W + 6} y={40 + 3 * (ROW_H + ROW_GAP) + 2} fontSize="8.5" fill="var(--gold-text)" fontWeight="700"
        textAnchor="end">200</text>
      {TONES.slice(3, 6).map((t, i) => (
        <Row key={i} y={40 + (i + 3) * (ROW_H + ROW_GAP) + 4} tone={t} dim />
      ))}
      <text x={LEFT} y={H - 6} fontSize="9" fill="var(--text-muted)">아래쪽은 잘려 나감</text>
    </svg>
  );
}

function Panel3() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="결과가 200명 미만이면 전부 보인다">
      <SearchBox y={10} />
      {TONES.slice(0, 6).map((t, i) => (
        <Row key={i} y={40 + i * (ROW_H + ROW_GAP)} tone={t} />
      ))}
      <path d={`M${LEFT - 6} 40v${6 * (ROW_H + ROW_GAP) - ROW_GAP}`} stroke="var(--accent)" strokeWidth="2" />
      <text x={LEFT} y={H - 6} fontSize="9" fill="var(--text-muted)">잘린 곳 없음</text>
    </svg>
  );
}

function Panel4() {
  const groups = [0, 1, 2];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="전부 보인 검색만 모은 것이 쏠림 없는 표본">
      <rect x={6} y={8} width={W - 12} height={H - 26} rx="3" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
      {groups.map((g) => (
        <g key={g}>
          {TONES.slice(0, 4).map((t, i) => (
            <Row key={i} y={18 + g * 42 + i * 8} tone={t} width={ROW_W - 14} />
          ))}
        </g>
      ))}
      <text x={LEFT} y={H - 6} fontSize="9" fill="var(--accent)" fontWeight="700">쏠림 없는 표본</text>
    </svg>
  );
}

const PANELS = [
  { node: <Panel1 />, caption: "검색은 한 번에 200명까지만 보여줍니다." },
  { node: <Panel2 />, caption: "200명이 넘는 글자는 잘립니다. 잘릴 때 강한 캐릭터가 먼저 남습니다." },
  { node: <Panel3 />, caption: "200명이 안 되는 글자는 전부 보입니다." },
  { node: <Panel4 />, caption: "이렇게 전부 보인 검색만 모은 것이 쏠림 없는 표본입니다. 실제 분포에 더 가깝습니다." },
];

export default function SearchExplainer() {
  return (
    <ol className="m-0 grid list-none gap-x-6 gap-y-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {PANELS.map((p, i) => (
        <li key={i}>
          <div style={{ background: "var(--bg-sunken)", padding: "6px 4px" }}>{p.node}</div>
          <p className="t-body m-0 mt-2 text-[0.84rem]">
            <b className="num" style={{ color: "var(--accent)" }}>{i + 1}</b> {p.caption}
          </p>
        </li>
      ))}
    </ol>
  );
}

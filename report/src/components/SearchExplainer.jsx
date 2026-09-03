import { BIN_COLOR, BIN_ORDER } from "../lib/palette.js";
import { fmtInt, fmtPct } from "../lib/format.js";
import { capEvidence } from "../lib/data.js";

/**
 * 검색이 어떻게 잘리는지, 잘린 검색을 어떻게 쪼개 다시 받는지 네 칸 그림으로 보여 준다.
 * 줄 하나가 캐릭터 하나이고, 줄이 짙을수록 강한 캐릭터다.
 */
const W = 170;
const H = 158;
const CAP = 26;   // 맨 아래 캡션이 쓰는 띠. 그림은 이 위에서 끝난다.
const ROW_H = 9;
const ROW_GAP = 3;
const LEFT = 18;
const ROW_W = 134;

const STRONG = BIN_COLOR[BIN_ORDER[5]];
const MID = BIN_COLOR[BIN_ORDER[3]];
const WEAK = BIN_COLOR[BIN_ORDER[0]];

function Row({ y, tone, width = ROW_W, dim, x = LEFT, h = ROW_H }) {
  return <rect x={x} y={y} width={width} height={h} rx="1.5" fill={tone} opacity={dim ? 0.28 : 1} />;
}

function SearchBox({ y }) {
  return (
    <g>
      <rect x={LEFT} y={y} width={ROW_W} height={18} rx="2" fill="none" stroke="var(--hairline-strong)" strokeWidth="1.1" />
      <text x={LEFT + 8} y={y + 13} fontSize="13" fill="var(--text-primary)" fontWeight="600">가나</text>
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
      <text x={LEFT} y={H - 6} fontSize="13" fill="var(--text-muted)">줄 하나가 캐릭터 하나</text>
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
      <line x1={LEFT - 4} x2={LEFT + ROW_W - 26} y1={40 + 3 * (ROW_H + ROW_GAP) - 2} y2={40 + 3 * (ROW_H + ROW_GAP) - 2}
        stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 3" />
      <text x={LEFT + ROW_W + 4} y={40 + 3 * (ROW_H + ROW_GAP) + 3} fontSize="13" fill="var(--gold-text)" fontWeight="700"
        textAnchor="end">200</text>
      {TONES.slice(3, 6).map((t, i) => (
        <Row key={i} y={40 + (i + 3) * (ROW_H + ROW_GAP) + 4} tone={t} dim />
      ))}
      <text x={LEFT} y={H - 6} fontSize="13" fill="var(--text-muted)">아래쪽은 잘려 나감</text>
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
      <text x={LEFT} y={H - 6} fontSize="13" fill="var(--text-muted)">잘린 곳 없음</text>
    </svg>
  );
}

// 잘린 목록 하나가 직업군 여러 갈래로 나뉘고, 갈래마다 잘림 없이 전부 보인다.
const SRC_X = 53;
const SRC_W = 64;
const SRC_H = 7;
const CUT_Y = 39;
const COL_CX = [27, 85, 143];
const COL_W = 44;
const SPLIT_H = 7;
const SPLIT_GAP = 3;
const SPLIT_TOP = 62;

function Panel4() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label="잘린 목록 하나를 직업군 세 갈래로 쪼개면 갈래마다 잘림 없이 전부 보인다">
      {[STRONG, STRONG, MID].map((t, i) => (
        <Row key={i} x={SRC_X} y={10 + i * (SRC_H + 2)} width={SRC_W} h={SRC_H} tone={t} />
      ))}
      <line x1={SRC_X - 5} x2={SRC_X + SRC_W + 5} y1={CUT_Y} y2={CUT_Y}
        stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="5 3" />

      {COL_CX.map((cx) => (
        <path key={cx} d={`M85 ${CUT_Y + 4}V${CUT_Y + 10}H${cx}V${SPLIT_TOP - 4}`}
          fill="none" stroke="var(--accent)" strokeWidth="1.2" />
      ))}

      {COL_CX.map((cx) => (
        <g key={cx}>
          <path d={`M${cx - COL_W / 2 - 5} ${SPLIT_TOP}v${4 * (SPLIT_H + SPLIT_GAP) - SPLIT_GAP}`}
            stroke="var(--accent)" strokeWidth="2" />
          {[STRONG, MID, WEAK, WEAK].map((t, i) => (
            <Row key={i} x={cx - COL_W / 2} y={SPLIT_TOP + i * (SPLIT_H + SPLIT_GAP)}
              width={COL_W} h={SPLIT_H} tone={t} />
          ))}
        </g>
      ))}

      <text x={LEFT} y={H - 6} fontSize="13" fill="var(--accent)" fontWeight="700">직업군으로 쪼개 다시</text>
    </svg>
  );
}

const PANELS = [
  { node: <Panel1 />, caption: "검색은 한 번에 200명까지만 보여줍니다." },
  {
    node: <Panel2 />,
    caption: `200명이 넘는 글자는 잘립니다. 잘릴 때 낮은 명성 캐릭터가 먼저 잘립니다. 잘린 검색 ${fmtInt(capEvidence.sampledCombos)}개를 쪼개 다시 받아 보니 새로 드러난 캐릭터의 ${fmtPct(capEvidence.stageSplit[0].revealed)}가 가장 낮은 단계였습니다.`,
  },
  {
    node: <Panel3 />,
    caption: "200명이 안 되는 글자는 전부 보입니다. 다만 이런 검색은 드문 이름에 몰려 있어 그 자체를 기준으로 쓰지는 않았습니다.",
  },
  {
    node: <Panel4 />,
    caption: "잘린 검색을 직업군으로 쪼개 다시 받으면 가려진 몫이 보입니다. 그 몫을 되돌린 값이 상한 보정값입니다.",
  },
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

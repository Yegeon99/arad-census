// 색 규칙: 잉크 네이비 한 계열 + 액센트 1색 + 3D 강조용 골드 1색.
// 직업군 색은 채도를 낮춘 계열색으로만 구분하고, 게임 아트워크 색은 쓰지 않는다.

export const INK = ["#DEE5F2", "#BCCAE7", "#8DA6D8", "#5D80C3", "#2450A8", "#16346B"];
export const ACCENT = "#2450A8";
export const GOLD = "#B0813C";

/** 명성 6구간 색 (아래에서 위로 짙어진다) */
export const BIN_ORDER = [
  "레기온 입장 전",
  "아포칼립스 입장",
  "상급 던전 구간",
  "레이드 입장 구간",
  "레이드 권장 구간",
  "하드 권장 구간",
];
export const BIN_COLOR = Object.fromEntries(BIN_ORDER.map((b, i) => [b, INK[i]]));

/** 활성도 4단계 색 */
export const ACT_ORDER = [
  "최근 7일 접속",
  "최근 30일 접속",
  "최근 90일 접속",
  "90일 넘게 기록 없음",
];
export const ACT_COLOR = {
  "최근 7일 접속": "#16346B",
  "최근 30일 접속": "#5D80C3",
  "최근 90일 접속": "#AFC1E0",
  "90일 넘게 기록 없음": "#DCD9D1",
};

/** 직업군 색: 잉크 네이비 한 색을 명도로만 나눈 램프 */
const GROUP_HUE = 219;
const GROUP_SAT = 34;
export const groupColor = (index, total = 18, light = 0) => {
  const step = total > 1 ? index / (total - 1) : 0;
  const base = 22 + step * 46;          // 어두운 잉크에서 밝은 잉크까지
  const l = base + light * (86 - base) * 0.72;
  return `hsl(${GROUP_HUE} ${GROUP_SAT}% ${l}%)`;
};
/** 그 색 위에 글자를 얹을 때 쓸 색 */
export const onGroupColor = (index, total = 18, light = 0) => {
  const step = total > 1 ? index / (total - 1) : 0;
  const base = 22 + step * 46;
  const l = base + light * (86 - base) * 0.72;
  return l > 62 ? "#1B2130" : "#FFFFFF";
};

/** 0~1 값을 잉크 6단계로 */
export const inkScale = (t) => INK[Math.max(0, Math.min(5, Math.floor(t * 6)))];

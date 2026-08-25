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

/** 직업군 계열색 18종 (채도 낮은 잉크 톤) */
const GROUP_HUES = [
  218, 205, 240, 196, 255, 228, 188, 264, 212, 246,
  182, 272, 222, 200, 252, 192, 234, 208,
];
export const groupColor = (index, light = 0) => {
  const h = GROUP_HUES[index % GROUP_HUES.length];
  const s = 20 + (index % 3) * 5;
  const l = 38 + light * 34;
  return `hsl(${h} ${s}% ${l}%)`;
};

/** 0~1 값을 잉크 6단계로 */
export const inkScale = (t) => INK[Math.max(0, Math.min(5, Math.floor(t * 6)))];

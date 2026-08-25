// 화면 숫자 표기 규칙: 퍼센트는 소수 1자리, 인원은 천 단위 콤마.
// 집계 값이 소수 둘째 자리까지 오므로, 반올림은 둘째 자리를 먼저 맞춘 뒤
// 셋째 자리에서 올림 방향으로 처리한다 (검증 스크립트와 같은 방식).

const halfUp = (v) => Math.round(v);
export const round1 = (v) => halfUp(halfUp(Number(v) * 100) / 10) / 10;

export const fmtInt = (v) => Number(v).toLocaleString("ko-KR");
export const fmtPeople = (v) => `${fmtInt(v)}명`;
export const pct1 = (v) => round1(v).toFixed(1);
export const fmtPct = (v) => `${pct1(v)}%`;
export const fmtPp = (v) => `${pct1(v)}%포인트`;
export const fmtX = (v) => `${Number(v).toFixed(2)}배`;

/** 명성값 축 라벨: 74,000 대신 7.4만으로 짧게 */
export const fmtFame = (v) => {
  if (v === 0) return "0";
  const man = v / 10000;
  return Number.isInteger(man) ? `${man}만` : `${man.toFixed(1)}만`;
};

/** 한글 조사 고르기: 이름이 데이터에서 오므로 받침에 맞춰 붙인다. */
const finalJamo = (word) => {
  const last = String(word).trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return code % 28;
};
export const topicParticle = (w) => `${w}${finalJamo(w) ? "은" : "는"}`;
export const withParticle = (w) => `${w}${finalJamo(w) ? "과" : "와"}`;
export const asParticle = (w) => {
  const j = finalJamo(w);
  return `${w}${!j || j === 8 ? "로" : "으로"}`;
};

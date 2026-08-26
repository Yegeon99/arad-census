// 표본 피라미드 모양 계산.
// 두 피라미드는 밑변 폭과 전체 높이가 같고, 층 높이만 그 구간의 비중을 따른다.
// 그래서 겉모양은 같은 삼각형이고, 가로로 자른 위치만 달라진다.

/**
 * @param {{range:string,pct:number,count:number}[]} bins 아래 구간부터 차례로
 * @returns 층별 아래쪽 높이 비율, 위쪽 높이 비율, 아래 반폭 비율, 위 반폭 비율
 */
export function bands(bins) {
  const total = bins.reduce((s, b) => s + b.pct, 0) || 100;
  const out = [];
  let acc = 0;
  for (const b of bins) {
    const from = acc / total;
    acc += b.pct;
    const to = acc / total;
    out.push({
      bin: b.range,
      pct: b.pct,
      count: b.count,
      from,
      to,
      mid: (from + to) / 2,
      halfFrom: 1 - from, // 밑변에서 꼭짓점까지 곧게 좁아진다
      halfTo: 1 - to,
    });
  }
  return out;
}

/**
 * 라벨이 겹치지 않게 자리를 벌린다.
 * @param {number[]} desired 위에서 아래 차례로 놓인 원하는 세로 좌표
 * @param {number} minGap 최소 간격
 * @param {number} top 가장 위 한계
 * @param {number} bottom 가장 아래 한계
 */
export function spreadLabels(desired, minGap, top, bottom) {
  const ys = [...desired];
  for (let i = 0; i < ys.length; i += 1) {
    const floor = i === 0 ? top : ys[i - 1] + minGap;
    ys[i] = Math.max(ys[i], floor);
  }
  for (let i = ys.length - 1; i >= 0; i -= 1) {
    const ceil = i === ys.length - 1 ? bottom : ys[i + 1] - minGap;
    ys[i] = Math.min(ys[i], ceil);
  }
  return ys;
}

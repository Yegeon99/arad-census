/**
 * 차트 한 덩어리.
 * 위에는 읽는 법 한 줄, 아래에는 그래서 한 줄을 붙인다.
 * 이 두 줄만 읽어도 차트의 뜻이 통해야 한다.
 */
export default function Chart({ how, so, children }) {
  return (
    <div>
      {how && (
        <p className="m-0 mb-3 text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {how}
        </p>
      )}
      {children}
      {so && (
        <p className="m-0 mt-4 max-w-[680px] text-[1rem] font-bold leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {so}
        </p>
      )}
    </div>
  );
}

/** 입체 화면과 평면 화면 전환. 평면이 정확한 읽기용이라는 점을 캡션으로 밝힌다. */
export default function ViewToggle({ mode, setMode, available }) {
  const options = [
    { key: "flat", label: "평면으로 보기" },
    { key: "solid", label: "입체로 보기" },
  ];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="flex items-center gap-3">
        {options.map((o) => {
          const on = mode === o.key;
          const disabled = o.key === "solid" && !available;
          return (
            <button
              key={o.key}
              type="button"
              disabled={disabled}
              onClick={() => setMode(o.key)}
              className="disclose"
              style={{
                color: on ? "var(--text-primary)" : disabled ? "var(--text-muted)" : "var(--accent)",
                fontWeight: on ? 700 : 450,
                textDecoration: on ? "none" : "underline",
                cursor: disabled ? "default" : "pointer",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="t-small m-0">
        {available
          ? "정확한 수치는 평면 화면에서 읽고, 입체 화면은 전체 모양을 잡는 데 씁니다."
          : "좁은 화면과 움직임 최소화 설정에서는 평면 화면만 보여 줍니다."}
      </p>
    </div>
  );
}

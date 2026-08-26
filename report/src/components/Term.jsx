import { useEffect, useRef, useState } from "react";

/** 처음 나온 자리에서 뜻을 풀어 주는 낱말. 마우스를 올리거나 누르면 한 문장이 뜬다. */
export const GLOSSARY = {
  명성: "캐릭터가 얼마나 강한지 게임이 매기는 점수입니다. 장비가 좋을수록 높습니다.",
  성장단계: "명성 점수를 게임 콘텐츠 입장 조건에 맞춰 여섯 단계로 나눈 것입니다. 가장 낮은 단계가 레기온 입장 전, 가장 높은 단계가 하드 권장 구간입니다.",
  잘린검색: "검색은 한 번에 200명까지만 돌려줍니다. 200명에 걸려 일부만 받은 검색을 잘린 검색이라고 부릅니다. 강한 캐릭터를 먼저 보여주는 쏠림이 있습니다.",
  빠짐없이: "200명에 걸리지 않아 해당 글자가 든 캐릭터를 전부 받은 검색만 모은 표본입니다. 잘린 검색의 쏠림이 없습니다.",
  보정값: "잘린 검색의 쏠림을 빠짐없이 모은 표본의 비율로 되돌려 다시 계산한 값입니다.",
  전직: "캐릭터가 기본 직업에서 갈라져 나와 고르는 직업입니다.",
  각성: "전직한 직업이 한 단계 더 강해지면서 이름이 바뀌는 성장 지점입니다.",
  진각성: "직업 성장의 마지막 단계입니다.",
};

export default function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const text = GLOSSARY[k];

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (!text) return children;

  return (
    <span
      ref={ref}
      className="term"
      tabIndex={0}
      role="button"
      aria-label={`${children} 뜻 보기`}
      aria-expanded={open}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
    >
      {children}
      {open && <span className="term-pop">{text}</span>}
    </span>
  );
}

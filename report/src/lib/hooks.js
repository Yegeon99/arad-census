import { useEffect, useRef, useState } from "react";

export const PAGES = [
  { id: "overview", label: "한눈에 보기" },
  { id: "jobs", label: "직업" },
  { id: "growth", label: "성장 단계" },
  { id: "activity", label: "활성도" },
  { id: "gap", label: "직업과 성장 격차" },
  { id: "insights", label: "AI 인사이트" },
  { id: "method", label: "조사 방법과 한계" },
];

const IDS = PAGES.map((p) => p.id);
const readHash = () => {
  const id = window.location.hash.replace("#", "");
  return IDS.includes(id) ? id : IDS[0];
};

/** 해시 라우팅 (화면 7개 분리) */
export function useHashRoute() {
  const [page, setPage] = useState(readHash);
  useEffect(() => {
    const onHash = () => {
      setPage(readHash());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.replace("#overview");
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return page;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    setMatch(mq.matches);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

let webglChecked = null;
function hasWebGL() {
  if (webglChecked !== null) return webglChecked;
  try {
    const canvas = document.createElement("canvas");
    webglChecked = Boolean(window.WebGLRenderingContext
      && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    webglChecked = false;
  }
  return webglChecked;
}

/** 입체 화면을 켜도 되는 기기인지 (모바일과 저사양, 그래픽 미지원은 평면으로 대체) */
export function useCanRender3D() {
  const narrow = useMediaQuery("(max-width: 900px)");
  const coarse = useMediaQuery("(pointer: coarse)");
  const reduced = useReducedMotion();
  const weak = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;
  return !(narrow || coarse || reduced || weak) && hasWebGL();
}

/** 차트가 0에서 실제 값까지 차오르는 시간. 항목이 많아도 0.8초 안에 끝나게 잡는다. */
export const ENTER_MS = 320;
export const STAGGER_MS = 10;

/**
 * 화면에 들어왔는지 (차트 그려지는 애니메이션 시작점).
 * 관찰 기능이 없는 환경에서는 기다리지 않고 바로 그린다.
 */
export function useInView(options) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", ...options }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);
  return [ref, seen];
}

/** 값이 바뀔 때 부드럽게 따라가는 보간 (차트 모핑용) */
export function useTween(target, { duration = 700, enabled = true } = {}) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!enabled) {
      from.current = target;
      setValue(target);
      return undefined;
    }
    const start = from.current;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const v = start + (target - start) * eased;
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

/** 첫 화면이 그려진 뒤에 무거운 화면을 붙인다 (초기 로딩 보호) */
export function useIdleMount(timeout = 400) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let id = 0;
    if (typeof window.requestIdleCallback === "function") {
      id = window.requestIdleCallback(() => setReady(true), { timeout });
      return () => window.cancelIdleCallback(id);
    }
    id = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(id);
  }, [timeout]);
  return ready;
}

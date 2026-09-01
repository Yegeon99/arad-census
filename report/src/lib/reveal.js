// 스크롤에 맞춘 등장 연출을 한곳에서 만든다.
// 애니메이션은 Anime.js가 맡는다. 화면에 들어왔는지 판정은 브라우저가 주는
// 교차 관찰자 하나로 모아 처리한다.
//
// 판정을 요소마다 따로 두면 화면에 들어설 때 그 전부가 한꺼번에 위치를 재느라
// 첫 화면이 늦게 잡힌다. 관찰자를 하나로 모으면 그 비용이 사라지고,
// 위치를 묻는 일도 브라우저가 알아서 한가할 때 한다.
//
// 어떤 이유로든 관찰이 실패하면 요소를 즉시 보이게 되돌린다
// (글이 사라지지 않게 하는 마지노선).
import { animate, cubicBezier, utils } from "animejs";

export const ENTER_MS = 380;   // 요소 하나가 나타나는 시간
export const STEP_MS = 70;     // 요소 사이 간격
export const MAX_STEPS = 5;    // 이 이상은 기다리게 하지 않는다
export const FAILSAFE_MS = 900; // 관찰이 안 걸렸을 때 무조건 보이게 하는 시점

export const EASE = cubicBezier(0.22, 0.68, 0.31, 1);

// 요소 윗변이 화면 아래에서 이만큼 올라와야 등장 연출이 시작된다.
// 화면 끝에 살짝 걸친 요소는 아직 켜지 않는 것이 이 리포트의 규칙이다.
export const ENTER_MARGIN = 40;

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const show = (el) => utils.set(el, { opacity: 1, translateY: 0 });

/* 공용 감지 ------------------------------------------------------------------
   화면에 들어왔거나, 한 번에 건너뛰어 이미 위로 지나갔으면 켠다.

   교차 관찰자만 쓰면 한 번에 맨 아래까지 내렸을 때 걸치는 순간이 아예 없어
   상태가 바뀌지 않고, 그래서 울리지도 않는다. 그 경우를 놓치면 글과 차트가
   빈 채로 남는다.

   그렇다고 스크롤마다 위치를 물으면 그때마다 레이아웃이 강제로 돈다.
   그래서 위치는 한 번만 재고, 스크롤 중에는 셈만 한다.
   듣는 자리도 하나뿐이고 볼 것이 없어지면 스스로 뗀다.

   재는 시점도 등록할 때가 아니라 스크롤이 실제로 일어난 뒤로 미룬다.
   등록은 화면이 뜨는 순간 요소마다 한 번씩 일어나는데, 그 사이사이에
   등장 연출이 요소의 모양을 손댄다. 손댄 직후에 위치를 물으면 브라우저가
   그 자리에서 배치를 다시 계산한다. 요소 수만큼 되풀이되면 첫 화면이
   그만큼 늦게 잡힌다. 미뤄 두면 잴 일이 한 번에 몰려 배치 계산도 한 번이면
   끝나고, 화면에 걸쳐 있는 요소는 어차피 관찰자가 알려 주므로 잴 일조차 없다. */
let sharedObserver = null;
const jobs = new Map();      // 요소 -> { fn, top } (top 이 null 이면 아직 안 잰 것)
let scrollBound = false;
let framePending = false;

const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

function runJob(el, passed) {
  const job = jobs.get(el);
  if (!job) return;
  jobs.delete(el);
  sharedObserver?.unobserve(el);
  if (jobs.size === 0) unbindScroll();
  job.fn(passed);
}

function sweep() {
  framePending = false;
  // 재는 일을 먼저 몰아서 끝낸다. 재기와 켜기를 번갈아 하면 그때마다 배치가
  // 다시 돌기 때문에, 잴 것을 다 재고 나서 켜는 순서를 지킨다.
  for (const [el, job] of jobs) {
    if (job.top === null) job.top = docTop(el);
  }
  const line = window.scrollY + window.innerHeight - ENTER_MARGIN;
  for (const [el, job] of [...jobs]) {
    if (line >= job.top) runJob(el, false);
  }
}

function onScrollTick() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(sweep);
}

function remeasure() {
  // 창 크기가 바뀌면 적어 둔 위치가 틀어진다. 지워만 두고 다시 재는 일은
  // 다음 차례에 맡긴다.
  for (const job of jobs.values()) job.top = null;
  onScrollTick();
}

function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;
  window.addEventListener("scroll", onScrollTick, { passive: true });
  window.addEventListener("resize", remeasure, { passive: true });
}

function unbindScroll() {
  if (!scrollBound) return;
  scrollBound = false;
  window.removeEventListener("scroll", onScrollTick);
  window.removeEventListener("resize", remeasure);
}

function ensureObserver() {
  if (sharedObserver || typeof IntersectionObserver === "undefined") return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const passed = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
        if (e.isIntersecting || passed) runJob(e.target, passed);
      }
    },
    { rootMargin: `0px 0px -${ENTER_MARGIN}px 0px` }
  );
  return sharedObserver;
}

/**
 * 요소가 화면에 들어오면 한 번만 부른다.
 * @param {HTMLElement} el
 * @param {(passed: boolean) => void} fn passed 가 참이면 걸치지 않고 지나쳐 버린 경우
 * @returns 정리 함수
 */
export function whenInView(el, fn) {
  if (typeof IntersectionObserver === "undefined" || typeof window === "undefined") {
    fn(false);
    return () => {};
  }
  jobs.set(el, { fn, top: null });
  ensureObserver()?.observe(el);
  bindScroll();
  return () => {
    jobs.delete(el);
    sharedObserver?.unobserve(el);
    if (jobs.size === 0) unbindScroll();
  };
}

/** 지금 화면 안에 있는지. 관찰자가 늦을 때만 쓴다. */
const inViewNow = (el) => {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top <= window.innerHeight - ENTER_MARGIN;
};

/**
 * 화면에 들어올 때 한 번만 재생하는 등장 연출.
 * @returns 정리 함수
 */
export function revealOnScroll(el, { delay = 0, distance = 10 } = {}) {
  if (!el) return () => {};
  if (reducedMotion()) {
    show(el);
    return () => {};
  }

  let done = false;
  let stopWatch = () => {};
  let animation = null;

  const play = (instant) => {
    if (done) return;
    done = true;
    stopWatch();
    if (instant) { show(el); return; }
    try {
      animation = animate(el, {
        opacity: [0, 1],
        translateY: [distance, 0],
        duration: ENTER_MS,
        delay,
        ease: EASE,
      });
    } catch {
      show(el);
    }
  };

  try {
    utils.set(el, { opacity: 0, translateY: distance });
    stopWatch = whenInView(el, (passed) => play(passed));
  } catch {
    show(el);
    return () => {};
  }

  // 관찰자가 어떤 까닭으로든 울리지 않았는데 이미 화면 안에 있으면 그냥 보여 준다.
  const failsafe = setTimeout(() => {
    if (done) return;
    if (!inViewNow(el)) return;
    play(false);
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    stopWatch();
    animation?.revert();
    show(el);
  };
}

/**
 * 구분선이 왼쪽에서 오른쪽으로 그어지는 연출.
 * 화면과 화면을 잇는 자리에 하나만 쓴다.
 */
export function drawRuleOnScroll(el) {
  if (!el) return () => {};
  if (reducedMotion()) return () => {};

  let done = false;
  let stopWatch = () => {};
  let animation = null;
  const finish = () => utils.set(el, { scaleX: 1 });

  const play = (instant) => {
    if (done) return;
    done = true;
    stopWatch();
    if (instant) { finish(); return; }
    try {
      animation = animate(el, { scaleX: [0, 1], duration: 620, ease: EASE });
    } catch {
      finish();
    }
  };

  try {
    utils.set(el, { scaleX: 0, transformOrigin: "0% 50%" });
    stopWatch = whenInView(el, (passed) => play(passed));
  } catch {
    finish();
    return () => {};
  }

  const failsafe = setTimeout(() => {
    if (done) return;
    if (!inViewNow(el)) return;
    play(false);
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    stopWatch();
    animation?.revert();
    utils.set(el, { scaleX: 1, transformOrigin: "" });
  };
}

/**
 * 화면에 들어올 때 0에서 실제 값까지 세어 올라간다. 최초 1회만 돈다.
 */
export function countUpOnScroll(el, target, onValue) {
  return countOnScroll(el, { from: 0, to: target, onValue, duration: 1100 });
}

/**
 * 화면에 들어올 때 시작값에서 끝값까지 옮겨 간다. 최초 1회만 돈다.
 * 회차 비교처럼 앞 값에서 뒤 값으로 바뀌는 자리에 쓴다.
 */
export function countOnScroll(el, { from = 0, to, onValue, duration = 900 } = {}) {
  if (!el || !Number.isFinite(to)) return () => {};
  if (reducedMotion()) {
    onValue(to);
    return () => {};
  }

  let done = false;
  let stopWatch = () => {};
  let animation = null;
  const counter = { value: from };

  const play = (instant) => {
    if (done) return;
    done = true;
    stopWatch();
    if (instant) { onValue(to); return; }
    try {
      animation = animate(counter, {
        value: to,
        duration,
        ease: "outExpo",
        onUpdate: () => onValue(counter.value),
        onComplete: () => onValue(to),
      });
    } catch {
      onValue(to);
    }
  };

  try {
    onValue(from);
    stopWatch = whenInView(el, (passed) => play(passed));
  } catch {
    onValue(to);
    return () => {};
  }

  const failsafe = setTimeout(() => {
    if (done) return;
    if (!inViewNow(el)) return;
    play(false);
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    stopWatch();
    animation?.revert();
  };
}

/**
 * 시각화가 화면 가운데를 채울 때만 주변 글을 살짝 죽여 시선을 모은다.
 * 지금은 쓰는 화면이 없다. 입체 시각화를 되살릴 때를 위해 남겨 둔다.
 */
export function dimAroundOnScroll(visualEl, dimEls, { level = 0.55 } = {}) {
  const targets = Array.from(dimEls ?? []).filter(Boolean);
  if (!visualEl || targets.length === 0) return () => {};
  if (reducedMotion()) return () => {};

  const fade = (opacity) => animate(targets, { opacity, duration: 420, ease: EASE });
  const stop = whenInView(visualEl, () => fade(level));
  return () => {
    stop();
    utils.set(targets, { opacity: 1 });
  };
}

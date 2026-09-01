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
export const FAILSAFE_MS = 900;  // 관찰이 안 걸렸을 때 무조건 보이게 하는 시점
export const VISIBLE_MS = 400;   // 화면에 들어온 뒤 이만큼 지나면 무조건 다 보인다

export const EASE = cubicBezier(0.22, 0.68, 0.31, 1);

// 화면 아래 이만큼 앞에서 미리 등장 연출을 시작한다.
//
// 화면에 걸친 다음에 시작하면 빠르게 내릴 때 늘 늦는다. 연출이 도는 사이에
// 요소가 이미 화면을 지나가 버려, 눈에는 한동안 빈 화면으로 보인다.
// 미리 시작해 두면 화면에 들어설 때는 이미 다 나와 있거나 나오는 중이다.
export const ENTER_LEAD = 300;

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const show = (el) => utils.set(el, { opacity: 1, translateY: 0 });

/* 마지노선 감시 ---------------------------------------------------------------
   스크롤로 켜는 길과 별개로, 요소가 정말로 화면에 들어선 뒤 VISIBLE_MS 가
   지나면 연출 상태와 상관없이 다 보이게 한다. 스크롤 없이 화면이 자라거나
   내용이 늦게 붙는 경우까지 받쳐 주는 마지막 그물이다. */
let hardObserver = null;
const hardJobs = new Map(); // 요소 -> { onDeadline, timer, entered }

function ensureHardObserver() {
  if (hardObserver || typeof IntersectionObserver === "undefined") return hardObserver;
  hardObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const job = hardJobs.get(e.target);
      if (!job || !e.isIntersecting || job.entered) continue;
      job.entered = true;
      job.timer = setTimeout(() => {
        hardJobs.delete(e.target);
        hardObserver?.unobserve(e.target);
        job.onDeadline();
      }, VISIBLE_MS);
    }
  });
  return hardObserver;
}

/**
 * 요소가 화면에 들어선 뒤 VISIBLE_MS 가 지나면 한 번 부른다.
 * @returns 정리 함수
 */
function whenVisible(el, onDeadline) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const job = { onDeadline, timer: 0, entered: false };
  hardJobs.set(el, job);
  ensureHardObserver()?.observe(el);
  return () => {
    clearTimeout(job.timer);
    hardJobs.delete(el);
    hardObserver?.unobserve(el);
  };
}

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
const jobs = new Map();      // 요소 -> { soft, hard, top, started }
let scrollBound = false;
let framePending = false;

const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

/** 시작선을 넘었다. 등장 연출을 시작한다. */
function runSoft(el, passed) {
  const job = jobs.get(el);
  if (!job || job.started) return;
  job.started = true;
  sharedObserver?.unobserve(el);
  job.soft(passed);
  if (passed) runHard(el);
}

/** 마지막선을 넘었다. 연출이 어디까지 갔든 그냥 다 보이게 한다. */
function runHard(el) {
  const job = jobs.get(el);
  if (!job) return;
  jobs.delete(el);
  sharedObserver?.unobserve(el);
  if (jobs.size === 0) unbindScroll();
  job.hard();
}

function sweep() {
  framePending = false;
  // 재는 일을 먼저 몰아서 끝낸다. 재기와 켜기를 번갈아 하면 그때마다 배치가
  // 다시 돌기 때문에, 잴 것을 다 재고 나서 켜는 순서를 지킨다.
  for (const [el, job] of jobs) {
    if (job.top === null) job.top = docTop(el);
  }
  // 시작선은 화면 아래 ENTER_LEAD 앞, 마지막선은 화면 아래 그 자리다.
  // 정말로 화면 안에 든 요소가 아직 안 나와 있으면 그 자리에서 다 보이게 한다.
  // 스크롤이 들어온 그 순간 셈해서 켜므로, 다음 그림을 기다리다 비는 일이 없다.
  const bottom = window.scrollY + window.innerHeight;
  for (const [el, job] of [...jobs]) {
    if (bottom + ENTER_LEAD >= job.top) runSoft(el, false);
    if (bottom >= job.top) runHard(el);
  }
}

function onScrollTick() {
  // 다음 그림을 기다리지 않고 스크롤 그 자리에서 켠다. 기다리면 느린 기기에서
  // 다음 그림이 수백 밀리초 뒤로 밀리고, 그동안 그 자리가 빈 채로 남는다.
  // 위치는 처음 한 번만 재고 그다음부터는 셈만 하므로 여기 드는 비용은 작다.
  sweep();
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
        if (e.isIntersecting || passed) runSoft(e.target, passed);
      }
    },
    { rootMargin: `0px 0px ${ENTER_LEAD}px 0px` }
  );
  return sharedObserver;
}

/**
 * 요소가 화면 가까이 오면 soft 를, 정말로 화면 안에 들면 hard 를 한 번씩 부른다.
 * @param {HTMLElement} el
 * @param {(passed: boolean) => void} soft passed 가 참이면 걸치지 않고 지나쳐 버린 경우
 * @param {() => void} [hard] 연출과 상관없이 다 보이게 하는 마지막 손질
 * @returns 정리 함수
 */
export function whenInView(el, soft, hard = () => {}) {
  if (typeof IntersectionObserver === "undefined" || typeof window === "undefined") {
    soft(false);
    hard();
    return () => {};
  }
  jobs.set(el, { soft, hard, top: null, started: false });
  ensureObserver()?.observe(el);
  bindScroll();
  return () => {
    jobs.delete(el);
    sharedObserver?.unobserve(el);
    if (jobs.size === 0) unbindScroll();
  };
}

/** 지금 화면 안이거나 코앞인지. 관찰자가 늦을 때만 쓴다. */
const inViewNow = (el) => {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top <= window.innerHeight + ENTER_LEAD;
};

/* 지금 내리는 중인가 --------------------------------------------------------- */
let lastScrollAt = -Infinity;
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => { lastScrollAt = performance.now(); }, { passive: true });
}
const SCROLLING_MS = 400;  // 마지막으로 내린 뒤 이만큼은 내리는 중으로 본다
const NEAR_SCREENS = 1.5;  // 화면 이만큼 앞까지를 곧 볼 자리로 본다

/**
 * 숨겼다 켜면 안 되는 자리인가.
 *
 * 숨긴 것을 켜 주는 일은 관찰자와 다음 그림에 기댄다. 느린 기기에서 한꺼번에
 * 그리는 중이면 그 차례가 수백 밀리초 뒤로 밀리고, 그동안 그 자리는 빈 채로
 * 남는다. 빠르게 내릴 때 화면이 통째로 비어 보이던 것이 이 경우였다.
 *
 * 그래서 두 경우에는 숨기지 않고 그냥 보여 준다.
 *   - 이미 화면 안에 들어와 있다
 *   - 내리는 중이고, 곧 볼 자리(화면 1.5개 앞)에 있다
 *
 * 아직 한 번도 안 내린 상태(막 들어온 첫 화면)는 뺀다. 그때는 순서대로
 * 나타나는 연출이 있어야 하고, 어차피 늦을 일도 없다.
 */
const showRightAway = (el) => {
  if (typeof window === "undefined" || window.scrollY <= 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.bottom <= 0) return true;
  if (rect.top < window.innerHeight) return true;
  const scrolling = performance.now() - lastScrollAt < SCROLLING_MS;
  return scrolling && rect.top < window.innerHeight * (1 + NEAR_SCREENS);
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

  if (showRightAway(el)) {
    show(el);
    return () => {};
  }

  let done = false;
  let stopWatch = () => {};
  let stopHard = () => {};
  let animation = null;

  const play = (instant) => {
    if (done) return;
    done = true;
    stopWatch();
    if (instant) { show(el); stopHard(); return; }
    // 순서대로 나타나는 간격은 막 들어온 첫 화면 몫이다. 내려서 만나는 요소에
    // 그대로 물리면 간격만큼 늦게 나타나고, 빠르게 내리면 그 사이에 화면을
    // 지나쳐 버린다.
    const wait = window.scrollY > 0 ? 0 : delay;
    try {
      animation = animate(el, {
        opacity: [0, 1],
        translateY: [distance, 0],
        duration: ENTER_MS,
        delay: wait,
        ease: EASE,
      });
    } catch {
      show(el);
      stopHard();
    }
  };

  try {
    utils.set(el, { opacity: 0, translateY: distance });
    const settle = () => {
      done = true;
      stopWatch();
      animation?.pause();
      show(el);
    };
    // 시작선을 넘으면 연출을 시작하고, 정말로 화면 안에 들면 연출과 상관없이
    // 다 보이게 한다. 마지막 손질은 스크롤 그 자리에서 셈해 켜므로 늦지 않는다.
    stopWatch = whenInView(el, (passed) => play(passed), settle);
    // 스크롤 없이 화면이 자라는 경우까지 받쳐 주는 마지막 그물
    stopHard = whenVisible(el, settle);
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
    stopHard();
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

  if (showRightAway(el)) return () => {};

  let done = false;
  let stopWatch = () => {};
  let stopHard = () => {};
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
    const settle = () => {
      done = true;
      stopWatch();
      animation?.pause();
      finish();
    };
    stopWatch = whenInView(el, (passed) => play(passed), settle);
    stopHard = whenVisible(el, settle);
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
    stopHard();
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

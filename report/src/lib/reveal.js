// 스크롤에 맞춘 등장 연출을 한곳에서 만든다.
// 애니메이션은 Anime.js가 맡고, 화면에 들어왔는지 판정도 Anime.js 스크롤 관찰자가 한다.
// 어떤 이유로든 관찰이 실패하면 요소를 즉시 보이게 되돌린다 (글이 사라지지 않게 하는 마지노선).
import { animate, cubicBezier, onScroll, utils } from "animejs";

export const ENTER_MS = 380;   // 요소 하나가 나타나는 시간
export const STEP_MS = 70;     // 요소 사이 간격
export const MAX_STEPS = 5;    // 이 이상은 기다리게 하지 않는다
export const FAILSAFE_MS = 900; // 관찰이 안 걸렸을 때 무조건 보이게 하는 시점

export const EASE = cubicBezier(0.22, 0.68, 0.31, 1);

// 등장 연출이 도는 구간의 시작과 끝.
// 시작은 요소 윗변이 화면 아래에서 40px 올라온 지점이다.
// 끝은 사실상 없는 값으로 둔다. 한 번에 맨 아래까지 내려도 지나친 요소가
// 건너뛰어지지 않고 반드시 한 번은 켜지게 하기 위해서다.
// 요소 윗변이 화면 아래에서 이만큼 올라와야 등장 연출이 시작된다.
// 화면 끝에 살짝 걸친 요소는 아직 켜지 않는 것이 이 리포트의 규칙이다.
export const ENTER_MARGIN = 40;
const ENTER_AT = `end-=${ENTER_MARGIN} start`;
const NEVER_LEAVE = -1e9;

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const show = (el) => utils.set(el, { opacity: 1, translateY: 0 });

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

  let entered = false;
  let observer = null;
  let animation = null;

  // 첫 화면에 이미 들어와 있는 요소는 기다릴 스크롤이 없다.
  // 그런데도 스크롤 관찰자에 맡기면, 관찰자가 처음 판정하는 시점이
  // 늦어질수록 글이 늦게 켜진다. 이미 들어와 있으면 바로 재생한다.
  const alreadyInView = () => {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top <= window.innerHeight - ENTER_MARGIN;
  };

  try {
    utils.set(el, { opacity: 0, translateY: distance });
    const inView = alreadyInView();
    if (inView) {
      entered = true;
    } else {
      observer = onScroll({
        target: el,
        enter: ENTER_AT,
        leave: NEVER_LEAVE,
        repeat: false,
        onEnter: () => { entered = true; },
      });
    }
    animation = animate(el, {
      opacity: [0, 1],
      translateY: [distance, 0],
      duration: ENTER_MS,
      delay,
      ease: EASE,
      autoplay: inView ? true : observer,
    });
  } catch {
    show(el);
    return () => {};
  }

  // 관찰자가 붙지 않았는데 이미 화면 안에 있으면 그냥 보여 준다.
  // 판정 기준은 등장 연출과 똑같은 문턱을 쓴다. 예전에는 화면에 1픽셀만
  // 걸쳐도 여기서 켜 버려서, 아직 켜지 않기로 한 요소를 연출과 서로 다투었다.
  const failsafe = setTimeout(() => {
    if (entered) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight - ENTER_MARGIN) return;
    observer?.revert();
    animation?.revert();
    show(el);
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    observer?.revert();
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

  let observer = null;
  let animation = null;
  try {
    utils.set(el, { scaleX: 0, transformOrigin: "0% 50%" });
    observer = onScroll({ target: el, enter: ENTER_AT, leave: NEVER_LEAVE, repeat: false });
    animation = animate(el, {
      scaleX: [0, 1],
      duration: 620,
      ease: EASE,
      autoplay: observer,
    });
  } catch {
    utils.set(el, { scaleX: 1 });
    return () => {};
  }

  const failsafe = setTimeout(() => {
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) return;
    if (animation?.began) return;
    observer?.revert();
    animation?.revert();
    utils.set(el, { scaleX: 1 });
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    observer?.revert();
    animation?.revert();
    utils.set(el, { scaleX: 1, transformOrigin: "" });
  };
}

/**
 * 화면에 들어올 때 0에서 실제 값까지 세어 올라간다. 최초 1회만 돈다.
 * @param {HTMLElement} el 관찰 대상
 * @param {number} target 최종 값
 * @param {(v: number) => void} onValue 매 프레임 값 전달
 */
export function countUpOnScroll(el, target, onValue) {
  if (!el || !Number.isFinite(target)) return () => {};
  if (reducedMotion()) {
    onValue(target);
    return () => {};
  }

  const counter = { value: 0 };
  let observer = null;
  let animation = null;
  try {
    onValue(0);
    observer = onScroll({ target: el, enter: ENTER_AT, leave: NEVER_LEAVE, repeat: false });
    animation = animate(counter, {
      value: target,
      duration: 1100,
      ease: "outExpo",
      autoplay: observer,
      onUpdate: () => onValue(counter.value),
      onComplete: () => onValue(target),
    });
  } catch {
    onValue(target);
    return () => {};
  }

  const failsafe = setTimeout(() => {
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) return;
    if (animation?.began) return;
    observer?.revert();
    animation?.revert();
    onValue(target);
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    observer?.revert();
    animation?.revert();
  };
}

/**
 * 입체 시각화가 화면 가운데를 채울 때만 주변 글을 살짝 죽여 시선을 모은다.
 * 시각화가 화면에서 차지하는 높이가 이 값보다 작으면 (긴 화면 캡처처럼)
 * 굳이 죽이지 않는다. 글을 읽는 데 방해가 되기 때문이다.
 */
const FILLS_SCREEN = 0.3;

export function dimAroundOnScroll(visualEl, dimEls, { level = 0.55 } = {}) {
  const targets = Array.from(dimEls ?? []).filter(Boolean);
  if (!visualEl || targets.length === 0) return () => {};
  if (reducedMotion()) return () => {};

  let observer = null;
  const fade = (opacity) => animate(targets, { opacity, duration: 420, ease: EASE });
  const fillsScreen = () =>
    visualEl.getBoundingClientRect().height / window.innerHeight >= FILLS_SCREEN;
  const dim = () => { if (fillsScreen()) fade(level); };

  try {

    observer = onScroll({
      target: visualEl,
      enter: "center+=60 center",
      leave: "start end",
      repeat: true,
      onEnter: dim,
      onLeave: () => fade(1),
      onEnterBackward: dim,
      onLeaveBackward: () => fade(1),
    });
  } catch {
    utils.set(targets, { opacity: 1 });
    return () => {};
  }

  return () => {
    observer?.revert();
    utils.set(targets, { opacity: 1 });
  };
}

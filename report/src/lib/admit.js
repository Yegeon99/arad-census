// 화면 하나를 한 번에 다 그리지 않고 묶음 단위로 차례차례 들여보낸다.
//
// 리포트 한 화면은 세로로 3천 픽셀이 넘는다. 그것을 한 번에 그리면 브라우저가
// 전체 배치를 한 덩어리로 계산하고, 계산하는 동안에는 아무것도 눌리지 않는다.
// 느린 기기에서 그 한 덩어리가 0.4초를 넘었다.
//
// 그래서 묶음을 화면 한 번 그릴 때마다 하나씩 들여보낸다. 배치 계산이 묶음
// 수만큼 잘게 나뉘어, 한 번에 붙잡는 시간이 짧아진다. 전부 들어오기까지
// 걸리는 시간 자체는 거의 그대로다.
//
// 첫 묶음까지 한 프레임 미룬다. 곧바로 그려 두면 첫 배치에 제목 글꼴 처리까지
// 함께 걸려 다시 무거워진다 (실측 136 -> 188밀리초). 사람 눈에는 한 프레임이다.
//
// 다만 사람이 스크롤을 시작하면 남은 묶음을 그 자리에서 전부 들여보내고,
// 이어서 한동안은 새로 올라오는 묶음도 기다리지 않고 곧바로 그린다.
// 한 프레임에 하나는 화면이 뜨는 동안에만 넉넉한 속도다. 빠르게 내리면
// 그리는 속도가 내리는 속도를 못 따라가 아래쪽이 한동안 비어 보인다.
// 스크롤이 시작됐다는 것은 화면 뜨는 일이 이미 끝났다는 뜻이기도 하다.
//
// 한동안을 두는 까닭: 묶음 안에 다시 묶음이 든 자리가 있다. 바깥이 열려야
// 안쪽이 자리를 받으므로, 한 번 몰아넣는 것만으로는 안쪽이 다시 밀린다.

const RUSH_MS = 1200;  // 스크롤 뒤 이만큼은 기다리지 않고 곧바로 그린다
const DEAF_MS = 150;   // 화면을 옮기며 스스로 올린 스크롤은 이만큼 못 들은 척한다

let seq = 0;        // 지금까지 자리를 받은 묶음 수
let admitted = 0;   // 이 번호 앞까지는 그려도 된다
let rushUntil = 0;  // 이 시각까지는 밀린 것을 곧바로 들여보낸다
let deafUntil = 0;  // 이 시각까지 들어온 스크롤은 사람이 낸 것이 아니다
let pumping = false;
const waiting = new Set(); // { seat, fn }

const canDefer = () =>
  typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";

function pump() {
  pumping = false;
  // 차례가 이른 것부터 한 프레임에 하나씩 들여보낸다.
  const next = [...waiting].sort((a, b) => a.seat - b.seat)[0];
  if (next) {
    // 버려진 번호는 건너뛴다. 화면을 옮기면 차례를 못 받은 채 내려간 묶음이 생긴다.
    admitted = Math.max(admitted, next.seat + 1);
    waiting.delete(next);
    next.fn();
  }
  if (waiting.size > 0) schedule();
}

function schedule() {
  if (pumping || !canDefer()) return;
  pumping = true;
  window.requestAnimationFrame(pump);
}

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());
const rushing = () => now() < rushUntil;

/** 밀린 묶음을 한꺼번에 들여보낸다. 사람이 스크롤을 시작하면 부른다. */
function rush() {
  if (now() < deafUntil) return;
  rushUntil = now() + RUSH_MS;
  for (const one of [...waiting].sort((a, b) => a.seat - b.seat)) {
    admitted = Math.max(admitted, one.seat + 1);
    waiting.delete(one);
    one.fn();
  }
}

/**
 * 화면을 옮길 때 부른다. 몰아넣기를 끄고, 이어서 스스로 올리는 스크롤은
 * 사람이 낸 것으로 치지 않는다. 새 화면은 다시 한 프레임에 하나씩 그린다.
 */
export function calmDown() {
  rushUntil = 0;
  deafUntil = now() + DEAF_MS;
}

let listening = false;
function listenForScroll() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  // 화면을 옮길 때마다 다시 밀리므로 한 번 듣고 마는 것이 아니라 계속 듣는다.
  // 밀린 것이 없으면 rush 는 아무 일도 하지 않는다.
  for (const kind of ["wheel", "touchmove", "keydown", "scroll"]) {
    window.addEventListener(kind, rush, { passive: true });
  }
}

/** 묶음 하나가 자리를 받는다. 화면을 그리는 중에 부른다. */
export function takeSeat() {
  if (!canDefer()) return -1;
  const mine = seq;
  seq += 1;
  return mine;
}

export const isAdmitted = (mine) => mine < 0 || mine < admitted || rushing();

/**
 * 아직 차례가 안 된 묶음이 자기 차례를 기다린다.
 *
 * 기다리겠다는 등록은 화면을 그린 뒤에 들어온다. 그래서 차례 돌리기는 자리를
 * 받을 때가 아니라 여기서 시작한다. 자리를 받을 때만 걸어 두면 등록이 들어오기
 * 전에 차례 돌리기가 끝나 버려, 남은 묶음이 영영 안 들어온다.
 */
export function onAdmit(mine, fn) {
  if (mine < 0) {
    fn();
    return () => {};
  }
  listenForScroll();
  if (rushing()) {
    admitted = Math.max(admitted, mine + 1);
    fn();
    return () => {};
  }
  const one = { seat: mine, fn };
  waiting.add(one);
  schedule();
  return () => { waiting.delete(one); };
}

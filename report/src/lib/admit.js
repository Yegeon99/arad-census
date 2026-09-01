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

let seq = 0;        // 지금까지 자리를 받은 묶음 수
let admitted = 0;   // 이 번호 앞까지는 그려도 된다
let pumping = false;
const waiting = new Set(); // { seat, fn }

const canDefer = () =>
  typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";

function pump() {
  pumping = false;
  // 차례가 가장 이른 것 하나만 들여보낸다. 밀린 것이 여럿이어도 한꺼번에
  // 풀지 않는다. 한꺼번에 풀면 배치가 다시 한 덩어리가 된다.
  let next = null;
  for (const one of waiting) {
    if (next === null || one.seat < next.seat) next = one;
  }
  if (next !== null) {
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

/** 묶음 하나가 자리를 받는다. 화면을 그리는 중에 부른다. */
export function takeSeat() {
  if (!canDefer()) return -1;
  const mine = seq;
  seq += 1;
  return mine;
}

export const isAdmitted = (mine) => mine < 0 || mine < admitted;

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
  const one = { seat: mine, fn };
  waiting.add(one);
  schedule();
  return () => { waiting.delete(one); };
}

import { Suspense, lazy, useEffect } from "react";
import { MotionConfig } from "motion/react";
import { TopNav, BottomNav } from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import Overview from "./pages/Overview.jsx";
import { useHashRoute } from "./lib/hooks.js";

/**
 * 첫 화면만 처음부터 들고 있고 나머지 여섯 화면은 따로 받는다.
 * 일곱 화면을 한 덩어리로 묶으면 진입할 때 그 전부를 읽어 들이느라
 * 화면이 한동안 손에 안 잡힌다. 대신 화면이 뜬 뒤 한가할 때 미리 받아 두어
 * 화면을 옮길 때는 기다리지 않게 한다.
 */
const LAZY = {
  jobs: lazy(() => import("./pages/Jobs.jsx")),
  growth: lazy(() => import("./pages/Growth.jsx")),
  activity: lazy(() => import("./pages/Activity.jsx")),
  gap: lazy(() => import("./pages/Gap.jsx")),
  insights: lazy(() => import("./pages/Insights.jsx")),
  method: lazy(() => import("./pages/Method.jsx")),
};

const PRELOAD = [
  () => import("./pages/Jobs.jsx"),
  () => import("./pages/Growth.jsx"),
  () => import("./pages/Activity.jsx"),
  () => import("./pages/Gap.jsx"),
  () => import("./pages/Insights.jsx"),
  () => import("./pages/Method.jsx"),
];

/** 기다리는 동안 자리를 지킨다. 높이를 미리 잡아 두어 화면이 튀지 않는다. */
function Waiting() {
  return <div aria-hidden="true" style={{ minHeight: "70vh" }} />;
}

function usePreloadRest() {
  useEffect(() => {
    let stop = false;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    // 한 번에 다 받지 않고 하나씩 받는다. 한꺼번에 받으면 그것대로 화면이 걸린다.
    let i = 0;
    const next = () => {
      if (stop || i >= PRELOAD.length) return;
      PRELOAD[i]().finally(() => { i += 1; handle = idle(next); });
    };
    let handle = idle(next);
    return () => { stop = true; cancel(handle); };
  }, []);
}

export default function App() {
  const page = useHashRoute();
  const View = page === "overview" ? Overview : LAZY[page] ?? Overview;
  usePreloadRest();

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <TopNav page={page} />
        <main key={page} className="flex-1">
          <Suspense fallback={<Waiting />}>
            <View />
          </Suspense>
        </main>
        <Footer />
        <BottomNav page={page} />
      </div>
    </MotionConfig>
  );
}

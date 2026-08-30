import { MotionConfig } from "motion/react";
import { TopNav, BottomNav } from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import Overview from "./pages/Overview.jsx";
import Jobs from "./pages/Jobs.jsx";
import Growth from "./pages/Growth.jsx";
import Activity from "./pages/Activity.jsx";
import Gap from "./pages/Gap.jsx";
import Insights from "./pages/Insights.jsx";
import Method from "./pages/Method.jsx";
import { useHashRoute } from "./lib/hooks.js";

const VIEWS = {
  overview: Overview,
  jobs: Jobs,
  growth: Growth,
  activity: Activity,
  gap: Gap,
  insights: Insights,
  method: Method,
};

export default function App() {
  const page = useHashRoute();
  const View = VIEWS[page] ?? Overview;
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <TopNav page={page} />
        <main key={page} className="flex-1">
          <View />
        </main>
        <Footer />
        <BottomNav page={page} />
      </div>
    </MotionConfig>
  );
}

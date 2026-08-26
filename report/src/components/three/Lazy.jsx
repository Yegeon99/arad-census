import { Component, lazy, Suspense } from "react";

const Pyramid3D = lazy(() => import("./SamplePyramid3D.jsx"));
const Terrain3D = lazy(() => import("./JobTerrain3D.jsx"));

function Loading({ height }) {
  return (
    <div className="flex items-center justify-center" style={{ height, background: "var(--bg-sunken)" }}>
      <p className="t-small m-0">입체 화면을 불러오는 중입니다.</p>
    </div>
  );
}

/** 입체 화면이 어떤 이유로든 뜨지 않으면 평면 화면으로 되돌린다. */
class Fallback extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function wrap(Node, height) {
  return function Wrapped({ fallback, placeholder, ...props }) {
    return (
      <Fallback fallback={fallback}>
        <Suspense fallback={placeholder ?? <Loading height={height} />}>
          <Node {...props} placeholder={placeholder} />
        </Suspense>
      </Fallback>
    );
  };
}

export const LazySamplePyramid = wrap(Pyramid3D, 420);
export const LazyJobTerrain = wrap(Terrain3D, 440);

"use client";

// 把折射层挂上去的 Hook。
//
// 为什么要等 ready：位移图是按**元素的实际尺寸**算的，
// 面板还没渲染出来的时候量不到尺寸，也就没法生成正确的图。
//
// 失败不影响可用性：CSS 里 .glass-warp 本身带一层模糊，
// 折射只是"增强"，挂不上就是普通磨砂玻璃，内容照样清楚。
import { useEffect, useLayoutEffect, useState } from "react";
import { setupGlassRefraction, REFRACTION_MIN_WIDTH } from "./glassRefraction.js";

/** 窗口够宽、且用户没开"减少动态效果"时才开折射（见 glassRefraction.js 里的性能实测） */
function useRefractionEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${REFRACTION_MIN_WIDTH}px)`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(query.matches && !reduced.matches);
    update();
    query.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  return enabled;
}

export function useGlassRefraction(rootRef, svgRef, ready) {
  const enabled = useRefractionEnabled();

  useLayoutEffect(() => {
    if (!ready || !enabled) return;
    try {
      return setupGlassRefraction(rootRef.current, svgRef.current);
    } catch (error) {
      console.error("[glass] 折射层初始化失败，退回普通磨砂玻璃", error);
      return;
    }
  }, [rootRef, svgRef, ready, enabled]);
}

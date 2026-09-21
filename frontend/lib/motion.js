// 动画相关的公共判断。
//
// 系统里开了"减少动态效果"（前庭功能障碍等用户会开）时，我们就不再跑入场动画。
// 这不是可选项：动画会让人不适，尊重这个设置是基本的无障碍要求。

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

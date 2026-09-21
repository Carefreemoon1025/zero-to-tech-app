"use client";

// 滚动浮现：页面往下滚，面板一个个浮现。
//
// 用 anime.js 4 自带的 onScroll（ScrollObserver）当触发器，不引第三方滚动动画库。
// 触发点用默认的 "end start"：元素顶边碰到视口底边，也就是"刚露头"就开始动。
// repeat: false —— 只播一次，播完观察器自己卸载，来回滚不会反复抖。
//
// ⚠️ 这里必须守住一条底线（M5 踩过的坑）：
// **不能给内容设默认透明然后指望 JS 把它显出来**。要是脚本没跑到或者中途抛错，
// 页面就是一片空白。所以：
//   1. 隐藏用的 class 是在 useLayoutEffect 里、浏览器绘制之前加的 —— 不会先闪一下；
//   2. 观察器建立与隐藏写在同一个 try 里，一旦出错立刻把 class 摘掉，内容照样看得见；
//   3. 用户开了"减少动态效果"就完全不进场，直接显示。
import { useLayoutEffect } from "react";
import { animate, onScroll } from "animejs";
import { prefersReducedMotion } from "./motion.js";

const ARMED_CLASS = "reveal-armed";

export function useScrollReveal(rootRef, ready) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;
    if (prefersReducedMotion()) return;

    const targets = [...root.querySelectorAll("[data-reveal]")];
    if (targets.length === 0) return;

    // 同一排的卡片错开一点时间，看起来才是"一个个浮现"而不是"整排闪现"
    const columns = countGridColumns(root.querySelector(".stack-grid"));
    let observers = [];

    try {
      root.classList.add(ARMED_CLASS);
      observers = targets.map((element, index) =>
        onScroll({
          target: element,
          enter: "end start",
          repeat: false,
          onEnter: () => {
            // 只动 transform，**不加 opacity**：父元素一旦 opacity<1 就成了 backdrop root，
            // 面板里的光学层会瞬间采不到页面背景，动画结束时会"啪"地跳一下。
            // 只用位移+缩放，面板是"落位"进来的，视觉一样，但没有这个副作用。
            animate(element, {
              translateY: [44, 0],
              scale: [0.97, 1],
              duration: 780,
              delay: (index % columns) * 90,
              ease: "out(3)",
            });
          },
        }),
      );
    } catch (error) {
      // 兜底：动画没建立起来也不能让内容消失
      console.error("[showcase] 滚动浮现初始化失败，已降级为直接显示", error);
      root.classList.remove(ARMED_CLASS);
      return;
    }

    return () => {
      observers.forEach((observer) => observer.revert());
      root.classList.remove(ARMED_CLASS);
    };
  }, [rootRef, ready]);
}

/** 当前是几列布局（窄屏会变成 1~2 列，错开延迟要跟着变） */
function countGridColumns(grid) {
  if (!grid) return 1;
  const template = getComputedStyle(grid).gridTemplateColumns;
  return Math.max(1, template.split(" ").filter((part) => part && part !== "none").length);
}

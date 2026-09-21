"use client";

// 用法：<AnimatedCardGrid className="dashboard-grid">… hero + 几张卡片 …</AnimatedCardGrid>
// 负责"卡片依次飞入"这一份动画。
//
// 这里没有用"挂载时查一次 .card 就交给 anime.js"的写法，因为接了后端之后它会出事：主页的卡片是**数据到位后**才渲染出来的，
// 挂载那一刻它们还不存在，于是永远留在 CSS 的 opacity: 0 上——内容在页面上是隐形的
// （实测：主页两张卡 computed opacity = 0，文字抓得到、眼睛看不见）。
// 所以改成用 MutationObserver 盯着容器：谁后进来，就给谁补一次入场动画。
import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { prefersReducedMotion } from "../lib/motion.js";

// 打过标记的卡片不再重复动画（React 重渲染时不会又飞一次）
const ANIMATED_FLAG = "data-card-animated";

export default function AnimatedCardGrid({ className, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    function animateNewCards() {
      const cards = [...root.querySelectorAll(`.card:not([${ANIMATED_FLAG}])`)];
      if (cards.length === 0) return;
      cards.forEach((card) => card.setAttribute(ANIMATED_FLAG, "true"));

      if (prefersReducedMotion()) {
        // 尊重"减少动态效果"：不飞入，直接显形
        cards.forEach((card) => {
          card.style.opacity = "1";
          card.style.transform = "none";
        });
        return;
      }

      animate(cards, {
        opacity: [0, 1],
        translateY: [24, 0],
        delay: stagger(120), // 每张卡错开 120ms
        duration: 700,
        ease: "outBack", // 弹性落地
      });
    }

    animateNewCards();
    const observer = new MutationObserver(animateNewCards);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}

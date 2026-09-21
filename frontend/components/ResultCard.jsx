"use client";

// 结果卡：原文 / 拼音 / 情感分数 / 情感判断。
//
// 有两处是踩过坑之后**特意改掉**的写法，注释留在这儿免得以后又改回去：
//
// 1) 没有结果时不再显示假数据（0.86 / 偏积极）。
//    面试官点开页面看到的每一条信息都应该是真的：没分析过就老实说"还没有结果"。
//
// 2) 分数滚动改成"用 anime.js 动画一个 JS 数值 → 交给 React 渲染"。
//    更常见的写法是 `animate(scoreRef.current, { innerHTML: scrambleText(...) })`：
//    让 anime.js 直接改 DOM 的 innerHTML，这跟 React 抢同一块 DOM——
//    React 以为自己渲染了 0.74，实际节点早被 anime.js 换掉，页面上就停在挂载时那个
//    占位数字上再也刷不动（实测：分析完显示的还是初始的 0.86）。
//    现在 React 独占 DOM，anime.js 只负责算中间值；两边不打架，换新结果还会重新滚。
import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "../lib/motion.js";

const SCORE_ANIMATION_MS = 900;

export default function ResultCard({ result, onOpenHistory }) {
  const cardRef = useRef(null);
  const [displayScore, setDisplayScore] = useState(null);

  // 卡片飞入：只在挂载时跑一次
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const controls = animate(cardRef.current, {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
      ease: "outBack",
    });
    return () => controls?.pause?.();
  }, []);

  // 分数滚动：每来一个新结果就重新滚一次
  useEffect(() => {
    if (!result) {
      setDisplayScore(null);
      return;
    }
    if (prefersReducedMotion()) {
      setDisplayScore(result.score);
      return;
    }
    // 动画的是一个普通 JS 对象（不是 DOM）——中间值通过 onUpdate 回到 React state
    const counter = { value: 0 };
    const controls = animate(counter, {
      value: result.score,
      duration: SCORE_ANIMATION_MS,
      ease: "outExpo",
      onUpdate: () => setDisplayScore(counter.value),
    });
    return () => controls?.pause?.();
  }, [result]);

  const score = displayScore ?? result?.score ?? null;

  return (
    <article ref={cardRef} className="panel panel-half lab-panel result-panel card">
      <div className="panel-heading panel-heading-row">
        <div>
          <p className="section-kicker">结果区</p>
          <h3>分析结果</h3>
        </div>
        <button type="button" className="ghost-button" onClick={onOpenHistory}>
          历史记录
        </button>
      </div>

      {!result ? (
        <p className="result-empty">还没有结果，贴一段中文点「开始分析」试试。</p>
      ) : (
        // aria-live：分析结果对屏幕阅读器来说是"新出现的内容"，得主动播报
        <div className="result-stack" aria-live="polite">
          <div className="result-item">
            <span>原文</span>
            <p>{result.text}</p>
          </div>
          <div className="result-item">
            <span>拼音</span>
            <p>{result.pinyin}</p>
          </div>
          <div className="result-grid">
            <div className="result-badge">
              <span>情感分数</span>
              <strong>{score === null ? "—" : score.toFixed(2)}</strong>
            </div>
            <div className="result-badge">
              <span>情感判断</span>
              <strong>{result.label}</strong>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

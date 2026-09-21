"use client";

// 结果卡：原文 / 拼音 / 情感分数 / 情感判断。
//
// 两种形态：
//   一行 → 大卡片，分数滚动归位；
//   多行 → 逐行列表 + 一行小结（平均分、正向/中性/负向各几条）。
// 逐行模式不做数字滚动——一排数字同时滚会看不清，列表本身就是内容。
//
// 还有两处是踩过坑之后**特意改掉**的写法，注释留在这儿免得以后又改回去：
//
// 1) 没有结果时不再显示假数据（0.86 / 偏积极）。
//    面试官点开页面看到的每一条信息都应该是真的：没分析过就老实说"还没有结果"。
//
// 2) 分数滚动用「anime.js 动画一个 JS 数值 → onUpdate 回 React state」，
//    而不是让 anime.js 直接改 DOM 的 innerHTML。后者跟 React 抢同一块 DOM：
//    React 以为自己渲染了 0.74，实际节点早被换掉，页面就停在挂载时的占位数字上。
import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "../lib/motion.js";

const SCORE_ANIMATION_MS = 900;

/** 复制到剪贴板，返回是否成功 */
async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // 落到下面的兜底
  }
  // 兜底：站点部署在裸 IP 的 HTTP 上，不是安全上下文，浏览器不提供 clipboard API；
  // 用临时 textarea + execCommand 顶一下（已废弃但仍然是这类场景的通用做法）。
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 存成 .txt 下载（HTTP 下也能用，不依赖剪贴板权限） */
function downloadText(value, filename) {
  const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ResultCard({ results, onOpenHistory }) {
  const cardRef = useRef(null);
  const [displayScore, setDisplayScore] = useState(null);
  const [copied, setCopied] = useState("");

  const list = results ?? [];
  const single = list.length === 1 ? list[0] : null;
  const batch = list.length > 1;

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

  // 分数滚动：只在一行结果的形态下跑，每来一个新结果重新滚一次
  useEffect(() => {
    if (!single) {
      setDisplayScore(null);
      return;
    }
    if (prefersReducedMotion()) {
      setDisplayScore(single.score);
      return;
    }
    const counter = { value: 0 };
    const controls = animate(counter, {
      value: single.score,
      duration: SCORE_ANIMATION_MS,
      ease: "outExpo",
      onUpdate: () => setDisplayScore(counter.value),
    });
    return () => controls?.pause?.();
  }, [single]);

  // 复制成功后按钮上短暂显示"已复制"
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(""), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const score = displayScore ?? single?.score ?? null;

  // 逐行模式的小结：平均分 + 三种判断各几条
  const summary = batch
    ? (() => {
        const average = list.reduce((sum, item) => sum + item.score, 0) / list.length;
        const count = (label) => list.filter((item) => item.label === label).length;
        return {
          average: average.toFixed(2),
          positive: count("偏积极"),
          neutral: count("中性"),
          negative: count("偏消极"),
        };
      })()
    : null;

  const pinyinText = list.map((item) => item.pinyin).join("\n");

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

      {list.length === 0 ? (
        <p className="result-empty">还没有结果，贴一段中文点「开始分析」试试。</p>
      ) : (
        // aria-live：分析结果对屏幕阅读器来说是"新出现的内容"，得主动播报
        <div className="result-stack" aria-live="polite">
          {batch ? (
            <>
              <p className="result-summary">
                共 {list.length} 行 · 平均 {summary.average} · 偏积极 {summary.positive} · 中性{" "}
                {summary.neutral} · 偏消极 {summary.negative}
              </p>
              <ul className="result-list">
                {list.map((item, index) => (
                  <li className="result-row" key={`${item.text}-${index}`}>
                    <p className="result-row-text">{item.text}</p>
                    <p className="result-row-pinyin">{item.pinyin}</p>
                    <p className="result-row-meta">
                      <strong>{item.score.toFixed(2)}</strong>
                      <span>{item.label}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="result-item">
                <span>原文</span>
                <p>{single.text}</p>
              </div>
              <div className="result-item">
                <span>拼音</span>
                <p>{single.pinyin}</p>
              </div>
              <div className="result-grid">
                <div className="result-badge">
                  <span>情感分数</span>
                  <strong>{score === null ? "—" : score.toFixed(2)}</strong>
                </div>
                <div className="result-badge">
                  <span>情感判断</span>
                  <strong>{single.label}</strong>
                </div>
              </div>
            </>
          )}

          {/* 拼音是这一页最实用的产物：复制走，或者存成 txt */}
          <div className="result-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={async () => {
                const ok = await copyText(pinyinText);
                setCopied(ok ? "已复制" : "复制失败");
              }}
            >
              {copied || "复制拼音"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => downloadText(pinyinText, "pinyin.txt")}
            >
              下载 .txt
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

"use client";

// 文字实验室的"输入区"卡片。
//
// 支持两种用法：
//   单段 —— 默认，贴一段中文点"开始分析"；
//   逐行 —— 文本里有多行时，按行分别分析（每行一次请求）。
//          逐行不是"顺手加的"：情绪判断本来就是按句子给的，
//          一整段混在一起打分，正负会互相抵消成一个没意义的中性。
//
// 状态有四样都要照看到：提交中（按钮禁用+进度）、失败（role=alert）、
// 超长（和后端上限对齐，当场拦下）、空输入。
import { useState } from "react";
import { apiFetch } from "../lib/api.js";

// 和后端 backend/main.py 的 MAX_TEXT_LENGTH 保持一致
const MAX_TEXT_LENGTH = 500;

export default function InputCard({ onResults }) {
  const [text, setText] = useState("今天的风很轻，适合把脑海里的想法慢慢写下来。");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // 逐行模式：按行拆开，去掉空行
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const isBatch = lines.length > 1;
  const tooLong = lines.some((line) => line.length > MAX_TEXT_LENGTH);
  const empty = lines.length === 0;
  const canSubmit = !empty && !tooLong && !analyzing;

  async function analyzeOne(line) {
    const res = await apiFetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line }),
    });
    if (!res.ok) {
      // 后端的错误格式固定是 {"detail": "..."}（见 backend/main.py）
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `分析失败：HTTP ${res.status}`);
    }
    return res.json();
  }

  async function handleAnalyze() {
    if (!canSubmit) return;
    setError("");
    setAnalyzing(true);
    setProgress({ done: 0, total: lines.length });

    try {
      const collected = [];
      // 逐行串行发：顺序稳定、进度可信，也避免一次几十个请求把后端打满
      for (const [index, line] of lines.entries()) {
        collected.push(await analyzeOne(line));
        setProgress({ done: index + 1, total: lines.length });
      }
      onResults(collected);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "连不上后端服务，请确认 API 已启动。"
          : err.message,
      );
    } finally {
      setAnalyzing(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  return (
    <article className="panel panel-half lab-panel card">
      <div className="panel-heading">
        <p className="section-kicker">输入区</p>
        <h3>贴一段中文</h3>
      </div>
      <form className="lab-form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="text-input">文本内容</label>
        <textarea
          id="text-input"
          rows="8"
          maxLength={MAX_TEXT_LENGTH * 2} /* 宽一点，让人能真的看到"超了"而不是打不进去 */
          placeholder={"例如：生活没有标准答案，但每一天都值得认真感受。\n想逐句看情绪？一行一句，会按行分别分析。"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="text-count"
          aria-invalid={tooLong}
        />
        {/* state 现身：text 一变，这行数字自动跟着变 */}
        <p
          id="text-count"
          className={tooLong ? "lab-count lab-count-over" : "lab-count"}
        >
          {isBatch
            ? `${lines.length} 行 · 共 ${text.replace(/\s/g, "").length} 字`
            : `已输入 ${lines[0]?.length ?? 0} 字`}
          {tooLong && `（每行最多 ${MAX_TEXT_LENGTH} 字）`}
        </p>
        {error && (
          <p className="lab-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          type="button"
          onClick={handleAnalyze}
          disabled={!canSubmit}
          aria-busy={analyzing}
        >
          {analyzing
            ? progress.total > 1
              ? `分析中 ${progress.done}/${progress.total}`
              : "分析中…"
            : isBatch
              ? `逐行分析（${lines.length} 行）`
              : "开始分析"}
        </button>
      </form>
    </article>
  );
}

"use client";

// 文字实验室的"输入区"卡片：
// 点"开始分析"就把输入的文字 POST 给 /api/analyze，拿到结果通过 onResult 交给父组件。
//
// 这一版补齐了三种容易被忽略的状态：
//   - 提交中：按钮禁用 + 文案变"分析中…"，防止连点发出多个请求；
//   - 失败：用 role="alert" 报出来（屏幕阅读器也会念），文案取后端返回的 detail；
//   - 超长：字数上限和后端 MAX_TEXT_LENGTH 对齐，超了当场拦下，不用等一次网络往返。
// 后端地址不写死在这里，统一走 lib/api.js（读 NEXT_PUBLIC_API_BASE_URL）。
import { useState } from "react";
import { apiFetch } from "../lib/api.js";

// 和后端 backend/main.py 的 MAX_TEXT_LENGTH 保持一致
const MAX_TEXT_LENGTH = 500;

export default function InputCard({ onResult }) {
  const [text, setText] = useState("今天的风很轻，适合把脑海里的想法慢慢写下来。");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const tooLong = text.length > MAX_TEXT_LENGTH;
  const canSubmit = text.trim().length > 0 && !tooLong && !analyzing;

  async function handleAnalyze() {
    if (!canSubmit) return;
    setError("");
    setAnalyzing(true);

    try {
      const res = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        // 后端的错误格式固定是 {"detail": "..."}（见 backend/main.py）
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `分析失败：HTTP ${res.status}`);
      }

      onResult(await res.json());
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "连不上后端服务，请确认 API 已启动。"
          : err.message,
      );
    } finally {
      setAnalyzing(false);
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
          placeholder="例如：生活没有标准答案，但每一天都值得认真感受。"
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
          已输入 {text.length} 字{tooLong && `（最多 ${MAX_TEXT_LENGTH} 字）`}
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
          {analyzing ? "分析中…" : "开始分析"}
        </button>
      </form>
    </article>
  );
}

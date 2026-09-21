"use client";

// 文字实验室页：输入区 + 结果区 + 历史弹窗，三块各管各的。
//
// 历史记录放在弹窗里（而不是再加一张卡），点结果卡右上角的按钮才打开——
// 也是打开的那一刻才去请求 /api/history，没必要每次进页面都拉一遍。
//
// 这里还负责一件事：把"历史记录"这份远程数据的四种状态（未加载/加载中/成功/失败）
// 明确管起来，交给 HistoryModal 去画。弹窗拿到的是状态，不是一堆 if。
import { useState } from "react";
import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import InputCard from "./InputCard.jsx";
import ResultCard from "./ResultCard.jsx";
import HistoryModal from "./HistoryModal.jsx";
import PageBackdrop from "./PageBackdrop.jsx";
import { textLab } from "../data/site.js";
import { apiFetch } from "../lib/api.js";

export default function TextLabView() {
  const [result, setResult] = useState(null); // 最近一次分析结果
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("idle"); // idle | loading | ready | error
  const [historyError, setHistoryError] = useState("");

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryStatus("loading");
    setHistoryError("");
    try {
      // 带 cookie 请求：后端按 cookie 里的会话 id 只返回"我的"历史
      const res = await apiFetch("/api/history");
      if (!res.ok) {
        throw new Error(`历史记录加载失败（HTTP ${res.status}）`);
      }
      setHistory(await res.json());
      setHistoryStatus("ready");
    } catch (err) {
      // 这里不再"假装没有记录"：出错就说出错，否则用户以为数据丢了
      setHistoryError(
        err instanceof TypeError
          ? "连不上后端服务，请确认 API 已启动。"
          : err.message,
      );
      setHistoryStatus("error");
    }
  }

  return (
    <>
      {/* 和首页共用同一份背景，两个页面才像同一个网站 */}
      <PageBackdrop />

      <AnimatedCardGrid className="dashboard-grid">
        <article className="hero-stage panel-full">
          <Nav />
          <PageHeading title={textLab.heroTitle} subtitle={textLab.heroSubtitle} />
        </article>

        <InputCard onResult={setResult} />
        <ResultCard result={result} onOpenHistory={openHistory} />

        <HistoryModal
          open={historyOpen}
          status={historyStatus}
          items={history}
          error={historyError}
          onRetry={openHistory}
          onClose={() => setHistoryOpen(false)}
        />
      </AnimatedCardGrid>
    </>
  );
}

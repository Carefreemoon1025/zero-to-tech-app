"use client";

// 首页：液态玻璃作品展示页。
//
// 数据来源分两路，是有意的取舍：
//   · 首屏文案（标题、副标题、下滑提示）放在 data/site.js —— 静态直出，
//     打开页面第一眼就是完整的，不会先闪一下"加载中"；
//   · 技术栈面板与作品数据来自后端 —— 它们是"内容"，改一句不用重新构建前端，
//     顺便让首页第一屏就证明"这个站的数据是活的"。
//
// 三件事在这里汇合：浅蓝光斑背景（折射要有底片）、液态玻璃面板（CSS + SVG 滤镜）、
// 滚动逐个浮现（anime.js 的 onScroll，见 lib/useScrollReveal.js）。
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate } from "animejs";
import PageBackdrop from "./PageBackdrop.jsx";
import { showcase } from "../data/site.js";
import { apiFetch } from "../lib/api.js";
import { useScrollReveal } from "../lib/useScrollReveal.js";
import { prefersReducedMotion } from "../lib/motion.js";

export default function ShowcaseView() {
  const rootRef = useRef(null);
  const hintRef = useRef(null);
  const [stack, setStack] = useState([]);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      // 两个接口并行拿：技术栈面板 + 作品与个人信息
      const [stackRes, profileRes] = await Promise.all([
        apiFetch("/api/stack"),
        apiFetch("/api/profile"),
      ]);
      if (!stackRes.ok) throw new Error(`技术栈加载失败（HTTP ${stackRes.status}）`);
      if (!profileRes.ok) throw new Error(`作品数据加载失败（HTTP ${profileRes.status}）`);
      setStack(await stackRes.json());
      setProfile(await profileRes.json());
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "连不上后端服务，请确认 API 已启动。"
          : err.message,
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 面板与作品卡都就位之后，才去建立滚动浮现（否则观察不到还不存在的元素）
  useScrollReveal(rootRef, status === "ready");

  // 一开始提示"下滑"，用户真的开始滚了就把它淡掉——提示的使命结束了
  useEffect(() => {
    const hint = hintRef.current;
    if (!hint || prefersReducedMotion()) return;

    function onFirstScroll() {
      if (window.scrollY < 60) return;
      window.removeEventListener("scroll", onFirstScroll);
      animate(hint, { opacity: [1, 0], translateY: [0, 12], duration: 420, ease: "out(2)" });
    }

    window.addEventListener("scroll", onFirstScroll, { passive: true });
    return () => window.removeEventListener("scroll", onFirstScroll);
  }, []);

  const work = profile?.featuredWork ?? showcase.workFallback;

  return (
    <div className="showcase" ref={rootRef}>

      <PageBackdrop />

      <div className="showcase-content">
        <header className="showcase-hero glass">
          <p className="showcase-eyebrow">{showcase.eyebrow}</p>
          <h1 className="showcase-title">{showcase.title}</h1>
          <p className="showcase-sub">{showcase.subtitle}</p>
          <a className="scroll-hint" href="#stack" ref={hintRef}>
            {showcase.scrollHint}
            <span className="scroll-hint-arrow" aria-hidden="true">
              ↓
            </span>
          </a>
        </header>

        <section className="showcase-section" id="stack">
          <div className="showcase-section-head">
            <h2 className="showcase-section-title">技术栈</h2>
            <p className="showcase-section-lead">{showcase.stackLead}</p>
          </div>

          {status === "loading" && (
            <>
              <p className="showcase-status" role="status">
                正在从后端加载技术栈…
              </p>
              {/* 骨架和真卡片同尺寸，数据到位时页面不会跳 */}
              <div className="stack-grid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="stack-card glass stack-card--skeleton" key={index} />
                ))}
              </div>
            </>
          )}

          {status === "error" && (
            <div className="glass" role="alert">
              <p className="showcase-status showcase-status-error">{error}</p>
              <div className="showcase-status">
                <button type="button" className="status-retry" onClick={load}>
                  重试
                </button>
              </div>
            </div>
          )}

          {status === "ready" && (
            <div className="stack-grid">
              {stack.map((item) => (
                <article
                  className="stack-card glass"
                  key={item.key}
                  data-reveal
                  style={{ "--accent": item.accent }}
                >
                  <div className="stack-card-head">
                    <span className="stack-badge">{item.badge}</span>
                    <h3 className="stack-name">{item.name}</h3>
                  </div>
                  <p className="stack-tag">{item.tag}</p>
                  <p className="stack-blurb">{item.blurb}</p>
                  <ul className="stack-chips">
                    {item.chips.map((chip) => (
                      <li key={chip}>{chip}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 作品入口：文案优先用后端的，拿不到就用本地兜底——
            这张卡是导航，不能因为接口慢/挂了就消失 */}
        <section className="showcase-section">
          <div className="showcase-section-head">
            <h2 className="showcase-section-title">作品</h2>
            <p className="showcase-section-lead">{showcase.workLead}</p>
          </div>
          <Link className="work-card glass" href="/text-lab" data-reveal>
            <span className="work-text">
              <span className="work-kicker">{work.kicker}</span>
              <span className="work-title">{work.title}</span>
              <span className="work-copy">{work.copy}</span>
              <span className="work-link">{work.linkLabel}</span>
            </span>
            <span className="work-go" aria-hidden="true">
              →
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}

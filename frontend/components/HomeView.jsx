"use client";

// 个人主页：页面文案**只从后端来**（GET /api/profile）。
//
// 这里刻意没有再拿 site.js 的 home 打底。打底数据看着"稳"，实际是个陷阱：
// 后端挂了、接口改了字段、CORS 没配通，页面照样显示得好好的，
// 问题被静默吞掉，等到面试现场演示才发现"其实一直没连上后端"。
// 现在三种状态是分明的：
//   加载中 → 显示加载态；成功 → 显示后端数据；失败 → 显示错误 + 重试按钮。
// 因为要在浏览器里发请求、用 state，所以顶上写了 "use client"。
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import { apiFetch } from "../lib/api.js";

export default function HomeView() {
  const [data, setData] = useState(null); // 后端返回的主页数据
  const [error, setError] = useState(""); // 错误文案，非空即进入错误态
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/profile");
      if (!res.ok) {
        throw new Error(`主页数据加载失败（HTTP ${res.status}）`);
      }
      setData(await res.json());
    } catch (err) {
      // 网络层错误（后端没起、跨源被拦）也会走到这里
      setError(
        err instanceof TypeError
          ? "连不上后端服务，请确认 API 已启动。"
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <AnimatedCardGrid className="dashboard-grid">
      <article className="hero-stage panel-full">
        <Nav />
        {data ? (
          <PageHeading title={data.heroTitle} subtitle={data.heroSubtitle} />
        ) : (
          // 标题还没拿到时先占住位置，避免内容进来时页面整体跳动
          <div className="hero-placeholder" aria-hidden="true" />
        )}
      </article>

      {loading && (
        <article className="panel panel-full card" role="status" aria-live="polite">
          <p className="panel-status">正在从后端加载主页数据…</p>
        </article>
      )}

      {!loading && error && (
        <article className="panel panel-full card" role="alert">
          <p className="panel-status panel-status-error">{error}</p>
          <button type="button" className="ghost-button" onClick={loadProfile}>
            重试
          </button>
        </article>
      )}

      {!loading && data && (
        <>
          <article className="panel panel-full featured-work-panel card">
            <p className="section-kicker">{data.featuredWork.kicker}</p>
            <p className="featured-title">{data.featuredWork.title}</p>
            <p className="featured-copy">{data.featuredWork.copy}</p>
            <Link className="featured-link" href="/text-lab">
              <span className="featured-link-label">{data.featuredWork.linkLabel}</span>
              <span className="arrow">›</span>
            </Link>
          </article>

          <article className="panel panel-full identity-panel card">
            <div className="identity-item">
              <p className="section-kicker">座右铭</p>
              <p className="identity-value identity-quote">{data.identity.motto}</p>
            </div>
            <div className="identity-item">
              <p className="section-kicker">正在学习</p>
              <p className="identity-value">{data.identity.learning}</p>
            </div>
          </article>
        </>
      )}
    </AnimatedCardGrid>
  );
}

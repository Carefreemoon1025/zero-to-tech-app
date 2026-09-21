"use client";

// 深浅色切换。
//
// 图标用内联 SVG 而不是 ☀/☾ 这两个字符：Noto Sans SC 里**没有** ☾ 这个码位，
// 靠系统字体兜底的后果是——在没有对应字体的机器上直接变豆腐块。
// 图标这种事不该赌字体覆盖率。（用字符的话还会把两个字都拖进字体子集里。）
//
// 两枚图标都渲染、由 CSS 按 <html data-theme> 显示其中一枚：
// 服务端渲染时不知道用户的主题，用 React state 控制会出现水合不一致（图标先闪一下）。
// 主题值优先取 localStorage（用户手动选过），没有就跟系统走；首屏那一下的判定
// 在 app/layout.jsx 的内联脚本里做，不能等到 React 水合，否则深色用户会先看到白屏。
const STORAGE_KEY = "theme";

export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隐私模式下 localStorage 可能不可用，忽略即可，本次切换仍然生效
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="切换深色 / 浅色模式"
      title="切换深色 / 浅色模式"
    >
      {/* 太阳：深色模式下显示，提示"点它变浅色" */}
      <svg
        className="theme-icon theme-icon--sun"
        viewBox="0 0 24 24"
        width="19"
        height="19"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4.1" />
        <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5" />
      </svg>
      {/* 月亮：浅色模式下显示 */}
      <svg
        className="theme-icon theme-icon--moon"
        viewBox="0 0 24 24"
        width="19"
        height="19"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      >
        <path d="M20.6 14.3A8.7 8.7 0 0 1 9.7 3.4a8.8 8.8 0 1 0 10.9 10.9Z" />
      </svg>
    </button>
  );
}

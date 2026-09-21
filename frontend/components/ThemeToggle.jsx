"use client";

// 深浅色切换。
//
// 图标不用 React state 控制，而是两枚都渲染、由 CSS 按 <html data-theme> 显示其中一个
// ——服务端渲染时不知道用户的主题，用 state 会出现水合不一致（图标先闪一下）。
//
// 主题值优先取 localStorage（用户手动选过），没有就跟系统走。
// 首屏那一下的判定在 app/layout.jsx 的内联脚本里做，不能等到 React 水合，否则会白闪。
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
      <span className="theme-icon theme-icon--sun" aria-hidden="true">
        ☀
      </span>
      <span className="theme-icon theme-icon--moon" aria-hidden="true">
        ☾
      </span>
    </button>
  );
}

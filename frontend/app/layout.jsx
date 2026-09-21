// app/layout.jsx 是 Next.js 的"全站外壳"——所有页面都套在它里面：
//   - <html>/<body> 由它提供，语言标成 zh-CN；
//   - app-shell / page-shell / page-content 这层包裹，是全站统一的宽度与留白；
//   - 所有 CSS 在这里统一引入（顺序有讲究：先 reset/variables，再布局与组件，
//     最后是页面级的 states.css / showcase.css，它们要能覆盖前面的规则）。
// 注意：导航条 Nav 不在这儿，它在每一页的 hero 里（ShowcaseView / TextLabView 各放一份），
// 因为两个页面的标题区排版不同，放在页面里更好调。

import localFont from "next/font/local";
import "../css/reset.css";
import "../css/variables.css";
import "../css/layout.css";
import "../css/hero.css";
import "../css/nav.css";
import "../css/cards.css";
import "../css/lab.css";
import "../css/responsive.css";
import "../css/states.css";
import "../css/showcase.css";

// 自托管中文可变字体（Noto Sans SC，按本站用到的字子集化，见 scripts/subset-fonts.py）。
// 为什么不用系统字体栈了事：字体栈里的 "PingFang SC" 只有 Mac 有，
// Windows 会退到微软雅黑——同一份作品在不同面试官电脑上长得不一样。
// 自托管一份，谁的屏幕上都一致；子集化之后只有 250KB，且不依赖任何 CDN。
// weight: "100 900" 表示这是可变字体，标题的 semibold 与正文的 regular 共用这一个文件。
const cjkFont = localFont({
  src: "./fonts/noto-sans-sc-var.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-cjk",
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"],
});

export const metadata = {
  title: "作品集",
  description: "个人作品集：技术栈展示与文字实验室（中文拼音转换与情感分析）。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={cjkFont.variable}>
      <body>
        <div className="app-shell">
          <div className="page-shell">
            <main className="page-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

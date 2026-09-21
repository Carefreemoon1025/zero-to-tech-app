// app/layout.jsx 是 Next.js 的"全站外壳"——所有页面都套在它里面：
//   - <html>/<body> 由它提供，语言标成 zh-CN；
//   - app-shell / page-shell / page-content 这层包裹，是全站统一的宽度与留白；
//   - 所有 CSS 在这里统一引入（顺序有讲究：先 reset/variables，再布局与组件）。
// 注意：导航条 Nav 不在这儿，它在每一页的 hero 里（HomeView / TextLabView 各放一份），
// 因为两台页面的标题区排版不同，放在页面里更好调。

import "../css/reset.css";
import "../css/variables.css";
import "../css/layout.css";
import "../css/hero.css";
import "../css/nav.css";
import "../css/cards.css";
import "../css/lab.css";
import "../css/responsive.css";
import "../css/states.css";

export const metadata = {
  title: "zero to tech · 个人主页与文字实验室",
  description: "个人主页 + 文字实验室：中文文本的拼音转换与情感分析。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
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

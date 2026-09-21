// app/page.jsx → 网站根路径 "/"
// 这个文件坐在 app/ 目录里，Next.js 就知道："访问 / 的时候，渲染我"。
// 不用注册、不用配路由表、不用写 if/else——这就是"文件夹 = 路由"。
import ShowcaseView from "../components/ShowcaseView.jsx";

// 每个页面自己的标题（会和 layout 里的 title 合并），浏览器标签页能区分两个页面
export const metadata = {
  title: "作品集",
  description: "作品展示页：玻璃面板 + 技术栈，数据来自后端接口。",
};

export default function Page() {
  return <ShowcaseView />;
}

// app/page.jsx → 网站根路径 "/"
// 这个文件坐在 app/ 目录里，Next.js 就知道："访问 / 的时候，渲染我"。
// 不用注册、不用配路由表、不用写 if/else——这就是"文件夹 = 路由"。
import HomeView from "../components/HomeView.jsx";

// 每个页面自己的标题（会和 layout 里的 title 合并），浏览器标签页能区分两个页面
export const metadata = {
  title: "关于我 · zero to tech",
  description: "个人主页：项目，创意，灵感，心得，我的作品。",
};

export default function Page() {
  return <HomeView />;
}

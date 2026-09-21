// app/text-lab/page.jsx → 网站路径 "/text-lab"
// 想加一个 /blog 页面？不用改任何"路由配置"——在 app/ 下新建一个
// blog/page.jsx 就行。"文件夹结构 = 网站结构"。
import TextLabView from "../../components/TextLabView.jsx";

export const metadata = {
  title: "文字实验室 · 作品集",
  description: "把一段中文交给后端，拿回带声调的拼音和情感判断，历史记录按会话隔离。",
};

export default function Page() {
  return <TextLabView />;
}

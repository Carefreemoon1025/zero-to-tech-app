# frontend

Next.js 15（App Router）+ React 19 前端，两个页面：个人主页 `/` 与文字实验室 `/text-lab`。

## 跑起来

```bash
npm install
cp .env.example .env.local   # 按需修改后端地址
npm run dev                  # http://localhost:3000
```

后端（`../backend`）需同时运行在 `:8000`，否则主页回退到 `data/site.js` 的打底文案、
分析按钮会提示连接失败。

## 目录

```
app/                    文件夹 = 路由
  layout.jsx            全站外壳（<html>/<body> + 统一引入 8 个 css）
  page.jsx              /         → <HomeView />
  text-lab/page.jsx     /text-lab → <TextLabView />
components/
  Nav.jsx                顶部导航（<Link> + usePathname 高亮当前页）
  HomeView.jsx           个人主页视图（GET /api/profile）
  TextLabView.jsx        文字实验室视图（组织输入区 / 结果区 / 历史弹窗）
  InputCard.jsx          输入区：POST /api/analyze
  ResultCard.jsx         结果区：拼音 + 情感分数（anime.js 数字滚动）
  HistoryModal.jsx       历史记录弹窗：GET /api/history
  AnimatedCardGrid.jsx   卡片飞入动画容器
  PageHeading.jsx        大标题 + 副标题
css/                     8 个样式文件（variables / layout / hero / nav / cards / lab / responsive / reset）
data/site.js             打底文案（后端不可用时的兜底）
lib/api.js               后端地址与 fetch 的唯一出口
```

## 环境变量

| 变量 | 本地开发 | 生产 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 留空（同源，nginx 反代 `/api`） |

改动环境变量后需要重启 `npm run dev`（`NEXT_PUBLIC_*` 在构建时内联进产物）。

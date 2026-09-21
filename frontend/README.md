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
  AnimatedCardGrid.jsx   卡片飞入动画容器（MutationObserver：数据到位后新增的卡片也会飞入）
  PageHeading.jsx        大标题 + 副标题
  HistoryModal.jsx       历史记录弹窗（焦点陷阱、Esc 关闭、加载/错误态）
css/                     9 个样式文件（variables / layout / hero / nav / cards / lab / responsive / reset / states）
data/site.js             页面固定文案（主页文案已归后端，见下）
lib/api.js               后端地址与 fetch 的唯一出口
lib/motion.js            "减少动态效果"判断（无障碍）
app/icon.svg             站点图标（Next.js 自动接管为 favicon）
```

## 环境变量

| 变量 | 开发 | 生产 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `.env.development` → `http://localhost:8000` | **不配**（留空 = 同源，nginx 反代 `/api`） |

开发配置写在 **`.env.development`**（已提交），不是 `.env.local`：Next.js 只在 `next dev`
时加载它，`next build` 读不到，生产构建因此天然是"同源"，不用担心把 `localhost:8000`
打进产物里。改动后需重启 `npm run dev`（`NEXT_PUBLIC_*` 在构建时内联进产物）。

主页文案（heroTitle / featuredWork / identity）现在唯一的出处是后端 `/api/profile`
（`backend/profile.py`），`data/site.js` 只留页面标题这类固定文案。

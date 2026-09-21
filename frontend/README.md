# frontend

Next.js 15（App Router）+ React 19 前端，两个页面：作品展示（液态玻璃首页）`/` 与文字实验室 `/text-lab`。

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
  ShowcaseView.jsx       首页：液态玻璃作品展示页
  PageBackdrop.jsx       全站共用背景（浅蓝渐变 + 光斑 + 淡纹理）
  PageHeading.jsx        大标题 + 副标题
  HistoryModal.jsx       历史记录弹窗（焦点陷阱、Esc 关闭、加载/错误态）
css/                     10 个样式文件（variables / layout / hero / nav / cards / lab / responsive / reset / states / showcase）
data/site.js             页面固定文案（首屏文案直出，列表数据走后端，见下）
lib/api.js               后端地址与 fetch 的唯一出口
lib/motion.js            "减少动态效果"判断（无障碍）
lib/useScrollReveal.js   滚动浮现（anime.js 的 onScroll 驱动）
app/fonts/               自托管中文字体（子集化产物，见 scripts/subset-fonts.py）
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

## 玻璃：为什么只有磨砂、没有折射

这一版曾经实现过**真实折射**（按每个面板尺寸生成位移图，用
`backdrop-filter: blur() url(#位移滤镜)` 让背景像隔着流动的液体一样扭曲），
实现是对的、也量化验证过，但最后按取舍删掉了：

- 只在背景**有颜色过渡**的地方看得出来，纯色渐变处几乎为零——这是光学事实，不是实现问题；
  背景特征的尺度还必须明显大于位移量，否则周期纹理会发生相位绕回，看起来像没动；
- 代价是滚动时多花约 13%（12 个图层各挂一个 SVG 滤镜）：实测 p50
  无玻璃 29ms / 只有模糊 33.7ms / 模糊+折射 38.7ms。

留下的三条经验（改玻璃之前先看）：

1. **面板不能有 `opacity < 1` 或 `isolation: isolate`**：它们会让面板变成 backdrop root，
   只采得到自己的底色、采不到页面背景。所以滚动浮现只动 `transform`，不动 `opacity`。
2. **`filter: url()` 和 `backdrop-filter: url()` 不是一回事**：`filter` 作用的是元素自己画的东西，
   对背景毫无影响（实测差异 0.00），只有 `backdrop-filter: url()` 才扭曲背景。
3. **底色不能太"白"**：一度用了 72% 的白，面板内部成了不透明白板，背景色一点透不过来，
   玻璃就成了贴纸。现在的 42%→10%→26% 是看截图调出来的。

想要把折射加回来：`git show 042a2a1:frontend/lib/glassRefraction.js`，
对照实验在 `scripts/fixtures/glass-repro.html`，量化工具是 `scripts/png-analyze.py`。

## 中文字体

字体栈里的 `PingFang SC` 只有 Mac 有，Windows 会退到微软雅黑，同一份作品在不同电脑上长得不一样。
所以自托管一份 **Noto Sans SC 可变字体**，并用 `scripts/subset-fonts.py` 裁剪到本站用到的字：

```bash
.venv/bin/python scripts/subset-fonts.py     # 16.9MB → 253KB
```

⚠️ 站点文案改了要重新跑一次，否则新字会落到系统字体上（不会出豆腐块，但风格不统一）。

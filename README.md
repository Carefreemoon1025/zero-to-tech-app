# zero-to-tech-app

**个人主页 + 文字实验室**：一个完整的全栈 Web 项目。前端 Next.js，后端 FastAPI，
输入一段中文，拿回**带声调的拼音**和**情感判断**，历史记录按访客会话隔离。

> 🌐 线上地址（阿里云 ECS，nginx + systemd）：**<http://120.25.73.53/>**
> 📄 部署细节：[`docs/DEPLOY.md`](docs/DEPLOY.md)

这个项目按「零到全栈」课程的终点形态独立重建：从课程 demo 里取骨架，
但**接口、会话、错误处理、部署全部自己实现**，并修掉了 demo 里若干"能演示但不能上线"的写法
（下面「踩过的坑」一节有具体记录）。

---

## 1. 功能

| 页面 | 做什么 |
|---|---|
| `/` 个人主页 | 文案全部来自后端 `GET /api/profile`；后端不可用时显示错误态 + 重试，**不用打底数据糊弄** |
| `/text-lab` 文字实验室 | 输入中文 → `POST /api/analyze` 返回拼音与情感分数（分数滚动动画）→ 历史记录弹窗 `GET /api/history` |

- 拼音：带声调转写，标点、英文、数字原样保留（`pypinyin`）
- 情感：可解释的关键词规则打分（0~1），支持否定词反转
- 历史：SQLite 持久化，**按 cookie 会话隔离**——换个浏览器就是另一份历史
- 状态完备：加载中 / 成功 / 失败 / 空数据四种状态在 UI 上都有明确表现
- 无障碍：键盘可达（弹窗焦点陷阱、Esc 关闭、焦点归还）、`aria-live` 播报结果、
  尊重系统「减少动态效果」

## 2. 技术栈与选型理由

| 层 | 选型 | 为什么 |
|---|---|---|
| 前端 | Next.js 15（App Router）+ React 19 | 文件即路由，`app/` 目录天然把两个页面分开；服务端组件让纯展示组件不必给浏览器发 JS |
| 动画 | anime.js 4 | 卡片入场与分数滚动。**只让它算数值，DOM 交给 React**（见「踩过的坑」②） |
| 后端 | FastAPI + uvicorn | 用 Pydantic 声明式定义请求体，自动生成 `/docs` 交互式接口文档；异步框架但对本项目这种"短请求 + 少量 IO"足够 |
| 拼音 | pypinyin | 成熟词典库，没必要自己维护汉字-拼音表 |
| 情感 | **自己写的规则** | 见下 |
| 存储 | SQLite（标准库 `sqlite3`） | 一张表、两个查询，用 ORM 只是多一层映射；零依赖、零迁移工具，1.7G 内存的小服务器上尤其划算 |
| 会话 | cookie + CORS credentials | 课程终点的形态；后端下发 `HttpOnly` cookie 作为访客标识 |
| 反向代理 | nginx | 让前端与 `/api` **同源**，彻底绕开跨源问题，cookie 也天然可用 |
| 进程管理 | systemd | 开机自启 + 崩溃自动拉起，比 `nohup` 裸跑可靠；日志进 journald |

### 为什么情感分析不上模型

这个接口的价值不在"多准"，而在**可解释**：每条分数都能说清是哪几个词贡献的，
毫秒级返回、零额外依赖、零调用成本。上模型会把项目变成"调 API"，反而丢掉了对打分逻辑的表达。
规则化的代价是精度有限，见文末「已知局限」——写清楚比假装没有好。

```
score = 0.5 + min(正向词命中数 × 0.12, 0.45) − min(负向词命中数 × 0.12, 0.45)
裁剪到 [0,1]；≥0.6 偏积极，≤0.4 偏消极，其余中性
```

- 单向上限 0.45：防止"好好好好好"把分数刷满
- 否定词（不/没/无/别/非/莫）紧贴词前会反转语义：「不开心」判为消极
- 词表里本身带否定字的（「不错」）走例外名单，不再反转

## 3. 架构

```
                        ┌──────────────────────────── 阿里云 ECS（1.7G 内存）────────────────────────────┐
                        │                                                                              │
  浏览器 ──HTTP :80──►  │  nginx                                                                       │
                        │   ├── location /api/  ──►  127.0.0.1:8000   uvicorn ── FastAPI ──┬─ analysis.py（拼音/情感）
                        │   ├── location /      ──►  127.0.0.1:3000   next start           └─ db.py ── SQLite
                        │   └── location ~ /\.  ──►  403（挡住 .git/.env 扫描）                            │
                        │                                                                              │
                        │  systemd: zero-to-tech-frontend / zero-to-tech-backend（www-data，Restart=always）│
                        └──────────────────────────────────────────────────────────────────────────────┘
```

前端与 `/api` 同源 → 生产环境不需要 CORS；开发环境 `:3000 → :8000` 跨源，
所以后端仍保留 `ALLOWED_ORIGINS` 白名单，两边共用同一套代码。

**前端数据流**：`lib/api.js` 是后端地址与 `fetch` 的唯一出口（读 `NEXT_PUBLIC_API_BASE_URL`），
组件里不出现任何域名；它同时统一带上 `credentials: "include"`——浏览器对跨源请求默认**不带** cookie，
漏了这一个参数，后端就会把同一个访客当成每次都新来的，历史记录永远只剩一条。

## 4. 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/profile` | 主页文案 |
| POST | `/api/analyze` | 请求 `{"text":"..."}` → `{text, pinyin, score, label}`，同时落库 |
| GET | `/api/history` | 当前会话的历史记录，按时间**倒序**（`?limit=`，默认 50，上限 200） |
| GET | `/api/health` | 健康检查（部署自测用） |

```bash
curl -s http://120.25.73.53/api/profile
curl -s -X POST http://120.25.73.53/api/analyze \
     -H 'Content-Type: application/json' -d '{"text":"今天很开心"}'
#   → {"text":"今天很开心","pinyin":"jīn tiān hěn kāi xīn","score":0.62,"label":"偏积极"}
curl -s -c jar.txt -b jar.txt http://120.25.73.53/api/history   # 带 cookie 才是"你的"历史
```

**错误格式统一为 `{"detail": "..."}`，而且 `detail` 一定是字符串**：
前端直接把 `body.detail` 当文案显示，而 FastAPI 默认的 422 返回的是**数组**（每个字段一条），
会显示成 `[object Object]`。所以后端加了一个异常处理器把它压成一句人话。

## 5. 会话隔离怎么做的

1. 每个请求过一遍 `current_session` 依赖：读 cookie `ztt_sid`，没有或格式不对就 `uuid4()`
   现场发一个（`HttpOnly` + `SameSite=Lax`，有效期 180 天）。
2. 分析结果落库时带上这个 `session_id`。
3. 读历史时 `WHERE session_id = ?`。

**数据库是一份，每个访客只看到自己那份**。实测：同一浏览器两次分析 → 历史 2 条；
换新用户目录 → 0 条；关掉浏览器再开（同一用户目录）→ 2 条仍在。详见第 8 节。

另外，时间统一**存 UTC ISO 字符串**（`2026-09-21T07:24:22Z`），显示时才转本地时区——
存本地时间的话，服务器换时区、访客跨时区，历史记录的时间就全乱了。

## 6. 本地运行

```bash
# 后端 :8000
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000

# 前端 :3000（另开一个终端）
cd frontend
npm install
npm run dev            # 后端地址来自 .env.development
```

打开 <http://localhost:3000>。后端的交互式接口文档在 <http://127.0.0.1:8000/docs>。

## 7. 部署

```bash
scripts/deploy.sh            # 同步 + 装依赖 + 构建 + 重启 + 经 nginx 自测
```

拓扑、systemd 单元与 nginx 配置全文、备份与回滚步骤都在 **[`docs/DEPLOY.md`](docs/DEPLOY.md)**。

## 8. 怎么验证的（不是"看起来对"）

界面和行为用一个自写的端到端脚本 `scripts/cdp-check.mjs` 驱动**真实无头 Chromium**
（Chrome DevTools Protocol）逐项断言：它打开页面、跑一段 JS、把结果和**控制台错误**一起打出来，
退出码非 0 即失败。用 CDP 而不是 Playwright/Puppeteer：Node 22+ 自带 `fetch` 与 `WebSocket`，
这个脚本 200 行搞定，不往仓库里塞一个几百 MB 的浏览器依赖。

```bash
node scripts/cdp-check.mjs --url http://localhost:3000/text-lab --eval-file flow.js
node scripts/cdp-check.mjs --url http://localhost:3000/ --width 375 --height 812   # 响应式
node scripts/cdp-check.mjs --url http://localhost:3000/ --reduced-motion           # 无障碍分支
```

实测结论：

| 验证项 | 结果 |
|---|---|
| 后端在线时的主页 | 渲染出来自 `/api/profile` 的数据；卡片 `opacity=1` |
| **关掉后端**时的主页 | 显示「连不上后端服务」+ 重试按钮，且**完全没有**任何打底文案（逐条断言过） |
| 跨源 + cookie | 浏览器里点「开始分析」成功，历史弹窗立刻能看到刚写入的 1 条 |
| 会话隔离 | 同一 profile 重启浏览器：cookie 还在，历史仍是那 2 条；换 profile：0 条 |
| 分数动画 | 连续分析两句分别显示 `0.74` / `0.26`（修 bug 前会停在初始占位数字） |
| 375×812 窄屏 | 无横向溢出；卡片各占一行；弹窗不出屏 |
| 键盘无障碍 | 打开弹窗焦点落在「关闭」；Tab 不跑出弹窗；关闭后焦点归还触发按钮 |
| `prefers-reduced-motion` | 不跑入场动画，但卡片仍然可见（`opacity=1`） |
| 控制台 | 后端在线时错误数 **0**（含 favicon） |
| 生产构建 | `npm run build` 通过；产物中断言不含 `localhost:8000` |

后端接口另有一组 curl 验证（正常/空文本/超长/坏 JSON/CORS 预检/白名单外来源），
以及 `analysis.py` 里的 `doctest`：

```bash
cd backend && python -m doctest analysis.py
```

线上（公网）用 curl 覆盖了 HTTP 全链路：两个页面 200、静态资源 200、三个接口正常、
空文本 400 且 `detail` 为字符串、`/.git/config` 403、重启服务后全部恢复。

## 9. 踩过的坑（都是实测出来的，不是推演）

① **卡片是隐形的**。卡片入场动画在组件挂载时查一次 `.card`，可主页的卡片要等数据到位才渲染——
挂载那一刻它们还不存在，于是永远停在 CSS 里的 `opacity: 0`：文字抓得到，眼睛看不见。
改成 `MutationObserver` 盯着容器，后进场的卡片补一次入场动画。

② **分数不刷新**。原写法是 `animate(el, { innerHTML: scrambleText(...) })`，让 anime.js 直接改
DOM 的 `innerHTML`——这跟 React 抢同一块 DOM。React 以为自己渲染了 `0.74`，实际节点早被
anime.js 换掉，页面上就停在挂载时那个占位数字上再也刷不动。
改成"anime.js 动画一个普通 JS 数值 + `onUpdate` 回 React state"，React 独占 DOM，两边不打架，
换新结果还会重新滚一次。

③ **生产产物里混进了 `localhost:8000`**。前端地址放在 `.env.local` 会被 `next build` 读到，
部署后就变成访客浏览器去连自己的 localhost。改成 `.env.development`（只有 `next dev` 加载），
生产构建天然留空 = 同源；构建后加了一条 `grep` 断言。

④ **CORS 不能用 `*`**。`Access-Control-Allow-Origin: *` 和 `Allow-Credentials: true` 浏览器不认，
带 cookie 的跨源请求会直接失败——所以白名单必须写具体来源。

⑤ **测试工具也会骗人**。验证"关掉浏览器再打开，会话还在"时一直失败，最后发现是脚本用
`SIGKILL` 结束 Chrome，它来不及把 cookie 落盘。改成走 CDP 的 `Browser.close` 优雅关闭后，
行为才是真实的。**测出问题先怀疑测试。**

## 10. 目录结构

```
zero-to-tech-app/
├── frontend/                Next.js 应用
│   ├── app/                 layout（全站外壳）+ page（主页）+ text-lab/page + icon.svg
│   ├── components/          HomeView / TextLabView / InputCard / ResultCard / HistoryModal
│   │                        Nav / PageHeading / AnimatedCardGrid
│   ├── css/                 variables / reset / layout / hero / nav / cards / lab / responsive / states
│   ├── data/site.js         页面固定文案（主页文案已归后端）
│   └── lib/                 api.js（后端地址与 fetch 的唯一出口）、motion.js（减少动态效果判断）
├── backend/                 FastAPI 服务
│   ├── main.py              接口、CORS、会话 cookie、错误格式统一
│   ├── analysis.py          拼音 + 关键词情感打分（纯函数，带 doctest）
│   ├── db.py                SQLite 建表/写入/按会话查询
│   └── profile.py           主页文案
├── scripts/
│   ├── deploy.sh            一键部署（rsync + 远端构建 + 重启 + 自测）
│   └── cdp-check.mjs        用 CDP 驱动无头 Chromium 做端到端验证
└── docs/DEPLOY.md           服务器、systemd、nginx、回滚、验证清单
```

## 11. 已知局限与可以继续做的

- **情感判断看不懂上下文**：词表匹配对反讽、比喻、双重否定（"我一点都不难过"）会判错；
  要更准就得上模型，那是另一个取舍。词表也只在中文、短文本上调过。
- **历史记录只能看，不能删**：没有删除接口，也没有分页（`limit` 之外没做游标）。
- **会话靠 cookie**：清掉 cookie 就等于换了个访客，旧历史还在库里但找不回来；
  想要"跨设备的历史"就得引入真正的账号体系。
- 没有自动化测试框架：目前是 `doctest` + 端到端脚本 + curl 清单，
  再往下就该上 `pytest` + CI，把第 8 节那张表固化成可重复执行的门禁。

# backend

FastAPI 服务：给前端提供主页文案、文本分析（拼音 + 情感）与历史记录。

## 跑起来

```bash
python3 -m venv .venv && source .venv/bin/activate   # 或直接用仓库根目录的 .venv
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

启动时会自动建表（SQLite），无需额外初始化步骤。交互式文档在 <http://127.0.0.1:8000/docs>。

## 文件

| 文件 | 职责 |
|---|---|
| `main.py` | FastAPI 应用：三个接口、CORS、会话 cookie |
| `analysis.py` | 拼音转换 + 关键词情感打分（纯函数，带 doctest） |
| `db.py` | SQLite 建表、写入、按会话查询 |
| `profile.py` | 主页文案数据 |

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/profile` | 主页文案 |
| POST | `/api/analyze` | 请求 `{"text": "..."}`，返回 `{text, pinyin, score, label}`，同时落库 |
| GET | `/api/history` | 当前会话的历史记录，**倒序**；`?limit=` 可选（默认 50，上限 200） |
| GET | `/api/health` | 健康检查 |

**所有错误都返回 `{"detail": "..."}` 且 detail 一定是字符串**——前端 `InputCard.jsx`
直接把它当文案显示，所以连 FastAPI 默认的 422 数组格式也在 `main.py` 里改写成了字符串。

```bash
curl -s http://127.0.0.1:8000/api/profile
curl -s -X POST http://127.0.0.1:8000/api/analyze \
     -H 'Content-Type: application/json' -d '{"text":"今天很开心"}'
curl -s -c jar.txt -b jar.txt http://127.0.0.1:8000/api/history   # 带 cookie 才是"你的"历史
```

## 会话隔离怎么做的

1. 每个请求经过 `current_session` 依赖：读 cookie `ztt_sid`，没有或格式不对就 `uuid4()` 发一个新的
   （`HttpOnly` + `SameSite=Lax`，前端 JS 读不到）。
2. 分析结果落库时带上这个 `session_id`。
3. 读历史时 `WHERE session_id = ?`，所以**数据库是一份，每个访客只看到自己那份**。

curl 验证：`-c jar.txt` 保存 cookie、`-b jar.txt` 带上，换一个 jar 就是另一个访客，历史互不可见。

## 情感打分怎么算的

关键词规则，不走模型：

```
score = 0.5 + min(正向词命中数 × 0.12, 0.45) − min(负向词命中数 × 0.12, 0.45)
score 裁剪到 [0, 1]；≥0.6 偏积极，≤0.4 偏消极，其余中性
```

- 单个词权重 0.12、单向上限 0.45，避免一句话靠堆词刷到 0 或 1。
- 否定词（不/没/无/别/非/莫）紧贴词前会反转语义："不开心" 判为消极。
- 词表里本身带否定字的（"不错"）走 `NEGATION_EXCEPTIONS`，不再反转。

**已知局限**（如实写在 README 里比假装没有好）：纯词表匹配看不懂反讽、比喻和上下文，
"我一点都不难过" 这类双重否定也会判错。要更准就得上模型，那是另一个取舍。

跑一下自带的用例：

```bash
python -m doctest analysis.py      # 拼音与打分的示例
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_PATH` | `backend/data/history.db` | SQLite 文件位置 |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | CORS 白名单，逗号分隔 |
| `COOKIE_SECURE` | `false` | 上了 HTTPS 后设为 `true` |

> ⚠️ `ALLOWED_ORIGINS` **不能填 `*`**：浏览器禁止 `Allow-Origin: *` 与
> `Allow-Credentials: true` 同时出现，带 cookie 的跨源请求会直接失败。

## 本地沙箱备注

本机的 python3.14 没装 pip / ensurepip（`apt install python3-pip` 需要 root），
仓库根目录的 `.venv` 是这样引导出来的，正常机器上直接 `python3 -m venv` 即可：

```bash
apt-get download python3-pip && dpkg-deb -x python3-pip_*.deb root/
python3 -m venv --without-pip .venv
PYTHONPATH=$PWD/root/usr/lib/python3/dist-packages \
    .venv/bin/python -m pip install --no-cache-dir -r backend/requirements.txt
```

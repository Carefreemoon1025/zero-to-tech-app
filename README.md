# zero-to-tech-app

按「零到全栈」课程终点独立重建的完整全栈 Web 项目：**个人主页 + 文字实验室**两个页面，
前端负责交互与动画，后端提供数据、拼音与情感分析接口，并带历史记录与会话隔离。

> 🚧 本 README 为骨架，最终面向面试官的完整版（架构图、技术选型取舍、运行与部署说明）在 **M7** 补齐。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 15（App Router）+ React 19 + anime.js 4 |
| 后端 | Python + FastAPI + uvicorn（:8000） |
| 存储 | SQLite（Python 标准库 `sqlite3`，零额外依赖） |
| 会话 | cookie + CORS credentials，按访客隔离历史 |
| 反向代理 | nginx（:80）同时反代前端与 `/api` |

## 目录结构

```
zero-to-tech-app/
├── frontend/        Next.js 应用（页面、组件、样式）
├── backend/         FastAPI 服务（接口、拼音、情感规则、SQLite）
├── AGENTS.md        项目交接与工作约定
└── README.md        本文件
```

## 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/profile` | 主页文案数据 |
| POST | `/api/analyze` | 传入文本，返回拼音 + 情感分数与文案 |
| GET | `/api/history` | 当前会话的历史记录，按时间倒序 |

错误统一返回 `{"detail": "..."}`。

## 本地运行

```bash
# 后端（:8000）
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# 前端（:3000）
cd frontend && npm install && npm run dev
```

## 部署

阿里云 ECS `120.25.73.53`：nginx 反代 `/api` → `127.0.0.1:8000`，`/` → `127.0.0.1:3000`，
前后端各由 systemd 托管。详细步骤见 M7 版本。

## 与课程原项目的隔离

本项目与 `~/zero-to-tech`（学习项目）完全隔离：不共用依赖、不改动其仓库、不覆盖其文件。

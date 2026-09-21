"""zero-to-tech-app 后端：FastAPI 三个接口 + 会话 cookie。

跑起来：
    uvicorn main:app --reload --port 8000

接口：
    GET  /api/profile   主页文案
    POST /api/analyze   文本 → 拼音 + 情感分数
    GET  /api/history   当前会话的历史记录（倒序）
    GET  /api/health    健康检查（部署时给 nginx / 监控用）

错误格式统一为 {"detail": "..."}——前端 InputCard 读的就是这个字段。
"""

import os
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import analysis
import db
from profile import PROFILE

# ---------------------------------------------------------------- 配置

# 会话 cookie 名。前端不直接读它（httponly），只是浏览器自动带上、后端用来分组。
SESSION_COOKIE = "ztt_sid"
SESSION_MAX_AGE = 60 * 60 * 24 * 180  # 半年

# 允许的前端来源。**不能写 "*"**：浏览器禁止 `Access-Control-Allow-Origin: *`
# 与 `Access-Control-Allow-Credentials: true` 同时出现，带 cookie 的跨源请求会直接失败。
# 生产环境前端与 /api 同源（nginx 反代），其实用不到 CORS，
# 这里保留列表是为了本地开发（:3000 → :8000）也能跑。
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

# 生产如果上了 HTTPS，把这个打开，cookie 就只走加密连接
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"

MAX_TEXT_LENGTH = 500  # 一条文本最多多少字，防止有人拿接口当存储用


# ---------------------------------------------------------------- 应用

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()  # 启动时建表（幂等）
    yield


app = FastAPI(
    title="zero-to-tech-app API",
    version="1.0.0",
    description="个人主页数据 + 中文文本的拼音转换与情感分析，历史记录按会话隔离。",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,   # 允许浏览器带上 cookie —— 会话隔离的前提
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """把 FastAPI 默认的 422 错误体压成一句人话。

    默认返回的 detail 是**数组**（每个字段一条），前端 `body.detail` 直接当字符串用，
    数组会显示成 "[object Object]"。这里统一成字符串，前端不用为它写特例。
    """
    return JSONResponse(status_code=422, content={"detail": "请求体格式不正确，应形如 {\"text\": \"...\"}"})


# ---------------------------------------------------------------- 会话

def current_session(request: Request, response: Response) -> str:
    """取当前访客的会话 id；没有就现场发一个。

    FastAPI 会把这里 `response.set_cookie` 写下的头合并进最终响应，
    所以"读 cookie"和"下发 cookie"可以在同一个依赖里完成。
    """
    session_id = request.cookies.get(SESSION_COOKIE)
    if not _valid_session_id(session_id):
        session_id = uuid.uuid4().hex
        response.set_cookie(
            key=SESSION_COOKIE,
            value=session_id,
            max_age=SESSION_MAX_AGE,
            httponly=True,      # 前端 JS 读不到，降低 XSS 偷走会话的风险
            samesite="lax",     # 常规同站跳转带上，跨站 POST 不带
            secure=COOKIE_SECURE,
            path="/",
        )
    return session_id


def _valid_session_id(value: str | None) -> bool:
    """只接受我们自己发的 32 位十六进制串，避免伪造的怪 cookie 进数据库。"""
    return bool(value) and len(value) == 32 and all(c in "0123456789abcdef" for c in value)


# ---------------------------------------------------------------- 接口

@app.get("/api/profile", summary="主页文案")
def get_profile() -> dict:
    return PROFILE


class AnalyzeRequest(BaseModel):
    """请求体只有 text 一个字段。"""

    text: str


@app.post("/api/analyze", summary="分析文本（拼音 + 情感）")
def post_analyze(payload: AnalyzeRequest, session_id: str = Depends(current_session)) -> dict:
    text = payload.text.strip()
    # 校验放在这里而不是 Field(...) 里，是为了让错误也走 {"detail": "..."} 这条统一通道
    if not text:
        raise HTTPException(status_code=400, detail="文本不能为空")
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400, detail=f"文本太长，最多 {MAX_TEXT_LENGTH} 字（当前 {len(text)} 字）"
        )

    result = analysis.analyze(text)
    # 分析成功就落库，历史记录因此天然是"真实发生过的分析"
    db.add_record(
        session_id,
        text=result["text"],
        pinyin=result["pinyin"],
        score=result["score"],
        label=result["label"],
    )
    return result


@app.get("/api/history", summary="当前会话的历史记录（倒序）")
def get_history(
    limit: int = 50, session_id: str = Depends(current_session)
) -> list[dict]:
    # 只返回当前 cookie 对应会话的记录 —— 换个浏览器/清掉 cookie 就是另一份历史
    return db.list_records(session_id, limit=max(1, min(limit, 200)))


@app.get("/api/health", summary="健康检查")
def get_health() -> dict:
    return {"status": "ok"}

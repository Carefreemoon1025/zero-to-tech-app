"""SQLite 存储层：建表、写入一条分析记录、按会话读取历史。

为什么用 sqlite3 而不是 ORM：本项目只有一张表、两个查询，
Python 标准库自带 sqlite3，零额外依赖、零迁移工具，服务器上也少装一堆东西。
换 SQLAlchemy 只会让人多读一层映射，收益为零。

会话隔离（模块 6.6 的核心）：每条记录都带 session_id，
读历史时只返回当前 cookie 对应的那一条会话的记录——
数据库是"一个"，但每个访客看到的是"自己的那一份"。
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

# 默认把库文件放在 backend/data/ 下；部署时可用环境变量 DB_PATH 指到别处
_DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "history.db"
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL,
    text       TEXT    NOT NULL,
    pinyin     TEXT    NOT NULL,
    score      REAL    NOT NULL,
    label      TEXT    NOT NULL,
    created_at TEXT    NOT NULL          -- UTC ISO 8601，如 2026-09-16T08:30:00Z
);

-- 主查询是"按会话取最近 N 条"，索引直接按 (session_id, id 倒序) 建
CREATE INDEX IF NOT EXISTS idx_history_session
    ON history (session_id, id DESC);
"""


def db_path() -> str:
    return os.environ.get("DB_PATH") or _DEFAULT_DB_PATH


def utc_now_iso() -> str:
    """当前 UTC 时间，形如 2026-09-16T08:30:00Z。

    规矩（课程 6.3）：**存 UTC，显示时再转本地**。
    存本地时间的话，服务器换时区、用户跨时区，历史记录的时间就全乱了。
    """
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


@contextmanager
def connect():
    """每次操作开一条短连接。

    sqlite3 的连接不能跨线程复用（FastAPI 的同步接口跑在线程池里），
    而这个量级下"开连接"的成本可以忽略，所以用最简单也最安全的写法。
    """
    path = db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row  # 查询结果按列名取值，比下标好读
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """建表。幂等，可在启动时反复调用。"""
    with connect() as conn:
        conn.executescript(SCHEMA)


def add_record(
    session_id: str, text: str, pinyin: str, score: float, label: str
) -> dict:
    """写入一条记录并原样返回（含数据库生成的 id 和 UTC 时间）。"""
    created_at = utc_now_iso()
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO history (session_id, text, pinyin, score, label, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (session_id, text, pinyin, score, label, created_at),
        )
        record_id = cursor.lastrowid
    return {
        "id": record_id,
        "text": text,
        "pinyin": pinyin,
        "score": score,
        "label": label,
        "created_at": created_at,
    }


def list_records(session_id: str, limit: int = 50) -> list[dict]:
    """按时间**倒序**返回某个会话的历史记录。"""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, text, pinyin, score, label, created_at
            FROM history
            WHERE session_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]

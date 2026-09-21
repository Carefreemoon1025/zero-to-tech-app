"use client";

// 历史记录弹窗：把 /api/history 拿到的数组逐条列出来。
// 用弹窗而不是再加一张卡，是为了不把页面撑得太长；
// 它也**不关心**这个数组是"全站的"还是"某个访客自己的"——会话隔离在后端和 cookie 里，
// 这里只负责把拿到的数组画好。所以它拿到的是 status + items，而不是自己去判断该显示什么。
import { useEffect, useId, useRef } from "react";

// 后端存的是 UTC 时间（6.3 立的规矩：存 UTC，显示时再转本地）。
// 这里就是"转本地"的那一步——浏览器知道用户在哪个时区，交给它换算。
function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryModal({ open, status, items, error, onRetry, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);

  // 按 Esc 关闭 + 打开时把焦点移到关闭按钮（键盘用户不用先 Tab 半天）
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // 点遮罩关闭；点弹窗本体时 stopPropagation，免得误关
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="section-kicker">历史记录</p>
            <h3 id={titleId}>最近的分析</h3>
          </div>
          <button
            type="button"
            className="modal-close"
            ref={closeButtonRef}
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        {status === "loading" && (
          <p className="history-empty" role="status">正在加载历史记录…</p>
        )}

        {status === "error" && (
          <div role="alert">
            <p className="panel-status panel-status-error">{error}</p>
            <button type="button" className="ghost-button" onClick={onRetry}>
              重试
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <p className="history-empty">还没有记录，先分析一句试试。</p>
        )}

        {status === "ready" && items.length > 0 && (
          <div className="history-list">
            {/* 列表渲染：照着数组逐条长出来。key 用数据库发的那个唯一 id */}
            {items.map((item) => (
              <div className="history-item" key={item.id}>
                <p className="history-text">{item.text}</p>
                <span className="history-meta">
                  {item.score} · {item.label} · {formatTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

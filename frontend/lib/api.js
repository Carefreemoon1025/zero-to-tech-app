// 后端地址的唯一出口。
//
// demo（5-5）把 `http://localhost:8000` 写死在组件里，直接部署必然出问题：
// 生产环境前端和后端不同源，写死的地址会让浏览器去访问"访客自己的 localhost"。
// 所以这里统一从环境变量读，组件一律用 apiFetch()，任何地方都不再出现域名。
//
// NEXT_PUBLIC_API_BASE_URL 的取值：
//   - 本地开发：http://localhost:8000（前端 :3000 / 后端 :8000，不同源，走 CORS）
//   - 生产部署：留空 —— 前端与 /api 同源，由 nginx 把 /api 反代到后端 :8000
//
// 注意这里拼的是"后端基地址"，接口路径仍写全（/api/profile）。
// 这样无论基地址是空、是域名、还是带端口的地址，结果都是对的。
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

// 会话隔离靠 cookie。浏览器默认对跨源请求**不带** cookie
// （fetch 的 credentials 默认是 same-origin），必须显式 include，
// 否则后端每次都把我们当新访客，历史记录永远只有一条。
// 后端那边也相应要求 allow_credentials=True —— 两边必须成对出现。
export function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), { credentials: "include", ...options });
}

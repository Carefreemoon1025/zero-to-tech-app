# 部署说明（阿里云 ECS）

线上地址：**<http://120.25.73.53/>** ｜ 主机：阿里云 ECS，Ubuntu 26.04，1.7G 内存 / 40G 磁盘（含 2G swap）

## 1. 线上长什么样

```
浏览器 ──HTTP:80──► nginx ──┬── /       ──► 127.0.0.1:3000  Next.js（next start）
                            ├── /api/   ──► 127.0.0.1:8000  FastAPI（uvicorn）
                            └── /.      ──► 403（隐藏文件一律拒绝）

/opt/zero-to-tech-app/
├── frontend/        源码 + node_modules + .next（构建产物）
└── backend/         源码 + .venv + data/history.db（线上真实数据）

systemd：zero-to-tech-frontend.service / zero-to-tech-backend.service
         两个都 enabled（开机自启）+ Restart=always（崩了自动拉起），以 www-data 身份运行
```

后端只监听 `127.0.0.1:8000`，前端只监听 `127.0.0.1:3000`，**外网只能从 80 端口进**，
由 nginx 决定去向。这样后端不需要暴露、也不需要配 HTTPS/防火墙规则。

前端与 `/api` **同源**，所以生产环境根本用不到 CORS，cookie 也天然可用
（开发环境 `:3000 → :8000` 才需要，所以后端仍保留 `ALLOWED_ORIGINS` 白名单）。

## 2. 一次性准备（已经做完，重装系统时才需要重来）

```bash
# ① Node 22 LTS —— apt 源里的版本旧，用阿里云镜像的官方包，放 /opt/node
curl -sL -o /tmp/node.tar.xz \
  https://mirrors.aliyun.com/nodejs-release/v22.23.2/node-v22.23.2-linux-x64.tar.xz
mkdir -p /opt/node && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1
ln -sf /opt/node/bin/{node,npm,npx} /usr/local/bin/
printf 'export PATH=/opt/node/bin:$PATH\n' > /etc/profile.d/node.sh

# ② npm 源换国内镜像：直连 registry.npmjs.org 要 15s+，npmmirror 只要 2s
npm config set registry https://registry.npmmirror.com --location=global

# ③ Ubuntu 的 python3.14 默认没有 ensurepip，不装这个包装不了 venv
apt-get install -y python3.14-venv
```

## 3. 日常部署：一条命令

```bash
scripts/deploy.sh                 # 同步 + 装依赖 + 构建 + 重启 + 自测
scripts/deploy.sh --skip-build    # 只改了后端时用（省掉 26s 的 next build）
scripts/deploy.sh --no-restart    # 只想推代码，不重启
```

脚本做的事（`scripts/deploy.sh`）：

1. `rsync -az --delete` 从本机推到 `/opt/zero-to-tech-app`，
   **排除** `node_modules`、`.next`、`.venv`、`*.db`——这些是服务器自己生成/线上真实数据，
   不能被本机覆盖（尤其是 SQLite 里的历史记录）；
2. 远端 `.venv/bin/pip install -r requirements.txt`（走阿里云 PyPI 镜像，0.06s 响应）；
3. 远端 `npm install && npm run build`；
4. `chown -R www-data:www-data`（服务以 www-data 跑）+ 重启两个 systemd 服务；
5. 经 nginx 自测 `/`、`/text-lab`、`/api/health`、`/api/profile` 全是 200。

> 关于构建位置：服务器 1.7G 内存 + 2G swap，`next build` 实测 26s 通过，没触发 OOM，
> 所以采用"服务器上直接构建"，省掉本地/远端产物同步的一致性问题。
> 如果哪天内存吃紧，退路是本地 `npm run build` 后 rsync `.next` 上去。

## 4. systemd 单元（`/etc/systemd/system/`）

`zero-to-tech-backend.service`

```ini
[Unit]
Description=zero-to-tech-app backend (FastAPI/uvicorn)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/zero-to-tech-app/backend
Environment=DB_PATH=/opt/zero-to-tech-app/backend/data/history.db
Environment=ALLOWED_ORIGINS=http://120.25.73.53
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/zero-to-tech-app/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`zero-to-tech-frontend.service` 的 `ExecStart` 直接跑 next 的入口，
**不套一层 npm**——`npm start` 会多一个中间进程，systemd 停止时信号要多绕一手：

```ini
ExecStart=/opt/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
```

常用命令：

```bash
systemctl status zero-to-tech-backend
journalctl -u zero-to-tech-frontend -f
systemctl restart zero-to-tech-frontend
```

## 5. nginx（`/etc/nginx/sites-available/default`）

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";

    location /api/ { proxy_pass http://127.0.0.1:8000; proxy_read_timeout 30s; }
    location /     { proxy_pass http://127.0.0.1:3000; proxy_read_timeout 30s; }
    location ~ /\. { deny all; }
}
```

- `proxy_pass` **不带路径**：`/api/profile` 原样转给后端，后端路由也叫 `/api/profile`，
  两边不用互相迁就（带了 `/` 就会把前缀吃掉，出现 404 或 `/api/api/...`）。
- `location ~ /\.` 这条必须留着：会挡住 `/.git/config`、`/.env` 之类。
  日志里天天有扫描器在试 `/.env`、`/app/.git/config`，实测返回 403。

改配置前先备份、改完先测再重载：

```bash
cp -a /etc/nginx/sites-available/default /home/myue/backups/default.nginx.$(date +%Y%m%d-%H%M%S)
nginx -t && systemctl reload nginx
```

## 6. 回滚

模块 3.5 的旧静态站文件一直在 `/home/myue/zero-to-tech`，**一个字节都没动**；
nginx 旧配置备份在 `/home/myue/backups/default.nginx.20260915-171812`。

```bash
cp /home/myue/backups/default.nginx.20260915-171812 /etc/nginx/sites-available/default
nginx -t && systemctl reload nginx
# 需要的话再停掉新项目：systemctl disable --now zero-to-tech-frontend zero-to-tech-backend
```

## 7. 上线验证清单（实测结果）

| 检查项 | 结果 |
|---|---|
| `curl http://120.25.73.53/` | 200，标题「关于我 · zero to tech」 |
| `curl http://120.25.73.53/text-lab` | 200，标题「文字实验室 · zero to tech」 |
| `/_next/static/...`、`/icon.svg` | 200（静态资源经 nginx 正常透传） |
| `GET /api/profile` | 200，返回主页文案 JSON |
| `POST /api/analyze` | 200，`score=0.74`，并 `Set-Cookie: ztt_sid=...`（HttpOnly） |
| `GET /api/history`（带 cookie） | 1 条刚写入的记录 |
| `GET /api/history`（换 cookie） | `[]` —— 会话隔离在线上同样成立 |
| `POST /api/analyze`（空文本） | 400 `{"detail":"文本不能为空"}` |
| `GET /.git/config` | 403 |
| 重启两个服务后再测 | 4 个路径全部 200，服务 `enabled`（开机自启） |

> 说明：本项目**前端渲染层面**（点击分析、分数动画、历史弹窗、响应式、控制台无报错）
> 是在本地用无头 Chromium 跑 `scripts/cdp-check.mjs` 逐项验证的；
> 线上验证走 curl（本机沙箱里的 Chromium 不允许访问外网）。
> 线上跑的是同一份代码、同一个 commit 构建出来的产物。

## 8. 踩过的坑（省得下次再踩）

1. **`python3 -m venv` 失败**：Ubuntu 26.04 的 python3.14 没带 `ensurepip`，
   报 "ensurepip is not available"，`apt install python3.14-venv` 解决。
2. **`npm install` 卡 15s+**：`registry.npmjs.org` 在国内访问很慢，换 npmmirror 后 9s 装完。
3. **生产产物里混进 `localhost:8000`**：环境变量放在 `.env.local` 会被 `next build` 读到。
   改成 **`.env.development`**（只有 `next dev` 加载），生产构建天然留空 = 同源。
   构建后可以用 `grep -rl localhost:8000 .next/static` 断言为 0。
4. **本机 `/usr/local/bin` 软链"没生效"**：执行 `ln -sf` 的脚本里 `node` 还不在 PATH
   （`npm` 的 shebang 是 `#!/usr/bin/env node`）。先建软链再调用，或直接用绝对路径。
5. **改完 nginx 第一次 reload 后仍是旧行为**：`nginx -t` 通过、reload 返回 0 也要**再测一次**；
   确认无误可再 `systemctl reload nginx` 一次，或看 worker 进程是否已换新。
6. **沙箱里的 Chromium 访问不了外网**（`net::ERR_BLOCKED_BY_CLIENT`），
   所以"公网浏览器验证"这一步在沙箱内做不到，改用 curl 覆盖 HTTP 全链路。
